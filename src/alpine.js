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
 // lake ice (drivable, slick), then roads, plaza
 for(let y=LAKE.cy-LAKE.ry;y<LAKE.cy+LAKE.ry;y+=CELL)for(let x=LAKE.cx-LAKE.rx;x<LAKE.cx+LAKE.rx;x+=CELL)if(lakeV(x+8,y+8)<1)fillAny(x,y,CELL,CELL,CODE.lot);
 // village pavements: boardwalks either side of the main street
 fillAny(9300,10704,1250,40,CODE.walk);fillAny(9300,10888,1250,40,CODE.walk);
 for(const r of roadRects)fillAny(r.x,r.y,r.w,r.h,CODE.road);
 fillAny(PLAZA.x,PLAZA.y,PLAZA.w,PLAZA.h,CODE.road);
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
 for(const [x,y,k] of [[9260,10620,'snowman'],[10560,11010,'wood'],[9960,10960,'sled'],[9600,10630,'wood'],[8000,10560,'snowman'],[8700,10760,'sled'],[10250,12640,'snowman']])if(!roadNear(x,y,30))A.props.push({x,y,k});
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
const SN={base:'#e9eff6',shade:'#c9d7e8',deep:'#a9bcd6',hi:'#fbfdff',rock:'#6c6a6e',rock2:'#8a8790',asphalt:'#4a4f56',sea:'#20465a'};
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
 // plaza markings: turning circle
 c.strokeStyle='rgba(236,196,80,.5)';c.lineWidth=4;c.setLineDash([18,16]);c.beginPath();c.arc(PLAZA.x+PLAZA.w/2,PLAZA.y+PLAZA.h/2,90,0,TAU);c.stroke();c.setLineDash([]);
}
function offsetPath(P,off){const out=[],n=P.length;for(let i=0;i<n;i++){const b=P[i];let nx=0,ny=0;
 if(i>0){const d=norm(b[0]-P[i-1][0],b[1]-P[i-1][1]);nx+=-d[1];ny+=d[0];}
 if(i<n-1){const d=norm(P[i+1][0]-b[0],P[i+1][1]-b[1]);nx+=-d[1];ny+=d[0];}
 if(i===0||i===n-1){const L=Math.hypot(nx,ny)||1;nx/=L;ny/=L;}
 out.push([b[0]+nx*off,b[1]+ny*off]);}return out;}
