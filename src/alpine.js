/* Crown Peak: an alpine annex below the southern frontier (y >= 10240).
   Collision lives in its own grid (W.south); all static scenery is painted
   once into cached 512px chunks. Only smoke, the lift, snowfall and night
   lights animate per frame. */
export const SOUTH = 3072;
const H0 = 10240, TAU = Math.PI*2;
export const PEAK_BOUNDS = Object.freeze({x0:4608,y0:9728,x1:12288,y1:H0+SOUTH});
const RW = 144;
// Plowed mountain roads: the village loop and one switchback climb to the summit.
const LOOP = [[9216,9872],[9216,10816],[10624,10816],[10624,9872]];
const CLIMB = [[10624,10816],[10624,11392],[8448,11392],[8448,11904],[10368,11904],[10368,12416],[8960,12416],[8960,12800],[9984,12800]];
// Painted as two strokes so the T-junction at the lift base stays square.
const PAINT_PATHS = [[[9216,9872],[9216,10816],[10624,10816]],[[10624,9872],...CLIMB]];
const PLAZA = Object.freeze({x:9984,y:12664,w:330,h:272});
const LAKE = Object.freeze({cx:8330,cy:10800,rx:520,ry:290});
const OBS = Object.freeze({x:10149,y:13050,r:74});
// Guardrails on the downhill and outer side of every hairpin.
const RAILS = [
 [[10716,10900],[10716,11484],[10380,11484]],
 [[10530,11300],[8356,11300],[8356,11996],[8660,11996]],
 [[8560,11812],[10460,11812],[10460,12508],[10180,12508]],
 [[10276,12324],[8868,12324],[8868,12892],[9900,12892]],
];
const ICE = [[8520,11470,70,30],[10300,11830,64,26],[9020,12360,80,28],[10560,11330,60,24],[9500,11392,90,22],[9700,12800,70,22]];
const LIFT = [[10480,10990],[10380,11660],[10290,12280],[10430,13010]];
export const PEAK_CACHES = [{x:9930,y:10640,v:40},{x:8330,y:10800,v:60},{x:8250,y:11650,v:45},{x:10200,y:12990,v:75}];
const coastX = y => 5160+90*Math.sin(y/310)+50*Math.sin(y/97+1.3);
function rng(seed){let s=seed>>>0;return()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};}
function hash(x,y){let h=Math.imul(x|0,374761393)+Math.imul(y|0,668265263);h=Math.imul(h^h>>>13,1274126177);return ((h^h>>>16)>>>0)/4294967296;}
function vnoise(x,y){const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy,u=fx*fx*(3-2*fx),v=fy*fy*(3-2*fy);
 const a=hash(ix,iy),b=hash(ix+1,iy),c=hash(ix,iy+1),d=hash(ix+1,iy+1);return a+(b-a)*u+(c-a)*v+(a-b-c+d)*u*v;}
// Terrain height (for hill shading only): a massif rising to the summit, with ridges.
function height(x,y){
 const dx=(x-10150)/2300,dy=(y-13050)/1900,peak=Math.exp(-(dx*dx+dy*dy))*1;
 const rise=Math.max(0,Math.min(1,(y-H0)/2800))*.6;
 const n=vnoise(x/420,y/420)*.22+vnoise(x/160,y/160)*.08+Math.abs(Math.sin(x/530+y/900))*.12;
 return peak+rise+n;
}
const segRects = (pts,w)=>{const out=[];for(let i=1;i<pts.length;i++){const [ax,ay]=pts[i-1],[bx,by]=pts[i];
 const x0=Math.min(ax,bx)-w/2,x1=Math.max(ax,bx)+w/2,y0=Math.min(ay,by)-w/2,y1=Math.max(ay,by)+w/2;out.push({x:x0,y:y0,w:x1-x0,h:y1-y0});}return out;};
const inR=(x,y,r,m=0)=>x>=r.x-m&&x<=r.x+r.w+m&&y>=r.y-m&&y<=r.y+r.h+m;
const hits=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
const lakeV=(x,y)=>((x-LAKE.cx)/LAKE.rx)**2+((y-LAKE.cy)/LAKE.ry)**2;

