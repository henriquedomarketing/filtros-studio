import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const index=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const theme=readFileSync(new URL('../studio-redesign.css',import.meta.url),'utf8');
const base=readFileSync(new URL('../client.css',import.meta.url),'utf8');

test('Estilos novos ficam isolados em folha adicionada depois do CSS legado',()=>{
  assert.match(index,/href="\.\/studio-redesign\.css"/);
  assert.ok(index.indexOf('./studio-redesign.css')>index.indexOf('./client.css'));
  assert.match(theme,/--fs-navy: #001893/);
  assert.match(theme,/--fs-blue-soft: #eaf0ff/);
  assert.match(theme,/\.auth-layout/);
  assert.match(theme,/\.admin-layout \.sidebar/);
  assert.match(theme,/\.client-app\.is-home \.client-home-heading/);
  assert.match(theme,/\.client-app\.is-camera \.client-camera-drawer/);
});

test('Identidade de uma empresa não é usada para colorir interface',()=>{
  const brand=app.slice(app.indexOf('function brandStyle('),app.indexOf('const companyInitials='));
  assert.match(brand,/--brand-primary:#001893/);
  assert.match(brand,/--brand-accent:#eaf0ff/);
  assert.doesNotMatch(brand,/company\?\.primary_color|company\?\.accent_color|brandColor\(/);
  assert.match(theme,/background:linear-gradient\(170deg,#001893/);
  const modal=app.slice(app.indexOf('function companyModal('),app.indexOf('function categoryModal('));
  assert.doesNotMatch(modal,/field\('primary_color'|field\('accent_color'/);
  assert.match(modal,/A imagem manterá a proporção original/);
});

test('Logo do cliente é preservada nos dados mas não na tela de boas-vindas',()=>{
  const home=app.slice(app.indexOf('function clientCategories(){'),app.indexOf('function cameraView(){'));
  assert.doesNotMatch(home,/brandImg\(|client-company-logo-wrap/);
  assert.match(app,/async function uploadCompanyLogo/);
  assert.match(app,/async function brandLogoUrl/);
  assert.match(app,/function hydrateBrandLogos/);
  assert.match(base,/img\[data-brand-logo\]\.brand-image-ready/);
  const save=app.slice(app.indexOf('async function saveCompanyBrand('),app.indexOf('async function brandLogoUrl('));
  assert.match(save,/if\(!logo\)return/);
  assert.match(save,/payload\.logo_path=uploaded/);
  assert.doesNotMatch(save,/primary_color:|accent_color:/);
});

test('Redesign mantém os acionadores funcionais de login, câmera e filtros',()=>{
  assert.match(app,/id="authForm"/);
  assert.match(app,/api\.auth\.signInWithPassword/);
  assert.match(app,/data-act="open-client-menu"/);
  assert.match(app,/data-act="choose-filter"/);
  assert.match(app,/data-act="capture"/);
  assert.match(app,/data-act="pick-gallery"/);
  assert.match(app,/data-act="photo-share"/);
  assert.match(app,/function categoryOrderPointerDown/);
  assert.match(app,/async function saveFilterChanges/);
  assert.match(app,/function testFilters/);
});

test('Responsividade, foco e acessibilidade sem animações obrigatórias',()=>{
  assert.match(theme,/@media\(max-width:430px\)/);
  assert.match(theme,/@media\(prefers-reduced-motion:reduce\)/);
  assert.match(theme,/button:focus-visible/);
  assert.match(theme,/\.client-app\.is-home \.client-category-item/);
});
