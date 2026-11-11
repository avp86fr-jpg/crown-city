/* Persistent panel damage and predictable handling. Rendering uses the original
   vehicle artwork at every condition, including bikes, launches and buses. */
import {bodySize,localPoint} from './collision.js';
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const HEALTHY=Object.freeze({health:1,wear:0,power:1,top:1,grip:1,brake:1,label:'GOOD'});
export function vehicleCondition(v){
 if((v.health??100)>=99&&!v.dead)return HEALTHY;
 const health=clamp((v.health??100)/100),wear=clamp((.65-health)/.65);
 return {health,wear,power:1-wear*.48,top:1-wear*.32,grip:1-wear*.18,brake:1-wear*.15,
  label:v.dead?'WRECKED':health<.12?'ENGINE FIRE':health<.35?'CRITICAL':health<.65?'DAMAGED':health<.88?'SCUFFED':'GOOD'};
}
export function damageSnapshot(v){
 if(!v.damage||v.health>=99)return null;
 return Object.fromEntries(['front','rear','left','right'].map(k=>[k,clamp(Number(v.damage[k])||0)]));
}
export function restoreDamage(v,s){
 v.damage={front:0,rear:0,left:0,right:0};
 if(s&&v.health<99)for(const k of Object.keys(v.damage))v.damage[k]=clamp(Number(s[k])||0);
 v.damageStage=vehicleCondition(v).label;
}
export function recordVehicleDamage(v,amount,point){
 if(!Number.isFinite(amount)||amount<=0||v.dead)return null;
 if(!v.damage||v.health>=99)restoreDamage(v);
 const body=bodySize(v),p=point?localPoint(v,point.x,point.y):{x:0,y:-body.l};
 const panel=Math.abs(p.x/body.w)>Math.abs(p.y/body.l)?p.x<0?'left':'right':p.y<0?'front':'rear';
 v.damage[panel]=clamp(v.damage[panel]+amount/65);
 if(amount>18){const adjacent=panel==='front'||panel==='rear'?(p.x<0?'left':'right'):'front';v.damage[adjacent]=clamp(v.damage[adjacent]+amount/220);}
 const previous=vehicleCondition(v).label;v.health=clamp((v.health??100)-amount,0,100);
 v.damageStage=vehicleCondition(v).label;v.damagePulse=.18;
 return {panel,previous,stage:v.damageStage};
}
export function drawVehicleDamage(ctx,v){
 if(v.health>=88&&!v.dead)return;
 const b=bodySize(v),w=b.w,l=b.l,wear=1-clamp((v.health??100)/100);
 const d=v.damage||{front:wear,rear:wear*.3,left:wear*.45,right:wear*.25};
 ctx.save();ctx.lineJoin='round';
 // Crumpled panel seams remain aligned with the actual impact face.
 for(const [side,amount] of Object.entries(d)){
  if(amount<.08&&!v.dead)continue;
  const a=v.dead?1:amount;ctx.save();
  if(side==='rear')ctx.rotate(Math.PI);
  if(side==='left'||side==='right'){
   const sign=side==='left'?-1:1;ctx.strokeStyle='rgba(11,18,22,.88)';ctx.lineWidth=2+a*3;
   ctx.beginPath();ctx.moveTo(sign*w*.88,-l*.5);ctx.lineTo(sign*(w*(.88-a*.3)),-l*.18);ctx.lineTo(sign*w*.86,l*.16);ctx.lineTo(sign*(w*(.84-a*.18)),l*.48);ctx.stroke();
   ctx.strokeStyle='#99a6a3';ctx.lineWidth=.7;ctx.beginPath();ctx.moveTo(sign*w*.78,-l*.34);ctx.lineTo(sign*w*.57,l*.04);ctx.lineTo(sign*w*.77,l*.27);ctx.stroke();
  }else{
   ctx.fillStyle=`rgba(12,21,26,${.18+a*.45})`;ctx.beginPath();ctx.moveTo(-w*.68,-l*.83);ctx.lineTo(-w*.25,-l*(.86-a*.14));ctx.lineTo(w*.33,-l*.89);ctx.lineTo(w*.71,-l*(.76-a*.14));ctx.lineTo(w*.65,-l*.5);ctx.lineTo(-w*.63,-l*.52);ctx.closePath();ctx.fill();
   ctx.strokeStyle='rgba(181,191,181,.78)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(-w*.62,-l*.72);ctx.lineTo(-w*.18,-l*.56);ctx.lineTo(w*.19,-l*.76);ctx.lineTo(w*.59,-l*.57);ctx.stroke();
   if(a>.45){ctx.fillStyle='#101b20';ctx.fillRect(-w*.58,-l*.81,w*.36,4);}
  }ctx.restore();
 }
 if(wear>.35&&!v.def.bike){
  ctx.strokeStyle='rgba(181,224,222,.82)';ctx.lineWidth=.75;const x=-w*.14,y=-l*.24;
  ctx.beginPath();ctx.moveTo(x-w*.31,y-l*.11);ctx.lineTo(x,y);ctx.lineTo(x+w*.39,y-l*.07);ctx.moveTo(x,y);ctx.lineTo(x-w*.19,y+l*.11);ctx.moveTo(x,y);ctx.lineTo(x+w*.14,y+l*.12);ctx.stroke();
 }
 if(v.dead){
  ctx.fillStyle='rgba(10,16,18,.55)';ctx.beginPath();ctx.ellipse(0,-l*.12,w*.65,l*.58,0,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle='#a18c68';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-w*.65,-l*.64);ctx.lineTo(-w*.2,-l*.4);ctx.lineTo(w*.5,-l*.62);ctx.stroke();
 }ctx.restore();
}
