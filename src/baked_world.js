import {loadScenery} from './assets.js';
import {BAKED_WORLD} from './baked_world_manifest.js';
const available=new Set(BAKED_WORLD.sheets),TILE=512,SIDE=4,PIXEL=256;
function release(e){e.retired=true;e.image?.close?.();e.image=null;}
export function releaseBakedWorld(G){if(!G.bakedWorld)return;for(const e of G.bakedWorld.sheets.values())release(e);G.bakedWorld.sheets.clear();G.bakedWorld=null;}
export function prepareBakedWorld(G,tiles){
 const state=G.bakedWorld||(G.bakedWorld={sheets:new Map(),frame:0,pending:0,ready:0,bytes:0}),wanted=new Map();state.frame++;
 for(const p of tiles){const key=Math.floor(p.x/SIDE)+'_'+Math.floor(p.y/SIDE);if(!available.has(key))continue;wanted.set(key,Math.min(wanted.get(key)??Infinity,p.d));}
 const nearest=[...wanted].sort((a,b)=>a[1]-b[1]).slice(0,16),keep=new Set(nearest.map(([key])=>key));
 const limit=Math.min(16,Math.max(2,keep.size+1));
 for(const [key,e] of state.sheets)if(keep.has(key))e.frame=state.frame;
 // Keep at most one previous sheet for small camera movements. The ordinary
 // flight view retains 3–5 sheets; an extreme zoom still has a hard ceiling.
 const cold=[...state.sheets].filter(([key])=>!keep.has(key)).sort((a,b)=>a[1].frame-b[1].frame);
 for(const [key,e] of cold){if(state.sheets.size<=limit)break;release(e);state.sheets.delete(key);}
 for(const [key] of nearest){
  let e=state.sheets.get(key);if(!e){e={frame:state.frame,pending:false,retryAt:0,image:null};state.sheets.set(key,e);}
  if(!e.image&&!e.pending&&G.ticks>=e.retryAt&&state.pending<2){
   e.pending=true;state.pending++;
   loadScenery(`assets/world/mobile/${key}.webp?v=${BAKED_WORLD.version}`,1024).then(image=>{if(e.retired)image.close?.();else e.image=image;}).catch(()=>{e.retryAt=G.ticks+1800;}).finally(()=>{e.pending=false;state.pending--;});
  }
 }
 // Newly discovered sheets also count toward the budget in this frame.
 for(const [key,e] of cold){if(state.sheets.size<=limit)break;if(state.sheets.has(key)){release(e);state.sheets.delete(key);}}
 state.ready=0;state.bytes=0;for(const e of state.sheets.values())if(e.image){state.ready++;state.bytes+=e.image.width*e.image.height*4;}
}
export function drawBakedWorldTile(G,c,x,y){
 const image=G.bakedWorld?.sheets.get(Math.floor(x/SIDE)+'_'+Math.floor(y/SIDE))?.image;if(!image)return false;
 c.drawImage(image,(x%SIDE)*PIXEL,(y%SIDE)*PIXEL,PIXEL,PIXEL,x*TILE,y*TILE,TILE+.5,TILE+.5);return true;
}
