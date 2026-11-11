/* Habitat-based local wildlife. Only nearby animals think or animate. */
import {loadImage} from './assets.js';
import {STATIONS,stationExit} from './transit.js';
const TAU=Math.PI*2;
export const SPECIES=Object.freeze([
 {id:'deer',size:44,speed:25,run:118,bird:false,color:'#b39365'},
 {id:'fox',size:32,speed:31,run:108,bird:false,color:'#c07c4e'},
 {id:'dog',size:31,speed:25,run:96,bird:false,color:'#b99565'},
 {id:'cat',size:24,speed:22,run:100,bird:false,color:'#8d9694'},
 {id:'gull',size:23,speed:16,run:90,bird:true,color:'#d3d8c8'},
 {id:'pigeon',size:18,speed:13,run:80,bird:true,color:'#7c9296'},
]);
const allowed=(G,x,y)=>!['build','water','canal'].includes(G.surfaceAt(x,y));
export function initWildlife(G){
 let seed=98371;const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};const animals=[];
 function add(kind,x,y,n=1){for(let i=0;i<n;i++){let px=x+(rnd()-.5)*180,py=y+(rnd()-.5)*150;if(!allowed(G,px,py)){const at=G.findSafeAction(px,py);px=at.x;py=at.y;}if(!allowed(G,px,py))continue;animals.push({id:animals.length,kind,x:px,y:py,hx:px,hy:py,angle:rnd()*TAU,target:rnd()*TAU,walk:0,flee:0,t:1+rnd()*4,phase:rnd()*10,lift:0});}}
 for(let y=1700;y<8200;y+=850){add(0,11220,y,3);add(1,11810,y+250,2);}
 for(let x=4500;x<8500;x+=800)add(1,x,9520,2);
 for(const s of STATIONS.filter(s=>s.line==='metro')){const e=stationExit(s);add(2,e.x+110,e.y,1);add(3,e.x-100,e.y,1);add(5,e.x,e.y+40,3);}
 for(let y=1100;y<6300;y+=700){add(4,6815,y,3);add(4,7120,y+150,2);}
 // Small flocks near the playable opening streets, placed through the same collision map.
 add(5,1510,2930,4);add(2,1460,2800,2);add(3,2420,2200,2);add(4,2400,840,4);
 G.wildlife={animals,active:[],bins:new Map(),elapsed:0,shot:G.shotsFired||0,stats:{active:0,total:animals.length}};
 for(const a of animals){const k=Math.floor(a.hx/512)+':'+Math.floor(a.hy/512),list=G.wildlife.bins.get(k)||[];list.push(a);G.wildlife.bins.set(k,list);}
 if(!G.wildlifeAtlas&&!G.wildlifeLoading){G.wildlifeLoading=true;loadImage('assets/premium/wildlife.webp').then(im=>G.wildlifeAtlas=im).catch(()=>{}).finally(()=>G.wildlifeLoading=false);}
}
export function tickWildlife(G,dt){
 const W=G.wildlife;if(!W)return;const P=G.player;W.elapsed+=dt;
 if(W.elapsed>.35||!W.active.length){W.elapsed=0;const nearby=[];for(let y=Math.floor((P.y-1000)/512);y<=Math.floor((P.y+1000)/512);y++)for(let x=Math.floor((P.x-1000)/512);x<=Math.floor((P.x+1000)/512);x++)for(const a of W.bins.get(x+':'+y)||[])if(Math.abs(a.x-P.x)<850&&Math.abs(a.y-P.y)<750)nearby.push(a);nearby.sort((a,b)=>(a.x-P.x)**2+(a.y-P.y)**2-((b.x-P.x)**2+(b.y-P.y)**2));W.active=nearby.slice(0,G.settings.quality==='low'?18:36);}
 const shot=(G.shotsFired||0)!==W.shot;W.shot=G.shotsFired||0;const moving=P.type==='veh'&&Math.hypot(P.vx||0,P.vy||0)>25;
 for(const a of W.active){const s=SPECIES[a.kind],dist=Math.hypot(a.x-P.x,a.y-P.y),home=Math.hypot(a.x-a.hx,a.y-a.hy);a.t-=dt;a.flee=Math.max(0,a.flee-dt);
  const traffic=(G.nearVehicles||[]).find(v=>v!==P&&!v.dead&&!v.def?.boat&&!(v.altitude>10)&&Math.abs(v.x-a.x)<90&&Math.abs(v.y-a.y)<90&&(v.vx*v.vx+v.vy*v.vy)>900);
  if(traffic||dist<(shot?370:moving?115:s.bird?48:55)&&!(P.def?.aircraft&&P.altitude>70)){
   if(a.flee<=0&&dist<180)G.audio.wildlife?.(s.id,Math.min(.23,20/Math.max(60,dist)),(a.x-P.x)/220);
   a.flee=2.5;a.target=Math.atan2(a.y-(traffic||P).y,a.x-(traffic||P).x);a.walk=1;
  }else if(a.t<=0){a.t=1.5+(a.id%7)*.6;a.walk=(Math.sin(G.ticks*.002+a.id)>-.25)?1:0;a.target=home>130?Math.atan2(a.hy-a.y,a.hx-a.x):a.angle+Math.sin(G.ticks*.005+a.id)*1.5;}
  if(home>240){a.target=Math.atan2(a.hy-a.y,a.hx-a.x);a.flee=0;a.walk=1;}
  let turn=Math.atan2(Math.sin(a.target-a.angle),Math.cos(a.target-a.angle));a.angle+=turn*Math.min(1,dt*5);
  const speed=(a.flee?s.run:s.speed)*a.walk,nx=a.x+Math.cos(a.angle)*speed*dt,ny=a.y+Math.sin(a.angle)*speed*dt;
  if(a.flee&&s.bird||allowed(G,nx+Math.cos(a.angle)*10,ny+Math.sin(a.angle)*10)){a.x=nx;a.y=ny;a.phase+=speed*dt*.12;}else{a.target+=Math.PI*.72;a.t=.45;a.walk=0;}
  a.lift+=(s.bird&&a.flee?20-a.lift:-a.lift)*Math.min(1,dt*3);
  // Landing over a wall/water is deferred; return to the habitat instead of embedding in it.
  if(s.bird&&!a.flee&&!allowed(G,a.x,a.y)){a.x=a.hx;a.y=a.hy;a.lift=0;}
 }
 W.stats.active=W.active.length;
}
export function drawWildlife(G,r){
 const c=G.ctx,im=G.wildlifeAtlas;if(!G.wildlife)return;
 for(const a of G.wildlife.active){if(a.x<r.x0-45||a.x>r.x1+45||a.y<r.y0-45||a.y>r.y1+45)continue;const s=SPECIES[a.kind],flip=Math.cos(a.angle)<0?-1:1;
  c.save();c.translate(a.x,a.y);c.fillStyle='rgba(18,28,25,.22)';c.beginPath();c.ellipse(2,4,s.size*.4,s.size*.15,0,0,TAU);c.fill();c.translate(0,-a.lift);c.scale(flip,1);
  if(im){const col=G.settings.reducedMotion?0:a.flee?3:a.walk?1+(Math.floor(a.phase)%2):0,w=im.width/4,h=im.height/6,bob=G.settings.reducedMotion?0:Math.sin(a.phase*2)*(a.flee?2:1);c.drawImage(im,col*w,a.kind*h,w,h,-s.size/2,-s.size*.7+bob,s.size,s.size);}
  else{c.fillStyle=s.color;c.beginPath();c.ellipse(0,-3,s.size*.4,s.size*.2,0,0,TAU);c.fill();c.beginPath();c.arc(s.size*.3,-6,s.size*.15,0,TAU);c.fill();}
  c.restore();
 }
}
