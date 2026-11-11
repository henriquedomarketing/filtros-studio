import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../photo-editor.css',import.meta.url),'utf8');

function extract(name){
  const match=app.match(new RegExp('function '+name+'\\([^]*?\\n\\}'));
  assert.ok(match,'Função ausente: '+name);
  return match[0];
}
const mockFont=Object.fromEntries(Array.from({length:15},(_,i)=>['f'+i,{css:'Arial,sans-serif',weight:700,label:'Fonte '+(i+1)}]));
const fonts=Object.fromEntries([['modern',{css:'Arial,sans-serif',weight:700,label:'Modern'}],...Object.entries(mockFont)]);
function makeView(texts,tool){
  const state={captureData:{url:'blob:test',width:1080,height:1350,format:'feed'},
    photoEditor:{texts,tool,selectedId:texts[0]?.id||null}};
  const htmlEscape=s=>String(s);
  const view=new Function('app','PHOTO_TEXT_FONTS','PHOTO_TEXT_COLORS','photoTextActive','photoTextLayer','photoEyedropperView','escapeHtml',
    'return ('+extract('photoEditorView')+')')(
      state,fonts,['#FFFFFF','#000000'],()=>texts[0]||null,
      ()=>'',()=>'',
      htmlEscape);
  return view();
}

test('Adicionar texto aparece acima da foto, nunca duplicado no rodapé',()=>{
  const html=makeView([],null);
  const button=html.indexOf('data-act="text-add"');
  const image=html.indexOf('id="photoTextStage"');
  const toolbar=html.indexOf('aria-label="Ferramentas de texto"');
  assert.ok(button>0&&button<image,'Botão deve aparecer antes da foto');
  assert.ok(image<toolbar,'Painel inferior vem depois da foto');
  assert.equal((html.match(/data-act="text-add"/g)||[]).length,1);
  assert.match(html,/fs-simple-empty/);
  assert.match(css,/\.fs-photo-editor \.fs-simple-panel\.fs-simple-empty\{/);
  assert.match(css,/display:none!important/);
});

test('botão superior permanece e as ferramentas aparecem após escrever',()=>{
  const html=makeView([{id:'t1',text:'Bom dia',size:80,font:'modern',color:'#FFFFFF',style:'plain'}],null);
  assert.equal((html.match(/data-act="text-add"/g)||[]).length,1);
  assert.ok(html.indexOf('data-act="text-add"')<html.indexOf('id="photoTextStage"'));
  assert.doesNotMatch(html,/fs-simple-empty/);
  assert.match(html,/data-id="text"/);
  assert.match(html,/data-id="size"/);
});

test('editor começa apenas com Adicionar texto, sem controles pequenos',()=>{
  const html=makeView([],null);
  assert.match(html,/data-act="text-add"/);
  assert.doesNotMatch(html,/class="fs-simple-tools"/);
  assert.doesNotMatch(html,/data-act="text-font"/);
  assert.doesNotMatch(html,/data-act="text-eyedropper"/);
  assert.doesNotMatch(html,/id="photoTextSize"/);
});

test('após escrever, mostra somente quatro opções grandes e nenhuma aba aberta',()=>{
  const html=makeView([{id:'t1',text:'Bom dia',size:80,font:'modern',color:'#FFFFFF',style:'plain'}],null);
  const buttons=(html.match(/class="fs-simple-tool(?: [^"]*)?"/g)||[]).length;
  assert.equal(buttons,4);
  assert.match(html,/data-id="text"/);
  assert.match(html,/data-id="size"/);
  assert.match(html,/data-id="color"/);
  assert.match(html,/data-id="style"/);
  assert.doesNotMatch(html,/data-act="text-delete"/);
  assert.doesNotMatch(html,/data-act="text-font"/);
  assert.doesNotMatch(html,/data-act="text-color"/);
  assert.doesNotMatch(html,/data-act="text-style"/);
});

test('aba Tamanho mostra controles dedicados sem expor fontes ou cores',()=>{
  const html=makeView([{id:'t1',text:'Bom dia',size:80,font:'modern',color:'#FFFFFF',style:'plain'}],'size');
  assert.doesNotMatch(html,/data-act="text-font"/);
  assert.match(html,/data-act="text-smaller"/);
  assert.match(html,/data-act="text-larger"/);
  assert.match(html,/id="photoTextSize"/);
  assert.doesNotMatch(html,/data-act="text-color"/);
});
test('abas Texto, Cor e Estilo são independentes',()=>{
  const text=[{id:'t1',text:'Bom dia',size:80,font:'modern',color:'#FFFFFF',style:'plain'}];
  const color=makeView(text,'color'),style=makeView(text,'style'),editing=makeView(text,'text');
  assert.match(editing,/data-act="text-edit"/);
  assert.match(editing,/data-act="text-delete"/);
  assert.doesNotMatch(editing,/data-act="text-color"/);
  assert.match(color,/data-act="text-eyedropper"/);
  assert.match(color,/data-act="text-color"/);
  assert.doesNotMatch(color,/data-act="text-style"/);
  assert.match(style,/data-act="text-style"/);
  assert.match(style,/data-act="text-font"/);
  assert.doesNotMatch(style,/data-act="text-color"/);
});

test('texto inicial é Modern, branco e com sombra; sem criação automática na abertura',()=>{
  const editor=app.slice(app.indexOf('function photoTextOpen(){'),app.indexOf('function photoTextSyncPixels(){'));
  assert.match(editor,/font:'modern',color:'#FFFFFF',style:'plain'/);
  assert.match(editor,/size:80/);
  assert.doesNotMatch(editor,/if\(!texts\.length\)photoTextAdd\(\)/);
  assert.match(css,/\.fs-edit-text-plain span\{text-shadow:/);
});

test('pinça e botões podem reduzir até 4px, sem interferir no enquadramento',()=>{
  assert.match(app,/Math\.max\(4,Math\.min\(600,Math\.round\(start\.size\*scale\)\)\)/);
  assert.match(app,/Math\.max\(4,Math\.min\(600,Math\.round\(item\.size\*/);
  assert.match(app,/function photoTextPointerMove\(event\)/);
  assert.match(css,/\.fs-photo-editor \.fs-edit-text\{/);
  assert.match(css,/min-width:36px/);
  assert.match(app,/Math\.max\(-\.20,Math\.min\(1\.20,start\.y/);
});
