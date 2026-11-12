// Keep combat debris bounded across long sessions. Owned and mission vehicles
// remain recoverable; transient wrecks leave the simulation after the scene clears.
import {streetViewport} from './traffic.js';
export function retireStreetActors(G){
 const view=streetViewport(G),co=Math.abs(Math.cos(G.cam.rot||0)),si=Math.abs(Math.sin(G.cam.rot||0));
 const halfW=view.halfW*co+view.halfH*si+140,halfH=view.halfH*co+view.halfW*si+140;
 const visible=a=>Math.abs(a.x-G.cam.x)<halfW&&Math.abs(a.y-G.cam.y)<halfH;
 const keep=(a,eligible,delay)=>{
  if(!eligible){delete a.cleanupSince;delete a.retireAt;return true;}
  a.cleanupSince??=G.ticks;
  const age=(G.ticks-a.cleanupSince)/60;
  if(age<delay)return true;
  if(!visible(a))return false;
  // A visible body fades gradually; it cannot suddenly vanish during a shot.
  if(a.dead&&age>delay+60){a.retireAt??=G.ticks;return G.ticks-a.retireAt<120;}
  return true;
 };
 G.peds=G.peds.filter(p=>keep(p,p.dead&&!p.mission,30));
 G.vehicles=G.vehicles.filter(v=>keep(v,v!==G.player&&v.ambient&&!v.keep&&!v.mission&&!v.isVan&&!v.role&&!v.chasing&&!v.pdCar&&(v.dead||!v.traffic&&!v.loose&&v.parked),45));
}
export const retirementOpacity=(G,a)=>a.retireAt==null?1:Math.max(0,1-(G.ticks-a.retireAt)/120);
