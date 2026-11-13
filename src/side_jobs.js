import {expansionJobTarget,tickExpansionJob,isExpansionJob} from './expansion_jobs.js';
/* Multi-stage street work. Blue routes remain independent from the campaign. */
export const STREET_JOBS=[
 {id:'rescue',title:'BORROWED TIME',contact:'HUNTER',text:'Pick up Hunter’s witness near the Crown Loop. Stop a car for three seconds, then bring them to the garage without a tail.',reward:950,time:180},
 {id:'signal',title:'PAPER TRAIL',contact:'VERA',text:'Recover three dead drops on foot. Hold still at each for two seconds. Send the evidence from the loft with no Metro heat.',reward:1100,time:240},
 {id:'harbour',title:'LOW TIDE',contact:'HUNTER',text:'Collect the dock manifest on foot. Idle offshore in a working boat for three seconds, then return to the marina on foot. Lose all wanted stars at each stop.',reward:1250,time:240}
];
const point=(p)=>({x:p[0],y:p[1]});
export function streetJobTarget(G,c){
 const expanded=expansionJobTarget(G,c);if(expanded)return expanded;
 const s=G.meta.spawns,i=G.meta.interactions;
 if(c.id==='harbour')return c.stage===1?{x:1960,y:200}:point(s.marina);
 if(c.id==='rescue')return point(c.stage?s.garage:s.raceStart);
 if(c.id==='signal')return point([s.garage,i.pd,s.raceStart,i.neural][Math.min(3,c.stage||0)]);
 if(c.id==='courier')return point(c.stage?i.neural:s.garage);
 if(c.id==='ghost'&&!c.stage)return point(i.pd);
 return null;
}
export function restoreStreetRoute(G){const c=G.action?.contract;if(!c)return;const target=streetJobTarget(G,c);if(target){G.waypoint=target;G.gps=null;}}
export function tickStreetJob(G,c,dt,notify){
 if(isExpansionJob(c.id))return tickExpansionJob(G,c,dt,notify);
 const p=G.player,target=streetJobTarget(G,c);if(!target)return false;
 const distance=Math.hypot(p.x-target.x,p.y-target.y),speed=p.type==='veh'?Math.hypot(p.vx,p.vy):p.speed||0;
 if(c.id==='harbour'){
  const boat=p.type==='veh'&&p.def.boat&&!p.dead&&(p.health??100)>0;
  const safe=distance<85&&speed<10&&G.wanted===0&&!G.input.fire&&(c.stage===1?boat:p.type==='foot');
  c.progress=safe?(c.progress||0)+dt:0;
  if(c.progress>=3){
   c.stage++;c.progress=0;if(c.stage===3)return true;
   restoreStreetRoute(G);
   notify(G,'HUNTER',c.stage===1?'Manifest lifted. Those containers are eviction records. Find a launch, follow the blue buoy and idle there for three seconds.':'Upload received. Vera has the names. Bring the original back on foot; the dock clerk needs proof when the Palace comes asking.');
  }
 }
 if(c.id==='rescue'){
  const passengerCar=p.type==='veh'&&!p.def.boat&&!p.def.bike&&!p.def.aircraft&&!p.dead&&(p.health??100)>0;
  const safeStop=passengerCar&&G.wanted===0&&!G.input.fire;
  if(!c.stage){
   const safe=distance<85&&safeStop&&speed<8;
   c.progress=safe?(c.progress||0)+dt:0;
   if(c.progress>=3){c.stage=1;c.progress=0;c.rideHealth=p.health||100;restoreStreetRoute(G);notify(G,'HUNTER','Witness aboard. Palace collectors are looking for them. Bring them to the garage, without the collectors.');G.wanted=Math.max(G.wanted,2);G.seenT=0;}
  }else{
   // Getting out holds the job; the witness stays with the player's next safe car.
   const arrived=distance<85&&safeStop&&speed<10;
   c.progress=arrived?(c.progress||0)+dt:0;
   return c.progress>=2;
  }
 }
 if(c.id==='signal'){
  const safe=distance<65&&p.type==='foot'&&speed<8&&!G.input.fire&&G.wanted===0;
  c.progress=safe?(c.progress||0)+dt:0;
  if(c.progress>=(c.stage===3?3:2)){
   c.stage++;c.progress=0;
   if(c.stage===4)return true;
   restoreStreetRoute(G);notify(G,'VERA',c.stage===3?'All three receipts match. Bring them to Neural’s loft. Three quiet seconds to transmit.':'Evidence '+c.stage+'/3 secured. The next dead drop is marked blue. Leave your weapon down.');
  }
 }
 return false;
}

export const STREET_DEBRIEFS={rescue:'The witness is inside. They can name the collector who signed the orders. Hunter has somewhere safer for them tonight.',signal:'Three receipts. One Palace account. Vera is putting the copies where Gold Mage cannot buy them back.',harbour:'The dock clerk kept their job. Vera kept the evidence. Gold Mage just lost another place to hide.'};
