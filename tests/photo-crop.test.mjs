import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const geometrySource = source.match(/function drawSourceCover\(ctx,source,width,height\)\{[\s\S]*?\n\}/);
assert.ok(geometrySource, 'A função real de enquadramento deve existir no app.js');
const drawSourceCover = new Function('return (' + geometrySource[0] + ')')();

function cropFor(width,height,kind='gallery'){
  let call;
  const context={drawImage(...args){call=args;}};
  const media=kind==='video'?{videoWidth:width,videoHeight:height}:{naturalWidth:width,naturalHeight:height};
  drawSourceCover(context,media,1080,1920);
  const [source,x,y,cropWidth,cropHeight,dx,dy,dw,dh]=call;
  assert.equal(source,media);
  assert.deepEqual([dx,dy,dw,dh],[0,0,1080,1920]);
  assert.ok(x>=-1e-7&&y>=-1e-7,'Sem bordas negativas');
  assert.ok(x+cropWidth<=width+1e-7&&y+cropHeight<=height+1e-7,'Recorte dentro da imagem');
  assert.ok(Math.abs(cropWidth/cropHeight-1080/1920)<1e-8,'Recorte 9:16 sem esticar');
  return {x,y,cropWidth,cropHeight};
}

test('Foto Stories 1080x1920 preservada integralmente',()=>{
  const c=cropFor(1080,1920);
  assert.equal(c.x,0);assert.equal(c.y,0);
  assert.equal(c.cropWidth,1080);assert.equal(c.cropHeight,1920);
});

test('Foto horizontal 4000x3000: cortar laterais igualmente, preservar altura',()=>{
  const c=cropFor(4000,3000);
  assert.equal(c.y,0);
  assert.equal(c.cropHeight,3000);
  assert.ok(Math.abs(c.x-(4000-c.cropWidth)/2)<1e-7);
});

test('Foto quadrada 2000x2000: centralizar sem distorcer',()=>{
  const c=cropFor(2000,2000);
  assert.equal(c.cropHeight,2000);
  assert.ok(Math.abs(c.x-437.5)<1e-7);
});

test('Foto vertical muito alta: cortar em cima e embaixo pelo centro',()=>{
  const c=cropFor(1080,2400);
  assert.equal(c.x,0);assert.equal(c.y,240);
  assert.equal(c.cropWidth,1080);assert.equal(c.cropHeight,1920);
});

test('Foto vertical 3:4: recortar laterais proporcionalmente',()=>{
  const c=cropFor(3000,4000);
  assert.equal(c.y,0);assert.equal(c.cropHeight,4000);
  assert.equal(c.x,375);
});

test('Câmera horizontal usa mesmo recorte central de 9:16',()=>{
  const c=cropFor(1920,1080,'video');
  assert.equal(c.y,0);assert.equal(c.cropHeight,1080);
  assert.ok(c.cropWidth<1920);
});

