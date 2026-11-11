import {before,test} from 'node:test';
import assert from 'node:assert/strict';
import {harness} from './harness.js';
import {createNav} from '../src/traffic.js';
import {worldBodyHit} from '../src/collision.js';
let G,T,originalSurface,originalSolid,originalNav;
before(async()=>{const h=await harness();({G,T}=h);originalSurface=G.surfaceAt;originalSolid=G.solidAt;originalNav=G.nav;});
test('real coastal boat traffic cruises for 45 seconds without beaching its hull',()=>{
 T.startFreeRide(G);G.surfaceAt=originalSurface;G.solidAt=originalSolid;G.peds=[];G.settings.timeSpeed=0;
 const vessels=G.vehicles.filter(v=>v.role==='boat'&&!worldBodyHit(G,v,v.x,v.y)).slice(0,3);assert.ok(vessels.length>=2);
 for(const v of vessels){G.vehicles=[v];G.player=T.makeFoot(G,5000,5000,0);G.cam.x=v.x;G.cam.y=v.y;const from={x:v.x,y:v.y};let maxTravel=0;
  for(let i=0;i<2700;i++){G.ticks++;G.cam.x=v.x;G.cam.y=v.y;T.tickVehicles(G,1/60);maxTravel=Math.max(maxTravel,Math.hypot(v.x-from.x,v.y-from.y));assert.ok(Number.isFinite(v.x+v.y+v.rot));if(i%60===0)assert.equal(worldBodyHit(G,v,v.x,v.y),null);}
  assert.ok(maxTravel>80,JSON.stringify({kind:v.kind,from,to:[v.x,v.y]}));
 }
});
test('foot police navigate around a building and never arrest across its wall',()=>{
 const solid=(x,y)=>x>320&&x<550&&y>80&&y<680;
 G.surfaceAt=(x,y)=>solid(x,y)?'build':'walk';G.solidAt=solid;G.nav=createNav(G);G.policeTarget={x:800,y:350};G.wanted=1;G.cops=[];G.vehicles=[];G.player=T.makeFoot(G,800,350,0);G.scene='play';G.mode='freeride';
 const p={x:180,y:350,rot:Math.PI/2,copPed:true,hp:50,dist:0,grabT:0};G.peds=[p];let arrived=false;
 for(let i=0;i<1300;i++){G.ticks++;G.nav.update(800,350);T.tickCops(G,1/60);assert.ok(!solid(p.x,p.y));if(Math.hypot(p.x-800,p.y-350)<65){arrived=true;break;}}
 assert.ok(arrived,JSON.stringify({x:p.x,y:p.y}));
 // A wall thinner than arrest range still blocks the arrest.
 G.surfaceAt=(x,y)=>x>400&&x<410?'build':'walk';G.solidAt=(x,y)=>x>400&&x<410;G.nav={clearLine:()=>false,next:()=>null};G.player=T.makeFoot(G,418,350,0);Object.assign(p,{x:392,y:350,grabT:0});G.policeTarget={x:392,y:350};
 for(let i=0;i<100;i++)T.tickCops(G,1/60);assert.equal(p.grabT,0);assert.equal(G.wanted,1);
 // Clearing the last star keeps a visible officer but cannot trigger an arrest.
 G.surfaceAt=()=> 'walk';G.solidAt=()=>false;G.nav={clearLine:()=>true,next:()=>null};G.wanted=0;G.cam.x=418;G.cam.y=350;
 Object.assign(p,{x:400,y:350,grabT:0,dead:false,car:{x:1000,y:350,dead:false}});
 for(let i=0;i<45;i++)T.tickCops(G,1/60);assert.equal(p.grabT,0);assert.equal(G.scene,'play');assert.equal(p.dead,false);
 G.surfaceAt=originalSurface;G.solidAt=originalSolid;
});
test('on-foot contact with real building edges stays finite and on the walkable mask',()=>{
 G.surfaceAt=originalSurface;G.solidAt=originalSolid;G.nav=originalNav;G.vehicles=[];G.peds=[];
 for(const b of G.world.coreBuildings.filter(b=>b.w>100&&b.h>100).slice(0,10)){
  const start=T.findSafe(G,b.x+b.w/2,b.y+b.h+15,10,true);G.player=T.makeFoot(G,start.x,start.y,0);
  for(let i=0;i<120;i++){T.moveFoot(G,G.player,Math.sin(i*.02)*2,-3);assert.ok(T.footClear(G,G.player.x,G.player.y,7));}
 }
});
