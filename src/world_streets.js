// Core artwork, road collision and traffic connections meet at these authored gateways.
export const GATEWAYS=[
 {x:352,y:3792,w:3744,h:304},
 {x:3720,y:1472,w:408,h:256},
 {x:3720,y:2432,w:408,h:384}
];
const overlap=(a,b)=>a.x<b.x+b.w&&a.x+(a.w||1)>b.x&&a.y<b.y+b.h&&a.y+(a.h||1)>b.y;
export function applyStreetGateways(W,meta,CODE){
 const core=(meta.roads||[]).filter(s=>s.a[0]===s.b[0]).map(s=>({v:true,c:s.a[0],a:Math.min(s.a[1],s.b[1]),b:Math.max(s.a[1],s.b[1]),w:s.w,lanes:s.k==='strip'?3:s.w>=200?2:1,med:s.k==='strip'?72:0}));
 const roads=[...core,{v:false,c:3900,a:400,b:4096,w:200,lanes:2,med:0},
  ...W.roads.filter(s=>s.v&&s.c<4096&&s.a<=3990),
  ...W.roads.filter(s=>!s.v&&[1600,2620].includes(s.c))];
 W.gateways=GATEWAYS;W.gatewayRoads=roads;
 for(const r of GATEWAYS){
  W.fill(r.x,r.y,r.w,r.h,CODE.walk);
  for(let y=r.y;y<r.y+r.h;y+=16)for(let x=r.x;x<r.x+r.w;x+=16){
   const px=x+8,py=y+8;
   if(roads.some(s=>{const along=s.v?py:px,side=Math.abs((s.v?px:py)-s.c);return along>=s.a-16&&along<=s.b+16&&side<s.w/2;}))W.fill(x,y,16,16,CODE.road);
  }
 }
 const hit=p=>GATEWAYS.some(r=>overlap(p,r));
 for(const key of ['buildings','trees','lamps','props','features','lots','parking'])W[key]=W[key].filter(p=>!hit(p));
 for(const key of ['buildings','props','parking','gathers','fountains','palms'])if(meta[key])meta[key]=meta[key].filter(p=>!hit(p));
}
function paint(c,r,roads,roadInk){
 roadInk=roadInk||"#2a2e32";
 c.translate(-r.x,-r.y);c.fillStyle='#96968a';c.fillRect(r.x,r.y,r.w,r.h);
 c.strokeStyle='#7e8078';c.lineWidth=1;
 for(let x=r.x;x<r.x+r.w;x+=24){c.beginPath();c.moveTo(x,r.y);c.lineTo(x,r.y+r.h);c.stroke();}
 for(let y=r.y;y<r.y+r.h;y+=24){c.beginPath();c.moveTo(r.x,y);c.lineTo(r.x+r.w,y);c.stroke();}
 for(const s of roads){c.fillStyle='#c2c1ac';const x=s.v?s.c-s.w/2:s.a,y=s.v?s.a:s.c-s.w/2,w=s.v?s.w:s.b-s.a,h=s.v?s.b-s.a:s.w;c.fillRect(x-4,y-4,w+8,h+8);}
 for(const s of roads){c.fillStyle=roadInk;c.fillRect(s.v?s.c-s.w/2:s.a,s.v?s.a:s.c-s.w/2,s.v?s.w:s.b-s.a,s.v?s.b-s.a:s.w);}
 // Paint only outside intersecting road envelopes, including the Strip mouth.
 for(const s of roads){
  const from=Math.max(s.a,s.v?r.y:r.x),to=Math.min(s.b,s.v?r.y+r.h:r.x+r.w);
  for(let p=Math.ceil(from/36)*36;p<to;p+=36){
   if(roads.some(o=>o.v!==s.v&&Math.abs(p-o.c)<o.w/2+28))continue;
   const offsets=[0],lanes=s.lanes||1,med=s.med||0;for(let lane=1;lane<lanes;lane++){const d=med/2+(s.w/2-med/2)*lane/lanes;offsets.push(-d,d);}
   for(const offset of offsets){c.fillStyle=offset?'#c6c8bb':'#d1b66f';c.fillRect(s.v?s.c+offset-1:p,s.v?p:s.c+offset-1,s.v?2:18,s.v?18:2);}
  }
 }
 // East gateways have a real north/south ring-road crossing. Mark each
 // approach so the wide joining apron reads as a junction, not empty asphalt.
 if(r.x===3720){const y=r.y===1472?1600:2620,half=y===2620?160:100;
  c.fillStyle='#c6cbbb';
  for(const x of [3722,3956])for(let q=-half+12;q<half-10;q+=18)c.fillRect(x,y+q,20,9);
  for(const yy of [y-half-28,y+half+8])for(let x=3752;x<3928;x+=18)c.fillRect(x,yy,9,20);
  c.strokeStyle='#c6cbbb';c.lineWidth=3;
  for(const [x,side] of [[4002,1],[3740,-1]]){c.beginPath();c.moveTo(x-side*14,y+side*half*.55);c.lineTo(x+side*14,y+side*half*.55);c.lineTo(x+side*6,y+side*half*.55-7);c.moveTo(x+side*14,y+side*half*.55);c.lineTo(x+side*6,y+side*half*.55+7);c.stroke();}
 }

 c.fillStyle='rgba(185,191,181,.13)';for(let i=0;i<r.w*r.h/500;i++)c.fillRect(r.x+i*197%r.w,r.y+i*67%r.h,2,1);
 // Crosswalks stay on the approaches; no planting islands obstruct the lane mouths.
 if(r.y===3792)for(const s of roads.filter(s=>s.v))for(let x=s.c-s.w/2+12;x<s.c+s.w/2-8;x+=18){c.fillStyle='#bfc5bb';c.fillRect(x,4020,9,28);}
}
export function drawStreetGateways(G,view){
 const cache=G.gatewayArt||(G.gatewayArt=[]);
 GATEWAYS.forEach((r,i)=>{if(r.x>view.x1||r.y>view.y1||r.x+r.w<view.x0||r.y+r.h<view.y0)return;
  if(!cache[i]||cache[i].revision!==G.ground.revision){if(cache[i])cache[i].width=1;const c=document.createElement('canvas');c.width=r.w;c.height=r.h;paint(c.getContext('2d'),r,G.world.gatewayRoads,G.ground.asphalt);c.revision=G.ground.revision;cache[i]=c;}
  G.ctx.drawImage(cache[i],r.x,r.y);
 });
}
