// Illustrated combat effects: bounded particles, pooled records and one small atlas.
const TAU=Math.PI*2,clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
let atlas;const LOW=[48,32],HIGH=[144,96];
const state=G=>G.bloodFX||(G.bloodFX={drops:[],stains:[],pool:[],serial:0});
const limits=G=>G.settings.quality==='low'?LOW:HIGH;
function stain(G,F,x,y,size,rot){
 if(['water','canal','build'].includes(G.surfaceAt(x,y)))return;
 const max=limits(G)[1];if(F.stains.length>=max)F.stains.shift();
 F.stains.push({x,y,size,rot,age:0,life:45+(++F.serial%5)*4,variant:F.serial%4});
}
export function bloodImpact(G,p,vx=0,vy=0,force=1,fatal=false){
 if(G.settings.blood==='off')return;
 const F=state(G),low=G.settings.quality==='low',reduced=G.settings.blood==='reduced',power=clamp(force,.3,2.4),speed=Math.hypot(vx,vy),rot=speed>1?Math.atan2(vy,vx):(p.rot||0)-Math.PI/2;
 p.fallSide=Math.cos(rot)>=0?1:-1;
 if(fatal||!reduced)stain(G,F,p.x,p.y,(fatal?25:12)*Math.sqrt(power)*(reduced?.65:1),rot);
 const count=reduced?2:Math.min(low?10:20,Math.round((fatal?10:5)*power)),cap=limits(G)[0];
 for(let i=0;i<count;i++){
  const a=rot+(Math.random()-.5)*1.9,s=(25+Math.random()*80)*power;
  const d=F.pool.pop()||{};Object.assign(d,{x:p.x,y:p.y,z:12+Math.random()*10,vx:Math.cos(a)*s,vy:Math.sin(a)*s,vz:25+Math.random()*55,age:0,life:.9+Math.random()*.4,size:1.3+Math.random()*2.4,chunk:!reduced&&fatal&&power>1.2&&i%4===0,rot:a});
  if(F.drops.length>=cap)F.pool.push(F.drops.shift());F.drops.push(d);
 }
}
export function tickBlood(G,dt){
 const F=G.bloodFX;if(!F)return;
 if(G.settings.blood==='off'){F.drops.length=F.stains.length=F.pool.length=0;return;}
 const [drops,stains]=limits(G);while(F.drops.length>drops)F.pool.push(F.drops.shift());if(F.stains.length>stains)F.stains.splice(0,F.stains.length-stains);
 let n=0;for(const p of F.drops){p.age+=dt;p.vz-=180*dt;p.z+=p.vz*dt;
  const x=p.x+p.vx*dt,y=p.y+p.vy*dt;if(!G.solidAt(x,y)){p.x=x;p.y=y;}else{p.vx*=.1;p.vy*=.1;}
  if(p.z<=0||p.age>=p.life){if(p.chunk)stain(G,F,p.x,p.y,7,p.rot);F.pool.push(p);continue;}
  F.drops[n++]=p;
 }F.drops.length=n;
 n=0;for(const p of F.stains){p.age+=dt*(G.rainAmt>.3?2.5:1);if(p.age<p.life)F.stains[n++]=p;}F.stains.length=n;
 if(F.pool.length>drops)F.pool.length=drops;
}
function art(){
 if(atlas)return atlas;atlas=document.createElement('canvas');atlas.width=512;atlas.height=96;const c=atlas.getContext('2d');
 let seed=1827;const rnd=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
 for(let v=0;v<4;v++){c.save();c.translate(v*128+64,48);
  for(let i=0;i<22;i++){const a=rnd()*TAU,d=i<10?rnd()*16:18+rnd()*34,r=i<10?8+rnd()*8:1+rnd()*3;c.fillStyle=i%3?'#641320':'#8d1c2a';c.beginPath();c.ellipse(Math.cos(a)*d,Math.sin(a)*d*.55,r,r*.55,a,0,TAU);c.fill();}
  c.fillStyle='rgba(186,54,64,.35)';c.beginPath();c.ellipse(-6,-3,10,2,-.3,0,TAU);c.fill();c.restore();
 }return atlas;
}
export function drawBlood(G,r,ground){
 const F=G.bloodFX;if(!F||G.settings.blood==='off')return;const c=G.ctx;c.save();
 if(ground){for(const p of F.stains){if(p.x+p.size<r.x0||p.x-p.size>r.x1||p.y+p.size<r.y0||p.y-p.size>r.y1)continue;
  c.save();c.translate(p.x,p.y);c.rotate(p.rot);c.globalAlpha=Math.min(1,(p.life-p.age)/8)*.85;c.drawImage(art(),p.variant*128,0,128,96,-p.size,-p.size*.75,p.size*2,p.size*1.5);c.restore();
 }}else for(const p of F.drops){if(p.x<r.x0||p.x>r.x1||p.y<r.y0||p.y-p.z>r.y1)continue;c.fillStyle=p.chunk?'#651521':'#b52b38';
  c.save();c.translate(p.x,p.y-p.z);c.rotate(p.rot+p.age*5);if(p.chunk){c.fillRect(-p.size,-p.size*.7,p.size*2,p.size*1.4);c.fillStyle='#a64143';c.fillRect(-p.size,-p.size*.7,p.size,1);}else{c.beginPath();c.ellipse(0,0,p.size,p.size*.5,0,0,TAU);c.fill();}c.restore();
 }c.restore();
}
