import {test} from 'node:test';
import assert from 'node:assert/strict';
import {actionState,actionSave,WEAPONS,requestShot,reload,tickAction,startContract,buyService,applyTune,nearService} from '../src/action.js';
function game(){return {action:actionState(),input:{x:0,y:0},player:{type:'foot',x:0,y:0,rot:0,dist:0,speed:0},scene:'play',wanted:0,evading:true,chips:3000,cops:[],audio:{},cam:{rot:0},missionIndex:0,objectiveIndex:0,
 meta:{spawns:{garage:[0,0],neural:[600,0],pd:[1000,0]},interactions:{neural:[600,0],pd:[1000,0]}},solidAt:()=>false,findSafeAction:(x,y)=>({x,y})};}
const hooks={moveFoot:(G,P,x,y)=>{P.x+=x;P.y+=y;}};
test('weapons have different cadence, capacity and pellet damage, with bounded reloads',()=>{
 const G=game();assert.equal(requestShot(G).id,'sidearm');assert.equal(G.action.ammo[0],11);assert.equal(requestShot(G),null);
 tickAction(G,.3,hooks);assert.ok(requestShot(G));
 G.action.ammo[0]=0;G.action.shotT=0;assert.equal(requestShot(G),null);assert.ok(G.action.reloadT>0);
 tickAction(G,1.1,hooks);assert.equal(G.action.ammo[0],12);
 G.action.weapon=2;G.action.shotT=0;const gun=requestShot(G);assert.equal(gun.pellets,6);assert.ok(gun.interval>WEAPONS[1].interval);
 assert.equal(reload(G),true);tickAction(G,2,hooks);assert.equal(G.action.ammo[2],6);
});
test('dodge spends stamina, moves in the intended direction and cannot be spammed',()=>{
 const G=game();G.input.y=1;G.input.dodgeP=true;tickAction(G,1/60,hooks);assert.ok(G.player.y<0);assert.ok(G.action.stamina<77);assert.ok(G.action.dodgeCool>0);
 const stamina=G.action.stamina;tickAction(G,1/60,hooks);assert.ok(G.action.stamina>stamina-2);
 G.input.dodgeP=false;G.input.y=0;tickAction(G,5,hooks);assert.equal(G.action.stamina,100);
});
test('cover is detected only while still beside a wall',()=>{
 const G=game();G.solidAt=(x,y)=>x===30&&y===0;tickAction(G,.1,hooks);assert.equal(G.action.cover,true);
 G.player.speed=100;tickAction(G,.1,hooks);assert.equal(G.action.cover,false);
});
test('courier completion pays once, increments reputation and restores job guidance',()=>{
 const G=game();assert.ok(startContract(G,'courier'));assert.equal(startContract(G,'ghost'),false);
 tickAction(G,.1,hooks);assert.equal(G.action.contract.stage,1);
 G.player.x=600;const chips=G.chips;tickAction(G,1,hooks);assert.equal(G.chips,chips+650);assert.equal(G.action.completed,1);assert.equal(G.action.reputation,2);assert.equal(G.waypoint,null);
 tickAction(G,1,hooks);assert.equal(G.chips,chips+650);
});
test('ghost contract requires reaching its target and then losing the new heat',()=>{
 const G=game();startContract(G,'ghost');tickAction(G,1,hooks);assert.equal(G.action.contract.stage,0);
 G.player.x=1000;tickAction(G,1,hooks);assert.equal(G.wanted,2);assert.equal(G.action.contract.stage,1);
 G.player.x=2000;G.wanted=0;tickAction(G,1,hooks);assert.equal(G.action.contract,null);assert.equal(G.chips,3850);
});
test('drift work needs a sliding land vehicle, and missed contracts never pay',()=>{
 const G=game();startContract(G,'drift');G.player={type:'veh',def:{boat:true},drifting:true,vx:300,vy:0};tickAction(G,1,hooks);assert.equal(G.action.contract.progress,0);
 G.player.def.boat=false;tickAction(G,7,hooks);assert.equal(G.action.contract,null);assert.equal(G.chips,3700);
 G.player={type:'foot',x:0,y:0,speed:0};startContract(G,'courier');tickAction(G,.1,hooks);tickAction(G,101,hooks);assert.equal(G.chips,3700);assert.equal(G.action.contract,null);
});
test('starting a courier at the destination cannot farm rewards without a garage pickup',()=>{
 const G=game();G.player.x=600;startContract(G,'courier');tickAction(G,200,hooks);assert.equal(G.chips,3000);assert.equal(G.action.contract.stage,0);assert.equal(G.action.contract.t,100);
 assert.deepEqual(G.waypoint,{x:0,y:0});
});
test('workshops enforce cost, line of sight and vehicle requirements',()=>{
 const G=game();assert.ok(nearService(G));assert.equal(buyService(G,'repair'),false);assert.equal(G.chips,3000);
 G.player={type:'veh',x:0,y:0,vx:0,vy:0,health:20,burning:true,wrecked:true,def:{boat:false}};
 G.wanted=3;G.evading=false;assert.equal(buyService(G,'respray'),false);assert.equal(G.wanted,3);
 G.evading=true;assert.ok(buyService(G,'respray'));assert.equal(G.wanted,0);assert.equal(G.chips,2750);
 assert.ok(buyService(G,'repair'));assert.equal(G.player.health,100);assert.equal(G.player.burning,false);
 G.chips=0;assert.equal(buyService(G,'tune'),false);assert.equal(G.action.upgrades,0);
});
test('tuning is scoped to the player car, cannot compound, and rolls back with checkpoints',()=>{
 const G=game(),stock={accel:200,brake:250,grip:.8,max:300},v={def:stock};G.action.upgrades=2;
 applyTune(G,v);const top=v.def.max;applyTune(G,v);assert.equal(v.def.max,top);assert.equal(stock.max,300);
 G.action.upgrades=0;applyTune(G,v);assert.equal(v.def,stock);
});
test('saved action state excludes transient motion and validates legacy or malformed values',()=>{
 const A=actionState({weapon:100,ammo:[-4,Infinity,1000],upgrades:40,stamina:NaN});assert.equal(A.weapon,2);assert.equal(A.ammo[0],0);assert.equal(A.ammo[1],28);assert.equal(A.ammo[2],6);
 A.dodgeT=.3;A.reloadT=1;A.reputation=12;const restored=actionState(actionSave(A));assert.equal(restored.reputation,12);assert.equal(restored.dodgeT,0);assert.equal(restored.reloadT,0);
 assert.equal(actionState().weapon,0);
});
