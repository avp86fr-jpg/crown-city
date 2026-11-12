/* Ground-space combat queries; visual muzzle height never changes hit detection. */
import {aimDirection} from './controls.js';
import {screenToWorld} from './session.js';
const angle=x=>Math.atan2(Math.sin(x),Math.cos(x));
export function playerAim(G,actor,onFoot=actor.type==='foot'){
 const height=onFoot?23:14,I=G.input,mouse=!G.touch&&I.mouse.fire;
 let rot=G.touch?aimDirection(I,actor.rot,G.cam.rot):actor.rot,distance=300;
 if(mouse){const p=screenToWorld(G,I.mouse.x,I.mouse.y),dx=p.x-actor.x,dy=p.y+height-actor.y;rot=Math.atan2(dx,-dy);distance=Math.hypot(dx,dy);}
 // Mouse placement is authoritative. Directional touch aim gets only a small
 // correction toward the most aligned visible threat, never the nearest off-axis one.
 let target=null;
 if(onFoot&&!mouse&&G.settings.aimAssist!==false){
  const directed=G.touch&&I.touchAim?.aiming,cone=directed?.10:G.touch?.23:.10;let score=Infinity;
  const consider=t=>{if(!t||t.dead)return;const dx=t.x-actor.x,dy=t.y-actor.y,d=Math.hypot(dx,dy),a=Math.atan2(dx,-dy),error=angle(a-rot),s=Math.abs(error)+d*.00004;
   if(d<20||d>420||Math.abs(error)>cone||s>=score||firstSolid(G,actor.x,actor.y,t.x,t.y)!==null)return;target={actor:t,error};score=s;};
  for(const t of G.cops||[])consider(t);for(const t of G.peds||[])if(t.copPed)consider(t);
  if(G._flow?.objectives[G.objectiveIndex]?.kind==='intercept')consider(G.van);
  if(target){const limit=directed?.035:G.touch?.14:.055;rot+=Math.max(-limit,Math.min(limit,target.error));}
 }
 return {rot,distance:Math.max(24,distance),height,target:target?.actor||null,manual:mouse};
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
