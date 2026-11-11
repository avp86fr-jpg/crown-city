import {test} from 'node:test';
import assert from 'node:assert/strict';
import {harness} from './harness.js';
import {worldBodyHit} from '../src/collision.js';
import {TRACK,TRACK_LENGTH,CIRCUIT,trackPoint,nearestTrack,inCircuit} from '../src/circuit_world.js';
import {circuitPilot,startCircuit,tickCircuit,nearCircuit} from '../src/motorsport.js';
import {actionState,actionSave,startContract,tickAction} from '../src/action.js';
import {tickDropJob,dropPrediction,DROP_TARGETS} from '../src/airdrop.js';
import {safeCrossing} from '../src/navigation_ai.js';
const {G,T}=await harness();
function reset(){T.startFreeRide(G);G.vehicles=[];G.peds=[];G.cops=[];G.wanted=0;G.weather='clear';G.wet=0;G.action=actionState();G.parcel=null;G.circuitSession=null;G.player=T.makeFoot(G,CIRCUIT.pit.x,CIRCUIT.pit.y,0);G.input.fire=G.input.fireP=false;}

test('every sampled racing-line hull clears scenery; perimeter and pit buildings remain solid',()=>{
 const car=T.makeVeh('nyx',0,0,0);for(const p of TRACK){Object.assign(car,p);assert.equal(worldBodyHit(G,car,p.x,p.y),null,`track ${p.s}`);}
 assert.equal(G.surfaceAt(1600,7550),'build');assert.equal(G.surfaceAt(660,8000),'build');assert.equal(G.surfaceAt(3720,7656),'lot');assert.equal(G.surfaceAt(3008,7656),'lot');
 assert.ok(TRACK_LENGTH>7000);assert.ok(!G.graph.edges.some(e=>inCircuit((e.A.x+e.B.x)/2,(e.A.y+e.B.y)/2)),'ordinary traffic must stay outside the circuit');
});
test('city gateway lanes and their crossing road stay drivable with full-size hulls',()=>{
 const car=T.makeVeh('riot',0,0,0);
 for(const x of [500,980,1470,1964,2430,2900,3370,3840])for(let y=3860;y<=4210;y+=12){car.rot=0;car.x=x+(x===1964?55:30);car.y=y;assert.equal(worldBodyHit(G,car,car.x,y),null,`${x}/${y}`);}
 for(const y of [1600,2620])for(let x=3720;x<4160;x+=12){car.rot=Math.PI/2;assert.equal(worldBodyHit(G,car,x,y+30),null,`east ${x}/${y}`);}
 for(const x of [3790,3890])for(let y=1450;y<2830;y+=12){car.rot=0;assert.equal(worldBodyHit(G,car,x,y),null,`ring ${x}/${y}`);}
});
test('five opponents and a player using the same steering physics complete a clean circuit lap',()=>{
 reset();assert.equal(startCircuit(G,G.circuitHooks),true);const car=G.player;car.racerIndex=1;let frames=0,maxDistance=0;
 while(G.circuitSession.running&&frames++<60*110){if(!G.circuitSession.countdown)T.tickDrive(G,car,circuitPilot(G,car,1/60),1/60,true);tickCircuit(G,1/60,G.circuitHooks);T.tickCollisions(G);G.cam.x=car.x;G.cam.y=car.y;G.ticks++;maxDistance=Math.max(maxDistance,nearestTrack(car.x,car.y).d);}
 assert.equal(G.circuitSession.valid,true);assert.equal(G.circuitSession.running,false);assert.ok(G.action.circuitBest>35&&G.action.circuitBest<100);assert.equal(G.action.circuitLaps,1);assert.ok(maxDistance<68);
 const opponents=G.vehicles.filter(v=>v.circuitRacer);assert.equal(opponents.length,5);for(const v of opponents){assert.ok(v.health>95);assert.ok(nearestTrack(v.x,v.y).d<68);}
 const record=G.action.circuitBest;tickCircuit(G,1,G.circuitHooks);assert.equal(G.action.circuitLaps,1);assert.equal(G.action.circuitBest,record);
 assert.equal(actionState(actionSave(G.action)).circuitBest,record);
});
test('shortcuts, reversing and busted recovery cannot mint clean laps or rewards',()=>{
 reset();startCircuit(G,G.circuitHooks);const s=G.circuitSession;s.countdown=0;
 Object.assign(G.player,trackPoint(TRACK_LENGTH*.8));tickCircuit(G,1/60,G.circuitHooks);assert.equal(s.valid,false);assert.equal(G.action.circuitLaps,0);assert.equal(s.gate,1);
 Object.assign(G.player,trackPoint(500));s.lastS=500;s.distance=500;Object.assign(G.player,trackPoint(490));tickCircuit(G,1/60,G.circuitHooks);assert.ok(s.distance<500);
 T.busted(G);assert.equal(G.circuitSession,null);assert.equal(G.action.circuitLaps,0);assert.deepEqual([G.player.x,G.player.y],[2400,3736]);
});
test('circuit evidence mission requires a clean timed lap and pit return, and pays only once',()=>{
 reset();startContract(G,'circuit');tickAction(G,1/60,{moveFoot:T.moveFoot});assert.equal(G.action.contract.stage,1);
 G.circuitSession={running:false,valid:false,time:40};tickAction(G,1/60,{moveFoot:T.moveFoot});assert.equal(G.action.contract.stage,1);
 G.circuitSession={running:false,valid:true,time:101};tickAction(G,1/60,{moveFoot:T.moveFoot});assert.equal(G.action.contract.stage,1);
 G.circuitSession={running:false,valid:true,time:75};tickAction(G,1/60,{moveFoot:T.moveFoot});assert.equal(G.action.contract.stage,2);
 const before=G.chips;Object.assign(G.player,CIRCUIT.pit,{vx:0,vy:0});tickAction(G,1/60,{moveFoot:T.moveFoot});assert.equal(G.chips,before+2200);assert.equal(G.action.contract,null);tickAction(G,1/60,{moveFoot:T.moveFoot});assert.equal(G.chips,before+2200);
});
test('a circuit driver brakes for a parked car and does not teleport it out of the way',()=>{
 reset();const p=trackPoint(600),v=T.makeVeh('nyx',p.x,p.y,p.rot,{racerIndex:0,vx:150,vy:0}),o=T.makeVeh('fare',p.x+105,p.y,p.rot);G.vehicles=[v,o];const pos=[o.x,o.y];assert.equal(circuitPilot(G,v,1/60).brake,true);assert.deepEqual([o.x,o.y],pos);
 G.wanted=1;assert.equal(nearCircuit(G),false);
});
test('manual airplane releases use velocity and altitude and misses leave the current receiver pending',()=>{
 reset();const c={id:'airdrop',stage:1,progress:0},target=DROP_TARGETS[0];G.action.contract=c;
 G.player=T.makeVeh('plane',target.x-1000,target.y,Math.PI/2,{vx:180,vy:0,altitude:100});
 const prediction=dropPrediction(G.player);assert.ok(prediction.x>G.player.x);assert.ok(prediction.t>2);
 tickDropJob(G,c,.1,()=>{});assert.equal(G.parcel,null);G.input.fireP=true;tickDropJob(G,c,.01,()=>{});assert.ok(G.parcel);G.input.fireP=false;for(let i=0;i<200;i++)tickDropJob(G,c,1/60,()=>{});assert.equal(c.stage,1);assert.equal(G.parcel,null);
 G.player.altitude=20;G.input.fireP=true;tickDropJob(G,c,.01,()=>{});assert.equal(G.parcel,null);
});
test('three physical package impacts must precede a stopped runway return; rewards persist once',()=>{
 reset();G.player=T.makeFoot(G,9840,7780,0);startContract(G,'airdrop');tickAction(G,2.1,{moveFoot:T.moveFoot});assert.equal(G.action.contract.stage,1);
 for(const target of DROP_TARGETS){const altitude=90,time=Math.sqrt(altitude/19);G.player=T.makeVeh('plane',target.x-180*time,target.y,Math.PI/2,{vx:180,vy:0,altitude});G.input.fireP=true;tickAction(G,.01,{moveFoot:T.moveFoot});G.input.fireP=false;for(let i=0;i<150;i++)tickAction(G,1/60,{moveFoot:T.moveFoot});}
 assert.equal(G.action.contract.stage,4);const before=G.chips;
 Object.assign(G.player,{x:9600,y:7700,vx:0,vy:0,altitude:0});tickAction(G,3,{moveFoot:T.moveFoot});assert.equal(G.chips,before);
 G.player.y=7500;tickAction(G,2.1,{moveFoot:T.moveFoot});assert.equal(G.chips,before+2800);assert.equal(G.action.contract,null);tickAction(G,2,{moveFoot:T.moveFoot});assert.equal(G.chips,before+2800);
 const saved=actionState(actionSave(G.action));assert.ok(saved.completedJobs.includes('airdrop'));
});
test('roll distance follows actual swept movement and blocked rolls recover without sliding through walls',()=>{
 reset();G.player=T.makeFoot(G,704,3196,0);G.input.dodgeP=true;tickAction(G,1/60,{moveFoot:T.moveFoot});G.input.dodgeP=false;
 const y=G.player.y,start=G.player.dist;for(let i=0;i<40;i++)tickAction(G,1/60,{moveFoot:T.moveFoot});assert.ok(G.player.y>=3191);assert.ok(G.player.dist-start<12);assert.equal(G.action.dodgeT,0);assert.equal(T.footClear(G,G.player.x,G.player.y,7),true);
});
test('pedestrian prediction rejects a car in the far lane even when the near curb is clear',()=>{
 const game={ticks:0,surfaceAt:(x)=>x<0||x>200?'walk':'road',graph:{nodes:[{x:100,y:0,hw:100,hh:100}]},vehicles:[{x:170,y:-340,vx:0,vy:100,rot:Math.PI,kind:'fare',def:{}}]};
 assert.equal(safeCrossing(game,{x:-10,y:0,hx:1,hy:0,walk:36}),false);
 game.vehicles=[];assert.equal(safeCrossing(game,{x:-10,y:0,hx:1,hy:0,walk:36}),true);
});

test('circuit streaming reuses a bounded mobile image and retires it when quality changes',async()=>{
 const {drawCircuitGround}=await import('../src/circuit_world.js');const draws=[],ctx={drawImage:(...a)=>draws.push(a)},pats={},view={x0:1024,y0:7680,x1:1536,y1:8192};
 drawCircuitGround(ctx,view,pats,.5);const first=draws[0][0];assert.deepEqual([first.width,first.height],[1536,728]);assert.equal(draws[0][3],256);
 drawCircuitGround(ctx,view,pats,.5);assert.equal(draws[1][0],first);
 drawCircuitGround(ctx,view,pats,1);assert.equal(first.width,1);assert.equal(draws[2][0].width,3072);assert.equal(draws[2][3],512);
});
