/* Rival street crews and ammo crates.
 * Two crews hold turf (Vipers in Eastside, Rust Kings in Ironside). Squads of
 * three patrol sidewalks around the player while they are on that turf. They
 * ignore a passer-by, warn a loiterer, and turn hostile when shot at, hit, run
 * over, or when the player fires nearby. Hostile members keep cover distance
 * and fire bursts; killing them is not a police matter unless an officer sees.
 * No real-world gang colours, names or symbols. */
import {stepPedestrian} from './pedestrian_motion.js';
import {addAmmo,message} from './action.js';
const TAU=Math.PI*2;
export const CREWS=[
 {id:'vipers',name:'VIPERS',color:'#3fd6a4',trim:'#0d4a3b',r:[7400,1600,2840,2300],sprite:'m2'},
 {id:'rust',name:'RUST KINGS',color:'#ff8a3d',trim:'#5a2410',r:[4096,3900,6144,2700],sprite:'m4'},
];
const inRect=(r,x,y)=>x>=r[0]&&y>=r[1]&&x<r[0]+r[2]&&y<r[1]+r[3];
export function crewAt(x,y){return CREWS.find(c=>inRect(c.r,x,y))||null;}
function state(G){return G.gangs||(G.gangs={squads:[],t:0,crates:null,serial:0});}
function walkableSpot(G,x,y){const s=G.surfaceAt(x,y);return s==='walk'||s==='lot'||s==='grass';}
function spawnSquad(G,crew,hooks){
 const P=G.player,S=state(G);
 for(let k=0;k<10;k++){
  const a=Math.random()*TAU,d=620+Math.random()*420,x=P.x+Math.sin(a)*d,y=P.y-Math.cos(a)*d;
  if(!inRect(crew.r,x,y)||!walkableSpot(G,x,y))continue;
  const spot=hooks.findSafe(G,x,y,10,true);if(!spot||!walkableSpot(G,spot.x,spot.y))continue;
  const squad={id:++S.serial,crew,members:[],hostile:false,warnT:0,goal:null,goalT:0,alarmT:0};
  for(let i=0;i<3;i++){const p={x:spot.x+(i-1)*16,y:spot.y+(i%2)*14,rot:a+Math.PI,vx:0,vy:0,sprite:crew.sprite,speed:0,walk:34,dist:0,flee:0,r:8,hp:60,dead:false,gang:crew.id,gangColor:crew.color,gangTrim:crew.trim,squad,role:i?'follow':'lead',shotWait:.6+Math.random()};
   squad.members.push(p);G.peds.push(p);}
  S.squads.push(squad);return squad;
 }return null;
}
export function provokeGang(G,x,y,radius=320){
 for(const s of state(G).squads)if(s.members.some(m=>!m.dead&&Math.hypot(m.x-x,m.y-y)<radius))makeHostile(G,s);
}
function makeHostile(G,s){if(s.hostile)return;s.hostile=true;s.alarmT=25;G.audio?.yelp?.();
 if(!G._gangNoteT||G.ticks>G._gangNoteT){G._gangNoteT=G.ticks+600;message(G,'NEURAL',s.crew.name+' crew is on you. Break line of sight or put them down.','#ff8a7a');}}
