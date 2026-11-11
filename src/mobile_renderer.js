import {drawCityHubs} from './world_hubs.js';
/* A bounded painted-city renderer. Static layers are composed once, never per frame. */
import {mobileTint,LIGHT,visibleStreetLights,drawTrafficSignals} from './lighting.js';
import {loadImage} from './assets.js';
import {drawStreetScene,loadStreetArt} from './citylife.js';
import {drawExpansionPeople} from './expansion.js';
import {drawExpansionOverhead} from './expansion_world.js';
import {WORLD_W,WORLD_H} from './world.js';
import {drawTransitWorld} from './transit.js';
import {drawCasinoWorld} from './casino.js';
import {drawWildlife} from './wildlife.js';
import {drawLocalAtmosphere} from './world_effects.js';
const CORE=4096,TILE=1024,OUTER=512;
function retire(e){e.retired=true;e.bitmap?.close();if(e.canvas)e.canvas.width=1;}
function seal(e){
  // Immutable bitmap copies avoid repeated canvas-to-canvas uploads on Android.
  if(typeof createImageBitmap==='function')createImageBitmap(e.canvas).then(bitmap=>{if(e.retired)bitmap.close();else{e.bitmap=bitmap;e.canvas.width=1;}}).catch(()=>{});
  return e;
}
function trim(cache,limit){if(cache.size<=limit)return;const cold=[...cache].sort((a,b)=>a[1].t-b[1].t);for(let i=0;i<cold.length-limit;i++){retire(cold[i][1]);cache.delete(cold[i][0]);}}
function outerTile(G,tx,ty){
 const cache=G.mobileOuter||(G.mobileOuter=new Map()),key=tx+':'+ty,revision=G.ground.revision*100+(G.street?.revision||0);
 let entry=cache.get(key);if(entry&&entry.revision===revision){entry.t=G.ticks;return entry.bitmap||entry.canvas;}
 if(G._outerBuilt>=2||G._outerBuilt>0&&performance.now()-G._outerStart>5)return null;G._outerBuilt++;if(entry)retire(entry);
 const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const c=canvas.getContext('2d',{alpha:false});
 c.fillStyle='#193e43';c.fillRect(0,0,256,256);c.scale(.5,.5);c.translate(-tx*OUTER,-ty*OUTER);
 const r={x0:tx*OUTER,y0:ty*OUTER,x1:(tx+1)*OUTER-.01,y1:(ty+1)*OUTER-.01};
 G.ground.draw(c,r,0);G.bld.staticDraw(c,r);
 const prior=G.ctx;G.ctx=c;try{drawStreetScene(G,r);}finally{G.ctx=prior;}
 entry=seal({canvas,revision,t:G.ticks});cache.set(key,entry);trim(cache,G._outerLimit||40);return entry.canvas;
}
function tile(G,tx,ty,night) {
  const cache=G.mobileTiles||(G.mobileTiles=new Map()),key=`${tx}:${ty}:${night}`;
  let e=cache.get(key);
  if(!e){
    e={image:null,t:G.ticks,pending:false,retryAt:0};cache.set(key,e);
    const limit=G._coreLimit||16;if(cache.size>limit){const cold=[...cache].sort((a,b)=>a[1].t-b[1].t);for(let i=0;i<cold.length-limit;i++)cache.delete(cold[i][0]);}
  }
  if(!e.image&&!e.pending&&G.ticks>=e.retryAt){e.pending=true;loadImage(`assets/mobile/${night?'night':'day'}/${tx}_${ty}.webp`).then(im=>{e.image=im;}).catch(()=>{e.retryAt=G.ticks+600;}).finally(()=>e.pending=false);}
  e.t=G.ticks;
  // The boot albedo keeps the first frame painted while its finished tile decodes.
  return e.image||G.assets.layers.albedo?.img.get(tx+'_'+ty)||null;
}
// Reuse tile descriptors as the camera travels within its current tile range.
// Warm views need no distance sort; centre-first ordering matters only while
// composition is pending. Rotation still gets an exact per-frame visibility test.
export function visibleOuterTiles(G,r){
 const x0=Math.max(0,Math.floor(r.x0/OUTER)),y0=Math.max(0,Math.floor(r.y0/OUTER)),x1=Math.min(WORLD_W/OUTER-1,Math.floor(r.x1/OUTER)),y1=Math.min(WORLD_H/OUTER-1,Math.floor(r.y1/OUTER));
 let plan=G._outerPlan;
 if(!plan||plan.x0!==x0||plan.y0!==y0||plan.x1!==x1||plan.y1!==y1){
  const slots=plan?.slots||[];let n=0;
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
   if(x*OUTER<CORE&&y*OUTER<CORE)continue;
   const p=slots[n]||(slots[n]={});Object.assign(p,{x,y,key:x+':'+y,cx:(x+.5)*OUTER,cy:(y+.5)*OUTER});n++;
  }
  slots.length=n;plan=G._outerPlan={x0,y0,x1,y1,slots};
 }
 const queue=G._outerQueue||(G._outerQueue=[]);queue.length=0;
 const co=Math.cos(G.cam.rot),si=Math.sin(G.cam.rot),halfW=G.canvas.width/(2*r.S),halfH=G.canvas.height/(2*r.S),margin=OUTER*.708,revision=G.ground.revision*100+(G.street?.revision||0);let pending=false;
 for(const p of plan.slots){const dx=p.cx-G.cam.x,dy=p.cy-G.cam.y;
  if(Math.abs(dx*co+dy*si)>halfW+margin||Math.abs(-dx*si+dy*co)>halfH+margin)continue;
  p.d=dx*dx+dy*dy;queue.push(p);const entry=G.mobileOuter?.get(p.key);if(!entry||entry.revision!==revision)pending=true;
 }
 if(pending)queue.sort((a,b)=>a.d-b.d);
 return queue;
}
export function drawMobileWorld(G,H) {
  if(G.street&&!G.street.atlas)loadStreetArt(G);
  const c=G.ctx,r=H.viewRect(G),tint=mobileTint(G.time),night=tint.night;
  const coreCols=Math.max(0,Math.min(3,Math.floor(r.x1/TILE))-Math.max(0,Math.floor(r.x0/TILE))+1),coreRows=Math.max(0,Math.min(3,Math.floor(r.y1/TILE))-Math.max(0,Math.floor(r.y0/TILE))+1);G._coreLimit=Math.min(32,Math.max(16,coreCols*coreRows*(night>.02&&night<.98?2:1)+2));
  H.worldXform(G,c,r.S);c.imageSmoothingQuality='low';c.fillStyle='#123943';c.fillRect(r.x0,r.y0,r.x1-r.x0,r.y1-r.y0);
  for(let y=Math.max(0,Math.floor(r.y0/TILE));y<=Math.min(3,Math.floor(r.y1/TILE));y++)for(let x=Math.max(0,Math.floor(r.x0/TILE));x<=Math.min(3,Math.floor(r.x1/TILE));x++){
    const image=tile(G,x,y,night>.98);if(image)c.drawImage(image,x*TILE,y*TILE,TILE+.5,TILE+.5);
    if(night>.02&&night<=.98){const lit=tile(G,x,y,true);if(lit){c.globalAlpha=night;c.drawImage(lit,x*TILE,y*TILE,TILE+.5,TILE+.5);c.globalAlpha=1;}}
  }
  G._outerBuilt=0;G._outerStart=performance.now();let pending=0;
  const queue=visibleOuterTiles(G,r);
  // A rotated aircraft view can exceed the old 40-tile cache and evict itself forever.
  // Size to the visible working set, with a hard 24 MiB bitmap ceiling and center-first work.
  G._outerLimit=Math.min(96,Math.max(40,queue.length+8));
  for(const {x,y} of queue){const image=outerTile(G,x,y);if(image)c.drawImage(image,x*OUTER,y*OUTER,OUTER+.5,OUTER+.5);else{pending++;const surface=G.surfaceAt((x+.5)*OUTER,(y+.5)*OUTER);c.fillStyle=surface==='water'||surface==='canal'?'#193e43':surface==='grass'?'#59634b':surface==='sand'?'#9d8964':'#555d58';c.fillRect(x*OUTER,y*OUTER,OUTER+.5,OUTER+.5);}}
  // Zooming back in must release the old wider working set even when all newly
  // visible tiles are warm and no composition call would otherwise trim it.
  if(G.mobileOuter)trim(G.mobileOuter,G._outerLimit);
  drawCityHubs(G,r);
  drawExpansionOverhead(G,r);
  drawTransitWorld(G,r);
  drawCasinoWorld(G,r);
  drawTrafficSignals(G,r);
  c.fillStyle='#17201f';for(const s of G.skids){if(s.x<r.x0||s.x>r.x1||s.y<r.y0||s.y>r.y1)continue;c.globalAlpha=s.a*.4;c.fillRect(s.x-7,s.y-3,3,6);c.fillRect(s.x+5,s.y-3,3,6);}c.globalAlpha=1;
  for(const p of G.props){
    if(p.x<r.x0||p.x>r.x1||p.y<r.y0||p.y>r.y1)continue;
    const image=G.assets.sprites['prop_'+p.kind];if(!image)continue;
    c.save();c.translate(p.x,p.y);c.rotate(p.rot||0);c.globalAlpha=p.broken?.7:1;c.drawImage(image,-16,-16,32,32);c.restore();
  }
  for(const p of G.pickups)if(!p.got&&p.x>r.x0&&p.x<r.x1&&p.y>r.y0&&p.y<r.y1)c.drawImage(G.assets.chipIcon,p.x-8,p.y-8,16,16);
  H.drawObjectiveGround(G);
  const actors=G._mobileActors||(G._mobileActors=[]);actors.length=0;for(const v of G.vehicles)if(v.x>r.x0-80&&v.x<r.x1+80&&v.y>r.y0-80&&v.y<r.y1+80)actors.push(v);
  for(const p of G.peds)if(p.x>r.x0-30&&p.x<r.x1+30&&p.y>r.y0-60&&p.y<r.y1+30)actors.push(p);
  if(G.player.type==='foot')actors.push(G.player);
  actors.sort((a,b)=>(a.dead?-1e6:a.y)-(b.dead?-1e6:b.y));
  for(const a of actors)a.def?H.drawVeh(G,a):H.drawChar(G,a);
  drawWildlife(G,r);drawExpansionPeople(G,r);drawTransitWorld(G,r,true);H.drawAirborne?.(G,r);
  H.drawParticles(G,r,false);
  // One restrained ambient tint, with a small set of additive lights. No full-screen light-map passes.
  c.setTransform(1,0,0,1,0,0);c.fillStyle=`rgba(7,15,32,${tint.alpha})`;c.fillRect(0,0,G.canvas.width,G.canvas.height);
  if(tint.warm>.002){c.fillStyle=`rgba(246,149,82,${tint.warm})`;c.fillRect(0,0,G.canvas.width,G.canvas.height);}
  H.worldXform(G,c,r.S);c.globalCompositeOperation='lighter';
  if(night>.02){const glow=LIGHT.radial('rgba(255,190,110,0.65)',64);c.globalAlpha=.2*night;for(const lamp of visibleStreetLights(G,r,16))c.drawImage(glow,lamp.x-42,lamp.y-42,84,84);}
  for(const v of actors)if(v.def&&!v.dead&&!v.def.boat&&!v.def.aircraft&&(v===G.player||v.traffic||v.ai||v.siren||v.role||v.loose&&v.looseT<6)&&(night||v.cop)){
    const s=Math.sin(v.rot),co=Math.cos(v.rot);c.globalAlpha=.65*(v.cop?1:night);c.fillStyle=v.cop?(G.ticks%36<18?'#ff5676':'#65a8ff'):'#e9ecc4';
    const d=v.def.bike?16:Math.max(24,v.r*1.05);c.beginPath();c.arc(v.x+s*d,v.y-co*d,3.5,0,Math.PI*2);c.fill();
    if(v===G.player&&night){c.save();c.translate(v.x,v.y);c.rotate(v.rot);c.globalAlpha=.12*night;c.fillStyle='#e7e5b6';c.beginPath();c.moveTo(-14,-42);c.lineTo(-48,-165);c.lineTo(48,-165);c.lineTo(14,-42);c.fill();c.restore();}
  }
  for(const f of G.flashes){if(f.x+f.r<r.x0||f.x-f.r>r.x1||f.y+f.r<r.y0||f.y-f.r>r.y1)continue;c.globalAlpha=Math.min(1,f.life/(f.max||.07))*.55;c.drawImage(LIGHT.radial(f.col),f.x-f.r*.5,f.y-f.r*.5,f.r,f.r);}
  c.globalCompositeOperation='source-over';c.globalAlpha=1;drawLocalAtmosphere(G,r);H.drawParticles(G,r,true);H.drawObjectiveBeacon(G);H.drawStreetWaypoint(G);H.drawAimGuide(G);if(G.heliChase)H.drawHeli(G,night,false);
  c.setTransform(1,0,0,1,0,0);
  if(G.rainAmt>.15&&!G.settings.reducedMotion){c.strokeStyle='rgba(190,216,230,.22)';c.lineWidth=1;c.beginPath();for(let i=0;i<28;i++){const x=(i*97+G.ticks*1.5)%G.canvas.width,y=(i*137+G.ticks*6)%G.canvas.height;c.moveTo(x,y);c.lineTo(x+3,y+9);}c.stroke();}
  if(G.hurtT>0){c.fillStyle=`rgba(155,30,38,${Math.min(.12,G.hurtT*.22)})`;c.fillRect(0,0,G.canvas.width,G.canvas.height);}
  G.mobileRenderStats={tiles:G.mobileTiles?.size||0,outerTiles:G.mobileOuter?.size||0,outerVisible:queue.length,outerPending:pending,outerLimit:G._outerLimit,groundChunks:G.ground.cache.size,groundLimit:G.ground.maxChunks,actors:actors.length};
}
