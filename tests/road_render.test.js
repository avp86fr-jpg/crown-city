import {test} from 'node:test';
import assert from 'node:assert/strict';
import {junctionApproaches,drawIntersection,drawLot,makeBuildings} from '../src/render_world.js';
import {harness} from './harness.js';
function junction(start=0,med=0){
 const vs={v:true,c:500,a:start,b:1000,w:200,lanes:2,med,k:'boulevard'},hs={v:false,c:500,a:0,b:1000,w:200,lanes:2,med,k:'boulevard'};
 return {W:{roads:[vs,hs]},n:{x:500,y:500,vs,hs}};
}
function recorder(){
 const fills=[],paths=[],state={fillStyle:'',strokeStyle:''};let path=[];
 return {fills,paths,ctx:new Proxy(state,{get(t,k){if(k in t)return t[k];if(k==='fillRect')return (x,y,w,h)=>fills.push({x,y,w,h,color:t.fillStyle});if(k==='beginPath')return ()=>path=[];if(k==='moveTo'||k==='lineTo')return (x,y)=>path.push([x,y]);if(k==='stroke')return ()=>paths.push({points:path.slice(),color:t.strokeStyle});return ()=>{};}})};
}
test('T junctions mark only connected approaches, including collinear split roads',()=>{
 const {W,n}=junction(500);let arms=junctionApproaches(W,n);assert.equal(arms.length,3);assert.ok(!arms.some(a=>a.v&&a.side<0));
 W.roads.push({...n.vs,a:0,b:500});arms=junctionApproaches(W,n);assert.equal(arms.length,4);
 const r=recorder();W.roads.pop();drawIntersection(r.ctx,W,n,{asphalt:'#road'});
 assert.ok(!r.fills.some(p=>p.color==='rgba(238,235,220,.8)'&&p.y<400));
 assert.ok(r.paths.some(p=>JSON.stringify(p.points)===JSON.stringify([[400,400],[600,400]])),'closed northern kerb must remain continuous');
});
test('divided junction paint leaves median refuges clear and puts stop lines across incoming lanes',()=>{
 const {W,n}=junction(0,40),r=recorder();drawIntersection(r.ctx,W,n,{asphalt:'#road'});
 const stripes=r.fills.filter(p=>p.color==='rgba(238,235,220,.8)');assert.ok(stripes.length>10);
 for(const p of stripes){if(p.h===18)assert.ok(p.x+p.w<=477||p.x>=523);else assert.ok(p.y+p.h<=477||p.y>=523);}
 const lines=r.fills.filter(p=>p.color==='rgba(239,235,220,.85)');assert.equal(lines.length,4);
 assert.ok(lines.find(p=>p.y<400&&p.h===4).x<480);assert.ok(lines.find(p=>p.y>600&&p.h===4).x>520);
 assert.ok(lines.find(p=>p.x<400&&p.w===4).y>520);assert.ok(lines.find(p=>p.x>600&&p.w===4).y<480);
});
test('planned parking paints exactly its supplied full-size bays and no phantom spaces',()=>{
 const r=recorder();drawLot(r.ctx,{x:0,y:0,w:500,h:500,k:'parking',bays:[]});assert.equal(r.paths.length,0);
 drawLot(r.ctx,{x:0,y:0,w:500,h:500,k:'parking',bays:[{x:100,y:100,rot:0,w:64,l:120},{x:200,y:100,rot:Math.PI,w:64,l:120}]});
 assert.equal(r.paths.length,2);assert.deepEqual(r.paths[0].points,[[-32,60],[-32,-60],[32,-60],[32,60]]);
});
test('procedural roofs stay within one curb width of their ground footprint while core roofs stay fixed',async()=>{
 const {G}=await harness();const b={x:5000,y:2000,w:180,h:220,hgt:240,roof:'gravel',wall:'grey',kind:'office'},world={buildings:[b],coreBuildings:[],trees:[],WALLS:G.world.WALLS};
 const renderer=makeBuildings(world,G.assets.tex,null),ctx=G.ctx,original=ctx.drawImage;let drawn=[];ctx.drawImage=(...a)=>drawn.push(a);
 try{for(const cam of [{x:6000,y:3000,scale:1},{x:4200,y:1000,scale:2},{x:5100,y:2110,scale:1}]){
  drawn=[];renderer.draw(ctx,cam,{x0:4900,y0:1900,x1:5300,y1:2400},0,{x:0,y:-1},{low:false});assert.equal(drawn.length,1);
  const [,x,y,w,h]=drawn[0];assert.ok(Math.abs(x-b.x)<=24);assert.ok(Math.abs(y-b.y)<=24);assert.ok(Math.abs(x+w-b.x-b.w)<=24);assert.ok(Math.abs(y+h-b.y-b.h)<=24);
 }
 b.core=true;drawn=[];renderer.draw(ctx,{x:6000,y:3000,scale:1},{x0:4900,y0:1900,x1:5300,y1:2400},0,{x:0,y:-1},{low:false});assert.deepEqual(drawn[0].slice(1),[b.x,b.y,b.w,b.h]);
 }finally{ctx.drawImage=original;}
});
