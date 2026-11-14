import {test,before} from 'node:test';
import assert from 'node:assert/strict';
import {harness} from './harness.js';
import {WEAPONS,actionState,tickAction} from '../src/action.js';
import {blastExposure,detonate,tickBlastFX} from '../src/explosions.js';
import {bloodImpact,runoverBlood,tickBlood} from '../src/blood_fx.js';
import {sleepSafeGround} from '../src/pedestrian_motion.js';
import {ambientAt,mobileTint,nightMix,weatherSun,emergencyLightsOn,vehicleLightStrength,timeLabel} from '../src/lighting.js';
let G,T;
before(async()=>{({G,T}=await harness());});
function flat(){T.startFreeRide(G);G.settings.blood='full';G.settings.quality='low';G.settings.aimAssist=false;G.solidAt=()=>false;G.surfaceAt=()=> 'road';G.player=T.makeFoot(G,500,500,Math.PI/2);G.action=actionState({weapon:3});G.peds=[];G.vehicles=[];G.cops=[];G.bullets=[];G.rockets=[];G.bloodFX=null;G.blastFX=null;G.input.mouse.fire=false;G.input.fire=false;G.input.touchAim={active:false,aiming:false};G.touch=false;G.health=100;G._endT=0;}
test('old saves retain gun indices and get one launcher round; launcher reload and vehicle interlock',()=>{
 flat();const old=actionState({weapon:2,ammo:[2,3,4]});assert.equal(WEAPONS[old.weapon].id,'shotgun');assert.deepEqual(old.ammo,[2,3,4,1]);
 const v=T.makeVeh('riot',500,500,0);T.shoot(G,v,false);assert.equal(G.action.ammo[3],1);assert.equal(G.rockets.length,0);
 T.shoot(G,G.player,true);assert.equal(G.rockets.length,1);assert.equal(G.action.ammo[3],0);assert.ok(G.action.reloadT>2);
 T.shoot(G,G.player,true);assert.equal(G.rockets.length,1);
 for(let i=0;i<180;i++)tickAction(G,1/60);assert.equal(G.action.ammo[3],1);
});
test('rocket swept hull collision works during a slow frame, with delayed vehicle chain reactions',()=>{
 flat();const target=T.makeVeh('riot',720,500,0);G.vehicles=[target];T.shoot(G,G.player,true);T.tickRockets(G,.5);
 assert.equal(G.rockets.length,0);assert.ok(target.health<12);assert.equal(target.burning,true);assert.ok(!target.dead);assert.ok(target.burnT>4);
 assert.equal(G.blastFX.bursts.length,1);assert.ok(G.blastFX.bursts[0].x<720);
});
test('buildings intercept rockets and shield blast victims on the far side',()=>{
 flat();G.solidAt=(x,y)=>x>=650&&x<=660;const near={x:625,y:505,hp:30},far={x:680,y:500,hp:30};G.peds=[near,far];
 T.shoot(G,G.player,true);T.tickRockets(G,.5);assert.equal(G.rockets.length,0);assert.equal(near.dead,true);assert.equal(far.hp,30);assert.equal(far.dead,undefined);
});
test('blast falloff includes the exposed end of a long vehicle and respects bridges/aircraft',()=>{
 flat();const b={x:100,y:100,radius:120},bus=T.makeVeh('bus',100,260,0);assert.ok(blastExposure(G,b,bus)>0);
 assert.equal(blastExposure(G,b,{x:100,y:150,def:{aircraft:true},altitude:30}),0);
 const savedExpansion=G.world.expansion;G.world.expansion={bridges:[{x:80,y:80,w:100,h:100}]};assert.equal(blastExposure(G,{...b,waterLevel:true},{x:110,y:100}),0);
 assert.ok(blastExposure(G,{...b,waterLevel:true},{x:110,y:100,rot:0,def:{boat:true}})>0);G.world.expansion=savedExpansion;
});
test('a barrel pressed against a wall cannot launch through it, and recovery clears projectiles',()=>{
 flat();G.solidAt=x=>x>=520;T.shoot(G,G.player,true);assert.equal(G.rockets.length,0);assert.equal(G.health,100,'an obstructed tube is an unarmed dud, never a self-kill');
 flat();T.shoot(G,G.player,true);assert.equal(G.rockets.length,1);T.clearRecoveryState(G);assert.equal(G.rockets.length,0);
});
test('vehicle explosions use cover instead of harming pedestrians through buildings',()=>{
 flat();G.solidAt=x=>x>=610&&x<=620;const v=T.makeVeh('riot',580,500,0);const p={x:645,y:500,hp:30};G.vehicles=[v];G.peds=[p];T.explode(G,v);assert.equal(p.hp,30);assert.equal(p.dead,undefined);
});
test('hundreds of explosions keep bounded FX, expire without rendering and preserve pause',()=>{
 flat();G.player.x=-1000;const hooks={};for(let i=0;i<500;i++)detonate(G,{x:i,y:0,radius:120,damage:0,carDamage:0},hooks);
 assert.equal(G.blastFX.bursts.length,8);assert.equal(G.blastFX.scars.length,16);G.scene='pause';T.tick(G,1);assert.equal(G.blastFX.bursts[0].age,0);
 for(let i=0;i<2500;i++)tickBlastFX(G,1/60);assert.equal(G.blastFX.bursts.length,0);assert.equal(G.blastFX.scars.length,0);
});
test('blood cosmetics do not consume the gameplay random stream; runover trails stop at walls and stay bounded',()=>{
 flat();const p={x:500,y:500},v=T.makeVeh('riot',500,500,Math.PI/2);v.vx=200;G.solidAt=x=>x>530;
 const old=Math.random;let calls=0;Math.random=()=>{calls++;return .5;};try{bloodImpact(G,p,200,0,2,true);runoverBlood(G,p,v);}finally{Math.random=old;}
 assert.equal(calls,0);assert.ok(G.bloodFX.stains.some(p=>p.track));assert.ok(G.bloodFX.stains.every(p=>p.x<=530));
 for(let i=0;i<100;i++){v.x+=10;tickBlood(G,.02);}assert.equal(G.bloodFX.wheels.length,0);assert.ok(G.bloodFX.stains.length<=32);
 G.settings.blood='off';tickBlood(G,.1);assert.equal(G.bloodFX.stains.length,0);
});
test('far pedestrian terrain cache rechecks on movement and collision-map replacement',()=>{
 let calls=0;const state={surfaceAt:x=>{calls++;return x<20?'walk':'road';}},p={x:0,y:0};assert.equal(sleepSafeGround(state,p),true);const first=calls;
 for(let i=0;i<1000;i++)assert.equal(sleepSafeGround(state,p),true);assert.equal(calls,first);
 p.x=10;assert.equal(sleepSafeGround(state,p),false);state.surfaceAt=()=> 'walk';assert.equal(sleepSafeGround(state,p),true);
});
test('ambient and mobile night crossfades are continuous at midnight, dawn and dusk',()=>{
 for(let h=0;h<=24;h+=.02){const a=ambientAt(h),b=ambientAt(h+.001);assert.ok(a.every((v,i)=>Math.abs(v-b[i])<1));assert.ok(Math.abs(nightMix(h)-nightMix(h+.001))<.01);assert.ok(mobileTint(h).alpha<=.251);}
 assert.deepEqual(ambientAt(-1),ambientAt(23));assert.deepEqual(ambientAt(24),ambientAt(0));assert.equal(timeLabel(48).text,'00:00');assert.ok(mobileTint(0).alpha>mobileTint(12).alpha+.2);
 assert.ok(weatherSun(12,1,.3).alpha<weatherSun(12).alpha*.4);assert.equal(weatherSun(0).alpha,0);
});
test('police beacons require an active siren; ordinary headlamps respond to night and weather',()=>{
 const v={cop:true,def:{}};assert.equal(emergencyLightsOn(v),false);assert.equal(vehicleLightStrength(v,0),0);assert.equal(vehicleLightStrength(v,1),1);
 v.siren=true;assert.equal(emergencyLightsOn(v),true);assert.ok(vehicleLightStrength(v,0,1)>.3);v.dead=true;assert.equal(emergencyLightsOn(v),false);assert.equal(vehicleLightStrength(v,1),0);
});

test('population pressure ignores brief signals, reduces prolonged district queues, and restores slowly',async()=>{
 const {trafficFlowBudget}=await import('../src/street_population.js'),state={};
 for(let i=0;i<24;i++)trafficFlowBudget(state,20,50,.25);assert.equal(state.flowBudget,1);
 trafficFlowBudget(state,0,50,.25);assert.equal(state.flowHeat,0);
 for(let i=0;i<56;i++)trafficFlowBudget(state,20,50,.25);assert.equal(state.flowBudget,.8);
 for(let i=0;i<47;i++)trafficFlowBudget(state,2,50,.25);assert.equal(state.flowBudget,.8);
 trafficFlowBudget(state,2,50,.25);assert.ok(state.flowBudget>.8&&state.flowBudget<.9);
});
