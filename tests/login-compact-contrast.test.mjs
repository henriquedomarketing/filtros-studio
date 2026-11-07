import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const css=readFileSync(new URL('../studio-unified-blue.css',import.meta.url),'utf8');
const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const compact=css.slice(css.indexOf('/* Login compacto:'),css.length);
const auth=app.slice(app.indexOf('function authMarkup(){'),app.indexOf('function layout(content)',app.indexOf('function authMarkup(){')));

test('Login mobile ocupa um viewport, sem bloquear rolagem para teclado/zoom',()=>{
  assert.match(compact,/\.auth-layout:has\(> \.auth-card\)\{/);
  assert.match(compact,/height:100dvh!important/);
  assert.match(compact,/overflow-y:auto!important/);
  assert.match(compact,/\.auth-layout \.auth-card>\.brand\{/);
  assert.match(compact,/min-height:clamp\(150px,25dvh,238px\)!important/);
  assert.match(compact,/@media\(max-height:690px\)/);
  assert.match(compact,/min-height:clamp\(115px,20dvh,150px\)!important/);
});

test('Crédito da autoria mantém contraste no fundo azul, inclusive links',()=>{
  assert.match(app,/Desenvolvido por <strong>@henriquedomarketing<\/strong>/);
  assert.match(app,/Desde 2025 · Todos os direitos reservados\./);
  assert.match(compact,/\.auth-layout \.studio-credits-auth strong,/);
  assert.match(compact,/\.auth-layout \.studio-credits-auth a,/);
  assert.match(compact,/color:#fff!important/);
  assert.match(compact,/-webkit-text-fill-color:#fff!important/);
});

test('Preservados login, senha, suporte e autenticação atual',()=>{
  assert.match(auth,/id="authForm"/);
  assert.match(auth,/Nome de usuário/);
  assert.match(auth,/Senha/);
  assert.match(auth,/type="submit">Entrar/);
  assert.match(auth,/auth-support-link/);
  assert.match(app,/api\.auth\.signInWithPassword/);
});
