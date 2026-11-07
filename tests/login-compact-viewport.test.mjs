import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const css=readFileSync(new URL('../studio-unified-blue.css',import.meta.url),'utf8');
const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const compact=css.slice(css.indexOf('/* Login compacto: cabe no viewport móvel'));

test('login compacto limita cabeçalho e reduz margens para a área útil do iPhone',()=>{
  assert.match(compact,/\.auth-layout \.auth-card>\.brand\{\s*min-height:clamp\(145px,26dvh,235px\)!important/);
  assert.match(compact,/\.auth-layout \.auth-card \.form\{\s*gap:clamp\(8px,1\.3dvh,12px\)!important/);
  assert.match(compact,/\.auth-layout \.auth-card \.field input\{\s*min-height:48px!important/);
  assert.match(compact,/\.auth-layout \.auth-card \.btn-primary\{\s*min-height:50px!important/);
  assert.match(compact,/\.auth-layout \.studio-credits-auth\{/);
  assert.match(compact,/@media\(max-height:650px\)/);
});

test('login conserva rolagem de segurança quando teclado abre ou viewport é baixo',()=>{
  assert.match(css,/overflow-x:hidden!important;overflow-y:auto!important/);
  assert.doesNotMatch(compact,/overflow-y:hidden|position:fixed/);
  assert.match(compact,/min-height:100dvh!important/);
  assert.doesNotMatch(compact,/^[ \t]*height:100dvh!important/m);
  assert.match(app,/id="authForm"/);
  assert.match(app,/api\.auth\.signInWithPassword/);
  assert.match(app,/class="auth-support-link"/);
});
