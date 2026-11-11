import {test} from 'node:test';
import assert from 'node:assert/strict';
import {aimDirection} from '../src/controls.js';
import {streetViewport} from '../src/traffic.js';
import {settingsFrom,resetInput} from '../src/session.js';
import {actionState,startContract,tickAction} from '../src/action.js';
import {restoreStreetRoute} from '../src/side_jobs.js';
const hooks={moveFoot(){}};
function game(){return {action:actionState(),player:{type:'foot',x:0,y:0,speed:0},input:{x:0,y:0},wanted:0,scene:'play',chips:0,health:100,cam:{rot:0},audio:{},solidAt:()=>false,meta:{spawns:{garage:[0,0],raceStart:[800,0]},interactions:{pd:[400,0],neural:[1200,0]}}};}
test('touch aim respects camera rotation independently of the movement stick',()=>{
 assert.equal(aimDirection({touchAim:{active:true,aiming:true,x:1,y:0}},0,.3),Math.PI/2+.3);
 assert.equal(aimDirection({touchAim:{active:true,aiming:false,x:0,y:0}},1),1);
 const input={touchAim:{active:true},mouse:{down:true},touchJoy:{active:true},tFire:true};resetInput(input);assert.equal(input.touchAim.active,false);assert.equal(input.tFire,false);
});
test('mobile preferences validate arbitrary saved values',()=>{
 const s=settingsFrom({controlSize:3,controlOpacity:Infinity,batterySaver:true,leftHanded:true,aimAssist:false});
 assert.equal(s.controlSize,1);assert.equal(s.controlOpacity,.8);assert.equal(s.batterySaver,true);assert.equal(s.leftHanded,true);assert.equal(s.aimAssist,false);
});
test('street population viewport is independent of render resolution and device pixel density',()=>{
 const base={cssW:390,cssH:844,cam:{scale:1.4},canvas:{width:390,height:844},dpr:1};
 assert.deepEqual(streetViewport(base),streetViewport({...base,canvas:{width:1170,height:2532},dpr:3}));
 const view=streetViewport(base);assert.ok(view.halfW<400);assert.ok(view.halfH<700);
});
test('witness rescue requires an actual stopped car pickup, newly acquired heat and safe delivery',()=>{
 const G=game();startContract(G,'rescue');G.player.x=0;tickAction(G,3,hooks);assert.equal(G.action.contract.stage,0);assert.equal(G.chips,0);
 G.player.x=800;tickAction(G,3,hooks);assert.equal(G.action.contract.stage,0);
 G.player={type:'veh',def:{},x:800,y:0,vx:50,vy:0,health:100};tickAction(G,3,hooks);assert.equal(G.action.contract.stage,0);
 G.player.vx=0;tickAction(G,3.1,hooks);assert.equal(G.action.contract.stage,1);assert.equal(G.wanted,2);assert.deepEqual(G.waypoint,{x:0,y:0});
 G.player.x=0;tickAction(G,3,hooks);assert.equal(G.chips,0);G.wanted=0;tickAction(G,2.1,hooks);assert.equal(G.chips,950);assert.equal(G.action.contract,null);tickAction(G,1,hooks);assert.equal(G.chips,950);
});
test('evidence drops require ordered on-foot holds, interrupt on fire and pay once after upload',()=>{
 const G=game();startContract(G,'signal');G.player.x=1200;tickAction(G,4,hooks);assert.equal(G.action.contract.stage,0);
 G.player.x=0;tickAction(G,1,hooks);G.input.fire=true;tickAction(G,1,hooks);assert.equal(G.action.contract.progress,0);G.input.fire=false;
 for(const x of [0,400,800]){G.player.x=x;tickAction(G,2.1,hooks);}
 assert.equal(G.action.contract.stage,3);assert.equal(G.chips,0);G.player.x=1200;G.wanted=1;tickAction(G,4,hooks);assert.equal(G.chips,0);G.wanted=0;tickAction(G,3.1,hooks);assert.equal(G.chips,1100);tickAction(G,4,hooks);assert.equal(G.chips,1100);
});
test('resumed street jobs rebuild the correct stage marker and expired jobs do not pay',()=>{
 const G=game();G.action=actionState({contract:{id:'signal',stage:2,t:45,progress:0}});restoreStreetRoute(G);assert.deepEqual(G.waypoint,{x:800,y:0});
 tickAction(G,46,hooks);assert.equal(G.action.contract,null);assert.equal(G.chips,0);
});
