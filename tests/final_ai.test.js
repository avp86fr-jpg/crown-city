import {test} from 'node:test';
import assert from 'node:assert/strict';
import {safeCrossing,boatPilot} from '../src/navigation_ai.js';
import {createCityAI} from '../src/city_ai.js';
import {tickWildlife} from '../src/wildlife.js';
import {circleBody,bodyContact,worldBodyHit} from '../src/collision.js';
import {harness} from './harness.js';

const car=(extra={})=>({x:0,y:0,rot:Math.PI/2,kind:'fare',def:{},traffic:true,vx:0,vy:0,...extra});
const city=extra=>{const G={player:{type:'foot',x:0,y:400},cam:{x:0,y:0},peds:[],vehicles:[],street:{fixtures:[]},settings:{quality:'low'},surfaceAt:()=> 'walk',solidAt:()=>false,...extra};G.cityAI=createCityAI(G);return G;};

test('crossing decisions reject stationary queues and wrecks, then resume when the actual corridor clears',()=>{
 const p={x:-90,y:0,hx:1,hy:0,walk:40},v=car({rot:0});
 const G={ticks:1,graph:{nodes:[{x:0,y:0,hw:70,hh:70}]},vehicles:[v],surfaceAt:x=>Math.abs(x)<70?'road':'walk'};
 assert.equal(safeCrossing(G,p),false);
 Object.assign(v,{dead:true,vx:180});G.ticks+=11;assert.equal(safeCrossing(G,p),false,'wreck velocity cannot make its occupied crossing appear clear');
 v.y=140;G.ticks+=11;assert.equal(safeCrossing(G,p),true,'a parked body beside the crossing does not close it');
});

test('buses serve only a shelter beside their curb lane, never across opposing traffic or mid-turn',()=>{
 for(const [side,lane,turn,stop] of [[40,1,null,true],[-40,1,null,false],[40,0,null,false],[40,1,{},false]]){
  const v=car({kind:'bus',tr:{lane,e:{lanes:2},turn}}),G=city({vehicles:[v],street:{fixtures:[{x:0,y:side,kind:2}]}});
  G.cityAI.begin(.2);assert.equal(G.cityAI.trafficSpeed(v,80),stop?0:80,JSON.stringify({side,lane,turn}));
 }
});

test('a wrecked emergency siren cannot keep unrelated traffic permanently yielding',()=>{
 const v=car(),emergency=car({x:-100,y:15,siren:true,dead:true}),G=city({vehicles:[v,emergency]});
 G.cityAI.begin(.2);assert.equal(G.cityAI.trafficSpeed(v,80),80);
 emergency.dead=false;G.cityAI.begin(.2);assert.equal(G.cityAI.trafficSpeed(v,80),20);
});

test('an interrupted conversation clears the remaining partner gesture immediately',()=>{
 const ped=x=>({x,y:0,rot:0,walk:34,speed:0,dist:0,r:8,ambient:true,flee:0});
 const a=ped(0),b=ped(32),G=city({peds:[a,b]});
 for(let i=0;i<700&&a.cityState?.mode!=='talk';i++){G.cityAI.begin(.1);G.cityAI.steerPed(a,.1);G.cityAI.steerPed(b,.1);}
 assert.equal(a.cityActivity,'conversation');assert.equal(b.cityActivity,'conversation');
 G.cityAI.emit('gunshot',a.x,a.y,{radius:15});G.cityAI.begin(.2);
 assert.ok(a.flee>0);assert.equal(b.flee,0);assert.equal(b.cityState.mode,'walk');assert.equal(b.cityActivity,null);
});

function habitat(a,vehicles){const G=city({player:{type:'foot',x:0,y:500},vehicles,ticks:0,time:12,audio:{},shotsFired:0});delete G.cityAI;
 G.wildlife={animals:[a],active:[a],bins:new Map([[Math.floor(a.hx/512)+':'+Math.floor(a.hy/512),[a]]]),elapsed:0,shot:0,stats:{}};return G;}
const animal=extra=>({id:0,kind:2,x:-100,y:0,hx:-100,hy:0,angle:0,target:0,walk:1,flee:0,t:100,phase:0,lift:0,...extra});
test('ground wildlife never walks through a parked or wrecked vehicle body',()=>{
 for(const dead of [false,true]){
  const v=car({rot:0,dead}),a=animal(),G=habitat(a,[v]);let travel=0;
  for(let i=0;i<1200;i++){G.ticks++;tickWildlife(G,1/60);travel=Math.max(travel,Math.hypot(a.x+100,a.y));assert.equal(circleBody(v,a.x,a.y,7),false);}
  assert.ok(travel>40,'animal should still explore its habitat');
 }
});

test('birds keep airborne while a vehicle occupies their landing spot',()=>{
 const a=animal({kind:4,x:0,hx:0,lift:10,walk:0}),v=car(),G=habitat(a,[v]);
 tickWildlife(G,.1);assert.ok(a.lift>10);assert.equal(a.walk,1);
});

test('opposing canal boats pass repeatedly for a minute without contact, beaching or a stopped deadlock',async()=>{
 const {G,T}=await harness();T.startFreeRide(G);
 const a=T.makeVeh('wake',6968,3200,Math.PI,{role:'boat',home:{x:6968,y:3200}}),b=T.makeVeh('wake',6968,3600,0,{role:'boat',home:{x:6968,y:3600}});
 G.vehicles=[a,b];G.peds=[];G.player=T.makeFoot(G,6800,3400,0);G.cam.x=6968;G.cam.y=3400;G.wet=0;
 let passes=0,side=false,wait=0,maxWait=0;
 for(let i=0;i<3600;i++){
  G.ticks++;for(const v of G.vehicles)T.tickDrive(G,v,boatPilot(G,v,1/60),1/60,false);
  assert.equal(bodyContact(a,b),null);T.tickCollisions(G);
  if((a.y>b.y)!==side){side=a.y>b.y;passes++;}
  for(const v of G.vehicles)assert.equal(worldBodyHit(G,v,v.x,v.y),null);
  wait=Math.hypot(a.vx,a.vy)<3&&Math.hypot(b.vx,b.vy)<3?wait+1:0;maxWait=Math.max(maxWait,wait);
 }
 assert.ok(passes>=3);assert.ok(maxWait<60);assert.equal(a.health,100);assert.equal(b.health,100);
});
