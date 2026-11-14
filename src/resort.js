/* Lucky Isle: a resort island in the new northern bay.
   Collision lives in its own annex grid (y < 0); visuals are painted into
   cached 512px chunks once, and only rides, water glints and night lights
   animate per frame. */
export const NORTH = 2816;
export const ISLE = Object.freeze({cx:6000,cy:-1420,a:2380,b:1020,p:6});
const TAU = Math.PI*2;
const BRIDGE = Object.freeze({x:5600,road:200,deck:256,y0:-470,y1:760,pylons:[-130,390],span:[-330,640]});
const PARK = Object.freeze({x:4188,y:-2032,w:1284,h:1224});
export const RESORT_BOUNDS = Object.freeze({x0:3328,y0:-NORTH,x1:9216,y1:784});
const ROADS = [
 {v:false,c:-680,a:4060,b:7940},{v:false,c:-2160,a:4060,b:7940},
 {v:true,c:4060,a:-2160,b:-680},{v:true,c:7940,a:-2160,b:-680},
 {v:true,c:5600,a:-2160,b:-680},{v:false,c:-1420,a:5600,b:7940},
];
function rng(seed){let s=seed>>>0;return()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};}
const wob=t=>.016*Math.sin(5*t+.7)+.011*Math.sin(9*t+2.1)+.007*Math.sin(17*t+.4);
function superV(dx,dy,a,b,p){return Math.pow(Math.pow(Math.abs(dx/a),p)+Math.pow(Math.abs(dy/b),p),1/p);}
export function islandValue(x,y,inset=0){
 const dx=x-ISLE.cx,dy=y-ISLE.cy;
 return superV(dx,dy,ISLE.a-inset,ISLE.b-inset,ISLE.p)*(1+wob(Math.atan2(dy,dx)));
}
function islandPath(inset=0,n=720){
 const P=new Path2D(),a=ISLE.a-inset,b=ISLE.b-inset,e=2/ISLE.p;
 for(let i=0;i<=n;i++){const t=i/n*TAU,c=Math.cos(t),s=Math.sin(t);
  let x=a*Math.sign(c)*Math.pow(Math.abs(c),e),y=b*Math.sign(s)*Math.pow(Math.abs(s),e);
  const k=1/(1+wob(Math.atan2(y,x)));x=ISLE.cx+x*k;y=ISLE.cy+y*k;i?P.lineTo(x,y):P.moveTo(x,y);}
 P.closePath();return P;
}
function catmull(pts,per=24){
 const out=[],n=pts.length;
 for(let i=0;i<n;i++){const p0=pts[(i-1+n)%n],p1=pts[i],p2=pts[(i+1)%n],p3=pts[(i+2)%n];
  for(let k=0;k<per;k++){const t=k/per,t2=t*t,t3=t2*t;
   out.push([.5*(2*p1[0]+(-p0[0]+p2[0])*t+(2*p0[0]-5*p1[0]+4*p2[0]-p3[0])*t2+(-p0[0]+3*p1[0]-3*p2[0]+p3[0])*t3),
             .5*(2*p1[1]+(-p0[1]+p2[1])*t+(2*p0[1]-5*p1[1]+4*p2[1]-p3[1])*t2+(-p0[1]+3*p1[1]-3*p2[1]+p3[1])*t3)]);}}
 return out;
}
const inRect=(x,y,r,m=0)=>x>=r.x-m&&x<=r.x+r.w+m&&y>=r.y-m&&y<=r.y+r.h+m;
const hits=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;

/* ------------------------------------------------------------ world build */
export function applyResort(W,{CELL,GW,GH,CODE,WORLD_W,WORLD_H}){
 const NR=NORTH/CELL,north=new Uint8Array(GW*NR).fill(CODE.water);W.north=north;W.northRows=NR;
 const fillAny=(x,y,w,h,code,onlyIf)=>{
  const x0=Math.max(0,Math.floor(x/CELL)),x1=Math.min(GW,Math.ceil((x+w)/CELL));
  const y0=Math.max(-NR,Math.floor(y/CELL)),y1=Math.min(GH,Math.ceil((y+h)/CELL));
  for(let cy=y0;cy<y1;cy++)for(let cx=x0;cx<x1;cx++){
   if(cy<0){const i=(cy+NR)*GW+cx;if(onlyIf&&!onlyIf(north[i]))continue;north[i]=code;}
   else{const i=cy*GW+cx;if(onlyIf&&!onlyIf(W.grid[i]))continue;W.grid[i]=code;}
  }
 };
 const codeAny=(x,y)=>{const cx=Math.floor(x/CELL),cy=Math.floor(y/CELL);if(cx<0||cx>=GW||cy<-NR||cy>=GH)return -1;return cy<0?north[(cy+NR)*GW+cx]:W.grid[cy*GW+cx];};
 // island ground: sand rim, planted interior
 for(let cy=-NR;cy<0;cy++)for(let cx=Math.floor(RESORT_BOUNDS.x0/CELL);cx<Math.ceil(RESORT_BOUNDS.x1/CELL);cx++){
  const x=cx*CELL+8,y=cy*CELL+8,v=islandValue(x,y);if(v>1)continue;
  north[(cy+NR)*GW+cx]=islandValue(x,y,175)<=1?CODE.grass:CODE.sand;
 }
 const R=W.resort={bounds:RESORT_BOUNDS,bridge:BRIDGE,park:PARK,hotels:[],pools:[],palms:[],umbrellas:[],towels:[],towers:[],bars:[],stalls:[],rocks:[],yachts:[],piers:[],gardens:[],courts:[],slips:[],lamps:[],beds:[],signs:[]};
 const rnd=rng(90210);
 // Bridge deck over the bay, then the island road grid.
 const B=BRIDGE,deckX=B.x-B.deck/2,roadX=B.x-B.road/2;
 fillAny(deckX,B.y0,B.deck,B.y1-B.y0,CODE.walk,c=>c===CODE.water||c===CODE.sand||c===CODE.grass);
 fillAny(roadX,B.y0,B.road,B.y1-B.y0+40,CODE.road,c=>c!==CODE.build);
 // Approach: the island grid stops ~100 px short of the deck; pave the beach gap
 // so the bridge road actually meets the resort road instead of a strip of sand.
 fillAny(roadX,B.y0-112,B.road,114,CODE.road,c=>c!==CODE.build);
 for(const y of B.pylons)for(const x of [deckX-4,B.x+B.deck/2-12])fillAny(x,y-12,16,24,CODE.build);
 const segs=[];
 for(const s of ROADS){const q={...s,w:200,lanes:2,med:0,k:'resort'};segs.push(q);
  const r=s.v?{x:s.c-128,y:s.a-128,w:256,h:s.b-s.a+256}:{x:s.a-128,y:s.c-128,w:s.b-s.a+256,h:256};
  fillAny(r.x,r.y,r.w,r.h,CODE.walk,c=>c!==CODE.road);
 }
 for(const s of segs){const r=s.v?{x:s.c-100,y:s.a-100,w:200,h:s.b-s.a+200}:{x:s.a-100,y:s.c-100,w:s.b-s.a+200,h:200};fillAny(r.x,r.y,r.w,r.h,CODE.road);}
 segs.push({v:true,c:B.x,a:-680,b:860,w:200,lanes:2,med:0,k:'bridge'});
 W.roads.push(...segs);R.roads=segs;
 // Signalised junctions on the island spine (bridge landing, park gate, north beach).
 for(const y of [-680,-1420,-2160])W.signals.push({x:5600,y,r:160,gen:true});
 // Park block (paved), hotel blocks (paved plazas + gardens).
 fillAny(PARK.x,PARK.y,PARK.w,PARK.h,CODE.walk);
 const blocks=[{x:5728,y:-2032,w:2084,h:484,front:'S'},{x:5728,y:-1292,w:2084,h:484,front:'S'}];
 for(const b of blocks)fillAny(b.x,b.y,b.w,b.h,CODE.walk);
 const names=[['AZURE CROWN','#e8e2d4','#2f8fb4'],['CORAL PALMS','#f0d6c2','#e2725b'],['PEARL TOWER','#e9ecef','#9a7fd1'],['SOLARIS','#f3e3b5','#e4a92a'],['LUCKY SEVEN','#efe0d0','#c73a4c'],['DUNE HOUSE','#e7d3ae','#5f9f88']];
 const spans=[[5760,6380],[6460,7080],[7170,7790]];let hi=0;
 for(const [bi,b] of blocks.entries())for(const [x0,x1] of spans){
  const [name,wall,accent]=names[hi],tower=hi===2||hi===4,fac=tower?112:80,h=tower?236:196,y=b.y+12;
  const H={x:x0,y,w:x1-x0,h,fac,name,wall,accent,tower,seed:rnd(),roof:['#c9c2b3','#b8a48c','#d6d0c6','#c7b28e','#b9a69a','#cbb797'][hi],id:hi};
  R.hotels.push(H);fillAny(H.x,H.y,H.w,H.h,CODE.build);
  // canopy drop-off in front of the lobby, pool deck to the south
  const deck={x:x0+30,y:y+h+24,w:x1-x0-60,h:b.y+b.h-(y+h+24)-26};
  const pw=deck.w*(.55+rnd()*.15),ph=Math.min(150,deck.h-70),pool={x:deck.x+(deck.w-pw)*(.25+rnd()*.5),y:deck.y+30+rnd()*(deck.h-ph-60),w:pw,h:ph,kidney:hi%2===1,deck,seed:rnd(),accent};
  R.pools.push(pool);fillAny(pool.x,pool.y,pool.w,pool.h,CODE.build);
  for(const gx of [deck.x-20,deck.x+deck.w-40]){R.gardens.push({x:gx,y:deck.y,w:60,h:deck.h});fillAny(gx,deck.y,60,deck.h,CODE.grass);for(let yy=deck.y+30;yy<deck.y+deck.h-10;yy+=90)R.palms.push({x:gx+30,y:yy,r:34+rnd()*10,seed:rnd()});}
  hi++;
 }
 // Wild Crown Park rides
 const P=PARK;
 const coasterCtl=[[4960,-1228],[5150,-1226],[5320,-1236],[5420,-1330],[5432,-1600],[5420,-1870],[5330,-1985],[5150,-2002],[4990,-1962],[4918,-1840],[4950,-1700],[5080,-1640],[5230,-1690],[5300,-1810],[5205,-1885],[5105,-1805],[5150,-1570],[5280,-1490],[5262,-1385],[5110,-1352],[4965,-1395],[4922,-1310]];
 const track=catmull(coasterCtl,18);let len=0;const cum=[0];for(let i=1;i<=track.length;i++){const a=track[i-1],b=track[i%track.length];len+=Math.hypot(b[0]-a[0],b[1]-a[1]);cum.push(len);}
 R.coaster={pts:track,cum,len,station:{x:4980,y:-1262,w:200,h:24}};
 R.ferris={x:4470,y:-1745,r:168,base:{x:4396,y:-1598,w:148,h:26}};
 R.carousel={x:4420,y:-1330,r:96};R.spinner={x:4745,y:-1350,r:104};R.drop={x:4760,y:-1960,s:64};
 R.bumper={x:4930,y:-1110,w:320,h:210};R.fountain={x:4560,y:-1060,r:58};R.gate={x:4830,y:P.y+P.h};
 fillAny(R.ferris.base.x,R.ferris.base.y,R.ferris.base.w,R.ferris.base.h,CODE.build);
 for(const [o,rad] of [[R.carousel,R.carousel.r],[R.spinner,R.spinner.r-8],[R.fountain,R.fountain.r]])fillAny(o.x-rad*.82,o.y-rad*.82,rad*1.64,rad*1.64,CODE.build);
 fillAny(R.drop.x-R.drop.s/2,R.drop.y-R.drop.s/2,R.drop.s,R.drop.s,CODE.build);
 const st=R.coaster.station;fillAny(st.x,st.y,st.w,st.h,CODE.build);
 for(const [x,y,c] of [[4290,-1150,'#e05a47'],[4290,-990,'#2f8fb4'],[4650,-1190,'#e4a92a'],[5340,-1060,'#9a7fd1'],[5340,-930,'#5f9f88'],[4660,-930,'#c73a4c'],[4300,-1500,'#e4a92a'],[4620,-1560,'#2f8fb4']]){R.stalls.push({x:x-34,y:y-26,w:68,h:52,c,seed:rnd()});fillAny(x-34,y-26,68,52,CODE.build);}
 for(const b of [{x:4230,y:-1990,w:90,h:200},{x:4230,y:-1250,w:70,h:60},{x:5270,y:-1180,w:150,h:46},{x:4560,y:-1260,w:110,h:50},{x:4850,y:-1250,w:60,h:120}]){R.beds.push(b);fillAny(b.x,b.y,b.w,b.h,CODE.grass);}
 // Marina on the east shore, a lighthouse jetty to the south-west.
 const walk={x:8270,y:-1900,w:70,h:960};R.piers.push({...walk,kind:'boardwalk'});fillAny(walk.x,walk.y,walk.w,walk.h,CODE.pier);
 for(const y of [-1860,-1660,-1460,-1260,-1060]){const f={x:8340,y,w:520,h:28,kind:'finger'};R.piers.push(f);fillAny(f.x,f.y,f.w,f.h,CODE.pier);}
 for(const y of [-1760,-1560,-1360,-1160]){R.slips.push({x:8520,y,rot:Math.PI/2});R.yachts.push({x:8760,y,len:150+rnd()*40,rot:Math.PI/2*(rnd()<.5?1:-1),seed:rnd(),c:['#f4f1ea','#e9edf2','#203247'][Math.floor(rnd()*3)]});}
 R.harbour={x:8090,y:-1470,w:130,h:90};fillAny(R.harbour.x,R.harbour.y,R.harbour.w,R.harbour.h,CODE.build);
 const jetty={x:4580,y:-470,w:40,h:380,kind:'jetty'},head={x:4520,y:-150,w:160,h:76,kind:'head'};R.piers.push(jetty,head);fillAny(jetty.x,jetty.y,jetty.w,jetty.h,CODE.pier,c=>c!==CODE.road&&c!==CODE.walk);fillAny(head.x,head.y,head.w,head.h,CODE.pier);
 R.lighthouse={x:4600,y:-112,r:22};fillAny(4578,-134,44,44,CODE.build);
 // Beach furniture on the dry upper sand only.
 const clearOf=(x,y,m)=>!R.piers.some(p=>inRect(x,y,p,m))&&Math.abs(x-B.x)>B.deck/2+m&&!(x>8040&&y>-1950&&y<-900)&&codeAny(x,y)===CODE.sand&&codeAny(x+m,y)===CODE.sand&&codeAny(x-m,y)===CODE.sand&&codeAny(x,y+m)===CODE.sand&&codeAny(x,y-m)===CODE.sand;
 for(const [x,y,r] of [[3780,-1420,52],[6880,-480,40],[5050,-2350,44],[8150,-760,40]])if(clearOf(x,y,r*.6)){R.bars.push({x,y,r,seed:rnd()});fillAny(x-r*.7,y-r*.7,r*1.4,r*1.4,CODE.build);}
 for(const [x,y] of [[5250,-470],[6400,-472],[7500,-480],[4800,-2365],[6250,-2370],[7350,-2360],[3700,-1100],[3700,-1780],[8250,-2050]])if(clearOf(x,y,16)){R.towers.push({x,y});fillAny(x-10,y-10,20,20,CODE.build);}
 for(const [x,y,w,h] of [[3760,-1900,90,150],[6750,-2390,150,80]])R.courts.push({x,y,w,h});
 const colors=['#e94b3c','#f4c542','#2a9fd6','#ffffff','#46b37a','#f28c38','#c4479b','#1f6fb2'];
 for(let i=0;i<2600&&R.umbrellas.length<190;i++){
  const x=3640+rnd()*4720,y=-2440+rnd()*2050;const v=islandValue(x,y);if(v<.9||v>.972||!clearOf(x,y,26))continue;
  if(R.umbrellas.some(u=>Math.hypot(u.x-x,u.y-y)<64)||R.bars.some(b=>Math.hypot(b.x-x,b.y-y)<b.r+40)||R.towers.some(t=>Math.hypot(t.x-x,t.y-y)<50)||R.courts.some(c=>inRect(x,y,c,30)))continue;
  const u={x,y,r:20+rnd()*6,c1:colors[Math.floor(rnd()*colors.length)],c2:rnd()<.5?'#ffffff':colors[Math.floor(rnd()*colors.length)],seed:rnd()};R.umbrellas.push(u);
  const n=rnd()<.7?2:1;for(let k=0;k<n;k++){const a=rnd()*TAU;R.towels.push({x:x+Math.cos(a)*28,y:y+Math.sin(a)*28,rot:a+Math.PI/2+(rnd()-.5)*.4,c:colors[Math.floor(rnd()*colors.length)],person:rnd()<.62,skin:['#f1c7a3','#d9a47c','#a86f4c','#6f4630'][Math.floor(rnd()*4)],suit:colors[Math.floor(rnd()*colors.length)],seed:rnd()});}
 }
 for(let i=0;i<500&&R.palms.length<170;i++){
  const x=3640+rnd()*4720,y=-2440+rnd()*2050,v=islandValue(x,y);
  if(v<.955&&v>.86&&codeAny(x,y)!==CODE.road&&codeAny(x,y)!==CODE.build&&!R.piers.some(p=>inRect(x,y,p,40))&&Math.abs(x-B.x)>170&&!R.palms.some(p=>Math.hypot(p.x-x,p.y-y)<90)&&!R.umbrellas.some(u=>Math.hypot(u.x-x,u.y-y)<40)&&!R.bars.some(b=>Math.hypot(b.x-x,b.y-y)<b.r+30))R.palms.push({x,y,r:30+rnd()*14,seed:rnd()});
 }
 // Avenue / boulevard palms and street lamps along every island road.
 for(const s of segs){if(s.k==='bridge')continue;
  for(let t=s.a+70;t<s.b-70;t+=170){
   for(const side of [-1,1]){const off=side*114,x=s.v?s.c+off:t,y=s.v?t:s.c+off;
    if(codeAny(x,y)!==CODE.walk)continue;const nearX=ROADS.some(o=>o!==s&&(o.v?Math.abs(x-o.c)<150&&y>o.a-150&&y<o.b+150:Math.abs(y-o.c)<150&&x>o.a-150&&x<o.b+150));if(nearX)continue;
    if((Math.round(t/170))%2===0)W.lamps.push({x,y,v:s.v,side,resort:true});
    else R.palms.push({x:s.v?x+side*2:x,y:s.v?y:y+side*2,r:30+rnd()*8,seed:rnd(),street:true});
   }
  }
 }
 for(let y=B.y0+90;y<640;y+=150)for(const side of [-1,1]){W.lamps.push({x:B.x+side*(B.road/2+20),y,v:true,side,resort:true,bridge:true});}
 for(const p of R.palms)if(codeAny(p.x,p.y)!==CODE.road)fillAny(p.x-5,p.y-5,10,10,CODE.build,c=>c!==CODE.road);
 for(const p of R.hotels)R.signs.push({x:p.x+p.w/2,y:p.y+p.h+8,text:p.name,c:p.accent});
 // Rocky points at the island corners.
 for(const [x,y] of [[3700,-2320],[8300,-2330],[3690,-520],[8320,-500],[3640,-1600]])for(let k=0;k<5;k++){const rx=x+(rnd()-.5)*120,ry=y+(rnd()-.5)*90;if(islandValue(rx,ry)>.985&&islandValue(rx,ry)<1.03)R.rocks.push({x:rx,y:ry,r:14+rnd()*18,seed:rnd()});}
 for(const r of R.rocks)if(islandValue(r.x,r.y)>1)fillAny(r.x-r.r*.6,r.y-r.r*.6,r.r*1.2,r.r*1.2,CODE.build);
 // Boats pass beneath the bridge deck except at its pylons.
 const prevBoat=W.boatSurfaceAt;
 W.boatSurfaceAt=(x,y)=>{
  if(Math.abs(x-B.x)<=B.deck/2+2&&y>B.span[0]&&y<B.span[1])return B.pylons.some(p=>Math.abs(y-p)<26)&&Math.abs(x-B.x)>B.road/2-4?null:'water';
  if(y<0)return null;return prevBoat?prevBoat(x,y):null;
 };
 R.bridgeDeck={x:B.x-B.deck/2,y:B.span[0],w:B.deck,h:B.span[1]-B.span[0]};
 R.underBridge=(x,y)=>Math.abs(x-B.x)<=B.deck/2+2&&y>B.span[0]&&y<B.span[1];
 W.limits={x:0,y:-NORTH,w:WORLD_W,h:WORLD_H+NORTH};
 if(W.expansion){W.expansion.obstacles.push({x:deckX,y:B.y0,w:B.deck,h:B.y1-B.y0,hgt:44,kind:'bridge'});for(const H of R.hotels)W.expansion.obstacles.push({x:H.x,y:H.y,w:H.w,h:H.h,hgt:H.tower?150:90});
  W.expansion.obstacles.push({x:R.ferris.x-R.ferris.r,y:R.ferris.y-R.ferris.r,w:R.ferris.r*2,h:R.ferris.r*2+40,hgt:120});
  (W.expansion.landmarks||(W.expansion.landmarks=[])).push({name:'LUCKY ISLE',x:6400,y:-1700},{name:'WILD CROWN PARK',x:4830,y:-1450});}
 R.codeAny=codeAny;
 return R;
}
export function resortDistrict(x,y){
 const B=BRIDGE;
 if(Math.abs(x-B.x)<=B.deck/2+10&&y>-430&&y<700)return 'CROWN BAY BRIDGE';
 if(y>=0)return null;
 const v=islandValue(x,y);
 if(v>1.04)return 'CROWN BAY';
 if(x>=PARK.x-30&&x<=PARK.x+PARK.w+30&&y>=PARK.y-30&&y<=PARK.y+PARK.h+30)return 'WILD CROWN PARK';
 if(x>8040&&y>-1950&&y<-900)return 'LUCKY ISLE MARINA';
 if(v>.9)return 'COPPER BEACH';
 return 'LUCKY ISLE RESORT';
}
export function islandAmbience(G){
 const P=G.player;if(!P||P.y>=740)return null;const d=resortDistrict(P.x,P.y);if(!d)return null;
 const v=islandValue(P.x,P.y),coast=v>1?Math.max(0,1-(v-1)*8):Math.max(0,(v-.84)/.16);
 const park=G.world.resort?Math.max(0,1-Math.hypot(Math.max(0,Math.abs(P.x-(PARK.x+PARK.w/2))-PARK.w/2),Math.max(0,Math.abs(P.y-(PARK.y+PARK.h/2))-PARK.h/2))/500):0;
 return {district:d,beach:Math.min(1,coast),park,island:true};
}

