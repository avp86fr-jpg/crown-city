import {before,test} from 'node:test';
import assert from 'node:assert/strict';
import {harness} from './harness.js';
import {recordVehicleDamage,damageSnapshot,restoreDamage,vehicleCondition} from '../src/vehicle_dynamics.js';
import {AIRCRAFT_DEFS,tickAircraft,restoreAircraft,canExitAircraft} from '../src/aviation.js';
import {worldBodyHit} from '../src/collision.js';
let G,T;before(async()=>({G,T}=await harness()));
function scene(surfaceAt=()=> 'road'){
 const world={...G,world:{buildings:[],coreBuildings:[]},surfaceAt,solidAt:(x,y)=>surfaceAt(x,y)==='build',vehicles:[],peds:[],cops:[],particles:[],flashes:[],skids:[],bullets:[],ticks:1,health:100,wanted:0,wet:0};
 world.player=T.makeFoot(world,500,500,0);return world;
}
test('impact location damages the appropriate panels; repair and saved damage remain consistent',()=>{
 const v=T.makeVeh('riot',500,500,0);recordVehicleDamage(v,24,{x:526,y:500});assert.ok(v.damage.right>.3);assert.equal(v.damage.left,0);assert.equal(vehicleCondition(v).label,'SCUFFED');
 recordVehicleDamage(v,35,{x:500,y:448});assert.ok(v.damage.front>.5);assert.equal(vehicleCondition(v).label,'DAMAGED');
 const copy=T.makeVeh('riot',0,0,0,{health:v.health});restoreDamage(copy,damageSnapshot(v));assert.deepEqual(copy.damage,v.damage);
 v.health=100;recordVehicleDamage(v,10,{x:500,y:552});assert.equal(v.damage.front,0);assert.equal(v.damage.right,0);assert.ok(v.damage.rear>0);
});
test('serious damage reduces actual acceleration and stops a destroyed engine producing thrust',()=>{
 const distances=[];
 for(const health of [100,30,0]){const W=scene(),car=T.makeVeh('riot',500,1500,0,{health});W.player=car;W.vehicles=[car];for(let i=0;i<120;i++){W.ticks++;T.tickDrive(W,car,{y:1,x:0},1/60,false);}distances.push(1500-car.y);}
 assert.ok(distances[1]<distances[0]*.85);assert.equal(distances[2],0);
});
test('wrecked motorcycles, buses and boats retain their own vehicle art',()=>{
 const ctx=G.ctx,old=ctx.drawImage;let images=[];ctx.drawImage=img=>images.push(img);
 try{for(const kind of ['hog','bus','wake']){images=[];const v=T.makeVeh(kind,500,500,0,{health:0,dead:true,wrecked:true});T.drawVeh(G,v);assert.ok(images.includes(G.assets.sprites.city_fleet),kind);assert.ok(!images.includes(G.assets.sprites.veh_fare_wreck),kind);}}finally{ctx.drawImage=old;}
});
test('boats brake under forward mobile stick input, never produce road tire skid effects, and retain hull clearance while turning',()=>{
 const W=scene((x,y)=>x>250&&x<750&&y>250&&y<750?'water':'sand');
 const boat=T.makeVeh('wake',500,500,0,{vx:0,vy:-160,parked:false});W.player=boat;W.vehicles=[boat];
 for(let i=0;i<45;i++){W.ticks++;T.tickDrive(W,boat,{x:0,y:1,brake:true},1/60,true);}assert.ok(Math.hypot(boat.vx,boat.vy)<90);
 Object.assign(boat,{x:420,y:500,vx:70,vy:-130});for(let i=0;i<220;i++){W.ticks++;T.tickDrive(W,boat,{x:1,y:1,hand:true},1/60,true);assert.equal(worldBodyHit(W,boat,boat.x,boat.y),null);}
 assert.equal(boat.drifting,false);assert.equal(W.skids.length,0);assert.ok(!W.particles.some(p=>p.kind==='dust'));
});
test('holding the brake stops cars and boats without engaging reverse; the reverse stick still works',()=>{
 for(const kind of ['riot','wake']){
  const W=scene(()=>kind==='wake'?'water':'road'),v=T.makeVeh(kind,500,1500,0,{vx:0,vy:-100,parked:false});W.player=v;W.vehicles=[v];
  for(let i=0;i<300;i++){W.ticks++;T.tickDrive(W,v,{x:0,y:1,brake:true},1/60,true);assert.ok(v.vy<=.001,kind+' reversed while braking');}
  assert.ok(Math.hypot(v.vx,v.vy)<.01);const y=v.y;
  for(let i=0;i<120;i++){W.ticks++;T.tickDrive(W,v,{x:0,y:-1},1/60,true);}
  assert.ok(v.y>y+5,kind+' cannot reverse');
 }
});
test('destroyed wrecks cannot coast through a wall and explosions apply only once',()=>{
 const W=scene((x,y)=>y<430?'build':'road'),wreck=T.makeVeh('fare',500,490,0,{dead:true,health:0,vy:-200,loose:true});
 for(let i=0;i<60;i++)T.tickDrive(W,wreck,{},1/60,false);assert.ok(wreck.y>=482);assert.equal(worldBodyHit(W,wreck,wreck.x,wreck.y),null);
 const car=T.makeVeh('fare',700,700,0);W.vehicles=[car];T.explode(W,car);const count=W.particles.length;T.explode(W,car);assert.equal(W.particles.length,count);
});
test('mobile plane descent maintains approach power instead of applying reverse throttle',()=>{
 const W=scene(()=> 'track'),plane=T.makeVeh('plane',7000,7500,Math.PI/2);restoreAircraft(plane,{altitude:130,airspeed:240,vx:240,vy:0});
 W.player=plane;W.vehicles=[plane];W.touch=true;W.input={...G.input,x:0,y:0,brake:true,hand:false,boost:false,sprint:false,enterP:false,touchJoy:{active:false}};
 for(let i=0;i<180;i++)T.tickPlayer(W,1/60);assert.equal(plane.stall,false);assert.ok(plane.airspeed>=200);assert.ok(plane.altitude<70);
});
test('plane runway assist aligns an offset final, touches down and brakes to a safe exit speed',()=>{
 const W=scene(()=> 'track'),plane=T.makeVeh('plane',7000,7540,Math.PI/2);restoreAircraft(plane,{altitude:130,airspeed:230,vx:230,vy:0});W.player=plane;
 tickAircraft(W,plane,{enterP:true,touchFlight:true},1/60);
 for(let i=0;i<900;i++){W.ticks++;tickAircraft(W,plane,{touchFlight:true},1/60);}
 assert.equal(plane.altitude,0);assert.equal(plane.landing,false);assert.ok(canExitAircraft(plane));assert.ok(Math.abs(plane.y-7500)<40);assert.ok(plane.x<9900);
});
test('runway assist calls a go-around when remaining runway is unsafe, and a roof collision never teleports altitude',()=>{
 const W=scene(()=> 'track'),plane=T.makeVeh('plane',9800,7500,Math.PI/2);restoreAircraft(plane,{altitude:140,airspeed:210,vx:210,vy:0});W.player=plane;let notice='';tickAircraft(W,plane,{enterP:true},1/60,{notice:s=>notice=s});assert.equal(plane.landing,false);assert.match(notice,/Go around/);
 const B=scene((x,y)=>x>500?'build':'track'),taxi=T.makeVeh('plane',480,500,Math.PI/2);B.world.buildings=[{x:500,y:400,w:100,h:200,hgt:130}];restoreAircraft(taxi,{airspeed:70,vx:70,vy:0});B.player=taxi;tickAircraft(B,taxi,{y:1},1/60);assert.equal(taxi.altitude,0);
});
test('separating cars in a narrow alley never pushes the free car through the opposite wall',()=>{
 const W=scene((x,y)=>x<452||x>548?'build':'road');W.cam={...G.cam,x:500,y:500};
 const a=T.makeVeh('fare',477,500,0,{vx:100,parked:false}),b=T.makeVeh('fare',519,500,0,{parked:false});W.player=a;W.vehicles=[a,b];T.tickCollisions(W);
 assert.equal(worldBodyHit(W,a,a.x,a.y),null);assert.equal(worldBodyHit(W,b,b.x,b.y),null);assert.ok(b.x<=524);
});
