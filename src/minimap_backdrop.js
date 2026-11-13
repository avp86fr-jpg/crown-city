import {drawTransitMap} from './transit.js';

// The terrain and rail network do not change every frame. Keep a single small
// overscanned map and scroll its source rectangle; objectives, police and the
// player remain live. Crossing the overscan margin repaints the same canvas.
export function drawMinimapBackdrop(G,x,y,size,span){
 const k=size/span,side=Math.ceil(size*2),P=G.player,M=G.minimap;
 let cache=G.minimapBackdrop;
 if(!cache){const canvas=document.createElement('canvas');cache=G.minimapBackdrop={canvas,builds:0};}
 const margin=(side-size)/2;
 if(cache.source!==M.c||cache.side!==side||cache.span!==span||cache.ui!==G.ui||
    Math.abs(P.x-cache.x)*k>margin-2||Math.abs(P.y-cache.y)*k>margin-2){
  const canvas=cache.canvas;
  if(canvas.width!==side||canvas.height!==side){canvas.width=side;canvas.height=side;}
  const c=canvas.getContext('2d');c.setTransform(1,0,0,1,0,0);
  c.fillStyle='#0b1622';c.fillRect(0,0,side,side);
  const extent=side/k;
  c.drawImage(M.c,(P.x-extent/2)/M.S,(P.y+(M.oy||0)-extent/2)/M.S,extent/M.S,extent/M.S,0,0,side,side);
  c.fillStyle='rgba(0,0,0,.12)';c.fillRect(0,0,side,side);
  drawTransitMap({ctx:c,ui:G.ui},(wx,wy)=>[side/2+(wx-P.x)*k,side/2+(wy-P.y)*k],{x:0,y:0,size:side});
  Object.assign(cache,{source:M.c,side,span,ui:G.ui,x:P.x,y:P.y,builds:cache.builds+1});
 }
 G.ctx.drawImage(cache.canvas,margin+(P.x-cache.x)*k,margin+(P.y-cache.y)*k,size,size,x,y,size,size);
}
