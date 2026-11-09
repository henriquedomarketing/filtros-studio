import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../photo-editor.css',import.meta.url),'utf8');
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const begin=app.indexOf('const FILTER_FORMATS=');
const end=app.indexOf('function cameraView(){',begin);
assert.ok(begin>=0&&end>begin,'A identificação do formato deve existir antes da câmera');
const {detectFilterFormat,filterFormatOrLegacy}=new Function(
  app.slice(begin,end)+'\nreturn {detectFilterFormat,filterFormatOrLegacy};'
)();

test('identifica Stories 9:16 e Feed 4:5 sem depender do nome do arquivo',()=>{
  assert.equal(detectFilterFormat(1080,1920)?.id,'story');
  assert.equal(detectFilterFormat(1080,1350)?.id,'feed');
  assert.equal(detectFilterFormat(2160,2700)?.id,'feed');
  assert.equal(detectFilterFormat(720,1280)?.id,'story');
  assert.equal(detectFilterFormat(1200,1000),null);
  assert.equal(detectFilterFormat(1080,2000),null);
});

test('arquivos antigos sem proporção reconhecida mantêm o comportamento Stories',()=>{
  assert.equal(filterFormatOrLegacy(1200,1000).height,1920);
  assert.equal(filterFormatOrLegacy(1080,1920).height,1920);
  assert.equal(filterFormatOrLegacy(1080,1350).height,1350);
});

test('validação, lote e substituição aceitam as duas proporções PNG',()=>{
  assert.match(app,/const format=detectFilterFormat\(img\.naturalWidth,img\.naturalHeight\)/);
  assert.match(app,/9:16 \(1080 × 1920\) ou 4:5 \(1080 × 1350\)/);
  assert.match(app,/sampleHeight=format\.id==='feed'\?125:178/);
  assert.match(app,/function setFilterBatch\(files\)/);
  assert.match(app,/function previewReplacementFilter\(file\)/);
});

test('a mesma proporção guia visor, captura e sobreposição sem esticar',()=>{
  assert.match(app,/applyCameraFilterFormat\(filterFormatOrLegacy\(img\.naturalWidth,img\.naturalHeight\)\)/);
  assert.match(app,/canvas\.width=format\.width;canvas\.height=format\.height/);
  assert.match(app,/drawSourceCover\(ctx,source,format\.width,format\.height\)/);
  assert.match(app,/ctx\.drawImage\(overlay,0,0,format\.width,format\.height\)/);
  assert.match(css,/\.client-viewfinder\[data-filter-format="feed"\]/);
  assert.match(css,/aspect-ratio:4\/5!important/);
});

test('foto pronta, edição e exportação usam altura original em 4:5',()=>{
  assert.match(app,/--photo-ratio:\$\{photo\.width\|\|1080\} \/ \$\{photo\.height\|\|1920\}/);
  assert.match(app,/canvas\.height=photo\.height\|\|image\.naturalHeight\|\|1920/);
  assert.match(app,/ctx\.canvas\?\.height\|\|1920/);
  assert.match(css,/aspect-ratio:var\(--photo-ratio,9\/16\)/);
  assert.match(html,/photo-editor\.css/);
});

test('recorte central de imagem horizontal funciona nos dois formatos',()=>{
  const match=app.match(/function drawSourceCover\(ctx,source,width,height\)\{[\s\S]*?\n\}/);
  assert.ok(match);
  const draw=new Function('return ('+match[0]+')')();
  const img={naturalWidth:4000,naturalHeight:3000};
  function crop(w,h){
    let args;
    draw({drawImage:(...x)=>{args=x;}},img,w,h);
    return args;
  }
  const story=crop(1080,1920),feed=crop(1080,1350);
  assert.equal(story[7],1920);
  assert.equal(feed[7],1350);
  assert.equal(feed[1],500);
  assert.equal(feed[2],0);
  assert.equal(feed[3],3000);
  assert.equal(feed[4],3000);
  assert.ok(story[1]>feed[1]);
});
