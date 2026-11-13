/* Optional evidence operations. Every checkpoint is serializable; frame samples
   are weakly owned by the active contract and never enter the save file. */
import {onRunway} from './aviation.js';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const finite=(n,d,a,b)=>Number.isFinite(n)?clamp(n,a,b):d;
const samples=new WeakMap();
export const OPERATIONS=[
 {id:'coldchain',title:'COLD STORAGE',contact:'VERA',text:'Carry an intact Palace recorder from Crown Air. Verify it at two street checkpoints, then deliver to Hunter. Crashes and long slides damage the recording.',reward:2400,time:600,stages:3},
 {id:'skytrace',title:'SKYLINE GHOST',contact:'NEURAL',text:'Fit a receiver at Crown Air. Scan three towers in a plane at 110–210 altitude and 32–60 knots. Land, lose the heat and deliver the recording on foot.',reward:3200,time:780,stages:5},
];
export const OPERATION_STEPS={
 coldchain:['Car: stop at Crown Air arrivals to load the recorder. The clock starts after loading.','Car: carry the recorder to Pinewatch Village. Stop for a three-second checksum.','Car: reach the Canal South checkpoint. Stop for a three-second checksum.','Car: return to Hunter Garage. Stop without heat to deliver the intact recording.'],
 skytrace:['On foot: collect Neural’s receiver at Crown Air. The clock starts after pickup.','Plane: scan Sierra. Stay inside the ring for three seconds with level wings.','Plane: scan Pinewatch. Stay inside the ring for three seconds with level wings.','Plane: scan MetaWin. Stay inside the ring for three seconds with level wings.','Land a plane on Crown Air’s runway. Stop at the east marker.','On foot: deliver Neural’s recording at Crown Air. Lose all wanted stars first.'],
};
export const OPERATION_DEBRIEFS={
 coldchain:'Two independent checksums. One intact recorder. Vera has the original eviction orders and Hunter has a witness who can identify the voice.',
 skytrace:'Three towers broadcast the same Palace order. Neural has the source, the relay and the casino receiver. Gold Mage cannot blame a broken radio this time.',
};
export const SKY_SCANS=Object.freeze([
 Object.freeze({x:10830,y:9220,name:'SIERRA',radius:450}),
 Object.freeze({x:11070,y:4500,name:'PINEWATCH',radius:450}),
 Object.freeze({x:8240,y:3220,name:'METAWIN',radius:450}),
]);
const cargoRoute=[{x:8252,y:8668},{x:11950,y:4870},{x:6320,y:6360}];
const receiver={x:9840,y:7780};
export const isOperation=id=>id==='coldchain'||id==='skytrace';
export function operationTarget(G,c){
 if(c.id==='coldchain')return c.stage===3?{x:G.meta.spawns.garage[0],y:G.meta.spawns.garage[1]}:cargoRoute[Math.min(2,c.stage||0)];
 if(c.id==='skytrace')return c.stage===0||c.stage===5?receiver:c.stage===4?{x:9600,y:7500}:SKY_SCANS[c.stage-1];
 return null;
}
export function restoreOperationState(saved){
 if(!isOperation(saved?.id))return {};
 return {integrity:finite(saved.integrity,100,0,100),warnings:Math.floor(finite(saved.warnings,0,0,3))};
}
export function operationStatus(G,c){
 if(c?.id==='coldchain')return c.stage?'RECORDER '+Math.ceil(c.integrity??100)+'% / '+Math.min(2,c.stage-1)+'/2 CHECKSUMS':'LOAD AT ARRIVALS';
 if(c?.id==='skytrace'&&c.stage>0&&c.stage<4){const p=G.player;return 'ALT '+Math.round((p.altitude||0)/5)*5+' [110–210] / KTS '+Math.round(Math.hypot(p.vx||0,p.vy||0)*.1944)+' [32–60] / SCAN '+Math.min(100,Math.floor((c.progress||0)/3*20)*5)+'%';}
 return '';
}
export function operationHint(G,c){
 if(!isOperation(c?.id))return '';
 return OPERATION_STEPS[c.id][c.stage];
}
function advance(G,c,notify){
 c.stage++;c.progress=0;G.waypoint=operationTarget(G,c);G.gps=null;
 notify(G,c.id==='coldchain'?'VERA':'NEURAL',OPERATION_STEPS[c.id][c.stage]);
 G.audio?.pickup?.();
}
function cargoDamage(G,c,dt,notify){
 const p=G.player;let sample=samples.get(c);
 if(!sample){sample={vehicle:p,health:p.health??100,recovery:G.recoverySerial||0};samples.set(c,sample);}
 if(sample.recovery!==(G.recoverySerial||0)){
  sample.recovery=G.recoverySerial||0;c.progress=0;sample.vehicle=null;
  notify(G,'VERA','The last checksum is safe. Find a sound car and finish the marked leg. The recorder has not repaired itself.');
 }
 // Read the previous carrier even after a crash forcibly ejects Chaos.
 // Otherwise abandoning a wreck between frames could preserve its cargo.
 if(sample.vehicle?.type==='veh'){
  c.integrity=clamp((c.integrity??100)-Math.max(0,sample.health-(sample.vehicle.health??100))*1.35,0,100);
  if(sample.vehicle.dead||(sample.vehicle.health??100)<=0)c.integrity=0;
 }
 if(p.type==='veh'){
  // A prolonged powered slide shakes the recorder. Ordinary fast driving,
  // acceleration and braking are safe; the player can choose a better route.
  if(p.drifting&&Math.hypot(p.vx||0,p.vy||0)>90)c.integrity=clamp((c.integrity??100)-dt*3,0,100);
  if(p.dead||(p.health??100)<=0)c.integrity=0;
 }
 sample.vehicle=p;sample.health=p.health??100;
 const band=c.integrity<=25?3:c.integrity<=50?2:c.integrity<=75?1:0;
 if(band>(c.warnings||0)&&c.integrity>0){c.warnings=band;notify(G,'VERA','Recorder integrity '+Math.ceil(c.integrity)+'%. Avoid crashes and long drifts. Repairs fix the car, not the evidence.');}
 if(c.integrity<=0){c.failed='The recorder was destroyed. Take COLD STORAGE again in CREW; a fresh case is waiting at arrivals.';return false;}
 return true;
}
export function tickOperation(G,c,dt,notify){
 if(!isOperation(c.id))return false;
 const p=G.player,target=operationTarget(G,c),speed=p.type==='veh'?Math.hypot(p.vx||0,p.vy||0):p.speed||0;
 const dist=Math.hypot(p.x-target.x,p.y-target.y),quiet=G.wanted===0&&!G.input.fire;
 let valid=false,hold=3;
 if(c.id==='coldchain'){
  if(c.stage&& !cargoDamage(G,c,dt,notify))return false;
  const car=p.type==='veh'&&!p.def.boat&&!p.def.aircraft&&!p.def.bike&&!p.dead&&(p.health??100)>0;
  valid=car&&dist<90&&speed<9&&quiet;
  if(c.stage===0&&valid){c.integrity=100;c.warnings=0;}
 }else if(c.stage===0||c.stage===5){valid=p.type==='foot'&&dist<65&&speed<8&&quiet;hold=2;}
 else if(c.stage===4){valid=p.kind==='plane'&&!p.dead&&(p.altitude||0)<3&&speed<10&&onRunway(G,p)&&dist<260;hold=2;}
 else{
  valid=p.kind==='plane'&&!p.dead&&!p.stall&&p.altitude>=110&&p.altitude<=210&&speed>=165&&speed<=310&&Math.abs(p.lean||0)<.18&&dist<target.radius&&!G.input.fire;
 }
 // A scan is continuous, not banked by repeatedly dipping through the zone.
 c.progress=valid?(c.progress||0)+dt:0;
 if(c.progress<hold)return false;
 const final=c.id==='coldchain'?3:5;if(c.stage===final)return true;
 advance(G,c,notify);
 if(c.id==='coldchain'&&c.stage===1)samples.set(c,{vehicle:p,health:p.health??100,recovery:G.recoverySerial||0});
 if(c.id==='skytrace'&&c.stage===4){G.wanted=Math.max(2,G.wanted);G.seenT=0;notify(G,'NEURAL','MetaWin noticed the intercept. Recordings secured. Bring the plane home, then lose Metro before the handoff.');}
 return false;
}
export function drawOperationMarkers(G,r){
 const job=G.action?.contract;if(!isOperation(job?.id))return;
 const at=operationTarget(G,job),c=G.ctx,scan=job.id==='skytrace'&&job.stage>0&&job.stage<4,rad=scan?at.radius:54;
 if(at.x<r.x0-rad||at.x>r.x1+rad||at.y<r.y0-rad||at.y>r.y1+rad)return;
 c.save();c.strokeStyle='#83d8d1';c.lineWidth=scan?4:2;c.setLineDash(scan?[24,16]:[8,6]);c.beginPath();c.arc(at.x,at.y,rad,0,Math.PI*2);c.stroke();c.setLineDash([]);
 if(scan){
  c.strokeStyle='#eac778';c.lineWidth=6;c.beginPath();c.arc(at.x,at.y,rad,-Math.PI/2,-Math.PI/2+Math.PI*2*Math.min(1,(job.progress||0)/3));c.stroke();
  c.font='700 16px system-ui';c.textAlign='center';c.fillStyle='#eee1b4';c.fillText(at.name+' / SCAN 110–210',at.x,at.y-rad*.6-24);c.font='700 12px system-ui';c.fillText('32–60 KTS / LEVEL WINGS',at.x,at.y-rad*.6-5);
 }else{
  // A grounded field case gives the handoff a readable physical prop.
  c.fillStyle='#1a2b32';c.fillRect(at.x-13,at.y-11,26,20);c.strokeStyle='#b5d8ce';c.lineWidth=2;c.strokeRect(at.x-13,at.y-11,26,20);c.fillStyle='#d1af6f';c.fillRect(at.x-3,at.y-11,6,20);
 }
 c.restore();
}
