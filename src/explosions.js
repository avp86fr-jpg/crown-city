/* Ground-space blast queries and bounded, simulation-timed effects. */
import {firstSolid} from './combat.js';
import {bodySize,localPoint,segmentBody,segmentCircle} from './collision.js';
import {LIGHT} from './lighting.js';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),TAU=Math.PI*2;
const effects=G=>{const F=G.blastFX||(G.blastFX={bursts:[],scars:[],serial:0});F.debris||(F.debris=[]);return F;};
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
 if(!water&&!b.airborne&&!G.solidAt(b.x,b.y)){if(F.scars.length>=(low?16:40))F.scars.shift();F.scars.push({x:b.x,y:b.y,age:0,radius:b.radius*.32,seed:F.serial,fire:b.source?5:3});}
 // Tumbling debris: hot metal shards and dark chunks that arc out, bounce
 // and stay scattered round the scorch mark (bounded list, sim-timed).
 if(!b.airborne&&!G.settings.reducedMotion){const n=water?0:low?6:12;let seed=F.serial*977;const rnd=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
  for(let i=0;i<n;i++){if(F.debris.length>=(low?36:96))F.debris.shift();const a=rnd()*TAU,sp=90+rnd()*260;
   F.debris.push({x:b.x,y:b.y,z:4,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp*.8,vz:120+rnd()*260,rot:rnd()*TAU,spin:(rnd()-.5)*18,w:3+rnd()*7,h:2+rnd()*4,col:b.source?['#3a3f45','#5c6268','#2a2725','#7a2f22'][i%4]:['#3b3530','#5a5048','#2a2522'][i%3],age:0});}}
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
 if(G.player.type==='foot'&&!(G._endT>0)&&!b.ownerSafe){const strength=blastExposure(G,b,G.player);if(strength){G.health-=G.absorbDamage?G.absorbDamage(G,b.damage*strength):b.damage*strength;G.hurtT=.4;if(G.health<=0)H.wasted(G);}}
}
export function launchRocket(G,x,y,vx,vy,weapon,waterLevel=false){
 const list=G.rockets||(G.rockets=[]);if(list.length>=8)list.shift();
 list.push({x,y,vx,vy,life:weapon.range/weapon.speed,waterLevel,damage:weapon.damage,carDamage:weapon.carDamage,height:23,travel:0,age:0,own:true});
}
export const ROCKET_ARM=60;
export function dud(G,r,H){G.stats&&(G.stats.rocketDuds=(G.stats.rocketDuds||0)+1);G.audio?.impact?.('metal',r.x,r.y,.5);
 for(let i=0;i<6;i++)G.particles?.push({kind:'spark',x:r.x,y:r.y,vx:(Math.random()-.5)*160,vy:(Math.random()-.5)*160,life:.25,maxLife:.25,size:.5});
 G.particles?.push({kind:'smoke',x:r.x,y:r.y,vx:0,vy:-10,life:.9,maxLife:.9,size:1});}
