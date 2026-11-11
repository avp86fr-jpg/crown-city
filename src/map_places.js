export const MAP_PLACES=[
 {id:'casino',name:'METAWIN CASINO',short:'CAS',x:8060,y:3100,color:'#e6c171'},
 {id:'circuit',name:'BUGATTI CIRCUIT',short:'RACE',x:3008,y:7656,color:'#91d5e3'},
 {id:'airport',name:'AIRPORT',short:'AIR',x:9840,y:7780,color:'#afdbc8'}
];
export function drawMapPlaces(G,to,small=false){
 const c=G.ctx,u=small?G.ui:Math.max(G.ui,.9*G.dpr),cache=G.placeArt||(G.placeArt=new Map());
 for(const m of MAP_PLACES){
  if(small&&(Math.abs(m.x-G.player.x)>1100||Math.abs(m.y-G.player.y)>1100))continue;
  const [x,y]=to(m.x,m.y);let art=cache.get(m.id);
  if(!art){art=document.createElement('canvas');art.width=96;art.height=60;const a=art.getContext('2d');a.scale(3,3);a.fillStyle='#101f27';a.strokeStyle=m.color;a.lineWidth=1.5;a.beginPath();a.roundRect(1,1,30,18,4);a.fill();a.stroke();a.fillStyle=m.color;a.textAlign='center';a.font='800 8px system-ui';a.fillText(m.short,16,13);cache.set(m.id,art);}
  c.drawImage(art,x-16*u,y-10*u,32*u,20*u);
 }
}
export function placeButtons(G,button){
 const W=G.canvas.width,H=G.canvas.height,u=G.ui,gap=7*u,w=Math.min(175*u,(W-32*u-gap*2)/3),left=(W-3*w-2*gap)/2;
 MAP_PLACES.forEach((m,i)=>button(G,left+i*(w+gap),H-40*u,w,30*u,m.name,()=>{G.waypoint={x:m.x,y:m.y};G.gps=null;G.scene='play';},{size:9*u}));
}