/* ------------------------------------------------------------ world build */
export function applyAlpine(W,{CELL,GW,GH,CODE,WORLD_W,WORLD_H}){
 const SR=SOUTH/CELL,south=new Uint8Array(GW*SR).fill(CODE.grass);W.south=south;W.southRows=SR;
 const fillAny=(x,y,w,h,code,onlyIf)=>{
  const x0=Math.max(0,Math.floor(x/CELL)),x1=Math.min(GW,Math.ceil((x+w)/CELL));
  const y0=Math.max(0,Math.floor(y/CELL)),y1=Math.min(GH+SR,Math.ceil((y+h)/CELL));
  for(let cy=y0;cy<y1;cy++)for(let cx=x0;cx<x1;cx++){
   if(cy>=GH){const i=(cy-GH)*GW+cx;if(onlyIf&&!onlyIf(south[i]))continue;south[i]=code;}
   else{const i=cy*GW+cx;if(onlyIf&&!onlyIf(W.grid[i]))continue;W.grid[i]=code;}
  }
 };
 const codeAny=(x,y)=>{const cx=Math.floor(x/CELL),cy=Math.floor(y/CELL);if(cx<0||cx>=GW||cy<0||cy>=GH+SR)return -1;return cy>=GH?south[(cy-GH)*GW+cx]:W.grid[cy*GW+cx];};
 // sea to the west, a rock wall at the far east edge
 for(let cy=GH;cy<GH+SR;cy++){const y=cy*CELL+8,cx0=Math.ceil(coastX(y)/CELL);for(let cx=0;cx<Math.min(GW,cx0);cx++)south[(cy-GH)*GW+cx]=CODE.water;
  const east=11920+80*Math.sin(y/260);for(let cx=Math.floor(east/CELL);cx<GW;cx++)south[(cy-GH)*GW+cx]=CODE.build;}
 for(let cy=GH+SR-6;cy<GH+SR;cy++)for(let cx=0;cx<GW;cx++)if(south[(cy-GH)*GW+cx]!==CODE.water)south[(cy-GH)*GW+cx]=CODE.build;
 const A=W.alpine={bounds:PEAK_BOUNDS,loop:LOOP,climb:CLIMB,plaza:PLAZA,lake:LAKE,obs:OBS,rails:RAILS,ice:ICE,lift:LIFT,chalets:[],pines:[],cliffs:[],props:[],codeAny,coastX};
 const rnd=rng(31337);
 // Entry roads cross the southern frontier strip: clear its scenery first.
 const roadRects=[...segRects(LOOP,RW),...segRects(CLIMB,RW)];
 const clearZone=roadRects.map(r=>({x:r.x-30,y:r.y-30,w:r.w+60,h:r.h+60}));
 const touching=p=>{const r=p.r||0,w=p.w||r*2||1,h=p.h||r*2||1,a={x:p.x-r,y:p.y-r,w,h},b={x:p.x-w/2,y:p.y-h/2,w,h};return clearZone.some(z=>hits(z,a)||hits(z,b));};
 for(const key of ['buildings','trees','parking','lots','features','lamps','pools','props'])if(Array.isArray(W[key]))W[key]=W[key].filter(p=>p.y<9700||!touching(p));
 if(W.expansion){for(const key of ['decor','obstacles'])if(Array.isArray(W.expansion[key]))W.expansion[key]=W.expansion[key].filter(p=>p.y<9700||!touching(p));}
 if(W.expansion?.decor){const near=d=>d.kind==='rock'&&d.y>9850&&[9216,10624].some(x=>Math.abs(d.x-x)<(d.w||0)/2+340);
  for(const d of W.expansion.decor.filter(near))fillAny(d.x-d.w/2-20,d.y-d.h/2-20,d.w+40,d.h+40,CODE.dirt,c=>c===CODE.build);
  W.expansion.decor=W.expansion.decor.filter(d=>!near(d));W.expansion.obstacles=(W.expansion.obstacles||[]).filter(o=>!(o.y>9850&&o.y<10240&&[9216,10624].some(x=>Math.abs(o.x+o.w/2-x)<330)));}
 // district fit: no cacti in the snow band, desert scrub thins out before the snowline
 if(W.expansion?.decor)W.expansion.decor=W.expansion.decor.filter(d=>!(d.kind==='cactus'&&d.y>9950||d.kind==='scrub'&&d.y>10080));
 // painted decor is drawn from spatial bins: drop removed items there too
 if(W.expansion?.decorBins){const keep=new Set(W.expansion.decor);for(const [k,arr] of W.expansion.decorBins)W.expansion.decorBins.set(k,arr.filter(p=>keep.has(p)));}
 // lake ice (drivable, slick), then roads, plaza
 for(let y=LAKE.cy-LAKE.ry;y<LAKE.cy+LAKE.ry;y+=CELL)for(let x=LAKE.cx-LAKE.rx;x<LAKE.cx+LAKE.rx;x+=CELL)if(lakeV(x+8,y+8)<1)fillAny(x,y,CELL,CELL,CODE.lot);
 // village pavements: boardwalks either side of the main street
 fillAny(9300,10704,1250,40,CODE.walk);fillAny(9300,10888,1250,40,CODE.walk);
 for(const r of roadRects)fillAny(r.x,r.y,r.w,r.h,CODE.road);
 fillAny(PLAZA.x,PLAZA.y,PLAZA.w,PLAZA.h,CODE.road);
 // the flagstone viewpoint below the parking apron is a pedestrian terrace
 fillAny(PLAZA.x+8,PLAZA.y+222,PLAZA.w-16,PLAZA.h-230,CODE.walk); // flagstone strip south of the turnaround road
 const segs=[];const push=(pts)=>{for(let i=1;i<pts.length;i++){const [ax,ay]=pts[i-1],[bx,by]=pts[i];const v=ax===bx;
  segs.push(v?{v:true,c:ax,a:Math.min(ay,by)-(ay===9872||by===9872?72:0),b:Math.max(ay,by),w:RW,lanes:1,med:0,k:'alpine'}:{v:false,c:ay,a:Math.min(ax,bx),b:Math.max(ax,bx),w:RW,lanes:1,med:0,k:'alpine'});}};
 push(LOOP);push(CLIMB);
 // de-duplicate the shared village corner segment
 W.roads.push(...segs);A.roads=segs;
 // guardrails (thin solid strips)
 for(const R of RAILS)for(let i=1;i<R.length;i++){const [ax,ay]=R[i-1],[bx,by]=R[i];fillAny(Math.min(ax,bx)-6,Math.min(ay,by)-6,Math.abs(bx-ax)+12,Math.abs(by-ay)+12,CODE.build,c=>c!==CODE.road);}
 // chalets around the village street (north and south rows)
 const woods=['#7a4a2a','#8d5a34','#5e3b22','#a36a3c','#6b4a38','#94603a'],trims=['#b23a2e','#2f5d3a','#1f3f66','#d9a43a','#efe9dc','#7b2f4a'],roofs=['#5b2c24','#3b4a3a','#4a3a30','#2f3b4f','#6a4a2a','#3f2f2a'];
 const rows=[{y0:10420,y1:10690,front:'S'},{y0:10950,y1:11230,front:'N'}];let id=0;
 for(const row of rows){let x=9320;while(x<10480){const w=170+Math.floor(rnd()*80),h=Math.min(row.y1-row.y0,170+Math.floor(rnd()*70));if(x+w>10540)break;
  const y=row.front==='S'?row.y1-h:row.y0,gable=rnd()<.4,C={x,y,w,h,fac:Math.round(h*.3),wood:woods[id%6],trim:trims[(id*5+2)%6],roof:roofs[(id*7+1)%6],gable,balcony:rnd()<.6,seed:rnd(),id,front:row.front,chimney:{x:x+w*(.2+rnd()*.6),y:y+h*(.18+rnd()*.25)}};
  // night windows (facade)
  const fy=row.front==='S'?y+h-C.fac:y,n=Math.max(2,Math.floor(w/52));C.win=[];for(let k=0;k<n;k++){const wx=x+14+k*(w-28)/n;if(k===Math.floor(n/2)&&row.front==='S')continue;C.win.push([wx+4,fy+C.fac*.28,(w-28)/n-10,C.fac*.42]);}
  A.chalets.push(C);fillAny(x,y,w,h,CODE.build);id++;x+=w+40+Math.floor(rnd()*40);}}
 // parked cars on the drive pads between chalets
 A.cars=[];const carCols=['#b23a2e','#1f3f66','#e0b040','#2f5d3a','#d8d8d8','#4a4a52'];
 for(let i=1;i<A.chalets.length;i++){const a=A.chalets[i-1],b=A.chalets[i];if(a.front!==b.front)continue;const gap=b.x-(a.x+a.w);if(gap<44)continue;
  const x=a.x+a.w+gap/2,y=a.front==='S'?10640:10992;A.cars.push({x,y,col:carCols[i%6],seed:rnd()});fillAny(x-14,y-25,28,50,CODE.build);}
 // a rental hut and the village sign
 A.hut={x:9220+90,y:10950,w:0,h:0};A.sign={x:9216,y:10180};
 // cliffs and outcrops on the slopes between switchback runs
 const roadNear=(x,y,m)=>roadRects.some(r=>inR(x,y,r,m))||inR(x,y,PLAZA,m);
 const railNear=(x,y,m)=>RAILS.some(R=>{for(let i=1;i<R.length;i++){const [ax,ay]=R[i-1],[bx,by]=R[i];if(x>=Math.min(ax,bx)-m&&x<=Math.max(ax,bx)+m&&y>=Math.min(ay,by)-m&&y<=Math.max(ay,by)+m)return true;}return false;});
 const addCliff=(x,y,rx,ry)=>{if(roadNear(x,y,Math.max(rx,ry)+40)||railNear(x,y,Math.max(rx,ry)+30)||lakeV(x,y)<1.6)return;const pts=[],n=9+Math.floor(rnd()*5);for(let k=0;k<n;k++){const a=k/n*TAU,j=.72+rnd()*.38;pts.push([x+Math.cos(a)*rx*j,y+Math.sin(a)*ry*j]);}A.cliffs.push({x,y,rx,ry,pts,seed:rnd()});fillAny(x-rx*.7,y-ry*.65,rx*1.4,ry*1.3,CODE.build);};
 for(const [y0,y1] of [[11520,11770],[12040,12290],[12560,12760]])for(let x=8640;x<10300;x+=150+rnd()*170)addCliff(x,y0+rnd()*(y1-y0),40+rnd()*60,26+rnd()*34);
 for(let y=10900;y<13200;y+=110+rnd()*90)addCliff(11120+rnd()*600,y,50+rnd()*70,40+rnd()*40);
 for(let x=7400;x<11800;x+=140+rnd()*140)addCliff(x,13140+rnd()*80,50+rnd()*60,34+rnd()*30);
 for(let i=0;i<26;i++)addCliff(5600+rnd()*2600,11400+rnd()*1800,40+rnd()*60,30+rnd()*40);
 // summit observatory (landmark), lift pylons
 fillAny(OBS.x-OBS.r*.8,OBS.y-OBS.r*.8,OBS.r*1.6,OBS.r*1.6,CODE.build);
 A.spots=A.chalets.map(C=>[C.x+C.w/2,C.front==='S'?C.y+C.h+34:C.y-34]).concat([[PLAZA.x+80,PLAZA.y+240],[PLAZA.x+PLAZA.w-90,PLAZA.y+245],[PLAZA.x+PLAZA.w/2,PLAZA.y+250],[PLAZA.x+40,PLAZA.y+235]]);
 A.pylons=[];for(let i=1;i<LIFT.length;i++){const [ax,ay]=LIFT[i-1],[bx,by]=LIFT[i];for(let t=0;t<1;t+=.34){const x=ax+(bx-ax)*t,y=ay+(by-ay)*t;if(roadNear(x,y,26)||railNear(x,y,20))continue;A.pylons.push({x,y});fillAny(x-8,y-8,16,16,CODE.build);}}
 const villageR={x:9150,y:10380,w:1560,h:880};
 const pineOK=(x,y)=>{if(y<H0+60||x<coastX(y)+120||x>11800||y>13230)return false;if(roadNear(x,y,48)||railNear(x,y,26)||lakeV(x,y)<1.25)return false;if(inR(x,y,villageR,0)&&!(x<9200||x>10690))return false;
  if(Math.hypot(x-OBS.x,y-OBS.y)<OBS.r+60)return false;if(A.cliffs.some(c=>Math.hypot((x-c.x)/(c.rx+18),(y-c.y)/(c.ry+18))<1))return false;if(A.pylons.some(p=>Math.hypot(p.x-x,p.y-y)<40))return false;
  for(let i=1;i<LIFT.length;i++){const [ax,ay]=LIFT[i-1],[bx,by]=LIFT[i],dx=bx-ax,dy=by-ay,t=Math.max(0,Math.min(1,((x-ax)*dx+(y-ay)*dy)/(dx*dx+dy*dy)));if(Math.hypot(x-ax-dx*t,y-ay-dy*t)<34)return false;}
  return true;};
 for(let i=0;i<26000&&A.pines.length<1700;i++){const x=5200+rnd()*6600,y=H0+40+rnd()*(SOUTH-120);const dens=vnoise(x/600,y/600);if(dens<.42||rnd()>dens*1.2)continue;if(!pineOK(x,y))continue;
  const r=16+rnd()*16+(dens>.7?6:0);if(A.pines.some(p=>Math.abs(p.x-x)<r+p.r*.6&&Math.abs(p.y-y)<r+p.r*.6))continue;A.pines.push({x,y,r,seed:rnd()});}
 for(const p of A.pines)fillAny(p.x-6,p.y-6,12,12,CODE.build,c=>c!==CODE.road);
 A.pines.sort((a,b)=>a.y-b.y);
 // village props (snowman, sleds, firewood) on open snow
 for(const [x,y,k] of [[9260,10620,'snowman'],[10560,11010,'wood'],[9960,10960,'sled'],[9600,10630,'wood'],[8000,10560,'snowman'],[8700,10760,'sled'],[10250,12640,'snowman'],[9330,10600,'snowmobile'],[9720,10950,'snowmobile'],[10120,12610,'snowmobile'],[10640,11060,'snowmobile'],[9880,10600,'skis'],[10330,12600,'skis'],[8060,10600,'skis']])if(!roadNear(x,y,30))A.props.push({x,y,k});
 // street lamps in the village and at the summit plaza
 for(let x=9300;x<10560;x+=210)for(const side of [-1,1])W.lamps.push({x,y:10816+side*100,v:false,side,alpine:true});
 for(const [x,y] of [[10000,12660],[10300,12660],[10000,12940],[10300,12940]])W.lamps.push({x,y,v:false,side:1,alpine:true});
 if(W.limits)W.limits.h+=SOUTH;
 if(W.expansion){(W.expansion.landmarks||(W.expansion.landmarks=[])).push({name:'CROWN PEAK',x:10150,y:12880},{name:'FROSTFALL',x:9920,y:10560},{name:'MIRROR LAKE',x:8330,y:10640});
  W.expansion.obstacles.push({x:OBS.x-OBS.r,y:OBS.y-OBS.r,w:OBS.r*2,h:OBS.r*2,hgt:70});}
 return A;
}
export function peakDistrict(x,y){if(y<H0)return null;return x<coastX(y)?'SOUTH SOUND':y>12200?'CROWN PEAK':x>9100&&x<10750&&y<11300?'FROSTFALL':'CROWN PEAK';}
// Grip multiplier on packed snow, ice and the frozen lake.
export function alpineGrip(G,x,y,surf){
 if(y<H0-60)return 1;const A=G.world.alpine;if(!A)return 1;
 if(surf==='lot'&&lakeV(x,y)<1)return .36;
 if(surf==='road'){for(const [ix,iy,rx,ry] of ICE)if(((x-ix)/rx)**2+((y-iy)/ry)**2<1)return .5;return .8;}
 return .72;
}

