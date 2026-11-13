import test from 'node:test';
import assert from 'node:assert/strict';
import {harness} from './harness.js';
import {safeStreetFootprint,fixtureBounds,streetItemsInView,indexStreetItems,FIXTURE_SIZES,frontageSprite} from '../src/street_design.js';
import {roofDetailPlan} from '../src/architecture_art.js';

test('wide scenery rejects roads, parking aisles and shoreline strips through its interior',()=>{
 const footprint={x:10,y:10,w:88,h:64};
 for(const blocked of ['road','lot','water','canal','build']){
  const G={surfaceAt:(x,y)=>x>45&&x<58?blocked:'walk',solidAt:()=>false};
  assert.equal(safeStreetFootprint(G,footprint),false,blocked);
 }
 assert.equal(safeStreetFootprint({surfaceAt:()=> 'walk',solidAt:()=>false},footprint),true);
 assert.equal(safeStreetFootprint({surfaceAt:()=> 'walk',solidAt:(x,y)=>x>45&&x<58},footprint),false);
});

test('rotated bus shelters use their actual long dimension for street clearance',()=>{
 const a=fixtureBounds({kind:2,x:200,y:300,rot:0}),b=fixtureBounds({kind:2,x:200,y:300,rot:Math.PI/2});
 assert.equal(a.w,FIXTURE_SIZES[2][0]);assert.ok(Math.abs(b.h-a.w)<1e-9);assert.ok(Math.abs(b.w-a.h)<1e-9);
});

test('authored street placements fit playable paving without overlapping each other or storefronts',async()=>{
 const {G}=await harness(),fixtures=G.street.fixtures.filter(p=>!p.hidden),frontages=G.street.frontages;
 assert.ok(fixtures.length>=35);assert.ok(frontages.length>=100);assert.ok(fixtures.some(p=>p.name==='PUBLIC / PROMENADE'&&p.kind===0));
 for(const p of [...fixtures,...frontages])assert.equal(safeStreetFootprint(G,p.bounds),true,`${p.kind??p.category}: ${p.x},${p.y}`);
 const boxes=[...fixtures,...frontages].map(p=>p.bounds);
 for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){
  const a=boxes[i],b=boxes[j];assert.ok(!(a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y),'overlapping furniture / entrance');
 }
});

test('spatial street queries include boundary objects once and exclude distant streets',()=>{
 const fixtures=[{x:249,y:256},{x:257,y:250},{x:5000,y:6000}];
 const street={fixtureBins:indexStreetItems(fixtures)},found=[...streetItemsInView(street,{x0:220,y0:220,x1:280,y1:280},'fixtureBins',0)];
 assert.equal(found.length,2);assert.equal(new Set(found).size,2);assert.ok(!found.includes(fixtures[2]));
});

test('roof furniture stays inside roofs, keeps equipment separate and uses stable cached plans',()=>{
 const overlaps=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
 for(const kind of ['house','apt','office','shop','garage','hangar'])for(const [w,h] of [[50,48],[93,77],[128,111],[190,138],[420,180]]){
  const b={kind,w,h,roof:'metal',seed:137},plan=roofDetailPlan(b),items=[...plan.fans,...plan.solar,...plan.skylights,...(plan.terrace?[plan.terrace]:[]),...(plan.access?[plan.access]:[])];
  assert.equal(roofDetailPlan(b),plan);
  for(const a of items)assert.ok(a.x>=0&&a.y>=0&&a.x+a.w<=w&&a.y+a.h<=h,`${kind} ${w}x${h}`);
  for(let i=0;i<items.length;i++)for(let j=i+1;j<items.length;j++)assert.ok(!overlaps(items[i],items[j]),`${kind} equipment collision ${w}x${h}`);
 }
 const helipad=roofDetailPlan({w:240,h:240,roof:'metal',kind:'office',helipad:true});assert.equal(helipad.fans.length+helipad.solar.length,0);assert.equal(helipad.terrace,null);
});

test('frontage sprites share a bounded style cache rather than allocating per building',async()=>{
 const {G}=await harness();for(const p of G.street.frontages)frontageSprite(G.street,p);const first=[...G.street.frontageCache.values()];
 assert.ok(first.length<=32);for(const p of G.street.frontages)frontageSprite(G.street,p);assert.deepEqual([...G.street.frontageCache.values()],first);
});