test('A página oferece foto da galeria e mantém troca de filtros',()=>{
  assert.match(source,/data-act="pick-gallery"/);
  assert.match(source,/data-act="choose-filter"/);
  assert.match(source,/async function loadGalleryPhoto\(/);
  assert.match(source,/const source=gallery\?gallery\.img:video/);
  assert.match(source,/ctx\.drawImage\(overlay,0,0,canvas\.width,canvas\.height\)/);
});

test('Tela de resultado oferece Voltar, sem botão de sair',()=>{
  const begin=source.indexOf('function layout(content)');
  const end=source.indexOf('function table(',begin);
  const layout=source.slice(begin,end);
  assert.match(layout,/type==='is-preview'\?[`]<header class="client-preview-header">/);
  assert.match(layout,/data-act="photo-back"/);
  assert.match(layout,/class="client-preview-back"/);
  assert.match(layout,/type==='is-preview'\?[`]<header class="client-preview-header">[\s\S]*?data-act="photo-back"/);
  assert.match(source,/if\(act==='photo-back'\|\|act==='photo-retake'\|\|act==='photo-change-filter'\)\{backToCamera\(\);return;\}/);
});

test('Qualquer retorno da tela final deve limpar foto capturada e importada',()=>{
  const resetSource=source.match(/function resetCameraSession\(categoryId=app.selectedCategory\)\{[\s\S]*?\n\}/);
  assert.ok(resetSource,'Rotina central de reinicialização da câmera');
  const originalGallery={url:'blob:galeria-antiga'};
  const originalCapture={url:'blob:captura-antiga'};
  const app={
    selectedCategory:'categoria-atual',
    selectedFilter:'filtro-antigo',
    filters:[
      {id:'filtro-padrao',category_id:'categoria-atual',active:true},
      {id:'filtro-antigo',category_id:'categoria-atual',active:true}
    ],
    galleryPhoto:originalGallery,
    captureData:originalCapture,
    stream:'stream-antigo',
    facing:'user',
    page:'preview'
  };
  const calls=[];
  const stopCamera=()=>{calls.push('stopCamera');app.stream=null;};
  const clearCapturedPhoto=()=>{calls.push('clearCapturedPhoto');app.captureData=null;};
  const clearGalleryPhoto=()=>{calls.push('clearGalleryPhoto');app.galleryPhoto=null;};
  const render=()=>calls.push('render');
  const window={scrollTo:(x,y)=>calls.push(`scrollTo(${x},${y})`)};
  const reset=new Function('app','stopCamera','clearCapturedPhoto','clearGalleryPhoto','render','window',
    'return ('+resetSource[0]+')')(app,stopCamera,clearCapturedPhoto,clearGalleryPhoto,render,window);
  reset();
  assert.equal(app.galleryPhoto,null,'Não deve reaproveitar foto da galeria');
  assert.equal(app.captureData,null,'Não deve reaproveitar arquivo de captura');
  assert.equal(app.stream,null,'Stream anterior deve ser encerrado');
  assert.equal(app.page,'camera','Deve voltar à câmera');
  assert.equal(app.facing,'environment','Deve usar câmera traseira novamente');
  assert.equal(app.selectedCategory,'categoria-atual','Permanece na categoria');
  assert.equal(app.selectedFilter,'filtro-padrao','Primeiro filtro da categoria');
  assert.deepEqual(calls,['stopCamera','clearCapturedPhoto','clearGalleryPhoto','render','scrollTo(0,0)']);
});

test('Voltar, Nova foto e Trocar filtro sempre chamam mesma rotina limpa',()=>{
  assert.match(source,/function backToCamera\(\)\{resetCameraSession\(\);\}/);
  const handler=source.slice(source.indexOf('async function click(event)'),source.indexOf('function setClientCameraMenu('));
  assert.match(handler,/act==='photo-back'\|\|act==='photo-retake'\|\|act==='photo-change-filter'/);
  assert.match(handler,/\{backToCamera\(\);return;\}/);
  assert.doesNotMatch(handler,/backToCamera\(true\)/);
});

test('Foto importada mostra Voltar à câmera sobre o enquadramento',()=>{
  const begin=source.indexOf('function cameraView(){');
  const end=source.indexOf('function previewView(){',begin);
  const camera=source.slice(begin,end);
  assert.match(camera,/fromGallery\?['`]?<button type="button" class="client-gallery-back"/);
  assert.match(camera,/data-act="use-camera"/);
  assert.match(camera,/Voltar à câmera/);
  assert.match(camera,/fromGallery\?'Voltar':'Alternar'/);
  const handler=source.slice(source.indexOf('async function click(event)'),source.indexOf('function setClientCameraMenu('));
  assert.match(handler,/if\(act==='use-camera'\)\{resetCameraSession\(\);return;\}/);
});


test('Créditos institucionais aparecem em login, cliente e administração, não na câmera',()=>{
  assert.match(source,/Desenvolvido por <strong>@henriquedomarketing<\/strong>/);
  assert.match(source,/Desde 2025 · Todos os direitos reservados\./);
  assert.match(source,/studioCredits\('studio-credits-auth'\)/);
  assert.match(source,/cameraMode\?'':studioCredits\('client-footer'\)/);
  assert.match(source,/studioCredits\('studio-credits-admin'\)/);
});
