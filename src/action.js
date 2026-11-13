import {restoreOperationState,settleOperationState} from './crew_operations.js';
import {CIRCUIT,CIRCUIT_VERSION} from './circuit_world.js';
import {recoverRiot} from './vehicle_recovery.js';
import {EXPANSION_JOBS,EXPANSION_DEBRIEFS,isExpansionJob} from './expansion_jobs.js';
/* Crown City action systems: weapons, stamina, crew work and vehicle workshops. */
import {STREET_JOBS,STREET_DEBRIEFS,streetJobTarget,tickStreetJob} from './side_jobs.js';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const number=(v,d,a,b)=>Number.isFinite(v)?clamp(v,a,b):d;
export const WEAPONS=[
 {id:'sidearm',name:'SILENCED .45',mag:12,reload:1.05,interval:.26,damage:34,carDamage:9,speed:1100,pellets:1,spread:.009,range:620,falloff:380,kick:.10,quiet:true,reserveMax:null,start:null},
 {id:'smg',name:'VULTURE SMG',mag:28,reload:1.5,interval:.085,damage:16,carDamage:5,speed:1250,pellets:1,spread:.045,range:620,falloff:300,kick:.14,reserveMax:224,start:112},
 {id:'shotgun',name:'BREACHER',mag:6,reload:1.9,interval:.7,damage:19,carDamage:5,speed:1050,pellets:6,spread:.23,range:340,falloff:100,kick:.32,reserveMax:42,start:24},
 {id:'rocket',name:'CROWN RPG',mag:1,reload:2.8,interval:1,damage:125,carDamage:115,speed:560,pellets:1,spread:0,range:950,kick:.5,rocket:true,reserveMax:5,start:2},
];
export function actionState(s={}) {
 return {weapon:Math.floor(number(s.weapon,0,0,WEAPONS.length-1)),ammo:WEAPONS.map((w,i)=>Math.floor(number(s.ammo?.[i],w.mag,0,w.mag))),
 // Spare rounds per weapon (the sidearm is unlimited). Old saves start stocked.
 reserve:WEAPONS.map((w,i)=>w.reserveMax==null?null:Math.floor(number(s.reserve?.[i],w.start,0,w.reserveMax))),
 circuitVersion:CIRCUIT_VERSION,circuitClass:['club','sport','pro'].includes(s.circuitClass)?s.circuitClass:'club',circuitRecords:Object.fromEntries(['club','sport','pro'].map(k=>[k,s.circuitVersion===CIRCUIT_VERSION?number(s.circuitRecords?.[k],0,0,240):0])),
 circuitBest:s.circuitVersion===CIRCUIT_VERSION?number(s.circuitBest,0,0,240):0,circuitLaps:Math.floor(number(s.circuitLaps,0,0,1e6)),
 stamina:number(s.stamina,100,0,100),reloadT:0,shotT:0,dodgeT:0,dodgeCool:0,bloom:0,
 completedJobs:[...new Set((Array.isArray(s.completedJobs)?s.completedJobs:[]).filter(id=>CONTRACTS.some(c=>c.id===id)))],
 reputation:Math.floor(number(s.reputation,0,0,999)),completed:Math.floor(number(s.completed,0,0,999)),
 upgrades:Math.floor(number(s.upgrades,0,0,MAX_TUNE)),armor:Math.floor(number(s.armor,0,0,100)),contract:s.contract&&CONTRACTS.some(c=>c.id===s.contract.id)?{id:s.contract.id,stage:Math.floor(number(s.contract.stage,0,0,EXPANSION_JOBS.find(j=>j.id===s.contract.id)?.stages??(s.contract.id==='signal'?3:s.contract.id==='harbour'?2:1))),t:number(s.contract.t,0,0,CONTRACTS.find(c=>c.id===s.contract.id).time),progress:number(s.contract.progress,0,0,1e6),trainStart:Math.floor(number(s.contract.trainStart,0,0,1e6)),...restoreOperationState(s.contract)}:null,
 messages:[],messageT:0,message:null,combo:0,comboT:0,cover:false};
}
export function actionSave(A) {settleOperationState(A.contract);return {circuitVersion:CIRCUIT_VERSION,circuitClass:A.circuitClass,circuitRecords:{...A.circuitRecords},circuitBest:A.circuitBest,circuitLaps:A.circuitLaps,weapon:A.weapon,ammo:[...A.ammo],reserve:[...(A.reserve||[])],stamina:A.stamina,reputation:A.reputation,completed:A.completed,completedJobs:[...(A.completedJobs||[])],upgrades:A.upgrades,armor:Math.round(A.armor||0),contract:A.contract?{...A.contract}:null};}
export function message(G,name,text,color='#88dfd8') {
 const A=G.action;if(!A)return;
 if(A.messageT>0){A.messages.push({name,text,color});A.messages=A.messages.slice(-5);return;}
 A.message={name,text,color};A.messageT=6.5;
 G.audio?.radioChirp?.();
}
export function reload(G) {
 const A=G.action,w=WEAPONS[A.weapon];if(A.reloadT>0||A.ammo[A.weapon]===w.mag)return false;
 if(A.reserve&&A.reserve[A.weapon]!=null&&A.reserve[A.weapon]<=0)return false;
 A.reloadT=w.reload;G.audio?.reload?.();return true;
}
export function requestShot(G) {
 const A=G.action;if(!A)return WEAPONS[0];
 if(A.shotT>0||A.reloadT>0||A.dodgeT>0)return null;
 if(A.ammo[A.weapon]<=0){if(!reload(G)&&!(A.dryT>0)){A.dryT=.35;G.audio?.dryfire?.();if(!A.emptyNote){A.emptyNote=true;message(G,'HUNTER',WEAPONS[A.weapon].name+' is dry. Swap weapons or grab an ammo crate.','#edc67f');}}return null;}
 const w=WEAPONS[A.weapon];A.ammo[A.weapon]--;A.shotT=w.interval;
 if(!A.ammo[A.weapon])reload(G);
 return w;
}
export function servicePoints(G) {
 if(G.services)return G.services;
 const points=[['garage','HUNTER CUSTOMS','garage',0,0],['spray','MIDNIGHT RESPRAY','neural',130,70],['clinic','MERCY / SUPPLY','pd',-180,80]];
 G.services=points.map(([id,name,key,dx,dy])=>{const p=G.meta.spawns[key];const s=G.findSafeAction(p[0]+dx,p[1]+dy);return {id,name,x:s.x,y:s.y};});
 G.services.push({id:'circuit',name:'CROWN CIRCUIT / PADDOCK',...CIRCUIT.pit});
 return G.services;
}
export function nearService(G) {
 if(!G.action||G.race||G.jack)return null;
 if(G.player.type==='veh'&&Math.hypot(G.player.vx,G.player.vy)>35)return null;
 return servicePoints(G).find(s=>Math.hypot(s.x-G.player.x,s.y-G.player.y)<85)||null;
}
// Chips sink: five street-tune stages at rising prices, plus body armour.
export const MAX_TUNE=5,TUNE_COSTS=[500,800,1200,1700,2400],ARMOR_COST=400;
export const tuneCost=A=>TUNE_COSTS[Math.min(TUNE_COSTS.length-1,A?.upgrades||0)];
// Armour soaks 60% of incoming damage until it is spent.
export function absorbDamage(G,dmg){const A=G.action;if(!A||!(A.armor>0)||!(dmg>0))return dmg;const soak=Math.min(A.armor,dmg*.6);A.armor-=soak;return dmg-soak;}
// Cosmetic sink: a paint job changes the car's colour without touching heat.
export const PAINT_COST=300;
export function buyService(G,choice) {
 const A=G.action,P=G.player;
 if(choice==='recover')return recoverRiot(G);
 const offers={repair:{cost:120},tune:{cost:tuneCost(A)},supply:{cost:90},respray:{cost:250},armor:{cost:ARMOR_COST},paint:{cost:PAINT_COST}};
 const offer=offers[choice];if(!offer)return false;
 if(G.wanted>0&&!G.evading){message(G,'HUNTER','Break their line of sight first. I am a mechanic, not a magician.');return false;}
 if(['repair','tune','respray','paint'].includes(choice)&&(P.type!=='veh'||P.def.boat||P.def.aircraft)){message(G,'HUNTER','Bring a car or a bike into the workshop.');return false;}
 if(choice==='armor'&&(A.armor||0)>=100){message(G,'MERCY','Your vest is already fresh. Go get it scratched.');return false;}
 if(choice==='tune'&&A.upgrades>=MAX_TUNE){message(G,'HUNTER','Every street upgrade is fitted. Go make them regret it.');return false;}
 if(G.chips<offer.cost){message(G,'HUNTER','Not enough chips. Crew contracts pay.');return false;}
 G.chips-=offer.cost;
 if(choice==='repair'){P.health=100;P.burning=false;P.wrecked=false;P.burnT=0;}
 if(choice==='tune'){A.upgrades++;P.tune=A.upgrades;message(G,'HUNTER','Stage '+A.upgrades+' fitted: more torque, better brakes, sharper turn-in.');}
 if(choice==='respray'||choice==='repair')P.flat=false;
 if(choice==='respray'){G.wanted=0;G.seenT=0;G.cops.forEach(c=>{c.chasing=false;c.siren=false;c.ai=false;c.loose=true;c.keep=false;c.ambient=true;c.knocked=true;c.restT=0;});G.cops=[];P.paint=(P.paint||0)+1;}
 if(choice==='paint'){P.paint=((P.paint||0)+1+Math.floor(Math.random()*4))%6;A.paints=(A.paints||0)+1;message(G,'HUNTER','Fresh coat, same engine. Looks expensive, which is the point.');}
 if(choice==='armor'){A.armor=100;message(G,'MERCY','Plated vest fitted. It soaks most of a firefight, not a bus.');}
 if(choice==='supply'){G.health=100;A.ammo=WEAPONS.map(w=>w.mag);A.reserve=WEAPONS.map(w=>w.reserveMax);A.emptyNote=false;A.reloadT=0;A.stamina=100;}
 G.audio?.pickup?.();return true;
}
export const CONTRACTS=[
 {id:'courier',title:'NIGHT SHIFT',contact:'NEURAL',text:'Carry a sealed drive from Southside to the loft. 100 seconds after pickup. Stop at both markers; no wanted stars or gunfire at delivery.',reward:650,time:100},
 {id:'ghost',title:'GHOST DRIVER',contact:'MASK',text:'Lift a marked black box near Metro, then disappear. Reach the marker and lose two stars.',reward:850,time:150},
 {id:'drift',title:'SMOKE SIGNAL',contact:'FIRE',text:'Bank 1,200 drift points in a car. Keep the speed up. You have 90 seconds.',reward:700,time:90},
 ...STREET_JOBS, ...EXPANSION_JOBS,
];
const contractById=new Map(CONTRACTS.map(c=>[c.id,c]));
export const contractClockRunning=c=>!!c&&(!!c.stage||c.id!=='courier'&&!isExpansionJob(c.id));
export function startContract(G,id) {
 const A=G.action;if(A.contract)return false;
 const c=contractById.get(id);if(!c)return false;
 G.circuitSession=null;G.parcel=null;
 A.contract={id,t:c.time,progress:0,stage:0};
 message(G,c.contact,id==='courier'?"The drive is at Hunter's garage. Pick it up. The clock starts when you do.":id==='ghost'?'Black box is marked blue. Pick it up, then make the city forget you.':id==='drift'?'Show me a long slide, not an expensive crash.':c.text);
 if(id==='courier'){const at=G.meta.spawns.garage;G.waypoint={x:at[0],y:at[1]};}
 if(id==='ghost'){const at=G.meta.interactions.pd;G.waypoint={x:at[0],y:at[1]};}
 const target=streetJobTarget(G,A.contract);if(target)G.waypoint=target;
 G.gps=null;return true;
}
export function tickAction(G,dt,hooks) {
 const A=G.action,I=G.input,P=G.player;if(!A)return;
 A.shotT=Math.max(0,A.shotT-dt);A.dodgeCool=Math.max(0,A.dodgeCool-dt);A.bloom=Math.max(0,(A.bloom||0)-dt*.85);
 if(A.reloadT>0){A.reloadT=Math.max(0,A.reloadT-dt);if(A.reloadT===0){const w=WEAPONS[A.weapon],need=w.mag-A.ammo[A.weapon],res=A.reserve?.[A.weapon];const take=res==null?need:Math.min(need,res);A.ammo[A.weapon]+=take;if(res!=null)A.reserve[A.weapon]=res-take;G.audio?.cock?.();}}
 A.dryT=Math.max(0,(A.dryT||0)-dt);
 if(I.weaponP){A.weapon=(A.weapon+1)%WEAPONS.length;A.reloadT=0;G.audio?.cock?.();}
 if(I.reloadP)reload(G);
 if(I.crewP){G.scene='crew';G.menuSel=0;G.pausedFrom='play';return;}
 const running=P.type==='foot'&&Math.hypot(I.x,I.y)>.15&&I.sprint;
 A.stamina=clamp(A.stamina+dt*(running?-15:22),0,100);
 A.exhausted=A.stamina<5||A.exhausted&&A.stamina<28;
 A.cover=false;
 if(P.type==='foot'&&(P.speed||0)<35){for(const [x,y] of [[30,0],[-30,0],[0,30],[0,-30]])if(G.solidAt(P.x+x,P.y+y)){A.cover=true;break;}}
 if(I.dodgeP&&P.type==='foot'&&A.stamina>=24&&A.dodgeCool===0){
  A.stamina-=24;A.dodgeT=.48;A.dodgeCool=.9;A.dodgeBlocked=false;A.dodgeRot=Math.hypot(I.x,I.y)>.1?Math.atan2(I.x,I.y)+G.cam.rot:P.rot;
  G.audio?.dodge?.();
 }
 if(A.dodgeT>0&&P.type==='foot'){
  const phase=1-A.dodgeT/.48,velocity=120+240*Math.sin(Math.PI*phase),x=P.x,y=P.y;
  A.dodgeT=Math.max(0,A.dodgeT-dt);hooks.moveFoot(G,P,Math.sin(A.dodgeRot)*velocity*dt,-Math.cos(A.dodgeRot)*velocity*dt);P.rot=A.dodgeRot;
  const travelled=Math.hypot(P.x-x,P.y-y);P.dist=(P.dist||0)+travelled;P.speed=travelled/Math.max(.001,dt);
  if(travelled<velocity*dt*.15&&phase<.72){A.dodgeBlocked=true;A.dodgeT=Math.min(A.dodgeT,.12);}
 }
 A.messageT=Math.max(0,A.messageT-dt);
 if(A.messageT===0&&A.messages.length){const next=A.messages.shift();message(G,next.name,next.text,next.color);}
 if(A.contract){
  const c=A.contract,def=contractById.get(c.id);if(contractClockRunning(c))c.t=Math.max(0,c.t-dt);let done=false;
  if(c.id==='courier'){
    const a=G.meta.interactions.neural,start=G.meta.spawns.garage;
    const ready=(P.type==='foot'||!P.dead&&(P.health??100)>0&&!P.def.aircraft&&!P.def.boat)&&(P.type==='veh'?Math.hypot(P.vx||0,P.vy||0):P.speed||0)<10&&!G.input.fire;
    if(!c.stage&&ready&&Math.hypot(P.x-start[0],P.y-start[1])<85){c.stage=1;c.t=def.time;G.waypoint={x:a[0],y:a[1]};G.gps=null;message(G,'NEURAL','Drive collected. The clock is running. Bring it to the loft without heat.');}
    done=ready&&c.stage===1&&G.wanted===0&&Math.hypot(P.x-a[0],P.y-a[1])<85;
  }
  if(c.id==='ghost'){const a=G.meta.interactions.pd;if(!c.stage&&Math.hypot(P.x-a[0],P.y-a[1])<100){c.stage=1;G.wanted=Math.max(2,G.wanted);G.seenT=0;G.waypoint=null;G.gps=null;message(G,'MASK','Metro noticed. Find an alley. Do not lead them back to me.');}done=c.stage===1&&G.wanted===0;}
  if(c.id==='drift'&&P.type==='veh'&&!P.dead&&(P.health??100)>0&&!P.def.boat&&!P.def.aircraft&&!P.def.bike&&P.drifting){const score=Math.hypot(P.vx,P.vy)*dt*.65;c.progress+=score;A.combo+=score;A.comboT=1.2;done=c.progress>=1200;}
  if(c.id==='rescue'||c.id==='signal'||c.id==='harbour'||isExpansionJob(c.id))done=tickStreetJob(G,c,dt,message);
  if(c.t===0||c.failed)done=false;
  if(done){G.chips+=def.reward;A.reputation+=2;A.completed++;if(!A.completedJobs.includes(c.id))A.completedJobs.push(c.id);message(G,def.contact,'+'+def.reward+' chips. '+(EXPANSION_DEBRIEFS[c.id]||STREET_DEBRIEFS[c.id]||'Contract complete. Your name is travelling.'),'#f2c14e');G.audio?.pickup?.();A.contract=null;G.waypoint=null;G.gps=null;}
  else if(c.t===0||c.failed){message(G,def.contact,c.failed||'Contract missed. No penalty. Take another run when you are ready.');A.contract=null;G.waypoint=null;G.gps=null;}
 }
 A.comboT=Math.max(0,A.comboT-dt);if(!A.comboT)A.combo=0;

}
export function applyTune(G,v) {
 const level=G.action?.upgrades||0;if(v.def.boat||v.def.aircraft||v.tunedLevel===level)return;
 if(!level){if(v.stockDef)v.def=v.stockDef;v.tunedLevel=0;return;}
 if(!v.stockDef)v.stockDef=v.def;v.def={...v.stockDef,accel:v.stockDef.accel*(1+level*.1),brake:v.stockDef.brake*(1+level*.09),grip:Math.min(1.3,v.stockDef.grip+level*.04),max:v.stockDef.max*(1+Math.min(level,3)*.035+Math.max(0,level-3)*.02)};v.tunedLevel=level;
}

// Ammo crates and drops: refill spare rounds for one or all weapons.
export function addAmmo(G,index=null,amount=null){
 const A=G.action;if(!A)return 0;A.reserve=A.reserve||WEAPONS.map(w=>w.reserveMax==null?null:0);let got=0;
 WEAPONS.forEach((w,i)=>{if(w.reserveMax==null||index!=null&&i!==index)return;const add=amount??Math.ceil(w.mag*(w.rocket?1:2));const before=A.reserve[i];A.reserve[i]=Math.min(w.reserveMax,before+add);got+=A.reserve[i]-before;});
 if(got)A.emptyNote=false;return got;
}
