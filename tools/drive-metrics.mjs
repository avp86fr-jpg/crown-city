import {harness} from '../tests/harness.js';
const {G,T}=await harness();
const out={};
for(const k of ['fare','riot','hog','dart','nyx','taxi']){
 G.vehicles=[];const v=T.makeVeh(k,2940,2756,0);v.parked=false;G.vehicles.push(v);
 // open area: teleport each step back to start to avoid walls, keeping velocity
 let t=0,t300=null,top=0;const dt=1/60;
 for(let i=0;i<60*8;i++){T.tickDrive(G,v,{x:0,y:+process.env.Y,hand:false,brake:false},dt,true);t+=dt;const s=Math.hypot(v.vx,v.vy);top=Math.max(top,s);if(t300==null&&s>=300)t300=t;v.x=2940;v.y=2756;}
 let d=0,s0=Math.hypot(v.vx,v.vy),tb=0;
 for(let i=0;i<60*8&&Math.hypot(v.vx,v.vy)>5;i++){T.tickDrive(G,v,{x:0,y:1,hand:false,brake:true},dt,true);d+=Math.hypot(v.vx,v.vy)*dt;tb+=dt;v.x=2940;v.y=2756;}
 out[k]={top:Math.round(top),t300:t300&&+t300.toFixed(2),brakeFrom:Math.round(s0),brakeDist:Math.round(d),brakeT:+tb.toFixed(2)};
}
console.log(JSON.stringify(out,null,0));