function norm(x,y){const L=Math.hypot(x,y);return L?[x/L,y/L]:[0,0];}
function paintRails(c,m){
 for(const R of RAILS){const bb={x:Math.min(...R.map(p=>p[0]))-30,y:Math.min(...R.map(p=>p[1]))-30,w:0,h:0};bb.w=Math.max(...R.map(p=>p[0]))+30-bb.x;bb.h=Math.max(...R.map(p=>p[1]))+30-bb.y;if(!hits(bb,m))continue;
  c.lineJoin='round';roundedPath(c,R.map(p=>[p[0]+6,p[1]+8]),40);c.strokeStyle='rgba(60,80,110,.3)';c.lineWidth=10;c.stroke();
  // posts
  for(let i=1;i<R.length;i++){const [ax,ay]=R[i-1],[bx,by]=R[i],L=Math.hypot(bx-ax,by-ay);for(let t=0;t<L;t+=48){const x=ax+(bx-ax)*t/L,y=ay+(by-ay)*t/L;c.fillStyle='#3d3f44';c.fillRect(x-3,y-3,7,7);c.fillStyle='#f3f7fb';c.fillRect(x-3,y-4,7,3);}}
  roundedPath(c,R,40);c.strokeStyle='#9aa3ad';c.lineWidth=6;c.stroke();roundedPath(c,R,40);c.strokeStyle='#d8dee5';c.lineWidth=2;c.stroke();
  // red-white chevrons on the outer hairpin bends
  for(let i=1;i<R.length-1;i++){const [x,y]=R[i];c.save();c.translate(x,y);for(let k=-1;k<=1;k++){c.fillStyle=k%2?'#c8312c':'#f4f4f4';c.fillRect(-7+k*0,-7+k*16,14,10);}c.restore();}
 }
}
function paintCliff(c,k){
 c.save();c.translate(10,13);smoothPoly(c,k.pts);c.fillStyle='rgba(60,80,120,.32)';c.fill();c.restore();
 smoothPoly(c,k.pts);c.fillStyle=pat(c,'rock');c.fill();c.strokeStyle='rgba(30,28,34,.55)';c.lineWidth=2;c.stroke();
 // lit north-west face, shadowed south-east face
 c.save();smoothPoly(c,k.pts);c.clip();const g=c.createLinearGradient(k.x-k.rx,k.y-k.ry,k.x+k.rx,k.y+k.ry);g.addColorStop(0,'rgba(255,255,255,.22)');g.addColorStop(.55,'rgba(0,0,0,0)');g.addColorStop(1,'rgba(20,20,40,.35)');c.fillStyle=g;c.fillRect(k.x-k.rx-4,k.y-k.ry-4,k.rx*2+8,k.ry*2+8);
 // snow lying on the north-west crest, with a soft blue edge where it meets the rock
 const r=rng(Math.floor(k.seed*1e6));
 c.fillStyle='rgba(190,206,228,.9)';c.beginPath();c.ellipse(k.x-k.rx*.28,k.y-k.ry*.42,k.rx*.95,k.ry*.62,-.35,0,TAU);c.fill();
 c.fillStyle='#f3f7fb';c.beginPath();c.ellipse(k.x-k.rx*.34,k.y-k.ry*.5,k.rx*.88,k.ry*.52,-.35,0,TAU);c.fill();
 c.strokeStyle='rgba(40,38,46,.5)';c.lineWidth=1.5;for(let i=0;i<5;i++){const x=k.x+(r()-.3)*k.rx*.9,y=k.y+(r()-.1)*k.ry*.6;c.beginPath();c.moveTo(x,y);c.lineTo(x+(r()-.5)*k.rx*.4,y+k.ry*(.15+r()*.25));c.stroke();}
 c.fillStyle='rgba(255,255,255,.85)';for(let i=0;i<4;i++){const x=k.x+(r()-.2)*k.rx*.8,y=k.y+(r()-.2)*k.ry*.7;c.beginPath();c.ellipse(x,y,k.rx*.12,k.ry*.06,.2,0,TAU);c.fill();}
 c.restore();
}
function paintPine(c,p,shadow){
 const r=p.r;if(shadow){c.fillStyle='rgba(55,78,120,.28)';c.beginPath();c.ellipse(p.x+r*.55,p.y+r*.7,r*1.02,r*.82,0.5,0,TAU);c.fill();return;}
 const rr=rng(Math.floor(p.seed*1e7)),tiers=3;
 for(let t=0;t<tiers;t++){const R=r*(1-t*.28),n=8+t;c.beginPath();for(let i=0;i<n*2;i++){const a=i/(n*2)*TAU+p.seed*3+t*.4,q=i%2?R*.58:R;const x=p.x+Math.cos(a)*q-t*1.5,y=p.y+Math.sin(a)*q-t*2;i?c.lineTo(x,y):c.moveTo(x,y);}c.closePath();
  c.fillStyle=['#23463a','#2c5646','#356452'][t];c.fill();
  // snow resting on the upper (north-west) side of each tier
  c.save();c.clip();c.fillStyle='rgba(236,243,250,.78)';c.beginPath();c.ellipse(p.x-R*.42-t,p.y-R*.46-t*2,R*.5,R*.32,-.6,0,TAU);c.fill();c.fillStyle='rgba(200,215,235,.5)';c.beginPath();c.ellipse(p.x-R*.1,p.y-R*.05,R*.4,R*.2,-.6,0,TAU);c.fill();c.restore();}
 c.fillStyle='#f6f9fc';c.beginPath();c.arc(p.x-4,p.y-6,Math.max(2,r*.16),0,TAU);c.fill();
 if(rr()<.5){c.fillStyle='rgba(255,255,255,.95)';c.fillRect(p.x-r*.5,p.y-r*.3,1.5,1.5);c.fillRect(p.x+r*.2,p.y-r*.55,1.5,1.5);}
}
function shade(hex,k){const n=parseInt(hex.slice(1),16),f=v=>Math.max(0,Math.min(255,Math.round(k<0?v*(1+k):v+(255-v)*k)));return '#'+[n>>16,n>>8&255,n&255].map(f).map(v=>v.toString(16).padStart(2,'0')).join('');}
function paintChalet(c,C){
 const {x,y,w,h,fac}=C,south=C.front==='S',roofY=south?y:y+fac,roofH=h-fac,facY=south?y+h-fac:y,r=rng(Math.floor(C.seed*1e7));
 c.fillStyle='rgba(50,70,110,.3)';c.fillRect(x+12,y+16,w+6,h+4);
 // facade: vertical larch planks, stone plinth, windows with shutters, door, balcony
 c.fillStyle=C.wood;c.fillRect(x,facY,w,fac);c.strokeStyle=shade(C.wood,-.3);c.lineWidth=1;for(let px=x+6;px<x+w;px+=9){c.beginPath();c.moveTo(px,facY);c.lineTo(px,facY+fac);c.stroke();}
 c.fillStyle='#8c8a86';c.fillRect(x,south?facY+fac-10:facY,w,10);c.fillStyle='rgba(0,0,0,.18)';for(let px=x;px<x+w;px+=14)c.fillRect(px,south?facY+fac-10:facY,1,10);
 for(const [wx,wy,ww,wh] of C.win){c.fillStyle='#2b3440';c.fillRect(wx,wy,ww,wh);c.fillStyle='rgba(150,190,220,.55)';c.fillRect(wx+2,wy+2,ww-4,wh*.45);c.strokeStyle=C.trim;c.lineWidth=2;c.strokeRect(wx,wy,ww,wh);c.fillStyle=C.trim;c.fillRect(wx-6,wy,5,wh);c.fillRect(wx+ww+1,wy,5,wh);c.fillStyle='#c94a3a';c.fillRect(wx,wy+wh,ww,4);c.fillStyle='#e9eef4';c.fillRect(wx-1,wy+wh+3,ww+2,2);}
 if(south){const dx=x+w/2-13;c.fillStyle='#3a2416';c.fillRect(dx,facY+fac-34,26,32);c.fillStyle='#d9a43a';c.fillRect(dx+20,facY+fac-20,3,3);c.fillStyle='#b9c4d0';c.fillRect(dx-6,facY+fac,38,8);}
 if(C.balcony){const by=south?facY+fac*.14:facY+fac*.6;c.fillStyle=shade(C.wood,.15);c.fillRect(x+8,by,w-16,4);for(let px=x+10;px<x+w-8;px+=8)c.fillRect(px,by,2,fac*.2);c.fillStyle='#eef3f8';c.fillRect(x+8,by-2,w-16,2);}
 // roof: dark eaves, deep snow, ridge, icicles on the eave line
 c.fillStyle=C.roof;c.fillRect(x-8,roofY-6,w+16,roofH+10);
 const ridge=C.gable?null:roofY+roofH*.42;
 c.fillStyle='#f4f8fc';c.fillRect(x-4,roofY-3,w+8,roofH+2);
 if(ridge){const g=c.createLinearGradient(0,roofY,0,ridge);g.addColorStop(0,'#cfdcea');g.addColorStop(1,'#e7eef6');c.fillStyle=g;c.fillRect(x-4,roofY-3,w+8,ridge-roofY+3);c.fillStyle='rgba(130,150,185,.55)';c.fillRect(x-4,ridge-1,w+8,3);c.fillStyle='rgba(255,255,255,.9)';c.fillRect(x-4,ridge+2,w+8,2);}
 else{const mx=x+w/2,g=c.createLinearGradient(x,0,mx,0);g.addColorStop(0,'#c9d7e8');g.addColorStop(1,'#e8eff7');c.fillStyle=g;c.fillRect(x-4,roofY-3,w/2+4,roofH+2);c.fillStyle='rgba(130,150,185,.55)';c.fillRect(mx-1,roofY-3,3,roofH+2);}
 c.save();c.globalAlpha=.55;c.fillStyle=pat(c,'snow');c.fillRect(x-4,roofY-3,w+8,roofH+2);c.restore();
 {const sy=south?roofY+roofH:roofY-3,g=c.createLinearGradient(0,sy-(south?roofH*.35:-roofH*.35),0,sy);g.addColorStop(0,'rgba(150,170,205,0)');g.addColorStop(1,'rgba(150,170,205,.45)');c.fillStyle=g;c.fillRect(x-4,south?sy-roofH*.35:sy,w+8,roofH*.35);}
 c.fillStyle=shade(C.roof,-.2);c.fillRect(x-8,south?roofY+roofH-1:roofY-6,w+16,5);
 // snow lumps and wind-scoured patches showing roof boards
 for(let i=0;i<5;i++){c.fillStyle=r()<.6?'rgba(255,255,255,.7)':'rgba(190,206,228,.45)';c.beginPath();c.ellipse(x+r()*w,roofY+r()*roofH,10+r()*22,4+r()*8,0,0,TAU);c.fill();}
 if(r()<.7){c.fillStyle=C.roof;c.globalAlpha=.55;c.fillRect(x+r()*(w-40),roofY+roofH*(.55+r()*.3),30+r()*20,6);c.globalAlpha=1;}
 const ey=south?roofY+roofH:roofY-3;c.fillStyle='#eaf3fb';for(let px=x-4;px<x+w+4;px+=7){const L=3+((px*13)%9);c.beginPath();c.moveTo(px,ey);c.lineTo(px+3,ey+(south?L:-L));c.lineTo(px+6,ey);c.fill();}
 const ch=C.chimney;c.fillStyle='rgba(50,70,110,.35)';c.fillRect(ch.x-6,ch.y-4,22,22);c.fillStyle='#8a837c';c.fillRect(ch.x-11,ch.y-11,22,22);c.fillStyle='rgba(0,0,0,.25)';for(let k=0;k<3;k++)c.fillRect(ch.x-11,ch.y-6+k*7,22,1);c.fillStyle='#f4f8fc';c.fillRect(ch.x-12,ch.y-13,24,6);c.fillStyle='#2a2220';c.fillRect(ch.x-5,ch.y-5,10,8);
}
function paintVillage(c,A,m){
 const V={x:9150,y:10360,w:1560,h:920};if(!hits(V,m))return;
 // trampled snow paths to each door
 for(const C of A.chalets){const dx=C.x+C.w/2,y0=C.front==='S'?C.y+C.h:C.y,y1=C.front==='S'?10704:10928;c.fillStyle='rgba(196,210,228,.55)';c.fillRect(dx-16,Math.min(y0,y1),32,Math.abs(y1-y0));c.fillStyle='rgba(150,165,190,.35)';for(let yy=Math.min(y0,y1)+4;yy<Math.max(y0,y1);yy+=12){c.beginPath();c.ellipse(dx-6,yy,3,5,0,0,TAU);c.ellipse(dx+6,yy+6,3,5,0,0,TAU);c.fill();}}
 // boardwalks
 for(const yy of [10704,10888]){c.fillStyle='#8a6a4a';c.fillRect(9300,yy,1250,40);c.strokeStyle='rgba(50,30,20,.45)';c.lineWidth=1;for(let px=9300;px<10550;px+=12){c.beginPath();c.moveTo(px,yy);c.lineTo(px,yy+40);c.stroke();}c.fillStyle='rgba(240,246,252,.7)';c.fillRect(9300,yy+(yy<10800?0:34),1250,6);}
 for(const C of A.chalets)if(hits({x:C.x-20,y:C.y-20,w:C.w+50,h:C.h+50},m))paintChalet(c,C);
 // fences between gardens
 c.strokeStyle='#6b4a32';c.lineWidth=3;for(const C of A.chalets){const fy=C.front==='S'?C.y-14:C.y+C.h+14;c.beginPath();c.moveTo(C.x-10,fy);c.lineTo(C.x+C.w+10,fy);c.stroke();c.fillStyle='#6b4a32';for(let px=C.x-10;px<=C.x+C.w+10;px+=18)c.fillRect(px-2,fy-4,4,8);c.fillStyle='#f4f8fc';c.fillRect(C.x-10,fy-4,C.w+20,2);}
}
function paintProp(c,p){const {x,y}=p;
 if(p.k==='snowman'){c.fillStyle='rgba(60,80,120,.3)';c.beginPath();c.ellipse(x+8,y+10,22,14,0,0,TAU);c.fill();c.fillStyle='#f6f9fc';c.beginPath();c.arc(x,y+6,18,0,TAU);c.fill();c.fillStyle='#e6eef6';c.beginPath();c.arc(x-2,y-10,12,0,TAU);c.fill();c.fillStyle='#2a2a2a';c.fillRect(x-8,y-24,14,8);c.fillRect(x-11,y-17,20,3);c.fillStyle='#e0782a';c.fillRect(x+6,y-11,8,3);c.fillStyle='#c8312c';c.fillRect(x-11,y-2,20,4);}
 else if(p.k==='wood'){c.fillStyle='rgba(60,80,120,.3)';c.fillRect(x-20,y-6,48,26);for(let i=0;i<10;i++){const lx=x-22+(i%5)*9,ly=y-8+Math.floor(i/5)*10;c.fillStyle='#8a5a34';c.beginPath();c.arc(lx,ly,4.5,0,TAU);c.fill();c.fillStyle='#d6b07a';c.beginPath();c.arc(lx,ly,2.5,0,TAU);c.fill();}c.fillStyle='#f4f8fc';c.fillRect(x-27,y-14,46,4);}
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
  if(y0<H0+300){const g=c.createLinearGradient(0,H0,0,H0+260);g.addColorStop(0,x0<8800?'rgba(214,190,140,.95)':'rgba(150,128,96,.9)');g.addColorStop(1,'rgba(233,239,246,0)');c.fillStyle=g;c.fillRect(Math.max(x0,coastX(H0)),H0,SZ,260);
   c.fillStyle='rgba(255,255,255,.75)';const r=rng(ix*91+7);for(let i=0;i<40;i++){const x=x0+r()*SZ,y=H0+40+r()*200;c.beginPath();c.ellipse(x,y,6+r()*18,3+r()*6,0,0,TAU);c.fill();}}
  // wind drifts: long soft blue-shadowed ridges
  {const r=rng(ix*733+iy*177);for(let i=0;i<7;i++){const x=x0+r()*SZ,y=Math.max(top,y0)+r()*SZ,l=60+r()*120;c.strokeStyle='rgba(150,172,205,.32)';c.lineWidth=7;c.beginPath();c.moveTo(x,y);c.quadraticCurveTo(x+l*.5,y-10,x+l,y+4);c.stroke();c.strokeStyle='rgba(255,255,255,.8)';c.lineWidth=3;c.beginPath();c.moveTo(x,y-4);c.quadraticCurveTo(x+l*.5,y-14,x+l,y);c.stroke();}}
  yield;
  // frozen lake
  if(hits(m,{x:LAKE.cx-LAKE.rx-80,y:LAKE.cy-LAKE.ry-80,w:LAKE.rx*2+160,h:LAKE.ry*2+160})){
   c.fillStyle='rgba(160,185,215,.6)';c.beginPath();c.ellipse(LAKE.cx,LAKE.cy,LAKE.rx+30,LAKE.ry+24,0,0,TAU);c.fill();
   c.fillStyle=pat(c,'ice');c.beginPath();c.ellipse(LAKE.cx,LAKE.cy,LAKE.rx,LAKE.ry,0,0,TAU);c.fill();
   c.save();c.clip();const g=c.createRadialGradient(LAKE.cx-120,LAKE.cy-80,30,LAKE.cx,LAKE.cy,LAKE.rx);g.addColorStop(0,'rgba(255,255,255,.35)');g.addColorStop(1,'rgba(40,110,150,.25)');c.fillStyle=g;c.fillRect(LAKE.cx-LAKE.rx,LAKE.cy-LAKE.ry,LAKE.rx*2,LAKE.ry*2);
   c.strokeStyle='rgba(255,255,255,.55)';c.lineWidth=2;const r=rng(55);for(let i=0;i<9;i++){const cx=LAKE.cx+(r()-.5)*LAKE.rx*1.4,cy=LAKE.cy+(r()-.5)*LAKE.ry*1.4,rad=30+r()*60;c.beginPath();c.ellipse(cx,cy,rad,rad*.45,r()*3,0,TAU*(.4+r()*.5));c.stroke();}
   c.fillStyle='rgba(245,250,255,.85)';for(let i=0;i<10;i++){const a=r()*TAU;c.beginPath();c.ellipse(LAKE.cx+Math.cos(a)*LAKE.rx*.9,LAKE.cy+Math.sin(a)*LAKE.ry*.9,30+r()*40,10+r()*12,a+Math.PI/2,0,TAU);c.fill();}
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
 const list=[];for(let iy=iy0;iy<=iy1;iy++)for(let ix=ix0;ix<=ix1;ix++){const by=iy*SZ,bx=ix*SZ;if(by+SZ<=H0&&!(bx<10760&&bx+SZ>9100))continue;list.push({ix,iy,d:(bx+256-G.cam.x)**2+(by+256-G.cam.y)**2});}
 list.sort((a,b)=>a.d-b.d);let pending=0;
 for(const {ix,iy} of list){const im=chunk(G,ix,iy,budget);if(im&&A.cache.get(ix+':'+iy)?.done)c.drawImage(im,ix*SZ,iy*SZ,SZ,SZ);else{pending++;if(iy*SZ+SZ>H0){c.fillStyle=ix*SZ<5200?SN.sea:SN.base;c.fillRect(ix*SZ,Math.max(H0,iy*SZ),SZ,SZ);}}}
 A.pending=pending;trimCache(G,Math.max(low?18:26,list.length+6));
}
let PUFF=null;function puff(){if(PUFF)return PUFF;const c=canvas(64,64),x=c.getContext('2d'),g=x.createRadialGradient(32,32,2,32,32,32);g.addColorStop(0,'rgba(236,240,246,.85)');g.addColorStop(.6,'rgba(220,226,236,.4)');g.addColorStop(1,'rgba(220,226,236,0)');x.fillStyle=g;x.fillRect(0,0,64,64);return PUFF=c;}
const BEANIE=['#c8312c','#2f6fb2','#e0b040','#2f8f5a','#7d3cc8','#f4f4f4'];
export function drawAlpineOverhead(G,r){
 const A=G.world.alpine;if(!A||r.y1<H0-100)return;const c=G.ctx,t=G.settings.reducedMotion?0:G.ticks/60;
 // winter-dressed pedestrians: knit hats and scarves on everyone in the snow
 for(const p of G.peds){if(p.dead||p.y<H0-200||p.x<r.x0||p.x>r.x1||p.y<r.y0||p.y>r.y1)continue;const k=((p.x*7+(p.id||0)*13)|0)&7,col=BEANIE[(p.sprite?.length||k)%6];
  c.save();c.translate(p.x,p.y);c.rotate(p.rot||0);c.fillStyle=BEANIE[(k+2)%6];c.fillRect(-7,1,14,4);c.fillRect(3,3,4,8);c.fillStyle=col;c.beginPath();c.arc(0,-1,5.4,0,TAU);c.fill();c.fillStyle='#f4f4f4';c.beginPath();c.arc(0,-1,2,0,TAU);c.fill();c.restore();}
 // chimney smoke drifting with the wind
 const img=puff();
 for(const C of A.chalets){const ch=C.chimney;if(ch.x<r.x0-200||ch.x>r.x1+100||ch.y<r.y0-100||ch.y>r.y1+200)continue;
  for(let i=0;i<5;i++){const k=((t*.35+i/5+C.seed)%1),s=14+k*46;c.globalAlpha=(1-k)*.55;c.drawImage(img,ch.x+k*70-s/2+Math.sin(t+i)*6,ch.y-k*90-s/2,s,s);}c.globalAlpha=1;}
 // chair lift: cable and moving chairs
 if(r.x1>10150&&r.x0<10560&&r.y1>10950&&r.y0<12970){c.strokeStyle='rgba(30,30,36,.75)';c.lineWidth=2;c.beginPath();c.moveTo(LIFT[0][0]-6,LIFT[0][1]);for(const p of LIFT)c.lineTo(p[0]-6,p[1]);c.moveTo(LIFT[0][0]+6,LIFT[0][1]);for(const p of LIFT)c.lineTo(p[0]+6,p[1]);c.stroke();
  let L=0;const seg=[];for(let i=1;i<LIFT.length;i++){const d=Math.hypot(LIFT[i][0]-LIFT[i-1][0],LIFT[i][1]-LIFT[i-1][1]);seg.push(d);L+=d;}
  for(let n=0;n<22;n++)for(const side of [-1,1]){let s=((n/22+(side>0?t*.012:-t*.012))%1+1)%1*L,i=0;while(i<seg.length-1&&s>seg[i]){s-=seg[i];i++;}const a=LIFT[i],b=LIFT[i+1],f=s/seg[i],x=a[0]+(b[0]-a[0])*f+side*6,y=a[1]+(b[1]-a[1])*f;
   if(x<r.x0||x>r.x1||y<r.y0||y>r.y1)continue;c.fillStyle='rgba(40,60,100,.25)';c.fillRect(x+10,y+16,12,8);c.fillStyle=side>0?'#c8312c':'#2f6fb2';c.fillRect(x-6,y-4,12,8);c.fillStyle='#22262c';c.fillRect(x-1,y-8,2,5);}}
}
export function drawAlpineLights(G,r,night){
 const A=G.world.alpine;if(!A||night<.05||r.y1<H0-100)return;const c=G.ctx,t=G.settings.reducedMotion?0:G.ticks/60;
 c.save();c.globalCompositeOperation='lighter';
 for(const C of A.chalets){if(C.x>r.x1||C.x+C.w<r.x0||C.y>r.y1+120||C.y+C.h<r.y0-120)continue;
  c.globalAlpha=.9*night;c.fillStyle='rgba(255,186,96,1)';for(const [x,y,w,h] of C.win)c.fillRect(x+2,y+2,w-4,h-4);
  const gy=C.front==='S'?C.y+C.h+30:C.y-30;c.globalAlpha=.42*night;const g=c.createRadialGradient(C.x+C.w/2,gy,6,C.x+C.w/2,gy,C.w*.6);g.addColorStop(0,'rgba(255,180,90,.9)');g.addColorStop(1,'rgba(255,180,90,0)');c.fillStyle=g;c.fillRect(C.x-C.w*.1,gy-C.w*.6,C.w*1.2,C.w*1.2);}
 const O=OBS;if(Math.abs(O.x-(r.x0+r.x1)/2)<1400&&Math.abs(O.y-(r.y0+r.y1)/2)<1400){c.globalAlpha=night*(.6+.4*Math.sin(t*3));c.fillStyle='#ff4a4a';c.beginPath();c.arc(O.x+130,O.y-32,5,0,TAU);c.fill();c.globalAlpha=.45*night;const g=c.createRadialGradient(O.x,O.y,10,O.x,O.y,O.r+90);g.addColorStop(0,'rgba(150,190,255,.7)');g.addColorStop(1,'rgba(150,190,255,0)');c.fillStyle=g;c.beginPath();c.arc(O.x,O.y,O.r+90,0,TAU);c.fill();}
 c.restore();
}
// Falling snow in parallax layers, from pre-rendered tiles; cheap on phones.
let FLAKES=null;
function flakes(){if(FLAKES)return FLAKES;const mk=(n,r0,r1,a,seed)=>{const cv=canvas(256,256),x=cv.getContext('2d'),r=rng(seed);for(let i=0;i<n;i++){const px=r()*256,py=r()*256,rad=r0+r()*(r1-r0);for(const [ox,oy] of [[0,0],[256,0],[0,256],[256,256],[-256,0],[0,-256]]){const g=x.createRadialGradient(px+ox,py+oy,0,px+ox,py+oy,rad);g.addColorStop(0,`rgba(255,255,255,${a})`);g.addColorStop(.55,`rgba(245,250,255,${a*.6})`);g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(px+ox-rad,py+oy-rad,rad*2,rad*2);}}return cv;};
 return FLAKES={far:mk(90,1,1.8,.75,5),mid:mk(34,1.8,3,.85,9),near:mk(12,3,5.2,.9,13)};}
export function alpineMix(G){const P=G.player||G.cam;if(!P)return 0;const y=G.cam?.y??P.y,x=G.cam?.x??P.x;if(y<H0-500)return 0;const k=Math.max(0,Math.min(1,(y-(H0-500))/700));return x<coastX(y)-300?k*.4:k;}
export function drawSnowfall(G){
 const mix=alpineMix(G);G.alpineMix=mix;if(mix<.02)return;const c=G.ctx,w=G.canvas.width,h=G.canvas.height,F=flakes(),low=G.settings.quality==='low';
 const t=G.settings.reducedMotion?0:performance.now()/1000,heavy=.65+Math.min(1,(G.rainAmt||0)*1.2)*.35,s=Math.max(1,w/1280);
 const layers=low?[[F.far,26,.35,.7],[F.mid,48,.7,.8]]:[[F.far,24,.3,.65],[F.mid,44,.6,.8],[F.near,80,1,.85]];
 c.save();c.setTransform(1,0,0,1,0,0);
 for(const [img,speed,par,a] of layers){const p=c.createPattern(img,'repeat');const ox=((-(G.cam.x||0)*par*.25+Math.sin(t*.5+speed)*22+t*speed*.35)%256+256)%256,oy=((-(G.cam.y||0)*par*.25+t*speed)%256+256)%256;
  p.setTransform(new DOMMatrix([s,0,0,s,ox*s,oy*s]));c.globalAlpha=a*mix*heavy;c.fillStyle=p;c.fillRect(0,0,w,h);}
 // cold haze at the top of the screen
 c.globalAlpha=.12*mix;c.fillStyle='#dfe8f3';c.fillRect(0,0,w,h);
 c.restore();
}
