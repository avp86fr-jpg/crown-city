import {before,test} from 'node:test';
import assert from 'node:assert/strict';
import {harness} from './harness.js';
import {bodySize,worldBodyHit} from '../src/collision.js';
let G,T;before(async()=>({G,T}=await harness()));
test('seeded ambient parking respects the full hull and stays outside active road lanes',()=>{
 T.startFreeRide(G);const parked=G.vehicles.filter(v=>v.parked&&!v.def.boat&&!v.def.aircraft);assert.ok(parked.length>20);assert.ok(parked.some(v=>v.mission&&v.kind==='riot'));
 for(const v of parked){assert.equal(worldBodyHit(G,v,v.x,v.y),null,`${v.kind} embedded at ${v.x},${v.y}`);const b=bodySize(v),sn=Math.sin(v.rot),co=Math.cos(v.rot);for(const a of [-1,-.5,0,.5,1])for(const d of [-1,-.5,0,.5,1]){const x=a*b.w,y=d*b.l;assert.notEqual(G.surfaceAt(v.x+x*co-y*sn,v.y+x*sn+y*co),'road',`${v.kind} occupies a lane`);}}
});
test('minor traffic contact does not turn a live queue into permanently abandoned cars',()=>{
 const W={...G,world:{buildings:[],coreBuildings:[]},surfaceAt:()=> 'road',solidAt:()=>false,particles:[],flashes:[],peds:[],cops:[],cam:{...G.cam,x:500,y:500}};
 W.player=T.makeFoot(W,800,800,0);
 const a=T.makeVeh('fare',500,500,0,{traffic:true,parked:false,vx:4,tr:{marker:'lane'}}),b=T.makeVeh('fare',540,500,0,{traffic:true,parked:false,tr:{marker:'lane'}});W.vehicles=[a,b];T.tickCollisions(W);
 assert.equal(a.traffic,true);assert.equal(b.traffic,true);assert.ok(a.tr&&b.tr);
});
test('a gently nudged parked car enters physics instead of retaining a frozen velocity',()=>{
 const W={...G,world:{buildings:[],coreBuildings:[]},surfaceAt:()=> 'road',solidAt:()=>false,particles:[],flashes:[],peds:[],cops:[],cam:{...G.cam,x:500,y:500}};
 const a=T.makeVeh('fare',500,500,Math.PI/2,{parked:false,vx:30}),b=T.makeVeh('fare',602,500,Math.PI/2,{parked:true});W.player=a;W.vehicles=[a,b];T.tickCollisions(W);
 assert.equal(b.parked,false);assert.equal(b.loose,true);assert.ok(b.vx>0);
 W.vehicles=[b];const before=b.x;for(let i=0;i<60*40;i++)T.tickVehicles(W,1/60);
 assert.ok(b.x>before);assert.ok(Math.abs(b.vx)<1,'the nudge must settle under friction');
});
test('ambulance service stays on its road route and has a bounded stop before traffic resumes',()=>{
 const W={...G,vehicles:[],peds:[],cops:[]};W.player=T.makeFoot(W,800,800,0);
 const v=T.makeVeh('ambulance',500,500,Math.PI/2,{role:'ambulance',traffic:true,parked:false,tr:{turn:null},target:{x:570,y:500},cruise:110,responseCruise:110,serviceLeft:null});W.vehicles=[v];
 T.tickVehicles(W,1/60);assert.equal(v.traffic,true);assert.ok(v.tr);assert.equal(v.x,500);assert.equal(v.cruise,0);
 for(let i=0;i<9*60;i++)T.tickVehicles(W,1/60);assert.equal(v.target,null);assert.equal(v.siren,false);assert.equal(v.cruise,110);assert.ok(v.tr);
});
test('a pedestrian outside the render budget keeps clearing an active road',()=>{
 G.player=T.makeFoot(G,5000,5000,0);G.cam.x=5000;G.cam.y=5000;G.vehicles=[];G.movingVehicles=[];G.cityAI=null;G.bullets=[];
 const p={x:1820,y:2000,rot:-Math.PI/2,hx:-1,hy:0,walk:40,speed:0,r:8,hp:30,dead:false,ambient:true,idle:0,crossing:true,onRoad:true,dist:0,flee:0};G.peds=[p];
 assert.equal(G.surfaceAt(p.x,p.y),'road');const x=p.x;
 for(let i=0;i<120;i++)T.tickPeds(G,1/60);
 assert.ok(Math.abs(p.x-x)>30,'offscreen pedestrians must not become permanent traffic obstacles');
});
