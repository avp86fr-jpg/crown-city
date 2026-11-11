/* Screen-local environmental detail. No particle allocations and no hidden-world updates. */
import {nightMix} from './lighting.js';
export function drawLocalAtmosphere(G,r){
 if(G.settings.reducedMotion)return;const c=G.ctx,t=G.ticks/60,n=nightMix(G.time),count=G.settings.quality==='low'?10:22,w=r.x1-r.x0,h=r.y1-r.y0,forest=G.player.x>10400&&G.player.y<8400,desert=G.player.y>9216&&G.player.x<8800;
 c.save();
 if(forest||desert){for(let i=0;i<count;i++){const x=r.x0+((i*173.21+t*(desert?13:3))%w+w)%w,y=r.y0+((i*241.7+Math.sin(t*.4+i)*18)%h+h)%h;c.globalAlpha=forest?n*(.14+.2*(1+Math.sin(t*1.7+i))):.15;c.fillStyle=forest?'#d3e98b':'#e8ce94';c.beginPath();c.ellipse(x,y,forest?1.6:8,forest?1.6:1.2,-.2,0,Math.PI*2);c.fill();}}
 // A sparse set of animated wavelets follows the canal without a full-screen water shader.
 if(r.x1>6864&&r.x0<7072&&r.y1>560&&r.y0<6800){c.strokeStyle='#a1c9bb';c.lineWidth=1;c.globalAlpha=.18*(1-n*.6);for(let i=0;i<count;i++){const x=6882+(i*43)%164,y=Math.max(570,r.y0)+((i*127+t*9)%Math.min(h,600));if(y>6800)continue;c.beginPath();c.moveTo(x,y);c.quadraticCurveTo(x+8,y-2,x+17,y);c.stroke();}}
 c.restore();
}
