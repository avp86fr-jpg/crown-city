import test from 'node:test';
import assert from 'node:assert/strict';
import {harness} from './harness.js';
import {CONTRACTS,actionState,startContract,tickAction} from '../src/action.js';
import {EXPANSION_JOBS,EXPANSION_STEPS,EXPANSION_DEBRIEFS,expansionJobTarget} from '../src/expansion_jobs.js';
import {tickStreetJob} from '../src/side_jobs.js';
import {MISSIONS,VN,missionFlow} from '../src/story.js';
import {beginJob,tickDirector,directorState,jobBrief} from '../src/mission_director.js';
const {G,T}=await harness();
function reset(){T.startFreeRide(G);G.scene='play';G.action=actionState();G.chips=0;G.wanted=0;G.input.fire=false;G.input.x=G.input.y=0;G.input.crewP=G.input.dodgeP=false;}
const tick=dt=>tickAction(G,dt,{moveFoot:T.moveFoot});

test('every expansion contract has ordered text, an ending, valid targets and saveable stages',()=>{
 reset();assert.equal(new Set(CONTRACTS.map(j=>j.id)).size,CONTRACTS.length);
 for(const job of EXPANSION_JOBS){
  assert.equal(EXPANSION_STEPS[job.id].length,job.stages+1,job.id);assert.ok(EXPANSION_DEBRIEFS[job.id]);
  for(let stage=0;stage<=job.stages;stage++){
   const c={id:job.id,stage,t:job.time,progress:0},p=expansionJobTarget(G,c);
   assert.ok(Number.isFinite(p.x)&&p.x>=0&&p.x<12288&&Number.isFinite(p.y)&&p.y>=0&&p.y<10240,job.id+stage);
   assert.ok(EXPANSION_STEPS[job.id][stage].length>12);assert.equal(actionState({contract:c}).contract.stage,stage);
  }
 }
});
test('all campaign branches resolve their intro, objectives and ending dialogue',()=>{
 for(const heist of ['quiet','loud'])for(const stash of ['flip','safe'])for(const mission of MISSIONS){
  assert.equal(jobBrief(MISSIONS.indexOf(mission)).title,mission.title);const flow=missionFlow(mission.id,{heist,stash});assert.ok(VN[flow.startVN],mission.id);
  const ending=typeof flow.winVN==='function'?flow.winVN():flow.winVN;assert.ok(VN[ending],mission.id);
  assert.equal(new Set(flow.objectives.map(o=>o.id)).size,flow.objectives.length);
  for(const o of flow.objectives)assert.ok(o.hint?.trim().length>10,mission.id+o.id);
  if(flow.midVN)assert.ok(VN[flow.midVN.page]);if(flow.loseVN)assert.ok(VN[flow.loseVN]);
 }
});
test('Low Tide rejects wrecks and zero-health boats, and requires an uninterrupted upload',()=>{
 reset();const c={id:'harbour',stage:1,progress:0};G.player=T.makeVeh('wake',1960,200,0);
 G.player.dead=true;tickStreetJob(G,c,4,()=>{});assert.equal(c.stage,1);
 G.player.dead=false;G.player.health=0;tickStreetJob(G,c,4,()=>{});assert.equal(c.stage,1);
 G.player.health=100;tickStreetJob(G,c,2,()=>{});G.input.fire=true;tickStreetJob(G,c,.1,()=>{});assert.equal(c.progress,0);
 G.input.fire=false;tickStreetJob(G,c,3.1,()=>{});assert.equal(c.stage,2);
});
test('drift rewards reject wrecked cars and motorcycles',()=>{
 for(const [kind,dead]of [['riot',true],['stitch',false]]){reset();startContract(G,'drift');G.player=T.makeVeh(kind,5000,5000,0,{vx:300,vy:0});G.player.dead=dead;G.player.drifting=true;tick(10);assert.equal(G.chips,0);assert.equal(G.action.contract.progress,0);}
});
test('courier handoffs require a stopped live carrier and cannot pay twice',()=>{
 reset();startContract(G,'courier');G.player=T.makeVeh('riot',...G.meta.spawns.garage,0,{vx:120,vy:0});tick(.1);assert.equal(G.action.contract.stage,0);
 G.player.vx=0;tick(.1);assert.equal(G.action.contract.stage,1);
 [G.player.x,G.player.y]=G.meta.interactions.neural;G.player.dead=true;tick(.1);assert.equal(G.chips,0);
 G.player.dead=false;G.input.fire=true;tick(.1);assert.equal(G.chips,0);G.input.fire=false;tick(.1);assert.equal(G.chips,650);tick(.1);assert.equal(G.chips,650);
});
test('steady objectives reuse guidance and refreshed objectives replace it',()=>{
 reset();G.freeRoam=false;G.missionIndex=0;G.objectiveIndex=0;G._flow=missionFlow('cold_wallet',G.flags);G.director=directorState();beginJob(G);tickDirector(G,.1);const guide=G.director.guidance;
 for(let i=0;i<120;i++)tickDirector(G,1/60);assert.equal(G.director.guidance,guide);
 G.objectiveIndex=1;tickDirector(G,.1);assert.notEqual(G.director.guidance,guide);assert.doesNotMatch(G.director.guidance.text,/Four clean/);
});
