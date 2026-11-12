import test from 'node:test';import assert from 'node:assert/strict';
import {initCasino,casinoSave,interactCasino,leaveCasino,tickCasino} from '../src/casino.js';
import {SLOT_MACHINES,slotMultiplier,spinSlots,finishSlots,drawSlots,nearSlots} from '../src/slots.js';
import {harness} from './harness.js';
function game(chips=400){const m=SLOT_MACHINES[0],G={scene:'play',player:{type:'foot',x:m.entryX,y:m.entryY},chips,wanted:0,input:{},settings:{reducedMotion:true}};initCasino(G);interactCasino(G);return G;}
test('slot paytable covers exactly 512 uniform outcomes and returns 92.1875% of wagers on average',()=>{let sum=0;for(let a=0;a<8;a++)for(let b=0;b<8;b++)for(let c=0;c<8;c++)sum+=slotMultiplier([a,b,c]);assert.equal(sum/512,.921875);assert.equal(slotMultiplier([0,0,0]),40);assert.equal(slotMultiplier([1,2,1]),2);assert.equal(slotMultiplier([1,2,3]),0);});
test('spin debits once, saves all reels before reveal and settles exactly once across reload or exit',()=>{
 const G=game();let saves=0;const H={save:()=>saves++};assert.equal(spinSlots(G,H,()=>0),true);assert.equal(spinSlots(G,H),false);assert.equal(G.chips,390);assert.equal(saves,1);
 const saved=casinoSave(G),R=game(G.chips);initCasino(R,saved);assert.deepEqual(R.slots.round.reels,[0,0,0]);leaveCasino(R,H);assert.equal(R.chips,790);finishSlots(R,H);leaveCasino(R,H);assert.equal(R.chips,790);
 const again=game(R.chips);initCasino(again,casinoSave(R));for(let i=0;i<20;i++)tickCasino(again,.25,H);assert.equal(again.chips,790);
});
test('slot stakes reject insufficient or invalid balances and restored corrupt outcomes',()=>{for(const balance of [9,-1,Infinity,NaN])assert.equal(spinSlots(game(balance)),false);const G=game();spinSlots(G,{},()=>0);const save=casinoSave(G);save.slots.round.returned=999999;initCasino(G,save);assert.equal(G.slots.round,null);assert.equal(G.chips,390);});
test('slot controls fit short landscape and portrait screens without overlap',async()=>{
 await harness();
 for(const [width,height] of [[320,568],[390,844],[844,390],[568,320],[1280,720]]){const G=game();G.canvas={width,height};G.dpr=1;G.safe={t:8,b:20,l:8,r:8};G.ctx=new Proxy({},{get:(o,k)=>o[k]||(()=>{}),set:(o,k,v)=>(o[k]=v,true)});const buttons=[];drawSlots(G,{button:(g,x,y,w,h,label)=>buttons.push({x,y,w,h,label})});for(const b of buttons){assert.ok(b.x>=8&&b.y>=8&&b.x+b.w<=width-8&&b.y+b.h<=height-20,b.label);}for(let i=0;i<buttons.length;i++)for(let j=i+1;j<buttons.length;j++){const a=buttons[i],b=buttons[j];assert.ok(a.x+a.w<=b.x||b.x+b.w<=a.x||a.y+a.h<=b.y||b.y+b.h<=a.y);}}
});
test('all three cabinets have solid bodies, safe foot approaches and open-world interactions',async()=>{const {G,T}=await harness();T.startFreeRide(G);for(const m of SLOT_MACHINES){assert.equal(G.surfaceAt(m.x,m.y),'build');assert.ok(T.footClear(G,m.entryX,m.entryY,8));G.player=T.makeFoot(G,m.entryX,m.entryY,0);assert.equal(nearSlots(G),m);assert.equal(interactCasino(G),true);assert.equal(G.casino.mode,'slots');leaveCasino(G);}});