/* ------------------------------------------------------------ painting */
const C={deep:'#1c5b70',mid:'#257f8f',shallow:'#3fb2b0',lagoon:'#62cfc0',foam:'rgba(236,252,246,.9)',wet:'#c9ab76',sand:'#ecd5a0',sand2:'#f3e2b6',grass:'#5d9a4c',grass2:'#4f8a42',asphalt:'#3e4549',walk:'#c9c0ad',paver:'#d6a57a'};
function pat(G,c,name){const t=G.assets?.tex?.[name];if(!t)return null;const key='_rp_'+name;return G.world.resort[key]||(G.world.resort[key]=c.createPattern(t,'repeat'));}
function shadowRect(c,x,y,w,h,dx=18,dy=22,a=.26){c.fillStyle=`rgba(10,22,30,${a})`;c.fillRect(x+dx,y+dy,w,h);}
function rr(c,x,y,w,h,r){c.beginPath();c.moveTo(x+r,y);c.arcTo(x+w,y,x+w,y+h,r);c.arcTo(x+w,y+h,x,y+h,r);c.arcTo(x,y+h,x,y,r);c.arcTo(x,y,x+w,y,r);c.closePath();}
function paintPalm(c,p,shadow){
 const r=p.r,s=p.seed;
 if(shadow){c.fillStyle='rgba(12,30,20,.22)';c.beginPath();c.ellipse(p.x+r*.55,p.y+r*.65,r*.95,r*.75,0,0,TAU);c.fill();return;}
 const n=7+Math.floor(s*3);
 for(let i=0;i<n;i++){const a=i/n*TAU+s*6,len=r*(.86+((i*37)%7)/30);
  const ex=p.x+Math.cos(a)*len,ey=p.y+Math.sin(a)*len,mx=p.x+Math.cos(a+.25)*len*.55,my=p.y+Math.sin(a+.25)*len*.55;
  c.strokeStyle=i%2?'#3f7d34':'#4f9440';c.lineWidth=r*.34;c.lineCap='round';c.beginPath();c.moveTo(p.x,p.y);c.quadraticCurveTo(mx,my,ex,ey);c.stroke();
  c.strokeStyle='rgba(170,220,120,.55)';c.lineWidth=r*.07;c.beginPath();c.moveTo(p.x,p.y);c.quadraticCurveTo(mx,my,ex,ey);c.stroke();
 }
 c.fillStyle='#6b4a2b';c.beginPath();c.arc(p.x,p.y,r*.16,0,TAU);c.fill();c.fillStyle='#8a6a3a';c.beginPath();c.arc(p.x-1,p.y-1,r*.08,0,TAU);c.fill();
}
function paintUmbrella(c,u,shadow){
 if(shadow){c.fillStyle='rgba(60,40,10,.22)';c.beginPath();c.ellipse(u.x+9,u.y+11,u.r,u.r*.85,0,0,TAU);c.fill();return;}
 for(let i=0;i<8;i++){c.fillStyle=i%2?u.c1:u.c2;c.beginPath();c.moveTo(u.x,u.y);c.arc(u.x,u.y,u.r,i/8*TAU+u.seed,(i+1)/8*TAU+u.seed);c.closePath();c.fill();}
 c.strokeStyle='rgba(0,0,0,.18)';c.lineWidth=1.2;c.beginPath();c.arc(u.x,u.y,u.r,0,TAU);c.stroke();
 const g=c.createRadialGradient(u.x-u.r*.35,u.y-u.r*.35,1,u.x,u.y,u.r);g.addColorStop(0,'rgba(255,255,255,.35)');g.addColorStop(1,'rgba(0,0,0,.12)');c.fillStyle=g;c.beginPath();c.arc(u.x,u.y,u.r,0,TAU);c.fill();
 c.fillStyle='#fff';c.beginPath();c.arc(u.x,u.y,2.2,0,TAU);c.fill();
}
function paintTowel(c,t){
 c.save();c.translate(t.x,t.y);c.rotate(t.rot);
 c.fillStyle='rgba(60,40,10,.18)';c.fillRect(-9,-19,20,40);
 c.fillStyle=t.c;c.fillRect(-11,-21,20,40);c.fillStyle='rgba(255,255,255,.55)';c.fillRect(-11,-14,20,3);c.fillRect(-11,10,20,3);
 if(t.person){c.fillStyle=t.skin;c.beginPath();c.arc(-1,-13,4.2,0,TAU);c.fill();c.fillRect(-4,-9,6,17);c.fillRect(-5,6,3,10);c.fillRect(0,6,3,10);c.fillRect(-8,-8,3,10);c.fillRect(3,-8,3,10);
  c.fillStyle=t.suit;c.fillRect(-4,-3,6,6);c.fillStyle='#3a2a1c';c.beginPath();c.arc(-1,-14.5,3.6,Math.PI,TAU);c.fill();}
 c.restore();
}
function shade(hex,k){const n=parseInt(hex.slice(1),16),f=v=>Math.max(0,Math.min(255,Math.round(k<0?v*(1+k):v+(255-v)*k)));return '#'+[n>>16,n>>8&255,n&255].map(f).map(v=>v.toString(16).padStart(2,'0')).join('');}
// Hotels: stepped massing, a balconied south facade with awnings and fins,
// and a distinct roof per property (pool deck, terracotta hip roof, helipad
// tower, solar deck, neon crown, garden). All names are invented.
function paintHotel(c,H,G){
 const {x,y,w,h,fac}=H,roofH=h-fac,rnd=rng(Math.floor(H.seed*1e6)),acc=H.accent;
 shadowRect(c,x,y,w,h,34,40,.32);shadowRect(c,x,y,w,h,14,16,.18);
 // ---- facade ----
 const fg=c.createLinearGradient(0,y+roofH,0,y+h);fg.addColorStop(0,shade(H.wall,.08));fg.addColorStop(1,shade(H.wall,-.22));c.fillStyle=fg;c.fillRect(x,y+roofH,w,fac);
 const rows=H.tower?5:3,rowH=(fac-16)/rows,bay=H.tower?30:34,cols=Math.floor((w-16)/bay),bw=(w-16)/cols;
 for(let r=0;r<rows;r++){const wy=y+roofH+4+r*rowH;
  for(let k=0;k<cols;k++){const wx=x+8+k*bw;
   // recessed glass with sky reflection
   const gl=c.createLinearGradient(wx,wy,wx+bw,wy+rowH);gl.addColorStop(0,'#9fd3e3');gl.addColorStop(.5,'#3f6f88');gl.addColorStop(1,'#29485c');c.fillStyle=gl;c.fillRect(wx+3,wy+2,bw-6,rowH-6);
   if((k*7+r*3+H.id)%9===0){c.fillStyle='rgba(240,232,214,.85)';c.fillRect(wx+4,wy+3,(bw-8)*.45,rowH-8);} // drawn curtain
   // balcony slab + railing + its shadow
   c.fillStyle='rgba(0,0,0,.22)';c.fillRect(wx+1,wy+rowH-3,bw-2,3);
   c.fillStyle=shade(H.wall,.25);c.fillRect(wx+1,wy+rowH-6,bw-2,3);
   c.strokeStyle='rgba(255,255,255,.42)';c.lineWidth=.8;c.beginPath();for(let q=wx+3;q<wx+bw-2;q+=4){c.moveTo(q,wy+rowH-6);c.lineTo(q,wy+rowH-11);}c.moveTo(wx+2,wy+rowH-11);c.lineTo(wx+bw-2,wy+rowH-11);c.stroke();
   // striped awnings on alternating bays of the top row
   if(r===0&&k%2===H.id%2){c.fillStyle=acc;c.fillRect(wx+2,wy,bw-4,5);c.fillStyle='rgba(255,255,255,.75)';for(let q=wx+2;q<wx+bw-4;q+=6)c.fillRect(q,wy,3,5);}
  }
 }
 // vertical fins every few bays
 c.fillStyle=shade(H.wall,-.12);for(let k=0;k<=cols;k+=H.tower?2:3){const fx=x+6+k*bw;c.fillRect(fx,y+roofH,4,fac-12);c.fillStyle='rgba(255,255,255,.4)';c.fillRect(fx,y+roofH,1.5,fac-12);c.fillStyle=shade(H.wall,-.12);}
 // side returns: the east flank is in shade and the west catches light, so
 // the facade reads as a deep block rather than a painted strip
 {const sw=14,g1=c.createLinearGradient(x+w-sw,0,x+w,0);g1.addColorStop(0,shade(H.wall,-.28));g1.addColorStop(1,shade(H.wall,-.45));c.fillStyle=g1;c.beginPath();c.moveTo(x+w-sw,y+roofH);c.lineTo(x+w,y+roofH-10);c.lineTo(x+w,y+h-10);c.lineTo(x+w-sw,y+h);c.closePath();c.fill();
  c.fillStyle='rgba(255,255,255,.22)';c.fillRect(x,y+roofH,3,fac);
  for(let r2=1;r2<rows;r2++){c.fillStyle='rgba(0,0,0,.28)';c.fillRect(x+6,y+roofH+4+r2*rowH-1,w-6-sw,2);}
  c.fillStyle='rgba(0,0,0,.25)';c.fillRect(x,y+roofH,w-sw,5);}
 c.fillStyle=acc;c.fillRect(x,y+h-12,w,12);c.fillStyle='rgba(255,255,255,.3)';c.fillRect(x,y+h-12,w,2);
 // lobby: glass doors, columns, canopy with name
 const lx=x+w/2;c.fillStyle='#22313c';c.fillRect(lx-46,y+h-26,92,16);c.fillStyle='#6fb3c9';for(let q=0;q<4;q++)c.fillRect(lx-42+q*22,y+h-24,18,12);
 c.fillStyle='rgba(0,0,0,.28)';c.fillRect(lx-58,y+h,128,30);c.fillStyle=acc;rr(c,lx-64,y+h-8,128,30,6);c.fill();
 c.fillStyle='rgba(255,255,255,.35)';c.fillRect(lx-58,y+h-6,116,4);c.fillStyle='#f4efe3';for(const q of [-56,52])c.fillRect(lx+q,y+h+14,6,10);
 c.save();c.fillStyle='#fffaf0';c.font='800 11px system-ui';c.textAlign='center';c.textBaseline='middle';c.fillText(H.name,lx,y+h+8);c.restore();
 // ---- roof ----
 const parapet=(px,py,pw,ph,col)=>{c.fillStyle=col;c.fillRect(px,py,pw,ph);c.strokeStyle='rgba(255,255,255,.6)';c.lineWidth=5;c.strokeRect(px+2.5,py+2.5,pw-5,ph-5);c.strokeStyle='rgba(0,0,0,.22)';c.lineWidth=2;c.strokeRect(px+7,py+7,pw-14,ph-14);};
 const tex=pat(G,c,'roof_gravel');
 parapet(x,y,w,roofH,H.roof);if(tex){c.globalAlpha=.22;c.fillStyle=tex;c.fillRect(x+6,y+6,w-12,roofH-12);c.globalAlpha=1;}
 // deck pavers on the open roof, slightly warmer toward the sea-facing edge
 c.strokeStyle='rgba(70,55,40,.10)';c.lineWidth=1;c.beginPath();for(let q=x+30;q<x+w-8;q+=30){c.moveTo(q,y+8);c.lineTo(q,y+roofH-8);}for(let q=y+30;q<y+roofH-8;q+=30){c.moveTo(x+8,q);c.lineTo(x+w-8,q);}c.stroke();
 {const wg=c.createLinearGradient(0,y,0,y+roofH);wg.addColorStop(0,'rgba(255,255,255,0)');wg.addColorStop(1,'rgba(255,214,160,.16)');c.fillStyle=wg;c.fillRect(x+6,y+6,w-12,roofH-12);}
 // upper tier (stepped massing) casting a shadow on the terrace below
 const tw=w*(H.tower?.42:.36),tx=H.id%2?x+w-tw-16:x+16,ty=y+12,th=roofH-46;
 c.fillStyle='rgba(10,20,30,.28)';c.fillRect(tx+12,ty+14,tw,th);
 parapet(tx,ty,tw,th,shade(H.roof,-.06));
 const kind=H.id;
 if(kind===1){ // terracotta hip roof on the tier
  const cx=tx+tw/2,cy=ty+th/2;c.fillStyle='#c4683f';c.fillRect(tx+6,ty+6,tw-12,th-12);
  c.fillStyle='#a8522f';c.beginPath();c.moveTo(tx+6,ty+6);c.lineTo(cx-tw*.15,cy);c.lineTo(tx+6,ty+th-6);c.closePath();c.fill();
  c.fillStyle='#d98458';c.beginPath();c.moveTo(tx+6,ty+6);c.lineTo(tx+tw-6,ty+6);c.lineTo(cx+tw*.15,cy);c.lineTo(cx-tw*.15,cy);c.closePath();c.fill();
  c.strokeStyle='rgba(90,40,20,.35)';c.lineWidth=1;for(let q=ty+10;q<ty+th-6;q+=5){c.beginPath();c.moveTo(tx+6,q);c.lineTo(tx+tw-6,q);c.stroke();}
  c.strokeStyle='#f0c9a5';c.lineWidth=3;c.beginPath();c.moveTo(cx-tw*.15,cy);c.lineTo(cx+tw*.15,cy);c.stroke();
 }else if(kind===2){ // helipad tower
  const hx=tx+tw/2,hy=ty+th/2,R=Math.min(tw,th)*.38;c.fillStyle='#4f565c';c.beginPath();c.arc(hx,hy,R+8,0,TAU);c.fill();c.fillStyle='#5c646a';c.beginPath();c.arc(hx,hy,R,0,TAU);c.fill();
  c.strokeStyle='#f0d25a';c.lineWidth=4;c.beginPath();c.arc(hx,hy,R-8,0,TAU);c.stroke();c.fillStyle='#f4f4f4';c.font=`900 ${R*.9|0}px system-ui`;c.textAlign='center';c.textBaseline='middle';c.fillText('H',hx,hy+2);
  for(let i=0;i<8;i++){const a=i/8*TAU;c.fillStyle='#ffd36a';c.beginPath();c.arc(hx+Math.cos(a)*(R+4),hy+Math.sin(a)*(R+4),2.5,0,TAU);c.fill();}
 }else if(kind===3){ // solar array + sun deck
  for(let r2=0;r2<4;r2++)for(let k2=0;k2<Math.floor((tw-24)/26);k2++){const sx=tx+12+k2*26,sy=ty+12+r2*((th-24)/4);c.fillStyle='#22324a';c.fillRect(sx,sy,22,(th-24)/4-5);c.strokeStyle='#7c9cc4';c.lineWidth=.8;c.strokeRect(sx+.5,sy+.5,21,(th-24)/4-6);c.beginPath();c.moveTo(sx+11,sy);c.lineTo(sx+11,sy+(th-24)/4-5);c.stroke();}
 }else if(kind===5){ // garden roof with pergola
  c.fillStyle='#6f9f5a';c.fillRect(tx+8,ty+8,tw-16,th-16);c.fillStyle='#d9cfb8';c.fillRect(tx+tw/2-5,ty+8,10,th-16);
  for(let i=0;i<7;i++){c.fillStyle=i%2?'#4f7f43':'#86b66a';c.beginPath();c.arc(tx+18+rnd()*(tw-36),ty+18+rnd()*(th-36),7+rnd()*7,0,TAU);c.fill();}
  c.strokeStyle='#8a6b4a';c.lineWidth=2;for(let q=ty+14;q<ty+th-12;q+=9){c.beginPath();c.moveTo(tx+tw/2-14,q);c.lineTo(tx+tw/2+14,q);c.stroke();}
 }else{ // 0 & 4: rooftop pool with cabanas
  const px=tx+14,py=ty+14,pw=tw-28,ph=th-28;c.fillStyle='#e6dccb';c.fillRect(px-6,py-6,pw+12,ph+12);const g=c.createLinearGradient(px,py,px+pw,py+ph);g.addColorStop(0,'#86ece6');g.addColorStop(1,'#1f97bd');c.fillStyle=g;rr(c,px,py,pw,ph*.62,10);c.fill();
  c.strokeStyle='rgba(255,255,255,.5)';c.lineWidth=1.5;for(let i=0;i<4;i++){c.beginPath();c.moveTo(px+12+i*pw/4,py+8);c.quadraticCurveTo(px+24+i*pw/4,py+ph*.3,px+8+i*pw/4,py+ph*.55);c.stroke();}
  for(let i=0;i<Math.floor(pw/22);i++){const cx=px+4+i*22,cy=py+ph*.72;c.fillStyle='rgba(0,0,0,.2)';c.fillRect(cx+2,cy+2,14,20);c.fillStyle=i%2?acc:'#fafafa';c.fillRect(cx,cy,14,20);c.fillStyle='rgba(0,0,0,.12)';c.fillRect(cx,cy+12,14,8);}
  if(kind===4){c.strokeStyle='#ffd34d';c.lineWidth=4;c.beginPath();const cx=tx+tw/2,cy=py-1;c.moveTo(cx-26,cy);c.lineTo(cx-20,cy-16);c.lineTo(cx-8,cy-6);c.lineTo(cx,cy-20);c.lineTo(cx+8,cy-6);c.lineTo(cx+20,cy-16);c.lineTo(cx+26,cy);c.closePath();c.stroke();}
 }
 // lower terrace: loungers, planters, a bar kiosk and plant equipment
 const ox=H.id%2?x+20:x+tw+40,ow=w-tw-60;
 for(let i=0;i<Math.floor(ow/40);i++){const lx2=ox+i*40,ly=y+roofH-40;c.fillStyle='rgba(0,0,0,.18)';c.fillRect(lx2+3,ly+3,12,24);c.fillStyle='#f6f2ea';rr(c,lx2,ly,12,24,3);c.fill();c.fillStyle=acc;c.fillRect(lx2,ly,12,7);
  if(i%3===1){c.fillStyle='rgba(0,0,0,.18)';c.beginPath();c.arc(lx2+22,ly+12,11,0,TAU);c.fill();c.fillStyle=i%2?acc:'#f4ead2';c.beginPath();c.arc(lx2+20,ly+10,10,0,TAU);c.fill();}}
 for(let i=0;i<4;i++){const ax=ox+rnd()*(ow*.6),ay=y+16+rnd()*(roofH-80);c.fillStyle='rgba(0,0,0,.25)';c.fillRect(ax+4,ay+5,28,20);c.fillStyle='#a9adab';c.fillRect(ax,ay,28,20);c.fillStyle='#6f7576';c.beginPath();c.arc(ax+14,ay+10,7,0,TAU);c.fill();c.strokeStyle='#8c9291';c.lineWidth=1;c.beginPath();c.moveTo(ax+7,ay+10);c.lineTo(ax+21,ay+10);c.moveTo(ax+14,ay+3);c.lineTo(ax+14,ay+17);c.stroke();}
 for(let i=0;i<5;i++){const qx=ox+ow*(i+.5)/5,qy=y+12;c.fillStyle='#8a7a62';c.fillRect(qx-7,qy,14,10);c.fillStyle=i%2?'#5f9f50':'#7fbf62';c.beginPath();c.arc(qx,qy+2,8,0,TAU);c.fill();}
 // rooftop name sign: letters on a rail at the roof's front edge
 c.save();const fs=Math.min(30,roofH*.24);c.font=`900 ${fs}px system-ui`;c.textAlign='left';c.textBaseline='bottom';const tx2=H.id%2?x+22:x+tw+40,ty2=y+roofH-50,tw2=c.measureText(H.name).width;
 c.fillStyle='rgba(0,0,0,.3)';c.fillRect(tx2-6,ty2+3,tw2+12,6);c.fillStyle='#3b3f44';c.fillRect(tx2-8,ty2-2,tw2+16,5);
 c.fillStyle='rgba(0,0,0,.35)';c.fillText(H.name,tx2+3,ty2+3);c.fillStyle=shade(acc,.15);c.fillText(H.name,tx2,ty2-2);c.restore();
}
function paintPool(c,p,G){
 const d=p.deck;c.fillStyle='#e7dcc7';c.fillRect(d.x,d.y,d.w,d.h);
 const t=pat(G,c,'paver_warm');if(t){c.globalAlpha=.35;c.fillStyle=t;c.fillRect(d.x,d.y,d.w,d.h);c.globalAlpha=1;}
 c.strokeStyle='rgba(120,100,70,.25)';c.lineWidth=1;for(let x=d.x;x<d.x+d.w;x+=24){c.beginPath();c.moveTo(x,d.y);c.lineTo(x,d.y+d.h);c.stroke();}
 c.fillStyle='#f6f1e6';rr(c,p.x-12,p.y-12,p.w+24,p.h+24,p.kidney?60:20);c.fill();
 const g=c.createLinearGradient(p.x,p.y,p.x+p.w*.3,p.y+p.h);g.addColorStop(0,'#86ece6');g.addColorStop(.6,'#36b8cf');g.addColorStop(1,'#1d8db4');c.fillStyle=g;
 if(p.kidney){c.beginPath();c.ellipse(p.x+p.w*.3,p.y+p.h*.5,p.w*.3,p.h*.5,0,0,TAU);c.ellipse(p.x+p.w*.7,p.y+p.h*.55,p.w*.3,p.h*.42,0,0,TAU);c.fill();}
 else{rr(c,p.x,p.y,p.w,p.h,14);c.fill();c.strokeStyle='rgba(255,255,255,.45)';c.lineWidth=2;for(let i=1;i<6;i++){c.beginPath();c.moveTo(p.x+i*p.w/6,p.y+6);c.lineTo(p.x+i*p.w/6,p.y+p.h-6);c.stroke();}}
 c.strokeStyle='rgba(255,255,255,.55)';c.lineWidth=1.5;const rnd=rng(Math.floor(p.seed*1e6));for(let i=0;i<14;i++){const cx=p.x+20+rnd()*(p.w-40),cy=p.y+14+rnd()*(p.h-28);c.beginPath();c.moveTo(cx-10,cy);c.quadraticCurveTo(cx,cy-6,cx+10,cy);c.stroke();}
 // loungers + mini umbrellas along both long sides
 for(const yy of [p.y-46,p.y+p.h+20])for(let x=d.x+20;x<d.x+d.w-30;x+=46){if(x>p.x-20&&x<p.x+p.w-4&&false)continue;c.fillStyle='rgba(0,0,0,.18)';c.fillRect(x+4,yy+4,18,30);c.fillStyle='#ffffff';c.fillRect(x,yy,18,30);c.fillStyle=p.accent;c.fillRect(x,yy,18,8);}
 for(let x=d.x+43;x<d.x+d.w-30;x+=138)paintUmbrella(c,{x,y:p.y-62,r:17,c1:p.accent,c2:'#fff',seed:.2},false);
}
function paintBridge(c,G){
 const B=BRIDGE,dx=B.x-B.deck/2,rx=B.x-B.road/2;
 c.fillStyle='rgba(6,24,34,.35)';c.fillRect(dx+26,B.y0+40,B.deck,B.y1-B.y0-80);
 c.fillStyle='#8f8a80';c.fillRect(dx,B.y0,B.deck,B.y1-B.y0);
 c.fillStyle='#c9c1ae';c.fillRect(dx+2,B.y0,B.deck/2-B.road/2-4,B.y1-B.y0);c.fillRect(B.x+B.road/2+2,B.y0,B.deck/2-B.road/2-4,B.y1-B.y0);
 const a=pat(G,c,'asphalt');c.fillStyle=C.asphalt;c.fillRect(rx,B.y0,B.road,B.y1-B.y0);if(a){c.globalAlpha=.4;c.fillStyle=a;c.fillRect(rx,B.y0,B.road,B.y1-B.y0);c.globalAlpha=1;}
 c.fillStyle='#f2c94c';c.fillRect(B.x-5,B.y0,3,B.y1-B.y0);c.fillRect(B.x+2,B.y0,3,B.y1-B.y0);
 c.fillStyle='rgba(255,255,255,.8)';for(let y=B.y0;y<B.y1;y+=60){c.fillRect(B.x-52,y,3,30);c.fillRect(B.x+49,y,3,30);}
 {const y=B.y0-112,h=112;c.fillStyle='#c9c1ae';c.fillRect(rx-14,y,14,h);c.fillRect(rx+B.road,y,14,h);c.fillStyle='#8f8a80';c.fillRect(rx-2,y,2,h);c.fillRect(rx+B.road,y,2,h);c.fillStyle=C.asphalt;c.fillRect(rx,y,B.road,h);if(a){c.globalAlpha=.4;c.fillStyle=a;c.fillRect(rx,y,B.road,h);c.globalAlpha=1;}c.fillStyle='#f2c94c';c.fillRect(B.x-5,y,3,h);c.fillRect(B.x+2,y,3,h);c.fillStyle='rgba(255,255,255,.8)';for(let yy=y+10;yy<B.y0;yy+=60){c.fillRect(B.x-52,yy,3,30);c.fillRect(B.x+49,yy,3,30);}}
 c.fillStyle='rgba(255,255,255,.9)';c.fillRect(rx+6,B.y0,3,B.y1-B.y0);c.fillRect(B.x+B.road/2-9,B.y0,3,B.y1-B.y0);
 c.fillStyle='rgba(0,0,0,.25)';for(let y=B.y0+100;y<B.y1;y+=240)c.fillRect(dx,y,B.deck,3);
 for(const side of [dx,B.x+B.deck/2-6]){c.fillStyle='#e7e1d1';c.fillRect(side,B.y0,6,B.y1-B.y0);c.fillStyle='#6d6a64';for(let y=B.y0;y<B.y1;y+=20)c.fillRect(side,y,6,3);}
 for(const py of B.pylons){c.fillStyle='rgba(0,0,0,.3)';c.fillRect(dx-10+20,py-18+24,B.deck+20,36);c.fillStyle='#d8d2c6';c.fillRect(dx-10,py-18,B.deck+20,36);c.fillStyle='#b2ab9e';c.fillRect(dx-10,py+8,B.deck+20,10);
  for(const lx of [dx-4,B.x+B.road/2+6]){c.fillStyle='#ece6da';c.fillRect(lx,py-14,26,28);c.fillStyle='#9d968a';c.fillRect(lx+4,py-10,18,20);}}
}
function paintPier(c,p,G){
 c.fillStyle='rgba(5,30,40,.3)';c.fillRect(p.x+8,p.y+10,p.w,p.h);
 c.fillStyle='#a77d50';c.fillRect(p.x,p.y,p.w,p.h);
 c.strokeStyle='rgba(60,38,20,.45)';c.lineWidth=1.4;
 if(p.w>p.h){for(let x=p.x;x<p.x+p.w;x+=9){c.beginPath();c.moveTo(x,p.y);c.lineTo(x,p.y+p.h);c.stroke();}}
 else for(let y=p.y;y<p.y+p.h;y+=9){c.beginPath();c.moveTo(p.x,y);c.lineTo(p.x+p.w,y);c.stroke();}
 c.fillStyle='#5b3f24';const step=p.w>p.h?60:60;
 if(p.w>p.h)for(let x=p.x+4;x<p.x+p.w;x+=step){c.beginPath();c.arc(x,p.y+3,3.5,0,TAU);c.arc(x,p.y+p.h-3,3.5,0,TAU);c.fill();}
 else for(let y=p.y+4;y<p.y+p.h;y+=step){c.beginPath();c.arc(p.x+3,y,3.5,0,TAU);c.arc(p.x+p.w-3,y,3.5,0,TAU);c.fill();}
}
function paintYacht(c,y){
 c.save();c.translate(y.x,y.y);c.rotate(y.rot);const L=y.len,Wd=L*.3;
 c.fillStyle='rgba(5,25,35,.3)';c.beginPath();c.ellipse(8,10,Wd*.55,L*.52,0,0,TAU);c.fill();
 c.fillStyle=y.c;c.beginPath();c.moveTo(0,-L/2);c.quadraticCurveTo(Wd*.6,-L*.2,Wd/2,L/2);c.lineTo(-Wd/2,L/2);c.quadraticCurveTo(-Wd*.6,-L*.2,0,-L/2);c.fill();
 c.fillStyle=y.c==='#203247'?'#c8a35a':'#2a4a63';c.fillRect(-Wd*.32,-L*.1,Wd*.64,L*.34);c.fillStyle='rgba(255,255,255,.85)';c.fillRect(-Wd*.24,-L*.05,Wd*.48,L*.22);
 c.fillStyle='#b88a54';c.fillRect(-Wd*.38,L*.3,Wd*.76,L*.16);c.restore();
}
function paintRide(c,R,G){
 // ferris: boarding deck, ticket hut and queue rails (wheel animates overhead)
 const F=R.ferris;c.fillStyle='rgba(10,20,30,.22)';c.beginPath();c.ellipse(F.x+40,F.y+F.r+4,F.r*.9,36,0,0,TAU);c.fill();
 c.fillStyle='#6d6458';c.fillRect(F.base.x-10,F.base.y-8,F.base.w+20,F.base.h+18);
 c.fillStyle='#c4b79a';c.fillRect(F.base.x-6,F.base.y-4,F.base.w+12,F.base.h+12);
 c.fillStyle='#e6c25a';c.fillRect(F.base.x+8,F.base.y+4,F.base.w-16,7);
 // ticket hut to the west of the wheel
 c.fillStyle='rgba(0,0,0,.25)';c.fillRect(F.base.x-70,F.base.y-18,48,36);
 c.fillStyle='#7b3fa0';c.fillRect(F.base.x-76,F.base.y-24,48,20);c.fillStyle='#f2c94c';c.fillRect(F.base.x-76,F.base.y-24,48,4);
 c.fillStyle='#efe6d2';c.fillRect(F.base.x-76,F.base.y-4,48,18);
 c.strokeStyle='#d7c49a';c.lineWidth=3;c.beginPath();c.moveTo(F.base.x-20,F.base.y+20);c.lineTo(F.base.x-20,F.base.y+70);c.lineTo(F.base.x+40,F.base.y+70);c.stroke();
 // carousel / spinner decks: painted wooden rings with a decorative lip
 for(const [o,col,lip] of [[R.carousel,'#e7d3a6','#c49a3a'],[R.spinner,'#d5e8ef','#5aa0b4']]){
  c.fillStyle='rgba(0,0,0,.22)';c.beginPath();c.arc(o.x+12,o.y+14,o.r+10,0,TAU);c.fill();
  c.fillStyle=col;c.beginPath();c.arc(o.x,o.y,o.r+8,0,TAU);c.fill();
  c.strokeStyle=lip;c.lineWidth=6;c.stroke();
  c.strokeStyle='rgba(120,80,30,.25)';c.lineWidth=1.4;for(let i=0;i<16;i++){const a=i/16*TAU;c.beginPath();c.moveTo(o.x,o.y);c.lineTo(o.x+Math.cos(a)*(o.r+5),o.y+Math.sin(a)*(o.r+5));c.stroke();}
  c.fillStyle='rgba(255,255,255,.2)';c.beginPath();c.arc(o.x-o.r*.25,o.y-o.r*.3,o.r*.45,0,TAU);c.fill();
 }
 // drop tower: a readable shaft footprint and long northward shadow
 const D=R.drop;c.fillStyle='rgba(10,20,30,.28)';c.save();c.translate(D.x,D.y);c.rotate(-.15);c.fillRect(-16,-8,32,240);c.restore();
 c.fillStyle='#4e5862';c.beginPath();c.ellipse(D.x,D.y,28,18,0,0,TAU);c.fill();
 c.fillStyle='#c5c0b6';c.beginPath();c.ellipse(D.x,D.y,20,13,0,0,TAU);c.fill();
 c.fillStyle='#9aa4ad';c.fillRect(D.x-8,D.y-10,16,20);c.strokeStyle='#f2c94c';c.lineWidth=3;c.strokeRect(D.x-10,D.y-12,20,24);
 // bumper car floor: rubber apron, yellow kerb, entrance on the west
 const U=R.bumper;c.fillStyle='rgba(0,0,0,.25)';c.fillRect(U.x+10,U.y+12,U.w,U.h);
 c.fillStyle='#2b2f45';c.fillRect(U.x,U.y,U.w,U.h);c.strokeStyle='#f2c94c';c.lineWidth=8;c.strokeRect(U.x+4,U.y+4,U.w-8,U.h-8);
 c.strokeStyle='rgba(255,255,255,.08)';c.lineWidth=1;for(let x=U.x+20;x<U.x+U.w;x+=20){c.beginPath();c.moveTo(x,U.y+8);c.lineTo(x,U.y+U.h-8);c.stroke();}
 c.fillStyle='#3b3f55';c.fillRect(U.x-18,U.y+U.h/2-22,22,44);c.fillStyle='#f2c94c';c.fillRect(U.x-18,U.y+U.h/2-22,22,4);c.fillRect(U.x-18,U.y+U.h/2+18,22,4);
 // fountain basin with a tiled rim
 const Fo=R.fountain;c.fillStyle='#cbbfa8';c.beginPath();c.arc(Fo.x,Fo.y,Fo.r+12,0,TAU);c.fill();
 c.strokeStyle='#a89878';c.lineWidth=5;c.stroke();
 const g=c.createRadialGradient(Fo.x,Fo.y,4,Fo.x,Fo.y,Fo.r);g.addColorStop(0,'#bff3ef');g.addColorStop(1,'#2aa6c0');c.fillStyle=g;c.beginPath();c.arc(Fo.x,Fo.y,Fo.r,0,TAU);c.fill();
 c.fillStyle='#d9c9a6';c.beginPath();c.arc(Fo.x,Fo.y,8,0,TAU);c.fill();
 // coaster station: platform, striped canopy and a short stair
 const S=R.coaster.station;c.fillStyle='rgba(0,0,0,.25)';c.fillRect(S.x+8,S.y+10,S.w,S.h+18);
 c.fillStyle='#8a3040';c.fillRect(S.x-8,S.y-8,S.w+16,S.h+22);
 c.fillStyle='#c73a4c';c.fillRect(S.x,S.y,S.w,S.h);
 c.fillStyle='#f6e7c8';for(let x=S.x+6;x<S.x+S.w;x+=24)c.fillRect(x,S.y+4,14,S.h-8);
 c.fillStyle='#7b3fa0';c.fillRect(S.x-10,S.y-22,S.w+20,16);c.fillStyle='#f2c94c';c.fillRect(S.x-10,S.y-22,S.w+20,4);
 c.fillStyle='#fff6d8';c.font='800 11px system-ui';c.textAlign='center';c.textBaseline='middle';c.fillText('CROWN COASTER',S.x+S.w/2,S.y-13);
 c.fillStyle='#c9c0ad';for(let i=0;i<4;i++)c.fillRect(S.x+S.w+2,S.y+S.h-2+i*5,28,4);
 // trestle footings under the track
 c.fillStyle='rgba(30,30,40,.4)';const P=R.coaster.pts;for(let i=0;i<P.length;i+=4){c.fillRect(P[i][0]+10,P[i][1]+16,7,9);c.fillStyle='#6a5a4a';c.fillRect(P[i][0]+8,P[i][1]+14,7,8);c.fillStyle='rgba(30,30,40,.4)';}
 for(const s of R.stalls){c.fillStyle='rgba(0,0,0,.25)';c.fillRect(s.x+8,s.y+10,s.w,s.h);for(let i=0;i<6;i++){c.fillStyle=i%2?'#fff':s.c;c.fillRect(s.x+i*s.w/6,s.y,s.w/6+.5,s.h*.62);}c.fillStyle='#8b5e3c';c.fillRect(s.x,s.y+s.h*.62,s.w,s.h*.38);c.fillStyle='rgba(255,255,255,.35)';c.fillRect(s.x,s.y,s.w,4);c.fillStyle='#efe6d2';c.fillRect(s.x+8,s.y+s.h*.68,s.w-16,8);}
}

