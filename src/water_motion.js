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
export function drawWaterMotion(G,r){
 const low=G.settings.quality==='low',stats=G.waterMotionStats||(G.waterMotionStats={});stats.waves=stats.shores=stats.built=0;
 if(G.settings.reducedMotion)return;
 // At aircraft/map scale fine ripples have no useful screen footprint.
 if(G.cam.scale<.48)return;
 const state=G._waterMotion||(G._waterMotion={chunks:new Map(),frame:0}),stamp=++state.frame;
 const x0=Math.max(0,Math.floor(r.x0/CHUNK)),x1=Math.min(47,Math.floor(r.x1/CHUNK)),y0=Math.max(0,Math.floor(r.y0/CHUNK)),y1=Math.min(39,Math.floor(r.y1/CHUNK));
 if((x1-x0+1)*(y1-y0+1)>80)return;
 const c=G.ctx,t=G.ticks/60,wind=sceneWind(G),waveLimit=low?64:150,shoreLimit=low?40:90;
 const stride=Math.max(1,Math.ceil((x1-x0+1)*(y1-y0+1)*16/waveLimit));
 const night=(G.night||0)>.45;
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
   const crest=.4+.6*(.5+.5*Math.sin(phase));
   // Painted trough: a darker stroke under each crest gives the swell volume.
   c.globalAlpha=(p.canal?.08:.14)*crest;c.strokeStyle='#0d3550';c.lineWidth=low?2:2.6;
   c.beginPath();c.moveTo(p.x+dx,p.y+dy+2.4);c.bezierCurveTo(p.x+dx+p.len*.25,p.y+dy+.4,p.x+dx+p.len*.6,p.y+dy+4.4,p.x+dx+p.len,p.y+dy+1.8);c.stroke();
   c.strokeStyle=night?'#7fa6c4':'#c8ece6';c.lineWidth=low?1.15:1.2;
   c.globalAlpha=(p.canal?.16:.26)*crest;
   c.beginPath();c.moveTo(p.x+dx,p.y+dy);c.bezierCurveTo(p.x+dx+p.len*.25,p.y+dy-2.2,p.x+dx+p.len*.6,p.y+dy+2,p.x+dx+p.len,p.y+dy-.6);c.stroke();stats.waves++;
   // Sun sparkle by day, a cool moon glint at night: brief, crest-timed twinkles.
   const tw=Math.sin(phase*2.3+p.phase*3);if(!p.canal&&tw>.82){const k=(tw-.82)/.18;c.globalAlpha=k*(night?.35:.7);c.fillStyle=night?'#bcd4ff':'#fffbe8';const sx=p.x+dx+p.len*.45,sy=p.y+dy-1;c.fillRect(sx-2.5*k,sy-.5,5*k,1);c.fillRect(sx-.5,sy-1.6*k,1,3.2*k);}
  }
  c.lineWidth=1.7;
  for(const p of chunk.shores){
   if(stats.shores>=shoreLimit)break;
   if(p.x<r.x0||p.x>r.x1||p.y<r.y0||p.y>r.y1)continue;
   const pulse=.5+.5*Math.sin(t*.95+p.phase),retreat=3+3*pulse,px=p.x-p.dx*retreat,py=p.y-p.dy*retreat;
   c.globalAlpha=.1+.2*pulse;c.beginPath();c.moveTo(px-p.dy*6,py+p.dx*6);c.quadraticCurveTo(px-p.dx*1.5,py-p.dy*1.5,px+p.dy*6,py-p.dx*6);c.stroke();
   c.globalAlpha=.06+.08*(1-pulse);c.beginPath();c.moveTo(px-p.dy*5-p.dx*6,py+p.dx*5-p.dy*6);c.quadraticCurveTo(px-p.dx*8,py-p.dy*8,px+p.dy*5-p.dx*6,py-p.dx*5-p.dy*6);c.stroke();stats.shores++;
  }
  c.lineWidth=low?1.15:1;
 }
 c.restore();
 if(state.chunks.size>80)for(const [key,p]of state.chunks){if(state.chunks.size<=80)break;if(p.used!==stamp)state.chunks.delete(key);}
 stats.chunks=state.chunks.size;
}
