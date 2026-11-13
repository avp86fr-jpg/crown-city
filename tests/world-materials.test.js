import test from 'node:test';
import assert from 'node:assert/strict';
import {surfaceFinishRuns,makeCoreFinish} from '../src/ground_finish.js';
import {windAt,sceneWind} from '../src/wind.js';
import {waterMotionPlan,drawWaterMotion} from '../src/water_motion.js';
import {smokeOrigin} from '../src/world_effects.js';

const context=()=>new Proxy({}, {get:(o,k)=>o[k]||(()=>{}),set:(o,k,v)=>(o[k]=v,true)});
test('surface finishing respects buildings, piers and road paint opacity boundaries',()=>{
 const code=(x,y)=>x<32?3:x<64?7:x<96?2:x<128?1:0,runs=surfaceFinishRuns(code,0,0,256);
 assert.ok(runs.some(r=>r.code===3&&r.shore===2));
 assert.ok(runs.some(r=>r.code===3&&r.shore===0));
 assert.ok(!runs.some(r=>r.code===2||r.code===7));
 for(const r of runs)for(let x=r.x+2;x<r.x+r.w;x+=4)assert.equal(code(x,r.y+2),r.code);
});
test('core texture cache releases old tiles and uses bounded coarse art at flight scale',()=>{
 const previous=globalThis.document;globalThis.document={createElement:()=>({width:256,height:256,getContext:context})};
 try{const finish=makeCoreFinish(()=>0,{asphalt:{}}),c=context();
  for(let y=0;y<16;y++)for(let x=0;x<16;x++){finish.draw(c,{x0:x*256,y0:y*256,x1:x*256+255,y1:y*256+255});assert.ok(finish.cache.size<=48);}
  const keys=[...finish.cache.keys()];for(let i=0;i<12;i++)finish.draw(c,{x0:0,y0:0,x1:4096,y1:4096});assert.deepEqual([...finish.cache.keys()],keys);assert.equal(finish.distant.size,16);
  const old=[...finish.cache.values(),...finish.distant.values()];finish.clear();assert.equal(finish.cache.size,0);assert.equal(finish.distant.size,0);assert.ok(old.every(e=>e.c.width===1));
 }finally{globalThis.document=previous;}
});
test('wave swept footprints cannot cross a thin pier between wet corners',()=>{
 const code=(x,y)=>x>=48&&x<56?7:3,plan=waterMotionPlan(code,0,0);
 assert.ok(plan.waves.length>0);
 for(const p of plan.waves)assert.ok(p.x+48<48||p.x-16>=56);
 assert.equal(plan.shores.length,0,'pier edges must never look like beach surf');
});
test('surf occurs on the wet side of beaches, never on the land',()=>{
 const code=(x,y)=>y<96?3:4,plan=waterMotionPlan(code,0,0);
 assert.ok(plan.shores.length>0);
 for(const s of plan.shores){assert.equal(code(s.x,s.y),3);assert.equal(s.dy,1);assert.ok(s.y<96);}
});
test('water effects stay bounded across a long trip, and respect reduced motion',()=>{
 const G={ctx:context(),codeAt:()=>3,cam:{scale:1},ticks:0,settings:{quality:'low'}};
 for(let i=0;i<180;i++){
  G.ticks+=60;const x=(i%20)*512,y=Math.floor(i/20)*512;
  drawWaterMotion(G,{x0:x,y0:y,x1:x+800,y1:y+390});
  assert.ok(G.waterMotionStats.built<=2);assert.ok(G.waterMotionStats.waves<=64);assert.ok(G.waterMotionStats.shores<=40);assert.ok(G._waterMotion.chunks.size<=80);
 }
 G.settings.reducedMotion=true;G.codeAt=()=>{throw Error('reduced motion must do no geometry work');};drawWaterMotion(G,{x0:0,y0:0,x1:800,y1:390});assert.equal(G.waterMotionStats.waves,0);
});
test('wind is deterministic, bounded and shares a reusable state across effects',()=>{
 for(let t=0;t<1000;t+=.37){const calm=windAt(t),storm=windAt(t,1);assert.ok(calm.x>.3&&calm.x<=1.01);assert.ok(storm.x<=1.81);assert.deepEqual(windAt(t),calm);}
 const G={ticks:150,settings:{reducedMotion:false}},a=sceneWind(G);assert.equal(sceneWind(G),a);G.ticks++;assert.equal(sceneWind(G),a);
 G.settings.reducedMotion=true;const still={...sceneWind(G)};G.ticks+=600;assert.equal(sceneWind(G).x,still.x);assert.equal(sceneWind(G).y,still.y);
});
test('smoke is anchored to a real roof fixture and avoids painted roofs and helipads',()=>{
 for(const kind of ['warehouse','hangar','garage']){const b={kind,w:180,h:110,seed:3},p=smokeOrigin(b);assert.ok(p);assert.ok(p.x>0&&p.x<b.w&&p.y>0&&p.y<b.h);}
 assert.equal(smokeOrigin({core:true,w:150,h:200}),null);
 assert.equal(smokeOrigin({helipad:true,w:150,h:200}),null);
 assert.equal(smokeOrigin({kind:'office',w:150,h:200}),null);
 assert.equal(smokeOrigin({kind:'house',roof:'terra',w:160,h:100,seed:3}).kind,'chimney');
});
