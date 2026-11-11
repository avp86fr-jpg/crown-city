/* Three physical terrace cabinets; a spin is saved before its reveal begins. */
export const SLOT_MACHINES=Object.freeze([8624,8688,8752].map((x,i)=>Object.freeze({id:'slots-'+i,x,y:3328,entryX:x,entryY:3372,radius:28,name:'METAWIN SLOTS',slots:true})));
export const SLOT_STAKES=Object.freeze([10,25,50]);
export const SLOT_SYMBOLS=Object.freeze(['CROWN','GEM','7','BAR','MOON','STAR','BELL','M']);
const payouts=[40,25,20,15,12,10,8,6];
export function slotMultiplier(reels){return reels[0]===reels[1]&&reels[1]===reels[2]?payouts[reels[0]]:new Set(reels).size===2?2:0;}
export function initSlots(G,saved={}){
 const r=saved?.round,valid=r&&SLOT_STAKES.includes(r.stake)&&Array.isArray(r.reels)&&r.reels.length===3&&r.reels.every(n=>Number.isInteger(n)&&n>=0&&n<8)&&['spinning','result'].includes(r.phase)&&r.returned===slotMultiplier(r.reels)*r.stake;
 G.slots={stake:SLOT_STAKES.includes(saved?.stake)?saved.stake:10,round:valid?{...r,reels:[...r.reels]}:null,elapsed:0,stop:0};
}
export function slotsSave(G){const s=G.slots;return s?{stake:s.stake,round:s.round?{...s.round,reels:[...s.round.reels]}:null}:null;}
export function nearSlots(G){const p=G.player;return p?.type==='foot'&&!G.jack?SLOT_MACHINES.find(m=>Math.hypot(m.entryX-p.x,m.entryY-p.y)<m.radius)||null:null;}
export function spinSlots(G,H={},random=Math.random){
 const s=G.slots;if(G.scene!=='casino'||G.casino?.mode!=='slots'||!s||s.round?.phase==='spinning'||!SLOT_STAKES.includes(s.stake)||!Number.isFinite(G.chips)||G.chips<s.stake)return false;
 const reels=Array.from({length:3},()=>Math.min(7,Math.max(0,Math.floor((Number(random())||0)*8))));
 G.chips-=s.stake;s.round={phase:'spinning',stake:s.stake,reels,returned:s.stake*slotMultiplier(reels)};s.elapsed=0;s.stop=0;
 H.save?.(G);G.audio?.casino?.('chips');return true;
}
export function finishSlots(G,H={}){
 const r=G.slots?.round;if(!r||r.phase!=='spinning')return false;
 r.phase='result';G.chips+=r.returned;H.save?.(G);G.audio?.casino?.(r.returned>r.stake?'win':'lose');return true;
}
export function tickSlots(G,dt,H={}){
 const s=G.slots;if(!s||s.round?.phase!=='spinning')return;
 s.elapsed+=Math.min(.25,Math.max(0,dt));const short=G.settings?.reducedMotion;
 const stop=Math.min(3,Math.max(0,Math.floor((s.elapsed-(short?.05:.65))/(short?.08:.4))+1));
 if(stop>s.stop){s.stop=stop;G.audio?.casino?.('card');}
 if(s.elapsed>=(short?.35:1.9))finishSlots(G,H);
}
function text(c,s,x,y,size,col='#eedcb1'){c.fillStyle=col;c.font=`700 ${size}px system-ui`;c.textAlign='center';c.fillText(s,x,y);}
export function drawSlots(G,H={}){
 const c=G.ctx,W=G.canvas.width,Hh=G.canvas.height,safe=G.safe||{},aw=W-(safe.l||0)-(safe.r||0),ah=Hh-(safe.t||0)-(safe.b||0),portrait=ah>aw;
 const u=Math.min(G.dpr||1,aw/(portrait?350:700),ah/(portrait?580:370)),pw=Math.min(aw-16*u,(portrait?420:860)*u),ph=(portrait?560:350)*u,x=(safe.l||0)+(aw-pw)/2,y=(safe.t||0)+(ah-ph)/2;
 const s=G.slots,r=s.round,cx=x+pw/2; c.save();c.setTransform(1,0,0,1,0,0);c.fillStyle='#091c22';c.fillRect(0,0,W,Hh);
 c.fillStyle='#143039';c.beginPath();c.roundRect(x,y,pw,ph,16*u);c.fill();c.strokeStyle='#ae9158';c.lineWidth=2*u;c.stroke();
 text(c,'METAWIN / GOLDEN CROWN',cx,y+29*u,13*u);text(c,`${Math.floor(G.chips)} CHIPS`,cx,y+53*u,13*u,'#a7d9d1');
 const rx=x+24*u,rw=portrait?pw-48*u:pw*.55,rh=portrait?126*u:134*u,ry=y+74*u,cell=(rw-16*u)/3;
 c.fillStyle='#101c27';c.fillRect(rx,ry,rw,rh);
 for(let i=0;i<3;i++){
  const spinning=r?.phase==='spinning'&&s.stop<=i,motion=spinning&&!G.settings?.reducedMotion,offset=motion?(s.elapsed*370%38)*u:0;
  const symbol=spinning?Math.floor(s.elapsed*17+i*3)%8:(r?.reels[i]??0),xx=rx+8*u+i*cell;
  c.save();c.beginPath();c.rect(xx+3*u,ry+6*u,cell-6*u,rh-12*u);c.clip();
  c.fillStyle='#eee3c8';c.fillRect(xx,ry,cell,rh);
  for(let j=-2;j<=2;j++){const yy=ry+rh/2+6*u+j*38*u+offset; text(c,SLOT_SYMBOLS[(symbol+j+8)%8],xx+cell/2,yy,Math.min(16*u,cell*.17),j===0?'#775422':'#9d9c8e');}
  c.restore();
 }
 c.strokeStyle='#d7ae61';c.lineWidth=2*u;c.strokeRect(rx+4*u,ry+rh/2-18*u,rw-8*u,38*u);
 const bx=portrait?x+20*u:rx+rw+22*u,bw=portrait?pw-40*u:pw-rw-66*u,by=portrait?ry+rh+28*u:ry+4*u;
 const status=r?.phase==='spinning'?'REELS IN MOTION':r?.phase==='result'?(r.returned?`${r.returned} CHIPS RETURNED`:'NO MATCH THIS SPIN'):'CHOOSE YOUR STAKE';
 text(c,status,bx+bw/2,by+4*u,12*u);text(c,r?.phase==='result'?`NET ${r.returned-r.stake>=0?'+':''}${r.returned-r.stake} CHIPS`:'Match any pair or all three.',bx+bw/2,by+25*u,10*u,'#a7c8c4');
 const button=(xx,yy,w,label,fn,primary=false)=>H.button?.(G,xx,yy,w,39*u,label,fn,{primary,size:11*u});
 if(r?.phase!=='spinning'){
  const sw=(bw-12*u)/3;SLOT_STAKES.forEach((stake,i)=>button(bx+i*(sw+6*u),by+40*u,sw,String(stake),()=>{s.stake=stake;H.save?.(G);},s.stake===stake));
  if(G.chips>=s.stake)button(bx,by+87*u,bw,`SPIN · ${s.stake} CHIPS`,()=>spinSlots(G,H),true);
  else text(c,'Earn more chips on crew jobs.',bx+bw/2,by+110*u,10*u,'#d9ac9a');
 }else text(c,'Each reel locks in turn…',bx+bw/2,by+80*u,11*u,'#c9bb9e');
 const py=portrait?by+151*u:y+ph-108*u;
 text(c,'3 MATCH: CROWN 40× · GEM 25× · 7 20× · BAR 15×',cx,py,8*u,'#b9c9be');
 text(c,'MOON 12× · STAR 10× · BELL 8× · M 6× / ANY PAIR 2×',cx,py+16*u,8*u,'#b9c9be');
 text(c,'Multipliers include the stake. Game chips only.',cx,py+34*u,9*u,'#92aba5');
 button(x+20*u,y+ph-56*u,pw-40*u,r?.phase==='spinning'?'FINISH & LEAVE':'LEAVE MACHINES',()=>{finishSlots(G,H);G.scene='play';G.frozenWorld=null;G.menuSel=0;G.input.enterP=G.input.fire=G.input.fireP=false;H.save?.(G);});c.restore();
}
export function drawSlotsWorld(G,r){
 const c=G.ctx,near=nearSlots(G);
 for(const m of SLOT_MACHINES){if(m.x<r.x0-40||m.x>r.x1+40||m.y<r.y0-70||m.y>r.y1+40)continue;
  c.save();c.translate(m.x,m.y);c.fillStyle='#243037';c.fillRect(-16,-16,32,32);c.fillStyle='#94763f';c.fillRect(-15,-30,30,39);c.fillStyle='#172b34';c.fillRect(-12,-26,24,25);
  text(c,'CROWN',0,-19,5);for(let i=-1;i<=1;i++){c.fillStyle='#f0dfab';c.fillRect(i*7-3,-15,6,10);text(c,i?'7':'M',i*7,-8,5,'#7d4a39');}
  c.fillStyle='#61ccb7';c.fillRect(-8,3,8,3);c.fillStyle='#c7b067';c.fillRect(5,3,4,3);c.restore();
  if(near===m){c.save();text(c,G.touch?'TAP PLAY / SLOTS':'E / PLAY SLOTS',m.entryX,m.entryY+24,9);c.restore();}
 }
}
