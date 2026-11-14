import {before,test} from 'node:test';
import assert from 'node:assert/strict';
import {harness} from './harness.js';
import {districtAt,WORLD_H} from '../src/world.js';
import {SOUTH,alpineGrip,PEAK_CACHES} from '../src/alpine.js';
let G,T;
before(async()=>{({G,T}=await harness());T.startFreeRide(G);});
test('Crown Peak annex extends the world south with its own collision grid',()=>{
 const A=G.world.alpine;assert.ok(A&&G.world.south);
 assert.equal(G.world.limits.y+G.world.limits.h,WORLD_H+SOUTH);
 assert.equal(G.surfaceAt(9900,10816),'road');        // village street
 assert.equal(G.surfaceAt(9984+150,12800),'road');    // summit plaza
 assert.equal(G.surfaceAt(8330,10800),'lot');         // frozen lake (drivable ice)
 assert.equal(G.surfaceAt(3000,11000),'water');       // southern sound
 assert.equal(districtAt(10150,12900),'CROWN PEAK');assert.equal(districtAt(9900,10800),'FROSTFALL');
 assert.ok(A.chalets.length>=8&&A.pines.length>600&&A.cliffs.length>20);
});
test('the summit is reachable by road from the city network',()=>{
 const g=G.graph,start=g.edges.find(e=>Math.abs(e.A.y-9800)<2&&Math.abs(e.B.y-9800)<2).A;
 const seen=new Set([start]),q=[start];
 while(q.length){const n=q.shift();for(const e of n.edges){const o=e.A===n?e.B:e.A;if(!seen.has(o)){seen.add(o);q.push(o);}}}
 assert.ok([...seen].some(n=>Math.abs(n.x-9984)<20&&Math.abs(n.y-12800)<20),'summit node connected');
});
test('snow and ice reduce grip; caches are placed on reachable ground',()=>{
 assert.equal(alpineGrip(G,5000,2000,'road'),1);
 assert.ok(alpineGrip(G,9900,10816,'road')<1);
 assert.ok(alpineGrip(G,8330,10800,'lot')<alpineGrip(G,9900,10816,'road'));
 for(const c of PEAK_CACHES){const p=G.pickups.find(q=>q.id===`${c.x}:${c.y}`);assert.ok(p,'cache '+c.x);assert.notEqual(G.surfaceAt(p.x,p.y),'build');}
});
