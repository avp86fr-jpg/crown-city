/* Pursuit depth: spike strips laid ahead of roadblocks (flat tyres cap speed
   and throw sparks until a respray), dispatch radio calls when heat rises,
   and an evasion tally for the stats page. Bounded lists, sim-timed. */
import {districtAt} from './world.js';
const TAU=Math.PI*2;
export function laySpikes(G,x,y,rot){
 const S=G.spikes||(G.spikes=[]);if(S.length>=4)S.shift();
 S.push({x,y,rot,len:170,t:30,hit:new Set()});
}
const CALLS=['Dispatch: all units, white helm, purple coat — {d}.','Dispatch: suspect heading through {d}, units converge.','Dispatch: shots reported in {d}. Air unit en route.','Dispatch: spike strips authorised. Box them in near {d}.','Dispatch: lethal force cleared. Suspect last seen {d}.'];
export function tickPursuit(G,dt){
 const P=G.player,S=G.spikes;
 // Spike strips: any car crossing one gets flat tyres (player and traffic).
 if(S?.length){let n=0;for(const s of S){s.t-=dt;if(s.t<=0||G.wanted===0&&s.t<26)continue;S[n++]=s;
  const hx=Math.cos(s.rot),hy=Math.sin(s.rot);
  for(const v of G.vehicles){if(v.dead||v.def?.boat||v.def?.aircraft||v.jumpH>0||s.hit.has(v)||v.cop)continue;const dx=v.x-s.x,dy=v.y-s.y;if(Math.abs(dx*hx+dy*hy)>s.len/2+6||Math.abs(-dx*hy+dy*hx)>14)continue;
   if(Math.hypot(v.vx||0,v.vy||0)<20)continue;s.hit.add(v);v.flat=true;G.audio?.contact?.({speed:200,material:'metal',source:v,x:v.x,y:v.y});
   for(let i=0;i<8;i++)G.particles.push({kind:'spark',x:v.x,y:v.y,vx:(Math.random()-.5)*160,vy:(Math.random()-.5)*160,life:.3});
   if(v===P){G.toast='Spike strip! Tyres shredded — get a respray or swap cars.';G.toastT=3.2;G.cam.shake=Math.max(G.cam.shake||0,5);}}}
  S.length=n;}
 // Flat tyres: speed cap, a little wobble, rim sparks at speed.
 for(const v of G.vehicles){if(!v.flat||v.dead)continue;const sp=Math.hypot(v.vx||0,v.vy||0),cap=(v.def?.max||200)*.5;
  if(sp>cap){const k=Math.max(cap/sp,1-dt*1.6);v.vx*=k;v.vy*=k;}
  if(sp>60&&!G.settings.reducedMotion){if(v===P)v.rot+=Math.sin(G.ticks*.5)*.004*(sp/cap);if(G.ticks%4===0&&G.particles.length<420){const s=Math.random()<.5?-1:1;G.particles.push({kind:'spark',x:v.x+Math.cos(v.rot)*14*s,y:v.y+Math.sin(v.rot)*14*s,vx:-(v.vx||0)*.3,vy:-(v.vy||0)*.3,life:.2});}}}
 // Dispatch radio and evasion tally.
 const w=G.wanted||0,last=G._pursuitW||0;
 if(w>last&&w>=2&&G.scene==='play'){const t=CALLS[Math.min(CALLS.length-1,w-2)].replace('{d}',districtAt(P.x,P.y));G.radioMsg={text:t,t:3.6};}
 if(last>0&&w===0&&!G._endT&&G.health>0){G.stats&&(G.stats.evaded=(G.stats.evaded||0)+1);G.stats&&(G.stats.maxHeat=Math.max(G.stats.maxHeat||0,G._pursuitPeak||0));G._pursuitPeak=0;}
 if(w>0)G._pursuitPeak=Math.max(G._pursuitPeak||0,w);
 G._pursuitW=w;
 if(G.radioMsg){G.radioMsg.t-=dt;if(G.radioMsg.t<=0)G.radioMsg=null;}
}
export function drawPursuit(G,r){
 const S=G.spikes;const c=G.ctx;
 if(S?.length){for(const s of S){if(s.x<r.x0-120||s.x>r.x1+120||s.y<r.y0-120||s.y>r.y1+120)continue;c.save();c.translate(s.x,s.y);c.rotate(s.rot);
  c.globalAlpha=Math.min(1,s.t/2);c.fillStyle='rgba(0,0,0,.4)';c.fillRect(-s.len/2+2,-5,s.len,13);c.fillStyle='#1d2124';c.fillRect(-s.len/2,-6,s.len,11);c.fillStyle='#e8c24a';for(let x=-s.len/2;x<s.len/2;x+=24)c.fillRect(x,-6,10,2);
  c.fillStyle='#c9ced2';for(let x=-s.len/2+3;x<s.len/2-2;x+=7){c.beginPath();c.moveTo(x,-4);c.lineTo(x+2.5,-8);c.lineTo(x+5,-4);c.fill();c.beginPath();c.moveTo(x,3);c.lineTo(x+2.5,7);c.lineTo(x+5,3);c.fill();}
  c.fillStyle='#e8c24a';c.fillRect(-s.len/2-4,-5,4,9);c.fillRect(s.len/2,-5,4,9);c.restore();}}
}
// Dispatch line drawn as a small radio strip under the HUD (screen space).
export function drawRadio(G){
 const m=G.radioMsg;if(!m||G.scene!=='play')return;const c=G.ctx,W=G.canvas.width,s=Math.max(1,Math.min(2,W/900)),a=Math.min(1,m.t*2,(3.6-m.t)*4);
 c.save();c.setTransform(1,0,0,1,0,0);c.globalAlpha=a;c.font=`600 ${12*s}px system-ui`;const tw=c.measureText(m.text).width+34*s,x=(W-tw)/2,y=G.canvas.height-64*s;
 c.fillStyle='rgba(12,18,26,.82)';c.fillRect(x,y,tw,24*s);c.fillStyle='#ff5a6a';c.fillRect(x,y,4*s,24*s);c.fillStyle=(G.ticks%30<15)?'#ff5a6a':'#5aa0ff';c.beginPath();c.arc(x+15*s,y+12*s,4*s,0,TAU);c.fill();
 c.fillStyle='#e8eef4';c.textBaseline='middle';c.fillText(m.text,x+26*s,y+12.5*s);c.restore();
}