/* ------------------------------------------------------------ painting */
const SN={base:'#e9eff6',shade:'#c9d7e8',deep:'#a9bcd6',hi:'#fbfdff',rock:'#6c6a6e',rock2:'#8a8790',asphalt:'#363b43',sea:'#20465a'};
function canvas(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;return c;}
let ART=null;
function art(){if(ART)return ART;
 const snow=canvas(256,256),s=snow.getContext('2d');s.fillStyle=SN.base;s.fillRect(0,0,256,256);
 const r=rng(77);
 for(let i=0;i<70;i++){const x=r()*256,y=r()*256,rr=10+r()*34;for(const [ox,oy] of [[0,0],[256,0],[-256,0],[0,256],[0,-256],[256,256],[-256,-256],[256,-256],[-256,256]]){const g=s.createRadialGradient(x+ox,y+oy,0,x+ox,y+oy,rr);g.addColorStop(0,r()<.5?'rgba(196,212,232,.42)':'rgba(255,255,255,.55)');g.addColorStop(1,'rgba(220,230,242,0)');s.fillStyle=g;s.fillRect(x+ox-rr,y+oy-rr,rr*2,rr*2);}}
 s.strokeStyle='rgba(170,190,215,.28)';s.lineWidth=1.4;for(let i=0;i<26;i++){const x=r()*256,y=r()*256,l=20+r()*40;s.beginPath();s.moveTo(x,y);s.quadraticCurveTo(x+l*.5,y-4-r()*5,x+l,y+r()*3);s.stroke();s.strokeStyle='rgba(255,255,255,.6)';s.beginPath();s.moveTo(x,y+2);s.quadraticCurveTo(x+l*.5,y-2,x+l,y+4);s.stroke();s.strokeStyle='rgba(170,190,215,.28)';}
 for(let i=0;i<260;i++){const x=r()*256,y=r()*256;s.fillStyle=r()<.7?'rgba(255,255,255,.95)':'rgba(170,205,255,.9)';s.fillRect(x,y,r()<.15?2:1,1);}
 const rock=canvas(128,128),k=rock.getContext('2d');k.fillStyle=SN.rock;k.fillRect(0,0,128,128);
 for(let i=0;i<120;i++){k.fillStyle=`rgba(${r()<.5?'40,38,44':'150,146,150'},${.12+r()*.2})`;k.beginPath();k.ellipse(r()*128,r()*128,3+r()*10,2+r()*6,r()*3,0,TAU);k.fill();}
 k.strokeStyle='rgba(30,28,34,.45)';k.lineWidth=1.2;for(let i=0;i<14;i++){let x=r()*128,y=r()*128;k.beginPath();k.moveTo(x,y);for(let j=0;j<4;j++){x+=(r()-.5)*30;y+=r()*16;k.lineTo(x,y);}k.stroke();}
 const ice=canvas(256,256),q=ice.getContext('2d');q.fillStyle='#addbe9';q.fillRect(0,0,256,256);
 for(let i=0;i<40;i++){const x=r()*256,y=r()*256,rr=12+r()*40,c0=r()<.5?'rgba(255,255,255,.35)':'rgba(70,140,175,.22)';for(const [ox,oy] of [[0,0],[256,0],[-256,0],[0,256],[0,-256],[256,256],[-256,-256],[256,-256],[-256,256]]){const g=q.createRadialGradient(x+ox,y+oy,0,x+ox,y+oy,rr);g.addColorStop(0,c0);g.addColorStop(1,'rgba(160,210,230,0)');q.fillStyle=g;q.fillRect(x+ox-rr,y+oy-rr,rr*2,rr*2);}}
 q.strokeStyle='rgba(255,255,255,.65)';q.lineWidth=1;for(let i=0;i<22;i++){let x=r()*256,y=r()*256;q.beginPath();q.moveTo(x,y);for(let j=0;j<5;j++){x+=(r()-.5)*44;y+=(r()-.5)*44;q.lineTo(x,y);}q.stroke();}
 q.strokeStyle='rgba(40,100,130,.25)';for(let i=0;i<10;i++){let x=r()*256,y=r()*256;q.beginPath();q.moveTo(x,y);for(let j=0;j<4;j++){x+=(r()-.5)*50;y+=(r()-.5)*50;q.lineTo(x,y);}q.stroke();}
 const road=canvas(128,128),d=road.getContext('2d');d.fillStyle=SN.asphalt;d.fillRect(0,0,128,128);
 for(let i=0;i<500;i++){d.fillStyle=r()<.5?'rgba(255,255,255,.08)':'rgba(0,0,0,.12)';d.fillRect(r()*128,r()*128,1+r()*2,1+r()*2);}
 for(let i=0;i<30;i++){const x=r()*128,y=r()*128,rr=6+r()*14,g=d.createRadialGradient(x,y,0,x,y,rr);g.addColorStop(0,'rgba(225,232,240,.22)');g.addColorStop(1,'rgba(225,232,240,0)');d.fillStyle=g;d.fillRect(x-rr,y-rr,rr*2,rr*2);}
 return ART={snow,rock,ice,road};
}
const pats=new WeakMap();
function pat(c,name){let m=pats.get(c);if(!m){m={};pats.set(c,m);}return m[name]||(m[name]=c.createPattern(art()[name],'repeat'));}
function polyPath(c,pts){c.beginPath();c.moveTo(pts[0][0],pts[0][1]);for(let i=1;i<pts.length;i++)c.lineTo(pts[i][0],pts[i][1]);}
function smoothPoly(c,pts){c.beginPath();const n=pts.length;for(let i=0;i<=n;i++){const a=pts[i%n],b=pts[(i+1)%n],mx=(a[0]+b[0])/2,my=(a[1]+b[1])/2;i?c.quadraticCurveTo(a[0],a[1],mx,my):c.moveTo(mx,my);}c.closePath();}
function roundedPath(c,pts,rad){c.beginPath();c.moveTo(pts[0][0],pts[0][1]);for(let i=1;i<pts.length-1;i++)c.arcTo(pts[i][0],pts[i][1],pts[i+1][0],pts[i+1][1],rad);const L=pts[pts.length-1];c.lineTo(L[0],L[1]);}
function paintRoads(c,A,m){
 const any=[...segRects(LOOP,RW+120),...segRects(CLIMB,RW+120),{x:PLAZA.x-60,y:PLAZA.y-60,w:PLAZA.w+120,h:PLAZA.h+120}].some(r=>hits(r,m));if(!any)return;
 c.lineCap='butt';c.lineJoin='round';
 const paths=PAINT_PATHS;
 // plowed banks: lumpy snow walls with a blue shadow on the uphill side
 c.save();c.beginPath();c.rect(m.x,Math.max(m.y,H0-160),m.w,m.h+400);c.clip();
 for(const P of paths){roundedPath(c,P,120);c.strokeStyle='rgba(120,145,180,.35)';c.lineWidth=RW+64;c.stroke();roundedPath(c,P,120);c.strokeStyle='#f3f7fb';c.lineWidth=RW+44;c.stroke();roundedPath(c,P,120);c.strokeStyle='rgba(176,196,222,.75)';c.lineWidth=RW+18;c.stroke();}
 c.restore();
 for(const P of paths){roundedPath(c,P,110);c.strokeStyle=SN.asphalt;c.lineWidth=RW;c.stroke();roundedPath(c,P,110);c.strokeStyle=pat(c,'road');c.lineWidth=RW;c.stroke();}
 c.fillStyle=SN.asphalt;c.fillRect(PLAZA.x,PLAZA.y,PLAZA.w,PLAZA.h);c.fillStyle=pat(c,'road');c.fillRect(PLAZA.x,PLAZA.y,PLAZA.w,PLAZA.h);
 // edge slush: draw a wide light stroke then the clean centre over it
 for(const P of paths){roundedPath(c,P,110);c.strokeStyle='rgba(214,224,236,.55)';c.lineWidth=RW;c.stroke();roundedPath(c,P,110);c.strokeStyle=SN.asphalt;c.lineWidth=RW-26;c.stroke();roundedPath(c,P,110);c.strokeStyle=pat(c,'road');c.lineWidth=RW-26;c.stroke();}
 // tyre tracks: two pale compacted ruts per lane
 for(const P of paths){for(const off of [-48,-24,24,48]){const Q=offsetPath(P,off);roundedPath(c,Q,Math.max(20,110-off));c.strokeStyle='rgba(205,215,228,.32)';c.lineWidth=9;c.stroke();roundedPath(c,Q,Math.max(20,110-off));c.strokeStyle='rgba(30,34,40,.28)';c.lineWidth=3;c.stroke();}}
 // faded centre line
 c.setLineDash([26,30]);for(const P of paths){roundedPath(c,P,110);c.strokeStyle='rgba(236,196,80,.55)';c.lineWidth=4;c.stroke();}c.setLineDash([]);
 // icy patches
 for(const [x,y,rx,ry] of ICE){if(!inR(x,y,m,120))continue;const g=c.createRadialGradient(x,y,2,x,y,rx);g.addColorStop(0,'rgba(210,240,255,.75)');g.addColorStop(.7,'rgba(170,215,240,.5)');g.addColorStop(1,'rgba(170,215,240,0)');c.fillStyle=g;c.beginPath();c.ellipse(x,y,rx,ry,0,0,TAU);c.fill();c.strokeStyle='rgba(255,255,255,.7)';c.lineWidth=1.5;c.beginPath();c.moveTo(x-rx*.5,y-ry*.2);c.lineTo(x+rx*.3,y+ry*.1);c.stroke();}
 paintPlaza(c,m);
 // orange snow poles with reflectors on both verges (drawn with long blue shadows)
 for(const P of PAINT_PATHS)for(let i=1;i<P.length;i++){const [ax,ay]=P[i-1],[bx,by]=P[i],L=Math.hypot(bx-ax,by-ay),ux=(bx-ax)/L,uy=(by-ay)/L;
  for(let t=60;t<L-60;t+=96)for(const side of [-1,1]){const x=ax+ux*t-uy*side*(RW/2+26),y=ay+uy*t+ux*side*(RW/2+26);if(!inR(x,y,m,10)||y<H0)continue;
   c.strokeStyle='rgba(60,80,120,.28)';c.lineWidth=3;c.beginPath();c.moveTo(x,y);c.lineTo(x+16,y+20);c.stroke();
   c.fillStyle='#1d1d22';c.beginPath();c.arc(x,y,3.6,0,TAU);c.fill();c.fillStyle='#f07a1a';c.beginPath();c.arc(x,y,2.6,0,TAU);c.fill();c.fillStyle='#fff6c8';c.fillRect(x-1,y-1,2,2);}}
}
function paintPlaza(c,m){const P=PLAZA;if(!hits({x:P.x-80,y:P.y-80,w:P.w+160,h:P.h+260},m))return;
 const park=P.h*.36;
 // snowy stone viewpoint: flagstones with snow in the joints, a plowed bank on the rim
 c.fillStyle='#8f9298';c.fillRect(P.x,P.y+park,P.w,P.h-park);const r=rng(4242);
 for(let y=P.y+park;y<P.y+P.h;y+=22){const off=((y/22)|0)%2?11:0;for(let x=P.x-off;x<P.x+P.w;x+=34){const w=30+((x*7+y)%5),h=19;c.fillStyle=['#a3a6ab','#9a9da3','#adb0b4','#94979d'][((x+y)/11|0)&3];c.fillRect(Math.max(P.x,x+2),y+2,Math.min(w,P.x+P.w-x-2),h);}}
 c.fillStyle='rgba(240,245,250,.55)';for(let i=0;i<26;i++){c.beginPath();c.ellipse(P.x+r()*P.w,P.y+park+r()*(P.h-park),14+r()*30,5+r()*9,r(),0,TAU);c.fill();}
 // parking apron with painted bays
 c.fillStyle='rgba(255,255,255,.8)';for(let x=P.x+30;x<=P.x+P.w-30;x+=46)c.fillRect(x,P.y+6,3,park-16);c.fillRect(P.x+30,P.y+park-12,P.w-60,3);
 c.fillStyle='#f2c14e';c.font='900 12px system-ui';c.textAlign='center';c.textBaseline='middle';c.fillText('P',P.x+14,P.y+park/2);
 // plowed rim
 c.strokeStyle='rgba(120,145,180,.45)';c.lineWidth=16;c.strokeRect(P.x-6,P.y-6,P.w+12,P.h+12);c.strokeStyle='#f3f7fb';c.lineWidth=10;c.strokeRect(P.x-8,P.y-8,P.w+16,P.h+16);
 // benches, coin telescope, flags, entrance to the observatory
 for(const bx of [P.x+40,P.x+P.w-100]){const by=P.y+P.h-34;c.fillStyle='rgba(50,70,110,.35)';c.fillRect(bx+5,by+6,62,16);c.fillStyle='#6b4a32';c.fillRect(bx,by,62,14);c.fillStyle='rgba(0,0,0,.25)';for(let k=1;k<4;k++)c.fillRect(bx,by+k*3.5,62,1);c.fillStyle='#f4f8fc';c.fillRect(bx+2,by,58,4);}
 {const tx=P.x+P.w-36,ty=P.y+park+40;c.strokeStyle='rgba(50,70,110,.35)';c.lineWidth=4;c.beginPath();c.moveTo(tx,ty);c.lineTo(tx+16,ty+20);c.stroke();c.fillStyle='#2f5d8a';c.beginPath();c.arc(tx,ty,8,0,TAU);c.fill();c.fillStyle='#1a1d22';c.save();c.translate(tx,ty);c.rotate(.6);c.fillRect(-3,-16,6,14);c.restore();c.fillStyle='#e0b040';c.beginPath();c.arc(tx,ty,3,0,TAU);c.fill();}
 for(const [k,fx] of [[0,P.x+P.w*.32],[1,P.x+P.w*.5],[2,P.x+P.w*.68]]){const fy=P.y+park+16;c.strokeStyle='rgba(50,70,110,.35)';c.lineWidth=3;c.beginPath();c.moveTo(fx,fy);c.lineTo(fx+20,fy+26);c.stroke();c.fillStyle='#d8dce2';c.beginPath();c.arc(fx,fy,3,0,TAU);c.fill();c.fillStyle=['#7d3cc8','#f2c14e','#2f8fb4'][k];c.beginPath();c.moveTo(fx,fy);c.quadraticCurveTo(fx+14,fy-7,fx+28,fy-2);c.lineTo(fx+26,fy+10);c.quadraticCurveTo(fx+13,fy+5,fx,fy+12);c.closePath();c.fill();}
 const ex=OBS.x,ey=P.y+P.h;c.fillStyle='#9a9da3';c.fillRect(ex-24,ey,48,OBS.y-OBS.r-ey+6);for(let k=0;k<4;k++){c.fillStyle=k%2?'#b4b7bc':'#a6a9ae';c.fillRect(ex-24,ey+k*9,48,8);}
 c.fillStyle='#2a3440';c.fillRect(ex-14,OBS.y-OBS.r-6,28,12);c.fillStyle='#b23a2e';c.fillRect(ex-20,OBS.y-OBS.r-12,40,6);
}
function offsetPath(P,off){const out=[],n=P.length;for(let i=0;i<n;i++){const b=P[i];let nx=0,ny=0;
 if(i>0){const d=norm(b[0]-P[i-1][0],b[1]-P[i-1][1]);nx+=-d[1];ny+=d[0];}
 if(i<n-1){const d=norm(P[i+1][0]-b[0],P[i+1][1]-b[1]);nx+=-d[1];ny+=d[0];}
 if(i===0||i===n-1){const L=Math.hypot(nx,ny)||1;nx/=L;ny/=L;}
 out.push([b[0]+nx*off,b[1]+ny*off]);}return out;}
