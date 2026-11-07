import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const appSource=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../studio-unified-blue.css',import.meta.url),'utf8');

const storageHelpers=appSource.slice(
  appSource.indexOf('const AUTH_SESSION_STORAGE_KEY'),
  appSource.indexOf('const $ =')
);
const logoutImplementation=appSource.slice(
  appSource.indexOf('async function logoutCurrentBrowser()'),
  appSource.indexOf('async function click(event)')
);
function fakeStorage(seed={}){
  const map=new Map(Object.entries(seed));
  return {getItem:key=>map.has(key)?map.get(key):null,setItem:(key,value)=>map.set(key,String(value)),
    removeItem:key=>map.delete(key),has:key=>map.has(key)};
}

test('Sair remove a sessão do Safari mesmo com erro remoto, e guarda a decisão para o reload',async()=>{
  const tokenKey='sb-imfgumnpbxhbrjlkiphf-auth-token';
  const local=fakeStorage({[tokenKey]:'token-antigo',[tokenKey+'-code-verifier']:'pkce'});
  const tab=fakeStorage();
  const app={
    user:{id:'exemplo'},profile:{role:'client'},company:{name:'teste'},
    companies:[{id:1}],categories:[{id:1}],filters:[{id:1}],invoices:[{id:1}],settings:{x:1},
    modal:{a:1},selectedCategory:'c',selectedFilter:'f',page:'camera',
    adminTest:{active:true},images:new Map()
  };
  let rendered=false,called=false,scope;
  const api={auth:{signOut:async options=>{called=true;scope=options.scope;return {error:new Error('offline')}}}};
  const factory=new Function('SUPABASE_URL','localStorage','sessionStorage','api','app',
    'stopCamera','clearCapturedPhoto','clearGalleryPhoto','render',
    storageHelpers+logoutImplementation+'return {logoutCurrentBrowser,wasExplicitlyLoggedOut,clearStoredAuthSession,setExplicitLogout}');
  const session=factory('https://imfgumnpbxhbrjlkiphf.supabase.co',local,tab,api,app,
    ()=>{},()=>{},()=>{},()=>{rendered=true;});
  await session.logoutCurrentBrowser();
  assert.equal(called,true);
  assert.equal(scope,'local');
  assert.equal(rendered,true);
  assert.equal(app.user,null);
  assert.equal(app.profile,null);
  assert.equal(app.company,null);
  assert.equal(app.filters.length,0);
  assert.equal(local.has(tokenKey),false);
  assert.equal(local.has(tokenKey+'-code-verifier'),false);
  assert.equal(session.wasExplicitlyLoggedOut(),true);
  session.setExplicitLogout(false);
  assert.equal(session.wasExplicitlyLoggedOut(),false);
});

test('Reload respeita saída explícita, e novo login real libera sessões futuras',()=>{
  const init=appSource.slice(appSource.indexOf('async function init()'),appSource.indexOf('const clientUsernamePattern'));
  const login=appSource.slice(appSource.indexOf('async function authSubmit(form)'),appSource.indexOf('async function manager('));
  assert.match(init,/if\(wasExplicitlyLoggedOut\(\)\)/);
  assert.match(init,/clearStoredAuthSession\(\)/);
  assert.ok(init.indexOf('wasExplicitlyLoggedOut')<init.indexOf('api.auth.getSession'));
  assert.match(login,/if\(logoutPending\)/);
  assert.match(login,/setExplicitLogout\(false\);app.user=auth.user/);
  assert.doesNotMatch(logoutImplementation,/signOut\(\)/);
});

test('Login mantém a logo presente, usa espaçamento equilibrado e acessível em alturas baixas',()=>{
  const layout=css.slice(css.indexOf('/* Distribuição do login no iPhone:'));
  assert.match(layout,/\.auth-layout \.auth-card>\.brand/);
  assert.match(layout,/min-height:clamp\(230px,29dvh,390px\)!important/);
  assert.match(layout,/\.auth-layout \.auth-card \.form\{/);
  assert.match(layout,/margin:auto auto 0!important/);
  assert.match(layout,/\.auth-layout \.auth-card \.auth-support-link\{/);
  assert.match(layout,/margin:clamp\(14px,2\.5dvh,25px\) auto auto!important/);
  assert.match(layout,/@media\(max-height:720px\)/);
  assert.match(css,/min-height:100dvh!important/);
  assert.doesNotMatch(css,/^[ \t]*height:100dvh!important/m);
  assert.match(css,/overflow-y:auto!important/);
});
