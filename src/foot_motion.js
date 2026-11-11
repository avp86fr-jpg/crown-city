/* Swept foot-circle movement: preserve intended tangential motion at walls. */
export function slideFoot(p,dx,dy,clear,radius=7){
 if(!Number.isFinite(dx)||!Number.isFinite(dy))return;
 const distance=Math.hypot(dx,dy),steps=Math.max(1,Math.ceil(distance/3));
 const sx=dx/steps,sy=dy/steps;
 for(let i=0;i<steps;i++){
  if(clear(p.x+sx,p.y+sy,radius)){p.x+=sx;p.y+=sy;continue;}
  // Resolve the larger axis first. Never invent sideways input at a corner.
  const axes=Math.abs(sx)>Math.abs(sy)?[[sx,0],[0,sy]]:[[0,sy],[sx,0]];
  for(const [ax,ay] of axes)if((ax||ay)&&clear(p.x+ax,p.y+ay,radius)){p.x+=ax;p.y+=ay;}
 }
}
