import {before,test} from 'node:test';
import assert from 'node:assert/strict';
import {harness} from './harness.js';
import {AIRCRAFT_DEFS, tickAircraft, landingZone, canExitAircraft, restoreAircraft, obstacleHeight} from '../src/aviation.js';
import {actionState} from '../src/action.js';
let G,T,h;
before(async()=>{h=await harness();({G,T}=h);});
const step=(world,v,input,n)=>{for(let i=0;i<n;i++){world.ticks=(world.ticks||0)+1;tickAircraft(world,v,input,1/60,{damage:(craft,amount)=>craft.health-=amount});}};
function flat(kind='heli',extra={}){
 const v={type:'veh',kind,def:AIRCRAFT_DEFS[kind],x:6900,y:7500,rot:Math.PI/2,vx:0,vy:0,health:100,...extra};restoreAircraft(v,extra);
 const world={player:v,world:{buildings:[],coreBuildings:[]},surfaceAt:()=> 'track',solidAt:()=>false,ticks:0};return {world,v};
}
test('airport aircraft are tangible vehicles on clear ground with a usable runway',()=>{
 const crafts=G.vehicles.filter(v=>v.def.aircraft);assert.ok(crafts.some(v=>v.kind==='heli'));assert.ok(crafts.some(v=>v.kind==='plane'));
 for(const v of crafts){assert.ok(!['water','canal','build'].includes(G.surfaceAt(v.x,v.y)));assert.equal(v.altitude,0);assert.ok(canExitAircraft(v));}
 const plane=crafts.find(v=>v.kind==='plane');assert.equal(landingZone(G,plane),'RUNWAY');
 const heli=crafts.find(v=>v.kind==='heli');G.player=T.makeFoot(G,heli.x+65,heli.y,0);T.enterVeh(G,heli,true);assert.equal(G.player,heli);
 T.exitVeh(G);assert.equal(G.player.type,'foot');assert.ok(T.footClear(G,G.player.x,G.player.y,7));
});
test('helicopter climbs vertically, holds a stable hover, then lands without exiting in flight',()=>{
 const {world,v}=flat();step(world,v,{boost:true},120);assert.ok(v.altitude>100);assert.equal(v.x,6900);assert.equal(v.y,7500);assert.equal(canExitAircraft(v),false);
 const alt=v.altitude;step(world,v,{},120);assert.equal(v.altitude,alt);assert.equal(v.flightState,'HOVER');
 step(world,v,{enterP:true},1);assert.equal(v.landing,true);step(world,v,{},240);
 assert.equal(v.altitude,0);assert.equal(v.landing,false);assert.equal(canExitAircraft(v),true);
});
test('airplane takes off only with runway speed and alignment; low-speed flight stalls',()=>{
 const runway=flat('plane');step(runway.world,runway.v,{y:1},180);assert.ok(runway.v.altitude>25);assert.ok(runway.v.airspeed>185);
 const apron=flat('plane',{y:7780});step(apron.world,apron.v,{y:1},180);assert.equal(apron.v.altitude,0);
 const wrongWay=flat('plane',{rot:0});step(wrongWay.world,wrongWay.v,{y:1},150);assert.equal(wrongWay.v.altitude,0);
 const stalled=flat('plane',{altitude:65,airspeed:80});step(stalled.world,stalled.v,{y:-1},30);assert.equal(stalled.v.stall,true);step(stalled.world,stalled.v,{y:-1},90);assert.ok(stalled.v.health<1);
});
test('approach power supports a real plane touchdown; water and crosswind approaches refuse landing',()=>{
 const {world,v}=flat('plane',{altitude:20,airspeed:210});step(world,v,{hand:true},55);assert.equal(v.altitude,0);assert.ok(v.airspeed>115);step(world,v,{},30);assert.equal(v.altitude,0);
 const water=flat('heli',{altitude:20});water.world.surfaceAt=()=> 'water';water.v.y=600;step(water.world,water.v,{brake:true},100);assert.ok(water.v.altitude>=12);
 const cross=flat('plane',{altitude:20,airspeed:210,rot:0});step(cross.world,cross.v,{hand:true},80);assert.ok(cross.v.altitude>=12);
});
test('aerial obstacles use roof height and high flight clears them',()=>{
 const low=flat('heli',{altitude:25,vx:130});low.world.world.buildings=[{x:6940,y:7450,w:120,h:100,hgt:95}];
 assert.equal(obstacleHeight(low.world,6960,7500),95);step(low.world,low.v,{y:1},90);assert.ok(low.v.x<6940);assert.ok(low.v.health<100);
 const high=flat('heli',{altitude:180});high.world.world.buildings=[{x:6940,y:7450,w:120,h:100,hgt:95}];step(high.world,high.v,{y:1},90);assert.ok(high.v.x>7060);assert.equal(high.v.health,100);
});
test('an aircraft above traffic does not ram cars, strike people or intercept ground bullets',()=>{
 T.clearRecoveryState(G);const heli=T.makeVeh('heli',2108,2400,0,{altitude:100,vx:120}),car=T.makeVeh('fare',2108,2400,0);
 G.player=heli;G.vehicles=[heli,car];G.cam.x=heli.x;G.cam.y=heli.y;G.peds=[{x:2108,y:2400,dead:false,hp:30,speed:0,dist:0,walk:0,copPed:true}];
 T.tickCollisions(G);T.tickPeds(G,1/60);assert.equal(car.health,100);assert.equal(G.peds[0].hp,30);assert.equal(heli.x,2108);
 G.vehicles=[heli];G.bullets=[{x:2108,y:2500,vx:0,vy:-600,life:1,friend:false}];for(let i=0;i<20;i++)T.tickBullets(G,1/60);assert.equal(heli.health,100);
});
test('save/resume preserves aircraft altitude, flight velocity and identity without duplicate aircraft',()=>{
 T.startNew(G);G.scene='play';const heli=G.vehicles.find(v=>v.kind==='heli');T.enterVeh(G,heli,true);
 Object.assign(heli,{x:8070,y:6020,altitude:185,verticalSpeed:20,vx:90,vy:-140,airspeed:166,landing:false});
 const saved=T.snapshot(G),count=G.vehicles.filter(v=>v.kind==='heli').length;
 T.restoreState(G,saved);assert.equal(G.player.kind,'heli');assert.equal(G.player.altitude,185);assert.equal(G.player.x,8070);assert.equal(G.player.vy,-140);assert.equal(G.player.aircraftId,heli.aircraftId);
 T.restoreState(G,saved);assert.equal(G.vehicles.filter(v=>v.kind==='heli').length,count);
});
test('busted recovery clears held input, chase ownership, bullets and unfinished holds while preserving progress',()=>{
 T.startNew(G);G.scene='play';G.missionIndex=3;G.objectiveIndex=1;G.chips=1000;
 G.action=actionState();G.action.contract={id:'signal',stage:2,t:91,progress:1.8};G.action.reloadT=1;G.action.dodgeT=.3;
 G.missionState={holdT:2,hacking:true,receipt:'paid'};
 const car=T.makeVeh('riot',2108,2400,0,{vx:130,driver:'player'}),cop=T.makeVeh('metro',2150,2400,0,{ai:true,chasing:true,siren:true}),rival=T.makeVeh('dart',2108,2440,0,{raceRival:true,ai:true});
 G.player=car;G.vehicles.push(car,cop,rival);G.cops=[cop];G.race={rival};G.peds.push({copPed:true,x:car.x,y:car.y,car:cop});G.bullets=[{x:car.x,y:car.y,life:1}];G.jack={v:car};G.heliChase=true;G.policeTarget={x:car.x,y:car.y};G.wanted=5;G.evading=true;
 h.dispatch('keydown',{code:'KeyW'});h.dispatch('keydown',{code:'KeyJ'});G.input.tBoost=true;G.input.touchJoy={active:true,x:1,y:1};G._pulseInput();
 T.busted(G);h.dispatch('keydown',{code:'KeyW',repeat:true});h.dispatch('keydown',{code:'KeyJ',repeat:true});G._pulseInput();
 assert.equal(G.player.type,'foot');assert.equal(G.health,100);assert.equal(G.chips,920);assert.equal(G.missionIndex,3);assert.equal(G.objectiveIndex,1);assert.equal(G.missionState.receipt,'paid');assert.equal(G.missionState.holdT,0);assert.equal(G.missionState.hacking,false);
 assert.equal(G.action.contract.stage,2);assert.equal(G.action.contract.t,91);assert.equal(G.action.contract.progress,0);assert.equal(G.action.reloadT,0);assert.equal(G.action.dodgeT,0);
 assert.equal(G.input.y,0);assert.equal(G.input.fire,false);assert.equal(G.input.boost,false);assert.equal(G.input.touchJoy.active,false);
 assert.equal(G.wanted,0);assert.equal(G.heliChase,false);assert.equal(G.policeTarget,null);assert.equal(G.jack,null);assert.equal(G.cops.length,0);assert.equal(G.bullets.length,0);assert.ok(!G.peds.some(p=>p.copPed));assert.ok(!G.vehicles.includes(cop));assert.ok(!G.vehicles.includes(rival));assert.equal(cop.ai,false);assert.equal(cop.siren,false);assert.equal(car.driver,null);assert.equal(car.vx,0);
 assert.ok(T.footClear(G,G.player.x,G.player.y,7));assert.equal(G.cam.x,G.player.x);assert.equal(G.cam.lx,0);
 T.tickPlay(G,1/60);assert.equal(G.cops.length,0);assert.equal(G.bullets.length,0);
});
test('zero wanted level turns off helicopter chase and avoids full-city pursuit navigation',()=>{
 T.startNew(G);G.scene='play';G.heliChase=true;G.evading=true;G.wanted=0;T.tickWanted(G,1/60);assert.equal(G.heliChase,false);assert.equal(G.evading,false);
 const update=G.nav.update;let calls=0;G.nav.update=()=>calls++;T.tickPlay(G,1/60);G.nav.update=update;assert.equal(calls,0);
});
test('a destroyed aircraft is replaced at its home stand after recovery without an overlapping wreck',()=>{
 T.startNew(G);G.scene='play';const plane=G.vehicles.find(v=>v.kind==='plane');T.enterVeh(G,plane,true);plane.altitude=90;plane.dead=true;plane.health=0;
 T.wasted(G);const replacement=G.vehicles.find(v=>v.aircraftId===plane.aircraftId&&!v.dead);
 assert.ok(replacement);assert.notEqual(replacement,plane);assert.equal(replacement.altitude,0);assert.equal(replacement.health,100);assert.ok(!G.vehicles.includes(plane));assert.equal(G.player.type,'foot');
});
test('bridge deck traffic and characters pass over boats; projectiles respect the two elevations',()=>{
 T.startNew(G);G.scene='play';const bridge=G.world.expansion.bridges.find(b=>b.h>100)||G.world.expansion.bridges[0],x=6968,y=bridge.y+bridge.h/2;
 const boat=T.makeVeh('wake',x,y,0,{vx:0,vy:120,parked:false}),car=T.makeVeh('fare',x,y,Math.PI/2,{vx:100,vy:0,parked:false});
 G.vehicles=[boat,car];G.player=car;G.cam.x=x;G.cam.y=y;G.peds=[];T.tickCollisions(G);assert.equal(boat.health,100);assert.equal(car.health,100);assert.equal(car.x,x);assert.equal(boat.y,y);
 G.player=T.makeFoot(G,x,y,0);G.vehicles=[boat];G.nearVehicles=null;G.streetVehicleGrid=null;T.moveFoot(G,G.player,3,0);assert.equal(G.player.x,x+3);T.tickCollisions(G);T.tickPeds(G,1/60);assert.equal(G.health,100);
 G.player=T.makeFoot(G,x-120,y,Math.PI/2);G.bullets=[{x:x-110,y,vx:600,vy:0,life:1,friend:true,carDamage:15}];for(let i=0;i<22;i++)T.tickBullets(G,1/60);assert.equal(boat.health,100);
 G.player=boat;G.vehicles=[boat,car];car.health=100;G.peds=[{x,y,hp:30,dead:false}];G.bullets=[{x:x-110,y,vx:600,vy:0,life:1,friend:true,waterLevel:true,carDamage:15,damage:30}];for(let i=0;i<22;i++)T.tickBullets(G,1/60);assert.equal(car.health,100);assert.equal(G.peds[0].hp,30);
 const other=T.makeVeh('wake',x+12,y,0,{parked:false,vy:-120});G.peds=[];G.vehicles=[boat,other];G.player=boat;T.tickCollisions(G);assert.ok(Math.hypot(boat.x-other.x,boat.y-other.y)>12);assert.ok(boat.health<100||other.health<100||boat.x!==x);
});
