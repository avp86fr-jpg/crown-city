import {test} from 'node:test';
import assert from 'node:assert/strict';
import {harness} from './harness.js';
import {circleBody,bodyContact,localPoint} from '../src/collision.js';
const {G,T}=await harness();
function reset(){
 T.startFreeRide(G);G.vehicles=[];G.peds=[];G.cops=[];G.wanted=0;
 G.surfaceAt=()=> 'road';G.solidAt=()=>false;G.player=T.makeFoot(G,2108,2400,0);
}
test('dismount chooses an unoccupied door instead of placing Chaos inside the neighbouring car',()=>{
 for(const dead of [false,true]){
  reset();const car=T.makeVeh('riot',2108,2400,0),neighbor=T.makeVeh('fare',2048,2400,0,{dead});G.vehicles=[car,neighbor];
  assert.equal(bodyContact(car,neighbor),null,'the parked cars themselves have adequate separation');
  T.enterVeh(G,car,true);T.exitVeh(G);
  assert.equal(G.player.type,'foot');assert.equal(circleBody(neighbor,G.player.x,G.player.y,8),false);
  assert.equal(circleBody(car,G.player.x,G.player.y,8),false);assert.ok(Math.hypot(G.player.x-car.x,G.player.y-car.y)<110);
 }
});
test('blocked doors fall back beyond the actual rear body at rotated parking angles',()=>{
 for(const rot of [0,.35,Math.PI/2]){
  reset();const car=T.makeVeh('riot',2108,2400,rot);G.vehicles=[car];
  G.surfaceAt=(x,y)=>{const p=localPoint(car,x,y);return Math.abs(Math.abs(p.x)-34)<14&&Math.abs(p.y)<14?'build':'road';};
  T.enterVeh(G,car,true);T.exitVeh(G);
  assert.equal(G.player.type,'foot');assert.ok(T.footClear(G,G.player.x,G.player.y,8));
  assert.equal(circleBody(car,G.player.x,G.player.y,8),false,`rear exit overlaps the car at rotation ${rot}`);
  assert.ok(Math.hypot(G.player.x-car.x,G.player.y-car.y)<125,'exiting should remain local to the parked car');
 }
});
test('restoring a police-car save preserves escaped heat and the remaining jammer instead of recording another theft',()=>{
 reset();const car=T.makeVeh('metro',2108,2400,0);G.vehicles=[car];T.enterVeh(G,car,true);
 assert.ok(G.wanted>0,'actually stealing the cruiser should still be a crime');
 G.wanted=0;G.missionState.scramblerT=50;G._crimeCool=0;
 const saved=T.snapshot(G);T.restoreState(G,saved);
 assert.equal(G.player.kind,'metro');assert.equal(G.wanted,0);assert.equal(G.missionState.scramblerT,50);
 assert.equal(G.policeTarget,null,'loading a save must not create a new police observation');
});
