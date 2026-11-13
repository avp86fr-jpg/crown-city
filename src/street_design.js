/* Full-footprint street composition. A cafe belongs on a plaza, not halfway
   across a lane; all placement checks use the same playable surface map. */
import {inCityHub} from './world_hubs.js';
const BIN=256;
const seedAt=(x,y)=>{let n=(Math.imul(x|0,73856093)^Math.imul(y|0,19349663))>>>0;return (Math.imul(n^(n>>>16),2246822507)>>>0)/4294967296;};
export const FIXTURE_SIZES=Object.freeze([[88,64],[48,52],[94,38],[84,34],[46,40],[44,48]].map(Object.freeze));
export function fixtureBounds(p,w=FIXTURE_SIZES[p.kind][0],h=FIXTURE_SIZES[p.kind][1]){
 const co=Math.abs(Math.cos(p.rot||0)),si=Math.abs(Math.sin(p.rot||0)),rx=(w*co+h*si)/2,ry=(w*si+h*co)/2;
 return {x:p.x-rx,y:p.y-ry,w:rx*2,h:ry*2};
}
export function safeStreetFootprint(G,bounds){
 // Include both edges and sample the interior: checking four corners misses a
 // one-cell road, parking aisle or bank running through a wide cafe sprite.
 const nx=Math.ceil(bounds.w/8),ny=Math.ceil(bounds.h/8);
 for(let y=0;y<=ny;y++)for(let x=0;x<=nx;x++){
  const px=bounds.x+x*bounds.w/nx,py=bounds.y+y*bounds.h/ny,s=G.surfaceAt(px,py);
  if(s!=='walk'&&s!=='pier'||G.solidAt?.(px,py))return false;
 }return true;
}
const overlap=(a,b,pad=0)=>a.x<b.x+b.w+pad&&a.x+a.w>b.x-pad&&a.y<b.y+b.h+pad&&a.y+a.h>b.y-pad;
export function indexStreetItems(items){
 const bins=new Map();for(const p of items){const key=Math.floor(p.x/BIN)+':'+Math.floor(p.y/BIN);let list=bins.get(key);if(!list){list=[];bins.set(key,list);}list.push(p);}return bins;
}
export function* streetItemsInView(street,r,key='fixtureBins',pad=100){
 const bins=street[key];if(!bins)return;
 for(let y=Math.floor((r.y0-pad)/BIN);y<=Math.floor((r.y1+pad)/BIN);y++)for(let x=Math.floor((r.x0-pad)/BIN);x<=Math.floor((r.x1+pad)/BIN);x++){
  const list=bins.get(x+':'+y);if(!list)continue;
  for(const p of list)if(p.x>=r.x0-pad&&p.x<=r.x1+pad&&p.y>=r.y0-pad&&p.y<=r.y1+pad)yield p;
 }
}
function candidates(b,depth,width){
 const points=[],offset=depth/2+8;
 for(const f of [.5,.24,.76]){
  if(b.w>=width+14){points.push({x:b.x+b.w*f,y:b.y+b.h+offset,rot:0});points.push({x:b.x+b.w*f,y:b.y-offset,rot:Math.PI});}
  if(b.h>=width+14){points.push({x:b.x-offset,y:b.y+b.h*f,rot:Math.PI/2});points.push({x:b.x+b.w+offset,y:b.y+b.h*f,rot:-Math.PI/2});}
 }return points;
}
export function buildStreetDesign(G){
 const fixtures=[],frontages=[],occupied=new Map(),reserved=[];
 const reserve=b=>{reserved.push(b);for(let y=Math.floor(b.y/BIN);y<=Math.floor((b.y+b.h)/BIN);y++)for(let x=Math.floor(b.x/BIN);x<=Math.floor((b.x+b.w)/BIN);x++){const key=x+':'+y;let list=occupied.get(key);if(!list){list=[];occupied.set(key,list);}list.push(b);}};
 const free=b=>{for(let y=Math.floor((b.y-8)/BIN);y<=Math.floor((b.y+b.h+8)/BIN);y++)for(let x=Math.floor((b.x-8)/BIN);x<=Math.floor((b.x+b.w+8)/BIN);x++)for(const other of occupied.get(x+':'+y)||[])if(overlap(b,other,8))return false;return true;};
 for(const s of G.services||[])reserve({x:s.x-60,y:s.y-38,w:120,h:76});
 for(const p of G.world.expansion?.contacts||[])reserve({x:p.x-30,y:p.y-30,w:60,h:60});
 for(const p of G.world.features||[])if(p.k==='fountain')reserve({x:p.x-p.r-10,y:p.y-p.r-10,w:(p.r+10)*2,h:(p.r+10)*2});
 // Composed plaza edges leave their central walking spine and fountain open.
 // Cafes need this deeper public paving; narrow sidewalks use benches instead.
 for(const plaza of G.world.features||[]){
  if(plaza.k!=='plaza'||plaza.w<150||plaza.h<180)continue;
  for(const [kind,x,y] of [[0,plaza.x+plaza.w/2,plaza.y+46],[3,plaza.x+plaza.w/2,plaza.y+plaza.h-27]]){
   const p={x,y,rot:0,kind},bounds=fixtureBounds(p);if(!safeStreetFootprint(G,bounds)||!free(bounds))continue;
   fixtures.push({...p,seed:seedAt(x,y),id:fixtures.length,name:'PUBLIC / PROMENADE',bounds});reserve(bounds);
  }
 }
 for(const b of [...G.meta.buildings,...G.world.buildings]){
  if(b.w<50||b.h<45||['pavilion','outpost','container'].includes(b.kind))continue;
  const seed=seedAt(b.x,b.y),industrial=['warehouse','hangar','garage'].includes(b.kind),home=['house','apt','villa','loft'].includes(b.kind),kind=industrial?4:home?3:Math.floor(seed*6);
  // A small, readable threshold explains where a closed building is entered;
  // it does not invent an interior or obstruct its usable sidewalk.
  if(!['casino','hangar'].includes(b.kind))for(const p of candidates(b,20,60)){
   const bounds=fixtureBounds(p,60,20);if(inCityHub(p.x,p.y,48)||!safeStreetFootprint(G,bounds)||!free(bounds))continue;
   const category=industrial?'workshop':home?'residential':b.kind==='office'?'office':'shop';
   frontages.push({...p,category,seed,index:Math.floor(seed*4),name:b.name||'',bounds});reserve({...bounds,x:bounds.x-3,y:bounds.y-3,w:bounds.w+6,h:bounds.h+6});break;
  }
  for(const choice of [kind,...(kind===3?[]:[3])]){
   const [w,h]=FIXTURE_SIZES[choice];let placed=false;
   for(const p of candidates(b,h,w)){
    const bounds=fixtureBounds(p,w,h);if(inCityHub(p.x,p.y,70)||!safeStreetFootprint(G,bounds)||!free(bounds))continue;
    fixtures.push({...p,kind:choice,seed,id:fixtures.length,name:b.name||'',bounds});reserve(bounds);placed=true;break;
   }if(placed)break;
  }
 }
 return {fixtures,frontages,fixtureBins:indexStreetItems(fixtures),frontageBins:indexStreetItems(frontages),placementStats:{fixtures:fixtures.length,frontages:frontages.length,reservations:reserved.length}};
}
const schemes={shop:['#526e6b','#e0cdaa','#a84e44','#c5a45d'],residential:['#677c69','#d4ccb0','#526a72','#9c8566'],office:['#3b626e','#d2d5bd','#56838b','#6a8585'],workshop:['#536364','#d5b777','#aa7350','#7e8d85']};
const signs={shop:['CROWN / RECORDS','AFTER HOURS','NIGHT MARKET','RIVER CAFE'],residential:['RESIDENCES','CROWN / ROOMS','GARDEN HOUSE','CITY APARTMENTS'],office:['CROWN / HOUSE','MERIDIAN','CITY EXCHANGE','ARCHIVE / 04'],workshop:['MOTOR / WORKS','CITY / SUPPLY','WAREHOUSE','GARAGE / 24']};
export function frontageSprite(street,p){
 const key=p.category+':'+p.index;let canvas=street.frontageCache.get(key);if(canvas)return canvas;
 canvas=document.createElement('canvas');canvas.width=128;canvas.height=64;const c=canvas.getContext('2d');c.translate(64,32);c.scale(2,2);
 const palette=schemes[p.category]||schemes.shop;c.fillStyle='rgba(16,28,29,.25)';c.fillRect(-29,-7,60,18);c.fillStyle=palette[0];c.fillRect(-30,-10,60,17);
 c.fillStyle='#223e43';c.fillRect(-25,-6,17,9);c.fillRect(8,-6,17,9);c.fillStyle='#8ea9a5';c.fillRect(-24,-6,15,1);c.fillRect(9,-6,15,1);
 c.fillStyle='#172f36';c.fillRect(-5,-6,10,13);c.fillStyle=palette[1];c.fillRect(-4,0,8,1);c.fillRect(2,-4,1,5);
 c.fillStyle=palette[2];c.fillRect(-30,-10,60,5);c.fillStyle=palette[1];for(let x=-29;x<29;x+=10)c.fillRect(x,-10,4,5);
 c.fillStyle=palette[3];c.fillRect(-7,7,14,3);c.fillStyle='#eadfc0';c.font='700 4px system-ui';c.textAlign='center';c.fillText(signs[p.category][p.index],0,-6.5,52);
 // Paved approach only; no solid prop is painted into the path.
 c.strokeStyle='rgba(39,65,62,.36)';c.lineWidth=.6;c.beginPath();c.moveTo(-8,11);c.lineTo(8,11);c.stroke();street.frontageCache.set(key,canvas);return canvas;
}
