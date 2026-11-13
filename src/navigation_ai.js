/* Small, local steering decisions. Physics still performs every movement. */
import {bodySize,worldBodyHit,segmentBody,bodyContact,circleBody} from './collision.js';
import {pedestrianClear} from './pedestrian_motion.js';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const angle=a=>Math.atan2(Math.sin(a),Math.cos(a));
const water=(G,x,y)=>['water','canal'].includes(G.world?.boatSurfaceAt?.(x,y)||G.surfaceAt(x,y));
const CROSS_SAFE=new Set(['walk','lot','grass','sand','dirt','pier']);
const boatIndexes=new WeakMap();
function nearbyBoats(G,v,out){
 let index=boatIndexes.get(G);const tick=G.ticks;
 if(!index){index={cells:new Map(),pool:[],tick:-Infinity,source:null,count:0};boatIndexes.set(G,index);}
 // Share the watercraft broadphase between captains. Road traffic, aircraft,
 // and faraway marinas need not be scanned for every hull probe.
 if(!Number.isFinite(tick)||tick<index.tick||tick-index.tick>=9||index.source!==G.vehicles||index.count!==G.vehicles.length){
  for(const bucket of index.cells.values()){bucket.length=0;index.pool.push(bucket);}index.cells.clear();
  for(const boat of G.vehicles){if(!boat.def?.boat)continue;const key=Math.floor(boat.x/384)+Math.floor(boat.y/384)*10000;let bucket=index.cells.get(key);
   if(!bucket){bucket=index.pool.pop()||[];index.cells.set(key,bucket);}bucket.push(boat);
  }index.tick=tick;index.source=G.vehicles;index.count=G.vehicles.length;
 }
 out.length=0;
 for(let x=Math.floor((v.x-800)/384);x<=Math.floor((v.x+800)/384);x++)for(let y=Math.floor((v.y-800)/384);y<=Math.floor((v.y+800)/384);y++){
  const bucket=index.cells.get(x+y*10000);if(!bucket)continue;for(const o of bucket)if(o!==v&&Math.abs(o.x-v.x)<820&&Math.abs(o.y-v.y)<820)out.push(o);
 }return out;
}

export function waterPathClear(G,v,x,y){
 const dx=x-v.x,dy=y-v.y,length=Math.hypot(dx,dy),rot=Math.atan2(dx,-dy),probe={def:v.def,kind:v.kind,rot};
 const steps=Math.max(1,Math.ceil(length/28));
 for(let i=1;i<=steps;i++)if(worldBodyHit(G,probe,v.x+dx*i/steps,v.y+dy*i/steps))return false;
 return true;
}

function boatCorridorClear(G,v,distance,boats){
 const hx=Math.sin(v.rot),hy=-Math.cos(v.rot),probe={kind:v.kind,def:v.def,rot:v.rot};
 const steps=Math.max(1,Math.ceil(Math.abs(distance)/20));
 for(let i=0;i<=steps;i++){
  const d=distance*i/steps;probe.x=v.x+hx*d;probe.y=v.y+hy*d;
  if(worldBodyHit(G,probe,probe.x,probe.y)||boats.some(o=>Math.abs(o.x-probe.x)<180&&Math.abs(o.y-probe.y)<180&&bodyContact(probe,o)))return false;
 }
 return true;
}

