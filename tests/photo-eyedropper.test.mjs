import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../photo-editor.css',import.meta.url),'utf8');
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');

test('botão conta-gotas visível e independente da faixa de cores rolável',()=>{
  const editor=source.slice(source.indexOf('function photoEditorView(){'),source.indexOf('function photoEyedropperView(){'));
  assert.match(editor,/data-act="text-eyedropper"/);
  assert.match(editor,/Conta-gotas: escolher cor da foto ou moldura/);
  assert.match(editor,/class="fs-edit-eyedropper"/);
  assert.match(css,/\.fs-edit-eyedropper\{/);
  assert.match(css,/\.fs-eye-overlay\{/);
});

test('amostragem lê pixels do PNG final 1080x1920 e 1080x1350',()=>{
  const match=source.match(/function photoEyedropperSamplePoint\(colorContext,x,y\)\{[\s\S]*?\n\}/);
  assert.ok(match,'Função de amostragem precisa existir');
  const sample=new Function('return ('+match[0]+')')();
  const ctx={canvas:{width:1080,height:1350},getImageData(x,y,w,h){
    assert.equal(w,1);assert.equal(h,1);
    return {data:[x===1079?255:0,y===1349?201:127,64,255]};
  }};
  assert.equal(sample(ctx,1,1),'#FFC940');
  assert.equal(sample(ctx,0,0),'#007F40');
  const story={...ctx,canvas:{width:1080,height:1920}};
  assert.equal(sample(story,1,1),'#FF7F40');
});

test('conta-gotas só seleciona cor após confirmação',()=>{
  assert.match(source,/function cancelPhotoEyedropper\(\)/);
  assert.match(source,/function usePhotoEyedropperColor\(\)/);
  assert.match(source,/selected\.color=pick\.color/);
  assert.match(source,/if\(selected\.style==='light'\)selected\.style='plain'/);
  assert.match(source,/function photoEyedropperPointerDown\(/);
  assert.match(source,/function photoEyedropperPointerMove\(/);
  assert.match(source,/touch-action:none/);
});

test('fontes web e cores personalizadas são exportadas sem trocar a fonte',()=>{
  const fonts=source.slice(source.indexOf('const PHOTO_TEXT_FONTS='),source.indexOf('const PHOTO_TEXT_COLORS='));
  assert.equal((fonts.match(/family:/g)||[]).length,15);
  assert.match(source,/document\.fonts\.load\(/);
  assert.match(source,/for\(const item of texts\)await loadPhotoTextFont\(item\)/);
  assert.match(html,/fonts\.googleapis\.com\/css2/);
  assert.match(html,/20261111-editor-edge-v12/);
});