function paintPark(c,G){
 const P=PARK,R=G.world.resort;
 // packed earth and warm pavers, slightly darker under the rides
 c.fillStyle='#c89a6a';c.fillRect(P.x,P.y,P.w,P.h);
 const t=pat(G,c,'paver_warm');if(t){c.globalAlpha=.5;c.fillStyle=t;c.fillRect(P.x,P.y,P.w,P.h);c.globalAlpha=1;}
 c.fillStyle='rgba(90,60,30,.08)';c.fillRect(P.x,P.y,P.w,P.h);
 // entrance apron meeting the south resort road, so the gate reads as a way in
 c.fillStyle='#d4b48a';c.fillRect(R.gate.x-70,P.y+P.h-8,140,140);
 if(t){c.globalAlpha=.4;c.fillStyle=t;c.fillRect(R.gate.x-70,P.y+P.h-8,140,140);c.globalAlpha=1;}
 c.fillStyle='rgba(255,255,255,.55)';for(let k=-54;k<=48;k+=16)c.fillRect(R.gate.x+k,P.y+P.h+20,10,86);
 // promenades: sand-brick paths with a darker kerb
 const paths=()=>{c.beginPath();c.moveTo(R.gate.x,R.gate.y);c.lineTo(4830,-1180);c.lineTo(R.carousel.x,R.carousel.y);c.moveTo(4830,-1180);c.lineTo(R.spinner.x,R.spinner.y);c.lineTo(R.ferris.x,R.ferris.y+R.ferris.r+30);c.moveTo(R.spinner.x,R.spinner.y);c.lineTo(4760,-1900);c.moveTo(4830,-1180);c.lineTo(5080,-1200);c.moveTo(R.fountain.x,R.fountain.y);c.lineTo(4830,-1180);c.moveTo(R.gate.x,R.gate.y);c.lineTo(R.fountain.x,R.fountain.y);};
 c.strokeStyle='#8a6240';c.lineWidth=54;c.lineCap='round';c.lineJoin='round';paths();c.stroke();
 c.strokeStyle='#efd7b4';c.lineWidth=42;paths();c.stroke();
 c.strokeStyle='rgba(190,120,80,.35)';c.lineWidth=2;c.setLineDash([6,10]);paths();c.stroke();c.setLineDash([]);
 // path lamps (static posts; they glow in the night pass)
 c.fillStyle='#3b4044';for(const [lx,ly] of [[4830,-1120],[4700,-1280],[4550,-1500],[4780,-1680],[5000,-1220],[4580,-1180],[4700,-980]]){c.fillRect(lx-3,ly-3,7,7);c.fillStyle='#f6e7b0';c.beginPath();c.arc(lx,ly-10,3.5,0,TAU);c.fill();c.fillStyle='#3b4044';}
 for(const b of R.beds){c.fillStyle='#3d6a36';rr(c,b.x-3,b.y-3,b.w+6,b.h+6,16);c.fill();c.fillStyle='#4f8f45';rr(c,b.x,b.y,b.w,b.h,14);c.fill();const rnd=rng(b.x*7+b.y);for(let i=0;i<b.w*b.h/420;i++){c.fillStyle=['#f05d7a','#ffd34d','#ffffff','#b98cf0','#ff8c42'][i%5];c.beginPath();c.arc(b.x+8+rnd()*(b.w-16),b.y+8+rnd()*(b.h-16),3.2,0,TAU);c.fill();}}
 // hedge fence with an arched gate
 c.strokeStyle='#2f6a32';c.lineWidth=18;c.beginPath();c.moveTo(R.gate.x-90,P.y+P.h-7);c.lineTo(P.x+7,P.y+P.h-7);c.lineTo(P.x+7,P.y+7);c.lineTo(P.x+P.w-7,P.y+7);c.lineTo(P.x+P.w-7,P.y+P.h-7);c.lineTo(R.gate.x+90,P.y+P.h-7);c.stroke();
 c.strokeStyle='#4f8f45';c.lineWidth=8;c.stroke();
 // ticket booths flanking the gate
 for(const sx of [-130,78]){c.fillStyle='rgba(0,0,0,.25)';c.fillRect(R.gate.x+sx+6,R.gate.y-20,46,36);c.fillStyle='#7b3fa0';c.fillRect(R.gate.x+sx,R.gate.y-26,46,18);c.fillStyle='#f2c94c';c.fillRect(R.gate.x+sx,R.gate.y-26,46,4);c.fillStyle='#efe6d2';c.fillRect(R.gate.x+sx,R.gate.y-8,46,20);}
 c.fillStyle='rgba(0,0,0,.28)';c.fillRect(R.gate.x-94,R.gate.y-54,200,30);c.fillStyle='#7b3fa0';c.fillRect(R.gate.x-100,R.gate.y-60,200,32);c.fillStyle='#f2c94c';c.fillRect(R.gate.x-100,R.gate.y-60,200,5);
 c.fillStyle='#fff6d8';c.font='900 18px system-ui';c.textAlign='center';c.textBaseline='middle';c.fillText('WILD CROWN PARK',R.gate.x,R.gate.y-43);
}

