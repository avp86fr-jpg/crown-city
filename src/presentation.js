import { MISSIONS } from './story.js';
import {challengeProgress} from './mission_director.js';
const ink='#0d1a20', paper='#f0e5cd', gold='#d8b476', mint='#9ac8bb', muted='#a9b9b5';
const font=(size,weight=700)=>`${weight} ${Math.round(size)}px Inter, system-ui, sans-serif`;
function lines(c,text,width){const out=[];let line='';for(const w of String(text||'').split(' ')){const next=line?line+' '+w:w;if(line&&c.measureText(next).width>width){out.push(line);line=w;}else line=next;}if(line)out.push(line);return out;}
function label(c,text,x,y,size,color=paper,weight=700){c.font=font(size,weight);c.fillStyle=color;c.textAlign='left';c.fillText(text,x,y);}
function paragraph(c,text,x,y,width,size,leading,color=muted,max=5){c.font=font(size,500);c.fillStyle=color;c.textAlign='left';const rows=lines(c,text,width).slice(0,max);rows.forEach((l,i)=>c.fillText(l,x,y+i*leading));return rows.length*leading;}
function shade(G,alpha=.9){const {ctx:c,canvas:{width:W,height:H}}=G;c.setTransform(1,0,0,1,0,0);c.fillStyle=`rgba(8,18,24,${alpha})`;c.fillRect(0,0,W,H);}
export function drawTitleScreen(G,{button,startNew,continueGame,freeRide,settings}){
 const c=G.ctx,W=G.canvas.width,H=G.canvas.height,u=G.ui,portrait=H>W,compact=!portrait&&H/u<500;
 c.setTransform(1,0,0,1,0,0);
 const image=G.assets.hero;
 if(image){const scale=Math.max(W/image.width,H/image.height),ww=image.width*scale,hh=image.height*scale;c.drawImage(image,portrait?W-ww:(W-ww)/2,(H-hh)/2,ww,hh);}
 const fade=c.createLinearGradient(0,0,W,0);fade.addColorStop(0,'rgba(5,16,22,.88)');fade.addColorStop(.55,'rgba(5,16,22,.28)');fade.addColorStop(1,'rgba(5,16,22,.03)');c.fillStyle=fade;c.fillRect(0,0,W,H);
 const bottom=c.createLinearGradient(0,H*.48,0,H);bottom.addColorStop(0,'rgba(6,17,23,0)');bottom.addColorStop(.65,'rgba(6,17,23,.92)');bottom.addColorStop(1,'#061117');c.fillStyle=bottom;c.fillRect(0,H*.48,W,H*.52);
 const x=(portrait?24:48)*u+(G.safe?.l||0),top=(compact?30:52)*u+(G.safe?.t||0);
 label(c,'METAWINNERS  /  AFTER HOURS',x,top,10*u,gold,800);
 const big=Math.min((compact?56:74)*u,W*(portrait?.17:.095));
 c.font=`900 ${Math.round(big)}px 'Arial Black', Impact, system-ui`;c.fillStyle=paper;c.fillText('CROWN',x,top+big*1.1);c.fillText('CITY',x,top+big*2.05);
 c.fillStyle=gold;c.fillRect(x,top+big*2.18,52*u,3*u);
 const taglineY=top+big*2.18+25*u;
 label(c,'THE CITY KEEPS RECEIPTS.',x,taglineY,11*u,mint,800);
 if(!compact)paragraph(c,'Six jobs. A stolen identity. A crew with everything to lose.',x,taglineY+23*u,portrait?W-2*x:310*u,12*u,17*u,muted,2);
 const items=[];
 if(G.saveExists)items.push(['CONTINUE',continueGame,true]);
 items.push(['NEW GAME',startNew,!G.saveExists],['FREE RIDE',freeRide,false],['SETTINGS',settings,false]);
 const bw=Math.min(portrait?W-x*2:300*u,350*u),bh=Math.max(44*G.dpr,42*u),gap=8*u;
 let by=H-(G.safe?.b||0)-36*u-items.length*(bh+gap);
 for(const [text,act,primary] of items){button(G,x,by,bw,bh,text,act,{primary,align:'left'});by+=bh+gap;}
 if(!portrait&&!compact){label(c,'01 / SOUTHSIDE',W*.64,H-70*u,10*u,gold,800);label(c,'CHAOS',W*.64,H-43*u,23*u,paper,900);}
 label(c,'Fan-made · Play chips only · Not affiliated with MetaWin',x,H-13*u,8*u,'#9baba7',500);
}

