// One sampled racing line drives asphalt, collision, sector gates and opponents.
export const CIRCUIT={x:656,y:7456,w:3072,h:1456,half:68,pit:{x:3008,y:7656},entry:{x:3600,y:7656}};
const knots=[[1400,7860],[2740,7860],[3220,7890],[3420,8130],[3190,8400],[2770,8220],[2440,8270],[2720,8560],[2460,8710],[2070,8630],[1790,8360],[1390,8500],[1040,8690],[854,8440],[1070,8190],[880,7940],[1070,7820]];
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
const buildings=[{x:1248,y:7512,w:1152,h:96,type:'pit'},{x:3136,y:7488,w:160,h:112,type:'control'},{x:1536,y:8056,w:512,h:80,type:'stand'},{x:2960,y:8672,w:480,h:96,type:'stand'}];
export function applyCircuit(W,CODE){
 W.circuit=CIRCUIT;
 const hit=p=>p.x+(p.w||p.r||0)>CIRCUIT.x&&p.x-(p.r||0)<CIRCUIT.x+CIRCUIT.w&&p.y+(p.h||p.r||0)>CIRCUIT.y&&p.y-(p.r||0)<CIRCUIT.y+CIRCUIT.h;
 for(const key of ['buildings','trees','lamps','props','features','lots','parking','pools'])W[key]=W[key].filter(p=>!hit(p));
 // Internal grid streets are removed all the way to the surrounding boulevards.
 W.roads=W.roads.flatMap(s=>{const min=s.v?500:7300,max=s.v?3840:9000;if(s.c<=min||s.c>=max)return [s];const a=s.v?7300:500,b=s.v?9000:3840;if(s.b<=a||s.a>=b)return [s];return [{...s,b:Math.min(a,s.b)},{...s,a:Math.max(b,s.a)}].filter(r=>r.b-r.a>=180);});
 W.inter=W.inter.filter(n=>!(n.x>500&&n.x<3840&&n.y>7300&&n.y<9000));
 W.signals=W.signals.filter(n=>!inCircuit(n.x,n.y,64));
 W.inter=[];for(const v of W.roads)if(v.v)for(const h of W.roads)if(!h.v&&h.c>=v.a&&h.c<=v.b&&v.c>=h.a&&v.c<=h.b)W.inter.push({x:v.c,y:h.c,vs:v,hs:h});
 W.signals=W.signals.filter(n=>W.inter.some(i=>i.x===n.x&&i.y===n.y)||n.x<4096&&n.y<4096);
 W.fill(608,7408,3136,1488,CODE.grass);
 // Rasterize only segment envelopes, instead of scanning the whole circuit
 // against every segment. This keeps mobile world startup bounded.
 for(const a of TRACK){
  const x0=Math.floor((Math.min(a.x,a.x+a.dx)-112)/16)*16,x1=Math.ceil((Math.max(a.x,a.x+a.dx)+112)/16)*16;
  const y0=Math.floor((Math.min(a.y,a.y+a.dy)-112)/16)*16,y1=Math.ceil((Math.max(a.y,a.y+a.dy)+112)/16)*16;
  for(let y=y0;y<y1;y+=16)for(let x=x0;x<x1;x+=16){const t=Math.max(0,Math.min(1,((x+8-a.x)*a.dx+(y+8-a.y)*a.dy)/(a.len*a.len))),d2=(x+8-a.x-a.dx*t)**2+(y+8-a.y-a.dy*t)**2;
   if(d2<68*68)W.fill(x,y,16,16,CODE.track);else if(d2<112*112)W.fill(x,y,16,16,CODE.sand,c=>c!==CODE.track);
  }
 }
 W.fill(1152,7616,2690,96,CODE.lot);W.fill(2640,7616,128,288,CODE.lot);
 for(const b of buildings)W.fill(b.x,b.y,b.w,b.h,CODE.build);
 // Physical perimeter, with a deliberate eastern entrance.
 for(const r of [{x:656,y:7456,w:3072,h:16},{x:656,y:8896,w:3072,h:16},{x:656,y:7456,w:16,h:1456},{x:3712,y:7456,w:16,h:160},{x:3712,y:7712,w:16,h:1200}])W.fill(r.x,r.y,r.w,r.h,CODE.build);
}
function path(c){c.beginPath();c.moveTo(TRACK[0].x,TRACK[0].y);for(const p of TRACK)c.lineTo(p.x,p.y);c.closePath();}
function paintCircuit(c,view,pats={}){
 if(CIRCUIT.x>view.x1||CIRCUIT.y>view.y1||CIRCUIT.x+CIRCUIT.w<view.x0||CIRCUIT.y+CIRCUIT.h<view.y0)return;
 c.save();c.beginPath();c.rect(CIRCUIT.x,CIRCUIT.y,CIRCUIT.w,CIRCUIT.h);c.clip();
 c.fillStyle=pats.grass||'#526247';c.fillRect(CIRCUIT.x,CIRCUIT.y,CIRCUIT.w,CIRCUIT.h);
 c.fillStyle='rgba(170,179,119,.10)';for(let y=CIRCUIT.y;y<8912;y+=48)c.fillRect(656,y,3072,24);
 c.lineJoin='round';c.lineCap='round';path(c);c.strokeStyle=pats.sand||'#b4a483';c.lineWidth=224;c.stroke();c.strokeStyle='#393f40';c.lineWidth=152;c.stroke();c.strokeStyle='#ddd8c5';c.lineWidth=144;c.stroke();c.setLineDash([24,24]);c.strokeStyle='#b6463a';c.stroke();c.setLineDash([]);c.strokeStyle=pats.asphalt||'#30373b';c.lineWidth=136;c.stroke();c.strokeStyle='rgba(31,39,43,.35)';c.stroke();
 // Rubber line is subtle and baked into each visible ground chunk once.
 c.strokeStyle='rgba(15,20,24,.27)';c.lineWidth=9;c.stroke();
 c.fillStyle='#434d50';c.fillRect(1152,7616,2576,96);c.fillRect(2640,7616,128,288);
 c.strokeStyle='#cfbf7f';c.lineWidth=2;c.setLineDash([18,18]);c.beginPath();c.moveTo(1200,7670);c.lineTo(3712,7670);c.stroke();c.setLineDash([]);
 for(let x=1260;x<2400;x+=144){c.strokeStyle='#c0c6ba';c.strokeRect(x,7618,100,48);c.fillStyle='#d4cfb2';c.font='bold 13px sans-serif';c.fillText('PIT '+(1+(x-1260)/144),x+12,7650);}
 for(const b of buildings){c.fillStyle='#14242d';c.fillRect(b.x+6,b.y+7,b.w,b.h);c.fillStyle=b.type==='stand'?'#758687':'#465c64';c.fillRect(b.x,b.y,b.w,b.h);c.strokeStyle='#a2afb1';c.lineWidth=2;for(let y=b.y+9;y<b.y+b.h;y+=10){c.beginPath();c.moveTo(b.x+5,y);c.lineTo(b.x+b.w-5,y);c.stroke();}c.fillStyle='#e4ddba';c.textAlign='center';c.font='bold 15px sans-serif';c.fillText(b.type==='pit'?'BUGATTI  /  CROWN CIRCUIT  /  PIT LANE':b.type==='control'?'RACE CONTROL':'GRANDSTAND',b.x+b.w/2,b.y+b.h-10);}
 for(let y=7792;y<7928;y+=12)for(let x=1392;x<1416;x+=12){c.fillStyle=((y-7792)/12+(x-1392)/12)%2?'#252b30':'#e3dfcd';c.fillRect(x,y,12,12);}
 for(let i=1;i<=7;i++){const p=trackPoint(length*i/8);c.save();c.translate(p.x,p.y);c.rotate(p.rot);c.strokeStyle='#a7c8bc';c.lineWidth=2;c.setLineDash([8,8]);c.beginPath();c.moveTo(-66,0);c.lineTo(66,0);c.stroke();c.setLineDash([]);c.fillStyle='#d9dbc4';c.font='bold 14px sans-serif';c.fillText('S'+i,82,0);c.restore();}
 for(const b of buildings.filter(b=>b.type==='stand')){for(let y=b.y+10;y<b.y+b.h-22;y+=12)for(let x=b.x+12;x<b.x+b.w-12;x+=14){c.fillStyle=((x+y)/2)%3?'#bd9a76':'#c6c7ab';c.fillRect(x,y,5,5);c.fillStyle=((x+y)/2)%4?'#293b4a':'#aa4e3c';c.fillRect(x-1,y+5,7,4);}}
 for(const y of [7490,8870])for(let x=740;x<3650;x+=144){c.fillStyle='#23382e';c.beginPath();c.ellipse(x+5,y+4,13,8,0,0,Math.PI*2);c.fill();c.fillStyle='#617e50';c.beginPath();c.arc(x,y,12,0,Math.PI*2);c.fill();}
 c.fillStyle='#c8d5ca';c.font='bold 15px sans-serif';c.textAlign='center';c.fillText('40 / PIT LIMIT',2860,7695);c.fillText('ENTRY  →',3480,7650);
 c.strokeStyle='#afb9b5';c.lineWidth=8;c.strokeRect(664,7464,3056,1440);c.fillStyle='#434d50';c.fillRect(3708,7616,20,96);
 c.restore();
}