function paintCourt(c,k){c.fillStyle='#e9d39d';c.fillRect(k.x,k.y,k.w,k.h);c.strokeStyle='rgba(255,255,255,.85)';c.lineWidth=2;c.strokeRect(k.x+4,k.y+4,k.w-8,k.h-8);c.strokeStyle='#333';c.lineWidth=2;c.beginPath();if(k.w>k.h){c.moveTo(k.x+k.w/2,k.y-4);c.lineTo(k.x+k.w/2,k.y+k.h+4);}else{c.moveTo(k.x-4,k.y+k.h/2);c.lineTo(k.x+k.w+4,k.y+k.h/2);}c.stroke();}
function paintBar(c,b){c.fillStyle='rgba(60,40,10,.25)';c.beginPath();c.arc(b.x+12,b.y+14,b.r,0,TAU);c.fill();c.fillStyle='#b98a4a';c.beginPath();c.arc(b.x,b.y,b.r,0,TAU);c.fill();c.strokeStyle='rgba(110,70,30,.6)';c.lineWidth=2;for(let i=0;i<16;i++){const a=i/16*TAU;c.beginPath();c.moveTo(b.x,b.y);c.lineTo(b.x+Math.cos(a)*b.r,b.y+Math.sin(a)*b.r);c.stroke();}c.fillStyle='#d9b06a';c.beginPath();c.arc(b.x,b.y,b.r*.25,0,TAU);c.fill();
 for(let i=0;i<5;i++){const a=i/5*TAU+.3;c.fillStyle='#8d5a32';c.beginPath();c.arc(b.x+Math.cos(a)*(b.r+16),b.y+Math.sin(a)*(b.r+16),6,0,TAU);c.fill();}}
