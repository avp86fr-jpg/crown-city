import {test} from 'node:test';
import assert from 'node:assert/strict';
import {harness} from './harness.js';
import {missionFlow} from '../src/story.js';
import {trackPoint,nearestTrack,CIRCUIT} from '../src/circuit_world.js';
import {circuitPilot} from '../src/motorsport.js';
import {bodyContact} from '../src/collision.js';
import {streetSceneSteps} from '../src/citylife.js';

const {G,T,dispatch}=await harness();
function newGame(){T.startNew(G);G.scene='play';G.needsBegin=false;G._flow=null;G.freeRoam=true;G.weatherT=1e9;G.settings.timeSpeed=0;}

test('world chips persist through reload, reset in a new game, and stay separate between save slots',()=>{
 newGame();for(const p of G.pickups){assert.equal(T.footClear(G,p.x,p.y,14),true);assert.notEqual(G.surfaceAt(p.x,p.y),'road');}
 const pickup=G.pickups[0],chips=G.chips;G.player=T.makeFoot(G,pickup.x,pickup.y,0);
 T.tickPlay(G,1/60);assert.equal(pickup.got,true);assert.equal(G.chips,chips+pickup.v);
 T.save(G,true);T.startFreeRide(G);assert.ok(G.pickups.every(p=>!p.got));
 assert.equal(T.loadSave(G,'story'),true);assert.equal(G.pickups[0].got,true);
 const restored=G.chips;G.player=T.makeFoot(G,pickup.x,pickup.y,0);T.tickPlay(G,1/60);assert.equal(G.chips,restored);
 T.startNew(G);assert.ok(G.pickups.every(p=>!p.got));
 T.restoreState(G,{...T.snapshot(G),pickups:{broken:true}});assert.ok(G.pickups.every(p=>!p.got));
});

test('checkpoint flags and unlocked vehicles do not change when the live session changes',()=>{
 newGame();const checkpoint=T.snapshot(G);G.flags.vaultBag=true;G.unlocked.push('nyx');
 assert.equal(checkpoint.flags.vaultBag,false);assert.equal(checkpoint.unlocked.includes('nyx'),false);
});

test('an interrupted race save on foot or in a boat returns to Fire’s pit meeting without crashing',()=>{
 for(const kind of ['foot','wake','plane']){
  newGame();G.freeRoam=false;G.missionIndex=1;G.objectiveIndex=1;G._flow=missionFlow('pink_slip',G.flags);
  G.player=kind==='foot'?T.makeFoot(G,CIRCUIT.pit.x,CIRCUIT.pit.y,0):T.makeVeh(kind,6900,7500,0);
  const data={...T.snapshot(G),race:{version:2,i:5,rivalI:4,t:20,countdown:0,rival:trackPoint(1300)}};
  assert.equal(T.restoreState(G,data),true);assert.equal(G.race,null);assert.equal(G.objectiveIndex,0);assert.equal(G.scene,'play');
 }
});

test('off-track or malformed saved rivals restart the race on the grid with no reward',()=>{
 for(const rival of [{x:100,y:100,rot:0},{x:null,y:7900},{x:Infinity,y:7900}]){
  newGame();G.vehicles=[];G.freeRoam=false;G.missionIndex=1;G.objectiveIndex=1;G._flow=missionFlow('pink_slip',G.flags);
  const p=trackPoint(600);G.player=T.makeVeh('riot',p.x,p.y,p.rot);G.vehicles.push(G.player);
  const data={...T.snapshot(G),race:{version:2,i:5,rivalI:4,t:20,countdown:0,rival}},chips=G.chips;
  assert.equal(T.restoreState(G,data),true);assert.equal(G.race.i,0);assert.equal(G.race.countdown,3);assert.equal(G.chips,chips);
  assert.ok(nearestTrack(G.player.x,G.player.y).d<50);assert.equal(G.vehicles.filter(v=>v.raceRival).length,1);
 }
});

