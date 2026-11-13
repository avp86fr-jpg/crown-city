import {test} from 'node:test';
import assert from 'node:assert/strict';
import {stepPedestrian,sleepSafeGround} from '../src/pedestrian_motion.js';
import {circleBody} from '../src/collision.js';

const pedestrian=()=>({x:0,y:0,rot:Math.PI/2,speed:0,dist:0});
test('pedestrian candidates refresh at a bounded decision rate while walking stays at 60 Hz',()=>{
 let carQueries=0,peopleQueries=0;const G={vehicles:[],surfaceAt:()=> 'walk',cityAI:{nearTraffic(){carQueries++;},nearPeople(){peopleQueries++;}}},p=pedestrian();
 for(let i=0;i<60;i++)assert.equal(stepPedestrian(G,p,Math.PI/2,36,1/60),true);
 assert.ok(Math.abs(p.x-36)<.001);assert.ok(carQueries>=8&&carQueries<=11);assert.equal(carQueries,peopleQueries);
});
test('cached candidates use current vehicle bodies instead of stale avoidance positions',()=>{
 let queries=0;const v={x:35,y:120,rot:0,def:{},vx:0,vy:0},G={vehicles:[v],surfaceAt:()=> 'walk',cityAI:{nearTraffic(x,y,r,visit){queries++;visit(v);}}},p=pedestrian();
 stepPedestrian(G,p,Math.PI/2,36,1/60);v.y=0;
 for(let i=0;i<5;i++){stepPedestrian(G,p,Math.PI/2,36,1/60);assert.equal(circleBody(v,p.x,p.y,6),false);}
 assert.equal(queries,1,'narrow phase should use the moving candidate without a new query');
});
test('large walking steps cannot cross a two-pixel wall or water strip',()=>{
 for(const surface of ['build','canal']){
  const G={vehicles:[],surfaceAt:x=>x>9&&x<11?surface:'walk'},p=pedestrian();
  for(let i=0;i<10;i++){stepPedestrian(G,p,Math.PI/2,200,.1);assert.ok(p.x<9,'the barrier must not be tunneled through');}
 }
});
test('stationary pedestrians do not query avoidance or rotate, and invalid ground cannot sleep',()=>{
 let queries=0;const G={vehicles:[],surfaceAt:()=> 'walk',cityAI:{nearTraffic(){queries++;}}},p=pedestrian();
 assert.equal(stepPedestrian(G,p,0,0,1/60),false);assert.equal(queries,0);assert.equal(p.rot,Math.PI/2);
 assert.equal(sleepSafeGround(G,p),true);
 for(const s of ['road','build','water','canal']){G.surfaceAt=()=>s;assert.equal(sleepSafeGround(G,p),false,s);}
});
