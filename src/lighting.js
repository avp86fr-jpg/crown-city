/* Time of day + light map. Ambient multiply pass at reduced resolution with additive lights. */
import {signalPhase} from './traffic.js';
const TAU = Math.PI * 2;
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const hourOfDay=t=>Number.isFinite(t)?((t%24)+24)%24:12;

// key frames: hour -> ambient rgb (multiply), sun elevation handled separately
const AMB = [
  [0, [71, 84, 124]], [4.5, [73, 86, 126]], [5.6, [120, 92, 120]], [6.4, [236, 170, 140]], [7.4, [255, 236, 214]],
  [9, [255, 255, 250]], [16, [255, 252, 244]], [17.4, [255, 214, 168]], [18.4, [236, 140, 112]], [19.3, [130, 84, 126]],
  [20.2, [75, 85, 130]], [21, [71, 84, 124]], [24, [71, 84, 124]],
];
export function ambientAt(t) {
  t=hourOfDay(t);
  for (let i = 0; i < AMB.length - 1; i++) {
    const [h0, c0] = AMB[i], [h1, c1] = AMB[i + 1];
    if (t >= h0 && t <= h1) {
      const k = (t - h0) / (h1 - h0 || 1);
      const s = k * k * (3 - 2 * k);
      return [lerp(c0[0], c1[0], s), lerp(c0[1], c1[1], s), lerp(c0[2], c1[2], s)];
    }
  }
  return AMB[0][1];
}
export function darkness(t) {
  const a = ambientAt(t);
  return clamp(1 - (a[0] + a[1] + a[2]) / 765, 0, 1);
}
// sun direction (unit vector pointing FROM sun along ground) and shadow length factor
export function sunAt(t) {
  t=hourOfDay(t);
  const day = clamp((t - 6) / 13, 0, 1); // 6:00 -> 19:00
  const up = Math.sin(day * Math.PI);
  const az = lerp(-Math.PI * 0.5, Math.PI * 0.5, day); // east -> west
  // light comes from (cos(az)*-1 ...) ; shadow falls away from the sun
  const sx = Math.sin(az), sy = -0.45; // sun slightly south -> shadows fall north
  const L = Math.hypot(sx, sy) || 1;
  const alive = t > 6 && t < 19.2;
  return { x: sx / L, y: sy / L, len: alive ? clamp(0.25 / Math.max(0.18, up), 0.25, 1.4) : 0, alpha: alive ? clamp(up * 1.6, 0, 1) * 0.34 : 0, up };
}
export function timeLabel(t) {
  t=hourOfDay(t);
  const h = t | 0, m = ((t % 1) * 60) | 0;
  const phase = t < 5.5 ? "NIGHT" : t < 7.5 ? "DAWN" : t < 17 ? "DAY" : t < 19.8 ? "DUSK" : "NIGHT";
  return { text: `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`, phase };
}
// Continuous crossfade for baked mobile light layers, rather than a Boolean night switch.
export function nightMix(t){const v=clamp((darkness(t)-.12)/.42,0,1);return v*v*(3-2*v);}
export function mobileTint(t){const rgb=ambientAt(t),n=nightMix(t);return {night:n,alpha:.025+n*.145,warm:Math.max(0,(rgb[0]-rgb[2])/255)*.12};}

// Effects use simulation time, independent of rendering or skipped frames.
export function tickLightEffects(G,dt){
  G.hurtT=Math.max(0,(G.hurtT||0)-dt);
  let live=0;
  for(const f of G.flashes){f.life-=dt;if(f.life>0)G.flashes[live++]=f;}
  G.flashes.length=live;
}

// The legacy neon mask predates the painted roofs. Brighten the current casino
// artwork itself so signs and pool edges cannot drift or appear twice.
export function drawCoreGlow(G,ctx,r,frame,night){
  if(night<.02)return;
  ctx.save();ctx.globalCompositeOperation='screen';ctx.globalAlpha=.46*night;
  for(const b of G.world.coreBuildings){
    if(b.kind!=='casino'||b.x>r.x1||b.x+b.w<r.x0||b.y>r.y1||b.y+b.h<r.y0)continue;
    G.assets.layers.roofs.drawRect(ctx,b.x,b.y,b.w,b.h,frame,(ax,ay,bx,by)=>[ax,ay,bx-ax,by-ay]);
  }
  ctx.restore();
}

// Live signal heads share the AI's phase, including the baked mobile renderer.
const SIGNAL_COLORS=['#3ce06a','#ffb000','#ff3a3a'],SIGNAL_ART=[];
function signalArt(phase){
  if(SIGNAL_ART[phase])return SIGNAL_ART[phase];
  const canvas=document.createElement('canvas');canvas.width=24;canvas.height=40;const c=canvas.getContext('2d');c.scale(2,2);
  c.fillStyle='rgba(0,0,0,.35)';c.fillRect(1,2,8,16);c.fillStyle='#16161a';c.fillRect(0,0,8,16);
  c.fillStyle=SIGNAL_COLORS[phase];c.beginPath();c.arc(4,12-phase*4,2.6,0,TAU);c.fill();return SIGNAL_ART[phase]=canvas;
}
export function drawTrafficSignals(G,r){
  let index=G._signalIndex;
  if(!index||index.source!==G.graph.nodes){
    index=G._signalIndex={source:G.graph.nodes,bins:new Map()};
    for(const n of G.graph.nodes)if(n.sig){const key=Math.floor(n.x/512)+':'+Math.floor(n.y/512);if(!index.bins.has(key))index.bins.set(key,[]);index.bins.get(key).push(n);}
  }
  const c=G.ctx,ns=signalPhase(G.ticks,true),ew=signalPhase(G.ticks,false),lit=G._sigLit||(G._sigLit=[]);lit.length=0;
  c.save();c.globalAlpha=1;
  for(let y=Math.floor((r.y0-200)/512);y<=Math.floor((r.y1+200)/512);y++)for(let x=Math.floor((r.x0-200)/512);x<=Math.floor((r.x1+200)/512);x++)for(const n of index.bins.get(x+':'+y)||[]){
    const hw=(n.hw||40)+10,hh=(n.hh||40)+10;
    for(let k=0;k<4;k++){
      const sx=n.x+(k===0||k===2?-hw:hw),sy=n.y+(k===0||k===3?-hh:hh),phase=k<2?ns:ew;
      if(sx<r.x0-8||sx>r.x1+8||sy<r.y0-8||sy>r.y1+8)continue;
      c.drawImage(signalArt(phase),sx-4,sy-8,12,20);lit.push(sx,sy,SIGNAL_COLORS[phase]);
    }
  }c.restore();
}

