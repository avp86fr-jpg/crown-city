/* Ground coordinates and altitude are separate: the same aircraft exists on the
   apron, in flight, in a save, and in the collision/render passes. */
import {vehicleCondition,drawVehicleDamage} from './vehicle_dynamics.js';
import { WORLD_W, WORLD_H } from './world.js';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const num=(v,d,a=-Infinity,b=Infinity)=>Number.isFinite(v)?clamp(v,a,b):d;
const angle=a=>Math.atan2(Math.sin(a),Math.cos(a));
const LAND_SURFACES=new Set(['grass','sand','dirt','lot','track']);
export const AIRCRAFT_DEFS={
 heli:{name:'Crown Sparrow',kind:'helicopter',sprite:'heli',aircraft:true,helicopter:true,accel:110,max:310,steer:1.7,brake:150,grip:.8,mass:2.2,r:38},
 plane:{name:'Crown Skylark',kind:'airplane',sprite:'plane',aircraft:true,airplane:true,accel:105,max:540,steer:.75,brake:130,grip:.8,mass:3.8,r:52},
};
export const airborne=v=>!!v?.def?.aircraft&&(v.altitude||0)>10;
const runway=G=>G.world?.expansion?.airport?.runway||G.world?.features?.find(f=>f.k==='runway')||{x:6620,y:7420,w:3300,h:160};
export function onRunway(G,v,margin=24){const r=runway(G);return v.x>r.x+margin&&v.x<r.x+r.w-margin&&v.y>r.y+margin&&v.y<r.y+r.h-margin;}
export function landingZone(G,v){
 if(v.def.airplane)return onRunway(G,v)&&Math.abs(Math.cos(v.rot))<.35?'RUNWAY':null;
 const pad=G.world?.expansion?.helipads?.find(p=>Math.hypot(v.x-p.x,v.y-p.y)<(p.r||90)-20);
 if(pad)return pad.name||'HELIPAD';
 if(onRunway(G,v))return 'AIRFIELD';
 // Helicopters may set down in a genuine clearing, with clearance for the rotor.
 for(let i=0;i<9;i++){const a=i*Math.PI/4,r=i===8?0:55;if(!LAND_SURFACES.has(G.surfaceAt(v.x+Math.cos(a)*r,v.y+Math.sin(a)*r)))return null;}
 return 'CLEARING';
}
export function canExitAircraft(v){return !v.def?.aircraft||((v.altitude||0)<=1&&Math.hypot(v.vx||0,v.vy||0)<12);}
export function aircraftSnapshot(v){return v?.def?.aircraft?{id:v.aircraftId,altitude:v.altitude||0,verticalSpeed:v.verticalSpeed||0,airspeed:v.airspeed||0,vx:v.vx,vy:v.vy,landing:!!v.landing,rotor:v.rotor||0,approachDirection:v.approachDirection||0,autoBrake:!!v.autoBrake}:null;}
export function restoreAircraft(v,s={}){
 v.altitude=num(s?.altitude,0,0,420);v.verticalSpeed=num(s?.verticalSpeed,0,-85,65);
 v.airspeed=num(s?.airspeed,0,0,v.def.max);v.vx=num(s?.vx,0,-v.def.max,v.def.max);v.vy=num(s?.vy,0,-v.def.max,v.def.max);
 v.landing=s?.landing===true;v.rotor=num(s?.rotor,0,0,1);v.aircraftId=typeof s?.id==='string'?s.id:v.aircraftId;
 v.approachDirection=s?.approachDirection===-1?-1:s?.approachDirection===1?1:0;v.autoBrake=s?.autoBrake===true;
 v.flightState=v.altitude>1?'CRUISE':'PARKED';v.stall=false;
}
export function spawnAircraft(G,makeVeh){
 const pads=G.world?.expansion?.helipads||[{id:'airport',name:'AIRFIELD HELIPORT',x:7000,y:7790,r:95}];
 const spawns=G.world?.expansion?.aircraft||[
  ...pads.map(p=>({id:'heli-'+p.id,kind:'heli',x:p.x,y:p.y,rot:0})),
  {id:'runway-skylark',kind:'plane',x:6840,y:7500,rot:Math.PI/2},
 ];
 for(const s of spawns){if(!AIRCRAFT_DEFS[s.kind]||G.vehicles.some(v=>v.aircraftId===s.id&&!v.dead))continue;
  G.vehicles=G.vehicles.filter(v=>!(v.dead&&v.aircraftId===s.id));
  const v=makeVeh(s.kind,s.x,s.y,s.rot||0,{keep:true,aircraftId:s.id,home:{x:s.x,y:s.y,rot:s.rot||0}});restoreAircraft(v);G.vehicles.push(v);
 }
}
// A static building index makes aerial clearance independent of city size.
const obstacleIndices=new WeakMap();
export function obstacleHeight(G,x,y,r=30){
 const world=G.world;if(!world)return G.solidAt?.(x,y)?100:0;
 let index=obstacleIndices.get(world);
 if(!index){index=new Map();for(const b of [...(world.buildings||[]),...(world.coreBuildings||[]),...(world.expansion?.obstacles||[])]){
  for(let ix=Math.floor(b.x/512);ix<=Math.floor((b.x+b.w)/512);ix++)for(let iy=Math.floor(b.y/512);iy<=Math.floor((b.y+b.h)/512);iy++){
   const key=ix+':'+iy;if(!index.has(key))index.set(key,[]);index.get(key).push(b);
  }
 }obstacleIndices.set(world,index);}
 let height=0;
 for(let ix=Math.floor((x-r)/512);ix<=Math.floor((x+r)/512);ix++)for(let iy=Math.floor((y-r)/512);iy<=Math.floor((y+r)/512);iy++)for(const b of index.get(ix+':'+iy)||[]){
  if(x+r>b.x&&x-r<b.x+b.w&&y+r>b.y&&y-r<b.y+b.h)height=Math.max(height,b.hgt||b.height||65);
 }
 if(!height&&G.solidAt?.(x,y))height=75;
 return height;
}
const PLANE_PROBES=[[0,0,17],[-36,7,30],[36,7,30],[-77,7,14],[77,7,14],[0,-55,15],[0,48,19]];
const HELI_PROBES=[[0,0,45],[-48,-2,15],[48,-2,15],[0,-48,15],[0,59,17]];
export function aircraftClearance(G,v,x=v.x,y=v.y){
 const co=Math.cos(v.rot),si=Math.sin(v.rot);let height=0;
 for(const [px,py,r] of v.def.helicopter?HELI_PROBES:PLANE_PROBES)height=Math.max(height,obstacleHeight(G,x+px*co-py*si,y+px*si+py*co,r));
 return height;
}
export function tickAircraft(G,v,I,dt,hooks={}){
 if(v.dead)return;
 dt=clamp(dt,0,.1);v.groundLock=Math.max(0,(v.groundLock||0)-dt);v.prevX=v.x;v.prevY=v.y;v.altitude=num(v.altitude,0,0,420);
 const condition=vehicleCondition(v);
 const helicopter=v.def.helicopter,up=!!(I.boost||I.sprint),down=!!(I.brake||I.hand),throttle=clamp(I.y||0,-1,1);
 let steer=clamp(I.x||0,-1,1);
 const notice=s=>{if(v.notice!==s||(G.ticks||0)>(v.noticeAt||0)+180){hooks.notice?.(s);v.notice=s;v.noticeAt=G.ticks||0;}};
 if(I.enterP&&!canExitAircraft(v)){v.landing=!v.landing;v.approachDirection=Math.sin(v.rot)>=0?1:-1;notice(v.landing?helicopter?'Landing approach. Hold over a clear helipad.':'Runway assist armed. Fly alongside the runway; release steering to align.':'Landing cancelled.');}
 if(up){v.landing=false;v.autoBrake=false;}
 v.rotor=clamp((v.rotor||0)+dt*((v===G.player||v.driver==='player')?.8:-.35),0,1);
 const oldAltitude=v.altitude,oldX=v.x,oldY=v.y,oldRot=v.rot;
 let speed=Math.hypot(v.vx||0,v.vy||0),vertical=0;
 if(helicopter){
  v.yaw=(v.yaw||0)+(steer*1.7-(v.yaw||0))*(1-Math.exp(-7*dt));v.rot=angle(v.rot+v.yaw*dt);v.lean=(v.lean||0)+(steer*.15-(v.lean||0))*(1-Math.exp(-5*dt));
  const moving=throttle>0.08, target=moving?throttle*v.def.max*condition.top:throttle*75;
  // Release the stick to hold a stable hover; horizontal flight requires lift first.
  const fly=v.altitude>8,blend=1-Math.exp(-(moving?1.25:3.1)*dt);
  v.vx=(v.vx||0)+(Math.sin(v.rot)*(fly?target:0)-(v.vx||0))*blend;
  v.vy=(v.vy||0)+(-Math.cos(v.rot)*(fly?target:0)-(v.vy||0))*blend;
  vertical=up?56:down||v.landing?-36:0;
  if(v.altitude<65&&moving&&!down&&!v.landing)vertical=38;
  if(v.landing){v.vx*=Math.exp(-3*dt);v.vy*=Math.exp(-3*dt);}
 }else{
  speed=num(v.airspeed,speed,0,v.def.max);
  const ground=v.altitude===0;
  if(ground&&throttle>.15&&!v.groundLock)v.autoBrake=false;
  if(v.landing&&!ground){
   const r=runway(G),dir=v.approachDirection||(Math.sin(v.rot)>=0?1:-1),center=r.y+r.h/2;
   const along=dir>0?v.x-r.x:r.x+r.w-v.x,remaining=r.w-along;
   v.runwayRemaining=Math.max(0,remaining);
   // Localizer assistance only near the runway; the pilot retains steering.
   const close=along>-1000&&along<r.w+200&&Math.abs(v.y-center)<500;
   v.runwayAligned=onRunway(G,v)&&Math.abs(Math.cos(v.rot))<.2;
   if(close&&Math.abs(steer)<.12){const desired=dir*Math.PI/2-dir*Math.atan2(v.y-center,520);steer=clamp(angle(desired-v.rot)*2.6,-1,1);}
   if(remaining<Math.max(180,v.altitude*4)&&along>0){v.landing=false;notice('Go around — too little runway. Climb and approach the opposite end.');}
  }
  if(!ground&&(down||v.landing)&&throttle>=0){
   // Approach power holds a flyable speed while the pilot aligns the runway.
   speed+=clamp(210-speed,-60,60)*dt;
  }else if(!ground&&I.touchFlight&&throttle===0&&!up){speed+=clamp(240-speed,-25,25)*dt;}
  else speed+=((throttle>0?throttle*105*condition.power:ground?-23:-8)-((down||v.autoBrake)&&ground?150:0)-(throttle<0?-throttle*120:0))*dt;
  speed=clamp(speed,0,v.def.max*condition.top);v.airspeed=speed;
  const yaw=steer*(ground?1.15:.74)*clamp(speed/120,.1,1);v.yaw=(v.yaw||0)+(yaw-(v.yaw||0))*(1-Math.exp(-(ground?9:5)*dt));v.rot=angle(v.rot+v.yaw*dt);v.lean=(v.lean||0)+(steer*.25-(v.lean||0))*(1-Math.exp(-5*dt));
  v.vx=Math.sin(v.rot)*speed;v.vy=-Math.cos(v.rot)*speed;
  v.stall=!ground&&speed<155;
  if(ground&&throttle>0&&!v.groundLock&&speed>=185&&onRunway(G,v)&&Math.abs(Math.cos(v.rot))<.35&&!down){vertical=38;v.altitude=1.1;}
  else if(!ground){vertical=v.stall?-Math.max(24,(155-speed)*.65):down?-26:v.landing?(v.runwayAligned?-Math.min(40,Math.max(22,v.altitude*speed/Math.max(300,v.runwayRemaining-250))):v.altitude<95?28:0):up?48:v.altitude<155?30:0;}
  if(v.stall)notice('STALL — add throttle; regain 155 airspeed.');
  if(ground&&speed>170&&!onRunway(G,v))notice('Takeoff needs the marked runway.');
 }
 v.verticalSpeed=vertical;v.altitude=clamp(v.altitude+vertical*dt,0,420);
 const edge=helicopter?80:105;let nx=clamp(v.x+v.vx*dt,edge,WORLD_W-edge),ny=clamp(v.y+v.vy*dt,edge,WORLD_H-edge);
 const steps=Math.max(1,Math.ceil(Math.hypot(nx-oldX,ny-oldY)/18));let height=0;
 for(let i=1;i<=steps;i++){const q=i/steps,h=aircraftClearance(G,v,oldX+(nx-oldX)*q,oldY+(ny-oldY)*q);if(h&&oldAltitude+(v.altitude-oldAltitude)*q<h+18){height=h;break;}}
 if(height){
  v.vx*= -.12;v.vy*= -.12;v.airspeed=0;v.yaw=0;v.rot=oldRot;nx=oldX;ny=oldY;
  if(oldAltitude>=height+18)v.altitude=oldAltitude;
  if(!(v.airImpactT>0)){hooks.damage?.(v,Math.max(8,speed/7));v.airImpactT=.8;notice('Obstacle ahead — gain altitude before crossing rooftops.');}
 }
 v.airImpactT=Math.max(0,(v.airImpactT||0)-dt);v.x=nx;v.y=ny;
 const zone=vertical<0&&v.altitude<12?landingZone(G,v):null,nowSpeed=Math.hypot(v.vx,v.vy);
 if(vertical<0&&v.altitude<12&&oldAltitude>0){
  const safe=zone&&(helicopter?nowSpeed<45:nowSpeed>=115&&nowSpeed<270&&!v.stall);
  if(safe){
   if(v.altitude<=.8){v.altitude=0;v.verticalSpeed=0;v.landing=false;v.groundLock=2;v.autoBrake=!helicopter;v.flightState='LANDED';if(helicopter){v.vx=v.vy=0;}notice('Touchdown — '+zone+'. Stop, then exit.');}
  }else if(!v.stall){v.altitude=Math.max(12,oldAltitude);v.verticalSpeed=0;notice(helicopter?'Hold a hover over a helipad or open clearing to land.':'Align with the runway at 115–270 airspeed to land.');}
  else if(v.altitude===0){hooks.damage?.(v,110);notice('Hard landing.');}
 }
 // Grounded aircraft cannot taxi into water; rotor lift clears banks once airborne.
 if(v.altitude<=1&&['water','canal','build'].includes(G.surfaceAt(v.x,v.y))){v.x=oldX;v.y=oldY;v.vx=v.vy=v.airspeed=0;}
 v.flightState=v.altitude<=1?(nowSpeed>8?'TAXI':'PARKED'):v.stall?'STALL':v.landing||down?'APPROACH':vertical>1?'CLIMB':helicopter&&nowSpeed<15?'HOVER':'CRUISE';
 v.airspeed=helicopter?Math.hypot(v.vx,v.vy):v.airspeed;v.parked=false;
 return {exit:I.enterP&&canExitAircraft(v)&&oldAltitude<=1};
}
export function aviationHint(G){
 const v=G.player;if(!v?.def?.aircraft)return '';
 const controls=G.touch?(v.def.airplane?'Stick: throttle / turn · UP: climb · DOWN: descend · LAND: runway assist':'Stick: fly · UP: climb · DOWN: descend · LAND'):(v.def.airplane?'W/S: throttle · A/D: turn · SHIFT: climb · SPACE: descend · E: runway assist':'W/S: throttle · A/D: turn · SHIFT: climb · SPACE: descend · E: land');
 return `${v.def.name.toUpperCase()} / ${v.flightState||'PARKED'} · ALT ${Math.round(v.altitude||0)} · SPD ${Math.round(v.airspeed||0)}\n${controls}`;
}
export function drawAircraft(G,v){
 const c=G.ctx,heli=v.def.helicopter,z=v.altitude||0,t=G.ticks/60;
 c.save();c.translate(v.x+z*.12,v.y+z*.08);c.rotate(v.rot);c.globalAlpha=clamp(.3-z/1800,.08,.3);c.fillStyle='#08151d';
 c.beginPath();c.ellipse(0,0,heli?40:82,heli?57:70,0,0,Math.PI*2);c.fill();c.restore();
 c.save();c.translate(v.x,v.y-z*.22);c.rotate(v.rot);const scale=1+z/1800;c.scale(scale,scale);
 const path=(points,fill,stroke='#13252c',width=2)=>{c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fillStyle=fill;c.fill();c.strokeStyle=stroke;c.lineWidth=width;c.stroke();};
 const hull=c.createLinearGradient(-22,0,22,0);hull.addColorStop(0,v.dead?'#354046':'#254958');hull.addColorStop(.45,v.dead?'#566166':'#e5e8da');hull.addColorStop(.65,v.dead?'#30383c':'#fff9dc');hull.addColorStop(1,v.dead?'#202c31':'#829d9b');
 if(heli){
  // Skids, tail boom, horizontal stabilizers, then the glazed cabin.
  c.strokeStyle='#172e38';c.lineWidth=5;for(const x of [-25,25]){c.beginPath();c.moveTo(x,-30);c.lineTo(x,32);c.stroke();}c.lineWidth=3;c.beginPath();c.moveTo(-25,-10);c.lineTo(25,-10);c.moveTo(-25,22);c.lineTo(25,22);c.stroke();
  path([[-6,18],[-4,77],[5,77],[8,18]],hull);path([[-23,58],[24,58],[21,65],[-21,65]],'#dfb663');
  path([[0,-47],[-15,-37],[-20,-12],[-16,23],[0,32],[16,23],[20,-12],[15,-37]],hull);
  path([[-13,-30],[-3,-40],[-3,-13],[-15,-13]],'#285369');path([[3,-40],[13,-30],[15,-13],[3,-13]],'#5c8c9a');
  c.strokeStyle='#d7ecda';c.lineWidth=1;c.beginPath();c.moveTo(-12,-29);c.lineTo(-5,-34);c.moveTo(6,-33);c.lineTo(11,-27);c.stroke();
  path([[-17,-4],[-7,-4],[-7,15],[-15,13]],'#315969');path([[7,-4],[17,-4],[15,13],[7,15]],'#416c7a');
  c.fillStyle='#d5ac57';c.fillRect(-17,19,34,4);c.fillStyle='#eef5de';c.font='bold 6px sans-serif';c.textAlign='center';c.fillText('CROWN',0,28);
  c.save();c.translate(0,72);c.rotate(t*(v.dead?0:34));c.fillStyle='#1e3540';c.fillRect(-15,-2,30,4);c.fillRect(-2,-15,4,30);c.restore();
  const spin=v.dead?0:t*(v.rotor||0)*35;c.save();c.translate(0,-2);c.rotate(spin);c.fillStyle='#233a41';for(let i=0;i<4;i++){c.rotate(Math.PI/2);path([[5,-3],[66,-5],[68,1],[7,4]],'#263c44','#152832',1);c.fillStyle='#d6bd6c';c.fillRect(57,-4,10,4);}c.restore();
  if(v.rotor>.5&&!G.settings?.reducedMotion){c.globalAlpha=.14;c.strokeStyle='#ccd5c4';c.lineWidth=8;c.beginPath();c.ellipse(0,-2,64,64,0,0,Math.PI*2);c.stroke();c.globalAlpha=1;}
  c.fillStyle='#c4aa66';c.beginPath();c.arc(0,-2,6,0,Math.PI*2);c.fill();
 }else{
  path([[-8,23],[-37,48],[-35,57],[0,46],[35,57],[37,48],[8,23]],hull);
  path([[-10,-21],[-88,0],[-88,16],[-12,7],[12,7],[88,16],[88,0],[10,-21]],hull);
  path([[-77,2],[-34,-9],[-34,-3],[-77,8]],'#c79845');path([[34,-9],[77,2],[77,8],[34,-3]],'#c79845');
  path([[0,-69],[-11,-47],[-14,-5],[-9,38],[0,65],[9,38],[14,-5],[11,-47]],hull);
  path([[-8,-44],[0,-52],[8,-44],[9,-22],[-9,-22]],'#346275');c.strokeStyle='#a9d6ce';c.lineWidth=2;c.beginPath();c.moveTo(0,-48);c.lineTo(0,-25);c.stroke();
  for(const x of [-33,33]){path([[x-6,-31],[x+6,-31],[x+7,0],[x-7,0]],hull);c.save();c.translate(x,-32);c.rotate(t*(v.dead||v!==G.player&&!(v.airspeed>8)?0:70));c.fillStyle='#263640';c.fillRect(-14,-2,28,4);c.restore();}
  c.fillStyle='#cda64f';c.fillRect(-8,30,16,5);c.fillStyle='#203b4b';c.font='bold 7px sans-serif';c.textAlign='center';c.fillText('CW',0,18);
  path([[0,25],[-3,60],[3,60]],'#264c60');
 }
 drawVehicleDamage(c,v);
 c.fillStyle='#e45d62';c.beginPath();c.arc(heli?-22:-87,heli?4:10,2.5,0,Math.PI*2);c.fill();c.fillStyle='#84f2c4';c.beginPath();c.arc(heli?22:87,heli?4:10,2.5,0,Math.PI*2);c.fill();c.restore();
}
