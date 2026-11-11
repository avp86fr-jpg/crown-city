import {EXPANSION_JOBS,EXPANSION_DEBRIEFS} from './expansion_jobs.js';
/* Crown City action systems: weapons, stamina, crew work and vehicle workshops. */
import {STREET_JOBS,STREET_DEBRIEFS,streetJobTarget,tickStreetJob} from './side_jobs.js';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const number=(v,d,a,b)=>Number.isFinite(v)?clamp(v,a,b):d;
export const WEAPONS=[
 {id:'sidearm',name:'SILENCED .45',mag:12,reload:1.05,interval:.26,damage:34,carDamage:9,speed:780,pellets:1,spread:.018,quiet:true},
 {id:'smg',name:'VULTURE SMG',mag:28,reload:1.5,interval:.085,damage:16,carDamage:5,speed:860,pellets:1,spread:.09},
 {id:'shotgun',name:'BREACHER',mag:6,reload:1.9,interval:.7,damage:19,carDamage:5,speed:680,pellets:6,spread:.3},
];
export function actionState(s={}) {
 return {weapon:Math.floor(number(s.weapon,0,0,2)),ammo:WEAPONS.map((w,i)=>Math.floor(number(s.ammo?.[i],w.mag,0,w.mag))),
 stamina:number(s.stamina,100,0,100),reloadT:0,shotT:0,dodgeT:0,dodgeCool:0,
 reputation:Math.floor(number(s.reputation,0,0,999)),completed:Math.floor(number(s.completed,0,0,999)),
 upgrades:Math.floor(number(s.upgrades,0,0,3)),contract:s.contract&&['courier','ghost','drift','rescue','signal','harbour','canal','casino','airlift','ridge','nightline','coldsignal','clockwork'].includes(s.contract.id)?{id:s.contract.id,stage:Math.floor(number(s.contract.stage,0,0,EXPANSION_JOBS.find(j=>j.id===s.contract.id)?.stages??(s.contract.id==='signal'?3:s.contract.id==='harbour'?2:1))),t:number(s.contract.t,0,0,720),progress:number(s.contract.progress,0,0,1e6),trainStart:Math.floor(number(s.contract.trainStart,0,0,1e6))}:null,
 messages:[],messageT:0,message:null,combo:0,comboT:0,cover:false};
}
export function actionSave(A) {return {weapon:A.weapon,ammo:[...A.ammo],stamina:A.stamina,reputation:A.reputation,completed:A.completed,upgrades:A.upgrades,contract:A.contract?{...A.contract}:null};}
export function message(G,name,text,color='#88dfd8') {
 const A=G.action;if(!A)return;
 if(A.messageT>0){A.messages.push({name,text,color});A.messages=A.messages.slice(-5);return;}
 A.message={name,text,color};A.messageT=6.5;
 G.audio?.radioChirp?.();
}
export function reload(G) {
 const A=G.action,w=WEAPONS[A.weapon];if(A.reloadT>0||A.ammo[A.weapon]===w.mag)return false;
 A.reloadT=w.reload;G.audio?.reload?.();return true;
}
export function requestShot(G) {
 const A=G.action;if(!A)return WEAPONS[0];
 if(A.shotT>0||A.reloadT>0||A.dodgeT>0)return null;
 if(A.ammo[A.weapon]<=0){reload(G);return null;}
 const w=WEAPONS[A.weapon];A.ammo[A.weapon]--;A.shotT=w.interval;
 if(!A.ammo[A.weapon])reload(G);
 return w;
}
export function servicePoints(G) {
 if(G.services)return G.services;
 const points=[['garage','HUNTER CUSTOMS','garage',0,0],['spray','MIDNIGHT RESPRAY','neural',130,70],['clinic','MERCY / SUPPLY','pd',-180,80]];
 G.services=points.map(([id,name,key,dx,dy])=>{const p=G.meta.spawns[key];const s=G.findSafeAction(p[0]+dx,p[1]+dy);return {id,name,x:s.x,y:s.y};});
 return G.services;
}
export function nearService(G) {
 if(!G.action||G.race||G.jack)return null;
 if(G.player.type==='veh'&&Math.hypot(G.player.vx,G.player.vy)>35)return null;
 return servicePoints(G).find(s=>Math.hypot(s.x-G.player.x,s.y-G.player.y)<85)||null;
}
export function buyService(G,choice) {
 const A=G.action,P=G.player;
 const offers={repair:{cost:120},tune:{cost:500},supply:{cost:90},respray:{cost:250}};
 const offer=offers[choice];if(!offer)return false;
 if(G.wanted>0&&!G.evading){message(G,'HUNTER','Break their line of sight first. I am a mechanic, not a magician.');return false;}
 if(['repair','tune','respray'].includes(choice)&&(P.type!=='veh'||P.def.boat||P.def.aircraft)){message(G,'HUNTER','Bring a car or a bike into the workshop.');return false;}
 if(choice==='tune'&&A.upgrades>=3){message(G,'HUNTER','Every street upgrade is fitted. Go make them regret it.');return false;}
 if(G.chips<offer.cost){message(G,'HUNTER','Not enough chips. Crew contracts pay.');return false;}
 G.chips-=offer.cost;
 if(choice==='repair'){P.health=100;P.burning=false;P.wrecked=false;P.burnT=0;}
 if(choice==='tune'){A.upgrades++;P.tune=A.upgrades;message(G,'HUNTER','Stage '+A.upgrades+' fitted: more torque, better brakes, sharper turn-in.');}
 if(choice==='respray'){G.wanted=0;G.seenT=0;G.cops.forEach(c=>{c.chasing=false;c.siren=false;c.ai=false;c.loose=true;c.keep=false;c.ambient=true;});G.cops=[];P.paint=(P.paint||0)+1;}
 if(choice==='supply'){G.health=100;A.ammo=WEAPONS.map(w=>w.mag);A.reloadT=0;A.stamina=100;}
 G.audio?.pickup?.();return true;
}
export const CONTRACTS=[
 {id:'courier',title:'NIGHT SHIFT',contact:'NEURAL',text:'Carry a sealed drive from Southside to the loft. 100 seconds. No wanted stars at delivery.',reward:650,time:100},
 {id:'ghost',title:'GHOST DRIVER',contact:'MASK',text:'Lift a marked black box near Metro, then disappear. Reach the marker and lose two stars.',reward:850,time:150},
 {id:'drift',title:'SMOKE SIGNAL',contact:'FIRE',text:'Bank 1,200 drift points in a car. Keep the speed up. You have 90 seconds.',reward:700,time:90},
 ...STREET_JOBS, ...EXPANSION_JOBS,
];
export function startContract(G,id) {
 const A=G.action;if(A.contract)return false;
 const c=CONTRACTS.find(c=>c.id===id);if(!c)return false;
 A.contract={id,t:c.time,progress:0,stage:0};
 message(G,c.contact,id==='courier'?"The drive is at Hunter's garage. Pick it up. The clock starts when you do.":id==='ghost'?'Black box is marked blue. Pick it up, then make the city forget you.':id==='drift'?'Show me a long slide, not an expensive crash.':c.text);
 if(id==='courier'){const at=G.meta.spawns.garage;G.waypoint={x:at[0],y:at[1]};}
 if(id==='ghost'){const at=G.meta.interactions.pd;G.waypoint={x:at[0],y:at[1]};}
 const target=streetJobTarget(G,A.contract);if(target)G.waypoint=target;
 G.gps=null;return true;
}
export function tickAction(G,dt,hooks) {
 const A=G.action,I=G.input,P=G.player;if(!A)return;
 A.shotT=Math.max(0,A.shotT-dt);A.dodgeCool=Math.max(0,A.dodgeCool-dt);
 if(A.reloadT>0){A.reloadT=Math.max(0,A.reloadT-dt);if(A.reloadT===0){A.ammo[A.weapon]=WEAPONS[A.weapon].mag;G.audio?.cock?.();}}
 if(I.weaponP){A.weapon=(A.weapon+1)%WEAPONS.length;A.reloadT=0;G.audio?.cock?.();}
 if(I.reloadP)reload(G);
 if(I.crewP){G.scene='crew';G.menuSel=0;G.pausedFrom='play';return;}
 const running=P.type==='foot'&&Math.hypot(I.x,I.y)>.15&&(I.sprint||I.touchJoy?.active&&Math.hypot(I.x,I.y)>.92);
 A.stamina=clamp(A.stamina+dt*(running?-15:22),0,100);
 A.exhausted=A.stamina<5||A.exhausted&&A.stamina<28;
 A.cover=false;
 if(P.type==='foot'&&(P.speed||0)<35){for(const [x,y] of [[30,0],[-30,0],[0,30],[0,-30]])if(G.solidAt(P.x+x,P.y+y)){A.cover=true;break;}}
 if(I.dodgeP&&P.type==='foot'&&A.stamina>=24&&A.dodgeCool===0){
  A.stamina-=24;A.dodgeT=.34;A.dodgeCool=.75;A.dodgeRot=Math.hypot(I.x,I.y)>.1?Math.atan2(I.x,I.y)+G.cam.rot:P.rot;
  G.audio?.dodge?.();
 }
 if(A.dodgeT>0&&P.type==='foot'){
  A.dodgeT=Math.max(0,A.dodgeT-dt);hooks.moveFoot(G,P,Math.sin(A.dodgeRot)*390*dt,-Math.cos(A.dodgeRot)*390*dt);P.rot=A.dodgeRot;P.dist+=390*dt;
 }
 A.messageT=Math.max(0,A.messageT-dt);
 if(A.messageT===0&&A.messages.length){const next=A.messages.shift();message(G,next.name,next.text,next.color);}
 if(A.contract){
  const c=A.contract,def=CONTRACTS.find(d=>d.id===c.id);if(c.id!=='courier'||c.stage)c.t=Math.max(0,c.t-dt);let done=false;
  if(c.id==='courier'){
    const a=G.meta.interactions.neural,start=G.meta.spawns.garage;
    if(!c.stage&&Math.hypot(P.x-start[0],P.y-start[1])<85){c.stage=1;c.t=def.time;G.waypoint={x:a[0],y:a[1]};G.gps=null;message(G,'NEURAL','Drive collected. The clock is running. Bring it to the loft without heat.');}
    done=c.stage===1&&G.wanted===0&&Math.hypot(P.x-a[0],P.y-a[1])<85;
  }
  if(c.id==='ghost'){const a=G.meta.interactions.pd;if(!c.stage&&Math.hypot(P.x-a[0],P.y-a[1])<100){c.stage=1;G.wanted=Math.max(2,G.wanted);G.seenT=0;G.waypoint=null;G.gps=null;message(G,'MASK','Metro noticed. Find an alley. Do not lead them back to me.');}done=c.stage===1&&G.wanted===0;}
  if(c.id==='drift'&&P.type==='veh'&&!P.def.boat&&!P.def.aircraft&&P.drifting){const score=Math.hypot(P.vx,P.vy)*dt*.65;c.progress+=score;A.combo+=score;A.comboT=1.2;done=c.progress>=1200;}
  if(c.id==='rescue'||c.id==='signal'||c.id==='harbour'||EXPANSION_JOBS.some(j=>j.id===c.id))done=tickStreetJob(G,c,dt,message);
  if(c.t===0)done=false;
  if(done){G.chips+=def.reward;A.reputation+=2;A.completed++;message(G,def.contact,'+'+def.reward+' chips. '+(EXPANSION_DEBRIEFS[c.id]||STREET_DEBRIEFS[c.id]||'Contract complete. Your name is travelling.'),'#f2c14e');G.audio?.pickup?.();A.contract=null;G.waypoint=null;G.gps=null;}
  else if(c.t===0){message(G,def.contact,'Contract missed. No penalty. Take another run when you are ready.');A.contract=null;G.waypoint=null;G.gps=null;}
 }
 A.comboT=Math.max(0,A.comboT-dt);if(!A.comboT)A.combo=0;

}
export function applyTune(G,v) {
 const level=G.action?.upgrades||0;if(v.def.boat||v.def.aircraft||v.tunedLevel===level)return;
 if(!level){if(v.stockDef)v.def=v.stockDef;v.tunedLevel=0;return;}
 if(!v.stockDef)v.stockDef=v.def;v.def={...v.stockDef,accel:v.stockDef.accel*(1+level*.1),brake:v.stockDef.brake*(1+level*.09),grip:Math.min(1.3,v.stockDef.grip+level*.04),max:v.stockDef.max*(1+level*.035)};v.tunedLevel=level;
}
