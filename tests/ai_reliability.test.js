import {test} from 'node:test';
import assert from 'node:assert/strict';
import {harness} from './harness.js';
import {createTraffic,buildGraph,edgePoint,createPeds} from '../src/traffic.js';
import {bodyContact,worldBodyHit,circleBody} from '../src/collision.js';
import {CITY_HUBS,inCityHub} from '../src/world_hubs.js';
import {createCityAI} from '../src/city_ai.js';

test('a stopped car holds a queue for three minutes without being pushed into a pile',async()=>{
 const {G:base,T}=await harness();
 const graph=buildGraph({roads:[{v:false,c:2000,a:100,b:3900,w:200,lanes:1,med:0,k:'arterial'}],signals:[]},{roads:[]});
 const G={...base,world:{buildings:[],coreBuildings:[]},graph,player:{x:2000,y:2300,type:'foot'},cam:{x:2000,y:2300,scale:1},canvas:{width:800,height:500},ticks:1,vehicles:[],peds:[],audio:{},surfaceAt:()=> 'road'};
 const traffic=createTraffic(G);traffic.target=0;const e=graph.edges[0];
 const def=T.makeVeh('fare',0,0,0).def;
 const parked={...edgePoint(e,true,2100,0),def,kind:'fare',parked:true,vx:0,vy:0};G.vehicles.push(parked);
 for(let i=0;i<8;i++)G.vehicles.push({...edgePoint(e,true,1800-i*150,0),type:'veh',def,kind:'fare',traffic:true,cruise:100,vx:0,vy:0,tr:{e,fwd:true,s:1800-i*150,lane:0,spd:100,turn:null}});
 for(let frame=0;frame<180*60;frame++){G.ticks++;traffic.tick(1/60);T.tickCollisions(G);if(frame%60===0)for(let i=0;i<G.vehicles.length;i++)for(let j=i+1;j<G.vehicles.length;j++)assert.equal(bodyContact(G.vehicles[i],G.vehicles[j]),null);}
 assert.equal(parked.x,2200);assert.equal(G.vehicles.filter(v=>v.traffic&&v.tr.spd<1).length,8);
 G.vehicles.shift();for(let frame=0;frame<12*60;frame++){G.ticks++;traffic.tick(1/60);}assert.ok(G.vehicles[0].x>2700,'queue resumes after obstacle leaves');
});

test('walkers route around a parked car without entering its body or jittering in place',()=>{
 const car={x:0,y:0,rot:0,def:{},kind:'fare',vx:0,vy:0};
 const G={surfaceAt:()=> 'walk',vehicles:[car],peds:[],ticks:1};const walkers=createPeds(G),p={x:-100,y:0,rot:Math.PI/2,hx:1,hy:0,walk:36,dist:0,idle:0};
 const rand=Math.random;Math.random=()=>.5;
 try{for(let i=0;i<15*60;i++){walkers.walkAmbient(p,1/60);assert.equal(circleBody(car,p.x,p.y,5),false);}}finally{Math.random=rand;}
 assert.ok(p.x>80,`walker failed to pass car: ${p.x},${p.y}`);
});

test('authored garage provides a safe starter car, foot spawn and drivable exit; police release survives saving',async()=>{
 const {G,T}=await harness();T.startNew(G);const h=CITY_HUBS.garage,riot=G.vehicles.find(v=>v.mission&&v.kind==='riot');
 assert.deepEqual([riot.x,riot.y,riot.rot],h.car);assert.deepEqual([G.player.x,G.player.y],h.spawn);
 for(let x=riot.x;x<=1010;x+=8)assert.equal(worldBodyHit(G,riot,x,riot.y),null,`garage exit at ${x}`);
 assert.ok(G.street.fixtures.every(p=>!inCityHub(p.x,p.y,40)));
 G.wanted=3;T.busted(G);assert.deepEqual([G.player.x,G.player.y],CITY_HUBS.police.release);assert.equal(G.wanted,0);assert.equal(G.cops.length,0);assert.ok(T.footClear(G,G.player.x,G.player.y,8));
 const save=T.snapshot(G);T.restoreState(G,save);assert.ok(Math.hypot(G.player.x-2400,G.player.y-3736)<20);
});

