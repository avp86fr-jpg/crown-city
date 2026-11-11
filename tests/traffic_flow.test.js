import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildGraph,createTraffic,createPeds,edgePoint} from '../src/traffic.js';
import {safeCrossing} from '../src/navigation_ai.js';
import {bodyContact} from '../src/collision.js';
import {harness} from './harness.js';
function city(roads,signals=[]){
 const graph=buildGraph({roads,signals},{roads:[]}),G={graph,player:{x:2400,y:2400,type:'foot'},cam:{x:2000,y:2000,scale:1},canvas:{width:800,height:500},ticks:1,vehicles:[],peds:[],audio:{}};
 const traffic=createTraffic(G);traffic.target=0;
 const car=(e,fwd,s,lane=0)=>{const p=edgePoint(e,fwd,s,lane),v={...p,type:'veh',kind:'fare',def:{},traffic:true,cruise:125,vx:0,vy:0,tr:{e,fwd,s,lane,spd:0,turn:null}};G.vehicles.push(v);return v;};
 return {G,traffic,car};
}
const road=(v,c,a,b,w=200)=>({v,c,a,b,w,lanes:2,med:0,k:'arterial'});
test('duplicate road records and short collinear seams do not create false junctions or overlapping turn zones',()=>{
 const W={roads:[road(false,2000,100,1800),road(false,2000,1800,2000),road(false,2000,2000,3900),road(true,2000,100,3900)],signals:[]};
 const graph=buildGraph(W,{roads:[{a:[100,2000],b:[1800,2000],w:200,k:'arterial'}]});
 assert.equal(graph.edges.length,4);assert.equal(graph.nodes.filter(n=>n.edges.length===4).length,1);
 assert.equal(graph.nodes.some(n=>n.x===1800&&n.y===2000),false);
 const keys=graph.edges.map(e=>[e.A.id,e.B.id].sort((a,b)=>a-b).join(':'));assert.equal(new Set(keys).size,keys.length);
});
test('a four-way signal clears all sixteen queued cars without collisions or a permanent turn deadlock',()=>{
 const {G,traffic,car}=city([road(false,2000,100,3900),road(true,2000,100,3900)],[{x:2000,y:2000}]);
 const centre=G.graph.nodes.find(n=>n.edges.length===4),entered=new Set(),cars=[];
 for(const e of centre.edges)for(let lane=0;lane<2;lane++)for(let row=0;row<2;row++)cars.push(car(e,e.B===centre,e.len-450-row*150,lane));
 const first=new Map(cars.map(c=>[c,c.tr.e]));
 let seed=903;const rand=Math.random;Math.random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
 try{for(let i=0;i<120*60;i++){G.ticks++;traffic.tick(1/60);for(const c of cars){assert.ok(Number.isFinite(c.x+c.y+c.rot));if(c.tr.e!==first.get(c))entered.add(c);}
  if(i%30===0)for(let a=0;a<cars.length;a++)for(let b=a+1;b<cars.length;b++)assert.ok(!(bodyContact(cars[a],cars[b])?.pen>.5),'queue/turn body overlap');
 }}finally{Math.random=rand;}
 assert.equal(entered.size,cars.length,'every approach must progress through the signal');
});
test('traffic waits outside a blocked exit and resumes when the exit becomes clear',()=>{
 const {G,traffic,car}=city([road(false,2000,100,2000,200),road(false,2000,2000,3900,260)],[]);
 const seam=G.graph.nodes.find(n=>n.edges.length===2),e=seam.edges.find(e=>e.A.x===100),v=car(e,true,e.len-500),block={type:'veh',kind:'fare',def:{},x:2240,y:2032.5,rot:Math.PI/2,vx:0,vy:0};G.vehicles.push(block);
 for(let i=0;i<1200;i++){G.ticks++;traffic.tick(1/60);}assert.ok(v.x<1900);assert.equal(v.tr.turn,null);
 G.vehicles.splice(G.vehicles.indexOf(block),1);for(let i=0;i<900;i++){G.ticks++;traffic.tick(1/60);}assert.ok(v.x>2300);
});
test('five-minute real-road traffic soak retains circulation without overlapping vehicles',async t=>{
 const {G,T}=await harness();T.startFreeRide(G);G.player=T.makeFoot(G,2300,2400,0);G.cam.x=1964;G.cam.y=2400;G.vehicles=[];G.peds=[];G.cityAI=null;G.traffic=createTraffic(G);G.traffic.target=34;
 let seed=73524;const rand=Math.random;Math.random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);let moving=0,sampled=0,allStopped=0,maxAllStopped=0,maxTurnStall=0,maxStall=0;const stalls=new Map(),turnStalls=new Map();
 try{for(let i=0;i<300*60;i++){G.ticks++;G.traffic.tick(1/60);if(i%60)continue;const cars=G.vehicles.filter(v=>v.traffic),active=cars.filter(v=>v.tr.spd>5).length;
  for(const v of cars){const stopped=v.tr.spd<5;stalls.set(v,stopped?(stalls.get(v)||0)+1:0);turnStalls.set(v,stopped&&v.tr.turn?(turnStalls.get(v)||0)+1:0);maxStall=Math.max(maxStall,stalls.get(v));maxTurnStall=Math.max(maxTurnStall,turnStalls.get(v));}
  if(i>180*60){moving+=active;sampled+=cars.length;allStopped=active===0?allStopped+1:0;maxAllStopped=Math.max(maxAllStopped,allStopped);}
  for(let a=0;a<cars.length;a++)for(let b=a+1;b<cars.length;b++)assert.ok(!(bodyContact(cars[a],cars[b])?.pen>1),'body overlap in real road graph');
 }}finally{Math.random=rand;}
 t.diagnostic(`isolated: ${(100*moving/sampled).toFixed(1)}% moving; max stopped ${maxStall}s; max stopped in turn ${maxTurnStall}s`);assert.ok(maxTurnStall<45,'persistent turn jam');assert.ok(maxStall<60,'one approach was starved for a full minute');
 assert.ok(moving/sampled>.25,`circulation collapsed: ${moving}/${sampled}`);assert.ok(maxAllStopped<8,`entire network stopped for ${maxAllStopped}s`);
});
test('four-minute full game simulation keeps traffic moving with actual parked cars, pedestrians and collision physics',async t=>{
 let seed=9921;const rand=Math.random;Math.random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
 const {G,T}=await harness();T.startFreeRide(G);const safe=T.findSafe(G,2280,2400,10,true);G.player=T.makeFoot(G,safe.x,safe.y,0);G.cam.x=1964;G.cam.y=2400;G.settings.timeSpeed=0;G.weatherT=1e9;
 let moving=0,sampled=0,maxStall=0,maxTurnStall=0,longStalled=0;const stalls=new Map(),turnStalls=new Map();
 try{for(let i=0;i<240*60;i++){T.tick(G,1/60);if(i%60===0){const cars=G.vehicles.filter(v=>v.traffic);for(const v of cars){const stopped=Math.hypot(v.vx,v.vy)<5;stalls.set(v,stopped?(stalls.get(v)||0)+1:0);turnStalls.set(v,stopped&&v.tr.turn?(turnStalls.get(v)||0)+1:0);maxStall=Math.max(maxStall,stalls.get(v));maxTurnStall=Math.max(maxTurnStall,turnStalls.get(v));}if(i>180*60){moving+=cars.filter(v=>Math.hypot(v.vx,v.vy)>5).length;longStalled+=cars.filter(v=>stalls.get(v)>45).length;sampled+=cars.length;}assert.ok(cars.every(v=>Number.isFinite(v.x+v.y+v.rot)));}}}finally{Math.random=rand;}
 t.diagnostic(`full: ${(100*moving/sampled).toFixed(1)}% moving; max stopped ${maxStall}s; max stopped in turn ${maxTurnStall}s; ${(100*longStalled/sampled).toFixed(1)}% of final samples stopped >45s`);assert.ok(maxTurnStall<45,'persistent turn jam in full game');
 assert.equal(G.scene,'play');assert.ok(sampled>500);assert.ok(moving/sampled>.25,`full simulation traffic stalled: ${moving}/${sampled}`);
});