export function gangHit(G,p){if(p.squad)makeHostile(G,p.squad);}
export function tickGangs(G,dt,hooks){
 if(G.scene!=='play')return;
 const S=state(G),P=G.player;S.t-=dt;
 tickCrates(G,dt,hooks);
 const crew=crewAt(P.x,P.y),limit=G.settings.quality==='low'?1:2;
 const live=S.squads.filter(s=>s.members.some(m=>!m.dead));
 if(crew&&S.t<=0){S.t=4;if(live.filter(s=>s.crew===crew).length<limit&&!P.def?.aircraft)spawnSquad(G,crew,hooks);}
 for(const s of S.squads){
  const alive=s.members.filter(m=>!m.dead);if(!alive.length){s.gone=true;continue;}
  const lead=alive[0],dP=Math.hypot(lead.x-P.x,lead.y-P.y);
  if(dP>1900){for(const m of s.members){m.dead=true;m.removed=true;}s.gone=true;continue;}
  if(s.hostile&&(s.alarmT-=dt)<=0&&dP>700)s.hostile=false;
  // Loitering next to a crew on foot earns one warning, then trouble.
  if(!s.hostile&&P.type==='foot'&&dP<85){s.warnT+=dt;if(s.warnT>1&&!s.warned){s.warned=true;G.toastT=0;hooks.toast?.(G,s.crew.name+': "Keep walking."');}if(s.warnT>5)makeHostile(G,s);}else s.warnT=Math.max(0,s.warnT-dt*.5);
  for(const m of alive){
   const dx=P.x-m.x,dy=P.y-m.y,d=Math.hypot(dx,dy);
   if(s.hostile&&d<520){
    // Hold a firing distance, strafing; close in when the player is hidden.
    const los=G.nav.clearLine(m.x,m.y,P.x,P.y),want=los?(d>260?1:d<150?-1:0):1;
    const face=Math.atan2(dx,-dy),strafe=(m.squad.members.indexOf(m)-1)*.9;
    const head=want>0?face+strafe*.25:want<0?face+Math.PI:face+Math.PI/2*(strafe>=0?1:-1);
    stepPedestrian(G,m,head,want===0?40:118,dt,{road:true});m.rot=face;m.cityActivity=null;
    m.shotWait-=dt;
    if(los&&d<380&&m.shotWait<=0){m.shotWait=.75+Math.random()*.7;m.burst=(m.burst||0)+1;if(m.burst%3===0)m.shotWait+=.9;
     const a=face+(Math.random()-.5)*(.18+(P.type==='veh'?.08:0)),h={x:Math.sin(a),y:-Math.cos(a)};
     G.bullets.push({x:m.x+h.x*14,y:m.y+h.y*14,vx:h.x*500,vy:h.y*500,life:.85,friend:false,gang:true});
     G.flashes.push({x:m.x+h.x*14,y:m.y+h.y*14,r:90,col:'rgba(255,210,140,0.8)',life:.06,max:.06});G.audio?.gunfire?.('pistol',m.x,m.y,.6);m.shotTick=G.ticks;}
    continue;
   }
   // Patrol: the lead walks between sidewalk goals; the others trail it.
   if(m===lead){
    if(!s.goal||(s.goalT-=dt)<=0||Math.hypot(s.goal.x-m.x,s.goal.y-m.y)<24){
     for(let k=0;k<6;k++){const a=Math.random()*TAU,g={x:m.x+Math.sin(a)*240,y:m.y-Math.cos(a)*240};if(inRect(s.crew.r,g.x,g.y)&&walkableSpot(G,g.x,g.y)){s.goal=g;break;}}
     s.goalT=9;
    }
    const g=s.goal||m,h=Math.atan2(g.x-m.x,-(g.y-m.y));
    if(!stepPedestrian(G,m,h,34,dt))s.goalT=0;
   }else{
    const i=s.members.indexOf(m),side=i%2?1:-1,b=lead.rot||0,tx=lead.x-Math.sin(b)*22+Math.cos(b)*18*side,ty=lead.y+Math.cos(b)*22+Math.sin(b)*18*side,dd=Math.hypot(tx-m.x,ty-m.y);
    if(dd>10)stepPedestrian(G,m,Math.atan2(tx-m.x,-(ty-m.y)),Math.min(70,30+dd),dt);else{m.speed=0;m.rot=lead.rot;}
   }
  }
 }
 S.squads=S.squads.filter(s=>!s.gone);
}
// Death drops: chips and a few rounds.
export function gangDrop(G,p){
 if(!(p.gang||p.copPed)||p._dropped)return;p._dropped=true;
 const S=state(G);(S.drops||(S.drops=[])).push({x:p.x+8,y:p.y+6,t:40,ammo:true});
 if(p.gang)G.chips+=20+((Math.random()*30)|0);
}
/* Ammo crates: a dozen fixed street spots, respawning 90 s after pickup. */
const CRATE_SPOTS=[[1200,1300],[2900,1900],[1000,3300],[5200,800],[6900,2400],[8800,2200],[5600,4600],[8200,5600],[1800,5200],[3000,7600],[7400,7600],[6400,-1500]];
function tickCrates(G,dt,hooks){
 const S=state(G);
 if(!S.crates)S.crates=CRATE_SPOTS.map(([x,y])=>{const s=hooks.findSafe(G,x,y,10,true)||{x,y};return {x:s.x,y:s.y,down:0};});
 const P=G.player;if(P.type!=='foot'&&!P.def?.bike){for(const c of S.crates)c.down=Math.max(0,c.down-dt);}
 const take=(c,amount)=>{const got=addAmmo(G,null,amount);G.audio?.pickup?.();hooks.toast?.(G,got?'Ammo +'+got:'Ammo full');};
 for(const c of S.crates){if(c.down>0){c.down-=dt;continue;}if((P.type==='foot'||P.def?.bike)&&Math.abs(c.x-P.x)<28&&Math.abs(c.y-P.y)<28){c.down=90;take(c);}}
 if(S.drops){for(const d of S.drops){d.t-=dt;if(d.t>0&&Math.hypot(d.x-P.x,d.y-P.y)<30){d.t=0;const got=addAmmo(G,null,8);G.audio?.pickup?.();if(got)hooks.toast?.(G,'Ammo +'+got);}}S.drops=S.drops.filter(d=>d.t>0);}
}
export function drawGangWorld(G,r){
 const S=G.gangs;if(!S)return;const c=G.ctx,t=G.ticks/60;
 const box=(x,y,k)=>{c.save();c.translate(x,y+Math.sin(t*3+x)*1.2);c.fillStyle='rgba(0,0,0,.35)';c.beginPath();c.ellipse(2,5,11*k,5*k,0,0,TAU);c.fill();
  c.fillStyle='#5b5a3a';c.fillRect(-10*k,-8*k,20*k,14*k);c.fillStyle='#7c7a4e';c.fillRect(-10*k,-8*k,20*k,4*k);c.fillStyle='#e9c96a';c.fillRect(-3*k,-3*k,6*k,4*k);
  c.strokeStyle='#2b2a1b';c.lineWidth=1;c.strokeRect(-10*k,-8*k,20*k,14*k);c.restore();};
 for(const k of S.crates||[])if(k.down<=0&&k.x>r.x0&&k.x<r.x1&&k.y>r.y0&&k.y<r.y1){box(k.x,k.y,1);c.save();c.globalAlpha=.35+.25*Math.sin(t*4);c.strokeStyle='#e9c96a';c.lineWidth=1.5;c.beginPath();c.ellipse(k.x,k.y+4,18,9,0,0,TAU);c.stroke();c.restore();}
 for(const d of S.drops||[])if(d.x>r.x0&&d.x<r.x1&&d.y>r.y0&&d.y<r.y1)box(d.x,d.y,.6);
}
// Crew colours: bandana on the head and an armband, drawn after the body.
export function drawGangMark(c,a){
 if(!a.gang||a.dead)return;c.save();c.fillStyle=a.gangColor;c.strokeStyle=a.gangTrim;c.lineWidth=1;
 c.beginPath();c.ellipse(0,-44,5.4,3,0,0,TAU);c.fill();c.stroke();c.fillRect(-9,-31,4,3);c.restore();
}
