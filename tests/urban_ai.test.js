import {test} from 'node:test';
import assert from 'node:assert/strict';
import {slideFoot} from '../src/foot_motion.js';
import {createTraffic,edgePoint} from '../src/traffic.js';
import {boatPilot,waterPathClear,safeCrossing,escapeHeading} from '../src/navigation_ai.js';

test('foot sweep cannot tunnel through thin walls or invent sideways corner motion',()=>{
 const clear=(x,y,r)=>x+r<50||x-r>56;
 const p={x:10,y:0};slideFoot(p,200,0,clear);assert.ok(p.x<43);assert.equal(p.y,0);
 for(let i=0;i<200;i++)slideFoot(p,2,0,clear);assert.equal(p.y,0);assert.ok(p.x<43);
 slideFoot(p,30,60,clear);assert.ok(p.x<43);assert.ok(p.y>59);
});
test('foot sliding is consistent across movement subdivisions',()=>{
 const clear=(x,y,r)=>x+r<50&&y+r<100,p={x:10,y:0},q={...p};
 slideFoot(p,60,80,clear);for(let i=0;i<20;i++)slideFoot(q,3,4,clear);
 assert.ok(Math.hypot(p.x-q.x,p.y-q.y)<3);
});
function trafficCity(){
 const A={x:0,y:0,id:0,hw:50,hh:50,edges:[]},B={x:1000,y:0,id:1,hw:50,hh:50,sig:true,edges:[]},C={x:2000,y:0,id:2,hw:50,hh:50,edges:[]};
 const e={A,B,len:1000,dx:1,dy:0,w:120,lanes:1,med:0,k:'street'},n={...e,A:B,B:C};A.edges=[e];B.edges=[e,n];C.edges=[n];
 const G={graph:{nodes:[A,B,C],edges:[e,n]},player:{x:0,y:1000,type:'foot'},vehicles:[],peds:[],ticks:0,audio:{},cam:{x:0,y:0},canvas:{width:800,height:400}};
 const traffic=createTraffic(G);traffic.target=0;
 function car(s,speed=100){const p=edgePoint(e,true,s,0),v={...p,kind:'fare',def:{},type:'veh',traffic:true,cruise:140,vx:speed,vy:0,tr:{e,fwd:true,s,lane:0,spd:speed,turn:null}};G.vehicles.push(v);return v;}
 return {G,traffic,car,e,B};
}
test('cars hold behind a red stop line without creeping, then leave on green',()=>{
 const {G,traffic,car}=trafficCity(),v=car(760,160);
 for(let i=0;i<360;i++){G.ticks=i;traffic.tick(1/60);assert.ok(v.x<=880.01);}
 assert.ok(v.x>875);assert.ok(v.tr.spd<1);assert.equal(v.tr.turn,null);
 for(let i=480;i<720;i++){G.ticks=i;traffic.tick(1/60);}assert.ok(v.x>950);
});
test('traffic preserves body-length stopping space behind a parked car',()=>{
 const {G,traffic,car,B}=trafficCity();B.sig=false;const v=car(200,140);
 G.vehicles.push({x:600,y:v.y,rot:Math.PI/2,kind:'bus',def:{},type:'veh',vx:0,vy:0});
 for(let i=0;i<480;i++){G.ticks=i;traffic.tick(1/60);assert.ok(v.x<=467.01);}
 assert.ok(v.x>460);assert.ok(v.tr.spd<1);
});
test('dead traffic does not continue driving its lane after wrecking',()=>{
 const {G,traffic,car}=trafficCity(),v=car(200);v.dead=true;traffic.tick(1/60);assert.equal(v.x,200);
});
const boat=(x=0,y=0,rot=0)=>({x,y,rot,kind:'wake',def:{boat:true},vx:0,vy:0,home:{x,y}});
test('boat routes validate the whole hull and retain water access under bridges',()=>{
 const G={surfaceAt:(x,y)=>Math.abs(x)<105?'canal':'walk',world:{boatSurfaceAt:(x,y)=>Math.abs(x)<105?'canal':'walk'},vehicles:[]},v=boat();G.vehicles=[v];
 assert.ok(waterPathClear(G,v,0,-300));assert.equal(waterPathClear(G,v,100,-300),false);
 for(let i=0;i<10;i++){const controls=boatPilot(G,v,.2);assert.ok(Number.isFinite(controls.x));assert.ok(Math.abs(v.pilot.goal.x)<86);}
});
test('boat traffic slows for another hull and stops when surrounded by land',()=>{
 const v=boat(0,0);v.vy=-95;const G={surfaceAt:()=> 'water',vehicles:[v,boat(0,-130)]};
 assert.equal(boatPilot(G,v,.2).brake,true);
 const trapped=boat();assert.equal(boatPilot({surfaceAt:()=> 'build',vehicles:[trapped]},trapped,.2).brake,true);
});
test('pedestrians wait for a safe crossing gap even with a permissive light',()=>{
 const p={x:0,y:0,hx:1,hy:0,walk:45},G={ticks:8*60,graph:{nodes:[{x:30,y:0,hw:30,hh:30,sig:true}]},vehicles:[]};
 assert.equal(safeCrossing(G,p),true);
 p._crossAt=0;G.vehicles=[{x:35,y:-100,vx:0,vy:100,rot:Math.PI,def:{},kind:'fare'}];assert.equal(safeCrossing(G,p),false);
 G.vehicles=[];G.ticks=14*60;assert.equal(safeCrossing(G,p),false);
});
test('a fleeing civilian selects an open path around a wall instead of running into it',()=>{
 const G={surfaceAt:(x,y)=>y<-20&&Math.abs(x)<25?'build':'walk',solidAt:()=>false},p={x:0,y:0,rot:0};
 const a=escapeHeading(G,p,{x:0,y:60});assert.ok(Math.abs(Math.sin(a)*42)>25);assert.notEqual(G.surfaceAt(Math.sin(a)*42,-Math.cos(a)*42),'build');
});
