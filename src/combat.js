/* Ground-space combat queries; visual muzzle height never changes hit detection. */
import {aimDirection} from './controls.js';
import {screenToWorld} from './session.js';
const angle=x=>Math.atan2(Math.sin(x),Math.cos(x));
export function playerAim(G,actor,onFoot=actor.type==='foot'){
 const height=onFoot?23:14,I=G.input,mouse=!G.touch&&I.mouse.fire;
 let rot=G.touch?aimDirection(I,actor.rot,G.cam.rot):actor.rot,distance=300;
 if(mouse){const p=screenToWorld(G,I.mouse.x,I.mouse.y),dx=p.x-actor.x,dy=p.y+height-actor.y;rot=Math.atan2(dx,-dy);distance=Math.hypot(dx,dy);}
 if(!onFoot&&actor.def&&!actor.def.aircraft){const d=driveByAim(G,actor,mouse?rot:null);return {rot:d.rot,distance,height,target:null,manual:mouse,side:d.side};}
 // Mouse placement is authoritative. Directional touch aim gets only a small
 // correction toward the most aligned visible threat, never the nearest off-axis one.
 let target=null;
 if(onFoot&&!mouse&&G.settings.aimAssist!==false){
  const directed=G.touch&&I.touchAim?.aiming,cone=directed?.10:G.touch?.23:.10;let score=Infinity;
  const consider=t=>{if(!t||t.dead)return;const dx=t.x-actor.x,dy=t.y-actor.y,d=Math.hypot(dx,dy),a=Math.atan2(dx,-dy),error=angle(a-rot),s=Math.abs(error)+d*.00004;
   if(d<20||d>420||Math.abs(error)>cone||s>=score||firstSolid(G,actor.x,actor.y,t.x,t.y)!==null)return;target={actor:t,error};score=s;};
  for(const t of G.cops||[])consider(t);for(const t of G.peds||[])if(t.copPed||t.gang&&t.squad?.hostile)consider(t);
  if(G._flow?.objectives[G.objectiveIndex]?.kind==='intercept')consider(G.van);
  if(target){const limit=directed?.035:G.touch?.14:.055;rot+=Math.max(-limit,Math.min(limit,target.error));}
 }
 return {rot,distance:Math.max(24,distance),height,target:target?.actor||null,manual:mouse};
}
// Drive-by: the driver leans out of a side window. Aim is limited to side arcs
// (no shooting through the windscreen); touch/keyboard picks the best threat on
// either side, otherwise the driver's window (left) slightly forward.
export function driveByAim(G,v,mouseRot=null){
 const bike=!!v.def?.bike,minA=bike?.35:.62,maxA=bike?2.75:2.55,rel=a=>angle(a-v.rot);
 let best=null,score=Infinity;
 const consider=t=>{if(!t||t.dead||t===v)return;const dx=t.x-v.x,dy=t.y-v.y,d=Math.hypot(dx,dy);if(d<30||d>460)return;
  const a=Math.atan2(dx,-dy),r=Math.abs(rel(a));if(r<minA*.8||r>maxA)return;const s=d+r*40;if(s<score&&firstSolid(G,v.x,v.y,t.x,t.y)===null){score=s;best=a;}};
 if(mouseRot===null){for(const t of G.cops||[])consider(t);for(const t of G.peds||[])if(t.copPed||t.gang&&t.squad?.hostile)consider(t);if(G.van)consider(G.van);}
 let r=mouseRot!==null?rel(mouseRot):best!==null?rel(best):-(Math.PI/2-.18)*(v.driveSide||1);
 const side=r>=0?1:-1;r=side*Math.max(minA,Math.min(maxA,Math.abs(r)));
 v.driveSide=side;return {rot:v.rot+r,side,target:best!==null};
}
export function windowPoint(v,side){
 // Driver's hand just outside the window line, a little ahead of the B-pillar.
 const bike=!!v.def?.bike,w=bike?13:(v.kind==='bus'?30:v.kind==='van'||v.kind==='ambulance'?27:25),fwd=bike?2:8;
 const c=Math.cos(v.rot),s=Math.sin(v.rot);
 return {x:v.x+c*w*side+Math.sin(v.rot)*fwd,y:v.y+s*w*side-Math.cos(v.rot)*fwd};
}
export function firstSolid(G,x0,y0,x1,y1){
 const dx=x1-x0,dy=y1-y0,steps=Math.max(1,Math.ceil(Math.hypot(dx,dy)/3));
 for(let i=0;i<=steps;i++){const t=i/steps;if(!G.solidAt(x0+dx*t,y0+dy*t))continue;
  let lo=Math.max(0,(i-1)/steps),hi=t;for(let j=0;j<4;j++){const m=(lo+hi)/2;if(G.solidAt(x0+dx*m,y0+dy*m))hi=m;else lo=m;}
  return hi;
 }return null;
}
export function shotSpread(G,weapon,actor){
 const movement=actor.type==='foot'?Math.min(1,(actor.speed||0)/175):Math.min(1,Math.hypot(actor.vx||0,actor.vy||0)/260);
 return weapon.spread*(1+movement*.85+(G.action?.bloom||0)*1.4)*(G.action?.cover?.8:1);
}
export function projectileDamage(b){
 const falloff=b.falloff;if(!falloff)return b.damage||20;
 const t=Math.max(0,Math.min(1,((b.travel||0)-falloff)/(Math.max(falloff+1,b.range||560)-falloff)));
 return (b.damage||20)*(1-t*.65);
}
