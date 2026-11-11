import {before,test} from 'node:test';
import assert from 'node:assert/strict';
import {harness} from './harness.js';
import {bodyContact,circleBody,segmentBody,worldBodyHit,waterBerth} from '../src/collision.js';
import {actionState,startContract,tickAction} from '../src/action.js';
import {restoreStreetRoute} from '../src/side_jobs.js';
let h,G,T,originalSurface,originalSolid;
before(async()=>{h=await harness();({G,T}=h);originalSurface=G.surfaceAt;originalSolid=G.solidAt;});
function flat(){G.surfaceAt=()=> 'road';G.solidAt=()=>false;G.vehicles=[];G.peds=[];G.cops=[];G.nearVehicles=null;G.movingVehicles=null;G.particles=[];G.bullets=[];G.action=actionState();G.wanted=0;G._crimeCool=0;G.health=100;G.scene='play';G.player=T.makeFoot(G,500,500,0);G.cam.x=G.cam.y=500;}
function bullet(x,y,vx,vy){return {x,y,vx,vy,life:1,friend:true,damage:34,carDamage:9};}
test('oriented cars, bikes and boats use their full visible length and narrow bike width',()=>{
 const a=T.makeVeh('riot',0,0,0),b=T.makeVeh('riot',0,99,0),bike=T.makeVeh('stitch',0,0,0);
 assert.ok(bodyContact(a,b));assert.equal(bodyContact(a,{...b,y:105}),null);
 assert.ok(circleBody(a,0,48));assert.equal(circleBody(bike,16,0),false);
 a.rot=Math.PI/2;assert.ok(circleBody(a,48,0));assert.equal(circleBody(a,0,48),false);
 assert.ok(segmentBody(a,-200,0,200,0)<.5);assert.equal(segmentBody(a,-200,90,200,90),null);
});
test('the whole boat hull stops before shores and piers, with a valid nearby water berth',()=>{
 flat();G.surfaceAt=(x,y)=>y<400?'water':'pier';const boat=T.makeVeh('wake',500,300,Math.PI);boat.vy=200;
 assert.ok(worldBodyHit(G,boat,500,360));assert.equal(worldBodyHit(G,boat,500,330),null);
 for(let i=0;i<60;i++)T.tickDrive(G,boat,{x:0,y:1},1/60,false);
 assert.equal(worldBodyHit(G,boat,boat.x,boat.y),null);assert.ok(boat.y<344);
 const berth=waterBerth(G,boat,500,420);assert.ok(berth);assert.equal(worldBodyHit(G,boat,berth.x,berth.y),null);
});
test('swept shots hit citizens, stop at the nearest vehicle and cannot skip a thin wall',()=>{
 flat();const p={x:500,y:400,hp:30,walk:20,dist:0};G.peds=[p];G.bullets=[bullet(500,500,0,-1000)];T.tickBullets(G,.2);assert.equal(p.dead,true);
 flat();const car=T.makeVeh('riot',500,410,0),behind={x:500,y:300,hp:30};G.vehicles=[car];G.peds=[behind];G.bullets=[bullet(500,500,0,-1200)];T.tickBullets(G,.25);assert.equal(car.health,91);assert.equal(behind.hp,30);
 flat();G.solidAt=(x,y)=>y>=440&&y<=446;const protectedPed={x:500,y:400,hp:30};G.peds=[protectedPed];G.bullets=[bullet(500,500,0,-1000)];T.tickBullets(G,.2);assert.equal(protectedPed.hp,30);assert.equal(G.bullets.length,0);
});
test('a diving citizen can be run over and pedestrians cannot walk through parked vehicles',()=>{
 flat();const car=T.makeVeh('riot',500,500,0);car.vy=-180;car.prevX=500;car.prevY=503;G.vehicles=[car];G.player=car;
 const p={x:500,y:455,hp:30,dive:.4,dist:0,walk:20};G.peds=[p];T.tickPeds(G,1/60);assert.equal(p.dead,true);assert.ok(G.wanted>0);
 flat();const parked=T.makeVeh('riot',500,450,0);G.vehicles=[parked];G.player=T.makeFoot(G,500,530,0);for(let i=0;i<30;i++)T.moveFoot(G,G.player,0,-3);assert.ok(G.player.y>=510);
});
test('traffic can hit the player on foot, with recovery time between impacts',()=>{
 flat();const car=T.makeVeh('taxi',500,540,0);car.vy=-180;G.vehicles=[car];T.tickPeds(G,1/60);assert.ok(G.health<100);const health=G.health;T.tickPeds(G,1/60);assert.equal(G.health,health);
});
test('nearby characters separate without being pushed into a wall',()=>{
 flat();G.peds=[{x:500,y:500},{x:500,y:500}];G.player.x=600;T.separateCharacters(G);assert.ok(Math.hypot(G.peds[0].x-G.peds[1].x,G.peds[0].y-G.peds[1].y)>10);
});
test('offshore exit requires a bank but an exploding boat never traps its occupant',()=>{
 G.surfaceAt=originalSurface;G.solidAt=originalSolid;const boat=T.makeVeh('wake',1960,400,Math.PI/2);G.vehicles=[boat];G.peds=[];G.player=boat;G.health=100;G._endT=0;
 const far=waterBerth(G,boat,1960,160);assert.ok(far);Object.assign(boat,far);T.exitVeh(G);assert.equal(G.player,boat);
 T.explode(G,boat);assert.equal(G.player.type,'foot');assert.ok(T.footClear(G,G.player.x,G.player.y,7));
});
test('Free Ride starts immediately and persists independently of the story slot',async()=>{
 G.surfaceAt=originalSurface;G.solidAt=originalSolid;T.startNew(G);await h.readyVN();G.chips=731;T.save(G);
 const story=h.storage.get('mw_crown_city_v1');assert.ok(story);
 T.startFreeRide(G);await h.readyVN();assert.equal(G.scene,'play');assert.equal(G.freeRoam,true);assert.equal(G._flow,null);assert.equal(G.chips,1800);
 for(let i=0;i<90;i++)T.tick(G,1/60);assert.equal(G._flow,null);assert.equal(G.missionIndex,0);assert.equal(T.currentObjectivePos(G),null);G.chips=2345;T.save(G);assert.equal(h.storage.get('mw_crown_city_v1'),story);
 T.loadSave(G,'story');assert.equal(G.mode,'story');assert.equal(G.chips,731);T.startFreeRide(G);assert.equal(G.mode,'freeride');assert.equal(G.chips,2345);assert.equal(G._flow,null);const buoy=T.makeVeh('wake',1960,200,Math.PI/2);assert.equal(T.carHit(G,buoy,buoy.x,buoy.y),null);
});
test('Low Tide requires pickup on foot, a stationary boat upload, and return on foot; stages survive saving',()=>{
 flat();G.meta={...G.meta,spawns:{...G.meta.spawns,marina:[500,500]}};startContract(G,'harbour');const hooks={moveFoot(){}};
 tickAction(G,3.1,hooks);assert.equal(G.action.contract.stage,1);assert.deepEqual(G.waypoint,{x:1960,y:200});
 G.player={type:'veh',def:{boat:false},x:1960,y:200,vx:0,vy:0};tickAction(G,4,hooks);assert.equal(G.action.contract.stage,1);
 G.player.def.boat=true;G.player.vx=30;tickAction(G,4,hooks);assert.equal(G.action.contract.progress,0);
 G.player.vx=0;tickAction(G,3.1,hooks);assert.equal(G.action.contract.stage,2);G.action=actionState({contract:{...G.action.contract}});restoreStreetRoute(G);assert.deepEqual(G.waypoint,{x:500,y:500});
 G.player.x=G.player.y=500;const before=G.chips;tickAction(G,4,hooks);assert.equal(G.chips,before);
 G.player=T.makeFoot(G,500,500,0);tickAction(G,3.1,hooks);assert.equal(G.chips,before+1250);assert.equal(G.action.contract,null);tickAction(G,4,hooks);assert.equal(G.chips,before+1250);
});
