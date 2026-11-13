import {WEAPONS} from './action.js';
// World-unit dimensions shared by the held artwork and the projectile origin.
// The hero is 50 units tall; the launcher is a compact shoulder-mounted tube.
export const WEAPON_ART={sidearm:{length:13,width:4,muzzle:22},smg:{length:18,width:6,muzzle:27},shotgun:{length:24,width:5,muzzle:33},rocket:{length:28,width:7,muzzle:37}};
const cache=new Map();
function sprite(id){
 if(cache.has(id))return cache.get(id);
 const spec=WEAPON_ART[id]||WEAPON_ART.sidearm,c=document.createElement('canvas');c.width=128;c.height=48;
 const x=c.getContext('2d',{willReadFrequently:true});x.scale(4,4);x.translate(3,6);
 const L=spec.length,metal=x.createLinearGradient(0,-3,0,3);metal.addColorStop(0,'#d4dce0');metal.addColorStop(.3,'#596c77');metal.addColorStop(.55,'#26343d');metal.addColorStop(1,'#101c25');
 const block=(px,py,w,h,col)=>{x.fillStyle=col;x.beginPath();x.roundRect(px,py,w,h,.65);x.fill();};
 if(id==='sidearm'){
  block(0,-1.9,8.5,3.8,metal);block(8,-1.25,5,2.5,metal);
  x.fillStyle='#15212a';x.beginPath();x.moveTo(2,.7);x.lineTo(5,1);x.lineTo(4.3,5);x.lineTo(1.7,4.6);x.closePath();x.fill();
  x.strokeStyle='#8d9d9d';x.lineWidth=.55;x.strokeRect(4,1,2.6,2.2);
  block(1,-2.2,1,1,'#ccdacd');block(6.5,-2.2,.7,1,'#ccdacd');
  x.fillStyle='#91a7ac';x.fillRect(1,-1.9,6,.45);x.fillRect(8.5,-1.1,3.8,.4);
  x.fillStyle='#20303a';for(let i=1;i<4;i++)x.fillRect(i,-1.4,.35,1.5);
 }else if(id==='smg'){
  x.strokeStyle='#93a8a9';x.lineWidth=.7;x.beginPath();x.moveTo(2,-1);x.lineTo(-2,-2);x.lineTo(-2,2);x.lineTo(2,1);x.stroke();
  block(1,-2.2,10,4.4,metal);block(10,-1.4,8,2.8,metal);block(3,1.4,2.3,3.7,'#25323a');
  x.fillStyle='#1b2932';x.beginPath();x.moveTo(7,1);x.lineTo(10,1);x.lineTo(9.2,6);x.lineTo(6.8,5.5);x.closePath();x.fill();
  block(5,-3.1,3.3,1.2,'#30424b');x.fillStyle='#c4a777';x.fillRect(7,-1.2,2,1);
  x.fillStyle='#9cb0b6';x.fillRect(2,-2.2,8,.5);x.fillRect(11,-1.3,5,.45);x.fillRect(7.3,2,.5,3);
  x.fillStyle='#172833';for(let i=11;i<15;i++)x.fillRect(i,-1.4,.4,1.2);
 }else if(id==='rocket'){
  block(-2,-2.4,26,4.8,'#293a31');block(0,-1.8,20,3.6,metal);block(6,-2.7,9,5.4,'#607044');
  block(2,-3.5,2,7,'#afa47b');block(18,-2.8,1.2,5.6,'#a6b48c');block(6,2,2,3.7,'#273130');block(15,1.7,3,3,'#3b4334');
  block(12,-4,3,1.5,'#23312c');block(13,-4.5,.7,1,'#b7d7b1');
  x.fillStyle='#879961';x.beginPath();x.moveTo(22,-3.5);x.lineTo(28,0);x.lineTo(22,3.5);x.closePath();x.fill();
  x.fillStyle='#c1cba1';x.fillRect(2,-1.8,17,.55);x.fillRect(7,-2.6,7,.5);
 }else{
  const wood=x.createLinearGradient(0,-2,0,3);wood.addColorStop(0,'#bd9668');wood.addColorStop(.5,'#836246');wood.addColorStop(1,'#493c31');
  x.fillStyle=wood;x.beginPath();x.moveTo(-2,-1);x.lineTo(6,-1.3);x.lineTo(7,1);x.lineTo(1,3.1);x.lineTo(-2,2.8);x.closePath();x.fill();
  block(5,-1.7,7,3.4,metal);block(11,-1.1,13,2.2,metal);block(12,-1.7,6,3.4,wood);
  x.fillStyle='#503c2c';for(let i=13;i<18;i+=1.2)x.fillRect(i,-1.4,.4,2.8);
  x.fillStyle='#b8caca';x.fillRect(6,-1.7,5,.45);x.fillRect(18,-1,5,.4);x.fillStyle='#cee0b9';x.fillRect(23,-1.5,.8,.6);
  x.strokeStyle='#8d9d9d';x.lineWidth=.6;x.strokeRect(6,1,3,2);
 }
 block(L-.8,-1,.8,2,'#0b1721');
 cache.set(id,c);return c;
}
export function drawHeldWeapon(G,a,rot){
 const c=G.ctx,id=WEAPONS[G.action.weapon].id,spec=WEAPON_ART[id]||WEAPON_ART.sidearm,reload=G.action.reloadT>0;
 const recoil=Math.max(0,1-(G.ticks-(a.shotTick??-100))/7)*2;
 c.save();c.translate(0,-23);c.rotate(rot-Math.PI/2+(reload?.35*Math.sin(G.action.reloadT*5):0));
 // Sleeve, support hand and grip: separate from the body atlas, so muzzle
 // direction follows continuous aim instead of snapping between eight poses.
 const sleeve=c.createLinearGradient(0,-6,12,5);sleeve.addColorStop(0,'#77607e');sleeve.addColorStop(.45,'#493652');sleeve.addColorStop(1,'#281f35');
 const arm=(support=false)=>{c.beginPath();c.moveTo(-3,support?-6:3);c.quadraticCurveTo(support?8:2,support?-6:6,(support?(id==='shotgun'||id==='rocket'?22:18):11)-recoil,support?-1:1);};
 for(const support of id==='sidearm'?[false]:[true,false]){arm(support);c.lineCap='round';c.strokeStyle='#242131';c.lineWidth=4;c.stroke();c.strokeStyle=sleeve;c.lineWidth=3;c.stroke();}
 c.drawImage(sprite(id),spec.muzzle-spec.length-3-recoil,-6,32,12);
 c.fillStyle='#29493e';c.beginPath();c.ellipse(11-recoil,1,1.8,1.4,0,0,Math.PI*2);c.fill();
 if(id!=='sidearm'){c.beginPath();c.ellipse((id==='shotgun'||id==='rocket'?22:18)-recoil,-.5,1.7,1.5,0,0,Math.PI*2);c.fill();}
 c.restore();
}
// Drive-by: purple sleeve from the driver's shoulder out through the side
// window, a one-handed grip and the weapon pointing along the shot. Drawn in
// the vehicle's local frame (forward = -y, right = +x).
export function drawDriveByArm(G,v,c){
 if(!(v.driveByT>0)||v.dead)return;
 const id=WEAPONS[G.action.weapon]?.id||'sidearm',spec=WEAPON_ART[id]||WEAPON_ART.sidearm,side=v.driveBySide||-1,bike=!!v.def?.bike;
 const rel=(v.driveByRot??v.rot)-v.rot,w=bike?6:(v.kind==='bus'?26:v.kind==='van'||v.kind==='ambulance'?23:21),out=bike?8:9;
 const recoil=Math.max(0,1-(G.ticks-(v.shotTick??-100))/6)*2.5,ext=Math.min(1,v.driveByT/.12);
 const sx=side*(w-9),sy=bike?2:5,ax=Math.sin(rel),ay=-Math.cos(rel);
 const hx=side*(w+out*ext)+ax*4*ext-ax*recoil,hy=(bike?-4:0)+ay*4*ext-ay*recoil;
 c.save();c.lineCap='round';
 c.strokeStyle='rgba(0,0,0,.35)';c.lineWidth=5;c.beginPath();c.moveTo(sx+2,sy+3);c.lineTo(hx+2,hy+3);c.stroke();
 c.strokeStyle='#241a30';c.lineWidth=4.6;c.beginPath();c.moveTo(sx,sy);c.quadraticCurveTo(side*(w+1),sy-3,hx,hy);c.stroke();
 c.strokeStyle='#5d3f73';c.lineWidth=3.2;c.stroke();
 c.fillStyle='#d9c3a8';c.beginPath();c.arc(hx,hy,1.9,0,Math.PI*2);c.fill();
 c.translate(hx,hy);c.rotate(rel-Math.PI/2);
 const L=Math.min(spec.length,id==='sidearm'?13:20);c.drawImage(sprite(id),-3,-4,L*32/spec.length*.95,8);
 if(G.ticks-(v.shotTick??-100)<3){c.globalCompositeOperation='lighter';c.fillStyle='rgba(255,214,140,.95)';c.beginPath();c.moveTo(L+1,0);c.lineTo(L+11,-3.2);c.lineTo(L+15,0);c.lineTo(L+11,3.2);c.closePath();c.fill();
  c.fillStyle='rgba(255,250,220,.9)';c.beginPath();c.arc(L+3,0,2.6,0,Math.PI*2);c.fill();}
 c.restore();
}
