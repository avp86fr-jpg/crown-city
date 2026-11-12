// Two abandoned canal fragments in the painted core now form continuous
// paved service courts. Buildings, public roads and the harbour stay intact.
export const URBAN_COURTS=[{x:448,y:2080,w:240,h:240},{x:768,y:2304,w:480,h:144}];
export function repairCoreWater(mask,size){
 const scale=size/4096;
 for(const r of URBAN_COURTS)for(let y=Math.floor(r.y*scale);y<(r.y+r.h)*scale;y++)for(let x=Math.floor(r.x*scale);x<(r.x+r.w)*scale;x++){
  const i=y*size+x;if(mask[i]===3||mask[i]===8)mask[i]=1;
 }
}
function courtArt(G,r){
 const canvas=document.createElement('canvas');canvas.width=r.w;canvas.height=r.h;
 const c=canvas.getContext('2d',{willReadFrequently:true}),paths={walk:[],road:[]};
 // Use the actual four-unit core mask outline, preserving roof edges and
 // planting already painted into the original district.
 for(let y=0;y<r.h;y+=4){let prior='',start=0;
  for(let x=0;x<=r.w;x+=4){const s=x<r.w?G.surfaceAt(r.x+x+2,r.y+y+2):'';
   if(s!==prior){if(paths[prior])paths[prior].push([start,y,x-start,4]);start=x;prior=s;}
  }
 }
 c.save();c.beginPath();for(const a of paths.walk)c.rect(...a);c.clip();c.fillStyle='#b1ae9d';c.fillRect(0,0,r.w,r.h);c.strokeStyle='#999b8d';c.lineWidth=.65;
 for(let x=0;x<r.w;x+=24){c.beginPath();c.moveTo(x,0);c.lineTo(x,r.h);c.stroke();}
 for(let y=0;y<r.h;y+=24){c.beginPath();c.moveTo(0,y);c.lineTo(r.w,y);c.stroke();}
 // Drainage and subtle aggregate replace the open-sea texture between shops.
 c.fillStyle='rgba(55,64,60,.14)';for(let i=0;i<r.w*r.h/180;i++)c.fillRect(i*37%r.w,i*71%r.h,2,1);
 c.restore();c.save();c.beginPath();for(const a of paths.road)c.rect(...a);c.clip();c.fillStyle='#27282e';c.fillRect(0,0,r.w,r.h);
 for(const road of G.meta.roads){if(road.a[0]!==road.b[0])continue;const cx=road.a[0]-r.x;c.fillStyle='#c6b376';
  for(let y=Math.ceil(r.y/64)*64-r.y;y<r.h;y+=64)c.fillRect(cx-1,y,2,24);
  c.fillStyle='#c5c7c2';for(const side of [-1,1])for(let y=Math.ceil(r.y/64)*64-r.y;y<r.h;y+=64)c.fillRect(cx+side*road.w/4-1,y,2,24);
 }
 c.restore();return canvas;
}
export function drawUrbanCourts(G,r){
 const cache=G.urbanCourtArt||(G.urbanCourtArt=[]);
 for(let i=0;i<URBAN_COURTS.length;i++){const a=URBAN_COURTS[i];if(a.x>r.x1||a.y>r.y1||a.x+a.w<r.x0||a.y+a.h<r.y0)continue;
  G.ctx.drawImage(cache[i]||(cache[i]=courtArt(G,a)),a.x,a.y);
 }
}