// Query nearby cells instead of scanning the entire city for each light pass.
export function visibleStreetLights(G,r,limit=Infinity){
  const core=G.meta.lights,outer=G.world.lamps;
  let index=G._lampIndex;
  if(!index||index.core!==core||index.outer!==outer||index.count!==core.length+outer.length){
    index=G._lampIndex={core,outer,count:core.length+outer.length,bins:new Map(),visible:[]};
    const add=(p,expanded)=>{
      if(!expanded&&p.kind&&p.kind!=='street')return;
      const side=p.side||0;
      const x=p.x+(expanded&&p.v?-side*30:0),y=p.y+(expanded&&!p.v?-side*30:0);
      const key=Math.floor(x/512)+':'+Math.floor(y/512);
      if(!index.bins.has(key))index.bins.set(key,[]);
      index.bins.get(key).push({x,y,bulbX:p.x,bulbY:p.y,radius:expanded?200:150,expanded});
    };
    core.forEach(p=>add(p,false));outer.forEach(p=>add(p,true));
  }
  const out=index.visible;out.length=0;
  for(let y=Math.floor((r.y0-200)/512);y<=Math.floor((r.y1+200)/512);y++)for(let x=Math.floor((r.x0-200)/512);x<=Math.floor((r.x1+200)/512);x++){
    const bin=index.bins.get(x+':'+y);if(!bin)continue;
    for(const p of bin)if(p.x+p.radius>r.x0&&p.x-p.radius<r.x1&&p.y+p.radius>r.y0&&p.y-p.radius<r.y1)out.push(p);
  }
  if(out.length>limit){const x=G.cam.x,y=G.cam.y;out.sort((a,b)=>(a.x-x)**2+(a.y-y)**2-(b.x-x)**2-(b.y-y)**2);out.length=limit;}
  return out;
}

const sprites = new Map();
function radial(color, size = 128) {
  const k = color + size;
  if (sprites.has(k)) return sprites.get(k);
  const c = document.createElement("canvas"); c.width = c.height = size;
  const x = c.getContext("2d");
  const g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, color); g.addColorStop(0.25, color.replace(/[\d.]+\)$/, (m) => (parseFloat(m) * 0.55).toFixed(3) + ")"));
  g.addColorStop(0.6, color.replace(/[\d.]+\)$/, (m) => (parseFloat(m) * 0.16).toFixed(3) + ")"));
  g.addColorStop(1, "rgba(0,0,0,0)");
  x.fillStyle = g; x.fillRect(0, 0, size, size);
  sprites.set(k, c); return c;
}
function cone(color) {
  const k = "cone" + color;
  if (sprites.has(k)) return sprites.get(k);
  const W = 128, H = 256;
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const x = c.getContext("2d");
  const g = x.createLinearGradient(0, H, 0, 0);
  g.addColorStop(0, color); g.addColorStop(0.35, color.replace(/[\d.]+\)$/, "0.45)")); g.addColorStop(1, "rgba(0,0,0,0)");
  x.fillStyle = g;
  x.beginPath(); x.moveTo(W / 2 - 6, H); x.lineTo(0, 10); x.quadraticCurveTo(W / 2, -10, W, 10); x.lineTo(W / 2 + 6, H); x.closePath(); x.fill();
  // soften edges
  const c2 = document.createElement("canvas"); c2.width = W; c2.height = H;
  const y = c2.getContext("2d"); y.filter = "blur(6px)"; y.drawImage(c, 0, 0);
  sprites.set(k, c2); return c2;
}
function hurt(){
  if(sprites.has('hurt'))return sprites.get('hurt');
  const c=document.createElement('canvas');c.width=256;c.height=144;const x=c.getContext('2d');
  const g=x.createRadialGradient(128,72,43,128,72,115);g.addColorStop(0,'rgba(200,0,20,0)');g.addColorStop(1,'rgba(200,0,20,1)');
  x.fillStyle=g;x.fillRect(0,0,256,144);sprites.set('hurt',c);return c;
}
export const LIGHT = { radial, cone, hurt };

export function createLighting() {
  const cv = document.createElement("canvas");
  const lx = cv.getContext("2d");
  const sh = document.createElement("canvas");
  const sx = sh.getContext("2d");
  return {
    cv, lx, sh, sx,
    resize(w, h, q) {
      const d = q === "low" ? 3 : 2;
      const W = Math.max(64, Math.ceil(w / d)), H = Math.max(64, Math.ceil(h / d));
      if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; sh.width = W; sh.height = H; }
      this.div = d;
    },
  };
}
