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
 if(v.def.boat){drawHullWear(ctx,w,l,d,v.dead);return;}
 if(v.def.bike){drawBikeWear(ctx,w,l,d,v.dead);return;}
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
 // Dented panels catch a pale highlight along the crumple edge.
 if(wear>.2&&!v.dead){ctx.strokeStyle=`rgba(232,236,228,${.25+wear*.4})`;ctx.lineWidth=.8;ctx.beginPath();ctx.moveTo(-w*.5,-l*.62);ctx.quadraticCurveTo(-w*.1,-l*(.55-wear*.12),w*.45,-l*.64);ctx.stroke();
  ctx.fillStyle=`rgba(8,12,15,${.12+wear*.25})`;ctx.beginPath();ctx.ellipse(w*.32,l*.1,w*.22,l*.14,.4,0,Math.PI*2);ctx.ellipse(-w*.36,-l*.2,w*.18,l*.12,-.3,0,Math.PI*2);ctx.fill();}
 // Smashed glass: frosted, crazed windscreen, then the rear screen too.
 if(wear>.5&&!v.def.bike){
  const glass=(y0,y1,seed)=>{ctx.fillStyle=v.dead?'rgba(30,34,36,.65)':'rgba(206,226,232,.34)';ctx.beginPath();ctx.moveTo(-w*.48,y0);ctx.lineTo(w*.48,y0);ctx.lineTo(w*.42,y1);ctx.lineTo(-w*.42,y1);ctx.closePath();ctx.fill();
   ctx.strokeStyle='rgba(236,246,248,.8)';ctx.lineWidth=.6;const cx=w*(seed-.5)*.5,cy=(y0+y1)/2;ctx.beginPath();
   for(let k=0;k<7;k++){const a=k/7*Math.PI*2+seed;ctx.moveTo(cx,cy);ctx.lineTo(cx+Math.cos(a)*w*.42,cy+Math.sin(a)*Math.abs(y1-y0)*.62);}ctx.stroke();
   ctx.fillStyle='rgba(255,255,255,.9)';for(let k=0;k<4;k++)ctx.fillRect(cx+Math.cos(k*1.9+seed)*w*.25,cy+Math.sin(k*2.3)*2,1,1);};
  glass(-l*.4,-l*.16,.3);if(wear>.72||v.dead)glass(l*.42,l*.58,.7);
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

function drawHullWear(ctx,w,l,d,dead){
 // Gelcoat scuffs follow the tapered hull. A launch has no car hood, lamp
 // rectangles or windshield-sized overlay across its passenger deck.
 ctx.save();ctx.lineJoin='round';
 for(const [side,amount] of Object.entries(d)){
  const a=dead?1:amount;if(a<.08)continue;ctx.save();
  ctx.strokeStyle=`rgba(19,34,38,${.45+a*.4})`;ctx.lineWidth=1.4+a*1.7;
  if(side==='left'||side==='right'){
   const sign=side==='left'?-1:1;ctx.beginPath();ctx.moveTo(sign*w*.5,-l*.62);ctx.lineTo(sign*w*(.85-a*.15),-l*.2);ctx.lineTo(sign*w*.77,l*.4);ctx.stroke();
   ctx.strokeStyle='#d1c8a9';ctx.lineWidth=.8;ctx.beginPath();ctx.moveTo(sign*w*.65,-l*.2);ctx.lineTo(sign*w*.55,l*.13);ctx.lineTo(sign*w*.7,l*.36);ctx.stroke();
  }else{
   const y=side==='front'?-l*.68:l*.65,width=side==='front'?w*.38:w*.68;
   ctx.beginPath();ctx.moveTo(-width,y);ctx.lineTo(-width*.2,y+a*5);ctx.lineTo(width*.25,y-3);ctx.lineTo(width,y+2);ctx.stroke();
  }ctx.restore();
 }
 if(dead){ctx.fillStyle='rgba(13,27,29,.5)';ctx.beginPath();ctx.ellipse(0,l*.18,w*.55,l*.31,0,0,Math.PI*2);ctx.fill();}
 ctx.restore();
}
function drawBikeWear(ctx,w,l,d,dead){
 // Compact tank/fork damage, rather than scaled-down car panels and glass.
 ctx.save();ctx.strokeStyle='#253039';ctx.lineWidth=1.5;
 if(d.front>.12||dead){const bend=dead?5:d.front*5;ctx.beginPath();ctx.moveTo(-w*.55,-l*.22);ctx.lineTo(-w*.45+bend,-l*.78);ctx.moveTo(w*.55,-l*.22);ctx.lineTo(w*.45+bend,-l*.78);ctx.stroke();}
 ctx.strokeStyle='rgba(194,184,155,.85)';ctx.lineWidth=.9;
 if(d.left>.08||d.right>.08||dead){const sign=d.left>d.right?-1:1;ctx.beginPath();ctx.moveTo(sign*w*.55,-l*.12);ctx.lineTo(-sign*w*.15,l*.08);ctx.lineTo(sign*w*.3,l*.2);ctx.stroke();}
 if(d.rear>.12||dead){ctx.strokeStyle='#1b252b';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-w*.4,l*.58);ctx.lineTo(w*.35,l*.68);ctx.stroke();}
 ctx.restore();
}
