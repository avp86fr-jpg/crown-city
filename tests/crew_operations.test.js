import {test} from 'node:test';
import assert from 'node:assert/strict';
import {harness} from './harness.js';
import {actionState,actionSave,startContract,tickAction,CONTRACTS,contractClockRunning} from '../src/action.js';
import {operationTarget,tickOperation,operationStatus,SKY_SCANS} from '../src/crew_operations.js';
import {worldBodyHit} from '../src/collision.js';
import {restoreStreetRoute} from '../src/side_jobs.js';
const {G,T}=await harness(),hooks={moveFoot:T.moveFoot};
function reset(){T.startFreeRide(G);G.scene='play';G.wanted=0;G.action=actionState();G.health=100;G.chips=0;G.input.fire=false;G.input.fireP=false;G.input.crewP=false;G.input.dodgeP=false;G.input.x=G.input.y=0;G.vehicles=[];G.cops=[];G.peds=[];G._endT=0;}
function tick(seconds){for(let t=0;t<seconds;t+=.1)tickAction(G,Math.min(.1,seconds-t),hooks);}
function atStage(kind='fare'){const at=operationTarget(G,G.action.contract);G.player=kind==='foot'?T.makeFoot(G,at.x,at.y):T.makeVeh(kind,at.x,at.y,0);return G.player;}
function loadCargo(){startContract(G,'coldchain');atStage();tick(3.1);assert.equal(G.action.contract.stage,1);}
function scan(c,index){const at=SKY_SCANS[index];G.player=T.makeVeh('plane',at.x-370,at.y,Math.PI/2,{altitude:165,vx:230,vy:0,airspeed:230,lean:0});for(let n=0;n<186;n++){G.player.x+=230/60;tickAction(G,1/60,hooks);}}

