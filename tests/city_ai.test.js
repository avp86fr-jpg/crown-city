import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCityAI, createStreetIndex } from '../src/city_ai.js';

const ped = (x = 0, y = 0, extra = {}) => ({ x, y, rot: 0, walk: 34, speed: 0, dist: 0, r: 8, ambient: true, flee: 0, ...extra });
const car = (x, y, extra = {}) => ({ x, y, rot: Math.PI / 2, vx: 0, vy: 0, r: 24, type: 'veh', traffic: true, ...extra });
function city(extra = {}) {
  const G = { player: { x: 0, y: 0, type: 'foot' }, cam: { x: 0, y: 0 }, peds: [], vehicles: [],
    street: { fixtures: [] }, settings: { quality: 'high' }, surfaceAt: () => 'walk', solidAt: () => false, ...extra };
  const ai = createCityAI(G);
  return { G, ai, frame(dt = 0.1) { ai.begin(dt); for (const p of G.peds) ai.steerPed(p, dt); } };
}

test('street queries cover distant cells and negative coordinates without duplicate results', () => {
  const index = createStreetIndex(80), points = [{ x: -161, y: -1 }, { x: 161, y: 1 }, { x: 0, y: 0 }, { x: 0, y: 400 }];
  index.rebuild(points); const found = [];
  index.query(0, 0, 200, p => found.push(p));
  assert.deepEqual(new Set(found), new Set(points.slice(0, 3))); assert.equal(found.length, 3);
  index.rebuild([{ x: 5, y: 5, dead: true }]); let count = 0;
  index.query(0, 0, 200, () => count++); assert.equal(count, 0);
});

test('a civilian anticipates an approaching ambient car and dives perpendicular to its path', () => {
  const p = ped(75, 2), v = car(0, 0, { vx: 110 });
  const { ai } = city({ peds: [p], vehicles: [v] }); ai.begin(0.1);
  assert.ok(p.dive > 0); assert.ok(p.flee >= 3); assert.ok(Math.abs(p.vx) < 0.001);
  assert.ok(p.vy > 0); assert.equal(p.threatX, v.x);
});

test('receding traffic and cars in another lane do not panic pedestrians', () => {
  const behind = ped(-25, 0), adjacent = ped(60, 80);
  const { ai } = city({ peds: [behind, adjacent], vehicles: [car(0, 0, { vx: 110 })] }); ai.begin(0.1);
  assert.equal(behind.flee, 0); assert.equal(adjacent.flee, 0);
});

test('danger avoidance picks the clear side and never dives into water', () => {
  const p = ped(60, 1);
  const { ai } = city({ peds: [p], vehicles: [car(0, 0, { vx: 110 })],
    surfaceAt: (_x, y) => y > 12 ? 'water' : 'walk' }); ai.begin(0.1);
  assert.ok(p.dive > 0); assert.ok(p.vy < 0);
});

test('gunfire interrupts fixture residents and conversations but does not cross occluding walls', () => {
  const p = ped(30, 0, { gather: { x: 30, y: 0 } }), occluded = ped(-30, 0);
  const { ai } = city({ peds: [p, occluded], nav: { clearLine: x => x > 0 } });
  ai.steerPed(p, 0.1); assert.equal(p.cityState.mode, 'pause');
  ai.emit('gunshot', 0, 0); ai.begin(0.1);
  assert.ok(p.flee > 0); assert.equal(p.cityState.mode, 'walk'); assert.equal(p.gather, null);
  assert.equal(occluded.flee, 0);
});

test('purposeful visits reach the actual market and end after a finite shopping stop', () => {
  const p = ped(0, 36), fixture = { x: 90, y: 0, kind: 1, rot: 0 };
  const { frame } = city({ peds: [p], street: { fixtures: [fixture] } });
  let arrived = false, left = false;
  for (let i = 0; i < 400; i++) {
    frame();
    if (p.cityState.mode === 'pause' && p.cityActivity === 'shopping') {
      arrived = true; assert.ok(Math.hypot(p.x - 67, p.y - 36) < 10);
    }
    if (arrived && p.cityState.mode === 'walk') { left = true; break; }
  }
  assert.ok(arrived); assert.ok(left); assert.ok(p.dist > 50);
});