export function drawPauseScreen(G,{button,panel,items}){
 shade(G,.86);const c=G.ctx,W=G.canvas.width,H=G.canvas.height,u=G.ui;
 const columns=H<W?2:1,margin=24*u,gap=9*u,pw=Math.min(W-margin*2,columns===2?740*u:400*u),rows=Math.ceil(items.length/columns);
 const bh=Math.min(49*u,(H-112*u)/rows-gap),ph=88*u+rows*(bh+gap),x=(W-pw)/2,y=(H-ph)/2;
 panel(c,x,y,pw,ph,12*u,{fill:ink,stroke:'#62746d'});
 label(c,'TAKE A BREATH.',x+20*u,y+32*u,22*u,paper,900);
 label(c,G.freeRoam?'CROWN CITY / FREE ROAM':`JOB ${G.missionIndex+1} / ${MISSIONS[G.missionIndex]?.title||'AFTER HOURS'}`,x+20*u,y+54*u,10*u,mint,700);
 const bw=(pw-40*u-gap*(columns-1))/columns;
 items.forEach(([text,act,options],i)=>button(G,x+20*u+(i%columns)*(bw+gap),y+72*u+Math.floor(i/columns)*(bh+gap),bw,bh,text,act,{size:11*u,...options}));
}

export function drawSettingsScreen(G,{button,panel,save,quality,back}){
 shade(G,.95);const c=G.ctx,W=G.canvas.width,H=G.canvas.height,u=G.ui,S=G.settings;
 const change=(key,value)=>{S[key]=value;save(G);G._syncTouch?.();};
 const cycle=(key,values)=>change(key,values[(values.indexOf(S[key])+1)%values.length]);
 const toggle=key=>()=>change(key,!S[key]);
 const vol=(key,method)=>d=>{change(key,Math.max(0,Math.min(1,Math.round((S[key]+d*.1)*10)/10)));G.audio[method](S[key]);};
 const pages=[
  [
   ['GRAPHICS',{low:'PERFORMANCE',med:'BALANCED',high:'QUALITY'}[S.quality],()=>{cycle('quality',['low','med','high']);quality();}],
   ['AUTO RESOLUTION',S.autoRes?'ON':'OFF',toggle('autoRes')],
   ['BATTERY SAVER',S.batterySaver?'30 FPS':'60 FPS',toggle('batterySaver')],
   ['REDUCED MOTION',S.reducedMotion?'ON':'OFF',toggle('reducedMotion')],
   ['FPS COUNTER',S.showFps?'ON':'OFF',toggle('showFps')],
   ['CAMERA',G.cam.northUp?'NORTH UP':'CHASE',()=>{G.cam.northUp=!G.cam.northUp;}]
  ],
  [
   ['MASTER',Math.round(S.master*100)+'%',vol('master','setMaster')],
   ['SOUND EFFECTS',Math.round(S.sfx*100)+'%',vol('sfx','setSfx')],
   ['MUSIC',Math.round(S.mus*100)+'%',vol('mus','setMus')],
   ['RADIO',G.audio.stations[G.audio.station].name,()=>G.audio.nextStation()],
   ['TIME SPEED',['FROZEN','NORMAL','SLOW','SLOWER'][S.timeSpeed],()=>cycle('timeSpeed',[0,1,2,3])],
   ['SET CLOCK',String(Math.floor(G.time)).padStart(2,'0')+':00',d=>{G.time=(G.time+(d||1)*3+24)%24;}]
  ],
  [
   ['THUMB LAYOUT',S.leftHanded?'LEFT HANDED':'RIGHT HANDED',toggle('leftHanded')],
   ['CONTROL SIZE',Math.round(S.controlSize*100)+'%',()=>cycle('controlSize',[.9,1,1.15])],
   ['CONTROL OPACITY',Math.round(S.controlOpacity*100)+'%',()=>cycle('controlOpacity',[.55,.8,1])],
   ['AIM ASSIST',S.aimAssist?'ON':'OFF',toggle('aimAssist')],
   ['VIBRATION',S.haptics?'ON':'OFF',toggle('haptics')],
   ['STREET TIPS',S.showTips?'ON':'OFF',toggle('showTips')]
  ]
 ];
 const tab=Math.min(2,G.settingsTab||0),rows=pages[tab],columns=H<W?2:1,n=Math.ceil(rows.length/columns),gap=8*u;
 const pw=Math.min(W-28*u,columns===2?850*u:470*u),rh=Math.min(59*u,(H-176*u)/n-gap),ph=154*u+n*(rh+gap),x=(W-pw)/2,y=Math.max(8*u,(H-ph)/2);
 panel(c,x,y,pw,ph,12*u,{fill:ink,stroke:'#62746d'});label(c,'MAKE IT YOUR CITY',x+18*u,y+31*u,20*u,paper,900);
 const tw=(pw-36*u-2*gap)/3;
 ['DISPLAY','AUDIO / WORLD','CONTROLS'].forEach((t,i)=>button(G,x+18*u+i*(tw+gap),y+45*u,tw,36*u,t,()=>{G.settingsTab=i;G.menuSel=0;},{primary:i===tab,size:9*u}));
 const bw=(pw-36*u-gap*(columns-1))/columns;
 rows.forEach(([name,value,fn],i)=>{
  const bx=x+18*u+(i%columns)*(bw+gap),by=y+94*u+Math.floor(i/columns)*(rh+gap);
  const adjustment=['MASTER','SOUND EFFECTS','MUSIC','SET CLOCK'].includes(name);
  button(G,bx,by,bw,rh,name,()=>fn(1),{adj:fn,hideLabel:true});
  label(c,name,bx+12*u,by+rh*.38,9*u,muted,800);label(c,value,bx+12*u,by+rh*.76,12*u,mint,800);
  if(adjustment)button(G,bx+bw-88*u,by+3*u,40*u,rh-6*u,'−',()=>fn(-1),{nav:false,size:18*u});
  button(G,bx+bw-44*u,by+3*u,40*u,rh-6*u,adjustment?'+':'›',()=>fn(1),{nav:false,size:18*u});
 });
 button(G,x+18*u,y+ph-45*u,pw-36*u,34*u,'BACK',back,{primary:true,size:11*u});
}

