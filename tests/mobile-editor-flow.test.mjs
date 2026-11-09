import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../photo-editor.css',import.meta.url),'utf8');
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const between=(start,end)=>app.slice(app.indexOf(start),app.indexOf(end,app.indexOf(start)+start.length));
const drawCoverSource=app.match(/function drawSourceCover\(ctx,source,width,height\)\{[\s\S]*?\n\}/)?.[0];
const drawFrameSource=app.match(/function drawFramedSource\(ctx,source,width,height,framing\)\{[\s\S]*?\n\}/)?.[0];
assert.ok(drawCoverSource&&drawFrameSource,'Ambos os recortes devem existir');
const drawSourceCover=new Function('return ('+drawCoverSource+')')();
const drawFramedSource=new Function('drawSourceCover','return ('+drawFrameSource+')')(drawSourceCover);

function crop(imageSize,output,framing){
  const source={naturalWidth:imageSize[0],naturalHeight:imageSize[1]};
  let args;
  drawFramedSource({drawImage(...params){args=params;}},source,output[0],output[1],framing);
  const [,x,y,w,h,,,dstWidth,dstHeight]=args;
  assert.equal(dstWidth,output[0]);
  assert.equal(dstHeight,output[1]);
  assert.ok(x>=0&&y>=0&&w>0&&h>0,'O recorte deve permanecer dentro da imagem');
  assert.ok(x+w<=source.naturalWidth+1e-6&&y+h<=source.naturalHeight+1e-6,'Sem áreas transparentes no enquadramento');
  return {x,y,w,h};
}

test('foto vertical 9:16 pode ser movida verticalmente em moldura 4:5 sem zoom',()=>{
  const centered=crop([1080,1920],[1080,1350],{zoom:1,dx:0,dy:0});
  const top=crop([1080,1920],[1080,1350],{zoom:1,dx:0,dy:.211111111});
  const bottom=crop([1080,1920],[1080,1350],{zoom:1,dx:0,dy:-.211111111});
  assert.equal(centered.y,285);
  assert.ok(top.y<.001);
  assert.ok(bottom.y>569.999);
});

test('zoom e deslocamento 9:16 preservam a imagem e as dimensões da saída',()=>{
  const base=crop([4000,3000],[1080,1920],{zoom:1,dx:0,dy:0});
  const zoom=crop([4000,3000],[1080,1920],{zoom:2.2,dx:.30,dy:.08});
  assert.ok(zoom.w<base.w&&zoom.h<base.h);
  assert.notEqual(zoom.x,base.x);
});

test('enquadramento é posterior à captura e separado da moldura',()=>{
  const camera=between('function cameraView(){','function framingView(){');
  const capture=between('async function capture(){','function shareCapturedPhoto(');
  assert.doesNotMatch(camera,/id="photoFramingZoom"|class="client-framing-controls"|client-framing-guide/);
  assert.match(capture,/app\.framingDraft=\{sourceUrl,ownsSourceUrl,overlayUrl:src,/);
  assert.match(capture,/app\.page='framing'/);
  assert.match(app,/function framingView\(\)/);
  assert.match(app,/function framingPointerMove\(/);
  assert.match(app,/function finishPhotoFraming\(/);
  assert.match(app,/drawFramedSource\(ctx,source,canvas\.width,canvas\.height,d\)/);
  assert.match(css,/\.fs-frame-overlay\{/);
  assert.match(css,/\.fs-frame-stage\{/);
  assert.match(css,/touch-action:none!important/);
});

test('editor mantém somente o campo de escrita, com opções após Pronto',()=>{
  const view=between('function photoEditorView(){','function photoTextOpen(){');
  const compose=view.slice(view.indexOf('<div class="fs-edit-compose hidden"'));
  assert.match(compose,/id="photoTextInput"/);
  assert.match(compose,/data-act="text-compose-done"/);
  assert.doesNotMatch(compose,/fs-edit-compose-fonts|fs-edit-compose-options/);
  assert.match(view,/fs-edit-fonts/);
  assert.match(view,/fs-edit-colors/);
  assert.match(view,/id="photoTextSize"/);
});

test('15 fontes disponíveis para personalizar depois de escrever',()=>{
  const fontSection=between('const PHOTO_TEXT_FONTS=','const PHOTO_TEXT_COLORS=');
  assert.equal((fontSection.match(/label:/g)||[]).length,15);
  assert.match(fontSection,/modern:/);
  assert.match(fontSection,/signature:/);
  assert.match(fontSection,/fashion:/);
});

test('resultado tem botão dourado EDITAR FOTO e apenas Salvar/Nova foto',()=>{
  const result=between('function previewView(){','function supportContactMarkup(){');
  assert.match(result,/EDITAR FOTO/);
  assert.match(result,/data-act="photo-save"/);
  assert.match(result,/data-act="photo-retake"/);
  assert.doesNotMatch(result,/data-act="photo-whatsapp"|data-act="photo-instagram"/);
  assert.match(css,/\.client-app\.is-preview \.fs-result-buttons \.fs-result-premium\{/);
  assert.match(css,/#fae6ae/);
  assert.match(css,/#18130b/);
});

test('cores, proporções e cache coerentes com a identidade Filtros Studio',()=>{
  assert.match(css,/\.fs-photo-editor,\.fs-framing-screen\{/);
  assert.match(css,/background-color:#001893!important/);
  assert.match(css,/fs-frame-stage\[data-format="feed"\]/);
  assert.match(html,/app\.js\?v=20261109-editor-frame-v8/);
  assert.match(html,/photo-editor\.css\?v=20261109-editor-frame-v8/);
});
