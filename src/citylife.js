/* Cached illustrated street furniture and architecture; anchored to actual walkable city edges. */
import {hash} from './visuals.js';
import {loadScenery} from './assets.js';
import {BAKED_WORLD} from './baked_world_manifest.js';
import {projectedRoofBounds} from './render_world.js';
import {roofDetailPlan} from './architecture_art.js';
import {buildStreetDesign,indexStreetItems,streetItemsInView,frontageSprite,FIXTURE_SIZES} from './street_design.js';
const TAU=Math.PI*2;
const colors=['#ac4540','#2c6663','#d0b47b','#304f68','#736047'];
const within=(p,r,m=120)=>p.x>r.x0-m&&p.x<r.x1+m&&p.y>r.y0-m&&p.y<r.y1+m;
function oval(c,x,y,w,h,col){c.fillStyle=col;c.beginPath();c.ellipse(x,y,w,h,0,0,TAU);c.fill();}
function panel(c,x,y,w,h,col){c.fillStyle='rgba(0,0,0,.3)';c.fillRect(x+3,y+5,w,h);c.fillStyle=col;c.fillRect(x,y,w,h);c.fillStyle='rgba(255,255,255,.14)';c.fillRect(x,y,w,2);}
export function buildStreetScene(G){
 const design=buildStreetDesign(G),fixtures=design.fixtures;let i=fixtures.length;
 // The casino's actual tables and canal benches are social destinations.
 for(const p of G.world.expansion?.decor||[])if(['roulette','blackjack','canal'].includes(p.kind))fixtures.push({x:p.x,y:p.y,rot:0,kind:p.kind==='canal'?3:0,seed:hash(p.x+p.y),id:i++,hidden:true});
 G.street={...design,fixtures,fixtureBins:indexStreetItems(fixtures),cache:new Map(),frontageCache:new Map(),roadCache:new Map(),revision:0};
 loadStreetArt(G);
 const origin=G.meta.spawns.player;
 for(const p of fixtures.filter(p=>Math.hypot(p.x-origin[0],p.y-origin[1])<1250).slice(0,24)){
  if(p.kind===4)continue;
  const x=p.x+Math.cos(p.rot)*28,y=p.y+Math.sin(p.rot)*28;
  if(!['walk','lot'].includes(G.surfaceAt(x,y)))continue;
  G.peds.push({x,y,rot:Math.PI+p.rot,vx:0,vy:0,sprite:['guest','m2','worker','m4','cabbie','valet'][p.kind],speed:0,walk:26,dist:0,flee:0,r:8,hp:30,dead:false,ambient:true,gather:{x,y}});
 }
 return G.street;
}
export function loadStreetArt(G){
 const street=G.street;if(!street)return Promise.resolve();
 if(street.atlas||(street.retryAt||0)>performance.now())return Promise.resolve();
 if(street.loading)return street.loading;
 street.loading=loadScenery(`assets/premium/street-furniture.webp?v=${BAKED_WORLD.version}`,576).then(im=>{
  street.atlas=im;for(const canvas of street.cache.values())canvas.width=1;street.cache.clear();street.revision++;
 }).catch(()=>{street.retryAt=performance.now()+10000;}).finally(()=>{street.loading=null;});return street.loading;
}
function fixtureArt(G,kind,seed){
 const key=kind+':'+Math.floor(seed*4);let canvas=G.street.cache.get(key);if(canvas)return canvas;
 canvas=document.createElement('canvas');canvas.width=canvas.height=160;const c=canvas.getContext('2d',{willReadFrequently:true});c.translate(80,80);
 const col=colors[Math.floor(seed*colors.length)];
 const [width,height]=FIXTURE_SIZES[kind];
 // Tight contact shadow stays inside the validated footprint.
 oval(c,1,3,width*.42,height*.32,'rgba(0,0,0,.14)');
 if(G.street.atlas){
  const im=G.street.atlas;
  c.drawImage(im,(kind%3)*im.width/3,Math.floor(kind/3)*im.height/2,im.width/3,im.height/2,-width/2,-height/2,width,height);
  G.street.cache.set(key,canvas);return canvas;
 }
 c.scale(width/112,height/96);
 if(kind===0){ // pavement cafe
  for(const x of [-27,27]){
   for(const side of [-1,1]){panel(c,x-6,side*19-5,12,11,'#584c3e');c.fillStyle='#ae9876';c.fillRect(x-6,side*19-5,12,2);}
   oval(c,x,0,17,12,'#3a3027');oval(c,x,-2,17,12,'#d2b087');
   c.strokeStyle='#9d7d5c';c.lineWidth=.8;for(let y=-8;y<7;y+=4){c.beginPath();c.moveTo(x-13,y);c.lineTo(x+13,y);c.stroke();}
   oval(c,x-5,-2,3,2,'#f1e9d9');oval(c,x+5,1,2,2,'#f5e8dc');panel(c,x-2,-7,5,4,'#91806c');
  }
 }else if(kind===1){ // market cart / striped canopy
  panel(c,-29,-15,58,34,'#a88d62');for(const x of [-25,25]){oval(c,x,18,5,3,'#202326');}
  for(let x=-31;x<30;x+=8){c.fillStyle=(x+31)%16===0?col:'#d9c8a8';c.fillRect(x,-29,8,32);c.fillStyle='rgba(0,0,0,.2)';c.fillRect(x,-1,8,4);}
  c.fillStyle='#283130';c.fillRect(-25,10,50,2);for(let x=-20;x<22;x+=8){oval(c,x,8,3,2,['#d3b14e','#9c4c32','#738a40'][(x+20)/8%3|0]);}
 }else if(kind===2){ // bus shelter, route display, bins
  panel(c,-42,-13,78,27,'#273b46');panel(c,-40,-14,74,3,'#acc3c9');
  c.fillStyle='rgba(123,187,192,.4)';c.fillRect(-39,-10,72,17);c.strokeStyle='#9aafb2';c.lineWidth=2;for(const x of [-38,0,33]){c.beginPath();c.moveTo(x,-10);c.lineTo(x,17);c.stroke();}
  panel(c,-28,12,49,7,'#6d6457');panel(c,43,-16,9,36,'#202b35');panel(c,44,-13,7,14,'#d9c580');
  c.fillStyle='#d8d5b1';c.font='bold 7px sans-serif';c.fillText('07',43,-1);panel(c,44,26,11,13,'#344d40');
 }else if(kind===3){ // palms and flower beds
  for(const x of [-30,30]){panel(c,x-13,-7,26,22,'#867b69');oval(c,x,0,11,8,'#283b25');for(let j=0;j<9;j++){const a=j*2.4;oval(c,x+Math.cos(a)*8,Math.sin(a)*6,4,3,['#597344','#718552','#3b6346'][j%3]);}}
  panel(c,-15,17,30,8,'#726146');for(const x of [-11,11])panel(c,x,22,3,6,'#222a26');
 }else if(kind===4){ // loading bay, crates, pallet and bins
  panel(c,-35,-17,45,33,'#775842');c.strokeStyle='#382d26';c.lineWidth=1;for(let y=-14;y<17;y+=6){c.beginPath();c.moveTo(-35,y);c.lineTo(10,y);c.stroke();}
  panel(c,-28,-27,21,22,'#b29a71');c.strokeStyle='#725b3b';c.strokeRect(-25,-24,15,16);c.beginPath();c.moveTo(-25,-24);c.lineTo(-10,-8);c.stroke();
  panel(c,18,-15,18,27,'#315b4c');panel(c,16,-18,22,7,'#213d34');for(const x of [20,29])oval(c,x,14,3,2,'#171f1b');
  c.fillStyle='#b9ac8b';for(let k=0;k<9;k++)c.fillRect(-40+hash(seed+k)*85,19+hash(seed+k+8)*13,3,2);
 }else{ // newsstand and newspaper bundles
  panel(c,-28,-22,54,38,'#4b514e');panel(c,-32,-29,62,12,col);panel(c,-24,-15,45,20,'#273334');
  for(let k=0;k<5;k++){panel(c,-21+k*8,-12,6,14,['#c2b18b','#998f82','#ba695c','#6f91a3','#cfbd88'][k]);}
  panel(c,-32,22,20,11,'#c5bda7');for(let y=24;y<31;y+=2){c.fillStyle='#6a6960';c.fillRect(-29,y,14,1);}
  c.fillStyle='#f0d7a7';c.font='bold 6px sans-serif';c.textAlign='center';c.fillText('CITY / DAILY',0,-20);
 }
 G.street.cache.set(key,canvas);return canvas;
}
function* roadArtSteps(G,ix,iy){
 // Mobile scenery is composited at half scale. Rasterize its street details
 // at that same size instead of holding twelve redundant 1024 KiB canvases.
 const size=G.settings.quality==='low'?256:512,key=ix+':'+iy+':'+size,limit=G.settings.quality==='low'?12:G.settings.quality==='med'?24:48;
 for(const [oldKey,canvas] of G.street.roadCache)if(canvas.width!==size||G.street.roadCache.size>limit){G.street.roadCache.delete(oldKey);canvas.width=canvas.height=1;}
 let c=G.street.roadCache.get(key);if(c)return c;
 c=document.createElement('canvas');c.width=c.height=size;const x=c.getContext('2d',{willReadFrequently:true});x.scale(size/512,size/512);
 for(let j=0;j<24;j++){yield;
  const seed=ix*138+iy*73+j*9,px=hash(seed)*500,py=hash(seed+4)*500,wx=ix*512+px,wy=iy*512+py;
  if(!['road','walk','lot'].includes(G.surfaceAt(wx,wy)))continue;
  if(j%4===0){
   oval(x,px+2,py+2,8,6,'rgba(0,0,0,.3)');oval(x,px,py,8,6,'#42454b');x.strokeStyle='#737473';x.lineWidth=.7;x.beginPath();x.ellipse(px,py,6,4,0,0,TAU);x.stroke();
   for(let k=-3;k<=3;k+=2){x.beginPath();x.moveTo(px-4,py+k);x.lineTo(px+4,py+k);x.stroke();}
  }else if(j%4===1){
   x.strokeStyle='rgba(11,16,20,.45)';x.lineWidth=.7;x.beginPath();x.moveTo(px,py);x.lineTo(px+11,py-3);x.lineTo(px+17,py+4);x.lineTo(px+26,py+1);x.stroke();
  }else if(j%4===2){oval(x,px,py,9,3,'rgba(12,16,20,.12)');}
  else{ x.save();x.translate(px,py);x.rotate(hash(seed+9)*6);panel(x,-2,-2,4,3,'rgba(199,189,163,.4)');x.restore();}
 }
 if(G.street.roadCache.size>=limit){const oldest=G.street.roadCache.keys().next().value;const old=G.street.roadCache.get(oldest);G.street.roadCache.delete(oldest);old.width=old.height=1;}
 G.street.roadCache.set(key,c);return c;
}
export function* streetSceneSteps(G,r,c=G.ctx){
 if(!G.street)buildStreetScene(G);
 if(!G.street.atlas)loadStreetArt(G);
 for(let ix=Math.max(0,Math.floor(r.x0/512));ix<=Math.floor(r.x1/512);ix++)for(let iy=Math.max(0,Math.floor(r.y0/512));iy<=Math.floor(r.y1/512);iy++){const art=yield* roadArtSteps(G,ix,iy);c.drawImage(art,ix*512,iy*512,512,512);}
 for(const p of streetItemsInView(G.street,r,'frontageBins')){yield;c.save();c.translate(p.x,p.y);c.rotate(p.rot);c.drawImage(frontageSprite(G.street,p),-32,-16,64,32);c.restore();}
 for(const p of streetItemsInView(G.street,r)){if(p.hidden)continue;yield;c.save();c.translate(p.x,p.y);c.rotate(p.rot);c.drawImage(fixtureArt(G,p.kind,p.seed),-80,-80);c.restore();}
 // Distinct, legible workshop forecourts.
 for(const s of G.services||[]){if(!within(s,r))continue;c.save();c.translate(s.x,s.y);c.fillStyle='rgba(7,13,18,.45)';c.fillRect(-46,-24,92,48);c.strokeStyle=s.id==='clinic'?'#a7e0bc':'#e0bd76';c.lineWidth=1.5;c.setLineDash([5,5]);c.strokeRect(-46,-24,92,48);c.setLineDash([]);c.font='bold 8px sans-serif';c.textAlign='center';c.fillStyle='#ead7ae';c.fillText(s.id==='clinic'?'MED / AMMO':s.id==='spray'?'RESPRAY':'CUSTOMS',0,4);c.restore();}
}
export function drawStreetScene(G,r){for(const step of streetSceneSteps(G,r)){} }
export function drawRoofDetail(G,r){
 // Roof furnishings are baked with their actual building. The painted core
 // retains its authored rooftops; only visible fan rotors animate on Ultra.
 if(G.settings.quality!=='high'||G.settings.reducedMotion)return;
 const c=G.ctx,roof={},t=G.ticks/60;let budget=18;
 for(const b of G.bld.inView(r)){
  if(b.core||b.helipad)continue;const plan=roofDetailPlan(b);if(!plan.fans.length)continue;
  projectedRoofBounds(b,G.cam,roof);const {x,y,w,h}=roof;
  c.save();if(G.scene!=='title'&&G.player.type==='foot'&&G.player.x>x-12&&G.player.x<x+w+12&&G.player.y-22>y&&G.player.y-22<y+h)c.globalAlpha*=.24;
  c.translate(x,y);c.scale(w/b.w,h/b.h);c.strokeStyle='#a9b7af';c.lineWidth=.9;
  for(const f of plan.fans){if(budget--<=0)break;const a=t*2+(b.seed||0),cx=f.x+f.w/2,cy=f.y+f.h/2;
   c.beginPath();c.moveTo(cx-Math.cos(a)*4,cy-Math.sin(a)*4);c.lineTo(cx+Math.cos(a)*4,cy+Math.sin(a)*4);c.moveTo(cx+Math.sin(a)*4,cy-Math.cos(a)*4);c.lineTo(cx-Math.sin(a)*4,cy+Math.cos(a)*4);c.stroke();
  }c.restore();if(budget<=0)break;
 }
}
export function drawAmbientGesture(G,p){
 if(p.dead||p.copPed||p.flee>0||((p.speed||0)>20&&p.cityActivity!=='shopping'))return;
 const c=G.ctx,t=G.settings.reducedMotion?0:G.ticks/60,seed=hash(p.x+p.y);
 c.save();c.translate(0,-23);c.rotate(p.rot||0);
 if(p.cityActivity==='bus'||p.cityActivity==='news'||(!p.cityActivity&&seed<.34)){ // phone screen
  c.translate(8,-9);c.rotate(Math.sin(t*.8+seed)*.1);panel(c,-2,-3,4,7,'#16272e');c.fillStyle='#83b7bb';c.fillRect(-1,-2,2,4);
 }else if(p.cityActivity==='coffee'||p.cityActivity==='conversation'||(!p.cityActivity&&seed<.67)){ // cup / conversation gesture
  const wave=Math.sin(t*2+seed*19)*2;oval(c,10+wave,-8,2.7,2,'#ddd1b8');c.strokeStyle='#e6d8c3';c.lineWidth=.7;c.beginPath();c.arc(13+wave,-8,1.5,0,TAU);c.stroke();
 }else{ // small shopping bag
  panel(c,-13,1,8,10,'#a28659');c.strokeStyle='#d6c5a3';c.lineWidth=1;c.beginPath();c.arc(-9,2,3,Math.PI,TAU);c.stroke();
 }
 c.restore();
}
