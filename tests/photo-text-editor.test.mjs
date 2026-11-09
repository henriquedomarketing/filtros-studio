import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../photo-editor.css',import.meta.url),'utf8');
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
function between(begin,end){
  const a=app.indexOf(begin),b=app.indexOf(end,a+begin.length);
  assert.ok(a!==-1&&b>a,'Trechos encontrados: '+begin);
  return app.slice(a,b);
}
const preview=between('function previewView(){','function supportContactMarkup(){');
const editor=between('function photoEditorView(){','function photoTextOpen(){');
const exportCode=between('async function photoTextFinish(){','function previewView(){');
const wrapCode=between('function photoTextWrap(ctx,text,maxWidth){','function photoTextDraw(ctx,item){');
const drawCode=between('function photoTextDraw(ctx,item){','async function photoTextFinish(){');

test('A foto final é simples e mantém somente as ações solicitadas',()=>{
  for(const action of ['photo-edit','photo-save','photo-whatsapp','photo-instagram','photo-retake'])
    assert.match(preview,new RegExp('data-act="'+action+'"'));
  assert.doesNotMatch(preview,/Sua foto ficou pronta|FOTO FINALIZADA|photo-change-filter|photo-share/);
  assert.match(preview,/fs-result-premium/);
  assert.match(css,/\.fs-result-premium/);
});
test('Editor oferece fontes, cores, estilos e texto livre',()=>{
  assert.match(editor,/data-act="text-add"/);
  for(const act of ['text-font','text-style','text-color','text-finish','text-cancel','text-delete'])
    assert.match(editor,new RegExp('data-act="'+act+'"'));
  assert.match(editor,/photoTextInput/);
  assert.match(editor,/fs-edit-compose-fonts/);
  assert.match(app,/const PHOTO_TEXT_COLORS=/);
  assert.match(css,/\.fs-edit-stage/);
  assert.match(css,/touch-action:none/);
});
test('O texto é incorporado ao PNG 1080 por 1920 e o filtro original é preservado para reedição',()=>{
  assert.match(exportCode,/canvas\.width=1080;canvas\.height=1920/);
  assert.match(exportCode,/ctx\.drawImage\(image,0,0,1080,1920\)/);
  assert.match(exportCode,/photoTextDraw\(ctx,item\)/);
  assert.match(exportCode,/photo\.baseUrl\|\|photo\.url/);
  assert.match(exportCode,/photo\.file=new File\(\[blob\]/);
  assert.match(app,/photo\.baseBlob=photo\.blob;photo\.baseUrl=photo\.url/);
  assert.match(app,/if\(app\.captureData\?\.baseUrl/);
});
test('Os controles de toque e tamanho estão registrados',()=>{
  assert.match(app,/addEventListener\('pointerdown',photoTextPointerDown\)/);
  assert.match(app,/addEventListener\('pointermove',photoTextPointerMove/);
  assert.match(app,/addEventListener\('pointerup',photoTextPointerUp/);
  assert.match(app,/addEventListener\('input',photoTextInputChanged\)/);
  assert.match(app,/drag\.x\+dx\/rect\.width/);
  assert.match(app,/drag\.y\+dy\/rect\.height/);
});
test('Quebra de texto respeita o limite horizontal da foto',()=>{
  const wrap=new Function('return ('+wrapCode.trim()+')')();
  const ctx={measureText:text=>({width:text.length*10})};
  const lines=wrap(ctx,'Bom dia a todos\nNovidades na loja',110);
  assert.deepEqual(lines,['Bom dia a','todos','Novidades','na loja']);
  assert.ok(lines.every(line=>ctx.measureText(line).width<=110));
});
test('Desenho em Canvas é compatível com navegadores sem roundRect',()=>{
  const wrap=new Function('return ('+wrapCode.trim()+')')();
  const draw=new Function('photoTextFont','photoTextWrap','return ('+drawCode.trim()+')')(
    ()=>({weight:'700',canvas:'Arial, sans-serif'}),wrap);
  const operations=[];
  const ctx={
    save(){},restore(){},beginPath(){},
    measureText:text=>({width:text.length*10}),
    moveTo(){},lineTo(){},quadraticCurveTo(){},closePath(){},
    fill(){operations.push('bg')},
    fillText(){operations.push('text')},
    strokeText(){operations.push('stroke')}
  };
  draw(ctx,{text:'Bom dia',font:'modern',style:'dark',color:'#FFFFFF',size:92,x:.5,y:.5});
  assert.deepEqual(operations,['bg','text']);
  draw(ctx,{text:'Vendido',font:'modern',style:'outline',color:'#FFFFFF',size:92,x:.5,y:.5});
  assert.deepEqual(operations.slice(-2),['stroke','text']);
});
test('Nova folha visual é carregada depois do tema principal e módulo ganha versão nova',()=>{
  assert.ok(html.indexOf('photo-editor.css')>html.indexOf('studio-unified-blue.css'));
  assert.match(html,/app\.js\?v=20261109-texto-stories-v1/);
});