test('pedestrians finish crossing without random pauses and leave a road after fleeing',()=>{
 const G={surfaceAt:(x,y)=>Math.abs(x)<100?'road':'walk',peds:[],vehicles:[],ticks:0};
 const system=createPeds(G),p={x:0,y:0,rot:0,hx:0,hy:-1,walk:36,dist:0,idle:10,crossing:false};
 for(let i=0;i<240;i++)system.walkAmbient(p,1/60);
 assert.ok(Math.abs(p.x)>100,'road recovery must reach a sidewalk');assert.equal(p.crossing,false);assert.ok(Math.abs(p.y)<40,'recovery should cross the lane instead of following it');
});
test('pedestrian crossings require a reachable opposite verge',()=>{
 const G={surfaceAt:(x,y)=>Math.abs(x)<100?'road':'walk',graph:{nodes:[{x:0,y:0,hw:100,hh:100}]},vehicles:[],ticks:0};
 const crossing={x:-110,y:0,hx:1,hy:0,walk:36};assert.equal(safeCrossing(G,crossing),true);
 const alongLane={x:0,y:0,hx:0,hy:1,walk:36};assert.equal(safeCrossing(G,alongLane),false);assert.equal(alongLane._crossRouteInvalid,true);
});
test('a walker blocked by a building finishes turning instead of alternating heading forever',()=>{
 const G={surfaceAt:x=>x>=0?'build':'walk'},system=createPeds(G),p={x:-7,y:0,rot:Math.PI/2,hx:1,hy:0,walk:36,dist:0,idle:0};
 const rand=Math.random;Math.random=()=>.5;
 try{for(let i=0;i<240;i++)system.walkAmbient(p,1/60);}finally{Math.random=rand;}
 assert.ok(Math.hypot(p.x+7,p.y)>45,'walker should turn and clear the corner');assert.ok(p.x<=-6,'walker must stay outside the wall');assert.ok(Number.isFinite(p.rot));
});
