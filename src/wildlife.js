/* Habitat-based local wildlife. Only nearby animals think or animate. */
import {loadImage} from './assets.js';
import {STATIONS,stationExit} from './transit.js';
import {circleBody,bodySize,segmentCircle} from './collision.js';
import {bloodImpact,runoverBlood} from './blood_fx.js';
const TAU=Math.PI*2;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const RADII=[12,8,8,6,5,4],HEALTH=[90,42,48,30,16,12];
const landVehicle=v=>!v.def?.boat&&!(v.def?.aircraft&&(v.altitude||0)>10);
export const SPECIES=Object.freeze([
 {id:'deer',size:44,speed:25,run:118,bird:false,color:'#b39365'},
 {id:'fox',size:32,speed:31,run:108,bird:false,color:'#c07c4e'},
 {id:'dog',size:31,speed:25,run:96,bird:false,color:'#b99565'},
 {id:'cat',size:24,speed:22,run:100,bird:false,color:'#8d9694'},
 {id:'gull',size:23,speed:16,run:90,bird:true,color:'#d3d8c8'},
 {id:'pigeon',size:18,speed:13,run:80,bird:true,color:'#7c9296'},
]);
const allowed=(G,x,y)=>!['build','water','canal'].includes(G.surfaceAt(x,y));
const clearBody=(G,x,y)=>allowed(G,x,y)&&allowed(G,x-7,y)&&allowed(G,x+7,y)&&allowed(G,x,y-7)&&allowed(G,x,y+7);
export function initWildlife(G){
 let seed=98371;const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};const animals=[];
 function add(kind,x,y,n=1){for(let i=0;i<n;i++){let px=x+(rnd()-.5)*180,py=y+(rnd()-.5)*150;if(!allowed(G,px,py)){const at=G.findSafeAction(px,py);px=at.x;py=at.y;}if(!allowed(G,px,py))continue;animals.push({id:animals.length,kind,x:px,y:py,hx:px,hy:py,angle:rnd()*TAU,target:rnd()*TAU,walk:0,flee:0,t:1+rnd()*4,phase:rnd()*10,lift:0});}}
 for(let y=1700;y<8200;y+=850){add(0,11220,y,3);add(1,11810,y+250,2);}
 for(let x=4500;x<8500;x+=800)add(1,x,9520,2);
 for(const s of STATIONS.filter(s=>s.line==='metro')){const e=stationExit(s);add(2,e.x+110,e.y,1);add(3,e.x-100,e.y,1);add(5,e.x,e.y+40,3);}
 for(let y=1100;y<6300;y+=700){add(4,6815,y,3);add(4,7120,y+150,2);}
 // Small flocks near the playable opening streets, placed through the same collision map.
 add(5,1510,2930,4);add(2,1460,2800,2);add(3,2420,2200,2);add(4,2400,840,4);
 G.wildlife={animals,active:[],nearby:[],movers:[],moverPool:[],bins:new Map(),elapsed:.36,clock:0,shot:G.shotsFired||0,stats:{active:0,total:animals.length,hits:0,playerHits:0,deaths:0,respawns:0,collisionChecks:0,decisions:0}};
 for(const a of animals){const k=Math.floor(a.hx/512)+':'+Math.floor(a.hy/512),list=G.wildlife.bins.get(k)||[];list.push(a);G.wildlife.bins.set(k,list);}
 if(!G.wildlifeAtlas&&!G.wildlifeLoading){G.wildlifeLoading=true;loadImage('assets/premium/wildlife.webp').then(im=>G.wildlifeAtlas=im).catch(()=>{}).finally(()=>G.wildlifeLoading=false);}
}
// Exact swept circle against the rounded corners of an oriented vehicle body.
// A padded rectangle alone incorrectly hits animals grazing past a bumper corner.
function segmentBox(x,y,dx,dy,w,l){
 let lo=0,hi=1;
 if(Math.abs(dx)<1e-9){if(Math.abs(x)>w)return false;}else{let a=(-w-x)/dx,b=(w-x)/dx;if(a>b)[a,b]=[b,a];lo=Math.max(lo,a);hi=Math.min(hi,b);}
 if(Math.abs(dy)<1e-9){if(Math.abs(y)>l)return false;}else{let a=(-l-y)/dy,b=(l-y)/dy;if(a>b)[a,b]=[b,a];lo=Math.max(lo,a);hi=Math.min(hi,b);}
 return lo<=hi;
}
function sweptAnimal(v,a,dx,dy,r){
 if(circleBody(v,a.x,a.y,r))return true;
 if(dx*dx+dy*dy<.001)return false;
 const b=bodySize(v),co=Math.cos(v.rot),sn=Math.sin(v.rot),ax=a.x-v.x,ay=a.y-v.y;
 const ex=ax*co+ay*sn,ey=-ax*sn+ay*co,sx=ex+dx*co+dy*sn,sy=ey-dx*sn+dy*co;
 if(segmentBox(sx,sy,ex-sx,ey-sy,b.w+r,b.l)||segmentBox(sx,sy,ex-sx,ey-sy,b.w,b.l+r))return true;
 for(const x of [-b.w,b.w])for(const y of [-b.l,b.l])if(segmentCircle(sx,sy,ex,ey,x,y,r)!==null)return true;
 return false;
}
const nearPlayer=(P,x,y,pad=0)=>Math.abs(x-P.x)<850+pad&&Math.abs(y-P.y)<750+pad;
function refreshWildlife(G,W){
 const P=G.player,nearby=W.nearby||(W.nearby=[]);nearby.length=0;
 // Habitats remain the static index. Expand by their maximum roaming radius,
 // otherwise a returning bird disappears at a cell boundary beside the camera.
 for(let y=Math.floor((P.y-1150)/512);y<=Math.floor((P.y+1150)/512);y++)for(let x=Math.floor((P.x-1250)/512);x<=Math.floor((P.x+1250)/512);x++)for(const a of W.bins.get(x+':'+y)||[]){
  if(!a.hidden&&nearPlayer(P,a.x,a.y))nearby.push(a);
 }
 nearby.sort((a,b)=>(a.x-P.x)**2+(a.y-P.y)**2-((b.x-P.x)**2+(b.y-P.y)**2));
 const active=W.active||(W.active=[]);active.length=0;
 const budget=G.settings.quality==='low'?18:36;
 for(let i=0;i<Math.min(budget,nearby.length);i++)active.push(nearby[i]);
 W.stats.active=active.length;W.stats.dead=0;
 for(const a of W.animals){if(a.dead)W.stats.dead++;if(!nearPlayer(P,a.x,a.y)&&a._cars){a._cars.length=0;a._senseIn=0;}}
}
function movingBodies(G,W,dt){
 const movers=W.movers||(W.movers=[]),pool=W.moverPool||(W.moverPool=[]);movers.length=0;
 const add=v=>{
  if(!landVehicle(v)||v.dead)return;
  const speed=Math.hypot(v.vx||0,v.vy||0);if(speed<26)return;
  let dx=v.x-(v.prevX??v.x),dy=v.y-(v.prevY??v.y);
  // Recovery, mission placement and rail travel are not impacts across the map.
  if(Math.hypot(dx,dy)>Math.max(200,speed*dt*3+32))dx=dy=0;
  const b=bodySize(v),extent=Math.hypot(b.w,b.l)+14;
  if(!nearPlayer(G.player,v.x,v.y,400)&&!nearPlayer(G.player,v.x-dx,v.y-dy,400))return;
  const m=pool[movers.length]||(pool[movers.length]={});
  Object.assign(m,{v,dx,dy,speed,x0:Math.min(v.x,v.x-dx)-extent,x1:Math.max(v.x,v.x-dx)+extent,y0:Math.min(v.y,v.y-dy)-extent,y1:Math.max(v.y,v.y-dy)+extent});movers.push(m);
 };
 const source=G.nearVehicles||G.vehicles||[];for(const v of source)add(v);
 if(G.player.type==='veh'&&!source.includes(G.player))add(G.player);
 // The pool retains at most the local fleet, never retired cars or a growing history.
 for(let i=movers.length;i<pool.length;i++)pool[i].v=null;
 if(pool.length>128)pool.length=Math.max(128,movers.length);
 return movers;
}
function strikeAnimal(G,W,a,m){
 const {v,speed}=m,s=SPECIES[a.kind],factor=v.def?.bike?.44:.78;
 a.hp=(a.hp??HEALTH[a.kind])-speed*factor;
 a.impactT=.85;a.stun=.22;a.flee=4;a.walk=1;a.lift=0;
 a.target=Math.atan2(v.vy||0,v.vx||0);a.angle=a.target;
 a.vx=(v.vx||0)*.38;a.vy=(v.vy||0)*.38;
 if(a.hp<=0){a.dead=true;a.deadAt=W.clock;a.walk=0;a.flee=0;a.fallSide=(a.id&1)?-1:1;W.stats.deaths=(W.stats.deaths||0)+1;}
 W.stats.hits=(W.stats.hits||0)+1;
 bloodImpact(G,a,v.vx,v.vy,clamp(speed/180,.35,1.8)*(s.bird?.5:1),a.dead);
 runoverBlood(G,a,v);
 G.audio?.contact?.({source:v,x:a.x,y:a.y,speed:speed*.5,material:'body'});
 G.cityAI?.emit?.('collision',a.x,a.y,{radius:100,duration:.7});
 if(v===G.player){
  W.stats.playerHits=(W.stats.playerHits||0)+1;G.hitConfirmT=.16;
  const drag=a.kind===0?.94:s.bird?.995:.98;v.vx*=drag;v.vy*=drag;
 }
}
function tickFallen(G,W,a,dt){
 const age=W.clock-a.deadAt;
 if(age<.75){const x=a.x+(a.vx||0)*dt,y=a.y+(a.vy||0)*dt;if(clearBody(G,x,y)){a.x=x;a.y=y;}const damp=Math.exp(-7*dt);a.vx*=damp;a.vy*=damp;}
 // Visible casualties fade, but cannot resurrect while the player watches.
 // Reuse the original habitat actor only after both locations have left view.
 if(age>40)a.hidden=true;
 if(age>90&&!nearPlayer(G.player,a.x,a.y,180)&&!nearPlayer(G.player,a.hx,a.hy,180)&&clearBody(G,a.hx,a.hy)){
  Object.assign(a,{x:a.hx,y:a.hy,dead:false,hidden:false,hp:HEALTH[a.kind],vx:0,vy:0,impactT:0,stun:0,flee:0,walk:0,lift:0,t:2,_senseIn:0});
  W.stats.respawns=(W.stats.respawns||0)+1;
 }
}
function senseCars(G,W,a){
 const cars=a._cars||(a._cars=[]);cars.length=0;
 const add=v=>{if(landVehicle(v))cars.push(v);};
 if(G.cityAI?.nearTraffic)G.cityAI.nearTraffic(a.x,a.y,270,add);
 else for(const v of G.nearVehicles||G.vehicles||[])if(Math.abs(v.x-a.x)<270&&Math.abs(v.y-a.y)<270)add(v);
 if(G.player.type==='veh'&&Math.abs(G.player.x-a.x)<270&&Math.abs(G.player.y-a.y)<270&&!cars.includes(G.player))add(G.player);
 W.stats.decisions=(W.stats.decisions||0)+1;a._senseIn=.16+(a.id%3)*.02;return cars;
}
export function tickWildlife(G,dt){
 const W=G.wildlife;if(!W)return;const P=G.player,step=Math.min(dt,.1);W.clock=(W.clock||0)+dt;W.elapsed+=dt;
 // Retirement is independent of simulation distance. Leaving the district does
 // not freeze a corpse forever or grow a second population on return.
 for(const a of W.animals)if(a.dead)tickFallen(G,W,a,step);
 if(W.elapsed>.35||!W.nearby){W.elapsed=0;refreshWildlife(G,W);}
 const movers=movingBodies(G,W,dt),nearby=W.nearby||W.active;W.stats.collisionChecks=0;
 for(const a of nearby){
  if(a.dead||a.hidden)continue;a.impactT=Math.max(0,(a.impactT||0)-dt);
  if(a.impactT||SPECIES[a.kind].bird&&a.lift>6)continue;
  for(const m of movers){
   if(a.x<m.x0||a.x>m.x1||a.y<m.y0||a.y>m.y1)continue;
   W.stats.collisionChecks++;
   if(sweptAnimal(m.v,a,m.dx,m.dy,RADII[a.kind])){strikeAnimal(G,W,a,m);break;}
  }
 }
 const shot=(G.shotsFired||0)!==W.shot;W.shot=G.shotsFired||0;
 const moving=P.type==='veh'&&Math.hypot(P.vx||0,P.vy||0)>25;
 for(const a of W.active){
  if(a.dead||a.hidden)continue;
  if(a.stun>0){a.stun-=dt;const x=a.x+(a.vx||0)*step,y=a.y+(a.vy||0)*step;if(clearBody(G,x,y)){a.x=x;a.y=y;}continue;}
  const s=SPECIES[a.kind],dist=Math.hypot(a.x-P.x,a.y-P.y),home=Math.hypot(a.x-a.hx,a.y-a.hy);a.t-=dt;a.flee=Math.max(0,a.flee-dt);
  a._senseIn=(a._senseIn||0)-dt;
  const cars=a._senseIn<=0?senseCars(G,W,a):a._cars||[];
  let traffic=null,closest=Infinity;
  for(const v of cars){
   if(v.dead)continue;const vx=v.vx||0,vy=v.vy||0,speed2=vx*vx+vy*vy;if(speed2<900)continue;
   const dx=a.x-v.x,dy=a.y-v.y,t=(dx*vx+dy*vy)/speed2;if(t<0||t>1.25)continue;
   const miss=Math.hypot(dx-vx*t,dy-vy*t);if(miss<52&&t<closest){traffic=v;closest=t;}
  }
  const clear=(x,y)=>{if(!clearBody(G,x,y))return false;for(const v of cars)if(circleBody(v,x,y,7))return false;return true;};
  if(traffic||dist<(shot?370:moving?115:s.bird?48:55)&&!(P.def?.aircraft&&P.altitude>70)){
   if(a.flee<=0&&dist<180)G.audio?.wildlife?.(s.id,Math.min(.23,20/Math.max(60,dist)),(a.x-P.x)/220);
   a.flee=2.5;a.target=Math.atan2(a.y-(traffic||P).y,a.x-(traffic||P).x);a.walk=1;
  }else if(a.t<=0){a.t=1.5+(a.id%7)*.6;const nocturnal=a.kind===1||a.kind===3,night=G.time>19||G.time<6;a.walk=(Math.sin(G.ticks*.002+a.id)>(nocturnal&&!night?.4:-.25))?1:0;a.target=home>130?Math.atan2(a.hy-a.y,a.hx-a.x):a.angle+Math.sin(G.ticks*.005+a.id)*1.5;}
  if(home>240){a.target=Math.atan2(a.hy-a.y,a.hx-a.x);if(!s.bird)a.flee=0;a.walk=1;}
  const turn=Math.atan2(Math.sin(a.target-a.angle),Math.cos(a.target-a.angle));a.angle+=turn*Math.min(1,step*5);
  const speed=(a.flee?s.run:s.speed)*a.walk,nx=a.x+Math.cos(a.angle)*speed*step,ny=a.y+Math.sin(a.angle)*speed*step;
  if(s.bird&&(a.flee||a.lift>2)||clear(nx,ny)&&clear(nx+Math.cos(a.angle)*10,ny+Math.sin(a.angle)*10)){a.x=nx;a.y=ny;a.phase+=speed*step*.12;}else{a.target+=Math.PI*.72;a.t=.45;a.walk=0;}
  const land=clear(a.x,a.y);a.lift+=(s.bird&&(a.flee||!land)?20-a.lift:-a.lift)*Math.min(1,step*3);
  if(s.bird&&!a.flee&&!land){a.target=Math.atan2(a.hy-a.y,a.hx-a.x);a.walk=1;}
 }
 W.stats.active=W.active.length;
}
export function drawWildlife(G,r){
 const c=G.ctx,im=G.wildlifeAtlas;if(!G.wildlife)return;
 for(const a of G.wildlife.active){if(a.hidden||a.x<r.x0-45||a.x>r.x1+45||a.y<r.y0-45||a.y>r.y1+45)continue;const s=SPECIES[a.kind],flip=Math.cos(a.angle)<0?-1:1;
  c.save();if(a.dead)c.globalAlpha=Math.min(1,Math.max(0,(40-(G.wildlife.clock-a.deadAt))/8));c.translate(a.x,a.y);c.fillStyle='rgba(18,28,25,.22)';c.beginPath();c.ellipse(2,4,s.size*.4,s.size*.15,0,0,TAU);c.fill();c.translate(0,-a.lift);if(a.dead){c.rotate((a.fallSide||1)*.28);c.scale(1,.62);}c.scale(flip,1);
  if(im){const col=a.dead||G.settings.reducedMotion?0:a.flee?3:a.walk?1+(Math.floor(a.phase)%2):0,w=im.width/4,h=im.height/6,bob=a.dead||G.settings.reducedMotion?0:Math.sin(a.phase*2)*(a.flee?2:1);c.drawImage(im,col*w,a.kind*h,w,h,-s.size/2,-s.size*.7+bob,s.size,s.size);}
  else{c.fillStyle=s.color;c.beginPath();c.ellipse(0,-3,s.size*.4,s.size*.2,0,0,TAU);c.fill();c.beginPath();c.arc(s.size*.3,-6,s.size*.15,0,TAU);c.fill();}
  c.restore();
 }
}