function paintTower(c,t){c.fillStyle='rgba(60,40,10,.25)';c.fillRect(t.x-6,t.y-4,26,26);c.fillStyle='#f4f1ea';c.fillRect(t.x-11,t.y-11,22,22);c.fillStyle='#e94b3c';c.fillRect(t.x-11,t.y-11,22,7);c.fillStyle='#e94b3c';c.fillRect(t.x-3,t.y+11,6,10);}
function paintRoads(c,G,r){
 const R=G.world.resort,a=pat(G,c,'asphalt'),wk=pat(G,c,'paver');
 for(const s of R.roads){if(s.k==='bridge')continue;const sw=s.v?{x:s.c-128,y:s.a-128,w:256,h:s.b-s.a+256}:{x:s.a-128,y:s.c-128,w:s.b-s.a+256,h:256};if(!hits(sw,r))continue;c.fillStyle=C.walk;c.fillRect(sw.x,sw.y,sw.w,sw.h);if(wk){c.globalAlpha=.35;c.fillStyle=wk;c.fillRect(sw.x,sw.y,sw.w,sw.h);c.globalAlpha=1;}c.strokeStyle='rgba(120,110,95,.5)';c.lineWidth=3;c.strokeRect(sw.x+26,sw.y+26,sw.w-52,sw.h-52);}
 for(const s of R.roads){if(s.k==='bridge')continue;const q=s.v?{x:s.c-100,y:s.a-100,w:200,h:s.b-s.a+200}:{x:s.a-100,y:s.c-100,w:s.b-s.a+200,h:200};if(!hits(q,r))continue;c.fillStyle=C.asphalt;c.fillRect(q.x,q.y,q.w,q.h);if(a){c.globalAlpha=.45;c.fillStyle=a;c.fillRect(q.x,q.y,q.w,q.h);c.globalAlpha=1;}}
 // markings, skipping the junction boxes
 const junction=(x,y)=>R.roads.some(o=>o.v&&Math.abs(x-o.c)<104&&y>o.a-104&&y<o.b+104)&&R.roads.some(o=>!o.v&&Math.abs(y-o.c)<104&&x>o.a-104&&x<o.b+104);
 for(const s of R.roads){if(s.k==='bridge')continue;
  for(let t=s.a-100;t<s.b+100;t+=20){const x=s.v?s.c:t,y=s.v?t:s.c;if(x<r.x-120||x>r.x+r.w+120||y<r.y-120||y>r.y+r.h+120||junction(x,y))continue;
   c.fillStyle='#f2c94c';if(s.v){c.fillRect(x-5,y,3,20);c.fillRect(x+2,y,3,20);}else{c.fillRect(x,y-5,20,3);c.fillRect(x,y+2,20,3);}
   c.fillStyle='rgba(255,255,255,.85)';if(Math.round(t/20)%3===0){if(s.v){c.fillRect(x-52,y,3,30);c.fillRect(x+49,y,3,30);}else{c.fillRect(x,y-52,30,3);c.fillRect(x,y+49,30,3);}}
   c.fillStyle='rgba(255,255,255,.6)';if(s.v){c.fillRect(x-93,y,3,20);c.fillRect(x+90,y,3,20);}else{c.fillRect(x,y-93,20,3);c.fillRect(x,y+90,20,3);}
  }
 }
 // zebra crossings at every island junction
 c.fillStyle='rgba(255,255,255,.82)';
 for(const v of R.roads)if(v.v&&v.k!=='bridge')for(const h of R.roads)if(!h.v&&h.c>=v.a-1&&h.c<=v.b+1&&v.c>=h.a-1&&v.c<=h.b+1){
  const x=v.c,y=h.c;if(x<r.x-300||x>r.x+r.w+300||y<r.y-300||y>r.y+r.h+300)continue;
  for(let k=-90;k<=80;k+=22){if(y-112>v.a-100)c.fillRect(x+k,y-124,12,18);if(y+106<v.b+100)c.fillRect(x+k,y+106,12,18);if(x-112>h.a-100)c.fillRect(x-124,y+k,18,12);if(x+106<h.b+100)c.fillRect(x+106,y+k,18,12);}
 }
}
function paintLampPost(c,L){const x=L.x,y=L.y;c.fillStyle='rgba(0,0,0,.25)';c.fillRect(x+3,y+3,7,7);c.fillStyle='#3b4044';c.fillRect(x-3,y-3,7,7);const ax=L.v?-L.side*18:0,ay=L.v?0:-L.side*18;c.strokeStyle='#3b4044';c.lineWidth=3;c.beginPath();c.moveTo(x,y);c.lineTo(x+ax,y+ay);c.stroke();c.fillStyle='#f6e7b0';c.beginPath();c.arc(x+ax,y+ay,4,0,TAU);c.fill();}