test('visits do not cut across roads, buildings, or water to reach a fixture', () => {
  for (const obstacle of ['road', 'build', 'water']) {
    const p = ped(0, 36), { frame } = city({ peds: [p], street: { fixtures: [{ x: 120, y: 0, kind: 1 }] },
      surfaceAt: x => x > 30 && x < 50 ? obstacle : 'walk' });
    for (let i = 0; i < 150; i++) frame();
    assert.equal(p.x, 0, obstacle); assert.equal(p.cityState.mode, 'walk', obstacle);
  }
});

test('venue reservations prevent en-route residents from piling into the same queue slot', () => {
  const fixture = { x: 320, y: 0, kind: 1 }, peds = Array.from({ length: 12 }, (_, i) => ped(-i * 4, 36));
  const { frame } = city({ peds, street: { fixtures: [fixture] } });
  let reserved = 0;
  for (let i = 0; i < 100; i++) {
    frame();
    const guests = peds.filter(p => p.cityState?.fixture === fixture);
    reserved = Math.max(reserved, guests.length);
    assert.ok(guests.length <= 3); assert.equal(new Set(guests.map(p => p.cityState.slot)).size, guests.length);
  }
  assert.equal(reserved, 3);
});

test('nearby residents form a timed conversation, face each other, and separate after an alarm', () => {
  const a = ped(0, 0), b = ped(32, 0), { ai, frame } = city({ peds: [a, b] });
  for (let i = 0; i < 700 && a.cityState?.mode !== 'talk'; i++) frame();
  assert.equal(a.cityState.mode, 'talk'); assert.equal(a.cityState.partner, b);
  for (let i = 0; i < 10; i++) frame();
  assert.ok(Math.sin(a.rot) > 0.9); assert.ok(Math.sin(b.rot) < -0.9);
  ai.emit('collision', 0, 0); frame();
  assert.ok(a.flee > 0 && b.flee > 0); assert.equal(a.cityState.partner, null); assert.equal(b.cityState.partner, null);
});

test('traffic yields to crossing pedestrians and emergency vehicles without slowing protected player vehicles', () => {
  const v = car(0, 0), p = ped(65, 0, { onRoad: true });
  const { G, ai } = city({ peds: [p], vehicles: [v] }); ai.begin(0.1);
  assert.ok(ai.trafficSpeed(v, 100) < 25);
  G.peds = []; G.vehicles.push(car(-100, 15, { siren: true })); ai.begin(0.2);
  assert.equal(ai.trafficSpeed(v, 100), 20);
  G.player = v; assert.equal(ai.trafficSpeed(v, 100), 100);
});

test('sidewalk walkers beside the real hull corridor do not freeze traffic',()=>{
 for(const offset of [32,34,36]){
  const v=car(0,0),p=ped(48,offset,{speed:34,rot:Math.PI/2,onRoad:false});
  const {ai}=city({peds:[p],vehicles:[v]});ai.begin(.1);assert.equal(ai.trafficSpeed(v,100),100,'sidewalk offset '+offset);
 }
 const bike=car(0,0,{def:{bike:true}}),p=ped(60,23,{speed:34,rot:Math.PI/2});
 const {ai}=city({peds:[p],vehicles:[bike]});ai.begin(.1);assert.equal(ai.trafficSpeed(bike,80),80);
});

test('a pedestrian inside the vehicle path remains protected even with stale sidewalk flags',()=>{
 const v=car(0,0),p=ped(48,22.5,{onRoad:false});const {ai}=city({peds:[p],vehicles:[v]});
 ai.begin(.1);assert.equal(ai.trafficSpeed(v,100),0);
 const bus=car(0,0,{kind:'bus'}),front=ped(83,0,{onRoad:true});const b=city({peds:[front],vehicles:[bus]});
 b.ai.begin(.1);assert.equal(b.ai.trafficSpeed(bus,80),0,'long buses must stop before the bumper overlaps a pedestrian');
});

