import {test} from 'node:test';
import assert from 'node:assert/strict';
import {tickWildlife} from '../src/wildlife.js';
import {tickBlood} from '../src/blood_fx.js';
import {circleBody} from '../src/collision.js';

const animal=(extra={})=>({id:0,kind:2,x:0,y:0,hx:0,hy:0,angle:0,target:0,walk:0,flee:0,t:100,phase:0,lift:0,...extra});
const car=(extra={})=>({type:'veh',kind:'riot',def:{mass:1.3},x:80,y:0,prevX:-80,prevY:0,rot:Math.PI/2,vx:1600,vy:0,...extra});
function habitat(animals,vehicles,options={}){
 const bins=new Map();for(const a of animals){const k=Math.floor(a.hx/512)+':'+Math.floor(a.hy/512),bucket=bins.get(k)||[];bucket.push(a);bins.set(k,bucket);}
 return {player:vehicles[0]||{type:'foot',x:0,y:500},vehicles,peds:[],time:12,ticks:0,settings:{quality:'low',blood:'full'},surfaceAt:()=> 'grass',solidAt:()=>false,audio:{},wildlife:{animals,active:[],bins,elapsed:1,shot:0,stats:{}},...options};
}
test('a fast car or bike strikes wildlife along its swept path before avoidance runs',()=>{
 for(const bike of [false,true]){
  const a=animal(),v=car({def:{bike,mass:bike?.5:1.3}}),G=habitat([a],[v]);
  assert.equal(circleBody(v,a.x,a.y,8),false,'the final position already passed the animal');
  tickWildlife(G,.1);
  assert.equal(a.dead,true);assert.equal(G.wildlife.stats.hits,1);assert.equal(G.wildlife.stats.playerHits,1);
  assert.ok(G.bloodFX.drops.length>0);assert.ok(G.bloodFX.stains.length>0);
  for(let i=0;i<60;i++){v.prevX=v.x;v.prevY=v.y;tickWildlife(G,1/60);}
  assert.equal(G.wildlife.stats.hits,1,'a fallen animal cannot re-trigger damage or effects');
 }
});
test('grazes outside rounded body corners, parallel near misses and teleports are not hits',()=>{
 for(const [a,v,dt] of [
  [animal({x:31,y:59,hx:31,hy:59}),car({x:0,y:0,prevX:-2,prevY:0,rot:0,vx:120}),1/60],
  [animal({y:34,hy:34}),car(),.1],
  [animal(),car({x:800,prevX:-800,vx:160}),1/60],
 ]){const G=habitat([a],[v]);tickWildlife(G,dt);assert.ok(!a.dead);assert.equal(G.wildlife.stats.hits||0,0);}
});
test('boats, airborne aircraft and airborne birds never collide as road wildlife',()=>{
 for(const [a,v] of [
  [animal(),car({def:{boat:true}})],
  [animal(),car({kind:'plane',def:{aircraft:true},altitude:80})],
  [animal({kind:4,lift:20}),car()],
 ]){const G=habitat([a],[v]);tickWildlife(G,.1);assert.equal(G.wildlife.stats.hits||0,0);assert.ok(!a.dead);}
 const a=animal({kind:5}),G=habitat([a],[car()]);tickWildlife(G,.1);assert.equal(a.dead,true,'a bird on the ground is vulnerable before it takes off');
});
test('impact collision remains active for wildlife beyond the mobile animation budget',()=>{
 const v=car(),target=animal({id:50}),crowd=Array.from({length:25},(_,i)=>animal({id:i+1,x:80,y:40+i*.5,hx:80,hy:40+i*.5}));
 const G=habitat([...crowd,target],[v]);tickWildlife(G,.1);
 assert.equal(G.wildlife.active.length,18);assert.ok(!G.wildlife.active.includes(target));assert.equal(target.dead,true);
});
test('low-speed contact hurts and knocks back without becoming a repeated per-frame hit',()=>{
 const a=animal({kind:0}),v=car({x:0,prevX:0,vx:30}),G=habitat([a],[v]);tickWildlife(G,1/60);
 assert.ok(a.hp>0&&a.hp<90);assert.ok(!a.dead);assert.ok(a.stun>0);assert.equal(G.wildlife.stats.hits,1);
 for(let i=0;i<20;i++)tickWildlife(G,1/60);assert.equal(G.wildlife.stats.hits,1);
});
test('gore preferences apply to wildlife while damage and cleanup remain consistent',()=>{
 for(const setting of ['off','reduced','full']){
  const a=animal(),G=habitat([a],[car()]);G.settings.blood=setting;tickWildlife(G,.1);assert.equal(a.dead,true);
  if(setting==='off')assert.equal(G.bloodFX,undefined);
  else if(setting==='reduced')assert.ok(G.bloodFX.drops.every(d=>!d.chunk));
  else assert.ok(G.bloodFX.drops.some(d=>d.chunk));
 }
});
test('fallen wildlife fades in view, recovers only offscreen and reuses its original habitat actor',()=>{
 const a=animal(),v=car(),G=habitat([a],[v]);tickWildlife(G,.1);v.vx=0;
 for(let i=0;i<1200;i++){tickWildlife(G,.1);tickBlood(G,.1);}
 assert.equal(a.dead,true,'no resurrection under the camera');assert.equal(a.hidden,true);assert.equal(G.wildlife.animals.length,1);
 G.player={type:'foot',x:4000,y:4000};tickWildlife(G,.1);
 assert.equal(a.dead,false);assert.equal(a.hidden,false);assert.deepEqual([a.x,a.y],[a.hx,a.hy]);assert.equal(G.wildlife.stats.respawns,1);
 assert.ok(G.bloodFX.drops.length<=48&&G.bloodFX.stains.length<=32&&G.bloodFX.pool.length<=48);
 assert.equal(G.wildlife.animals.length,1);assert.equal([...G.wildlife.bins.values()].flat().length,1);
});
test('one hundred impacts and offscreen returns keep population, effect and vehicle-reference pools bounded',()=>{
 const a=animal(),v=car(),G=habitat([a],[v]);
 for(let i=0;i<100;i++){
  G.player=v;Object.assign(v,{x:80,y:0,prevX:-80,prevY:0,vx:1600});G.wildlife.elapsed=1;tickWildlife(G,.1);assert.equal(a.dead,true);
  G.player={type:'foot',x:4000,y:4000};v.vx=0;tickWildlife(G,91);tickBlood(G,91);assert.equal(a.dead,false);
 }
 assert.equal(G.wildlife.stats.deaths,100);assert.equal(G.wildlife.stats.respawns,100);assert.equal(G.wildlife.animals.length,1);
 assert.ok(G.wildlife.moverPool.length<=1);assert.ok(G.wildlife.moverPool.every(m=>!m.v));
 assert.ok(G.bloodFX.drops.length<=48&&G.bloodFX.stains.length<=32&&G.bloodFX.pool.length<=48);
});
