/* Open-world layer: hidden chip caches, speed traps, taxi fares and ambient
   street events (buskers, traffic stops, deliveries, beach crowds, valets).
   Deterministic placement from the map; progress kept in its own save key. */
import {storyTotals} from './story_score.js';
import {districtAt,WORLD_W,WORLD_H} from './world.js';
const KEY='crowncity.openworld.v1',TAU=Math.PI*2;
const FOOT=new Set(['walk','grass','sand','pier','lot','dirt']);
const hash=(x,y)=>{const s=Math.sin(x*12.9898+y*78.233)*43758.5453;return s-Math.floor(s);};
const store=()=>{try{return JSON.parse(localStorage.getItem(KEY)||'{}')||{};}catch{return {};}};
export function owSave(G){try{const o=G.ow;localStorage.setItem(KEY,JSON.stringify({caches:[...o.got],traps:o.best,fares:o.fares,hints:o.hints,jumps:o.jumps,owned:o.owned,seen:o.seen,stats:G.stats}));}catch{}}
const reward=(G,x,y,amt,text)=>{G.chips+=amt;G.floaters?.push({x,y,text:'+'+amt+' CHIPS',life:1.6,vy:-36,color:'#f2c14e'});G.particles?.push({kind:'flash',x,y,life:.14,a:1});G.audio?.pickup?.();G.toast=text;G.toastT=2.8;};
const nearRoad=(G,x,y)=>{for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]])if(G.surfaceAt(x+dx*40,y+dy*40)==='road')return true;return false;};
export function initOpenWorld(G,hooks){
 const s=store();
 const o=G.ow={hooks,got:new Set(s.caches||[]),best:s.traps||{},fares:s.fares||0,hints:s.hints||{},jumps:s.jumps||{},owned:s.owned||{},seen:s.seen||{},caches:[],traps:[],events:[],fare:null,evT:3,stillT:0};
 G.stats=Object.assign({dist:0,walk:0,top:0,jumps:0,longest:0,evaded:0,maxHeat:0,invested:0,rent:0,hideouts:0,time:0},s.stats||{});
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
 // City ramps: plazas and car parks in town, run-up and landing on road,
 // pavement or lot with no building in the flight path.
 const CITY=new Set(['road','walk','lot']);let city=0;
 const CORE=/DOWNTOWN|STRIP|MIDTOWN|PALACE|CROWN LOOP|OLD TOWN|EASTSIDE|SOUTHSIDE|PORT/;
 for(let i=0;i<60000&&city<3;i++){
  const x=300+hash(i,13)*(W-600),y=400+hash(i,17)*(H-700),sf=G.surfaceAt(x,y);if(sf!=='lot'&&sf!=='walk')continue;if(i<45000&&!CORE.test(districtAt(x,y)))continue;
  if(o.ramps.some(r=>Math.hypot(r.x-x,r.y-y)<1100))continue;
  for(const [hx,hy] of [[0,-1],[1,0],[0,1],[-1,0]]){let ok=true,road=0;
   for(let t=-200;t<=420&&ok;t+=20){const sx=x+hx*t,sy=y+hy*t;const a=G.surfaceAt(sx,sy),b=G.surfaceAt(sx-hy*28,sy+hx*28),c=G.surfaceAt(sx+hy*28,sy-hx*28);if(!CITY.has(a)||!CITY.has(b)||!CITY.has(c))ok=false;if(a==='road')road++;}
   if(ok&&road>=6&&G.surfaceAt(x,y)!=='road'){o.ramps.push({id:'c'+city,x,y,hx,hy,rot:Math.atan2(hx,-hy),name:districtAt(x,y),city:true});city++;break;}
  }
 }
 placeLandmarks(G,o);placeProperties(G,o);
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
   let pay=40+dist*4;if(first)pay+=200;if(dist>best){o.jumps[r.id]=dist;}if(G.stats){G.stats.jumps++;G.stats.longest=Math.max(G.stats.longest,dist);}
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
 tickJumps(G,dt);tickCityLife(G,dt);tickPrimer(G,dt);
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
// Dead-end roads that stop at open ground (not the map edge) get a proper
// terminus: a kerb, a red/white end-of-road barrier and boulders. Shared with
// the road-coherence audit, which fails on any uncapped dead end.
export function roadEnds(G){
 if(G._roadEnds&&G._roadEnds.g===G.graph)return G._roadEnds.list;
 const list=[],deg=new Map();for(const e of G.graph?.edges||[])for(const n of [e.A,e.B]){const d=deg.get(n);if(d)d.push(e);else deg.set(n,[e]);}
 for(const [n,es] of deg){if(es.length!==1)continue;const e=es[0],o=e.A===n?e.B:e.A,ux=(n.x-o.x)/e.len,uy=(n.y-o.y)/e.len;
  if(n.x<150||n.x>WORLD_W-150||n.y>WORLD_H-150)continue;
  const at=(k)=>G.surfaceAt(n.x+ux*e.w*.5*k,n.y+uy*e.w*.5*k);if(at(1)==='road')continue;
  list.push({x:n.x,y:n.y,ux,uy,w:e.w,node:n.id});}
 G._roadEnds={g:G.graph,list};return list;
}
function drawRoadEnds(G,r){
 const c=G.ctx;for(const q of roadEnds(G)){if(q.x<r.x0-200||q.x>r.x1+200||q.y<r.y0-200||q.y>r.y1+200)continue;
  c.save();c.translate(q.x,q.y);c.rotate(Math.atan2(q.uy,q.ux));const h=q.w/2;
  // kerb cap and verge
  c.fillStyle='#b9b2a0';c.fillRect(-6,-h-10,22,q.w+20);c.fillStyle='#8f8a80';c.fillRect(-6,-h-10,3,q.w+20);
  // end-of-road barrier: posts and a red/white chevron board
  c.fillStyle='rgba(0,0,0,.25)';c.fillRect(-18,-h+14,10,q.w-28);
  c.fillStyle='#f4f1e8';c.fillRect(-22,-h+12,10,q.w-24);c.fillStyle='#c8322c';for(let y=-h+12;y<h-12;y+=24)c.fillRect(-22,y,10,12);
  c.fillStyle='#3a3d40';for(const y of [-h+16,0,h-20])c.fillRect(-14,y,4,6);
  // boulders behind
  c.fillStyle='#6f6a5f';for(const [x,y,s] of [[30,-h*.6,11],[34,0,13],[28,h*.6,10]]){c.beginPath();c.ellipse(x,y,s,s*.8,0,0,6.283);c.fill();}
  c.fillStyle='#9a9384';for(const [x,y,s] of [[28,-h*.6-2,6],[32,-2,7],[26,h*.6-2,5]]){c.beginPath();c.ellipse(x,y,s,s*.7,0,0,6.283);c.fill();}
  c.restore();}
}
export function drawOpenWorld(G,r){
drawRoadEnds(G,r);
 const o=G.ow;if(!o)return;const ctx=G.ctx,t=G.ticks/60,inR=(x,y,m=60)=>x>r.x0-m&&x<r.x1+m&&y>r.y0-m&&y<r.y1+m;
 drawCityLife(G,r);
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
export function owProgress(G){return G.ow?owCompletion(G)+'%':'';}
export function owDetail(G){const o=G.ow;if(!o)return '';return `Caches ${o.got.size}/${o.caches.length} · Speed traps ${Object.keys(o.best).length}/${o.traps.length} · Jumps ${Object.keys(o.jumps).length}/${(o.ramps||[]).length} · Fares ${o.fares}`;}
// ---- Pass 8: landmarks, properties, stats ---------------------------------
const LM_ART=new Map();
function lmArt(kind){
 if(LM_ART.has(kind))return LM_ART.get(kind);if(typeof document==='undefined')return null;
 const S=2,size={fountain:[110,110],statue:[84,84],gazebo:[104,104],tower:[96,96],billboard:[150,70],lifeguard:[70,70],picnic:[120,90],wheel:[170,170],mast:[70,70],market:[130,100]}[kind],cv=document.createElement('canvas');cv.width=size[0]*S;cv.height=size[1]*S;
 const c=cv.getContext('2d');c.scale(S,S);const W=size[0],H=size[1],cx=W/2,cy=H/2;
 const shadow=(x,y,rx,ry)=>{c.fillStyle='rgba(0,0,0,.28)';c.beginPath();c.ellipse(x+5,y+7,rx,ry,0,0,TAU);c.fill();};
 const disc=(x,y,r,f,s)=>{c.fillStyle=f;c.beginPath();c.arc(x,y,r,0,TAU);c.fill();if(s){c.strokeStyle=s;c.lineWidth=1.2;c.stroke();}};
 if(kind==='fountain'){shadow(cx,cy,48,46);disc(cx,cy,50,'#cfc6b4','#8f8574');disc(cx,cy,44,'#b9b09d');const g=c.createRadialGradient(cx-8,cy-8,4,cx,cy,40);g.addColorStop(0,'#8fe0e6');g.addColorStop(1,'#2f8fa6');disc(cx,cy,40,g);
  c.strokeStyle='rgba(255,255,255,.55)';c.lineWidth=1.4;for(const r of [14,24,33]){c.beginPath();c.arc(cx,cy,r,0,TAU);c.stroke();}disc(cx,cy,12,'#d8d0bd','#8f8574');disc(cx,cy,6,'#9fe8ef');disc(cx-1.5,cy-1.5,2.5,'#ffffff');
  for(let i=0;i<8;i++){const a=i/8*TAU;disc(cx+Math.cos(a)*47,cy+Math.sin(a)*47,3,'#e6dfcf','#8f8574');}}
 else if(kind==='statue'){shadow(cx,cy,36,34);c.fillStyle='#b8ae98';c.fillRect(cx-36,cy-36,72,72);c.strokeStyle='#7c735f';c.lineWidth=1.5;c.strokeRect(cx-36,cy-36,72,72);c.fillStyle='#d6cdb6';c.fillRect(cx-24,cy-24,48,48);c.strokeRect(cx-24,cy-24,48,48);
  // bronze crown on a plinth, original emblem
  c.fillStyle='#6e5a36';c.fillRect(cx-14,cy-12,28,24);const g=c.createLinearGradient(cx-14,cy-14,cx+14,cy+14);g.addColorStop(0,'#e7c66a');g.addColorStop(1,'#8a6a2a');c.fillStyle=g;
  c.beginPath();c.moveTo(cx-13,cy+8);c.lineTo(cx-13,cy-6);c.lineTo(cx-6,cy+1);c.lineTo(cx,cy-11);c.lineTo(cx+6,cy+1);c.lineTo(cx+13,cy-6);c.lineTo(cx+13,cy+8);c.closePath();c.fill();c.strokeStyle='#4a3a1a';c.lineWidth=1;c.stroke();
  for(const [x,y] of [[-13,-6],[0,-11],[13,-6]])disc(cx+x,cy+y,2.4,'#ff6a6a','#4a3a1a');for(const [x,y] of [[-30,-30],[30,-30],[-30,30],[30,30]]){disc(cx+x,cy+y,5,'#3f6b38');disc(cx+x-1,cy+y-1,3,'#5d9150');}}
 else if(kind==='gazebo'){shadow(cx,cy,46,44);c.fillStyle='#cdbf9f';c.beginPath();for(let i=0;i<8;i++){const a=i/8*TAU+TAU/16;c.lineTo(cx+Math.cos(a)*48,cy+Math.sin(a)*48);}c.fill();
  for(let i=0;i<8;i++){const a0=i/8*TAU+TAU/16,a1=(i+1)/8*TAU+TAU/16;c.fillStyle=i%2?'#3d6a5b':'#4f806d';c.beginPath();c.moveTo(cx,cy);c.lineTo(cx+Math.cos(a0)*42,cy+Math.sin(a0)*42);c.lineTo(cx+Math.cos(a1)*42,cy+Math.sin(a1)*42);c.fill();}
  c.strokeStyle='rgba(255,236,200,.55)';c.lineWidth=1;for(let i=0;i<8;i++){const a=i/8*TAU+TAU/16;c.beginPath();c.moveTo(cx,cy);c.lineTo(cx+Math.cos(a)*42,cy+Math.sin(a)*42);c.stroke();}c.strokeStyle='#efe6cf';c.lineWidth=2.2;c.beginPath();for(let i=0;i<=8;i++){const a=i/8*TAU+TAU/16;c.lineTo(cx+Math.cos(a)*42,cy+Math.sin(a)*42);}c.stroke();disc(cx,cy,5,'#e7c66a','#5a4220');}
 else if(kind==='tower'){shadow(cx,cy,40,38);c.strokeStyle='#5a5148';c.lineWidth=3;for(const [x,y] of [[-30,-30],[30,-30],[-30,30],[30,30]]){c.beginPath();c.moveTo(cx+x,cy+y);c.lineTo(cx+x*.45,cy+y*.45);c.stroke();}
  const g=c.createRadialGradient(cx-10,cy-10,4,cx,cy,34);g.addColorStop(0,'#e9e2d2');g.addColorStop(1,'#9a9284');disc(cx,cy,32,g,'#5a5148');c.strokeStyle='rgba(90,81,72,.6)';c.lineWidth=1;for(let i=0;i<12;i++){const a=i/12*TAU;c.beginPath();c.moveTo(cx+Math.cos(a)*10,cy+Math.sin(a)*10);c.lineTo(cx+Math.cos(a)*31,cy+Math.sin(a)*31);c.stroke();}
  disc(cx,cy,9,'#b8b0a0','#5a5148');c.fillStyle='#2f5f8a';c.font='900 9px system-ui';c.textAlign='center';c.fillText('CROWN',cx,cy+22);}
 else if(kind==='billboard'){c.fillStyle='rgba(0,0,0,.3)';c.fillRect(10,30,W-12,30);c.fillStyle='#3a3f45';c.fillRect(30,40,6,26);c.fillRect(W-36,40,6,26);
  const g=c.createLinearGradient(0,6,0,44);g.addColorStop(0,'#2f6f8f');g.addColorStop(1,'#173a52');c.fillStyle=g;c.fillRect(6,6,W-12,38);c.strokeStyle='#e8e2d4';c.lineWidth=2;c.strokeRect(6,6,W-12,38);
  c.fillStyle='#f2c14e';c.font='900 15px system-ui';c.textAlign='center';c.fillText('LUCKY ISLE',cx,26);c.fillStyle='#e8eef2';c.font='700 8px system-ui';c.fillText('FERRY · EVERY HOUR · PIER 3',cx,38);}
 else if(kind==='lifeguard'){shadow(cx,cy,26,24);c.fillStyle='#d8c08a';c.fillRect(cx-22,cy-22,44,44);c.fillStyle='#e2563f';c.beginPath();c.moveTo(cx-26,cy-16);c.lineTo(cx,cy-30);c.lineTo(cx+26,cy-16);c.lineTo(cx+26,cy+6);c.lineTo(cx-26,cy+6);c.closePath();c.fill();
  c.fillStyle='#f4eee0';c.fillRect(cx-26,cy-6,52,5);c.fillStyle='#7a5a3a';c.fillRect(cx-6,cy+6,12,20);for(let y=cy+9;y<cy+26;y+=4)c.fillRect(cx-9,y,18,1.5);c.fillStyle='#f4eee0';c.font='900 7px system-ui';c.textAlign='center';c.fillText('GUARD',cx,cy-10);}
 else if(kind==='picnic'){for(const [x,y] of [[30,28],[82,30],[54,62]]){shadow(x,y,16,10);c.fillStyle='#8a5a34';c.fillRect(x-16,y-6,32,12);c.fillStyle='#a86e40';c.fillRect(x-16,y-12,32,4);c.fillRect(x-16,y+8,32,4);c.strokeStyle='rgba(60,36,18,.6)';c.lineWidth=.8;c.strokeRect(x-16,y-6,32,12);
   c.fillStyle=['#e05a4f','#3a8fb7','#5fb06a'][(x+y)%3];c.fillRect(x-6,y-4,12,8);c.fillStyle='#f4eee0';c.fillRect(x-4,y-2,3,3);}
  disc(108,70,9,'#3f6b38');disc(106,68,6,'#5d9150');disc(12,70,7,'#3f6b38');}
 else if(kind==='wheel'){shadow(cx,cy+30,70,20);c.strokeStyle='#e8e2d4';c.lineWidth=3;c.beginPath();c.arc(cx,cy,72,0,TAU);c.stroke();c.lineWidth=1.2;c.beginPath();c.arc(cx,cy,64,0,TAU);c.stroke();
  for(let i=0;i<16;i++){const a=i/16*TAU;c.strokeStyle='rgba(232,226,212,.8)';c.beginPath();c.moveTo(cx,cy);c.lineTo(cx+Math.cos(a)*72,cy+Math.sin(a)*72);c.stroke();c.fillStyle=['#e05a4f','#f2c14e','#3a8fb7','#5fb06a','#b06ad0'][i%5];c.beginPath();c.roundRect(cx+Math.cos(a)*72-6,cy+Math.sin(a)*72-5,12,10,2);c.fill();}
  disc(cx,cy,10,'#c9ced2','#5a5148');c.fillStyle='#5a5148';c.beginPath();c.moveTo(cx-6,cy);c.lineTo(cx-34,cy+82);c.lineTo(cx-26,cy+82);c.closePath();c.fill();c.beginPath();c.moveTo(cx+6,cy);c.lineTo(cx+34,cy+82);c.lineTo(cx+26,cy+82);c.closePath();c.fill();}
 else if(kind==='mast'){shadow(cx,cy,24,22);c.strokeStyle='#8a2f2a';c.lineWidth=2;for(const r of [10,18,26]){c.beginPath();c.rect(cx-r,cy-r,r*2,r*2);c.stroke();}c.strokeStyle='#d8d0c0';c.lineWidth=1.2;for(const [x,y] of [[-26,-26],[26,-26],[-26,26],[26,26]]){c.beginPath();c.moveTo(cx,cy);c.lineTo(cx+x,cy+y);c.stroke();}disc(cx,cy,5,'#e8e2d4','#8a2f2a');disc(cx,cy,2,'#ff4a4a');}
 else if(kind==='market'){for(let i=0;i<4;i++){const x=18+i*31,y=i%2?60:36;shadow(x,y,14,12);c.fillStyle=['#e05a4f','#3a8fb7','#f2c14e','#5fb06a'][i];c.fillRect(x-14,y-14,28,24);c.fillStyle='rgba(255,255,255,.75)';for(let k=0;k<4;k++)c.fillRect(x-14+k*7,y-14,3.5,24);
   c.fillStyle='rgba(0,0,0,.25)';c.fillRect(x-14,y+8,28,3);c.fillStyle='#8a5a34';c.fillRect(x-12,y+12,24,5);}}
 LM_ART.set(kind,{cv,w:W,h:H});return LM_ART.get(kind);
}
const LM_NAME={fountain:'Crown Fountain',statue:'Monument',gazebo:'Bandstand',tower:'Water Tower',billboard:'Billboard',lifeguard:'Lifeguard Post',picnic:'Picnic Lawn',wheel:'Pier Wheel',mast:'Radio Mast',market:'Market Stalls'};
// Kinds that belong in each kind of place: no fountains in the pines or on
// the airfield apron, plazas and statues in the city, lookouts in the wild.
const LM_KINDS={urban:['fountain','statue','gazebo','market','fountain','statue'],beach:['wheel','lifeguard','market','lifeguard'],forest:['picnic','tower','gazebo','picnic'],desert:['tower','mast','billboard'],air:['mast','billboard','tower'],track:['billboard','statue'],edge:['billboard','market','tower','statue']};
function lmCategory(dn,sf,core){if(sf==='sand'&&!/MESA|DESERT|SIERRA/.test(dn))return 'beach';if(/FOREST/.test(dn))return 'forest';if(/MESA|DESERT|SIERRA/.test(dn))return 'desert';if(/AIRFIELD/.test(dn))return 'air';if(/GRAND PRIX/.test(dn))return 'track';return core||/IRONSIDE|EASTSIDE|MIDTOWN|TERRACE|PALACE|OLD TOWN|SOUTHSIDE|DOWNTOWN/.test(dn)?'urban':'edge';}
function placeLandmarks(G,o){
 o.landmarks=[];const W=WORLD_W,H=WORLD_H,ok=new Set(['grass','dirt','sand','lot']),perD={};
 const CITY=/DOWNTOWN|STRIP|MIDTOWN|PALACE|CROWN LOOP|OLD TOWN|EASTSIDE|SOUTHSIDE|PORT|CROWN CITY/;
 const cells=[];for(let y=260;y<H-200;y+=180)for(let x=200;x<W-200;x+=180){const cx=x+(hash(x,y)-.5)*80,cy=y+(hash(y,x)-.5)*80;cells.push([cx,cy,CITY.test(districtAt(cx,cy))]);}
 // the painted core is checked first so the city gets its plazas before the wilds fill the quota
 cells.sort((a,b)=>(b[2]-a[2])||hash(a[0]*.37,a[1]*.11)-hash(b[0]*.37,b[1]*.11));
 let wheel=false;const rail=G.world?.transit?.rail;
 for(const [x,y,core] of cells){if(o.landmarks.length>=32)break;const sf=G.surfaceAt(x,y);if(!ok.has(sf)&&!(core&&sf==='walk'))continue;if(core&&sf==='lot')continue; // city lots are car parks
  let clear=true;const R=core?60:80,st=core?30:40;for(let dy=-R;dy<=R&&clear;dy+=st)for(let dx=-R;dx<=R;dx+=st){const s=G.surfaceAt(x+dx,y+dy);if(s!==sf&&!(ok.has(s)&&sf!=='sand'&&sf!=='walk')){clear=false;break;}}
  if(!clear)continue;if(o.landmarks.some(l=>Math.hypot(l.x-x,l.y-y)<(core?520:820)))continue;if(o.ramps.some(r=>Math.hypot(r.x-x,r.y-y)<600))continue;if(rail&&Math.abs(x-rail.x)<200&&y>rail.y0-200&&y<rail.y1+200)continue;
  const dn=districtAt(x,y),cat=lmCategory(dn,sf,core);if((perD[dn]||0)>=(cat==='track'?1:core?4:3))continue;
  const h=hash(x*.7,y*.3),list=LM_KINDS[cat].filter(k=>k!=='wheel'||!wheel);const kind=list[Math.floor(h*list.length)];
  if(kind==='wheel')wheel=true;perD[dn]=(perD[dn]||0)+1;
  o.landmarks.push({x,y,kind,r:kind==='wheel'?52:kind==='billboard'?28:kind==='picnic'||kind==='market'?0:36,district:dn});
 }
}
const PROP_NAMES=['Flat','Studio','Loft','Garage','Townhouse','Penthouse','Villa','Estate'];
function placeProperties(G,o){
 o.props=[];const W=WORLD_W,H=WORLD_H,used=new Set();
 for(let i=0;i<30000&&o.props.length<8;i++){const x=200+hash(i,31)*(W-400),y=300+hash(i,37)*(H-500);if(G.surfaceAt(x,y)!=='walk')continue;
  let wall=null;for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]])if(G.surfaceAt(x+dx*30,y+dy*30)==='build')wall=[dx,dy];if(!wall||!nearRoad(G,x,y))continue;
  const d=districtAt(x,y);if(used.has(d))continue;if(o.props.some(p=>Math.hypot(p.x-x,p.y-y)<1400))continue;if(o.caches.some(c=>Math.hypot(c.x-x,c.y-y)<120))continue;
  used.add(d);const k=o.props.length,title=d.toLowerCase().replace(/(^|\s)\S/g,m=>m.toUpperCase()).replace(/^The /,'');o.props.push({id:'p'+k,x,y,wx:wall[0],wy:wall[1],name:title+' '+PROP_NAMES[k],district:d,price:[1500,2500,3500,5000,6500,8000,10000,12500][k]});}
}
export function tickCityLife(G,dt){
 const o=G.ow,P=G.player,st=G.stats;if(!o||!st)return;
 // stats
 if(P.type==='veh'){const sp=Math.hypot(P.vx||0,P.vy||0);st.dist+=sp*dt;const kmh=Math.round(sp*.36);if(kmh>st.top&&!P.def?.aircraft)st.top=kmh;}else st.walk+=(P.speed||0)*dt;
 st.time+=dt;
 // landmarks are solid at the base (player only: AI routes never cross lawns)
 for(const l of o.landmarks){if(!l.r)continue;const dx=P.x-l.x,dy=P.y-l.y,d=Math.hypot(dx,dy),R=l.r+(P.type==='veh'?20:8);if(d>=R||d<.01||P.jumpH>0)continue;
  P.x=l.x+dx/d*R;P.y=l.y+dy/d*R;if(P.type==='veh'){const vn=(P.vx*dx+P.vy*dy)/d;if(vn<0){P.vx-=dx/d*vn*1.4;P.vy-=dy/d*vn*1.4;P.vx*=.7;P.vy*=.7;}}}
 // first visit to each landmark counts toward discovery
 if(G.ticks%15===0)for(const l of o.landmarks){const id=l.kind+Math.round(l.x)+'_'+Math.round(l.y);if(!o.seen[id]&&Math.hypot(P.x-l.x,P.y-l.y)<220){o.seen[id]=1;G.toast=`Discovered: ${LM_NAME[l.kind]} · ${l.district}`;G.toastT=2.6;owSave(G);break;}}
 // properties: stand on the marker on foot to buy; owned ones are safehouses and pay rent
 let on=null;if(P.type==='foot')for(const p of o.props)if(Math.hypot(P.x-p.x,P.y-p.y)<34){on=p;break;}
 if(on){o.buyT=(o.buyT||0)+dt;const owned=o.owned[on.id];
  if(!owned){if(o.buyT>.2&&o.buyT-dt<=.2){G.toast=`FOR SALE: ${on.name} — ${on.price.toLocaleString()} chips. Stand still to buy.`;G.toastT=2.4;}
   if(o.buyT>2&&!o.buyDone){o.buyDone=true;if(G.chips>=on.price){G.chips-=on.price;o.owned[on.id]=1;st.invested+=on.price;G.toast=`${on.name} is yours. Safehouse + rent ${Math.round(on.price*.03)} chips every 3 min.`;G.toastT=3.4;G.audio?.pickup?.();G.floaters?.push({x:on.x,y:on.y-20,text:'-'+on.price,life:1.6,vy:-30,color:'#ff8a7a'});owSave(G);}else{G.toast=`${on.name}: you need ${(on.price-G.chips).toLocaleString()} more chips.`;G.toastT=2.6;}}}
  else if(G.wanted>0&&o.buyT>1.5&&!o.buyDone&&!G.vehicles.some(v=>v.cop&&!v.dead&&Math.hypot(v.x-P.x,v.y-P.y)<360)){o.buyDone=true;G.wanted=0;G.heat=0;G.toast=`Laid low at ${on.name}. Heat cleared.`;G.toastT=2.8;st.hideouts++;}
 }else{o.buyT=0;o.buyDone=false;}
 // rent every 3 minutes of play
 o.rentT=(o.rentT||0)+dt;if(o.rentT>=180){o.rentT=0;let sum=0;for(const p of o.props)if(o.owned[p.id])sum+=Math.round(p.price*.03);if(sum){G.chips+=sum;st.rent+=sum;G.toast=`Rent collected: +${sum} chips`;G.toastT=2.4;owSave(G);}}
 if(G.statsCardT>0)G.statsCardT-=dt;
}
export function drawCityLife(G,r){
 const o=G.ow;if(!o)return;const c=G.ctx,inR=(x,y,m)=>x>r.x0-m&&x<r.x1+m&&y>r.y0-m&&y<r.y1+m;
 for(const l of o.landmarks){const a=lmArt(l.kind);if(!a||!inR(l.x,l.y,a.w))continue;
  const K=1.35;c.drawImage(a.cv,l.x-a.w*K/2,l.y-a.h*K/2,a.w*K,a.h*K);
  if(l.kind==='fountain'&&!G.settings.reducedMotion){c.save();c.fillStyle='rgba(235,252,255,.85)';for(let i=0;i<10;i++){const k=((G.ticks/50)+i/10)%1,an=i/10*TAU;c.globalAlpha=1-k;c.fillRect(l.x+Math.cos(an)*k*22,l.y+Math.sin(an)*k*22-Math.sin(k*Math.PI)*8,2,2);}c.restore();}
  if(l.kind==='mast'&&(G.night||0)>.3&&(G.ticks%60)<30){c.save();c.globalCompositeOperation='lighter';c.drawImage(LIGHTDOT(),l.x-10,l.y-10,20,20);c.restore();}
 }
 for(const p of o.props){if(!inR(p.x,p.y,60))continue;const owned=o.owned[p.id];c.save();c.translate(p.x,p.y);
  c.fillStyle='rgba(0,0,0,.25)';c.beginPath();c.ellipse(2,3,18,9,0,0,TAU);c.fill();
  c.strokeStyle=owned?'rgba(110,220,150,.9)':'rgba(242,193,78,.9)';c.lineWidth=2;c.setLineDash([5,4]);c.beginPath();c.arc(0,0,22+Math.sin(G.ticks/20)*1.5,0,TAU);c.stroke();c.setLineDash([]);
  c.fillStyle=owned?'#3f9a5e':'#c9932e';c.beginPath();c.moveTo(-9,2);c.lineTo(0,-8);c.lineTo(9,2);c.lineTo(9,10);c.lineTo(-9,10);c.closePath();c.fill();c.fillStyle='#f4eee0';c.fillRect(-2.5,4,5,6);
  const near=Math.hypot(G.player.x-p.x,G.player.y-p.y)<300,rent=Math.round(p.price*.03);
  // Info card before buying: name, price and rent (near), a compact tag (far).
  const l1=owned||near?p.name.toUpperCase():`FOR SALE ${p.price.toLocaleString()}`,l2=owned?(near?`SAFEHOUSE · +${rent} / 3 MIN`:''):near?`${p.price.toLocaleString()} CHIPS · RENT ${rent} / 3 MIN`:'';
  c.textAlign='center';c.font='800 8px system-ui';let tw=c.measureText(l1).width;c.font='700 7px system-ui';if(l2)tw=Math.max(tw,c.measureText(l2).width);tw+=10;const hh=l2?21:11;
  c.fillStyle='rgba(10,14,18,.8)';c.fillRect(-tw/2,-16-hh,tw,hh);c.fillStyle=owned?'#9ff0bf':'#f2c14e';c.fillRect(-tw/2,-16-hh,2,hh);
  c.font='800 8px system-ui';c.fillStyle=l2&&!owned?'#f4eee0':owned?'#9ff0bf':'#f2c14e';c.fillText(l1,0,-hh-16+8.5);
  if(l2){c.font='700 7px system-ui';c.fillStyle=owned?'#bfe9cf':'#f2c14e';c.fillText(l2,0,-hh-16+18);}
  c.restore();}
}
let _dot=null;function LIGHTDOT(){if(_dot)return _dot;const cv=document.createElement('canvas');cv.width=cv.height=32;const x=cv.getContext('2d'),g=x.createRadialGradient(16,16,0,16,16,16);g.addColorStop(0,'rgba(255,80,80,1)');g.addColorStop(1,'rgba(255,80,80,0)');x.fillStyle=g;x.fillRect(0,0,32,32);return _dot=cv;}
const fmtTime=s=>{const h=Math.floor(s/3600),m=Math.floor(s/60)%60;return h?`${h} h ${m} min`:`${m} min`;};
export function owCompletion(G){const o=G.ow;if(!o)return 0;const n=o.got.size+Object.keys(o.best).length+Object.keys(o.jumps).length+Object.keys(o.owned).length+Object.keys(o.seen).length,t=o.caches.length+o.traps.length+o.ramps.length+o.props.length+o.landmarks.length;return t?Math.round(n/t*100):0;}
export function drawStatsCard(G){
 if(!(G.statsCardT>0)||!G.ow||G.scene!=='play')return;const o=G.ow,st=G.stats,c=G.ctx,W=G.canvas.width,Hc=G.canvas.height,s=Math.max(1,Math.min(2.2,Math.min(W/760,Hc/460)));
 const rows=[['Completion',owCompletion(G)+'%'],['Hidden caches',`${o.got.size} / ${o.caches.length}`],['Speed traps',`${Object.keys(o.best).length} / ${o.traps.length}`],['Stunt jumps',`${Object.keys(o.jumps).length} / ${o.ramps.length}  (best ${Math.max(0,...Object.values(o.jumps))} m)`],
  ...(G.mode!=='freeride'?[['Story score',(()=>{const T=storyTotals(G.director);return T.played?`${T.total.toLocaleString()} (${T.grade})`:'—';})()]]:[]),
  ['Landmarks found',`${Object.keys(o.seen).length} / ${o.landmarks.length}`],['Properties',`${Object.keys(o.owned).length} / ${o.props.length}  (rent ${st.rent})`],['Taxi fares',String(o.fares)],['Distance driven',(st.dist/16/1000).toFixed(1)+' km'],['On foot',(st.walk/16/1000).toFixed(1)+' km'],['Top speed',st.top+' km/h'],['Chases escaped',String(st.evaded||0)],['Highest heat',String(st.maxHeat||0)+' ★'],['Played',fmtTime(st.time)]];
 const w=330*s,h=(48+rows.length*19)*s,x=(W-w)/2,y=Math.max(10,(Hc-h)/2),a=Math.min(1,G.statsCardT*2);
 c.save();c.setTransform(1,0,0,1,0,0);c.globalAlpha=a;c.fillStyle='rgba(10,16,22,.9)';c.fillRect(x,y,w,h);c.strokeStyle='#f2c14e';c.lineWidth=1.5*s;c.strokeRect(x,y,w,h);
 c.fillStyle='#f2c14e';c.font=`800 ${15*s}px system-ui`;c.textBaseline='middle';c.textAlign='left';c.fillText('CITY LIFE · STATS',x+16*s,y+20*s);
 c.font=`600 ${12*s}px system-ui`;rows.forEach(([k,v],i)=>{const yy=y+(46+i*19)*s;c.fillStyle='#9fb0bc';c.textAlign='left';c.fillText(k,x+16*s,yy);c.fillStyle='#eef2f5';c.textAlign='right';c.fillText(v,x+w-16*s,yy);});
 c.restore();
}
// First-run primer: three short cards (moving, the phone/crew board and heat,
// free-roam activities), mobile or desktop wording, shown once per profile.
const TUT=m=>[
 ['WELCOME TO CROWN CITY',m?['Left stick: walk or steer · CAR: get in or out','AIM / FIRE: hold to aim, release to fire · RUN: sprint','MAP top right · pause II for story, crew and settings']:['WASD / arrows: walk or drive · E: get in or out of a car','Mouse: aim and fire · Shift: sprint · Space: drift · Q/X: weapon, reload','M: map · C: crew board · R: radio (six stations) · Esc: pause']],
 ['HEAT AND THE CREW',['Stars are heat. Break line of sight to let them fade.','Workshops: repair, respray to lose heat, tune, paint and fix spiked tyres.','Roadblocks at 3+ stars may lay spike strips. Owned safehouses clear heat.']],
 ['CITY LIFE',['Hidden chip caches glint against walls; speed traps pay at 110+ km/h.','Ramps launch you; FOR SALE houses become safehouses that pay rent.','Pause → CITY LIFE shows your stats and completion.']],
];
export function tickPrimer(G,dt){const o=G.ow;if(!o||G.scene!=='play')return;
 if(!o.hints.primer&&!(G.vn?.t>0)&&G.ticks>90){o.hints.primer=1;G.primer={i:0,t:6.5};owSave(G);}
 const p=G.primer;if(!p)return;p.t-=dt;if(p.t<=0){p.i++;p.t=6.5;if(p.i>=3)G.primer=null;}}