function norm(x,y){const L=Math.hypot(x,y);return L?[x/L,y/L]:[0,0];}
function paintRails(c,m){
 for(const R of RAILS){const bb={x:Math.min(...R.map(p=>p[0]))-30,y:Math.min(...R.map(p=>p[1]))-30,w:0,h:0};bb.w=Math.max(...R.map(p=>p[0]))+30-bb.x;bb.h=Math.max(...R.map(p=>p[1]))+30-bb.y;if(!hits(bb,m))continue;
  for(let i=1;i<R.length;i++){const [ax,ay]=R[i-1],[bx,by]=R[i],L=Math.hypot(bx-ax,by-ay),nx=-(by-ay)/L,ny=(bx-ax)/L;const mx=(ax+bx)/2,my=(ay+by)/2;
   const sgn=segRects(CLIMB,RW).some(q=>inR(mx+nx*40,my+ny*40,q))||segRects(LOOP,RW).some(q=>inR(mx+nx*40,my+ny*40,q))?-1:1;
   const g=c.createLinearGradient(mx,my,mx+nx*sgn*90,my+ny*sgn*90);g.addColorStop(0,'rgba(40,62,104,.42)');g.addColorStop(1,'rgba(40,62,104,0)');c.fillStyle=g;
   c.beginPath();c.moveTo(ax,ay);c.lineTo(bx,by);c.lineTo(bx+nx*sgn*90,by+ny*sgn*90);c.lineTo(ax+nx*sgn*90,ay+ny*sgn*90);c.closePath();c.fill();}
  c.lineJoin='round';roundedPath(c,R.map(p=>[p[0]+6,p[1]+8]),40);c.strokeStyle='rgba(60,80,110,.3)';c.lineWidth=10;c.stroke();
  // posts
  for(let i=1;i<R.length;i++){const [ax,ay]=R[i-1],[bx,by]=R[i],L=Math.hypot(bx-ax,by-ay);for(let t=0;t<L;t+=48){const x=ax+(bx-ax)*t/L,y=ay+(by-ay)*t/L;c.fillStyle='#3d3f44';c.fillRect(x-3,y-3,7,7);c.fillStyle='#f3f7fb';c.fillRect(x-3,y-4,7,3);}}
  roundedPath(c,R,40);c.strokeStyle='#5d6670';c.lineWidth=9;c.stroke();roundedPath(c,R,40);c.strokeStyle='#c3cad2';c.lineWidth=4;c.stroke();roundedPath(c,R,40);c.strokeStyle='#f4f7fa';c.lineWidth=1.4;c.stroke();
  // red-white chevrons on the outer hairpin bends
  for(let i=1;i<R.length-1;i++){const [x,y]=R[i];c.save();c.translate(x,y);for(let k=-1;k<=1;k++){c.fillStyle=k%2?'#c8312c':'#f4f4f4';c.fillRect(-7+k*0,-7+k*16,14,10);}c.restore();}
 }
}
function paintCliff(c,k){
 c.save();c.translate(10,13);smoothPoly(c,k.pts);c.fillStyle='rgba(60,80,120,.32)';c.fill();c.restore();
 smoothPoly(c,k.pts);c.fillStyle=pat(c,'rock');c.fill();c.strokeStyle='rgba(30,28,34,.55)';c.lineWidth=2;c.stroke();
 // lit north-west face, shadowed south-east face
 c.save();smoothPoly(c,k.pts);c.clip();const g=c.createLinearGradient(k.x-k.rx,k.y-k.ry,k.x+k.rx,k.y+k.ry);g.addColorStop(0,'rgba(255,255,255,.22)');g.addColorStop(.55,'rgba(0,0,0,0)');g.addColorStop(1,'rgba(20,20,40,.35)');c.fillStyle=g;c.fillRect(k.x-k.rx-4,k.y-k.ry-4,k.rx*2+8,k.ry*2+8);
 // stratified ledges: short, broken snow lines on the rock bands with a blue lip shadow
 const r=rng(Math.floor(k.seed*1e6)),bands=2+Math.floor(r()*2);
 for(let i=0;i<bands;i++){const y=k.y-k.ry*.2+(i+.5)*(k.ry*1.1/bands),x0=-k.rx*(.2+r()*.6),x1=k.rx*(.1+r()*.6),ph=r()*6;
  c.fillStyle='rgba(60,82,124,.32)';c.beginPath();c.moveTo(k.x+x0,y+3);for(let x=x0;x<=x1;x+=7)c.lineTo(k.x+x,y+3+Math.sin(x/7+ph)*2);c.lineTo(k.x+x1,y+6);c.lineTo(k.x+x0,y+6);c.fill();
  c.fillStyle='rgba(238,243,249,.92)';c.beginPath();c.moveTo(k.x+x0,y);for(let x=x0;x<=x1;x+=7)c.lineTo(k.x+x,y+Math.sin(x/7+ph)*2);for(let x=x1;x>=x0;x-=7)c.lineTo(k.x+x,y-2-Math.abs(Math.sin(x/11+ph))*3);c.closePath();c.fill();}
 c.fillStyle='#f6f9fc';c.beginPath();c.ellipse(k.x-k.rx*.3,k.y-k.ry*.62,k.rx*.62,k.ry*.32,-.25,0,TAU);c.fill();
 c.strokeStyle='rgba(30,28,36,.45)';c.lineWidth=1.3;for(let i=0;i<4;i++){const x=k.x+(r()-.5)*k.rx*1.2,y=k.y+(r()-.3)*k.ry;c.beginPath();c.moveTo(x,y);c.lineTo(x+(r()-.5)*10,y+k.ry*.3);c.stroke();}

 c.restore();
}
function paintPine(c,p,shadow){
 const r=p.r;if(shadow){c.fillStyle='rgba(55,78,120,.28)';c.beginPath();c.ellipse(p.x+r*.55,p.y+r*.7,r*1.02,r*.82,0.5,0,TAU);c.fill();return;}
 const rr=rng(Math.floor(p.seed*1e7)),tiers=3;
 for(let t=0;t<tiers;t++){const R=r*(1-t*.28),n=8+t;c.beginPath();for(let i=0;i<n*2;i++){const a=i/(n*2)*TAU+p.seed*3+t*.4,q=i%2?R*.58:R;const x=p.x+Math.cos(a)*q-t*1.5,y=p.y+Math.sin(a)*q-t*2;i?c.lineTo(x,y):c.moveTo(x,y);}c.closePath();
  c.fillStyle=['#1f4136','#28513f','#31604c'][t];c.fill();
  // snow clumps resting on the north-west branches
 }
 for(let t=0;t<tiers;t++){const R=r*(1-t*.28),n=8+t;
  for(let i=0;i<n;i++){const a=i/n*TAU+p.seed*3+t*.4;const lit=Math.cos(a+2.36);if(lit<-.2)continue;const q=R*(.45+rr()*.35),x=p.x+Math.cos(a)*q-t*1.5,y=p.y+Math.sin(a)*q-t*2;
   c.fillStyle='rgba(120,150,190,.45)';c.beginPath();c.ellipse(x+1.2,y+1.4,R*.16,R*.08,a,0,TAU);c.fill();
   c.fillStyle=lit>.4?'#f6f9fd':'#dbe6f2';c.beginPath();c.ellipse(x,y,R*(.12+rr()*.07),R*(.06+rr()*.03),a,0,TAU);c.fill();}}
 c.fillStyle='#f6f9fc';c.beginPath();c.arc(p.x-4,p.y-6,Math.max(2,r*.16),0,TAU);c.fill();
 if(rr()<.5){c.fillStyle='rgba(255,255,255,.95)';c.fillRect(p.x-r*.5,p.y-r*.3,1.5,1.5);c.fillRect(p.x+r*.2,p.y-r*.55,1.5,1.5);}
}
function shade(hex,k){const n=parseInt(hex.slice(1),16),f=v=>Math.max(0,Math.min(255,Math.round(k<0?v*(1+k):v+(255-v)*k)));return '#'+[n>>16,n>>8&255,n&255].map(f).map(v=>v.toString(16).padStart(2,'0')).join('');}
function snowRoof(c,x,y,w,h,ridgeV,roof,r){
 // timber/shingle eaves showing at the edge of the snow load
 c.fillStyle=shade(roof,-.25);c.fillRect(x-9,y-9,w+18,h+18);
 c.fillStyle=roof;c.fillRect(x-7,y-7,w+14,h+14);
 c.fillStyle=shade(roof,.18);for(let yy=y-7;yy<y+h+7;yy+=5)for(let xx=x-7+((yy/5|0)%2)*4;xx<x+w+7;xx+=8)c.fillRect(xx,yy,6,1.2);
 // snow mass with a pillowy, overhanging edge
 // shingle courses on the exposed eave band (clearly wood from above)
 c.fillStyle=shade(roof,-.32);for(let yy=y-7;yy<y+h+7;yy+=5)c.fillRect(x-7,yy,w+14,1);
 const ins=13;c.fillStyle='#e2eaf3';c.fillRect(x+ins-2,y+ins-2,w-ins*2+4,h-ins*2+4);
 c.fillStyle='#eef3f9';for(let xx=x+ins;xx<=x+w-ins;xx+=9){c.beginPath();c.arc(xx,y+ins,4.5+r()*2,0,TAU);c.arc(xx,y+h-ins,4.5+r()*2,0,TAU);c.fill();}
 for(let yy=y+ins;yy<=y+h-ins;yy+=9){c.beginPath();c.arc(x+ins,yy,4.5+r()*2,0,TAU);c.arc(x+w-ins,yy,4.5+r()*2,0,TAU);c.fill();}
 if(!ridgeV){const ry=y+h*.45,g1=c.createLinearGradient(0,y,0,ry),g2=c.createLinearGradient(0,ry,0,y+h);
  g1.addColorStop(0,'#bccde2');g1.addColorStop(1,'#d9e4f0');g2.addColorStop(0,'#fbfdff');g2.addColorStop(1,'#eaf1f8');
  c.fillStyle=g1;c.fillRect(x+ins,y+ins,w-ins*2,ry-y-ins);c.fillStyle=g2;c.fillRect(x+ins,ry,w-ins*2,y+h-ins-ry);
  c.fillStyle='rgba(110,132,170,.6)';c.fillRect(x+ins,ry-1.5,w-ins*2,2.5);c.fillStyle='#ffffff';c.fillRect(x+ins,ry+1,w-ins*2,1.5);snowLoad(c,x+ins,y+ins,w-ins*2,ry-y-ins-3,r,.75);snowLoad(c,x+ins,ry+4,w-ins*2,y+h-ins-ry-4,r,1);
  c.fillStyle=shade(roof,-.1);c.fillRect(x-9,ry-3,6,6);c.fillRect(x+w+3,ry-3,6,6);ridgeCap(c,x+ins-6,ry-3,w-ins*2+12,6,roof,r);bare(c,x+ins,ry+6,w-ins*2,y+h-ins-ry-6,roof,r);return ry;}
 const rx=x+w*.5,g1=c.createLinearGradient(x,0,rx,0),g2=c.createLinearGradient(rx,0,x+w,0);
 g1.addColorStop(0,'#bccde2');g1.addColorStop(1,'#d9e4f0');g2.addColorStop(0,'#fbfdff');g2.addColorStop(1,'#eaf1f8');
 c.fillStyle=g1;c.fillRect(x+ins,y+ins,rx-x-ins,h-ins*2);c.fillStyle=g2;c.fillRect(rx,y+ins,x+w-ins-rx,h-ins*2);
 c.fillStyle='rgba(110,132,170,.6)';c.fillRect(rx-1.5,y+ins,2.5,h-ins*2);c.fillStyle='#fff';c.fillRect(rx+1,y+ins,1.5,h-ins*2);snowLoad(c,x+ins,y+ins,rx-x-ins-3,h-ins*2,r,.75);snowLoad(c,rx+4,y+ins,x+w-ins-rx-4,h-ins*2,r,1);ridgeCap(c,rx-3,y+ins-6,6,h-ins*2+12,roof,r);bare(c,rx+6,y+ins,x+w-ins-rx-6,h-ins*2,roof,r);return null;
}
// uneven snow load: deeper drifts (shadowed lee edge), thin crust where wind scoured, and sastrugi ripples,
// so a roof centre reads as packed snow rather than a flat white card
function snowLoad(c,x,y,w,h,r,lit){if(w<14||h<14)return;c.save();c.beginPath();c.rect(x,y,w,h);c.clip();
 const n=2+Math.floor(r()*3);for(let k=0;k<n;k++){const px=x+w*r(),py=y+h*r(),rw=w*(.18+r()*.25),rh=h*(.14+r()*.22),g=c.createRadialGradient(px,py,0,px,py,Math.max(rw,rh));
  const deep=r()<.55;g.addColorStop(0,deep?`rgba(150,170,205,${(.22*lit).toFixed(2)})`:`rgba(255,255,255,${(.5*lit).toFixed(2)})`);g.addColorStop(1,'rgba(150,170,205,0)');
  c.fillStyle=g;c.beginPath();c.ellipse(px,py,rw,rh,r()*.6-.3,0,TAU);c.fill();}
 c.strokeStyle=`rgba(120,142,180,${(.16+.1*(1-lit)).toFixed(2)})`;c.lineWidth=1;const step=7+r()*4,ang=.25+r()*.3;
 for(let o=-h;o<w+h;o+=step){c.beginPath();const ox=x+o;c.moveTo(ox,y);for(let t=0;t<=1.01;t+=.25)c.lineTo(ox+t*h*ang+Math.sin((t+o)*5)*2,y+t*h);c.stroke();}
 c.fillStyle='rgba(255,255,255,.55)';for(let k=0;k<w*h/260;k++)c.fillRect(x+r()*w,y+r()*h,1.2,1.2);c.restore();}
