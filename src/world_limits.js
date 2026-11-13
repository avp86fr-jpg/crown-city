/* The playable border is shared by hull collision and its visible coastline. */
export function makeWorldLimits(w,h){return {x:0,y:0,w,h};}
export function worldBoundaryContact(bounds,v,x,y,body){
 if(!bounds)return null;
 const reach=body.w+body.l;
 if(x>bounds.x+reach&&x<bounds.x+bounds.w-reach&&y>bounds.y+reach&&y<bounds.y+bounds.h-reach)return null;
 const c=Math.abs(Math.cos(v.rot||0)),s=Math.abs(Math.sin(v.rot||0));
 const rx=body.w*c+body.l*s,ry=body.w*s+body.l*c;
 let nx=0,ny=0,n=0;
 if(x-rx<bounds.x){nx++;n++;}if(x+rx>=bounds.x+bounds.w){nx--;n++;}
 if(y-ry<bounds.y){ny++;n++;}if(y+ry>=bounds.y+bounds.h){ny--;n++;}
 if(!n)return null;const length=Math.hypot(nx,ny)||1;
 return {nx:nx/length,ny:ny/length,n,boundary:true};
}
export function clampWorldBody(bounds,v,x,y,body){
 const c=Math.abs(Math.cos(v.rot||0)),s=Math.abs(Math.sin(v.rot||0));
 const rx=body.w*c+body.l*s,ry=body.w*s+body.l*c;
 return {x:Math.max(bounds.x+rx,Math.min(bounds.x+bounds.w-rx-.01,x)),y:Math.max(bounds.y+ry,Math.min(bounds.y+bounds.h-ry-.01,y))};
}
// Tiny repeating vistas are built only when their biome first reaches the
// viewport. Existing art is reused; a warmed edge costs one fill per biome,
// irrespective of the number of distant trees/rocks or camera zoom.
function vistaPattern(c,G,kind){
 if(!G?.assets?.tex)return null;
 const W=G.world,atlas=W.sceneryAtlas;
 let cache=W._boundaryVista;
 if(!cache||cache.atlas!==atlas)cache=W._boundaryVista={atlas,patterns:{}};
 if(cache.patterns[kind])return cache.patterns[kind];
 const tile=document.createElement('canvas');tile.width=tile.height=384;
 const x=tile.getContext('2d'),tex=G.assets.tex[kind==='water'?'water':kind==='forest'?'grass':kind==='desert'?'sand':'dirt'];
 x.fillStyle=tex?x.createPattern(tex,'repeat'):kind==='forest'?'#566c43':kind==='water'?'#235455':'#8a8166';x.fillRect(0,0,384,384);
 x.fillStyle=kind==='forest'?'rgba(43,62,39,.48)':kind==='water'?'rgba(19,48,55,.4)':kind==='desert'?'rgba(151,124,77,.18)':'rgba(73,75,76,.35)';x.fillRect(0,0,384,384);
 if(atlas&&kind!=='water'){
  const count=kind==='forest'?17:kind==='desert'?5:8;
  for(let i=0;i<count;i++){
   const px=(i*137+37)%384,py=(i*223+53)%384,index=kind==='forest'?0:kind==='mountain'?1:i%2?3:2;
   const width=kind==='forest'?78+(i*17)%45:kind==='mountain'?100+(i*13)%60:index===3?44:106;
   const height=width*(kind==='forest'?1.15:.85);
   for(const dx of [-384,0,384])for(const dy of [-384,0,384]){
    const ax=px+dx-width/2,ay=py+dy-height/2;
    if(ax+width<0||ax>384||ay+height<0||ay>384)continue;
    x.drawImage(atlas,index%2*atlas.width/2,Math.floor(index/2)*atlas.height/2,atlas.width/2,atlas.height/2,ax,ay,width,height);
   }
  }
 }
 // Atmospheric distance keeps the view quieter than the playable foreground.
 x.fillStyle=kind==='forest'?'rgba(75,91,69,.16)':kind==='water'?'rgba(50,74,77,.12)':'rgba(123,117,105,.18)';x.fillRect(0,0,384,384);
 return cache.patterns[kind]=c.createPattern(tile,'repeat');
}
export function drawBoundaryBackdrop(c,b,r,G){
 if(!b||r.x0>=b.x&&r.x1<=b.x+b.w&&r.y0>=b.y&&r.y1<=b.y+b.h)return;
 const right=b.x+b.w,bottom=b.y+b.h;
 c.save();
 const paint=(x,y,w,h,kind)=>{if(w<=0||h<=0)return;c.fillStyle=vistaPattern(c,G,kind)||({water:'#173940',forest:'#2e4538',desert:'#756b51',mountain:'#4a514c'})[kind];c.fillRect(x,y,w,h);if(G?._boundaryTint){c.globalCompositeOperation='multiply';c.fillStyle=G._boundaryTint;c.fillRect(x,y,w,h);c.globalCompositeOperation='source-over';}};
 if(r.y0<b.y)paint(r.x0,r.y0,r.x1-r.x0,b.y-r.y0,'water');
 if(r.y1>bottom){const split=Math.max(r.x0,Math.min(r.x1,8800));paint(r.x0,bottom,split-r.x0,r.y1-bottom,'desert');paint(split,bottom,r.x1-split,r.y1-bottom,'mountain');}
 // Split at river/coast/biome boundaries, never continue dry forest over water.
 const side=(x,w,east)=>{const cuts=[b.y,720,...(G?.world?.river||[6600,6800]),8400,bottom];for(let i=0;i<cuts.length-1;i++){const y=Math.max(r.y0,cuts[i]),end=Math.min(r.y1,cuts[i+1]);const kind=i===0||i===2?'water':east&&i<4?'forest':i===4?'mountain':'desert';paint(x,y,w,end-y,kind);}};
 if(r.x0<b.x)side(r.x0,b.x-r.x0,false);
 if(r.x1>right)side(right,r.x1-right,true);
 c.restore();
}
export function drawBoundaryMarkers(c,W,r){
 const b=W.limits;if(!b)return;const right=b.x+b.w,bottom=b.y+b.h;
 const marker=(x,y,marine,vertical)=>{
  if(x<r.x0-20||x>r.x1+20||y<r.y0-20||y>r.y1+20)return;
  c.save();c.translate(x,y);
  if(marine){c.fillStyle='#263b3c';c.beginPath();c.ellipse(3,4,9,5,0,0,Math.PI*2);c.fill();c.fillStyle='#d4ac62';c.fillRect(-3,-5,6,10);c.fillStyle='#efe1ad';c.fillRect(-2,-8,4,3);}
  else{c.fillStyle='#48574b';c.fillRect(vertical?-5:-20,vertical?-20:-5,vertical?10:40,vertical?40:10);c.fillStyle='#8e9378';c.fillRect(-3,-3,6,6);}
  c.restore();
 };
 if(r.y0<b.y+24)for(let x=Math.floor(r.x0/160)*160+80;x<Math.min(right,r.x1+160);x+=160)if(x>=0)marker(x,b.y+12,true,false);
 if(r.y1>bottom-24)for(let x=Math.floor(r.x0/96)*96+48;x<Math.min(right,r.x1+96);x+=96)if(x>=0)marker(x,bottom-2,false,false);
 for(const [x,on] of [[2,r.x0<24],[right-2,r.x1>right-24]])if(on)for(let y=Math.floor(r.y0/96)*96+48;y<Math.min(bottom,r.y1+96);y+=96)if(y>=b.y)marker(x,y,y<720||y>W.river[0]&&y<W.river[1],true);
}
