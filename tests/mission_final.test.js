import {test} from 'node:test';
import assert from 'node:assert/strict';
import {harness} from './harness.js';
import {missionFlow,VN} from '../src/story.js';
import {beginJob,tickDirector,finishJob,directorState} from '../src/mission_director.js';
import {tickStreetJob} from '../src/side_jobs.js';
import {expansionJobTarget,tickExpansionJob} from '../src/expansion_jobs.js';
import {tickCircuit} from '../src/motorsport.js';
import {CIRCUIT,trackPoint,TRACK_LENGTH} from '../src/circuit_world.js';
const {G,T}=await harness();
function reset(){T.startFreeRide(G);G.scene='play';G.wanted=0;G.vehicles=[];G.peds=[];G.cops=[];G.ticks=100;G.circuitSession=null;G.circuitRespawns=null;G.circuitSleeping=false;G.action.contract=null;G.input.fire=G.input.fireP=false;G.interactP=false;}
function mission(index,id,objective=0){reset();G.freeRoam=false;G.missionIndex=index;G.objectiveIndex=objective;G.flags.heist='quiet';G._flow=missionFlow(id,G.flags);G.missionState={};}

test('witness pickup and delivery require a living road car with no gunfire',()=>{
 reset();const pickup=G.meta.spawns.raceStart,c={id:'rescue',stage:0,progress:0};
 for(const kind of ['heli','plane','wake','stitch']){G.player=T.makeVeh(kind,...pickup,0);G.player.altitude=90;tickStreetJob(G,c,4,()=>{});assert.equal(c.stage,0,kind);}
 G.player=T.makeVeh('riot',...pickup,0);G.player.dead=true;tickStreetJob(G,c,4,()=>{});assert.equal(c.stage,0);
 G.player.dead=false;G.input.fire=true;tickStreetJob(G,c,4,()=>{});assert.equal(c.stage,0);
 G.input.fire=false;tickStreetJob(G,c,3.1,()=>{});assert.equal(c.stage,1);assert.equal(G.wanted,2);
 G.wanted=0;G.player=T.makeVeh('heli',...G.meta.spawns.garage,0);assert.equal(tickStreetJob(G,c,3,()=>{}),false);
 G.player=T.makeVeh('riot',...G.meta.spawns.garage,0);G.input.fire=true;assert.equal(tickStreetJob(G,c,3,()=>{}),false);
 G.input.fire=false;assert.equal(tickStreetJob(G,c,2.1,()=>{}),true);
});

test('the clean driving bonus cannot be earned by flying a helicopter',()=>{
 reset();G.freeRoam=false;G.missionIndex=1;G.objectiveIndex=0;G.director=directorState();G._flow=missionFlow('pink_slip',G.flags);G.player=T.makeVeh('heli',5000,5000,0,{vx:400,vy:0,altitude:100});beginJob(G);
 for(let i=0;i<120;i++){G.player.x+=40;tickDirector(G,.1);}
 assert.equal(G.director.active.distance,0);assert.equal(G.director.active.drivingTime,0);assert.equal(finishJob(G,true).earned.includes('wheels'),false);
});

test('Palace casing is interrupted by movement and firing, then completes after a fresh still hold',()=>{
 mission(3,'the_tell');G.player=T.makeFoot(G,...G.meta.interactions.casinoDoor,0);G.player.speed=20;
 T.tickMission(G,3);assert.equal(G.objectiveIndex,0);assert.equal(G.missionState.holdT,0);
 G.player.speed=0;G.input.fire=true;T.tickMission(G,3);assert.equal(G.objectiveIndex,0);
 G.input.fire=false;T.tickMission(G,1.5);assert.equal(G.objectiveIndex,0);T.tickMission(G,.6);assert.equal(G.objectiveIndex,1);
});

test('leaving the archive interrupts the transfer and requires a new interaction',()=>{
 mission(4,'house_odds',1);const [x,y]=G.meta.interactions.casino;G.player=T.makeFoot(G,x,y,0);G.interactP=true;T.tickMission(G,.8);G.interactP=false;assert.ok(G.missionState.hacking);
 G.player.x+=1000;T.tickMission(G,.1);assert.equal(G.missionState.hacking,false);assert.equal(G.missionState.holdT,0);
 G.player.x=x;T.tickMission(G,4);assert.equal(G.objectiveIndex,1);G.interactP=true;T.tickMission(G,3.1);assert.equal(G.objectiveIndex,2);
});

test('taking flight clears interrupted campaign hold state',()=>{
 mission(4,'house_odds',1);G.player=T.makeVeh('heli',...G.meta.interactions.casino,0,{altitude:80});G.missionState={hacking:true,holdT:2.9};T.tickMission(G,.1);
 assert.equal(G.objectiveIndex,1);assert.equal(G.missionState.hacking,false);assert.equal(G.missionState.holdT,0);
});

test('the loud archive escape has its own alarm dialogue at the Palace',()=>{
 const quiet=missionFlow('house_odds',{heist:'quiet'}).midVN.page,loud=missionFlow('house_odds',{heist:'loud'}).midVN.page;
 assert.notEqual(loud,quiet);assert.equal(VN[loud].next,'play');assert.equal(VN[loud].bg,'palace');assert.equal(VN[quiet].bg,'palace');assert.match(VN[loud].text,/alarm is live/);assert.doesNotMatch(VN[loud].text,/blackout is holding/);
});

test('circuit contract guidance stays on the next sector after clearing or replacing a custom waypoint',()=>{
 reset();const c={id:'circuit',stage:1};G.circuitSession={running:true,gate:3};G.waypoint=null;
 const expected=trackPoint(TRACK_LENGTH*3/8);assert.deepEqual(expansionJobTarget(G,c),expected);G.waypoint={x:10,y:20};assert.deepEqual(expansionJobTarget(G,c),expected);
 assert.equal(tickExpansionJob(G,c,.1,()=>{}),false);assert.equal(c.stage,1);
});

test('old circuit wrecks retain their visible body and only respawn into an unseen clear grid slot',()=>{
 reset();const spawn=trackPoint(800),wreck=T.makeVeh('nyx',spawn.x,spawn.y,spawn.rot,{circuitRacer:true,racerIndex:0,dead:true,health:0,keep:true});
 G.vehicles=[wreck];G.player=T.makeFoot(G,spawn.x,spawn.y+100,0);Object.assign(G.cam,{x:spawn.x,y:spawn.y,rot:0,scale:1});tickCircuit(G,1/60,G.circuitHooks);
 G.ticks+=91*60;tickCircuit(G,1/60,G.circuitHooks);assert.ok(G.vehicles.includes(wreck),'visible wreck may not vanish');
 wreck.x=6200;wreck.y=8800;tickCircuit(G,1/60,G.circuitHooks);assert.equal(G.vehicles.includes(wreck),false);assert.equal(G.vehicles.some(v=>v.circuitRacer&&v.racerIndex===0),false,'replacement may not pop into the visible start straight');
 Object.assign(G.player,{x:CIRCUIT.pit.x,y:CIRCUIT.pit.y});Object.assign(G.cam,{x:6200,y:8800});tickCircuit(G,1/60,G.circuitHooks);
 const replacement=G.vehicles.filter(v=>v.circuitRacer&&v.racerIndex===0);assert.equal(replacement.length,1);assert.equal(replacement[0].health,100);
});
