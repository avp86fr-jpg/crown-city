/* World-anchored, geometry-checked wavelets. No framebuffer reads, full-screen
   shaders or growing particle lists; at most two geometry chunks are planned
   per frame and 80 chunks (small coordinate arrays) survive travel. */
import {sceneWind} from './wind.js';
const CHUNK=256,TAU=Math.PI*2,wet=c=>c===3||c===8;
const hash=(x,y)=>((Math.imul(x,73856093)^Math.imul(y,19349663))>>>0)/4294967296;
function clearWater(codeAt,x,y){
 // Sample the interior too: four wet corners can straddle a narrow pier.
 for(let dy=-10;dy<=10;dy+=4)for(let dx=-16;dx<=48;dx+=4)if(!wet(codeAt(x+dx,y+dy)))return false;
 return true;
}
export function waterMotionPlan(codeAt,tx,ty){
 const waves=[],shores=[],ox=tx*CHUNK,oy=ty*CHUNK;
 for(let y=oy+24;y<oy+CHUNK;y+=64)for(let x=ox+24;x<ox+CHUNK;x+=64){
  const seed=hash(x,y),px=x+seed*15,py=y+hash(y,x)*15,code=codeAt(px,py);
  // The complete swept footprint stays off quay walls, docks and bridge decks.
  if(!wet(code)||!clearWater(codeAt,px,py))continue;
  waves.push({x:px,y:py,phase:seed*TAU,len:code===8?16:22+seed*12,canal:code===8});
 }
 for(let y=oy+8;y<oy+CHUNK;y+=16)for(let x=ox+8;x<ox+CHUNK;x+=16){
  if(!wet(codeAt(x,y)))continue;
  for(let side=0;side<4;side++){
   const dx=side===0?-1:side===1?1:0,dy=side===2?-1:side===3?1:0,land=codeAt(x+dx*16,y+dy*16);
   if(land!==4&&land!==5)continue; // Surf belongs on beaches, not through docks.
   const px=x+dx*4,py=y+dy*4;
   if(!wet(codeAt(px-dy*7,py+dx*7))||!wet(codeAt(px+dy*7,py-dx*7)))continue;
   shores.push({x:px,y:py,dx,dy,phase:hash(x,y)*TAU});
  }
 }
 return {waves,shores};
}
let _shelf=null;
function shelfTex(){if(_shelf||typeof document==='undefined')return _shelf;const c=document.createElement('canvas');c.width=c.height=64;const x=c.getContext('2d'),g=x.createRadialGradient(32,32,0,32,32,32);g.addColorStop(0,'rgba(96,222,206,.9)');g.addColorStop(.6,'rgba(70,190,190,.35)');g.addColorStop(1,'rgba(60,170,180,0)');x.fillStyle=g;x.fillRect(0,0,64,64);return _shelf=c;}
let _foam=null;
function foamTex(){if(_foam||typeof document==='undefined')return _foam;const c=document.createElement('canvas');c.width=c.height=32;const x=c.getContext('2d'),g=x.createRadialGradient(16,16,0,16,16,16);g.addColorStop(0,'rgba(255,255,255,.95)');g.addColorStop(.5,'rgba(236,252,250,.5)');g.addColorStop(1,'rgba(220,245,245,0)');x.fillStyle=g;x.fillRect(0,0,32,32);return _foam=c;}
// Boat wakes: a bounded list of stern samples that spread into a foam V and
// a churned centre line, fading over ~3 s, so a fast boat leaves a readable
// trail across the sea instead of two short strokes on the hull.
export function tickWakes(G,dt){
 const W=G.wakes||(G.wakes=[]),cap=G.settings.quality==='low'?90:200;let n=0;
 for(const w of W){w.age+=dt;if(w.age<3)W[n++]=w;}W.length=n;
 if(G.ticks%3)return;
 for(const v of G.vehicles){if(!v.def?.boat||v.dead)continue;const s=Math.hypot(v.vx||0,v.vy||0);if(s<40)continue;
  if(Math.abs(v.x-G.cam.x)>1400||Math.abs(v.y-G.cam.y)>1000)continue;
  const fx=Math.sin(v.rot),fy=-Math.cos(v.rot),back=(v.r||30)*.95;
  if(W.length>=cap)W.shift();W.push({x:v.x-fx*back,y:v.y-fy*back,rot:v.rot,age:0,s:Math.min(1,s/260)});}
}
function drawWakes(G,r){
 const W=G.wakes;if(!W?.length)return;const foam=foamTex();if(!foam)return;const c=G.ctx;c.save();
 for(const w of W){if(w.x<r.x0-80||w.x>r.x1+80||w.y<r.y0-80||w.y>r.y1+80)continue;
  const k=w.age/3,a=(1-k)*(1-k)*(.35+.5*w.s),sx=Math.cos(w.rot),sy=Math.sin(w.rot),spread=5+w.age*26*(.5+w.s),sz=8+w.age*9;
  c.globalAlpha=a*.9;c.drawImage(foam,w.x-sz*.6,w.y-sz*.6,sz*1.2,sz*1.2);
  c.globalAlpha=a*.75;for(const side of [-1,1]){const x=w.x+sx*spread*side,y=w.y+sy*spread*side,q=6+w.age*5;c.drawImage(foam,x-q/2,y-q/2,q,q);}
 }c.restore();
}
export function drawWaterMotion(G,r){
 drawWakes(G,r);
 const low=G.settings.quality==='low',stats=G.waterMotionStats||(G.waterMotionStats={});stats.waves=stats.shores=stats.built=0;
 if(G.settings.reducedMotion)return;
 // At aircraft/map scale fine ripples have no useful screen footprint.
 if(G.cam.scale<.48)return;
 const state=G._waterMotion||(G._waterMotion={chunks:new Map(),frame:0}),stamp=++state.frame;
 const x0=Math.max(0,Math.floor(r.x0/CHUNK)),x1=Math.min(47,Math.floor(r.x1/CHUNK)),y0=Math.max(0,Math.floor(r.y0/CHUNK)),y1=Math.min(39,Math.floor(r.y1/CHUNK));
 if((x1-x0+1)*(y1-y0+1)>80)return;
 const c=G.ctx,t=G.ticks/60,wind=sceneWind(G),waveLimit=low?64:220,shoreLimit=low?40:120;
 const stride=Math.max(1,Math.ceil((x1-x0+1)*(y1-y0+1)*16/waveLimit));
 const night=(G.night||0)>.45,shelf=shelfTex(),foam=foamTex();
 c.save();c.lineWidth=low?1.15:1;c.lineCap='round';c.strokeStyle='#a4cec8';
 for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
  const key=y*48+x;let chunk=state.chunks.get(key);
  if(!chunk){if(stats.built>=2)continue;chunk=waterMotionPlan(G.codeAt,x,y);state.chunks.set(key,chunk);stats.built++;}
  chunk.used=stamp;
  for(const p of chunk.waves){
   if(stats.waves>=waveLimit)break;
   if((Math.floor(p.x/64)+Math.floor(p.y/64)*3)%stride)continue;
   if(p.x<r.x0-30||p.x>r.x1||p.y<r.y0-12||p.y>r.y1+12)continue;
   const phase=t*(p.canal?.8:1.05)+p.phase,sway=Math.sin(phase),dx=sway*6*wind.x,dy=Math.cos(phase*.8)*2+wind.y*2;
   const crest=.4+.6*(.5+.5*Math.sin(phase)),peak=Math.max(0,Math.sin(phase));
   // Painted swell: a broad dark trough, a pale crest band and a bright core at the peak.
   c.globalAlpha=(p.canal?.14:.34)*crest;c.strokeStyle=night?'#061a2e':'#0a3552';c.lineWidth=low?3.6:6;
   c.beginPath();c.moveTo(p.x+dx,p.y+dy+3);c.bezierCurveTo(p.x+dx+p.len*.25,p.y+dy+1,p.x+dx+p.len*.6,p.y+dy+5,p.x+dx+p.len,p.y+dy+2.4);c.stroke();
   c.globalAlpha=(p.canal?.22:.46)*crest;c.strokeStyle=night?'#7a9dc2':'#c8f2ea';c.lineWidth=low?2.6:3.6;
   c.beginPath();c.moveTo(p.x+dx,p.y+dy);c.bezierCurveTo(p.x+dx+p.len*.25,p.y+dy-2.2,p.x+dx+p.len*.6,p.y+dy+2,p.x+dx+p.len,p.y+dy-.6);c.stroke();
   c.fillStyle=night?'#d5e6ff':'#ffffff';
   c.globalAlpha=(p.canal?.28:.72)*peak;const L=p.len,X=p.x+dx,Y=p.y+dy;
   c.beginPath();c.moveTo(X+L*.1,Y-1);c.quadraticCurveTo(X+L*.45,Y-3.6-peak,X+L*.85,Y-.8);c.quadraticCurveTo(X+L*.45,Y-1.2,X+L*.1,Y-1);c.fill();stats.waves++;
   // Sun sparkle by day, a cool moon glint at night: brief, crest-timed twinkles.
   const tw=Math.sin(phase*2.3+p.phase*3);if(!p.canal&&tw>.82){const k=(tw-.82)/.18;c.globalAlpha=k*(night?.35:.7);c.fillStyle=night?'#bcd4ff':'#fffbe8';const sx=p.x+dx+p.len*.45,sy=p.y+dy-1;c.fillRect(sx-2.5*k,sy-.5,5*k,1);c.fillRect(sx-.5,sy-1.6*k,1,3.2*k);}
  }
  c.lineWidth=1.7;
  for(const p of chunk.shores){
   if(stats.shores>=shoreLimit)break;
   if(p.x<r.x0||p.x>r.x1||p.y<r.y0||p.y>r.y1)continue;
   const pulse=.5+.5*Math.sin(t*.95+p.phase),retreat=3+5*pulse,px=p.x-p.dx*retreat,py=p.y-p.dy*retreat;
   // Shallow shelf: turquoise light near the beach fading into deep water.
   if(shelf){c.globalAlpha=night?.12:.3;c.drawImage(shelf,p.x-p.dx*14-22,p.y-p.dy*14-22,44,44);}
   if(foam){c.globalAlpha=.32+.4*pulse;const fx=px-p.dx*2,fy=py-p.dy*2;if(p.dx)c.drawImage(foam,fx-6,fy-13,12,26);else c.drawImage(foam,fx-13,fy-6,26,12);
    c.globalAlpha=.16+.2*(1-pulse);const bx=px-p.dx*(9+4*pulse),by=py-p.dy*(9+4*pulse);if(p.dx)c.drawImage(foam,bx-4,by-11,8,22);else c.drawImage(foam,bx-11,by-4,22,8);}
   c.fillStyle='#ffffff';c.globalAlpha=.45*pulse;c.fillRect(px+p.dy*3-1,py-p.dx*3-1,2,2);c.fillRect(px-p.dy*4-p.dx*5,py+p.dx*4-p.dy*5,1.5,1.5);stats.shores++;
  }
  c.lineWidth=low?1.15:1;
 }
 c.restore();
 if(state.chunks.size>80)for(const [key,p]of state.chunks){if(state.chunks.size<=80)break;if(p.used!==stamp)state.chunks.delete(key);}
 stats.chunks=state.chunks.size;
}
