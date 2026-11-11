import {test} from 'node:test';
import assert from 'node:assert/strict';
import {harness} from './harness.js';
import {bodyContact,bodySize,worldBodyHit} from '../src/collision.js';

const {G,T}=await harness(),W=G.world;
const overlaps=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
const roadRect=s=>s.v?{x:s.c-s.w/2,y:s.a,w:s.w,h:s.b-s.a}:{x:s.a,y:s.c-s.w/2,w:s.b-s.a,h:s.w};

test('planned outer buildings never overlap another building or an active roadway',()=>{
 assert.ok(W.buildings.length>450,'retain a substantial city');
 for(let i=0;i<W.buildings.length;i++){
  const b=W.buildings[i];
  for(let j=i+1;j<W.buildings.length;j++)assert.ok(!overlaps(b,W.buildings[j]),`overlapping buildings ${b.x},${b.y} and ${W.buildings[j].x},${W.buildings[j].y}`);
  for(const s of W.roads)assert.ok(!overlaps(b,roadRect(s)),`building ${b.x},${b.y} obstructs road ${s.c}`);
 }
});

test('marked occupied bays fit complete car hulls and preserve empty spaces and moving lanes',()=>{
 assert.ok(W.parking.length>=70,'retain useful off-street parking across the city');
 assert.ok(W.parkingPlan.bays>W.parking.length,'leave free spaces');
 const cars=W.parking.map(p=>{
  assert.ok(p.planned);const l=W.lots[p.lot];
  assert.ok(l.bays.some(b=>b.occupied&&b.x===p.x&&b.y===p.y&&b.rot===p.rot),'car must match its painted bay');
  const v=T.makeVeh('riot',p.x,p.y,p.rot),size=bodySize(v);
  assert.ok(p.w>=size.w*2&&p.l>=size.l*2);
  assert.equal(worldBodyHit(G,v,v.x,v.y),null);
  const c=Math.cos(v.rot),s=Math.sin(v.rot);
  for(const a of [-1,0,1])for(const b of [-1,0,1])assert.equal(G.surfaceAt(v.x+a*size.w*c-b*size.l*s,v.y+a*size.w*s+b*size.l*c),'lot','whole hull must be off the road');
  return v;
 });
 for(let i=0;i<cars.length;i++)for(let j=i+1;j<cars.length;j++)assert.equal(bodyContact(cars[i],cars[j]),null);
});

test('occupied courts have vehicle-wide connected driveways with no hidden wall or tree',()=>{
 for(const l of W.lots){
  if(!l.bays?.some(b=>b.occupied))continue;
  assert.ok(l.entry&&l.aisle&&l.driveways.length===2);
  assert.ok(['road','lot','walk'].includes(G.surfaceAt(l.entry.x,l.entry.y)),`entry ${l.entry.x},${l.entry.y}`);
  for(const r of l.driveways){
   const vertical=r.h>r.w,cx=r.x+r.w/2,cy=r.y+r.h/2,from=vertical?r.y+48:r.x+48,to=vertical?r.y+r.h-48:r.x+r.w-48;
   for(let p=from;p<=to;p+=8){const x=vertical?cx:p,y=vertical?p:cy,v=T.makeVeh('riot',x,y,vertical?0:Math.PI/2);assert.equal(worldBodyHit(G,v,x,y),null,`blocked driveway ${x},${y}`);}
   for(const t of W.trees)assert.ok(!overlaps({x:t.x-t.r,y:t.y-t.r,w:t.r*2,h:t.r*2},r),'tree covers driveway');
  }
 }
});

test('core arterials join the expanded city and casino roads finish at surrounding junctions',()=>{
 for(const y of [1600,2620]){
  assert.ok(W.roads.some(s=>!s.v&&s.c===y&&s.a<=3720&&s.b>=4700));
  for(let x=3720;x<=4700;x+=16)assert.equal(G.surfaceAt(x,y),'road');
 }
 assert.ok(W.roads.some(s=>s.v&&s.c===1964&&s.a<=3820&&s.b>=4700));
 for(let y=3820;y<=4200;y+=16)assert.equal(G.surfaceAt(1964,y),'road');
 const casino={x:7540,y:2820,w:1420,h:770};
 for(const s of W.roads)assert.ok(!overlaps(roadRect(s),casino),'through-road crosses casino terrace');
 for(const s of W.roads.filter(s=>s.v&&s.c>7540&&s.c<8960))assert.ok(s.b<=2620||s.a>=3900,'casino spur ends outside a junction');
});

test('public greens keep tree canopies clear of basins and new destinations retain accessible frontage',()=>{
 for(const f of W.features.filter(f=>f.k==='fountain'||f.k==='pond'))for(const t of W.trees)assert.ok(Math.hypot(t.x-f.x,t.y-f.y)>=f.r*1.2+t.r+12);
 assert.ok(W.features.filter(f=>f.k==='plaza').length>W.features.filter(f=>f.k==='fountain').length,'civic squares should have variety');
 for(const [x,y] of [[11780,4660],[12020,4660],[7900,8500],[8350,8500]])assert.ok(T.footClear(G,x,y,8),`destination frontage ${x},${y}`);
 for(const name of ['CROWN AIR / ARRIVALS','PINEWATCH / VILLAGE'])assert.ok(W.lots.find(l=>l.name===name)?.bays.length>0,name);
});

test('terminal and village pedestrian approaches are reserved outside every marked parking space',()=>{
 const lots=W.lots.filter(l=>l.walkways?.length);assert.equal(lots.length,2);
 for(const l of lots)for(const r of l.walkways){
  for(const b of l.bays)assert.ok(!overlaps(r,{x:b.x-b.w/2,y:b.y-b.l/2,w:b.w,h:b.l}),`${l.name}: marked bay obstructs pedestrian approach`);
  for(let y=r.y+8;y<r.y+r.h-8;y+=8)assert.ok(T.footClear(G,r.x+r.w/2,y,8),`${l.name}: pedestrian approach blocked`);
 }
 const terminal=lots.find(l=>l.name==='CROWN AIR / ARRIVALS');assert.equal(terminal.walkways[0].x+terminal.walkways[0].w/2,8252);
 assert.ok(!terminal.bays.some(b=>b.x===8252),'former empty space becomes a permanent walkway');
});
