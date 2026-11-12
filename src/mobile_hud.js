import {circuitHint} from './motorsport.js';
import {dropReady} from './airdrop.js';
import { WEAPONS, CONTRACTS } from './action.js';
const font=(s,w=700)=>`${w} ${Math.round(s)}px system-ui, sans-serif`;
const wrapped=new Map();
function wrap(c,text,width,max=4){const key=c.font+'|'+width+'|'+max+'|'+text,cached=wrapped.get(key);if(cached)return cached;const rows=[];let line='';for(const word of String(text||'').split(' ')){const n=line?line+' '+word:word;if(line&&c.measureText(n).width>width){rows.push(line);line=word;}else line=n;}if(line)rows.push(line);const result=rows.slice(0,max);if(wrapped.size>=24)wrapped.delete(wrapped.keys().next().value);wrapped.set(key,result);return result;}
export function drawMobileHUD(G,{minimap,gps,objective,screen,missionTitle,banner}){
 const c=G.ctx,W=G.canvas.width,H=G.canvas.height,d=G.dpr,portrait=H>W,sf=G.safe||{t:0,l:0,r:0,b:0};
 const L=12*d+sf.l,T=12*d+sf.t,R=W-64*d-sf.r,A=G.action,mm=(portrait?94:84)*d;
 c.setTransform(1,0,0,1,0,0);gps(G);minimap(G,L,T,mm,G.player.type==='veh'?2000:1300);
 const panel=(x,y,w,h,accent)=>{c.fillStyle='rgba(10,23,29,.87)';c.beginPath();c.roundRect(x,y,w,h,6*d);c.fill();if(accent){c.fillStyle=accent;c.fillRect(x,y+6*d,2*d,h-12*d);}};
 const text=(s,x,y,size,color='#ece5d4',weight=700)=>{c.textAlign='left';c.font=font(size*d,weight);c.fillStyle=color;c.fillText(s,x,y);};
 // Health and stamina sit under the map; weapon information no longer stacks tall cards.
 panel(L,T+mm+5*d,mm,37*d);
 c.fillStyle='#314249';c.fillRect(L+7*d,T+mm+13*d,mm-14*d,4*d);c.fillStyle=G.health<30?'#e99580':'#b1d2ac';c.fillRect(L+7*d,T+mm+13*d,(mm-14*d)*G.health/100,4*d);
 c.fillStyle='#314249';c.fillRect(L+7*d,T+mm+21*d,mm-14*d,2*d);c.fillStyle=A.exhausted?'#e99580':'#9fc8c2';c.fillRect(L+7*d,T+mm+21*d,(mm-14*d)*A.stamina/100,2*d);
 text(A.reloadT>0?'RELOADING':WEAPONS[A.weapon].name+' / '+A.ammo[A.weapon],L+7*d,T+mm+34*d,8);
 const cashW=Math.min(150*d,R-(L+mm+10*d));
 panel(R-cashW,T,cashW,44*d);text(Math.round(G.chips).toLocaleString('en-US')+'  CHIPS',R-cashW+9*d,T+17*d,12,'#e5c486',800);
 text('★'.repeat(G.wanted)+'☆'.repeat(5-G.wanted),R-cashW+9*d,T+34*d,13,G.evading?'#a2dfd6':'#ddba7c');
 const mx=portrait?L+mm+10*d:Math.max(L+mm+18*d,W*.28),mw=portrait?R-mx:Math.min(W*.42,340*d),my=portrait?T+52*d:T;
 const hint=circuitHint(G)||G.expansionHint||G.hint||'Explore Crown City. The crew always has work.';
 c.font=font(8*d,700);const flight=G.player.def?.aircraft?wrap(c,`${G.player.flightState||'PARKED'} / ALT ${Math.round(G.player.altitude||0)}${dropReady(G)?' / DROP: 45–220 ALT':''}`,mw-20*d,2):[];
 c.font=font(11*d,650);const rows=wrap(c,hint.replace(/\(E\)/g,'').replace(/press E/gi,'tap TAKE'),mw-20*d,5);
 panel(mx,my,mw,(26+rows.length*15+flight.length*12)*d,'#ddba7c');text(missionTitle||'AFTER HOURS',mx+10*d,my+15*d,8,'#ddba7c',800);
 rows.forEach((line,i)=>text(line,mx+10*d,my+(31+i*15)*d,11));
 flight.forEach((line,i)=>text(line,mx+10*d,my+(31+rows.length*15+i*12)*d,8,G.player.stall?'#ffb093':'#9ed5cf'));
 const objectiveAt=G.waypoint||objective(G);
 let yy=my+(34+rows.length*15+flight.length*12)*d;
 if(objectiveAt){const distance=Math.round(Math.hypot(objectiveAt.x-G.player.x,objectiveAt.y-G.player.y)/10);text(distance+(G.waypoint?' m TO BLUE ROUTE':' m TO OBJECTIVE'),mx+8*d,yy,9,'#b2c9bc');yy+=17*d;}
 if(G.wanted){text(G.evading?'SEARCHING / STAY OUT OF SIGHT':'SPOTTED / BREAK LINE OF SIGHT',mx+8*d,yy,8,G.evading?'#a2dfd6':'#f2a38c');yy+=16*d;}
 if(G.missionState.holdT){text('HOLD STILL / '+Math.round(G.missionState.holdT*10)/10+'s',mx+8*d,yy,9,'#9bddd4');yy+=17*d;}
 if(G.race){text(G.race.countdown>0?'READY / '+Math.ceil(G.race.countdown):'GATE '+Math.min(G.race.i+1,G.race.pts.length)+' / '+G.race.pts.length+' · '+G.race.t.toFixed(1)+'s',mx+8*d,yy,11,'#d2dfc1');yy+=19*d;}
 if(A.contract){const job=CONTRACTS.find(j=>j.id===A.contract.id);text(job.title+' / '+Math.ceil(A.contract.t)+'s',mx+8*d,yy,8,'#9ed5cf');}
 // Put the current radio message in the space above thumbs, never under the action buttons.
 const message=G.contactTalk&&G.contactNear?null:G.toastT>0?{name:'CROWN CITY',text:G.toast}:A.messageT>0?A.message:null;
 if(message){
  const ww=portrait?W-32*d:Math.min(330*d,W*.42),xx=(W-ww)/2;
  c.font=font(11*d,600);const rows=wrap(c,message.text,ww-24*d,portrait?5:4),hh=(29+rows.length*15)*d;
  const y=portrait?H-sf.b-215*d-hh:H-sf.b-48*d-hh;
  panel(xx,y,ww,hh,'#9cc9bd');text(message.name,xx+12*d,y+15*d,8,'#9cc9bd',800);
  rows.forEach((s,i)=>text(s,xx+12*d,y+(31+i*15)*d,11));
 }
 if(G.player.type==='veh'){
  const nautical=G.player.def.boat||G.player.def.aircraft,speed=Math.round(Math.hypot(G.player.vx,G.player.vy)*(nautical?.1944:.36)),y=portrait?H-230*d:H-18*d;
  c.textAlign='center';c.font=font(14*d,800);c.fillStyle='#f1ddae';c.fillText(speed+(nautical?' KTS':' KM/H'),W/2,y);if(G.player.def.boat){c.font=font(8*d,700);c.fillStyle='#a4d1cc';c.fillText((G.player.fwd||0)<-5?'ASTERN':speed<7?'DOCKING SPEED':'UNDER WAY',W/2,y-18*d);}
 }
 if(objectiveAt){const p=screen(G,objectiveAt.x,objectiveAt.y);if(p.x<20*d||p.x>W-20*d||p.y<20*d||p.y>H-20*d){
  const a=Math.atan2(p.x-W/2,-(p.y-H/2)),cy=portrait?H*.48:H*.5,rx=W*.35,ry=portrait?H*.15:H*.16;
  c.save();c.translate(W/2+Math.sin(a)*rx,cy-Math.cos(a)*ry);c.rotate(a);c.fillStyle='#efd19a';c.strokeStyle='#0b1821';c.lineWidth=2*d;c.beginPath();c.moveTo(0,-11*d);c.lineTo(8*d,7*d);c.lineTo(0,3*d);c.lineTo(-8*d,7*d);c.closePath();c.stroke();c.fill();c.restore();
 }}
 if(G.banner)banner(G,W,H);
 if(G.settings.showFps)text(Math.round(G.presentFps||G.fps)+' FPS',L,H-12*d,9,'#b5d1b8');
}
