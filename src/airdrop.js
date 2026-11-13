import {onRunway} from './aviation.js';
export const DROP_TARGETS=[{x:5590,y:9580,name:'RED MESA'},{x:11080,y:3900,name:'PINEWATCH'},{x:10960,y:8940,name:'SIERRA'}];
export function dropPrediction(p){const t=Math.sqrt(2*Math.max(0,p.altitude||0)/38);return {x:p.x+(p.vx||0)*t,y:p.y+(p.vy||0)*t,t};}
export function dropReady(G){const c=G.action?.contract;return c?.id==='airdrop'&&c.stage>=1&&c.stage<=3&&G.player.kind==='plane'&&!G.player.dead&&(G.player.health??100)>0;}
export function tickDropJob(G,c,dt,notify){
 const p=G.player,speed=Math.hypot(p.vx||0,p.vy||0);
 if(c.stage===0||c.stage===4){
  const valid=c.stage===0?p.type==='foot'&&(p.speed||0)<8&&!G.input.fire&&Math.hypot(p.x-9840,p.y-7780)<65&&G.wanted===0:p.kind==='plane'&&!p.dead&&(p.health??100)>0&&(p.altitude||0)<3&&speed<10&&onRunway(G,p)&&Math.hypot(p.x-9600,p.y-7500)<260;
  c.progress=valid?(c.progress||0)+dt:0;if(c.progress<2)return false;
  if(c.stage===4)return true;c.stage=1;c.progress=0;notify(G,'NEURAL','Three receivers. Fly level at 45–220 altitude. The blue reticle predicts the landing point. Release over each gold zone, then bring the plane back.');
 }
 if(G.parcel){
  const d=G.parcel;d.t+=dt;d.z=Math.max(0,d.altitude-19*d.t*d.t);d.x=d.startX+d.vx*d.t;d.y=d.startY+d.vy*d.t;
  if(d.z===0){const target=DROP_TARGETS[c.stage-1],hit=target&&Math.hypot(d.x-target.x,d.y-target.y)<115;G.parcel=null;
   if(hit){c.stage++;notify(G,'NEURAL',c.stage===4?'All three drives received. Land on the airport runway and stop at its east end.':'Receiver confirmed. Next drop: '+DROP_TARGETS[c.stage-1].name+'.');G.audio?.pickup?.();}
   else notify(G,'NEURAL','The package missed the receiver. Spare aboard. Circle around and line up the blue reticle.');
  }
 }
 if(dropReady(G)&&G.input.fireP&&!G.parcel){
  if(p.altitude<45||p.altitude>220||speed<100||p.stall||Math.abs(p.lean||0)>.15)notify(G,'NEURAL','Hold 45–220 altitude, regain flying speed and level the wings.');
  else{G.parcel={x:p.x,y:p.y,startX:p.x,startY:p.y,vx:p.vx,vy:p.vy,altitude:p.altitude,z:p.altitude,t:0};G.audio?.cock?.();}
 }
 const next=c.stage===4?{x:9600,y:7500}:DROP_TARGETS[c.stage-1];
 if(next&&(G.waypoint?.x!==next.x||G.waypoint?.y!==next.y)){G.waypoint={x:next.x,y:next.y};G.gps=null;}
 return false;
}
export function drawDropMission(G,r){
 const job=G.action?.contract;if(job?.id!=='airdrop')return;
 const c=G.ctx,t=DROP_TARGETS[job.stage-1];c.save();
 if(t&&t.x>r.x0-140&&t.x<r.x1+140&&t.y>r.y0-140&&t.y<r.y1+140){c.strokeStyle='#ead089';c.lineWidth=4;c.setLineDash([18,10]);c.beginPath();c.arc(t.x,t.y,115,0,Math.PI*2);c.stroke();c.setLineDash([]);c.font='bold 16px sans-serif';c.fillStyle='#ead089';c.textAlign='center';c.fillText('DROP / '+t.name,t.x,t.y-130);}
 if(dropReady(G)){const p=dropPrediction(G.player);c.strokeStyle='#8ee1e1';c.lineWidth=3;c.beginPath();c.arc(p.x,p.y,24,0,Math.PI*2);c.moveTo(p.x-38,p.y);c.lineTo(p.x+38,p.y);c.moveTo(p.x,p.y-38);c.lineTo(p.x,p.y+38);c.stroke();}
 const d=G.parcel;if(d){c.fillStyle='rgba(0,0,0,.25)';c.beginPath();c.ellipse(d.x,d.y,12,6,0,0,Math.PI*2);c.fill();c.translate(d.x,d.y-d.z*.35);c.fillStyle='#b28b52';c.fillRect(-8,-6,16,12);c.strokeStyle='#f1e0ae';c.lineWidth=2;c.strokeRect(-8,-6,16,12);c.beginPath();c.moveTo(0,-6);c.lineTo(0,6);c.stroke();}
 c.restore();
}
