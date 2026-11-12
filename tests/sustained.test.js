import {test} from 'node:test';
import assert from 'node:assert/strict';
import {harness} from './harness.js';
import {retireStreetActors,retirementOpacity} from '../src/street_lifecycle.js';
import {circleBody} from '../src/collision.js';
import {boatPilot} from '../src/navigation_ai.js';
import {startCircuit,tickCircuit,circuitPilot} from '../src/motorsport.js';
import {CIRCUIT} from '../src/circuit_world.js';
const {G,T}=await harness();
function reset(){T.startFreeRide(G);G.wanted=0;G.vehicles=[];G.peds=[];G.cops=[];G.traffic.target=G.pedsys.target=0;G.wet=0;G.weather='clear';G.weatherT=1e8;G.player=T.makeFoot(G,2108,2400,0);G.cam.x=2108;G.cam.y=2400;G.input.x=G.input.y=0;G.action.contract=null;}

test('ten minutes of combat debris stays bounded while owned and mission cars remain recoverable',()=>{
 reset();const owned=T.makeVeh('riot',2108,2400,0,{keep:true,dead:true}),mission=T.makeVeh('van',2200,2400,0,{mission:true,ambient:true,dead:true});G.vehicles=[owned,mission];
 let maxBodies=0,maxWrecks=0;
 for(let second=0;second<600;second++){
  G.ticks=second*60;
  if(second%3===0){G.peds.push({x:2120,y:2400,dead:true,ambient:true},{x:6000,y:2400,dead:true,ambient:true});G.vehicles.push(T.makeVeh('fare',2300,2400,0,{dead:true,ambient:true}),T.makeVeh('fare',6000,2400,0,{dead:true,ambient:true}));}
  retireStreetActors(G);maxBodies=Math.max(maxBodies,G.peds.length);maxWrecks=Math.max(maxWrecks,G.vehicles.length);
 }
 assert.ok(maxBodies<45,`bodies grew to ${maxBodies}`);assert.ok(maxWrecks<55,`wrecks grew to ${maxWrecks}`);assert.ok(G.vehicles.includes(owned)&&G.vehicles.includes(mission));
 const fading=G.peds.find(p=>p.retireAt!=null);if(fading)assert.ok(retirementOpacity(G,fading)>=0&&retirementOpacity(G,fading)<=1);
 // A transient stopped car may leave offscreen, but does not pop out of a visible queue.
 const parked=T.makeVeh('fare',2108,2400,0,{ambient:true});G.vehicles=[parked];retireStreetActors(G);G.ticks+=600*60;retireStreetActors(G);assert.ok(G.vehicles.includes(parked));parked.x=6000;retireStreetActors(G);assert.equal(G.vehicles.length,0);
});

test('mobile ambient scheduling halves updates without slowing player movement or the traffic clock',()=>{
 const results=[];
 for(const touch of [false,true]){
  reset();G.touch=touch;G.settings.quality='low';G.input.y=1;let calls=0,elapsed=0;const original=G.traffic.tick;
  G.traffic.tick=dt=>{calls++;elapsed+=dt;original(dt);};const y=G.player.y;
  for(let i=0;i<60;i++)T.tickPlay(G,1/60);
  G.traffic.tick=original;results.push({calls,elapsed,distance:y-G.player.y});
 }
 assert.equal(results[0].calls,60);assert.equal(results[1].calls,30);assert.ok(Math.abs(results[1].elapsed-1)<1e-9);assert.ok(Math.abs(results[0].distance-results[1].distance)<.1);assert.ok(results[1].distance>20);
});

test('mobile player impact checks still run between ambient movement updates',()=>{
 reset();G.touch=true;G.settings.quality='low';G.ticks=100;G.health=100;G.player.y=2360;
 G.vehicles=[T.makeVeh('riot',2108,2400,0,{loose:true,parked:false,vy:-160})];T.tickPlay(G,1/60);assert.ok(G.health<100,'odd simulation ticks must still resolve a car striking Chaos');
});

test('foot recovery and dismount searches avoid parked vehicle bodies',()=>{
 reset();const car=T.makeVeh('bus',2108,2400,Math.PI/4);G.vehicles=[car];const at=T.findSafe(G,car.x,car.y,10,true);assert.equal(circleBody(car,at.x,at.y,10),false);assert.ok(T.footClear(G,at.x,at.y,10));
});

test('adaptive mobile resolution respects the raster floor and waits for sustained recovery',()=>{
 reset();G.settings.autoRes=true;G.directRaster=true;G.resScale=.75;G._ar={t:0,n:0,sum:0};
 const window=(fps)=>{Object.assign(G._ar,{t:2,n:fps*2,sum:2});T.adaptRes(G,1/fps);};
 for(let i=0;i<8;i++)window(25);assert.equal(G.resScale,.75);
 for(let i=0;i<8;i++){window(60);window(44);}assert.equal(G.resScale,.75,'alternating short good windows must not trigger reallocations');
 for(let i=0;i<4;i++)window(60);assert.ok(G.resScale>.75,'sustained headroom restores detail');
 G.settings.autoRes=false;
});

test('a boat checks its reversing corridor, including wrecks and newly arriving vessels',()=>{
 const v={kind:'wake',def:{boat:true},x:0,y:0,rot:0,vx:0,vy:0},other={...v,y:160,dead:true};
 const game={vehicles:[v,other],surfaceAt:(x,y)=>y<-80?'build':'water'};
 assert.ok(boatPilot(game,v,.2).y>=0,'no reversing into a wreck');
 game.vehicles=[v];v.pilot=null;assert.ok(boatPilot(game,v,.2).y<0);
 game.vehicles.push({...other,y:140,dead:false});const input=boatPilot(game,v,.2);assert.equal(input.y,0);assert.equal(input.brake,true);
});

for(const lane of [0,1])test('a fast complete lap remains valid on '+(lane?'outside':'inside')+' hairpin lines',()=>{
 reset();G.touch=false;G.player=T.makeFoot(G,CIRCUIT.pit.x,CIRCUIT.pit.y,0);G.action.circuitClass='sport';assert.ok(startCircuit(G,G.circuitHooks));const car=G.player;car.racerIndex=lane;let frames=0,peak=0;
 while(G.circuitSession.running&&frames++<7200){if(!G.circuitSession.countdown)T.tickDrive(G,car,circuitPilot(G,car,1/60),1/60,true);tickCircuit(G,1/60,G.circuitHooks);T.tickCollisions(G);G.cam.x=car.x;G.cam.y=car.y;G.ticks++;peak=Math.max(peak,Math.hypot(car.vx,car.vy));}
 assert.ok(G.circuitSession.valid);assert.ok(G.action.circuitBest<65,'pace must be faster than the former ~90-second lap');assert.ok(peak*.36>105,'straight-line pace should exceed 105 km/h');assert.ok(car.health>95);assert.equal(G.action.circuitRecords.sport,G.action.circuitBest);
});
