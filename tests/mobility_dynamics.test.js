import {before,test} from 'node:test';
import assert from 'node:assert/strict';
import {harness} from './harness.js';
import {resolveVehicleImpulse,worldBodyHit,bodySize} from '../src/collision.js';
import {worldBoundaryContact} from '../src/world_limits.js';
let G,T;before(async()=>({G,T}=await harness()));
function road(){return {...G,world:{buildings:[],coreBuildings:[]},surfaceAt:()=> 'road',solidAt:()=>false,vehicles:[],peds:[],props:[],particles:[],flashes:[],skids:[],cops:[],cam:{...G.cam,x:500,y:1500}};}
test('holding the car brake stops forward motion, pauses, then reverses despite a forward stick',()=>{
 const W=road(),v=T.makeVeh('riot',500,1500,0,{vy:-140,parked:false});W.player=v;W.vehicles=[v];
 let stoppedAt=null,reversedAt=null;
 for(let i=0;i<240;i++){W.ticks++;T.tickDrive(W,v,{x:0,y:1,brake:true},1/60,true);const forward=-v.vy;if(stoppedAt==null&&Math.abs(forward)<.1)stoppedAt=i;if(reversedAt==null&&forward<-2)reversedAt=i;}
 assert.ok(stoppedAt!==null&&reversedAt!==null);assert.ok(reversedAt-stoppedAt>=17,'a deliberate stop separates drive and reverse');assert.ok(v.brakeReverse);assert.ok(v.vy>20&&v.vy<=72.01);assert.equal(v.braking,false);
 const reverseY=v.y;for(let i=0;i<120;i++)T.tickDrive(W,v,{x:0,y:1},1/60,true);
 assert.equal(v.brakeReverse,false);assert.ok(v.vy<0,'forward throttle brakes the reverse motion then drives forward');assert.ok(Number.isFinite(v.y-reverseY));
});
test('releasing the brake before neutral delay cancels reverse and bikes retain normal braking',()=>{
 for(const kind of ['riot','hog']){
  const W=road(),v=T.makeVeh(kind,500,1500,0,{parked:false});W.player=v;W.vehicles=[v];
  for(let i=0;i<12;i++)T.tickDrive(W,v,{brake:true},1/60,true);T.tickDrive(W,v,{},1/60,true);
  assert.equal(v.brakeReverse,false);assert.ok(Math.abs(v.vy)<.01);
  if(kind==='hog'){for(let i=0;i<120;i++)T.tickDrive(W,v,{brake:true,y:1},1/60,true);assert.ok(Math.abs(v.vy)<.01);}
 }
});
test('glancing contacts conserve linear momentum while removing sideways energy and limiting bounce',()=>{
 for(const boat of [false,true]){
  const a={vx:180,vy:90,def:{boat}},b={vx:-20,vy:-30,def:{boat}},ma=1,mb=2;
  const momentum=[a.vx*ma+b.vx*mb,a.vy*ma+b.vy*mb],energy=ma*(a.vx*a.vx+a.vy*a.vy)+mb*(b.vx*b.vx+b.vy*b.vy),side=Math.abs(b.vy-a.vy);
  assert.equal(resolveVehicleImpulse(a,b,1,0,ma,mb),200);
  assert.ok(Math.abs(a.vx*ma+b.vx*mb-momentum[0])<1e-8);assert.ok(Math.abs(a.vy*ma+b.vy*mb-momentum[1])<1e-8);
  assert.ok(ma*(a.vx*a.vx+a.vy*a.vy)+mb*(b.vx*b.vx+b.vy*b.vy)<energy);assert.ok(Math.abs(b.vy-a.vy)<side);
  assert.ok(b.vx-a.vx<=36.01);assert.equal(resolveVehicleImpulse(a,b,1,0,ma,mb),0);
 }
});
test('rotated car and boat hulls cannot cross the playable world boundary',()=>{
 const bounds={x:0,y:0,w:1000,h:1000},W={world:{limits:bounds,boatSurfaceAt:()=> 'water'},surfaceAt:()=> 'road'};
 for(const kind of ['riot','wake'])for(const rot of [0,Math.PI/4,Math.PI/2]){
  const v=T.makeVeh(kind,500,500,rot),b=bodySize(v);assert.equal(worldBodyHit(W,v,500,500),null);
  for(const [x,y] of [[1,500],[999,500],[500,1],[500,999]])assert.equal(worldBodyHit(W,v,x,y)?.boundary,true);
  assert.equal(worldBoundaryContact(bounds,v,500,500,b),null);
 }
});
