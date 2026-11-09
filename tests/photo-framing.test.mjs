import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../photo-editor.css',import.meta.url),'utf8');
function extract(name){
  const start=app.indexOf('function '+name+'(');
  const end=app.indexOf('\n}',start);
  assert.ok(start>=0&&end>start,name+' deve existir');
  return app.slice(start,end+2);
}
const original=new Function('return ('+extract('drawSourceCover')+')')();
const adjusted=new Function('drawSourceCover','return ('+extract('drawFramedSource')+')')(original);
const bounds=new Function('return ('+extract('photoFramingBounds')+')')();

test('arrastar e pinçar atuam somente na foto, mantendo PNG imóvel',()=>{
  assert.match(css,/\.client-viewfinder #cameraOverlay\{[\s\S]*?pointer-events:none/);
  assert.match(css,/\.client-viewfinder #galleryBase,[\s\S]*?\.client-viewfinder #cameraVideo\{[\s\S]*?transform-origin:center center/);
  assert.match(css,/touch-action:none/);
  assert.match(app,/photoFramingGestureStart/);
  assert.match(app,/photoFramingGestureMove/);
  assert.match(app,/photoFramingGestureEnd/);
  assert.match(app,/data-act="photo-framing-reset"/);
});
test('o deslocamento permitido não deixa espaços vazios',()=>{
  for(const zoom of [1,1.5,2,3]){
    const limit=(zoom-1)/2;
    assert.deepEqual(bounds(1080,1350,300,375,zoom),{x:limit,y:limit});
  }
});
test('corte exportado segue zoom e arrasto em ambos formatos',()=>{
  for(const [width,height,sw,sh] of [[1080,1920,4000,3000],[1080,1350,4000,3000],[1080,1350,1080,1350],[1080,1920,1080,1920]]){
    for(const [zoom,dx,dy] of [[1,0,0],[2,.5,-.5],[1.5,.2,-.2],[3,-1,1]]){
      let args;
      adjusted({drawImage:(...value)=>{args=value;}},{naturalWidth:sw,naturalHeight:sh},width,height,{zoom,dx,dy});
      const [,sx,sy,cw,ch,ox,oy,dw,dh]=args;
      assert.ok(sx>=-1e-7&&sy>=-1e-7,'O recorte não pode sair da foto');
      assert.ok(sx+cw<=sw+1e-7&&sy+ch<=sh+1e-7,'O recorte deve caber na foto');
      assert.deepEqual([ox,oy,dw,dh],[0,0,width,height]);
    }
  }
});
test('sessão nova limpa o enquadramento anterior e exporta a posição escolhida',()=>{
  const reset=app.slice(app.indexOf('function resetCameraSession('),app.indexOf('function backToCamera('));
  assert.match(reset,/resetPhotoFraming\(\)/);
  assert.match(app,/drawFramedSource\(ctx,source,format\.width,format\.height,app\.photoFraming\)/);
  assert.match(app,/if\(event\.target\.id==='photoFramingZoom'/);
});
