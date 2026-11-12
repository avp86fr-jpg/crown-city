import {stepPedestrian,pedestrianClear} from './pedestrian_motion.js';
import {trafficDemand,spawnWeight,trafficFlowBudget} from './street_population.js';
import {bodySize,bodyContact,circleBody,worldBodyHit} from './collision.js';
/* Road graph, lane-following traffic with turns + lights, ambient pedestrians, nav field for cops. */
import { CORE, WORLD_W, WORLD_H } from "./world.js";
const TAU = Math.PI * 2;
const EMPTY=[],CARDINAL=[[1,0],[-1,0],[0,1],[0,-1]],FOOT_SAFE=new Set(['walk','lot','grass','dirt','sand','pier']),bodyRadii=new WeakMap();
function bodyRadius(v){const b=bodySize(v);let r=bodyRadii.get(b);if(r===undefined){r=Math.hypot(b.w,b.l);bodyRadii.set(b,r);}return r;}
function bodiesNear(a,b,r=bodyRadius(a)){const dx=a.x-b.x,dy=a.y-b.y,extent=r+bodyRadius(b);return dx*dx+dy*dy<=extent*extent;}
// Population placement uses the visible world, independent of display pixel density.
export function streetViewport(G){
 const w=G.cssW||G.canvas.width/(G.dpr||1),h=G.cssH||G.canvas.height/(G.dpr||1);
 const scale=(G.cam.scale||1)*Math.sqrt(w*h/(1280*720))*(Math.min(w,h)<520?1.12:1)*(G.zoomMul||1);
 return {halfW:w/2/scale,halfH:h/2/scale};
}
function visibleSpawn(G,x,y){
 if(!G.ticks)return false;
 const {halfW,halfH}=streetViewport(G),angle=-(G.cam.rot||0),dx=x-G.cam.x,dy=y-G.cam.y;
 return Math.abs(dx*Math.cos(angle)-dy*Math.sin(angle))<halfW+35&&Math.abs(dx*Math.sin(angle)+dy*Math.cos(angle))<halfH+35;
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;

export function buildGraph(W, meta) {
  const segs = [];
  for (const s of W.roads) {
    const a = s.v ? [s.c, s.a] : [s.a, s.c], b = s.v ? [s.c, s.b] : [s.b, s.c];
    segs.push({ a, b, w: s.w, lanes: Math.min(s.lanes,Math.max(1,Math.floor((s.w-s.med)/100))), med: s.med, k: s.k });
  }
  for (const r of meta.roads || []) {
    if (r.k === "track") continue;
    const lanes = r.k === "strip" ? 3 : r.w >= 200 ? 2 : 1;
    const med = r.k === "strip" ? 72 : 0;
    segs.push({ a: r.a.slice(), b: r.b.slice(), w: r.w, lanes, med, k: r.k });
  }
  const nodes = [], nmap = new Map(), edgeKeys=new Set();
  const nodeAt = (x, y) => {
    const k = Math.round(x / 6) + "," + Math.round(y / 6);
    let n = nmap.get(k);
    if (!n) {
      for (const m of nodes) if (Math.abs(m.x - x) < 14 && Math.abs(m.y - y) < 14) { n = m; break; }
      if (!n) { n = { x, y, edges: [], id: nodes.length, hw: 0, hh: 0, sig: false }; nodes.push(n); }
      nmap.set(k, n);
    }
    return n;
  };
  const isV = (s) => Math.abs(s.a[0] - s.b[0]) < 1;
  const isH = (s) => Math.abs(s.a[1] - s.b[1]) < 1;
  for (const s of segs) {
    const pts = [s.a, s.b];
    for (const o of segs) {
      if (o === s) continue;
      if (isV(s) && isH(o)) {
        const x = s.a[0], y = o.a[1];
        if (y > Math.min(s.a[1], s.b[1]) + 1 && y < Math.max(s.a[1], s.b[1]) - 1 && x >= Math.min(o.a[0], o.b[0]) - 1 && x <= Math.max(o.a[0], o.b[0]) + 1) pts.push([x, y]);
      } else if (isH(s) && isV(o)) {
        const y = s.a[1], x = o.a[0];
        if (x > Math.min(s.a[0], s.b[0]) + 1 && x < Math.max(s.a[0], s.b[0]) - 1 && y >= Math.min(o.a[1], o.b[1]) - 1 && y <= Math.max(o.a[1], o.b[1]) + 1) pts.push([x, y]);
      }
      // endpoint of o lying on s (T junctions)
      for (const e of [o.a, o.b]) {
        if (isV(s) && Math.abs(e[0] - s.a[0]) < 2 && e[1] > Math.min(s.a[1], s.b[1]) + 1 && e[1] < Math.max(s.a[1], s.b[1]) - 1) pts.push([s.a[0], e[1]]);
        if (isH(s) && Math.abs(e[1] - s.a[1]) < 2 && e[0] > Math.min(s.a[0], s.b[0]) + 1 && e[0] < Math.max(s.a[0], s.b[0]) - 1) pts.push([e[0], s.a[1]]);
      }
    }
    const dx = s.b[0] - s.a[0], dy = s.b[1] - s.a[1], L = Math.hypot(dx, dy) || 1;
    pts.sort((p, q) => ((p[0] - s.a[0]) * dx + (p[1] - s.a[1]) * dy) - ((q[0] - s.a[0]) * dx + (q[1] - s.a[1]) * dy));
    const ns = pts.map((p) => nodeAt(p[0], p[1]));
    for (const n of ns) { if (isV(s)) n.hw = Math.max(n.hw, s.w / 2); else if (isH(s)) n.hh = Math.max(n.hh, s.w / 2); else { n.hw = Math.max(n.hw, s.w / 3); n.hh = Math.max(n.hh, s.w / 3); } }
    for (let i = 0; i < ns.length - 1; i++) {
      const A = ns[i], B = ns[i + 1];
      if (A === B) continue;
      const len = Math.hypot(B.x - A.x, B.y - A.y);
      if (len < 20) continue;
      const edgeKey=A.id<B.id?A.id+":"+B.id:B.id+":"+A.id;
      if(edgeKeys.has(edgeKey))continue;edgeKeys.add(edgeKey);
      const e = { A, B, len, dx: (B.x - A.x) / len, dy: (B.y - A.y) / len, w: s.w, lanes: Math.min(s.lanes,Math.max(1,Math.floor((s.w-s.med)/100))), med: s.med, k: s.k, id: 0 };
      A.edges.push(e); B.edges.push(e);
    }
  }
  // A painted road ending just short of a wider continuation used to create
  // 80–120 px connector edges. Their junction trims overlapped, placing a car
  // past the next stop line before it could reserve that junction. Collapse
  // these collinear seams; use a lane corridor that fits both road widths.
  let merged=true;
  while(merged){merged=false;
    for(const n of nodes){
      if(n.edges.length!==2)continue;const [a,b]=n.edges;
      const A=a.A===n?a.B:a.A,B=b.A===n?b.B:b.A;
      const ax=A.x-n.x,ay=A.y-n.y,bx=B.x-n.x,by=B.y-n.y;
      if(ax*bx+ay*by>=0||Math.abs(ax*by-ay*bx)>a.len*b.len*.001||Math.min(a.len,b.len)>320)continue;
      const w=Math.min(a.w,b.w),med=Math.max(a.med,b.med),lanes=Math.max(1,Math.min(a.lanes,b.lanes,Math.floor((w-med)/100)));
      const len=Math.hypot(B.x-A.x,B.y-A.y),e={A,B,len,dx:(B.x-A.x)/len,dy:(B.y-A.y)/len,w,med,lanes,k:a.len>b.len?a.k:b.k,id:0};
      A.edges=A.edges.filter(o=>o!==a);B.edges=B.edges.filter(o=>o!==b);n.edges=[];A.edges.push(e);B.edges.push(e);merged=true;
    }
  }
  // A car cannot turn around on a tiny decorative spur or fit between two
  // adjacent junctions. Keep the road playable, but omit those dead-end spurs
  // from ambient routing and reserve close junctions as one continuous zone.
  let pruned=true;while(pruned){pruned=false;for(const n of nodes){if(n.edges.length!==1)continue;const e=n.edges[0],other=e.A===n?e.B:e.A;
    if(other.edges.length>1&&e.len<trimAt(other,e)+170){other.edges=other.edges.filter(o=>o!==e);n.edges=[];pruned=true;}
  }}
  const roots=new Map(nodes.map(n=>[n,n]));const root=n=>{while(roots.get(n)!==n)n=roots.get(n);return n;};
  for(const n of nodes)for(const e of n.edges)if(e.A.edges.length>1&&e.B.edges.length>1&&e.len<trimAt(e.A,e)+trimAt(e.B,e)+150)roots.set(root(e.A),root(e.B));
  const sizes=new Map();for(const n of nodes){const r=root(n);sizes.set(r,(sizes.get(r)||0)+1);}
  for(const n of nodes){const r=root(n);n.zone=r.id;n.zoneSize=sizes.get(r);}
  const edges = [];
  for (const n of nodes) for (const e of n.edges) if (!edges.includes(e)) { e.id = edges.length; edges.push(e); }
  // signals
  const sigs = (meta.signals || []).concat(W.signals || []);
  for (const s of sigs) {
    let best = null, bd = 60;
    for (const n of nodes) { const d = Math.hypot(n.x - s.x, n.y - s.y); if (d < bd) { bd = d; best = n; } }
    if (best && best.edges.length >= 3) best.sig = true;
  }
  return { nodes:nodes.filter(n=>n.edges.length), edges };
}

export function laneOff(e, lane) {
  const laneW = (e.w / 2 - e.med / 2) / e.lanes;
  return e.med / 2 + laneW * (lane + 0.5);
}
// point on edge travelling forward (A->B) or backward, at distance s from the start node
export function edgePoint(e, fwd, s, lane) {
  const dx = fwd ? e.dx : -e.dx, dy = fwd ? e.dy : -e.dy;
  const S = fwd ? e.A : e.B;
  const off = laneOff(e, lane);
  return { x: S.x + dx * s + (-dy) * off, y: S.y + dy * s + dx * off, rot: Math.atan2(dx, -dy), dx, dy };
}
function laneTransition(n){
  return n.edges.length===2&&(n.edges[0].w!==n.edges[1].w||n.edges[0].lanes!==n.edges[1].lanes||n.edges[0].med!==n.edges[1].med);
}
export function trimAt(n, e) {
  if (n.edges.length <= 1) return 110;
  const horizontal = Math.abs(e.dx) > Math.abs(e.dy);
  return Math.max(horizontal?n.hw:n.hh,laneTransition(n)?128:0)+8;
}
export function signalPhase(ticks,ns){
  const phase=((ticks/60)%16+16)%16;
  return ns?(phase<6.6?0:phase<8?1:2):(phase<8?2:phase<14.6?0:1);
}
export function lightGreen(G, n, e) {
  if (!n.sig) return true;
  const ns = Math.abs(e.dy) > Math.abs(e.dx);
  return signalPhase(G.ticks,ns)===0;
}

const KSPEED = { highway: 165, strip: 120, boulevard: 120, coast: 110, arterial: 105, street: 72 };

export function createTraffic(G) {
  const graph = G.graph,hash=new Map(),buckets=[],junctions=new Map(),order=[],closedCaps=new Set(),staticRoutes=new Map(),departures=new Map();
  let routeSurface=G.surfaceAt,spawnCache=null;
  function spawnEdges(near,maxD){
    const cx=Math.floor(near.x/512),cy=Math.floor(near.y/512),range=Math.ceil(maxD/256);
    if(spawnCache?.cx===cx&&spawnCache.cy===cy&&spawnCache.range===range)return spawnCache;
    const edges=[],weights=[];let total=0;const x=cx*512+256,y=cy*512+256,r=range*256+400;
    for(const e of graph.edges){
      if(closedCaps.has(e)||e.len-trimAt(e.A,e)-trimAt(e.B,e)<380)continue;
      const t=clamp((x-e.A.x)*e.dx+(y-e.A.y)*e.dy,0,e.len);
      if(Math.hypot(e.A.x+e.dx*t-x,e.A.y+e.dy*t-y)>r+e.w/2)continue;
      total+=spawnWeight(e);edges.push(e);weights.push(total);
    }
    return spawnCache={cx,cy,range,edges,weights,total};
  }
  function route(v,end,ne){
    const tr=v.tr,e=tr.e,nfwd=ne.A===end,nlane=Math.min(tr.lane,ne.lanes-1),ns=trimAt(end,ne);
    const p0=edgePoint(e,tr.fwd,e.len-trimAt(end,e),tr.lane),p2=edgePoint(ne,nfwd,ns,nlane);
    const den=p0.dx*p2.dy-p0.dy*p2.dx;let p1;
    if(Math.abs(den)<.2)p1=ne===e?{x:end.x+p0.dx*65,y:end.y+p0.dy*65}:{x:(p0.x+p2.x)/2,y:(p0.y+p2.y)/2};
    else{const t=((p2.x-p0.x)*p2.dy-(p2.y-p0.y)*p2.dx)/den;p1={x:p0.x+p0.dx*t,y:p0.y+p0.dy*t};}
    const cubic=ne===e?{a:{x:p0.x+p0.dx*110,y:p0.y+p0.dy*110},b:{x:p2.x-p2.dx*110,y:p2.y-p2.dy*110}}:null;
    return {p0,p1,p2,cubic,u:0,ne,nfwd,nlane,ns,node:end};
  }
  function nearby(x,y,r,visit){
    for(let ix=Math.floor((x-r)/160);ix<=Math.floor((x+r)/160);ix++)for(let iy=Math.floor((y-r)/160);iy<=Math.floor((y+r)/160);iy++)for(const o of hash.get(ix+iy*10000)||EMPTY)if(visit(o))return true;
    return false;
  }
  function exitClear(v,t){
    const b=bodySize(v),probe=t.exitProbe||(t.exitProbe={...edgePoint(t.ne,t.nfwd,t.ns+b.l+22,t.nlane),kind:v.kind,def:v.def}),radius=bodyRadius(v);
    // Do not enter a junction unless the whole car can fit beyond it.
    if(t.exitSurface!==G.surfaceAt){t.exitSurface=G.surfaceAt;t.exitBlocked=!!(G.surfaceAt&&worldBodyHit(G,probe,probe.x,probe.y));}
    if(t.exitBlocked)return false;
    return !nearby(probe.x,probe.y,b.l+100,o=>o!==v&&(o.def?bodiesNear(probe,o,radius)&&bodyContact(probe,o):!o.dead&&circleBody(probe,o.x,o.y,9)));
  }
  function staticRouteClear(v,t){
    if(!G.surfaceAt)return true;
    if(routeSurface!==G.surfaceAt){routeSurface=G.surfaceAt;staticRoutes.clear();departures.clear();}
    const key=v.tr.e.id+':'+t.node.id+':'+t.ne.id+':'+v.tr.lane+':'+v.kind;
    if(staticRoutes.has(key))return staticRoutes.get(key);
    const probe={kind:v.kind,def:v.def,rot:0};
    for(let i=0;i<=24;i++){const p=turnPoint(t,i/24);probe.rot=p.rot;if(worldBodyHit(G,probe,p.x,p.y)){staticRoutes.set(key,false);return false;}}
    staticRoutes.set(key,true);return true;
  }
  // Never dispatch a long vehicle into a lane from which no full-body turn
  // fits. Checking only the current junction stranded buses at the next one.
  function canDepart(v,e,fwd,lane){
    if(routeSurface!==G.surfaceAt){routeSurface=G.surfaceAt;staticRoutes.clear();departures.clear();}
    const end=fwd?e.B:e.A,key=e.id+':'+end.id+':'+lane+':'+v.kind;
    if(departures.has(key))return departures.get(key);
    const car={kind:v.kind,def:v.def,tr:{e,fwd,lane}},options=end.edges.filter(o=>o!==e&&!closedCaps.has(o)&&(o.w-o.med)/(2*o.lanes)>=bodySize(v).w*2+2);
    if(!options.length){
      // A bus that cannot fit any onward lane should not be sent here merely
      // because a U-turn fits; that turn can wait forever against opposing flow.
      if(v.kind==='bus'&&end.edges.length>1){departures.set(key,false);return false;}
      options.push(e);
    }
    const clear=options.some(ne=>staticRouteClear(car,route(car,end,ne)));departures.set(key,clear);return clear;
  }
  function chooseRoute(v,end,clearOnly=false){
    const e=v.tr.e,hx=v.tr.fwd?e.dx:-e.dx,hy=v.tr.fwd?e.dy:-e.dy,key=e.id+':'+end.id+':'+v.tr.lane;
    // Waiting on an occupied exit must not rebuild hundreds of swept poses
    // and compatibility pairs every frame. Geometry only changes at a new approach.
    let candidates=v.tr.candidates;
    if(!candidates||candidates.key!==key||candidates.surface!==G.surfaceAt){
      const options=end.edges.filter(o=>o!==e&&!closedCaps.has(o)&&(o.w-o.med)/(2*o.lanes)>=bodySize(v).w*2+2);
      if(!options.length)options.push(e);
      candidates=v.tr.candidates={key,surface:G.surfaceAt,plans:options.map(ne=>route(v,end,ne)).filter(t=>staticRouteClear(v,t)&&canDepart(v,t.ne,t.nfwd,t.nlane))};
    }
    const plans=clearOnly?candidates.plans.filter(t=>exitClear(v,t)):candidates.plans;
    if(!plans.length)return null;
    if(v.role==='ambulance'&&v.target)return plans.reduce((best,t)=>{
      const next=t.nfwd?t.ne.B:t.ne.A,previous=best.nfwd?best.ne.B:best.ne.A;
      return Math.hypot(next.x-v.target.x,next.y-v.target.y)<Math.hypot(previous.x-v.target.x,previous.y-v.target.y)?t:best;
    });
    const straight=plans.find(t=>(t.p2.dx*hx+t.p2.dy*hy)>.9);
    return straight&&Math.random()<.65?straight:plans[(Math.random()*plans.length)|0];
  }
  function turnPoint(t,u){
    if(t.cubic){const q=1-u,a=t.cubic.a,b=t.cubic.b;
      const x=q*q*q*t.p0.x+3*q*q*u*a.x+3*q*u*u*b.x+u*u*u*t.p2.x,y=q*q*q*t.p0.y+3*q*q*u*a.y+3*q*u*u*b.y+u*u*u*t.p2.y;
      const dx=3*q*q*(a.x-t.p0.x)+6*q*u*(b.x-a.x)+3*u*u*(t.p2.x-b.x),dy=3*q*q*(a.y-t.p0.y)+6*q*u*(b.y-a.y)+3*u*u*(t.p2.y-b.y);
      return {x,y,rot:Math.atan2(dx,-dy),speed:Math.max(12,Math.hypot(dx,dy))};
    }
    const iu=1-u,x=iu*iu*t.p0.x+2*iu*u*t.p1.x+u*u*t.p2.x,y=iu*iu*t.p0.y+2*iu*u*t.p1.y+u*u*t.p2.y;
    const dx=2*iu*(t.p1.x-t.p0.x)+2*u*(t.p2.x-t.p1.x),dy=2*iu*(t.p1.y-t.p0.y)+2*u*(t.p2.y-t.p1.y);
    return {x,y,rot:Math.atan2(dx,-dy),speed:Math.max(12,Math.hypot(dx,dy))};
  }
  function routesCompatible(a,v,b,o){
    if(!a||!b||a.cubic||b.cubic)return false;
    const cache=a.compatible||(a.compatible=new WeakMap());
    if(cache.has(b))return cache.get(b);
    const sweep=(t,car)=>t.swept||(t.swept=Array.from({length:25},(_,i)=>({...turnPoint(t,i/24),def:car.def,kind:car.kind})));
    const A=sweep(a,v),B=sweep(b,o);let clear=true;
    outer:for(const p of A)for(const q of B)if(bodiesNear(p,q)&&bodyContact(p,q)){clear=false;break outer;}
    cache.set(b,clear);return clear;
  }
  function olderApproachWaiting(v,plan,zone,ahead){
    for(const other of order){
      if(other===v)break;
      const t=other.tr,end=t.fwd?t.e.B:t.e.A;
      if(t.turn||t.reserved!=null||t.waitSince==null||G.ticks-t.waitSince<960||(end.zone??end.id)!==zone||!lightGreen(G,end,t.e)||!t.route)continue;
      const room=Math.max(0,t.e.len-trimAt(end,t.e)-bodySize(other).l*2-22-t.s);
      if(room>=100||ahead(other,Math.sin(other.rot),-Math.cos(other.rot),300)<=room+8||!exitClear(other,t.route))continue;
      // After one signal cycle, through traffic must leave space for the older
      // conflicting turn. A blocked exit earns no priority.
      if(!routesCompatible(plan,v,t.route,other))return true;
    }
    return false;
  }
  function poseClear(v,p){
    const probe=v.trafficProbe||(v.trafficProbe={kind:v.kind,def:v.def}),radius=bodyRadius(v);
    // A car waiting at the exact same pose need not resample the static map.
    // Dynamic vehicles and pedestrians are still checked on every movement.
    if(probe.x!==p.x||probe.y!==p.y||probe.rot!==p.rot||probe.surface!==G.surfaceAt){
      probe.x=p.x;probe.y=p.y;probe.rot=p.rot;probe.surface=G.surfaceAt;
      probe.blocked=!!(G.surfaceAt&&worldBodyHit(G,probe,p.x,p.y));
    }
    if(probe.blocked)return false;
    return !nearby(p.x,p.y,radius+110,o=>o!==v&&(o.def?bodiesNear(probe,o,radius)&&bodyContact(probe,o):!o.dead&&circleBody(probe,o.x,o.y,8)));
  }
  function lanePose(tr,s){
    const p=edgePoint(tr.e,tr.fwd,s,tr.lane),m=tr.merge;if(!m)return p;
    const from=edgePoint(tr.e,tr.fwd,s,m.from),u=clamp((s-m.start)/(m.length||140),0,1),blend=u*u*(3-2*u);
    const dx=p.x-from.x,dy=p.y-from.y;p.x=from.x+dx*blend;p.y=from.y+dy*blend;
    p.rot=Math.atan2(p.dx+dx*6*u*(1-u)/(m.length||140),-(p.dy+dy*6*u*(1-u)/(m.length||140)));return p;
  }
  function passParked(v,gap){
    const tr=v.tr,e=tr.e;
    if(tr.turn||tr.merge||tr.backoff!=null||tr.reserved!=null||e.lanes<2||gap>240||tr.s<180||e.len-tr.s<300)return;
    if((tr.passCheck||0)>G.ticks)return;tr.passCheck=G.ticks+30;
    const hx=tr.fwd?e.dx:-e.dx,hy=tr.fwd?e.dy:-e.dy;
    const parked=nearby(v.x+hx*180,v.y+hy*180,240,o=>o!==v&&o.def&&!o.traffic&&!o.ai&&!o.cop&&Math.hypot(o.vx||0,o.vy||0)<3&&(o.x-v.x)*hx+(o.y-v.y)*hy>0&&Math.abs((o.x-v.x)*hy-(o.y-v.y)*hx)<bodySize(v).w+bodySize(o).w);
    if(!parked)return;
    for(const lane of [tr.lane-1,tr.lane+1]){
      if(lane<0||lane>=e.lanes)continue;
      let clear=true;for(let ds=-160;ds<=220;ds+=35)if(!poseClear(v,edgePoint(e,tr.fwd,tr.s+ds,lane))){clear=false;break;}
      if(!clear)continue;
      // Try a swept, gradual lane change, including cars that were already
      // stopped when the other lane cleared. Recheck occupancy every half second.
      for(const length of [140,100,72]){
        const plan={...tr,lane,merge:{from:tr.lane,start:tr.s,length}};
        for(let ds=0;ds<=length;ds+=4)if(!poseClear(v,lanePose(plan,tr.s+ds))){clear=false;break;}
        if(clear){tr.merge=plan.merge;tr.lane=lane;tr.route=null;tr.candidates=null;return;}clear=true;
      }
      // A nose-to-tail stop needs steering room. Back up slowly only after
      // checking the entire rear corridor; queued cars and walkers have priority.
      if(gap<90&&tr.spd<2){
        const distance=100-gap;let safe=true;
        for(let ds=0;ds<=distance+18;ds+=4)if(!poseClear(v,edgePoint(e,tr.fwd,tr.s-ds,tr.lane))){safe=false;break;}
        if(safe){tr.backoff=tr.s-distance;tr.passLane=lane;tr.spd=0;return;}
      }
    }
  }
  function trafficPose(v,p,dt){const decay=Math.exp(-dt*4);p.x+=(v.tr.offsetX||0)*decay;p.y+=(v.tr.offsetY||0)*decay;return p;}
  function commit(v,p,dt){v.x=p.x;v.y=p.y;v.rot=p.rot;v.tr.offsetX=(v.tr.offsetX||0)*Math.exp(-dt*4);v.tr.offsetY=(v.tr.offsetY||0)*Math.exp(-dt*4);}
  // An isolated spur with no full-body turnaround is not an ambient route.
  // Keep it playable, but do not dispatch cars into an inescapable corner.
  if(G.surfaceAt)for(const e of graph.edges)for(const end of [e.A,e.B])if(end.edges.length===1){
    for(let lane=0;lane<e.lanes;lane++){
      const v={kind:'fare',def:{},tr:{e,fwd:end===e.B,lane}},t=route(v,end,e);
      for(let i=0;i<=32;i++){const p=turnPoint(t,i/32),probe={...p,kind:'fare',def:{}};if(worldBodyHit(G,probe,p.x,p.y)){closedCaps.add(e);break;}}
      if(closedCaps.has(e))break;
    }
  }
  const HK=(x,y)=>Math.floor(x/160)+Math.floor(y/160)*10000;
  const T = {
    target: 34,
    diagnostics(){return [...junctions].map(([zone,owners])=>({zone,owners:[...owners].map(v=>({kind:v.kind,x:v.x,y:v.y,s:v.tr?.s,releaseAt:v.tr?.releaseAt,turn:!!v.tr?.turn,route:!!v.tr?.route,edge:[v.tr?.e.A.id,v.tr?.e.B.id]}))}));},
    spawnCar(near, minD, maxD, kind) {
      const candidates=spawnEdges(near,maxD);if(!candidates.edges.length)return null;
      for (let tries = 0; tries < 24; tries++) {
        const weight=Math.random()*candidates.total;
        let ei=0;while(candidates.weights[ei]<weight)ei++;
        const e = candidates.edges[ei];
        const fwd = Math.random() < 0.5;
        const t0 = trimAt(fwd ? e.A : e.B, e), t1 = trimAt(fwd ? e.B : e.A, e);
        if (e.len - t0 - t1 < 60) continue;
        // Spawn a full body outside junctions, never across the stop line.
        const margin=170;if(e.len-t0-t1<margin*2+40)continue;
        const s=t0+margin+Math.random()*(e.len-t0-t1-margin*2);
        const lane = (Math.random() * e.lanes) | 0;
        const p = edgePoint(e, fwd, s, lane);
        const d = Math.hypot(p.x - near.x, p.y - near.y);
        if (d < minD || d > maxD) continue;
        if(visibleSpawn(G,p.x,p.y))continue;
        if (G.vehicles.some((v) => Math.abs(v.x - p.x) < 90 && Math.abs(v.y - p.y) < 90)) continue;
        const kinds = ["fare", "fare", "dart", "riot", "taxi", "fare", "dart", "bus", "fare", "taxi", "stitch", "hog"];
        const k = kind || kinds[(Math.random() * kinds.length) | 0];
        if(k==="bus"&&(e.w-e.med)/(2*e.lanes)<58)continue;
        const v = G.makeVeh(k, p.x, p.y, p.rot, { parked: false, traffic: true, tr: { e, fwd, s, lane, spd: 0, turn: null }, ambient: true });
        if(G.surfaceAt&&worldBodyHit(G,v,v.x,v.y))continue;
        if(G.vehicles.some(other=>!other.def?.boat&&!(other.altitude>10)&&bodiesNear(v,other)&&bodyContact(v,other)))continue;
        // Leave braking room in both directions, not just a non-overlapping hull.
        const own=bodySize(v);
        if(G.vehicles.some(other=>{
          if(other.def?.boat||other.altitude>10)return false;
          const dx=other.x-v.x,dy=other.y-v.y;if(Math.abs(dx)>300||Math.abs(dy)>300)return false;
          const b=bodySize(other),co=Math.abs(Math.cos(other.rot-v.rot)),si=Math.abs(Math.sin(other.rot-v.rot));
          return Math.abs(dx*p.dy-dy*p.dx)<own.w+b.w*co+b.l*si+5&&Math.abs(dx*p.dx+dy*p.dy)<own.l+b.l*co+b.w*si+100;
        }))continue;
        if(!canDepart(v,e,fwd,lane))continue;
        v.cruise = (KSPEED[e.k] || 100) * (0.8 + Math.random() * 0.3) * (k === "bus" ? 0.7 : 1);
        G.vehicles.push(v);
        return v;
      }
      return null;
    },
    tick(dt) {
      const P = G.player;
      // population
      if (G.ticks % 15 === 0) {
        G.vehicles = G.vehicles.filter((v) => {
          if (v === P || v.mission || v.isVan || v.role === "boat" || v.chasing || v.pdCar || v.keep) return true;
          if (!v.ambient && !v.loose) return true;
          return Math.hypot(v.x - P.x, v.y - P.y) < 2400;
        });
        let n=0,blocked=0;for(const v of G.vehicles)if(v.traffic&&v.tr&&!v.dead){n++;if(v.tr.waitSince!=null&&G.ticks-v.tr.waitSince>600||v.blockedT>4)blocked++;}
        const elapsed=Math.min(1,(G.ticks-(T.populationTick??G.ticks-15))/60);T.populationTick=G.ticks;
        const flow=trafficFlowBudget(T,blocked,n,elapsed);
        T.effectiveTarget=Math.round(trafficDemand(G,T.target)*flow);T.population={active:n,queued:blocked,target:T.effectiveTarget,flow};
        if(n>T.effectiveTarget){
          const i=G.vehicles.findIndex(v=>v!==P&&v.ambient&&v.traffic&&!v.mission&&!v.isVan&&!v.keep&&!v.siren&&!v.role&&!v.pdCar&&!v.chasing&&!visibleSpawn(G,v.x,v.y));
          if(i>=0){G.vehicles.splice(i,1);n--;}
        }
        // Let a jam clear before feeding it more cars. Signals alone do not
        // trigger this: a meaningful fraction must wait longer than ten seconds.
        if(blocked<Math.max(5,n*.35)){
          const {halfW,halfH}=streetViewport(G),minD=Math.min(halfW,halfH)+80;
          for(let k=0;k<3&&n<T.effectiveTarget;k++)if(T.spawnCar(P,minD,minD+900))n++;
        }
      }
      // spatial hash for following
      for(const bucket of hash.values()){bucket.length=0;buckets.push(bucket);}hash.clear();
      for(const [id,owners] of junctions){
        for(const v of owners)if(v.dead||!v.traffic||!v.tr||!G.vehicles.includes(v)||v.tr.reserved!==id||v.tr.releaseAt!=null&&v.tr.s>=v.tr.releaseAt){
          if(v.tr?.reserved===id){v.tr.reserved=null;v.tr.releaseAt=null;}owners.delete(v);
        }
        if(!owners.size)junctions.delete(id);
      }
      const add=v=>{const k=HK(v.x,v.y);let bucket=hash.get(k);if(!bucket){bucket=buckets.pop()||[];hash.set(k,bucket);}bucket.push(v);};
      for(const v of G.vehicles)if(!v.def?.boat&&!(v.def?.aircraft&&v.altitude>10))add(v);
      if(P.type==='foot')add(P);
      for(const p of G.peds)if(!p.dead&&(p.onRoad||p.crossing))add(p);
      const ahead=(v,hx,hy,range)=>{
        let best=range;const own=bodySize(v);
        const cells=Math.ceil(range/160),cx=Math.floor(v.x/160),cy=Math.floor(v.y/160);
        for(let ix=cx-cells;ix<=cx+cells;ix++)for(let iy=cy-cells;iy<=cy+cells;iy++){
          for(const o of hash.get(ix+iy*10000)||EMPTY){
            if(o===v)continue;const dx=o.x-v.x,dy=o.y-v.y,forward=dx*hx+dy*hy;
            if(forward<=0||forward>range+110)continue;
            const veh=!!o.def,body=veh?bodySize(o):{w:8,l:8},sn=Math.sin(o.rot||0),co=Math.cos(o.rot||0);
            const length=veh?Math.abs(hx*sn-hy*co)*body.l+Math.abs(hx*co+hy*sn)*body.w:8;
            const width=veh?Math.abs(hx*sn-hy*co)*body.w+Math.abs(hx*co+hy*sn)*body.l:8;
            if(forward+length+own.l>0&&Math.abs(-dx*hy+dy*hx)<own.w+width-.5)best=Math.min(best,Math.max(0,forward-own.l-length-12));
          }
        }return best;
      };
      // Oldest waiting approach gets first refusal when a reservation clears.
      // Array insertion order used to starve one side of a busy junction.
      order.length=0;for(const v of G.vehicles)if(v.traffic&&v.tr&&!v.dead)order.push(v);
      order.sort((a,b)=>(a.tr.waitSince??Infinity)-(b.tr.waitSince??Infinity));
      for (const v of order) {
        const tr = v.tr;
        v.prevX=v.x;v.prevY=v.y;
        if (!v.traffic || !tr || v === P || v.dead) continue;
        if (Math.abs(v.x - P.x) > 2600 || Math.abs(v.y - P.y) > 2600) continue;
        const hx = Math.sin(v.rot), hy = -Math.cos(v.rot);
        let want = v.cruise;
        const gap=tr.turn?300:ahead(v,hx,hy,300);
        passParked(v,gap);
        if(tr.backoff!=null){
          const next=Math.max(tr.backoff,tr.s-18*dt),p=edgePoint(tr.e,tr.fwd,next,tr.lane),travel=tr.s-next;
          if(poseClear(v,p)){tr.s=next;commit(v,p,dt);v.vx=-Math.sin(v.rot)*travel/dt;v.vy=Math.cos(v.rot)*travel/dt;}
          else{tr.backoff=null;v.vx=v.vy=0;tr.passCheck=G.ticks+60;}
          v.fwd=-Math.hypot(v.vx,v.vy);v.braking=true;v.turnSign=Math.sign(tr.passLane-tr.lane);
          if(tr.backoff!=null&&tr.s<=tr.backoff+.01){tr.backoff=null;tr.passCheck=0;}
          continue;
        }
        if(tr.merge)want=Math.min(want,55);
        if(gap<300)want=Math.min(want,Math.sqrt(2*110*gap),gap/0.85);
        v.blockedT=gap<12?(v.blockedT||0)+dt:0;
        if (v.blockedT > 2.5 && P.type === "veh" && Math.hypot(P.x - v.x, P.y - v.y) < 140 && !v.honked) { v.honked = true; if (G.audio.horn) G.audio.horn(); }
        if (v.blockedT < 0.5) v.honked = false;
        want = G.cityAI?.trafficSpeed(v, want) ?? want;
        const e = tr.e;
        if (!tr.turn) {
          const end = tr.fwd ? e.B : e.A;
          const stopAt = e.len - trimAt(end, e);
          const toStop = stopAt - tr.s;
          const controlled=end.edges.length!==2||laneTransition(end)||Math.abs(end.edges[0].dx*end.edges[1].dy-end.edges[0].dy*end.edges[1].dx)>.1;
          // Leave rear-swing clearance for a turning car beside a queued lane.
          const hold=stopAt-bodySize(v).l*(controlled?2:1)-(controlled?22:10);
          const zone=end.zone??end.id;let owners=junctions.get(zone),room=Math.max(0,hold-tr.s);
          if(controlled&&!owners?.has(v)&&room<100)tr.waitSince??=G.ticks;
          if(!tr.route&&toStop<300)tr.route=chooseRoute(v,end);
          const green=lightGreen(G,end,e);
          if(controlled&&!owners?.has(v)&&(tr.reserved==null||tr.reserved===zone)&&green&&room<100&&gap>room+8&&G.ticks>=(tr.junctionCheck||0)){
            // Queue decisions run at 10 Hz, while motion and contact checks
            // retain their fixed 60 Hz step, with a maximum 100 ms retry delay.
            tr.junctionCheck=G.ticks+6;
            let plan=tr.route;
            if(!plan||!exitClear(v,plan))plan=chooseRoute(v,end,true);
            // Reserve the swept bodies, not the whole intersection. A slight
            // lane taper used to serialize every approach for several signals.
            // Non-conflicting through lanes and right turns can now clear together.
            const compatible=plan&&(!owners||(end.zoneSize||1)<=1&&[...owners].every(o=>{
              return routesCompatible(plan,v,o.tr.turn||o.tr.route,o);
            }))&&!olderApproachWaiting(v,plan,zone,ahead);
            if(compatible){tr.route=plan;if(!owners){owners=new Set();junctions.set(zone,owners);}owners.add(v);tr.reserved=zone;tr.releaseAt=null;}
          }
          // Reserve before crossing the stop line; competing entrants cannot
          // overwrite a car already committed to clearing the junction.
          const blocked=(controlled?!owners?.has(v):!green)||!tr.route&&toStop<300;
          const stopping=blocked&&tr.s<=hold+2;
          if(stopping)want=Math.min(want,Math.sqrt(2*115*room),room*1.8);
          if(end.edges.length>1&&toStop<90)want=Math.min(want,Math.max(45,v.cruise*.55));
          tr.spd=Math.max(0,tr.spd+clamp(want-tr.spd,-145*dt,38*dt));
          let travel=Math.min(tr.spd*dt,gap);
          if(stopping){travel=Math.min(travel,room);if(room<.5)tr.spd=0;}
          // Commit route distance only after the physical body has room. Otherwise
          // the next tick used to snap a collision-corrected car into its queue.
          const nextS=Math.min(stopAt,tr.s+travel),candidate=trafficPose(v,lanePose(tr,nextS),dt);
          if(poseClear(v,candidate)){tr.s=nextS;commit(v,candidate,dt);}
          else{travel=0;tr.spd=0;}
          if(travel<tr.spd*dt)tr.spd=travel/dt;
          if(tr.s>=stopAt){
            tr.turn=tr.route||chooseRoute(v,end);tr.route=null;
            if(!tr.turn){tr.spd=v.vx=v.vy=0;continue;}
            tr.turn.u=0;tr.waitSince=null;
            v.turnSign=Math.sign(tr.turn.p0.dx*tr.turn.p2.dy-tr.turn.p0.dy*tr.turn.p2.dx)||0;
          } else {
            if(tr.merge&&tr.s>=tr.merge.start+(tr.merge.length||140))tr.merge=null;
            v.turnSign = tr.merge?Math.sign(tr.lane-tr.merge.from):0;
          }
        }
        if (tr.turn) {
          const t=tr.turn;
          tr.spd=Math.max(0,tr.spd+clamp(Math.min(want,68)-tr.spd,-145*dt,32*dt));
          const p=turnPoint(t,t.u),next=Math.min(1,t.u+tr.spd*dt/p.speed);
          // Follow the actual curve, not a forward ray that mistakes the
          // waiting cross-traffic for a permanent obstacle during left turns.
          const at=trafficPose(v,turnPoint(t,next),dt);
          if(poseClear(v,at)){t.u=next;commit(v,at,dt);}else tr.spd=0;
          if(t.u>=1){
            tr.e=t.ne;tr.fwd=t.nfwd;tr.lane=t.nlane;tr.s=t.ns;tr.turn=null;v.turnSign=0;
            if(tr.reserved!=null){const nextNode=t.nfwd?t.ne.B:t.ne.A;tr.releaseAt=(nextNode.zone??nextNode.id)===tr.reserved?null:t.ns+bodySize(v).l+14;}
          }
        }

        v.vx = Math.sin(v.rot) * tr.spd; v.vy = -Math.cos(v.rot) * tr.spd;
        v.braking = want < tr.spd - 5 || tr.spd < 3;
        v.fwd = tr.spd;
      }
    },
  };
  return T;
}

/* ---------- pedestrians ---------- */
const PED_SPR = ["m1", "m2", "m3", "m4", "worker", "cabbie", "prime", "valet", "guest", "synth", "m1", "m3"];
export function createPeds(G) {
  const surf = (x, y) => G.surfaceAt(x, y);
  const P = {
    target: 64,
    spawn(near, minD, maxD) {
      for (let i = 0; i < 30; i++) {
        const a = Math.random() * TAU, d = minD + Math.random() * (maxD - minD);
        const x = near.x + Math.cos(a) * d, y = near.y + Math.sin(a) * d;
        if (surf(x, y) !== "walk"||!pedestrianClear(G,x,y)) continue;
        if(G.peds.some(p=>!p.dead&&(p.x-x)**2+(p.y-y)**2<38**2))continue;
        if(visibleSpawn(G,x,y))continue;
        // orient along the sidewalk
        const dirs = CARDINAL.filter(([dx, dy]) => surf(x + dx * 40, y + dy * 40) === "walk");
        const dd = dirs.length ? dirs[(Math.random() * dirs.length) | 0] : [1, 0];
        const n = Math.random() < 0.3 ? 2 : 1;
        for (let k = 0; k < n; k++) {
          const px=x+k*22*-dd[1],py=y+k*22*dd[0];
          if(!pedestrianClear(G,px,py)||[[0,0],[-7,0],[7,0],[0,-7],[0,7]].some(([ox,oy])=>surf(px+ox,py+oy)!=='walk'))continue;
          if(k&&G.peds.some(p=>!p.dead&&(p.x-px)**2+(p.y-py)**2<19**2))continue;
          G.peds.push({
            x:px,y:py, rot: Math.atan2(dd[0], -dd[1]), vx: 0, vy: 0,
            sprite: PED_SPR[(Math.random() * PED_SPR.length) | 0], speed: 0, walk: 26 + Math.random() * 22,
            dist: Math.random() * 20, flee: 0, r: 8, hp: 30, dead: false, ambient: true, idle: 0, hx: dd[0], hy: dd[1],
          });
        }
        return true;
      }
      return false;
    },
    tick(dt) {
      const pl = G.player;
      if (G.ticks % 10 === 0) {
        if(!(G.touch&&G.settings?.quality==='low')){
          const live=G.peds.filter(p=>!p.dead&&p.ambient).length;P.effectiveTarget=P.target;
          if(live<P.target){const {halfW,halfH}=streetViewport(G),minD=Math.min(halfW,halfH)+60;for(let k=0;k<3&&live+k<P.target;k++)P.spawn(pl,minD,minD+600);}
          G.peds=G.peds.filter(p=>!p.ambient||Math.hypot(p.x-pl.x,p.y-pl.y)<1700||p.dead&&p.deadT<30);
          return;
        }
        G.peds = G.peds.filter((p) => !p.ambient || Math.hypot(p.x - pl.x, p.y - pl.y) < 1700 || (p.dead && p.deadT < 30));
        let live=0;for(const p of G.peds)if(!p.dead&&p.ambient)live++;
        P.effectiveTarget=Math.round(P.target*(G.touch&&G.settings?.quality==='low'?(G.streetBudget??1):1));
        if(live>P.effectiveTarget){
          const i=G.peds.findIndex(p=>p.ambient&&!p.dead&&!p.mission&&!p.copPed&&!p.crossing&&!p.onRoad&&!visibleSpawn(G,p.x,p.y));
          if(i>=0){G.peds.splice(i,1);live--;}
        }
        if(live<P.effectiveTarget){const {halfW,halfH}=streetViewport(G),minD=Math.min(halfW,halfH)+60;
          for(let k=0;k<3&&live<P.effectiveTarget;k++){const before=G.peds.length;P.spawn(pl,minD,minD+600);live+=G.peds.length-before;}
        }
      }
    },
    walkAmbient(p, dt) {
      // stays on sidewalks, turns at corners, crosses at green
      const onRoad=surf(p.x,p.y)==='road';p.onRoad=onRoad;
      // Keep the whole waiting body behind the curb. A centre just outside
      // the road blocked the outer lane while the walker waited for that lane.
      if(!onRoad&&!p.crossing){
        for(const [dx,dy] of CARDINAL)if(surf(p.x+dx*14,p.y+dy*14)==='road'&&FOOT_SAFE.has(surf(p.x-dx*20,p.y-dy*20))){
          if(stepPedestrian(G,p,Math.atan2(-dx,dy),30,dt)){p.idle=0;return;}
        }
      }
      if(p._turning){
        const target=Math.atan2(p.hx,-p.hy),delta=Math.atan2(Math.sin(target-p.rot),Math.cos(target-p.rot));
        p.rot+=delta*Math.min(1,dt*10);p.speed=0;if(Math.abs(delta)<.12)p._turning=false;return;
      }
      // A fleeing person can finish on the carriageway facing along it. Walk
      // to the nearest safe verge instead of becoming a permanent lane block.
      if(onRoad&&!p.crossing){
        let cached=p._roadExit;
        if(!cached||cached.x!==p.x||cached.y!==p.y||cached.surface!==G.surfaceAt){
          let exit=null;
          outer:for(let distance=18;distance<=600;distance+=18)for(const [hx,hy] of CARDINAL){
            const s=surf(p.x+hx*distance,p.y+hy*distance);
            if(!FOOT_SAFE.has(s))continue;
            let clear=true;for(let t=12;t<distance;t+=12){const at=surf(p.x+hx*t,p.y+hy*t);if(at==='build'||at==='water'||at==='canal'){clear=false;break;}}
            if(clear){exit={hx,hy};break outer;}
          }
          cached=p._roadExit={x:p.x,y:p.y,surface:G.surfaceAt,exit};
        }
        const exit=cached.exit;
        if(exit){p.hx=exit.hx;p.hy=exit.hy;p.crossing=true;p.idle=0;}
      }
      if (!p.crossing&&!onRoad&&p.idle > 0) { p.idle -= dt; p.speed = 0; return; }
      if (!p.crossing&&!onRoad&&Math.random() < 0.0015) { p.idle = 1.5 + Math.random() * 3; return; }
      const look = 18;
      const ahead = surf(p.x + p.hx * look, p.y + p.hy * look);
      const ok = (s) => s === "walk" || s === "grass" || s === "pier" || s === "sand" || s === "lot" || s === "dirt";
      if (p.crossing) {
        if (ok(ahead) && surf(p.x, p.y) !== "road") p.crossing = false;
      } else if (!ok(ahead)) {
        if(ahead==='road'&&G.crossOk){
          if(!G.crossOk(p)){
            p._crossWait=(p._crossWait||0)+dt;
            if(p._crossRouteInvalid||p._crossWait>18){
              const dirs=CARDINAL.filter(([dx,dy])=>dx*p.hx+dy*p.hy===0&&[18,40,70].every(t=>ok(surf(p.x+dx*t,p.y+dy*t))&&pedestrianClear(G,p.x+dx*t,p.y+dy*t)));
              if(dirs.length){const d=dirs[(Math.random()*dirs.length)|0];p.hx=d[0];p.hy=d[1];p._crossWait=0;p._turning=true;p._crossAt=0;p.cityActivity=null;return;}
            }
            p.speed=0;p.onRoad=false;p.cityActivity='waiting';return;
          }
          p.crossing=true;p.cityActivity=null;p._crossWait=0;
        }
        else {
          const dirs = CARDINAL.filter(([dx, dy]) => !(dx === -p.hx && dy === -p.hy) && ok(surf(p.x + dx * look, p.y + dy * look)));
          const d = dirs.length ? dirs[(Math.random() * dirs.length) | 0] : [-p.hx, -p.hy];
          p.hx = d[0]; p.hy = d[1];
        }
      }
      const tr = Math.atan2(p.hx, -p.hy);
      if(ahead!=='road'){p._crossWait=0;if(p.cityActivity==='waiting')p.cityActivity=null;}
      p.rot = p.rot + ((((tr - p.rot + Math.PI) % TAU) + TAU) % TAU - Math.PI) * Math.min(1, 8 * dt);
      const sp = p.crossing ? p.walk * 1.4 : p.walk;
      if(!stepPedestrian(G,p,tr,sp,dt,{road:p.crossing||onRoad})){
        p._blockedWalk=(p._blockedWalk||0)+dt;
        if(p._blockedWalk>.6){p.hx=-p.hx;p.hy=-p.hy;p._turning=true;p.crossing=false;p._blockedWalk=0;}
      }else p._blockedWalk=0;
      p.onRoad = surf(p.x,p.y)==='road';
    },
  };
  return P;
}

/* ---------- nav field (cars) ---------- */
export function createNav(G) {
  let N_raw = null;
  const C = 32, NW = Math.ceil(WORLD_W / C), NH = Math.ceil(WORLD_H / C);
  const pass = new Uint8Array(NW * NH);
  for (let y = 0; y < NH; y++) for (let x = 0; x < NW; x++) {
    let ok = 1;
    for (const [ox, oy] of [[16, 16], [6, 6], [26, 6], [6, 26], [26, 26]]) {
      const s = G.surfaceAt(x * C + ox, y * C + oy);
      if (s === "build" || s === "water" || s === "canal") { ok = 0; break; }
    }
    pass[y * NW + x] = ok;
  }
  // cars need room: erode by one cell so the flow field never threads 1-cell alleys
  {
    const raw = pass.slice();
    for (let y = 1; y < NH - 1; y++) for (let x = 1; x < NW - 1; x++) {
      const i = y * NW + x;
      if (raw[i] && !(raw[i - 1] && raw[i + 1] && raw[i - NW] && raw[i + NW])) pass[i] = 0;
    }
    N_raw = raw;
  }
  const dist = new Uint16Array(NW * NH),footDist=new Uint16Array(NW*NH);
  const q = new Int32Array(NW * NH);
  const N = {
    C, NW, NH, pass, dist, footDist, t: 0, lastX:-1,lastY:-1, get raw() { return N_raw; },
    update(tx, ty, force) {
      N.t -= 1;
      if (N.t > 0 && !force) return;
      N.t = 24;
      const cx=Math.floor(tx/C),cy=Math.floor(ty/C);
      if(!force&&N.lastX===cx&&N.lastY===cy)return;
      N.lastX=cx;N.lastY=cy;N.flood(dist,tx,ty,170);N.flood(footDist,tx,ty,90,N_raw);
    },
    flood(D, tx, ty, maxD,grid=pass) {
      D.fill(65535);
      let cx = clamp((tx / C) | 0, 0, NW - 1), cy = clamp((ty / C) | 0, 0, NH - 1);
      if (!grid[cy * NW + cx]) {
        outer: for (let r = 1; r < 6; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
          const x = cx + dx, y = cy + dy; if (x < 0 || y < 0 || x >= NW || y >= NH) continue;
          if (grid[y * NW + x]) { cx = x; cy = y; break outer; }
        }
      }
      let h = 0, t = 0;
      q[t++] = cy * NW + cx; D[cy * NW + cx] = 0;
      while (h < t) {
        const i = q[h++]; const d = D[i];
        if (d > maxD) continue;
        const x = i % NW, y = (i / NW) | 0;
        if (x > 0) { const j = i - 1; if (grid[j] && D[j] === 65535) { D[j] = d + 1; q[t++] = j; } }
        if (x < NW - 1) { const j = i + 1; if (grid[j] && D[j] === 65535) { D[j] = d + 1; q[t++] = j; } }
        if (y > 0) { const j = i - NW; if (grid[j] && D[j] === 65535) { D[j] = d + 1; q[t++] = j; } }
        if (y < NH - 1) { const j = i + NW; if (grid[j] && D[j] === 65535) { D[j] = d + 1; q[t++] = j; } }
      }
    },
    // GPS: route polyline from (x,y) to the target of field R
    route(R, x, y) {
      let cx = clamp((x / C) | 0, 0, NW - 1), cy = clamp((y / C) | 0, 0, NH - 1);
      const pts = [];
      if (R[cy * NW + cx] === 65535) return pts;
      for (let s = 0; s < 900; s++) {
        let best = R[cy * NW + cx], bx = cx, by = cy;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = cx + dx, ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= NW || ny >= NH) continue;
          const d = R[ny * NW + nx]; if (d < best) { best = d; bx = nx; by = ny; }
        }
        if (bx === cx && by === cy) break;
        cx = bx; cy = by;
        if (s % 3 === 0) pts.push(cx * C + C / 2, cy * C + C / 2);
      }
      return pts;
    },
    // returns a steering point a few cells downhill from (x,y)
    next(x,y,steps=3,foot=false) {
      const field=foot?footDist:dist,grid=foot?N_raw:pass;
      let cx = clamp((x / C) | 0, 0, NW - 1), cy = clamp((y / C) | 0, 0, NH - 1);
      if (field[cy * NW + cx] === 65535) {
        // off the car grid (curb, eroded edge): head for the best nearby reachable cell
        let bd = 65535, bx = -1, by = -1;
        for (let r = 1; r <= 4 && bx < 0; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
          const nx = cx + dx, ny = cy + dy; if (nx < 0 || ny < 0 || nx >= NW || ny >= NH) continue;
          const d = field[ny * NW + nx]; if (d < bd) { bd = d; bx = nx; by = ny; }
        }
        if (bx < 0) return null;
        return { x: bx * C + C / 2, y: by * C + C / 2, d: bd };
      }
      for (let s = 0; s < steps; s++) {
        let best = field[cy * NW + cx], bx = cx, by = cy;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
          const nx = cx + dx, ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= NW || ny >= NH) continue;
          if (dx && dy && (!grid[cy * NW + nx] || !grid[ny * NW + cx])) continue;
          const d = field[ny * NW + nx];
          if (d < best) { best = d; bx = nx; by = ny; }
        }
        if (bx === cx && by === cy) break;
        cx = bx; cy = by;
      }
      return { x: cx * C + C / 2, y: cy * C + C / 2, d: field[cy * NW + cx] };
    },
    clearLine(x0, y0, x1, y1) {
      const L = Math.hypot(x1 - x0, y1 - y0), n = Math.ceil(L / 24);
      for (let i = 1; i < n; i++) {
        const x = x0 + (x1 - x0) * i / n, y = y0 + (y1 - y0) * i / n;
        if (!N_raw[((y / C) | 0) * NW + ((x / C) | 0)]) return false;
      }
      return true;
    },
  };
  return N;
}
