/* A bounded painted-city renderer. Static layers are composed once, never per frame. */
import {ambientAt,darkness,LIGHT} from './lighting.js';
import {loadImage} from './assets.js';
import {drawStreetScene} from './citylife.js';
import {drawExpansionPeople} from './expansion.js';
import {drawExpansionOverhead} from './expansion_world.js';
import {WORLD_W,WORLD_H} from './world.js';
const CORE=4096,TILE=1024,OUTER=512;
function retire(e){e.retired=true;e.bitmap?.close();if(e.canvas)e.canvas.width=1;}
function seal(e){
  // Immutable bitmap copies avoid repeated canvas-to-canvas uploads on Android.
  if(typeof createImageBitmap==='function')createImageBitmap(e.canvas).then(bitmap=>{if(e.retired)bitmap.close();else{e.bitmap=bitmap;e.canvas.width=1;}}).catch(()=>{});
  return e;
}
function trim(cache,limit){if(cache.size<=limit)return;const cold=[...cache].sort((a,b)=>a[1].t-b[1].t);for(let i=0;i<cold.length-limit;i++){retire(cold[i][1]);cache.delete(cold[i][0]);}}
function outerTile(G,tx,ty){
 const cache=G.mobileOuter||(G.mobileOuter=new Map()),key=tx+':'+ty,revision=G.ground.revision;
 let entry=cache.get(key);if(entry&&entry.revision===revision){entry.t=G.ticks;return entry.bitmap||entry.canvas;}
 if(G._outerBuilt>=2)return null;G._outerBuilt++;if(entry)retire(entry);
 const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const c=canvas.getContext('2d',{alpha:false});
 c.fillStyle='#193e43';c.fillRect(0,0,256,256);c.scale(.5,.5);c.translate(-tx*OUTER,-ty*OUTER);
 const r={x0:tx*OUTER,y0:ty*OUTER,x1:(tx+1)*OUTER-.01,y1:(ty+1)*OUTER-.01};
 G.ground.draw(c,r,0);G.bld.staticDraw(c,r);
 const prior=G.ctx;G.ctx=c;try{drawStreetScene(G,r);}finally{G.ctx=prior;}
 entry=seal({canvas,revision,t:G.ticks});cache.set(key,entry);trim(cache,40);return entry.canvas;
}
function tile(G,tx,ty,night) {
  const cache=G.mobileTiles||(G.mobileTiles=new Map()),key=`${tx}:${ty}:${night}`;
  let e=cache.get(key);
  if(!e){
    e={image:null,t:G.ticks};cache.set(key,e);
    loadImage(`assets/mobile/${night?'night':'day'}/${tx}_${ty}.webp`).then(im=>{e.image=im;}).catch(()=>{e.failed=true;});
    if(cache.size>16){const cold=[...cache].sort((a,b)=>a[1].t-b[1].t);for(let i=0;i<cold.length-16;i++)cache.delete(cold[i][0]);}
  }
  e.t=G.ticks;
  // The boot albedo keeps the first frame painted while its finished tile decodes.
  return e.image||G.assets.layers.albedo?.img.get(tx+'_'+ty)||null;
}
export function drawMobileWorld(G,H) {
  const c=G.ctx,r=H.viewRect(G),night=darkness(G.time)>.2;
  H.worldXform(G,c,r.S);c.imageSmoothingQuality='low';c.fillStyle='#123943';c.fillRect(r.x0,r.y0,r.x1-r.x0,r.y1-r.y0);
  for(let y=Math.max(0,Math.floor(r.y0/TILE));y<=Math.min(3,Math.floor(r.y1/TILE));y++)for(let x=Math.max(0,Math.floor(r.x0/TILE));x<=Math.min(3,Math.floor(r.x1/TILE));x++){
    const image=tile(G,x,y,night);if(image)c.drawImage(image,x*TILE,y*TILE,TILE+.5,TILE+.5);
  }
  G._outerBuilt=0;
  if(r.x1>CORE||r.y1>CORE)for(let y=Math.max(0,Math.floor(r.y0/OUTER));y<=Math.min(WORLD_H/OUTER-1,Math.floor(r.y1/OUTER));y++)for(let x=Math.max(0,Math.floor(r.x0/OUTER));x<=Math.min(WORLD_W/OUTER-1,Math.floor(r.x1/OUTER));x++){
    if(x*OUTER<CORE&&y*OUTER<CORE)continue;const image=outerTile(G,x,y);if(image)c.drawImage(image,x*OUTER,y*OUTER,OUTER+.5,OUTER+.5);
  }
  drawExpansionOverhead(G,r);
  c.fillStyle='#17201f';for(const s of G.skids){if(s.x<r.x0||s.x>r.x1||s.y<r.y0||s.y>r.y1)continue;c.globalAlpha=s.a*.4;c.fillRect(s.x-7,s.y-3,3,6);c.fillRect(s.x+5,s.y-3,3,6);}c.globalAlpha=1;
  for(const p of G.props){
    if(p.x<r.x0||p.x>r.x1||p.y<r.y0||p.y>r.y1)continue;
    const image=G.assets.sprites['prop_'+p.kind];if(!image)continue;
    c.save();c.translate(p.x,p.y);c.rotate(p.rot||0);c.globalAlpha=p.broken?.7:1;c.drawImage(image,-16,-16,32,32);c.restore();
  }
  for(const p of G.pickups)if(!p.got&&p.x>r.x0&&p.x<r.x1&&p.y>r.y0&&p.y<r.y1)c.drawImage(G.assets.chipIcon,p.x-8,p.y-8,16,16);
  H.drawObjectiveGround(G);
  const actors=[];for(const v of G.vehicles)if(v.x>r.x0-80&&v.x<r.x1+80&&v.y>r.y0-80&&v.y<r.y1+80)actors.push(v);
  for(const p of G.peds)if(p.x>r.x0-30&&p.x<r.x1+30&&p.y>r.y0-60&&p.y<r.y1+30)actors.push(p);
  if(G.player.type==='foot')actors.push(G.player);
  actors.sort((a,b)=>(a.dead?-1e6:a.y)-(b.dead?-1e6:b.y));
  for(const a of actors)a.def?H.drawVeh(G,a):H.drawChar(G,a);
  drawExpansionPeople(G,r);H.drawAirborne?.(G,r);
  H.drawParticles(G,r,false);
  // One restrained ambient tint, with a small set of additive lights. No full-screen light-map passes.
  c.setTransform(1,0,0,1,0,0);const amb=ambientAt(G.time);c.fillStyle=`rgba(7,15,32,${night?.16:Math.max(0,(235-amb[0])/500)})`;c.fillRect(0,0,G.canvas.width,G.canvas.height);
  H.worldXform(G,c,r.S);c.globalCompositeOperation='lighter';
  if(night){const glow=LIGHT.radial('rgba(255,190,110,0.65)',64);let count=0;for(const lamp of G.meta.lights){if(lamp.x<r.x0||lamp.x>r.x1||lamp.y<r.y0||lamp.y>r.y1)continue;c.globalAlpha=.18;c.drawImage(glow,lamp.x-42,lamp.y-42,84,84);if(++count===12)break;}}
  for(const v of actors)if(v.def&&!v.dead&&!(v.def.aircraft&&v.altitude>10)&&(night||v.cop)){
    const s=Math.sin(v.rot),co=Math.cos(v.rot);c.globalAlpha=.65;c.fillStyle=v.cop?(G.ticks%36<18?'#ff5676':'#65a8ff'):'#e9ecc4';
    const d=v.def.bike?30:46;c.beginPath();c.arc(v.x+s*d,v.y-co*d,3.5,0,Math.PI*2);c.fill();
    if(v===G.player&&night){c.save();c.translate(v.x,v.y);c.rotate(v.rot);c.globalAlpha=.12;c.fillStyle='#e7e5b6';c.beginPath();c.moveTo(-14,-42);c.lineTo(-48,-165);c.lineTo(48,-165);c.lineTo(14,-42);c.fill();c.restore();}
  }
  c.globalCompositeOperation='source-over';c.globalAlpha=1;H.drawParticles(G,r,true);H.drawObjectiveBeacon(G);H.drawStreetWaypoint(G);H.drawAimGuide(G);if(G.heliChase)H.drawHeli(G,night?1:0,false);
  c.setTransform(1,0,0,1,0,0);
  if(G.rainAmt>.15&&!G.settings.reducedMotion){c.strokeStyle='rgba(190,216,230,.22)';c.lineWidth=1;c.beginPath();for(let i=0;i<28;i++){const x=(i*97+G.ticks*1.5)%G.canvas.width,y=(i*137+G.ticks*6)%G.canvas.height;c.moveTo(x,y);c.lineTo(x+3,y+9);}c.stroke();}
  if(G.hurtT>0){c.fillStyle=`rgba(155,30,38,${Math.min(.12,G.hurtT*.22)})`;c.fillRect(0,0,G.canvas.width,G.canvas.height);G.hurtT=Math.max(0,G.hurtT-1/30);}
  G.mobileRenderStats={tiles:G.mobileTiles?.size||0,outerTiles:G.mobileOuter?.size||0,actors:actors.length};
}
