import {drawCasinoEvidence} from './casino_details.js';
import {initSlots,slotsSave,nearSlots,tickSlots,finishSlots,drawSlots,drawSlotsWorld} from './slots.js';
/* MetaWin's playable terrace table. All stakes are Crown City game chips.
   The wager, shuffled deck and settlement travel in the same game snapshot. */
import {message} from './action.js';
export const CASINO_TABLE=Object.freeze({id:'terrace-blackjack',x:8435,y:3055,entryX:8395,entryY:3104,radius:64,name:'METAWIN BLACKJACK'});
export const CASINO_STAKES=Object.freeze([20,50,100]);
const phases=new Set(['player','dealer','result']);
const rank=card=>card%13+1;
const clamp=(n,min,max)=>Math.min(max,Math.max(min,n));
export function handValue(cards){
 let total=0,aces=0;for(const card of cards){const r=rank(card);total+=r===1?11:Math.min(10,r);if(r===1)aces++;}
 while(total>21&&aces){total-=10;aces--;}
 return {total,soft:aces>0,blackjack:cards.length===2&&total===21,bust:total>21};
}
export function shuffledDeck(random=Math.random){
 const deck=Array.from({length:52},(_,i)=>i);
 for(let i=51;i>0;i--){const j=Math.floor(clamp(random(),0,.999999999999)*(i+1));[deck[i],deck[j]]=[deck[j],deck[i]];}
 return deck;
}
function copyRound(r){return r?{...r,deck:[...r.deck],player:[...r.player],dealer:[...r.dealer]}:null;}
function validRound(r){
 if(!r||!phases.has(r.phase)||!CASINO_STAKES.includes(r.base)||typeof r.doubled!=='boolean'||r.wager!==r.base*(r.doubled?2:1))return false;
 if(!Array.isArray(r.deck)||r.deck.length!==52||new Set(r.deck).size!==52||r.deck.some(n=>!Number.isInteger(n)||n<0||n>51))return false;
 if(!Array.isArray(r.player)||!Array.isArray(r.dealer)||r.player.length<2||r.dealer.length<2||!Number.isInteger(r.cursor)||r.cursor!==r.player.length+r.dealer.length)return false;
 const dealt=[...r.player,...r.dealer];if(new Set(dealt).size!==dealt.length||dealt.some(n=>!r.deck.slice(0,r.cursor).includes(n)))return false;
 if(r.phase==='player'&&(handValue(r.player).total>=21||r.doubled||r.dealer.length!==2))return false;
 if(r.phase==='result'){
  const returned=r.outcome==='blackjack'?r.wager*2.5:r.outcome==='win'?r.wager*2:r.outcome==='push'?r.wager:0;
  if(!['blackjack','win','lose','push'].includes(r.outcome)||r.returned!==returned||r.net!==returned-r.wager)return false;
 }
 return true;
}
export function initCasino(G,saved={}){
 initSlots(G,saved?.slots);
 G.casino={stake:CASINO_STAKES.includes(saved?.stake)?saved.stake:20,round:validRound(saved?.round)?copyRound(saved.round):null,
  played:clamp(Math.floor(Number(saved?.played)||0),0,1e9),won:clamp(Math.floor(Number(saved?.won)||0),0,1e9),net:clamp(Math.floor(Number(saved?.net)||0),-1e9,1e9),near:null,delay:0,anim:0};
}
export function casinoSave(G){
 const s=G.casino;if(!s)return null;return {v:1,slots:slotsSave(G),stake:s.stake,played:s.played,won:s.won,net:s.net,round:copyRound(s.round)};
}
export function nearCasino(G){
 const p=G.player,t=CASINO_TABLE;return p?.type==='foot'&&!G.jack&&Math.hypot(p.x-t.entryX,p.y-t.entryY)<t.radius?t:nearSlots(G);
}
export function interactCasino(G){
 if(!nearCasino(G))return false;if(!G.casino)initCasino(G);
 if(G.wanted>0){message(G,'METAWIN','Security is watching the terrace. Lose your wanted level first.','#dfc496');return true;}
 G.casino.mode=nearSlots(G)?'slots':'blackjack';G.scene='casino';G.menuSel=0;sound(G,'open');G.casino.delay=.25;G.casino.anim=0;
 if(G.input){G.input.fire=G.input.fireP=G.input.enterP=false;}
 if(G.player){G.player.vx=0;G.player.vy=0;}
 return true;
}
function persist(G,H){H?.save?.(G);}
function sound(G,type){G.audio?.casino?.(type);}
function take(r,hand){const card=r.deck[r.cursor++];hand.push(card);return card;}
function settle(G,outcome){
 const s=G.casino,r=s.round;if(!r||r.phase==='result')return false;
 const returned=outcome==='blackjack'?r.wager*2.5:outcome==='win'?r.wager*2:outcome==='push'?r.wager:0;
 // Transition before crediting; callbacks and repeated clicks cannot settle twice.
 r.phase='result';r.outcome=outcome;r.returned=returned;r.net=returned-r.wager;
 G.chips+=returned;s.played++;if(r.net>0)s.won++;s.net+=r.net;s.delay=.35;s.anim=0;
 sound(G,outcome==='blackjack'||outcome==='win'?'win':outcome);return true;
}
function finishDealer(G){
 const r=G.casino.round,p=handValue(r.player),d=handValue(r.dealer);
 settle(G,p.bust?'lose':d.bust||p.total>d.total?'win':p.total===d.total?'push':'lose');
}
export function dealCasino(G,H={},random=Math.random){
 const s=G.casino;if(!s||s.mode==='slots'||!CASINO_STAKES.includes(s.stake)||G.scene!=='casino'||s.round&&s.round.phase!=='result'||s.delay>0||!Number.isFinite(G.chips)||G.chips<s.stake)return false;
 G.chips-=s.stake;const r=s.round={phase:'player',base:s.stake,wager:s.stake,doubled:false,deck:shuffledDeck(random),cursor:0,player:[],dealer:[],outcome:null,returned:0,net:0};
 take(r,r.player);take(r,r.dealer);take(r,r.player);take(r,r.dealer);s.delay=.3;s.anim=0;sound(G,'card');
 const p=handValue(r.player),d=handValue(r.dealer);
 if(p.blackjack||d.blackjack)settle(G,p.blackjack&&d.blackjack?'push':p.blackjack?'blackjack':'lose');
 persist(G,H);return true;
}
export function casinoAction(G,action,H={}){
 const s=G.casino,r=s?.round;if(s?.mode==='slots'||G.scene!=='casino'||r?.phase!=='player'||s.delay>0||!Number.isFinite(G.chips)||G.chips<0)return false;
 if(action==='double'&&(r.player.length!==2||G.chips<r.base))return false;
 if(!['hit','stand','double'].includes(action))return false;
 if(action==='double'){G.chips-=r.base;r.wager+=r.base;r.doubled=true;sound(G,'chips');}
 if(action!=='stand'){take(r,r.player);sound(G,'card');}
 s.delay=.3;s.anim=0;const p=handValue(r.player);
 if(p.bust)settle(G,'lose');else if(action!=='hit'||p.total===21){r.phase='dealer';s.delay=.55;}
 persist(G,H);return true;
}
export function tickCasino(G,dt,H={}){
 if(!G.casino)initCasino(G);tickSlots(G,dt,H);const s=G.casino;s.near=nearCasino(G);
 if(s.mode==='slots')return;
 if(G.scene!=='casino')return;dt=clamp(Number(dt)||0,0,.25);s.delay=Math.max(0,s.delay-dt);s.anim+=dt;
 const r=s.round;if(r?.phase!=='dealer'||s.delay>0)return;
 if(handValue(r.dealer).total<17){take(r,r.dealer);sound(G,'card');s.delay=G.settings?.reducedMotion ? .15 : .6;s.anim=0;}
 else finishDealer(G);
 persist(G,H);
}
export function leaveCasino(G,H={}){
 finishSlots(G,H);
 const r=G.casino?.round;
 // Leaving means standing; there is no refundable peek at the opening cards.
 if(r&&r.phase!=='result'){
  while(!handValue(r.player).bust&&handValue(r.dealer).total<17)take(r,r.dealer);
  finishDealer(G);
 }
 G.scene='play';G.frozenWorld=null;G.menuSel=0;if(G.input)G.input.enterP=G.input.fire=G.input.fireP=false;persist(G,H);
}
const suits=['♠','♥','♣','♦'];
function cardLabel(n){const r=rank(n);return (r===1?'A':r===11?'J':r===12?'Q':r===13?'K':String(r))+suits[Math.floor(n/13)];}
function text(c,s,x,y,size,color='#eee4cd',align='center',max){c.font=`700 ${size}px system-ui`;c.fillStyle=color;c.textAlign=align;c.fillText(s,x,y,max);}
function rounded(c,x,y,w,h,r,fill,stroke){c.beginPath();c.roundRect(x,y,w,h,r);c.fillStyle=fill;c.fill();if(stroke){c.strokeStyle=stroke;c.lineWidth=1;c.stroke();}}
function drawCard(c,n,x,y,w,h,hidden,u){
 rounded(c,x+2*u,y+4*u,w,h,6*u,'rgba(0,0,0,.22)');rounded(c,x,y,w,h,6*u,hidden?'#284b4e':'#efe7d5',hidden?'#d1b373':'#fff5d9');
 if(hidden){c.strokeStyle='#b79f65';c.lineWidth=u;c.strokeRect(x+5*u,y+5*u,w-10*u,h-10*u);text(c,'M',x+w/2,y+h*.63,w*.45,'#dbbf7d');return;}
 const color=[1,3].includes(Math.floor(n/13))?'#ad4e46':'#243a3b',label=cardLabel(n);
 text(c,label,x+6*u,y+15*u,13*u,color,'left');text(c,suits[Math.floor(n/13)],x+w/2,y+h*.71,25*u,color);
}
function hand(c,cards,cx,y,maxW,hidden,u,motion){
 const w=48*u,h=67*u,step=Math.min(57*u,(maxW-w)/Math.max(1,cards.length-1)),left=cx-(w+step*(cards.length-1))/2;
 cards.forEach((card,i)=>drawCard(c,card,left+i*step,y+(i===cards.length-1?motion:0),w,h,hidden&&i===1,u));
}
function valueLabel(cards){const v=handValue(cards);return v.blackjack?'BLACKJACK':v.bust?`BUST · ${v.total}`:`${v.total}${v.soft?' · SOFT':''}`;}
export function drawCasino(G,{button,save}={}){
 if(G.scene!=='casino')return;if(G.casino.mode==='slots'){drawSlots(G,{button,save});return;}const c=G.ctx,W=G.canvas.width,H=G.canvas.height,d=G.dpr||1,s=G.casino,r=s.round;
 // Layout units fit both narrow phones and landscape browser chrome; safe insets
 // are included before fitting, so buttons stay above the gesture/home bar.
 const safe=G.safe||{},areaW=W-(safe.l||0)-(safe.r||0),areaH=H-(safe.t||0)-(safe.b||0),portrait=areaH>areaW;
 const u=Math.min(d,areaW/(portrait?350:680),areaH/(portrait?620:380)),pw=Math.min(areaW-16*u,(portrait?480:860)*u),ph=Math.min(areaH-16*u,(portrait?650:500)*u),x=(safe.l||0)+(areaW-pw)/2,y=(safe.t||0)+(areaH-ph)/2;
 c.save();c.setTransform(1,0,0,1,0,0);c.fillStyle='rgba(4,16,19,.96)';c.fillRect(0,0,W,H);
 rounded(c,x,y,pw,ph,16*u,'#142f30','#8d8057');
 text(c,'METAWIN / TERRACE',x+20*u,y+28*u,10*u,'#b9c3ad','left');text(c,'BLACKJACK',x+20*u,y+54*u,23*u,'#ebd09b','left');
 text(c,`${Math.floor(G.chips).toLocaleString()} CHIPS`,x+pw-20*u,y+31*u,14*u,'#ebd09b','right');text(c,'GAME CURRENCY',x+pw-20*u,y+49*u,8*u,'#b5c9ba','right');
 c.strokeStyle='#46605a';c.beginPath();c.moveTo(x+20*u,y+67*u);c.lineTo(x+pw-20*u,y+67*u);c.stroke();
 const contentTop=y+82*u,footer=y+ph-(portrait?192:110)*u,tableW=portrait?pw-30*u:pw*.57,tableX=x+15*u,center=tableX+tableW/2;
 const tableBottom=portrait?footer-8*u:y+ph-50*u,tableH=tableBottom-contentTop;
 rounded(c,tableX,contentTop,tableW,tableH,Math.min(60*u,tableW*.2),'#1b4942','#577063');
 c.save();c.beginPath();c.roundRect(tableX+8*u,contentTop+8*u,tableW-16*u,tableH-16*u,Math.min(50*u,tableW*.18));c.strokeStyle='rgba(212,191,127,.3)';c.lineWidth=2*u;c.stroke();
 for(let i=0;i<3;i++){c.fillStyle=['#a35649','#487b83','#b49b5d'][i];c.beginPath();c.ellipse(tableX+20*u,contentTop+(55+i*14)*u,7*u,4*u,0,0,Math.PI*2);c.fill();}c.restore();
 const dealerY=contentTop+33*u,playerY=tableBottom-89*u;
 const motion=G.settings?.reducedMotion?0:Math.max(0,1-s.anim/.22)*-7*u;
 text(c,r?`DEALER${r.phase==='player'?' · '+handValue([r.dealer[0]]).total:' · '+valueLabel(r.dealer)}`:'DEALER STANDS ON 17',center,dealerY-12*u,10*u,'#d7d9bd');
 if(r){hand(c,r.dealer,center,dealerY,tableW-28*u,r.phase==='player',u,r.phase==='dealer'?motion:0);hand(c,r.player,center,playerY,tableW-28*u,false,u,motion);text(c,'YOU · '+valueLabel(r.player),center,playerY+85*u,12*u,'#f1dfb4');}
 else {hand(c,[0,12],center,dealerY,tableW-28*u,false,u,0);text(c,'Take a seat.',center,playerY+21*u,20*u,'#edcf91');text(c,'Choose your stake to begin.',center,playerY+43*u,11*u,'#c4d5bf');}
 const middle=(dealerY+67*u+playerY)/2;
 text(c,r?`${r.wager} CHIPS IN PLAY`:'BLACKJACK PAYS 3 : 2',center,middle+3*u,10*u,'#ddbf7e');
 const bx=portrait?x+16*u:tableX+tableW+20*u,bw=portrait?pw-32*u:pw-tableW-55*u,by=portrait?footer:contentTop+7*u,Hs={save};
 let status=r?.phase==='result'?({blackjack:'BLACKJACK',win:'YOU WIN',lose:'HOUSE WINS',push:'PUSH · STAKE RETURNED'}[r.outcome]):r?.phase==='dealer'?'DEALER’S TURN':r?'YOUR MOVE':'CHOOSE YOUR STAKE';
 const statusColor=r?.phase==='result'&&r.net>0?'#e8c877':r?.phase==='result'&&r.net<0?'#e5aa99':'#d4dbc4';
 text(c,status,bx+bw/2,by+14*u,portrait?12*u:16*u,statusColor);
 let detail=r?.phase==='result'?`${r.net>0?'+':''}${r.net} chips · ${r.returned} returned`:r?.phase==='player'?'Hit for a card. Stand to hold.':r?.phase==='dealer'?'Revealing the house hand…':'Fresh deck · no split or insurance.';
 text(c,detail,bx+bw/2,by+34*u,10*u,'#b8cdbd', 'center',bw);
 const controlsY=by+48*u,bh=38*u,gap=7*u;
 const btn=(xx,yy,ww,label,act,primary=false)=>button?.(G,xx,yy,ww,bh,label,act,{primary,size:11*u});
 if(!r||r.phase==='result'){
  const sw=(bw-gap*2)/3;CASINO_STAKES.forEach((stake,i)=>btn(bx+i*(sw+gap),controlsY,sw,String(stake),()=>{s.stake=stake;sound(G,'chips');persist(G,Hs);},s.stake===stake));
  if(G.chips>=s.stake)btn(bx,controlsY+bh+gap,bw,`DEAL · ${s.stake} CHIPS`,()=>dealCasino(G,Hs),true);
  else text(c,`Need ${s.stake} chips · earn more on crew jobs`,bx+bw/2,controlsY+bh+gap+24*u,10*u,'#e0b6a1','center',bw);
 }else if(r.phase==='player'){
  const sw=(bw-gap*2)/3;btn(bx,controlsY,sw,'HIT',()=>casinoAction(G,'hit',Hs),true);btn(bx+sw+gap,controlsY,sw,'STAND',()=>casinoAction(G,'stand',Hs));
  if(r.player.length===2&&G.chips>=r.base)btn(bx+(sw+gap)*2,controlsY,sw,'DOUBLE',()=>casinoAction(G,'double',Hs));
  else {rounded(c,bx+(sw+gap)*2,controlsY,sw,bh,10*u,'#223d3b');text(c,'DOUBLE',bx+(sw+gap)*2+sw/2,controlsY+24*u,10*u,'#718c7c');}
  text(c,`Double adds ${r.base} chips, takes one card, then stands.`,bx+bw/2,controlsY+bh+23*u,9*u,'#b8cdbd','center',bw);
 }else text(c,'Standing on every 17, including soft 17.',bx+bw/2,controlsY+28*u,10*u,'#b8cdbd','center',bw);
 if(!portrait){text(c,'BLACKJACK 3:2 · WIN 1:1 · TIE RETURNS STAKE',bx+bw/2,controlsY+bh*2+34*u,8*u,'#cbd5ba','center',bw);text(c,'No split or insurance. Aces count as 1 or 11.',bx+bw/2,controlsY+bh*2+52*u,9*u,'#9db6a6','center',bw);}
 const bottom=y+ph-38*u;
 text(c,portrait?'BJ 3:2 · WIN 1:1 · TIE REFUNDS · STAND SOFT 17':'A fresh deck each hand. Chips have no real-money value.',portrait?x+pw/2:x+20*u,portrait?bottom-7*u:bottom+13*u,portrait?8*u:9*u,'#a9bdac',portrait?'center':'left');
 const leaveW=portrait?pw-32*u:Math.min(260*u,bw),leaveX=portrait?x+16*u:bx;
 button?.(G,leaveX,bottom,leaveW,29*u,r&&r.phase!=='result'?'STAND & LEAVE':'LEAVE TABLE',()=>leaveCasino(G,Hs),{size:10*u});
 c.restore();
}
export function drawCasinoWorld(G,r){
 drawSlotsWorld(G,r);drawCasinoEvidence(G,r);
 const t=CASINO_TABLE;if(t.x<r.x0-100||t.x>r.x1+100||t.y<r.y0-100||t.y>r.y1+100)return;
 const c=G.ctx,near=nearCasino(G)===t;c.save();c.strokeStyle=near?'#f1cf85':'#ab9e6d';c.lineWidth=1.5;c.beginPath();c.ellipse(t.entryX,t.entryY,18,8,0,0,Math.PI*2);c.stroke();
 text(c,'BLACKJACK',t.x,t.y-34,9,'#eed49b');text(c,near?(G.touch?'TAP PLAY':'E / PLAY'):'20 / 50 / 100 CHIPS',t.entryX,t.entryY+24,near?10:8,near?'#ffe2a3':'#dbc99c');c.restore();
}
