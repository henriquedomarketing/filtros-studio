import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../client.css',import.meta.url),'utf8');

const layout=app.slice(app.indexOf('function layout(content){'),app.indexOf('function table(',app.indexOf('function layout(content){')));
const camera=app.slice(app.indexOf('function cameraView(){'),app.indexOf('function previewView(){'));

test('Boas-vindas não exibem logo do cliente e cabeçalho usa a marca Filtros Studio',()=>{
  const home=app.slice(app.indexOf('function clientCategories(){'),app.indexOf('function cameraView(){'));
  assert.doesNotMatch(home,/client-company-logo-wrap|brandImg\(/);
  assert.match(home,/>Bem-vindo!</);
  assert.doesNotMatch(layout,/brandImg\(app\.company,'client-brand-logo'\)/);
  assert.match(layout,/class="client-brand client-brand-without-icon client-brand-with-studio-logo"/);
  assert.match(layout,/class="client-brand-copy"><strong>Filtros Studio/);
});

test('Menu da câmera usa a identidade fixa do Filtros Studio inclusive no teste admin',()=>{
  assert.match(layout,/id="clientCameraDrawer" style="\$\{brandStyle\(testing\?testingCompany:app\.company\)\}"/);
  assert.match(app,/function brandStyle\(_company\)/);
  assert.match(app,/--brand-primary:#001893;--brand-accent:#eaf0ff/);
  const design=readFileSync(new URL('../studio-redesign.css',import.meta.url),'utf8');
  assert.match(design,/\.client-app\.is-camera \.client-camera-drawer \{/);
  assert.match(design,/background:linear-gradient\(170deg,#001893/);
  assert.match(design,/\.client-app\.is-camera \.client-camera-drawer-category\.selected \{/);
  assert.match(app,/function brandInk\(hex\)/);
});

test('A câmera usa o mesmo texto de créditos presente no rodapé',()=>{
  assert.match(camera,/studioCredits\('client-camera-credits'\)/);
  assert.doesNotMatch(camera,/Resultado em 1080|Fotografe ou escolha uma foto da galeria\. Resultado/);
  assert.match(app,/Desenvolvido por <strong>@henriquedomarketing<\/strong>/);
  assert.match(app,/Desde 2025 · Todos os direitos reservados\./);
  assert.match(css,/\.client-app\.is-camera \.studio-credits\.client-camera-credits/);
});

test('A visualização da câmera continua com menu, filtros e botões ativos',()=>{
  assert.match(layout,/data-act="open-client-menu"/);
  assert.match(layout,/data-act="choose-filter"/);
  assert.match(camera,/data-act="capture"/);
  assert.match(camera,/data-act="pick-gallery"/);
  assert.match(camera,/fromGallery\?'use-camera':'flip-camera'/);
  assert.match(layout,/studioCredits\('client-footer'\)/);
  assert.match(layout,/cameraMode\?'':studioCredits/);
});

test('Botão do menu segue azul FS para todos os clientes, mesmo no teste administrativo',()=>{
  assert.match(layout,/<header class="client-camera-header" style="\$\{brandStyle\(testing\?testingCompany:app\.company\)\}">/);
  const design=readFileSync(new URL('../studio-redesign.css',import.meta.url),'utf8');
  assert.match(design,/\.client-app\.is-camera \.client-camera-header \.client-camera-menu-toggle \{/);
  assert.match(design,/background:linear-gradient\(145deg,#2757f5,#001893\) !important/);
  assert.match(design,/color:#fff !important/);
});