test('a cancelled pointer releases keyboard and touch holds until a fresh press',()=>{
 newGame();dispatch('keydown',{code:'KeyW'});dispatch('keydown',{code:'KeyK'});G.input.tBrake=true;G.jack={t:.3};
 dispatch('pointercancel');G._pulseInput();assert.equal(G.input.y,0);assert.equal(G.input.fire,false);assert.equal(G.input.brake,false);assert.equal(G.jack,null);
 dispatch('keydown',{code:'KeyW',repeat:true});G._pulseInput();assert.equal(G.input.y,0);
 dispatch('keyup',{code:'KeyW'});dispatch('keydown',{code:'KeyW'});G._pulseInput();assert.equal(G.input.y,1);dispatch('keyup',{code:'KeyW'});G.releaseControls();
});

for(const dead of [false,true])for(const distance of [106,320])test(`circuit drivers pass a ${dead?'wreck':'parked car'} initially ${distance} units ahead with physical clearance`,()=>{
 newGame();G.vehicles=[];G.peds=[];G.cops=[];G.player=T.makeFoot(G,CIRCUIT.pit.x,CIRCUIT.pit.y,0);
 const p=trackPoint(600),q=trackPoint(600+distance),v=T.makeVeh('nyx',p.x,p.y-28,p.rot,{racerIndex:0,vx:distance>200?140:0,vy:0}),o=T.makeVeh('fare',q.x,q.y-28,q.rot,{parked:true,dead,health:dead?0:100});
 G.vehicles=[v,o];G.cam.x=v.x;G.cam.y=v.y;const pos=[o.x,o.y];let passed=false,maxPen=0;
 for(let i=0;i<60*18;i++){
  T.tickDrive(G,v,circuitPilot(G,v,1/60),1/60,false);maxPen=Math.max(maxPen,bodyContact(v,o)?.pen||0);T.tickCollisions(G);G.ticks++;
  if(nearestTrack(v.x,v.y).s>1150){passed=true;break;}
 }
 assert.equal(passed,true,`driver stalled at ${v.x},${v.y}`);assert.ok(maxPen<1,'planned path must clear the parked hull');assert.ok(v.health>98);assert.deepEqual([o.x,o.y],pos);
});

test('mobile street detail stays within 3 MiB during exploration and keeps its world scale when quality changes',()=>{
 newGame();G.settings.quality='low';const calls=[],ctx=new Proxy({drawImage:(image,...dst)=>calls.push({image,dst})},{get:(o,k)=>o[k]||(()=>{})});
 for(let i=0;i<20;i++){const x=4096+i*512;for(const step of streetSceneSteps(G,{x0:x,y0:4096,x1:x+511,y1:4607},ctx)){} }
 assert.ok([...G.street.roadCache.values()].reduce((n,c)=>n+c.width*c.height*4,0)<=3*1024*1024);
 const r={x0:4096,y0:4096,x1:4607,y1:4607};calls.length=0;for(const step of streetSceneSteps(G,r,ctx)){}
 const low=calls.find(c=>c.dst[0]===4096&&c.dst[1]===4096);assert.equal(low.image.width,256);assert.deepEqual(low.dst,[4096,4096,512,512]);
 G.settings.quality='high';calls.length=0;for(const step of streetSceneSteps(G,r,ctx)){}
 const high=calls.find(c=>c.dst[0]===4096&&c.dst[1]===4096);assert.equal(high.image.width,512);assert.deepEqual(high.dst,low.dst);
 G.settings.quality='low';for(const step of streetSceneSteps(G,r,ctx)){}assert.equal(high.image.width,1,'lowering quality releases the larger backing canvas');
 assert.ok([...G.street.roadCache.values()].reduce((n,c)=>n+c.width*c.height*4,0)<=3*1024*1024);
});

test('a circuit driver with a blocked rear waits for space instead of reversing into a pedestrian',()=>{
 newGame();G.vehicles=[];G.peds=[];const p=trackPoint(650);
 const v=T.makeVeh('nyx',p.x,p.y,p.rot,{racerIndex:0}),o=T.makeVeh('fare',p.x+106,p.y,p.rot,{parked:true,dead:true});
 G.vehicles=[v,o];G.player=T.makeFoot(G,p.x-66,p.y,0);
 for(let i=0;i<60;i++){const input=circuitPilot(G,v,1/60);assert.ok(input.y>=0);T.tickDrive(G,v,input,1/60,false);}
 assert.ok(v.x>=p.x-.1);assert.equal(bodyContact(v,o),null);
});
