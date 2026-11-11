/* Crown Transit. Station geometry is shared by collision, maps and rendering.
   Trains use an analytic timetable: no distant physics, pathfinding or spawned actors. */
import {message} from './action.js';
import {loadImage} from './assets.js';
import {darkness} from './lighting.js';
export const STATIONS=Object.freeze([
 {id:'harbour',name:'PORT ROYALE',line:'metro',x:6180,y:1250},
 {id:'midtown',name:'MIDTOWN',line:'metro',x:6250,y:3480},
 {id:'terrace',name:'METAWIN TERRACE',line:'metro',x:9450,y:3500},
 {id:'southcanal',name:'CANAL SOUTH',line:'metro',x:6320,y:6140},
 {id:'oldtown',name:'OLD TOWN',line:'metro',x:2600,y:6100},
 {id:'eastport',name:'EAST PORT',line:'regional',x:10320,y:1400},
 {id:'pinewatch',name:'PINEWATCH',line:'regional',x:10320,y:4900},
 {id:'airfield',name:'AIRFIELD EAST',line:'regional',x:10320,y:8020},
 {id:'sierra',name:'SIERRA JUNCTION',line:'regional',x:10320,y:9440},
]);
export const TRANSIT_FARE=25;
export const stationExit=s=>({x:s.x-(s.line==='regional'?105:0),y:s.y+84});
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),smooth=t=>t*t*(3-2*t),TAU=Math.PI*2;
export function applyTransitWorld(W,{CODE}){
 W.transit={stations:STATIONS,rail:{x:10320,y0:1140,y1:9660}};
 // Portals and forecourts live outside the painted core; clear props and solid geometry together.
 for(const s of STATIONS){
  const r={x:s.x-182,y:s.y-98,w:364,h:212};
  for(const key of ['buildings','trees','parking','lots','features','lamps','pools'])W[key]=W[key].filter(p=>!(p.x+(p.w||p.r||0)>r.x&&p.x-(p.r||0)<r.x+r.w&&p.y+(p.h||p.r||0)>r.y&&p.y-(p.r||0)<r.y+r.h));
  const overlaps=p=>p.x+(p.w||0)>r.x&&p.x<r.x+r.w&&p.y+(p.h||0)>r.y&&p.y<r.y+r.h;
  W.expansion.obstacles=W.expansion.obstacles.filter(p=>!overlaps(p));
  W.expansion.decor=W.expansion.decor.filter(p=>!overlaps({x:p.x-(p.w||0)/2,y:p.y-(p.h||0)/2,w:p.w||1,h:p.h||1}));
  W.fill(r.x,r.y,r.w,r.h,CODE.walk,c=>c!==CODE.road);
  if(s.line==='metro'){
   // Only the canopy/posts block movement; the broad south approach remains accessible.
   W.fill(s.x-78,s.y-50,156,70,CODE.build);
   W.expansion?.obstacles.push({x:s.x-78,y:s.y-50,w:156,h:70,hgt:16});
  }
  const e=stationExit(s);W.fill(e.x-22,e.y-22,44,44,CODE.walk);
 }
 const validDecor=new Set(W.expansion.decor);for(const [key,items] of W.expansion.decorBins){const live=items.filter(p=>validDecor.has(p));if(live.length)W.expansion.decorBins.set(key,live);else W.expansion.decorBins.delete(key);}
 // Elevated alignment: roads and canal retain their surface collision beneath the viaduct.
 for(let y=1280;y<9600;y+=240){
  if(y>W.river[0]-50&&y<W.river[1]+50||STATIONS.some(s=>s.line==='regional'&&Math.abs(s.y-y)<170)||W.roads.some(s=>!s.v&&Math.abs(s.c-y)<s.w/2+40))continue;
  W.fill(10288,y-10,16,20,CODE.build);
  W.expansion?.obstacles.push({x:10288,y:y-10,w:16,h:20,hgt:42});
 }
}
function ensureTransitArt(G){if(!G.transitAtlas&&!G.transitLoading){G.transitLoading=true;loadImage('assets/premium/transit.webp').then(im=>G.transitAtlas=im).catch(()=>{}).finally(()=>G.transitLoading=false);}}
export function initTransit(G,saved={}){G.transit={clock:Number.isFinite(saved.clock)?Math.max(0,saved.clock)%198:0,near:null,menu:null,ride:null,completed:Number.isFinite(saved.completed)?Math.max(0,Math.min(1e6,Math.floor(saved.completed))):0};}
export function nearStation(G){if(G.player?.type!=='foot'||G.jack)return null;return STATIONS.find(s=>{const e=stationExit(s);return Math.hypot(G.player.x-e.x,G.player.y-e.y)<76;})||null;}
export function tickTransit(G,dt){if(!G.transit)initTransit(G);G.transit.clock+=dt;G.transit.near=nearStation(G);}
export function interactTransit(G){
 const s=nearStation(G);if(!s)return false;
 if(G.wanted>0){message(G,'CROWN TRANSIT','Police are checking the gates. Lose your wanted level first.','#8ed6cc');return true;}
 G.transit.menu=s;G.scene='transit';G.menuSel=0;G.input.fire=false;return true;
}
export function journeyDuration(a,b){return 17+clamp(Math.hypot(a.x-b.x,a.y-b.y)/480,5,20);}
export function beginJourney(G,id){
 const from=G.transit?.menu,to=STATIONS.find(s=>s.id===id);
 if(!from||!to||from.id===to.id||G.player.type!=='foot'||G.wanted>0)return false;
 if(G.chips<TRANSIT_FARE){message(G,'CROWN TRANSIT','A day fare costs 25 chips.','#8ed6cc');return false;}
 G.chips-=TRANSIT_FARE;G.transit.ride={from,to,elapsed:0,duration:journeyDuration(from,to),advanced:0};G.transit.menu=null;G.scene='train';G.audio.transit?.('doors');G.input.fire=false;
 return true;
}
export function ridePhase(ride){
 const t=ride.elapsed,end=ride.duration;
 return t<4?{id:'approach',p:t/4}:t<6?{id:'boarding',p:(t-4)/2}:t<10?{id:'departing',p:(t-6)/4}:t<end-6?{id:'riding',p:(t-10)/(end-16)}:t<end-2?{id:'arriving',p:(t-(end-6))/4}:{id:'alighting',p:clamp((t-(end-2))/2,0,1)};
}
export function tickJourney(G,dt,H={}){
 const ride=G.transit?.ride;if(!ride){G.scene='play';return;}
 const before=ridePhase(ride).id;ride.elapsed=Math.min(ride.duration,ride.elapsed+dt);G.ticks++;G.transit.clock+=dt;
 const speed=[0,1,.5,.25][G.settings.timeSpeed??1]??1;G.time=(G.time+dt*(24/480)*speed)%24;
 // Timed contracts cannot gain free time by using a train, including skipped journeys.
 if(G.action?.contract&&(G.action.contract.id!=='courier'||G.action.contract.stage)){G.action.contract.t-=dt;if(G.action.contract.t<=0){G.action.contract=null;message(G,'CREW','The job window closed while you were on the train.');}}
 const after=ridePhase(ride).id;if(after!==before)G.audio.transit?.(after==='boarding'||after==='alighting'?'doors':after==='departing'?'depart':'rail');
 if(ride.elapsed>=ride.duration){
  const e=stationExit(ride.to),safe=G.findSafeAction?G.findSafeAction(e.x,e.y):e;
  G.player=H.makeFoot?H.makeFoot(G,safe.x,safe.y,Math.PI):{...G.player,type:'foot',x:safe.x,y:safe.y,vx:0,vy:0};
  G.cam.x=safe.x;G.cam.y=safe.y;G.cam.rot=0;G.transit.ride=null;G.transit.completed++;G.scene='play';G.frozenWorld=null;G.waypoint=null;G.gps=null;
  G.input.fire=G.input.enterP=false;G.transit.near=ride.to;message(G,'CROWN TRANSIT',ride.to.name+' · Mind the gap.','#8ed6cc');H.save?.(G);
 }
}
export function skipJourney(G,H){const r=G.transit?.ride;if(r&&r.elapsed>=6)tickJourney(G,r.duration-r.elapsed,H);}
export function cancelTransit(G){if(G.transit){G.transit.ride=null;G.transit.menu=null;G.transit.near=null;}if(['train','transit'].includes(G.scene))G.scene='play';}
export function regionalTrainAt(clock,offset=0){
 const stops=STATIONS.filter(s=>s.line==='regional'),sequence=[0,1,2,3,2,1],legs=sequence.map((i,j)=>({a:stops[i],b:stops[sequence[(j+1)%sequence.length]]}));
 const travel=26,dwell=7,total=legs.length*(travel+dwell),t=((clock+offset)%total+total)%total,k=Math.floor(t/(travel+dwell)),local=t%(travel+dwell),leg=legs[k],p=clamp((local-dwell)/travel,0,1),dir=Math.sign(leg.b.y-leg.a.y);
 return {x:10320+(offset?18:-18),y:leg.a.y+(leg.b.y-leg.a.y)*smooth(p),rot:dir>0?Math.PI:0,doors:local<dwell?Math.min(1,local*2,(dwell-local)*2):0,speed:local<dwell?0:6*p*(1-p)*Math.abs(leg.b.y-leg.a.y)/travel,next:leg.b.name};
}
function box(c,x,y,w,h,col){c.fillStyle=col;c.fillRect(x,y,w,h);}
function label(c,t,x,y,size,col='#e4e3cf'){c.fillStyle=col;c.font=`800 ${size}px system-ui`;c.textAlign='center';c.fillText(t,x,y);}
function art(c,im,rect,x,y,w,h){c.drawImage(im,rect[0]*im.width,rect[1]*im.height,rect[2]*im.width,rect[3]*im.height,x,y,w,h);}
function trainCar(c,x,y,rot,doors=0,regional=true,im=null){
 if(im){c.save();c.translate(x,y);c.rotate(rot);art(c,im,[.685,0,.13,.5],-18,-72,36,140);for(const side of [-1,1])if(doors>0)box(c,side<0?-19:17,-8,2,doors*16,'#f3d69b');c.restore();return;}
 c.save();c.translate(x,y);c.rotate(rot);box(c,-15,-67,35,140,'#14272b');box(c,-18,-72,36,140,regional?'#c6d0c7':'#b9c8bf');box(c,-17,-59,34,6,regional?'#c68e48':'#42a6a1');box(c,-11,-69,22,12,'#153943');box(c,-14,49,28,14,'#153943');
 for(let y=-40;y<48;y+=28){box(c,-18,y,5,16,'#264f59');box(c,13,y,5,16,'#264f59');box(c,-12,y,24,18,'#83988f');box(c,-8,y+4,16,10,'#a9b8ae');}
 for(const side of [-1,1]){box(c,side<0?-19:14,-13-doors*7,5,12,'#dfdfcd');box(c,side<0?-19:14,1+doors*7,5,12,'#dfdfcd');box(c,side<0?-20:18,-3,2,doors*12,'#11272d');}
 if(im)art(c,im,[.685,0,.13,.5],-18,-72,36,140);
 for(const side of [-1,1])if(doors>0)box(c,side<0?-20:18,-8,2,doors*16,'#f3d69b');
 box(c,-13,-71,6,3,'#fff1bf');box(c,7,-71,6,3,'#fff1bf');box(c,-12,65,5,2,'#c45143');box(c,7,65,5,2,'#c45143');c.restore();
}
export function drawTransitWorld(G,r,overhead=false){
 const c=G.ctx,rail=G.world.transit?.rail;if(!rail)return;
 if(overhead&&r.x1>rail.x-120&&r.x0<rail.x+120&&r.y1>rail.y0&&r.y0<rail.y1){
  ensureTransitArt(G);const y0=Math.max(rail.y0,Math.floor(r.y0/16)*16-16),y1=Math.min(rail.y1,r.y1+16);
  box(c,rail.x-26,y0+18,103,y1-y0,'rgba(10,24,26,.32)');box(c,rail.x-50,y0,100,y1-y0,'#555e59');
  for(let y=y0;y<y1;y+=16){box(c,rail.x-42,y,84,5,'#8c8770');box(c,rail.x-40,y+5,80,2,'#353f3f');}
  for(const x of [-31,-6,6,31]){box(c,rail.x+x,y0,3,y1-y0,'#aeb5a8');box(c,rail.x+x+3,y0,1,y1-y0,'#293e40');}
  for(const x of [-49,48])box(c,rail.x+x,y0,2,y1-y0,'#c0b99b');
  for(const offset of [0,99]){const v=regionalTrainAt(G.transit?.clock||0,offset);if(v.y<r.y0-420||v.y>r.y1+420)continue;for(let i=-1;i<=1;i++)trainCar(c,v.x,v.y+i*148,v.rot,i===0?v.doors:0,true,G.transitAtlas);}
 }
 if(overhead)return;
 for(const s of STATIONS){if(s.x<r.x0-220||s.x>r.x1+220||s.y<r.y0-160||s.y>r.y1+160)continue;
  ensureTransitArt(G);c.save();c.translate(s.x,s.y);if(s.line==='metro')c.scale(.82,1);box(c,-179,-94,358,204,'#8c9483');
  for(let y=-92;y<108;y+=16){box(c,-178,y,356,1,'#a3aa92');for(let x=-178+(y%32?0:12);x<179;x+=24)box(c,x,y,1,16,'rgba(49,72,63,.18)');}
  if(s.line==='metro'){
   box(c,-85,-12,170,69,'#172c32');for(let i=0;i<9;i++)box(c,-78,1+i*6,156,3,'#556863');
   box(c,-86,-58,172,62,'#1d464a');box(c,-80,-53,160,44,'#39716d');box(c,-83,-57,166,4,'#b9c7b4');
   for(const x of [-87,85]){box(c,x,-10,3,72,'#d4c7a0');box(c,x-2,52,7,6,'#e3d6ad');}
   if(G.transitAtlas)art(c,G.transitAtlas,[0,0,.49,.5],-180,-112,360,224);
   label(c,'M',-143,10,30,'#8fe0c7');label(c,'CROWN METRO',0,-31,11);label(c,s.name,0,-16,8);
   for(let i=0;i<3;i++)box(c,105+i*13,20,8,25,i===0?'#76bfa7':'#253e3b');
  }else{
   box(c,-96,-94,42,202,'#b4b7a1');box(c,-58,-94,4,202,'#e0b84e');
   box(c,54,-94,42,202,'#b4b7a1');box(c,54,-94,4,202,'#e0b84e');
   // Platforms flank the moving tracks; the train is never painted over by a plaza.
   box(c,-50,-96,100,204,'#555e59');for(let y=-92;y<108;y+=16)box(c,-42,y,84,5,'#8c8770');for(const x of [-31,-6,6,31])box(c,x,-96,3,204,'#b9c0b1');

   box(c,-153,-72,50,98,'#28585b');box(c,-150,-69,44,90,'#477878');for(let i=0;i<9;i++)box(c,-146,34+i*5,38,2,'#c6c2a7');if(G.transitAtlas){art(c,G.transitAtlas,[.13,.5,.23,.5],-101,-96,47,202);art(c,G.transitAtlas,[.13,.5,.23,.5],54,-96,47,202);}
   label(c,'R',-126,-36,27);label(c,s.name,0,-107,11);
  }
  for(const x of [-151,140]){box(c,x,57,22,8,'#5b5844');box(c,x,56,22,2,'#d4b98a');box(c,x,65,3,6,'#354941');box(c,x+19,65,3,6,'#354941');}
  box(c,112,-74,29,47,'#273d3e');box(c,116,-70,21,24,'#bba36b');label(c,'CITY',126,-55,6);
  for(const x of [-165,164]){box(c,x,-73,3,24,'#283c39');box(c,x-6,-76,15,5,darkness(G.time)>.3?'#ffe4a4':'#bdc6ab');}
  const e=stationExit(s);label(c,G.transit?.near?.id===s.id?(G.touch?'TAP RAIL':'E / RAIL'):'CROWN TRANSIT',e.x-s.x,102,9,'#173f40');
  c.restore();
 }
}
export function drawTransitMap(G,to){const c=G.ctx;c.save();for(const line of ['metro','regional']){const list=STATIONS.filter(s=>s.line===line);c.strokeStyle=line==='metro'?'#75d7c3':'#e2b46a';c.lineWidth=2*G.ui;c.beginPath();list.forEach((s,i)=>{const p=to(s.x,s.y);i?c.lineTo(...p):c.moveTo(...p);});if(line==='metro')c.closePath();c.stroke();for(const s of list){const p=to(s.x,s.y);c.fillStyle='#122e34';c.beginPath();c.arc(...p,6*G.ui,0,TAU);c.fill();c.stroke();label(c,line==='metro'?'M':'R',p[0],p[1]+3*G.ui,8*G.ui,line==='metro'?'#75d7c3':'#e2b46a');}}c.restore();}
export function drawTransitMenu(G,H){
 const c=G.ctx,d=G.dpr,W=G.canvas.width,Hh=G.canvas.height,from=G.transit?.menu;if(!from)return;
 c.setTransform(1,0,0,1,0,0);box(c,0,0,W,Hh,'rgba(7,21,28,.97)');const width=Math.min(W-28*d,650*d),x=(W-width)/2;
 label(c,'CROWN TRANSIT',W/2,34*d,21*d,'#8cd5c7');label(c,`${from.name}  /  25 CHIPS PER JOURNEY`,W/2,56*d,10*d);
 const cols=W>Hh?2:1,items=STATIONS.filter(s=>s.id!==from.id),gap=8*d,top=76*d,rowH=Math.min(50*d,(Hh-top-72*d)/Math.ceil(items.length/cols)),cw=(width-gap*(cols-1))/cols;
 items.forEach((s,i)=>H.button(G,x+(i%cols)*(cw+gap),top+Math.floor(i/cols)*rowH,cw,rowH-5*d,(s.line==='metro'?'M  ':'R  ')+s.name,()=>beginJourney(G,s.id),{primary:false}));
 const mapY=top+Math.ceil(items.length/cols)*rowH+26*d,mapH=Math.min(180*d,Hh-mapY-90*d);
 if(mapH>70*d){
  box(c,x,mapY,width,mapH,'#102b32');label(c,'THE NETWORK / ALL NIGHT SERVICE',W/2,mapY+20*d,9*d,'#99bfb5');
  const short={harbour:'PORT',midtown:'MIDTOWN',terrace:'METAWIN',southcanal:'CANAL',oldtown:'OLD TOWN',eastport:'EAST PORT',pinewatch:'PINES',airfield:'AIRFIELD',sierra:'SIERRA'};
  for(const [j,line] of ['metro','regional'].entries()){const stops=STATIONS.filter(s=>s.line===line),yy=mapY+(j?mapH*.72:mapH*.4),left=x+34*d,right=x+width-34*d;c.strokeStyle=line==='metro'?'#8cd5c7':'#d7b47b';c.lineWidth=3*d;c.beginPath();c.moveTo(left,yy);c.lineTo(right,yy);c.stroke();for(let i=0;i<stops.length;i++){const xx=left+i*(right-left)/(stops.length-1);c.fillStyle=stops[i]===from?'#eee1be':'#173d44';c.beginPath();c.arc(xx,yy,5*d,0,TAU);c.fill();c.stroke();label(c,short[stops[i].id],xx,yy+19*d,8*d);}}
 }
 label(c,G.chips<25?'NEED 25 CHIPS FOR A TICKET':'M · SUBWAY     R · REGIONAL RAIL     TRANSFERS INCLUDED',W/2,Hh-53*d,9*d,G.chips<25?'#ed9d80':'#b2bbaa');
 H.button(G,W/2-85*d,Hh-43*d,170*d,32*d,'BACK TO STREET',()=>{G.scene='play';G.transit.menu=null;},{primary:true});
}
export function drawJourney(G,H){
 const ride=G.transit?.ride;if(!ride)return;ensureTransitArt(G);const c=G.ctx,d=G.dpr,W=G.canvas.width,Hh=G.canvas.height,phase=ridePhase(ride),t=ride.elapsed,regional=ride.from.line==='regional'||ride.to.line==='regional';
 c.setTransform(1,0,0,1,0,0);box(c,0,0,W,Hh,'#0a1c25');
 // Responsive platform cutaway. Fixed number of repeated details bounds mobile draw cost.
 const sy=Hh*.54,scale=Math.min(W/(920*d),Hh/(520*d))*d;c.save();c.translate(W/2,sy);c.scale(scale,scale);
 box(c,-1100,-260,2200,550,regional?'#293f43':'#26383b');
 const movement=phase.id==='riding'?t*230:phase.id==='departing'?smooth(phase.p)*420:phase.id==='arriving'?(1-smooth(phase.p))*420:0;
 for(let i=-6;i<7;i++){const x=i*180-(movement%180);box(c,x,-250,4,320,'#436064');box(c,x+12,-135,140,3,'#6a7770');box(c,x+25,-90,110,60,'#1c3037');box(c,x+29,-86,102,3,'#a28655');label(c,i%2?'THE CITY KEEPS MOVING':'CROWN TRANSIT',x+80,-52,8,'#b4c0aa');box(c,x+20,-205,120,5,'#d5dfbc');}
 box(c,-1100,45,2200,105,'#565c51');box(c,-1100,46,2200,7,'#e4bb51');for(let i=-60;i<60;i++){box(c,i*20,60,2,88,'#8d8e75');box(c,i*20,103,20,1,'#8d8e75');}
 box(c,-1100,153,2200,125,'#15292e');for(let i=-55;i<55;i++)box(c,i*24-(movement%24),177,8,82,'#605f51');box(c,-1100,185,2200,4,'#bec3ae');box(c,-1100,248,2200,4,'#bec3ae');
 const slide=G.settings.reducedMotion?0:phase.id==='approach'?(1-smooth(phase.p))*1150:phase.id==='departing'?-smooth(phase.p)*1150:phase.id==='arriving'?(1-smooth(phase.p))*1150:0;
 const showTrain=phase.id!=='riding';
 if(showTrain){c.save();c.translate(slide,0);for(let i=-1;i<=1;i++){
  const x=i*310-148,doors=phase.id==='boarding'?Math.sin(Math.PI*phase.p):phase.id==='alighting'?Math.sin(Math.PI*phase.p):0;
  if(G.transitAtlas){art(c,G.transitAtlas,[.455,.635,.543,.22],x,-95,296,130);if(doors>.01){box(c,x+138,-57,33,70,'#16323a');art(c,G.transitAtlas,[.708,.7,.03,.117],x+138-doors*15,-57,16.4,69);art(c,G.transitAtlas,[.738,.7,.03,.117],x+154.4+doors*15,-57,16.4,69);}continue;}
  box(c,x+5,-79,296,122,'rgba(0,0,0,.35)');box(c,x,-93,296,128,'#bbc9bc');box(c,x,-91,296,8,'#e8e4cc');box(c,x,-5,296,16,regional?'#b77e42':'#399b96');box(c,x,25,296,10,'#394e4e');
  for(let j=0;j<4;j++){box(c,x+12+j*70,-73,55,48,'#152e38');box(c,x+15+j*70,-70,49,2,'#587e82');for(let p=0;p<2;p++){box(c,x+24+j*70+p*18,-44,10,18,'#816a54');box(c,x+26+j*70+p*18,-54,7,8,'#d0a77c');}}
  if(G.transitAtlas)art(c,G.transitAtlas,[.455,.635,.543,.22],x,-95,296,130);
  box(c,x+127,-76,44,105,'#223b40');box(c,x+128-doors*18,-75,21,103,'#a7bbb0');box(c,x+150+doors*18,-75,21,103,'#a7bbb0');box(c,x+132-doors*18,-68,13,36,'#1e414b');box(c,x+154+doors*18,-68,13,36,'#1e414b');label(c,'CROWN / '+(regional?'REGIONAL':'METRO'),x+75,19,9,'#254b4e');
 }c.restore();}
 else{
  // Passenger view through the windows during the middle of the journey.
  box(c,-470,-155,940,280,'#9aa99a');for(let i=-2;i<=2;i++){box(c,i*180-76,-134,152,158,'#122e3b');for(let j=0;j<5;j++){const xx=i*180-70+((j*38-t*160)%140+140)%140;box(c,xx,-120,12,130,regional?'#456256':'#526367');}box(c,i*180-72,28,144,30,'#315e60');box(c,i*180-72,70,144,37,'#28484c');}box(c,-470,-155,940,9,'#dce0c3');
 }
 label(c,phase.id==='arriving'||phase.id==='alighting'?ride.to.name:ride.from.name,0,-171,21,'#e7e0c2');c.restore();
 label(c,'CROWN TRANSIT',W/2,30*d,17*d,'#8ed7c7');label(c,ride.from.name+'  →  '+ride.to.name,W/2,52*d,10*d);
 if(Hh>W){const cy=Hh*.23;label(c,phase.id==='approach'||phase.id==='boarding'?'DEPARTING FROM':'NEXT STATION',W/2,cy,10*d,'#88b4ad');label(c,phase.id==='approach'||phase.id==='boarding'?ride.from.name:ride.to.name,W/2,cy+31*d,22*d);label(c,regional?'CROWN REGIONAL / THROUGH TICKET':'CROWN METRO / ALL NIGHT',W/2,cy+53*d,9*d,'#cbb98c');}
 const captions={approach:'Your train is arriving',boarding:'Doors opening · Mind the gap',departing:'Stand clear of the closing doors',riding:'Next stop · '+ride.to.name,arriving:'Arriving · '+ride.to.name,alighting:'Doors opening · Exit to street'};
 box(c,0,Hh-98*d,W,98*d,'rgba(8,26,34,.93)');label(c,captions[phase.id],W/2,Hh-74*d,13*d);const bw=Math.min(W-60*d,440*d);box(c,(W-bw)/2,Hh-60*d,bw,3*d,'#355557');box(c,(W-bw)/2,Hh-60*d,bw*t/ride.duration,3*d,'#8ed7c7');
 if(t>=6)H.button(G,W/2-80*d,Hh-47*d,160*d,34*d,'SKIP JOURNEY',()=>skipJourney(G,H),{primary:true});
}
