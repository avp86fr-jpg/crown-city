import {loadScenery} from './assets.js';
// One sampled racing line drives asphalt, collision, sector gates and opponents.
export const CIRCUIT_VERSION=2;
export const CIRCUIT={x:656,y:7040,w:5632,h:2368,half:108,pit:{x:5200,y:7568},entry:{x:6432,y:7568}};
export const PIT_LANE=[[1120,8020],[1376,7728],[1728,7568],[5056,7568],[5440,7728],[5680,7920]];
export const PADDOCK={x:1280,y:7104,w:4288,h:400};
export const inPitLane=(x,y)=>x>=1376&&x<=5280&&y>=7504&&y<=7696;
const knots=[[1600,7900],[2000,7900],[3000,7900],[4400,7900],[5550,7900],[5940,8170],[5620,8590],[4950,8400],[4280,8440],[4660,8930],[4200,9150],[3500,8980],[3000,8520],[2440,8720],[1880,9150],[1130,9010],[960,8560],[1150,8260],[1040,7950],[1280,7810]];
export const TRACK=[];
for(let i=0;i<knots.length;i++)for(let j=0;j<24;j++){
 const t=j/24,p0=knots[(i+knots.length-1)%knots.length],p1=knots[i],p2=knots[(i+1)%knots.length],p3=knots[(i+2)%knots.length];
 const axis=k=>.5*((2*p1[k])+(-p0[k]+p2[k])*t+(2*p0[k]-5*p1[k]+4*p2[k]-p3[k])*t*t+(-p0[k]+3*p1[k]-3*p2[k]+p3[k])*t*t*t);
 TRACK.push({x:axis(0),y:axis(1),s:0});
}
let length=0;for(let i=0;i<TRACK.length;i++){const a=TRACK[i],b=TRACK[(i+1)%TRACK.length];a.s=length;a.dx=b.x-a.x;a.dy=b.y-a.y;a.len=Math.hypot(a.dx,a.dy);length+=a.len;a.rot=Math.atan2(a.dx,-a.dy);}
export const TRACK_LENGTH=length;
export function trackPoint(s){s=(s%length+length)%length;let lo=0,hi=TRACK.length-1;while(lo<hi){const m=Math.ceil((lo+hi)/2);if(TRACK[m].s<=s)lo=m;else hi=m-1;}const a=TRACK[lo],t=(s-a.s)/a.len;return {x:a.x+a.dx*t,y:a.y+a.dy*t,rot:a.rot,s};}
const trackBins=new Map();for(const a of TRACK){const key=Math.floor((a.x+a.dx/2)/256)+':'+Math.floor((a.y+a.dy/2)/256);if(!trackBins.has(key))trackBins.set(key,[]);trackBins.get(key).push(a);}
export function nearestTrack(x,y){
 let best=TRACK[0],bestT=0,d2=Infinity;
 const scan=list=>{for(const a of list){const t=Math.max(0,Math.min(1,((x-a.x)*a.dx+(y-a.y)*a.dy)/(a.len*a.len))),dx=x-a.x-a.dx*t,dy=y-a.y-a.dy*t,d=dx*dx+dy*dy;if(d<d2){d2=d;best=a;bestT=t;}}};
 const bx=Math.floor(x/256),by=Math.floor(y/256);for(let iy=by-1;iy<=by+1;iy++)for(let ix=bx-1;ix<=bx+1;ix++){const list=trackBins.get(ix+':'+iy);if(list)scan(list);}
 if(d2>180*180)scan(TRACK);
 return {x:best.x+best.dx*bestT,y:best.y+best.dy*bestT,s:best.s+bestT*best.len,rot:best.rot,d:Math.sqrt(d2)};
}
export const inCircuit=(x,y,pad=0)=>x>=CIRCUIT.x-pad&&x<CIRCUIT.x+CIRCUIT.w+pad&&y>=CIRCUIT.y-pad&&y<CIRCUIT.y+CIRCUIT.h+pad;
export const CIRCUIT_BUILDINGS=[
 ...Array.from({length:10},(_,i)=>({x:1648+i*304,y:7344,w:272,h:144,type:'pit',name:'GARAGE '+String(i+1).padStart(2,'0')})),
 {x:5280,y:7184,w:256,h:192,type:'control',name:'RACE CONTROL'},
 {x:1744,y:8176,w:768,h:112,type:'stand',name:'MAIN GRANDSTAND'},
 {x:4944,y:9040,w:640,h:160,type:'stand',name:'SOUTH GRANDSTAND'},
 {x:3632,y:7140,w:320,h:120,type:'medical',name:'MEDICAL / TECH'},
 ...Array.from({length:6},(_,i)=>({x:1664+i*304,y:7140,w:224,h:96,type:'truck',name:'TEAM '+(i+1)}))
];
export function applyCircuit(W,CODE){
 W.circuit=CIRCUIT;
 const site={x:608,y:7008,w:5784,h:2448};
 const hit=p=>p.x+(p.w||p.r||0)>site.x&&p.x-(p.r||0)<site.x+site.w&&p.y+(p.h||p.r||0)>site.y&&p.y-(p.r||0)<site.y+site.h;
 for(const key of ['buildings','trees','lamps','props','features','lots','parking','pools'])W[key]=W[key].filter(p=>!hit(p));
 if(W.expansion?.obstacles)W.expansion.obstacles=W.expansion.obstacles.filter(p=>!hit(p));
 // A connected perimeter boulevard replaces the internal residential grid.
 W.roads=W.roads.flatMap(s=>{const min=s.v?500:6900,max=s.v?6500:9488;if(s.c<=min||s.c>=max)return [s];const a=s.v?6900:500,b=s.v?9488:6500;if(s.b<=a||s.a>=b)return [s];return [{...s,b:Math.min(a,s.b)},{...s,a:Math.max(b,s.a)}].filter(r=>r.b-r.a>=180);});
 for(const y of [6900,9488])W.roads.push({v:false,c:y,a:500,b:6500,w:144,lanes:1,med:0,k:'arterial'});
 for(const x of [500,6500])W.roads.push({v:true,c:x,a:9000,b:9488,w:200,lanes:2,med:0,k:'arterial'});
 // Clear only the two new perimeter corridors; keep the Mesa supply outpost south of them.
 const corridor=p=>[6900,9488].some(y=>p.x+(p.w||p.r||0)>392&&p.x-(p.r||0)<6608&&p.y+(p.h||p.r||0)>y-80&&p.y-(p.r||0)<y+80);
 for(const key of ['buildings','trees','lamps','props','features','lots','parking','pools'])W[key]=W[key].filter(p=>!corridor(p));
 if(W.expansion?.obstacles)W.expansion.obstacles=W.expansion.obstacles.filter(p=>!corridor(p));
 if(W.expansion){
  const E=W.expansion;
  E.decor=E.decor.filter(p=>{
   const centred=['rock','mesa','cactus','scrub','limit-sign'].includes(p.kind),w=p.w||40,h=p.h||40;
   const bounds={x:p.x-(centred?w*.65:0),y:p.y-(centred?h*.75:0),w:centred?w*1.3:w,h:centred?h*1.5:h};
   return !hit(bounds)&&!corridor(bounds);
  });
  E.decor.push({kind:'limit-sign',x:3500,y:9620,label:'RED MESA / COUNTY ROAD'},{kind:'limit-sign',x:6150,y:9620,label:'CROWN CITY / MOTORSPORT PARK'});
  E.decorBins=new Map();for(const p of E.decor){const r=Math.max(p.w||0,p.h||0,p.r||0,140);for(let y=Math.floor((p.y-r)/512);y<=Math.floor((p.y+r)/512);y++)for(let x=Math.floor((p.x-r)/512);x<=Math.floor((p.x+r)/512);x++){const key=x+':'+y,list=E.decorBins.get(key)||[];list.push(p);E.decorBins.set(key,list);}}
 }
 W.fill(site.x,site.y,site.w,site.h,CODE.grass);
 for(const r of W.roads)if(r.c===6900||r.c===9488||r.v&&[500,6500].includes(r.c))W.fill(r.v?r.c-r.w/2:r.a,r.v?r.a:r.c-r.w/2,r.v?r.w:r.b-r.a,r.v?r.b-r.a:r.w,CODE.road);
 W.inter=[];for(const v of W.roads)if(v.v)for(const h of W.roads)if(!h.v&&h.c>=v.a&&h.c<=v.b&&v.c>=h.a&&v.c<=h.b)W.inter.push({x:v.c,y:h.c,vs:v,hs:h});
 W.signals=W.signals.filter(n=>!inCircuit(n.x,n.y,64)&&(W.inter.some(i=>i.x===n.x&&i.y===n.y)||n.x<4096&&n.y<4096));
 function ribbon(points,half,runoff,code){for(let i=0;i<points.length-1;i++){
  const a=points[i],b=points[i+1],dx=b.x-a.x,dy=b.y-a.y,l2=dx*dx+dy*dy;
  for(let y=Math.floor((Math.min(a.y,b.y)-runoff)/16)*16;y<Math.max(a.y,b.y)+runoff;y+=16)for(let x=Math.floor((Math.min(a.x,b.x)-runoff)/16)*16;x<Math.max(a.x,b.x)+runoff;x+=16){const t=Math.max(0,Math.min(1,((x+8-a.x)*dx+(y+8-a.y)*dy)/l2)),d2=(x+8-a.x-dx*t)**2+(y+8-a.y-dy*t)**2;if(d2<half*half)W.fill(x,y,16,16,code);else if(d2<runoff*runoff)W.fill(x,y,16,16,CODE.sand,c=>c!==CODE.track&&c!==CODE.lot);}
 }}
 ribbon([...TRACK,TRACK[0]],108,152,CODE.track);
 W.fill(PADDOCK.x,PADDOCK.y,PADDOCK.w,PADDOCK.h,CODE.lot);
 ribbon(PIT_LANE.map(([x,y])=>({x,y})),72,80,CODE.lot);
 W.fill(5056,7472,1440,192,CODE.lot);W.fill(4800,7168,224,448,CODE.lot);
 for(const b of CIRCUIT_BUILDINGS){W.fill(b.x,b.y,b.w,b.h,CODE.build);W.expansion?.obstacles.push({...b,hgt:b.type==='stand'?14:b.type==='truck'?12:24});}
 W.fill(1840,7728,2960,16,CODE.build);
 for(const r of [{x:656,y:7040,w:5632,h:16},{x:656,y:9392,w:5632,h:16},{x:656,y:7040,w:16,h:2368},{x:6272,y:7040,w:16,h:432},{x:6272,y:7664,w:16,h:1744}])W.fill(r.x,r.y,r.w,r.h,CODE.build);
}
function path(c,points=TRACK,closed=true){c.beginPath();c.moveTo(points[0].x,points[0].y);for(const p of points)c.lineTo(p.x,p.y);if(closed)c.closePath();}
function* paintCircuit(c,view,pats={}){
 const {x,y,w,h,half}=CIRCUIT;c.save();c.beginPath();c.rect(x,y,w,h);c.clip();
 c.fillStyle=pats.grass||'#526247';c.fillRect(x,y,w,h);yield;c.fillStyle='rgba(177,187,131,.06)';for(let yy=y;yy<y+h;yy+=64)c.fillRect(x,yy,w,32);
 c.lineJoin='round';c.lineCap='round';path(c);c.strokeStyle=pats.sand||'#b4a483';c.lineWidth=304;c.stroke();yield;c.strokeStyle='#393f40';c.lineWidth=236;c.stroke();yield;c.strokeStyle='#ddd8c5';c.lineWidth=228;c.stroke();yield;c.setLineDash([24,24]);c.strokeStyle='#b6463a';c.stroke();yield;c.setLineDash([]);c.strokeStyle=pats.asphalt||'#30373b';c.lineWidth=216;c.stroke();yield;c.strokeStyle='rgba(15,20,24,.22)';c.lineWidth=11;c.stroke();yield;
 c.fillStyle='#515b5b';c.fillRect(PADDOCK.x,PADDOCK.y,PADDOCK.w,PADDOCK.h);c.fillRect(5056,7472,1440,192);c.fillRect(4800,7168,224,448);
 path(c,PIT_LANE.map(([x,y])=>({x,y})),false);c.strokeStyle='#d4ceb0';c.lineWidth=150;c.stroke();yield;c.strokeStyle='#434d50';c.lineWidth=144;c.stroke();yield;c.setLineDash([20,16]);c.strokeStyle='#c9b373';c.lineWidth=2;c.stroke();yield;c.setLineDash([]);
 for(let xx=1664;xx<4688;xx+=304){c.strokeStyle='#cfccae';c.lineWidth=2;c.strokeRect(xx,7504,224,104);c.fillStyle='#c8bc8b';c.font='bold 13px sans-serif';c.textAlign='center';c.fillText('PIT '+(1+(xx-1664)/304),xx+112,7580);}
 for(const b of CIRCUIT_BUILDINGS){yield;
  c.fillStyle='#18272c';c.fillRect(b.x+7,b.y+9,b.w,b.h);c.fillStyle=b.type==='stand'?'#73878a':b.type==='truck'?'#c4c7bc':'#49646c';c.fillRect(b.x,b.y,b.w,b.h);c.strokeStyle='#9ba9a8';c.lineWidth=2;
  for(let yy=b.y+10;yy<b.y+b.h-20;yy+=12){c.beginPath();c.moveTo(b.x+6,yy);c.lineTo(b.x+b.w-6,yy);c.stroke();yield;}
  c.fillStyle='#1e3137';c.fillRect(b.x+4,b.y+b.h-30,b.w-8,26);c.fillStyle='#e6dcbd';c.textAlign='center';c.font='bold 13px sans-serif';c.fillText(b.name,b.x+b.w/2,b.y+b.h-12);
  if(b.type==='pit'){
   c.fillStyle=['#397d88','#b7955b','#9a5254'][Math.floor(b.x/304)%3];c.fillRect(b.x+4,b.y+3,b.w-8,7);c.fillRect(b.x+8,b.y+b.h-4,b.w-16,9);
   for(const xx of [b.x+24,b.x+b.w-48]){c.fillStyle='#23373c';c.fillRect(xx,b.y+18,25,26);c.fillStyle='#809697';c.fillRect(xx+3,b.y+21,19,19);}
   c.fillStyle='#c8c9b8';c.fillRect(b.x+16,b.y+b.h+14,34,13);c.fillStyle='#26373d';c.fillRect(b.x+17,b.y+b.h+15,32,5);
  }
  if(b.type==='truck'){
   c.fillStyle='#22313b';for(const xx of [b.x+22,b.x+b.w-42])for(const yy of [b.y-4,b.y+b.h-3])c.fillRect(xx,yy,20,7);
   c.fillStyle='#6d858b';c.fillRect(b.x+b.w-42,b.y+7,35,b.h-14);c.fillStyle='#173038';c.fillRect(b.x+b.w-20,b.y+15,10,b.h-30);
  }
  if(b.type==='stand')for(let yy=b.y+10;yy<b.y+b.h-34;yy+=14)for(let xx=b.x+10;xx<b.x+b.w-10;xx+=16){c.fillStyle=(xx+yy)%3?'#bd9a76':'#d1d3c6';c.fillRect(xx,yy,5,5);c.fillStyle=(xx+yy)%4?'#294356':'#9c5145';c.fillRect(xx-1,yy+5,7,4);}
 }
 c.fillStyle='#b6bdb2';c.fillRect(1840,7728,2960,16);c.fillStyle='#34444a';c.fillRect(1840,7736,2960,4);
 for(let yy=7792;yy<8008;yy+=12)for(let xx=1592;xx<1616;xx+=12){c.fillStyle=((yy-7792)/12+(xx-1592)/12)%2?'#252b30':'#e3dfcd';c.fillRect(xx,yy,12,12);}
 for(let i=1;i<=7;i++){const p=trackPoint(length*i/8);c.save();c.translate(p.x,p.y);c.rotate(p.rot);c.strokeStyle='#a7c8bc';c.lineWidth=2;c.setLineDash([8,8]);c.beginPath();c.moveTo(-half,0);c.lineTo(half,0);c.stroke();yield;c.setLineDash([]);c.fillStyle='#dedac0';c.font='bold 15px sans-serif';c.fillText('S'+i,half+30,0);c.restore();}
 c.fillStyle='#e2d6ad';c.font='bold 23px sans-serif';c.textAlign='center';c.fillText('CROWN MOTORSPORT PARK',3400,7092);c.font='bold 14px sans-serif';c.fillText('PADDOCK / TRANSPORT & SCRUTINEERING',2820,7296);c.fillText('40 / PIT SPEED',4980,7650);c.fillText('PUBLIC ENTRY',6010,7580);c.fillText('PIT IN',1300,7830);c.fillText('PIT EXIT / YIELD',5430,7670);
 for(const xx of [1350,4700,5850]){c.fillStyle='#bda46d';c.fillRect(xx,7180,110,64);c.fillStyle='#285563';c.fillRect(xx+5,7185,100,52);}
 c.strokeStyle='#afb9b5';c.lineWidth=8;c.strokeRect(x+8,y+8,w-16,h-16);c.fillStyle='#515b5b';c.fillRect(6268,7472,24,192);c.restore();
}
// Cap the large venue's static bitmap at 8 MiB on Performance, 32 MiB on PC.
// Geometry and collisions stay full resolution; only distant static paint scales.
const artwork=new WeakMap();
export function loadCircuitArt(low){
 return loadScenery(`assets/world/circuit-v${CIRCUIT_VERSION}-${low?'mobile':'desktop'}.webp`,low?2048:4096);
}
export function* circuitGroundSteps(c,view,pats={},scale=1){
 const x=Math.max(view.x0,CIRCUIT.x),y=Math.max(view.y0,CIRCUIT.y),w=Math.min(view.x1,CIRCUIT.x+CIRCUIT.w)-x,h=Math.min(view.y1,CIRCUIT.y+CIRCUIT.h)-y;
 if(w<=0||h<=0)return;
 if(pats.circuitImage){const old=artwork.get(pats);if(old){old.retired=true;old.job?.return();old.bitmap?.close();old.canvas.width=1;artwork.delete(pats);}
  const im=pats.circuitImage,sx=im.width/CIRCUIT.w,sy=im.height/CIRCUIT.h;
  c.drawImage(im,(x-CIRCUIT.x)*sx,(y-CIRCUIT.y)*sy,w*sx,h*sy,x,y,w,h);return;
 }
 scale=Math.min(scale,(scale<1?2048:4096)/CIRCUIT.w);let cached=artwork.get(pats);
 if(!cached||cached.scale!==scale||cached.asphalt!==pats.asphalt||cached.grass!==pats.grass){
  if(cached){cached.retired=true;cached.bitmap?.close();cached.canvas.width=1;}
  const canvas=document.createElement('canvas');canvas.width=Math.ceil(CIRCUIT.w*scale);canvas.height=Math.ceil(CIRCUIT.h*scale);
  const a=canvas.getContext('2d',{willReadFrequently:true});a.scale(scale,scale);a.translate(-CIRCUIT.x,-CIRCUIT.y);const job=paintCircuit(a,view,pats);
  cached={canvas,scale,job,asphalt:pats.asphalt,grass:pats.grass};artwork.set(pats,cached);
 }
 if(cached.job){
  while(cached.job&&!cached.job.next().done)yield;
  if(cached.job){cached.job=null;
   if(typeof createImageBitmap==='function'){const entry=cached;createImageBitmap(entry.canvas).then(bitmap=>{if(entry.retired)bitmap.close();else{entry.bitmap=bitmap;entry.canvas.width=1;}}).catch(()=>{});}
  }
 }
 c.drawImage(cached.bitmap||cached.canvas,(x-CIRCUIT.x)*scale,(y-CIRCUIT.y)*scale,w*scale,h*scale,x,y,w,h);
}

export function drawCircuitGround(c,view,pats={},scale=1){for(const step of circuitGroundSteps(c,view,pats,scale)){} }
