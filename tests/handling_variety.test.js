import {before,test} from 'node:test';
import assert from 'node:assert/strict';
import {harness} from './harness.js';

let G,T;before(async()=>({G,T}=await harness()));
function scene(kind,{speed=0,wet=0,health=100,surface}={}){
 const water=kind==='wake'||kind==='gulf';
 const W={...G,world:{buildings:[],coreBuildings:[]},surfaceAt:()=>surface||(water?'water':'road'),solidAt:()=>false,
  vehicles:[],peds:[],props:[],cops:[],particles:[],flashes:[],skids:[],wet,ticks:0};
 const v=T.makeVeh(kind,10000,10000,0,{vy:-speed,health,parked:false});W.player=v;W.vehicles=[v];return {W,v};
}
function drive(s,input,seconds,dt=1/60){for(let i=0;i<Math.round(seconds/dt);i++){s.W.ticks++;T.tickDrive(s.W,s.v,input,dt,true);}}
const speed=s=>Math.hypot(s.v.vx,s.v.vy);
const slip=s=>Math.abs(Math.atan2(Math.sin(Math.atan2(s.v.vx,-s.v.vy)-s.v.rot),Math.cos(Math.atan2(s.v.vx,-s.v.vy)-s.v.rot)));

test('one-second launches and long straights separate heavy, everyday, muscle, sports and hyper cars',()=>{
 const runs={};
 for(const kind of ['bus','van','taxi','fare','riot','metro','dart','nyx','hog','stitch','gulf','wake']){
  const s=scene(kind);drive(s,{y:1},1);const launch=speed(s);drive(s,{y:1},11);
  runs[kind]={launch,top:speed(s)};
  assert.ok(runs[kind].top>s.v.def.max*.96,kind+' cannot reach its rated cruise');
  assert.ok(runs[kind].top<=s.v.def.max*1.005,kind+' exceeds its engine limit');
 }
 for(const [slow,fast,margin] of [['bus','fare',1.7],['fare','riot',1.3],['riot','dart',1.1],['dart','nyx',1.15],['hog','stitch',1.2],['gulf','wake',1.3]]){
  assert.ok(runs[fast].top>runs[slow].top*margin,slow+' and '+fast+' feel too alike on a straight');
 }
 assert.ok(runs.riot.launch>runs.fare.launch*1.45,'muscle car needs a visibly stronger launch than the sedan');
 assert.ok(runs.nyx.launch>runs.dart.launch*1.1,'hypercar has a separate launch character');
 assert.ok(runs.bus.launch<runs.fare.launch*.6,'heavy transit cannot launch like a sedan');
 const grass=scene('riot',{surface:'grass'});drive(grass,{y:1},12);
 assert.ok(speed(grass)<runs.riot.top*.9,'off-road resistance must not be cancelled by the engine curve');
});

test('steering preserves inertia and muscle cars recover lateral grip more slowly than the hypercar',()=>{
 const muscle=scene('riot',{speed:200}),hyper=scene('nyx',{speed:200}),bus=scene('bus',{speed:110});
 for(const s of [muscle,hyper,bus])drive(s,{x:1},.6);
 assert.ok(slip(muscle)>.1,'velocity must lag body yaw, not rotate rigidly with the sprite');
 assert.ok(slip(muscle)>slip(hyper)*1.5,'muscle tires should have more lateral give');
 assert.ok(bus.v.rot<hyper.v.rot*.6,'long heavy bodies must turn in more slowly');
 const drifting=scene('riot',{speed:200});drive(drifting,{x:1,hand:true},.5);
 assert.ok(drifting.v.drifting);const before=slip(drifting);drive(drifting,{y:1},1.5);
 assert.ok(slip(drifting)<before*.12,'release handbrake and straighten to regain grip');
 assert.ok(speed(drifting)>40,'a recoverable slide must not stop the vehicle');
});

test('braking distance follows the car and wet surface, without snapping overspeed to its rating',()=>{
 function stop(kind,wet=0){const s=scene(kind,{speed:200,wet});let frames=0;
  while(speed(s)>1&&frames++<240)drive(s,{brake:true},1/60);
  assert.ok(frames<240);return 10000-s.v.y;
 }
 const riot=stop('riot'),nyx=stop('nyx'),bus=stop('bus');
 assert.ok(riot>nyx*1.25,'performance brakes should shorten stopping distance');
 assert.ok(bus>riot*1.25,'bus must retain momentum instead of snapping to 125');
 assert.ok(stop('riot',1)>riot*1.15,'rain must increase stopping distance');
 const fast=scene('bus',{speed:200});drive(fast,{},1/60);
 assert.ok(speed(fast)>190,'rating limits propulsion, not external momentum');
});

test('a failed engine cannot creep into pedal reverse and boost release preserves momentum',()=>{
 const wreck=scene('riot',{health:0});drive(wreck,{y:1,brake:true},4);
 assert.equal(speed(wreck),0);assert.equal(wreck.v.y,10000);
 const nyx=scene('nyx');drive(nyx,{y:1,boost:true},8);const boosted=speed(nyx);
 assert.ok(boosted>nyx.v.def.max*1.15);drive(nyx,{y:1},1/60);
 assert.ok(speed(nyx)>boosted*.98,'releasing boost must not instantly erase momentum');
 drive(nyx,{y:1},8);assert.ok(speed(nyx)<=nyx.v.def.max*1.01);
});

test('handling remains close across simulation cadences, and long coasts come to rest',()=>{
 const results=[];
 for(const dt of [1/30,1/60,1/120]){const s=scene('dart');drive(s,{y:1},3,dt);drive(s,{x:.4,y:.6},1,dt);drive(s,{y:1},2,dt);results.push(s);}
 for(const s of [results[0],results[2]]){
  assert.ok(Math.abs(speed(s)-speed(results[1]))<8);
  assert.ok(Math.hypot(s.v.x-results[1].v.x,s.v.y-results[1].v.y)<35,'cadence should not change the driving line substantially');
 }
 const car=scene('riot',{speed:200});drive(car,{},35);assert.equal(speed(car),0);
});
