import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const src=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const edge=readFileSync(new URL('../supabase/functions/manage-client/index.ts',import.meta.url),'utf8');
const db=readFileSync(new URL('../supabase/migrations/20261103_007_username_client_login.sql',import.meta.url),'utf8');
const start=src.indexOf('const clientUsernamePattern=');
const end=src.indexOf('async function authSubmit(',start);
assert.ok(start>0&&end>start,'Client username helpers present');
const helpers=new Function(src.slice(start,end)+'\nreturn {normalizeClientUsername,loginAuthEmail};')();

test('Cliente faz login com nome de usuário sem fornecer e-mail',()=>{
  assert.equal(helpers.loginAuthEmail('p4veiculos'),'p4veiculos@usuarios.filtros.studio');
  assert.equal(helpers.loginAuthEmail(' SHOPCAR '),'shopcar@usuarios.filtros.studio');
  assert.equal(helpers.loginAuthEmail('ricci_veiculos'),'ricci_veiculos@usuarios.filtros.studio');
  assert.equal(helpers.normalizeClientUsername('P4VEICULOS'),'p4veiculos');
});

test('Administrador conserva login por e-mail sem alteração',()=>{
  assert.equal(helpers.loginAuthEmail('entreemcontato.br@gmail.com'),'entreemcontato.br@gmail.com');
  assert.equal(helpers.loginAuthEmail(' ADMIN@EXEMPLO.COM '),'admin@exemplo.com');
  assert.throws(()=>helpers.loginAuthEmail('nome@sem-dominio'),/e-mail de administrador/);
});

test('Usuários inválidos são rejeitados',()=>{
  for(const candidate of ['ab','-usuario','0cliente','nome e sobrenome','nome.com.ponto','a'.repeat(33),'user/other']){
    assert.throws(()=>helpers.loginAuthEmail(candidate),/nome de usuário/,candidate);
  }
});

test('Tela de login pede usuário e senha, mantém suporte e admite admin por e-mail',()=>{
  const auth=src.slice(src.indexOf('function authMarkup()'),src.indexOf('function layout(content)'));
  assert.match(auth,/field\('login','Nome de usuário'/);
  assert.match(auth,/field\('password','Senha'/);
  assert.doesNotMatch(auth,/Administrador: entre com seu e-mail habitual/);
  assert.match(auth,/Tire suas dúvidas/);
  assert.doesNotMatch(auth,/field\('email'/);
  assert.doesNotMatch(auth,/Primeiro acesso|Criar conta/);
  assert.match(src,/api\.auth\.signInWithPassword\(\{email:loginAuthEmail\(data\.login\)/);
});

test('Cadastro do cliente exige usuário/senha e jamais e-mail pessoal',()=>{
  const modal=src.slice(src.indexOf('function companyModal('),src.indexOf('function categoryModal('));
  assert.match(modal,/field\('username','Nome de usuário \(sem e-mail\)'/);
  assert.match(modal,/field\('password','Senha inicial/);
  assert.doesNotMatch(modal,/E-mail do login|field\('email'/);
  assert.match(src,/action:'create',name:values\.name,username:normalizeClientUsername\(values\.username\)/);
  assert.match(src,/action:'update_username',company_id:c\.id,username/);
  assert.match(src,/Usuário: \$\{escapeHtml\(c\.login_username/);
});

test('Edge Function só aceita criação de cliente pelo administrador',()=>{
  assert.match(edge,/profile\?\.role !== "admin"/);
  assert.match(edge,/action === "create"/);
  assert.match(edge,/usernamePattern\.test\(username\)/);
  assert.match(edge,/email: internalAuthEmail\(username\), password, email_confirm: true/);
  assert.match(edge,/login_username: username, contact_email: null/);
  assert.match(edge,/action === "update_username"/);
  assert.doesNotMatch(edge,/validEmail\(|email: safeText\(body\.email/);
  assert.match(edge,/action === "reset_password"/);
});

test('Banco garante unicidade por nome de usuário, sem mudar admin',()=>{
  assert.match(db,/add column if not exists login_username text/);
  assert.match(db,/unique index if not exists companies_login_username_unique/);
  assert.match(db,/on public\.companies \(lower\(login_username\)\)/);
  assert.doesNotMatch(db,/auth\.users|public\.profiles|drop table|delete from/i);
});
