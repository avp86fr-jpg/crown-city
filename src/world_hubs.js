/* Authored core blocks: visible paving, collision and spawn anchors share geometry. */
export const CITY_HUBS=Object.freeze({
 garage:{id:'garage',x:576,y:3024,w:304,h:496,building:{x:608,y:3040,w:256,h:144},car:[768,3344,Math.PI/2],spawn:[704,3264],name:'HUNTER GARAGE'},
 police:{id:'police',x:2256,y:3536,w:288,h:256,building:{x:2272,y:3552,w:256,h:112},release:[2400,3736],name:'METRO POLICE'}
});
export function inCityHub(x,y,margin=0){return Object.values(CITY_HUBS).some(h=>x>=h.x-margin&&x<h.x+h.w+margin&&y>=h.y-margin&&y<h.y+h.h+margin);}
export function applyCityHubs(W,meta,CODE){
 W.hubs=CITY_HUBS;
 for(const h of Object.values(CITY_HUBS)){
  W.fill(h.x,h.y,h.w,h.h,CODE.walk);
  if(h.id==='garage')W.fill(592,3200,288,320,CODE.lot);
  const b=h.building;W.fill(b.x,b.y,b.w,b.h,CODE.build);
 }
 const overlaps=b=>Object.values(CITY_HUBS).some(h=>b.x<h.x+h.w&&b.x+b.w>h.x&&b.y<h.y+h.h&&b.y+b.h>h.y);
 // The old illustrated roof layer is covered below; avoid drawing its displaced
 // roofs and shop furniture over a new driveway or the police entrance.
 W.coreBuildings=W.coreBuildings.filter(b=>!overlaps(b));
 meta.buildings=meta.buildings.filter(b=>!overlaps(b));
 meta.props=meta.props.filter(p=>!inCityHub(p.x,p.y,28));
 meta.parking=meta.parking.filter(p=>!inCityHub(p.x,p.y,60));
 meta.gathers=(meta.gathers||[]).filter(p=>!inCityHub(p.x,p.y,40));
 W.trees=W.trees.filter(p=>!inCityHub(p.x,p.y,35));
}
function paint(c,h){
 c.translate(-h.x,-h.y);c.fillStyle='#80847b';c.fillRect(h.x,h.y,h.w,h.h);
 c.strokeStyle='#6c7069';c.lineWidth=1;
 for(let x=h.x;x<h.x+h.w;x+=16){c.beginPath();c.moveTo(x,h.y);c.lineTo(x,h.y+h.h);c.stroke();}
 for(let y=h.y;y<h.y+h.h;y+=16){c.beginPath();c.moveTo(h.x,y);c.lineTo(h.x+h.w,y);c.stroke();}
 const b=h.building,police=h.id==='police';
 if(!police){
  c.fillStyle='#383f40';c.fillRect(592,3200,288,320);
  // Quiet aggregate texture, baked once, rather than frame-time particles.
  c.fillStyle='#525957';for(let i=0;i<600;i++)c.fillRect(596+(i*73%276),3204+(i*47%308),1,1);
  c.strokeStyle='#c7b575';c.lineWidth=2;
  for(const y of [3296,3408]){c.strokeRect(704,y,128,88);c.fillStyle='#283334';c.fillRect(702,y+2,3,84);}
  c.fillStyle='#bfa46a';c.font='bold 12px sans-serif';c.textAlign='center';c.fillText('RIOT / RESERVED',768,3312);
  c.strokeStyle='#d3c69c';c.beginPath();c.moveTo(836,3344);c.lineTo(873,3344);c.lineTo(862,3336);c.moveTo(873,3344);c.lineTo(862,3352);c.stroke();
  c.fillStyle='#bcae8a';c.fillRect(592,3200,288,8);c.fillStyle='#a0a18d';c.fillRect(592,3210,112,70);
 }else{
  c.fillStyle='#4b5a61';for(const x of [2288,2448])c.fillRect(x,3672,64,112);
  c.strokeStyle='#bccbd2';c.lineWidth=2;for(const x of [2288,2448])c.strokeRect(x,3672,64,112);
  c.fillStyle='#ebdfb1';c.font='bold 10px sans-serif';c.textAlign='center';c.fillText('PUBLIC ENTRANCE',2400,3776);
 }
 // Flat, readable roof architecture aligned exactly to the solid footprint.
 c.fillStyle='#202c30';c.fillRect(b.x,b.y,b.w,b.h);c.fillStyle=police?'#526c7b':'#626c69';c.fillRect(b.x+5,b.y+5,b.w-10,b.h-18);
 c.strokeStyle=police?'#78909b':'#7e8580';c.lineWidth=2;
 for(let y=b.y+14;y<b.y+b.h-18;y+=12){c.beginPath();c.moveTo(b.x+8,y);c.lineTo(b.x+b.w-8,y);c.stroke();}
 c.fillStyle=police?'#183b54':'#252f2f';c.fillRect(b.x+8,b.y+b.h-34,b.w-16,30);
 c.fillStyle=police?'#d2ebed':'#eed59d';c.textAlign='center';c.font='bold 18px sans-serif';c.fillText(h.name,b.x+b.w/2,b.y+b.h-12);
 c.fillStyle='#1c2b2e';c.fillRect(b.x+b.w/2-24,b.y+b.h,48,7);
 c.fillStyle='#a5cfce';c.fillRect(b.x+b.w/2-20,b.y+b.h+1,18,3);c.fillRect(b.x+b.w/2+2,b.y+b.h+1,18,3);
 for(const x of [b.x+24,b.x+b.w-56]){c.fillStyle='#2e3d40';c.fillRect(x,b.y+22,32,28);c.fillStyle='#83918b';c.fillRect(x+3,b.y+25,26,22);c.strokeStyle='#445256';c.beginPath();c.arc(x+16,b.y+36,9,0,Math.PI*2);c.stroke();}
}
export function drawCityHubs(G,r){
 const cache=G.hubArt||(G.hubArt=new Map());
 for(const h of Object.values(CITY_HUBS)){
  if(h.x>r.x1||h.x+h.w<r.x0||h.y>r.y1||h.y+h.h<r.y0)continue;
  let art=cache.get(h.id);if(!art){art=document.createElement('canvas');art.width=h.w;art.height=h.h;paint(art.getContext('2d'),h);cache.set(h.id,art);}
  G.ctx.drawImage(art,h.x,h.y);
 }
}
