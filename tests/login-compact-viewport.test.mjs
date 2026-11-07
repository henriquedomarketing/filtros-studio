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

test('faixa branca ocupa quase metade do viewport do iPhone, conforme referência',()=>{
  const reference=css.slice(css.indexOf('/* Referência aprovada: a faixa branca'));
  assert.match(reference,/@media\(max-width:700px\) and \(min-height:721px\)/);
  assert.match(reference,/\.auth-layout \.auth-card>\.brand\{/);
  assert.match(reference,/height:49dvh!important/);
  assert.match(reference,/min-height:49dvh!important/);
  assert.match(reference,/flex:0 0 49dvh!important/);
  assert.match(reference,/\.auth-layout \.auth-card \.form\{/);
  assert.match(reference,/margin:clamp\(14px,2\.5dvh,25px\) auto 0!important/);
  assert.match(reference,/@media\(max-width:700px\) and \(max-height:720px\)/);
  assert.match(reference,/height:34dvh!important/);
  assert.match(reference,/max-height:820px/);
  assert.match(reference,/height:43dvh!important/);
  assert.match(css,/overflow-y:auto!important/);
});
