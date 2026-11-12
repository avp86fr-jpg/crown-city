import test from 'node:test';
import assert from 'node:assert/strict';
import {CASINO_TABLE,initCasino,casinoSave,nearCasino,interactCasino,dealCasino,casinoAction,tickCasino,leaveCasino,handValue,shuffledDeck,drawCasino} from '../src/casino.js';
function game(chips=400){const G={chips,scene:'casino',player:{type:'foot',x:CASINO_TABLE.entryX,y:CASINO_TABLE.entryY},input:{},audio:{casino:()=>{}},settings:{reducedMotion:true},wanted:0};initCasino(G);return G;}
// Explicit hands let these tests assert rules without depending on a lucky seed.
function round(G,player,dealer,next=[],base=20){const prefix=[...player,...dealer,...next];G.casino.round={phase:'player',base,wager:base,doubled:false,player:[...player],dealer:[...dealer],deck:[...prefix,...Array.from({length:52},(_,i)=>i).filter(i=>!prefix.includes(i))],cursor:player.length+dealer.length,outcome:null,returned:0,net:0};G.chips-=base;G.casino.delay=0;}
function advance(G){for(let i=0;i<100&&G.casino.round.phase!=='result';i++)tickCasino(G,.25);}
function randomForPrefix(prefix){
 const desired=[...prefix,...Array.from({length:52},(_,i)=>i).filter(i=>!prefix.includes(i))],current=Array.from({length:52},(_,i)=>i),values=[];
 for(let i=51;i>0;i--){const j=current.indexOf(desired[i]);values.push((j+.1)/(i+1));[current[i],current[j]]=[current[j],current[i]];}
 return ()=>values.shift();
}
test('aces downgrade only as needed and two-card 21 is natural',()=>{
 assert.deepEqual(handValue([0,13,8]),{total:21,soft:true,blackjack:false,bust:false});
 assert.equal(handValue([0,13,8,9]).total,21);assert.equal(handValue([0,12]).blackjack,true);assert.equal(handValue([9,22,2]).bust,true);
});
test('shuffle keeps precisely one copy of every card',()=>{const d=shuffledDeck(()=>.42);assert.equal(new Set(d).size,52);assert.deepEqual([...d].sort((a,b)=>a-b),Array.from({length:52},(_,i)=>i));});
test('dealing debits exactly once, disallows a second live deal and snapshots independently',()=>{
 const G=game();let saves=0;assert.equal(dealCasino(G,{save:()=>saves++},()=>.42),true);assert.equal(G.chips,380);assert.equal(dealCasino(G),false);assert.equal(saves,1);
 const snap=casinoSave(G);snap.round.deck.reverse();assert.notDeepEqual(snap.round.deck,G.casino.round.deck);
});
test('unaffordable, negative and nonfinite stakes cannot be played',()=>{for(const chips of [0,19,-20,NaN,Infinity]){const G=game(chips);assert.equal(dealCasino(G),false);assert.equal(G.casino.round,null);}});
test('dealer stands on soft 17 and pays a normal win once',()=>{
 const G=game();round(G,[9,7],[0,5]);assert.equal(casinoAction(G,'stand'),true);advance(G);assert.equal(G.casino.round.dealer.length,2);assert.equal(G.casino.round.outcome,'win');assert.equal(G.chips,420);assert.equal(G.casino.played,1);
 advance(G);leaveCasino(G);assert.equal(G.chips,420);assert.equal(G.casino.played,1);
});
test('dealer draws below 17, bust pays, and hit bust loses wager',()=>{
 const G=game();round(G,[9,7],[8,5],[12]);casinoAction(G,'stand');advance(G);assert.equal(G.casino.round.outcome,'win');assert.equal(G.casino.round.dealer.length,3);
 const B=game();round(B,[9,7],[8,5],[12]);casinoAction(B,'hit');assert.equal(B.casino.round.outcome,'lose');assert.equal(B.chips,380);
});
test('tie returns original stake with zero profit',()=>{const G=game();round(G,[9,7],[22,20]);casinoAction(G,'stand');advance(G);assert.equal(G.casino.round.outcome,'push');assert.equal(G.chips,400);assert.equal(G.casino.net,0);});
test('doubling adds one matching wager, exactly one card and automatically stands',()=>{
 const G=game();round(G,[4,5],[8,7],[9]);assert.equal(casinoAction(G,'double'),true);assert.equal(G.chips,360);assert.equal(G.casino.round.player.length,3);assert.equal(G.casino.round.phase,'dealer');assert.equal(casinoAction(G,'hit'),false);advance(G);assert.equal(G.chips,440);
 const poor=game(20);round(poor,[4,5],[8,7],[9]);assert.equal(casinoAction(poor,'double'),false);assert.equal(poor.chips,0);
});
test('double becomes unavailable after a hit',()=>{const G=game();round(G,[1,2],[8,7],[3]);casinoAction(G,'hit');G.casino.delay=0;assert.equal(casinoAction(G,'double'),false);});
test('saving a live round preserves the exact future cards and wager',()=>{
 const G=game();round(G,[9,7],[8,5],[12]);casinoAction(G,'stand');const saved=JSON.parse(JSON.stringify(casinoSave(G))),R=game(G.chips);initCasino(R,saved);advance(G);advance(R);assert.deepEqual(casinoSave(R),casinoSave(G));assert.equal(R.chips,G.chips);
 const settled=casinoSave(R),again=game(R.chips);initCasino(again,settled);advance(again);leaveCasino(again);assert.equal(again.chips,R.chips);assert.equal(again.casino.played,1);
});
test('leaving an unresolved hand stands and persists its single settlement',()=>{const G=game();round(G,[9,7],[8,5],[12]);let saves=0;leaveCasino(G,{save:()=>saves++});assert.equal(G.scene,'play');assert.equal(G.chips,420);assert.equal(saves,1);leaveCasino(G);assert.equal(G.chips,420);});
test('corrupt persisted cards and settlements fail closed without awarding chips',()=>{
 const G=game();round(G,[9,7],[8,5],[12]);for(const bad of [r=>r.deck[0]=r.deck[1],r=>r.cursor=12,r=>r.wager=-20,r=>r.player=[99,98],r=>{r.phase='result';r.outcome='win';r.returned=NaN;}]){const snap=casinoSave(G);bad(snap.round);const R=game(380);initCasino(R,snap);assert.equal(R.casino.round,null);assert.equal(R.chips,380);}
});
test('table interaction requires the actual foot approach and refuses wanted entry',()=>{
 const G=game();G.scene='play';assert.equal(nearCasino(G),CASINO_TABLE);G.player.type='veh';assert.equal(interactCasino(G),false);G.player.type='foot';G.player.x+=200;assert.equal(nearCasino(G),null);G.player.x-=200;G.wanted=1;assert.equal(interactCasino(G),true);assert.equal(G.scene,'play');G.wanted=0;assert.equal(interactCasino(G),true);assert.equal(G.scene,'casino');assert.equal(G.input.fire,false);
});

