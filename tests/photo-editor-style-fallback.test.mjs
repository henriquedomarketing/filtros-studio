import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const js=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../photo-editor.css',import.meta.url),'utf8');
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');

test('Safari recebe o CSS do editor mesmo quando arquivo CSS não carrega',()=>{
  const match=js.match(/const PHOTO_EDITOR_INLINE_STYLES=`([\s\S]*?)`;/);
  assert.ok(match,'CSS crítico deve estar embutido no JavaScript');
  assert.equal(match[1],css,'A versão embutida precisa ser idêntica à folha de estilos');
  assert.match(js,/function ensurePhotoEditorStyles\(\)/);
  assert.match(js,/function render\(\)\{\s*ensurePhotoEditorStyles\(\)/);
});
test('Visualização da foto pronta mantém tamanhos e botões grandes',()=>{
  assert.match(css,/\.fs-result-picture\{/);
  assert.match(css,/\.fs-result-premium\{/);
  for(const action of ['photo-edit','photo-save','photo-retake'])
    assert.match(js,new RegExp('data-act="'+action+'"'));
});
test('Edição móvel possui foto enquadrada, controles e campo legível',()=>{
  for(const name of ['fs-photo-editor','fs-edit-stage','fs-edit-panel','fs-edit-compose','fs-edit-fonts'])
    assert.match(css,new RegExp('\\.'+name+'\\{'));
  assert.match(css,/@media\(max-height:690px\)/);
  assert.match(js,/photoTextComposeDone\(\)/);
  assert.match(js,/\$\('photoTextInput'\)\?\.blur\(\)/);
});
test('Versões do CSS e JavaScript foram renovadas para evitar cache antigo',()=>{
  assert.match(html,/photo-editor\.css\?v=20261109-editor-frame-v6/);
  assert.match(html,/app\.js\?v=20261109-editor-frame-v6/);
});