// dark timber ridge beam with snow crumbs
function ridgeCap(c,x,y,w,h,roof,r){c.fillStyle=shade(roof,-.4);c.fillRect(x,y,w,h);c.fillStyle=shade(roof,.1);c.fillRect(x+1,y+1,w>h?w-2:2,w>h?1.5:h-2);c.fillStyle='rgba(245,249,253,.9)';for(let k=0;k<Math.max(w,h)/14;k++){const t=r();c.fillRect(w>h?x+t*w:x+1,w>h?y+1:y+t*h,3,3);}}
// wind-scoured patches on the sunny slope where shingles show through
function bare(c,x,y,w,h,roof,r){if(w<20||h<20)return;const n=1+Math.floor(r()*3);for(let k=0;k<n;k++){const px=x+w*(.12+r()*.76),py=y+h*(.15+r()*.7),rw=8+r()*Math.min(26,w*.22),rh=5+r()*Math.min(14,h*.2);
 c.save();c.beginPath();c.ellipse(px,py,rw,rh,0,0,TAU);c.clip();c.fillStyle=roof;c.fillRect(px-rw,py-rh,rw*2,rh*2);c.fillStyle=shade(roof,-.3);for(let yy=py-rh;yy<py+rh;yy+=4)c.fillRect(px-rw,yy,rw*2,1);for(let yy=py-rh;yy<py+rh;yy+=4)for(let xx=px-rw+((yy/4|0)%2)*3;xx<px+rw;xx+=6)c.fillRect(xx,yy,1,4);c.restore();
 c.strokeStyle='rgba(250,252,255,.8)';c.lineWidth=1.5;c.beginPath();c.ellipse(px,py,rw,rh,0,0,TAU);c.stroke();}}
function paintChalet(c,C){
 const {x,y,w,h,fac}=C,south=C.front==='S',roofY=south?y:y+fac,roofH=h-fac,facY=south?y+h-fac:y,r=rng(Math.floor(C.seed*1e7));
 // blue cast shadow to the south-east
 c.fillStyle='rgba(60,84,130,.32)';c.beginPath();c.moveTo(x+w,y+8);c.lineTo(x+w+26,y+30);c.lineTo(x+w+26,y+h+26);c.lineTo(x+20,y+h+26);c.lineTo(x,y+h);c.lineTo(x+w,y+h);c.closePath();c.fill();
 // facade strip: larch planks, stone plinth, shuttered windows, door
 c.fillStyle=C.wood;c.fillRect(x,facY,w,fac);c.strokeStyle=shade(C.wood,-.3);c.lineWidth=1;for(let px=x+6;px<x+w;px+=9){c.beginPath();c.moveTo(px,facY);c.lineTo(px,facY+fac);c.stroke();}
 c.fillStyle='#8c8a86';c.fillRect(x,south?facY+fac-10:facY,w,10);
 for(const [wx,wy,ww,wh] of C.win){c.fillStyle='#2b3440';c.fillRect(wx,wy,ww,wh);c.fillStyle='rgba(150,190,220,.55)';c.fillRect(wx+2,wy+2,ww-4,wh*.45);c.strokeStyle=C.trim;c.lineWidth=2;c.strokeRect(wx,wy,ww,wh);c.fillStyle=C.trim;c.fillRect(wx-6,wy,5,wh);c.fillRect(wx+ww+1,wy,5,wh);c.fillStyle='#c94a3a';c.fillRect(wx,wy+wh,ww,4);}
 if(south){const dx=x+w/2-13;c.fillStyle='#3a2416';c.fillRect(dx,facY+fac-34,26,32);c.fillStyle='#d9a43a';c.fillRect(dx+20,facY+fac-20,3,3);}
 // back deck with railing, half buried
 if(C.balcony){const dy=south?roofY-26:y+h+2,dw=w*.62,dx=x+w*.19;c.fillStyle=shade(C.wood,.12);c.fillRect(dx,dy,dw,24);c.strokeStyle=shade(C.wood,-.35);c.lineWidth=1;for(let px=dx+5;px<dx+dw;px+=7){c.beginPath();c.moveTo(px,dy);c.lineTo(px,dy+24);c.stroke();}
  c.fillStyle='rgba(244,248,252,.85)';c.beginPath();c.ellipse(dx+dw*.35,dy+12,dw*.3,9,0,0,TAU);c.fill();c.strokeStyle='#4a3020';c.lineWidth=2.5;c.strokeRect(dx,dy,dw,24);}
 // main roof, plus a cross wing on bigger chalets
 const wing=w>210&&r()<.75,mainW=wing?w*.66:w,ry=snowRoof(c,x,roofY,mainW,roofH,C.gable,C.roof,r);
 if(wing){const wx=x+mainW-6,ww=w-mainW+6,wy=roofY+roofH*.12,wh=roofH*.88;snowRoof(c,wx,wy,ww,wh,!C.gable,shade(C.roof,.08),r);}
 // dormers on the sunny slope, skylights on the shaded one
 const nd=Math.max(1,Math.floor(mainW/90));for(let k=0;k<nd;k++){const dx=x+mainW*(k+.5)/nd-13,dy=ry?ry+(roofY+roofH-ry)*.25:roofY+roofH*.35;
  c.fillStyle='rgba(80,100,140,.35)';c.fillRect(dx+3,dy+3,28,22);c.fillStyle=C.roof;c.fillRect(dx-2,dy-2,30,24);c.fillStyle='#f6f9fc';c.fillRect(dx,dy,26,9);c.fillStyle='#e3ebf4';c.fillRect(dx,dy+9,26,7);c.fillStyle='#2b3440';c.fillRect(dx+6,dy+16,14,6);c.fillStyle=C.trim;c.fillRect(dx+5,dy+15,16,1.5);}
 if(ry){const sk=1+Math.floor(r()*2);for(let k=0;k<sk;k++){const sx=x+mainW*(.2+r()*.6),sy=roofY+(ry-roofY)*.45;c.fillStyle='#4a5868';c.fillRect(sx-9,sy-6,18,12);c.fillStyle='#7f9cb8';c.fillRect(sx-7,sy-4,14,8);c.fillStyle='rgba(255,255,255,.7)';c.fillRect(sx-7,sy-4,6,3);}}
 // icicles on the visible eave
 const ey=south?roofY+roofH+6:roofY-8;c.fillStyle='#e6f1fb';for(let px=x-6;px<x+w+6;px+=6){const L=3+((px*13)%8);c.beginPath();c.moveTo(px,ey);c.lineTo(px+2.5,ey+(south?L:-L));c.lineTo(px+5,ey);c.fill();}
 const ch=C.chimney;c.fillStyle='rgba(50,70,110,.35)';c.fillRect(ch.x-4,ch.y-2,24,24);c.fillStyle='#7a5a48';c.fillRect(ch.x-11,ch.y-11,22,22);c.fillStyle='#93705a';for(let k=0;k<4;k++)for(let j=0;j<3;j++)c.fillRect(ch.x-10+j*7+(k%2)*3,ch.y-10+k*5,5,3.5);c.fillStyle='rgba(0,0,0,.25)';for(let k=0;k<3;k++)c.fillRect(ch.x-11,ch.y-6+k*7,22,1);c.fillStyle='#f4f8fc';c.fillRect(ch.x-12,ch.y-13,24,5);c.fillStyle='#2a2220';c.fillRect(ch.x-5,ch.y-5,10,8);
}
function paintCar(c,k){c.save();c.translate(k.x,k.y);c.fillStyle='rgba(50,70,110,.35)';c.fillRect(-10,-20,28,48);c.fillStyle=k.col;c.beginPath();c.roundRect?c.roundRect(-13,-24,26,48,6):c.rect(-13,-24,26,48);c.fill();
 c.fillStyle='#22303c';c.fillRect(-10,-14,20,8);c.fillRect(-10,10,20,6);c.fillStyle='#f4f8fc';c.beginPath();c.ellipse(0,-1,10,9,0,0,TAU);c.fill();c.fillStyle='rgba(244,248,252,.8)';c.fillRect(-12,-24,24,5);c.fillStyle='#f6e7b0';c.fillRect(-11,-24,5,2);c.fillRect(6,-24,5,2);c.restore();}