test('natural blackjack pays 3:2, dealer natural wins, and simultaneous naturals push',()=>{
 for(const [cards,outcome,balance] of [[[0,9,12,7],'blackjack',430],[[9,0,7,12],'lose',380],[[0,13,12,25],'push',400]]){const G=game();assert.equal(dealCasino(G,{},randomForPrefix(cards)),true);assert.equal(G.casino.round.outcome,outcome);assert.equal(G.chips,balance);const R=game(balance);initCasino(R,casinoSave(G));leaveCasino(R);assert.equal(R.chips,balance);}
});

test('portrait and landscape table buttons remain inside safe canvas bounds without overlap',()=>{
 for(const [width,height] of [[320,568],[390,844],[844,390],[568,320],[1280,720]]){
  const G=game();G.canvas={width,height};G.dpr=1;G.safe={t:8,r:8,b:20,l:8};G.ctx=new Proxy({},{get:(o,k)=>o[k]||(()=>{}),set:(o,k,v)=>(o[k]=v,true)});
  for(const live of [false,true]){if(live)round(G,[9,7],[8,5],[12]);const buttons=[],rules=[];G.ctx.fillText=(label,x,y)=>{if(String(label).startsWith('BJ 3:2'))rules.push({x,y});};drawCasino(G,{button:(g,x,y,w,h,label)=>buttons.push({x,y,w,h,label})});
   for(const b of buttons){assert.ok(b.x>=G.safe.l&&b.y>=G.safe.t,b.label);assert.ok(b.x+b.w<=width-G.safe.r&&b.y+b.h<=height-G.safe.b,b.label);}
   for(const rule of rules)for(const b of buttons)assert.ok(rule.y<b.y||rule.y-8>b.y+b.h,`Rules overlap ${b.label}`);
   for(let i=0;i<buttons.length;i++)for(let j=i+1;j<buttons.length;j++){const a=buttons[i],b=buttons[j];assert.ok(a.x+a.w<=b.x||b.x+b.w<=a.x||a.y+a.h<=b.y||b.y+b.h<=a.y,`${width}x${height}: ${a.label} overlaps ${b.label}`);}
  }
 }
});

test('blackjack rejects unsupported stakes and cannot accept actions while the slot interface owns input',()=>{
 for(const stake of [-1,0,1,25,NaN,Infinity]){const G=game();G.casino.stake=stake;assert.equal(dealCasino(G),false);assert.equal(G.chips,400);}
 const G=game();G.casino.mode='slots';assert.equal(dealCasino(G),false);round(G,[9,7],[8,5],[12]);const hand=[...G.casino.round.player],chips=G.chips;assert.equal(casinoAction(G,'hit'),false);assert.deepEqual(G.casino.round.player,hand);assert.equal(G.chips,chips);
});