test('operation checkpoints fit the real collision map and contracts survive save sanitization',()=>{
 reset();for(let stage=0;stage<4;stage++){const p=operationTarget(G,{id:'coldchain',stage});const v=T.makeVeh('fare',p.x,p.y,0);assert.equal(worldBodyHit(G,v,p.x,p.y),null,'cargo stop '+stage);}
 for(const stage of [0,5]){const p=operationTarget(G,{id:'skytrace',stage});assert.ok(T.footClear(G,p.x,p.y,7));}
 for(const id of ['coldchain','skytrace']){assert.ok(CONTRACTS.some(c=>c.id===id));const A=actionState({contract:{id,stage:2,t:500,progress:1.25,integrity:64,warnings:1}});const saved=actionState(actionSave(A));assert.equal(saved.contract.id,id);assert.equal(saved.contract.integrity,64);assert.equal(saved.contract.stage,2);assert.equal(saved.contract.progress,1.25);}
 const clean=actionState({contract:{id:'skytrace',stage:99,t:9999,integrity:Infinity,warnings:-2}}).contract;assert.equal(clean.stage,5);assert.equal(clean.t,780);assert.equal(clean.integrity,100);assert.equal(clean.warnings,0);
});
test('loading requires a quiet stopped living car and leaves the clock idle until pickup',()=>{
 reset();startContract(G,'coldchain');assert.equal(contractClockRunning(G.action.contract),false);const max=G.action.contract.t;
 for(const kind of ['foot','stitch','wake','heli','plane']){atStage(kind);tick(4);assert.equal(G.action.contract.stage,0,kind);}
 let car=atStage();car.dead=true;tick(4);assert.equal(G.action.contract.stage,0);car.dead=false;car.vx=50;tick(4);assert.equal(G.action.contract.stage,0);car.vx=0;
 tick(2);G.input.fire=true;tick(.1);assert.equal(G.action.contract.progress,0);G.input.fire=false;G.wanted=1;tick(4);assert.equal(G.action.contract.stage,0);assert.equal(G.action.contract.t,max);
 G.wanted=0;tick(3.1);assert.equal(G.action.contract.stage,1);assert.equal(contractClockRunning(G.action.contract),true);assert.equal(G.action.contract.integrity,100);
});
test('crashes and drifting harm the recorder, repairs and changing cars cannot restore it',()=>{
 reset();loadCargo();const c=G.action.contract,p=G.player;p.health=80;tick(.1);assert.equal(c.integrity,73);p.health=100;tick(.1);assert.equal(c.integrity,73);
 p.vx=160;p.drifting=true;tick(2);assert.ok(Math.abs(c.integrity-67)<.01);p.drifting=false;p.vx=0;
 const before=c.integrity;G.player=T.makeFoot(G,p.x,p.y);tick(.2);G.player=T.makeVeh('dart',p.x,p.y,0);tick(.2);assert.equal(c.integrity,before);
 const saved=T.snapshot(G);T.restoreState(G,saved);assert.equal(G.action.contract.integrity,before);assert.equal(G.action.contract.stage,1);restoreStreetRoute(G);assert.deepEqual(G.waypoint,operationTarget(G,G.action.contract));
});
test('cargo operation validates ordered checksums and pays once only at the final stop',()=>{
 reset();loadCargo();const def=CONTRACTS.find(c=>c.id==='coldchain');
 for(let stage=1;stage<=3;stage++){atStage();tick(2);assert.equal(G.chips,0);assert.equal(G.action.contract.stage,stage);tick(1.1);}
 assert.equal(G.action.contract,null);assert.equal(G.chips,def.reward);assert.ok(G.action.completedJobs.includes('coldchain'));assert.equal(G.action.completed,1);tick(5);assert.equal(G.chips,def.reward);
 assert.equal(startContract(G,'coldchain'),true);atStage();tick(3.1);assert.equal(G.action.contract.integrity,100);
});
test('a destroyed recorder fails without a reward and a retry starts with a fresh case',()=>{
 reset();loadCargo();G.player.health=20;tick(.1);assert.equal(G.action.contract,null);assert.equal(G.chips,0);assert.equal(G.waypoint,null);assert.equal(G.action.completed,0);
 assert.equal(startContract(G,'coldchain'),true);atStage();tick(3.1);assert.equal(G.action.contract.integrity,100);assert.ok(G.action.contract.t>599);
});
test('flight scan rejects wrong aircraft, unsafe flight bands, turns and interrupted holds',()=>{
 reset();const c={id:'skytrace',stage:1,progress:0},at=operationTarget(G,c),notice=()=>{};
 const flight=(kind='plane',extra={})=>G.player=T.makeVeh(kind,at.x,at.y,Math.PI/2,{vx:230,vy:0,altitude:160,lean:0,...extra});
 for(const [kind,extra] of [['heli',{}],['plane',{altitude:90}],['plane',{altitude:250}],['plane',{vx:140}],['plane',{vx:400}],['plane',{lean:.2}],['plane',{stall:true}]]){flight(kind,extra);tickOperation(G,c,4,notice);assert.equal(c.stage,1);assert.equal(c.progress,0);}
 flight();tickOperation(G,c,2,notice);G.input.fire=true;tickOperation(G,c,.1,notice);assert.equal(c.progress,0);G.input.fire=false;tickOperation(G,c,2,notice);assert.equal(c.stage,1);G.player.x+=600;tickOperation(G,c,.1,notice);assert.equal(c.progress,0);
});
test('all three moving flight scans, runway return and quiet on-foot handoff complete Skyline Ghost',()=>{
 reset();startContract(G,'skytrace');atStage('foot');tick(2.1);assert.equal(G.action.contract.stage,1);
 for(let i=0;i<3;i++){scan(G.action.contract,i);assert.equal(G.action.contract.stage,i+2);assert.equal(G.chips,0);}
 assert.equal(G.wanted,2);assert.equal(G.action.contract.stage,4);
 atStage('foot');tick(3);assert.equal(G.action.contract.stage,4);const plane=atStage('plane');plane.altitude=90;tick(3);assert.equal(G.action.contract.stage,4);plane.altitude=0;tick(2.1);assert.equal(G.action.contract.stage,5);
 atStage('foot');tick(3);assert.equal(G.chips,0);G.wanted=0;tick(2.1);assert.equal(G.action.contract,null);assert.equal(G.chips,3200);tick(5);assert.equal(G.chips,3200);
});
test('timeout suppresses payout and busted recovery preserves checkpoints without healing cargo',()=>{
 reset();loadCargo();const c=G.action.contract;G.player.health=80;tick(.1);c.stage=2;c.progress=1.5;const integrity=c.integrity;T.busted(G);assert.equal(G.action.contract.stage,2);assert.equal(G.action.contract.progress,0);tick(.1);assert.equal(G.action.contract.integrity,integrity);assert.match(operationStatus(G,c),/1\/2 CHECKSUMS/);
 c.stage=3;c.t=1;atStage();tick(2);assert.equal(G.action.contract,null);assert.equal(G.chips,0);assert.equal(G.action.completed,0);
});

test('forced ejection from a destroyed carrier cannot preserve the recorder',()=>{
 reset();loadCargo();const car=G.player;car.dead=true;car.health=0;G.player=T.makeFoot(G,car.x+45,car.y);tick(.1);assert.equal(G.action.contract,null);assert.equal(G.chips,0);
});

test('flight guidance uses the same knots as the aircraft speedometer',()=>{
 reset();G.player=T.makeVeh('plane',0,0,0,{altitude:165,vx:230,vy:0});const text=operationStatus(G,{id:'skytrace',stage:1,progress:1.5});assert.match(text,/KTS 45 \[32–60\]/);assert.doesNotMatch(text,/165–310/);
});
