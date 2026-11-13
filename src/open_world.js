/* Open-world layer: hidden chip caches, speed traps, taxi fares and ambient
   street events (buskers, traffic stops, deliveries, beach crowds, valets).
   Deterministic placement from the map; progress kept in its own save key. */
import {districtAt,WORLD_W,WORLD_H} from './world.js';
const KEY='crowncity.openworld.v1',TAU=Math.PI*2;
const FOOT=new Set(['walk','grass','sand','pier','lot','dirt']);
const hash=(x,y)=>{const s=Math.sin(x*12.9898+y*78.233)*43758.5453;return s-Math.floor(s);};
const store=()=>{try{return JSON.parse(localStorage.getItem(KEY)||'{}')||{};}catch{return {};}};
export function owSave(G){try{const o=G.ow;localStorage.setItem(KEY,JSON.stringify({caches:[...o.got],traps:o.best,fares:o.fares,hints:o.hints,jumps:o.jumps}));}catch{}}
const reward=(G,x,y,amt,text)=>{G.chips+=amt;G.floaters?.push({x,y,text:'+'+amt+' CHIPS',life:1.6,vy:-36,color:'#f2c14e'});G.particles?.push({kind:'flash',x,y,life:.14,a:1});G.audio?.pickup?.();G.toast=text;G.toastT=2.8;};
const nearRoad=(G,x,y)=>{for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]])if(G.surfaceAt(x+dx*40,y+dy*40)==='road')return true;return false;};
export function initOpenWorld(G,hooks){
 const s=store();
 const o=G.ow={hooks,got:new Set(s.caches||[]),best:s.traps||{},fares:s.fares||0,hints:s.hints||{},jumps:s.jumps||{},caches:[],traps:[],events:[],fare:null,evT:3,stillT:0};
 // Caches: tucked against building walls (a "build" tile within 26 px),
 // two or three per district so every corner of the map has something.
 const per={};const W=WORLD_W,H=WORLD_H;
 for(let i=0;i<14000&&o.caches.length<36;i++){
  const x=120+hash(i,1)*(W-240),y=200+hash(i,2)*(H-320),sf=G.surfaceAt(x,y);
  if(!FOOT.has(sf)||sf==='lot')continue;
  let wall=false;for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]])if(G.surfaceAt(x+dx*26,y+dy*26)==='build')wall=true;if(!wall)continue;
  const d=districtAt(x,y);if((per[d]||0)>=3)continue;
  if(o.caches.some(c=>Math.hypot(c.x-x,c.y-y)<500))continue;
  per[d]=(per[d]||0)+1;o.caches.push({id:o.caches.length,x,y,district:d});
 }
 // Speed traps on the longest straight road edges, spread across the map.
 const edges=[...(G.graph?.edges||[])].filter(e=>e.len>420).sort((a,b)=>b.len-a.len);
 for(const e of edges){if(o.traps.length>=10)break;const x=(e.A.x+e.B.x)/2,y=(e.A.y+e.B.y)/2;if(G.surfaceAt(x,y)!=='road')continue;if(o.traps.some(t=>Math.hypot(t.x-x,t.y-y)<900))continue;
  o.traps.push({id:'t'+o.traps.length,x,y,rot:Math.atan2(e.B.x-e.A.x,-(e.B.y-e.A.y)),name:districtAt(x,y)});}
 // Stunt ramps: open ground (dirt, sand, grass, lots) with a clear run-up
 // and a clear landing strip, so a jump never ends inside a wall or the sea.
 o.ramps=[];const OPEN=new Set(['dirt','sand','grass','lot','road']),bad=new Set(['build','water','canal']);
 for(let i=0;i<20000&&o.ramps.length<10;i++){
  const x=200+hash(i,7)*(W-400),y=300+hash(i,9)*(H-500),sf=G.surfaceAt(x,y);if(!['dirt','sand','grass'].includes(sf))continue;
  if(o.ramps.some(r=>Math.hypot(r.x-x,r.y-y)<1300))continue;
  for(const [hx,hy] of [[0,-1],[1,0],[0,1],[-1,0]]){let ok=true;
   for(let t=-220;t<=520&&ok;t+=20){const sx=x+hx*t,sy=y+hy*t;const a=G.surfaceAt(sx,sy),b=G.surfaceAt(sx-hy*30,sy+hx*30),c=G.surfaceAt(sx+hy*30,sy-hx*30);if(bad.has(a)||bad.has(b)||bad.has(c)||!OPEN.has(a))ok=false;}
   if(ok){o.ramps.push({id:'r'+o.ramps.length,x,y,hx,hy,rot:Math.atan2(hx,-hy),name:districtAt(x,y)});break;}
  }
 }
 return o;
}
// A car that crosses a ramp fast and straight flies: launch velocity is held,
// the body lifts (drawn larger with a ground shadow), and the landing pays.
function tickJumps(G,dt){
 const o=G.ow,P=G.player;
 if(o.jumpCar&&o.jumpCar!==P){o.jumpCar.jumpT=o.jumpCar.jumpH=0;o.jumpCar=null;}
 if(P.jumpT>0){
  P.jumpT-=dt;const k=1-P.jumpT/P.jumpDur;P.jumpH=Math.sin(Math.PI*Math.min(1,k))*P.jumpPeak;
  P.vx=P.jumpVx;P.vy=P.jumpVy;P.rot=P.jumpRot;P.yaw=0;
  if(P.jumpT<=0){P.jumpH=0;const r=P.jumpRamp,dist=Math.round(Math.hypot(P.x-P.jumpX,P.y-P.jumpY)/16),air=P.jumpDur.toFixed(1),best=o.jumps[r.id]||0,first=!best;
   let pay=40+dist*4;if(first)pay+=200;if(dist>best){o.jumps[r.id]=dist;}
   if(!G.settings?.reducedMotion)G.cam.shake=Math.max(G.cam.shake||0,4);for(let i=0;i<10;i++)G.particles.push({kind:'dust',x:P.x+(Math.random()-.5)*40,y:P.y+(Math.random()-.5)*40,vx:(Math.random()-.5)*60,vy:(Math.random()-.5)*60,life:.7,seed:Math.random()*6});
   G.audio?.contact?.({speed:220,material:'concrete',source:P,x:P.x,y:P.y});
   reward(G,P.x,P.y,pay,`STUNT JUMP ${dist} m · ${air} s${first?' · first time':dist>best?' · new best':''}`);owSave(G);}
  return;
 }
 if(P.type!=='veh'||P.def?.boat||P.def?.aircraft||P.def?.bike&&false)return;
 const sp=Math.hypot(P.vx||0,P.vy||0);if(sp<230)return;
 for(const r of o.ramps){const dx=P.x-r.x,dy=P.y-r.y,along=dx*r.hx+dy*r.hy,side=Math.abs(dx*r.hy-dy*r.hx);
  if(along<-6||along>26||side>24)continue;const dot=(P.vx*r.hx+P.vy*r.hy)/sp;if(dot<.82)continue;
  const dur=Math.min(1.5,.45+sp/520);Object.assign(P,{jumpT:dur,jumpDur:dur,jumpPeak:Math.min(1,sp/600),jumpVx:P.vx,jumpVy:P.vy,jumpRot:P.rot,jumpX:P.x,jumpY:P.y,jumpRamp:r,jumpH:0});o.jumpCar=P;break;}
}
const SPOT={performer:['DOWNTOWN','THE STRIP','PALACE ROW','CROWN LOOP','MIDTOWN','CROWN CITY','METAWIN TERRACE'],stop:null,delivery:null,beach:null};
function pickSpot(G,P,want,tries=40){
 for(let i=0;i<tries;i++){const a=Math.random()*TAU,d=520+Math.random()*420,x=P.x+Math.cos(a)*d,y=P.y+Math.sin(a)*d;
  if(G.traffic?.visible?.(x,y))continue;const sf=G.surfaceAt(x,y);if(want(sf,x,y))return {x,y};}
 return null;
}
function spawnEvent(G){
 const o=G.ow,P=G.player,H=o.hooks,dist=districtAt(P.x,P.y);
 const kinds=[];
 if(SPOT.performer.includes(dist))kinds.push('performer');
 kinds.push('delivery','stop');
 if(/HARBOUR|BEACH|ISLE|BAY|RESORT|COVE/.test(dist))kinds.push('beach','beach');
 const kind=kinds[(Math.random()*kinds.length)|0];
 const ped=(x,y,sprite,extra={})=>{const p={x,y,rot:Math.random()*TAU,vx:0,vy:0,sprite,speed:0,walk:24,dist:0,flee:0,r:8,hp:30,dead:false,ambient:false,owEvent:true,...extra};G.peds.push(p);return p;};
 if(kind==='performer'||kind==='beach'){
  const at=pickSpot(G,P,(sf,x,y)=>kind==='beach'?sf==='sand':sf==='walk'&&!nearRoad(G,x,y)||sf==='walk'&&G.surfaceAt(x,y+30)==='walk'&&G.surfaceAt(x,y-30)==='walk');if(!at)return;
  const ev={kind,x:at.x,y:at.y,peds:[],t:0,seed:Math.random()*9};
  if(kind==='performer')ev.peds.push(ped(at.x,at.y,'m2',{rot:Math.PI,look:(Math.random()*12)|0,perform:true,gather:{x:at.x,y:at.y}}));
  const n=kind==='beach'?6+((Math.random()*4)|0):3+((Math.random()*3)|0);
  for(let i=0;i<n;i++){const a=(i/n)*TAU+Math.random()*.4,r=kind==='beach'?40+Math.random()*60:34+Math.random()*10,x=at.x+Math.cos(a)*r,y=at.y+Math.sin(a)*r;if(!FOOT.has(G.surfaceAt(x,y)))continue;
   const p=ped(at.x+Math.cos(a)*(r+120),at.y+Math.sin(a)*(r+120),'m1',{gather:{x,y},look:(Math.random()*12)|0});if(!FOOT.has(G.surfaceAt(p.x,p.y))){p.x=x;p.y=y;}ev.peds.push(p);}
  if(kind==='beach')ev.umbrellas=[0,1,2].map(i=>({x:at.x+(hash(at.x,i)-.5)*150,y:at.y+(hash(i,at.y)-.5)*110,c:['#e05a4f','#f2c14e','#3a8fb7','#5fb06a'][i%4]}));
  o.events.push(ev);return;
 }
 // Kerb-side scenes use painted parking bays so no live lane is blocked.
 const bays=(G.meta?.parking||[]).concat(G.world?.parking||[]).filter(b=>{const d=Math.hypot(b.x-P.x,b.y-P.y);return d>480&&d<1000&&!G.traffic?.visible?.(b.x,b.y)&&!G.vehicles.some(v=>Math.hypot(v.x-b.x,v.y-b.y)<70);});
 if(!bays.length||!H.makeVeh)return;const b=bays[(Math.random()*bays.length)|0],rot=b.rot||0,hx=Math.sin(rot),hy=-Math.cos(rot);
 const ev={kind,x:b.x,y:b.y,peds:[],cars:[],t:0,seed:Math.random()*9};
 if(kind==='stop'){
  const civ=H.makeVeh(['fare','dart','riot'][(Math.random()*3)|0],b.x,b.y,rot,{parked:true,keep:true,ambient:false,owEvent:true});
  const cop=H.makeVeh('metro',b.x-hx*62,b.y-hy*62,rot,{parked:true,keep:true,ambient:false,owEvent:true,cop:true});
  G.vehicles.push(civ,cop);ev.cars.push(civ,cop);ev.cop=cop;
  const sx=Math.cos(rot),sy=Math.sin(rot);{const q={x:b.x+sx*30-hx*8,y:b.y+sy*30-hy*8};ev.peds.push(ped(q.x,q.y,'cop',{rot:rot-Math.PI/2,gather:q}));}
 }else{
  const van=H.makeVeh('van',b.x,b.y,rot,{parked:true,keep:true,ambient:false,owEvent:true});G.vehicles.push(van);ev.cars.push(van);
  // The courier shuttles boxes between the van's rear doors and the nearest frontage.
  let door=null;for(let r=40;r<=220&&!door;r+=20)for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const x=b.x+dx*r,y=b.y+dy*r;if(G.surfaceAt(x,y)==='walk'&&G.surfaceAt(x+dx*24,y+dy*24)==='build'){door={x,y};break;}}
  const back={x:b.x-hx*70,y:b.y-hy*70};if(!door)door={x:back.x+Math.cos(rot)*60,y:back.y+Math.sin(rot)*60};
  ev.path=[back,door];ev.peds.push(ped(back.x,back.y,'worker',{acc:'case',accCol:'#a07a4a',accSide:1,look:3,gather:back}));
 }
 o.events.push(ev);
}
function retire(G,ev){for(const p of ev.peds){const i=G.peds.indexOf(p);if(i>=0)G.peds.splice(i,1);}for(const v of ev.cars||[]){const i=G.vehicles.indexOf(v);if(i>=0&&!v.dead&&G.player!==v)G.vehicles.splice(i,1);else{v.keep=false;v.owEvent=false;}}}
export function tickOpenWorld(G,dt){
 const o=G.ow;if(!o||G.scene!=='play')return;const P=G.player;
 // First-time hints teach each activity once, the moment it is relevant.
 const hint=(k,text)=>{if(o.hints[k]||G.toastT>0.6)return;o.hints[k]=1;G.toast=text;G.toastT=4.2;owSave(G);};
 if((G.ticks%20)===0){
  if(o.caches.some(c=>!o.got.has(c.id)&&Math.hypot(P.x-c.x,P.y-c.y)<240))hint('cache','Something glints against that wall. Hidden chip caches are tucked all over the city.');
  if(P.type==='veh'&&o.traps.some(t=>Math.hypot(P.x-t.x,P.y-t.y)<520))hint('trap','Speed trap ahead: cross the yellow line at 110+ km/h for chips.');
  if(P.type==='veh'&&o.ramps?.some(r=>Math.hypot(P.x-r.x,P.y-r.y)<560))hint('ramp','Stunt ramp nearby: hit it fast and straight for a jump bonus.');
  if(P.type==='veh'&&P.kind==='taxi'&&(G.freeRoam||G.mode==='freeride'))hint('taxi','Taxi: stop at the kerb for a couple of seconds to pick up a fare.');
 }
 tickJumps(G,dt);
 // caches
 for(const c of o.caches){if(o.got.has(c.id))continue;if(Math.abs(P.x-c.x)<26&&Math.abs(P.y-c.y)<26){o.got.add(c.id);reward(G,c.x,c.y,150,`Hidden chip cache ${o.got.size}/${o.caches.length} found`);if(o.got.size===o.caches.length)reward(G,c.x,c.y,2500,'Every cache in Crown City found!');owSave(G);}}
 // speed traps
 if(P.type==='veh'&&!P.def?.boat&&!P.def?.aircraft){const sp=Math.hypot(P.vx||0,P.vy||0);
  for(const t of o.traps){if(Math.abs(P.x-t.x)>60||Math.abs(P.y-t.y)>60)continue;if(G.ticks-(t.lastT||-999)<90)continue;t.lastT=G.ticks;
   const kmh=Math.round(sp*.36),best=o.best[t.id]||0;
   if(kmh>=110&&kmh>best){const first=!best;o.best[t.id]=kmh;reward(G,t.x,t.y,first?250:Math.min(300,(kmh-best)*5),`SPEED TRAP ${kmh} KM/H${first?'':' — new best'}`);owSave(G);}
   else{G.toast=`Speed trap: ${kmh} km/h (best ${best||'—'}, 110+ pays)`;G.toastT=2.2;}}}
 // taxi fares: stop a taxi at the kerb in free roam to pick up a fare.
 const free=(G.freeRoam||G.mode==='freeride')&&!G.action?.contract&&!(G.wanted>0);
 if(o.fare){const f=o.fare;f.t-=dt;if(P.type!=='veh'||P.kind!=='taxi'||G.wanted>0){G.toast='Fare abandoned.';G.toastT=2;o.fare=null;G.waypoint=null;}
  else if(f.t<=0){G.toast='The fare got out. Too slow.';G.toastT=2.4;o.fare=null;G.waypoint=null;}
  else{G.waypoint={x:f.x,y:f.y};if(Math.hypot(P.x-f.x,P.y-f.y)<80&&Math.hypot(P.vx,P.vy)<30){o.fares++;reward(G,P.x,P.y,f.pay+Math.round(f.t*2),`Fare delivered (${o.fares} total)`);o.fare=null;G.waypoint=null;owSave(G);}}}
 else if(free&&P.type==='veh'&&P.kind==='taxi'){
  o.stillT=Math.hypot(P.vx,P.vy)<12&&nearRoad(G,P.x,P.y)?o.stillT+dt:0;
  if(o.stillT>2.2&&G.graph?.nodes){o.stillT=0;let n=null;for(let i=0;i<30&&!n;i++){const c=G.graph.nodes[(Math.random()*G.graph.nodes.length)|0],d=Math.hypot(c.x-P.x,c.y-P.y);if(d>700&&d<1700)n=c;}
   if(n){const d=Math.hypot(n.x-P.x,n.y-P.y);o.fare={x:n.x,y:n.y,t:20+d/14,pay:60+Math.round(d/18)};G.toast=`Fare: ${districtAt(n.x,n.y)} — ${Math.round(o.fare.t)} s`;G.toastT=3;}}}
 // ambient events
 o.evT-=dt;
 for(let i=o.events.length-1;i>=0;i--){const ev=o.events[i];ev.t+=dt;
  if(Math.hypot(ev.x-P.x,ev.y-P.y)>1700&&!G.traffic?.visible?.(ev.x,ev.y)){retire(G,ev);o.events.splice(i,1);continue;}
  if(ev.cars?.some(v=>v.dead||G.player===v||Math.hypot(v.vx||0,v.vy||0)>40)){for(const v of ev.cars){v.keep=false;v.owEvent=false;}ev.cars=[];}
  if(ev.path){const p=ev.peds[0];if(p&&!p.dead&&!(p.flee>0)){const tgt=ev.path[ev.leg|0];p.gather=tgt;
   if(Math.hypot(tgt.x-p.x,tgt.y-p.y)<30){ev.wait=(ev.wait||0)+dt;if(ev.wait>1.6){ev.wait=0;ev.leg=ev.leg?0:1;p.acc=ev.leg?'case':null;}}}}
  if(ev.peds.length&&ev.peds.every(p=>p.dead||!G.peds.includes(p))){retire(G,ev);o.events.splice(i,1);}
 }
 if(o.evT<=0){o.evT=6+Math.random()*6;if(o.events.length<3&&!G.missionState?.scramblerT)spawnEvent(G);}
}
export function drawOpenWorld(G,r){
 const o=G.ow;if(!o)return;const ctx=G.ctx,t=G.ticks/60,inR=(x,y,m=60)=>x>r.x0-m&&x<r.x1+m&&y>r.y0-m&&y<r.y1+m;
 for(const c of o.caches){if(o.got.has(c.id)||!inR(c.x,c.y))continue;const pulse=.5+.5*Math.sin(t*3+c.id);
  ctx.save();ctx.translate(c.x,c.y);ctx.fillStyle='rgba(0,0,0,.3)';ctx.beginPath();ctx.ellipse(1,3,8,4,0,0,TAU);ctx.fill();
  ctx.fillStyle='#7a5a18';ctx.beginPath();ctx.arc(0,-1,7,0,TAU);ctx.fill();ctx.fillStyle='#f2c14e';ctx.beginPath();ctx.arc(0,-2,6,0,TAU);ctx.fill();
  ctx.strokeStyle='#fff1b8';ctx.lineWidth=1;ctx.setLineDash([2,2]);ctx.beginPath();ctx.arc(0,-2,4,0,TAU);ctx.stroke();ctx.setLineDash([]);
  ctx.globalAlpha=pulse*.9;ctx.fillStyle='#ffffff';ctx.fillRect(-3,-6,1.5,1.5);ctx.globalAlpha=1;ctx.restore();}
 for(const tr of o.traps){if(!inR(tr.x,tr.y,90))continue;ctx.save();ctx.translate(tr.x,tr.y);ctx.rotate(tr.rot);
  ctx.fillStyle='rgba(242,193,78,.18)';ctx.fillRect(-34,-4,68,8);ctx.fillStyle='#f2c14e';for(let x=-32;x<32;x+=8)ctx.fillRect(x,-2,4,4);
  for(const s of [-1,1]){ctx.fillStyle='#2a3036';ctx.fillRect(s*40-2,-3,4,6);ctx.fillStyle=(G.ticks%40<20)?'#ff5a4a':'#5a2a26';ctx.fillRect(s*40-1.5,-2,3,2);}ctx.restore();}
 for(const rp of o.ramps||[]){if(!inR(rp.x,rp.y,90))continue;ctx.save();ctx.translate(rp.x,rp.y);ctx.rotate(rp.rot);
  ctx.fillStyle='rgba(0,0,0,.35)';ctx.fillRect(-23,-26,50,58);
  const g=ctx.createLinearGradient(0,30,0,-30);g.addColorStop(0,'#3a4148');g.addColorStop(1,'#8a949c');ctx.fillStyle=g;ctx.beginPath();ctx.moveTo(-22,30);ctx.lineTo(22,30);ctx.lineTo(20,-28);ctx.lineTo(-20,-28);ctx.closePath();ctx.fill();
  ctx.fillStyle='#e8eef2';ctx.fillRect(-20,-30,40,3);ctx.fillStyle='#f2c14e';for(let k=0;k<3;k++){const y=18-k*16;ctx.beginPath();ctx.moveTo(-12,y);ctx.lineTo(0,y-8);ctx.lineTo(12,y);ctx.lineTo(12,y+4);ctx.lineTo(0,y-4);ctx.lineTo(-12,y+4);ctx.closePath();ctx.fill();}
  ctx.strokeStyle='#22282d';ctx.lineWidth=1.5;ctx.strokeRect(-22,-29,44,59);ctx.restore();}
 const PJ=G.player;if(PJ.jumpH>0){ctx.save();ctx.fillStyle=`rgba(0,0,0,${.35-PJ.jumpH*.15})`;ctx.beginPath();ctx.ellipse(PJ.x+PJ.jumpH*26,PJ.y+PJ.jumpH*34,30*(1-PJ.jumpH*.2),48*(1-PJ.jumpH*.2),PJ.rot,0,TAU);ctx.fill();ctx.restore();}
 if(o.fare){const f=o.fare;if(inR(f.x,f.y)){ctx.save();ctx.strokeStyle='rgba(242,193,78,.85)';ctx.lineWidth=2;ctx.beginPath();ctx.arc(f.x,f.y,30+Math.sin(t*4)*3,0,TAU);ctx.stroke();ctx.restore();}}
 for(const ev of o.events){if(!inR(ev.x,ev.y,200))continue;
  if(ev.umbrellas)for(const u of ev.umbrellas){ctx.save();ctx.fillStyle='rgba(0,0,0,.25)';ctx.beginPath();ctx.ellipse(u.x+4,u.y+6,19,15,0,0,TAU);ctx.fill();
   for(let k=0;k<8;k++){ctx.fillStyle=k%2?u.c:'#f4eee0';ctx.beginPath();ctx.moveTo(u.x,u.y);ctx.arc(u.x,u.y,18,k/8*TAU,(k+1)/8*TAU);ctx.closePath();ctx.fill();}
   ctx.fillStyle='#4a3a2a';ctx.beginPath();ctx.arc(u.x,u.y,2,0,TAU);ctx.fill();ctx.fillStyle='#e8d4a8';ctx.fillRect(u.x+16,u.y-4,9,16);ctx.fillStyle=u.c;ctx.fillRect(u.x+16,u.y-4,9,3);ctx.restore();}
  if(ev.kind==='performer'){const p=ev.peds[0];if(p&&!p.dead){ctx.save();ctx.fillStyle='#3a2418';ctx.beginPath();ctx.ellipse(p.x+14,p.y+10,7,4,0,0,TAU);ctx.fill();ctx.fillStyle='#f2c14e';ctx.fillRect(p.x+12,p.y+9,3,2);
   ctx.fillStyle='rgba(255,236,190,.9)';ctx.font='700 10px system-ui';for(let k=0;k<2;k++){const a=(t*.6+k*.5+ev.seed)%1;ctx.globalAlpha=1-a;ctx.fillText(k?'♫':'♪',p.x-6+k*12+Math.sin(a*6)*4,p.y-16-a*26);}ctx.restore();}}
  if(ev.kind==='stop'&&ev.cop&&!ev.cop.dead&&ev.cars.length){const c=ev.cop,on=(G.ticks%30)<15;ctx.save();ctx.globalCompositeOperation='lighter';ctx.globalAlpha=.55;
   ctx.fillStyle=on?'rgba(255,60,80,.9)':'rgba(60,120,255,.9)';ctx.beginPath();ctx.arc(c.x+(on?-6:6),c.y,26,0,TAU);ctx.fill();ctx.restore();}
 }
}
export function owProgress(G){const o=G.ow;if(!o)return '';const n=o.got.size+Object.keys(o.best).length+Object.keys(o.jumps).length,t=o.caches.length+o.traps.length+(o.ramps||[]).length;return `${n}/${t}`;}
export function owDetail(G){const o=G.ow;if(!o)return '';return `Caches ${o.got.size}/${o.caches.length} · Speed traps ${Object.keys(o.best).length}/${o.traps.length} · Jumps ${Object.keys(o.jumps).length}/${(o.ramps||[]).length} · Fares ${o.fares}`;}
