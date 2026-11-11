/* Screen-local environmental detail. No particle allocations and no hidden-world updates. */
import {nightMix,ambientAt,LIGHT} from './lighting.js';
import {drawBoundaryBackdrop,drawBoundaryMarkers} from './world_limits.js';
function drawAirfieldSignals(G,r){
 const details=G.world.details;if(!details||r.x1<6580||r.x0>10000||r.y1<7300||r.y0>7970)return;
 const c=G.ctx,n=nightMix(G.time),t=G.settings.reducedMotion?0:G.ticks/60;c.save();
 for(const w of details.windsocks){if(w.x<r.x0-60||w.x>r.x1+60||w.y<r.y0-60||w.y>r.y1+60)continue;
  c.strokeStyle='#bcc5b1';c.lineWidth=2;c.beginPath();c.moveTo(w.x,w.y);c.lineTo(w.x,w.y-26);c.stroke();
  c.translate(w.x,w.y-26);c.rotate(-.15+Math.sin(t*.8)*.12);for(let i=0;i<5;i++){c.fillStyle=i%2?'#e9d6ad':'#ce7850';const h=7-i*.9,y=Math.sin(t*3+i*.7)*1.2;c.beginPath();c.moveTo(i*7,-h+y);c.lineTo(i*7+7,-h+1+y);c.lineTo(i*7+7,h-1+y);c.lineTo(i*7,h+y);c.closePath();c.fill();}c.rotate(.15-Math.sin(t*.8)*.12);c.translate(-w.x,-w.y+26);
 }
 if(n>.05){
  const glow=LIGHT.radial('rgba(178,216,224,.55)',32);c.globalCompositeOperation='lighter';
  for(let x=Math.max(6650,6650+Math.ceil((r.x0-6650)/110)*110);x<Math.min(9920,r.x1);x+=110)for(const y of [7415,7585]){if(y<r.y0||y>r.y1)continue;c.globalAlpha=n*.35;c.drawImage(glow,x-14,y-14,28,28);c.globalAlpha=n;c.fillStyle='#e5f1d4';c.fillRect(x-1.5,y-1.5,3,3);}
  c.globalAlpha=n*.8;c.fillStyle='#71bece';for(let x=Math.max(6650,6650+Math.ceil((r.x0-6650)/140)*140);x<Math.min(9920,r.x1);x+=140)if(7624>r.y0&&7624<r.y1)c.fillRect(x-1.5,7622.5,3,3);
 }c.restore();
}
export function drawLocalAtmosphere(G,r){
 const bounds=G.world.limits;
 if(bounds&&(r.x0<bounds.x||r.x1>bounds.x+bounds.w||r.y0<bounds.y||r.y1>bounds.y+bounds.h)){
  // Quantize only the remote vista tint; no cache rebuild or terrain work as time advances.
  const minute=Math.floor(G.time*60);if(G._boundaryMinute!==minute){G._boundaryMinute=minute;const rgb=ambientAt(G.time);G._boundaryTint=`rgb(${rgb.map(Math.round).join(',')})`;}
  drawBoundaryBackdrop(G.ctx,bounds,r,G);
 }
 // The west/north painted core bypasses the procedural ground cache.
 if(r.x0<24&&r.y0<4096||r.y0<24&&r.x0<4096)drawBoundaryMarkers(G.ctx,G.world,{x0:r.x0,y0:r.y0,x1:Math.min(4096,r.x1),y1:Math.min(4096,r.y1)});
 drawAirfieldSignals(G,r);
 if(G.settings.reducedMotion)return;const c=G.ctx,t=G.ticks/60,n=nightMix(G.time),count=G.settings.quality==='low'?10:22,w=r.x1-r.x0,h=r.y1-r.y0,forest=G.player.x>10400&&G.player.y<8400,desert=G.player.y>9216&&G.player.x<8800;
 c.save();
 if(forest||desert){for(let i=0;i<count;i++){const x=r.x0+((i*173.21+t*(desert?13:3))%w+w)%w,y=r.y0+((i*241.7+Math.sin(t*.4+i)*18)%h+h)%h;c.globalAlpha=forest?n*(.14+.2*(1+Math.sin(t*1.7+i))):.15;c.fillStyle=forest?'#d3e98b':'#e8ce94';c.beginPath();c.ellipse(x,y,forest?1.6:8,forest?1.6:1.2,-.2,0,Math.PI*2);c.fill();}}
 // A sparse set of animated wavelets follows the canal without a full-screen water shader.
 if(r.x1>6864&&r.x0<7072&&r.y1>560&&r.y0<6800){c.strokeStyle='#a1c9bb';c.lineWidth=1;c.globalAlpha=.18*(1-n*.6);for(let i=0;i<count;i++){const x=6882+(i*43)%164,y=Math.max(570,r.y0)+((i*127+t*9)%Math.min(h,600));if(y>6800||G.surfaceAt(x,y)!=='canal')continue;c.beginPath();c.moveTo(x,y);c.quadraticCurveTo(x+8,y-2,x+17,y);c.stroke();}}
 const river=G.world?.river;
 if(river&&r.y1>river[0]&&r.y0<river[1]){
  c.strokeStyle='#bad9ca';c.lineWidth=1;c.globalAlpha=.17*(1-n*.55);
  for(let i=0;i<count;i++){const x=r.x0+((i*137.1+t*14)%w+w)%w,y=river[0]+16+(i*47)%(river[1]-river[0]-32);if(G.surfaceAt(x,y)!=='water')continue;c.beginPath();c.moveTo(x,y);c.quadraticCurveTo(x+9,y-2,x+19,y);c.stroke();}
  for(const shore of river)for(let x=Math.floor(r.x0/96)*96;x<r.x1;x+=96){const y=shore+(shore===river[0]?4:-4)+Math.sin(t*.7+x)*1.5;if(G.surfaceAt(x,y)!=='water')continue;c.globalAlpha=.07+.035*(1+Math.sin(t+x*.1));c.beginPath();c.moveTo(x,y);c.quadraticCurveTo(x+24,y+2,x+48,y);c.stroke();}
 }
 c.restore();
}
