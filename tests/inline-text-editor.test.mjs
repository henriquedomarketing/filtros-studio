import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../photo-editor.css',import.meta.url),'utf8');
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');

function extract(name){
  const i=app.indexOf('function '+name+'(');
  assert.ok(i>=0,'Função '+name+' presente');
  const j=app.indexOf('\nfunction ',i+9);
  const k=app.indexOf('\nasync function ',i+9);
  const end=Math.min(...[j,k].filter(n=>n>=0));
  return app.slice(i,Number.isFinite(end)?end:app.length).trim();
}

test('campo diretamente na imagem e sem caixa de confirmação por frase',()=>{
  const view=app.slice(app.indexOf('function photoEditorView(){'),app.indexOf('function photoEyedropperView(){'));
  const stage=view.indexOf('id="photoTextStage"');
  const field=view.indexOf('id="photoTextInput"');
  const panel=view.indexOf('aria-label="Ferramentas de texto"');
  assert.ok(stage>=0 && field>stage && field<panel,'Textarea dentro do palco');
  assert.match(view,/enterkeyhint="done"/);
  assert.match(view,/data-act="text-add"/);
  assert.match(view,/Salvar edição/);
  assert.doesNotMatch(view,/text-compose-done|>Pronto<|fs-edit-compose hidden/);
  assert.match(css,/\.fs-edit-inline-input\.hidden\{display:none!important\}/);
});

test('tap simples edita, arraste movimenta e toque fora fecha teclado',()=>{
  assert.match(app,/if\(tapped\)photoTextComposeOpen\(\)/);
  assert.match(app,/drag\.moved/);
  assert.match(app,/photoTextOutsidePointerDown/);
  assert.match(app,/addEventListener\('pointerdown',photoTextOutsidePointerDown,true\)/);
  assert.match(app,/addEventListener\('focusout',photoTextInputBlurred\)/);
  assert.match(app,/photoTextStageClicked/);
  assert.match(app,/editor\.ignoreStageClick/);
  assert.match(app,/field\.focus\(\{preventScroll:true\}\)/);
  assert.match(extract('photoTextInputChanged'),/Não reconstruir o textarea/);
});

test('pinça pode rotacionar em qualquer direção e exportação respeita ângulo',()=>{
  const fn=new Function('return ('+extract('photoTextGestureAngle')+')')();
  assert.equal(fn(new Map([[1,{x:0,y:0}],[2,{x:10,y:0}]])),0);
  assert.equal(fn(new Map([[1,{x:0,y:0}],[2,{x:0,y:10}]])),90);
  assert.match(app,/values\.rotation=Math\.round/);
  assert.match(app,/ctx\.rotate\?\.\(\(Number\(item\.rotation\)\|\|0\)\*Math\.PI\/180\)/);
  const wrap=new Function('return ('+extract('photoTextWrap')+')')();
  const draw=new Function('photoTextFont','photoTextWrap','return ('+extract('photoTextDraw')+')')(
    ()=>({weight:700,canvas:'Arial'}),wrap);
  const calls=[],ctx={canvas:{width:1080,height:1920},save(){},restore(){},translate(...args){calls.push(['translate',...args])},
    rotate(a){calls.push(['rotate',a])},measureText:s=>({width:s.length*20}),fillText(){},beginPath(){},fill(){}};
  draw(ctx,{text:'Teste',x:.5,y:.5,size:80,font:'modern',color:'#fff',style:'none',rotation:90});
  assert.deepEqual(calls[0],['translate',540,960]);
  assert.ok(Math.abs(calls[1][1]-Math.PI/2)<.00001);
});

test('fonte, cor, tamanho, sombra suave e forte continuam disponíveis',()=>{
  const view=app.slice(app.indexOf('function photoEditorView(){'),app.indexOf('function photoEyedropperView(){'));
  assert.match(view,/data-act="text-font"/);
  assert.match(view,/data-act="text-color"/);
  assert.match(view,/data-act="text-smaller"/);
  assert.match(view,/data-act="text-eyedropper"/);
  assert.match(view,/Sombra suave/);
  assert.match(view,/Sombra forte/);
  assert.match(view,/Sem sombra/);
  assert.match(css,/\.fs-edit-text-shadow span/);
  assert.match(css,/\.fs-edit-text-none span/);
});

test('fallback CSS e URL do app são atualizados juntos',()=>{
  assert.match(app,/const PHOTO_EDITOR_INLINE_STYLES=/);
  assert.match(app,/\.fs-edit-inline-input\.hidden/);
  assert.match(html,/app\.js\?v=20261116-texto-direto-v14/);
  assert.match(html,/photo-editor\.css\?v=20261116-texto-direto-v14/);
});
