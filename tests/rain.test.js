import test from 'node:test';
import assert from 'node:assert/strict';
import {rainDir,drawRainGround,drawRainOverlay,resetRainArt,RAIN_WET_SURFACES} from '../src/rain.js';
import {harness} from './harness.js';

function recorder(){
  const rec={createLinearGradient:0,createRadialGradient:0,drawImage:0,fillRect:0,setTransform:0,ops:[]};
  const grad={addColorStop(){}};
  const ctx=new Proxy({
    createLinearGradient(){rec.createLinearGradient++;return grad;},
    createRadialGradient(){rec.createRadialGradient++;return grad;},
    drawImage(){rec.drawImage++;},
    fillRect(...a){rec.fillRect++;rec.ops.push(['fill',this.fillStyle,this.globalCompositeOperation||'source-over',...a]);},
    setTransform(...a){rec.setTransform++;},
    createPattern(){return {id:'pat'};},save(){},restore(){},translate(){},rotate(){},beginPath(){},moveTo(){},lineTo(){},stroke(){},fill(){},ellipse(){},
  },{get:(o,k)=>o[k]||(()=>{}),set:(o,k,v)=>(o[k]=v,true)});
  return {rec,ctx};
}
function install(){
  const built=recorder();
  const previous=globalThis.document;
  globalThis.document={createElement:()=>{const c={width:0,height:0,getContext:()=>built.ctx};return c;}};
  resetRainArt();
  return {built,restore(){globalThis.document=previous;resetRainArt();}};
}
function state(ctx,extra={}){
  return {
    canvas:{width:844,height:390},ctx,
    cam:{x:2000,y:2200,scale:1.2,rot:0},
    ticks:180,time:22,night:.85,rainAmt:1,wet:1,fog:0,
    settings:{quality:'low',reducedMotion:false},
    surfaceAt:()=> 'road',
    meta:{lights:[{x:2000,y:2200,kind:'street'}]},
    world:{lamps:[]},
    vehicles:[{x:1980,y:2210,rot:0,def:{}}],
    player:{x:2000,y:2200,type:'foot'},
    rainStats:{},
    ...extra,
  };
}

test('rain direction stays finite, consistent and only slightly nudged by wind',()=>{
  const a=rainDir({ticks:60,settings:{reducedMotion:false},rainAmt:1});
  const b=rainDir({ticks:60,settings:{reducedMotion:false},rainAmt:1});
  assert.equal(a.angle,b.angle);
  assert.ok(Number.isFinite(a.angle)&&Number.isFinite(a.dx)&&Number.isFinite(a.dy));
  assert.ok(Math.abs(Math.hypot(a.dx,a.dy)-1)<1e-9);
  const still=rainDir({ticks:0,settings:{reducedMotion:true},rainAmt:1});
  const later=rainDir({ticks:6000,settings:{reducedMotion:true},rainAmt:1});
  assert.equal(still.angle,later.angle);
  const calm=rainDir({ticks:90,settings:{reducedMotion:false},rainAmt:0});
  const storm=rainDir({ticks:90,settings:{reducedMotion:false},rainAmt:1});
  assert.ok(Math.abs(storm.angle-calm.angle)<.08);
});

test('overlay and ground do nothing below the intensity threshold and skip motion when reduced',()=>{
  const doc=install();
  try{
    const idle=recorder();
    const G=state(idle.ctx,{rainAmt:0,wet:0});
    drawRainOverlay(G);drawRainGround(G,{x0:1800,y0:2000,x1:2300,y1:2400});
    assert.equal(idle.rec.drawImage,0);assert.equal(idle.rec.fillRect,0);
    const moved=recorder();
    const R=state(moved.ctx,{rainAmt:1,wet:1,settings:{quality:'low',reducedMotion:true}});
    // Art must be built once (gradients allowed only while constructing sprites).
    drawRainOverlay(R);drawRainGround(R,{x0:1800,y0:2000,x1:2300,y1:2400});
    const gradients=doc.built.rec.createLinearGradient+doc.built.rec.createRadialGradient;
    assert.ok(gradients>0,'sprites are pre-rendered with gradients');
    const before=gradients;
    const after=recorder();
    const S=state(after.ctx,{rainAmt:1,wet:1,settings:{quality:'low',reducedMotion:true},ticks:800});
    drawRainOverlay(S);
    assert.equal(doc.built.rec.createLinearGradient+doc.built.rec.createRadialGradient,before,'no per-frame gradients');
    assert.ok(after.rec.fillRect>=1,'uniform veil remains in reduced motion');
    assert.equal(after.rec.drawImage,0,'streaks do not animate when motion is reduced');
    const veil=after.rec.ops.filter(o=>o[0]==='fill');
    assert.ok(veil.length>=1&&veil.every(o=>o[2]==='multiply'&&o[3]===0&&o[4]===0&&o[5]===844&&o[6]===390),'veil is a full-screen uniform multiply');
  }finally{doc.restore();}
});

test('full rain draws tiled streak sheets, sidewalk ripples and puddles without new gradients',()=>{
  const doc=install();
  try{
    const rec=recorder();
    const G=state(rec.ctx,{settings:{quality:'high',reducedMotion:false},surfaceAt:(x,y)=>x<2050?'walk':'road'});
    drawRainGround(G,{x0:1800,y0:2000,x1:2300,y1:2400});
    drawRainOverlay(G);
    const gradients=doc.built.rec.createLinearGradient+doc.built.rec.createRadialGradient;
    const again=recorder();
    G.ctx=again.ctx;G.ticks+=30;
    drawRainGround(G,{x0:1800,y0:2000,x1:2300,y1:2400});
    drawRainOverlay(G);
    assert.equal(doc.built.rec.createLinearGradient+doc.built.rec.createRadialGradient,gradients);
    assert.ok(G.rainStats.ripples>0,'ripples land on sidewalks and roads');
    assert.ok(G.rainStats.puddles>0);
    assert.ok(G.rainStats.sheets>=2);
    assert.ok(again.rec.drawImage+again.rec.fillRect>8,'sheets and ground sprites are blitted');
    assert.ok(RAIN_WET_SURFACES.has('walk')&&RAIN_WET_SURFACES.has('road'));
  }finally{doc.restore();}
});

test('rain intensity ramps smoothly and weather ticks no longer burst rain particles',async()=>{
  const {G,T}=await harness();
  G.particles.length=0;G.weather='rain';G.weatherT=100;G.rainAmt=G.wet=G.fog=G.sand=0;
  G.settings.quality='high';G.settings.reducedMotion=false;
  T.tickWeather(G,8);
  assert.ok(G.rainAmt>0&&G.rainAmt<1,'intensity eases in rather than popping');
  assert.equal(G.particles.filter(p=>p.kind==='rain').length,0);
  T.tickWeather(G,30);
  assert.ok(G.rainAmt>.85);
  assert.equal(G.particles.filter(p=>p.kind==='rain').length,0);
  const rec=recorder();
  const doc=install();
  try{
    G.ctx=rec.ctx;G.canvas={width:844,height:390};G.night=.8;G.rainAmt=.4;
    G.surfaceAt=()=> 'road';G.rainStats={};
    drawRainOverlay(G);
    const mid=rec.rec.drawImage;
    const rec2=recorder();G.ctx=rec2.ctx;G.rainAmt=1;G.rainStats={};
    drawRainOverlay(G);
    // Same number of sheets; stronger rain only raises alpha, not draw count.
    assert.equal(rec2.rec.drawImage,mid);
  }finally{doc.restore();}
});