// A mobile circuit image is 1536 × 728 (4.3 MiB); desktop uses the original
// resolution. Streamed tiles copy only their intersecting rectangle. Repeating
// the full curved path and grandstands for every tile caused frame spikes.
const artwork=new WeakMap();
export function drawCircuitGround(c,view,pats={},scale=1){
 const x=Math.max(view.x0,CIRCUIT.x),y=Math.max(view.y0,CIRCUIT.y),w=Math.min(view.x1,CIRCUIT.x+CIRCUIT.w)-x,h=Math.min(view.y1,CIRCUIT.y+CIRCUIT.h)-y;
 if(w<=0||h<=0)return;
 let cached=artwork.get(pats);
 if(!cached||cached.scale!==scale||cached.asphalt!==pats.asphalt||cached.grass!==pats.grass){
  if(cached){cached.retired=true;cached.bitmap?.close();cached.canvas.width=1;}
  const canvas=document.createElement('canvas');canvas.width=CIRCUIT.w*scale;canvas.height=CIRCUIT.h*scale;
  const a=canvas.getContext('2d');a.scale(scale,scale);a.translate(-CIRCUIT.x,-CIRCUIT.y);paintCircuit(a,{x0:CIRCUIT.x,y0:CIRCUIT.y,x1:CIRCUIT.x+CIRCUIT.w,y1:CIRCUIT.y+CIRCUIT.h},pats);
  cached={canvas,scale,asphalt:pats.asphalt,grass:pats.grass};artwork.set(pats,cached);
  // Immutable pixels avoid repeat canvas uploads on Android's canvas backend.
  if(typeof createImageBitmap==='function'){const entry=cached;createImageBitmap(canvas).then(bitmap=>{if(entry.retired)bitmap.close();else{entry.bitmap=bitmap;entry.canvas.width=1;}}).catch(()=>{});}
 }
 c.drawImage(cached.bitmap||cached.canvas,(x-CIRCUIT.x)*scale,(y-CIRCUIT.y)*scale,w*scale,h*scale,x,y,w,h);
}
