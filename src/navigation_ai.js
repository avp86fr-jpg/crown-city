/* Small, local steering decisions. Physics still performs every movement. */
import {bodySize,worldBodyHit,circleBody,bodyContact} from './collision.js';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const angle=a=>Math.atan2(Math.sin(a),Math.cos(a));
const water=(G,x,y)=>['water','canal'].includes(G.world?.boatSurfaceAt?.(x,y)||G.surfaceAt(x,y));
const CROSS_SAFE=new Set(['walk','lot','grass','sand','dirt','pier']);

export function waterPathClear(G,v,x,y){
 const dx=x-v.x,dy=y-v.y,length=Math.hypot(dx,dy),rot=Math.atan2(dx,-dy),probe={def:v.def,kind:v.kind,rot};
 const steps=Math.max(1,Math.ceil(length/28));
 for(let i=1;i<=steps;i++)if(worldBodyHit(G,probe,v.x+dx*i/steps,v.y+dy*i/steps))return false;
 return true;
}

function boatCorridorClear(G,v,distance){
 const hx=Math.sin(v.rot),hy=-Math.cos(v.rot),probe={kind:v.kind,def:v.def,rot:v.rot};
 for(let d=0;d<=Math.abs(distance);d+=20){
  probe.x=v.x+hx*d*Math.sign(distance);probe.y=v.y+hy*d*Math.sign(distance);
  if(worldBodyHit(G,probe,probe.x,probe.y)||G.vehicles.some(o=>o!==v&&o.def?.boat&&Math.abs(o.x-probe.x)<180&&Math.abs(o.y-probe.y)<180&&bodyContact(probe,o)))return false;
 }
 return true;
}

export function boatPilot(G,v,dt){
 const b=v.pilot||(v.pilot={timer:0,goal:null,wait:0,stuck:0,elapsed:0});b.elapsed+=dt;
 if(b.controls&&b.elapsed<.16)return b.controls;dt=b.elapsed;b.elapsed=0;b.timer-=dt;
 const speed=Math.hypot(v.vx||0,v.vy||0),home=v.home||v;
 const hx=Math.sin(v.rot),hy=-Math.cos(v.rot);b.reverseCooldown=Math.max(0,(b.reverseCooldown||0)-dt);
 if(b.reverse>0){b.reverse-=dt;b.goal=null;if(!boatCorridorClear(G,v,-90)){b.reverse=0;return b.controls={x:0,y:0,brake:true};}return b.controls={x:0,y:-.38,brake:false};}
 // A moored launch can face its pier. Back out through checked water before
 // asking the rudder to turn; turning forward against the bank cannot recover.
 if(speed<18&&!b.reverseCooldown&&!waterPathClear(G,v,v.x+hx*90,v.y+hy*90)&&boatCorridorClear(G,v,-220)){
  b.reverse=2.8;b.reverseCooldown=5;b.goal=null;return b.controls={x:0,y:-.38,brake:false};
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
 let diff=angle(Math.atan2(b.goal.x-v.x,-(b.goal.y-v.y))-v.rot),cap=70;
 const own=bodySize(v);
 for(const other of G.vehicles){
  if(other===v||!other.def?.boat)continue;
  const dx=other.x-v.x,dy=other.y-v.y,ahead=dx*hx+dy*hy,lateral=dx*hy-dy*hx;
  if(ahead>0&&ahead<250&&Math.abs(lateral)<own.w+bodySize(other).w+24){
   const gap=ahead-own.l-bodySize(other).l-20;cap=Math.min(cap,Math.max(0,gap*.75));
   // Both vessels turn to starboard when safe; no head-on left/right oscillation.
   if(gap<130&&waterPathClear(G,v,v.x+Math.sin(v.rot+.5)*150,v.y-Math.cos(v.rot+.5)*150))diff+=.35;
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
 if(!junction)return false;
 const walkSpeed=Math.max(36,(p.walk||32)*1.4);
 const crossingTime=((geometry.exitDistance||((Math.abs(hx)>0?junction.hw:junction.hh)*2))+12)/walkSpeed;
 if(junction.sig){const phase=((G.ticks/60)%16+16)%16,ns=Math.abs(hy)>Math.abs(hx);if(ns?phase>6-crossingTime:phase<8||phase>14-crossingTime)return false;}
 // Test relative motion across the entire crossing, including its far lane.
 // The former curb-only probe let people step into a car arriving mid-crossing.
 let blocked=false;
 const inspect=v=>{
  if(blocked||v.dead||v.def?.boat||v.altitude>10)return;
  const vx=v.vx||0,vy=v.vy||0;if(vx*vx+vy*vy<144)return;
  const dx=p.x-v.x,dy=p.y-v.y,rx=hx*walkSpeed-vx,ry=hy*walkSpeed-vy,den=rx*rx+ry*ry;
  const t=clamp(-(dx*rx+dy*ry)/Math.max(1,den),0,crossingTime);
  if(circleBody(v,p.x+rx*t,p.y+ry*t,14))blocked=true;
 };
 if(G.cityAI?.nearTraffic)G.cityAI.nearTraffic(p.x+hx*walkSpeed*crossingTime/2,p.y+hy*walkSpeed*crossingTime/2,Math.min(1500,700+walkSpeed*crossingTime/2),inspect);
 else for(const v of G.vehicles)inspect(v);
 if(blocked)return false;p._crossAllowed=true;return true;
}

export function escapeHeading(G,p,source){
 const base=Math.atan2(p.x-source.x,-(p.y-source.y));let best=p.rot,score=-Infinity;
 for(const turn of [0,.6,-.6,1.2,-1.2,2,-2,Math.PI]){
  const a=base+turn,x=p.x+Math.sin(a)*42,y=p.y-Math.cos(a)*42;
  if(['build','water','canal'].includes(G.surfaceAt(x,y))||G.solidAt((p.x+x)/2,(p.y+y)/2))continue;
  const value=Math.hypot(x-source.x,y-source.y)-Math.abs(turn)*8;
  if(value>score){score=value;best=a;}
 }return best;
}
