import {WEAPONS,CONTRACTS,nearService,buyService,startContract,servicePoints} from './action.js';
const font=(s,w=700)=>`${w} ${Math.round(s)}px Inter, system-ui, sans-serif`;
function textLines(c,text,max){const out=[];let line='';for(const word of text.split(' ')){const n=line?line+' '+word:word;if(line&&c.measureText(n).width>max){out.push(line);line=word;}else line=n;}if(line)out.push(line);return out;}
export function drawActionHUD(G,L,y,width){
 const A=G.action;if(!A)return;const c=G.ctx,u=G.ui,W=G.canvas.width,H=G.canvas.height;
 c.save();c.setTransform(1,0,0,1,0,0);
 const yy=y+(G.radioT>0?78:38)*u;
 c.fillStyle='rgba(8,14,20,.86)';c.fillRect(L,yy,width,49*u);c.fillStyle='#d6b379';c.fillRect(L,yy,2*u,49*u);
 c.font=font(9*u,800);c.textAlign='left';c.fillStyle='#d8d1c2';c.fillText(WEAPONS[A.weapon].name,L+9*u,yy+14*u,width-18*u);
 c.font=font(16*u,900);c.fillStyle=A.reloadT>0?'#edc67f':'#fff';c.fillText(A.reloadT>0?'RELOADING':String(A.ammo[A.weapon]).padStart(2,'0')+' / '+WEAPONS[A.weapon].mag,L+9*u,yy+33*u,width-18*u);
 c.fillStyle='#28383c';c.fillRect(L+9*u,yy+40*u,width-18*u,3*u);c.fillStyle=A.exhausted?'#d77863':'#91c9ac';c.fillRect(L+9*u,yy+40*u,(width-18*u)*A.stamina/100,3*u);
 if(A.cover&&G.player.type==='foot'){c.font=font(9*u,800);c.fillStyle='#a3e0cf';c.fillText('IN COVER',L+9*u,yy+62*u);}
 if(A.contract){const d=CONTRACTS.find(d=>d.id===A.contract.id);const txt=d.title+' / '+Math.ceil(A.contract.t)+'s'+(d.id==='drift'?' / '+Math.floor(A.contract.progress)+'/1200':'');c.font=font(10*u,800);c.fillStyle='#8de0d7';c.fillText(txt,L,yy+(A.cover?79:63)*u,Math.min(W-L*2,260*u));}
 const service=nearService(G);
 if(service&&!G.race&&!G.input.touchJoy.active){c.font=font(11*u,800);c.textAlign='center';c.fillStyle='#edd3a1';c.fillText(service.name+' / '+(G.touch?'CREW → WORKSHOP':'C WORKSHOP'),W*.5,H-(G.touch?222:82)*u,W-32*u);}
 if(A.message&&A.messageT>0&&G.scene==='play'&&!(G.contactTalk&&G.contactNear)){
  const narrow=W/u<640,ww=Math.min(W-32*u,(narrow?300:430)*u),xx=(W-ww)/2;
  c.font=font(11*u,600);const lines=textLines(c,A.message.text,ww-32*u).slice(0,4);
  const hh=(38+lines.length*15)*u,by=G.touch?H-(narrow?230:225)*G.dpr-hh:H-126*u-hh;
  const fade=Math.min(1,A.messageT*3);c.globalAlpha=fade;c.fillStyle='rgba(10,18,23,.94)';c.fillRect(xx,Math.max(210*u,by),ww,hh);
  const top=Math.max(210*u,by);c.fillStyle=A.message.color;c.fillRect(xx,top,3*u,hh);c.textAlign='left';c.font=font(10*u,900);c.fillText('● '+A.message.name+' / ENCRYPTED',xx+15*u,top+20*u);
  c.fillStyle='#e8e4da';c.font=font(11*u,600);lines.forEach((line,i)=>c.fillText(line,xx+15*u,top+(40+i*15)*u));
 }
 if(A.combo>30){c.globalAlpha=1;c.textAlign='center';c.font=font(19*u,900);c.fillStyle='#ecd18e';c.fillText('DRIFT +'+Math.floor(A.combo),W/2,H*.62);}
 c.restore();
}
export function drawCrew(G,{button,panel,save}){
 const c=G.ctx,W=G.canvas.width,H=G.canvas.height,u=G.ui,A=G.action;
 c.setTransform(1,0,0,1,0,0);c.fillStyle='rgba(5,10,15,.94)';c.fillRect(0,0,W,H);
 const margin=24*u,portrait=H>W,columns=portrait?1:3,gap=12*u;
 const cw=(Math.min(W-2*margin,1100*u)-(columns-1)*gap)/columns;
 const left=(W-(cw*columns+(columns-1)*gap))/2;
 const ch=Math.min(240*u,(H-204*u)/(portrait?3:1)-gap);
 c.textAlign='left';c.font=font(24*u,900);c.fillStyle='#efe4cf';c.fillText('THE CREW',left,38*u);
 c.font=font(10*u,800);c.fillStyle='#91bfb7';c.fillText(`REP ${A.reputation} / ${A.completed} CONTRACTS / ${Math.round(G.chips)} CHIPS`,left,58*u);
 const pages=Math.ceil(CONTRACTS.length/3),page=Math.min(pages-1,G.crewPage||0);
 const jobs=CONTRACTS.slice(page*3,page*3+3);
 jobs.forEach((d,i)=>{
  const x=left+(portrait?0:i*(cw+gap)),y=78*u+(portrait?i*(ch+gap):0);
  const portraitArt=G.assets.sprites['port_'+({NEURAL:'neural',MASK:'mask',FIRE:'fire',HUNTER:'hunter',VERA:'vera','GOLD MAGE':'gold_mage',CHIEF:'chief',ICE:'ice',STEAMPUNK:'steampunk'}[d.contact])];
  panel(c,x,y,cw,ch,8*u,{fill:'rgba(31,42,47,.8)',stroke:'rgba(213,188,143,.25)'});
  if(portraitArt){
    c.save();c.beginPath();c.roundRect(x+1,y+1,cw-2,ch-2,8*u);c.clip();c.globalAlpha=.22;c.drawImage(portraitArt,x+cw*.35,y+ch*.18,cw*.7,cw*.7);c.globalAlpha=1;
    const fade=c.createLinearGradient(x,0,x+cw,0);fade.addColorStop(0,'rgba(15,25,29,.95)');fade.addColorStop(.5,'rgba(15,25,29,.4)');fade.addColorStop(1,'rgba(15,25,29,0)');c.fillStyle=fade;c.fillRect(x,y,cw,ch);c.restore();
  }
  c.textAlign='left';c.fillStyle='#d3b582';c.font=font(9*u,800);c.fillText(d.contact+' / '+d.time+' SEC',x+14*u,y+20*u);
  if(portraitArt){c.save();c.beginPath();c.arc(x+cw-37*u,y+31*u,22*u,0,Math.PI*2);c.clip();c.drawImage(portraitArt,x+cw-59*u,y+9*u,44*u,44*u);c.restore();}
  c.font=font(16*u,900);c.fillStyle='#f2eadb';c.fillText(d.title,x+14*u,y+43*u,cw-84*u);
  c.font=font(11*u,500);c.fillStyle='#bfc5bf';const lines=textLines(c,d.text,cw-28*u).slice(0,Math.max(1,Math.min(4,Math.floor((ch/u-108)/15)+1)));lines.forEach((line,j)=>c.fillText(line,x+14*u,y+(64+j*15)*u));
  const active=A.contract?.id===d.id,label=active?'CANCEL CONTRACT':A.contract?'CONTRACT ACTIVE':(A.completedJobs?.includes(d.id)?'REPLAY / +':'TAKE JOB / +')+d.reward;
  button(G,x+12*u,y+ch-39*u,cw-24*u,29*u,label,()=>{if(active){if(A.contract.id==='circuit')G.circuitSession=null;G.parcel=null;A.contract=null;G.waypoint=null;G.gps=null;}else if(startContract(G,d.id))G.scene='play';save(G);},{primary:!A.contract,size:10*u});
 });
 button(G,left,H-99*u,cw*columns+(columns-1)*gap,30*u,'JOBS '+(page+1)+' / '+pages+'  ·  '+(page<pages-1?'NEXT THREE ›':'‹ FIRST THREE'),()=>{G.crewPage=(page+1)%pages;G.menuSel=0;},{size:10*u});
 const by=H-57*u,bw=Math.min(190*u,(W-margin*2-gap)/2);
 button(G,margin,by,bw,35*u,'WORKSHOP',()=>{G.scene='garage';G.menuSel=0;},{size:11*u});
 button(G,W-margin-bw,by,bw,35*u,'BACK TO CITY',()=>{G.scene='play';},{primary:true,size:11*u});
}
export function drawWorkshop(G,{button,panel,save}){
 const c=G.ctx,W=G.canvas.width,H=G.canvas.height,u=G.ui,A=G.action,service=nearService(G);
 c.setTransform(1,0,0,1,0,0);c.fillStyle='rgba(5,10,15,.93)';c.fillRect(0,0,W,H);
 const ww=Math.min(W-40*u,520*u),xx=(W-ww)/2,hh=Math.min(H-30*u,470*u),yy=(H-hh)/2;
 panel(c,xx,yy,ww,hh,12*u,{fill:'#152027',stroke:'#8b7960'});
 c.textAlign='left';c.fillStyle='#e8d8b8';c.font=font(22*u,900);c.fillText('AFTER HOURS',xx+20*u,yy+36*u);
 c.fillStyle='#97c6bb';c.font=font(11*u,700);c.fillText(service?service.name:'DRIVE TO A MARKED WORKSHOP',xx+20*u,yy+57*u,ww-40*u);
 c.fillStyle='#d5c5a7';c.fillText(Math.round(G.chips)+' CHIPS / STREET TUNE '+A.upgrades+'/3',xx+20*u,yy+78*u);
 const items=[['repair','REPAIR / 120'],['tune','ENGINE + TIRES / 500'],['respray','LOSE HEAT / 250'],['supply','HEALTH + AMMO / 90']];
 const bh=Math.min(44*u,(hh-185*u)/5),gap=8*u;
 items.forEach(([id,label],i)=>button(G,xx+20*u,yy+96*u+i*(bh+gap),ww-40*u,bh,label,()=>{
  if(!nearService(G)){
    const target=[...servicePoints(G)].sort((a,b)=>Math.hypot(a.x-G.player.x,a.y-G.player.y)-Math.hypot(b.x-G.player.x,b.y-G.player.y))[0];
    G.waypoint={x:target.x,y:target.y};G.gps=null;A.message={name:'HUNTER',text:'Nearest workshop marked blue. Drive there and open C / CREW when you arrive.'};G.scene='play';return;
  }
  if(buyService(G,id))save(G);
 },{size:12*u,primary:i===0&&!!service}));
 c.fillStyle='#bdc8c3';c.font=font(10*u,600);const msg=A.message?.text||'Repair, respray and tune cars. Medical supplies also refill magazines.';
 textLines(c,msg,ww-40*u).slice(0,2).forEach((line,i)=>c.fillText(line,xx+20*u,yy+hh-(70-i*13)*u));
 const footer=(ww-48*u)/2;
 button(G,xx+20*u,yy+hh-42*u,footer,29*u,'CREW CONTRACTS',()=>{G.scene='crew';G.menuSel=0;},{size:10*u});
 button(G,xx+28*u+footer,yy+hh-42*u,footer,29*u,'BACK TO CITY',()=>{G.scene='play';},{primary:true,size:10*u});
}