export function* resortChunkSteps(G,ix,iy,scale){
 const SZ=512,x0=ix*SZ,y0=iy*SZ,r={x:x0,y:y0,w:SZ,h:SZ},m={x:x0-260,y:y0-260,w:SZ+520,h:SZ+520};
 const cv=document.createElement('canvas');cv.width=cv.height=Math.ceil(SZ*scale);const c=cv.getContext('2d');
 c.setTransform(scale,0,0,scale,-x0*scale,-y0*scale);
 const W=G.world,R=W.resort;yield {canvas:cv};
 if(y0<0){
  const g=c.createLinearGradient(0,y0,0,y0+SZ);g.addColorStop(0,C.deep);g.addColorStop(1,'#1f6678');c.fillStyle=C.deep;c.fillRect(x0,y0,SZ,Math.min(SZ,-y0));
  const wt=pat(G,c,'water');if(wt){c.globalAlpha=.22;c.fillStyle=wt;c.fillRect(x0,y0,SZ,Math.min(SZ,-y0));c.globalAlpha=1;}
  if(hits(m,{x:ISLE.cx-ISLE.a-400,y:ISLE.cy-ISLE.b-400,w:ISLE.a*2+800,h:ISLE.b*2+800})){
   const isl=R._path||(R._path=islandPath(0)),inner=R._inner||(R._inner=islandPath(175)),dry=R._dry||(R._dry=islandPath(26));
   c.lineJoin='round';
   for(const [w,col] of [[700,'rgba(37,127,143,.45)'],[440,'rgba(44,140,150,.6)'],[250,'rgba(56,166,168,.75)'],[120,'rgba(80,196,186,.9)'],[44,'#9fdfcf']]){c.strokeStyle=col;c.lineWidth=w;c.stroke(isl);}
   yield;
   c.fillStyle=C.wet;c.fill(isl);c.fillStyle=C.sand;c.fill(dry);
   const st=pat(G,c,'sand');if(st){c.save();c.clip(isl);c.globalAlpha=.33;c.fillStyle=st;c.fillRect(x0,y0,SZ,SZ);c.restore();}
   c.strokeStyle='rgba(255,255,255,.28)';c.lineWidth=3;c.stroke(dry);
   c.fillStyle=C.grass;c.fill(inner);const gt=pat(G,c,'grass');if(gt){c.save();c.clip(inner);c.globalAlpha=.42;c.fillStyle=gt;c.fillRect(x0,y0,SZ,SZ);c.restore();}
   c.strokeStyle='rgba(140,160,80,.55)';c.lineWidth=26;c.stroke(inner);c.strokeStyle='rgba(225,205,140,.6)';c.lineWidth=10;c.stroke(inner);
   // ripples on the sand
   const rnd=rng(ix*977+iy*131+7);c.strokeStyle='rgba(170,135,80,.18)';c.lineWidth=2;for(let i=0;i<40;i++){const x=x0+rnd()*SZ,y=y0+rnd()*SZ;if(R.codeAny(x,y)!==4)continue;c.beginPath();c.moveTo(x-14,y);c.quadraticCurveTo(x,y-4,x+14,y);c.stroke();}
   yield;
   for(const k of R.courts)if(hits(k,m))paintCourt(c,k);
   paintRoads(c,G,m);
   if(hits(PARK,m))paintPark(c,G);
   yield;
   for(const g of R.gardens)if(hits(g,m)){c.fillStyle=C.grass2;c.fillRect(g.x,g.y,g.w,g.h);}
   for(const p of R.pools)if(hits(p.deck,m))paintPool(c,p,G);
   yield;
   if(hits(PARK,m))paintRide(c,R,G);
   for(const H of R.hotels)if(hits({x:H.x,y:H.y,w:H.w+40,h:H.h+60},m))paintHotel(c,H,G);
   yield;
   for(const p of R.piers)if(hits(p,m))paintPier(c,p,G);
   for(const y of R.yachts)if(hits({x:y.x-100,y:y.y-100,w:200,h:200},m))paintYacht(c,y);
   if(hits({x:R.harbour.x,y:R.harbour.y,w:R.harbour.w,h:R.harbour.h},m)){const h=R.harbour;shadowRect(c,h.x,h.y,h.w,h.h);c.fillStyle='#f1ede4';c.fillRect(h.x,h.y,h.w,h.h);c.fillStyle='#2f8fb4';c.fillRect(h.x,h.y,h.w,18);c.fillStyle='#fff';c.font='800 12px system-ui';c.textAlign='center';c.textBaseline='middle';c.fillText('MARINA',h.x+h.w/2,h.y+9);}
   const L=R.lighthouse;if(Math.abs(L.x-x0-256)<400&&Math.abs(L.y-y0-256)<400){c.fillStyle='rgba(0,0,0,.3)';c.beginPath();c.arc(L.x+10,L.y+12,L.r,0,TAU);c.fill();c.fillStyle='#f4f1ea';c.beginPath();c.arc(L.x,L.y,L.r,0,TAU);c.fill();c.strokeStyle='#d6453b';c.lineWidth=6;c.beginPath();c.arc(L.x,L.y,L.r-6,0,TAU);c.stroke();c.fillStyle='#ffe9a0';c.beginPath();c.arc(L.x,L.y,7,0,TAU);c.fill();}
   for(const rk of R.rocks)if(Math.abs(rk.x-x0-256)<300&&Math.abs(rk.y-y0-256)<300){c.fillStyle='rgba(10,30,40,.3)';c.beginPath();c.ellipse(rk.x+5,rk.y+6,rk.r,rk.r*.75,rk.seed*3,0,TAU);c.fill();c.fillStyle='#7d7a72';c.beginPath();c.ellipse(rk.x,rk.y,rk.r,rk.r*.75,rk.seed*3,0,TAU);c.fill();c.fillStyle='rgba(255,255,255,.2)';c.beginPath();c.ellipse(rk.x-rk.r*.25,rk.y-rk.r*.2,rk.r*.45,rk.r*.3,rk.seed*3,0,TAU);c.fill();}
   yield;
   for(const b of R.bars)if(Math.abs(b.x-x0-256)<330&&Math.abs(b.y-y0-256)<330)paintBar(c,b);
   for(const t of R.towers)if(Math.abs(t.x-x0-256)<300&&Math.abs(t.y-y0-256)<300)paintTower(c,t);
   for(const t of R.towels)if(Math.abs(t.x-x0-256)<290&&Math.abs(t.y-y0-256)<290)paintTowel(c,t);
   for(const u of R.umbrellas)if(Math.abs(u.x-x0-256)<300&&Math.abs(u.y-y0-256)<300)paintUmbrella(c,u,true);
   for(const u of R.umbrellas)if(Math.abs(u.x-x0-256)<300&&Math.abs(u.y-y0-256)<300)paintUmbrella(c,u,false);
   for(const L of W.lamps)if(L.resort&&!L.bridge&&Math.abs(L.x-x0-256)<280&&Math.abs(L.y-y0-256)<280)paintLampPost(c,L);
   yield;
   for(const p of R.palms)if(Math.abs(p.x-x0-256)<330&&Math.abs(p.y-y0-256)<330)paintPalm(c,p,true);
   for(const p of R.palms)if(Math.abs(p.x-x0-256)<320&&Math.abs(p.y-y0-256)<320)paintPalm(c,p,false);
  }
 }
 const B=BRIDGE;if(hits(m,{x:B.x-B.deck/2-40,y:B.y0,w:B.deck+80,h:B.y1-B.y0})){paintBridge(c,G);for(const L of W.lamps)if(L.bridge&&Math.abs(L.y-y0-256)<300)paintLampPost(c,L);}
 return cv;
}

