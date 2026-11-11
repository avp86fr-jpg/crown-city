import {test} from 'node:test';
import assert from 'node:assert/strict';
import {harness} from './harness.js';
import {bodySize,worldBodyHit} from '../src/collision.js';
import {worldBoundaryContact,clampWorldBody,drawBoundaryBackdrop} from '../src/world_limits.js';
import {drawBridgeMarkings} from '../src/expansion_world.js';
import {aircraftClearance} from '../src/aviation.js';
const {G,T}=await harness(),E=G.world.expansion;

test('the canal opens into visible river water with no dry bank beneath a passing hull',()=>{
 const v=T.makeVeh('gulf',6968,6700,Math.PI/2);
 for(let x=6760;x<=7176;x+=8){v.x=x;assert.equal(G.surfaceAt(x,v.y),'water');assert.equal(G.world.boatSurfaceAt(x,v.y),'water');assert.equal(worldBodyHit(G,v,x,v.y),null);}
 assert.equal(G.world.boatSurfaceAt(6968,6800),null,'southern land must not be classified as canal');
 v.x=6968;v.y=6800;assert.ok(worldBodyHit(G,v,v.x,v.y),'riverbank must stop the whole boat');
});
test('every canal bridge has continuous pedestrian verges and a separate navigable boat layer',()=>{
 const c=E.canal,boat=T.makeVeh('gulf',6968,0,Math.PI);
 for(const b of E.bridges){
  for(const y of [b.y+16,b.y+b.h-16])for(let x=c.x-16;x<c.x+c.w+16;x+=8)assert.equal(G.surfaceAt(x,y),'walk',`bridge sidewalk ${x},${y}`);
  boat.y=b.y+b.h/2;assert.equal(G.surfaceAt(boat.x,boat.y),'road');assert.equal(worldBodyHit(G,boat,boat.x,boat.y),null);
 }
 assert.equal(E.overpasses.length,E.bridges.length+E.riverBridges.length);
 for(const b of E.overpasses){const v=T.makeVeh('plane',b.x+b.w/2,b.y+b.h/2,0);assert.ok(aircraftClearance(G,v)>=b.clearance,'aircraft must clear the bridge deck');}
});
test('dock colliders match their painted piers while both launch sizes fit the berth',()=>{
 for(const d of E.docks){
  for(const kind of ['wake','gulf']){const v=T.makeVeh(kind,d.boatX,d.boatY,Math.PI);assert.equal(worldBodyHit(G,v,v.x,v.y),null,kind+' '+d.id);}
  const pier=E.dockPiers.find(p=>p.id===d.id),x=pier.side<0?pier.x+pier.w-3:pier.x+3;
  assert.equal(G.world.boatSurfaceAt(x,pier.y+32),'pier');
  assert.equal(G.world.boatSurfaceAt(x,pier.y-1),'canal');
 }
});
test('whole rotated bodies remain inside the world and receive inward boundary normals',()=>{
 const bounds=G.world.limits;
 for(const kind of ['riot','bus','stitch','wake','gulf','plane','heli'])for(const rot of [0,.3,Math.PI/4,Math.PI/2]){
  const v=T.makeVeh(kind,0,0,rot),body=bodySize(v);
  for(const [x,y,nx,ny] of [[-20,500,1,0],[bounds.w+20,500,-1,0],[500,-20,0,1],[500,bounds.h+20,0,-1]]){
   const hit=worldBoundaryContact(bounds,v,x,y,body);assert.ok(hit?.boundary);assert.equal(hit.nx,nx);assert.equal(hit.ny,ny);
   const p=clampWorldBody(bounds,v,x,y,body);assert.equal(worldBoundaryContact(bounds,v,p.x,p.y,body),null,kind+' '+rot);
  }
  assert.equal(worldBoundaryContact(bounds,v,5000,5000,body),null);
 }
});
test('county gateway signs leave roads, contacts and pads open',()=>{
 const signs=E.decor.filter(p=>p.kind==='limit-sign');assert.equal(signs.length,4);
 for(const p of signs){assert.notEqual(G.surfaceAt(p.x,p.y),'road');for(const x of [p.x-70,p.x+70])assert.notEqual(G.surfaceAt(x,p.y),'road');}
 for(const p of E.contacts)assert.ok(T.footClear(G,p.x,p.y,8));
 for(const p of E.helipads)assert.equal(G.surfaceAt(p.x,p.y),'lot');
});
test('bridge lane paint keeps the crossing road width, median and lane centres',()=>{
 for(const b of E.overpasses){
  const centre=b.vertical?b.x+b.w/2:b.y+b.h/2,s=G.world.roads.find(s=>!!s.v===!!b.vertical&&Math.abs(s.c-centre)<.01&&s.a<=(b.vertical?b.y:b.x)&&s.b>=(b.vertical?b.y+b.h:b.x+b.w));
  assert.ok(s);assert.equal(b.lanes,s.lanes);assert.equal(b.med,s.med);assert.equal(b.roadWidth,s.w);
  const lines=[],fills=[];let points=[],dash=[];
  const c={beginPath(){points=[];},moveTo(x,y){points.push([x,y]);},lineTo(x,y){points.push([x,y]);},setLineDash(d){dash=d;},stroke(){lines.push({points,color:this.strokeStyle,dash,offset:this.lineDashOffset});},fillRect(...r){fills.push(r);}};
  drawBridgeMarkings(c,b);
  const yellow=lines.filter(l=>l.color==='#e8b830'),laneLines=lines.filter(l=>l.dash.length);
  assert.equal(yellow.length,b.med>0?0:b.lanes>1||b.roadKind==='street'||b.roadKind==='frontier'?2:0);
  assert.equal(laneLines.length,2*(b.lanes-1));assert.equal(fills.length,b.med>0?2:0);
  const laneWidth=(s.w/2-s.med/2)/s.lanes;
  for(const line of laneLines){const offset=Math.abs(line.points[0][b.vertical?0:1]-centre);assert.ok(Math.abs((offset-s.med/2)/laneWidth-Math.round((offset-s.med/2)/laneWidth))<1e-7);assert.deepEqual(line.dash,[22,26]);}
  assert.ok(lines.length<=2*b.lanes+4);assert.equal(c.lineDashOffset,0);
 }
});
test('edge vistas reuse cached art, preserve the river and cap warmed draw work',()=>{
 const vista={world:{river:G.world.river,sceneryAtlas:G.world.sceneryAtlas},assets:G.assets,_boundaryTint:'rgb(71,84,124)'},b=G.world.limits;
 let fills=0,patterns=0;const c={save(){},restore(){},fillRect(){fills++;},createPattern(){patterns++;return {};}};
 const edge={x0:b.w-200,x1:b.w+500,y0:4400,y1:4900};
 drawBoundaryBackdrop(c,b,edge,vista);assert.equal(patterns,1);assert.equal(fills,2);
 const forest=vista.world._boundaryVista.patterns.forest;fills=0;
 for(let frame=0;frame<20;frame++)drawBoundaryBackdrop(c,b,edge,vista);
 assert.equal(patterns,1,'the panorama must not be rebuilt every frame');assert.equal(fills,40);assert.equal(vista.world._boundaryVista.patterns.forest,forest);
 drawBoundaryBackdrop(c,b,{x0:b.w-100,x1:b.w+300,y0:6620,y1:6780},vista);assert.ok(vista.world._boundaryVista.patterns.water,'the river continues beyond the border');
 fills=0;drawBoundaryBackdrop(c,b,{x0:100,x1:1000,y0:100,y1:1000},vista);assert.equal(fills,0,'interior views do no backdrop work');
 fills=0;drawBoundaryBackdrop(c,b,{x0:-500,x1:b.w+500,y0:-500,y1:b.h+500},vista);assert.ok(fills<=26,'even a complete world view has bounded drawing work');
});
