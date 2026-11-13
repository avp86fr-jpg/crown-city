import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildGraph,createTraffic,createNav,edgePoint} from '../src/traffic.js';
import {bodyContact} from '../src/collision.js';
import {boatPilot} from '../src/navigation_ai.js';
import {createCityAI} from '../src/city_ai.js';

function street(kind='arterial'){
 const graph=buildGraph({roads:[{v:false,c:2000,a:100,b:8000,w:280,lanes:2,med:0,k:kind}],signals:[]},{roads:[]});
 const G={graph,player:{x:1900,y:2500,type:'foot'},cam:{x:1900,y:2500,scale:1},canvas:{width:800,height:500},ticks:1,vehicles:[],peds:[],audio:{},surfaceAt:()=> 'road'};
 const traffic=createTraffic(G);traffic.target=0;const e=graph.edges[0];
 const car=(kind,s,lane=0,speed=0)=>{const v={...edgePoint(e,true,s,lane),kind,def:{},health:100,type:'veh',traffic:true,driverPace:1,cruise:110,vx:speed,vy:0,tr:{e,fwd:true,s,lane,spd:speed,turn:null}};G.vehicles.push(v);return v;};
 const step=n=>{for(let i=0;i<n;i++){G.ticks++;traffic.tick(1/60);}};
 return{G,traffic,e,car,step};
}

test('ambient sports cars accelerate, cruise and clear a straight faster than a full-size bus',()=>{
 const result={};for(const kind of ['bus','fare','riot','dart']){
  const S=street('highway'),v=S.car(kind,1000);S.step(120);const launch=v.tr.spd;S.step(360);result[kind]={launch,speed:v.tr.spd,distance:v.x-1100};
 }
 assert.ok(result.dart.launch>result.bus.launch*2,'different models need visibly different acceleration');
 assert.ok(result.riot.launch>result.fare.launch*1.15);
 assert.ok(result.dart.speed>result.bus.speed*1.35,'heavy traffic should not share sports-car cruise speed');
 assert.ok(result.dart.distance>result.bus.distance*1.4);
});

test('drivers retain their temperament but obey the road they have entered and emergency service stops',()=>{
 const S=street('highway'),v=S.car('dart',1000);S.step(240);const highway=v.tr.spd;
 S.e.k='street';S.step(180);assert.ok(v.tr.spd<highway*.6,'a highway-spawned car must slow on local streets');
 const dry=v.tr.spd;S.G.wet=1;S.step(90);assert.ok(v.tr.spd<dry*.92,'wet streets reduce cruise pace');
 v.cruise=0;S.step(90);assert.equal(v.tr.spd,0,'service stop cannot be overridden by a road speed refresh');
});

test('highway traffic brakes before entering a slower local street',()=>{
 const graph=buildGraph({roads:[{v:false,c:2000,a:100,b:2500,w:280,lanes:2,med:0,k:'highway'},{v:false,c:2000,a:2500,b:6500,w:280,lanes:2,med:0,k:'street'}],signals:[]},{roads:[]}),e=graph.edges.find(e=>e.k==='highway');
 const G={graph,player:{x:2500,y:2500,type:'foot'},cam:{x:2500,y:2500,scale:1},canvas:{width:800,height:500},ticks:1,vehicles:[],peds:[],audio:{},surfaceAt:()=> 'road'};
 const v={...edgePoint(e,true,1800,0),kind:'fare',def:{},type:'veh',traffic:true,driverPace:1,cruise:165,vx:165,vy:0,tr:{e,fwd:true,s:1800,lane:0,spd:165,turn:null}};
 G.vehicles=[v];const traffic=createTraffic(G);traffic.target=0;let entered=false;
 for(let i=0;i<600;i++){G.ticks++;traffic.tick(1/60);if(v.x>=2500){entered=true;assert.ok(v.tr.spd<=80,`entered a residential street at ${v.tr.spd}`);break;}}
 assert.ok(entered,'deceleration must not become a permanent stop at the road seam');
});

test('drivers can pass a wreck that still retains its traffic flags without moving the wreck',()=>{
 const S=street(),wreck=S.car('fare',2100),v=S.car('fare',1600,0,90);wreck.dead=true;wreck.tr.spd=0;
 const x=wreck.x;let indicated=false;
 for(let i=0;i<16*60;i++){S.step(1);indicated ||= !!v.turnSign;assert.equal(bodyContact(v,wreck),null);}
 assert.ok(indicated);assert.equal(v.tr.lane,1);assert.ok(v.x>x+180);assert.equal(wreck.x,x);
});

test('a car waits for a fast vehicle approaching the adjacent lane before beginning its pass',()=>{
 const S=street('highway'),v=S.car('fare',1500,0,40),wreck=S.car('fare',1800),fast=S.car('dart',1100,1,200);wreck.dead=true;
 S.step(1);assert.equal(v.tr.merge,undefined,'rear car will reach the merge despite being outside the old 160px clearance box');
 let merged=false;for(let i=0;i<20*60;i++){
  S.step(1);merged ||= !!v.tr.merge;
  assert.equal(bodyContact(v,fast),null);assert.equal(bodyContact(v,wreck),null);
 }
 assert.ok(merged,'the driver should retry once the passing car clears');assert.ok(v.x>wreck.x+100);
});

