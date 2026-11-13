/* Deterministic scenery. Install geometry before navigation; bake paint into ground chunks. */
const TAU=Math.PI*2;
const hash=(x,y)=>{let n=(Math.imul(x,73856093)^Math.imul(y,19349663))>>>0;n=Math.imul(n^(n>>>16),2246822507);return ((n^(n>>>13))>>>0)/4294967296;};
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
 E.airport={...E.airport,taxiways:[7250,8350,9750],taxiwayWidth:224,stands:E.aircraft.filter(s=>s.kind==='plane').map((s,i)=>({id:s.id,label:'A'+(i+1),x:s.x,y:s.y,w:244,h:184}))};
 for(const x of E.airport.taxiways)W.fill(x-112,7580,224,80,CODE.lot);
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
 // East highway stops: a roadhouse, a motel and a farm break up the scrub,
 // with tree-free crop fields. All names invented; nothing branded.
 site({x:10966,y:2560,w:400,h:340},CODE.grass);site({x:10520,y:6900,w:280,h:360},CODE.grass);site({x:11040,y:7180,w:470,h:520},CODE.grass);
 W.eastFields=[{x:11000,y:3320,w:460,h:420},{x:10320,y:5280,w:440,h:520},{x:11080,y:7420,w:400,h:250}];
 for(const f of W.eastFields)site(f,CODE.grass);
 for(const b of [
  {x:11010,y:2600,w:176,h:92,name:'ROADHOUSE / DINER',roof:'metal2',wall:'cream',hgt:20},
  {x:10560,y:6940,w:96,h:280,name:"DUSTY STAR / MOTEL",roof:'terra',wall:'tan',hgt:20},
  {x:11070,y:7210,w:120,h:90,name:'HOLLOW CREEK / FARM',roof:'terra',wall:'white',hgt:20},
  {x:11300,y:7200,w:150,h:110,name:'HOLLOW CREEK / BARN',roof:'metal',wall:'rust',hgt:26},
 ]){const building={...b,kind:'outpost'};W.buildings.push(building);W.details.buildings.push(building);W.fill(b.x,b.y,b.w,b.h,CODE.build);E.obstacles.push({x:b.x,y:b.y,w:b.w,h:b.h,hgt:b.hgt});}
 for(const p of [
  {x:10966,y:2716,w:380,h:170,entry:{x:10958,y:2800},name:'ROADHOUSE / PARKING'},
  {x:10676,y:6940,w:124,h:280,entry:{x:10804,y:7080},name:'DUSTY STAR / PARKING'},
 ]){W.fill(p.x,p.y,p.w,p.h,CODE.lot);W.lots.push({...p,k:'parking'});}
 W.places.push({name:'ROADHOUSE',x:11100,y:2660},{name:"DUSTY STAR MOTEL",x:10610,y:7080});
 // Small solid footprints match the visible tent bodies and fuel pumps.
 for(const p of [{x:11147,y:4975,w:53,h:50},{x:11257,y:4975,w:53,h:50},{x:5755,y:9687,w:20,h:30},{x:5817,y:9687,w:20,h:30}]){W.fill(p.x,p.y,p.w,p.h,CODE.build);E.obstacles.push({...p,hgt:12});}
}
function airport(c,W,r,pats){
 if(!visible(r,6580,7330,3420,640))return;
 const {runway,apron,taxiways=[],stands=[]}=W.expansion.airport;
 c.save();c.beginPath();c.rect(apron.x,apron.y,apron.w,apron.h);c.clip();
 c.strokeStyle='rgba(24,41,42,.18)';c.lineWidth=1;c.beginPath();
 for(let x=apron.x;x<apron.x+apron.w;x+=120){c.moveTo(x,apron.y);c.lineTo(x,apron.y+apron.h);}
 for(let y=apron.y;y<apron.y+apron.h;y+=90){c.moveTo(apron.x,y);c.lineTo(apron.x+apron.w,y);}c.stroke();
 c.strokeStyle='#d9b966';c.lineWidth=3;c.beginPath();c.moveTo(apron.x,7660);c.lineTo(apron.x+apron.w,7660);c.stroke();
 for(const s of stands){
  c.strokeStyle='#c5ae70';c.lineWidth=2;c.beginPath();c.moveTo(s.x-48,7660);c.quadraticCurveTo(s.x,7660,s.x,7710);c.lineTo(s.x,s.y+78);c.stroke();
  box(c,s.x-23,s.y-69,46,3,'#ead6a1');text(c,s.label,s.x,s.y+100,18,'#e4d7b0');
  // Wing-clearance corners and a numbered stop bar match the parked aircraft.
  c.strokeStyle='rgba(222,214,187,.7)';c.lineWidth=1.5;c.beginPath();
  for(const side of [-1,1]){c.moveTo(s.x+side*118,s.y-76);c.lineTo(s.x+side*118,s.y+72);c.lineTo(s.x+side*90,s.y+72);}c.stroke();
  for(const side of [-1,1]){box(c,s.x+side*134-12,s.y+98,24,3,'#d1bc7d');box(c,s.x+side*134-1,s.y+89,2,12,'#d1bc7d');}
 }
 c.strokeStyle='#c8c9b9';c.lineWidth=2;c.setLineDash([12,10]);c.beginPath();c.moveTo(apron.x,7930);c.lineTo(apron.x+apron.w,7930);c.stroke();c.setLineDash([]);
 for(let x=apron.x+250;x<apron.x+apron.w;x+=600)text(c,'SERVICE',x,7950,10,'#ddd4bb');c.restore();
 for(const [i,x] of taxiways.entries()){
  c.strokeStyle='#dfbd64';c.lineWidth=3;c.beginPath();c.moveTo(x,7500);c.lineTo(x,7618);c.quadraticCurveTo(x,7660,x+70,7660);c.stroke();
  for(const y of [7593,7598])box(c,x-100,y,200,2,'#ead5a0');
  for(let k=-96;k<99;k+=12)for(const y of [7605,7610])box(c,x+k,y,7,2,'#ead5a0');
  box(c,x-164,7614,54,20,'#282e2b');text(c,'T'+(i+1),x-137,7629,13,'#ebc357');
  box(c,x+112,7586,68,23,'#8e443c');text(c,'09—27',x+146,7602,12,'#f2e5c7');
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
// Patches use world coordinates rather than a chunk seed. Adjacent tiles paint
// the same complete shape across their shared edge, without a visible seam.
// Entire bounding boxes must be natural ground, protecting narrow roads and
// destination courts as well as the centre of each decorative patch.
export function frontierFloorPatches(r,codeAt){
 if(r.x1<8800||r.x1<10400&&r.y1<9216)return [];
 const patches=[];
 for(let gy=Math.floor((r.y0-100)/192);gy<=Math.floor((r.y1+100)/192);gy++)for(let gx=Math.floor((r.x0-100)/192);gx<=Math.floor((r.x1+100)/192);gx++){
  const n=hash(gx,gy),x=gx*192+40+hash(gx+71,gy)*100,y=gy*192+40+hash(gx,gy+53)*100;
  const forest=x>=10400&&y<8400,mountain=x>=10400&&y>=8400||x>=8800&&y>=9216;if(!forest&&!mountain)continue;
  const rx=forest?46+n*48:60+n*38,ry=forest?28+n*26:35+n*30;
  if(x+rx<r.x0||x-rx>r.x1||y+ry<r.y0||y-ry>r.y1)continue;
  let safe=true;for(let yy=Math.floor((y-ry)/16)*16;safe&&yy<=y+ry;yy+=16)for(let xx=Math.floor((x-rx)/16)*16;xx<=x+rx;xx+=16){if(codeAt(xx+8,yy+8)!==(forest?5:10)){safe=false;break;}}
  if(safe)patches.push({x,y,rx,ry,n,forest});
 }
 return patches;
}
function frontierFloor(c,r,codeAt){
 for(const p of frontierFloorPatches(r,codeAt)){
  const {x,y,rx,ry,n,forest}=p;c.save();
  c.fillStyle=forest?'rgba(151,133,83,.14)':'rgba(183,165,129,.16)';c.beginPath();
  for(let i=0;i<12;i++){const a=i*TAU/12,k=.8+hash(i,Math.floor(x+y))*.2,px=x+Math.cos(a)*rx*k,py=y+Math.sin(a)*ry*k;i?c.lineTo(px,py):c.moveTo(px,py);}c.closePath();c.fill();
  if(!forest){
   // Low, weathered strata are surface markings, not uncollidable boulders.
   c.strokeStyle='rgba(56,76,72,.2)';c.lineWidth=2;c.beginPath();
   for(let j=-1;j<=1;j++){c.moveTo(x-rx*.55,y+ry*j*.34);c.bezierCurveTo(x-rx*.12,y+ry*(j*.34-.28),x+rx*.18,y+ry*(j*.34+.3),x+rx*.56,y+ry*j*.34);}c.stroke();
   c.strokeStyle='rgba(230,222,194,.22)';c.lineWidth=1;c.beginPath();c.moveTo(x-rx*.55,y-2);c.quadraticCurveTo(x,y-ry*.3,x+rx*.56,y-2);c.stroke();
  }else{
   c.strokeStyle='rgba(184,159,104,.35)';c.lineWidth=1;c.beginPath();
   for(let j=0;j<9;j++){const px=x+(hash(j,Math.floor(x))- .5)*rx,py=y+(hash(j,Math.floor(y))-.5)*ry;c.moveTo(px-3,py);c.lineTo(px+3,py+2+n*2);}c.stroke();
  }c.restore();
 }
}
function roadside(c,W,r,codeAt){
 for(const s of W.roads){
  if(s.k!=='frontier')continue;
  const lo=Math.max(s.a+90,Math.floor((s.v?r.y0:r.x0)/144)*144),hi=Math.min(s.b-90,s.v?r.y1:r.x1);
  if(s.c<(s.v?r.x0:r.y0)-100||s.c>(s.v?r.x1:r.y1)+100)continue;
  for(let d=Math.ceil(lo/144)*144;d<=hi;d+=144)for(const side of [-1,1]){
   const across=s.c+side*(s.w/2+14),x=s.v?across:d,y=s.v?d:across;
   if(codeAt(x,y)!==10||W.roads.some(o=>o!==s&&(o.v?Math.abs(x-o.c)<o.w/2+55&&y>=o.a-55&&y<=o.b+55:Math.abs(y-o.c)<o.w/2+55&&x>=o.a-55&&x<=o.b+55)))continue;
   box(c,x-2,y-3,5,8,'#555e53');box(c,x-2,y-5,4,7,'#d3cdb0');box(c,x-2,y-4,4,2,side<0?'#ad6651':'#e2ba6d');
  }
 }
}

// Far-east frontier dressing: power lines, ranch fences, farm tracks, crop
// fields in tree-free clearings and unbranded roadside signs, so the long
// highway through the scrub reads as lived-in country rather than filler.
const EAST_SIGNS=['PINEWATCH  2','FRESH PEACHES','LUCKY ISLE  ←','MOTEL · VACANCY','CITY LIMITS','REST AREA  1'];
function eastland(c,W,r,codeAt){
 if(r.x1<10000)return;
 const open=(x,y)=>{const k=codeAt(x,y);return k===5||k===10;};
 const clearOfTrees=(x,y,w,h)=>!W.trees.some(t=>t.x>x-14&&t.x<x+w+14&&t.y>y-14&&t.y<y+h+14);
 for(const s of W.roads){
  if(s.k!=='frontier'||!s.v||s.c<10000)continue;
  if(s.c<r.x0-620||s.c>r.x1+620)continue;
  const px=s.c+s.w/2+62,fx=s.c-s.w/2-104;
  // power line: poles every 220 with cross-arms; three wires between them
  const p0=Math.max(s.a+60,Math.floor((r.y0-220)/220)*220),p1=Math.min(s.b-60,r.y1+220);
  c.strokeStyle='rgba(28,26,22,.7)';c.lineWidth=1.3;
  for(const o of [-7,0,7]){c.beginPath();c.moveTo(px+o,p0);c.lineTo(px+o,p1);c.stroke();}
  c.strokeStyle='rgba(0,0,0,.12)';c.lineWidth=1.4;for(const o of [-7,0,7]){c.beginPath();c.moveTo(px+o+16,p0+20);c.lineTo(px+o+16,p1+20);c.stroke();}
  for(let y=Math.ceil(p0/220)*220;y<=p1;y+=220){if(!open(px,y))continue;
   c.fillStyle='rgba(0,0,0,.28)';c.fillRect(px+4,y+6,34,5);c.fillStyle='#4a3826';c.beginPath();c.arc(px,y,5,0,Math.PI*2);c.fill();c.fillStyle='#6d5a43';c.fillRect(px-13,y-2.5,26,5);c.fillStyle='#d9d3c1';for(const o of [-11,0,11])c.fillRect(px+o-1.5,y-3,3,3);}
  // ranch fence on the other verge
  c.fillStyle='rgba(0,0,0,.18)';
  for(let y=Math.ceil(r.y0/36)*36;y<=r.y1;y+=36){if(y<s.a+80||y>s.b-80||!open(fx,y))continue;c.fillStyle='rgba(0,0,0,.2)';c.fillRect(fx+2,y+3,4,4);c.fillStyle='#6f5236';c.fillRect(fx-3,y-3,6,6);c.fillStyle='#a4825a';c.fillRect(fx-1.5,y-1,3,36);c.fillStyle='rgba(0,0,0,.16)';c.fillRect(fx+2,y+2,2,36);}
  // farm tracks branching off every ~960 with rutted tyre lines
  for(let y=Math.ceil((r.y0-500)/960)*960+300;y<=r.y1+500;y+=960){if(y<s.a+200||y>s.b-200)continue;
   const dir=((y/960)|0)%2?1:-1,x0=s.c+dir*(s.w/2+4),len=520;
   c.strokeStyle='rgba(150,122,82,.55)';c.lineWidth=18;c.lineCap='round';c.beginPath();c.moveTo(x0,y);c.bezierCurveTo(x0+dir*160,y+30,x0+dir*260,y-90,x0+dir*len,y-60);c.stroke();
   c.strokeStyle='rgba(96,74,48,.45)';c.lineWidth=2.2;for(const o of [-5,5]){c.beginPath();c.moveTo(x0,y+o);c.bezierCurveTo(x0+dir*160,y+30+o,x0+dir*260,y-90+o,x0+dir*len,y-60+o);c.stroke();}c.lineCap='butt';
  }
  // roadside signs every 1500
  for(let y=Math.ceil((r.y0-80)/1500)*1500+700;y<=r.y1+80;y+=1500){if(y<s.a+200||y>s.b-200)continue;const sx=s.c-s.w/2-40;if(!open(sx,y))continue;
   const t=EAST_SIGNS[((y/1500)|0)%EAST_SIGNS.length];c.fillStyle='rgba(0,0,0,.25)';c.fillRect(sx-30,y+6,70,16);c.fillStyle='#4f4436';c.fillRect(sx-4,y+12,3,10);c.fillRect(sx+22,y+12,3,10);
   c.fillStyle=t.includes('LIMITS')?'#2f6b4f':'#e7dcc2';c.fillRect(sx-34,y-4,70,16);c.strokeStyle='#3a3328';c.lineWidth=1.5;c.strokeRect(sx-34,y-4,70,16);
   c.fillStyle=t.includes('LIMITS')?'#f1ead4':'#3a2f22';c.font='800 8px system-ui';c.textAlign='center';c.textBaseline='middle';c.fillText(t,sx+1,y+4);c.textAlign='left';c.textBaseline='alphabetic';}
 }
 // crop fields and hay bales in the cleared plots
 for(const [i,F] of (W.eastFields||[]).entries()){const {x,y,w,h:hh}=F;if(x>r.x1||x+w<r.x0||y>r.y1||y+hh<r.y0)continue;
  let h=(i*2654435761)>>>0;const rn=()=>((h=(Math.imul(h,1664525)+1013904223)>>>0)/4294967296);
  const crop=i%3;c.fillStyle=crop===0?'#b89b55':crop===1?'#7f8f45':'#9c7448';c.fillRect(x+10,y+10,w-20,hh-20);
  c.fillStyle='rgba(0,0,0,.12)';const vert=i%2===0;for(let q=10;q<(vert?w:hh)-10;q+=10)vert?c.fillRect(x+q,y+10,3,hh-20):c.fillRect(x+10,y+q,w-20,3);
  c.strokeStyle='#7a5c3c';c.lineWidth=3;c.strokeRect(x+10,y+10,w-20,hh-20);
  if(crop===0)for(let k=0;k<9;k++){const bx=x+30+rn()*(w-60),by=y+30+rn()*(hh-60);c.fillStyle='rgba(0,0,0,.24)';c.beginPath();c.arc(bx+3,by+4,8,0,Math.PI*2);c.fill();c.fillStyle='#d8b964';c.beginPath();c.arc(bx,by,8,0,Math.PI*2);c.fill();c.strokeStyle='rgba(140,100,40,.6)';c.lineWidth=1;c.beginPath();c.arc(bx,by,4.5,0,Math.PI*2);c.stroke();}
 }
}
export function drawWorldDetails(c,W,r,pats,codeAt){
 if(!W.details)return;
 frontierFloor(c,r,codeAt);roadside(c,W,r,codeAt);eastland(c,W,r,codeAt);
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
