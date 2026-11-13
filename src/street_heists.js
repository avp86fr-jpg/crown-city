/* Pass 3 crew-board jobs: a timed getaway, a tail-and-takedown, and a hypercar sprint east. */
export const HEIST_JOBS=[
 {id:'getaway',title:'NINETY SECONDS',contact:'HUNTER',text:'Lift the Palace counting-room ledger on the Strip. The alarm gives you a hard clock: swap plates at the garage, lose Metro, deliver to Neural on foot.',reward:2100,time:600,stages:2},
 {id:'tail',title:'SHADOW WORK',contact:'VERA',text:'Find the Palace bagman’s sedan. Tail it without being spotted, then box it in and take the satchel.',reward:1700,time:600,stages:2},
 {id:'hyper',title:'REDLINE EAST',contact:'FIRE',text:'Fire left a Nyx Sixteen at the race start. Run every gate out to the Roadhouse on the east highway before the clock dies.',reward:2400,time:600,stages:2},
];
export const HEIST_STEPS={
 getaway:['On foot: crack the counting-room ledger behind the casino. Hold still three seconds.','Drive to the garage for clean plates before the clock runs out.','Lose the heat, then hand the ledger to Neural on foot.'],
 tail:['Get close to the Palace bagman’s route near the Strip.','Tail the marked sedan. Stay in range, but not too close.','Ram or pin the sedan until it stalls, then take the satchel on foot.'],
 hyper:['Reach the race start.','Get in the Nyx Sixteen Fire left at the line.','Hit every gate to the Roadhouse before the clock runs out.'],
};
export const HEIST_DEBRIEFS={
 getaway:'Ninety seconds was generous. The ledger shows the Palace paying Metro overtime by the hour. Neural is already copying it.',
 tail:'The satchel is full of eviction stamps, pre-signed. Vera is sending them to the people named on them before the Palace can.',
 hyper:'The Roadhouse clock says you beat the courier route by minutes. Fire has her proof: the vault run was possible, and planned.',
};
export const HEIST_VN={
 job_getaway:{bg:'strip_night',left:'chaos',right:'hunter',speaker:'hunter',text:'The counting room is behind the casino. When that ledger moves, every alarm on the Strip goes off. You get ninety seconds to make the plates disappear. Do not get clever.',next:'play'},
 job_tail:{bg:'news',left:'chaos',right:'vera',speaker:'vera',text:'The bagman drives a plain sedan and checks his mirrors at every light. Stay close enough to see the plates, far enough that he never sees your face. Then take the satchel.',next:'play'},
 job_hyper:{bg:'desert',left:'chaos',right:'fire',speaker:'fire',text:'Sixteen cylinders, no badges, keys in the visor. The Palace says nobody reaches the east highway before their courier. Prove them wrong. Gates are blue. Clock starts when you roll.',next:'play'},
};
const heistIds=new Set(HEIST_JOBS.map(j=>j.id));
export const isHeistJob=id=>heistIds.has(id);
const LEDGER={x:2236,y:2368},ROADHOUSE={x:10966,y:2700};
const fmt=t=>Math.max(0,Math.ceil(t))+'s';
export function heistHint(G,c){
 if(!isHeistJob(c.id))return '';
 const base=HEIST_STEPS[c.id][Math.min(c.stage||0,HEIST_STEPS[c.id].length-1)];
 if(c.id==='getaway'&&c.stage===1&&c.timer!=null)return base+' '+fmt(c.timer)+' left.';
 if(c.id==='tail'&&c.stage===1)return 'Tail '+Math.floor(c.tailT||0)+'/35s'+((c.sus||0)>.5?'  ·  TOO CLOSE':'')+((c.lostT||0)>1?'  ·  LOSING HIM':'');
 if(c.id==='hyper'&&c.stage===2&&c.gates)return 'Gate '+(c.gate+1)+'/'+(c.gates.length/2)+'  ·  '+fmt(c.timer);
 return base;
}
function raceGates(G,from,to){
 const N=G.nav;if(!N)return [from.x,from.y,to.x,to.y];
 const D=new Uint16Array(N.NW*N.NH);N.flood(D,to.x,to.y,60000);const r=N.route(D,from.x,from.y)||[];
 const out=[];let acc=0;
 for(let i=2;i<r.length;i+=2){acc+=Math.hypot(r[i]-r[i-2],r[i+1]-r[i-1]);if(acc>=760){out.push(r[i],r[i+1]);acc=0;}}
 out.push(to.x,to.y);return out;
}
const tailCar=(G,c)=>c.carId!=null?G.vehicles.find(v=>v.jobId===c.carId&&!v.dead):null;
export function heistTarget(G,c){
 const s=G.meta.spawns,st=c.stage||0;
 if(c.id==='getaway')return st===0?LEDGER:st===1?{x:s.garage[0],y:s.garage[1]}:{x:G.meta.interactions.neural[0],y:G.meta.interactions.neural[1]};
 if(c.id==='tail'){const v=tailCar(G,c);if(st===0)return {x:s.casinoDoor[0]+300,y:s.casinoDoor[1]+420};return v?{x:v.x,y:v.y}:{x:s.casinoDoor[0]+300,y:s.casinoDoor[1]+420};}
 if(c.id==='hyper'){if(st===0)return {x:s.raceStart[0],y:s.raceStart[1]};const v=tailCar(G,c);if(st===1)return v?{x:v.x,y:v.y}:{x:s.raceStart[0],y:s.raceStart[1]};if(c.gates)return {x:c.gates[c.gate*2],y:c.gates[c.gate*2+1]};return ROADHOUSE;}
 return null;
}
const point=(G,c)=>{const t=heistTarget(G,c);if(t){G.waypoint={x:t.x,y:t.y};G.gps=null;}};
export function tickHeistJob(G,c,dt,notify){
 const P=G.player,H=G.jobHooks||{},st=c.stage||0,t=heistTarget(G,c);
 const sp=P.type==='veh'?Math.hypot(P.vx||0,P.vy||0):P.speed||0,d=t?Math.hypot(P.x-t.x,P.y-t.y):1e9,quiet=G.wanted===0&&!G.input.fire;
 const car=P.type==='veh'&&!P.dead&&(P.health??100)>0&&!P.def.boat&&!P.def.aircraft;
 if(!c.vn){c.vn=1;H.vn?.('job_'+c.id);}
 if(c.id==='getaway'){
  if(!G.waypoint)point(G,c); // keep the job marker alive if anything (map click, arrival) cleared it
  if(st===0){c.progress=P.type==='foot'&&d<60&&sp<8&&quiet?(c.progress||0)+dt:0;if(c.progress>=3){c.stage=1;c.progress=0;c.timer=90;G.wanted=Math.max(G.wanted,3);G.seenT=0;G.audio?.alarm?.();notify(G,'HUNTER','Alarm. Ninety seconds. Garage, now. Any car.');point(G,c);}}
  else if(st===1){c.timer=(c.timer??90)-dt;if(c.timer<=0){c.failed='HUNTER: Too slow. The plates are burned. Walk away and try it again later.';return false;}
   if(!car&&d<140&&!c.footNote){c.footNote=1;notify(G,'HUNTER','Plates go on a car, not your coat. Take the Riot in the bay, it is open.');}
   if(car&&d<95){c.stage=2;c.progress=0;G.wanted=Math.min(G.wanted,2);notify(G,'HUNTER','Clean plates on. Metro is still looking for the old ones. Shake them, then walk the ledger to Neural.');point(G,c);}}
  else{c.progress=P.type==='foot'&&d<70&&sp<8&&quiet?(c.progress||0)+dt:0;return c.progress>=2;}
  return false;
 }
 if(c.id==='tail'){
  if(st===0){if(d<520&&H.traffic){const v=H.traffic(P,380,700,'fare');if(v){v.keep=true;v.jobId=c.carId=(G.ticks|0)+1;v.jobMark=true;c.stage=1;c.tailT=0;c.sus=0;c.lostT=0;notify(G,'VERA','That’s him. Grey sedan, marked on your map. Stay back.');point(G,c);}}else point(G,c);return false;}
  const v=tailCar(G,c);if(!v){if(c.carId==null){c.stage=0;return false;}c.failed='VERA: He’s gone. We’ll catch his route another night.';return false;}
  G.waypoint={x:v.x,y:v.y};const dv=Math.hypot(P.x-v.x,P.y-v.y);
  if(st===1){
   if(dv<110)c.sus=(c.sus||0)+dt*(dv<70?2:1);else c.sus=Math.max(0,(c.sus||0)-dt*.5);
   if(dv>700)c.lostT=(c.lostT||0)+dt;else c.lostT=0;
   if(dv>=110&&dv<=560)c.tailT=(c.tailT||0)+dt;
   if(c.sus>=3){c.stage=2;v.cruise=(v.cruise||100)*1.45;v.driverPace=1.2;notify(G,'VERA','He made you. He’s running. Ram him before he reaches the Palace.');}
   else if(c.lostT>=9){c.failed='VERA: Lost him. The bagman will change routes now.';}
   else if(c.tailT>=35){c.stage=2;notify(G,'VERA','He’s heading for the Palace garage. Box him in now. Ram until he stalls.');}
   return false;
  }
  if(!c.stalled){if(P.type==='veh'&&dv<100){const vs=Math.hypot(v.vx||0,v.vy||0);c.boxT=(c.boxT||0)+dt*(vs<30?1:.3);}else c.boxT=Math.max(0,(c.boxT||0)-dt*.5);
   // Light bikes barely dent a sedan: pinning it alongside for a few seconds also stalls it.
   if((v.health??100)<60||v.dead||c.boxT>=4){c.stalled=true;v.traffic=false;v.tr=null;v.loose=true;v.ambient=false;notify(G,'VERA','He’s stalled. The satchel is on the back seat. On foot, quick.');}return false;}
  c.progress=P.type==='foot'&&dv<75&&sp<8?(c.progress||0)+dt:0;return c.progress>=1.5;
 }
 if(c.id==='hyper'){
  if(!G.waypoint&&(c.stage||0)!==1)point(G,c);
  if(st===0){c.progress=d<110&&sp<12?(c.progress||0)+dt:0;if(c.progress>=.6&&H.spawn){const s=G.meta.spawns.raceStart,v=H.spawn('nyx',s[0],s[1]);if(v){v.keep=true;v.jobId=c.carId=(G.ticks|0)+7;c.stage=1;c.progress=0;notify(G,'FIRE','Keys in the visor. Get in.');point(G,c);}}return false;}
  if(st===1){const v=tailCar(G,c);if(!v){c.stage=0;return false;}if(P===v){c.stage=2;c.gate=0;c.gates=raceGates(G,{x:v.x,y:v.y},ROADHOUSE);let len=0,px=v.x,py=v.y;for(let i=0;i<c.gates.length;i+=2){len+=Math.hypot(c.gates[i]-px,c.gates[i+1]-py);px=c.gates[i];py=c.gates[i+1];}c.timer=Math.round(len/270+15);notify(G,'FIRE',c.timer+' seconds. Go.');point(G,c);}else point(G,c);return false;}
  if(!c.gates){c.stage=1;return false;}
  c.timer-=dt;if(c.timer<=0){c.failed='FIRE: Too slow. The courier would have beaten you. Reset and run it again.';return false;}
  if(car&&d<(c.gate*2+2>=c.gates.length?120:150)){c.gate++;G.audio?.pickup?.();if(c.gate*2>=c.gates.length)return true;c.timer+=1.5;point(G,c);}
  return false;
 }
 return false;
}
