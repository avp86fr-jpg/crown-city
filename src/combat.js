/* Ground-space combat queries; visual muzzle height never changes hit detection. */
export function firstSolid(G,x0,y0,x1,y1){
 const dx=x1-x0,dy=y1-y0,steps=Math.max(1,Math.ceil(Math.hypot(dx,dy)/3));
 for(let i=0;i<=steps;i++){const t=i/steps;if(!G.solidAt(x0+dx*t,y0+dy*t))continue;
  let lo=Math.max(0,(i-1)/steps),hi=t;for(let j=0;j<4;j++){const m=(lo+hi)/2;if(G.solidAt(x0+dx*m,y0+dy*m))hi=m;else lo=m;}
  return hi;
 }return null;
}
export function shotSpread(G,weapon,actor){
 const movement=actor.type==='foot'?Math.min(1,(actor.speed||0)/175):Math.min(1,Math.hypot(actor.vx||0,actor.vy||0)/260);
 return weapon.spread*(1+movement*1.15+(G.action?.bloom||0)*1.8)*(G.action?.cover?.8:1);
}
export function projectileDamage(b){
 const falloff=b.falloff;if(!falloff)return b.damage||20;
 const t=Math.max(0,Math.min(1,((b.travel||0)-falloff)/(Math.max(falloff+1,b.range||560)-falloff)));
 return (b.damage||20)*(1-t*.65);
}
