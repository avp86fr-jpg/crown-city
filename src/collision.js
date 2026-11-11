/* Shared world-space bodies for rendering, swept projectiles and vehicle contacts. */
export function bodySize(v) {
  if(v.def?.bike)return {w:10,l:35};
  if(v.kind==='bus')return {w:28,l:69};
  if(v.kind==='gulf')return {w:29,l:62};
  if(v.def?.boat)return {w:20,l:57};
  if(v.kind==='van'||v.kind==='ambulance')return {w:25,l:58};
  return {w:24,l:52};
}
export function localPoint(v,x,y) {
  const c=Math.cos(v.rot),s=Math.sin(v.rot),dx=x-v.x,dy=y-v.y;
  return {x:dx*c+dy*s,y:-dx*s+dy*c};
}
export function circleBody(v,x,y,r=0) {
  const p=localPoint(v,x,y),b=bodySize(v);
  const qx=Math.max(-b.w,Math.min(b.w,p.x)),qy=Math.max(-b.l,Math.min(b.l,p.y));
  const dx=p.x-qx,dy=p.y-qy;
  return dx*dx+dy*dy<=r*r;
}
export function segmentBody(v,x0,y0,x1,y1,pad=0) {
  const a=localPoint(v,x0,y0),z=localPoint(v,x1,y1),b=bodySize(v);let enter=0,leave=1;
  for(const [p,d,h] of [[a.x,z.x-a.x,b.w+pad],[a.y,z.y-a.y,b.l+pad]]){
    if(Math.abs(d)<1e-9){if(Math.abs(p)>h)return null;continue;}
    let t0=(-h-p)/d,t1=(h-p)/d;if(t0>t1)[t0,t1]=[t1,t0];
    enter=Math.max(enter,t0);leave=Math.min(leave,t1);if(enter>leave)return null;
  }
  return enter;
}
export function segmentCircle(x0,y0,x1,y1,x,y,r) {
  const dx=x1-x0,dy=y1-y0,ox=x0-x,oy=y0-y,c=ox*ox+oy*oy-r*r;
  if(c<=0)return 0;const a=dx*dx+dy*dy;if(a<1e-9)return null;
  const b=ox*dx+oy*dy,disc=b*b-a*c;if(disc<0)return null;
  const t=(-b-Math.sqrt(disc))/a;return t>=0&&t<=1?t:null;
}
export function bodyContact(a,b) {
  const A=bodySize(a),B=bodySize(b),ac=Math.cos(a.rot),as=Math.sin(a.rot),bc=Math.cos(b.rot),bs=Math.sin(b.rot);
  const axes=[[ac,as],[-as,ac],[bc,bs],[-bs,bc]],dx=b.x-a.x,dy=b.y-a.y;let pen=Infinity,best;
  for(const [x,y] of axes){
    const ra=A.w*Math.abs(x*ac+y*as)+A.l*Math.abs(-x*as+y*ac);
    const rb=B.w*Math.abs(x*bc+y*bs)+B.l*Math.abs(-x*bs+y*bc);
    const d=dx*x+dy*y,overlap=ra+rb-Math.abs(d);if(overlap<=0)return null;
    if(overlap<pen){pen=overlap;const sign=d>=0?1:-1;best={nx:x*sign,ny:y*sign,pen};}
  }
  return best;
}
const SAMPLES=[[0,0],[0,-1],[0,1],[-1,-1],[1,-1],[-1,1],[1,1],[-1,0],[1,0],[-1,-.5],[1,-.5],[-1,.5],[1,.5]];
export function worldBodyHit(G,v,x,y) {
  const b=bodySize(v),c=Math.cos(v.rot),s=Math.sin(v.rot);let nx=0,ny=0,count=0;
  for(const [a,d] of SAMPLES){const dx=a*b.w*c-d*b.l*s,dy=a*b.w*s+d*b.l*c,surface=G.surfaceAt(x+dx,y+dy);
    const blocked=v.def.boat?surface!=='water'&&surface!=='canal':surface==='build';
    if(blocked){nx-=dx;ny-=dy;count++;}
  }
  if(!count)return null;
  if(Math.hypot(nx,ny)<.01){nx=-(v.vx||Math.sin(v.rot));ny=-(v.vy||-Math.cos(v.rot));}
  const m=Math.hypot(nx,ny)||1;return {nx:nx/m,ny:ny/m,n:count};
}
export function nearbyPairs(vehicles) {
  const grid=new Map(),pairs=[],seen=new Set(),cell=160;
  vehicles.forEach((v,i)=>{
    const b=bodySize(v),extent=Math.hypot(b.w,b.l);
    for(let x=Math.floor((v.x-extent)/cell);x<=Math.floor((v.x+extent)/cell);x++)for(let y=Math.floor((v.y-extent)/cell);y<=Math.floor((v.y+extent)/cell);y++){
      const key=x+':'+y,bucket=grid.get(key)||[];
      for(const j of bucket){const code=j*vehicles.length+i;if(!seen.has(code)){seen.add(code);pairs.push([vehicles[j],v]);}}
      bucket.push(i);grid.set(key,bucket);
    }
  });return pairs;
}
export function waterBerth(G,v,x,y) {
  if(!worldBodyHit(G,v,x,y))return {x,y};
  for(let r=16;r<=360;r+=16)for(let k=0;k<20;k++){
    const a=k*Math.PI/10,px=x+Math.cos(a)*r,py=y+Math.sin(a)*r;
    if(!worldBodyHit(G,v,px,py))return {x:px,y:py};
  }
  return null;
}
export function muzzleLength(v,angle) {
  const b=bodySize(v),d=angle-v.rot;
  return Math.min(b.w/Math.max(.001,Math.abs(Math.sin(d))),b.l/Math.max(.001,Math.abs(Math.cos(d))))+5;
}
