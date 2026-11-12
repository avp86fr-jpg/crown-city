/* A shared, bounded local planner for walkers and venue visitors. */
import {circleBody,localPoint,bodySize} from './collision.js';
const EMPTY_CARS=[];
const walkable=(G,x,y)=>{const s=G.surfaceAt(x,y);return s!=='build'&&s!=='water'&&s!=='canal';};
// Only static ground is cached. Live vehicle avoidance and crossings still run.
export function sleepSafeGround(G,p){
 if(p._sleepX===p.x&&p._sleepY===p.y&&p._sleepSurface===G.surfaceAt)return p._sleepSafe;
 p._sleepX=p.x;p._sleepY=p.y;p._sleepSurface=G.surfaceAt;
 return p._sleepSafe=G.surfaceAt(p.x,p.y)!=='road'&&G.surfaceAt(p.x-14,p.y)!=='road'&&G.surfaceAt(p.x+14,p.y)!=='road'&&G.surfaceAt(p.x,p.y-14)!=='road'&&G.surfaceAt(p.x,p.y+14)!=='road';
}
export function pedestrianClear(G,x,y,r=6,vehicles=null){
 if(!walkable(G,x,y)||!walkable(G,x-r,y)||!walkable(G,x+r,y)||!walkable(G,x,y-r)||!walkable(G,x,y+r))return false;
 let blocked=false;
 const check=v=>{if(!v.def?.boat&&!(v.def?.aircraft&&v.altitude>10)&&circleBody(v,x,y,r))blocked=true;};
 if(vehicles){for(const v of vehicles)check(v);}else if(G.cityAI?.nearTraffic)G.cityAI.nearTraffic(x,y,180,check);else for(const v of G.vehicles||[])if(Math.abs(v.x-x)<180&&Math.abs(v.y-y)<180)check(v);
 return !blocked;
}
export function stepPedestrian(G,p,heading,speed,dt,{road=false}={}){
 const step=speed*Math.min(dt,.1),side=p._walkSide||1;
 // Query broad-phase buckets once per walking step, reuse candidates for all
 // steering probes. Corner avoidance otherwise repeated both queries 14 times.
 const cars=p._walkCars||(p._walkCars=[]),people=p._walkPeople||(p._walkPeople=[]);cars.length=people.length=0;
 if(G.cityAI?.nearTraffic)G.cityAI.nearTraffic(p.x,p.y,210,v=>cars.push(v));
 else for(const v of G.vehicles||[])if(Math.abs(v.x-p.x)<210&&Math.abs(v.y-p.y)<210)cars.push(v);
 G.cityAI?.nearPeople?.(p.x,p.y,48,other=>people.push(other));
 const safe=(x,y)=>{
  if(!pedestrianClear(G,x,y,6,EMPTY_CARS)||!road&&G.surfaceAt(x,y)==='road')return false;
  for(const car of cars)if(!car.def?.boat&&!(car.def?.aircraft&&car.altitude>10)&&circleBody(car,x,y,6)){
   // A crossing pedestrian tangent to two stopped cars must be able to slide
   // out of the gap. Reject new/deeper contact, but allow an existing touch to clear.
   if(!circleBody(car,p.x,p.y,6))return false;
   const b=bodySize(car),a=localPoint(car,p.x,p.y),n=localPoint(car,x,y),clear=q=>Math.max(Math.abs(q.x)-b.w,Math.abs(q.y)-b.l);
   if(clear(n)<clear(a)-.001)return false;
  }
  let clear=true;for(const other of people){
   if(other===p||other.dead||other.dive>0)continue;
   const next=(other.x-x)**2+(other.y-y)**2,current=(other.x-p.x)**2+(other.y-p.y)**2;
   if(next<14**2&&next<current)clear=false;
  }return clear;
 };
 // Retain the chosen side around a parked body, rather than changing sides
 // every frame. Look farther than one step so the turn begins before contact.
 for(const turn of [0,.55*side,1.05*side,Math.PI/2*side,-.55*side,-1.05*side,-Math.PI/2*side,Math.PI]){
  const a=heading+turn,hx=Math.sin(a),hy=-Math.cos(a),x=p.x+hx*step,y=p.y+hy*step;
  if(!safe(x,y)||!safe(p.x+hx*Math.max(16,step),p.y+hy*Math.max(16,step)))continue;
  if(turn)p._walkSide=Math.sign(turn);
  p.x=x;p.y=y;p.rot+=Math.atan2(Math.sin(a-p.rot),Math.cos(a-p.rot))*Math.min(1,dt*9);
  p.speed=speed;p.vx=hx*speed;p.vy=hy*speed;p.dist=(p.dist||0)+step;return true;
 }
 p.speed=p.vx=p.vy=0;return false;
}
