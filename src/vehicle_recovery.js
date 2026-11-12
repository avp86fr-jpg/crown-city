import {CITY_HUBS} from './world_hubs.js';
import {worldBodyHit,bodyContact,circleBody} from './collision.js';
export function recoverRiot(G){
 const P=G.player,h=CITY_HUBS.garage;
 const tell=text=>{if(G.action){G.action.message={name:'HUNTER',text,color:'#94d9cb'};G.action.messageT=7;}return false;};
 if(P.type!=='foot'||Math.hypot(P.x-h.car[0],P.y-h.car[1])>160)return tell('Return on foot to Hunter Garage. Recovery bay marked RIOT.');
 if(G.wanted||G.action?.contract||G.circuitSession?.running)return tell('Finish your active job and lose the heat before requesting recovery.');
 const existing=G.vehicles.find(v=>v.kind==='riot'&&v.mission),probe=G.makeVeh('riot',h.car[0],h.car[1],h.car[2]);
 const clear=(x,y)=>{Object.assign(probe,{x,y});return !worldBodyHit(G,probe,x,y)&&!G.vehicles.some(v=>v!==existing&&!(v.altitude>10)&&bodyContact(probe,v))&&!circleBody(probe,P.x,P.y,12)&&!G.peds.some(p=>!p.dead&&circleBody(probe,p.x,p.y,10));};
 let at=null;for(const y of [3344,3452])if(clear(768,y)){at={x:768,y};break;}
 if(!at)return tell('Recovery bay occupied. Move clear of the two reserved spaces.');
 const car=existing||G.makeVeh('riot',at.x,at.y,h.car[2],{mission:true,keep:true});
 Object.assign(car,{...at,rot:h.car[2],health:100,damage:null,dead:false,wrecked:false,burning:false,burnT:0,vx:0,vy:0,yaw:0,driver:null,parked:true,traffic:false,tr:null,ai:false,loose:false,keep:true,mission:true});
 if(!existing)G.vehicles.push(car);G.waypoint=at;G.gps=null;G.audio?.race?.('service');tell('Your Riot is back in its reserved bay. Recovery is on the house.');return true;
}