export function tickRockets(G,dt,H){
 const list=G.rockets;if(!list?.length)return;const serial=G.recoverySerial;let n=0;
 for(const r of list){
  const x0=r.x,y0=r.y,step=Math.min(dt,r.life),x1=x0+r.vx*step,y1=y0+r.vy*step,wall=firstSolid(G,x0,y0,x1,y1);let hit=wall??Infinity;
  for(const v of G.vehicles){if(v===G.player||!sameBlastLayer(G,r,v)||Math.abs(v.x-x0)>Math.abs(x1-x0)+100||Math.abs(v.y-y0)>Math.abs(y1-y0)+100)continue;const t=segmentBody(v,x0,y0,x1,y1,2);if(t!==null)hit=Math.min(hit,t);}
  for(const p of G.peds){if(p.dead||!sameBlastLayer(G,r,p)||Math.abs(p.x-x0)>Math.abs(x1-x0)+14||Math.abs(p.y-y0)>Math.abs(y1-y0)+14)continue;const t=segmentCircle(x0,y0,x1,y1,p.x,p.y,12);if(t!==null)hit=Math.min(hit,t);}
  const travel=Math.hypot(x1-x0,y1-y0),t=Number.isFinite(hit)?Math.max(0,hit-2/Math.max(2,travel)):1;
  r.x=x0+(x1-x0)*t;r.y=y0+(y1-y0)*t;r.life-=dt;r.travel=(r.travel||0)+travel*Math.min(1,t);r.age=(r.age||0)+dt;
  // Arming distance: a warhead that strikes something within ROCKET_ARM px of the tube is a dud (thud + sparks)
  // instead of a blast in the shooter's face. Its own blast spares the shooter for the first .35 s of flight.
  if(hit<=1&&r.own&&r.travel<ROCKET_ARM){dud(G,r,H);continue;}
  if(hit<=1||r.life<=0){detonate(G,{...r,radius:145,attributed:true,ownerSafe:r.own&&r.age<.35},H);if(G.recoverySerial!==serial)return;}
  else list[n++]=r;
 }list.length=n;
}
export function tickBlastFX(G,dt){const F=G.blastFX;if(!F)return;let n=0;for(const b of F.bursts){b.age+=dt;if(b.age<(b.water?2.6:1.6))F.bursts[n++]=b;}
F.bursts.length=n;n=0;for(const b of F.scars){b.age+=dt*(G.rainAmt>.3?2:1);if(b.age<40)F.scars[n++]=b;}F.scars.length=n;
 if(F.debris){n=0;for(const d of F.debris){d.age+=dt;if(d.z>0||d.vz>0){d.vz-=620*dt;d.z+=d.vz*dt;d.x+=d.vx*dt;d.y+=d.vy*dt;d.rot+=d.spin*dt;if(d.z<=0){d.z=0;if(Math.abs(d.vz)>90){d.vz=-d.vz*.32;d.vx*=.45;d.vy*=.45;d.spin*=.5;}else d.vz=0;}}if(d.age<30)F.debris[n++]=d;}F.debris.length=n;}}
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
const _flames=[];
// Painted flame tongues (four cached flicker frames): a red-orange body, a
// yellow core and a white-hot base, instead of round fire puffs.
function flameArt(f){
 if(_flames[f])return _flames[f];const cv=document.createElement('canvas');cv.width=48;cv.height=64;const c=cv.getContext('2d');let seed=91+f*37;
 const rnd=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
 const tongue=(x,w,h,cols)=>{const g=c.createLinearGradient(0,62,0,62-h);cols.forEach((k,i)=>g.addColorStop(i/(cols.length-1),k));c.fillStyle=g;c.beginPath();c.moveTo(x-w,62);c.quadraticCurveTo(x-w*1.1,62-h*.45,x+(rnd()-.5)*w*.8,62-h);c.quadraticCurveTo(x+w*1.1,62-h*.45,x+w,62);c.closePath();c.fill();};
 for(let i=0;i<4;i++)tongue(10+i*9+rnd()*4,7+rnd()*4,30+rnd()*26,['rgba(190,52,20,.95)','rgba(236,104,30,.9)','rgba(250,160,50,.55)','rgba(250,160,50,0)']);
 for(let i=0;i<3;i++)tongue(15+i*9+rnd()*3,4+rnd()*2,16+rnd()*14,['rgba(255,250,210,1)','rgba(255,214,90,.95)','rgba(255,190,70,0)']);
 return _flames[f]=cv;
}
let _scorch=null;
function scorchArt(){
 if(_scorch)return _scorch;const cv=document.createElement('canvas');cv.width=cv.height=128;const c=cv.getContext('2d');let seed=771;
 const rnd=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
 const g=c.createRadialGradient(64,64,4,64,64,60);g.addColorStop(0,'rgba(12,10,9,.95)');g.addColorStop(.45,'rgba(24,19,16,.8)');g.addColorStop(.8,'rgba(40,32,26,.35)');g.addColorStop(1,'rgba(40,32,26,0)');
 c.fillStyle=g;c.beginPath();for(let i=0;i<=24;i++){const a=i/24*TAU,r=44+rnd()*18;c.lineTo(64+Math.cos(a)*r,64+Math.sin(a)*r);}c.fill();
 c.strokeStyle='rgba(14,11,9,.4)';c.lineCap='round';for(let i=0;i<10;i++){const a=rnd()*TAU,r0=30+rnd()*10,r1=44+rnd()*12;c.lineWidth=1.5+rnd()*2.5;c.beginPath();c.moveTo(64+Math.cos(a)*r0,64+Math.sin(a)*r0);c.lineTo(64+Math.cos(a+.08)*r1,64+Math.sin(a+.08)*r1);c.stroke();}
 c.fillStyle='rgba(120,96,70,.35)';for(let i=0;i<20;i++){const a=rnd()*TAU,r=rnd()*30;c.fillRect(64+Math.cos(a)*r,64+Math.sin(a)*r,2,2);}
 return _scorch=cv;
}
const inView=(b,r,pad)=>b.x+pad>r.x0&&b.x-pad<r.x1&&b.y+pad>r.y0&&b.y-pad<r.y1;
export function drawBlastFX(G,r,ground=false){
 const F=G.blastFX,c=G.ctx;c.save();
 if(ground){for(const b of F?.scars||[]){if(!inView(b,r,b.radius))continue;c.globalAlpha=Math.min(.85,(40-b.age)/12);const R=b.radius*1.35;c.save();c.translate(b.x,b.y);c.rotate((b.seed||0)*1.7);c.drawImage(scorchArt(),-R,-R*.8,R*2,R*1.6);c.restore();
  // Embers glow in the scar for a few seconds after the blast.
  if(b.age<8){c.globalAlpha=Math.max(0,1-b.age/8)*.8;c.fillStyle='#ff8a3a';for(let i=0;i<7;i++){const a=i*2.1+(b.seed||0),d=b.radius*(.25+(i%3)*.22);if((G.ticks+i*7)%40<30)c.fillRect(b.x+Math.cos(a)*d,b.y+Math.sin(a)*d*.75,2.2,2.2);}}}
 for(const d of F?.debris||[]){if(d.z>0||!inView(d,r,10))continue;c.globalAlpha=Math.min(1,(30-d.age)/4);c.save();c.translate(d.x,d.y);c.rotate(d.rot);c.fillStyle='rgba(0,0,0,.35)';c.fillRect(-d.w/2+1,-d.h/2+1,d.w,d.h);c.fillStyle=d.age<2.5?'#c8622a':d.col;c.fillRect(-d.w/2,-d.h/2,d.w,d.h);if(d.age<2.5){c.globalAlpha*=1-d.age/2.5;c.fillStyle=d.col;c.fillRect(-d.w/2,-d.h/2,d.w,d.h);}c.restore();}
 c.restore();return;}
 for(const b of F?.bursts||[]){if(!inView(b,r,b.radius*1.5))continue;const t=b.age,spread=b.radius*(.2+Math.min(t,.5)*1.2);
  // Shock: a white-hot core flash, a crisp fast ring and a slower dust ring.
  if(t<.14){c.globalAlpha=(1-t/.14)*.9;c.drawImage(LIGHT.radial('rgba(255,246,214,0.95)',96),b.x-b.radius*.9,b.y-b.radius*.6,b.radius*1.8,b.radius*1.2);}
  if(t<.42){const k=t/.42,R=b.radius*(.3+k*1.5);c.strokeStyle=b.water?'#eaffff':'#fff1cf';c.globalAlpha=(1-k)*.85;c.lineWidth=7*(1-k)+1;c.beginPath();c.ellipse(b.x,b.y,R,R*.62,0,0,TAU);c.stroke();}
  if(t<1.1){const k=t/1.1,R=b.radius*(.4+k*1.25);c.strokeStyle=b.water?'#a9d7dc':'#b89a78';c.globalAlpha=(1-k)*.45;c.lineWidth=10*(1-k)+2;c.beginPath();c.ellipse(b.x,b.y,R,R*.6,0,0,TAU);c.stroke();}
  if(b.water){
   // Water: a tall white column that collapses, then three spreading rings.
   for(let i=0;i<3;i++){const k=(t-i*.35)/1.9;if(k<=0||k>=1)continue;const R=b.radius*(.35+k*1.35);c.strokeStyle='#e6fbff';c.globalAlpha=(1-k)*.6;c.lineWidth=3*(1-k)+1;c.beginPath();c.ellipse(b.x,b.y,R,R*.58,0,0,TAU);c.stroke();}
   if(t<1.3){const k=t/1.3,hgt=b.radius*1.5*Math.sin(Math.min(1,k*1.6)*Math.PI/2)*(1-k*.55),w=b.radius*(.45+k*.5);c.globalAlpha=Math.min(1,(1.3-t)*2.2);c.drawImage(burstArt('water'),b.x-w/2,b.y-hgt,w,hgt*1.1);
    c.fillStyle='#f4ffff';for(let i=0;i<14;i++){const a=i*.9+b.seed,d=k*b.radius*(.5+(i%4)*.18);c.globalAlpha=(1-k)*.9;c.fillRect(b.x+Math.cos(a)*d,b.y+Math.sin(a)*d*.6-hgt*(1-k)*.6+k*k*40,2.4,2.4);}}
  }
  // Textured cloud paintings are cached once, replacing many translucent
  // circles and canvas passes per blast on mobile.
  const size=Math.max(spread,b.radius*.55)*2.1,lift=t*25;
  c.globalAlpha=Math.min(1,.4+t*2)*Math.max(0,1-t/1.25);c.drawImage(burstArt(b.water?'water':'smoke'),b.x-size*.5,b.y-size*.5-lift,size,size);
  if(!b.water&&t<.55){const k=Math.min(1,(.55-t)*4);c.globalAlpha=k;c.drawImage(burstArt('fire'),b.x-size*.5,b.y-size*.55-lift,size,size);
   c.globalCompositeOperation='lighter';c.globalAlpha=k*.75;c.drawImage(LIGHT.radial('rgba(255,200,110,0.9)',96),b.x-size*.6,b.y-size*.62-lift,size*1.2,size*1.2);c.globalCompositeOperation='source-over';}
  if(!b.water&&t<.9){c.globalAlpha=1-t/.9;c.fillStyle='#ffd27a';for(let i=0;i<10;i++){const a=i*1.37+b.seed*2,d=t*b.radius*1.6*(.55+(i%4)*.15);c.fillRect(b.x+Math.cos(a)*d,b.y+Math.sin(a)*d*.7-t*30,3,3);}}
  if(!b.water&&t<.7){c.globalAlpha=1-t/.7;c.fillStyle='#dd9b56';for(let i=0;i<6;i++){const a=i*2.4+b.seed,d=t*120*(.6+i%3*.2);c.fillRect(b.x+Math.cos(a)*d,b.y+Math.sin(a)*d-t*40+t*t*90,2,2);}}
 }
 for(const b of F?.scars||[]){if(b.age>=(b.fire||3)||!inView(b,r,b.radius*2))continue;const fade=Math.min(1,(b.fire-b.age)/1.2),fr=G.settings.reducedMotion?0:(G.ticks>>3);
  for(let i=0;i<4;i++){const a=i*2.3+b.seed,d=b.radius*.6*(i?1:.15),k=(1.1-i*.17)*fade,w=b.radius*.75*k,h=b.radius*1.0*k,x=b.x+Math.cos(a)*d,y=b.y+Math.sin(a)*d*.7;c.globalAlpha=Math.min(1,fade*1.2);c.drawImage(flameArt((fr+i)%4),x-w/2,y-h*.92,w,h);}}
 for(const d of F?.debris||[]){if(d.z<=0||!inView(d,r,40))continue;c.save();c.globalAlpha=.3;c.fillStyle='#000';c.fillRect(d.x-d.w/2,d.y-d.h/2,d.w,d.h);c.globalAlpha=1;c.translate(d.x,d.y-d.z*.55);c.rotate(d.rot);c.fillStyle=d.age<1.2?'#ffb35c':d.col;c.fillRect(-d.w/2,-d.h/2,d.w,d.h);c.fillStyle='rgba(255,255,255,.25)';c.fillRect(-d.w/2,-d.h/2,d.w,1);c.restore();}
 for(const p of G.rockets||[]){if(!inView(p,r,60))continue;const a=Math.atan2(p.vy,p.vx),t=G.settings.reducedMotion?0:G.ticks%3;
  c.save();c.globalAlpha=1;c.translate(p.x,p.y-p.height);c.rotate(a);c.fillStyle='#f5ba67';c.beginPath();c.moveTo(-7,-2);c.lineTo(-22-t*3,0);c.lineTo(-7,2);c.fill();c.fillStyle='#dae0c6';c.fillRect(-7,-2,12,4);c.fillStyle='#5b6752';c.beginPath();c.moveTo(5,-3);c.lineTo(11,0);c.lineTo(5,3);c.fill();c.restore();
 }c.restore();
}
