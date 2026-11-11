/* Multi-stage street work. Blue routes remain independent from the campaign. */
export const STREET_JOBS=[
 {id:'rescue',title:'BORROWED TIME',contact:'HUNTER',text:'Pick up Hunter’s witness near the Crown Loop. Stop a car for three seconds, then bring them to the garage without a tail.',reward:950,time:180},
 {id:'signal',title:'PAPER TRAIL',contact:'VERA',text:'Recover three dead drops on foot. Hold still at each for two seconds. Send the evidence from the loft with no Metro heat.',reward:1100,time:240}
];
const point=(p)=>({x:p[0],y:p[1]});
export function streetJobTarget(G,c){
 const s=G.meta.spawns,i=G.meta.interactions;
 if(c.id==='rescue')return point(c.stage?s.garage:s.raceStart);
 if(c.id==='signal')return point([s.garage,i.pd,s.raceStart,i.neural][Math.min(3,c.stage||0)]);
 if(c.id==='courier')return point(c.stage?i.neural:s.garage);
 if(c.id==='ghost'&&!c.stage)return point(i.pd);
 return null;
}
export function restoreStreetRoute(G){const c=G.action?.contract;if(!c)return;const target=streetJobTarget(G,c);if(target){G.waypoint=target;G.gps=null;}}
export function tickStreetJob(G,c,dt,notify){
 const p=G.player,target=streetJobTarget(G,c);if(!target)return false;
 const distance=Math.hypot(p.x-target.x,p.y-target.y),speed=p.type==='veh'?Math.hypot(p.vx,p.vy):p.speed||0;
 if(c.id==='rescue'){
  if(!c.stage){
   const safe=distance<85&&p.type==='veh'&&!p.def.boat&&!p.def.bike&&speed<8&&G.wanted===0;
   c.progress=safe?(c.progress||0)+dt:0;
   if(c.progress>=3){c.stage=1;c.progress=0;c.rideHealth=p.health||100;restoreStreetRoute(G);notify(G,'HUNTER','Witness aboard. Palace collectors are looking for them. Bring them to the garage, without the collectors.');G.wanted=Math.max(G.wanted,2);G.seenT=0;}
  }else{
   // Getting out holds the job; the witness stays with the player's next safe car.
   const arrived=distance<85&&p.type==='veh'&&!p.def.boat&&!p.def.bike&&speed<10&&G.wanted===0;
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