test('full touch stick walks; explicit RUN sprints; a partial stick gives precise movement',async()=>{
 const {G,T}=await harness();T.startFreeRide(G);G.vehicles=[];G.peds=[];G.input.touchJoy.active=true;G.cam.rot=0;
 const distance=(axis,sprint)=>{G.player=T.makeFoot(G,768,3344,Math.PI/2);G.input.x=axis;G.input.y=0;G.input.sprint=sprint;for(let i=0;i<30;i++)T.tickPlayer(G,1/60);return Math.hypot(G.player.x-768,G.player.y-3344);};
 const walk=distance(1,false),run=distance(1,true),slow=distance(.4,false);assert.ok(walk>25&&walk<40);assert.ok(run>walk*1.5);assert.ok(slow<walk*.5&&slow>3);
});

test('cruiser waits while officers are deployed without reversing or firing from an empty car',async()=>{
 const {G,T}=await harness();T.startFreeRide(G);G.vehicles=[];G.peds=[];G.player=T.makeFoot(G,980,3380,0);G.wanted=2;
 const c=T.makeVeh('metro',980,3050,Math.PI,{cop:true,ai:true});c.crewOut=true;G.cops=[c];G.vehicles=[c];G.peds=[{x:1040,y:3050,copPed:true,car:c,dead:false,rot:0,dist:0,grabT:0}];
 for(let i=0;i<180;i++){G.ticks++;T.tickCops(G,1/60);}assert.ok(Math.hypot(c.x-980,c.y-3050)<3);assert.equal(c.reverseT,0);assert.equal(G.bullets.length,0);
});

test('traffic signals and merges into a clear adjacent lane to pass a stationary parked obstruction',()=>{
 const graph=buildGraph({roads:[{v:false,c:2000,a:100,b:3900,w:260,lanes:2,med:0,k:'arterial'}],signals:[]},{roads:[]});
 const G={graph,player:{x:2000,y:2400,type:'foot'},cam:{x:2000,y:2300,scale:1},canvas:{width:800,height:500},ticks:1,vehicles:[],peds:[],audio:{},surfaceAt:()=> 'road'};
 const traffic=createTraffic(G);traffic.target=0;const e=graph.edges[0],parked={...edgePoint(e,true,2100,0),def:{},kind:'fare',parked:true,vx:0,vy:0};
 const v={...edgePoint(e,true,1600,0),type:'veh',def:{},kind:'fare',traffic:true,cruise:90,vx:90,vy:0,tr:{e,fwd:true,s:1600,lane:0,spd:90,turn:null}};G.vehicles=[parked,v];let signalled=false;
 for(let frame=0;frame<16*60;frame++){G.ticks++;traffic.tick(1/60);signalled ||= !!v.turnSign;assert.equal(bodyContact(v,parked),null);}
 assert.ok(signalled);assert.equal(v.tr.lane,1);assert.ok(v.x>parked.x+200,`failed to pass: ${v.x},${v.y}`);
});

test('painted junction crossings are road surfaces while the Strip refuge stays pedestrian space',async()=>{
 const {G}=await harness();assert.equal(G.surfaceAt(970,2681),'road');assert.notEqual(G.surfaceAt(1964,2300),'road');assert.notEqual(G.surfaceAt(850,2800),'road');
});

test('narrow coast roads use one viable lane per direction, preserving the diagonal connection',()=>{
 const graph=buildGraph({roads:[],signals:[]},{roads:[{k:'coast',w:180,a:[100,100],b:[1900,100]},{k:'highway',w:200,a:[1900,100],b:[2060,240]},{k:'arterial',w:200,a:[2060,240],b:[2060,1600]}]});
 assert.equal(graph.edges.find(e=>e.k==='coast').lanes,1);assert.equal(graph.nodes.find(n=>n.x===1900&&n.y===100).edges.length,2);
});
