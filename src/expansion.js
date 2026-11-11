/* Encounterable MetaWinners cast: original portraits, local story and optional contracts. */
import {loadImage} from './assets.js';
import {startContract,message} from './action.js';
import {EXPANSION_STEPS} from './expansion_jobs.js';
import {FRONTIER} from './expansion_world.js';
const INTRO={hunter:'The Palace moved its ledgers to the water. No traffic lights, no cameras under the bridges. I kept a launch for you. North dock to Southside. Make it count.',gold_mage:'Everyone calls the house lucky. Luck does not keep two sets of books. Read my dealers. Then decide which receipt leaves the terrace.',neural:'The city broadcasts what the Palace pays it to hear. I built two relays beyond the cameras. Take a helicopter to Pinewatch and Sierra. Let the people answer.',mask:'The forest does not care whose name is on your file. Fire has a drive at Red Mesa. Bring it by the long road. The handoff happens here.',fire:'Before the Palace, we raced the desert road for fuel money. I hid a drive at the old pumps. Two checkpoints, one friend in the forest. Show me you remember the turns.'};
export const EXTRA_CONTACTS=[
 {id:'chief',name:'CHIEF',x:10150,y:1460,job:'nightline',subtitle:'LAST TRAIN / FIRST WITNESS',portrait:'chief',color:'#c8c58c'},
 {id:'ice',name:'ICE',x:10150,y:9450,job:'coldsignal',subtitle:'A VOICE ABOVE THE VALLEY',portrait:'ice',color:'#95dce5'},
 {id:'steampunk',name:'STEAMPUNK',x:6130,y:3555,job:'clockwork',subtitle:'THE CITY RUNS ON BORROWED TIME',portrait:'steampunk',color:'#d6ab76'},
];
Object.assign(INTRO,{chief:'I used to guard the Palace trains. Then I read the cargo lists. There is a witness waiting at Old Town, and a sealed statement at Airfield East. Use the network. Keep both out of the Palace files.',ice:'They cut the mountain distress channel to hide a convoy. I kept the last transmission. Check the Sierra repeater, then Pinewatch. Neural can prove who ordered the silence.',steampunk:'Every clock in this city agrees, except the one that matters. The station logs place the Palace courier in two places at once. Read Midtown, Canal South, then bring me the original timestamps.'});
export function initExpansion(G,saved={}){
 const known=new Set([...FRONTIER.contacts,...EXTRA_CONTACTS].map(p=>p.id));
 G.expansionState={visited:[...new Set((Array.isArray(saved?.visited)?saved.visited:[]).filter(id=>known.has(id)))],deliveries:Math.max(0,Math.min(10000,Number(saved?.deliveries)||0))};
 G.contacts=[...FRONTIER.contacts,...EXTRA_CONTACTS].map(p=>({...p}));G.contactPortraits=G.contactPortraits||new Map();G.contactLoading=G.contactLoading||new Set();G.contactNear=null;G.contactTalk=null;
 if(!G.contactAtlas&&!G.contactAtlasLoading){G.contactAtlasLoading=true;loadImage('assets/premium/frontier-cast.webp').then(im=>G.contactAtlas=im).catch(()=>{}).finally(()=>G.contactAtlasLoading=false);}
 // Residents are persistent local actors, separate from the streamed street population.
 const residents=[];for(let row=0;row<2;row++)for(let col=0;col<5;col++)residents.push([7820+col*205,3055+row*185+57,col%2?'guest':'m4']);
 residents.push([8110,2990,'valet'],[8320,2990,'worker'],[7650,3220,'prime'],[8750,3370,'guest'],[11155,5020,'worker'],[11205,5025,'m2'],[11525,4910,'m3'],[11530,4980,'worker'],[5520,9700,'cabbie'],[5630,9740,'m1'],[5800,9690,'worker'],[11045,9560,'worker'],[11060,9670,'m2'],[7290,7800,'worker'],[7340,7870,'m3'],[7580,7760,'worker'],[8240,7810,'valet'],[9380,7790,'worker'],[9780,7860,'m2']);
 residents.forEach(([x,y,sprite],id)=>{
  if(G.peds.some(p=>p.frontierResident===id))return;
  const at=G.findSafeAction(x,y);G.peds.push({x:at.x,y:at.y,rot:id*.7,vx:0,vy:0,sprite,speed:0,walk:23+id%12,dist:0,flee:0,r:8,hp:30,dead:false,ambient:false,frontierResident:id,idle:1+id%4,hx:id%2?1:0,hy:id%2?0:1,gather:{x:at.x,y:at.y}});
 });
 for(const d of FRONTIER.docks){if(G.vehicles.some(v=>v.canalDock===d.id&&!v.dead))continue;const boat=G.makeVeh('wake',d.boatX,d.boatY,Math.PI,{keep:true,parked:true,canalDock:d.id});G.vehicles.push(boat);}
}
function portrait(G,p){if(G.contactPortraits.has(p.id)||G.contactLoading.has(p.id))return;G.contactLoading.add(p.id);loadImage(`assets/portraits/${p.id==='gold_mage'?'gold_mage_reference':p.portrait}.jpg`).then(image=>G.contactPortraits.set(p.id,image)).catch(()=>{});}
export function tickExpansion(G,dt){
 const P=G.player;G.contactNear=P.type==='foot'&&!G.jack?(G.contacts||[]).find(p=>Math.hypot(p.x-P.x,p.y-P.y)<60)||null:null;
 if(G.contactTalk){G.contactTalk.t-=dt;if(G.contactTalk.t<=0)G.contactTalk=null;}
 for(const p of G.contacts||[])if(Math.abs(p.x-P.x)<800&&Math.abs(p.y-P.y)<700)portrait(G,p);
 if(G.action?.contract&&EXPANSION_STEPS[G.action.contract.id])G.expansionHint=EXPANSION_STEPS[G.action.contract.id][G.action.contract.stage];else G.expansionHint='';
}
export function interactExpansion(G){
 const P=G.player;if(P.type!=='foot')return false;const contact=(G.contacts||[]).find(p=>Math.hypot(p.x-P.x,p.y-P.y)<60);if(!contact)return false;
 portrait(G,contact);if(G.wanted>0){message(G,contact.name,'You brought Metro. Lose the stars, then we can talk.',contact.color);return true;}
 if(!G.expansionState.visited.includes(contact.id))G.expansionState.visited.push(contact.id);
 const active=G.action.contract;
 const text=active?(active.id===contact.job?EXPANSION_STEPS[active.id][active.stage]:'Finish your current crew job first. I will be here.'):INTRO[contact.id];
 if(active)message(G,contact.name,text,contact.color);else startContract(G,contact.job);
 G.contactTalk={id:contact.id,t:16,text};return true;
}
export function drawExpansionPeople(G,r){
 const c=G.ctx;for(const p of G.contacts||[]){if(p.x<r.x0-100||p.x>r.x1+100||p.y<r.y0-100||p.y>r.y1+100)continue;
  portrait(G,p);c.save();c.translate(p.x,p.y);c.fillStyle='rgba(0,0,0,.35)';c.beginPath();c.ellipse(2,8,18,8,0,0,Math.PI*2);c.fill();
  const atlas=G.contactAtlas,reference=G.contactPortraits.get(p.id);
  if(reference&&(p.id==='gold_mage'||EXTRA_CONTACTS.some(q=>q.id===p.id))){
   // The supplied NFT pixels are the actual face/armor texture. No generated helmet.
   const robe=c.createLinearGradient(-19,0,19,0);robe.addColorStop(0,p.id==='gold_mage'?'#3a2028':'#152a2e');robe.addColorStop(.45,p.id==='gold_mage'?'#84503b':'#42585b');robe.addColorStop(1,'#14272d');c.fillStyle=robe;c.beginPath();c.moveTo(-15,-13);c.quadraticCurveTo(-13,4,-20,20);c.quadraticCurveTo(0,25,19,20);c.quadraticCurveTo(12,4,14,-13);c.fill();c.strokeStyle=p.color;c.lineWidth=.8;c.beginPath();c.moveTo(-12,-7);c.lineTo(-15,19);c.moveTo(11,-7);c.lineTo(15,19);c.moveTo(-2,-4);c.lineTo(-3,20);c.stroke();c.fillStyle='#182629';for(const x of [-10,10]){c.beginPath();c.ellipse(x,24,5,3,0,0,Math.PI*2);c.fill();}
   c.save();c.translate(-21,-49);c.scale(42/1280,42/1280);c.beginPath();
   if(p.id==='gold_mage'){
    // Trace around the original crown, shoulders and staff; retain the cyan M and both horns.
    c.moveTo(58,1280);c.lineTo(59,981);c.lineTo(133,776);c.lineTo(340,636);c.lineTo(403,711);c.lineTo(415,554);c.lineTo(409,290);c.lineTo(493,160);c.lineTo(508,49);c.lineTo(565,119);c.lineTo(671,106);c.lineTo(757,45);c.lineTo(764,170);c.lineTo(855,306);c.lineTo(871,513);c.lineTo(825,693);c.lineTo(902,637);c.lineTo(1001,426);c.lineTo(947,350);c.lineTo(1026,230);c.lineTo(1141,218);c.lineTo(1185,338);c.lineTo(1081,440);c.lineTo(1017,658);c.lineTo(1192,781);c.lineTo(1249,1280);
   }else{c.moveTo(25,1280);c.lineTo(32,785);c.lineTo(300,665);c.lineTo(335,275);c.quadraticCurveTo(640,-100,952,275);c.lineTo(958,653);c.lineTo(1250,805);c.lineTo(1270,1280);}
   c.closePath();c.clip();c.drawImage(reference,0,0,1280,1280);c.restore();
  }else if(atlas&&p.id!=='gold_mage'&&FRONTIER.contacts.some(q=>q.id===p.id)){const index=FRONTIER.contacts.findIndex(q=>q.id===p.id),fw=atlas.width/5,fh=atlas.height,scale=68/(fh*.86),breath=G.settings.reducedMotion?1:1+Math.sin(G.ticks*.025+p.x)*.008;
    c.drawImage(atlas,index*fw,0,fw,fh,-fw*scale/2,-fh*scale*.85,fw*scale,fh*scale*breath);
  }else{c.fillStyle=p.color;c.beginPath();c.ellipse(0,-16,12,25,0,0,Math.PI*2);c.fill();}
  c.fillStyle=p.color;c.beginPath();c.moveTo(0,-72);c.lineTo(4,-67);c.lineTo(0,-62);c.lineTo(-4,-67);c.closePath();c.fill();
  c.font='800 9px system-ui';c.textAlign='center';c.fillStyle=p.color;c.fillText(p.name,0,34);c.fillStyle='#e9e0c8';c.font='700 8px system-ui';if(G.contactNear?.id===p.id)c.fillText(G.touch?'TAP TALK':'E / TALK',0,47);c.restore();
 }
}
function lines(c,text,w,max=3){const rows=[];let line='';for(const word of text.split(' ')){const next=line?line+' '+word:word;if(line&&c.measureText(next).width>w){rows.push(line);line=word;}else line=next;}if(line)rows.push(line);return rows.slice(0,max);}
export function drawExpansionHUD(G){
 if(G.hideHUD||G.scene!=='play')return;const c=G.ctx,d=G.dpr,W=G.canvas.width,H=G.canvas.height,portrait=H>W;
 const contact=G.contactNear;const txt=G.expansionHint;
 if(!contact&&(!txt||G.touch))return;
 c.save();c.setTransform(1,0,0,1,0,0);const width=Math.min(W-32*d,(portrait?330:430)*d),x=(W-width)/2,preferredY=G.touch?(portrait?H*.43:H*.46):H-120*d;
 c.font=`600 ${11*d}px system-ui`;const talk=contact&&G.contactTalk?.id===contact.id?G.contactTalk.text:null,im=contact&&G.contactPortraits.get(contact.id),portraitW=im?68*d:0;
 const rows=lines(c,talk?contact.name+' · '+talk:contact?`${G.touch?'TAP TALK':'E / TALK'} · ${contact.name} — ${contact.subtitle}`:txt,width-24*d-portraitW,talk?10:3),height=Math.max((rows.length*16+18)*d,im?80*d:0),y=Math.max(18*d,Math.min(preferredY,H-height-18*d));
 c.fillStyle='rgba(9,24,28,.96)';c.fillRect(x,y,width,height);c.fillStyle=contact?.color||'#90c8c2';c.fillRect(x,y,3*d,height);if(im){c.drawImage(im,x+12*d,y+10*d,58*d,58*d);c.strokeStyle=contact.color;c.lineWidth=d;c.strokeRect(x+12*d,y+10*d,58*d,58*d);}c.textAlign='left';c.fillStyle='#e6ddc9';rows.forEach((line,i)=>c.fillText(line,x+12*d+portraitW,y+(22+i*16)*d));c.restore();
}
