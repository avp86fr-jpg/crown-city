import {test} from 'node:test';
import assert from 'node:assert/strict';
import {harness} from './harness.js';
import {STATIONS,stationExit,interactTransit,beginJourney,tickJourney,skipJourney,drawTransitWorld} from '../src/transit.js';
import {worldBodyHit,bodyContact,nearbyPairs} from '../src/collision.js';
import {createStreetIndex} from '../src/city_ai.js';
const {G,T}=await harness();
function ride(){T.startFreeRide(G);G.chips=1000;G.wanted=0;const e=stationExit(STATIONS[1]);G.player=T.makeFoot(G,e.x,e.y,0);interactTransit(G);assert.ok(beginJourney(G,'sierra'));}
test('three taxiways connect the apron and runway without hull collisions',()=>{
 for(const x of G.world.expansion.airport.taxiways){const v=T.makeVeh('plane',x,7660,0);for(let y=7660;y>=7500;y-=8){assert.ok(['lot','track'].includes(G.surfaceAt(x,y)),`${x},${y}`);assert.equal(worldBodyHit(G,v,x,y),null);}}
 for(const p of G.world.expansion.helipads){assert.ok(T.footClear(G,p.x,p.y,10),p.id);}
});
test('frontier destination buildings have matching collision and leave the highway and contacts accessible',()=>{
 for(const b of G.world.details.buildings){assert.equal(G.surfaceAt(b.x+b.w/2,b.y+b.h/2),'build');assert.ok(G.world.expansion.obstacles.some(o=>o.x===b.x&&o.y===b.y));}
 for(let y=9580;y<9740;y+=8)assert.equal(G.surfaceAt(5600,y),'road');
 for(const p of G.world.expansion.contacts)assert.ok(T.footClear(G,p.x,p.y,8),p.id);
 for(const s of STATIONS){const e=stationExit(s);assert.ok(T.footClear(G,e.x,e.y,10),s.id);}
});
test('train travel preserves the active route, rebuilds GPS and advances exactly its remaining duration',()=>{
 ride();G.settings.timeSpeed=1;G.weather='clear';G.weatherT=100;G.time=12;G.action.contract={id:'clockwork',stage:1,t:100,progress:0};const at={x:6130,y:3555};G.waypoint=at;G.gps={old:true};G.gpsPts=[0,0,1,1];const duration=G.transit.ride.duration,clock=G.transit.clock;
 tickJourney(G,7,{tickWeather:T.tickWeather});skipJourney(G,{makeFoot:T.makeFoot,tickWeather:T.tickWeather});
 assert.equal(G.waypoint,at);assert.equal(G.gps,null);assert.equal(G.gpsPts,null);assert.ok(Math.abs(G.action.contract.t-(100-duration))<1e-8);assert.ok(Math.abs(G.weatherT-(100-duration))<1e-8);assert.ok(Math.abs(G.transit.clock-clock-duration)<1e-8);assert.ok(Math.abs(G.time-12-duration*.05)<1e-8);
 ride();const remaining=G.transit.ride.duration,start=G.transit.clock;tickJourney(G,1000,{makeFoot:T.makeFoot});assert.ok(Math.abs(G.transit.clock-start-remaining)<1e-8);
});
test('expired train contracts clear their stale route and large weather steps remain bounded without particle bursts',()=>{
 ride();G.action.contract={id:'clockwork',stage:1,t:3};G.waypoint={x:1,y:1};G.gpsPts=[0,0,1,1];G.weather='rain';G.weatherT=100;G.rainAmt=G.fog=G.wet=G.sand=0;G.particles.length=0;
 tickJourney(G,15,{tickWeather:T.tickWeather});assert.equal(G.action.contract,null);assert.equal(G.waypoint,null);assert.equal(G.gpsPts,null);for(const k of ['rainAmt','wet','fog','sand'])assert.ok(G[k]>=0&&G[k]<=1,k);assert.equal(G.particles.length,0);
});
test('station artwork stays bounded and does not rebuild every frame or at dusk',()=>{
 G.scene='play';G.stationArtCache=null;G.stationArtBuilds=0;const r={x0:0,y0:0,x1:12288,y1:10240};drawTransitWorld(G,r);const first=G.stationArtBuilds;
 for(let i=0;i<60;i++){G.time=i/3;drawTransitWorld(G,r);}assert.equal(G.stationArtBuilds,first);assert.equal(G.stationArtCache.size,9);
 const atlas=G.transitAtlas;G.transitAtlas={width:1200,height:800};drawTransitWorld(G,r);assert.equal(G.stationArtCache.size,9);assert.equal(G.stationArtBuilds,first+9);G.transitAtlas=atlas;
});
test('pooled broadphase still contains every actual collision across rotated large and small vehicles',()=>{
 const workspace={ignoreParked:true};let seed=4;const rnd=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
 for(let frame=0;frame<30;frame++){
  const vehicles=Array.from({length:45},(_,i)=>T.makeVeh(['riot','plane','wake','bus','stitch'][i%5],rnd()*900-450,rnd()*700-350,rnd()*Math.PI*2,{parked:false}));
  const pairs=nearbyPairs(vehicles,workspace),seen=new Set(pairs.map(([a,b])=>vehicles.indexOf(a)+':'+vehicles.indexOf(b)));assert.equal(pairs.length,seen.size);
  for(let i=0;i<vehicles.length;i++)for(let j=i+1;j<vehicles.length;j++)if(bodyContact(vehicles[i],vehicles[j]))assert.ok(seen.has(i+':'+j));
 }
 const a=T.makeVeh('riot',0,0,0,{parked:true}),b=T.makeVeh('riot',0,0,0,{parked:true});assert.equal(nearbyPairs([a,b],workspace).length,0);b.loose=true;assert.equal(nearbyPairs([a,b],workspace).length,1);assert.equal(nearbyPairs([],workspace).length,0);
});
test('reused street buckets release old residents and do not alias distant or negative cells',()=>{
 const index=createStreetIndex(80),old={x:-161,y:-1},far={x:80,y:-5242880};index.rebuild([old,far]);const found=[];index.query(old.x,old.y,10,p=>found.push(p));assert.deepEqual(found,[old]);
 index.rebuild([{x:20,y:20}]);index.query(old.x,old.y,10,()=>assert.fail('stale resident'));const next=[];index.query(20,20,1,p=>next.push(p));assert.equal(next.length,1);index.rebuild([]);index.query(20,20,100,()=>assert.fail('stale bucket'));
});
test('offscreen ground composition evicts old chunks even when every caller uses frame zero',()=>{
 const ground=G.ground;ground.maxChunks=8;
 for(let i=0;i<40;i++){const x=4096+(i%12)*512,y=512+Math.floor(i/12)*512;ground.draw(G.ctx,{x0:x,y0:y,x1:x+511,y1:y+511},0);assert.ok(ground.cache.size<=8,'offscreen cache exceeded limit');}
 ground.maxChunks=24;
});