export function boatPilot(G,v,dt){
 const b=v.pilot||(v.pilot={timer:0,goal:null,wait:0,stuck:0,elapsed:0});b.elapsed+=dt;
 if(b.controls&&b.elapsed<.16)return b.controls;dt=b.elapsed;b.elapsed=0;b.timer-=dt;
 const boats=nearbyBoats(G,v,b.nearBoats||(b.nearBoats=[]));
 const speed=Math.hypot(v.vx||0,v.vy||0),home=v.home||v;
 const hx=Math.sin(v.rot),hy=-Math.cos(v.rot);b.reverseCooldown=Math.max(0,(b.reverseCooldown||0)-dt);
 if(b.reverse>0){b.reverse-=dt;b.goal=null;if(!boatCorridorClear(G,v,-90,boats)){b.reverse=0;return b.controls={x:0,y:0,brake:true};}return b.controls={x:0,y:-.38,brake:false};}
 // A moored launch can face its pier. Back out through checked water before
 // asking the rudder to turn; turning forward against the bank cannot recover.
 if(speed<18&&!b.reverseCooldown&&!waterPathClear(G,v,v.x+hx*90,v.y+hy*90)){
  // Berths rarely offer 220px behind every hull. A shorter, fully checked
  // backing manoeuvre creates enough rudder room without demanding open sea.
  for(const distance of [220,160,110])if(boatCorridorClear(G,v,-distance,boats)){
   b.reverse=Math.min(2.8,distance/45);b.reverseCooldown=5;b.goal=null;return b.controls={x:0,y:-.38,brake:false};
  }
 }
 if(!b.goal||Math.hypot(v.x-b.goal.x,v.y-b.goal.y)<65||b.timer<=0){
  let best=null,score=-Infinity;
  const directions=[v.rot,v.rot+.15,v.rot-.15,v.rot+.45,v.rot-.45,v.rot+.9,v.rot-.9,v.rot+1.5,v.rot-1.5,v.rot+Math.PI,0,Math.PI/2,Math.PI,Math.PI*1.5];
  for(const range of [300,180,100])for(const rot of directions){
   const turn=angle(rot-v.rot),x=v.x+Math.sin(rot)*range,y=v.y-Math.cos(rot)*range;
   if(!water(G,x,y)||!waterPathClear(G,v,x,y))continue;
   const rank=range-Math.abs(turn)*60-Math.max(0,Math.hypot(x-home.x,y-home.y)-650)*.6;
   if(rank>score){score=rank;best={x,y};}
  }b.goal=best;b.timer=1.2;
 }
 if(!b.goal)return b.controls={x:0,y:0,brake:true};
 const own=bodySize(v);
 // Commit early to a shallow starboard passing line. A last-second heading
 // nudge cannot move a hull sideways once both captains have already stopped.
 if(b.pass){const o=b.pass.other,ahead=(o.x-v.x)*hx+(o.y-v.y)*hy;
  if(o.dead||!G.vehicles.includes(o)||ahead<-(own.l+bodySize(o).l+30)||Math.hypot(o.x-v.x,o.y-v.y)>700)b.pass=null;
 }
 if(!b.pass)for(const o of boats){
  if(o===v||o.dead||!o.def?.boat||Math.cos(o.rot-v.rot)>-.5)continue;
  const dx=o.x-v.x,dy=o.y-v.y,ahead=dx*hx+dy*hy,side=dx*Math.cos(v.rot)+dy*Math.sin(v.rot);
  if(ahead<150||ahead>550||Math.abs(side)>80)continue;
  const goal={x:v.x+hx*350+Math.cos(v.rot)*55,y:v.y+hy*350+Math.sin(v.rot)*55};
  const canal=G.world?.expansion?.canal;
  if(canal&&v.x>canal.x&&v.x<canal.x+canal.w&&v.y>canal.y&&v.y<canal.y+canal.h&&Math.abs(hy)>.8){
   // Align with the canal itself after a turn, rather than carrying a slight
   // approach angle into the opposite lane on the next encounter.
   goal.x=canal.x+canal.w/2+(hy<0?1:-1)*Math.min(55,canal.w*.27);goal.y=v.y+Math.sign(hy)*350;
  }
  if(waterPathClear(G,v,goal.x,goal.y)){b.pass={other:o,goal};break;}
 }
 if(b.pass){b.goal=b.pass.goal;b.timer=1.2;}
 let diff=angle(Math.atan2(b.goal.x-v.x,-(b.goal.y-v.y))-v.rot),cap=v.kind==='gulf'?54:82;
 if(G.world?.boatSurfaceAt?.(v.x,v.y)==='canal'||G.surfaceAt(v.x,v.y)==='canal')cap=Math.min(cap,64);
 for(const other of boats){
  if(other===v||!other.def?.boat)continue;
  const dx=other.x-v.x,dy=other.y-v.y,ahead=dx*hx+dy*hy,lateral=dx*hy-dy*hx;
  const size=bodySize(other),turn=other.rot-v.rot,co=Math.abs(Math.cos(turn)),si=Math.abs(Math.sin(turn));
  const width=size.w*co+size.l*si,length=size.l*co+size.w*si,margin=b.pass?.other===other?10:24;
  if(ahead>0&&ahead<250&&Math.abs(lateral)<own.w+width+margin){
   const gap=ahead-own.l-length-20;cap=Math.min(cap,Math.max(0,gap*.75));
   // Both vessels turn to starboard when safe; no head-on left/right oscillation.
   if(!b.pass&&gap<130&&waterPathClear(G,v,v.x+Math.sin(v.rot+.24)*150,v.y-Math.cos(v.rot+.24)*150))diff+=.35;
  }
 }
 const look=75+speed*.65;
 if(!waterPathClear(G,v,v.x+hx*look,v.y+hy*look)){cap=Math.min(cap,15);b.timer=0;}
 if(Math.abs(diff)>.8)cap=Math.min(cap,25);
 b.stuck=speed<4?b.stuck+dt:0;if(b.stuck>3){b.goal=null;b.stuck=0;}
 return b.controls={x:clamp(diff*1.7,-1,1),y:speed>cap+6?0:cap<4?0:clamp((cap-speed)/90+.1,.08,.45),brake:speed>cap+8};
}

