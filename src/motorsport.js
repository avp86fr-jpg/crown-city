import {racePace} from './circuit_rules.js';
import {CIRCUIT,TRACK_LENGTH,trackPoint,nearestTrack,inCircuit,inPitLane} from './circuit_world.js';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),angle=a=>Math.atan2(Math.sin(a),Math.cos(a));
export function pitDriveInput(v,input){
 if(v.def.boat||v.def.aircraft||!inPitLane(v.x,v.y))return input;
 const speed=Math.hypot(v.vx,v.vy),limited={...input,boost:false,sprint:false};
 if(speed>40/.36){limited.y=Math.min(0,input.y);limited.brake=true;}
 else if(speed>37/.36)limited.y=Math.min(.15,input.y);
 return limited;
}
const storyMeeting=G=>!G.freeRoam&&G._flow?.objectives[G.objectiveIndex]?.id==='to_track';
export const nearCircuit=G=>!G.race&&!storyMeeting(G)&&(!G.action?.contract||G.action.contract.id==='circuit')&&!G.wanted&&!G.circuitSession?.running&&Math.hypot(G.player.x-CIRCUIT.pit.x,G.player.y-CIRCUIT.pit.y)<110&&Math.hypot(G.player.vx||0,G.player.vy||0)<12;
export function circuitPilot(G,v,dt){
 const n=nearestTrack(v.x,v.y),speed=Math.hypot(v.vx,v.vy),look=clamp(70+speed*.44,70,170),target=trackPoint(n.s+look);
 let offset=(v.racerIndex%2?1:-1)*28,limit=195+(v.racerIndex%3)*10;
 const bend=Math.abs(angle(trackPoint(n.s+look+90).rot-n.rot));limit=Math.min(limit,80+130/(1+bend*4));
 let blocked=false;
 for(const o of G.vehicles){if(o===v||o.dead||o.def.aircraft||Math.abs(o.x-v.x)>270||Math.abs(o.y-v.y)>270)continue;const dx=o.x-v.x,dy=o.y-v.y,front=dx*Math.sin(v.rot)-dy*Math.cos(v.rot),side=dx*Math.cos(v.rot)+dy*Math.sin(v.rot);if(front>0&&front<75+speed*.6&&Math.abs(side-offset)<45){blocked=true;offset=side>=0?-27:27;limit=Math.min(limit,Math.max(0,(front-65)*1.25));}}
 const p=G.player;if(p.type==='foot'){const dx=p.x-v.x,dy=p.y-v.y,front=dx*Math.sin(v.rot)-dy*Math.cos(v.rot);if(front>0&&front<90+speed*.7&&Math.abs(dx*Math.cos(v.rot)+dy*Math.sin(v.rot))<55){limit=0;blocked=true;}}
 const tx=target.x+Math.cos(target.rot)*offset,ty=target.y+Math.sin(target.rot)*offset,error=angle(Math.atan2(tx-v.x,-(ty-v.y))-v.rot);
 limit*=v.raceRival?(v.racePace||.84):racePace(G).speed;
 if(n.d>CIRCUIT.half-8)limit=Math.min(limit,75);if(Math.abs(error)>1)limit=Math.min(limit,55);
 v.racerWait=speed<5&&blocked?(v.racerWait||0)+dt:0;
 // A blocked driver waits; neither the parked car nor the racer is teleported.
 return {x:clamp(error*2.5-(v.yaw||0)*.22,-1,1),y:speed<limit?clamp((limit-speed)/35,0,1):0,brake:speed>limit+7};
}
export function tickCircuit(G,dt,hooks){
 const nearby=inCircuit(G.player.x,G.player.y,650);
 if(!nearby&&G.circuitSleeping&&!G.circuitSession?.running)return;
 const cars=G.vehicles.filter(v=>v.circuitRacer);G.circuitSleeping=!nearby;
 if(nearby&&cars.length<5){
  for(let i=0;i<5;i++){if(cars.some(v=>v.racerIndex===i))continue;const p=trackPoint(800+i*TRACK_LENGTH/5);if(G.vehicles.some(v=>Math.hypot(v.x-p.x,v.y-p.y)<130))continue;G.vehicles.push(G.makeVeh(i%2?'dart':'nyx',p.x,p.y,p.rot,{ai:true,circuitRacer:true,racerIndex:i,parked:false,keep:true}));}
 }
 for(const v of cars){if(v===G.player)continue;if(!nearby){v.vx=v.vy=0;continue;}if(v.dead||v.health<=0){v.ai=false;v.vx=v.vy=0;continue;}v.ai=true;hooks.tickDrive(G,v,circuitPilot(G,v,dt),dt,false);}
 const s=G.circuitSession;if(!s?.running)return;
 const P=G.player;
 if(P!==s.car||!inCircuit(P.x,P.y,20)||P.dead||P.health<=0){finishTrial(G,'RUN ENDED / RETURN TO PITS',false);return;}
 if(s.countdown>0){const previous=Math.ceil(s.countdown);s.countdown=Math.max(0,s.countdown-dt);if(Math.ceil(s.countdown)!==previous)G.audio?.race?.(s.countdown===0?'go':'count');P.vx=P.vy=0;return;}
 s.time+=dt;
 const n=nearestTrack(P.x,P.y),delta=angle((n.s-s.lastS)/TRACK_LENGTH*Math.PI*2)*TRACK_LENGTH/(Math.PI*2);
 if(n.d>CIRCUIT.half+8)s.off+=dt;else s.off=Math.max(0,s.off-dt*.5);
 if(s.off>(s.grace??.9)||Math.abs(delta)>Math.max(45,Math.hypot(P.vx,P.vy)*dt+30))s.valid=false;
 s.lastS=n.s;
 // Sequential projected progress prevents reverse laps, teleporting and skipped sectors.
 s.distance+=clamp(delta,-40,40);
 if(s.distance>=s.gate*TRACK_LENGTH/8&&s.gate<8){s.gate++;G.waypoint=trackPoint(s.gate*TRACK_LENGTH/8);G.gps=null;G.audio?.race?.('sector');}
 if(s.distance>=TRACK_LENGTH-10&&s.gate===8){
  const valid=s.valid&&s.time>15;
  if(valid){G.action.circuitLaps=(G.action.circuitLaps||0)+1;G.action.circuitBest=Math.min(G.action.circuitBest||Infinity,s.time);G.action.circuitRecords[s.pace]=G.action.circuitBest;}
  finishTrial(G,valid?'CLEAN LAP / '+s.time.toFixed(2)+'s':'LAP INVALID / KEEP ALL WHEELS ON TRACK',valid);hooks.save(G,true);
 }
 if(s.time>240)finishTrial(G,'SESSION ENDED / RETURN TO PITS',false);
}
function finishTrial(G,text,valid){const s=G.circuitSession;s.running=false;s.result=text;s.valid=valid;s.resultT=12;G.audio?.race?.(valid?'finish':'invalid');G.waypoint=CIRCUIT.pit;G.gps=null;G.action.message={name:'RACE CONTROL',text:text+'. '+(valid?'Personal best '+G.action.circuitBest.toFixed(2)+'s.':'Use the pit desk to try again.'),color:'#c7d9dc'};G.action.messageT=8;}
export function startCircuit(G,hooks){
 if(!nearCircuit(G)||G.race||G.jack)return false;
 const p=trackPoint(0),old=G.player;
 let car=old.type==='veh'&&!old.def.boat&&!old.def.aircraft&&!old.def.bike?old:G.vehicles.find(v=>v.circuitLoaner);
 if(G.vehicles.some(v=>v!==car&&v!==G.player&&Math.hypot(v.x-p.x,v.y-p.y)<145)){G.action.message={name:'RACE CONTROL',text:'The start line is occupied. Wait for a clear gap, then request your trial.'};G.action.messageT=6;return false;}
 if(car!==old){car=car||G.makeVeh('nyx',p.x,p.y,p.rot,{keep:true,circuitLoaner:true});if(!G.vehicles.includes(car))G.vehicles.push(car);car.dead=false;car.health=100;car.unlocked=true;hooks.enterVeh(G,car,true);if(G.player!==car){G.player=old;return false;}}
 Object.assign(car,{damage:null,wrecked:false,burnT:0,loose:false,tr:null,traffic:false,x:p.x,y:p.y,rot:p.rot,vx:0,vy:0,yaw:0,health:100,dead:false,burning:false,parked:false,ai:false,circuitRacer:false,driver:'player'});
 G.cam.x=car.x;G.cam.y=car.y;
 const pace=racePace(G);
 G.circuitSession={pace:pace.id,target:pace.target,grace:pace.grace,running:true,car,countdown:3,time:0,distance:0,lastS:0,gate:1,valid:true,off:0};
 G.audio?.race?.('count');G.waypoint=trackPoint(TRACK_LENGTH/8);G.gps=null;G.releaseControls?.();
 return true;
}
export function circuitHint(G){
 if(G.race||storyMeeting(G))return '';
 const s=G.circuitSession;
 if(s?.running)return s.countdown>0?'RACE CONTROL / LIGHTS OUT IN '+Math.ceil(s.countdown):`${s.valid?'TIME TRIAL':'INVALID LAP'} / ${s.time.toFixed(1)} / ${s.target}s / SECTOR ${Math.min(8,s.gate)}/8`;
 if(nearCircuit(G))return 'PIT DESK / '+(G.touch?'tap TRIAL':'E: time trial')+' / '+racePace(G).label+' '+racePace(G).target+'s / '+(G.action.circuitBest?'BEST '+G.action.circuitBest.toFixed(2)+'s':'loaner available');
 if(G.player.type==='veh'&&inPitLane(G.player.x,G.player.y))return 'PIT LIMITER / 40 KM/H / YIELD AT PIT EXIT';
 return '';
}
export function drawCircuitActivity(G,r){
 if(!inCircuit((r.x0+r.x1)/2,(r.y0+r.y1)/2,1800))return;
 const c=G.ctx;c.save();c.strokeStyle='#8dd9e3';c.fillStyle='#8dd9e3';c.lineWidth=2;
 c.beginPath();c.arc(CIRCUIT.pit.x,CIRCUIT.pit.y,38,0,Math.PI*2);c.stroke();c.font='bold 11px sans-serif';c.textAlign='center';c.fillText('TIME TRIAL / PIT DESK',CIRCUIT.pit.x,CIRCUIT.pit.y-48);
 const s=G.circuitSession;
 if(s?.running){const p=trackPoint(s.gate*TRACK_LENGTH/8);c.save();c.translate(p.x,p.y);c.rotate(p.rot);c.strokeStyle=s.valid?'#e7cf86':'#d8836b';c.lineWidth=4;c.beginPath();c.moveTo(-CIRCUIT.half,0);c.lineTo(CIRCUIT.half,0);c.stroke();c.restore();}
 c.restore();
}
