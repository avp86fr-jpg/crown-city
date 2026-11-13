import {trackPoint,nearestTrack,CIRCUIT} from '../src/circuit_world.js';
import {circuitPilot} from '../src/motorsport.js';
import { before, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { harness, root } from './harness.js';
import { VN, MISSIONS, missionFlow } from '../src/story.js';
import { readJSON, settingsFrom, flagsFrom, raceCourse, screenToWorld } from '../src/session.js';
import {actionState,startContract} from '../src/action.js';
import {directorState} from '../src/mission_director.js';
let h, G, T;
before(async () => { h = await harness({ stored: { mw_crown_city_settings: '{broken' } }); ({ G, T } = h); });
function mission(index, flags = {}) {
  G.action=actionState();
  G.flags = flagsFrom(flags); G.freeRoam=false;G.race = null; G.vnQueue = []; G.ended = false; G.needsBegin = false;
  G.player = T.makeFoot(G, ...G.meta.spawns.player, 0); G.health = 100; G.chips = 400;
  G.wanted = 0; G.interactP = false; G.input.enterP = false;
  T.beginMission(G, index); T.ensureMissionCar(G); G.gps = null; G.gpsPts = null; G.scene = 'play';
}
function position(at, foot = false) {
  if (foot) G.player = T.makeFoot(G, at.x, at.y, 0);
  else { G.player.x = at.x; G.player.y = at.y; G.player.vx = G.player.vy = 0; }
}
async function dialogue(flags = {}) {
  let guard = 0;
  while (G.scene === 'vn' && guard++ < 30) {
    await h.readyVN();
    const node = G.vn.node;
    if (node.choices) {
      const choice = node.choices.find(c => Object.entries(c.set || {}).every(([k, v]) => flags[k] === v)) || node.choices[0];
      Object.assign(G.flags, choice.set); T.openVN(G, choice.next);
    } else T.openVN(G, node.next);
  }
  if (G.scene === 'brief') T.startPlayFromBrief(G);
}

test('corrupt settings do not block boot; story art is deferred until needed', () => {
  assert.equal(G.scene, 'title');
  assert.equal(G.settings.quality, 'high');
  assert.ok(!h.calls.some(p => p.startsWith('assets/vn/') || p.startsWith('assets/portraits/')));
  assert.equal(readJSON({ getItem() { throw Error('blocked'); } }, 'x'), null);
  const settings = settingsFrom({ mus: Infinity, sfx: -10, quality: 'bad' });
  assert.equal(settings.mus, 0.6); assert.equal(settings.sfx, 0); assert.equal(settings.quality, 'high');
});

test('a title click still works when Web Audio is unavailable', () => {
  T.render(G); const button = G.buttons[0];
  G.canvas.dispatch('pointerdown', { clientX: button.x + 5, clientY: button.y + 5, pointerType: 'mouse' });
  assert.equal(G.scene, 'vn'); assert.equal(G.vn.id, 'intro_news');
});

test('W walks north and accelerates a north-facing car; S brakes or reverses', () => {
  mission(0); G._pulseInput();
  const safe = T.findSafe(G, 2108, 2000, 10, true);
  position(safe, true); const start = G.player.y;
  h.dispatch('keydown', { code: 'KeyW' }); G._pulseInput();
  assert.equal(G.input.y, 1);
  for (let n = 0; n < 20; n++) T.tickPlayer(G, 1 / 60);
  assert.ok(G.player.y < start);
  const car = T.makeVeh('riot', 2108, 2400, 0); G.vehicles.push(car); T.enterVeh(G, car, true);
  for (let n = 0; n < 20; n++) T.tickPlayer(G, 1 / 60);
  assert.ok(car.vy < 0);
  h.dispatch('keyup', { code: 'KeyW' }); h.dispatch('keydown', { code: 'KeyS' }); G._pulseInput();
  assert.equal(G.input.y, -1); h.dispatch('keyup', { code: 'KeyS' }); G._pulseInput();
});

test('focus loss clears keyboard, mouse and touch holds and pauses active play', () => {
  mission(0); G.input.tFire = true; G.input.mouse.down = true; G.input.touchJoy.active = true;
  h.dispatch('keydown', { code: 'KeyW' }); h.dispatch('blur'); G._pulseInput();
  assert.equal(G.scene, 'pause'); assert.equal(G.input.x, 0); assert.equal(G.input.y, 0);
  assert.equal(G.input.fire, false); assert.equal(G.input.touchJoy.active, false);
});

test('mission anchors are reachable on the actual collision map', () => {
  for (const key of ['casinoDoor', 'casino', 'casinoLot', 'neural', 'pd']) {
    const at = G.meta.interactions[key]; assert.ok(T.footClear(G, ...at, 8), key);
    assert.ok(G.nav.raw[Math.floor((at[1] + (G.nav.OY||0)) / G.nav.C) * G.nav.NW + Math.floor(at[0] / G.nav.C)], key);
  }
  assert.ok(Math.hypot(G.meta.interactions.casinoLot[0] - G.meta.interactions.casinoDoor[0],
    G.meta.interactions.casinoLot[1] - G.meta.interactions.casinoDoor[1]) > 150);
});
test('campaign objective transitions retain the active crew route',()=>{
 mission(0);startContract(G,'rescue');const marker={...G.waypoint};
 const car=G.vehicles.find(v=>v.mission&&v.kind==='riot');T.enterVeh(G,car,true);T.tickMission(G,1/60);
 assert.deepEqual(G.waypoint,marker);assert.equal(G.action.contract.id,'rescue');
 T.beginMission(G,1);assert.deepEqual(G.waypoint,marker);
});
test('civilian explosion casualties count only when the player caused ignition',()=>{
 G.director=directorState();mission(0);G.player=T.makeFoot(G,2108,2400,0);G.peds=[];G.vehicles=[];
 const baseline=G.director.active.civilianHarm;
 for(const byPlayer of [false,true]){
  const car=T.makeVeh('fare',2108,2200,0);G.vehicles=[car];
  G.peds=[{x:2108,y:2205,hp:30,dead:false,speed:0,rot:0,dist:0,walk:30}];
  T.damageVeh(G,car,95,byPlayer);assert.equal(car.playerIgnited,byPlayer);T.explode(G,car);
  assert.equal(G.director.active.civilianHarm,baseline+(byPlayer?1:0));
 }
});

test('collecting a package requires deliberate interaction and a slow vehicle', () => {
  mission(0); G.objectiveIndex = 2;
  position(T.currentObjectivePos(G), true); const chips = G.chips;
  T.tickMission(G, 1 / 60); assert.equal(G.objectiveIndex, 2); assert.equal(G.chips, chips);
  G.interactP = true; T.tickMission(G, 1 / 60); G.interactP = false;
  assert.equal(G.objectiveIndex, 3); assert.equal(G.chips, chips + 800);
  const state = T.snapshot(G); T.restoreState(G, state);
  assert.equal(G.objectiveIndex, 3); assert.equal(G.chips, chips + 800);
});

test('casing the Palace requires being on foot and holding still', () => {
  mission(3); const at = T.currentObjectivePos(G);
  const car = T.makeVeh('riot', at.x, at.y, 0); G.player = car;
  T.tickMission(G, 3); assert.equal(G.objectiveIndex, 0);
  position(at, true); G.player.speed = 70; T.tickMission(G, 3); assert.equal(G.objectiveIndex, 0);
  G.player.speed = 0; for (let n = 0; n < 125; n++) T.tickMission(G, 1 / 60);
  assert.equal(G.objectiveIndex, 1);
});

test('the convoy must be disabled with actual weapon damage before collecting its plate',()=>{
  mission(0);G.objectiveIndex=1;G.van.health=100;G.van.dead=false;G.bullets=[];
  G.player=T.makeFoot(G,G.van.x,G.van.y-100,Math.PI);G.input.mouse.fire=false;
  T.tickMission(G,1/60);assert.equal(G.objectiveIndex,1);
  for(let shot=0;shot<4;shot++){
    G.action.shotT=0;T.shoot(G,G.player,true);
    for(let f=0;f<14;f++)T.tickBullets(G,1/60);
  }
  assert.ok(G.van.health<=65);T.tickMission(G,1/60);assert.equal(G.objectiveIndex,2);assert.equal(G.van.loose,true);
});

test('archive transfer can be interrupted by firing and pays only after the full stationary hold',()=>{
  mission(4);G.objectiveIndex=1;position(T.currentObjectivePos(G),true);G.input.fire=false;G.interactP=true;T.tickMission(G,1/60);G.interactP=false;
  for(let f=0;f<60;f++)T.tickMission(G,1/60);assert.equal(G.objectiveIndex,1);
  G.input.fire=true;T.tickMission(G,1/60);assert.equal(G.missionState.holdT,0);G.input.fire=false;
  for(let f=0;f<200;f++)T.tickMission(G,1/60);assert.equal(G.objectiveIndex,1);
  G.interactP=true;for(let f=0;f<181;f++)T.tickMission(G,1/60);G.interactP=false;assert.equal(G.objectiveIndex,2);
});

test('race gates close the lap at the start, freeze the countdown and can be lost', () => {
  mission(1); G.objectiveIndex = 1;
  const car = T.makeVeh('dart', ...G.meta.spawns.raceStart, Math.PI / 2); G.player = car; G.vehicles.push(car);
  T.startRace(G); assert.deepEqual(G.race.pts.at(-1), [trackPoint(0).x,trackPoint(0).y]);
  const x = car.x; G.input.x = 0; G.input.y = 1; T.tickPlayer(G, 1); assert.equal(car.x, x);
  G.race.countdown = 0; G.race.started = true; G.race.rivalI = G.race.pts.length;
  const chips = G.chips; T.tickRace(G, {}, 1 / 60);
  assert.equal(G.missionIndex, 1); assert.equal(G.objectiveIndex, 0); assert.equal(G.chips, chips);
  assert.equal(G.race, null); assert.equal(G.vn.id, 'm2_lose');
});

test('race progress and the rival position survive save/resume', () => {
  mission(1); G.objectiveIndex = 1;
  G.player = T.makeVeh('dart', ...G.meta.spawns.raceStart, Math.PI / 2); G.vehicles=[G.player];
  T.startRace(G); G.race.i = 4; G.race.rivalI = 3; G.race.t = 12.5; G.race.countdown = 0;
  const saved = T.snapshot(G); T.restoreState(G, saved);
  assert.equal(G.race.i, 4); assert.equal(G.race.rivalI, 3); assert.equal(G.race.t, 12.5);
  assert.equal(G.race.countdown, 0);
});

test('a starter Riot can win the full Grand Prix lap using real physics and collision data', () => {
  mission(1); G.objectiveIndex = 1;
  const car = T.makeVeh('riot', ...G.meta.spawns.raceStart, Math.PI / 2);
  G.player = car; G.vehicles = [car]; T.startRace(G, G._flow.objectives[1]);
  assert.equal(G.race.pts.length,32);assert.ok(G.race.pts.every(p=>nearestTrack(...p).d<1));car.racerIndex=0;
  G.race.countdown = 0; G.race.started = true;
  let frames = 0;
  while (G.race && frames++ < 60*240) {
    G.ticks++;
    T.tickDrive(G,car,circuitPilot(G,car,1/60),1/60,true);
    G.cam.x=car.x;G.cam.y=car.y;
    T.tickVehicles(G, 1 / 60); T.tickRace(G, {}, 1 / 60);
  }
  assert.ok(car.health>60,'clean circuit drive should preserve the starter car');
  assert.ok(frames < 60*240); assert.equal(G.missionIndex, 2); assert.equal(G.vn.id, 'm2_win');
  console.log('Stock Riot physics race won in', frames, 'ticks');
});

test('quiet and loud heists differ; deferred fees are paid exactly once', () => {
  for (const [heist, wanted] of [['quiet', 2], ['loud', 5]]) {
    mission(4, { heist, scrambler: true, neuralDebt: 600 }); G.objectiveIndex = 1;
    position(T.currentObjectivePos(G), true); G.interactP = true;
    for(let n=0;n<181;n++)T.tickMission(G,1/60);
    G.interactP = false;
    assert.equal(G.wanted, wanted); assert.equal(G.flags.neuralDebt, 0); assert.equal(G.chips, 4800);
    assert.equal(G.missionState.scramblerT, heist === 'quiet' ? 90 : 0);
    const saved = T.snapshot(G); T.restoreState(G, saved);
    assert.equal(G.chips, 4800); assert.equal(G.objectiveIndex, 2); assert.equal(G.flags.vaultBag, true);
  }
});

test('Neural can defer a short balance, preventing an economy dead end', () => {
  mission(2, { finance: 'upfront' }); G.chips = 100;
  position(T.currentObjectivePos(G), true); T.tickMission(G, 1 / 60);
  assert.equal(G.chips, 0); assert.equal(G.flags.neuralDebt, 500); assert.equal(G.objectiveIndex, 1);
});

test('the reserved launch is stationary and boardable from reachable land', () => {
  mission(4); const boat = G.vehicles.find(v => v.getawayBoat && !v.dead);
  assert.ok(boat); assert.equal(boat.role, undefined);
  const shore = T.findSafe(G, boat.x, boat.y, 8, true);
  assert.ok(Math.hypot(shore.x - boat.x, shore.y - boat.y) < 72);
  position(shore, true); T.enterVeh(G, boat, true); assert.equal(G.player, boat);
});

test('job six unlocks and supplies a Nyx at the marina', () => {
  mission(5); G.objectiveIndex = 1; T.ensureMissionCar(G);
  assert.ok(G.unlocked.includes('nyx'));
  const car = G.vehicles.find(v => v.mission && v.kind === 'nyx' && !v.dead);
  assert.ok(car); assert.ok(!['water', 'canal', 'build'].includes(G.surfaceAt(car.x, car.y)));
  T.enterVeh(G, car, true); T.tickMission(G, 1 / 60); assert.equal(G.objectiveIndex, 2);
});

test('checkpoints restore receipts and position without creating duplicate player cars', () => {
  mission(0); const car = G.vehicles.find(v => v.mission && v.kind === 'riot' && !v.dead);
  T.enterVeh(G, car, true); T.tickMission(G, 1 / 60);
  const checkpoint = G.checkpoint; assert.equal(checkpoint.objectiveIndex, 1);
  const count = G.vehicles.length; G.chips = 0; G.player.x += 10;
  T.retryObjective(G); T.retryObjective(G);
  assert.equal(G.objectiveIndex, 1); assert.equal(G.chips, checkpoint.chips);
  assert.ok(G.vehicles.length <= count + 1); assert.equal(G.scene, 'play');
});

test('finished and malformed legacy saves never restart mission one or crash', () => {
  T.restoreState(G, { missionIndex: 6, objectiveIndex: 20, px: NaN, py: Infinity, chips: -10 });
  assert.equal(G.scene, 'end'); assert.equal(G._flow, null); assert.equal(G.chips, 0);
  T.restoreState(G, { missionIndex: 2, objectiveIndex: 0, px: 750, py: 1190, ptype: 'foot' });
  assert.equal(G.scene, 'play'); assert.ok(T.footClear(G, G.player.x, G.player.y, 7));
});

test('coordinate transforms round-trip with a rotated camera', () => {
  G.cam.rot = 0.7; G.cam.scale = 1.3;
  const expected = { x: G.cam.x + 200, y: G.cam.y - 140 };
  const screen = T.worldToScreen(G, expected.x, expected.y), point = screenToWorld(G, screen.x, screen.y);
  assert.ok(Math.abs(point.x - expected.x) < 1e-6 && Math.abs(point.y - expected.y) < 1e-6);
  G.cam.rot = 0;
});

test('police lose sight behind real occlusion and the scrambler expires', () => {
  mission(4, { heist: 'quiet', scrambler: true });
  G.wanted = 2; G.missionState.scramblerT = 90;
  const oldNav = G.nav;
  G.nav = { ...oldNav, clearLine: () => false };
  G.cops = [T.makeVeh('metro', G.player.x + 100, G.player.y, 0)];
  G.peds = [{ copPed: true, dead: false, x: G.player.x + 30, y: G.player.y }];
  G.vehicles.push(...G.cops); G.ticks = 1;
  for (let i = 0; i < 60; i++) T.tickWanted(G, 1 / 60);
  assert.equal(G.evading, true); assert.ok(G.seenT > 0.99); assert.ok(G.missionState.scramblerT < 90);
  T.crime(G, 1, G.player.x, G.player.y, false, 3); assert.equal(G.missionState.scramblerT, 0);
  G.nav = oldNav; G.cops = []; G.peds = [];
});

test('GPS work is bounded by simulation ticks rather than display refresh', () => {
  mission(0); G.ticks = 100; G.gps = null;
  const nav = G.nav, flood = nav.flood, route = nav.route;
  let floods = 0, routes = 0;
  nav.flood = (...args) => { floods++; return flood(...args); };
  nav.route = (...args) => { routes++; return route(...args); };
  for (let n = 0; n < 100; n++) T.updateGPS(G);
  assert.equal(floods, 1); assert.equal(routes, 1);
  nav.flood = flood; nav.route = route;
});

test('map clicks place a waypoint and JOB ROUTE restores mission guidance', () => {
  mission(0); T.drawMap(G); const m = G.mapView;
  G.scene = 'map';
  G.canvas.dispatch('pointerdown', { clientX: m.x + m.w / 2, clientY: m.y + m.h / 2, pointerType: 'mouse' });
  assert.ok(G.waypoint); assert.equal(G.input.mouse.fire, false);
  const route = G.buttons.find(b => b.x === 18 * G.ui); route.act(); assert.equal(G.waypoint, null);
});

test('title with a saved game and menu controls fit desktop and phone sizes', () => {
  mission(0);
  G.saveExists = true;
  for (const [w, height] of [[1280, 720], [844, 390], [390, 844], [667, 375]]) {
    window.innerWidth = w; window.innerHeight = height; T.fit(G);
    for (const scene of ['title', 'pause', 'map', 'settings', 'brief']) {
      G.scene = scene; G.pausedFrom = 'play'; T.render(G);
      for (const b of G.buttons) assert.ok(b.w > 0 && b.h > 0 && b.x >= -1 && b.x + b.w <= G.canvas.width + 1 && b.y >= -1 && b.y + b.h <= G.canvas.height + 1, scene);
    }
  }
  window.innerWidth = 1280; window.innerHeight = 720; T.fit(G);
});

for (const choices of [
  { stash: 'safe', heist: 'quiet', finance: 'upfront' },
  { stash: 'flip', heist: 'loud', finance: 'credit' }
]) test('all six jobs and story chains complete: ' + Object.values(choices).join('/'), async () => {
  T.startNew(G); await dialogue(choices);
  const original = VN.m1_win_safe.next;
  let steps = 0;
  while (G.missionIndex < MISSIONS.length && steps++ < 60) {
    await dialogue(choices);
    const obj = G._flow?.objectives[G.objectiveIndex]; assert.ok(obj);
    if (obj.kind === 'enter') {
      T.ensureMissionCar(G); const kind = obj.vehicle || 'riot';
      const car = G.vehicles.find(v => v.mission && v.kind === kind && !v.dead);
      T.enterVeh(G, car, true);
    } else if (obj.kind === 'enterBoat') {
      T.ensureGetawayBoat(G); T.enterVeh(G, G.vehicles.find(v => v.getawayBoat && !v.dead), true);
    } else if (obj.kind === 'loseWanted') G.wanted = 0;
    else if (obj.kind === 'race') {
      T.startRace(G, obj); G.race.countdown = 0; G.race.started = true;
      const pts = G.race.pts.map(p => p.slice());
      for (const point of pts) { position({ x: point[0], y: point[1] }); T.tickRace(G, obj, 1 / 60); }
      continue;
    } else {
      const at = T.currentObjectivePos(G); assert.ok(at, obj.id);
      position(at, obj.foot || obj.kind === 'stealCop');
      if(obj.kind==='intercept')G.van.health=65;
      if (obj.clearHeat) G.wanted = 0;
      if (obj.kind === 'collect' || obj.kind === 'stealCop') G.interactP = true;
    }
    if (obj.hold || obj.hack) { for (let n = 0; n < Math.ceil((obj.hold||obj.hack)*60)+1; n++) T.tickMission(G, 1 / 60); }
    else T.tickMission(G, 1 / 60);
    G.interactP = false;
  }
  await dialogue(choices);
  assert.equal(G.missionIndex, 6); assert.equal(G.scene, 'end'); assert.equal(G.flags.neuralDebt, 0);
  assert.equal(G.chips, choices.stash === 'flip' ? 9200 : 7500);
  assert.equal(VN.m1_win_safe.next, original);
  assert.ok(G.unlocked.includes('nyx'));
  T.loadSave(G); assert.equal(G.scene, 'end');
  T.render(G);G.buttons.find(b=>b.label==='KEEP DRIVING').act();assert.equal(G.scene,'play');assert.equal(G.freeRoam,true);
  T.loadSave(G);assert.equal(G.scene,'play');assert.equal(G.missionIndex,6);assert.equal(G._flow,null);assert.equal(G.freeRoam,true);
});
