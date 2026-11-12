import {test} from 'node:test';
import assert from 'node:assert/strict';
import {harness} from './harness.js';
import {CIRCUIT,PIT_LANE,TRACK_LENGTH,CIRCUIT_VERSION} from '../src/circuit_world.js';
import {worldBodyHit,bodyContact} from '../src/collision.js';
import {recoverRiot} from '../src/vehicle_recovery.js';
import {actionState,actionSave,startContract,tickAction,contractClockRunning} from '../src/action.js';
import {cycleRacePace,racePace} from '../src/circuit_rules.js';
import {startCircuit,pitDriveInput} from '../src/motorsport.js';
const {G,T}=await harness();
function reset(){T.startFreeRide(G);G.vehicles=[];G.peds=[];G.cops=[];G.wanted=0;G.action=actionState();G.circuitSession=null;G.player=T.makeFoot(G,840,3344,0);}
test('wider 12,000+ unit circuit has a continuous full-body pit route and clear public approach',()=>{
 assert.ok(TRACK_LENGTH>12000);assert.equal(CIRCUIT.half,108);
 const car=T.makeVeh('nyx',0,0,0);
 for(const points of [PIT_LANE,[[5200,7568],[6500,7568]]])for(let i=1;i<points.length;i++){
  const a=points[i-1],b=points[i],len=Math.hypot(b[0]-a[0],b[1]-a[1]);car.rot=Math.atan2(b[0]-a[0],a[1]-b[1]);
  for(let d=0;d<=len;d+=8){car.x=a[0]+(b[0]-a[0])*d/len;car.y=a[1]+(b[1]-a[1])*d/len;assert.equal(worldBodyHit(G,car,car.x,car.y),null,`pit route ${car.x}/${car.y}`);}
 }
 for(const y of [6900,9488])for(let x=530;x<6470;x+=32){car.rot=Math.PI/2;assert.equal(worldBodyHit(G,car,x,y+36),null,`perimeter ${x}/${y}`);}
});
test('Riot recovery reuses the same vehicle, checks both bays and refuses unsafe or active-job recovery',()=>{
 reset();const riot=T.makeVeh('riot',5000,5000,0,{mission:true,dead:true,health:0,burning:true,damage:{engine:1}});G.vehicles.push(riot);
 assert.equal(recoverRiot(G),true);assert.equal(G.vehicles.length,1);assert.equal(riot.health,100);assert.equal(riot.dead,false);assert.equal(riot.damage,null);assert.equal(worldBodyHit(G,riot,riot.x,riot.y),null);
 assert.equal(recoverRiot(G),true);assert.equal(G.vehicles[0],riot);
 const block=T.makeVeh('fare',768,3344,Math.PI);G.vehicles.push(block);assert.equal(recoverRiot(G),true);assert.equal(riot.y,3452);assert.equal(bodyContact(riot,block),null);
 G.vehicles.push(T.makeVeh('fare',768,3452,Math.PI));const before=[riot.x,riot.y];assert.equal(recoverRiot(G),false);assert.deepEqual([riot.x,riot.y],before);G.vehicles=[riot];
 G.action.contract={id:'circuit'};assert.equal(recoverRiot(G),false);G.action.contract=null;G.wanted=1;assert.equal(recoverRiot(G),false);G.wanted=0;G.player=riot;assert.equal(recoverRiot(G),false);
});
test('race classes preserve separate versioned records and cannot change an active contract',()=>{
 reset();G.action.circuitBest=170;G.action.circuitRecords.club=170;assert.equal(cycleRacePace(G),true);assert.equal(racePace(G).id,'sport');assert.equal(G.action.circuitBest,0);G.action.circuitBest=140;G.action.circuitRecords.sport=140;cycleRacePace(G);cycleRacePace(G);assert.equal(G.action.circuitBest,170);
 const saved=actionState(actionSave(G.action));assert.equal(saved.circuitRecords.sport,140);assert.equal(saved.circuitVersion,CIRCUIT_VERSION);assert.equal(actionState({circuitBest:55,circuitVersion:1}).circuitBest,0);
 G.action.contract={id:'circuit'};assert.equal(cycleRacePace(G),false);G.action.contract=null;G.circuitSession={running:true};assert.equal(cycleRacePace(G),false);
});
test('destroyed circuit loaner is reused, and an occupied start cannot place two cars together',()=>{
 reset();G.player=T.makeFoot(G,CIRCUIT.pit.x,CIRCUIT.pit.y,0);assert.equal(startCircuit(G,G.circuitHooks),true);const loaner=G.player;loaner.dead=true;loaner.health=0;G.circuitSession=null;G.player=T.makeFoot(G,CIRCUIT.pit.x,CIRCUIT.pit.y,0);assert.equal(startCircuit(G,G.circuitHooks),true);assert.equal(G.player,loaner);assert.equal(G.vehicles.length,1);assert.equal(loaner.health,100);
 G.circuitSession=null;G.player=T.makeFoot(G,CIRCUIT.pit.x,CIRCUIT.pit.y,0);G.vehicles.push(T.makeVeh('fare',loaner.x,loaner.y,loaner.rot));assert.equal(startCircuit(G,G.circuitHooks),false);assert.match(G.action.message.text,/occupied/);
});
test('pit limiter brakes progressively with normal physics and leaves track input untouched',()=>{
 reset();const car=T.makeVeh('nyx',2800,7568,Math.PI/2,{vx:170,vy:0}),input={x:0,y:1,boost:true};G.player=car;G.vehicles=[car];
 for(let i=0;i<60;i++)T.tickDrive(G,car,pitDriveInput(car,input),1/60,true);
 assert.ok(Math.hypot(car.vx,car.vy)<=112);assert.ok(car.x>2800);assert.equal(car.health,100);car.y=7900;assert.equal(pitDriveInput(car,input),input);
});
test('travel to expansion pickups does not consume their mission window',()=>{
 reset();for(const id of ['circuit','airdrop','casino','airlift']){G.action.contract=null;startContract(G,id);const c=G.action.contract,time=c.t;assert.equal(contractClockRunning(c),false);tickAction(G,60,{moveFoot:T.moveFoot});assert.equal(c.t,time);c.stage=1;assert.equal(contractClockRunning(c),true);}
 assert.equal(contractClockRunning({id:'drift',stage:0}),true);
});

test('offscreen sleeping pedestrians clear stale velocity so traffic does not predict phantom crossings',()=>{
 reset();G.cam.x=3000;G.cam.y=3000;G.player=T.makeFoot(G,3000,3000,0);
 const p={x:815,y:2500,rot:Math.PI/2,walk:35,speed:130,vx:130,vy:0,dist:0,hx:1,hy:0};G.peds=[p];const before=[p.x,p.y];T.tickPeds(G,1/60);assert.deepEqual([p.speed,p.vx,p.vy],[0,0,0]);assert.deepEqual([p.x,p.y],before);
});