test('police steering lookahead follows an L-shaped corridor instead of cutting its blocked corner',()=>{
 const nav=createNav({surfaceAt:()=> 'road'}),C=nav.C,OY=nav.OY||0;
 nav.pass.fill(0);nav.raw.fill(0);nav.dist.fill(65535);
 const path=[[5,5],[6,5],[7,5],[8,5],[8,6],[8,7],[8,8]];
 for(const [i,[x,y]]of path.entries()){nav.pass[y*nav.NW+x]=nav.raw[y*nav.NW+x]=1;nav.dist[y*nav.NW+x]=path.length-i-1;}
 const start={x:5.5*C,y:5.5*C-OY},next=nav.next(start.x,start.y,6);
 assert.ok(nav.gridLine(start.x,start.y,next.x,next.y));assert.deepEqual([next.x,next.y],[8.5*C,5.5*C-OY]);
 const finish=nav.next(next.x,next.y,6);assert.deepEqual([finish.x,finish.y],[8.5*C,8.5*C-OY]);
 // Recovery from an eroded edge cannot jump through a wall to a tempting
 // low-distance cell; a farther reachable cell on this side is preferable.
 nav.pass.fill(0);nav.raw.fill(0);nav.dist.fill(65535);
 for(let y=5;y<=8;y++)nav.raw[y*nav.NW+5]=1;
 for(const [x,y,d]of [[7,5,0],[5,8,10]]){nav.raw[y*nav.NW+x]=nav.pass[y*nav.NW+x]=1;nav.dist[y*nav.NW+x]=d;}
 const recover=nav.next(start.x,start.y);assert.deepEqual([recover.x,recover.y],[5.5*C,8.5*C-OY]);
});

test('two boat captains share one broadphase scan and still detect a newly arriving wreck',()=>{
 let scanned=0;const a={kind:'wake',def:{boat:true},x:0,y:0,rot:0,vx:0,vy:0},b={...a,x:500};
 const vehicles=[a,b,...Array.from({length:200},(_,i)=>({x:i*100,y:4000,get def(){scanned++;return{};}}))];
 const G={ticks:1,vehicles,surfaceAt:()=> 'water'};boatPilot(G,a,.2);const first=scanned;boatPilot(G,b,.2);
 assert.equal(scanned,first,'road population must not be rescanned by each captain in the same tick');
 G.vehicles.push({...a,y:-110,dead:true});G.ticks++;a.vy=-80;
 assert.equal(boatPilot(G,a,.2).brake,true,'new wreck invalidates the shared index immediately');
});

test('buses brake before a shelter, dwell beside it, and then resume instead of starting their dwell while moving',()=>{
 const v={x:0,y:0,rot:Math.PI/2,kind:'bus',def:{},traffic:true,vx:80,vy:0,tr:{lane:0,e:{lanes:1}}};
 const G={player:{x:0,y:300,type:'foot'},cam:{x:0,y:0},peds:[],vehicles:[v],street:{fixtures:[{x:160,y:50,kind:2}]},settings:{quality:'high'},surfaceAt:()=> 'road'};
 const ai=createCityAI(G);let stoppedAt=null,resumed=false,speed=80;
 for(let i=0;i<900;i++){
  ai.begin(1/60);const target=ai.trafficSpeed(v,80);speed+=Math.max(-120/60,Math.min(22/60,target-speed));v.x+=speed/60;v.vx=speed;
  if(speed<.5&&stoppedAt===null)stoppedAt=v.x;
  if(stoppedAt!==null&&v.x>200){resumed=true;break;}
 }
 assert.ok(stoppedAt>140&&stoppedAt<177,`bus stopped away from its shelter: ${stoppedAt}`);assert.ok(resumed);
});

test('traffic does not yield indefinitely to an opposite-direction siren or an empty deployed cruiser',()=>{
 const v={x:0,y:0,rot:Math.PI/2,kind:'fare',def:{},traffic:true,vx:50,vy:0},emergency={...v,x:-80,y:40,siren:true,rot:-Math.PI/2};
 const G={player:{x:0,y:300,type:'foot'},cam:{x:0,y:0},peds:[],vehicles:[v,emergency],street:{fixtures:[]},settings:{quality:'high'},surfaceAt:()=> 'road'},ai=createCityAI(G);
 ai.begin(.2);assert.equal(ai.trafficSpeed(v,100),100);
 emergency.rot=v.rot;emergency.crewOut=true;ai.begin(.2);assert.equal(ai.trafficSpeed(v,100),100);
 emergency.crewOut=false;ai.begin(.2);assert.equal(ai.trafficSpeed(v,100),20);
});