function paintVillage(c,A,m){
 const V={x:9150,y:10360,w:1560,h:920};if(!hits(V,m))return;
 // trampled snow paths to each door
 for(const C of A.chalets){const dx=C.x+C.w/2,y0=C.front==='S'?C.y+C.h:C.y,y1=C.front==='S'?10704:10928;const t0=Math.min(y0,y1),t1=Math.max(y0,y1);c.fillStyle='rgba(120,145,180,.4)';c.fillRect(dx-21,t0,42,t1-t0);c.fillStyle='#f6f9fc';c.fillRect(dx-22,t0,7,t1-t0);c.fillRect(dx+15,t0,7,t1-t0);c.fillStyle='#9b9a96';c.fillRect(dx-14,t0,28,t1-t0);c.fillStyle='rgba(0,0,0,.12)';for(let yy=t0;yy<t1;yy+=10)c.fillRect(dx-14,yy,28,1);c.fillStyle='rgba(235,242,250,.6)';c.fillRect(dx-14,t0,28,3);}
 // boardwalks
 for(const yy of [10704,10888]){c.fillStyle='#8a6a4a';c.fillRect(9300,yy,1250,40);c.strokeStyle='rgba(50,30,20,.45)';c.lineWidth=1;for(let px=9300;px<10550;px+=12){c.beginPath();c.moveTo(px,yy);c.lineTo(px,yy+40);c.stroke();}c.fillStyle='rgba(240,246,252,.7)';c.fillRect(9300,yy+(yy<10800?0:34),1250,6);}
 for(const k of A.cars||[])if(inR(k.x,k.y,m,40))paintCar(c,k);
 for(const C of A.chalets)if(hits({x:C.x-40,y:C.y-40,w:C.w+90,h:C.h+90},m))paintChalet(c,C);
 // fences between gardens
 c.strokeStyle='#6b4a32';c.lineWidth=3;for(const C of A.chalets){const fy=C.front==='S'?C.y-14:C.y+C.h+14;c.beginPath();c.moveTo(C.x-10,fy);c.lineTo(C.x+C.w+10,fy);c.stroke();c.fillStyle='#6b4a32';for(let px=C.x-10;px<=C.x+C.w+10;px+=18)c.fillRect(px-2,fy-4,4,8);c.fillStyle='#f4f8fc';c.fillRect(C.x-10,fy-4,C.w+20,2);}
}
function paintProp(c,p){const {x,y}=p;
 if(p.k==='snowman'){c.fillStyle='rgba(60,80,120,.3)';c.beginPath();c.ellipse(x+8,y+10,22,14,0,0,TAU);c.fill();c.fillStyle='#f6f9fc';c.beginPath();c.arc(x,y+6,18,0,TAU);c.fill();c.fillStyle='#e6eef6';c.beginPath();c.arc(x-2,y-10,12,0,TAU);c.fill();c.fillStyle='#2a2a2a';c.fillRect(x-8,y-24,14,8);c.fillRect(x-11,y-17,20,3);c.fillStyle='#e0782a';c.fillRect(x+6,y-11,8,3);c.fillStyle='#c8312c';c.fillRect(x-11,y-2,20,4);}
 else if(p.k==='wood'){c.fillStyle='rgba(60,80,120,.3)';c.fillRect(x-20,y-6,48,26);for(let i=0;i<10;i++){const lx=x-22+(i%5)*9,ly=y-8+Math.floor(i/5)*10;c.fillStyle='#8a5a34';c.beginPath();c.arc(lx,ly,4.5,0,TAU);c.fill();c.fillStyle='#d6b07a';c.beginPath();c.arc(lx,ly,2.5,0,TAU);c.fill();}c.fillStyle='#f4f8fc';c.fillRect(x-27,y-14,46,4);}
 else if(p.k==='snowmobile'){c.fillStyle='rgba(60,80,120,.32)';c.fillRect(x-10,y-14,30,46);c.fillStyle='#2a2d33';c.fillRect(x-17,y-24,5,40);c.fillRect(x+12,y-24,5,40);c.fillStyle=(x%3<1.5)?'#d0302a':'#1f5fa8';c.beginPath();c.roundRect(x-11,y-22,22,40,[9,9,4,4]);c.fill();c.fillStyle='#16181c';c.fillRect(x-8,y-2,16,16);c.fillStyle='rgba(170,210,240,.8)';c.fillRect(x-7,y-17,14,6);c.fillStyle='#e8e8e8';c.fillRect(x-12,y-9,24,2);c.fillStyle='#2a2d33';c.fillRect(x-9,y+14,18,10);c.strokeStyle='rgba(110,130,160,.45)';c.lineWidth=3;c.beginPath();c.moveTo(x-6,y+26);c.lineTo(x-14,y+120);c.moveTo(x+6,y+26);c.lineTo(x-2,y+120);c.stroke();}
 else if(p.k==='skis'){c.fillStyle='rgba(60,80,120,.3)';c.fillRect(x-24,y-2,56,14);c.fillStyle='#5a3a22';c.fillRect(x-28,y-6,56,6);const cols=['#d0302a','#f2c230','#1f5fa8','#2f8a4a','#e8e8e8'];for(let i=0;i<5;i++){c.fillStyle=cols[i];c.fillRect(x-25+i*11,y-16,4,24);c.fillRect(x-20+i*11,y-14,4,22);}c.fillStyle='#f4f8fc';c.fillRect(x-29,y-8,58,3);}
 else if(p.k==='sled'){c.fillStyle='rgba(60,80,120,.3)';c.fillRect(x-14,y-6,34,16);c.fillStyle='#c8312c';c.fillRect(x-18,y-9,32,14);c.strokeStyle='#3a2a20';c.lineWidth=2;c.strokeRect(x-18,y-9,32,14);c.strokeStyle='rgba(120,140,170,.5)';c.beginPath();c.moveTo(x+14,y-6);c.lineTo(x+120,y-30);c.moveTo(x+14,y+4);c.lineTo(x+120,y-20);c.stroke();}
}
function paintObservatory(c,A,m){const O=OBS;if(!inR(O.x,O.y,m,200))return;
 c.fillStyle='rgba(50,70,110,.35)';c.beginPath();c.arc(O.x+14,O.y+18,O.r+6,0,TAU);c.fill();
 c.fillStyle='#8c8f96';c.beginPath();c.arc(O.x,O.y,O.r+8,0,TAU);c.fill();
 const g=c.createRadialGradient(O.x-24,O.y-26,6,O.x,O.y,O.r);g.addColorStop(0,'#ffffff');g.addColorStop(.6,'#dfe6ee');g.addColorStop(1,'#a9b5c4');c.fillStyle=g;c.beginPath();c.arc(O.x,O.y,O.r,0,TAU);c.fill();
 c.save();c.translate(O.x,O.y);c.rotate(-.5);c.fillStyle='#22303e';c.fillRect(-9,-O.r,18,O.r);c.fillStyle='#3a4a5c';c.fillRect(-9,-O.r,18,8);c.restore();
 c.strokeStyle='rgba(120,135,155,.6)';c.lineWidth=1.5;for(let k=1;k<4;k++){c.beginPath();c.arc(O.x,O.y,O.r*k/4,0,TAU);c.stroke();}
 // crown flag and cairn on the true summit
 c.fillStyle='#5a5650';c.beginPath();c.arc(O.x+130,O.y+30,16,0,TAU);c.fill();c.fillStyle='#f4f8fc';c.beginPath();c.arc(O.x+126,O.y+24,8,0,TAU);c.fill();
 c.strokeStyle='#2a2a2a';c.lineWidth=3;c.beginPath();c.moveTo(O.x+130,O.y+30);c.lineTo(O.x+130,O.y-30);c.stroke();c.fillStyle='#7d3cc8';c.beginPath();c.moveTo(O.x+131,O.y-30);c.lineTo(O.x+170,O.y-22);c.lineTo(O.x+131,O.y-12);c.fill();
 c.fillStyle='#f2c14e';c.beginPath();c.moveTo(O.x+138,O.y-18);c.lineTo(O.x+142,O.y-27);c.lineTo(O.x+147,O.y-20);c.lineTo(O.x+152,O.y-27);c.lineTo(O.x+156,O.y-18);c.closePath();c.fill();
 c.fillStyle='#24303c';c.fillRect(O.x-110,O.y+O.r+16,220,30);c.fillStyle='#f2c14e';c.font='900 18px system-ui';c.textAlign='center';c.textBaseline='middle';c.fillText('CROWN PEAK  2,914 M',O.x,O.y+O.r+31);
}
function hillshade(ix,iy,SZ){
 const N=33,img=canvas(N-1,N-1),x=img.getContext('2d'),id=x.createImageData(N-1,N-1),st=SZ/(N-1);
 for(let j=0;j<N-1;j++)for(let i=0;i<N-1;i++){const wx=ix*SZ+(i+.5)*st,wy=iy*SZ+(j+.5)*st;const h=height(wx,wy),hx=height(wx+st,wy)-h,hy=height(wx,wy+st)-h;
  const sh=Math.max(-1,Math.min(1,(hx+hy)*9));const k=(j*(N-1)+i)*4;
  if(sh>0){id.data[k]=60;id.data[k+1]=86;id.data[k+2]=140;id.data[k+3]=Math.min(150,sh*190);}else{id.data[k]=255;id.data[k+1]=255;id.data[k+2]=255;id.data[k+3]=Math.min(110,-sh*150);}}
 x.putImageData(id,0,0);return img;
}
export function* alpineChunkSteps(G,ix,iy,scale){
 const SZ=512,x0=ix*SZ,y0=iy*SZ,m={x:x0-260,y:y0-260,w:SZ+520,h:SZ+520};
 const cv=canvas(Math.ceil(SZ*scale),Math.ceil(SZ*scale)),c=cv.getContext('2d');c.setTransform(scale,0,0,scale,-x0*scale,-y0*scale);
 const A=G.world.alpine;yield {canvas:cv};
 const land=y0+SZ>H0;
 if(y0<H0&&y0+SZ>9880){const top=Math.max(y0,9880),bot=Math.min(y0+SZ,H0);c.save();c.beginPath();c.rect(Math.max(x0,coastX(H0)-40),top,SZ,bot-top);c.clip();
  const g=c.createLinearGradient(0,9880,0,H0);g.addColorStop(0,'rgba(233,239,246,0)');g.addColorStop(.55,'rgba(233,239,246,.35)');g.addColorStop(1,'rgba(233,239,246,.9)');c.fillStyle=g;c.fillRect(x0,top,SZ,bot-top);
  const r=rng(ix*57+iy*13+1);for(let i=0;i<120;i++){const x=x0+r()*SZ,y=9890+Math.sqrt(r())*(H0-9890);if(y<top||y>bot)continue;const k=(y-9890)/(H0-9890);c.fillStyle=`rgba(${r()<.5?'246,249,252':'214,226,240'},${.25+k*.6})`;c.beginPath();c.ellipse(x,y,8+r()*26*k+4,3+r()*8*k+2,-.35+r()*.3,0,TAU);c.fill();}
  c.restore();}
 if(land){
  const top=Math.max(y0,H0);c.save();c.beginPath();c.rect(x0,top,SZ,y0+SZ-top);c.clip();
  // sea and its icy shore
  if(x0<6000){c.fillStyle=SN.sea;c.fillRect(x0,top,SZ,SZ);const wt=G.assets?.tex?.water;if(wt){c.globalAlpha=.2;c.fillStyle=c.createPattern(wt,'repeat');c.fillRect(x0,top,SZ,SZ);c.globalAlpha=1;}}
  const shore=[];for(let y=top-16;y<=y0+SZ+16;y+=16)shore.push([coastX(y),y]);
  c.beginPath();c.moveTo(x0+SZ+20,top-16);for(const p of shore)c.lineTo(p[0],p[1]);c.lineTo(x0+SZ+20,y0+SZ+16);c.closePath();
  if(x0<6000){c.save();c.lineJoin='round';c.strokeStyle='rgba(180,220,235,.5)';c.lineWidth=60;c.stroke();c.strokeStyle='rgba(225,242,250,.85)';c.lineWidth=22;c.stroke();c.restore();}
  c.fillStyle=pat(c,'snow');c.fill();
  yield;
  // hill shading for relief
  c.imageSmoothingEnabled=true;c.drawImage(hillshade(ix,iy,SZ),x0,y0,SZ,SZ);
  // beach to snow transition below the frontier
  if(y0<H0+300){const g=c.createLinearGradient(0,H0,0,H0+260);g.addColorStop(0,x0<8800?'rgba(214,190,140,.28)':'rgba(150,128,96,.25)');g.addColorStop(1,'rgba(233,239,246,0)');c.fillStyle=g;c.fillRect(Math.max(x0,coastX(H0)),H0,SZ,260);
   c.fillStyle='rgba(255,255,255,.75)';const r=rng(ix*91+7);for(let i=0;i<40;i++){const x=x0+r()*SZ,y=H0+40+r()*200;c.beginPath();c.ellipse(x,y,6+r()*18,3+r()*6,0,0,TAU);c.fill();}}
  // wind drifts: long soft blue-shadowed ridges
  {const r=rng(ix*733+iy*177+5);for(let i=0;i<10;i++){const x=x0+r()*SZ,y=Math.max(top,y0)+r()*SZ,l=40+r()*90,w=8+r()*12;c.save();c.translate(x,y);c.rotate(-.35);
   c.fillStyle='rgba(120,148,190,.3)';c.beginPath();c.moveTo(-l/2,0);c.quadraticCurveTo(0,w*1.6,l/2,0);c.quadraticCurveTo(0,w*.5,-l/2,0);c.fill();
   c.fillStyle='rgba(255,255,255,.92)';c.beginPath();c.moveTo(-l/2,0);c.quadraticCurveTo(0,-w,l/2,0);c.quadraticCurveTo(0,w*.4,-l/2,0);c.fill();c.restore();}
  for(let i=0;i<70;i++){c.fillStyle=r()<.6?'rgba(255,255,255,.95)':'rgba(180,215,255,.9)';c.fillRect(x0+r()*SZ,Math.max(top,y0)+r()*SZ,1.6,1.6);}}
  {const r=rng(ix*733+iy*177);for(let i=0;i<7;i++){const x=x0+r()*SZ,y=Math.max(top,y0)+r()*SZ,l=60+r()*120;c.strokeStyle='rgba(150,172,205,.32)';c.lineWidth=7;c.beginPath();c.moveTo(x,y);c.quadraticCurveTo(x+l*.5,y-10,x+l,y+4);c.stroke();c.strokeStyle='rgba(255,255,255,.8)';c.lineWidth=3;c.beginPath();c.moveTo(x,y-4);c.quadraticCurveTo(x+l*.5,y-14,x+l,y);c.stroke();}}
  yield;
  // frozen lake
  if(hits(m,{x:LAKE.cx-LAKE.rx-80,y:LAKE.cy-LAKE.ry-80,w:LAKE.rx*2+160,h:LAKE.ry*2+160})){
   c.fillStyle='rgba(160,185,215,.6)';c.beginPath();c.ellipse(LAKE.cx,LAKE.cy,LAKE.rx+30,LAKE.ry+24,0,0,TAU);c.fill();
   c.fillStyle=pat(c,'ice');c.beginPath();c.ellipse(LAKE.cx,LAKE.cy,LAKE.rx,LAKE.ry,0,0,TAU);c.fill();
   c.save();c.clip();const g=c.createRadialGradient(LAKE.cx-120,LAKE.cy-80,30,LAKE.cx,LAKE.cy,LAKE.rx);g.addColorStop(0,'rgba(255,255,255,.35)');g.addColorStop(1,'rgba(40,110,150,.25)');c.fillStyle=g;c.fillRect(LAKE.cx-LAKE.rx,LAKE.cy-LAKE.ry,LAKE.rx*2,LAKE.ry*2);
   c.strokeStyle='rgba(255,255,255,.55)';c.lineWidth=2;const r=rng(55);for(let i=0;i<9;i++){const cx=LAKE.cx+(r()-.5)*LAKE.rx*1.4,cy=LAKE.cy+(r()-.5)*LAKE.ry*1.4,rad=30+r()*60;c.beginPath();c.ellipse(cx,cy,rad,rad*.45,r()*3,0,TAU*(.4+r()*.5));c.stroke();}
   c.fillStyle='rgba(245,250,255,.85)';for(let i=0;i<10;i++){const a=r()*TAU;c.beginPath();c.ellipse(LAKE.cx+Math.cos(a)*LAKE.rx*.9,LAKE.cy+Math.sin(a)*LAKE.ry*.9,30+r()*40,10+r()*12,a+Math.PI/2,0,TAU);c.fill();}
   c.strokeStyle='rgba(255,255,255,.5)';c.lineWidth=1.2;for(let i=0;i<7;i++){const cx=LAKE.cx+(r()-.5)*LAKE.rx,cy=LAKE.cy+(r()-.5)*LAKE.ry,a=60+r()*90,b=30+r()*40;for(const off of [0,3.5]){c.beginPath();c.ellipse(cx-a/2,cy,a/2+off,b/2+off,0,0,TAU);c.ellipse(cx+a/2,cy,a/2+off,b/2+off,0,Math.PI,Math.PI+TAU);c.stroke();}}
   c.strokeStyle='rgba(30,80,110,.35)';c.lineWidth=1.4;for(let i=0;i<8;i++){let x=LAKE.cx+(r()-.5)*LAKE.rx*1.5,y=LAKE.cy+(r()-.5)*LAKE.ry*1.5;c.beginPath();c.moveTo(x,y);for(let j=0;j<6;j++){x+=(r()-.5)*70;y+=(r()-.5)*40;c.lineTo(x,y);}c.stroke();}
   c.restore();c.strokeStyle='rgba(255,255,255,.9)';c.lineWidth=5;c.beginPath();c.ellipse(LAKE.cx,LAKE.cy,LAKE.rx,LAKE.ry,0,0,TAU);c.stroke();
  }
  for(const k of A.cliffs)if(inR(k.x,k.y,m,k.rx+20))paintCliff(c,k);
  c.restore();
  yield;
 }
 paintRoads(c,A,m);
 if(land){paintRails(c,m);
  yield;
  paintVillage(c,A,m);
  for(const p of A.props)if(inR(p.x,p.y,m,40))paintProp(c,p);
  // plaza edge, lift station pads, pylons
  for(const p of A.pylons)if(inR(p.x,p.y,m,30)){c.fillStyle='rgba(50,70,110,.35)';c.fillRect(p.x-2,p.y+2,18,18);c.fillStyle='#585c63';c.fillRect(p.x-8,p.y-8,16,16);c.fillStyle='#f4f8fc';c.fillRect(p.x-8,p.y-8,16,4);}
  for(const [x,y] of [LIFT[0],LIFT[LIFT.length-1]])if(inR(x,y,m,80)){c.fillStyle='rgba(50,70,110,.35)';c.fillRect(x-26,y-18,60,48);c.fillStyle='#b23a2e';c.fillRect(x-32,y-24,64,44);c.fillStyle='#f4f8fc';c.fillRect(x-34,y-28,68,14);c.fillStyle='#2a2a2a';c.font='800 9px system-ui';c.textAlign='center';c.textBaseline='middle';c.fillText('PEAK LIFT',x,y+6);}
  paintObservatory(c,A,m);
  // village welcome sign
  if(inR(9100,10200,m,120)){c.fillStyle='rgba(50,70,110,.3)';c.fillRect(9100,10208,96,30);c.fillStyle='#5e3b22';c.fillRect(9096,10198,96,30);c.fillStyle='#f4f8fc';c.fillRect(9094,10194,100,6);c.fillStyle='#f2e6c8';c.font='900 11px system-ui';c.textAlign='center';c.textBaseline='middle';c.fillText('FROSTFALL',9144,10215);}
  yield;
  c.save();c.beginPath();c.rect(x0,Math.max(y0,H0),SZ,SZ);c.clip();
  for(const p of A.pines)if(Math.abs(p.x-x0-256)<300&&Math.abs(p.y-y0-256)<300)paintPine(c,p,true);
  for(const p of A.pines)if(Math.abs(p.x-x0-256)<300&&Math.abs(p.y-y0-256)<300)paintPine(c,p,false);
  c.restore();
 }
 return cv;
}

