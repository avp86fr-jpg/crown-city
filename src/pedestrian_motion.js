/* A shared, bounded local planner for walkers and venue visitors. */
import {circleBody,localPoint,bodySize} from './collision.js';
const EMPTY_CARS=[],VEHICLE_SOURCES=new WeakMap();let sourceSerial=0;
function sourceVersion(source){if(!source)return 0;let version=VEHICLE_SOURCES.get(source);if(!version){version=++sourceSerial;VEHICLE_SOURCES.set(source,version);}return version;}
const walkable=(G,x,y)=>{const s=G.surfaceAt(x,y);return s!=='build'&&s!=='water'&&s!=='canal';};
// Only static ground is cached. Live vehicle avoidance and crossings still run.
export function sleepSafeGround(G,p){
 if(p._sleepX===p.x&&p._sleepY===p.y&&p._sleepSurface===G.surfaceAt)return p._sleepSafe;
 p._sleepX=p.x;p._sleepY=p.y;p._sleepSurface=G.surfaceAt;
 const safe=(x,y)=>walkable(G,x,y)&&G.surfaceAt(x,y)!=='road';
 return p._sleepSafe=safe(p.x,p.y)&&safe(p.x-14,p.y)&&safe(p.x+14,p.y)&&safe(p.x,p.y-14)&&safe(p.x,p.y+14);
}
export function pedestrianClear(G,x,y,r=6,vehicles=null){
 if(!walkable(G,x,y)||!walkable(G,x-r,y)||!walkable(G,x+r,y)||!walkable(G,x,y-r)||!walkable(G,x,y+r))return false;
 let blocked=false;
 const check=v=>{if(!v.def?.boat&&!(v.def?.aircraft&&v.altitude>10)&&circleBody(v,x,y,r))blocked=true;};
 if(vehicles){for(const v of vehicles)check(v);}else if(G.cityAI?.nearTraffic)G.cityAI.nearTraffic(x,y,180,check);else for(const v of G.vehicles||[])if(Math.abs(v.x-x)<180&&Math.abs(v.y-y)<180)check(v);
 return !blocked;
}
export function stepPedestrian(G,p,heading,speed,dt,{road=false}={}){
 const step=Math.max(0,speed)*Math.min(dt,.1),side=p._walkSide||1;
 if(step<=0){p.speed=p.vx=p.vy=0;return false;}
 // Broad-phase candidates refresh at 10 Hz; all narrow-phase body positions
 // remain live every step. The extra radius covers movement between refreshes.
 const cars=p._walkCars||(p._walkCars=[]),people=p._walkPeople||(p._walkPeople=[]);
 p._walkQueryT=(p._walkQueryT||0)-dt;
 const source=sourceVersion(G.vehicles);
 if(p._walkQueryT<=0||p._walkVehicleSource!==source||Math.abs(p.x-p._walkQueryX)>18||Math.abs(p.y-p._walkQueryY)>18){
  cars.length=people.length=0;
  if(G.cityAI?.nearTraffic)G.cityAI.nearTraffic(p.x,p.y,250,v=>cars.push(v));
  else for(const v of G.vehicles||[])if(Math.abs(v.x-p.x)<250&&Math.abs(v.y-p.y)<250)cars.push(v);
  G.cityAI?.nearPeople?.(p.x,p.y,64,other=>people.push(other));
  p._walkQueryT=.1;p._walkQueryX=p.x;p._walkQueryY=p.y;p._walkVehicleSource=source;
 }
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
  // Large catch-up steps must not jump a thin fence or narrow canal strip.
  let blocked=false;
  if(step>6)for(let d=2;d<step;d+=2){const sx=p.x+hx*d,sy=p.y+hy*d;if(!pedestrianClear(G,sx,sy,6,EMPTY_CARS)||!road&&G.surfaceAt(sx,sy)==='road'){blocked=true;break;}}
  if(blocked)continue;
  if(turn)p._walkSide=Math.sign(turn);
  p.x=x;p.y=y;p.rot+=Math.atan2(Math.sin(a-p.rot),Math.cos(a-p.rot))*Math.min(1,dt*9);
  p.speed=speed;p.vx=hx*speed;p.vy=hy*speed;p.dist=(p.dist||0)+step;return true;
 }
 p.speed=p.vx=p.vy=0;return false;
}