export function drawPrimer(G){const p=G.primer;if(!p||G.scene!=='play')return;const card=TUT(!!G.touch)[p.i],c=G.ctx,W=G.canvas.width,Hc=G.canvas.height,s=Math.max(1,Math.min(2.2,Math.min(W/760,Hc/460)));
 const w=Math.min(W-20,440*s),h=(40+card[1].length*20+16)*s,x=(W-w)/2,y=Hc*.18,a=Math.min(1,(6.5-p.t)*3,p.t*2);
 c.save();c.setTransform(1,0,0,1,0,0);c.globalAlpha=a;c.fillStyle='rgba(10,16,22,.9)';c.fillRect(x,y,w,h);c.fillStyle='#f2c14e';c.fillRect(x,y,4*s,h);
 c.textAlign='left';c.textBaseline='middle';c.font=`800 ${14*s}px system-ui`;c.fillText(card[0],x+16*s,y+20*s);c.fillStyle='#9fb0bc';c.font=`600 ${10*s}px system-ui`;c.textAlign='right';c.fillText(`${p.i+1} / 3`,x+w-14*s,y+20*s);
 c.textAlign='left';c.fillStyle='#e8eef4';c.font=`500 ${12*s}px system-ui`;card[1].forEach((t,i)=>c.fillText(t,x+16*s,y+(44+i*20)*s,w-30*s));c.restore();}
