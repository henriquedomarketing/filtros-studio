import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../photo-editor.css',import.meta.url),'utf8');
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');

function extract(name){
  const found=app.match(new RegExp('function '+name+'\\([^]*?\\n\\}'));
  assert.ok(found,'Função ausente: '+name);
  return new Function('return ('+found[0]+')')();
}
const snapshot=extract('photoTextGestureSnapshot');
const transform=extract('photoTextGestureTransform');

test('gestos do editor aceitam um e dois dedos',()=>{
  const one=snapshot(new Map([[1,{x:100,y:200}]]));
  assert.deepEqual(one,{center:{x:100,y:200},distance:1});
  const two=snapshot(new Map([[1,{x:100,y:200}],[2,{x:200,y:200}]]));
  assert.deepEqual(two,{center:{x:150,y:200},distance:100});
});

test('um dedo movimenta o texto sem mudar o tamanho',()=>{
  const start={center:{x:100,y:100},distance:1,x:.5,y:.5,size:92};
  const p=transform(start,{center:{x:160,y:160},distance:1},{width:300,height:500});
  assert.equal(p.size,92);
  assert.ok(Math.abs(p.x-.7)<.0001);
  assert.ok(Math.abs(p.y-.62)<.0001);
});

test('dois dedos aumentam e diminuem, preservando o posicionamento',()=>{
  const start={center:{x:140,y:250},distance:100,x:.5,y:.5,size:100};
  const larger=transform(start,{center:{x:160,y:200},distance:175},{width:300,height:500});
  assert.equal(larger.size,175);
  assert.ok(Math.abs(larger.x-(.5+20/300))<.001);
  assert.ok(Math.abs(larger.y-.4)<.001);
  const smaller=transform(start,{center:{x:140,y:250},distance:50},{width:300,height:500});
  assert.equal(smaller.size,50);
});

test('limites evitam escala extrema, números inválidos e imagem movida',()=>{
  const start={center:{x:100,y:100},distance:100,x:.5,y:.5,size:100};
  const large=transform(start,{center:{x:999,y:-999},distance:900},{width:300,height:500});
  assert.equal(large.size,320);
  assert.equal(large.x,.93);
  assert.equal(large.y,.05);
  const tiny=transform(start,{center:{x:0,y:0},distance:1},{width:300,height:500});
  assert.equal(tiny.size,36);
  const pointer=app.slice(app.indexOf('function photoTextPointerDown('),app.indexOf('function photoTextWrap('));
  assert.match(pointer,/editor\.drag\.pointers\.size>=2/);
  assert.match(pointer,/stage\.setPointerCapture\(event\.pointerId\)/);
  assert.match(pointer,/photoTextGestureRebase\(editor\)/);
  assert.doesNotMatch(pointer,/drawFramedSource|framingDraft|galleryBase/);
});

test('prévia em px compatível com navegadores sem unidades cqw',()=>{
  assert.match(app,/function photoTextSyncPixels\(\)/);
  assert.match(app,/stage\.getBoundingClientRect\(\)\.width/);
  assert.match(app,/window\.visualViewport\?\.addEventListener\('resize',photoTextSyncPixels/);
  assert.match(css,/\.fs-edit-stage,\.fs-edit-layers\{/);
  assert.match(css,/touch-action:none/);
});

test('botão dourado mostra coroa e EDITAR FOTO, com brilho reduzível',()=>{
  const result=app.slice(app.indexOf('function previewView(){'),app.indexOf('function supportContactMarkup(){'));
  assert.match(result,/fs-premium-crown/);
  assert.match(result,/👑/);
  assert.match(result,/EDITAR FOTO/);
  assert.match(css,/@keyframes fs-premium-sheen/);
  assert.match(css,/prefers-reduced-motion:reduce/);
  assert.match(css,/animation:none/);
  assert.match(html,/app\.js\?v=20261109-premium-pinch-v10/);
});

test('confirmações do editor usam o dourado premium',()=>{
  assert.match(css,/\.fs-edit-top \.fs-edit-top-done,/);
  assert.match(css,/\.fs-frame-top \.fs-frame-done,/);
  assert.match(css,/\.fs-eye-header \.fs-eye-confirm,/);
  assert.match(css,/\.fs-edit-compose-head button\{/);
  assert.match(css,/#e6bf66/);
});