/* ------------------------------------------------------------ runtime */
export function initAlpine(G){const A=G.world.alpine;if(!A)return;A.cache=new Map();}
function chunk(G,ix,iy,budget){
 const A=G.world.alpine,key=ix+':'+iy,low=G.settings.quality==='low',scale=low?.5:1;
 let e=A.cache.get(key);
 if(e&&e.scale!==scale){if(e.c)e.c.width=1;A.cache.delete(key);e=null;}
 if(e){e.t=G.ticks;if(!e.job)return e.c;}
 if(!e){if(performance.now()>budget.until&&budget.used)return null;e={job:alpineChunkSteps(G,ix,iy,scale),scale,t:G.ticks,c:null};A.cache.set(key,e);}
 while(performance.now()<budget.until||!budget.used){budget.used=true;const s=e.job.next();if(s.value?.canvas)e.c=s.value.canvas;if(s.done){e.c=s.value;e.job=null;e.done=true;return e.c;}}
 return null;
}
function trimCache(G,limit){const A=G.world.alpine;if(A.cache.size<=limit)return;const cold=[...A.cache].sort((a,b)=>a[1].t-b[1].t);for(let i=0;i<cold.length-limit;i++){const e=cold[i][1];if(e.t===G.ticks)continue;if(e.c)e.c.width=1;e.job?.return?.();A.cache.delete(cold[i][0]);}}
export function drawAlpineGround(G,r){
 const A=G.world.alpine;if(!A||!A.cache||r.y1<PEAK_BOUNDS.y0)return;const c=G.ctx,SZ=512;
 const ix0=Math.max(0,Math.floor(r.x0/SZ)),ix1=Math.min(23,Math.floor(r.x1/SZ)),iy0=Math.max(Math.floor(PEAK_BOUNDS.y0/SZ),Math.floor(r.y0/SZ)),iy1=Math.min(Math.floor((PEAK_BOUNDS.y1-1)/SZ),Math.floor(r.y1/SZ));
 const low=G.settings.quality==='low',budget={until:performance.now()+(low?3:5),used:false};
 const list=[];for(let iy=iy0;iy<=iy1;iy++)for(let ix=ix0;ix<=ix1;ix++){const by=iy*SZ,bx=ix*SZ;if(by+SZ<=9880||by+SZ<=H0&&(bx+SZ<4600||bx>11900))continue;list.push({ix,iy,d:(bx+256-G.cam.x)**2+(by+256-G.cam.y)**2});}
 list.sort((a,b)=>a.d-b.d);let pending=0;
 for(const {ix,iy} of list){const im=chunk(G,ix,iy,budget);if(im&&A.cache.get(ix+':'+iy)?.done)c.drawImage(im,ix*SZ,iy*SZ,SZ,SZ);else{pending++;if(iy*SZ+SZ>H0){c.fillStyle=ix*SZ<5200?SN.sea:SN.base;c.fillRect(ix*SZ,Math.max(H0,iy*SZ),SZ,SZ);}}}
 A.pending=pending;trimCache(G,Math.max(low?18:26,list.length+6));
}
let PUFF=null;function puff(){if(PUFF)return PUFF;const c=canvas(64,64),x=c.getContext('2d'),g=x.createRadialGradient(32,32,2,32,32,32);g.addColorStop(0,'rgba(128,136,150,.85)');g.addColorStop(.6,'rgba(150,158,172,.42)');g.addColorStop(1,'rgba(160,168,180,0)');x.fillStyle=g;x.fillRect(0,0,64,64);return PUFF=c;}
const BEANIE=['#c8312c','#2f6fb2','#e0b040','#2f8f5a','#7d3cc8','#f4f4f4'];
export function drawAlpineOverhead(G,r){
 const A=G.world.alpine;if(!A||r.y1<H0-100)return;const c=G.ctx,t=G.settings.reducedMotion?0:G.ticks/60;
 // winter-dressed pedestrians: knit hats and scarves on everyone in the snow
 for(const p of G.peds){if(p.dead||p.y<H0-40||p.x<r.x0||p.x>r.x1||p.y<r.y0||p.y>r.y1)continue;const k=((p.x*7+(p.id||0)*13)|0)&7,col=BEANIE[(p.sprite?.length||k)%6];
  // standing sprites are ~50 px tall with feet at p.y: the hat sits on the head, the scarf at the neck
  const hx=p.x,hy=p.y-45;c.fillStyle=BEANIE[(k+2)%6];c.fillRect(hx-4,hy+6.5,8,2.2);c.fillRect(hx+1.5,hy+8,2,3.5);
  c.fillStyle=col;c.beginPath();c.ellipse(hx,hy,4.8,4.2,0,Math.PI,TAU);c.fill();c.fillRect(hx-5,hy-.4,10,2.4);
  c.fillStyle='rgba(255,255,255,.35)';c.fillRect(hx-5,hy+.3,10,.9);c.fillStyle='#f4f4f4';c.beginPath();c.arc(hx,hy-4.6,1.9,0,TAU);c.fill();
  const bk=(t*.6+k*.13)%1;if(bk<.45){c.fillStyle=`rgba(240,246,252,${.5*(1-bk/.45)})`;c.beginPath();c.arc(hx+Math.cos(p.rot||0)*(6+bk*14),hy+8+Math.sin(p.rot||0)*(6+bk*14),2.5+bk*7,0,TAU);c.fill();}}
 // chimney smoke drifting with the wind
 const img=puff();
 for(const C of A.chalets){const ch=C.chimney;if(ch.x<r.x0-200||ch.x>r.x1+100||ch.y<r.y0-100||ch.y>r.y1+200)continue;
  const sm=.5+.35*(1-(G.night||0));for(let i=0;i<6;i++){const k=((t*.35+i/6+C.seed)%1),s=16+k*52;c.globalAlpha=(1-k)*sm;c.drawImage(img,ch.x+k*70-s/2+Math.sin(t+i)*6,ch.y-k*90-s/2,s,s);}c.globalAlpha=1;}
 // chair lift: cable and moving chairs
 if(r.x1>10150&&r.x0<10560&&r.y1>10950&&r.y0<12970){c.strokeStyle='rgba(30,30,36,.75)';c.lineWidth=2;c.beginPath();c.moveTo(LIFT[0][0]-6,LIFT[0][1]);for(const p of LIFT)c.lineTo(p[0]-6,p[1]);c.moveTo(LIFT[0][0]+6,LIFT[0][1]);for(const p of LIFT)c.lineTo(p[0]+6,p[1]);c.stroke();
  let L=0;const seg=[];for(let i=1;i<LIFT.length;i++){const d=Math.hypot(LIFT[i][0]-LIFT[i-1][0],LIFT[i][1]-LIFT[i-1][1]);seg.push(d);L+=d;}
  for(let n=0;n<22;n++)for(const side of [-1,1]){let s=((n/22+(side>0?t*.012:-t*.012))%1+1)%1*L,i=0;while(i<seg.length-1&&s>seg[i]){s-=seg[i];i++;}const a=LIFT[i],b=LIFT[i+1],f=s/seg[i],x=a[0]+(b[0]-a[0])*f+side*6,y=a[1]+(b[1]-a[1])*f;
   if(x<r.x0||x>r.x1||y<r.y0||y>r.y1)continue;c.fillStyle='rgba(40,60,100,.25)';c.fillRect(x+10,y+16,14,9);
   // chair: hanger arm, padded seat, backrest bar, footrest; every other chair carries riders
   c.fillStyle='#22262c';c.fillRect(x-1,y-9,2,6);c.fillStyle=side>0?'#c8312c':'#2f6fb2';c.fillRect(x-7,y-3,14,7);c.fillStyle='#16181c';c.fillRect(x-7,y-4,14,1.6);c.fillRect(x-7,y+4,14,1.2);
   if((n+(side>0?1:0))%2===0){const cols=['#e0b040','#2f8a4a','#d0302a','#7b2f4a'];for(let q=0;q<2;q++){c.fillStyle=cols[(n+q)%4];c.beginPath();c.arc(x-3.5+q*7,y,2.6,0,TAU);c.fill();c.fillStyle='#f4f4f4';c.fillRect(x-5+q*7,y-2.6,3,1.2);}}}}
}
export function drawAlpineLights(G,r,night){
 const A=G.world.alpine;if(!A||night<.05||r.y1<H0-100)return;const c=G.ctx,t=G.settings.reducedMotion?0:G.ticks/60;
 c.save();c.globalCompositeOperation='lighter';
 for(const C of A.chalets){if(C.x>r.x1||C.x+C.w<r.x0||C.y>r.y1+120||C.y+C.h<r.y0-120)continue;
  c.globalAlpha=.9*night;c.fillStyle='rgba(255,186,96,1)';for(const [x,y,w,h] of C.win)c.fillRect(x+2,y+2,w-4,h-4);
  const gy=C.front==='S'?C.y+C.h+30:C.y-30;c.globalAlpha=.42*night;const g=c.createRadialGradient(C.x+C.w/2,gy,6,C.x+C.w/2,gy,C.w*.6);g.addColorStop(0,'rgba(255,180,90,.9)');g.addColorStop(1,'rgba(255,180,90,0)');c.fillStyle=g;c.fillRect(C.x-C.w*.1,gy-C.w*.6,C.w*1.2,C.w*1.2);}
 c.globalAlpha=.95*night;const cols=['#ffd36b','#ff6b6b','#6bd7ff','#9dff7a'];
 for(const C of A.chalets){if(C.x>r.x1||C.x+C.w<r.x0||C.y>r.y1+60||C.y+C.h<r.y0-60)continue;const ey=C.front==='S'?C.y+C.h-C.fac+4:C.y+C.fac-4;
  for(let i=0,n=Math.floor(C.w/14);i<=n;i++){const x=C.x+i*C.w/n,sag=Math.sin(i/n*Math.PI*3)*3;c.fillStyle=cols[(i+C.id)%4];c.globalAlpha=night*(.7+.3*Math.sin(t*2+i));c.beginPath();c.arc(x,ey+Math.abs(sag),2.4,0,TAU);c.fill();}}
 const O=OBS;if(Math.abs(O.x-(r.x0+r.x1)/2)<1400&&Math.abs(O.y-(r.y0+r.y1)/2)<1400){c.globalAlpha=night*(.6+.4*Math.sin(t*3));c.fillStyle='#ff4a4a';c.beginPath();c.arc(O.x+130,O.y-32,5,0,TAU);c.fill();c.globalAlpha=.45*night;const g=c.createRadialGradient(O.x,O.y,10,O.x,O.y,O.r+90);g.addColorStop(0,'rgba(150,190,255,.7)');g.addColorStop(1,'rgba(150,190,255,0)');c.fillStyle=g;c.beginPath();c.arc(O.x,O.y,O.r+90,0,TAU);c.fill();}
 c.restore();
}
// Falling snow in parallax layers, from pre-rendered tiles; cheap on phones.
let FLAKES=null;
function flakes(){if(FLAKES)return FLAKES;const mk=(n,r0,r1,a,seed)=>{const cv=canvas(256,256),x=cv.getContext('2d'),r=rng(seed);for(let i=0;i<n;i++){const px=r()*256,py=r()*256,rad=r0+r()*(r1-r0);for(const [ox,oy] of [[0,0],[256,0],[0,256],[256,256],[-256,0],[0,-256]]){const g=x.createRadialGradient(px+ox,py+oy,0,px+ox,py+oy,rad);g.addColorStop(0,`rgba(255,255,255,${a})`);g.addColorStop(.55,`rgba(245,250,255,${a*.6})`);g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(px+ox-rad,py+oy-rad,rad*2,rad*2);}}return cv;};
 // far+mid share one pre-composited tile: one full-screen fill instead of two (plus the haze, folded in)
 const far=mk(90,1,1.8,.75,5),mid=mk(34,1.8,3,.85,9),fm=canvas(256,256),x=fm.getContext('2d');x.fillStyle='rgba(223,232,243,.16)';x.fillRect(0,0,256,256);x.globalAlpha=.85;x.drawImage(far,0,0);x.globalAlpha=1;x.drawImage(mid,0,0);
 return FLAKES={fm,near:mk(12,3,5.2,.9,13)};}
