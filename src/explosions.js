/* Ground-space blast queries and bounded, simulation-timed effects. */
import {firstSolid} from './combat.js';
import {bodySize,localPoint,segmentBody,segmentCircle} from './collision.js';
import {LIGHT} from './lighting.js';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),TAU=Math.PI*2;
const effects=G=>G.blastFX||(G.blastFX={bursts:[],scars:[],serial:0});
export function onBridge(G,x,y){const E=G.world?.expansion;return !!E&&[E.bridges,E.riverBridges].some(list=>list?.some(r=>x>=r.x&&x<=r.x+r.w&&y>=r.y&&y<=r.y+r.h));}
export function sameBlastLayer(G,b,t){return !(t.def?.aircraft&&t.altitude>10)&&(!onBridge(G,t.x,t.y)||!!b.waterLevel===!!t.def?.boat);}
// Measure from the exposed hull, so a long bus does not absorb a direct hit
// merely because its centre lies outside the damage radius.
export function blastExposure(G,b,t){
 if(!sameBlastLayer(G,b,t))return 0;
 let x=t.x,y=t.y;
 if(t.def){const p=localPoint(t,b.x,b.y),s=bodySize(t),lx=clamp(p.x,-s.w,s.w),ly=clamp(p.y,-s.l,s.l),co=Math.cos(t.rot),sn=Math.sin(t.rot);x=t.x+lx*co-ly*sn;y=t.y+lx*sn+ly*co;}
 const d=Math.hypot(x-b.x,y-b.y);if(d>=b.radius||firstSolid(G,b.x,b.y,x,y)!==null)return 0;
 return (1-d/b.radius)**.8;
}
export function detonate(G,b,H){
 const F=effects(G),low=G.settings.quality==='low',water=!onBridge(G,b.x,b.y)&&['water','canal'].includes(G.surfaceAt(b.x,b.y));
 if(F.bursts.length>=(low?8:20))F.bursts.shift();F.bursts.push({x:b.x,y:b.y,age:0,radius:b.radius,water,seed:++F.serial});
 if(!water&&!b.airborne&&!G.solidAt(b.x,b.y)){if(F.scars.length>=(low?16:40))F.scars.shift();F.scars.push({x:b.x,y:b.y,age:0,radius:b.radius*.32});}
 const distance=Math.hypot(G.player.x-b.x,G.player.y-b.y);
 G.audio?.boom?.(b.x,b.y);if(distance<650)H.shake?.(G,(1-distance/650)*12);
 if(G.flashes.length>=(low?24:64))G.flashes.shift();
 if(!G.settings.reducedMotion)G.flashes.push({x:b.x,y:b.y,r:b.radius*2,col:'rgba(255,180,80,0.8)',life:.22,max:.22});
 H.scare?.(G,b.x,b.y,420);if(b.airborne)return;
 for(const v of G.vehicles){if(v.dead||v===b.source)continue;const strength=blastExposure(G,b,v);if(!strength)continue;
  H.damageVeh(G,v,b.carDamage*strength,!!b.attributed,b);
  const dx=v.x-b.x,dy=v.y-b.y,d=Math.hypot(dx,dy)||1,impulse=70*strength/Math.max(.7,v.def.mass||1);
  v.vx+=dx/d*impulse;v.vy+=dy/d*impulse;v.loose=true;v.parked=false;
 }
 for(const p of G.peds){if(p.dead)continue;const strength=blastExposure(G,b,p);if(!strength)continue;
  p.hp=(p.hp??30)-b.damage*strength;p.flee=5;p.threatX=b.x;p.threatY=b.y;
  const d=Math.hypot(p.x-b.x,p.y-b.y)||1;p.vx=(p.x-b.x)/d*95*strength;p.vy=(p.y-b.y)/d*95*strength;
  if(b.attributed&&!p.copPed)H.incident?.(G,'civilian_harm');
  if(p.hp<=0)H.killPed(G,p,false,!!b.attributed);else H.blood?.(G,p,p.vx,p.vy,strength);
 }
 if(G.player.type==='foot'&&!(G._endT>0)){const strength=blastExposure(G,b,G.player);if(strength){G.health-=G.absorbDamage?G.absorbDamage(G,b.damage*strength):b.damage*strength;G.hurtT=.4;if(G.health<=0)H.wasted(G);}}
}
export function launchRocket(G,x,y,vx,vy,weapon,waterLevel=false){
 const list=G.rockets||(G.rockets=[]);if(list.length>=8)list.shift();
 list.push({x,y,vx,vy,life:weapon.range/weapon.speed,waterLevel,damage:weapon.damage,carDamage:weapon.carDamage,height:23});
}
export function tickRockets(G,dt,H){
 const list=G.rockets;if(!list?.length)return;const serial=G.recoverySerial;let n=0;
 for(const r of list){
  const x0=r.x,y0=r.y,step=Math.min(dt,r.life),x1=x0+r.vx*step,y1=y0+r.vy*step,wall=firstSolid(G,x0,y0,x1,y1);let hit=wall??Infinity;
  for(const v of G.vehicles){if(v===G.player||!sameBlastLayer(G,r,v)||Math.abs(v.x-x0)>Math.abs(x1-x0)+100||Math.abs(v.y-y0)>Math.abs(y1-y0)+100)continue;const t=segmentBody(v,x0,y0,x1,y1,2);if(t!==null)hit=Math.min(hit,t);}
  for(const p of G.peds){if(p.dead||!sameBlastLayer(G,r,p)||Math.abs(p.x-x0)>Math.abs(x1-x0)+14||Math.abs(p.y-y0)>Math.abs(y1-y0)+14)continue;const t=segmentCircle(x0,y0,x1,y1,p.x,p.y,12);if(t!==null)hit=Math.min(hit,t);}
  const travel=Math.hypot(x1-x0,y1-y0),t=Number.isFinite(hit)?Math.max(0,hit-2/Math.max(2,travel)):1;
  r.x=x0+(x1-x0)*t;r.y=y0+(y1-y0)*t;r.life-=dt;
  if(hit<=1||r.life<=0){detonate(G,{...r,radius:145,attributed:true},H);if(G.recoverySerial!==serial)return;}
  else list[n++]=r;
 }list.length=n;
}
export function tickBlastFX(G,dt){const F=G.blastFX;if(!F)return;let n=0;for(const b of F.bursts){b.age+=dt;if(b.age<1.25)F.bursts[n++]=b;}F.bursts.length=n;n=0;for(const b of F.scars){b.age+=dt*(G.rainAmt>.3?2:1);if(b.age<40)F.scars[n++]=b;}F.scars.length=n;}
const burstSprites=new Map();
function burstArt(kind){
 if(burstSprites.has(kind))return burstSprites.get(kind);
 const canvas=document.createElement('canvas');canvas.width=canvas.height=160;const c=canvas.getContext('2d');let seed=3149;
 const rnd=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
 for(let i=0;i<58;i++){const a=rnd()*TAU,d=Math.sqrt(rnd())*47,x=80+Math.cos(a)*d,y=80+Math.sin(a)*d*.8,r=11+rnd()*20;
  const g=c.createRadialGradient(x-r*.18,y-r*.2,0,x,y,r);
  if(kind==='fire'){g.addColorStop(0,d<30?'#fff0b3':'#f9bd51');g.addColorStop(.28,'#f79b32');g.addColorStop(.68,'rgba(187,61,20,.82)');g.addColorStop(1,'rgba(95,38,24,0)');}
  else {g.addColorStop(0,kind==='water'?'rgba(209,229,228,.7)':'rgba(87,79,70,.8)');g.addColorStop(.55,kind==='water'?'rgba(120,161,168,.48)':'rgba(43,40,38,.62)');g.addColorStop(1,'rgba(28,29,30,0)');}
  c.fillStyle=g;c.fillRect(x-r,y-r,r*2,r*2);
 }burstSprites.set(kind,canvas);return canvas;
}
const inView=(b,r,pad)=>b.x+pad>r.x0&&b.x-pad<r.x1&&b.y+pad>r.y0&&b.y-pad<r.y1;
export function drawBlastFX(G,r,ground=false){
 const F=G.blastFX,c=G.ctx;c.save();
 if(ground){for(const b of F?.scars||[]){if(!inView(b,r,b.radius))continue;c.globalAlpha=Math.min(.6,(40-b.age)/12);c.drawImage(LIGHT.radial('rgba(17,14,12,0.8)',96),b.x-b.radius,b.y-b.radius*.6,b.radius*2,b.radius*1.2);}c.restore();return;}
 for(const b of F?.bursts||[]){if(!inView(b,r,b.radius*1.5))continue;const t=b.age,spread=b.radius*(.2+Math.min(t,.5)*1.2);
  c.strokeStyle=b.water?'#c4e3e5':'#f3c896';c.globalAlpha=Math.max(0,1-t*2.6)*.5;c.lineWidth=2;c.beginPath();c.ellipse(b.x,b.y,spread*1.2,spread*.65,0,0,TAU);c.stroke();
  // Textured cloud paintings are cached once, replacing many translucent
  // circles and canvas passes per blast on mobile.
  const size=spread*2.1,lift=t*25;
  c.globalAlpha=Math.min(1,.4+t*2)*Math.max(0,1-t/1.25);c.drawImage(burstArt(b.water?'water':'smoke'),b.x-size*.5,b.y-size*.5-lift,size,size);
  if(!b.water&&t<.48){c.globalAlpha=Math.min(1,(.48-t)*4);c.drawImage(burstArt('fire'),b.x-size*.44,b.y-size*.48-lift,size*.88,size*.88);}
  if(!b.water&&t<.7){c.globalAlpha=1-t/.7;c.fillStyle='#dd9b56';for(let i=0;i<6;i++){const a=i*2.4+b.seed,d=t*120*(.6+i%3*.2);c.fillRect(b.x+Math.cos(a)*d,b.y+Math.sin(a)*d-t*40+t*t*90,2,2);}}
 }
 for(const p of G.rockets||[]){if(!inView(p,r,60))continue;const a=Math.atan2(p.vy,p.vx),t=G.settings.reducedMotion?0:G.ticks%3;
  c.save();c.globalAlpha=1;c.translate(p.x,p.y-p.height);c.rotate(a);c.fillStyle='#f5ba67';c.beginPath();c.moveTo(-7,-2);c.lineTo(-22-t*3,0);c.lineTo(-7,2);c.fill();c.fillStyle='#dae0c6';c.fillRect(-7,-2,12,4);c.fillStyle='#5b6752';c.beginPath();c.moveTo(5,-3);c.lineTo(11,0);c.lineTo(5,3);c.fill();c.restore();
 }c.restore();
}
