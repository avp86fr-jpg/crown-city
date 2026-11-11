/* Deterministic scenery. Install geometry before navigation; bake paint into ground chunks. */
const TAU=Math.PI*2;
const visible=(r,x,y,w,h)=>x<r.x1&&x+w>r.x0&&y<r.y1&&y+h>r.y0;
function box(c,x,y,w,h,col){c.fillStyle=col;c.fillRect(x,y,w,h);}
function oval(c,x,y,w,h,col){c.fillStyle=col;c.beginPath();c.ellipse(x,y,w,h,0,0,TAU);c.fill();}
function text(c,s,x,y,size,col='#dfd7b9'){c.fillStyle=col;c.font=`700 ${size}px system-ui`;c.textAlign='center';c.fillText(s,x,y);}
export function applyWorldDetails(W,{CODE}){
 const E=W.expansion;if(!E)return;
 // Restore road surfaces through the three cleared destination forecourts.
 for(const p of E.decor)if(['camp','fuel','rescue'].includes(p.kind))for(const s of W.roads){
  const x=s.v?s.c-s.w/2:s.a,y=s.v?s.a:s.c-s.w/2,w=s.v?s.w:s.b-s.a,h=s.v?s.b-s.a:s.w;
  const x0=Math.max(x,p.x),y0=Math.max(y,p.y),x1=Math.min(x+w,p.x+p.w),y1=Math.min(y+h,p.y+p.h);
  if(x1>x0&&y1>y0)W.fill(x0,y0,x1-x0,y1-y0,CODE.road);
 }
 // Continuous paved links across the former grass strip between apron and runway.
 E.airport={...E.airport,taxiways:[7250,8350,9750]};
 for(const x of E.airport.taxiways)W.fill(x-60,7580,120,80,CODE.lot);
 W.details={buildings:[],windsocks:[{x:7150,y:7360},{x:9700,y:7360}]};
 for(const b of [
  {x:11128,y:4892,w:144,h:64,name:'PINEWATCH / RANGERS',roof:'terra',wall:'tan'},
  {x:5720,y:9570,w:136,h:72,name:'RED MESA / SUPPLY',roof:'metal2',wall:'cream'},
  {x:11020,y:9488,w:148,h:56,name:'SIERRA / RESCUE',roof:'metal',wall:'white'},
 ]){
  const building={...b,hgt:20,kind:'outpost'};W.buildings.push(building);W.details.buildings.push(building);
  W.fill(b.x,b.y,b.w,b.h,CODE.build);E.obstacles.push({x:b.x,y:b.y,w:b.w,h:b.h,hgt:20});
 }
 // Two composed destinations replace unused terrain with readable buildings,
 // connected public forecourts and parking, rather than scattered random props.
 const overlaps=(a,b)=>a.x<b.x+b.w&&a.x+(a.w||0)>b.x&&a.y<b.y+b.h&&a.y+(a.h||0)>b.y;
 const site=(r,ground)=>{
  for(const key of ['buildings','trees','lots','features','pools'])W[key]=W[key].filter(p=>!overlaps({x:p.x-(p.r||0),y:p.y-(p.r||0),w:p.w||p.r*2||1,h:p.h||p.r*2||1},r));
  E.obstacles=E.obstacles.filter(p=>!overlaps(p,r));W.fill(r.x,r.y,r.w,r.h,ground);
 };
 site({x:7700,y:8260,w:1000,h:620},CODE.grass);
 site({x:11708,y:4490,w:490,h:550},CODE.grass);
 for(const b of [
  {x:7800,y:8310,w:800,h:180,name:'CROWN AIR / TERMINAL',roof:'metal2',wall:'cream',hgt:34},
  {x:11740,y:4520,w:180,h:100,name:'PINEWATCH / SUPPLY',roof:'terra',wall:'tan',hgt:22},
  {x:12000,y:4520,w:144,h:100,name:'PINEWATCH / LODGE',roof:'terra',wall:'tan',hgt:22},
 ]){const building={...b,kind:'outpost'};W.buildings.push(building);W.details.buildings.push(building);W.fill(b.x,b.y,b.w,b.h,CODE.build);E.obstacles.push({x:b.x,y:b.y,w:b.w,h:b.h,hgt:b.hgt});}
 for(const p of [
  {x:7700,y:8520,w:1000,h:350,entry:{x:8200,y:8910},name:'CROWN AIR / ARRIVALS',walkways:[{x:8226,y:8532,w:52,h:198}]},
  {x:11708,y:4700,w:490,h:320,entry:{x:11635,y:4870},name:'PINEWATCH / VILLAGE',walkways:[{x:11812,y:4700,w:36,h:178},{x:12054,y:4700,w:36,h:178}]},
 ]){W.fill(p.x,p.y,p.w,p.h,CODE.lot);W.lots.push({...p,k:'parking'});}
 // Pavement connects the village frontage to its shared court and road.
 W.fill(11708,4635,490,65,CODE.walk);W.fill(11664,4800,56,140,CODE.lot,c=>c!==CODE.road);
 W.fill(7830,8150,72,160,CODE.walk);W.fill(7800,8490,800,30,CODE.walk);
 W.places=[{name:'CROWN AIR TERMINAL',x:8200,y:8390},{name:'PINEWATCH VILLAGE',x:11940,y:4640}];
 // Small solid footprints match the visible tent bodies and fuel pumps.
 for(const p of [{x:11147,y:4975,w:53,h:50},{x:11257,y:4975,w:53,h:50},{x:5755,y:9687,w:20,h:30},{x:5817,y:9687,w:20,h:30}]){W.fill(p.x,p.y,p.w,p.h,CODE.build);E.obstacles.push({...p,hgt:12});}
}
function airport(c,W,r,pats){
 if(!visible(r,6580,7330,3420,640))return;
 const {runway,apron,taxiways=[]}=W.expansion.airport;
 c.save();c.beginPath();c.rect(apron.x,apron.y,apron.w,apron.h);c.clip();
 c.strokeStyle='rgba(24,41,42,.18)';c.lineWidth=1;c.beginPath();
 for(let x=apron.x;x<apron.x+apron.w;x+=120){c.moveTo(x,apron.y);c.lineTo(x,apron.y+apron.h);}
 for(let y=apron.y;y<apron.y+apron.h;y+=90){c.moveTo(apron.x,y);c.lineTo(apron.x+apron.w,y);}c.stroke();
 c.strokeStyle='#d9b966';c.lineWidth=3;c.beginPath();c.moveTo(apron.x,7660);c.lineTo(apron.x+apron.w,7660);c.stroke();
 for(let i=0;i<4;i++){
  const x=7470+i*450;c.beginPath();c.moveTo(x,7660);c.quadraticCurveTo(x+48,7660,x+48,7730);c.lineTo(x+48,7860);c.stroke();
  box(c,x+31,7860,34,3,'#ead6a1');text(c,'A'+(i+1),x+48,7900,17,'#e4d7b0');
 }
 c.strokeStyle='#c8c9b9';c.lineWidth=2;c.setLineDash([12,10]);c.beginPath();c.moveTo(apron.x,7930);c.lineTo(apron.x+apron.w,7930);c.stroke();c.setLineDash([]);
 for(let x=apron.x+250;x<apron.x+apron.w;x+=600)text(c,'SERVICE',x,7950,10,'#ddd4bb');c.restore();
 for(const [i,x] of taxiways.entries()){
  c.strokeStyle='#dfbd64';c.lineWidth=3;c.beginPath();c.moveTo(x,7500);c.lineTo(x,7618);c.quadraticCurveTo(x,7660,x+70,7660);c.stroke();
  for(const y of [7593,7598])box(c,x-48,y,96,2,'#ead5a0');
  for(let k=-45;k<47;k+=12)for(const y of [7605,7610])box(c,x+k,y,7,2,'#ead5a0');
  box(c,x-106,7614,44,20,'#282e2b');text(c,'A'+(i+1),x-84,7629,13,'#ebc357');
 }
 for(const [x,rot,num] of [[runway.x+172,Math.PI/2,'09'],[runway.x+runway.w-172,-Math.PI/2,'27']]){
  c.save();c.translate(x,7500);c.rotate(rot);box(c,-40,-24,80,50,pats.asphalt||'#3e4447');text(c,num,0,16,44,'#eeead7');c.restore();
 }
 c.strokeStyle='rgba(15,21,24,.22)';c.lineWidth=5;
 for(const x of [7100,9300])for(const off of [-25,-12,12,25]){c.beginPath();c.moveTo(x,7500+off);c.lineTo(x+200,7500+off+1);c.stroke();}
 for(let x=runway.x+30;x<runway.x+runway.w;x+=110)for(const y of [runway.y-5,runway.y+runway.h+5]){box(c,x-3,y-3,6,6,'#343e3d');box(c,x-1.5,y-1.5,3,3,'#e8e7c2');}
 for(const w of W.details.windsocks){oval(c,w.x+2,w.y+3,13,8,'#b9b292');oval(c,w.x,w.y,10,6,'#3b4845');}
}
function destinations(c,W,r){
 // These entrances sit beyond the roof footprint, so their identity survives
 // both the overhead mobile bake and desktop building projection.
 const canopy=(cx,y,w,col)=>{
  box(c,cx-w/2+4,y+6,w,24,'rgba(15,28,29,.22)');
  box(c,cx-w/2,y,w,22,col);box(c,cx-w/2,y,w,3,'#c9d8ce');
  for(let x=cx-w/2+16;x<cx+w/2;x+=32)box(c,x,y+3,2,16,'#294e53');
  box(c,cx-w/2,y+21,w,3,'#253f43');
 };
 const bench=(x,y)=>{box(c,x+2,y+2,42,12,'rgba(12,27,26,.18)');box(c,x,y,40,9,'#a88d64');for(const yy of [2,5])box(c,x,y+yy,40,1,'#d0b78b');box(c,x+4,y-2,3,13,'#41534f');box(c,x+33,y-2,3,13,'#41534f');};
 if(visible(r,7700,8490,1000,220)){
  box(c,7790,8508,820,24,'#b6b5a1');box(c,7790,8531,820,3,'#6d837d');
  // A pedestrian spine links arrivals to the parking aisle, with zebra paint
  // where it crosses that aisle. The central vehicle access remains open.
  box(c,8226,8532,52,112,'#adb4a4');
  for(let y=8644;y<8730;y+=13)box(c,8226,y,52,7,'#dddac0');
  canopy(8252,8500,220,'#557e85');
  box(c,8154,8501,196,20,'#243f46');text(c,'CROWN AIR',8252,8515,14,'#ece2be');
  text(c,'ARRIVALS  /  TERMINAL',8252,8530,9,'#e4dfc6');
  for(const x of [7820,8550]){bench(x,8512);box(c,x+64,8508,18,18,'#596c62');oval(c,x+73,8517,7,5,'#78966a');}
  for(const [x,label] of [[7980,'CITY TRANSFER'],[8440,'DEPARTURES']]){box(c,x-60,8508,120,17,'#405f60');text(c,label,x,8520,10,'#dedfc9');}
 }
 if(visible(r,11708,4635,490,250)){
  box(c,11708,4648,490,47,'#b2aa8c');box(c,11708,4693,490,3,'#6a7763');
  for(const [x,label,col] of [[11830,'PINEWATCH SUPPLY','#778c68'],[12072,'FOREST LODGE','#8a7960']]){
   canopy(x,4650,110,col);text(c,label,x,4690,10,'#243e36');
   box(c,x-18,4700,36,91,'#b4b198');for(let y=4796;y<4878;y+=13)box(c,x-18,y,36,7,'#d8d4b7');
  }
  bench(11942,4660);box(c,11720,4658,17,20,'#5c6e57');oval(c,11728,4668,7,6,'#7d9761');
  text(c,'PINEWATCH VILLAGE',11953,4752,14,'#d7d4b9');
 }
 for(const p of W.expansion.decor){if(!['camp','fuel','rescue'].includes(p.kind)||!visible(r,p.x-30,p.y-30,p.w+60,p.h+60))continue;
  c.save();c.translate(p.x,p.y);
  if(p.kind==='camp'){
   for(const [i,x] of [50,160].entries()){
    box(c,x-29,135,67,64,'#8c7351');for(let yy=140;yy<199;yy+=8)box(c,x-28,yy,64,1,'#b49768');
    c.strokeStyle='#aa9a75';c.lineWidth=1;c.beginPath();c.moveTo(x-33,196);c.lineTo(x,144);c.lineTo(x+40,196);c.stroke();
    c.fillStyle=i?'#bc9968':'#537b70';c.beginPath();c.moveTo(x-23,185);c.lineTo(x+2,135);c.lineTo(x+30,185);c.closePath();c.fill();
    c.fillStyle=i?'#80633e':'#355c56';c.beginPath();c.moveTo(x+2,135);c.lineTo(x+30,185);c.lineTo(x+8,180);c.closePath();c.fill();box(c,x-5,165,13,21,'#1f3331');
   }
   oval(c,230,198,20,15,'#666861');oval(c,230,198,13,9,'#303f38');for(let j=0;j<9;j++)oval(c,230+Math.cos(j*TAU/9)*17,198+Math.sin(j*TAU/9)*12,3,2,'#b0aa8a');
   box(c,185,92,39,21,'#9f8761');box(c,180,86,49,5,'#c1a277');box(c,180,116,49,5,'#c1a277');
   box(c,16,88,20,30,'#314f47');box(c,19,91,14,22,'#b1bf91');text(c,'TRAIL',26,105,5,'#365a4b');
   text(c,'PINEWATCH / TRAILHEAD',130,235,11,'#d8d3ad');
  }else if(p.kind==='fuel'){
   // Pumps leave the north/south highway and Fire's contact clear.
   box(c,305,88,116,76,'#9a8057');box(c,298,83,130,10,'#c7aa75');
   for(const x of [325,387]){box(c,x,127,20,30,'#d7b17a');box(c,x+3,130,14,10,'#243f42');box(c,x+5,142,10,2,'#e4e4c8');c.strokeStyle='#2b3838';c.lineWidth=2;c.beginPath();c.moveTo(x+19,133);c.quadraticCurveTo(x+32,160,x+25,162);c.stroke();}
   text(c,'FUEL / 24H',362,105,12,'#2b4440');for(let x=296;x<430;x+=24)box(c,x,167,12,3,'#e5be70');
   box(c,260,36,12,45,'#365350');text(c,'24',266,53,8);box(c,261,85,10,4,'#d0c5a2');
  }else{
   box(c,15,72,145,27,'#677a72');for(let x=20;x<155;x+=12)box(c,x,75,2,21,'#b5c2ab');
   box(c,26,31,16,4,'#e1d4ba');box(c,32,25,4,16,'#e1d4ba');
   for(const x of [30,74,118]){box(c,x,115,28,25,'#a99d7d');box(c,x+2,117,24,2,'#d5c5a0');c.strokeStyle='#59655d';c.lineWidth=1;c.strokeRect(x+4,120,20,17);}
   text(c,'SIERRA / RESCUE',83,164,11,'#e4dcc2');
  }c.restore();
 }
}
export function drawWorldDetails(c,W,r,pats,codeAt){
 if(!W.details)return;
 let seed=(Math.imul(r.x0|0,73856093)^Math.imul(r.y0|0,19349663))>>>0;
 const rnd=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
 // Botanical clusters and pebble fans break up repeated terrain. No per-frame particles.
 for(let i=0;i<65;i++){
  const x=r.x0+rnd()*512,y=r.y0+rnd()*512,code=codeAt(x,y);
  if(x>10400&&y<8400&&code===5){
   const green=['#436846','#66824a','#7e9251'][i%3];for(let j=0;j<5;j++){const a=j*2.4;oval(c,x+Math.cos(a)*10,y+Math.sin(a)*6,5,2.5,green);}
   if(i%5===0)for(let j=0;j<4;j++)oval(c,x+j*5-8,y+(j%2)*4,1.8,1.5,i%2?'#d4b6cc':'#d9d7ad');
  }else if(y>=9216&&(code===4||code===10)){
   if(i%3){for(let j=0;j<3;j++)oval(c,x+j*6,y+(j%2)*4,2+j,1.5,'rgba(84,71,56,.25)');}
   else{c.strokeStyle=x<8800?'#a99c68':'#8f9c7c';c.lineWidth=1;c.beginPath();for(let j=-2;j<=2;j++){c.moveTo(x,y);c.lineTo(x+j*3,y-5-Math.abs(j));}c.stroke();}
  }
 }
 airport(c,W,r,pats);destinations(c,W,r);
}
