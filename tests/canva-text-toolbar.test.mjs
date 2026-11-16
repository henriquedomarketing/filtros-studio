import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../photo-editor.css',import.meta.url),'utf8');
test('editor mostra barra contextual e alças para texto selecionado',()=>{
  assert.match(app,/fs-canva-toolbar/);
  assert.match(app,/data-act="text-duplicate"/);
  assert.match(app,/data-text-handle="scale"/);
  assert.match(app,/data-text-handle="rotate"/);
  assert.match(css,/outline:2px solid #9747ff/);
});
test('gestos de alças, duplicação e edição direta estão conectados',()=>{
  assert.match(app,/drag\.handle==='scale'/);
  assert.match(app,/drag\.handle==='rotate'/);
  assert.match(app,/if\(act==='text-duplicate'\)/);
  assert.match(app,/photoTextComposeOpen\(\)/);
  assert.match(app,/photoTextRefreshControls\(\)/);
});
test('estilo de fallback acompanha controles contextuais',()=>{
  assert.match(app,/const PHOTO_EDITOR_INLINE_STYLES=/);
  assert.match(app,/\.fs-canva-toolbar\{/);
  assert.match(css,/\.fs-canva-toolbar\{/);
});