test('traffic anticipates a moving pedestrian entering its lane but does not stop for a walker moving away',()=>{
 for(const toward of [true,false]){
  const v=car(0,0,{vx:80}),p=ped(110,55,{speed:45,rot:toward?0:Math.PI,crossing:true});
  const {ai}=city({peds:[p],vehicles:[v],surfaceAt:(_x,y)=>Math.abs(y)<40?'road':'walk'});ai.begin(.1);
  const speed=ai.trafficSpeed(v,100);if(toward)assert.ok(speed<80);else assert.equal(speed,100);
 }
});

test('displaced residents release social or venue pauses and return control to road-exit walking',()=>{
 const p=ped(0,0,{gather:{x:0,y:0}}),{G,ai}=city({peds:[p]});ai.steerPed(p,.1);assert.equal(p.cityState.mode,'pause');
 G.surfaceAt=()=> 'road';assert.equal(ai.steerPed(p,.1),false);assert.equal(p.cityState.mode,'walk');assert.equal(p.onRoad,true);assert.equal(p.cityState.goal,null);
});

test('a bus stops at a shelter, waiting passengers board, and the bus resumes once', () => {
  const fixture = { x: 0, y: 40, kind: 2, rot: 0 }, p = ped(-23, 76), v = car(0, 0, { kind: 'bus' });
  const { G, ai, frame } = city({ peds: [p], vehicles: [v], street: { fixtures: [fixture] } });
  for (let i = 0; i < 300 && p.cityState?.mode !== 'pause'; i++) frame();
  assert.equal(p.cityState.mode, 'pause'); assert.equal(p.cityActivity, 'bus');
  assert.equal(ai.trafficSpeed(v, 80), 0); frame(0.2);
  assert.equal(G.peds.length, 0); assert.equal(v.cityPassengers, 1); assert.equal(ai.stats.boarded, 1);
  for (let i = 0; i < 25; i++) frame(0.2);
  assert.equal(ai.trafficSpeed(v, 80), 80); assert.equal(ai.stats.boarded, 1);
});

test('spatial rebuilding is throttled while movement stays smooth, with a lower mobile budget', () => {
  for (const [quality, max] of [['high', 10], ['low', 7]]) {
    const near = ped(), distant = ped(10000, 10000);
    const { ai } = city({ peds: [near, distant], settings: { quality } });
    for (let i = 0; i < 60; i++) ai.begin(1 / 60);
    assert.ok(ai.stats.indexBuilds <= max); assert.equal(distant.cityState, undefined);
  }
});

test('a resident on a painted crossing steps out of a stopped driver’s path instead of mutually waiting',()=>{
 const p=ped(68,2,{hx:-1,hy:0,rot:-Math.PI/2}),v=car(0,0,{def:{},kind:'fare'}),{G,ai}=city({peds:[p],vehicles:[v]});G.cityAI=ai;
 for(let i=0;i<180;i++){ai.begin(1/60);if(!ai.steerPed(p,1/60)){p.speed=0;} }
 assert.ok(Math.abs(p.y)>39,`resident still blocks the bumper at ${p.x},${p.y}`);assert.ok(ai.trafficSpeed(v,60)>0);
});

test('wrecks remain pedestrian obstacles without provoking a threat reaction',()=>{
 const p=ped(-80,0,{rot:Math.PI/2,hx:1,hy:0,gather:{x:80,y:0}}),v=car(0,0,{def:{},kind:'fare',dead:true});const {G,ai}=city({peds:[p],vehicles:[v]});G.cityAI=ai;
 ai.begin(.1);let seen=false;ai.nearTraffic(0,0,30,other=>{if(other===v)seen=true;});assert.equal(seen,true);assert.equal(p.flee,0);
 for(let i=0;i<120;i++){ai.begin(1/60);ai.steerPed(p,1/60);assert.ok(!(Math.abs(p.x)<52&&Math.abs(p.y)<24));}
});
