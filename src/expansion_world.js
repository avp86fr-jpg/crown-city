/* Crown City's canal, outdoor casino and connected frontier. All geometry is deterministic. */
export const FRONTIER = Object.freeze({
 canal:{x:6864,y:560,w:208,h:6240},
 casino:{x:7540,y:2820,w:1420,h:770,name:'METAWIN / OPEN AIR'},
 airport:{runway:{x:6620,y:7420,w:3300,h:160},apron:{x:6620,y:7620,w:3300,h:340}},
 helipads:[{id:'airport',name:'CROWN AIRFIELD',x:7000,y:7780,r:95},{id:'casino',name:'METAWIN TERRACE',x:7920,y:3450,r:90},{id:'terminal',name:'AIRFIELD / EAST APRON',x:9580,y:7780,r:85},{id:'forest',name:'PINEWATCH',x:11400,y:4920,r:90},{id:'mountain',name:'SIERRA RESCUE',x:11200,y:9640,r:90}],
 aircraft:[{id:'runway-plane',kind:'plane',x:6900,y:7500,rot:Math.PI/2},{id:'airport-heli',kind:'heli',x:7000,y:7780,rot:0},{id:'casino-heli',kind:'heli',x:7920,y:3450,rot:0},{id:'terminal-heli',kind:'heli',x:9580,y:7780,rot:0}],
 docks:[{id:'north',x:6818,y:1250,boatX:6930,boatY:1250},{id:'casino',x:7115,y:3450,boatX:7012,boatY:3450},{id:'south',x:6818,y:6150,boatX:6930,boatY:6150}],
 contacts:[{id:'hunter',name:'HUNTER',x:6810,y:1250,job:'canal',subtitle:'THE CANAL CONNECTION',portrait:'hunter',color:'#74b9bb'}, {id:'gold_mage',name:'GOLD MAGE',x:7660,y:3430,job:'casino',subtitle:'THE HOUSE ALWAYS KNOWS',portrait:'gold_mage',color:'#e1b750'}, {id:'neural',name:'NEURAL',x:9840,y:7780,job:'airlift',subtitle:'THE LAST FREQUENCY',portrait:'neural',color:'#d589e3'}, {id:'mask',name:'MASK',x:11340,y:4920,job:'ridge',subtitle:'THE ROAD WITHOUT CAMERAS',portrait:'mask',color:'#b5c9a4'}, {id:'fire',name:'FIRE',x:5680,y:9730,job:'ridge',subtitle:'DUST NEVER FORGETS',portrait:'fire',color:'#ed976b'}],
 landmarks:[{name:'CROWN CANAL',x:6968,y:3500},{name:'METAWIN TERRACE',x:8200,y:3200},{name:'CROWN AIRFIELD',x:8300,y:7500},{name:'PINEWATCH FOREST',x:11400,y:4200},{name:'RED MESA',x:6000,y:9690},{name:'SIERRA CROWN',x:11500,y:9660}],
});
const TAU=Math.PI*2, inside=(x,y,r)=>x>=r.x&&y>=r.y&&x<=r.x+r.w&&y<=r.y+r.h;
const intersects=(a,b)=>a.x<b.x+b.w&&a.x+(a.w||0)>b.x&&a.y<b.y+b.h&&a.y+(a.h||0)>b.y;
export function terrainRegion(x,y){return x>=10400&&y<8400?'forest':y>=9216&&x<8800?'desert':x>=10400&&y>=8400||y>=9216&&x>=8800?'mountain':null;}
export function applyExpansion(W,{CELL,GW,CODE,WORLD_W,WORLD_H}){
 const fill=W.fill,at=(x,y)=>W.grid[Math.floor(y/CELL)*GW+Math.floor(x/CELL)];
 W.expansion={...FRONTIER,bridges:[],decor:[],obstacles:[],version:1};const E=W.expansion;
 let seed=82713;const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const clear=(r,ground)=>{for(const key of ['buildings','trees','parking','lots','features','lamps','pools'])W[key]=W[key].filter(p=>!intersects({x:p.x-(p.r||0),y:p.y-(p.r||0),w:p.w||p.r*2||1,h:p.h||p.r*2||1},r));fill(r.x,r.y,r.w,r.h,ground);};
 // A continuous canal cuts through Midtown and connects the coast to the south river.
 const canal=E.canal;clear({x:canal.x-80,y:canal.y,w:canal.w+160,h:canal.h},CODE.walk);
 W.roads=W.roads.filter(s=>!(s.v&&s.c>canal.x-80&&s.c<canal.x+canal.w+80&&s.a<6800));
 fill(canal.x,canal.y,canal.w,canal.h,CODE.canal);W.waterRects.push([canal.x,canal.y,canal.w,canal.h]);
 for(const s of W.roads)if(!s.v&&s.a<canal.x&&s.b>canal.x+canal.w&&s.c>canal.y&&s.c<6800){
  const b={x:canal.x-64,y:s.c-s.w/2,w:canal.w+128,h:s.w,clearance:36};E.bridges.push(b);fill(b.x,b.y,b.w,b.h,CODE.road);
 }
 W.boatSurfaceAt=(x,y)=>inside(x,y,canal)?(E.docks.some(d=>Math.abs(y-d.y)<37&&(d.x<canal.x?x<canal.x+27:x>canal.x+canal.w-27))?'pier':'canal'):x>=0&&x<WORLD_W&&y>=W.river[0]&&y<W.river[1]?'water':null;
 for(const d of E.docks){const left=d.x<canal.x;const pier={x:left?canal.x-65:canal.x+canal.w-25,y:d.y-32,w:90,h:64};W.piers.push(pier);fill(pier.x,pier.y,pier.w,pier.h,CODE.pier);}
 for(let y=1000;y<6500;y+=150){if(E.bridges.some(b=>y>b.y-35&&y<b.y+b.h+35))continue;for(const x of [canal.x-39,canal.x+canal.w+39]){W.lamps.push({x,y,v:true});E.decor.push({kind:'canal',x,y,seed:rnd()});}}
 // Outdoor casino is a walkable terrace, with tables, cabanas, a stage and an aircraft pad.
 const casino=E.casino;clear(casino,CODE.walk);W.roads=W.roads.flatMap(s=>{
  const crossing=s.v?s.c>casino.x&&s.c<casino.x+casino.w:s.c>casino.y&&s.c<casino.y+casino.h;
  if(!crossing)return [s];const low=s.v?casino.y:casino.x,high=low+(s.v?casino.h:casino.w);
  if(s.b<=low||s.a>=high)return [s];return [{...s,b:low},{...s,a:high}].filter(q=>q.b-q.a>20);
 });
 fill(casino.x+100,casino.y+casino.h-90,casino.w-200,90,CODE.lot);
 for(const [x,y,w,h,kind] of [[casino.x+470,casino.y+35,500,90,'bar'],[casino.x+60,casino.y+50,130,100,'cage'],[casino.x+casino.w-200,casino.y+60,140,180,'stage']]){
  fill(x,y,w,h,CODE.build);W.buildings.push({x,y,w,h,hgt:18,roof:'tar',wall:'dark',kind:'pavilion',color:'#293d39'});E.decor.push({kind,x,y,w,h});
 }
 for(let row=0;row<2;row++)for(let col=0;col<5;col++){
  const x=casino.x+280+col*205,y=casino.y+235+row*185;
  E.decor.push({kind:col%2?'blackjack':'roulette',x,y,seed:rnd()});fill(x-56,y-23,112,46,CODE.build);E.obstacles.push({x:x-56,y:y-23,w:112,h:46,hgt:12});
 }
 for(let i=0;i<7;i++){const x=casino.x+75+i*200;W.trees.push({x,y:casino.y+casino.h-180,r:16,t:2});E.decor.push({kind:'cabana',x,y:casino.y+casino.h-120,seed:rnd()});}
 // Extend connected roads into the eastern forest and the southern desert / mountain belt.
 for(let y=720;y<WORLD_H;y+=CELL)for(let x=10240;x<WORLD_W;x+=CELL)if(y<W.river[0]-40||y>=W.river[1]+40)fill(x,y,CELL,CELL,terrainRegion(x,y)==='forest'?CODE.grass:CODE.dirt);
 fill(0,9216,WORLD_W,WORLD_H-9216,CODE.sand);fill(8800,9216,WORLD_W-8800,WORLD_H-9216,CODE.dirt);
 const roads=[{v:false,c:1600,a:10000,b:11600,w:144},{v:true,c:10880,a:860,b:9800,w:144},{v:true,c:11600,a:1600,b:9800,w:128},{v:false,c:4800,a:10000,b:11600,w:144},{v:false,c:9000,a:10000,b:11600,w:144},{v:true,c:5600,a:9000,b:9800,w:144},{v:true,c:3840,a:9000,b:9800,w:144},{v:false,c:9800,a:3840,b:11600,w:144}];
 for(const s of roads){s.lanes=1;s.med=0;s.k='frontier';W.roads.push(s);const r=s.v?{x:s.c-s.w/2-22,y:s.a,w:s.w+44,h:s.b-s.a}:{x:s.a,y:s.c-s.w/2-22,w:s.b-s.a,h:s.w+44};clear(r,CODE.dirt);if(s.v)fill(s.c-s.w/2,s.a,s.w,s.b-s.a,CODE.road);else fill(s.a,s.c-s.w/2,s.b-s.a,s.w,CODE.road);}
 E.riverBridges=W.roads.filter(s=>s.v&&s.a<W.river[0]&&s.b>W.river[1]).map(s=>({x:s.c-s.w/2,y:W.river[0]-16,w:s.w,h:W.river[1]-W.river[0]+32,vertical:true,clearance:36}));
 // Camp, fuel stop and mountain rescue station give the new roads destinations.
 for(const r of [{x:11120,y:4840,w:440,h:260,k:'camp'},{x:5430,y:9560,w:440,h:280,k:'fuel'},{x:11010,y:9480,w:420,h:270,k:'rescue'}]){clear(r,CODE.lot);E.decor.push({...r,kind:r.k});}
 const roadClear=(x,y,rad)=>!W.roads.some(s=>s.v?Math.abs(x-s.c)<s.w/2+rad&&y>s.a-rad&&y<s.b+rad:Math.abs(y-s.c)<s.w/2+rad&&x>s.a-rad&&x<s.b+rad);
 for(let i=0;i<1100;i++){
  const x=10410+rnd()*1800,y=900+rnd()*7370;if(!roadClear(x,y,75)||at(x,y)!==CODE.grass)continue;
  const r=19+rnd()*24;W.trees.push({x,y,r,t:3,pine:true});fill(x-6,y-6,12,12,CODE.build);
 }
 for(let i=0;i<210;i++){
  const x=4230+rnd()*4260,y=9260+rnd()*920;if(!roadClear(x,y,40)||at(x,y)===CODE.lot)continue;E.decor.push({kind:i%5?'scrub':'cactus',x,y,seed:rnd()});
 }
 for(let i=0;i<92;i++){
  const x=8940+rnd()*3150,y=9270+rnd()*780;if(!roadClear(x,y,100)||at(x,y)===CODE.lot)continue;
  const w=80+rnd()*150,h=50+rnd()*100;if(E.helipads.some(p=>Math.abs(p.x-x)<w/2+p.r+30&&Math.abs(p.y-y)<h/2+p.r+30))continue;fill(x-w/2,y-h/2,w,h,CODE.build);E.decor.push({kind:'rock',x,y,w,h,seed:rnd()});
 }
 for(let i=0;i<28;i++){const x=11840+rnd()*330,y=8200+rnd()*1500;if(roadClear(x,y,100)){E.decor.push({kind:'rock',x,y,w:90+rnd()*110,h:60+rnd()*80,seed:rnd()});fill(x-40,y-35,80,70,CODE.build);}}
 for(let i=0;i<30;i++){const x=4300+rnd()*4200,y=9340+rnd()*780,w=110+rnd()*120,h=60+rnd()*80;if(!roadClear(x,y,150)||at(x,y)===CODE.lot)continue;fill(x-w/2,y-h/2,w,h,CODE.build);E.decor.push({kind:'mesa',x,y,w,h,seed:rnd()});}
 // Every flight pad and named character has a clear, connected approach.
 for(const p of E.helipads){clear({x:p.x-p.r-14,y:p.y-p.r-14,w:(p.r+14)*2,h:(p.r+14)*2},CODE.lot);E.decor.push({kind:'helipad',...p});}
 for(const p of E.contacts){fill(p.x-28,p.y-28,56,56,CODE.walk);}
 E.decor=E.decor.filter(p=>p.kind!=='rock'||!E.helipads.some(h=>intersects({x:p.x-p.w/2,y:p.y-p.h/2,w:p.w,h:p.h},{x:h.x-h.r-20,y:h.y-h.r-20,w:h.r*2+40,h:h.r*2+40})));
 for(const p of E.decor)if(p.kind==='rock'||p.kind==='mesa')E.obstacles.push({x:p.x-p.w/2,y:p.y-p.h/2,w:p.w,h:p.h,hgt:40+p.h*.45});
 for(const t of W.trees)if(t.pine)E.obstacles.push({x:t.x-12,y:t.y-12,w:24,h:24,hgt:58});
 W.features=W.features.filter(f=>f.k!=='plane');
 W.inter=[];for(const a of W.roads)if(a.v)for(const b of W.roads)if(!b.v&&b.c>=a.a&&b.c<=a.b&&a.c>=b.a&&a.c<=b.b)W.inter.push({x:a.c,y:b.c,vs:a,hs:b});
 W.signals=W.signals.filter(p=>!(p.x>canal.x-80&&p.x<canal.x+canal.w+80));
 E.decorBins=new Map();for(const p of E.decor){const r=Math.max(p.w||0,p.h||0,p.r||0,140);for(let y=Math.floor((p.y-r)/512);y<=Math.floor((p.y+r)/512);y++)for(let x=Math.floor((p.x-r)/512);x<=Math.floor((p.x+r)/512);x++){const key=x+':'+y,list=E.decorBins.get(key)||[];list.push(p);E.decorBins.set(key,list);}}
}
function disk(c,x,y,r,color){c.fillStyle=color;c.beginPath();c.arc(x,y,r,0,TAU);c.fill();}
function ellipse(c,x,y,w,h,color){c.fillStyle=color;c.beginPath();c.ellipse(x,y,w,h,0,0,TAU);c.fill();}
function box(c,x,y,w,h,color){c.fillStyle=color;c.fillRect(x,y,w,h);}
function text(c,s,x,y,size,col='#e9d7a8'){c.fillStyle=col;c.font=`800 ${size}px system-ui`;c.textAlign='center';c.fillText(s,x,y);}
export function drawExpansionGround(c,W,r,pats={}){
 const E=W.expansion;if(!E)return;
 const canal=E.canal;if(r.x1>canal.x-80&&r.x0<canal.x+canal.w+80&&r.y1>canal.y&&r.y0<6800){
  c.fillStyle=pats.water||'#193e43';c.fillRect(canal.x,canal.y,canal.w,canal.h);c.fillStyle='rgba(16,54,55,.62)';c.fillRect(canal.x,canal.y,canal.w,canal.h);
  for(const x of [canal.x-8,canal.x+canal.w]){box(c,x,canal.y,8,canal.h,'#716c5d');box(c,x+2,canal.y,2,canal.h,'#c2b89a');}
  c.strokeStyle='rgba(140,200,176,.15)';c.lineWidth=1.5;for(let y=Math.max(canal.y,Math.floor(r.y0/32)*32);y<Math.min(6800,r.y1);y+=32){c.beginPath();c.moveTo(canal.x+24,y);c.quadraticCurveTo(canal.x+100,y-9,canal.x+184,y+2);c.stroke();}
 }
 const C=E.casino;if(intersects({x:r.x0,y:r.y0,w:r.x1-r.x0,h:r.y1-r.y0},C)){
  // Inlaid terrace aisles break up repeating stone without adding draw work per frame.
  box(c,C.x+190,C.y+307,1090,35,'#9d9b82');box(c,C.x+190,C.y+307,1090,2,'#d4c59e');box(c,C.x+190,C.y+340,1090,2,'#d4c59e');
  for(let col=0;col<5;col++)for(let row=0;row<2;row++){const x=C.x+280+col*205,y=C.y+235+row*185;ellipse(c,x+3,y+8,80,48,'rgba(29,55,48,.13)');}
  c.strokeStyle='#b99a5a';c.lineWidth=6;c.strokeRect(C.x+12,C.y+12,C.w-24,C.h-24);c.lineWidth=1;c.strokeRect(C.x+25,C.y+25,C.w-50,C.h-50);
  text(c,'METAWIN',C.x+C.w/2,C.y+165,50,'#315c4f');text(c,'OPEN AIR / PRIVATE TABLES',C.x+C.w/2,C.y+195,13,'#5b6656');
 }
 const props=new Set();for(let iy=Math.floor(r.y0/512);iy<=Math.floor(r.y1/512);iy++)for(let ix=Math.floor(r.x0/512);ix<=Math.floor(r.x1/512);ix++)for(const p of E.decorBins.get(ix+':'+iy)||[])props.add(p);
 for(const p of props){c.save();c.translate(p.x,p.y);
  if(W.sceneryAtlas&&['rock','mesa','cactus'].includes(p.kind)){
   const im=W.sceneryAtlas,i=p.kind==='rock'?1:p.kind==='mesa'?2:3,w=p.kind==='cactus'?42:p.w*1.25,h=p.kind==='cactus'?52:p.h*1.5;
   ellipse(c,6,10,w*.42,h*.34,'rgba(22,20,19,.25)');c.drawImage(im,(i%2)*im.width/2,Math.floor(i/2)*im.height/2,im.width/2,im.height/2,-w/2,-h*.58,w,h);c.restore();continue;
  }
  if(p.kind==='roulette'||p.kind==='blackjack'){
   ellipse(c,5,9,65,37,'rgba(9,15,12,.3)');ellipse(c,0,0,65,35,'#523b29');ellipse(c,0,-3,59,29,'#224e3c');c.strokeStyle='#c9ae73';c.lineWidth=2;c.stroke();
   if(p.kind==='roulette'){disk(c,-28,-3,20,'#c6a563');for(let k=0;k<16;k++){c.fillStyle=k%2?'#733f33':'#172d27';c.beginPath();c.moveTo(-28,-3);c.arc(-28,-3,17,k*TAU/16,(k+1)*TAU/16);c.fill();}disk(c,-28,-3,5,'#e7cc82');c.strokeStyle='#d7d7a5';c.lineWidth=.8;for(let x=0;x<36;x+=9)for(let y=-17;y<13;y+=10)c.strokeRect(x,y,8,9);}
   else{for(let i=0;i<4;i++){box(c,-34+i*20,-9,11,17,'#e9e4cc');disk(c,-29+i*20,14,4,i%2?'#bc695c':'#d9c17e');}text(c,'21',0,-14,9);}
   for(const a of [.25,1.2,2.1,2.9,3.7,5]){ellipse(c,Math.cos(a)*78,Math.sin(a)*47,9,8,'#453a2a');disk(c,Math.cos(a)*78,Math.sin(a)*47-2,8,'#927b52');}
  }else if(p.kind==='cabana'){box(c,-30,-18,60,38,'#c8bea2');for(let x=-30;x<30;x+=12)box(c,x,-18,6,38,'#3b695c');box(c,-24,25,48,10,'#806b4a');}
  else if(p.kind==='helipad'){disk(c,4,6,p.r,'rgba(0,0,0,.25)');disk(c,0,0,p.r,'#333e3f');c.strokeStyle='#eadc9f';c.lineWidth=5;c.beginPath();c.arc(0,0,p.r-12,0,TAU);c.stroke();text(c,'H',0,24,72);for(let a=0;a<TAU;a+=TAU/8)disk(c,Math.cos(a)*(p.r+5),Math.sin(a)*(p.r+5),3,'#89c5b8');text(c,p.name,0,p.r+25,12);}
  else if(p.kind==='canal'){box(c,-13,-5,26,11,'#83795d');for(let y=-5;y<7;y+=4)box(c,-13,y,26,1,'#4c5142');disk(c,20,0,10,'#586746');}
  else if(p.kind==='cactus'){c.strokeStyle='#69714a';c.lineWidth=8;c.lineCap='round';c.beginPath();c.moveTo(0,14);c.lineTo(0,-20);c.moveTo(0,-2);c.lineTo(-12,-2);c.lineTo(-12,-13);c.moveTo(0,4);c.lineTo(11,4);c.lineTo(11,-8);c.stroke();c.strokeStyle='#bac08b';c.lineWidth=1;c.beginPath();c.moveTo(-2,10);c.lineTo(-2,-19);c.stroke();}
  else if(p.kind==='scrub'){for(let k=0;k<5;k++)ellipse(c,Math.cos(k*2)*7,Math.sin(k*2)*5,5,3,k%2?'#847b50':'#78623e');}
  else if(p.kind==='rock'||p.kind==='mesa'){const w=p.w,h=p.h;ellipse(c,12,16,w*.6,h*.55,'rgba(29,25,27,.3)');c.fillStyle=pats.mountain||'#625e60';c.beginPath();c.moveTo(-w*.5,h*.28);c.lineTo(-w*.4,-h*.4);c.lineTo(w*.08,-h*.54);c.lineTo(w*.48,-h*.25);c.lineTo(w*.5,h*.4);c.lineTo(-w*.15,h*.5);c.closePath();c.fill();c.fillStyle='rgba(203,191,174,.32)';c.beginPath();c.moveTo(-w*.4,-h*.4);c.lineTo(w*.08,-h*.54);c.lineTo(w*.2,h*.1);c.lineTo(-w*.2,h*.2);c.closePath();c.fill();c.strokeStyle='#484b50';c.lineWidth=2;for(let k=0;k<4;k++){c.beginPath();c.moveTo(-w*.35+k*w*.12,-h*.32);c.lineTo(-w*.25+k*w*.12,h*.3);c.stroke();}}
  c.restore();
 }
}
export function drawExpansionOverhead(G,r){
 const c=G.ctx;for(const b of [...(G.world.expansion?.bridges||[]),...(G.world.expansion?.riverBridges||[])]){if(b.x>r.x1||b.x+b.w<r.x0||b.y>r.y1||b.y+b.h<r.y0)continue;
  if(b.vertical){box(c,b.x,b.y,b.w,b.h,'#454b4c');for(const x of [b.x-8,b.x+b.w]){box(c,x,b.y,8,b.h,'#a79878');for(let y=b.y;y<b.y+b.h;y+=38)box(c,x-2,y,12,5,'#d0bf9e');}c.strokeStyle='#d5c3a1';c.lineWidth=2;c.setLineDash([18,16]);c.beginPath();c.moveTo(b.x+b.w/2,b.y);c.lineTo(b.x+b.w/2,b.y+b.h);c.stroke();c.setLineDash([]);continue;}
  // Road deck hides boats below while cars/pedestrians are redrawn by the caller above it.
  box(c,b.x,b.y,b.w,b.h,'#454b4c');box(c,b.x,b.y-9,b.w,9,'#a79878');box(c,b.x,b.y+b.h,b.w,9,'#a79878');
  c.strokeStyle='#d5c3a1';c.lineWidth=2;c.setLineDash([18,16]);c.beginPath();c.moveTo(b.x,b.y+b.h/2);c.lineTo(b.x+b.w,b.y+b.h/2);c.stroke();c.setLineDash([]);
  for(let x=b.x+12;x<b.x+b.w;x+=38){box(c,x,b.y-12,5,13,'#d0bf9e');box(c,x,b.y+b.h,5,13,'#d0bf9e');}
 }
}
