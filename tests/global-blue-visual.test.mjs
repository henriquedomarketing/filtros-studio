import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const css=readFileSync(new URL('../studio-unified-blue.css',import.meta.url),'utf8');
const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const home=app.slice(app.indexOf('function clientCategories(){'),app.indexOf('function cameraView(){'));
const camera=app.slice(app.indexOf('function cameraView(){'),app.indexOf('function previewView(){'));

test('official #001893 design uses one last-loaded reusable CSS layer',()=>{
  assert.match(html,/<meta name="theme-color" content="#001893"/);
  assert.match(css,/--studio-blue:#001893;/);
  assert.equal(css.match(/--studio-surface-art:/g)?.length,1);
  assert.ok(html.indexOf('./studio-unified-blue.css')>html.indexOf('./brand-identity.css'));
  assert.doesNotMatch(html,/href="\.\/(reference-blue|welcome-responsive)\.css"/);
  assert.match(css,/\.client-app,\.auth-layout,\.access-paused-layout/);
  assert.match(css,/radial-gradient/);
  assert.match(css,/\.client-app\.is-camera \.client-camera-drawer/);
});
test('welcome text has no logo markup, no frame, and categories stay dynamic',()=>{
  assert.match(home,/>Bem-vindo!</);
  assert.match(home,/Escolha uma categoria, selecione seu filtro e crie fotos para suas redes sociais/);
  assert.doesNotMatch(home,/client-company-logo-wrap|brandImg\(/);
  assert.match(home,/app\.categories\.map\(c=>/);
  assert.match(home,/data-act="open-category"/);
  assert.match(css,/\.client-app\.is-home \.client-home-heading\{/);
  assert.match(css,/\.client-app\.is-home \.client-category-item\{/);
  assert.match(css,/background:#fff!important;color:var\(--studio-blue\)/);
});
test('photo capture/gallery/preview preserve the original video and PNG overlay',()=>{
  for(const action of ['capture','flip-camera','pick-gallery','use-camera','finish-gallery'])
    assert.match(camera,new RegExp('data-act=".*?'+action));
  assert.match(camera,/id="cameraVideo"/);
  assert.match(camera,/id="galleryBase"/);
  assert.match(camera,/id="cameraOverlay"/);
  assert.match(camera,/class="camera-frame client-viewfinder"/);
  assert.match(css,/aspect-ratio:9\/16!important/);
  assert.match(css,/\.client-viewfinder img#cameraOverlay\{object-fit:fill!important\}/);
  assert.doesNotMatch(css,/#cameraOverlay[^\{]*\{[^}]*filter:/);
  assert.match(app,/function previewView\(\)/);
  for(const action of ['photo-share','photo-instagram','photo-whatsapp','photo-save','photo-retake','photo-change-filter'])
    assert.match(app,new RegExp('data-act="'+action+'"'));
});
test('admin dashboard, client management and finance share the official blue background',()=>{
  const admin=app.slice(app.indexOf("const menu=[['dashboard'"),app.indexOf('function table('));
  for(const menu of ['dashboard','clients','filters','test-filters','finance','settings'])
    assert.ok(admin.includes("'"+menu+"'"),menu+' remains in sidebar');
  assert.match(admin,/class="workspace"/);
  assert.match(admin,/class="topbar"/);
  assert.match(admin,/class="content"/);
  assert.match(css,/\.admin-layout\{/);
  assert.match(css,/\.admin-layout \.sidebar\{/);
  assert.match(css,/\.admin-layout \.card,/);
  assert.match(css,/\.admin-layout \.topbar\{/);
  assert.match(css,/\.admin-layout \.mobile-menu-toggle/);
  assert.match(css,/\.admin-layout \.sidebar \.nav-btn\.active/);
  assert.match(css,/background-image:var\(--studio-surface-art\)!important/);
});
test('visual-only update respects responsive layouts and has no database DDL',()=>{
  assert.doesNotMatch(css,/service_role|CREATE TABLE|DROP TABLE/i);
  assert.match(css,/@media\(max-width:430px\)/);
  assert.match(css,/@media\(max-width:700px\)/);
  assert.match(css,/@media\(max-height:680px\)/);
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
});