export function drawMissionBrief(G,{button,panel,start,brief}){
 shade(G,.6);const c=G.ctx,W=G.canvas.width,H=G.canvas.height,u=G.ui,portrait=H>W,m=MISSIONS[G.missionIndex];if(!m)return;
 const pw=Math.min(W-40*u,820*u),ph=Math.min(H-40*u,portrait?470*u:330*u),x=(W-pw)/2,y=(H-ph)/2;
 panel(c,x,y,pw,ph,12*u,{fill:'rgba(10,23,29,.96)',stroke:'#bda06c'});
 label(c,`CASE FILE / 0${G.missionIndex+1}`,x+24*u,y+30*u,10*u,gold,800);
 label(c,m.title,x+24*u,y+66*u,Math.min(31*u,pw/15),paper,900);
 const textW=pw-48*u;let yy=y+94*u;
 yy+=paragraph(c,m.blurb,x+24*u,yy,textW,13*u,19*u,muted,3)+16*u;
 label(c,'FIRST MOVE',x+24*u,yy,9*u,gold,800);yy+=22*u;
 yy+=paragraph(c,G.touch?G.hint.replace(/\(E\)/g,'— tap CAR').replace(/press E/gi,'tap TAKE'):G.hint,x+24*u,yy,textW,14*u,20*u,paper,3)+16*u;
 const bonus=brief?.challenge||brief?.bonusLabel||'Bring the crew home. Keep civilians out of the crossfire.';
 if(yy<y+ph-95*u){label(c,'CREW STANDARD / '+(brief?.bonusLabel||''),x+24*u,yy,9*u,mint,800);paragraph(c,bonus,x+24*u,yy+20*u,textW,12*u,18*u,muted,2);}
 button(G,x+24*u,y+ph-65*u,pw-48*u,43*u,'START  ▶',start,{primary:true});
}

