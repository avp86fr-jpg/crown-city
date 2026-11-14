// Whole-map geometry audit using the shipped collision mask, not mocked terrain.
import fs from 'node:fs';
import {harness} from '../tests/harness.js';
import {worldBodyHit,bodyContact} from '../src/collision.js';
import {edgePoint,trimAt} from '../src/traffic.js';
import {roadCoherence} from './road-coherence.mjs';
import {roadEnds} from '../src/open_world.js';
import {WORLD_W,WORLD_H} from '../src/world.js';
let seed=77123;Math.random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
const {G,T}=await harness();T.startFreeRide(G);
const report={roads:[],surfaces:[],parked:[],overlaps:[],counts:{edges:G.graph.edges.length,vehicles:G.vehicles.length,hullSamples:0}};
for(const e of G.graph.edges)for(const fwd of [true,false])for(let lane=0;lane<e.lanes;lane++){
 const start=trimAt(fwd?e.A:e.B,e)+45,end=e.len-trimAt(fwd?e.B:e.A,e)-45;
 for(const kind of ['dart','bus']){
  if(kind==='bus'&&(e.w-e.med)/(2*e.lanes)<58)continue;
  let samples=0,hits=0,first;
  for(let s=start;s<=end;s+=24){const p=edgePoint(e,fwd,s,lane),v=T.makeVeh(kind,p.x,p.y,p.rot);samples++;if(kind==='dart'&&['build','water','canal'].includes(G.surfaceAt(p.x,p.y)))report.surfaces.push({edge:e.id,x:p.x,y:p.y,surface:G.surfaceAt(p.x,p.y)});const hit=worldBodyHit(G,v,v.x,v.y);if(hit){hits++;first||={x:p.x,y:p.y,hit};}}
  report.counts.hullSamples+=samples;
  if(hits)report.roads.push({edge:e.id,a:[e.A.x,e.A.y],b:[e.B.x,e.B.y],width:e.w,fwd,lane,kind,samples,hits,first});
 }
}
for(const v of G.vehicles){if(!v.def.aircraft){const hit=worldBodyHit(G,v,v.x,v.y);if(hit)report.parked.push({kind:v.kind,x:v.x,y:v.y,rot:v.rot,hit,mission:v.mission});}}
for(let a=0;a<G.vehicles.length;a++)for(let b=a+1;b<G.vehicles.length;b++){
 const A=G.vehicles[a],B=G.vehicles[b];if(Math.abs(A.x-B.x)>160||Math.abs(A.y-B.y)>160||!!A.def.boat!==!!B.def.boat)continue;
 const c=bodyContact(A,B);if(c?.pen>1)report.overlaps.push({a:{kind:A.kind,x:A.x,y:A.y},b:{kind:B.kind,x:B.x,y:B.y},pen:c.pen});
}
// Road-network coherence: dead ends, joins, signals, unjoined crossings, paving gaps.
const coh=roadCoherence(G,{W:WORLD_W,H:WORLD_H},roadEnds(G));report.coherence=coh;
fs.mkdirSync('.qa/sustained',{recursive:true});fs.writeFileSync('.qa/sustained/map-audit.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
// Hard failures: uncapped dead ends, edges crossing without a junction, gaps in the paving.
// Lane-count joins and unsignalled junctions are reported as warnings.
if(coh.stats.uncapped||coh.crossings.length||coh.offRoad.length||report.roads.length||report.surfaces.length||report.parked.length||report.overlaps.length)process.exitCode=1;
