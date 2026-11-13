import {sceneWind} from './wind.js';
import {roofDetailPlan} from './architecture_art.js';
/* Screen-local environmental detail. No particle allocations and no hidden-world updates. */
import {nightMix,ambientAt,LIGHT} from './lighting.js';
import {drawBoundaryBackdrop,drawBoundaryMarkers} from './world_limits.js';
function drawAirfieldSignals(G,r){
 const details=G.world.details;if(!details||r.x1<6580||r.x0>10000||r.y1<7300||r.y0>7970)return;
 const c=G.ctx,n=nightMix(G.time),t=G.settings.reducedMotion?0:G.ticks/60,wind=sceneWind(G);c.save();
 for(const w of details.windsocks){if(w.x<r.x0-60||w.x>r.x1+60||w.y<r.y0-60||w.y>r.y1+60)continue;
  c.strokeStyle='#bcc5b1';c.lineWidth=2;c.beginPath();c.moveTo(w.x,w.y);c.lineTo(w.x,w.y-26);c.stroke();
  c.translate(w.x,w.y-26);c.rotate(Math.atan2(wind.y,wind.x));for(let i=0;i<5;i++){c.fillStyle=i%2?'#e9d6ad':'#ce7850';const h=7-i*.9,y=Math.sin(t*3+i*.7)*1.2*wind.gust;c.beginPath();c.moveTo(i*7,-h+y);c.lineTo(i*7+7,-h+1+y);c.lineTo(i*7+7,h-1+y);c.lineTo(i*7,h+y);c.closePath();c.fill();}c.rotate(-Math.atan2(wind.y,wind.x));c.translate(-w.x,-w.y+26);
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
 if(G.settings.reducedMotion){if(G.atmosphereStats)G.atmosphereStats.plumes=G.atmosphereStats.puffs=G.atmosphereStats.leaves=0;return;}const c=G.ctx,t=G.ticks/60,n=nightMix(G.time),count=G.settings.quality==='low'?10:22,w=r.x1-r.x0,h=r.y1-r.y0,forest=G.player.x>10400&&G.player.y<8400,desert=G.player.y>9216&&G.player.x<8800;
 c.save();
 if(forest||desert){for(let i=0;i<count;i++){const x=r.x0+((i*173.21+t*(desert?13:3))%w+w)%w,y=r.y0+((i*241.7+Math.sin(t*.4+i)*18)%h+h)%h;c.globalAlpha=forest?n*(.14+.2*(1+Math.sin(t*1.7+i))):.15;c.fillStyle=forest?'#d3e98b':'#e8ce94';c.beginPath();c.ellipse(x,y,forest?1.6:8,forest?1.6:1.2,-.2,0,Math.PI*2);c.fill();}}
 c.restore();
 drawWindAndSmoke(G,r);
}

// Use the actual drawn chimney or extraction fan, never a random roof position.
export function smokeOrigin(b){
 if(b.core||b.helipad)return null;
 const plan=roofDetailPlan(b);
 if(plan.smokeSource!==undefined)return plan.smokeSource;
 if(plan.pitched&&plan.access&&(b.seed||0)%3===0)return plan.smokeSource={x:plan.access.x+plan.access.w/2,y:plan.access.y+plan.access.h/2,kind:'chimney'};
 if(plan.industrial&&plan.fans.length){const a=plan.fans[0];return plan.smokeSource={x:a.x+a.w/2,y:a.y+a.h/2,kind:'vent'};}
 return plan.smokeSource=null;
}
export function drawWindAndSmoke(G,r){
 const stats=G.atmosphereStats||(G.atmosphereStats={});stats.plumes=stats.puffs=stats.leaves=0;
 if(G.settings.reducedMotion||G.cam.scale<.48)return;
 const c=G.ctx,low=G.settings.quality==='low',t=G.ticks/60,wind=sceneWind(G),night=nightMix(G.time);
 c.save();
 // A few lifted leaves give baked mobile foliage motion without redrawing trees.
 c.fillStyle='#acb77e';
 for(const tree of G.bld.treesInView(r)){
  if(stats.leaves>=(low?10:24))break;
  if((Math.floor(tree.x)+Math.floor(tree.y))%3)continue;
  const phase=((t*.24+tree.x*.013+tree.y*.021)%1+1)%1,angle=tree.x*.17;
  const px=tree.x+Math.cos(angle)*tree.r*.5+phase*18*wind.x,py=tree.y+Math.sin(angle)*tree.r*.5+phase*18*wind.y;
  if(px<r.x0||px>r.x1||py<r.y0||py>r.y1)continue;
  c.globalAlpha=Math.sin(phase*Math.PI)*.45*(1-night*.65);c.beginPath();c.ellipse(px,py,2.6,1,angle+t*1.1,0,Math.PI*2);c.fill();stats.leaves++;
 }
 const puff=LIGHT.radial('rgba(184,192,188,.5)',48),limit=low?3:7;
 for(const b of G.bld.inView(r,90)){
  if(stats.plumes>=limit)break;
  const source=smokeOrigin(b);if(!source)continue;
  const k=low?0:(b.hgt||0)/(980/Math.max(.45,G.cam.scale)),x=b.x+(b.x-G.cam.x)*k+source.x*(1+k),y=b.y+(b.y-G.cam.y)*k+source.y*(1+k);
  if(x<r.x0-65||x>r.x1+15||y<r.y0-15||y>r.y1+80)continue;
  const duration=source.kind==='vent'?4.8:6.8,n=low?5:8;
  for(let i=0;i<n;i++){
   const phase=((t/duration+i/n+(b.seed||0)*.00037)%1+1)%1,age=phase*duration,size=9+phase*25;
   const px=x+wind.x*age*8+Math.sin(age*1.7+i)*phase*4,py=y-3-age*8+wind.y*age*8;
   c.globalAlpha=Math.sin(phase*Math.PI)*.26*(1-night*.55)*(1-Math.min(.7,G.rainAmt||0)*.4);
   c.drawImage(puff,px-size/2,py-size/2,size,size);stats.puffs++;
  }
  stats.plumes++;
 }
 c.restore();
}
