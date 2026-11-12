// Seeded full-game soak: queues include pedestrians, parked cars and collisions.
import {harness} from '../tests/harness.js';
import {worldBodyHit} from '../src/collision.js';
let seed=9921;Math.random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
const {G,T}=await harness();T.startFreeRide(G);const safe=T.findSafe(G,2280,2400,10,true);G.player=T.makeFoot(G,safe.x,safe.y,0);G.cam.x=1964;G.cam.y=2400;G.settings.timeSpeed=0;G.weatherT=1e9;
const stops=new Map();let samples=0,moving=0,long=0,max=0,turnMax=0;const turns=new Map();
for(let i=0;i<240*60;i++){T.tick(G,1/60);if(i%60)continue;for(const v of G.vehicles.filter(v=>v.traffic)){
 const stopped=Math.hypot(v.vx,v.vy)<5,n=stopped?(stops.get(v)||0)+1:0,t=stopped&&v.tr.turn?(turns.get(v)||0)+1:0;stops.set(v,n);turns.set(v,t);max=Math.max(max,n);turnMax=Math.max(turnMax,t);if(i>180*60){samples++;if(!stopped)moving++;if(n>45)long++;}
}}
const jams=G.vehicles.filter(v=>v.traffic&&(stops.get(v)||0)>25).map(v=>({kind:v.kind,x:Math.round(v.x),y:Math.round(v.y),stop:stops.get(v),s:Math.round(v.tr.s),len:Math.round(v.tr.e.len),reserved:v.tr.reserved,release:v.tr.releaseAt,turn:!!v.tr.turn,static:worldBodyHit(G,v,v.x,v.y),near:G.vehicles.filter(o=>o!==v&&Math.hypot(o.x-v.x,o.y-v.y)<230).map(o=>({kind:o.kind,x:Math.round(o.x),y:Math.round(o.y),speed:o.tr?.spd,traffic:o.traffic,parked:o.parked})),peds:G.peds.filter(p=>!p.dead&&Math.hypot(p.x-v.x,p.y-v.y)<100).map(p=>({x:p.x,y:p.y,cross:p.crossing,onRoad:p.onRoad}))}));
console.log(JSON.stringify({moving:moving/samples,longWait:long/samples,maxStop:max,maxTurnStop:turnMax,jams},null,2));