/* ------------------------------------------------------------ runtime */
export function initResort(G){
 const R=G.world.resort;if(!R)return;
 R.cache=new Map();R.t0=performance.now();
 for(const s of R.slips.slice(0,3)){try{const v=G.makeVeh(s.y<-1500?'wake':'gulf',s.x,s.y,s.rot,{keep:true});v.parked=true;v.resort=true;G.vehicles.push(v);}catch{}}
}
function chunk(G,ix,iy,budget){
 const R=G.world.resort,key=ix+':'+iy,low=G.settings.quality==='low';const scale=low?.5:1;
 let e=R.cache.get(key);
 if(e&&e.scale!==scale){e.c.width=1;R.cache.delete(key);e=null;}
 if(e){e.t=G.ticks;if(!e.job)return e.c;}
 if(performance.now()>budget.until&&e?.job)return null;
 if(!e){if(performance.now()>budget.until)return null;e={job:resortChunkSteps(G,ix,iy,scale),scale,t:G.ticks,c:null};R.cache.set(key,e);}
 while(performance.now()<budget.until||!budget.used){budget.used=true;const s=e.job.next();if(s.value?.canvas)e.c=s.value.canvas;if(s.done){e.c=s.value;e.job=null;e.done=true;return e.c;}}
 return null;
}
function trimCache(G,limit){const R=G.world.resort;if(R.cache.size<=limit)return;const cold=[...R.cache].sort((a,b)=>a[1].t-b[1].t);for(let i=0;i<cold.length-limit;i++){const e=cold[i][1];if(e.t===G.ticks)continue;if(e.c)e.c.width=1;e.job?.return?.();R.cache.delete(cold[i][0]);}}
function seaPattern(G,c){const R=G.world.resort;if(R._sea)return R._sea;const t=G.assets?.tex?.water;const cv=document.createElement('canvas');cv.width=cv.height=256;const x=cv.getContext('2d');x.fillStyle=C.deep;x.fillRect(0,0,256,256);if(t){x.globalAlpha=.22;x.fillStyle=x.createPattern(t,'repeat');x.fillRect(0,0,256,256);}return R._sea=c.createPattern(cv,'repeat');}
export function drawResortGround(G,r){
 const R=G.world.resort;if(!R||!R.cache||r.y0>RESORT_BOUNDS.y1)return;
 const c=G.ctx;
 if(r.y1>0&&r.y0<420){const g=c.createLinearGradient(0,0,0,400);g.addColorStop(0,'rgba(28,91,112,.92)');g.addColorStop(.35,'rgba(28,91,112,.55)');g.addColorStop(1,'rgba(28,91,112,0)');c.fillStyle=g;c.fillRect(Math.max(0,r.x0),0,Math.min(r.x1,12288)-Math.max(0,r.x0),400);}
 if(r.y0<0){c.fillStyle=seaPattern(G,c);c.fillRect(Math.max(0,r.x0),Math.max(-NORTH,r.y0),Math.min(r.x1,12288)-Math.max(0,r.x0),Math.min(0,r.y1)-Math.max(-NORTH,r.y0));}
 const SZ=512,ix0=Math.max(Math.floor(RESORT_BOUNDS.x0/SZ),Math.floor(r.x0/SZ)),ix1=Math.min(Math.floor((RESORT_BOUNDS.x1-1)/SZ),Math.floor(r.x1/SZ));
 const iy0=Math.max(-NORTH/SZ|0,Math.floor(r.y0/SZ))-(r.y0<-NORTH?0:0),iy1=Math.min(1,Math.floor(r.y1/SZ));
 const low=G.settings.quality==='low',budget={until:performance.now()+(low?3:5),used:G.ticks<3?false:false};
 const list=[];for(let iy=Math.max(Math.floor(-NORTH/SZ),iy0);iy<=iy1;iy++)for(let ix=ix0;ix<=ix1;ix++){const bx=ix*SZ,by=iy*SZ;if(by>=0&&(bx+SZ<BRIDGE.x-200||bx>BRIDGE.x+200))continue;list.push({ix,iy,d:(bx+256-G.cam.x)**2+(by+256-G.cam.y)**2});}
 list.sort((a,b)=>a.d-b.d);let pending=0;
 for(const {ix,iy} of list){const im=chunk(G,ix,iy,budget);if(im&&R.cache.get(ix+':'+iy)?.done)c.drawImage(im,ix*SZ,iy*SZ,SZ,SZ);else{pending++;if(iy<0)fallbackChunk(G,c,ix,iy);}}
 R.pending=pending;trimCache(G,Math.max(low?20:28,list.length+6));
 drawWaterLife(G,c,r);
}
function fallbackChunk(G,c,ix,iy){const R=G.world.resort,SZ=512,cols=['#3e4549','#c9c0ad','#7a7f80','#1c5b70','#ecd5a0','#5d9a4c','#3e4549','#a77d50','#1c5b70','#888','#888'];for(let y=0;y<SZ;y+=32)for(let x=0;x<SZ;x+=32){const k=R.codeAny(ix*SZ+x+16,iy*SZ+y+16);if(k===3)continue;c.fillStyle=cols[k]||'#888';c.fillRect(ix*SZ+x,iy*SZ+y,32.5,32.5);}}
function drawWaterLife(G,c,r){
 const R=G.world.resort,t=G.settings.reducedMotion?0:G.ticks/60;
 // animated surf line hugging the island
 if(r.y0<0&&r.x1>ISLE.cx-ISLE.a-100&&r.x0<ISLE.cx+ISLE.a+100&&r.y1>ISLE.cy-ISLE.b-100&&r.y0<ISLE.cy+ISLE.b+100){
  const isl=R._path||(R._path=islandPath(0)),wave=R._wave||(R._wave=islandPath(-22,520));
  c.save();c.lineJoin='round';c.setLineDash([26,18,10,22]);
  c.lineDashOffset=-t*14;c.strokeStyle='rgba(240,253,248,.7)';c.lineWidth=7;c.stroke(isl);
  c.lineDashOffset=t*9;c.strokeStyle='rgba(225,250,245,.35)';c.lineWidth=5;c.globalAlpha=.6+.4*Math.sin(t*1.3);c.stroke(wave);
  c.restore();
 }
 // glints on the open bay
 if(r.y0<0){const step=150;c.strokeStyle='rgba(210,245,250,.32)';c.lineWidth=2.4;c.beginPath();
  for(let y=Math.floor(Math.max(r.y0,-NORTH)/step)*step;y<Math.min(0,r.y1);y+=step)for(let x=Math.floor(r.x0/step)*step;x<r.x1;x+=step){
   const h=((x*73856093)^(y*19349663))>>>0,ph=(h%628)/100+t*(.6+(h%7)/10),a=Math.sin(ph);if(a<.35)continue;
   const gx=x+(h%step),gy=y+((h>>8)%step);if(G.world.resort.codeAny(gx,gy)!==3)continue;const L=6+a*10;c.moveTo(gx-L,gy);c.quadraticCurveTo(gx,gy-3,gx+L,gy);}
  c.stroke();}
}
function wheelAngle(G){return (G.settings.reducedMotion?0:G.ticks/60)*.12;}
export function drawResortOverhead(G,r){
 const R=G.world.resort;if(!R||!R.cache)return;const c=G.ctx,t=G.settings.reducedMotion?0:G.ticks/60;
 const B=BRIDGE;
 // bridge pylons + cables over the traffic
 if(r.x1>B.x-200&&r.x0<B.x+200&&r.y1>B.y0-200&&r.y0<B.y1){
  for(const py of B.pylons){if(py<r.y0-400||py>r.y1+400)continue;
   c.strokeStyle='rgba(240,236,225,.85)';c.lineWidth=2;c.beginPath();
   for(const lx of [B.x-B.deck/2+8,B.x+B.deck/2-8])for(let k=1;k<=7;k++){c.moveTo(lx,py);c.lineTo(lx,py-k*34);c.moveTo(lx,py);c.lineTo(lx,py+k*34);}c.stroke();
   for(const lx of [B.x-B.deck/2+8,B.x+B.deck/2-8]){c.fillStyle='rgba(0,0,0,.25)';c.fillRect(lx-4,py-2,26,28);c.fillStyle='#f3efe6';c.fillRect(lx-12,py-14,24,28);c.fillStyle='#c94b3c';c.fillRect(lx-12,py-14,24,5);}
   c.fillStyle='#e9e3d6';c.fillRect(B.x-B.deck/2+4,py-5,B.deck-8,10);c.fillStyle='rgba(0,0,0,.18)';c.fillRect(B.x-B.deck/2+4,py+3,B.deck-8,3);
  }
 }
 if(r.y0>-200||r.x0>PARK.x+PARK.w+200||r.x1<PARK.x-200||r.y1<PARK.y-300||r.y0>PARK.y+PARK.h+200)return drawHotelSigns(G,c,r);
 // roller coaster: elevated track, trestle legs and a moving train
 const K=R.coaster,P=K.pts;
 if(!K.paths||!K.paths.legs){const left=new Path2D(),right=new Path2D(),ties=new Path2D(),shadow=new Path2D(),legs=new Path2D();
  for(let i=0;i<=P.length;i++){const a=P[i%P.length],b=P[(i+1)%P.length],dx=b[0]-a[0],dy=b[1]-a[1],L=Math.hypot(dx,dy)||1,nx=-dy/L*7,ny=dx/L*7;
   if(i){left.lineTo(a[0]+nx,a[1]+ny);right.lineTo(a[0]-nx,a[1]-ny);shadow.lineTo(a[0]+22,a[1]+26);}else{left.moveTo(a[0]+nx,a[1]+ny);right.moveTo(a[0]-nx,a[1]-ny);shadow.moveTo(a[0]+22,a[1]+26);}
   ties.moveTo(a[0]+nx*1.5,a[1]+ny*1.5);ties.lineTo(a[0]-nx*1.5,a[1]-ny*1.5);
   if(i%4===0){legs.moveTo(a[0]+4,a[1]+2);legs.lineTo(a[0]+12,a[1]+18);legs.moveTo(a[0]-4,a[1]+2);legs.lineTo(a[0]+4,a[1]+18);}}
  K.paths={left,right,ties,shadow,legs};}
 c.save();c.lineJoin='round';c.lineCap='round';c.strokeStyle='rgba(15,25,35,.22)';c.lineWidth=18;c.stroke(K.paths.shadow);
 c.strokeStyle='#5a4638';c.lineWidth=3.2;c.stroke(K.paths.legs);
 c.strokeStyle='#5a3a6e';c.lineWidth=4;c.stroke(K.paths.ties);c.strokeStyle='#3a2a44';c.lineWidth=5;c.stroke(K.paths.left);c.stroke(K.paths.right);
 c.strokeStyle='#e8e4ea';c.lineWidth=2.4;c.stroke(K.paths.left);c.stroke(K.paths.right);c.restore();
 // train position follows a lift/drop speed profile
 const cyc=24,ph=(t%cyc)/cyc,u=ph<.18?ph/.18*.12:.12+(1-.12)*(1-Math.pow(1-(ph-.18)/.82,1.6));
 const at=(s)=>{s=((s%K.len)+K.len)%K.len;let lo=0,hi=K.cum.length-1;while(hi-lo>1){const mid=(lo+hi)>>1;K.cum[mid]<=s?lo=mid:hi=mid;}const a=P[lo%P.length],b=P[(lo+1)%P.length],f=(s-K.cum[lo])/((K.cum[lo+1]-K.cum[lo])||1);return {x:a[0]+(b[0]-a[0])*f,y:a[1]+(b[1]-a[1])*f,rot:Math.atan2(b[0]-a[0],-(b[1]-a[1]))};};
 const head=u*K.len+260;for(let k=0;k<5;k++){const p=at(head-k*30);c.save();c.translate(p.x,p.y);c.rotate(p.rot);c.fillStyle='rgba(0,0,0,.25)';c.fillRect(-9+14,-13+16,18,26);c.fillStyle=k===0?'#f2c94c':'#d6453b';rr(c,-10,-13,20,26,5);c.fill();c.fillStyle='#262a33';c.fillRect(-7,-7,14,5);c.fillRect(-7,3,14,5);c.fillStyle='#f1c7a3';c.beginPath();c.arc(-4,-9,2.6,0,TAU);c.arc(4,-9,2.6,0,TAU);c.arc(-4,1,2.6,0,TAU);c.arc(4,1,2.6,0,TAU);c.fill();c.restore();}
 R.coasterPos=at(head);R.coasterSpeed=ph<.18?.2:1-(ph-.18)/.82*.5;
 // carousel: horses orbit under a fixed scalloped canopy
 const Ca=R.carousel,ca=t*.6;
 c.fillStyle='rgba(0,0,0,.2)';c.beginPath();c.arc(Ca.x+12,Ca.y+14,Ca.r-6,0,TAU);c.fill();
 for(let i=0;i<10;i++){const a=ca+i/10*TAU,hx=Ca.x+Math.cos(a)*Ca.r*.62,hy=Ca.y+Math.sin(a)*Ca.r*.62,bob=Math.sin(ca*2+i)*4;c.save();c.translate(hx,hy+bob);c.rotate(a+Math.PI/2);
  c.fillStyle='rgba(0,0,0,.2)';c.beginPath();c.ellipse(2,3,8,4,0,0,TAU);c.fill();
  c.fillStyle=i%2?'#f4f1ea':'#d6453b';c.beginPath();c.ellipse(0,0,8,3.6,0,0,TAU);c.fill();
  c.fillStyle=i%2?'#d6453b':'#2a9fd6';c.fillRect(-2,-7,4,8);c.beginPath();c.ellipse(7,-2,3.4,2.2,0.4,0,TAU);c.fillStyle='#f1c7a3';c.fill();
  c.strokeStyle='#e6c25a';c.lineWidth=1.6;c.beginPath();c.moveTo(0,-1);c.lineTo(0,-16);c.stroke();c.restore();}
 // scalloped roof, slightly above the horses
 c.fillStyle='rgba(0,0,0,.18)';c.beginPath();c.arc(Ca.x+10,Ca.y+10,Ca.r-4,0,TAU);c.fill();
 for(let i=0;i<16;i++){c.fillStyle=i%2?'#d6453b':'#f6efe0';c.beginPath();c.moveTo(Ca.x,Ca.y);c.arc(Ca.x,Ca.y,Ca.r-2,i/16*TAU-Math.PI/16,(i+1)/16*TAU-Math.PI/16);c.closePath();c.fill();}
 c.fillStyle='#e6c25a';c.beginPath();c.arc(Ca.x,Ca.y,Ca.r*.42,0,TAU);c.fill();
 c.fillStyle='#7b3fa0';c.beginPath();c.arc(Ca.x,Ca.y,Ca.r*.22,0,TAU);c.fill();
 c.fillStyle='#f2c94c';c.beginPath();c.arc(Ca.x,Ca.y,7,0,TAU);c.fill();c.fillStyle='#fff6d8';c.beginPath();c.arc(Ca.x,Ca.y-10,3.5,0,TAU);c.fill();
 const Sp=R.spinner;for(let i=0;i<6;i++){const a=t*.9+i/6*TAU,cx=Sp.x+Math.cos(a)*Sp.r*.62,cy=Sp.y+Math.sin(a)*Sp.r*.62;c.fillStyle='rgba(0,0,0,.2)';c.beginPath();c.arc(cx+5,cy+6,20,0,TAU);c.fill();c.fillStyle=['#f05d7a','#ffd34d','#62cfc0','#b98cf0','#f28c38','#46b37a'][i];c.beginPath();c.arc(cx,cy,20,0,TAU);c.fill();c.fillStyle='rgba(255,255,255,.7)';c.beginPath();c.arc(cx,cy,12,0,TAU);c.fill();c.fillStyle='#f1c7a3';const sa=-t*3+i;c.beginPath();c.arc(cx+Math.cos(sa)*6,cy+Math.sin(sa)*6,3.4,0,TAU);c.arc(cx-Math.cos(sa)*6,cy-Math.sin(sa)*6,3.4,0,TAU);c.fill();}
 c.fillStyle='#7b3fa0';c.beginPath();c.arc(Sp.x,Sp.y,16,0,TAU);c.fill();c.fillStyle='#f2c94c';c.beginPath();c.arc(Sp.x,Sp.y,6,0,TAU);c.fill();
 // drop tower: a vertical shaft (northward in top-down) and a rising car
 const D=R.drop,dph=(t%9)/9,hgt=dph<.55?dph/.55:dph<.62?1:Math.max(0,1-(dph-.62)/.06);
 c.strokeStyle='#6a737c';c.lineWidth=8;c.beginPath();c.moveTo(D.x,D.y);c.lineTo(D.x-6,D.y-210);c.stroke();
 c.strokeStyle='#9aa4ad';c.lineWidth=4;c.beginPath();c.moveTo(D.x+6,D.y);c.lineTo(D.x,D.y-210);c.stroke();
 c.strokeStyle='#f2c94c';c.lineWidth=2;c.setLineDash([6,8]);c.beginPath();c.moveTo(D.x,D.y);c.lineTo(D.x-6,D.y-210);c.stroke();c.setLineDash([]);
 {const cx=D.x-6*hgt,cy=D.y-210*hgt;c.fillStyle='rgba(0,0,0,.25)';c.beginPath();c.arc(cx+6,cy+8,16,0,TAU);c.fill();c.fillStyle='#d6453b';c.beginPath();c.arc(cx,cy,15,0,TAU);c.fill();c.fillStyle='#f2c94c';c.beginPath();c.arc(cx,cy,15,0,TAU);c.lineWidth=3;c.stroke();c.fillStyle='#f1c7a3';for(let i=0;i<6;i++){const a=i/6*TAU;c.beginPath();c.arc(cx+Math.cos(a)*8,cy+Math.sin(a)*8,2.6,0,TAU);c.fill();}}
 c.fillStyle='#c5c0b6';c.beginPath();c.ellipse(D.x,D.y,14,9,0,0,TAU);c.fill();
 R.dropFall=dph>.62&&dph<.68;
 const U=R.bumper;for(let i=0;i<8;i++){const a=t*(.5+i*.07)+i*1.7,bx=U.x+30+(U.w-60)*(.5+.5*Math.sin(a*1.3+i)),by=U.y+28+(U.h-56)*(.5+.5*Math.sin(a*.9+i*2.1)),rot=Math.atan2(Math.cos(a*1.3+i)*1.3*(U.w-60),-Math.cos(a*.9+i*2.1)*.9*(U.h-56));c.save();c.translate(bx,by);c.rotate(rot);c.fillStyle=['#e94b3c','#2a9fd6','#f4c542','#46b37a'][i%4];rr(c,-10,-13,20,26,7);c.fill();c.fillStyle='#222';c.fillRect(-11,-14,22,4);c.fillStyle='#f1c7a3';c.beginPath();c.arc(0,2,3.6,0,TAU);c.fill();c.restore();}
 // fountain jets
 const Fo=R.fountain;c.fillStyle='rgba(235,252,255,.75)';for(let i=0;i<10;i++){const a=i/10*TAU+t*.4,k=.45+.25*Math.sin(t*3+i);c.beginPath();c.arc(Fo.x+Math.cos(a)*Fo.r*k,Fo.y+Math.sin(a)*Fo.r*k,3.2,0,TAU);c.fill();}c.beginPath();c.arc(Fo.x,Fo.y,7+2*Math.sin(t*5),0,TAU);c.fill();
 // ferris wheel, leaning toward the camera so it reads from above
 const F=R.ferris,wa=wheelAngle(G);c.save();
 c.strokeStyle='#5d6873';c.lineWidth=10;c.beginPath();c.moveTo(F.base.x+16,F.base.y+12);c.lineTo(F.x,F.y);c.lineTo(F.base.x+F.base.w-16,F.base.y+12);c.stroke();
 c.strokeStyle='#eef1f4';c.lineWidth=8;c.beginPath();c.arc(F.x,F.y,F.r,0,TAU);c.stroke();c.lineWidth=3;c.beginPath();c.arc(F.x,F.y,F.r-16,0,TAU);c.stroke();
 c.lineWidth=2.4;c.beginPath();for(let i=0;i<16;i++){const a=wa+i/16*TAU;c.moveTo(F.x,F.y);c.lineTo(F.x+Math.cos(a)*F.r,F.y+Math.sin(a)*F.r);}c.stroke();
 for(let i=0;i<16;i++){const a=wa+i/16*TAU,gx=F.x+Math.cos(a)*F.r,gy=F.y+Math.sin(a)*F.r;c.fillStyle='rgba(0,0,0,.2)';c.fillRect(gx-9,gy+4,20,16);c.fillStyle=['#e94b3c','#f4c542','#2a9fd6','#46b37a'][i%4];rr(c,-11+gx,gy+2-2,22,18,5);c.fill();c.fillStyle='rgba(255,255,255,.7)';c.fillRect(gx-8,gy+3,16,5);c.fillStyle='#f1c7a3';c.beginPath();c.arc(gx-3,gy+8,2.2,0,TAU);c.arc(gx+3,gy+8,2.2,0,TAU);c.fill();}
 c.fillStyle='#c49a3a';c.beginPath();c.arc(F.x,F.y,15,0,TAU);c.fill();c.fillStyle='#fff3c4';c.beginPath();c.arc(F.x,F.y,6,0,TAU);c.fill();c.restore();
 drawHotelSigns(G,c,r);
}
function drawHotelSigns(G,c,r){}
export function drawResortLights(G,r,night){
 const R=G.world.resort;if(!R||!R.cache||night<.05||r.y0>RESORT_BOUNDS.y1)return;const c=G.ctx,t=G.settings.reducedMotion?0:G.ticks/60;
 c.save();c.globalCompositeOperation='lighter';
 // hotel windows, pools
 for(const H of R.hotels){if(H.x>r.x1||H.x+H.w<r.x0||H.y>r.y1||H.y+H.h<r.y0)continue;
  if(!H.lit){H.lit=new Path2D();const rnd=rng(Math.floor(H.seed*1e7)),rows=H.tower?5:3,roofH=H.h-H.fac,rowH=(H.fac-14)/rows,cols=Math.floor(H.w/26);for(let rr_=0;rr_<rows;rr_++)for(let k=0;k<cols;k++)if(rnd()<.55)H.lit.rect(H.x+10+k*(H.w-16)/cols,H.y+roofH+6+rr_*rowH,(H.w-16)/cols-5,rowH-5);}
  c.globalAlpha=.85*night;c.fillStyle='rgba(255,196,120,1)';c.fill(H.lit);
  c.globalAlpha=.6*night;c.fillStyle=H.accent;c.fillRect(H.x,H.y+H.h-10,H.w,10);
  {const roofH=H.h-H.fac,tw=H.w*(H.tower?.42:.36),fs=Math.min(30,roofH*.24);c.globalAlpha=.7*night;c.fillStyle=H.accent;c.font='900 '+fs+'px system-ui';c.textAlign='left';c.textBaseline='bottom';c.fillText(H.name,H.id%2?H.x+22:H.x+tw+40,H.y+roofH-52);}
 }
 for(const p of R.pools){if(p.x>r.x1||p.x+p.w<r.x0||p.y>r.y1||p.y+p.h<r.y0)continue;c.globalAlpha=.5*night;const g=c.createRadialGradient(p.x+p.w/2,p.y+p.h/2,10,p.x+p.w/2,p.y+p.h/2,Math.max(p.w,p.h)*.6);g.addColorStop(0,'rgba(80,230,255,.9)');g.addColorStop(1,'rgba(0,120,200,0)');c.fillStyle=g;c.fillRect(p.x-60,p.y-60,p.w+120,p.h+120);}
 // park: wheel rim bulbs, coaster lights, carousel bulbs, gate neon
 if(r.x1>PARK.x-300&&r.x0<PARK.x+PARK.w+300&&r.y1>PARK.y-300&&r.y0<PARK.y+PARK.h+200){
  const F=R.ferris,wa=wheelAngle(G);for(let i=0;i<48;i++){const a=wa+i/48*TAU;c.globalAlpha=night*(.6+.4*Math.sin(t*4+i*.7));c.fillStyle=['#ff4f8b','#ffd34d','#4fd7ff','#8dff6a'][(i+Math.floor(t*2))%4];c.beginPath();c.arc(F.x+Math.cos(a)*F.r,F.y+Math.sin(a)*F.r,4.5,0,TAU);c.fill();}
  c.globalAlpha=.35*night;const halo=c.createRadialGradient(F.x,F.y,20,F.x,F.y,F.r+70);halo.addColorStop(0,'rgba(255,120,200,.0)');halo.addColorStop(.75,'rgba(255,120,200,.35)');halo.addColorStop(1,'rgba(255,120,200,0)');c.fillStyle=halo;c.fillRect(F.x-F.r-80,F.y-F.r-80,F.r*2+160,F.r*2+160);
  const K=R.coaster;c.globalAlpha=.7*night;c.fillStyle='#ffe7a0';for(let i=0;i<K.pts.length;i+=6){const p=K.pts[i];c.fillRect(p[0]-2,p[1]-2,4,4);}
  const Ca=R.carousel;for(let i=0;i<20;i++){const a=i/20*TAU;c.globalAlpha=night*(.7+.3*Math.sin(t*6+i));c.fillStyle='#fff0b0';c.beginPath();c.arc(Ca.x+Math.cos(a)*(Ca.r-2),Ca.y+Math.sin(a)*(Ca.r-2),3.5,0,TAU);c.fill();}
  c.globalAlpha=.35*night;const ch=c.createRadialGradient(Ca.x,Ca.y,8,Ca.x,Ca.y,Ca.r+30);ch.addColorStop(0,'rgba(255,200,120,.8)');ch.addColorStop(1,'rgba(255,200,120,0)');c.fillStyle=ch;c.beginPath();c.arc(Ca.x,Ca.y,Ca.r+30,0,TAU);c.fill();
  const Sp=R.spinner;for(let i=0;i<6;i++){const a=t*.9+i/6*TAU;c.globalAlpha=night*(.55+.35*Math.sin(t*5+i));c.fillStyle='#fff0c0';c.beginPath();c.arc(Sp.x+Math.cos(a)*Sp.r*.62,Sp.y+Math.sin(a)*Sp.r*.62,5,0,TAU);c.fill();}
  const D=R.drop;c.globalAlpha=.7*night;c.fillStyle='#ff6b7a';c.beginPath();c.arc(D.x,D.y,6,0,TAU);c.fill();c.fillStyle='#fff3c0';c.beginPath();c.arc(D.x-6,D.y-210,5,0,TAU);c.fill();
  const U=R.bumper;c.globalAlpha=.55*night;c.fillStyle='#f2c94c';c.strokeStyle='#f2c94c';c.lineWidth=3;c.strokeRect(U.x+4,U.y+4,U.w-8,U.h-8);
  for(const [lx,ly] of [[4830,-1120],[4700,-1280],[4550,-1500],[4780,-1680],[5000,-1220],[4580,-1180],[4700,-980]]){c.globalAlpha=.55*night;const lg=c.createRadialGradient(lx,ly-10,2,lx,ly-10,36);lg.addColorStop(0,'rgba(255,230,160,1)');lg.addColorStop(1,'rgba(255,230,160,0)');c.fillStyle=lg;c.beginPath();c.arc(lx,ly-10,36,0,TAU);c.fill();}
  c.globalAlpha=.8*night;c.fillStyle='#ff5fd2';c.fillRect(R.gate.x-100,R.gate.y-60,200,5);c.fillStyle='#ffe28a';c.font='900 18px system-ui';c.textAlign='center';c.textBaseline='middle';c.fillText('WILD CROWN PARK',R.gate.x,R.gate.y-43);
  for(const s of R.stalls){c.globalAlpha=.45*night;const g=c.createRadialGradient(s.x+s.w/2,s.y+s.h,4,s.x+s.w/2,s.y+s.h,70);g.addColorStop(0,'rgba(255,200,120,.9)');g.addColorStop(1,'rgba(255,200,120,0)');c.fillStyle=g;c.fillRect(s.x-40,s.y-30,s.w+80,s.h+90);}
 }
 // lighthouse sweep
 const L=R.lighthouse;if(Math.abs(L.x-(r.x0+r.x1)/2)<1600&&Math.abs(L.y-(r.y0+r.y1)/2)<1600){const a=t*1.4;c.globalAlpha=.32*night;const g=c.createRadialGradient(L.x,L.y,4,L.x,L.y,520);g.addColorStop(0,'rgba(255,240,190,.9)');g.addColorStop(1,'rgba(255,240,190,0)');c.fillStyle=g;c.beginPath();c.moveTo(L.x,L.y);c.arc(L.x,L.y,520,a-.16,a+.16);c.closePath();c.fill();c.globalAlpha=night;c.fillStyle='#fff3c0';c.beginPath();c.arc(L.x,L.y,7,0,TAU);c.fill();}
 // bridge cable lights
 const B=BRIDGE;if(r.x1>B.x-200&&r.x0<B.x+200&&r.y1>B.y0&&r.y0<B.y1){c.globalAlpha=.9*night;c.fillStyle='#bfe9ff';for(const py of B.pylons)for(const lx of [B.x-B.deck/2+8,B.x+B.deck/2-8])for(let k=-7;k<=7;k++){c.beginPath();c.arc(lx,py+k*34,2.2,0,TAU);c.fill();}
  c.globalAlpha=.85*night;c.fillStyle='#ff4040';for(const py of B.pylons)for(const lx of [B.x-B.deck/2+8,B.x+B.deck/2-8]){c.beginPath();c.arc(lx,py,4+Math.sin(t*3)*1.5,0,TAU);c.fill();}}
 c.restore();
}
