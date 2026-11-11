import {test} from 'node:test';
import assert from 'node:assert/strict';
import {harness} from './harness.js';
import {spawnAircraft,aircraftClearance,tickAircraft,drawAircraft,aircraftSnapshot,restoreAircraft} from '../src/aviation.js';
import {bodyContact,worldBodyHit,bodySize} from '../src/collision.js';
import {STATIONS,stationExit,regionalTrainAt,nextDeparture,drawTransitWorld,drawJourney} from '../src/transit.js';
const {G,T}=await harness();
const angle=a=>Math.atan2(Math.sin(a),Math.cos(a));
test('five distinct apron stands have full wing clearance, clear service lane and safe exits',()=>{
 T.startFreeRide(G);const planes=G.vehicles.filter(v=>v.kind==='plane'),stands=G.world.expansion.airport.stands;
 assert.equal(planes.length,5);assert.equal(new Set(planes.map(v=>v.aircraftId)).size,5);assert.equal(stands.length,5);
 for(const v of planes){assert.equal(aircraftClearance(G,v),0,v.aircraftId);assert.equal(worldBodyHit(G,v,v.x,v.y),null);const b=bodySize(v);
  for(const x of [-b.w,0,b.w])for(const y of [-b.l,0,b.l])assert.equal(G.surfaceAt(v.x+x,v.y+y),'lot');
  assert.ok(v.y-b.l>7660&&v.y+b.l<7930,'wings must leave taxi and service lanes open');
  for(const o of G.vehicles)if(o!==v)assert.equal(bodyContact(v,o),null,v.aircraftId+' overlaps '+o.aircraftId);
  T.enterVeh(G,v,true);T.exitVeh(G);assert.equal(G.player.type,'foot');assert.ok(T.footClear(G,G.player.x,G.player.y,7));
 }
});
test('an occupied stand defers its replacement and restoration keeps the correct livery and identity',()=>{
 T.startFreeRide(G);const original=G.vehicles.find(v=>v.aircraftId==='apron-plane-b'),id=original.aircraftId;original.dead=true;
 const car=T.makeVeh('riot',original.x,original.y,0);G.vehicles.push(car);spawnAircraft(G,T.makeVeh);assert.equal(G.vehicles.filter(v=>v.aircraftId===id).length,0);
 car.x-=230;spawnAircraft(G,T.makeVeh);spawnAircraft(G,T.makeVeh);const matches=G.vehicles.filter(v=>v.aircraftId===id);assert.equal(matches.length,1);assert.equal(matches[0].aircraftLivery,'teal');
 const recovered=T.makeVeh('plane',500,500,0);restoreAircraft(recovered,aircraftSnapshot(matches[0]));assert.equal(recovered.aircraftId,id);assert.equal(recovered.aircraftLivery,'teal');
});
test('real throttle and nose-wheel steering take a plane from its stand through the taxiway to flight without a collision',()=>{
 T.startFreeRide(G);const v=G.vehicles.find(v=>v.aircraftId==='runway-plane');G.player=v;let steps=0;
 const step=I=>{assert.ok(steps++<1400,'taxi did not reach runway');tickAircraft(G,v,I,1/60,{damage:(v,n)=>v.health-=n});assert.equal(v.health,100);if(v.altitude<10){assert.equal(aircraftClearance(G,v),0);for(const o of G.vehicles)if(o!==v)assert.equal(bodyContact(v,o),null);}};
 const turn=target=>{for(let n=0;n<700;n++){const diff=angle(target-v.rot);if(Math.abs(diff)<.018&&Math.abs(v.yaw)<.03)return;step({y:.25,x:Math.max(-1,Math.min(1,diff*5))});}assert.fail('steering never settled');};
 while(v.y>7765)step({y:.25});turn(-Math.PI/2);while(v.x>7323)step({y:.25,x:angle(-Math.PI/2-v.rot)*3});turn(0);assert.ok(Math.abs(v.x-7250)<20,'did not follow taxiway T1');turn(Math.PI/2);
 for(let i=0;i<220;i++)step({y:1,x:angle(Math.PI/2-v.rot)*3});assert.ok(v.altitude>65);assert.ok(v.airspeed>300);assert.ok(v.x>8000);
});
test('airframe static artwork is reused across frames and bounded across quality and damage variants',()=>{
 G.aircraftArtCache=null;G.aircraftArtBuilds=0;G.settings.quality='high';const crafts=G.vehicles.filter(v=>v.def.aircraft);for(const v of crafts)drawAircraft(G,v);const first=G.aircraftArtBuilds;
 for(let i=0;i<50;i++){G.ticks++;for(const v of crafts)drawAircraft(G,v);}assert.equal(G.aircraftArtBuilds,first);
 for(const quality of ['low','high'])for(const dead of [false,true]){G.settings.quality=quality;for(const v of crafts)drawAircraft(G,{...v,dead});assert.ok(G.aircraftArtCache.size<=8);}
});
test('regional arrival board agrees with both trains and all three carriages open on the platform side',()=>{
 for(const s of STATIONS.filter(s=>s.line==='regional'))for(const clock of [0,1,8,34,65,100,132,197,230]){
  const wait=nextDeparture(s,clock);assert.ok(wait>=0&&wait<198);const trains=[0,99].map(o=>regionalTrainAt(clock+(wait||.01),o));assert.ok(trains.some(v=>Math.abs(v.y-s.y)<.01&&v.speed===0),s.id+' ETA '+clock);
 }
 G.transitAtlas={width:1200,height:800};const rect=G.ctx.fillRect,doors=[];G.ctx.fillRect=(x,y,w,h)=>{if(w===2&&h===16&&G.ctx.fillStyle==='#f3d69b')doors.push(x);};
 try{for(const clock of [1,100]){doors.length=0;G.transit.clock=clock;drawTransitWorld(G,{x0:10100,y0:1000,x1:10500,y1:9750},true);assert.equal(doors.length,6);assert.ok(doors.every(x=>x===(clock===1?17:-19)));}}finally{G.ctx.fillRect=rect;}
 assert.equal(G.regionalPlatformCache.size,4);for(const canvas of G.regionalPlatformCache.values())assert.ok(canvas.height>=2*148+140+32,'platform too short for complete train');
 for(const s of STATIONS){const e=stationExit(s);assert.ok(T.footClear(G,e.x,e.y,10),s.id);}
});
test('platform scenery and journey tiles are reused rather than rebuilt every animation frame',()=>{
 const r={x0:10100,y0:1000,x1:10500,y1:9750};drawTransitWorld(G,r,true);const builds=G.regionalPlatformBuilds;
 G.journeyArt=null;G.journeyArtBuilds=0;G.transit.ride={from:STATIONS[0],to:STATIONS[1],elapsed:0,duration:25};
 for(let i=0;i<90;i++){G.transit.ride.elapsed=i/4;drawJourney(G,{button(){}});drawTransitWorld(G,r,true);}assert.equal(G.journeyArtBuilds,1);assert.equal(G.regionalPlatformBuilds,builds);
 G.transit.ride.to=STATIONS[6];drawJourney(G,{button(){}});assert.equal(G.journeyArt.size,2);assert.equal(G.journeyArtBuilds,2);G.transit.ride=null;
});
