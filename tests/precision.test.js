import {before,test} from 'node:test';
import assert from 'node:assert/strict';
import {harness} from './harness.js';
import {playerAim} from '../src/combat.js';
import {WEAPONS,actionState} from '../src/action.js';
import {WEAPON_ART} from '../src/weapons.js';
import {trackPoint,CIRCUIT,nearestTrack} from '../src/circuit_world.js';
import {nearCircuit,circuitHint} from '../src/motorsport.js';
import {missionFlow} from '../src/story.js';
import {flagsFrom} from '../src/session.js';
let G,T,solid,surface;
before(async()=>{({G,T}=await harness());solid=G.solidAt;surface=G.surfaceAt;});
function flat(){G.wanted=0;G.scene='play';G.touch=false;G.settings.aimAssist=true;G.solidAt=()=>false;G.surfaceAt=()=> 'road';G.player=T.makeFoot(G,500,500,0);G.action=actionState();G.vehicles=[];G.peds=[];G.cops=[];G.bullets=[];G.rockets=[];G.input.fire=false;G.input.mouse.fire=false;G.input.x=G.input.y=0;G.cam.rot=.4;G.cam.x=G.cam.y=500;G._flow=null;}
test('manual mouse targeting remains exact with aim assist enabled and a nearer cop off-axis',()=>{
 flat();G.cops=[{x:510,y:390}];const click=T.worldToScreen(G,500,277);Object.assign(G.input.mouse,click,{fire:true});
 assert.ok(Math.abs(playerAim(G,G.player).rot)<1e-10);T.shoot(G,G.player,true);
 assert.ok(Math.abs(Math.atan2(G.bullets[0].vx,-G.bullets[0].vy))<WEAPONS[0].spread/2);
 G.action.shotT=1;Object.assign(G.input.mouse,T.worldToScreen(G,700,477));G.input.fire=true;T.tickPlayer(G,1/60);
 assert.ok(Math.abs(G.player.aimRot-Math.PI/2)<1e-8,'held aim must update between rounds');
});
test('touch assistance favors alignment, has a narrow correction, and rejects occluded targets',()=>{
 flat();G.touch=true;G.cam.rot=0;G.input.touchAim={active:true,aiming:true,x:0,y:1};
 const near={x:508,y:400},aligned={x:504,y:250};G.cops=[near,aligned];let aim=playerAim(G,G.player);
 assert.equal(aim.target,aligned);assert.ok(Math.abs(aim.rot)<=.035);
 G.solidAt=(x,y)=>y<350;aim=playerAim(G,G.player);assert.equal(aim.target,near);assert.ok(Math.abs(aim.rot)<=.035);
 G.solidAt=(x,y)=>y<450;assert.equal(playerAim(G,G.player).target,null);
});
test('each weapon uses its proportional barrel tip, and shotgun pellets cover the cone evenly',()=>{
 for(let i=0;i<WEAPONS.length;i++){flat();G.action.weapon=i;T.shoot(G,G.player,true);const w=WEAPONS[i],art=WEAPON_ART[w.id];
  assert.ok(art.length<(w.rocket?30:25));assert.ok(art.width<=(w.rocket?7:6));assert.equal((w.rocket?G.rockets:G.bullets).length,w.pellets);
  for(const b of (w.rocket?G.rockets:G.bullets))assert.ok(Math.abs(Math.hypot(b.x-500,b.y-500)-art.muzzle)<1e-8);
  if(w.pellets>1){const angles=G.bullets.map(b=>Math.atan2(b.vx,-b.vy));for(let j=1;j<angles.length;j++)assert.ok(angles[j]-angles[j-1]>w.spread/w.pellets*.49);}
 }
});
test('obsolete street-race saves restart safely on the new circuit without duplicate rivals',()=>{
 flat();G.solidAt=solid;G.surfaceAt=surface;G.flags=flagsFrom({});G.missionIndex=1;G.objectiveIndex=1;G.mode='story';G._flow=missionFlow('pink_slip',G.flags);G.player=T.makeVeh('riot',2900,2900,0);G.vehicles=[G.player];
 const data={...T.snapshot(G),race:{i:22,rivalI:23,t:40,countdown:0,rival:{x:2900,y:2900,rot:0}}};
 T.restoreState(G,data);assert.equal(G.race.i,0);assert.equal(G.race.countdown,3);assert.ok(nearestTrack(G.player.x,G.player.y).d<50);
 assert.ok(Math.hypot(G.race.rival.x-G.player.x,G.race.rival.y-G.player.y)>=84-1e-6);
 T.restoreState(G,T.snapshot(G));assert.equal(G.vehicles.filter(v=>v.raceRival).length,1);
 const flow=missionFlow('pink_slip',G.flags);G.objectiveIndex=0;G._flow=flow;assert.deepEqual(T.currentObjectivePos(G),CIRCUIT.pit);
 assert.deepEqual(G.race.pts.at(-1),[trackPoint(0).x,trackPoint(0).y]);
});
test('isolated core canal fragments are walkable while connected canals and civic fountains remain water',()=>{
 for(const [x,y] of [[608,2208],[800,2368],[1152,2368]])assert.equal(surface(x,y),'walk');
 for(const [x,y] of [[6960,3500],[5320,2312],[5880,2992]])assert.ok(['water','canal'].includes(G.world.boatSurfaceAt?.(x,y)||surface(x,y)));
});

test('suspended scenery jobs retain their building and foliage lists while other tiles render',()=>{
 const view={x0:4096,y0:2048,x1:4608,y1:3072},elsewhere={x0:11000,y0:2100,x1:12000,y1:3000};
 const context=out=>new Proxy({}, {get:(o,k)=>k==='drawImage'?(_im,...args)=>out.push(args):()=>{}});
 const expected=[],actual=[];G.bld.staticDraw(context(expected),view);assert.ok(expected.length>5);
 const job=G.bld.staticSteps(context(actual),view);let step;
 do{step=job.next();G.bld.inView(elsewhere);G.bld.trees(context([]),{x:0,y:0,scale:1},elsewhere,{static:true,low:false});}while(!step.done);
 assert.deepEqual(actual,expected);
});

test('Fire’s pit meeting takes precedence over optional time-trial prompts',()=>{
 flat();G.freeRoam=false;G._flow=missionFlow('pink_slip',flagsFrom({}));G.objectiveIndex=0;G.race=null;G.player=T.makeVeh('riot',CIRCUIT.pit.x,CIRCUIT.pit.y,0);
 assert.equal(nearCircuit(G),false);assert.equal(circuitHint(G),'');G.freeRoam=true;assert.equal(nearCircuit(G),true);
});