export function drawDossier(G,{button,panel}){
 shade(G,.96);const c=G.ctx,W=G.canvas.width,H=G.canvas.height,u=G.ui,portrait=H>W;
 const x=22*u,pw=W-x*2;label(c,'THE PALACE FILES',x,37*u,23*u,paper,900);
 label(c,'THE STORY SO FAR / '+Math.min(G.missionIndex,6)+' OF 6 JOBS',x,59*u,10*u,mint,800);
 const selected=Math.max(0,Math.min(5,G.dossierJob??Math.min(G.missionIndex,5)));
 const side=portrait?pw:Math.min(260*u,pw*.34),gap=12*u,tabH=portrait?40*u:52*u,listColumns=portrait||H/u<500?2:1;
 MISSIONS.forEach((m,i)=>{
  const bx=x+(i%listColumns)*(side+gap)/listColumns,by=82*u+Math.floor(i/listColumns)*(tabH+8*u),bw=(side-gap*(listColumns-1))/listColumns;
  const state=i<G.missionIndex?'✓ ':i===G.missionIndex?'● ':'○ ';
  button(G,bx,by,bw,tabH,state+(i+1)+'. '+m.title,()=>{G.dossierJob=i;G.menuSel=0;},{primary:i===selected,size:9*u,align:'left'});
 });
 const dx=portrait?x:x+side+20*u,dy=portrait?82*u+3*(tabH+8*u)+12*u:82*u,dw=portrait?pw:pw-side-20*u,dh=H-dy-80*u;
 panel(c,dx,dy,dw,dh,10*u,{fill:'#17292e',stroke:'#51655d'});
 let yy=dy+29*u;const m=MISSIONS[selected],locked=selected>G.missionIndex;
 label(c,locked?'FILE SEALED':m.title,dx+18*u,yy,18*u,paper,900);yy+=28*u;
 yy+=paragraph(c,locked?'Finish the current job to uncover the next piece of the Palace archive.':m.blurb,dx+18*u,yy,dw-36*u,12*u,18*u,muted,dh<260*u?2:3)+16*u;
 const history=G.director?.history?.findLast(h=>h.won&&(h.index===selected||h.missionIndex===selected));
 if(selected===G.missionIndex&&G._flow){
  label(c,'CURRENT OBJECTIVE',dx+18*u,yy,9*u,gold,800);yy+=22*u;
  yy+=paragraph(c,G.hint,dx+18*u,yy,dw-36*u,13*u,19*u,paper,dh<260*u?2:3)+14*u;
  if(yy<dy+dh-60*u){label(c,'APPROACH: '+(G.flags.heist==='loud'?'FIRE’S DIVERSION':'MASK’S QUIET ROUTE'),dx+18*u,yy,9*u,mint,800);yy+=20*u;
  paragraph(c,G.flags.stash==='flip'?'A decoy sold. Gold Mage knows the ledger is loose.':'Original ledger protected. Vera needs the unedited archive.',dx+18*u,yy,dw-36*u,11*u,17*u,muted,3);}
  if(dh>330*u){
   let cy=dy+dh-100*u;label(c,'OPTIONAL CREW BONUSES',dx+18*u,cy,9*u,gold,800);
   for(const goal of challengeProgress(G)){cy+=23*u;label(c,(goal.failed?'× ':'○ ')+goal.title+' / +'+goal.reward,dx+18*u,cy,11*u,goal.failed?'#ca9387':mint,700);}
  }
 }else if(history){
  label(c,'JOB COMPLETE / '+(history.grade||'FILE RECOVERED'),dx+18*u,yy,11*u,mint,800);yy+=23*u;
  paragraph(c,history.summary||'The crew has this part of the story. Continue the next job to reveal more.',dx+18*u,yy,dw-36*u,12*u,18*u,muted,4);
 }else if(!locked){label(c,'EVIDENCE RECOVERED',dx+18*u,yy,11*u,mint,800);}
 button(G,x,H-59*u,pw,40*u,'BACK TO CITY',()=>{G.scene='play';G.menuSel=0;},{primary:true,size:11*u});
}
