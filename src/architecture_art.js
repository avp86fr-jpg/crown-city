/* Building-scale detail plans are deterministic and shared by the baked roof
   and the tiny live fan pass. Equipment stays inside the roof, never on roads. */
const TAU=Math.PI*2;
const box=(c,x,y,w,h,col)=>{c.fillStyle=col;c.fillRect(x,y,w,h);};
function unit(c,x,y,w,h,col){box(c,x+3,y+4,w,h,'rgba(8,20,24,.27)');box(c,x,y,w,h,col);box(c,x,y,w,1.5,'rgba(231,235,213,.5)');}
export function roofDetailPlan(b){
 if(b._roofDetailPlan)return b._roofDetailPlan;
 const w=b.w,h=b.h,seed=b.seed||0,industrial=['warehouse','hangar','garage','outpost'].includes(b.kind),residential=['house','apt','loft','villa'].includes(b.kind);
 const plan={w,h,pitched:b.roof==='terra'||b.roof==='terra2',industrial,residential,fans:[],solar:[],skylights:[],terrace:null,access:null};
 if(b.helipad||w<45||h<40)return b._roofDetailPlan=plan;
 if(plan.pitched){if(w>85&&h>65)plan.access={x:w*.7,y:h*.26,w:12,h:15};return b._roofDetailPlan=plan;}
 const margin=14,pick=((seed*9301+w*13+h*7)%997)/997,pick2=((seed*4973+w*31+h*17)%991)/991;
 // Flat roofs read as a varied, lived-in skyline: membrane colours, roof gardens, pools.
 if(!industrial)plan.tint=['rgba(205,126,88,.26)','rgba(88,156,152,.22)','rgba(226,198,140,.26)','rgba(122,142,178,.2)',null,'rgba(186,98,96,.2)'][Math.floor(pick2*6)];
 else plan.tint=pick2<.4?'rgba(120,150,160,.18)':pick2<.6?'rgba(170,120,80,.18)':null;
 if(!industrial&&w>112&&h>92&&pick<.3){plan.garden={x:margin,y:margin+30,w:w-margin*2,h:h-margin*2-30};plan.access={x:margin,y:margin,w:Math.min(36,w*.2),h:25};return b._roofDetailPlan=plan;}
 if(!industrial&&w>128&&h>104&&pick>=.3&&pick<.46){plan.pool={x:w*.32,y:h*.3,w:w*.5,h:h*.42};plan.access={x:margin,y:margin,w:Math.min(36,w*.2),h:25};return b._roofDetailPlan=plan;}
 if(w>90&&h>76){
  plan.access={x:margin,y:margin,w:Math.min(36,w*.2),h:25};
  if(industrial){
   for(let y=55;y<h-30;y+=54)for(let x=margin;x<w-85;x+=66)plan.skylights.push({x,y,w:38,h:19});
  }else if(residential&&w>125&&h>110){
   plan.terrace={x:margin,y:55,w:Math.min(96,w-64),h:Math.min(62,h-73)};
  }else if(w>125&&h>100){
   for(let x=margin;x<Math.min(w-70,175);x+=40)plan.solar.push({x,y:57,w:31,h:25});
  }
 }
 if(w>64&&h>64){
  for(let y=16;y<Math.min(h-28,industrial?136:78);y+=32)plan.fans.push({x:w-31,y,w:18,h:21});
 }
 return b._roofDetailPlan=plan;
}
export function drawRoofArtwork(c,b){
 const p=roofDetailPlan(b),w=p.w,h=p.h;
 if(b.helipad){
  const r=Math.min(w,h)*.3;c.fillStyle='#353f44';c.beginPath();c.arc(w/2,h/2,r,0,TAU);c.fill();c.strokeStyle='#e2bd69';c.lineWidth=3;c.stroke();
  c.fillStyle='#eee7ce';c.font=`800 ${Math.round(r)}px system-ui`;c.textAlign='center';c.textBaseline='middle';c.fillText('H',w/2,h/2+1);c.textBaseline='alphabetic';return;
 }
 if(p.pitched){
  // Hip ridges follow the building's long axis; gutters mark all four edges.
  const horizontal=w>=h,inset=Math.min(w,h)*.32;
  c.fillStyle='rgba(32,24,18,.16)';if(horizontal)c.fillRect(0,h/2,w,h/2);else c.fillRect(w/2,0,w/2,h);
  c.strokeStyle='rgba(59,37,27,.55)';c.lineWidth=2;c.beginPath();
  if(horizontal){c.moveTo(3,3);c.lineTo(inset,h/2);c.lineTo(w-inset,h/2);c.lineTo(w-3,3);c.moveTo(3,h-3);c.lineTo(inset,h/2);c.moveTo(w-inset,h/2);c.lineTo(w-3,h-3);}
  else{c.moveTo(3,3);c.lineTo(w/2,inset);c.lineTo(w/2,h-inset);c.lineTo(3,h-3);c.moveTo(w-3,3);c.lineTo(w/2,inset);c.moveTo(w/2,h-inset);c.lineTo(w-3,h-3);}c.stroke();
  c.strokeStyle='rgba(229,192,141,.35)';c.lineWidth=1;c.strokeRect(4,4,w-8,h-8);
  if(p.access){const a=p.access;unit(c,a.x,a.y,a.w,a.h,'#84675a');box(c,a.x+2,a.y+2,a.w-4,a.h-5,'#352f2c');}return;
 }
 if(p.tint){c.fillStyle=p.tint;c.fillRect(2,2,w-4,h-4);c.strokeStyle='rgba(255,246,226,.28)';c.lineWidth=3;c.strokeRect(3,3,w-6,h-6);}
 if(p.garden){const a=p.garden;box(c,a.x,a.y,a.w,a.h,'#5b8a47');box(c,a.x,a.y,a.w,3,'rgba(255,255,255,.18)');
  c.strokeStyle='#c9b48c';c.lineWidth=6;c.beginPath();c.moveTo(a.x,a.y+a.h/2);c.lineTo(a.x+a.w,a.y+a.h/2);c.moveTo(a.x+a.w*.4,a.y);c.lineTo(a.x+a.w*.4,a.y+a.h);c.stroke();
  let k=(b.seed||1)*7;const rn=()=>((k=(k*9301+49297)%233280)/233280);
  for(let i=0;i<Math.max(3,a.w*a.h/1600);i++){const tx=a.x+8+rn()*(a.w-16),ty=a.y+8+rn()*(a.h-16),r=5+rn()*7;c.fillStyle='rgba(10,30,10,.3)';c.beginPath();c.arc(tx+3,ty+4,r,0,TAU);c.fill();c.fillStyle=rn()<.2?'#d9708a':rn()<.5?'#4e7d3c':'#6a9a4c';c.beginPath();c.arc(tx,ty,r,0,TAU);c.fill();c.fillStyle='rgba(190,230,140,.35)';c.beginPath();c.arc(tx-r*.3,ty-r*.3,r*.45,0,TAU);c.fill();}
  for(const x of [a.x+6,a.x+a.w-18])unit(c,x,a.y+a.h-16,12,10,'#8a6a4a');
 }
 if(p.pool){const a=p.pool;box(c,a.x-8,a.y-8,a.w+16,a.h+16,'#e4dccb');const g=c.createLinearGradient(a.x,a.y,a.x+a.w,a.y+a.h);g.addColorStop(0,'#86e6e3');g.addColorStop(1,'#1f93b8');c.fillStyle=g;c.fillRect(a.x,a.y,a.w,a.h);
  c.strokeStyle='rgba(255,255,255,.5)';c.lineWidth=1.2;for(let i=1;i<4;i++){c.beginPath();c.moveTo(a.x+i*a.w/4-4,a.y+4);c.quadraticCurveTo(a.x+i*a.w/4+5,a.y+a.h/2,a.x+i*a.w/4-3,a.y+a.h-4);c.stroke();}
  for(let x=a.x;x<a.x+a.w-8;x+=16){unit(c,x,a.y-22,9,12,'#f3efe6');box(c,x,a.y-22,9,3,'#d2654a');}
 }
 if(p.garden||p.pool){if(p.access){const a=p.access;unit(c,a.x,a.y,a.w,a.h,'#828f8b');box(c,a.x+3,a.y+4,a.w-6,a.h-8,'#687a79');}return;}
 // An inset maintenance path and drains explain the roof's arrangement.
 if(w>90&&h>76){c.strokeStyle='rgba(202,195,167,.18)';c.lineWidth=5;c.beginPath();c.moveTo(19,40);c.lineTo(19,h-12);c.lineTo(w-22,h-12);c.lineTo(w-22,39);c.stroke();}
 if(p.access){const a=p.access;unit(c,a.x,a.y,a.w,a.h,'#828f8b');box(c,a.x+3,a.y+4,a.w-6,a.h-8,'#687a79');box(c,a.x+8,a.y+a.h-3,12,4,'#273f40');}
 for(const a of p.solar){unit(c,a.x,a.y,a.w,a.h,'#243f50');c.strokeStyle='#698b9a';c.lineWidth=.7;c.strokeRect(a.x+1,a.y+1,a.w-2,a.h-2);for(let k=1;k<4;k++){c.beginPath();c.moveTo(a.x+k*a.w/4,a.y+1);c.lineTo(a.x+k*a.w/4,a.y+a.h-1);c.stroke();}box(c,a.x+1,a.y+a.h/2,a.w-2,.6,'#698b9a');}
 for(const a of p.skylights){unit(c,a.x,a.y,a.w,a.h,'#7d9295');box(c,a.x+2,a.y+2,a.w-4,a.h-4,'#385c67');box(c,a.x+3,a.y+3,a.w-6,3,'#6f9b9c');for(let k=1;k<4;k++)box(c,a.x+k*a.w/4,a.y+1,1,a.h-2,'#b6bfb0');}
 if(p.terrace){const a=p.terrace;unit(c,a.x,a.y,a.w,a.h,'#7c735d');for(let y=a.y+4;y<a.y+a.h;y+=5)box(c,a.x+2,y,a.w-4,.6,'#ad9873');
  for(const x of [a.x+9,a.x+a.w-15]){unit(c,x,a.y+6,9,15,'#536f59');box(c,x+1,a.y+7,7,11,'#7e945e');}
  c.fillStyle='#ceb48a';c.beginPath();c.ellipse(a.x+a.w*.48,a.y+a.h*.6,10,7,0,0,TAU);c.fill();unit(c,a.x+a.w*.48-5,a.y+a.h*.6-16,10,7,'#405452');unit(c,a.x+a.w*.48-5,a.y+a.h*.6+10,10,7,'#405452');
  c.strokeStyle='#a9b9ac';c.lineWidth=1;c.strokeRect(a.x+1,a.y+1,a.w-2,a.h-2);
 }
 for(const a of p.fans){unit(c,a.x,a.y,a.w,a.h,'#a1aba5');box(c,a.x+2,a.y+2,a.w-4,a.h-4,'#647675');c.fillStyle='#2b4143';c.beginPath();c.arc(a.x+a.w/2,a.y+a.h/2,5.5,0,TAU);c.fill();
  c.strokeStyle='#a9b7af';c.lineWidth=1;c.beginPath();c.moveTo(a.x+5,a.y+6);c.lineTo(a.x+a.w-5,a.y+a.h-6);c.moveTo(a.x+a.w-5,a.y+6);c.lineTo(a.x+5,a.y+a.h-6);c.stroke();
 }
}
