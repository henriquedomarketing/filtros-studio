import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const src=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const styles=readFileSync(new URL('../styles.css',import.meta.url),'utf8');
const start=src.indexOf('function authMarkup(){');
const end=src.indexOf('function layout(content)',start);
assert.ok(start>0&&end>start,'A tela de login deve existir');
const loginSource=src.slice(start,end);

test('Tela inicial apresenta login sem cadastro ou primeiro acesso',()=>{
  assert.match(loginSource,/Bem-vindo de volta/);
  assert.match(loginSource,/id="authForm"/);
  assert.match(loginSource,/type="submit">Entrar/);
  assert.doesNotMatch(loginSource,/Primeiro acesso|Criar conta|register-view|login-view|Criar conta inicial/);
});

test('Link de dúvidas abre o WhatsApp de suporte em nova aba',()=>{
  assert.match(loginSource,/class="auth-support-link"/);
  assert.match(loginSource,/>Tire suas dúvidas<\/span>/);
  assert.match(loginSource,/https:\/\/wa\.me\/5544997497915/);
  assert.match(loginSource,/target="_blank" rel="noopener noreferrer"/);
  assert.match(styles,/\.auth-support-link\{/);
});

test('Login não permite cadastro público e preserva entrada por senha',()=>{
  assert.doesNotMatch(src,/api\.auth\.signUp/);
  assert.doesNotMatch(src,/act==='register-view'/);
  assert.match(src,/api\.auth\.signInWithPassword/);
  assert.match(src,/manager\(\{action:'create'/);
});
