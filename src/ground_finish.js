/* Surface-only retouching of the illustrated core. Geometry remains authoritative:
   paint never replaces buildings, piers or the authored street markings. Mobile
   bakes this layer once; desktop retains 48 near and 16 distant 256px tiles. */
const SIZE=256,STEP=4;
const MATERIAL={0:'asphalt',1:'paver',3:'water',4:'desert',5:'grass',8:'water',9:'asphalt'};
const OPACITY={0:.16,1:.32,3:1,4:.64,5:.24,8:1,9:.22};
const wet=code=>code===3||code===8;

export function surfaceFinishRuns(codeAt,x0,y0,size=SIZE,step=STEP){
 const runs=[];
 for(let y=y0;y<y0+size;y+=step){
  let start=x0,previous=-1,depth=-1;
  for(let x=x0;x<=x0+size;x+=step){
   const code=x<x0+size?codeAt(x+step/2,y+step/2):-1;
   let shore=0;
   if(wet(code)){
    const cx=x+step/2,cy=y+step/2;
    if(!wet(codeAt(cx-12,cy))||!wet(codeAt(cx+12,cy))||!wet(codeAt(cx,cy-12))||!wet(codeAt(cx,cy+12)))shore=2;
    else if(!wet(codeAt(cx-28,cy))||!wet(codeAt(cx+28,cy))||!wet(codeAt(cx,cy-28))||!wet(codeAt(cx,cy+28)))shore=1;
   }
   if(code!==previous||shore!==depth){
    if(MATERIAL[previous])runs.push({x:start,y,w:x-start,h:step,code:previous,shore:depth});
    start=x;previous=code;depth=shore;
   }
  }
 }
 return runs;
}
export function makeCoreFinish(codeAt,patterns){
 const cache=new Map(),distant=new Map();let stamp=0;
 function tile(x,y,size){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=SIZE;
  const c=canvas.getContext('2d');c.scale(SIZE/size,SIZE/size);c.translate(-x,-y);
  for(const run of surfaceFinishRuns(codeAt,x,y,size,STEP*size/SIZE)){
   const pat=patterns[MATERIAL[run.code]];if(!pat)continue;
   c.globalAlpha=OPACITY[run.code];c.fillStyle=pat;c.fillRect(run.x,run.y,run.w,run.h);
   if(wet(run.code)){c.globalAlpha=run.shore===2?.25:run.shore===1?.13:.07;c.fillStyle=run.shore?'#71a69a':'#123544';c.fillRect(run.x,run.y,run.w,run.h);}
  }
  return canvas;
 }
 return {cache,distant,clear(){for(const store of [cache,distant]){for(const e of store.values())e.c.width=1;store.clear();}},
  draw(c,r,budget=2){
   // A coarser cache keeps the sea/terrain palette consistent at flight zoom.
   // Its 1024-world-unit tiles have the same bitmap and planning cost as near tiles.
   const far=(Math.ceil((r.x1-r.x0)/SIZE)+1)*(Math.ceil((r.y1-r.y0)/SIZE)+1)>48,size=far?1024:SIZE,store=far?distant:cache,cols=4096/size,limit=far?16:48;
   const now=++stamp;let built=0;
   for(let y=Math.max(0,Math.floor(r.y0/size));y<=Math.min(cols-1,Math.floor(r.y1/size));y++)for(let x=Math.max(0,Math.floor(r.x0/size));x<=Math.min(cols-1,Math.floor(r.x1/size));x++){
    const key=y*cols+x;let e=store.get(key);
    if(!e){if(built++>=budget)continue;e={c:tile(x*size,y*size,size)};store.set(key,e);}
    e.used=now;c.drawImage(e.c,x*size,y*size,size,size);
   }
   if(store.size>limit)for(const [key,e]of store){if(store.size<=limit)break;if(e.used!==now){e.c.width=1;store.delete(key);}}
  }
 };
}
