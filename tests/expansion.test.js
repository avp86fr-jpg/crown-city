import assert from 'node:assert/strict';
import {harness} from './harness.js';
import {WORLD_W,WORLD_H,districtAt} from '../src/world.js';
import {worldBodyHit} from '../src/collision.js';
import {FRONTIER} from '../src/expansion_world.js';
import {EXPANSION_JOBS,expansionJobTarget,tickExpansionJob} from '../src/expansion_jobs.js';
import {interactExpansion,initExpansion} from '../src/expansion.js';
import {actionState,startContract} from '../src/action.js';
const h=await harness(),{G,T}=h;let passed=0;
function test(name,fn){fn();passed++;console.log('ok',name);}
test('frontier expands the connected world and keeps every contact and pad accessible',()=>{
 assert.equal(WORLD_W,12288);assert.equal(WORLD_H,10240);assert.ok(WORLD_W*WORLD_H>10240*9216*1.3);
 for(const p of FRONTIER.contacts)assert.ok(T.footClear(G,p.x,p.y,7),p.id+' contact obstructed');
 for(const p of FRONTIER.helipads)assert.equal(G.surfaceAt(p.x,p.y),'lot',p.id);
 assert.ok(districtAt(11400,4920).includes('FOREST'));assert.ok(districtAt(5680,9730).includes('MESA'));assert.ok(districtAt(11200,9640).includes('SIERRA'));
 assert.ok(G.world.trees.filter(t=>t.pine).length>400);assert.ok(G.world.expansion.bridges.length>5);
});
test('boats pass below every canal bridge while cars cross on the road deck',()=>{
 const boat=T.makeVeh('wake',6968,1250,Math.PI),car=T.makeVeh('riot',6968,1250,Math.PI/2);
 for(let y=1250;y<=6150;y+=8){boat.y=y;assert.equal(worldBodyHit(G,boat,boat.x,boat.y),null,'boat blocked at '+y);}
 for(const b of G.world.expansion.bridges){car.y=b.y+b.h/2;assert.equal(G.surfaceAt(car.x,car.y),'road');assert.equal(G.world.boatSurfaceAt(car.x,car.y),'canal');assert.equal(worldBodyHit(G,car,car.x,car.y),null);}
 boat.x=6864;boat.y=1500;assert.ok(worldBodyHit(G,boat,boat.x,boat.y),'boat must hit embankment');
});
test('boat contract requires ordered water gates and a quiet handoff on foot',()=>{
 G.wanted=0;G.input.fire=false;G.player=T.makeFoot(G,6810,1250);const c={id:'canal',stage:0,progress:0};const notify=()=>{};
 tickExpansionJob(G,c,2,notify);assert.equal(c.stage,1);
 let t=expansionJobTarget(G,c);G.player=T.makeFoot(G,t.x,t.y);tickExpansionJob(G,c,2,notify);assert.equal(c.stage,1);
 G.player=T.makeVeh('wake',t.x,t.y,0);tickExpansionJob(G,c,.1,notify);assert.equal(c.stage,2);
 for(let i=2;i<4;i++){t=expansionJobTarget(G,c);Object.assign(G.player,t);tickExpansionJob(G,c,.1,notify);}
 assert.equal(c.stage,4);assert.equal(G.wanted,2);t=expansionJobTarget(G,c);G.player=T.makeFoot(G,t.x,t.y);assert.equal(tickExpansionJob(G,c,3,notify),false);G.wanted=0;assert.equal(tickExpansionJob(G,c,2,notify),true);
});
test('casino evidence cannot be collected while driving, moving or firing',()=>{
 G.wanted=0;const c={id:'casino',stage:0,progress:0},p=expansionJobTarget(G,c);G.player=T.makeVeh('riot',p.x,p.y,0);tickExpansionJob(G,c,10,()=>{});assert.equal(c.stage,0);
 G.player=T.makeFoot(G,p.x,p.y);G.input.fire=true;tickExpansionJob(G,c,10,()=>{});assert.equal(c.stage,0);G.input.fire=false;
 for(let i=0;i<3;i++){Object.assign(G.player,expansionJobTarget(G,c));tickExpansionJob(G,c,3,()=>{});}assert.equal(c.stage,3);assert.equal(G.wanted,2);
 G.wanted=0;Object.assign(G.player,expansionJobTarget(G,c));assert.equal(tickExpansionJob(G,c,2,()=>{}),true);
});
test('airlift requires grounded helicopters and ridge refuses flight shortcuts',()=>{
 G.wanted=0;G.input.fire=false;const c={id:'airlift',stage:1,progress:0},p=expansionJobTarget(G,c);G.player=T.makeVeh('heli',p.x,p.y,0);G.player.altitude=100;
 tickExpansionJob(G,c,5,()=>{});assert.equal(c.stage,1);G.player.altitude=0;tickExpansionJob(G,c,3,()=>{});assert.equal(c.stage,2);
 const ridge={id:'ridge',stage:1,progress:0};Object.assign(G.player,expansionJobTarget(G,ridge));tickExpansionJob(G,ridge,2,()=>{});assert.equal(ridge.stage,1);
 G.player=T.makeVeh('dart',G.player.x,G.player.y,0);tickExpansionJob(G,ridge,.1,()=>{});assert.equal(ridge.stage,2);
});
test('encounters start local stories, save discoveries and sanitize corrupted expansion saves',()=>{
 T.startNew(G);G.scene='play';G.action=actionState();const p=FRONTIER.contacts[1];G.player=T.makeFoot(G,p.x,p.y);assert.equal(interactExpansion(G),true);assert.equal(G.action.contract.id,'casino');assert.deepEqual(G.expansionState.visited,['gold_mage']);
 const d=T.snapshot(G);T.restoreState(G,d);assert.equal(G.action.contract.id,'casino');assert.ok(G.expansionState.visited.includes('gold_mage'));
 const count=G.vehicles.filter(v=>v.canalDock).length;initExpansion(G,{visited:['gold_mage','evil','gold_mage'],deliveries:Infinity});assert.equal(G.vehicles.filter(v=>v.canalDock).length,count);assert.deepEqual(G.expansionState.visited,['gold_mage']);
 for(const job of EXPANSION_JOBS){G.action=actionState();assert.equal(startContract(G,job.id),true);const saved=T.snapshot(G);T.restoreState(G,saved);assert.equal(G.action.contract.id,job.id);assert.equal(G.action.contract.t,job.time);}
});
test('new mission handoffs are clear and a boat save under a bridge remains on water',()=>{
 T.startNew(G);G.scene='play';
 for(const id of ['casino','airlift','ridge'])for(const stage of (id==='casino'?[0,1,2,3]:id==='airlift'?[0]:[0,3])){const p=expansionJobTarget(G,{id,stage});assert.ok(T.footClear(G,p.x,p.y,7),id+' stage '+stage);}
 const b=G.world.expansion.bridges[2],boat=T.makeVeh('wake',6968,b.y+b.h/2,0,{keep:true});G.vehicles.push(boat);T.enterVeh(G,boat,true);const d=T.snapshot(G);T.restoreState(G,d);assert.equal(G.player.kind,'wake');assert.ok(Math.hypot(G.player.x-d.px,G.player.y-d.py)<1);assert.equal(worldBodyHit(G,G.player,G.player.x,G.player.y),null);
});
console.log(`${passed} expansion checks passed`);