export function alpineMix(G){const P=G.player||G.cam;if(!P)return 0;const y=G.cam?.y??P.y,x=G.cam?.x??P.x;if(y<H0-500)return 0;const k=Math.max(0,Math.min(1,(y-(H0-500))/700));return x<coastX(y)-300?k*.12:k;}
export function drawSnowfall(G){
 const mix=alpineMix(G);G.alpineMix=mix;if(mix<.02)return;const c=G.ctx,w=G.canvas.width,h=G.canvas.height,F=flakes(),low=G.settings.quality==='low';
 const t=G.settings.reducedMotion?0:performance.now()/1000,heavy=.65+Math.min(1,(G.rainAmt||0)*1.2)*.35,s=Math.max(1,w/1280);
 const layers=low?[[F.fm,36,.5,.8]]:[[F.fm,36,.5,.8],[F.near,80,1,.85]];
 c.save();c.setTransform(1,0,0,1,0,0);
 for(const [img,speed,par,a] of layers){const p=c.createPattern(img,'repeat');const ox=((-(G.cam.x||0)*par*.25+Math.sin(t*.5+speed)*22+t*speed*.35)%256+256)%256,oy=((-(G.cam.y||0)*par*.25+t*speed)%256+256)%256;
  p.setTransform(new DOMMatrix([s,0,0,s,ox*s,oy*s]));c.globalAlpha=a*mix*heavy;c.fillStyle=p;c.fillRect(0,0,w,h);}
 c.restore();
}

// Snow keeps its cool white under a warm sky: pull the ambient multiply toward neutral-cool.
export function coolSnow(amb,mix){if(!(mix>0))return amb;const L=(amb[0]+amb[1]+amb[2])/3,k=Math.min(1,mix)*.8,t=[Math.min(255,L*1.0),Math.min(255,L*1.02),Math.min(255,L*1.07)];
 return [amb[0]+(t[0]-amb[0])*k,amb[1]+(t[1]-amb[1])*k,amb[2]+(t[2]-amb[2])*k];}
