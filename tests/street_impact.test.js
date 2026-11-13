import {test} from 'node:test';
import assert from 'node:assert/strict';
import {bloodImpact,tickBlood} from '../src/blood_fx.js';
import {escapeHeading} from '../src/navigation_ai.js';
import {createCityAI} from '../src/city_ai.js';
import {createPeds,createTraffic,buildGraph} from '../src/traffic.js';
import {trafficDemand,pedDemand} from '../src/street_population.js';
import {characterPose} from '../src/visuals.js';
import {settingsFrom} from '../src/session.js';
import {circleBody} from '../src/collision.js';
import {harness} from './harness.js';
const scene=()=>({settings:{quality:'low',blood:'full'},surfaceAt:()=> 'walk',solidAt:()=>false,vehicles:[],peds:[],player:{x:0,y:0,type:'foot'},cam:{x:0,y:0},ticks:0,street:{fixtures:[]}});

test('heavy impacts spray in the impact direction and produce ground stains and debris',()=>{
 const G=scene(),p={x:100,y:200};bloodImpact(G,p,250,0,2,true);
 assert.ok(G.bloodFX.stains.length>=1&&G.bloodFX.stains.length<=4,'pool plus a short directional spray');assert.ok(G.bloodFX.drops.every(d=>d.vx>0));assert.ok(G.bloodFX.drops.some(d=>d.chunk));
 for(let i=0;i<120;i++)tickBlood(G,1/60);
 assert.equal(G.bloodFX.drops.length,0);assert.ok(G.bloodFX.stains.length>1,'landed debris leaves a small mark');
 tickBlood(G,180);assert.equal(G.bloodFX.stains.length,0,'decals persist a couple of minutes, then fade');
});
test('ten minutes of repeated mobile impacts stay within particle, stain and pool budgets',()=>{
 const G=scene();for(let i=0;i<6000;i++){bloodImpact(G,{x:0,y:0},200,50,2,true);tickBlood(G,.1);}
 assert.ok(G.bloodFX.drops.length<=64);assert.ok(G.bloodFX.stains.length<=64);assert.ok(G.bloodFX.pool.length<=64);
 G.settings.quality='high';for(let i=0;i<30;i++)bloodImpact(G,{x:0,y:0},200,0,2,true);
 G.settings.quality='low';tickBlood(G,.01);assert.ok(G.bloodFX.drops.length<=64);assert.ok(G.bloodFX.stains.length<=64);assert.ok(G.bloodFX.pool.length<=64);
});
test('blood preferences persist; reduced effects omit chunks, off clears effects, rain washes stains',()=>{
 const G=scene();assert.equal(settingsFrom({blood:'reduced'}).blood,'reduced');assert.equal(settingsFrom({blood:'invalid'}).blood,'full');
 G.settings.blood='reduced';bloodImpact(G,{x:0,y:0},200,0,2,true);assert.equal(G.bloodFX.drops.length,2);assert.ok(G.bloodFX.drops.every(d=>!d.chunk));
 G.rainAmt=1;tickBlood(G,70);assert.equal(G.bloodFX.stains.length,0);
 G.settings.blood='off';bloodImpact(G,{x:0,y:0},200,0,2,true);tickBlood(G,.1);assert.equal(G.bloodFX.drops.length+G.bloodFX.stains.length+G.bloodFX.pool.length,0);
 const fresh=scene();fresh.settings.blood='off';bloodImpact(fresh,{x:0,y:0});assert.equal(fresh.bloodFX,undefined);
 for(const s of ['water','canal','build']){const F=scene();F.surfaceAt=()=>s;bloodImpact(F,{x:0,y:0},100,0,2,true);assert.equal(F.bloodFX.stains.length,0);}
});
test('fleeing residents avoid parked hulls, approaching cars, and narrow wall corners',()=>{
 const G=scene(),p={x:0,y:0,rot:Math.PI/2},source={x:-100,y:0};
 G.vehicles=[{x:55,y:0,rot:0,kind:'fare',def:{},vx:0,vy:0}];
 let heading=escapeHeading(G,p,source);assert.ok(Math.abs(heading-Math.PI/2)>.5);assert.equal(p._escapeBlocked,false);
 assert.equal(circleBody(G.vehicles[0],Math.sin(heading)*70,-Math.cos(heading)*70,9),false);
 G.vehicles=[{x:140,y:0,rot:-Math.PI/2,kind:'fare',def:{},vx:-180,vy:0}];heading=escapeHeading(G,p,source);assert.ok(Math.abs(heading-Math.PI/2)>.5);
 G.vehicles=[];G.surfaceAt=(x,y)=>x>18&&Math.abs(y)<30?'build':'walk';heading=escapeHeading(G,p,source);assert.ok(Math.abs(heading-Math.PI/2)>.5);
 G.surfaceAt=(x,y)=>Math.hypot(x,y)>9?'build':'walk';escapeHeading(G,p,source);assert.equal(p._escapeBlocked,true,'trapped residents should cower instead of walking against a wall');
});
test('a fleeing pedestrian prefers the verge to running lengthways through traffic',()=>{
 const G=scene(),p={x:0,y:0,rot:0};G.surfaceAt=(x,y)=>Math.abs(x)<24?'road':'walk';
 const h=escapeHeading(G,p,{x:0,y:100});assert.ok(Math.abs(Math.sin(h)*70)>24);assert.equal(p._escapeBlocked,false);
});
test('a nearby casualty alarms a witness once; removed actors and occluded bodies do not',()=>{
 const G=scene(),p={x:0,y:0,rot:0,walk:32,flee:0},body={x:45,y:0,dead:true};G.peds=[p,body];G.cityAI=createCityAI(G);
 G.cityAI.begin(.2);assert.ok(p.flee>0);const reactions=G.cityAI.stats.reactions;p.flee=0;
 for(let i=0;i<30;i++)G.cityAI.begin(.2);assert.equal(G.cityAI.stats.reactions,reactions);assert.equal(p.flee,0);
 G.peds.push({x:30,y:0,dead:true,removed:true});G.cityAI.begin(.2);assert.equal(p.flee,0);
 G.nav={clearLine:()=>false};G.peds.push({x:25,y:0,dead:true});G.cityAI.begin(.2);assert.equal(p.flee,0);
 G.nav.clearLine=()=>true;G.cityAI.begin(.2);assert.ok(p.flee>0);
});
test('a permanently blocked crossing sends a walker along a clear curb after one signal cycle',()=>{
 const G=scene();G.surfaceAt=x=>x>=0&&x<180?'road':'walk';G.crossOk=()=>false;
 const p={x:-16,y:0,rot:Math.PI/2,hx:1,hy:0,walk:32,dist:0,idle:0},system=createPeds(G),rand=Math.random;Math.random=()=>.5;
 try{for(let i=0;i<24*60;i++)system.walkAmbient(p,1/60);}finally{Math.random=rand;}
 assert.ok(Math.abs(p.y)>40,'walker must find another crossing along the sidewalk');assert.ok(p.x<=-6);assert.equal(p.crossing,undefined);
});
test('traffic demand follows district and clock without exceeding quality limits',()=>{
 const G=scene();G.player={x:2100,y:2400};G.time=21;const city=trafficDemand(G,24);assert.ok(city>=24&&city<=30);
 G.time=4;assert.ok(trafficDemand(G,24)<city);G.player={x:11500,y:8000};assert.ok(trafficDemand(G,24)<=8);
 for(let h=0;h<24;h++){G.time=h;for(const base of [24,40,54])assert.ok(trafficDemand(G,base)<=Math.ceil(base*1.25));}assert.equal(trafficDemand(G,0),0);
});
test('local weighted spawning finds remote roads and preserves a full braking gap',()=>{
 const G=scene();G.graph=buildGraph({roads:[{v:false,c:12000,a:10000,b:15000,w:280,lanes:2,med:0,k:'arterial'},...Array.from({length:80},(_,i)=>({v:false,c:100+i*100,a:100,b:1000,w:200,lanes:1,med:0,k:'street'}))],signals:[]},{roads:[]});
 G.canvas={width:844,height:390};G.cam={x:12500,y:12000,scale:1};G.makeVeh=(kind,x,y,rot,extra)=>({kind,x,y,rot,def:{},...extra});
 const traffic=createTraffic(G),rand=Math.random;let seed=19;Math.random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
 try{for(let i=0;i<10;i++)traffic.spawnCar({x:12500,y:12000},0,1800,'fare');}finally{Math.random=rand;}
 assert.ok(G.vehicles.length>=5,'spawning must concentrate on nearby usable roads');assert.ok(G.vehicles.every(v=>v.y>11800));
 for(const a of G.vehicles)for(const b of G.vehicles)if(a!==b&&Math.abs(a.y-b.y)<35)assert.ok(Math.abs(a.x-b.x)>180,'spawned same-lane traffic needs braking space');
});
test('fallen characters have no idle breathing or walking squash',()=>{
 for(const t of [0,.1,10,100])assert.deepEqual(characterPose({dead:true,x:1,dist:55},true,t),{bob:0,sx:1,sy:1,recoil:0});
});
test('actual bullets and runovers trigger impact effects, while scenery hits do not',async()=>{
 const {G,T}=await harness();T.startFreeRide(G);G.vehicles=[];G.cops=[];G._ambT=99;G.surfaceAt=()=> 'road';G.solidAt=()=>false;G.settings.blood='full';G.player=T.makeFoot(G,2100,2400,Math.PI/2);
 const victim={x:2180,y:2400,rot:0,hp:100,dist:0,walk:30};G.peds=[victim];
 const shot=()=>({x:2120,y:2400,vx:800,vy:0,life:1,friend:true,damage:35});
 G.bullets=[shot()];T.tickBullets(G,.1);assert.ok(victim.hp<100);assert.ok(G.bloodFX.drops.length>0);
 victim.hp=1;G.bullets=[shot()];T.tickBullets(G,.1);assert.equal(victim.dead,true);assert.ok(G.bloodFX.stains.length>=2);
 G.bloodFX=null;G.solidAt=x=>x>2140;G.bullets=[shot()];T.tickBullets(G,.1);assert.equal(G.bloodFX,null,'wall hits must only spark');
 G.solidAt=()=>false;G.bloodFX=null;const car=T.makeVeh('riot',2180,2400,Math.PI/2);car.vx=200;car.vy=0;G.vehicles=[car];G.movingVehicles=[car];G.peds=[{x:2180,y:2400,rot:0,hp:10,dist:0,walk:30}];T.tickPeds(G,1/60);
 assert.equal(G.peds[0].dead,true);assert.ok(G.bloodFX.drops.some(d=>d.chunk));
});
test('sustained mobile load reduces ambient demand with hysteresis, leaving visible and protected pedestrians in place',async()=>{
 const {G,T}=await harness();T.startFreeRide(G);G.touch=true;G.settings.quality='low';G.settings.autoRes=true;G.directRaster=true;G.resScale=.75;T.applyQuality(G);
 for(let i=0;i<240;i++)T.adaptRes(G,1/30);assert.equal(G.streetBudget,.8);
 G.time=21;G.player.x=2100;G.player.y=2400;assert.ok(trafficDemand(G,24)<=24);
 for(let i=0;i<400;i++)T.adaptRes(G,1/60);assert.equal(G.streetBudget,.8,'a short recovery must not immediately repopulate');
 for(let i=0;i<1000;i++)T.adaptRes(G,1/60);assert.equal(G.streetBudget,1);
 G.streetBudget=.8;G.ticks=600;G.cam.x=G.player.x;G.cam.y=G.player.y;
 const visible={x:G.cam.x,y:G.cam.y,ambient:true},mission={x:G.cam.x+1500,y:G.cam.y,ambient:true,mission:true},crossing={x:G.cam.x+1400,y:G.cam.y,ambient:true,crossing:true};
 G.peds=[visible,mission,crossing,...Array.from({length:50},(_,i)=>({x:G.cam.x+1200+i,y:G.cam.y,ambient:true}))];
 const before=G.peds.length;G.pedsys.tick(1/60);assert.equal(G.peds.length,before-1);assert.ok(G.peds.includes(visible)&&G.peds.includes(mission)&&G.peds.includes(crossing));
 assert.equal(G.pedsys.effectiveTarget,Math.round(pedDemand(G,42)*.8));G.settings.quality='high';T.applyQuality(G);assert.equal(G.streetBudget,1);
});
