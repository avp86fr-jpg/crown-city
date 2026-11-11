import {test} from 'node:test';
import assert from 'node:assert/strict';
import {harness} from './harness.js';
import {tickLightEffects,visibleStreetLights,drawCoreGlow,drawTrafficSignals} from '../src/lighting.js';
import {lightGreen,signalPhase} from '../src/traffic.js';
const {G,T}=await harness();
test('flashes expire without rendering; drawing or pausing never advances their timers',()=>{
 T.startFreeRide(G);G.hurtT=.3;G.flashes=[{x:G.player.x,y:G.player.y,r:150,col:'rgba(255,210,140,0.9)',life:.07,max:.07}];
 const flashes=G.flashes;
 for(const quality of ['low','med']){G.settings.quality=quality;T.applyQuality(G);for(let i=0;i<10;i++)T.render(G);assert.equal(G.flashes[0].life,.07);assert.equal(G.hurtT,.3);}
 G.scene='pause';T.tick(G,.1);assert.equal(G.flashes[0].life,.07);
 G.scene='play';for(let i=0;i<6;i++)T.tickPlay(G,1/60);
 assert.equal(G.flashes,flashes);assert.equal(flashes.length,0);assert.ok(Math.abs(G.hurtT-.2)<1e-7);
});
test('light effect duration is independent of rendering and simulation step size',()=>{
 for(const dt of [1/120,1/60,1/30]){const state={hurtT:.5,flashes:[{life:.3},{life:.1}]};for(let t=0;t<.5-1e-6;t+=dt)tickLightEffects(state,dt);assert.equal(state.flashes.length,0);assert.ok(state.hurtT<1e-8);}
});
test('canal lamps have finite positions and light pools enter smoothly from outside the viewport',()=>{
 const view={x0:6880,y0:2000,x1:7050,y1:2200};
 const lamps=visibleStreetLights(G,view).slice();assert.ok(lamps.length>0);
 assert.ok(lamps.some(p=>p.x<view.x0||p.x>view.x1));
 for(const p of lamps)assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y));
});
test('mobile lamp budget keeps the closest lights and invalidates rebuilt world sources',()=>{
 const state={cam:{x:0,y:0},meta:{lights:[]},world:{lamps:Array.from({length:100},(_,i)=>({x:100-i,y:0,v:true}))}};
 const view={x0:-100,y0:-100,x1:600,y1:100};const lights=visibleStreetLights(state,view,16);
 assert.equal(lights.length,16);assert.equal(lights[0].x,1);assert.equal(lights[15].x,16);
 state.world.lamps=[{x:5,y:3,v:true}];assert.equal(visibleStreetLights(state,view).length,1);
});
test('painted casino glow samples the current roof at its exact world position',()=>{
 const original=G.assets.layers.roofs.drawRect,calls=[];
 G.assets.layers.roofs.drawRect=(ctx,x,y,w,h,frame,project)=>calls.push({x,y,w,h,dest:project(x,y,x+w,y+h)});
 try{drawCoreGlow(G,G.ctx,{x0:0,y0:0,x1:4096,y1:4096},10,1);}finally{G.assets.layers.roofs.drawRect=original;}
 assert.ok(calls.length>0);for(const p of calls)assert.deepEqual(p.dest,[p.x,p.y,p.w,p.h]);
});
test('mobile and desktop signal heads agree with traffic AI throughout a full cycle',()=>{
 const n=G.graph.nodes.find(n=>n.sig);assert.ok(n);
 const r={x0:n.x-200,y0:n.y-200,x1:n.x+200,y1:n.y+200};
 for(let ticks=0;ticks<960;ticks+=15){G.ticks=ticks;drawTrafficSignals(G,r);assert.ok(G._sigLit.length>=12);
  for(const ns of [true,false])assert.equal(lightGreen(G,n,{dx:ns?0:1,dy:ns?1:0}),signalPhase(ticks,ns)===0);
  assert.equal(signalPhase(ticks,true)===0&&signalPhase(ticks,false)===0,false);
 }
 assert.equal(signalPhase(7*60,true),1);assert.equal(signalPhase(15*60,false),1);
});
