import {before,test} from 'node:test';
import assert from 'node:assert/strict';
import {harness} from './harness.js';
import {actionState,actionSave,tickAction} from '../src/action.js';
import {firstSolid,shotSpread,projectileDamage} from '../src/combat.js';
import {WEAPONS} from '../src/action.js';
import {characterFrame,characterLayout} from '../src/sprite_frames.js';
import {aircraftClearance,obstacleHeight,tickAircraft,restoreAircraft} from '../src/aviation.js';
import {worldBodyHit,circleBody} from '../src/collision.js';
import {interactExpansion} from '../src/expansion.js';
import {WORLD_W} from '../src/world.js';
import {drawTransitWorld} from '../src/transit.js';
let G,T,realSurface,realSolid;
before(async()=>{({G,T}=await harness());realSurface=G.surfaceAt;realSolid=G.solidAt;});
function flat(){G.surfaceAt=()=> 'road';G.solidAt=()=>false;G.peds=[];G.vehicles=[];G.cops=[];G.bullets=[];G.particles=[];G.flashes=[];G.skids=[];G.wanted=0;G.health=100;G.action=actionState();G.player=T.makeFoot(G,500,500,0);G.input.fire=false;G.input.mouse.fire=false;G.input.touchJoy.active=false;G.touch=false;G.scene='play';G.jack=null;G._flow=null;G.cam.x=G.cam.y=500;G.nearVehicles=null;G.streetVehicleSource=null;}
test('a muzzle pressed against a wall cannot spawn a shot behind it',()=>{
 flat();G.solidAt=(x,y)=>y>=480&&y<=488;G.peds=[{x:500,y:440,hp:30,walk:0}];
 assert.notEqual(firstSolid(G,500,500,500,482),null);T.shoot(G,G.player,true);assert.equal(G.action.ammo[0],11);assert.equal(G.bullets.length,0);assert.equal(G.peds[0].hp,30);assert.ok(G.particles.some(p=>p.kind==='spark'));
});
test('wrecked cars provide cover against both player and police bullets',()=>{
 for(const friend of [true,false]){flat();const wreck=T.makeVeh('fare',500,400,0,{dead:true,health:0});G.vehicles=[wreck];const target=friend?{x:500,y:300,hp:30}:G.player;if(friend)G.peds=[target];else G.player.y=300;
 G.bullets=[{x:500,y:500,vx:0,vy:-1200,life:1,friend,damage:40}];T.tickBullets(G,.2);assert.equal(friend?target.hp:G.health,friend?30:100);assert.equal(G.bullets.length,0);}
});
test('mouse aim hits the visible torso with a rotated camera and aim assist disabled',()=>{
 flat();const aimAssist=G.settings.aimAssist;G.settings.aimAssist=false;G.cam.rot=-.37;
 const target={x:680,y:500,hp:30,walk:0};G.peds=[target];const click=T.worldToScreen(G,target.x,target.y-23);Object.assign(G.input.mouse,{...click,fire:true});
 try{T.shoot(G,G.player,true);T.tickBullets(G,.3);assert.ok(target.dead);assert.equal(G.bullets.length,0);}finally{G.settings.aimAssist=aimAssist;G.input.mouse.fire=false;G.cam.rot=0;}
});
test('weapon spread responds to movement and sustained fire; shotgun damage falls off at distance',()=>{
 flat();const w=WEAPONS[1],still=shotSpread(G,w,G.player);G.player.speed=175;assert.ok(shotSpread(G,w,G.player)>still);G.action.bloom=1;const burst=shotSpread(G,w,G.player);tickAction(G,.6,{moveFoot(){}});assert.ok(shotSpread(G,w,G.player)<burst);
 const b={damage:19,range:340,falloff:100,travel:60};assert.equal(projectileDamage(b),19);b.travel=330;assert.ok(projectileDamage(b)<8);assert.ok(projectileDamage(b)>0);
});
test('car BRAKE overrides forward throttle, stops before selecting reverse, and avoids handbrake drift',()=>{
 flat();G.wet=0;const v=T.makeVeh('riot',500,1500,0,{vy:-150});G.player=v;G.vehicles=[v];
 let reversed=false;for(let i=0;i<36;i++){T.tickDrive(G,v,{y:1,brake:true},1/60,true);if(v.fwd<0)reversed=true;}
 assert.equal(reversed,false);assert.ok(Math.hypot(v.vx,v.vy)<10);assert.equal(v.drifting,false);
 for(let i=0;i<35;i++)T.tickDrive(G,v,{y:1,brake:true},1/60,true);assert.ok(v.fwd<0);assert.ok(v.braking===false);
});
test('ordinary boat exit requires docking speed; stopped passengers reach the real pier',()=>{
 flat();G.surfaceAt=realSurface;G.solidAt=realSolid;const v=T.makeVeh('wake',6930,1250,Math.PI,{vy:80});G.player=v;G.vehicles=[v];T.exitVeh(G);assert.equal(G.player,v);v.vy=0;T.exitVeh(G);assert.equal(G.player.type,'foot');assert.ok(T.footClear(G,G.player.x,G.player.y,7));assert.ok(Math.hypot(G.player.x-v.x,G.player.y-v.y)<125);
});
test('a frightened pedestrian cannot dive through a riverbank or a wall',()=>{
 for(const blocked of ['water','build']){flat();G.surfaceAt=(x,y)=>x>515?blocked:'walk';G.solidAt=(x,y)=>x>515&&blocked==='build';const p={...T.makeFoot(G,500,500,0),sprite:'m1',dive:.5,vx:170,vy:0};G.peds=[p];for(let i=0;i<20;i++)T.tickPeds(G,1/60);assert.ok(p.x<=508);assert.ok(T.footClear(G,p.x,p.y,7));}
});
test('forest river remains continuous with separate boat and road bridge elevations',()=>{
 G.surfaceAt=realSurface;G.solidAt=realSolid;const boat=T.makeVeh('wake',10100,6700,Math.PI/2);
 for(let x=10100;x<12200;x+=8)assert.equal(worldBodyHit(G,boat,x,6700),null,'river blocked at '+x);
 assert.equal(G.surfaceAt(11200,6700),'water');assert.equal(G.surfaceAt(10880,6700),'road');assert.equal(G.world.boatSurfaceAt(10880,6700),'water');assert.ok(worldBodyHit(G,boat,WORLD_W,6700));
});
test('plane wingtips and helicopter rotors respect obstacles outside the fuselage',()=>{
 flat();for(const kind of ['plane','heli']){const v=T.makeVeh(kind,500,500,0);restoreAircraft(v,{altitude:30,airspeed:80});const W={...G,world:{buildings:[{x:kind==='plane'?575:552,y:490,w:10,h:25,hgt:90}],coreBuildings:[]},player:v};
 assert.equal(obstacleHeight(W,500,500,24),0);assert.equal(aircraftClearance(W,v),90);tickAircraft(W,v,{y:1},1/60,{damage:(v,n)=>v.health-=n});assert.ok(v.health<100);assert.ok(Number.isFinite(v.lean));}
 const plane=T.makeVeh('plane',500,500,0);assert.equal(circleBody(plane,580,505,1),true);
 assert.equal(aircraftClearance({...G,world:{buildings:[{x:540,y:502,w:4,h:4,hgt:80}]}},plane),80,'mid-span wings also require clearance');
});
test('weather advances out of clear weather and its sequence survives save/resume',()=>{
 flat();G.weather='clear';G.weatherIndex=0;const seen=new Set();for(let i=0;i<7;i++){G.weatherT=0;T.tickWeather(G,1/60);seen.add(G.weather);}assert.deepEqual([...seen].sort(),['clear','fog','rain','sand']);
 G.surfaceAt=realSurface;G.solidAt=realSolid;G.weather='rain';G.weatherIndex=2;G.weatherT=42;const d=T.snapshot(G);T.restoreState(G,d);assert.equal(G.weatherIndex,2);assert.equal(G.weatherT,42);
});
test('every regional carriage stays on its track when reversing at either terminus',()=>{
 const translate=G.ctx.translate,oldClock=G.transit.clock,r={x0:10200,x1:10400,y0:1000,y1:9700};
 function positions(t){const out=[];G.transit.clock=t;G.ctx.translate=(x,y)=>out.push([x,y]);drawTransitWorld(G,r,true);return out.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);}
 try{for(const clock of [99,198]){const before=positions(clock-.0001),after=positions(clock+.0001);assert.equal(before.length,6);assert.equal(after.length,6);for(let i=0;i<6;i++){assert.equal(before[i][0],after[i][0]);assert.ok(Math.abs(before[i][1]-after[i][1])<.1);assert.ok(after[i][1]-72>=G.world.transit.rail.y0);assert.ok(after[i][1]+72<=G.world.transit.rail.y1);}}}finally{G.ctx.translate=translate;G.transit.clock=oldClock;}
});
test('finished stories persist, contacts acknowledge them, and replay requires a second interaction',()=>{
 flat();G.surfaceAt=realSurface;G.solidAt=realSolid;G.player=T.makeFoot(G,6130,3555,0);G.transit.completed=3;G.action.contract={id:'clockwork',stage:2,t:100,progress:0,trainStart:2};const chips=G.chips;
 tickAction(G,2.6,{moveFoot(){}});assert.equal(G.action.contract,null);assert.ok(G.chips>chips);assert.deepEqual(G.action.completedJobs,['clockwork']);G.action=actionState(actionSave(G.action));G.contactTalk=null;
 interactExpansion(G);assert.equal(G.action.contract,null);assert.ok(G.contactTalk.repeat);assert.match(G.contactTalk.text,/missing nine minutes/);interactExpansion(G);assert.equal(G.action.contract.id,'clockwork');
 assert.deepEqual(actionState({completedJobs:['clockwork','unknown','clockwork']}).completedJobs,['clockwork']);
});
test('character source frames are bounded and feet remain at the same ground origin at both texture sizes',()=>{
 for(const crowd of [false,true])for(const size of [[1086,1448],[crowd?576:384,512]]){const im={width:size[0],height:size[1]};for(let row=0;row<8;row++)for(let col=0;col<(crowd?9:6);col++){const f=characterFrame(im,crowd,col,row),l=characterLayout(f,crowd?48:50);assert.ok(f.x>=0&&f.y>=0&&f.x+f.w<=im.width+.01&&f.y+f.h<=im.height+.01);assert.equal(l.y+l.h,0);assert.ok(l.w<55);}}
});
test('vehicle exit animation grows to normal size instead of shrinking before it disappears',()=>{
 flat();const scale=G.ctx.scale,ys=[];G.ctx.scale=(x,y)=>ys.push(y);try{for(const exitT of [1,.5,.01]){G.player.exitT=exitT;T.drawChar(G,G.player);}}finally{G.ctx.scale=scale;}assert.ok(ys[0]<ys[1]&&ys[1]<ys[2]);assert.ok(ys[2]>.99);
});
test('animation remains valid after repeated turns in either direction, including aiming while walking',()=>{
 flat();G.player.speed=80;G.player.dist=10;G.input.fire=true;
 for(let i=-100;i<=100;i++){G.player.rot=i*Math.PI/4;G.player.aimRot=G.player.rot;assert.doesNotThrow(()=>T.drawChar(G,G.player));}
 G.input.fire=false;
});