export function safeCrossing(G,p){
 if(p._crossAt>G.ticks)return !!p._crossAllowed;p._crossAt=G.ticks+10;p._crossAllowed=false;
 const hx=p.hx||0,hy=p.hy||0;let junction=null;p._crossRouteInvalid=false;
 // A crossing must lead to an opposite verge. At awkward road corners the
 // previous code could send someone along a traffic lane for an entire block.
 // Geometry is static while someone waits at the same curb; signals and
 // moving vehicles are still checked on every decision.
 let geometry=p._crossGeometry;
 if(!geometry||geometry.x!==p.x||geometry.y!==p.y||geometry.hx!==hx||geometry.hy!==hy||geometry.graph!==G.graph||geometry.surface!==G.surfaceAt){
  let invalid=false,exitDistance=0;
  if(G.surfaceAt){
   let road=false,exit=false;
   for(let step=12;step<=600;step+=12){const s=G.surfaceAt(p.x+hx*step,p.y+hy*step);
    if(s==='build'||s==='water'||s==='canal')break;
    if(s==='road')road=true;else if(road&&CROSS_SAFE.has(s)){exit=true;exitDistance=step;break;}
   }
   invalid=!exit;
  }
  if(!invalid){let best=Infinity;for(const n of G.graph.nodes){const dx=n.x-p.x,dy=n.y-p.y,d=dx*dx+dy*dy;if(d<best&&Math.abs(dx)<n.hw+90&&Math.abs(dy)<n.hh+90){junction=n;best=d;}}}
  geometry=p._crossGeometry={x:p.x,y:p.y,hx,hy,graph:G.graph,surface:G.surfaceAt,junction,invalid,exitDistance};
 }
 if(geometry.invalid){p._crossRouteInvalid=true;return false;}
 junction=geometry.junction;
 // Mid-block curbs have no crossing: walk on to the corner instead of
 // queueing at the kerb (this used to gather crowds facing the traffic).
 if(!junction){p._crossRouteInvalid=true;return false;}
 const walkSpeed=Math.max(36,(p.walk||32)*1.4);
 const crossingTime=((geometry.exitDistance||((Math.abs(hx)>0?junction.hw:junction.hh)*2))+12)/walkSpeed;
 if(junction.sig){const phase=((G.ticks/60)%16+16)%16,ns=Math.abs(hy)>Math.abs(hx);if(ns?phase>6-crossingTime:phase<8||phase>14-crossingTime)return false;}
 // Test relative motion across the entire crossing, including its far lane.
 // The former curb-only probe let people step into a car arriving mid-crossing.
 let blocked=false;
 const inspect=v=>{
  if(blocked||v.def?.boat||v.altitude>10)return;
  // A stationary queue or wreck still occupies the crossing. Predicting only
  // moving traffic sent walkers into its hull, stranding them mid-carriageway.
  const vx=v.dead?0:v.vx||0,vy=v.dead?0:v.vy||0;
  const rx=hx*walkSpeed-vx,ry=hy*walkSpeed-vy;
  if(segmentBody(v,p.x,p.y,p.x+rx*crossingTime,p.y+ry*crossingTime,14)!==null)blocked=true;
 };
 if(G.cityAI?.nearTraffic)G.cityAI.nearTraffic(p.x+hx*walkSpeed*crossingTime/2,p.y+hy*walkSpeed*crossingTime/2,Math.min(1500,700+walkSpeed*crossingTime/2),inspect);
 else for(const v of G.vehicles)inspect(v);
 if(blocked)return false;p._crossAllowed=true;return true;
}

export function escapeHeading(G,p,source){
 const base=Math.atan2(p.x-source.x,-(p.y-source.y)),cars=p._escapeCars||(p._escapeCars=[]);cars.length=0;
 const nearby=v=>{if(!v.def?.boat&&!(v.altitude>10))cars.push(v);};
 if(G.cityAI?.nearTraffic)G.cityAI.nearTraffic(p.x,p.y,260,nearby);
 else for(const v of G.vehicles||[])if(Math.abs(v.x-p.x)<260&&Math.abs(v.y-p.y)<260)nearby(v);
 let best=p.rot,score=-Infinity;const empty=[],onRoad=G.surfaceAt(p.x,p.y)==='road';
 for(const turn of [0,.6,-.6,1.2,-1.2,2,-2,Math.PI]){
  const a=base+turn,hx=Math.sin(a),hy=-Math.cos(a),x=p.x+hx*70,y=p.y+hy*70;
  let clear=true,road=0;
  for(const d of [12,26,42,70]){const px=p.x+hx*d,py=p.y+hy*d;
   if(!pedestrianClear(G,px,py,6,empty)){clear=false;break;}
   if(G.surfaceAt(px,py)==='road')road++;
  }
  if(!clear)continue;
  for(const v of cars){
   // Relative swept movement predicts a car entering this escape corridor.
   if(circleBody(v,p.x,p.y,7)){if(circleBody(v,x,y,9)){clear=false;break;}continue;}
   if(segmentBody(v,p.x,p.y,x-(v.vx||0)*.55,y-(v.vy||0)*.55,9)!==null){clear=false;break;}
  }
  if(!clear)continue;
  const value=Math.hypot(x-source.x,y-source.y)-Math.abs(turn)*8-road*(onRoad?9:22)+(onRoad&&CROSS_SAFE.has(G.surfaceAt(x,y))?30:0);
  if(value>score){score=value;best=a;}
 }p._escapeBlocked=score===-Infinity;return best;
}
