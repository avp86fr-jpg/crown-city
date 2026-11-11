import { bodySize, localPoint, circleBody, segmentBody, segmentCircle, bodyContact, nearbyPairs, worldBodyHit, waterBerth, muzzleLength } from './collision.js';
import { AIRCRAFT_DEFS, airborne, spawnAircraft, tickAircraft, aircraftSnapshot, restoreAircraft, drawAircraft, aviationHint, canExitAircraft } from './aviation.js';
import { initExpansion, tickExpansion, interactExpansion, drawExpansionPeople, drawExpansionHUD } from './expansion.js';
import { drawExpansionOverhead } from './expansion_world.js';
import { drawMobileWorld } from './mobile_renderer.js';
import { vehiclePose, characterPose, drawVehicleFinish, drawWetReflections, drawAtmosphere, drawParticleFX, drawGrade, drawArchitectureLights, drawObjectiveHalo, drawSpeedometer } from "./visuals.js";
import { loadImage as loadImg } from "./assets.js";
import { readJSON, settingsFrom, flagsFrom, finite, screenToWorld, raceCourse, resetInput } from "./session.js";
import { createAudio } from "./audio.js";
import { CHAR, MISSIONS, VN, missionFlow } from "./story.js";
import { buildWorld, makeCollision, districtAt, WORLD_W, WORLD_H, CORE, CODE } from "./world.js";
import { TileLayer, makeGround, makeBuildings } from "./render_world.js";
import { buildGraph, createTraffic, createPeds, createNav, edgePoint, lightGreen } from "./traffic.js";
import { createLighting, ambientAt, darkness, sunAt, timeLabel, LIGHT } from "./lighting.js";
import { actionState, actionSave, WEAPONS, tickAction, requestShot, servicePoints, nearService, applyTune, message } from './action.js';
import { drawActionHUD, drawCrew, drawWorkshop } from './action_ui.js';
import { buildStreetScene, drawStreetScene, drawRoofDetail, drawAmbientGesture } from './citylife.js';
import { aimDirection, bindTouchAim, installFullscreen, syncControlStyle } from './controls.js';
import { createCityAI } from './city_ai.js';
import { drawTitleScreen, drawPauseScreen, drawSettingsScreen, drawMissionBrief, drawDossier } from './presentation.js';
import { drawMobileHUD } from './mobile_hud.js';
import { restoreStreetRoute, streetJobTarget } from './side_jobs.js';
import { directorState, directorSave, beginJob, tickDirector, finishJob, recordIncident, jobBrief } from './mission_director.js';

const SAVE_KEY = "mw_crown_city_v1";
const FREE_SAVE_KEY = "mw_crown_city_freeride_v1";
const WORLD = 4096; // painted core size
const SETTINGS_KEY = "mw_crown_city_settings";
const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const angNorm = (a) => {
  while (a > Math.PI) a -= TAU;
  while (a < -Math.PI) a += TAU;
  return a;
};
const now = () => performance.now() / 1000;

const VEH_DEFS = {
  nyx: { name: "Nyx Sixteen", kind: "hyper", sprite: "nyx", accel: 280, max: 340, steer: 2.4, grip: 0.9, brake: 340, mass: 1.4, r: 28 },
  riot: { name: "Riot V8", kind: "muscle", sprite: "riot", accel: 200, max: 240, steer: 2.05, grip: 0.74, brake: 260, mass: 1.3, r: 26 },
  dart: { name: "Neon Dart", kind: "sports", sprite: "dart", accel: 240, max: 280, steer: 2.5, grip: 0.82, brake: 300, mass: 1.0, r: 24 },
  fare: { name: "Fare Lane", kind: "sedan", sprite: "fare", accel: 150, max: 190, steer: 2.2, grip: 0.8, brake: 220, mass: 1.15, r: 24 },
  metro: { name: "Metro PD", kind: "police", sprite: "metro", accel: 190, max: 230, steer: 2.25, grip: 0.8, brake: 260, mass: 1.2, r: 25, cop: true },
  stitch: { name: "Stitch S", kind: "bike", sprite: "stitch", accel: 230, max: 260, steer: 3.15, grip: 0.62, brake: 260, mass: 0.55, r: 14, bike: true },
  hog: { name: "Iron Hog", kind: "bike", sprite: "hog", accel: 170, max: 200, steer: 2.4, grip: 0.7, brake: 200, mass: 0.7, r: 15, bike: true },
  wake: { name: "Wake 39", kind: "boat", sprite: "wake", accel: 160, max: 210, steer: 2.0, grip: 0.45, brake: 80, mass: 1.1, r: 26, boat: true },
  gulf: { name: "Gulf Queen", kind: "boat", sprite: "gulf", accel: 110, max: 150, steer: 1.6, grip: 0.5, brake: 70, mass: 1.6, r: 30, boat: true },
  van: { name: "Seed Van", kind: "sedan", sprite: "fare", accel: 80, max: 110, steer: 1.6, grip: 0.85, brake: 160, mass: 1.8, r: 28, van: true },
  taxi: { name: "Crown Cab", kind: "sedan", sprite: "taxi", accel: 150, max: 180, steer: 2.1, grip: 0.8, brake: 220, mass: 1.15, r: 24 },
  ambulance: { name: "Mercy Unit", kind: "sedan", sprite: "ambulance", accel: 200, max: 220, steer: 2.15, grip: 0.8, brake: 240, mass: 1.2, r: 26 },
  bus: { name: "Line 7", kind: "sedan", sprite: "bus", accel: 80, max: 110, steer: 1.3, grip: 0.85, brake: 180, mass: 2.4, r: 36 },
};
// the city is ~6x bigger now: everything drivable gets more legs (scripted van/bus stay slow)
for (const [k, d] of Object.entries(VEH_DEFS)) if (k !== "van" && k !== "bus") { d.max = Math.round(d.max * 1.3); d.accel = Math.round(d.accel * 1.4); }

Object.assign(VEH_DEFS, AIRCRAFT_DEFS);

function vehScale(def) {
  if (!def) return 0.283;
  if (def.sprite === "nyx") return 0.30;
  if (def.sprite === "riot") return 0.30;
  if (def.sprite === "dart") return 0.275;
  if (def.sprite === "bus") return 0.33;
  if (def.sprite === "gulf") return 0.36;
  if (def.sprite === "wake") return 0.28;
  if (def.bike) return 0.22;
  if (def.boat) return 0.30;
  return 0.283;
}
function charScale(sprite, spr) {
  const fh = spr.height / 8;
  // Chaos sheet cells are 224px with a ~208px figure; peds are 128px with a ~110px figure.
  // Target: people ~54–60 world px tall (still under half a sedan / Nyx).
  if (sprite === "chaos") return 56 / (fh * .92);
  if (sprite === "hunter" || sprite === "fire") return 56 / 110;
  return 58 / 110;
}

const SURFACE = { 0: "road", 1: "walk", 2: "build", 3: "water", 4: "sand", 5: "grass", 6: "track", 7: "pier", 8: "canal", 9: "lot", 10: "dirt" };
const GRIP = { road: 1, walk: 0.8, build: 0.2, water: 0.15, sand: 0.5, grass: 0.6, track: 1.05, pier: 0.75, canal: 0.15, lot: 0.95, dirt: 0.62 };
const FOOT_OK = new Set(["road", "walk", "sand", "grass", "track", "pier", "lot", "dirt"]);


export async function boot() {
  const canvas = document.getElementById("c");
  const wrap = document.getElementById("wrap");
  const ctx = canvas.getContext("2d", { alpha: true, desynchronized: true });
  const audio = createAudio();
  const input = createInput();

  drawBoot(ctx, canvas, 0.05, "Loading Crown City…");
  const texNames = ["asphalt", "asphalt_hw", "concrete", "dirt", "glass", "grass", "lot", "paver", "paver_warm", "sand", "tar", "water", "roof_gravel", "roof_gravel2", "roof_metal", "roof_metal2", "roof_terra", "roof_terra2"];
  const tex = {};
  const [manifest, meta, maskImg, minimapCore, title, starOn, starOff, chipIcon, hero] = await Promise.all([
    fetch("assets/tiles/manifest.json").then((r) => r.json()),
    fetch("assets/city/meta.json").then((r) => r.json()),
    loadImg("assets/city/mask_gray.png"),
    loadImg("assets/city/minimap.png"),
    loadImg("assets/ui/title.jpg"),
    loadImg("assets/ui/star_on.png"),
    loadImg("assets/ui/star_off.png"),
    loadImg("assets/ui/chip.png"),
    loadImg("assets/premium/title-cover.webp"),
    ...texNames.map((n) => loadImg(`assets/tex/${n}.webp`).then((i) => (tex[n] = i))),
  ]);
  drawBoot(ctx, canvas, 0.35, "Loading cars and crews…");
  const layers = {};
  for (const [k, keys] of Object.entries(manifest.layers)) layers[k] = new TileLayer(k, keys, manifest.tile);

  const sprites = {};
  const mobileArt=navigator.maxTouchPoints>0;
  const vehNames = ["gulf", "fare_wreck", "metro_wreck"];
  const charNames = ["chaos", "hunter", "fire"];
  const propNames = ["hydrant", "bin", "cone", "newsstand", "planter", "mailbox", "palm"];
  await Promise.all([
    ...vehNames.map((n) => loadImg(`assets/sprites/veh_${n}.png`).then((i) => (sprites["veh_" + n] = i))),
    ...charNames.map((n) => loadImg(n === 'chaos' ? `assets/premium/chaos${mobileArt?'-mobile':''}.webp` : `assets/sprites/char_${n}.png`).then((i) => (sprites["char_" + n] = i))),
    loadImg(`assets/premium/vehicles${mobileArt?'-mobile':''}.webp`).then(i => (sprites.vehicle_atlas = i)),
    loadImg(`assets/premium/crowd${mobileArt?'-mobile':''}.webp`).then(i => (sprites.crowd_atlas = i)),
    loadImg(`assets/premium/city-fleet${mobileArt?'-mobile':''}.webp`).then(i => (sprites.city_fleet = i)),
    ...propNames.map((n) => loadImg(`assets/sprites/prop_${n}.png`).then((i) => (sprites["prop_" + n] = i))),
    loadImg("assets/fx/explosion.png").then((i) => (sprites.explosion = i)),
    loadImg("assets/fx/smoke.png").then((i) => (sprites.smoke = i)),
    loadImg("assets/fx/spark.png").then((i) => (sprites.spark = i)),
  ]);
  drawBoot(ctx, canvas, 0.6, "Laying out the city…");

  // Collision mask (painted core) → 2048 grid
  const MS = 2048;
  const mcv = document.createElement("canvas");
  mcv.width = mcv.height = MS;
  const mctx = mcv.getContext("2d", { willReadFrequently: true });
  mctx.imageSmoothingEnabled = false;
  mctx.drawImage(maskImg, 0, 0, MS, MS);
  const md = mctx.getImageData(0, 0, MS, MS).data;
  const coreMask = new Uint8Array(MS * MS);
  for (let i = 0; i < coreMask.length; i++) coreMask[i] = md[i * 4];
  mcv.width = mcv.height = 1;
  const world = buildWorld(meta, coreMask, MS);
  const codeAt = makeCollision(world, coreMask, MS);
  const surfaceAt = (x, y) => SURFACE[codeAt(x, y)] || "sand";
  const solidAt = (x, y) => { const c = codeAt(x, y); return c === 2; };

  const assets = { title, starOn, starOff, chipIcon, sprites, meta, hero, tex, layers };
  const settings = settingsFrom(readJSON(localStorage, SETTINGS_KEY, {}), navigator.maxTouchPoints > 0);

  const G = {
    canvas, ctx, wrap, audio, input, assets, codeAt, surfaceAt, solidAt, meta, world, settings,
    mode: "story",
    scene: "title", // title | vn | play | pause | settings | end | brief | map
    flags: { stash: "safe", heist: "quiet", scrambler: false },
    missionIndex: 0,
    objectiveIndex: 0,
    unlocked: ["riot", "fare", "hog", "wake", "gulf"],
    chips: 400,
    wanted: 0,
    wantedCool: 0,
    time: 19.4,
    weather: "clear",
    weatherT: 90,
    wet: 0, fog: 0, sand: 0, rainAmt: 0, lightning: 0, lightningT: 8,
    cam: { x: 920, y: 3220, rot: 0, scale: 1.05, northUp: true, shake: 0 },
    titleT: 0,
    player: null,
    vehicles: [], peds: [], cops: [], bullets: [], particles: [], skids: [], props: [], flashes: [],
    van: null, race: null, vn: null,
    hint: "", toast: "", toastT: 0, radioName: "", radioT: 0, banner: null, jack: null,
    pickups: [], floaters: [], buttons: [],
    pausedFrom: "play", settingsSel: 0, titleSel: 0, fade: 1, ended: false, needsBegin: false,
    ticks: 0, dtStat: 0, fps: 60,
    saveExists: !!readJSON(localStorage, SAVE_KEY),
    lastShot: 0, health: 100,
    storyLoads: new Map(),
    touch: false, missionState: {}, vnQueue: [], checkpoint: null, waypoint: null,
    action: actionState(),
    director: directorState(),
  };
  G.makeVeh = makeVeh;
  G.ground = makeGround(world, tex, codeAt);
  G.bld = makeBuildings(world, tex, layers.roofs);
  G.light = createLighting();
  G.graph = buildGraph(world, meta);
  G.traffic = createTraffic(G);
  G.pedsys = createPeds(G);
  applyQuality(G);
  G.nav = createNav(G);
  G.crossOk = (p) => {
    for (const n of G.graph.nodes) {
      if (Math.abs(n.x - p.x) < n.hw + 90 && Math.abs(n.y - p.y) < n.hh + 90) {
        const goingNS = Math.abs(p.hy) > Math.abs(p.hx);
        const phase = ((G.ticks / 60) % 16);
        // cross with the parallel green
        return goingNS ? phase < 6 : (phase >= 8 && phase < 14);
      }
    }
    return false;
  };
  G.minimap = buildMinimap(G, minimapCore);
  audio.setSfx && audio.setSfx(settings.sfx);
  audio.setMus && audio.setMus(settings.mus);
  if (settings.master != null && audio.setMaster) audio.setMaster(settings.master);

  setupTouch(G);
  bindKeys(G);
  hookFullscreen(G);
  spawnWorld(G);
  G.findSafeAction = (x,y) => findSafe(G,x,y,10,true);
  servicePoints(G); buildStreetScene(G);
  G.cityAI = createCityAI(G);
  G.player = makeFoot(G, meta.spawns.player[0], meta.spawns.player[1], 0);
  initExpansion(G);
  seedPickups(G);
  // Warm the first city tiles without running the city behind the static title.
  await Promise.race([layers.albedo.preload(["2_1", "2_2", "1_1", "1_2"]), new Promise((r) => setTimeout(r, 2500))]);

  window.__CC = api(G);
  window.addEventListener("pointerdown", () => G.audio.unlock(), { once: true });
  window.addEventListener("touchend", () => G.audio.unlock(), { once: true });
  window.addEventListener("keydown", () => G.audio.unlock(), { once: true });

  let acc = 0, last = now(), lastRender = 0;
  const STEP = 1 / 60;
  function frame() {
    const t = now();
    if(document.hidden){last=t;acc=0;requestAnimationFrame(frame);return;}
    let dt = Math.min(0.1, t - last);
    last = t;
    acc += dt;
    G.dtStat = dt;
    G.fps = lerp(G.fps, 1 / Math.max(0.001, dt), 0.05);
    let n = 0;
    const _t0 = performance.now();
    while (acc >= STEP && n++ < 6) {
      tick(G, STEP);
      acc -= STEP;
    }
    if (acc > STEP * 6) acc = 0;
    const _t1 = performance.now();
    // The simulation stays at 60 Hz; battery mode presents at 30 Hz.
    if((!G.settings.batterySaver && G.scene==='play') || t-lastRender>=1/30-.002 || G.scene!==G._renderScene){
      const elapsed=lastRender?t-lastRender:dt;lastRender=t;G._renderScene=G.scene;
      adaptRes(G, dt);render(G);G.presentFps=lerp(G.presentFps||60,1/Math.max(.001,elapsed),.1);
      prof(G,'render',performance.now()-_t1);
    }
    prof(G, "tick", _t1 - _t0);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  return G;
}

function buildMinimap(G, coreImg) {
  const S = 8; // world px per minimap px
  const W = WORLD_W / S, H = WORLD_H / S;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const x = c.getContext("2d");
  const img = x.createImageData(W, H);
  const col = { 0: [52, 54, 62], 1: [150, 146, 138], 2: [96, 84, 92], 3: [30, 86, 122], 4: [196, 170, 118], 5: [70, 118, 56], 6: [70, 70, 76], 7: [120, 96, 70], 8: [30, 86, 122], 9: [110, 110, 114], 10: [134, 112, 82] };
  for (let y = 0; y < H; y++) for (let xx = 0; xx < W; xx++) {
    const c0 = G.codeAt(xx * S + 4, y * S + 4);
    const k = col[c0] || [0, 0, 0];
    const i = (y * W + xx) * 4;
    img.data[i] = k[0]; img.data[i + 1] = k[1]; img.data[i + 2] = k[2]; img.data[i + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  if (coreImg) { x.globalAlpha = 0.85; x.drawImage(coreImg, 0, 0, CORE / S, CORE / S); x.globalAlpha = 1; }
  return { c, S };
}

function drawBoot(ctx, canvas, p, msg) {
  ctx.fillStyle = "#0a0810";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#f2c14e";
  ctx.font = "600 28px system-ui";
  ctx.fillText("CROWN CITY", 80, 200);
  ctx.fillStyle = "#c8c8d0";
  ctx.font = "16px system-ui";
  ctx.fillText(msg, 80, 240);
  ctx.fillStyle = "#1a1620";
  ctx.fillRect(80, 270, 400, 8);
  ctx.fillStyle = "#ff2d9b";
  ctx.fillRect(80, 270, 400 * p, 8);
}

function makeFoot(G, x, y, rot) {
  return { type: "foot", x, y, rot, vx: 0, vy: 0, speed: 0, dist: 0, shoot: false, sprite: "chaos", r: 10 };
}

function makeVeh(kind, x, y, rot, extra = {}) {
  const def = VEH_DEFS[kind];
  return {
    type: "veh", kind, def, x, y, rot, vx: 0, vy: 0, lean: 0, health: 100, parked: true, driver: null,
    r: def.r, torn: false, ...(def.aircraft ? { altitude:0, verticalSpeed:0, airspeed:0, rotor:0 } : {}), ...extra,
  };
}

function clearAt(G, x, y, r, foot = true) {
  const ok = (s) => foot ? FOOT_OK.has(s) : (s !== "build" && s !== "water" && s !== "canal");
  if (!ok(G.surfaceAt(x, y))) return false;
  for (let a = 0; a < 8; a++) {
    const ang = a * Math.PI / 4;
    if (!ok(G.surfaceAt(x + Math.cos(ang) * r, y + Math.sin(ang) * r))) return false;
  }
  return true;
}
// nearest open spot with clearance r that also reaches the street grid
function findSafe(G, x, y, r = 14, foot = true, offRoad = false) {
  const good = (px, py) => clearAt(G, px, py, r, foot) && navOk(G, px, py) && (!offRoad || G.surfaceAt(px, py) !== "road");
  if (good(x, y)) return { x, y };
  for (let rad = 8; rad < 900; rad += 8) {
    const n = Math.max(8, Math.round(rad / 6));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      const px = x + Math.cos(a) * rad, py = y + Math.sin(a) * rad;
      if (good(px, py)) return { x: px, y: py };
    }
  }
  return offRoad ? findSafe(G, x, y, r, foot, false) : { x, y };
}
function navOk(G, x, y) {
  const N = G.nav; if (!N) return true;
  if (!N.reach) {
    N.reach = new Uint8Array(N.NW * N.NH);
    const q = [];
    const s = ((2108 / N.C) | 0) + ((2000 / N.C) | 0) * N.NW;
    q.push(s); N.reach[s] = 1;
    while (q.length) {
      const i = q.pop(); const xx = i % N.NW, yy = (i / N.NW) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = xx + dx, ny = yy + dy; if (nx < 0 || ny < 0 || nx >= N.NW || ny >= N.NH) continue;
        const j = ny * N.NW + nx; if (!N.reach[j] && N.raw[j]) { N.reach[j] = 1; q.push(j); }
      }
    }
  }
  return !!N.reach[((y / N.C) | 0) * N.NW + ((x / N.C) | 0)];
}

function spawnWorld(G) {
  const meta = G.meta;
  G.props = meta.props.map((p) => ({ ...p, broken: false, vx: 0, vy: 0, spin: 0 }));
  G.vehicles = [];
  G.peds = [];
  G.cops = [];
  G.bullets = [];
  const car = findSafe(G, 920, 3236, 30, false);
  const spawn = findSafe(G, car.x - 52, car.y, 10, true, true);
  meta.spawns.player = [spawn.x, spawn.y];
  // the getaway now runs the whole east highway out to the city edge
  { const d = findSafe(G, 9700, 3900, 30, false); meta.spawns.desert = [d.x, d.y]; }
  G.vehicles.push(makeVeh("riot", car.x, car.y, Math.PI, { keep: true, mission: true }));
  meta.spawns.garage = [car.x, car.y];
  // keep the lane in front of the Riot clear: the spare cab waits across the road, facing north
  // Mission markers belong at reachable entrances, not deep inside painted roofs.
  meta.interactions = {};
  for (const key of ['casinoDoor', 'casino', 'neural', 'pd']) {
    const point = meta.spawns[key], safe = findSafe(G, point[0], point[1], 10, true);
    meta.interactions[key] = [safe.x, safe.y];
  }
  const lot = findSafe(G, meta.spawns.casinoDoor[0], meta.spawns.casinoDoor[1] + 240, 10, true);
  meta.interactions.casinoLot = [lot.x, lot.y];
  const c2 = findSafe(G, 1044, 3330, 30, false);
  G.vehicles.push(makeVeh("fare", c2.x, c2.y, 0, { keep: true }));
  const c3 = findSafe(G, 870, 3140, 16, false);
  G.vehicles.push(makeVeh("hog", c3.x, c3.y, Math.PI, { keep: true }));
  const pd = meta.spawns.pd;
  for (const ox of [-50, 50]) { const p = findSafe(G, pd[0] + ox, pd[1], 28, false); G.vehicles.push(makeVeh("metro", p.x, p.y, 0, { keep: true, pdCar: true })); }
  const blocked = new Set(["road", "track", "water", "canal", "build"]);
  let parkedN = 0;
  const stripX = (meta.layout && meta.layout.stripX) || 1964;
  for (const pk of meta.parking) {
    if (parkedN >= 30) break;
    if (blocked.has(G.surfaceAt(pk.x, pk.y))) continue;
    if (Math.abs(pk.x - stripX) < 360) continue;
    const kinds = ["fare", "dart", "riot", "fare"];
    G.vehicles.push(makeVeh(kinds[parkedN % kinds.length], pk.x, pk.y, pk.rot || 0, { keep: true }));
    parkedN++;
  }
  const pkinds = ["fare", "dart", "fare", "riot", "taxi", "fare", "dart"];
  for (const pk of G.world.parking) {
    const s = G.surfaceAt(pk.x, pk.y);
    if (s === "build" || s === "water") continue;
    G.vehicles.push(makeVeh(pkinds[((pk.x + pk.y) | 0) % pkinds.length], pk.x, pk.y, pk.rot + (((pk.x | 0) % 2) ? Math.PI : 0), { keep: true, parkedOuter: true }));
  }
  for (const [i,s] of meta.slips.slice(0,8).entries()) {const v=makeVeh(i%4===3?'gulf':'wake',s.x,s.y,s.rot||0,{keep:true});const at=waterBerth(G,v,s.x,s.y);if(at&&!G.vehicles.some(o=>o.def.boat&&Math.hypot(o.x-at.x,o.y-at.y)<110)){Object.assign(v,at);G.vehicles.push(v);}}
  for (const p of G.world.piers.slice(0,6)){const v=makeVeh('wake',p.x-60,p.y+60,0,{keep:true});const at=waterBerth(G,v,v.x,v.y);if(at){Object.assign(v,at);G.vehicles.push(v);}}
  const palace = meta.spawns.casino || [2560, 2090];
  G.vehicles.push(makeVeh("nyx", palace[0] - 40, palace[1] - 200, Math.PI, { lockedUntil: "nyx", keep: true }));
  G.vehicles.push(makeVeh("dart", 2480, 1680, 0, { lockedUntil: "dart", keep: true }));
  G.vehicles.push(makeVeh("stitch", 2520, 1680, 0.2, { lockedUntil: "stitch", keep: true }));
  for (let i = 0; i < 22; i++) G.traffic.spawnCar({ x: spawn.x, y: spawn.y }, 300, 2000);
  for (const gt of (meta.gathers || [])) {
    const n = 2 + ((Math.random() * 2) | 0);
    for (let i = 0; i < n; i++) {
      const ox = (i - (n - 1) / 2) * (16 + Math.random() * 8), oy = (Math.random() - 0.5) * 16;
      G.peds.push({ x: gt.x + ox, y: gt.y + oy, rot: Math.PI + (Math.random() - 0.5) * 0.8, vx: 0, vy: 0, sprite: i === 0 ? "valet" : ["guest", "m2", "prime", "m4"][i % 4], speed: 0, walk: 10, dist: 0, flee: 0, r: 8, hp: 30, dead: false, gather: gt });
    }
  }
  for (let i = 0; i < 40; i++) G.pedsys.spawn({ x: spawn.x, y: spawn.y }, 120, 1100);
  let boatN=0;for (const v of G.vehicles) if(v.def?.boat){if(boatN++%3===2){v.parked=false;v.role='boat';v.cruise=Math.random()*TAU;v.home={x:v.x,y:v.y};}else v.parked=true;}
  spawnAircraft(G, makeVeh);
}

function trafficLane(rd, i) {
  if (rd.k === "strip") {
    const L = rd._layout;
    const lanes = [];
    const mx = 36, lane = 72, n = 3;
    // fallback offsets from centre: 3 each way
    for (let k = 0; k < n; k++) {
      lanes.push(-(mx + lane * (k + 0.5)));
      lanes.push(mx + lane * (k + 0.5));
    }
    return lanes[i % lanes.length];
  }
  const w = rd.w || 48;
  const n = Math.max(1, Math.round((w / 2) / 72));
  const dir = (i % 2 === 0 ? 1 : -1);
  const k = Math.floor(i / 2) % n;
  const span = w / 2;
  const step = span / n;
  return dir * (step * (k + 0.5));
}
function lanePos(rd, t, lane) {
  const x = lerp(rd.a[0], rd.b[0], t);
  const y = lerp(rd.a[1], rd.b[1], t);
  const dx = rd.b[0] - rd.a[0], dy = rd.b[1] - rd.a[1];
  const len = Math.hypot(dx, dy) || 1;
  return { x: x + (-dy / len) * lane, y: y + (dx / len) * lane };
}
function pathRot(rd, dir) {
  const dx = (rd.b[0] - rd.a[0]) * (dir || 1);
  const dy = (rd.b[1] - rd.a[1]) * (dir || 1);
  return Math.atan2(dx, -dy);
}

/* -------------------- Input -------------------- */
function createInput() {
  return {
    x: 0, y: 0, enter: false, enterP: false, brake: false, hand: false, boost: false, fire: false, fireP: false,
    pauseP: false, fsP: false, skipP: false, confirmP: false, backP: false, mapP: false,
    radioP: false, upP: false, downP: false, leftP: false, rightP: false, sprint: false,
    mouse: { x: 0, y: 0, down: false },
    touchJoy: { x: 0, y: 0, active: false },
    tBrake: false, tHand: false, tBoost: false, tSprint: false, tFire: false,
  };
}

function bindKeys(G) {
  const down = new Set(), releasedHolds=new Set();
  const I = G.input;
  const on = (e, d) => {
    const k = e.code;
    if(d){if(e.repeat&&releasedHolds.has(k))return;if(!e.repeat)releasedHolds.delete(k);down.add(k);}
    else {down.delete(k);releasedHolds.delete(k);}
    if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Tab"].includes(k)) e.preventDefault();
    if (!d || e.repeat) return;
    G.touch = false; G._syncTouch && G._syncTouch();
    if (k === "KeyE" || k === "KeyF" && false) I.enterP = true;
    if (k === "KeyK" || k === "KeyJ" || k === "ControlLeft") I.fireP = true;
    if (k === "Escape" || k === "KeyP") I.pauseP = true;
    if (k === "KeyF") { e.preventDefault(); G.toggleFS(); }
    if (k === "KeyM" || k === "Tab") I.mapP = true;
    if (k === "Enter" || k === "Space") { I.skipP = true; I.confirmP = true; }
    if (k === "KeyR") I.radioP = true;
    if (k === 'KeyQ') I.weaponP = true;
    if (k === 'KeyX') I.reloadP = true;
    if (k === 'KeyC') I.crewP = true;
    if (k === 'Space') I.dodgeP = true;
    if (k === "ArrowUp" || k === "KeyW") I.upP = true;
    if (k === "ArrowDown" || k === "KeyS") I.downP = true;
    if (k === "ArrowLeft" || k === "KeyA") I.leftP = true;
    if (k === "ArrowRight" || k === "KeyD") I.rightP = true;
  };
  window.addEventListener("keydown", (e) => on(e, true));
  window.addEventListener("keyup", (e) => on(e, false));
  G.releaseControls = () => {
    for(const key of down)releasedHolds.add(key);
    down.clear(); resetInput(I); I.brake=I.hand=I.boost=I.sprint=I.keyDrive=false; G.releaseAim?.(); G._releaseTouch?.();
    document.querySelectorAll('#touch .down').forEach(el=>el.classList.remove('down'));
  };
  const release = () => {
    G.releaseControls(); G.jack = null;
    document.querySelectorAll('#touch .down').forEach(el => el.classList.remove('down'));
    if (G.scene === 'play') { G.pausedFrom = 'play'; G.scene = 'pause'; }
  };
  window.addEventListener("blur", release);
  window.addEventListener("pointercancel", () => resetInput(I));
  document.addEventListener("visibilitychange", () => { if (document.hidden) {release();G.audio.ctx?.suspend?.().catch(()=>{});} else if(G.audio.ctx?.state==='suspended')G.audio.ctx.resume().catch(()=>{}); });
  const pulse = () => {
    I.sprint = down.has("ShiftLeft") || down.has("ShiftRight") || I.tSprint || I.tBoost;
    I.boost = down.has("ShiftLeft") || down.has("ShiftRight") || I.tBoost;
    I.hand = down.has("Space") || I.tHand;
    I.brake = I.tBrake;
    I.fire = down.has("KeyK") || down.has("KeyJ") || down.has("ControlLeft") || I.tFire || (I.mouse.down && I.mouse.fire);
    let x = 0, y = 0;
    if (down.has("KeyA") || down.has("ArrowLeft")) x -= 1;
    if (down.has("KeyD") || down.has("ArrowRight")) x += 1;
    if (down.has("KeyW") || down.has("ArrowUp")) y += 1;
    if (down.has("KeyS") || down.has("ArrowDown")) y -= 1;
    I.keyDrive = !!(x || y);
    if (I.touchJoy.active) { x = I.touchJoy.x; y = I.touchJoy.y; }
    I.x = clamp(x, -1, 1);
    I.y = clamp(y, -1, 1);
  };
  G._pulseInput = pulse;
  canvasMouse(G);
}

function canvasMouse(G) {
  const c = G.canvas;
  const set = (e) => {
    const r = c.getBoundingClientRect();
    G.input.mouse.x = (e.clientX - r.left) * (c.width / r.width);
    G.input.mouse.y = (e.clientY - r.top) * (c.height / r.height);
  };
  c.addEventListener("pointermove", set);
  c.addEventListener("pointerdown", (e) => {
    set(e);
    G.audio.unlock();
    if (e.pointerType === "touch") { G.touch = true; G._syncTouch && G._syncTouch(); }
    G.firstTap && G.firstTap();
    // UI buttons first
    const mx = G.input.mouse.x, my = G.input.mouse.y;
    for (let i = G.buttons.length - 1; i >= 0; i--) {
      const b = G.buttons[i];
      if (mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h) { G.audio.click && G.audio.click(); b.act(); G.input.mouse.down = false; return; }
    }
    if (G.scene === 'map' && G.mapView) {
      const m = G.mapView;
      if (mx >= m.x && my >= m.y && mx <= m.x + m.w && my <= m.y + m.h) {
        G.waypoint = { x: clamp((mx - m.x) / m.k * G.minimap.S, 0, WORLD_W - 1),
          y: clamp((my - m.y) / m.k * G.minimap.S, 0, WORLD_H - 1) };
        G.gps = null; toast(G, 'Blue waypoint set. Gold marker is your job.');
      }
      return;
    }
    if (G.scene === "vn") { G.input.vnTap = true; return; }
    // mouse fires in play; taps on the map never shoot
    G.input.mouse.down = true;
    G.input.mouse.fire = e.pointerType === "mouse" && G.scene === "play";
  });
  window.addEventListener("pointerup", () => { G.input.mouse.down = false; G.input.mouse.fire = false; });
  c.addEventListener("pointercancel", () => resetInput(G.input));
  c.addEventListener("contextmenu", (e) => e.preventDefault());
}

function setupTouch(G) {
  const touch = document.getElementById("touch");
  const coarse = window.matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0;
  G.touch = coarse;
  const joy = document.getElementById("joy"), knob = document.getElementById("knob"), zone = document.getElementById("joyZone");
  const hintL = document.getElementById("hintL");
  let joyId = null, cx = 0, cy = 0;
  const R = 56;
  const place = (x, y) => { joy.style.left = x + "px"; joy.style.top = y + "px"; };
  const move = (e) => {
    const dx = e.clientX - cx, dy = e.clientY - cy;
    const m = Math.hypot(dx, dy);
    let nx = dx / R, ny = -dy / R;
    const mm = Math.hypot(nx, ny);
    if (mm > 1) { nx /= mm; ny /= mm; }
    // dead zone with smooth ramp
    const mag = Math.min(1, mm);
    const k = mag < 0.12 ? 0 : (mag - 0.12) / 0.88;
    const s = mm > 0 ? k / Math.min(1, mm) : 0;
    G.input.touchJoy = { x: nx * s * Math.min(1, mm), y: ny * s * Math.min(1, mm), active: true, mag: k };
    knob.style.transform = `translate(${nx * 38}px, ${-ny * 38}px)`;
    if (m > R * 1.6) { cx += (dx / m) * (m - R * 1.6); cy += (dy / m) * (m - R * 1.6); place(cx - zone.getBoundingClientRect().left, cy - zone.getBoundingClientRect().top); }
  };
  zone.addEventListener("pointerdown", (e) => {
    e.preventDefault(); G.touch = true; G.firstTap && G.firstTap(); G.audio.unlock();
    if (joyId !== null) return;
    joyId = e.pointerId; zone.setPointerCapture(e.pointerId);
    const r = zone.getBoundingClientRect();
    cx = e.clientX; cy = e.clientY;
    place(cx - r.left, cy - r.top);
    joy.classList.add("on");
    hintL.style.opacity = 0;
    move(e);
  });
  zone.addEventListener("pointermove", (e) => { if (e.pointerId === joyId) { e.preventDefault(); move(e); } });
  const end = (e) => {
    if (e.pointerId !== joyId) return;
    joyId = null; G.input.touchJoy = { x: 0, y: 0, active: false };
    knob.style.transform = ""; joy.classList.remove("on");
    joy.style.left = ""; joy.style.top = "";
  };
  ["pointerup", "pointercancel", "lostpointercapture"].forEach((ev) => zone.addEventListener(ev, end));
  G._releaseTouch = () => end({ pointerId: joyId });
  window.addEventListener("blur", G._releaseTouch);
  const hold = (id, fn) => {
    const el = document.getElementById(id);
    el.addEventListener("pointerdown", (e) => { e.preventDefault(); e.stopPropagation(); G.touch = true; G.firstTap && G.firstTap(); G.audio.unlock(); el.classList.add("down"); el.setPointerCapture(e.pointerId); fn(true); if (G.settings.haptics && navigator.vibrate) try { navigator.vibrate(8); } catch {} });
    ["pointerup", "pointercancel", "lostpointercapture"].forEach((ev) => el.addEventListener(ev, () => { el.classList.remove("down"); fn(false); }));
  };
  hold("tEnter", (d) => { if (d) G.input.enterP = true; });
  hold("tBrake", (d) => { G.input.tBrake = d; });
  hold("tHand", (d) => { G.input.tHand = d; });
  hold("tBoost", (d) => { G.input.tBoost = d; });
  hold("tSprint", (d) => { G.input.tSprint = d; });
  bindTouchAim(G, document.getElementById('tFire'));
  hold("tMap", (d) => { if (d) G.input.mapP = true; });
  hold("tPause", (d) => { if (d) G.input.pauseP = true; });
  hold('tWeapon', d => { if(d) G.input.weaponP=true; });
  hold('tReload', d => { if(d) G.input.reloadP=true; });
  hold('tDodge', d => { if(d) G.input.dodgeP=true; });
  hold('tCrew', d => { if(d) G.input.crewP=true; });
  const enterL = document.getElementById("tEnterL"), enterB = document.getElementById("tEnter"), boostB = document.getElementById("tBoost");
  let lastMode = "";
  G._syncTouch = () => {
    syncControlStyle(G);
    const show = G.touch;
    touch.classList.toggle("hidden", !show);
    if (!show) return;
    const inPlay = G.scene === "play";
    const drive = inPlay && G.player && G.player.type === "veh";
    const mode = !inPlay ? "menu" : drive ? "drive" : "foot";
    if (mode !== lastMode) { touch.classList.remove("menu", "drive", "foot"); touch.classList.add(mode); lastMode = mode; if (!inPlay) { G.releaseAim?.(); resetInput(G.input); } }
    if (inPlay) {
      const near = !drive && G.player && nearestVeh(G, G.player.x, G.player.y, 104);
      touch.classList.toggle("used", (G.walked || 0) > 140 || (G.drove || 0) > 100);
      const lbl = G.contactNear&&!drive ? "TALK" : nearbyInteraction(G) ? "TAKE" : drive ? (G.player.def.aircraft&&!canExitAircraft(G.player)?"LAND":"EXIT") : near ? (near.def.aircraft ? "FLY" : near.def.boat ? "BOAT" : near.def.bike ? "BIKE" : "CAR") : "CAR";
      if (enterL.textContent !== lbl) enterL.textContent = lbl;
      enterB.classList.toggle("ready", (!!near || !!G.contactNear || !!nearbyInteraction(G)) && !G.jack);
      enterB.style.opacity = drive || near || G.contactNear || nearbyInteraction(G) ? 1 : 0.45;
      boostB.classList.toggle("off", !(drive && (G.player.def.sprite === "nyx" || G.player.def.aircraft)));
      const flying=drive&&G.player.def.aircraft;
      for(const [id,text] of [["tBoost",flying?"UP":"BOOST"],["tBrake",flying?"DOWN":"BRAKE"],["tHand",flying?"LAND":"DRIFT"]]){const el=document.getElementById(id),label=el?.querySelector("span:last-child");if(label&&label.textContent!==text)label.textContent=text;}
    }
  };
}

function hookFullscreen(G) {
  installFullscreen(G, {fit, toast});
  document.addEventListener('touchmove', e => e.preventDefault(), {passive:false});
  document.addEventListener('gesturestart', e => e.preventDefault());
}

function fit(G) {
  const c = G.canvas;
  const w = window.innerWidth || G.wrap.clientWidth;
  const h = window.innerHeight || G.wrap.clientHeight;
  const q = G.settings ? G.settings.quality : "high";
  const maxDpr = q === "low" ? 1 : q === "med" ? 1.35 : 2;
  const dpr = Math.min(2,window.devicePixelRatio||1);
  G.worldDpr=Math.max(G.dprFloor||.6,Math.min(maxDpr,window.devicePixelRatio||1)*(G.resScale||1));
  G.worldWidth=Math.round(w*G.worldDpr);G.worldHeight=Math.round(h*G.worldDpr);
  const bw = Math.round(w * dpr), bh = Math.round(h * dpr);
  if (c.width !== bw || c.height !== bh) { c.width = bw; c.height = bh; }
  G.dpr = dpr; G.cssW = w; G.cssH = h;
  G.layered=!!(navigator.maxTouchPoints>0&&q==='low'&&G.wrap.insertBefore);
  // UI unit: CSS px scaled gently with the short side, so text stays readable on phones
  G.ui = dpr * clamp(Math.min(w, h) / 420, 0.82, 1.25);
  const sEl = document.getElementById("safe");
  if (sEl) {
    const cs = getComputedStyle(sEl);
    G.safe = { t: parseFloat(cs.paddingTop) * dpr || 0, r: parseFloat(cs.paddingRight) * dpr || 0, b: parseFloat(cs.paddingBottom) * dpr || 0, l: parseFloat(cs.paddingLeft) * dpr || 0 };
  } else G.safe = { t: 0, r: 0, b: 0, l: 0 };
  if (G.light) G.light.resize(G.worldWidth, G.worldHeight, G.settings.quality);
}

/* -------------------- Save -------------------- */
function snapshot(G) {
  return {
    v: 5, mode: G.mode || 'story',
    action: actionSave(G.action),
    director: directorSave(G.director),
    freeRoam: G.freeRoam === true,
    flags: G.flags,
    missionIndex: G.missionIndex,
    objectiveIndex: G.objectiveIndex,
    unlocked: G.unlocked,
    chips: G.chips,
    wanted: G.wanted,
    time: G.time,
    weather: G.weather,
    px: G.player.x, py: G.player.y, prot: G.player.rot, ptype: G.player.type,
    vehKind: G.player.type === "veh" ? G.player.kind : null,
    health: G.health, vehicleHealth: G.player.type === 'veh' ? G.player.health : null,
    vehiclePaint: G.player.type === 'veh' ? G.player.paint || 0 : 0,
    aircraft: aircraftSnapshot(G.player),
    expansion: {...G.expansionState,visited:[...(G.expansionState?.visited||[])]},
    missionState: { ...G.missionState }, ended: G.ended, needsBegin: G.needsBegin,
    scene: G.scene, vnId: G.scene === 'vn' ? G.vn.id : null, vnQueue: [...(G.vnQueue || [])],
    race: G.race ? { i: G.race.i, rivalI: G.race.rivalI, t: G.race.t, countdown: G.race.countdown,
      started: G.race.started, rival: { x: G.race.rival.x, y: G.race.rival.y, rot: G.race.rival.rot } } : null,
    van: G.van ? { x: G.van.x, y: G.van.y, health: G.van.health, dead: G.van.dead, loose: G.van.loose } : null,
  };
}
function save(G) {
  try { localStorage.setItem(G.mode==='freeride'?FREE_SAVE_KEY:SAVE_KEY, JSON.stringify({ ...snapshot(G), checkpoint: G.checkpoint })); if(G.mode!=='freeride')G.saveExists = true; toast(G, "Saved."); } catch {}
}
function loadSave(G, mode = G.mode || 'story') {
  const data = readJSON(localStorage, mode==='freeride'?FREE_SAVE_KEY:SAVE_KEY);
  if (!data) return false;
  return restoreState(G, data);
}
function restoreState(G, d) {
  clearRecoveryState(G);
  G.action = actionState(d.action);
  G.director = directorState(d.director);
  G.mode=d.mode==='freeride'?'freeride':'story';
  G.freeRoam = G.mode==='freeride'||d.freeRoam === true && d.missionIndex >= MISSIONS.length;
  G.waypoint=null;
  G.flags = flagsFrom(d.flags);
  G.missionIndex = Math.floor(finite(d.missionIndex, 0, 0, MISSIONS.length));
  G._flow = G.mode!=='freeride' && G.missionIndex < MISSIONS.length ? missionFlow(MISSIONS[G.missionIndex].id, G.flags) : null;
  G.objectiveIndex = Math.floor(finite(d.objectiveIndex, 0, 0, G._flow ? G._flow.objectives.length - 1 : 0));
  G.unlocked = Array.isArray(d.unlocked) ? [...new Set(d.unlocked.filter(k => VEH_DEFS[k]))] : ['riot', 'fare', 'hog', 'wake', 'gulf'];
  if (G.missionIndex >= 5 && !G.unlocked.includes('nyx')) G.unlocked.push('nyx');
  G.chips = finite(d.chips, 400, 0, 1e9); G.wanted = Math.floor(finite(d.wanted, 0, 0, 5));
  G.time = finite(d.time, 19.4, 0, 24) % 24;
  G.weather = ['clear', 'rain', 'fog', 'sand'].includes(d.weather) ? d.weather : 'clear';
  G.health = finite(d.health, 100, 1, 100);
  G.missionState = d.missionState && typeof d.missionState === 'object' ? { ...d.missionState } : {};
  G.missionState.scramblerT = finite(G.missionState.scramblerT, 0, 0, 90);
  G.missionState.holdT = 0;
  G.vnQueue = Array.isArray(d.vnQueue) ? d.vnQueue.filter(id => VN[id]) : [];
  G.needsBegin = d.needsBegin === true;
  G.ended = d.ended === true || G.missionIndex >= MISSIONS.length;
  G.race = null; G.jack = null; G.bullets = []; G.seenT = 0;
  const x = finite(d.px, G.meta.spawns.player[0], 40, WORLD_W - 40);
  const y = finite(d.py, G.meta.spawns.player[1], 40, WORLD_H - 40);
  const rot = finite(d.prot, 0, -Math.PI * 100, Math.PI * 100);
  if (G.player?.type === 'veh') { G.player.driver = null; G.player.loose = true; }
  if (d.ptype === 'veh' && VEH_DEFS[d.vehKind]) {
    let spot = { x, y };
    if (VEH_DEFS[d.vehKind].aircraft) { if (!(d.aircraft?.altitude>1)) spot = findSafe(G,x,y,35,false); }
    else if (!VEH_DEFS[d.vehKind].boat) spot = findSafe(G, x, y, 26, false);
    else if (!['water', 'canal', 'pier'].includes(G.world?.boatSurfaceAt?.(x,y)||G.surfaceAt(x, y))) {
      const slip = G.meta.slips.find(s => ['water', 'canal', 'pier'].includes(G.surfaceAt(s.x, s.y)));
      if (slip) spot = slip;
    }
    const v = G.vehicles.find(v => !v.dead && !v.raceRival && v.kind === d.vehKind && (d.aircraft?.id&&v.aircraftId===d.aircraft.id || Math.hypot(v.x - spot.x, v.y - spot.y) < 80)) || spawnPlayerCar(G, d.vehKind, spot.x, spot.y, rot);
    v.x = spot.x; v.y = spot.y; v.rot = rot; v.vx = v.vy = 0; v.burning = false; v.sinkT = 0;
    if(v.def.boat){const at=waterBerth(G,v,v.x,v.y);if(at)Object.assign(v,at);}
    finishEnter(G, v); v.health = finite(d.vehicleHealth, 100, 15, 100); v.wrecked = v.health < 35;
    v.paint = Math.floor(finite(d.vehiclePaint,0,0,100));
    if(v.def.aircraft) restoreAircraft(v,d.aircraft);
  } else { const spot = findSafe(G, x, y, 8, true); G.player = makeFoot(G, spot.x, spot.y, rot); }
  if (G._flow && G._flow.onStart && G._flow.onStart.spawnVan) {
    spawnVan(G);
    if (d.van) {
      G.van.x = finite(d.van.x, G.van.x, 40, WORLD_W - 40); G.van.y = finite(d.van.y, G.van.y, 40, WORLD_H - 40);
      G.van.health = finite(d.van.health, 100, 0, 100); G.van.dead = d.van.dead === true; G.van.loose = d.van.loose === true;
    }
  }
  G.cam.x = G.player.x; G.cam.y = G.player.y;
  restoreStreetRoute(G);
  if(G.action.contract?.id==='courier' || G.action.contract?.id==='ghost' && !G.action.contract.stage) {
    const point=G.action.contract.id==='courier'&&!G.action.contract.stage?G.meta.spawns.garage:G.meta.interactions[G.action.contract.id==='courier'?'neural':'pd'];G.waypoint={x:point[0],y:point[1]};
  }
  if (G._flow && G._flow.objectives[G.objectiveIndex].kind === 'race' && d.race) {
    startRace(G, G._flow.objectives[G.objectiveIndex], true);
    const r = G.race;
    r.i = Math.floor(finite(d.race.i, 0, 0, r.pts.length - 1));
    r.rivalI = Math.floor(finite(d.race.rivalI, 0, 0, r.pts.length));
    r.t = finite(d.race.t, 0, 0, 3600); r.countdown = finite(d.race.countdown, 3, 0, 3); r.started = r.countdown === 0;
    const point = d.race.rival || {};
    r.rival.x = finite(point.x, r.rival.x, 40, WORLD_W - 40); r.rival.y = finite(point.y, r.rival.y, 40, WORLD_H - 40);
    r.rival.rot = finite(point.rot, r.rival.rot);
  }
  G.checkpoint = d.checkpoint && typeof d.checkpoint === 'object' ? d.checkpoint : null;
  if (d.scene === 'vn' && VN[d.vnId]) openVN(G, d.vnId);
  else if (G.needsBegin && !G.ended) beginMission(G, G.missionIndex);
  else G.scene = G.ended && !G.freeRoam ? 'end' : 'play';
  setHint(G);
  initExpansion(G,d.expansion);
  beginJob(G);
  return true;
}
function retryObjective(G) {
  if (!G.checkpoint) { beginMission(G, Math.min(G.missionIndex, MISSIONS.length - 1)); return; }
  const checkpoint = G.checkpoint;
  restoreState(G, { ...checkpoint, checkpoint, scene: 'play', vnId: null });
  G.health = 100; G.scene = 'play'; resetInput(G.input);
  toast(G, 'Objective checkpoint restored.');
}

function toast(G, s) { G.toast = s; G.toastT = 2.4; }

function showBanner(G, title, sub, kind) {
  G.banner = { title, sub: sub || "", kind: kind || "win", t: 3.2, max: 3.2 };
  if (G.audio && G.audio.banner) G.audio.banner(kind !== "bust");
  addShake(G, kind === "bust" ? 10 : 6);
}

function popChips(G, x, y, amt) {
  if (!amt) return;
  G.floaters.push({ x, y, text: (amt > 0 ? "+" : "") + amt + " CHIPS", life: 1.4, vy: -36, color: amt > 0 ? "#f2c14e" : "#ff6688" });
  G.particles.push({ kind: "flash", x, y, life: 0.12, a: 1 });
  if (G.audio) G.audio.pickup();
}

function seedPickups(G) {
  G.pickups = [
    { x: 1480, y: 2100, v: 25 },
    { x: 2300, y: 1980, v: 25 },
    { x: 1760, y: 2680, v: 15 },
    { x: 2560, y: 2740, v: 15 },
    { x: 1920, y: 720, v: 20 },
    { x: 1180, y: 1560, v: 15 },
  ];
}

function tickJack(G, dt) {
  const j = G.jack;
  if (!j) return;
  j.t -= dt;
  const k = 1 - Math.max(0, j.t) / j.dur;
  if (G.player.type === "foot") {
    G.player.x = j.fromX + (j.v.x - j.fromX) * k;
    G.player.y = j.fromY + (j.v.y - j.fromY) * k;
    G.player.rot = Math.atan2(j.v.x - G.player.x, -(j.v.y - G.player.y));
  }
  if (j.t <= 0) {
    finishEnter(G, j.v);
    G.jack = null;
  }
}

function tickPickups(G, dt) {
  const p = G.player;
  for (const c of G.pickups) {
    if (c.got) continue;
    if (Math.hypot(p.x - c.x, p.y - c.y) < 22) {
      c.got = true;
      G.chips += c.v;
      popChips(G, c.x, c.y, c.v);
    }
  }
  for (const f of G.floaters) {
    f.life -= dt;
    f.y += (f.vy || -30) * dt;
  }
  G.floaters = G.floaters.filter((f) => f.life > 0);
}

/* -------------------- Tick -------------------- */
function tick(G, dt) {
  G._pulseInput();
  if (G.scene === "title") tickTitle(G, dt);
  else if (G.scene === "settings") tickSettings(G, dt);
  else if (G.scene === "vn") tickVN(G, dt);
  else if (G.scene === "end") tickEnd(G, dt);
  else if (['pause','map','crew','garage','dossier'].includes(G.scene)) tickPause(G, dt);
  else if (G.scene === "brief") tickBrief(G, dt);
  else tickPlay(G, dt);
  if ((G.ticks & 7) === 0 || G._lastScene !== G.scene) { G._syncTouch && G._syncTouch(); G._lastScene = G.scene; }
  G._auT = (G._auT || 0) + 1;
  if ((G._auT & 3) === 0 && G.audio.update) G.audio.update(G, dt * 4);
  const I = G.input;
  I.enterP = I.fireP = I.pauseP = I.skipP = I.confirmP = I.radioP = I.upP = I.downP = I.leftP = I.rightP = I.mapP = I.vnTap = false;
  I.weaponP = I.reloadP = I.crewP = I.dodgeP = false;
}

function tickTitle(G, dt) {
  G.fade = Math.max(0, G.fade - dt * 0.8);
  G.titleT = (G.titleT || 0) + dt;
  G.ticks++;
  menuKeys(G);
}
// keyboard navigation over whatever menu buttons were drawn last frame
function menuKeys(G) {
  const nav = (G.navButtons || []);
  if (!nav.length) return;
  if (G.input.upP) G.menuSel = (G.menuSel + nav.length - 1) % nav.length;
  if (G.input.downP) G.menuSel = (G.menuSel + 1) % nav.length;
  G.menuSel = clamp(G.menuSel || 0, 0, nav.length - 1);
  const b = nav[G.menuSel];
  if (b && b.adj) { if (G.input.leftP) b.adj(-1); if (G.input.rightP) b.adj(1); }
  if (G.input.confirmP && b) { G.audio.click && G.audio.click(); b.act(); }
}

function startNew(G) {
  clearRecoveryState(G);
  G.mode='story';
  G.action = actionState();
  G.director = directorState();
  G.freeRoam=false;
  G.flags = flagsFrom({});
  G.missionState = {}; G.vnQueue = []; G.checkpoint = null; G.race = null; G.van = null; G.waypoint = null;
  G.missionIndex = 0;
  G.objectiveIndex = 0;
  G.unlocked = ["riot", "fare", "hog", "wake", "gulf"];
  G.chips = 400;
  G.wanted = 0;
  G.time = 19.4;
  G.weather = "clear";
  G.health = 100;
  G.ended = false;
  G.tipStep = null; G.tipsDone = false; G.walked = 0; G.drove = 0;
  spawnWorld(G);G.nearVehicles=null;G.movingVehicles=null;
  buildStreetScene(G);
  G.cityAI=createCityAI(G);
  const s = G.meta.spawns.player;
  G.player = makeFoot(G, s[0], s[1], 0);
  initExpansion(G,{});
  G.cam.x = s[0]; G.cam.y = s[1];
  G.needsBegin = true;
  G.weatherT = 90;
  openVN(G, "intro_news");
}

function startFreeRide(G) {
  if(loadSave(G,'freeride')) {toast(G,'Free Ride continued. Your story save is separate.');return;}
  startNew(G);G.mode='freeride';G.freeRoam=true;G.scene='play';G._flow=null;G.vn=null;G.vnQueue=[];G.needsBegin=false;G.checkpoint=null;G.director=directorState();
  G.unlocked=Object.keys(VEH_DEFS);G.chips=1800;G.time=17.5;G.hint='FREE RIDE / Choose a crew contract, explore the city or take any ride.';G.tipsDone=true;G.tip='';
  G.cam.scale=1.2;G.cam.x=G.player.x;G.cam.y=G.player.y;save(G);
  message(G,'HUNTER','No schedule tonight. Every ride is yours. Crew work is on the board; your story stays where you left it.');
}

function titleHit() { return -1; }

function tickSettings(G) {
  if (G.input.pauseP) G.scene = G.pausedFrom || "title";
  menuKeys(G);
}
function saveSettings(G) { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(G.settings)); } catch {} }

function tickPause(G) {
  if (G.input.pauseP || (G.scene === "map" && G.input.mapP)) { G.scene = "play"; return; }
  menuKeys(G);
}

function tickEnd(G) {
  menuKeys(G);
  if (G.input.pauseP) { G.scene = "title"; G.saveExists = true; }
}

function openVN(G, page) {
  const p = typeof page === "function" ? page() : page;
  if (p === "play") {
    if (G.vnQueue && G.vnQueue.length) return openVN(G, G.vnQueue.shift());
    if (G.missionIndex >= MISSIONS.length) { G.scene = "end"; G.ended = true; return; }
    G.scene = "play";
    if (G.needsBegin) { G.needsBegin = false; beginMission(G, G.missionIndex); }
    return;
  }
  if (p === "end") { G.scene = "end"; G.ended = true; save(G); return; }
  const node = VN[p];
  if (!node) { G.scene = "play"; return; }
  G.vn = { id: p, node, t: 0, sel: 0, char: 0, wipe: G.settings.reducedMotion ? 0 : 0.32, typed: 0 };
  G.vn.pending = true;
  const scene = G.vn;
  G.scene = "vn";
  ensureStoryAssets(G, node).then(() => { if (G.vn === scene) scene.pending = false; });
}
function ensureStoryAssets(G, node) {
  if (!G.storyLoads) G.storyLoads = new Map();
  const keys = [['vn_' + node.bg, 'assets/vn/' + node.bg + '.jpg']];
  for (const id of [node.left, node.right]) if (CHAR[id]) {
    keys.push(['port_' + id, CHAR[id].portrait]);

  }
  return Promise.all(keys.map(([key, src]) => {
    if (G.assets.sprites[key]) return Promise.resolve();
    if (!G.storyLoads.has(key)) G.storyLoads.set(key, loadImg(src).then(im => { G.assets.sprites[key] = im; }).catch(() => {
      G.storyLoads.delete(key); // text remains usable; another visit can retry.
    }));
    return G.storyLoads.get(key);
  }));
}

function tickVN(G, dt) {
  if (G.vn.pending) return;
  G.vn.t += dt;
  if (G.vn.wipe > 0) G.vn.wipe = Math.max(0, G.vn.wipe - dt);
  const n = G.vn.node;
  const text = n.text || "";
  const total = text.length;
  if (G.vn.char < total) {
    const before = G.vn.char | 0;
    G.vn.char = Math.min(total, G.vn.char + dt * 52);
    const after = G.vn.char | 0;
    if (after > before && after - (G.vn.typed || 0) >= 2 && text[after - 1] !== " ") { G.audio.type(); G.vn.typed = after; }
  }
  const typedOut = G.vn.char >= total;
  const choices = n.choices || [];
  if (choices.length && typedOut) {
    if (G.input.upP) G.vn.sel = (G.vn.sel + choices.length - 1) % choices.length;
    if (G.input.downP) G.vn.sel = (G.vn.sel + 1) % choices.length;
  }
  if (G.input.confirmP || G.input.skipP || G.input.enterP || (G.input.vnTap && G.vn.t > 0.25)) {
    if (!typedOut) { G.vn.char = total; }
    else if (choices.length) {
      if (!G.input.vnTap) { const ch = choices[G.vn.sel]; if (ch.set) Object.assign(G.flags, ch.set); G.audio.ui(); openVN(G, ch.next); }
    } else { G.audio.ui(); openVN(G, n.next); }
  }
}

function vnChoiceHit() { return -1; }

function beginMission(G, idx) {
  G.missionIndex = idx;
  G.objectiveIndex = 0;
  if (!MISSIONS[idx]) { G._flow = null; G.scene = "end"; return; }
  G.missionState = {};
  const flow = missionFlow(MISSIONS[idx].id, G.flags);
  G._flow = flow;
  G.gps = null; G.waypoint = null;
  restoreStreetRoute(G);
  if (flow && flow.onStart) applyEffects(G, flow.onStart);
  if (flow && flow.onStart && flow.onStart.spawnVan) spawnVan(G);
  if (idx === 4) ensureGetawayBoat(G);
  beginJob(G);
  setHint(G);
  G.scene = "brief";
  G.briefT = 0;
  G.checkpoint = snapshot(G);
  save(G);
}
function tickBrief(G, dt) {
  G.briefT = (G.briefT || 0) + dt;
  G.ticks++;
  tickCamera(G, dt);
  if ((G.input.confirmP || G.input.skipP || G.input.pauseP) && G.briefT > 0.3) startPlayFromBrief(G);
}
function startPlayFromBrief(G) {
  G.scene = "play";
  toast(G, MISSIONS[G.missionIndex] ? MISSIONS[G.missionIndex].title : "");
  if (G.missionIndex === 0 && !G.tipsDone) G.tipStep = 0;
}
// first-mission onboarding tips, driven by what the player actually does
function tickTips(G, dt) {
  if(G.settings.showTips===false){G.tip=null;return;}
  if (G.missionIndex !== 0 || G.tipStep == null || G.tipsDone) { G.tip = ""; return; }
  const P = G.player, touch = G.touch;
  const steps = [
    { t: touch ? "Drag anywhere on the left to walk. Push further to run." : "WASD / arrows to walk. Shift to run.", done: () => (G.walked || 0) > 140 || P.type === "veh" },
    { t: touch ? "Walk to the gold marker and tap CAR to get in." : "Walk to the gold marker and press E to get in.", done: () => P.type === "veh" },
    { t: touch ? "Point the stick where you want to go. BRAKE reverses, DRIFT slides." : "W gas, S brake/reverse, A/D steer, Space handbrake.", done: () => (G.drove || 0) > 600 },
    { t: "Follow the gold arrow and the minimap line to the van.", done: () => G.objectiveIndex >= 2 },
  ];
  if (P.type === "foot") G.walked = (G.walked || 0) + (P.speed || 0) * dt;
  else G.drove = (G.drove || 0) + Math.hypot(P.vx, P.vy) * dt;
  const s = steps[G.tipStep];
  if (!s) { G.tipsDone = true; G.tip = ""; return; }
  G.tip = s.t;
  if (s.done()) { G.tipStep++; G.audio.ui && G.audio.ui(); }
}

function setHint(G) {
  if(G.mode==='freeride'){G.hint='Explore, choose a crew contract or visit a workshop.';const status=document.getElementById('gameStatus');if(status)status.textContent=G.hint;return;}
  const mission = MISSIONS[G.missionIndex];
  const flow = G._flow || (mission ? missionFlow(mission.id, G.flags) : null);
  G._flow = flow;
  const obj = flow && flow.objectives[G.objectiveIndex];
  G.hint = obj ? obj.hint : (G.missionIndex >= MISSIONS.length ? "Crown City is yours." : "");
  const status = document.getElementById("gameStatus");
  if (status) status.textContent = G.hint;
}

function applyEffects(G, e) {
  if (!e) return;
  if (e.wanted != null) { G.wanted = e.wanted; G.wantedCool = 8; }
  if (e.chips) {
    const amt = typeof e.chips === "function" ? e.chips(G.flags) : e.chips;
    G.chips = Math.max(0, G.chips + amt);
    if (G.player) popChips(G, G.player.x, G.player.y, amt);
  }
  if (e.unlock) for (const u of e.unlock) if (!G.unlocked.includes(u)) G.unlocked.push(u);
  if (e.flags) Object.assign(G.flags, e.flags);
}

function spawnVan(G) {
  if (G.van && G.vehicles.includes(G.van)) return;
  const sx = ((G.meta.layout && G.meta.layout.southbound && G.meta.layout.southbound[1]) || 1820);
  const v = makeVeh("van", sx, 980, Math.PI, { parked: false, isVan: true, traffic: false, keep: true, mission: true });
  G.van = v;
  G.vehicles.push(v);
}

function objectivePos(G, obj) {
  if (!obj || !obj.at) return null;
  if (obj.at === "van" && G.van) return { x: G.van.x, y: G.van.y };
  const s = G.meta.interactions?.[obj.at] || G.meta.spawns[obj.at];
  if (s) return { x: s[0], y: s[1] };
  return null;
}

function advanceObjective(G) {
  const flow = G._flow;
  const obj = flow.objectives[G.objectiveIndex];
  if(obj.id==='door' && G.flags.heist==='loud') {bumpWanted(G,3);message(G,'FIRE','The diversion is live. Move. Every second is expensive.','#ed9a72');}
  if (obj.id === "grab" && flow.onGrab) applyEffects(G, flow.onGrab);
  if (obj.id === 'pay') {
    const paid = G.flags.finance === 'credit' ? 0 : Math.min(600, G.chips);
    G.chips -= paid; G.flags.neuralDebt = 600 - paid;
    toast(G, paid === 600 ? 'Neural paid: 600 chips.' : 'Neural fee deferred: ' + G.flags.neuralDebt + ' from the vault cut.');
  }
  if (obj.id === 'vault') {
    G.chips += 5000 - (G.flags.neuralDebt || 0); G.flags.neuralDebt = 0; G.flags.vaultBag = true;
    const quiet = G.flags.heist === 'quiet' && G.flags.scrambler;
    G.wanted = quiet ? 2 : 5; G.seenT = 0;
    G.missionState.scramblerT = quiet ? 90 : 0;
  }
  G.missionState.holdT = 0;
  if (flow.midVN && flow.midVN.after === obj.id) {
    G.objectiveIndex++;
    setHint(G);
    openVN(G, flow.midVN.page);
    G.checkpoint = snapshot(G); save(G);
    return;
  }
  G.objectiveIndex++;
  G.gps = null; G.waypoint = null;
  restoreStreetRoute(G);
  G.audio.pickup();
  if (G.objectiveIndex >= flow.objectives.length) {
    completeMission(G, true);
  } else {
    setHint(G);
    toast(G, "Objective clear.");
    G.checkpoint = snapshot(G);
    save(G);
  }
}

function completeMission(G, won) {
  const flow = G._flow;
  if (!flow) return;
  const debrief=finishJob(G,won);
  if (G.race && G.race.rival) G.vehicles = G.vehicles.filter(v => v !== G.race.rival);
  G.race = null;
  if (!won) {
    G.objectiveIndex = 0; G.missionState = {}; setHint(G);
    G.checkpoint = snapshot(G);
    if (flow.loseVN) openVN(G, flow.loseVN);
    else G.scene = 'play';
    save(G); return;
  }
  if (flow.onWin) applyEffects(G, flow.onWin);
  showBanner(G, 'JOB DONE', (MISSIONS[G.missionIndex]?.title || 'JOB')+(debrief?.bonus?' / CREW BONUS +'+debrief.bonus:''), 'win');
  G.missionIndex++; G.objectiveIndex = 0; G.needsBegin = G.missionIndex < MISSIONS.length;
  const win = typeof flow.winVN === 'function' ? flow.winVN() : flow.winVN;
  const next = G.needsBegin ? missionFlow(MISSIONS[G.missionIndex].id, G.flags)?.startVN : null;
  G.vnQueue = next ? [next] : [];
  G._flow = null; G.hint = ''; G.checkpoint = null;
  if (win) openVN(G, win);
  else if (next) { G.vnQueue = []; openVN(G, next); }
  else { G.ended = true; G.scene = 'end'; }
  save(G);
}

function tickPlay(G, dt) {
  if (G.cineLock) {
    G.ticks++;
    if (G.radioT > 0) G.radioT = Math.max(G.radioT, 1.1);
    tickParticles(G, 1 / 60);
    return;
  }
  if ((G.ticks % 30) === 0) { ensureMissionCar(G);
    if (G.missionIndex === 4 && G.objectiveIndex >= 2) ensureGetawayBoat(G);
  }
  if((G.ticks%600)===0)spawnAircraft(G,makeVeh);
  if (G.input.pauseP) { G.scene = "pause"; G.settingsSel = 0; G.pausedFrom = "play"; return; }
  if (G.input.mapP) { G.scene = "map"; G.pausedFrom = "play"; return; }
  if (G.input.crewP && nearService(G)) { G.scene='garage'; G.menuSel=0; return; }
  if (G.input.radioP && G.player.type === "veh") { G.radioName = G.audio.nextStation(); G.radioT = 2.5; }
  G.ticks++;
  tickAction(G,dt,{moveFoot});
  G.hitConfirmT=Math.max(0,(G.hitConfirmT||0)-dt);
  if(G.scene !== 'play') return;
  const speed = [0, 1, 0.5, 0.25][G.settings.timeSpeed ?? 1] ?? 1;
  G.time = (G.time + dt * (24 / 480) * speed) % 24; // 8 real minutes per day at normal speed
  tickWeather(G, dt);
  if(G.input.enterP&&interactExpansion(G)){G.input.enterP=false;save(G);}
  if (G.input.enterP && nearbyInteraction(G)) {
    G.interactP = true; G.input.enterP = false;
  }
  const recovery=G.recoverySerial||0;
  // Previous positions are shared by projectile and pedestrian sweeps.
  for(const v of G.vehicles){v.prevX=v.x;v.prevY=v.y;}
  tickPlayer(G, dt);
  if(recovery!==(G.recoverySerial||0))return;
  G.cityAI?.begin(dt);
  G.traffic.tick(dt);
  tickVehicles(G, dt);
  if(recovery!==(G.recoverySerial||0))return;
  tickCollisions(G);
  tickJack(G, dt);
  G.pedsys.tick(dt);
  tickPeds(G, dt);
  if(recovery!==(G.recoverySerial||0))return;
  separateCharacters(G);
  const search = G.policeTarget || G.player;
  if(G.wanted>0||G.cops.length)G.nav.update(search.x, search.y);
  tickWanted(G, dt);
  tickCops(G, dt);
  if(recovery!==(G.recoverySerial||0))return;
  tickLife(G, dt);
  tickBullets(G, dt);
  if(recovery!==(G.recoverySerial||0))return;
  tickProps(G, dt);
  tickParticles(G, dt);
  tickPickups(G, dt);
  tickCamera(G, dt);
  const guidance=tickDirector(G,dt);
  if(guidance)message(G,guidance.name,guidance.text);
  tickMission(G, dt);
  tickExpansion(G,dt);
  G.interactP = false;
  tickTips(G, dt);
  G.district = districtAt(G.player.x, G.player.y);
  if (G.district !== G._lastDistrict) { if (G._lastDistrict) G.districtT = 3; G._lastDistrict = G.district; }
  if (G.districtT > 0) G.districtT -= dt;
  if (G.toastT > 0) G.toastT -= dt;
  if (G.radioT > 0) G.radioT -= dt;
  if (G.banner) { G.banner.t -= dt; if (G.banner.t <= 0) G.banner = null; }
  if (G.health < 100 && G.wanted === 0) G.health = Math.min(100, G.health + dt * 2);
  const rpm = G.player.type === "veh" ? Math.min(1, Math.hypot(G.player.vx, G.player.vy) / (G.player.def.max || 200)) : 0;
  G.audio.setEngine(G.player.type === "veh", rpm, G.player.type === "veh");
  G.audio.setRain(G.rainAmt);
  if ((G.ticks % 600) === 0) for (const l of Object.values(G.assets.layers)) l.evict(G.ticks);
}

function nightFactor(G) {
  const t = G.time;
  if (t < 5.5) return 1;
  if (t < 7.5) return 1 - (t - 5.5) / 2;
  if (t < 18.5) return 0;
  if (t < 20.5) return (t - 18.5) / 2;
  return 1;
}

function tickWeather(G, dt) {
  G.weatherT -= dt;
  if (G.weatherT <= 0) {
    const cycle = ["clear", "clear", "rain", "fog", "clear", "sand"];
    const i = (cycle.indexOf(G.weather) + 1) % cycle.length;
    G.weather = cycle[i];
    G.weatherT = 50 + Math.random() * 50;
    toast(G, G.weather === "clear" ? "Skies open over Crown City." : G.weather === "rain" ? "Rain on the Strip." : G.weather === "fog" ? "Fog rolls off the harbour." : "Sand off the east edge.");
  }
  const targetWet = G.weather === "rain" ? 1 : 0;
  const targetFog = G.weather === "fog" ? 0.65 : G.weather === "rain" ? 0.15 : 0;
  const targetSand = G.weather === "sand" ? 0.8 : 0;
  const targetRain = G.weather === "rain" ? 1 : 0;
  G.wet = lerp(G.wet, targetWet, 0.3 * dt);
  G.fog = lerp(G.fog, targetFog, 0.3 * dt);
  G.sand = lerp(G.sand, targetSand, 0.3 * dt);
  G.rainAmt = lerp(G.rainAmt, targetRain, 0.4 * dt);
  if (G.rainAmt > 0.1) {
    for (let i = 0; i < (G.settings.quality==='low'?0:4); i++) {
      G.particles.push({ kind: "rain", x: G.cam.x + (Math.random() - 0.5) * 1400, y: G.cam.y + (Math.random() - 0.5) * 900, vx: 40, vy: 420, life: 0.5 });
    }
  }
  if (G.sand > 0.2) {
    for (let i = 0; i < 6; i++) {
      G.particles.push({ kind: "sand", x: G.cam.x + (Math.random() - 0.5) * 1400, y: G.cam.y + (Math.random() - 0.5) * 900, vx: 180, vy: 20, life: 0.8, a: 1 });
    }
  }
  if (G.lightning > 0) G.lightning = Math.max(0, G.lightning - dt * 4);
  if (G.weather === "rain") {
    G.lightningT -= dt;
    if (G.lightningT <= 0) {
      G.lightning = G.settings.reducedMotion ? .08 : .45;
      if (!G.settings.reducedMotion) G.cam.shake = Math.max(G.cam.shake, 10);
      G.lightningT = 6 + Math.random() * 10;
    }
  }
}

function hexA(hex, a) {
  const h = (hex || "#ff2d9b").replace("#", "");
  const n = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const r = parseInt(n.slice(0, 2), 16), g = parseInt(n.slice(2, 4), 16), b = parseInt(n.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

function duskFactor(G) {
  const t = G.time;
  if (t >= 16.8 && t < 19.8) {
    const up = clamp((t - 16.8) / 0.9, 0, 1);
    const down = t < 18.4 ? 1 : 1 - clamp((t - 18.4) / 1.4, 0, 1);
    return up * down;
  }
  if (t >= 5.8 && t < 7.6) {
    const up = clamp((t - 5.8) / 0.7, 0, 1);
    const down = t < 6.6 ? 1 : 1 - clamp((t - 6.6) / 1.0, 0, 1);
    return up * down;
  }
  return 0;
}

function addShake(G, amt) {
  if (G.settings.reducedMotion) return;
  G.cam.shake = Math.max(G.cam.shake || 0, amt);
}

function headingVec(rot) { return { x: Math.sin(rot), y: -Math.cos(rot) }; }
function rightVec(rot) { return { x: Math.cos(rot), y: Math.sin(rot) }; }

function tickPlayer(G, dt) {
  if(G.player.type==='foot' && G.action?.dodgeT>0) return;
  if (G.player.type === "veh") {
    const v = G.player, I = G.input;
    if (G.race && G.race.countdown > 0) { v.vx = v.vy = 0; return; }
    let inp = I;
    if (I.touchJoy.active && !I.keyDrive) {
      // phone: point the stick where you want to go; the car steers there
      const mag = I.touchJoy.mag ?? Math.hypot(I.x, I.y);
      const want = Math.atan2(I.x, I.y) + G.cam.rot;
      const diff = angNorm(want - v.rot);
      const fwd = v.vx * Math.sin(v.rot) - v.vy * Math.cos(v.rot);
      let y = mag, x = clamp(diff * 1.8, -1, 1);
      // stick points behind a slow car: swing round in a tight forward U-turn (BRAKE = reverse)
      if (Math.abs(diff) > 2.3 && fwd < 60) { y = mag * 0.7; x = diff >= 0 ? 1 : -1; }
      else if (Math.abs(diff) > 1.6 && fwd > 90) y = mag * 0.3;
      inp = { x, y, brake: I.brake, hand: I.hand, boost: I.boost, sprint: I.boost, fire: I.fire, enterP: I.enterP };
    } else if (I.brake) inp = { ...I, y: Math.min(I.y, -1) };
    if(v.def.aircraft){
      const flight=tickAircraft(G,v,inp,dt,{damage:(craft,amount)=>damageVeh(G,craft,amount),notice:s=>toast(G,s)});
      tickVehDamage(G,v,dt);
      if(v.health<=0&&!v.dead){explode(G,v);if(G._endT<=0||!G._endT)wasted(G);return;}
      if(flight?.exit)exitVeh(G);return;
    }
    return tickDrive(G, v, inp, dt, true);
  }
  const p = G.player;
  const mag = Math.min(1, Math.hypot(G.input.x, G.input.y));
  if (mag > 0.12) {
    const want = Math.atan2(G.input.x, G.input.y) + G.cam.rot;
    p.rot = p.rot + angNorm(want - p.rot) * Math.min(1, 16 * dt);
  }
  const run = !G.action?.exhausted && (G.input.sprint || G.input.touchJoy.active && mag > 0.92);
  const target = mag < 0.12 ? 0 : (run ? 175 : 70 + 40 * mag);
  p.spd = lerp(p.spd || 0, target, (target > (p.spd || 0) ? 10 : 14) * dt);
  const h = headingVec(p.rot);
  moveFoot(G, p, h.x * p.spd * dt, h.y * p.spd * dt);
  p.speed = p.spd;
  const lastStep = Math.floor((p.dist || 0) / 25);
  p.dist += p.spd * dt;
  if (G.wet > .2 && Math.floor(p.dist / 25) !== lastStep) G.particles.push({ kind: 'footstep', x: p.x, y: p.y + 10, life: .45, maxLife: .45 });
  if (p.exitT > 0) p.exitT -= dt * 2.2;
  if (G.input.enterP) tryEnter(G);
  if (G.input.fire) shoot(G, p, true);
}

// forgiving on-foot movement: circle vs walls with sliding, and auto-unstick
function footOK(G, x, y) { const s = G.surfaceAt(x, y); return FOOT_OK.has(s); }
function footClear(G, x, y, r) {
  if (!footOK(G, x, y)) return false;
  for (let a = 0; a < 8; a++) { const ang = a * Math.PI / 4; if (!footOK(G, x + Math.cos(ang) * r, y + Math.sin(ang) * r)) return false; }
  return true;
}
function moveFoot(G,p,dx,dy){
  const x=p.x,y=p.y;moveFootMap(G,p,dx,dy);resolveFootVehicles(G,p,x,y);
}
function resolveFootVehicles(G,p,oldX=p.x,oldY=p.y){
  for(const v of localStreetVehicles(G,p.x,p.y)){
    if(v.def.boat||airborne(v)||Math.abs(v.x-p.x)>90||Math.abs(v.y-p.y)>90||Math.hypot(v.vx||0,v.vy||0)>45)continue;
    if(!circleBody(v,p.x,p.y,8))continue;
    const b=bodySize(v),q=localPoint(v,p.x,p.y),c=Math.cos(v.rot),sn=Math.sin(v.rot);
    let dx=0,dy=0;
    if(b.w+8-Math.abs(q.x)<b.l+8-Math.abs(q.y))dx=(q.x>=0?1:-1)*(b.w+8)-q.x;
    else dy=(q.y>=0?1:-1)*(b.l+8)-q.y;
    const nx=p.x+dx*c-dy*sn,ny=p.y+dx*sn+dy*c;
    if(footClear(G,nx,ny,7)){p.x=nx;p.y=ny;}else{p.x=oldX;p.y=oldY;}
  }
}
function moveFootMap(G, p, dx, dy) {
  const r = 7;
  if (!footClear(G, p.x, p.y, r)) {
    // stuck inside something: walk out toward the nearest open spot
    p.stuckT = (p.stuckT || 0) + 1 / 60;
    if (p.stuckT > 0.2) { const s = findSafe(G, p.x, p.y, 10); const d = Math.hypot(s.x - p.x, s.y - p.y) || 1; const step = Math.min(d, 260 / 60); p.x += (s.x - p.x) / d * step; p.y += (s.y - p.y) / d * step; }
    if (!footClear(G, p.x + dx, p.y + dy, 2)) return;
    p.x += dx; p.y += dy; return;
  }
  p.stuckT = 0;
  if (footClear(G, p.x + dx, p.y + dy, r)) { p.x += dx; p.y += dy; return; }
  // slide along the wall
  if (Math.abs(dx) > 0.01 && footClear(G, p.x + dx, p.y, r)) { p.x += dx; return; }
  if (Math.abs(dy) > 0.01 && footClear(G, p.x, p.y + dy, r)) { p.y += dy; return; }
  const L = Math.hypot(dx, dy);
  for (const turn of [0.6, -0.6, 1.1, -1.1]) {
    const a = Math.atan2(dy, dx) + turn;
    const nx = Math.cos(a) * L * 0.8, ny = Math.sin(a) * L * 0.8;
    if (footClear(G, p.x + nx, p.y + ny, r)) { p.x += nx; p.y += ny; return; }
  }
}

function tickDrive(G, v, input, dt, isPlayer) {
  v.prevX=v.x;v.prevY=v.y;const oldRot=v.rot;
  if(isPlayer) applyTune(G,v);
  const def = v.def;
  const surf = v.def.boat ? G.world?.boatSurfaceAt?.(v.x,v.y)||G.surfaceAt(v.x,v.y) : G.surfaceAt(v.x, v.y);
  if (v.dead) { v.vx *= 0.95; v.vy *= 0.95; v.x += v.vx * dt; v.y += v.vy * dt; return; }
  if (!def.boat && (surf === "water" || surf === "canal")) {
    v.vx *= Math.exp(-3 * dt); v.vy *= Math.exp(-3 * dt);
    v.sinkT = (v.sinkT || 0) + dt;
    if ((G.ticks % 4) === 0) G.particles.push({ kind: "splash", x: v.x + (Math.random() - 0.5) * 30, y: v.y + (Math.random() - 0.5) * 30, vx: 0, vy: -20, life: 0.5, a: 0.8 });
    if (isPlayer && v.sinkT > 0.8) { exitVeh(G); toast(G, "You bailed before it sank."); return; }
  } else v.sinkT = 0;
  const onLand = def.boat && surf !== "water" && surf !== "canal";
  const h = headingVec(v.rot);
  const r = rightVec(v.rot);
  let fwd = v.vx * h.x + v.vy * h.y;
  let lat = v.vx * r.x + v.vy * r.y;
  const throttle = Math.max(0, input.y || 0);
  const reverse = Math.max(0, -(input.y || 0));
  const hand = !!(input.hand || input.brake && !reverse);
  const isNyx = def.sprite === "nyx" && isPlayer;
  const boosting = isNyx && (input.boost || input.sprint) && throttle > 0;
  v.boost = boosting ? 1 : 0;
  const top = def.max * (boosting ? 1.25 : 1) * (v.health < 30 ? 0.7 : 1);
  // power curve: strong low end, tapering near top speed
  const k = clamp(Math.abs(fwd) / top, 0, 1);
  const torque = def.accel * (1.25 - 0.95 * k * k) * (isNyx ? 1 + 0.35 * Math.max(0, 1 - Math.abs(fwd) / 160) : 1) * (boosting ? 1.5 : 1);
  if (throttle > 0) {
    if (fwd < -5) fwd += def.brake * throttle * dt; // braking out of reverse
    else fwd += torque * throttle * dt;
  }
  if (reverse > 0) {
    if (fwd > 5) fwd -= def.brake * reverse * dt; // brake first
    else fwd -= def.accel * 0.55 * reverse * dt;
  }
  if (hand) fwd *= Math.exp(-(def.bike ? 1.4 : 0.9) * dt);
  if(!def.boat){const cornerTop=top/(1+Math.abs(input.x||0)*.78);if(Math.abs(fwd)>cornerTop)fwd*=Math.exp(-Math.abs(input.x||0)*1.8*dt);}
  // surface grip
  const speed0 = Math.abs(fwd);
  let grip = def.grip * (GRIP[surf] || 0.7) * (G.wet > 0.3 ? 0.8 : 1);
  if (def.boat) grip = onLand ? 0.2 : 0.62 + 0.25 * Math.max(0, 1 - speed0 / 160); // boats carve: more bite at low speed, slide when fast
  if (def.bike) grip = Math.max(grip, def.grip * 1.45 * (GRIP[surf] || 0.7));
  const speed = Math.abs(fwd);
  // steering: speed-sensitive, understeer at the top end, more bite on bikes
  const steerIn = clamp(input.x || 0, -1, 1);
  const steerAuth = def.steer * Math.min(1, speed / (def.bike ? 28 : def.boat ? 22 : 55)) * (1 - (def.bike ? 0.25 : 0.35) * k) * (hand ? 1.35 : 1) * (def.boat ? 1.15 : 1);
  const yawRate = steerIn * steerAuth * Math.sign(fwd || 1) * 1.15;
  v.yaw = lerp(v.yaw || 0, yawRate, Math.min(1, (def.bike ? 12 : 8) * dt));
  v.rot += v.yaw * dt;
  // lateral slip: handbrake lets the rear step out
  const slipGrip = hand ? 1.1 : (isNyx && Math.abs(steerIn) > 0.6 && speed > 150 ? 4.2 : 7.5);
  lat *= Math.exp(-grip * slipGrip * dt * (def.boat ? 0.5 : 1));
  if (hand && speed > 60) lat += -steerIn * speed * 0.9 * dt; // kick the tail out
  v.drifting = Math.abs(lat) > 34 && speed > 60;
  // rolling + aero drag
  fwd *= Math.exp(-(0.12 + (onLand ? 3 : 0) + (surf === "grass" || surf === "sand" || surf === "dirt" ? 0.35 : 0)) * dt);
  fwd -= Math.sign(fwd) * Math.min(Math.abs(fwd), 0.0009 * fwd * fwd * dt * 60 * 0.02);
  if (def.boat && !onLand) fwd *= Math.exp(-Math.abs(v.yaw || 0) * 0.35 * dt); // turning bleeds speed into the wake
  fwd = clamp(fwd, -def.max * 0.42, top);
  v.lean = lerp(v.lean || 0, steerIn * Math.min(1, speed / 140) * (def.bike ? 0.55 : def.boat ? 0.3 : 0.16) + (def.boat && !onLand ? Math.sin(G.ticks * 0.07 + v.x * 0.01) * 0.05 : 0), (def.bike ? 10 : 8) * dt);
  v.turnSign = steerIn;
  v.braking = reverse > 0 && fwd > 5 || hand;
  v.visualAccel = lerp(v.visualAccel || 0, clamp((fwd - (v.fwd || 0)) / Math.max(.01, dt) / 250, -1, 1), Math.min(1, dt * 9));
  v.visualTravel = (v.visualTravel || 0) + speed * dt;
  v.fwd = fwd;
  if (v.drifting) {
    G.skids.push({ x: v.x - h.x * 14, y: v.y - h.y * 14, a: 0.8, rot: v.rot });
    if (G.skids.length > 600) G.skids.splice(0, 100);
    if (isPlayer && Math.random() < 0.5) G.particles.push({ kind: "smoke", x: v.x - h.x * 18, y: v.y - h.y * 18, vx: (Math.random() - 0.5) * 20, vy: (Math.random() - 0.5) * 20, life: 0.6, frame: 0 });
    if (isPlayer && G.audio.skid && (G.ticks % 9) === 0) G.audio.skid();
  }
  if (isNyx && Math.abs(fwd) > 190) {
    const bk = headingVec(v.rot), rt = rightVec(v.rot);
    for (const side of [-1, 1]) G.particles.push({ kind: "trail", x: v.x - bk.x * 26 + rt.x * side * 9, y: v.y - bk.y * 26 + rt.y * side * 9, vx: 0, vy: 0, life: 0.22, a: Math.min(1, (Math.abs(fwd) - 190) / 120) });
  }
  if (boosting) {
    addShake(G, 1.2);
    if ((G.ticks % 2) === 0) G.particles.push({ kind: "boost", x: v.x - h.x * 18, y: v.y - h.y * 18, vx: -h.x * 80 + (Math.random() - 0.5) * 30, vy: -h.y * 80 + (Math.random() - 0.5) * 30, life: 0.28, a: 1, col: Math.random() < 0.5 ? "#ff4ad2" : "#29f0ff" });
  }
  const nh = headingVec(v.rot), nr = rightVec(v.rot);
  v.vx = nh.x * fwd + nr.x * lat;
  v.vy = nh.y * fwd + nr.y * lat;
  // Sweep the complete hull in short steps, sliding along the first blocking surface.
  if(carHit(G,v,v.x,v.y)){const rotated=v.rot;v.rot=oldRot;if(carHit(G,v,v.x,v.y))v.rot=rotated;}
  const travel=Math.hypot(v.vx,v.vy)*dt,steps=Math.max(1,Math.ceil(travel/5));let impact=0;
  for(let step=0;step<steps;step++){
    const dx=v.vx*dt/steps,dy=v.vy*dt/steps,nx=v.x+dx,ny=v.y+dy,hit=carHit(G,v,nx,ny);
    if(!hit){v.x=nx;v.y=ny;continue;}
    const vn=v.vx*hit.nx+v.vy*hit.ny;impact=Math.max(impact,Math.abs(vn));
    if(!carHit(G,v,nx,v.y))v.x=nx;
    else if(!carHit(G,v,v.x,ny))v.y=ny;
    if(vn<0){v.vx-=vn*1.12*hit.nx;v.vy-=vn*1.12*hit.ny;}v.vx*=.86;v.vy*=.86;
    break;
  }
  if(impact>70 && !(v.impactT>0)){
    v.impactT=.35;if(isPlayer){recordIncident(G,'collision');(v.def.boat?G.audio.splash||G.audio.crash:G.audio.crash)(impact/200);addShake(G,Math.min(9,impact/24));}
    damageVeh(G,v,impact/(v.def.boat?18:12),isPlayer);
    for(let i=0;i<(G.settings.quality==='low'?3:8);i++)G.particles.push({kind:v.def.boat?'splash':'spark',x:v.x,y:v.y,vx:(Math.random()-.5)*160,vy:(Math.random()-.5)*160,life:.25});
  }
  v.impactT=Math.max(0,(v.impactT||0)-dt);
  smashNear(G, v.x, v.y, v.r + 8, Math.hypot(v.vx, v.vy));
  const spdNow = Math.hypot(v.vx, v.vy);
  if (def.boat && spdNow > 40) G.particles.push({ kind: "wake", rot: v.rot, width: Math.min(42, 12 + Math.hypot(v.vx, v.vy) * .07), x: v.x - nh.x * 18, y: v.y - nh.y * 18, vx: -nh.x * 6 + (Math.random() - 0.5) * 12, vy: -nh.y * 6 + (Math.random() - 0.5) * 12, life: 0.5, a: 0.4 });
  if (isPlayer && spdNow > 50 && G.wet > 0.25 && (G.ticks % 3) === 0) G.particles.push({ kind: "splash", x: v.x - nh.x * 12, y: v.y - nh.y * 12, vx: (Math.random() - 0.5) * 30, vy: -30, life: 0.35, a: 0.7 });
  if (isPlayer && (surf === "sand" || surf === "dirt" || surf === "grass") && spdNow > 40 && (G.ticks % 2) === 0) G.particles.push({ kind: "dust", x: v.x - nh.x * 14, y: v.y - nh.y * 14, vx: -nh.x * 10, vy: -nh.y * 10, life: 0.5, a: 0.5 });
  tickVehDamage(G, v, dt);
  if (isPlayer && input.enterP) exitVeh(G);
  if (isPlayer && input.fire) shoot(G, v, false);
}

function carHit(G, v, x, y) {
  return worldBodyHit(G,v,x,y);
}

function damageVeh(G, v, amt, byPlayer=false) {
  if (amt <= 0 || v.dead) return;
  v.health = (v.health ?? 100) - amt;
  if (v.health < 35 && !v.wrecked) { v.wrecked = true; }
  if (v.health < 12 && !v.burning) { v.burning = true; v.burnT = 4.5; v.playerIgnited=byPlayer; }
  if (v.cop && v === G.player) return;
}
function tickVehDamage(G, v, dt) {
  if (v.health < 45 && (G.ticks % 5) === 0) G.particles.push({ kind: "smoke", x: v.x + (Math.random() - 0.5) * 10, y: v.y + (Math.random() - 0.5) * 10, vx: (Math.random() - 0.5) * 16, vy: -24, life: 0.7, frame: 0, dark: v.health < 25 });
  if (v.burning) {
    v.burnT -= dt;
    if ((G.ticks % 2) === 0) G.particles.push({ kind: "fire", x: v.x + (Math.random() - 0.5) * 16, y: v.y + (Math.random() - 0.5) * 16, vx: 0, vy: -30, life: 0.4 });
    G.flashes.push({ x: v.x, y: v.y, r: 120, col: "rgba(255,140,40,0.55)", life: 0.05 });
    if (v.burnT <= 0) explode(G, v);
  }
}
function explode(G, v) {
  v.burning = false; v.dead = true; v.wrecked = true; v.health = 0; v.vx *= 0.3; v.vy *= 0.3;
  G.particles.push({ kind: "boom", x: v.x, y: v.y, life: 0.6, frame: 0, big: true });
  for (let i = 0; i < 26; i++) G.particles.push({ kind: "spark", x: v.x, y: v.y, vx: (Math.random() - 0.5) * 520, vy: (Math.random() - 0.5) * 520, life: 0.3 + Math.random() * 0.3 });
  for (let i = 0; i < 10; i++) G.particles.push({ kind: "smoke", x: v.x, y: v.y, vx: (Math.random() - 0.5) * 80, vy: (Math.random() - 0.5) * 80, life: 1.2, frame: 0, dark: true });
  G.flashes.push({ x: v.x, y: v.y, r: 760, col: "rgba(255,190,90,1)", life: 0.6, max: 0.6 });
  G.audio.crash(); if (G.audio.boom) G.audio.boom();
  addShake(G, 16);
  scarePeds(G, v.x, v.y, 420);
  if(airborne(v)){if(G.player===v)wasted(G);return;}
  if (G.player === v) { exitVeh(G,true); G.health -= 60; if (G.health <= 0) wasted(G); }
  else if (G.player.type === "foot" && Math.hypot(G.player.x - v.x, G.player.y - v.y) < 70) { G.health -= 45; if (G.health <= 0) wasted(G); }
  for (const p of G.peds) if (!p.dead && Math.hypot(p.x - v.x, p.y - v.y) < 70) {if(v.playerIgnited&&!p.copPed)recordIncident(G,'civilian_harm');killPed(G,p,false,!!v.playerIgnited);}
  for (const o of G.vehicles) if (o !== v && !o.dead && Math.hypot(o.x - v.x, o.y - v.y) < 90) damageVeh(G, o, 40,!!v.playerIgnited);
  if (v.cop&&v.playerIgnited) crime(G, 1, v.x, v.y, true);
}

// Oriented hull contacts, spatially indexed and resolved by vehicle mass.
function tickCollisions(G) {
  const vs = G.vehicles;
  const P = G.player;
  const near = vs.filter((v) => !airborne(v) && Math.abs(v.x - G.cam.x) < 1400 && Math.abs(v.y - G.cam.y) < 1100);
  if (P.type === "veh" && !airborne(P) && !near.includes(P)) near.push(P);
  G.nearVehicles=near;
  const grid=G.streetVehicleGrid||new Map();grid.clear();
  for(const v of near){const key=Math.floor(v.x/160)*65536+Math.floor(v.y/160);if(!grid.has(key))grid.set(key,[]);grid.get(key).push(v);}
  G.streetVehicleGrid=grid;G.streetVehicleSource=G.vehicles;
  if(G.streetVehicleQueries)G.streetVehicleQueries.clear();else G.streetVehicleQueries=new Map();
  G.movingVehicles=near.filter(v=>!v.dead&&!v.def.boat&&!airborne(v)&&Math.hypot(v.vx||0,v.vy||0)>45);
  for(const [a,b] of nearbyPairs(near)) {
      if(!!a.def.boat!==!!b.def.boat)continue;
      if(a.parked&&b.parked&&!a.loose&&!b.loose)continue;
      const best=bodyContact(a,b);if(!best)continue;
      const ma = a.def.mass * (a.parked && !a.loose ? 2.2 : 1), mb = b.def.mass * (b.parked && !b.loose ? 2.2 : 1);
      const ta = mb / (ma + mb), tb = ma / (ma + mb);
      // pinned against a wall: the car that would be pushed into a building stays put and the other takes the whole push
      const ax = a.x - best.nx * best.pen * ta, ay = a.y - best.ny * best.pen * ta;
      const bx = b.x + best.nx * best.pen * tb, by = b.y + best.ny * best.pen * tb;
      const aBad = !!carHit(G, a, ax, ay), bBad = !!carHit(G, b, bx, by);
      if (aBad && !bBad) { b.x += best.nx * best.pen; b.y += best.ny * best.pen; }
      else if (bBad && !aBad) { a.x -= best.nx * best.pen; a.y -= best.ny * best.pen; }
      else if (!aBad) { a.x = ax; a.y = ay; b.x = bx; b.y = by; }
      else { // both pinned: slide them apart along the wall tangent
        const tx = -best.ny, ty = best.nx, sg = ((a.x - b.x) * tx + (a.y - b.y) * ty) >= 0 ? 1 : -1;
        const d=best.pen*.5;
        if(!carHit(G,a,a.x+tx*sg*d,a.y+ty*sg*d)){a.x+=tx*sg*d;a.y+=ty*sg*d;}
        if(!carHit(G,b,b.x-tx*sg*d,b.y-ty*sg*d)){b.x-=tx*sg*d;b.y-=ty*sg*d;}
      }
      const playerImpact = a===P ? a.vx*best.nx+a.vy*best.ny : b===P ? -b.vx*best.nx-b.vy*best.ny : 0;
      const otherImpact = a===P ? -b.vx*best.nx-b.vy*best.ny : b===P ? a.vx*best.nx+a.vy*best.ny : Infinity;
      const rv = (b.vx - a.vx) * best.nx + (b.vy - a.vy) * best.ny;
      if (rv < 0) {
        const jimp = -(1.3) * rv / (1 / ma + 1 / mb);
        a.vx -= jimp / ma * best.nx; a.vy -= jimp / ma * best.ny;
        b.vx += jimp / mb * best.nx; b.vy += jimp / mb * best.ny;
        const imp = Math.abs(rv);
        for (const v of [a, b]) {
          if (v.isVan && imp > 50) v.loose = true;
          if (v.traffic && v !== P) { v.traffic = false; v.loose = true; v.tr = null; v.parked = false; v.looseT = 0; }
          if (v.parked && v !== P) { v.loose = true; v.parked = false; v.looseT = 0; }
        }
        if (imp > 50) {
          if(playerImpact>50 && playerImpact>otherImpact)recordIncident(G,'collision');
          const atFault=playerImpact>50&&playerImpact>otherImpact;
          damageVeh(G, a, imp / 14,atFault); damageVeh(G, b, imp / 14,atFault);
          if (a === P || b === P) { G.audio.crash(); addShake(G, Math.min(12, imp / 22)); }
          const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
          for (let k = 0; k < 8; k++) G.particles.push({ kind: "spark", x: cx, y: cy, vx: (Math.random() - 0.5) * 260, vy: (Math.random() - 0.5) * 260, life: 0.2 });
          // only the player's fault if they were the one ramming (cops pinning you is not a new crime)
          if ((a === P && b.cop) || (b === P && a.cop)) {
            const cop = a === P ? b : a, ps = Math.hypot(P.vx, P.vy), cs = Math.hypot(cop.vx, cop.vy);
            if (ps > 150 && ps > cs + 60 && !(G._ramCool > 0)) { G._ramCool = 4; crime(G, 1, cx, cy, true, Math.max(3, G.wanted)); }
          }
        }
      }
  }
}

function localStreetVehicles(G,x,y){
  if(!G.streetVehicleGrid||G.streetVehicleSource!==G.vehicles)return G.vehicles;
  const cx=Math.floor(x/160),cy=Math.floor(y/160),key=cx*65536+cy;
  const cached=G.streetVehicleQueries.get(key);if(cached)return cached;
  const result=[];
  for(let ix=cx-1;ix<=cx+1;ix++)for(let iy=cy-1;iy<=cy+1;iy++){
    const bucket=G.streetVehicleGrid.get(ix*65536+iy);if(bucket)for(let i=0;i<bucket.length;i++)result.push(bucket[i]);
  }
  G.streetVehicleQueries.set(key,result);return result;
}

function solidAtSafe(G, x, y, r) {
  return G.solidAt(x, y) || G.solidAt(x + r, y) || G.solidAt(x - r, y) || G.solidAt(x, y + r) || G.solidAt(x, y - r);
}

function tryEnter(G, instant) {
  const p = G.player;
  if (p.type === "veh") return;
  if (G.jack) return;
  const v = nearestVeh(G, p.x, p.y, 104);
  if (v) enterVeh(G, v, instant);
  else toast(G, "No ride close enough. Walk up to a car.");
}

function nearestVeh(G, x, y, r, kind) {
  let best = null, bd = r;
  for (const v of G.vehicles) {
    if ((v.driver && v !== G.player) || v.dead || airborne(v)) continue;
    if (kind && v.kind !== kind) continue;
    const d = Math.hypot(v.x - x, v.y - y);
    if (d < bd) { bd = d; best = v; }
  }
  return best;
}

function enterVeh(G, v, instant) {
  if (!v || airborne(v)) return;
  if (v.lockedUntil && !G.unlocked.includes(v.lockedUntil) && !G.unlocked.includes(v.kind)) {
    toast(G, "Still locked. Earn it first.");
    return;
  }
  if (v.def.boat && !["water", "canal", "pier"].includes(G.world?.boatSurfaceAt?.(v.x,v.y)||G.surfaceAt(v.x, v.y))) {
    toast(G, "That hull wants water.");
    return;
  }
  if (!instant && G.player && G.player.type === "foot") {
    G.jack = { v, t: 0.38, dur: 0.38, fromX: G.player.x, fromY: G.player.y };
    G.audio.enter();
    addShake(G, 3);
    for (let i = 0; i < 8; i++) {
      G.particles.push({ kind: "smoke", x: v.x, y: v.y, vx: (Math.random()-0.5)*40, vy: (Math.random()-0.5)*40, life: 0.3, frame: 0 });
    }
    return;
  }
  finishEnter(G, v);
}

function finishEnter(G, v) {
  v.doorT=.55;
  // a traffic driver gets pulled out and runs
  if (v.traffic || v.tr) {
    const r = rightVec(v.rot);
    const s = findSafe(G, v.x - r.x * 30, v.y - r.y * 30, 8);
    G.peds.push({ x: s.x, y: s.y, rot: v.rot, vx: 0, vy: 0, sprite: ["m1", "m2", "cabbie", "m3"][(Math.random() * 4) | 0], speed: 0, walk: 40, dist: 0, flee: 5, threatX: v.x, threatY: v.y, r: 8, hp: 30, dead: false, ambient: true });
    if (G.audio.yelp) G.audio.yelp();
  }
  v.parked = false; v.loose = false; v.ambient = false; v.keep = true;
  v.driver = "player";
  v.traffic = false; v.tr = null;
  G.player = v;
  G.audio.enter();
  if (!G.audio.radio) G.audio.setRadio(true);
  const name = G.audio.currentStation ? G.audio.currentStation() : "VEIL FM";
  G.radioName = name;
  G.radioT = 3.2;
  if (G.audio.stinger) G.audio.stinger(G.audio.station || 0);
  if (v.def && v.def.cop) crime(G, 1, v.x, v.y, false, 2);
  G.cops = G.cops.filter((c) => c !== v);
}

function exitVeh(G, emergency=false) {
  const v = G.player;
  if (v.type !== "veh") return;
  if(!emergency&&!canExitAircraft(v)){v.landing=true;toast(G,"Land and stop before exiting.");return;}
  if(v.def.aircraft){v.vx=v.vy=v.airspeed=0;v.landing=false;if(emergency)v.altitude=0;}
  v.doorT=.75;
  const r = rightVec(v.rot);
  // Boats can only disembark at a nearby reachable bank, never teleport across the bay.
  if(v.def.boat&&!emergency){const bank=findSafe(G,v.x,v.y,8,true);if(Math.hypot(bank.x-v.x,bank.y-v.y)>125){toast(G,"Pull alongside a pier or shore to get out.");return;}}
  v.driver = null;
  v.loose = true; v.parked = false; v.traffic = false; v.tr = null;
  v.siren = false;
  let spot = null;
  for (const side of [-1, 1, 0]) {
    const offset=v.def.aircraft?70:30;
    const x = v.x + r.x * offset * side, y = v.y + r.y * offset * side + (side === 0 ? 40 : 0);
    if (footClear(G, x, y, 7)) { spot = { x, y }; break; }
  }
  if (!spot) spot = findSafe(G, v.x - r.x * 30, v.y - r.y * 30, 8);
  const foot = makeFoot(G, spot.x, spot.y, v.rot);
  foot.exitT = 1;
  G.player = foot;
  G.audio.exit();
  G.audio.setEngine(false, 0, false);
}

function spawnPlayerCar(G, kind, x, y, rot) {
  const v = makeVeh(kind, x, y, rot || 0);
  G.vehicles.push(v);
  return v;
}

function shoot(G, from, onFoot) {
  const weapon=requestShot(G); if(!weapon) return;
  from.shotTick = G.ticks;
  G.lastShot = now();
  let rot = from.rot;
  if (G.touch) rot = aimDirection(G.input, rot, G.cam.rot);
  if (G.input.mouse.fire && !G.touch) {
    const aim = screenToWorld(G, G.input.mouse.x, G.input.mouse.y);
    rot = Math.atan2(aim.x - from.x, -(aim.y - from.y));
  }
  from.aimRot=rot;
  const h = headingVec(rot);
  const speed = weapon.speed;
  // light auto-aim on foot: snap to the nearest target in a narrow cone
  let ax = h.x, ay = h.y;
  if (onFoot && G.settings.aimAssist !== false) {
    let best = null, bd = 320;
    const targets = G.cops.concat(G.peds.filter((p) => p.copPed && !p.dead));
    if (G._flow?.objectives[G.objectiveIndex]?.kind === 'intercept' && G.van && !G.van.dead) targets.push(G.van);
    for (const t of targets) {
      const dx = t.x - from.x, dy = t.y - from.y, d = Math.hypot(dx, dy);
      if (!t.dead && d > 0 && d < bd && G.nav.clearLine(from.x, from.y, t.x, t.y) && (dx * h.x + dy * h.y) / d > (G.touch ? .8 : .94)) { bd = d; best = { x: dx / d, y: dy / d }; }
    }
    if (best) { ax = best.x; ay = best.y; }
  }
  const muzzle=onFoot?18:muzzleLength(from,Math.atan2(ax,-ay));
  const sx = from.x + ax * muzzle, sy = from.y + ay * muzzle;
  const angle=Math.atan2(ax,-ay);
  from.aimRot=angle;
  for(let i=0;i<weapon.pellets;i++) {
    const a=angle+(Math.random()-.5)*weapon.spread;
    G.bullets.push({ x:sx,y:sy,vx:Math.sin(a)*speed,vy:-Math.cos(a)*speed,life:.7,friend:true,waterLevel:!!from.def?.boat,damage:weapon.damage,carDamage:weapon.carDamage });
  }
  G.audio.shot(0,weapon.quiet?.65:0,weapon.pellets>1?'shotgun':weapon.quiet?'pistol':'smg');
  G.particles.push({kind:'casing',x:from.x+ay*9,y:from.y-ax*9,vx:ay*50,vy:-ax*50,life:.7});
  G.particles.push({ kind: "flash", x: sx, y: sy, life: 0.06, a: 1 });
  G.flashes.push({ x: sx, y: sy, r: 150, col: "rgba(255,210,140,0.9)", life: 0.07, max: 0.07 });
  // gunfire is only a crime if someone sees it
  const copNear = G.cops.some((c) => Math.hypot(c.x - from.x, c.y - from.y) < 520) || G.vehicles.some((v) => v.cop && !v.dead && Math.hypot(v.x - from.x, v.y - from.y) < 420);
  if (copNear && (!weapon.quiet || G.cops.some(c=>Math.hypot(c.x-from.x,c.y-from.y)<180))) crime(G, 1, from.x, from.y, false, 2);
  scarePeds(G, from.x, from.y, weapon.quiet?110:320);
  G.shotsFired = (G.shotsFired || 0) + 1;
  if (!weapon.quiet && G.shotsFired % 6 === 0 && G.peds.some((p) => !p.dead && Math.hypot(p.x - from.x, p.y - from.y) < 300)) crime(G, 1, from.x, from.y, false, 1);
}

function bridgeAt(G,x,y){const E=G.world?.expansion;if(!E)return false;const c=E.canal;if(c&&(x<c.x-64||x>c.x+c.w+64))return false;return E.bridges?.some(r=>x>=r.x&&x<=r.x+r.w&&y>=r.y&&y<=r.y+r.h)||false;}
function bulletLayerMatches(G,b,target){return !bridgeAt(G,target.x,target.y)||!!b.waterLevel===!!target.def?.boat;}
function tickBullets(G, dt) {
  for (const b of G.bullets) {
    if(b.life<=0)continue;
    const x0=b.x,y0=b.y,x1=x0+b.vx*dt,y1=y0+b.vy*dt;b.life-=dt;
    let first=1.01,target=null,wall=false;
    const steps=Math.max(1,Math.ceil(Math.hypot(x1-x0,y1-y0)/5));
    for(let i=1;i<=steps;i++){const t=i/steps;if(G.solidAt(x0+(x1-x0)*t,y0+(y1-y0)*t)){first=t;wall=true;break;}}
    if(b.friend){
      for(const p of G.peds){if(p.dead||!bulletLayerMatches(G,b,p))continue;const t=segmentCircle(x0,y0,x1,y1,p.x,p.y,12);if(t!==null&&t<first){first=t;target=p;wall=false;}}
      for(const v of G.vehicles){if(v===G.player||v.dead||airborne(v)||Math.abs(v.x-x0)>Math.abs(x1-x0)+85||Math.abs(v.y-y0)>Math.abs(y1-y0)+85||!bulletLayerMatches(G,b,v))continue;const t=segmentBody(v,x0,y0,x1,y1,2);if(t!==null&&t<first){first=t;target=v;wall=false;}}
    }else{
      // Cars and scenery shield characters from police fire as well.
      for(const v of G.vehicles){if(v.dead||v.cop&&v!==G.player||airborne(v)||Math.abs(v.x-x0)>Math.abs(x1-x0)+85||Math.abs(v.y-y0)>Math.abs(y1-y0)+85||!bulletLayerMatches(G,b,v))continue;const t=segmentBody(v,x0,y0,x1,y1,1);if(t!==null&&t<first){first=t;target=v;wall=false;}}
      if(G.player.type==='foot'&&bulletLayerMatches(G,b,G.player)){const t=segmentCircle(x0,y0,x1,y1,G.player.x,G.player.y,12);if(t!==null&&t<first){first=t;target=G.player;wall=false;}}
    }
    const t=Math.min(1,first);b.x=x0+(x1-x0)*t;b.y=y0+(y1-y0)*t;
    if(first>1)continue;b.life=0;
    if(wall){G.particles.push({kind:'spark',x:b.x,y:b.y,vx:-b.vx*.04,vy:-b.vy*.04,life:.15});continue;}
    if(target?.def){damageVeh(G,target,b.friend?b.carDamage||6:4,!!b.friend);G.particles.push({kind:'spark',x:b.x,y:b.y,vx:0,vy:0,life:.15});if(b.friend){G.hitConfirmT=.14;if(target.cop)crime(G,1,b.x,b.y,true);}continue;}
    if(target===G.player){if(!(G._endT>0)&&!(G.action?.dodgeT>.08)){G.health-=G.action?.cover?2.5:7;G.hurtT=.3;if(G.health<=0){wasted(G);return;}}continue;}
    if(target){target.hp=(target.hp??30)-(b.damage||20);target.flee=4;target.threatX=G.player.x;target.threatY=G.player.y;G.hitConfirmT=.14;
      if(!target.copPed){recordIncident(G,'civilian_harm');crime(G,1,target.x,target.y,false,3);}
      G.particles.push({kind:'blood',x:b.x,y:b.y,life:.25});if(target.hp<=0)killPed(G,target,true);
    }
  }
  G.bullets=G.bullets.filter(b=>b.life>0);
}

function respawn(G) { wasted(G); }
function killPed(G, p, byGun, attributed=true) {
  if (p.dead) return;
  p.dead = true; p.deadT = 0; p.speed = 0;
  G.audio.hit();
  if(attributed){if (p.copPed) crime(G, 2, p.x, p.y, true); else crime(G, 1, p.x, p.y, false);}
  scarePeds(G, p.x, p.y, 320);
  if (Math.random() < 0.5) G.pickups.push({ x: p.x + 6, y: p.y + 4, v: 5 + ((Math.random() * 20) | 0), drop: true });
  callAmbulance(G, p.x, p.y);
}
function wasted(G) {
  const busted = false;
  endLife(G, "WASTED", "Mercy Unit patched you up.", "hospital");
}
function busted(G) { endLife(G, "BUSTED", "Metro took your piece and some chips.", "pd"); }
// Recovery changes actors, not campaign receipts or the persistent city. Remove
// chase ownership before clearing arrays so no detached unit can resume its AI.
function clearRecoveryState(G) {
  G.recoverySerial=(G.recoverySerial||0)+1;
  G.releaseControls?.(); resetInput(G.input);
  const old=G.player, units=new Set(G.cops||[]), rival=G.race?.rival;
  for(const v of G.vehicles||[]){
    if(v===old&&v.type==='veh'){
      v.driver=null;v.vx=v.vy=0;v.loose=false;v.parked=true;
      if(v.def.aircraft){v.altitude=0;v.verticalSpeed=v.airspeed=0;v.landing=false;
        if(v.home&&!v.dead){v.x=v.home.x;v.y=v.home.y;v.rot=v.home.rot;}}
    }
    if(units.has(v)||v.chasing){units.add(v);v.ai=false;v.chasing=false;v.siren=false;v.tr=null;v.traffic=false;v.crewOut=false;v.target=null;v.reverseT=v.stuckT=v.progT=0;}
    if(v.siren)v.siren=false;
  }
  G.vehicles=(G.vehicles||[]).filter(v=>v!==rival&&(!units.has(v)||v===old||v.pdCar));
  G.peds=(G.peds||[]).filter(p=>!p.copPed);
  G.cops=[];G.bullets=[];G.flashes=[];G.particles=[];G.floaters=[];
  G.jack=null;G.race=null;G.contactNear=G.contactTalk=null;G.policeTarget=null;G.heliChase=false;G.evading=false;
  G.nearVehicles=null;G.movingVehicles=null;G.streetVehicleGrid=null;G.streetVehicleQueries=null;G.streetVehicleSource=null;G.interactP=false;G.hurtT=G.hitConfirmT=0;
  G.seenT=G.wantedCool=G._crimeCool=G._ramCool=G.starFlash=G._endT=G._ambT=0;
  G.gps=null;G.gpsPts=null;G.gpsT=0;G.lastShot=0;G._heli=null;
  G.banner=null;G.toastT=0;G.tip='';
  if(G.cam)G.cam.lx=G.cam.ly=G.cam.shake=0;
  if(G.nav){G.nav.t=0;G.nav.lastX=G.nav.lastY=-1;G.nav.dist?.fill(65535);}
  if(G.missionState){G.missionState.holdT=0;G.missionState.hacking=false;G.missionState.scramblerT=0;}
  if(G.action){for(const k of ['reloadT','shotT','dodgeT','dodgeCool','combo','comboT'])G.action[k]=0;G.action.cover=false;G.action.exhausted=false;G.action.stamina=100;if(G.action.contract)G.action.contract.progress=0;}
  G.audio?.setEngine?.(false,0,false);G.audio?.setRadio?.(false);G.radioT=0;
  G.cityAI?.reset?.();
}
function endLife(G, title, sub, where) {
  if (G._endT > 0) return;
  recordIncident(G,'death');
  G._endT = 2.2;
  G.health = 100;
  const lost = Math.min(G.chips, Math.round(G.chips * 0.08));
  G.chips -= lost;
  clearRecoveryState(G);
  G._endT=2.2;
  const at = where === "pd" ? [G.meta.spawns.pd[0], G.meta.spawns.pd[1] + 120] : [G.meta.spawns.player[0], G.meta.spawns.player[1]];
  const s = findSafe(G, at[0], at[1], 14, true, true);
  G.player = makeFoot(G, s.x, s.y, 0);G.player.impactT=2.2;
  G.cam.x = s.x; G.cam.y = s.y; G.cam.lx=G.cam.ly=G.cam.shake=0;
  G.wanted = 0; G.wantedCool = 0;
  restoreStreetRoute(G);
  spawnAircraft(G,makeVeh);
  showBanner(G, title, sub + (lost ? `  −${lost} chips` : ""), "bust");
  // keep the mission, restart the current objective
  if (G._flow) { const obj = G._flow.objectives[G.objectiveIndex]; if (obj && obj.at === "van" && !G.van) spawnVan(G); if (G.race) { G.race = null; } }
}

function bumpWanted(G, n) {
  const prev = G.wanted;
  G.wanted = clamp(G.wanted + n, 0, 5);
  G.wantedCool = 0;
  G.seenT = 0;
  if (G.wanted > prev) { G.audio.star(); G.starFlash = 1.2; }
  if (prev < 3 && G.wanted >= 3 && G.audio.chaseSwell) G.audio.chaseSwell();
}
// a crime: +n stars (capped, so petty stuff never jumps straight to a manhunt)
function crime(G, n, x, y, serious, cap) {
  if(G._endT>0)return;
  if (G.missionState) G.missionState.scramblerT = 0;
  G.policeTarget = { x, y };
  const limit = cap ?? (serious ? 5 : 3);
  if (G.wanted >= limit) { G.seenT = 0; return; }
  if (G._crimeCool > 0 && !serious) return;
  G._crimeCool = 1.5;
  bumpWanted(G, Math.min(n, limit - G.wanted));
}

function tickWanted(G, dt) {
  G.missionState.scramblerT = Math.max(0, (G.missionState.scramblerT || 0) - dt);
  if (G._endT > 0) G._endT -= dt;
  if (G._crimeCool > 0) G._crimeCool -= dt;
  if (G._ramCool > 0) G._ramCool -= dt;
  if (G.starFlash > 0) G.starFlash -= dt;
  if (G.wanted <= 0) {
    // stand-down: cops go back to patrol (become regular cars and despawn)
    for (const c of G.cops) { c.chasing = false; c.ai = false; c.loose = true; c.siren = false; c.ambient = true; c.cop = true; c.keep = false; }
    G.cops = []; G.policeTarget = null; G.heliChase=false;G.evading=false;G.seenT=0;
    G.peds = G.peds.filter((p) => !p.copPed || Math.hypot(p.x - G.player.x, p.y - G.player.y) < 300 && false);
    return;
  }
  const P = G.player;
  // seen = a cop has line of sight within range
  let seen = false;
  for (const c of G.cops) if (!c.dead && Math.hypot(c.x - P.x, c.y - P.y) < 620 && G.nav.clearLine(c.x, c.y, P.x, P.y)) { seen = true; break; }
  for (const p of G.peds) if (p.copPed && !p.dead && Math.hypot(p.x - P.x, p.y - P.y) < 400 && G.nav.clearLine(p.x, p.y, P.x, P.y)) seen = true;
  if (seen) { G.seenT = 0; G.policeTarget = { x: P.x, y: P.y }; } else G.seenT = (G.seenT || 0) + dt;
  G.evading = !seen;
  const loseAfter = 7 + G.wanted * 2.5;
  if (G.seenT > loseAfter) {
    G.wanted = Math.max(0, G.wanted - 1);
    G.seenT = 0;
    if (G.wanted === 0) toast(G, "Heat's gone.");
    else toast(G, "Losing them…");
  }
  // cop units grow with stars: 1 / 2 / 3 / 5 / 6
  const need = [0, 1, 2, 3, 5, 6][G.wanted];
  G.cops = G.cops.filter((c) => !c.dead && G.vehicles.includes(c) && c !== P);
  if (!(G.missionState.scramblerT > 0) && (!G.evading || G.cops.length === 0) && G.cops.length < need && (G.ticks % (G.cops.length ? 90 : 20)) === 0) {
    // spawn on a road edge just out of view, never on top of the player
    const S = G.cam.scale * worldZoom(G);
    const viewR = Math.hypot(G.canvas.width, G.canvas.height) / 2 / S;
    let v = null;
    for (let k = 0; k < 4 && !v; k++) v = G.traffic.spawnCar(P, viewR + 40, viewR + 380 + k * 250, "metro");
    if (v && G.nav.next(v.x, v.y, 1) == null) { G.vehicles.splice(G.vehicles.indexOf(v), 1); v = null; }
    if (v) { v.traffic = false; v.tr = null; v.ai = true; v.cop = true; v.chasing = true; v.siren = true; v.ambient = false; v.keep = true; v.parked = false; G.cops.push(v); }
  }
  // heli at 4+
  G.heliChase = G.wanted >= 4;
}

function tickCops(G, dt) {
  const P = G.player;
  for (const c of G.cops) {
    if (!c || c === P || c.dead) continue;
    const dist = Math.hypot(P.x - c.x, P.y - c.y);
    let tx = (G.policeTarget || P).x, ty = (G.policeTarget || P).y;
    const pv = P.type === "veh" ? { x: P.vx, y: P.vy } : { x: 0, y: 0 };
    const los = !airborne(P) && dist < 520 && G.nav.clearLine(c.x, c.y, P.x, P.y);
    if (los) { tx = P.x + pv.x * Math.min(0.8, dist / 400); ty = P.y + pv.y * Math.min(0.8, dist / 400); }
    else { const n = G.nav.next(c.x, c.y, 4); if (n) { tx = n.x; ty = n.y; } }
    const ang = Math.atan2(tx - c.x, -(ty - c.y));
    const diff = angNorm(ang - c.rot);
    const fwd = c.vx * Math.sin(c.rot) - c.vy * Math.cos(c.rot);
    let y = dist > 600 && !los ? 1 : 0.78 + Math.min(0.22, G.wanted * 0.05);
    if (Math.abs(diff) > 1.4 && fwd > 120) y = -0.6;
    // stuck recovery
    c.stuckT = Math.abs(fwd) < 18 ? (c.stuckT || 0) + dt : 0;
    if (c.stuckT > 1.1) { c.reverseT = 0.9; c.stuckT = 0; }
    let x = clamp(diff * 2.2, -1, 1);
    if (c.reverseT > 0) { c.reverseT -= dt; y = -0.8; x = -x; }
    // on-foot suspect: stop nearby and get out
    const footTarget = P.type === "foot";
    if (footTarget && dist < 190) { y = fwd > 20 ? -1 : 0; }
    tickDrive(G, c, { x, y, hand: Math.abs(diff) > 1.2 && fwd > 140 && los, brake: false, fire: false, enterP: false }, dt, false);
    c.siren = true;
    // no progress for 5 s while out of sight: quietly recycle the unit (a fresh one is dispatched nearer)
    c.progT = (c.progT || 0) + dt;
    if (c.progT > 5) {
      if (!los && dist > 700 && dist > (c.progD || 1e9) - 120) { const i = G.vehicles.indexOf(c); if (i >= 0) G.vehicles.splice(i, 1); }
      c.progT = 0; c.progD = dist;
    }
    if (footTarget && dist < 230 && Math.abs(fwd) < 30 && !c.crewOut && G.wanted >= 1) {
      c.crewOut = true;
      for (let i = 0; i < (G.wanted >= 3 ? 2 : 1); i++) {
        const r = rightVec(c.rot);
        const s = findSafe(G, c.x + r.x * (i ? -26 : 26), c.y + r.y * (i ? -26 : 26), 8);
        G.peds.push({ x: s.x, y: s.y, rot: ang, vx: 0, vy: 0, sprite: "cop", speed: 0, walk: 130, dist: 0, flee: 0, r: 8, hp: 50, dead: false, copPed: true, car: c, grabT: 0 });
      }
    }
    if (!footTarget) c.crewOut = false;
    // ram + shoot from the car at 3+
    if (G.wanted >= 3 && los && dist < 320 && Math.random() < 0.025) {
      const a = Math.atan2(P.x - c.x, -(P.y - c.y)) + (Math.random() - 0.5) * 0.22;
      const h = headingVec(a);
      G.bullets.push({ x: c.x + h.x * 24, y: c.y + h.y * 24, vx: h.x * 520, vy: h.y * 520, life: 0.8, friend: false });
      G.flashes.push({ x: c.x + h.x * 24, y: c.y + h.y * 24, r: 110, col: "rgba(255,210,140,0.8)", life: 0.06, max: 0.06 });
      G.audio.shot && G.audio.shot();
    }
  }
  // cops on foot: chase, grab (bust) or shoot
  for (const p of G.peds) {
    if (!p.copPed || p.dead) continue;
    const dx = P.x - p.x, dy = P.y - p.y, d = Math.hypot(dx, dy);
    if (P.type === "veh" || G.wanted === 0) {
      // back to the car
      if (p.car && !p.car.dead) { const cd = Math.hypot(p.car.x - p.x, p.car.y - p.y); if (cd < 30) { p.dead = true; p.removed = true; p.car.crewOut = false; continue; } p.rot = Math.atan2(p.car.x - p.x, -(p.car.y - p.y)); }
      else { p.dead = true; p.removed = true; continue; }
    } else { const target = G.nav.clearLine(p.x, p.y, P.x, P.y) ? P : G.policeTarget || P; p.rot = Math.atan2(target.x - p.x, -(target.y - p.y)); }
    const sp = G.wanted >= 3 && d < 260 ? 40 : 120;
    const h = headingVec(p.rot);
    moveFoot(G, p, h.x * sp * dt, h.y * sp * dt);
    p.speed = sp; p.dist += sp * dt;
    if (P.type === "foot" && d < 26 && G.wanted <= 2) {
      p.grabT += dt;
      if (p.grabT > 0.7) {busted(G);return;}
    } else p.grabT = Math.max(0, p.grabT - dt);
    if (P.type === "foot" && G.wanted >= 3 && d < 300 && G.nav.clearLine(p.x, p.y, P.x, P.y) && Math.random() < 0.02) {
      const a = Math.atan2(dx, -dy) + (Math.random() - 0.5) * 0.25, hv = headingVec(a);
      G.bullets.push({ x: p.x + hv.x * 14, y: p.y + hv.y * 14, vx: hv.x * 480, vy: hv.y * 480, life: 0.8, friend: false });
      G.flashes.push({ x: p.x + hv.x * 14, y: p.y + hv.y * 14, r: 90, col: "rgba(255,210,140,0.8)", life: 0.06, max: 0.06 });
    }
  }
  G.peds = G.peds.filter((p) => !p.removed);
}

function tickVehicles(G, dt) {
  const P = G.player;
  for (const v of G.vehicles) {
    if(v.doorT>0)v.doorT=Math.max(0,v.doorT-dt);
    if (v === P || v.ai) continue;
    if(v.def.aircraft){if(v.burning)tickVehDamage(G,v,dt);continue;}
    if (v.isVan) {
      if (v.dead || v.health<=65) { v.vx = v.vy = 0; v.loose=true; continue; }
      // the seed van cruises the Strip southbound lanes
      const sx = ((G.meta.layout && G.meta.layout.southbound && G.meta.layout.southbound[1]) || 1820);
      if (v.loose) { tickDrive(G, v, { x: 0, y: 0, hand: true }, dt, false); continue; }
      v.x = lerp(v.x, sx, 0.8 * dt);
      v.y += 70 * dt; v.rot = Math.PI;
      v.vx = 0; v.vy = 70;
      if (v.y > 3700) v.y = 900;
      continue;
    }
    if (v.role === "boat" && v.def && v.def.boat) {
      if (v.loose) { tickDrive(G, v, { x: 0, y: 0 }, dt, false); continue; }
      v.cruise = (v.cruise || 0) + dt * 0.12;
      const hm = v.home || { x: 1920, y: 520 };
      const tx = hm.x + Math.cos(v.cruise) * 260, ty = Math.min(hm.y, 560) + Math.sin(v.cruise * 0.7) * 80 - 60;
      const ang = Math.atan2(tx - v.x, -(ty - v.y));
      const turn=clamp(angNorm(ang-v.rot)*2,-1,1);
      tickDrive(G,v,{x:turn,y:Math.abs(angNorm(ang-v.rot))>1?.15:.35},dt,false);
      if(Math.hypot(v.vx,v.vy)<5)v.cruise+=dt*2;
      continue;
    }
    if (v.role === "ambulance" && v.target) {
      const n = Math.hypot(v.target.x - v.x, v.target.y - v.y);
      const ang = Math.atan2(v.target.x - v.x, -(v.target.y - v.y));
      tickDrive(G, v, { x: clamp(angNorm(ang - v.rot) * 2, -1, 1), y: n < 120 ? 0.2 : 0.8 }, dt, false);
      v.siren = true;
      if (n < 60) { v.target = null; v.siren = false; v.loose = true; }
      continue;
    }
    if (v.loose && !v.traffic) {
      // knocked loose / abandoned: coast to a stop with physics
      tickDrive(G, v, { x: 0, y: 0, hand: false, brake: false }, dt, false);
      v.looseT = (v.looseT || 0) + dt;
      continue;
    }
    if (v.burning || v.health < 45) tickVehDamage(G, v, dt);
  }
  if (G._ambT) G._ambT -= dt;
  if (G.race && G.race.rival && G.race.started && !G.race.finished) {
    const riv = G.race.rival;
    const pts = G.race.pts;
    const i = Math.min(G.race.rivalI, pts.length - 1);
    const t = pts[i];
    const ang = Math.atan2(t[0] - riv.x, -(t[1] - riv.y));
    const diff = angNorm(ang - riv.rot);
    tickDrive(G, riv, { x: clamp(diff * 2.4, -1, 1), y: Math.abs(diff) > 0.9 ? 0.55 : 0.92, hand: Math.abs(diff) > 1.1 }, dt, false);
    if (Math.hypot(riv.x - pts[i][0], riv.y - pts[i][1]) < 65) G.race.rivalI++;
  }
}

function tickLife(G, dt) {
  if (!G.birds) {
    G.birds = [];
    for (let i = 0; i < 18; i++) {
      G.birds.push({
        x: 800 + Math.random() * 2400,
        y: 600 + Math.random() * 2800,
        rot: Math.random() * TAU,
        spd: 40 + Math.random() * 40,
        orbit: Math.random() * TAU,
      });
    }
  }
  if (!G.plane) G.plane = { x: 200, y: 400, rot: 0.6, spd: 220 };
  for (const b of G.birds) {
    b.orbit += dt * 0.6;
    // lazy circles over plazas, plus a little wander
    b.rot += Math.sin(b.orbit) * 0.4 * dt;
    b.x += Math.sin(b.rot) * b.spd * dt;
    b.y += -Math.cos(b.rot) * b.spd * dt;
    if (b.x < 200 || b.x > 3900 || b.y < 200 || b.y > 3900) b.rot += Math.PI * 0.6;
  }
  const pln = G.plane;
  pln.x += Math.sin(pln.rot) * pln.spd * dt;
  pln.y += -Math.cos(pln.rot) * pln.spd * dt;
  if (pln.x < -200 || pln.x > 4300 || pln.y < -200 || pln.y > 4300) {
    pln.x = -100; pln.y = 300 + Math.random() * 3000; pln.rot = 0.4 + Math.random() * 0.6;
  }
}

function scarePeds(G, x, y, r) {
  G.cityAI?.emit('gunshot', x, y, {radius:r});
  for (const p of G.peds) {
    if (p.dead || p.copPed || p.gather && r < 200) continue;
    if (Math.abs(p.x - x) < r && Math.abs(p.y - y) < r && Math.hypot(p.x - x, p.y - y) < r) {
      if (!(p.flee > 0) && G.audio.yelp && Math.random() < 0.04) G.audio.yelp();
      p.flee = 3.5 + Math.random() * 2; p.threatX = x; p.threatY = y; p.gather = null;
    }
  }
}

function callAmbulance(G, x, y) {
  if (G._ambT && G._ambT > 0) return;
  G._ambT = 25;
  const v = G.traffic.spawnCar({ x, y }, 500, 1100, "ambulance");
  if (!v) return;
  v.traffic = false; v.tr = null; v.role = "ambulance"; v.target = { x, y }; v.siren = true; v.ambient = true;
}

function lightHeld(G, rd, pos) {
  const phase = ((G.ticks / 60) % 16);
  const nsGreen = phase < 7;
  const ns = (Math.abs(rd.b[0] - rd.a[0]) < Math.abs(rd.b[1] - rd.a[1]));
  const held = ns ? nsGreen : (phase >= 8 && phase < 15);
  if (held || !G.meta.signals) return true;
  for (const s of G.meta.signals) {
    const d = Math.hypot(pos.x - s.x, pos.y - s.y);
    if (d < (s.r || 120) && d > 28) return false;
  }
  return true;
}

function tickPeds(G, dt) {
  const pl = G.player;
  const pSpd = pl.type === "veh" ? Math.hypot(pl.vx, pl.vy) : (pl.speed || 0);
  const moving=G.movingVehicles||G.vehicles.filter(v=>!v.dead&&!v.def.boat&&!airborne(v)&&Math.hypot(v.vx||0,v.vy||0)>45);
  if(pl.type==='foot'){
    pl.impactT=Math.max(0,(pl.impactT||0)-dt);
    if(!pl.impactT)for(const v of moving){
      if(Math.abs(v.x-pl.x)>110||Math.abs(v.y-pl.y)>110)continue;
      if(!circleBody(v,pl.x,pl.y,8)&&segmentBody(v,pl.x+v.x-(v.prevX??v.x),pl.y+v.y-(v.prevY??v.y),pl.x,pl.y,8)===null)continue;
      const speed=Math.hypot(v.vx,v.vy);G.health-=Math.min(75,speed*(v.def.bike?.16:.26));G.hurtT=.6;pl.impactT=1;
      moveFootMap(G,pl,v.vx/speed*26,v.vy/speed*26);v.vx*=.9;v.vy*=.9;G.audio.hit();addShake(G,7);
      if(G.health<=0){wasted(G);return;}break;
    }
  }
  for (const b of G.bullets || []) if ((G.ticks & 3) === 0) scarePeds(G, b.x, b.y, 90);
  for (const p of G.peds) {
    if (p.dead) { p.deadT = (p.deadT || 0) + dt; if(p.deadT<.75){const x=p.x+(p.vx||0)*dt,y=p.y+(p.vy||0)*dt;if(!G.solidAt(x,y)){p.x=x;p.y=y;}p.vx*=Math.exp(-5*dt);p.vy*=Math.exp(-5*dt);}continue; }
    if (Math.abs(p.x - G.cam.x) > 1400 || Math.abs(p.y - G.cam.y) > 1200) continue;
    const dx = p.x - pl.x, dy = p.y - pl.y;
    const dist = Math.hypot(dx, dy);
    // Impacts are resolved before a pedestrian's dodge; a dive is never invulnerability.
    let struck=false;
    p.impactT=Math.max(0,(p.impactT||0)-dt);
    for(const car of localStreetVehicles(G,p.x,p.y)){
      if(p.impactT)break;
      const speed=Math.hypot(car.vx||0,car.vy||0);if(car.dead||airborne(car)||car.def.boat||speed<45||Math.abs(car.x-p.x)>110||Math.abs(car.y-p.y)>110)continue;
      const px=car.prevX??car.x,py=car.prevY??car.y;
      if(!circleBody(car,p.x,p.y,9)&&segmentBody(car,p.x+(car.x-px),p.y+(car.y-py),p.x,p.y,9)===null)continue;
      p.impactT=.7;p.hp=(p.hp??30)-speed*(car.def.bike?.28:.65);p.vx=car.vx*.55;p.vy=car.vy*.55;p.flee=5;p.dive=0;
      if(p.hp<=0){if(car===pl&&!p.copPed)recordIncident(G,'civilian_harm');killPed(G,p,false,car===pl);}else{p.dive=.3;if(car===pl)crime(G,1,p.x,p.y,false,2);}
      if(car===pl){G.audio.hit();G.hitConfirmT=.2;car.vx*=.94;car.vy*=.94;}struck=true;break;
    }
    if(struck)continue;
    if(p.copPed)continue;
    resolveFootVehicles(G,p);
    // dive away from fast cars (any car, not just the player)
    if (pl.type === "veh" && !airborne(pl) && pSpd > 55 && dist < 90 && !(p.dive > 0)) {
      const hx = pl.vx / (pSpd || 1), hy = pl.vy / (pSpd || 1);
      if ((-dx * hx - dy * hy) < 0) {
        p.dive = 0.6; p.flee = 3;
        const side = (dx * hy - dy * hx) > 0 ? 1 : -1;
        p.vx = hy * side * 170; p.vy = -hx * side * 170;
        p.rot = Math.atan2(p.vx, -p.vy);
        if (G.audio.yelp && Math.random() < 0.4) G.audio.yelp();
      }
    }
    if (p.dive > 0) {
      p.dive -= dt;
      const nx = p.x + p.vx * dt, ny = p.y + p.vy * dt;
      if (!G.solidAt(nx, ny)) { p.x = nx; p.y = ny; }
      p.vx *= 0.9; p.vy *= 0.9; p.speed = 80; p.dist += 40 * dt;
      continue;
    }

    if (p.flee > 0) {
      p.flee -= dt;
      const tx = p.threatX ?? pl.x, ty = p.threatY ?? pl.y;
      const want = Math.atan2(p.x - tx, -(p.y - ty));
      p.rot = p.rot + angNorm(want - p.rot) * Math.min(1, 6 * dt);
      const h = headingVec(p.rot);
      const sp = (p.walk || 30) * 3.4;
      moveFoot(G, p, h.x * sp * dt, h.y * sp * dt);
      p.speed = sp; p.dist += sp * dt;
      if (p.flee <= 0) { p.hx = Math.abs(h.x) > Math.abs(h.y) ? Math.sign(h.x) : 0; p.hy = p.hx ? 0 : Math.sign(h.y) || 1; }
      continue;
    }
    if (G.cityAI?.steerPed(p, dt)) continue;
    if (p.gather) {
      const g = p.gather;
      const d = Math.hypot(p.x - g.x, p.y - g.y);
      if (d > 28) { p.rot = Math.atan2(g.x - p.x, -(g.y - p.y)); const h = headingVec(p.rot); p.x += h.x * 30 * dt; p.y += h.y * 30 * dt; p.speed = 30; p.dist += 30 * dt; }
      else { p.speed = 0; if (Math.random() < 0.01) p.rot += (Math.random() - 0.5) * 1.2; }
      continue;
    }
    if (p.hx === undefined) { p.hx = Math.round(Math.sin(p.rot)); p.hy = p.hx ? 0 : -Math.round(Math.cos(p.rot)) || 1; }
    G.pedsys.walkAmbient(p, dt);
  }
}

// Local circles keep crowds from stacking without checking every person against the city.
function separateCharacters(G){
  const grid=new Map(),cell=24,people=G.peds.filter(p=>!p.dead&&Math.abs(p.x-G.cam.x)<1000&&Math.abs(p.y-G.cam.y)<900);
  if(G.player.type==='foot')people.push(G.player);
  for(const p of people){
    const cx=Math.floor(p.x/cell),cy=Math.floor(p.y/cell);
    for(let x=cx-1;x<=cx+1;x++)for(let y=cy-1;y<=cy+1;y++)for(const q of grid.get(x+':'+y)||[]){
      let dx=p.x-q.x,dy=p.y-q.y,d=Math.hypot(dx,dy);if(d>=15)continue;
      if(d<.01){dx=1;dy=0;d=1;}const push=(15-d)*.5,nx=dx/d*push,ny=dy/d*push;
      if(footClear(G,p.x+nx,p.y+ny,7)){p.x+=nx;p.y+=ny;}
      if(footClear(G,q.x-nx,q.y-ny,7)){q.x-=nx;q.y-=ny;}
    }
    const key=cx+':'+cy,bucket=grid.get(key)||[];bucket.push(p);grid.set(key,bucket);resolveFootVehicles(G,p);
  }
}

function smashNear(G, x, y, r, speed) {
  if (speed < 50) return;
  for (const p of G.props) {
    if (p.broken) continue;
    if (Math.hypot(p.x - x, p.y - y) < r) {
      p.broken = true;
      p.vx = (p.x - x) * 8; p.vy = (p.y - y) * 8; p.spin = (Math.random() - 0.5) * 8;
      G.particles.push({ kind: "boom", x: p.x, y: p.y, life: 0.35, frame: 0 });
      for (let i = 0; i < 5; i++) G.particles.push({ kind: "bits", x: p.x, y: p.y, vx: (Math.random()-0.5)*80, vy: (Math.random()-0.5)*80, life: 0.4, a: 1 });
      addShake(G, 4);
      if (p.kind === "hydrant") {
        for (let i = 0; i < 10; i++) G.particles.push({ kind: "spray", x: p.x, y: p.y, vx: (Math.random()-0.5)*40, vy: -80 - Math.random()*40, life: 0.6, a: 1 });
      }
    }
  }
}

function tickProps(G, dt) {
  for (const p of G.props) {
    if (!p.broken) continue;
    p.x += (p.vx || 0) * dt; p.y += (p.vy || 0) * dt;
    p.rot = (p.rot || 0) + (p.spin || 0) * dt;
    p.vx *= 0.9; p.vy *= 0.9;
  }
}

function tickParticles(G, dt) {
  for (const p of G.particles) {
    if (!p.maxLife) p.maxLife = p.life;
    p.x += (p.vx || 0) * dt; p.y += (p.vy || 0) * dt; p.life -= dt;
    if (p.frame != null) p.frame += dt * 12;
  }
  const cap=G.settings.quality==='low'?140:500;if(G.particles.length>cap)G.particles.splice(0,G.particles.length-cap);
  G.particles = G.particles.filter((p) => p.life > 0);
  for (const s of G.skids) s.a -= dt * 0.15;
  G.skids = G.skids.filter((s) => s.a > 0);
}

function tickCamera(G, dt) {
  const p = G.player;
  const spd = p.type === "veh" ? Math.hypot(p.vx, p.vy) : p.speed || 0;
  const onFoot = p.type !== "veh";
  const portrait = G.cssH > G.cssW;
  const tgtScale = (p.def?.aircraft ? lerp(.92,.63,clamp((p.altitude||0)/300,0,1)) : onFoot
    ? lerp(1.48, 1.22, clamp(spd / 160, 0, 1))
    : lerp(1.10, 0.73, clamp(spd / 300, 0, 1))) * (portrait ? 0.86 : 1);
  G.cam.scale = lerp(G.cam.scale, tgtScale, 2.2 * dt);
  // look ahead in the direction of travel (more on phones)
  const lk = p.type === "veh" ? (G.touch ? 0.62 : 0.5) : 0.25;
  const vx = p.type === "veh" ? p.vx : Math.sin(p.rot) * spd, vy = p.type === "veh" ? p.vy : -Math.cos(p.rot) * spd;
  G.cam.lx = lerp(G.cam.lx || 0, clamp(vx * lk, -260, 260), 2.5 * dt);
  G.cam.ly = lerp(G.cam.ly || 0, clamp(vy * lk, -220, 220), 2.5 * dt);
  G.cam.x = lerp(G.cam.x, p.x + G.cam.lx, Math.min(1, 7 * dt));
  G.cam.y = lerp(G.cam.y, p.y + G.cam.ly, Math.min(1, 7 * dt));
  if (G.cam.northUp || p.type !== "veh") G.cam.rot = lerp(G.cam.rot, 0, 4 * dt);
  else G.cam.rot = G.cam.rot + angNorm(p.rot - G.cam.rot) * 3 * dt;
  if (G.cam.shake > 0) G.cam.shake = Math.max(0, G.cam.shake - 18 * dt);
}

function nearbyInteraction(G) {
  const obj = G._flow && G._flow.objectives[G.objectiveIndex];
  if (!obj || !['collect', 'stealCop'].includes(obj.kind)) return null;
  const at = objectivePos(G, obj);
  return at && Math.hypot(G.player.x - at.x, G.player.y - at.y) < (obj.r || 90) ? obj : null;
}
function tickMission(G, dt) {
  if(G.freeRoam||airborne(G.player))return;
  if (!MISSIONS[G.missionIndex]) return;
  const flow = G._flow || missionFlow(MISSIONS[G.missionIndex].id, G.flags);
  G._flow = flow;
  const obj = flow && flow.objectives[G.objectiveIndex];
  if (!obj) return;
  const p = G.player, at = objectivePos(G, obj);
  if (obj.kind === 'enter') {
    if (p.type === 'veh' && (!obj.vehicle || p.kind === obj.vehicle) &&
      (!obj.near || Math.hypot(p.x - G.meta.spawns[obj.near][0], p.y - G.meta.spawns[obj.near][1]) < 200)) advanceObjective(G);
  } else if(obj.kind === 'intercept') {
    if(G.van && (G.van.health<=65 || G.van.dead) && at && Math.hypot(p.x-at.x,p.y-at.y)<obj.r) {
      G.van.loose=true;G.van.vx=G.van.vy=0;advanceObjective(G);
      message(G,'HUNTER','Engine is out. Stop beside the van and take the sealed plate.');
    }
  } else if (obj.kind === 'goto' || obj.kind === 'collect') {
    const near = at && Math.hypot(p.x - at.x, p.y - at.y) < (obj.r || 80);
    const valid = near && (!obj.foot || p.type === 'foot') && (!obj.vehicle || p.type === 'veh' && !p.def.boat) && (!obj.clearHeat || G.wanted === 0);
    if (valid && obj.kind === 'collect') {
      if(obj.hack) {
        if(G.interactP)G.missionState.hacking=true;
        const still=(p.type==='veh'?Math.hypot(p.vx,p.vy):(p.speed||0))<10 && !G.input.fire;
        if(G.missionState.hacking && still) G.missionState.holdT=(G.missionState.holdT||0)+dt;
        else {G.missionState.holdT=0;G.missionState.hacking=false;}
        if(G.missionState.holdT>=obj.hack){G.missionState.hacking=false;advanceObjective(G);}
      }else if (G.interactP) {
        if (p.type === 'veh' && Math.hypot(p.vx, p.vy) > 50) toast(G, 'Slow down before taking the package.');
        else advanceObjective(G);
      }
    } else if (valid && obj.hold) {
      const still = p.type === 'foot' && (p.speed || 0) < 30;
      G.missionState.holdT = still ? (G.missionState.holdT || 0) + dt : 0;
      if (G.missionState.holdT >= obj.hold) advanceObjective(G);
    } else if (valid) advanceObjective(G);
    else G.missionState.holdT = 0;
  } else if (obj.kind === 'loseWanted') {
    if (G.wanted === 0) advanceObjective(G);
  } else if (obj.kind === 'enterBoat') {
    if (p.type === 'veh' && p.def.boat) advanceObjective(G);
  } else if (obj.kind === 'stealCop') {
    if (p.type === 'veh' && p.kind === 'metro' || p.type === 'foot' && nearbyInteraction(G) && G.interactP) {
      G.flags.scrambler = true;
      if (p.type === 'foot') bumpWanted(G, 1);
      advanceObjective(G);
    }
  } else if (obj.kind === 'race') {
    if (p.type !== 'veh' || p.def.boat || p.def.aircraft) { if (G.race) completeMission(G, false); else toast(G, 'Bring a car or bike to race Fire.'); return; }
    if (!G.race) startRace(G, obj);
    else tickRace(G, obj, dt);
  }
}

function startRace(G, obj = {}, resuming = false) {
  if (G.player.type !== 'veh' || G.player.def.boat || G.player.def.aircraft) return;
  if (G.race && G.race.rival) G.vehicles = G.vehicles.filter(v => v !== G.race.rival);
  const start = G.meta.spawns.raceStart;
  const pts = raceCourse(G.meta, obj.laps || 1);
  G.race = { i: 0, pts, laps: obj.laps || 1, gatesPerLap: G.meta.race.checkpoints.length, t: 0, rivalI: 0, rival: null, started: false, countdown: 3 };
  G.race.rival = makeVeh('dart', start[0] + 30, start[1], Math.PI / 2, { parked: false, ai: true, raceRival: true });
  // A fixed pace that the starter Riot can beat; no rubber-band teleporting.
  G.race.rival.def = { ...G.race.rival.def, max: VEH_DEFS.riot.max * 0.75, accel: VEH_DEFS.riot.accel * 0.8 };
  G.vehicles.push(G.race.rival);
  if (!resuming) { G.player.x = start[0]; G.player.y = start[1]; G.player.rot = Math.PI / 2; }
  G.player.vx = G.player.vy = 0;
  toast(G, 'Hold at the lights…');
}
function tickRace(G, obj, dt) {
  const R = G.race;
  if (!R || R.finished) return;
  if (R.countdown > 0) {
    R.countdown = Math.max(0, R.countdown - dt);
    if (R.countdown === 0) { toast(G, 'GO! Follow the numbered gates.'); R.started = true; }
    return;
  }
  R.t += dt;
  if (R.rivalI >= R.pts.length) {
    R.finished = true; completeMission(G, false); return;
  }
  const cp = R.pts[R.i];
  if (cp && Math.hypot(G.player.x - cp[0], G.player.y - cp[1]) < 65) {
    R.i++; G.audio.pickup();
    if (R.i >= R.pts.length) { R.finished = true; completeMission(G, true); }
    else toast(G, 'Gate ' + R.i + '/' + R.pts.length);
  }
}

function tickTitleDummy() {}

/* -------------------- Render -------------------- */
function render(G) {
  G.renderCount=(G.renderCount||0)+1;
  const { ctx, canvas } = G;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
  const cityScene=!['title','vn','end'].includes(G.scene)&&!(G.scene==='settings'&&G.pausedFrom==='title');
  if(G.worldCanvas?.style)G.worldCanvas.style.display=G.layered&&cityScene?'block':'none';
  if(G.layered&&cityScene)ctx.clearRect(0,0,canvas.width,canvas.height);
  else{ctx.fillStyle="#07060a";ctx.fillRect(0,0,canvas.width,canvas.height);}
  G.buttons = [];
  if(G._presentScene!==G.scene){G._presentScene=G.scene;syncControlStyle(G);}
  G._nav = [];
  if (G.scene === "title" || (G.scene === "settings" && G.pausedFrom === "title")) {
    drawTitle(G);
    if (G.scene === "settings") drawSettings(G);
  } else if (G.scene === "vn") { if (G.vn.pending) drawBoot(ctx, canvas, 0.9, "Loading scene art…"); else drawVN(G); }
  else if (G.scene === "end") drawEnd(G);
  else {
    const frozen = ['pause', 'map', 'settings','crew','garage','dossier'].includes(G.scene);
    if(frozen&&G.layered&&G.worldCanvas){/* Retain the compositor layer while menus are open. */}
    else if (frozen && G.frozenWorld && G.frozenWorld.width === canvas.width && G.frozenWorld.height === canvas.height) {
      ctx.drawImage(G.frozenWorld, 0, 0);
    } else {
      drawWorld(G);
      if (frozen) {
        const image = document.createElement('canvas'); image.width = canvas.width; image.height = canvas.height;
        image.getContext('2d').drawImage(canvas, 0, 0); G.frozenWorld = image;
      } else G.frozenWorld = null;
    }
    if (G.scene === "brief") drawBrief(G);
    else { const _h = performance.now(); drawHUD(G); prof(G, "hud", performance.now() - _h); }
    if (G.scene === "pause") drawPause(G);
    if (G.scene === "map") drawMap(G);
    if (G.scene === "settings") drawSettings(G);
    if (G.scene === 'crew') {
      if(!G._crewArt){G._crewArt=true;ensureStoryAssets(G,{bg:'garage',left:'neural',right:'fire'});ensureStoryAssets(G,{bg:'loft',left:'mask',right:'hunter'});ensureStoryAssets(G,{bg:'news',right:'vera'});ensureStoryAssets(G,{bg:'garage',left:'gold_mage'});}
      drawCrew(G,{button:uiButton,panel:uiPanel,save});
    }
    if (G.scene === 'dossier') drawDossier(G,{button:uiButton,panel:uiPanel});
    if (G.scene === 'garage') drawWorkshop(G,{button:uiButton,panel:uiPanel,save});
  }
  G.navButtons = G._nav;
}

function viewForLife(cam) {
  return 900 / cam.scale;
}
function worldZoom(G) {
  const base = Math.sqrt(G.canvas.width * G.canvas.height) / Math.sqrt(1280 * 720);
  const small = G.cssW && Math.min(G.cssW, G.cssH) < 520 ? 1.12 : 1;
  return base * small * (G.zoomMul || 1);
}
function viewRect(G) {
  const S = G.cam.scale * worldZoom(G);
  const hw = G.canvas.width / 2 / S, hh = G.canvas.height / 2 / S;
  const e = G.cam.rot ? Math.hypot(hw, hh) : 0;
  const ex = e || hw, ey = e || hh;
  return { x0: G.cam.x - ex - 40, y0: G.cam.y - ey - 40, x1: G.cam.x + ex + 40, y1: G.cam.y + ey + 40, S };
}
// adaptive resolution: hold ~50+ fps by trading render pixels (never below 0.6 css px)
function adaptRes(G, dt) {
  if (G.scene !== "play" && G.scene !== "title") return;
  const A = G._ar || (G._ar = { t: 0, n: 0, sum: 0 });
  A.t += dt; A.n++; A.sum += dt;
  if (A.t < 2) return;
  const avg = A.sum / A.n; A.t = 0; A.n = 0; A.sum = 0;
  if (G.settings.autoRes === false) return;
  const r = G.resScale || 1;
  let nr = r;
  if (avg > 1 / 45 && r > 0.62) nr = Math.max(0.6, r - (avg > 1 / 28 ? 0.15 : 0.08));
  else if (avg < 1 / 58 && r < 1) nr = Math.min(1, r + 0.05);
  if (nr !== r) { G.resScale = nr; fit(G); }
}
function volStep(v, d) { const n = Math.round((v + d * 0.1) * 10) / 10; return n > 1.001 ? 0 : n < -0.001 ? 1 : n; }
function applyQuality(G) {
  if (G.audio && G.audio.setLite) G.audio.setLite(G.settings.quality === "low");
  const q = G.settings.quality;
  if (G.traffic) G.traffic.target = q === "low" ? 24 : q === "med" ? 40 : 54;
  if (G.pedsys) G.pedsys.target = q === "low" ? 42 : q === "med" ? 76 : 110;
  if (G.ground) G.ground.maxChunks=q==='low'?24:q==='med'?40:64;
}
function prof(G, k, ms) { const P = G.prof || (G.prof = {}); P[k] = (P[k] ?? ms) * 0.95 + ms * 0.05; const X = G.profMax || (G.profMax = {}); if (!(X[k] > ms)) X[k] = ms; }
function worldXform(G, c, S, div = 1, ox = 0, oy = 0) {
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.translate(G.canvas.width / 2 / div + ox / div, G.canvas.height / 2 / div + oy / div);
  c.scale(S / div, S / div);
  c.rotate(-G.cam.rot);
  c.translate(-G.cam.x, -G.cam.y);
}

function drawLife(G, cam, view) {
  const ctx = G.ctx;
  const t = G.ticks;
  // pool caustics
  const pools = G.meta.pools || [];
  if (pools.length) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const p of pools) {
      const pw = p.w || 0, ph0 = p.h || 0;
      if (pw < 22 || ph0 < 16 || pw > 160 || ph0 > 90) continue;
      if (Math.abs(p.x - cam.x) > view || Math.abs(p.y - cam.y) > view) continue;
      const ph = Math.sin(t * 0.11 + p.x * 0.02) * 0.5 + 0.5;
      const rw = pw * 0.28, rh = ph0 * 0.24;
      ctx.globalAlpha = 0.07 + 0.06 * ph;
      ctx.fillStyle = "#b8f4ff";
      ctx.beginPath();
      ctx.ellipse(p.x + Math.sin(t * 0.09 + p.y) * 2, p.y + Math.cos(t * 0.08) * 1.5, rw, rh, 0.15, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }
  // palm wind glints — not a second solid palm
  const palms = G.meta.palms || [];
  if (palms.length) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = "rgba(120, 210, 90, 0.22)";
    ctx.lineWidth = 1.4;
    ctx.lineCap = "round";
    for (let i = 0; i < palms.length; i++) {
      const p = palms[i];
      if (Math.abs(p.x - cam.x) > view || Math.abs(p.y - cam.y) > view) continue;
      const sway = Math.sin(t * 0.06 + p.x * 0.04 + i) * 0.22;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(sway);
      ctx.globalAlpha = 0.28 + 0.12 * Math.sin(t * 0.08 + i);
      ctx.beginPath();
      for (let a = 0; a < 6; a++) {
        const ang = a * (Math.PI / 3) + sway;
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(Math.cos(ang) * 8, Math.sin(ang) * 8, Math.cos(ang) * 16, Math.sin(ang) * 16);
      }
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }
  // fountains
  for (const f of (G.meta.fountains || [])) {
    if (Math.abs(f.x - cam.x) > view || Math.abs(f.y - cam.y) > view) continue;
    const pulse = 0.5 + 0.5 * Math.sin(t * 0.2 + f.x);
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 0.35 + 0.2 * pulse;
    ctx.strokeStyle = "rgba(180, 230, 255, 0.85)";
    ctx.lineWidth = 1.2;
    for (let k = 0; k < 3; k++) {
      const rad = (f.r || 8) * (0.6 + 0.5 * k + 0.3 * Math.sin(t * 0.18 + k));
      ctx.beginPath(); ctx.ellipse(f.x, f.y, rad, rad * 0.55, 0, 0, TAU); ctx.stroke();
    }
    ctx.fillStyle = "rgba(200, 240, 255, 0.35)";
    ctx.beginPath(); ctx.arc(f.x, f.y - 4 - 6 * pulse, 2.2, 0, TAU); ctx.fill();
    ctx.restore();
  }
  // traffic lights on every signalled node (same phase as the traffic AI)
  const phase = ((t / 60) % 16);
  const nsCol = phase < 6.6 ? "#3ce06a" : phase < 8 ? "#ffb000" : "#ff3a3a";
  const ewCol = phase >= 8 && phase < 14.6 ? "#3ce06a" : phase >= 14.6 ? "#ffb000" : "#ff3a3a";
  G._sigLit = [];
  for (const n of G.graph.nodes) {
    if (!n.sig || Math.abs(n.x - cam.x) > view || Math.abs(n.y - cam.y) > view) continue;
    const hw = (n.hw || 40) + 10, hh = (n.hh || 40) + 10;
    // corner poles: NS heads face up/down traffic, EW heads face sideways
    for (const [dx, dy, ns] of [[-hw, -hh, true], [hw, hh, true], [-hw, hh, false], [hw, -hh, false]]) {
      const col = ns ? nsCol : ewCol;
      const x = n.x + dx, y = n.y + dy;
      ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.fillRect(x - 3, y - 6, 8, 16);
      ctx.fillStyle = "#16161a"; ctx.fillRect(x - 4, y - 8, 8, 16);
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y + (col === "#3ce06a" ? 4 : col === "#ffb000" ? 0 : -4), 2.6, 0, TAU); ctx.fill();
      G._sigLit.push(x, y, col);
    }
  }
  // birds
  for (const b of (G.birds || [])) {
    if (Math.abs(b.x - cam.x) > view || Math.abs(b.y - cam.y) > view) continue;
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(b.rot || 0);
    ctx.strokeStyle = "rgba(20,20,24,0.75)";
    ctx.lineWidth = 1.2;
    const flap = Math.sin((t * 0.5) + b.x) * 0.6;
    ctx.beginPath();
    ctx.moveTo(-5, flap * 3); ctx.lineTo(0, 0); ctx.lineTo(5, flap * 3);
    ctx.stroke();
    ctx.restore();
  }
  // plane shadow
  if (G.plane) {
    const pln = G.plane;
    ctx.save();
    ctx.translate(pln.x, pln.y);
    ctx.rotate(pln.rot);
    ctx.fillStyle = "rgba(0,0,0,0.22)";
    ctx.beginPath();
    ctx.moveTo(0, -22); ctx.lineTo(8, 16); ctx.lineTo(0, 12); ctx.lineTo(-8, 16);
    ctx.closePath(); ctx.fill();
    ctx.fillRect(-16, -2, 32, 3);
    ctx.restore();
  }
}

function heliPos(G) {
  const t = G.ticks;
  if (G.heliChase && G.player) {
    const ang = t * 0.012;
    const x = G.player.x + Math.cos(ang) * 140, y = G.player.y + Math.sin(ang) * 110 - 40;
    return { x, y, rot: ang + Math.PI / 2, beam: 0, lx: G.player.x + Math.cos(t * 0.03) * 30, ly: G.player.y + Math.sin(t * 0.025) * 30 };
  }
  const ang = t * 0.007;
  const x = 2720 + Math.cos(ang) * 160, y = 1860 + Math.sin(ang) * 140;
  const beam = ang * 1.6;
  return { x, y, rot: ang + Math.PI / 2, beam, lx: x + Math.cos(beam) * 110, ly: y + Math.sin(beam) * 110 };
}

// pass 8: chasing marquee bulbs along casino Strip fronts + sky searchlights
function drawMarquees(G, cam, view, lit) {
  const ctx = G.ctx;
  const ms = G.meta.marquees || [];
  const t = G.ticks || 0;
  const step = 9;
  for (let m = 0; m < ms.length; m++) {
    const M = ms[m];
    const mx = (M.x1 + M.x2) / 2, my = (M.y1 + M.y2) / 2;
    const len = Math.hypot(M.x2 - M.x1, M.y2 - M.y1) || 1;
    if (Math.abs(mx - cam.x) > view + len / 2 || Math.abs(my - cam.y) > view + len / 2) continue;
    const n = Math.max(2, (len / step) | 0);
    const dx = (M.x2 - M.x1) / n, dy = (M.y2 - M.y1) / n;
    const head = (t * 0.22 + m * 3) | 0;
    for (let i = 0; i <= n; i++) {
      const on = ((i + head) % 4) === 0;
      const x = M.x1 + dx * i, y = M.y1 + dy * i;
      ctx.globalAlpha = (on ? 0.95 : 0.32) * lit;
      ctx.fillStyle = M.color;
      ctx.beginPath(); ctx.arc(x, y, on ? 2.6 : 1.7, 0, TAU); ctx.fill();
      if (on) {
        ctx.globalAlpha = 0.85 * lit;
        ctx.fillStyle = "#fff6e0";
        ctx.beginPath(); ctx.arc(x, y, 1.1, 0, TAU); ctx.fill();
      }
    }
  }
  ctx.globalAlpha = 1;
}

function drawSearchlights(G, cam, night) {
  const ctx = G.ctx;
  const t = (G.ticks || 0) * 0.012;
  for (let k = 0; k < (G.meta.searchlights || []).length; k++) {
    const S = G.meta.searchlights[k];
    if (Math.abs(S.x - cam.x) > 1100 || Math.abs(S.y - cam.y) > 1100) continue;
    for (let j = 0; j < 2; j++) {
      const ang = Math.sin(t + k * 1.7 + j * 2.4) * 1.1 + j * Math.PI + k;
      const L = 620;
      const ex = S.x + Math.cos(ang) * L, ey = S.y + Math.sin(ang) * L;
      const g = ctx.createLinearGradient(S.x, S.y, ex, ey);
      g.addColorStop(0, hexA(S.color || "#fff0c8", 0.13));
      g.addColorStop(0.5, hexA(S.color || "#fff0c8", 0.04));
      g.addColorStop(1, hexA(S.color || "#fff0c8", 0));
      const w = 0.07;
      ctx.globalAlpha = night;
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(S.x, S.y);
      ctx.lineTo(S.x + Math.cos(ang - w) * L, S.y + Math.sin(ang - w) * L);
      ctx.lineTo(S.x + Math.cos(ang + w) * L, S.y + Math.sin(ang + w) * L);
      ctx.closePath(); ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

function drawHeli(G, night, lightOnly) {
  const ctx = G.ctx;
  const h = heliPos(G);
  if (lightOnly) {
    const lx = h.x + Math.cos(h.beam) * 110;
    const ly = h.y + Math.sin(h.beam) * 110;
    const grd = ctx.createRadialGradient(lx, ly, 0, lx, ly, 70);
    grd.addColorStop(0, "rgba(255, 245, 200, 0.42)");
    grd.addColorStop(0.35, "rgba(255, 220, 140, 0.14)");
    grd.addColorStop(1, "rgba(255, 200, 80, 0)");
    ctx.globalAlpha = 0.85 * night;
    ctx.fillStyle = grd;
    ctx.beginPath(); ctx.ellipse(lx, ly, 70, 42, h.beam, 0, TAU); ctx.fill();
    // shaft from heli to pool
    ctx.strokeStyle = `rgba(255, 240, 180, ${0.16 * night})`;
    ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(h.x, h.y); ctx.lineTo(lx, ly); ctx.stroke();
    return;
  }
  ctx.save();
  ctx.translate(h.x, h.y);
  ctx.rotate(h.rot);
  // shadow
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath(); ctx.ellipse(6, 10, 16, 10, 0, 0, TAU); ctx.fill();
  // body
  ctx.fillStyle = "#1a1c24";
  ctx.beginPath(); ctx.ellipse(0, 0, 11, 7, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = "#2a3140";
  ctx.fillRect(8, -2, 14, 4);
  ctx.fillStyle = "#29f0ff";
  ctx.globalAlpha = 0.8;
  ctx.fillRect(-10, -1, 3, 2);
  ctx.fillStyle = "#ff2d9b";
  ctx.fillRect(18, -1, 3, 2);
  ctx.globalAlpha = 1;
  // rotors
  const spin = G.ticks * 0.9;
  ctx.strokeStyle = "rgba(200,210,220,0.55)";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(Math.cos(spin) * 22, Math.sin(spin) * 22);
  ctx.lineTo(Math.cos(spin + Math.PI) * 22, Math.sin(spin + Math.PI) * 22);
  ctx.moveTo(Math.cos(spin + 1.2) * 22, Math.sin(spin + 1.2) * 22);
  ctx.lineTo(Math.cos(spin + 1.2 + Math.PI) * 22, Math.sin(spin + 1.2 + Math.PI) * 22);
  ctx.stroke();
  ctx.restore();
}

function drawBuildingHeight(G, cam) {
  const roofs = G.assets.roofs;
  if (!roofs || !G.meta.buildings) return;
  const ctx = G.ctx;
  const view = 900 / (cam.scale || 1);
  for (const b of G.meta.buildings) {
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    if (Math.abs(cx - cam.x) > view + b.w || Math.abs(cy - cam.y) > view + b.h) continue;
    const h = Math.min(64, (b.hgt || 24) * 0.55);
    // south wall (revealed as the roof shifts north / screen-up)
    ctx.fillStyle = "rgba(18, 10, 12, 0.55)";
    ctx.fillRect(b.x, b.y + b.h - 2, b.w, h);
    const oy = -Math.cos(cam.rot) * h;
    const ox = Math.sin(cam.rot) * h;
    ctx.drawImage(roofs, b.x, b.y, b.w, b.h, b.x + ox, b.y + oy, b.w, b.h);
  }
}

function drawWorld(G) {
  const canvas=G.canvas,ctx=G.ctx;
  if(!G.worldWidth || !G.layered&&G.worldWidth===canvas.width && G.worldHeight===canvas.height)return renderWorldLayer(G);
  const off=G.worldCanvas||(G.worldCanvas=document.createElement('canvas'));
  if(G.layered&&!off.parentNode){off.id='world-layer';off.className='world-layer';off.setAttribute('aria-hidden','true');G.wrap.insertBefore(off,canvas);}
  if(G.layered)off.style.display='block';
  if(off.width!==G.worldWidth||off.height!==G.worldHeight){off.width=G.worldWidth;off.height=G.worldHeight;}
  G.canvas=off;G.ctx=off.getContext('2d',{alpha:false});
  G.ctx.setTransform(1,0,0,1,0,0);G.ctx.globalAlpha=1;G.ctx.globalCompositeOperation='source-over';G.ctx.fillStyle='#0b151c';G.ctx.fillRect(0,0,off.width,off.height);
  try{renderWorldLayer(G);}finally{G.canvas=canvas;G.ctx=ctx;}
  if(G.layered&&!G.captureComposite)return;
  ctx.setTransform(1,0,0,1,0,0);ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality=G.settings.quality==='low'?'low':'medium';ctx.drawImage(off,0,0,canvas.width,canvas.height);
}
function renderWorldLayer(G) {
  if(G.settings.quality==='low')return drawMobileWorld(G,{viewRect,worldXform,drawVeh,drawChar,drawParticles,drawObjectiveGround,drawObjectiveBeacon,drawStreetWaypoint,drawAimGuide,drawHeli,drawAirborne});
  const { ctx, canvas, cam, assets } = G;
  const low = G.settings.quality === "low";
  const sh = cam.shake || 0;
  const ox = sh ? (Math.random() - 0.5) * sh * 2 : 0;
  const oy = sh ? (Math.random() - 0.5) * sh * 2 : 0;
  const r = viewRect(G);
  const S = r.S;
  const frame = G.ticks;
  const L = assets.layers;
  worldXform(G, ctx, S, 1, ox, oy);
  ctx.imageSmoothingEnabled = true;
  // 1. open water (animated) under everything outside the painted core
  if (r.x0 < 0 || r.y0 < 0 || r.x1 > CORE || r.y1 > CORE) {
    if (!G._waterPat) G._waterPat = ctx.createPattern(assets.tex.water, "repeat");
    const t = G.ticks * 0.25;
    G._waterPat.setTransform(new DOMMatrix([1, 0, 0, 1, t % 256, (t * 0.6) % 256]));
    ctx.fillStyle = G._waterPat;
    ctx.fillRect(r.x0, r.y0, r.x1 - r.x0, r.y1 - r.y0);
    if (!low) {
      ctx.globalAlpha = 0.35;
      G._waterPat.setTransform(new DOMMatrix([1.4, 0, 0, 1.4, -(t * 0.7) % 358, (t * 0.3) % 358]));
      ctx.fillRect(r.x0, r.y0, r.x1 - r.x0, r.y1 - r.y0);
      ctx.globalAlpha = 1;
    }
  }
  let _pt = performance.now(); const _ph = (k) => { const t = performance.now(); prof(G, k, t - _pt); _pt = t; };
  _ph('w_water');
  // 2. painted core
  if (r.x0 < CORE && r.y0 < CORE) {
    if (!(G.dbg && G.dbg.noAlb)) L.albedo.draw(ctx, r, frame);
    const wi = G.settings.reducedMotion ? 0 : ((G.ticks / 12) | 0) % 4;
    if (!(G.dbg && G.dbg.noWater)) {
      L["water" + wi].draw(ctx, r, frame);
      if (!low && !G.settings.reducedMotion) {
        ctx.globalAlpha = (G.ticks % 12) / 12;
        L["water" + ((wi + 1) % 4)].draw(ctx, r, frame); ctx.globalAlpha = 1;
      }
    }
    for (let k = 0; k < 4; k++) if (k !== wi) for (const key of L["water" + k].keys) { const [tx, ty] = key.split("_").map(Number); if (tx * 1024 < r.x1 && tx * 1024 + 1024 > r.x0 && ty * 1024 < r.y1 && ty * 1024 + 1024 > r.y0) L["water" + k].get(tx, ty, frame); }
  }
  _ph('w_core');
  // 3. procedural districts
  G.ground.draw(ctx, r, frame);
  if (G.wet > 0.15 && r.x0 < CORE && r.y0 < CORE) { ctx.globalAlpha = 0.4 * G.wet; L.puddles.draw(ctx, r, frame); ctx.globalAlpha = 1; }
  if (G.wet > 0.15) { ctx.fillStyle = `rgba(30,40,60,${0.18 * G.wet})`; ctx.fillRect(r.x0, r.y0, r.x1 - r.x0, r.y1 - r.y0); }
  _ph('w_ground');
  // 4. sun shadows
  const sun = sunAt(G.time);
  if (sun.alpha > 0.02) {
    const lt = G.light, sc = lt.sx;
    sc.setTransform(1, 0, 0, 1, 0, 0); sc.clearRect(0, 0, lt.sh.width, lt.sh.height);
    worldXform(G, sc, S, lt.div, ox, oy);
    G.bld.shadows(sc, cam, r, sun);
    for (const v of G.vehicles) if (v.x > r.x0 && v.x < r.x1 && v.y > r.y0 && v.y < r.y1 && !v.def.boat) { sc.beginPath(); sc.ellipse(v.x - sun.x * 10 * sun.len, v.y - sun.y * 10 * sun.len, v.r * 0.75, v.r * 0.75, 0, 0, TAU); sc.fill(); }
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = sun.alpha; ctx.drawImage(lt.sh, 0, 0, canvas.width, canvas.height);
    ctx.restore();
  }
  _ph('w_shadow');
  drawWetReflections(G, r, nightFactor(G));
  drawStreetScene(G,r);
  // 5. ground details
  ctx.lineWidth = 3;
  for (const s of G.skids) {
    if (s.x < r.x0 || s.x > r.x1 || s.y < r.y0 || s.y > r.y1) continue;
    ctx.save(); ctx.globalAlpha = s.a * 0.55; ctx.translate(s.x, s.y); ctx.rotate(s.rot || 0);
    ctx.fillStyle = "#101012"; ctx.fillRect(-9, -3, 4, 7); ctx.fillRect(5, -3, 4, 7);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
  for (const p of G.props) {
    if (p.x < r.x0 || p.x > r.x1 || p.y < r.y0 || p.y > r.y1) continue;
    const spr = assets.sprites["prop_" + p.kind];
    if (!spr) continue;
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot || 0); ctx.globalAlpha = p.broken ? 0.7 : 1;
    ctx.drawImage(spr, -16, -16, 32, 32); ctx.restore();
  }
  for (const c of G.pickups) {
    if (c.got || c.x < r.x0 || c.x > r.x1 || c.y < r.y0 || c.y > r.y1) continue;
    const bob = Math.sin((G.ticks + c.x) * 0.15) * 3;
    ctx.drawImage(assets.chipIcon, c.x - 10, c.y - 10 + bob, 20, 20);
  }
  drawObjectiveGround(G);
  drawLife(G, cam, viewForLife(cam));
  _ph('w_details');
  drawExpansionOverhead(G,r);
  // 6. actors
  const actors = [];
  for (const v of G.vehicles) if (v.x > r.x0 - 60 && v.x < r.x1 + 60 && v.y > r.y0 - 60 && v.y < r.y1 + 60) actors.push(v);
  for (const p of G.peds) if (p.x > r.x0 && p.x < r.x1 && p.y > r.y0 && p.y < r.y1) actors.push(p);
  if (G.player.type === "foot") actors.push(G.player);
  actors.sort((a, b) => (a.dead ? -1e5 : 0) + (a.def ? -1 : 0) - (b.dead ? -1e5 : 0) - (b.def ? -1 : 0) || a.y - b.y);
  for (const a of actors) { if (a.def) drawVeh(G, a); else drawChar(G, a); }
  drawExpansionPeople(G,r);
  drawParticles(G, r, false);
  _ph('w_actors');
  // 7. trees + extruded buildings (rise toward the camera)
  G.bld.trees(ctx, cam, r, { low, time: G.settings.reducedMotion ? 0 : G.ticks / 60 });
  if (!(G.dbg && G.dbg.noBld)) G.bld.draw(ctx, cam, r, frame, sun, { low, player:G.scene==='title'?null:G.player });
  drawRoofDetail(G,r);
  // the player is never lost behind a tower: soft outline when occluded
  if (G.player.type === "foot") {
    const D = 980 / Math.max(.45, cam.scale);
    const hidden = [...G.bld.inView(r)].some(b => {
      const k = (b.core ? Math.min(70, b.hgt || 24) : b.hgt) / D;
      const x = b.x + (b.x - cam.x) * k, y = b.y + (b.y - cam.y) * k;
      return G.player.x > x && G.player.x < x + b.w * (1 + k) && G.player.y > y && G.player.y < y + b.h * (1 + k);
    });
    if (hidden) { ctx.save(); ctx.globalAlpha = .38; drawChar(G, G.player); ctx.restore(); }
  }
  if (G.heliChase || (nightFactor(G) > 0.25 && cam.scale < 1.65)) drawHeli(G, nightFactor(G), false);
  drawAirborne(G,r);
  _ph('w_bld');
  // 8. light map
  if (!(G.dbg && G.dbg.noLight)) drawLighting(G, r, S, ox, oy, low);
  _ph('w_light');
  drawArchitectureLights(G, r, nightFactor(G));
  drawAtmosphere(G, r, nightFactor(G));
  drawParticles(G, r, true);
  worldXform(G, ctx, S, 1, ox, oy);
  drawObjectiveBeacon(G);
  drawStreetWaypoint(G);
  drawAimGuide(G);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (G.fog > 0.05) { ctx.fillStyle = `rgba(160,170,180,${0.28 * G.fog})`; ctx.fillRect(0, 0, canvas.width, canvas.height); }
  if (G.sand > 0.1) { ctx.fillStyle = `rgba(200,160,100,${0.16 * G.sand})`; ctx.fillRect(0, 0, canvas.width, canvas.height); }
  if (G.lightning > 0.05) { ctx.globalCompositeOperation = "lighter"; ctx.fillStyle = `rgba(230,240,255,${0.55 * G.lightning})`; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.globalCompositeOperation = "source-over"; }
  drawGrade(G);
  if (G.hurtT > 0) { G.hurtT -= 1 / 60; const g = ctx.createRadialGradient(canvas.width / 2, canvas.height / 2, canvas.height * 0.3, canvas.width / 2, canvas.height / 2, canvas.height * 0.8); g.addColorStop(0, "rgba(255,0,0,0)"); g.addColorStop(1, `rgba(200,0,20,${G.hurtT})`); ctx.fillStyle = g; ctx.fillRect(0, 0, canvas.width, canvas.height); }
}

function drawLighting(G, r, S, ox, oy, low) {
  const { ctx, canvas, cam, assets } = G;
  const amb = ambientAt(G.time);
  const rain = G.rainAmt * 0.18, fog = G.fog * 0.1;
  const ar = amb[0] * (1 - rain - fog), ag = amb[1] * (1 - rain * 0.8 - fog), ab = amb[2] * (1 - rain * 0.5);
  const dark = darkness(G.time);
  const hasFlash = G.flashes.length > 0;
  const lt = G.light, lx = lt.lx;
  const needMap = Math.min(ar, ag, ab) < 248;
  // low tier: rebuild the light map every other frame (the multiply still runs every frame)
  G._lmF = (G._lmF || 0) + 1;
  const reuse = low && (G._lmF & 1) && G._lmValid && !hasFlash;
  if (needMap) G._lmValid = true;
  if (needMap && !reuse) {
    lx.setTransform(1, 0, 0, 1, 0, 0);
    lx.globalCompositeOperation = "source-over"; lx.globalAlpha = 1;
    lx.fillStyle = `rgb(${ar | 0},${ag | 0},${ab | 0})`;
    lx.fillRect(0, 0, lt.cv.width, lt.cv.height);
    lx.globalCompositeOperation = "lighter";
    worldXform(G, lx, S, lt.div, ox, oy);
    const lit = clamp(dark * 1.6, 0, 1);
    if (lit > 0.02) {
      const warm = LIGHT.radial("rgba(255,196,120,0.9)");
      // street lamps
      const lamp = (x, y, rad, a) => { lx.globalAlpha = a * lit; lx.drawImage(warm, x - rad, y - rad, rad * 2, rad * 2); };
      for (const Lm of G.meta.lights) { if ((!Lm.kind || Lm.kind === "street") && Lm.x > r.x0 && Lm.x < r.x1 && Lm.y > r.y0 && Lm.y < r.y1) lamp(Lm.x, Lm.y, 150, 0.75); }
      for (const Lm of G.world.lamps) { if (Lm.x > r.x0 && Lm.x < r.x1 && Lm.y > r.y0 && Lm.y < r.y1) lamp(Lm.x + (Lm.v ? -Lm.side * 30 : 0), Lm.y + (Lm.v ? 0 : -Lm.side * 30), 200, 0.9); }
      // neon washes from the casino strip
      if (r.x0 < CORE && r.y0 < CORE) {
        lx.globalAlpha = 0.9 * lit; assets.layers.neonGround.draw(lx, r, G.ticks);
        lx.globalAlpha = 0.8 * lit; assets.layers.neon.draw(lx, r, G.ticks);
        for (const N of G.meta.neons) {
          const nx = N.x + N.w * 0.5, ny = N.y + N.h + 16;
          if (nx < r.x0 || nx > r.x1 || ny < r.y0 || ny > r.y1) continue;
          const spr = LIGHT.radial(hexA(N.color || "#ff2d9b", 0.85));
          const rad = Math.max(70, Math.min(N.w * 0.6, 160));
          lx.globalAlpha = lit * (0.85 + 0.15 * Math.sin(G.ticks * 0.1 + N.x));
          lx.drawImage(spr, nx - rad, ny - rad * 0.6, rad * 2, rad * 1.2);
        }
      }
      // the hero always has a little rim of light
      const P = G.player;
      lx.globalAlpha = 0.55 * lit; lx.drawImage(LIGHT.radial("rgba(200,220,255,0.7)"), P.x - 80, P.y - 80, 160, 160);
    }
    // vehicles: headlights, tail/brake, sirens
    const night = clamp(dark * 1.4 + G.fog * 0.5 + G.rainAmt * 0.3, 0, 1);
    for (const v of G.vehicles) {
      if (v.x < r.x0 - 200 || v.x > r.x1 + 200 || v.y < r.y0 - 200 || v.y > r.y1 + 200) continue;
      vehLights(G, lx, v, night, true);
    }
    if (G.player.type === "veh" && !G.vehicles.includes(G.player)) vehLights(G, lx, G.player, night, true);
    // muzzle flashes, explosions, fire
    for (const f of G.flashes) { const k = f.max ? f.life / f.max : 1; lx.globalAlpha = clamp(k, 0, 1); const sp = LIGHT.radial(f.col); lx.drawImage(sp, f.x - f.r, f.y - f.r, f.r * 2, f.r * 2); }
    for (const p of G.particles) if (p.kind === "fire" || p.kind === "boom") { lx.globalAlpha = 0.5; const rr = p.kind === "boom" ? 200 : 60; lx.drawImage(LIGHT.radial("rgba(255,150,60,0.9)"), p.x - rr, p.y - rr, rr * 2, rr * 2); }
    if (G.heliChase || (dark > 0.4 && cam.scale < 1.65)) {
      const h = heliPos(G);
      lx.globalAlpha = 0.9 * Math.max(dark, 0.4); lx.drawImage(LIGHT.radial("rgba(255,250,225,0.95)"), h.lx - 90, h.ly - 90, 180, 180);
    }
  }
  if (needMap) {
    // multiply onto the frame
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = "multiply"; ctx.globalAlpha = 1;
    ctx.drawImage(lt.cv, 0, 0, canvas.width, canvas.height);
    ctx.restore();
  }
  // emissive pass (additive, unaffected by darkness)
  worldXform(G, ctx, S, 1, ox, oy);
  ctx.globalCompositeOperation = "lighter";
  const lit = clamp(dark * 1.7, 0, 1);
  if (lit > 0.03) {
    if (r.x0 < CORE && r.y0 < CORE) {
      const fl = 0.92 + 0.08 * Math.sin(G.ticks * 0.21);
      ctx.globalAlpha = 0.9 * lit * fl; assets.layers.neon.draw(ctx, r, G.ticks);
      ctx.globalAlpha = 0.6 * lit; assets.layers.windows.draw(ctx, r, G.ticks);
      ctx.globalAlpha = 1;
      drawMarquees(G, cam, 900 / cam.scale, lit);
    }
    if (!low || lit > 0.5) G.bld.drawLit(ctx, cam, r, lit);
    const bulb = LIGHT.radial("rgba(255,230,180,1)", 32);
    ctx.globalAlpha = lit;
    for (const Lm of G.world.lamps) if (Lm.x > r.x0 && Lm.x < r.x1 && Lm.y > r.y0 && Lm.y < r.y1) ctx.drawImage(bulb, Lm.x - 7, Lm.y - 7, 14, 14);
    const sl = G._sigLit || [];
    for (let i = 0; i < sl.length; i += 3) { const c = sl[i + 2] === "#3ce06a" ? "rgba(60,224,106,1)" : sl[i + 2] === "#ffb000" ? "rgba(255,176,0,1)" : "rgba(255,58,58,1)"; ctx.drawImage(LIGHT.radial(c, 32), sl[i] - 12, sl[i + 1] - 12, 24, 24); }
    if (lit > 0.3) drawSearchlights(G, cam, lit);
  }
  const night = clamp(dark * 1.4 + G.fog * 0.5, 0, 1);
  for (const v of G.vehicles) {
    if (v.x < r.x0 || v.x > r.x1 || v.y < r.y0 || v.y > r.y1) continue;
    vehLights(G, ctx, v, night, false);
  }
  if (G.player.type === "veh" && !G.vehicles.includes(G.player)) vehLights(G, ctx, G.player, night, false);
  // daytime flashes still pop
  for (const f of G.flashes) { const k = f.max ? f.life / f.max : 1; ctx.globalAlpha = clamp(k, 0, 1) * (0.35 + 0.4 * (1 - dark)); ctx.drawImage(LIGHT.radial(f.col), f.x - f.r * 0.5, f.y - f.r * 0.5, f.r, f.r); }
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
  for (const f of G.flashes) f.life -= 1 / 60;
  G.flashes = G.flashes.filter((f) => f.life > 0);
}

// light emitters of one vehicle. map=true draws into the light map (pools on the ground), else bulbs
function vehLights(G, c, v, night, map) {
  if (!v.def || v.def.boat || v.dead) return;
  const active = v === G.player || v.traffic || v.ai || v.siren || v.role || (v.loose && v.looseT < 6);
  const h = Math.sin(v.rot), k = -Math.cos(v.rot);
  const len = v.def.bike ? 16 : Math.max(24, v.r * 1.05);
  const sirenOn = v.siren && (v.cop || v.role === "ambulance");
  if (map) {
    if (active && night > 0.05) {
      const cone = LIGHT.cone("rgba(255,240,205,0.95)");
      c.save(); c.translate(v.x + h * len, v.y + k * len); c.rotate(v.rot);
      c.globalAlpha = (v === G.player ? 1 : 0.85) * night;
      const L = v.def.bike ? 240 : 360, Wd = v.def.bike ? 130 : 200;
      c.drawImage(cone, -Wd / 2, -L, Wd, L);
      c.globalAlpha *= 0.7; c.drawImage(cone, -Wd * 0.3, -L * 0.6, Wd * 0.6, L * 0.6);
      c.restore();
      // tail glow
      const br = v.braking ? 1 : 0.45;
      c.globalAlpha = br * Math.max(night, 0.15);
      const red = LIGHT.radial("rgba(255,40,40,0.9)", 64);
      c.drawImage(red, v.x - h * len - 34, v.y - k * len - 34, 68, 68);
    }
    if (sirenOn) {
      const ph = ((G.ticks / 7) | 0) % 2;
      const rad = 320;
      const col = v.role === "ambulance" ? (ph ? "rgba(255,60,60,0.95)" : "rgba(255,255,255,0.8)") : (ph ? "rgba(255,40,60,0.95)" : "rgba(40,90,255,0.95)");
      c.globalAlpha = 0.55 + 0.45 * night;
      c.drawImage(LIGHT.radial(col), v.x - rad, v.y - rad, rad * 2, rad * 2);
    }
    return;
  }
  // bulbs (additive on the frame)
  const rt = { x: Math.cos(v.rot), y: Math.sin(v.rot) };
  const w = v.def.bike ? 0 : Math.max(8, v.r * 0.38);
  const bulb = LIGHT.radial("rgba(255,250,230,1)", 32);
  const red = LIGHT.radial("rgba(255,60,50,1)", 32);
  if (active) {
    c.globalAlpha = 0.25 + 0.75 * night;
    for (const s of w ? [-1, 1] : [0]) c.drawImage(bulb, v.x + h * len + rt.x * w * s - 7, v.y + k * len + rt.y * w * s - 7, 14, 14);
    if (night > 0.25) {
      // additive beam so headlights actually brighten dark asphalt (multiply alone can't)
      c.save(); c.translate(v.x + h * len, v.y + k * len); c.rotate(v.rot);
      c.globalAlpha = (v === G.player ? 0.3 : 0.18) * night; const cn = LIGHT.cone("rgba(255,240,205,0.95)");
      const L = v.def.bike ? 220 : 330, Wd = v.def.bike ? 120 : 180;
      c.drawImage(cn, -Wd / 2, -L, Wd, L); c.restore();
    }
    c.globalAlpha = v.braking ? 0.95 : 0.35 + 0.3 * night;
    for (const s of w ? [-1, 1] : [0]) c.drawImage(red, v.x - h * len + rt.x * w * s - (v.braking ? 9 : 6), v.y - k * len + rt.y * w * s - (v.braking ? 9 : 6), v.braking ? 18 : 12, v.braking ? 18 : 12);
    // indicators
    if (Math.abs(v.turnSign || 0) > 0.35 && ((G.ticks / 9) | 0) % 2 === 0 && w) {
      const s = Math.sign(v.turnSign);
      c.globalAlpha = 0.9; const amb = LIGHT.radial("rgba(255,170,0,1)", 32);
      c.drawImage(amb, v.x + h * len * 0.9 + rt.x * w * s - 6, v.y + k * len * 0.9 + rt.y * w * s - 6, 12, 12);
      c.drawImage(amb, v.x - h * len * 0.9 + rt.x * w * s - 6, v.y - k * len * 0.9 + rt.y * w * s - 6, 12, 12);
    }
  }
  if (sirenOn) {
    const ph = ((G.ticks / 7) | 0) % 2;
    c.globalAlpha = 0.14 + 0.3 * night;
    c.drawImage(LIGHT.radial(ph ? "rgba(255,40,60,1)" : (v.role === "ambulance" ? "rgba(255,255,255,1)" : "rgba(50,100,255,1)")), v.x - 190, v.y - 190, 380, 380);
    c.globalAlpha = 1;
    const a = LIGHT.radial(v.role === "ambulance" ? "rgba(255,60,60,1)" : "rgba(255,40,60,1)", 64), b = LIGHT.radial(v.role === "ambulance" ? "rgba(255,255,255,1)" : "rgba(60,110,255,1)", 64);
    c.drawImage(ph ? a : b, v.x - rt.x * 9 - 16, v.y - rt.y * 9 - 16, 32, 32);
    c.drawImage(ph ? b : a, v.x + rt.x * 9 - 10, v.y + rt.y * 9 - 10, 20, 20);
  }
  if (v.def.sprite === "nyx" && v === G.player && night > 0.05) {
    c.globalAlpha = 0.5 * night;
    c.drawImage(LIGHT.radial("rgba(255,70,210,0.9)"), v.x - 50, v.y - 50, 100, 100);
  }
  c.globalAlpha = 1;
}

function drawParticles(G, r, top) {
  const ctx = G.ctx, assets = G.assets;
  if(!top){ctx.save();ctx.lineWidth=1.8;ctx.lineCap='round';for(const b of G.bullets){if(b.x<r.x0||b.x>r.x1||b.y<r.y0||b.y>r.y1)continue;ctx.strokeStyle=b.friend?'#ffe0a0':'#ff8c7b';ctx.beginPath();ctx.moveTo(b.x-b.vx*.018,b.y-b.vy*.018);ctx.lineTo(b.x,b.y);ctx.stroke();}ctx.restore();}
  for (const p of G.particles) {
    if (p.x < r.x0 || p.x > r.x1 || p.y < r.y0 || p.y > r.y1) continue;
    const isTop = p.kind === "rain" || p.kind === "sand";
    if (isTop !== top) continue;
    if (drawParticleFX(ctx, p)) continue;
    if (p.kind === "rain") { ctx.strokeStyle = "rgba(180,200,220,0.5)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + 3, p.y + 12); ctx.stroke(); }
    else if (p.kind === "sand") { ctx.fillStyle = "rgba(200,160,90,0.35)"; ctx.fillRect(p.x, p.y, 3, 2); }
    else if (p.kind === "flash") { ctx.fillStyle = "#fff6d8"; ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, TAU); ctx.fill(); }
    else if (p.kind === "spray") { ctx.fillStyle = "rgba(120,180,220,0.5)"; ctx.fillRect(p.x, p.y, 2, 4); }
    else if (p.kind === "casing") { ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.life*8);ctx.fillStyle='#c6a46a';ctx.fillRect(-1,-2,2,4);ctx.restore(); }
    else if (p.kind === "bits") { ctx.fillStyle = "rgba(80,70,60,0.8)"; ctx.fillRect(p.x, p.y, 3, 3); }
    else if (p.kind === "blood") { ctx.fillStyle = `rgba(150,10,20,${Math.max(0, p.life)})`; ctx.beginPath(); ctx.arc(p.x, p.y, 6, 0, TAU); ctx.fill(); }
    else if (p.kind === "splash") { ctx.fillStyle = `rgba(200,220,235,${Math.max(0, (p.a || 0.6) * p.life * 2)})`; ctx.beginPath(); ctx.ellipse(p.x, p.y, 5, 3, 0, 0, TAU); ctx.fill(); }
  }
}

function drawObjectiveGround(G) {
  const at = currentObjectivePos(G);
  if (!at) return;
  drawObjectiveHalo(G, at, G.race);
}
function drawObjectiveBeacon(G) {
  const at = currentObjectivePos(G);
  if (!at) return;
  const ctx = G.ctx, t = G.settings.reducedMotion ? 0 : G.ticks * 0.06;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const g = ctx.createLinearGradient(at.x, at.y, at.x, at.y - 160);
  g.addColorStop(0, "rgba(255,220,120,0.55)"); g.addColorStop(1, "rgba(255,220,120,0)");
  ctx.fillStyle = g; ctx.fillRect(at.x - 10, at.y - 160, 20, 160);
  ctx.globalAlpha = 0.6 + 0.4 * Math.sin(t * 3);
  ctx.drawImage(LIGHT.radial("rgba(255,210,110,0.9)", 64), at.x - 40, at.y - 40, 80, 80);
  ctx.restore();
}
// mission car wrecked before it was needed: a fresh one is delivered to the garage
function ensureGetawayBoat(G) {
  if (G.vehicles.some(v => v.getawayBoat && !v.dead)) return;
  const marina = G.meta.spawns.marina;
  const slips = [...G.meta.slips].sort((a, b) => Math.hypot(a.x - marina[0], a.y - marina[1]) - Math.hypot(b.x - marina[0], b.y - marina[1]));
  const slip = slips.find(s => ['water', 'canal', 'pier'].includes(G.surfaceAt(s.x, s.y)));
  if (!slip) return;
  const boat=makeVeh('wake',slip.x,slip.y,slip.rot||0,{keep:true,parked:true,getawayBoat:true});const at=waterBerth(G,boat,slip.x,slip.y);if(at){Object.assign(boat,at);G.vehicles.push(boat);}
}
function ensureMissionCar(G) {
  const obj = G._flow && G._flow.objectives[G.objectiveIndex];
  if (!obj || obj.kind !== 'enter') return;
  const kind = obj.vehicle || 'riot';
  if (G.vehicles.some(v => v.mission && v.kind === kind && !v.dead)) return;
  const at = G.meta.spawns[obj.near || 'garage'];
  const spot = findSafe(G, at[0] + (kind === 'nyx' ? 120 : 0), at[1] + (kind === 'nyx' ? 100 : 0), 30, false);
  G.vehicles.push(makeVeh(kind, spot.x, spot.y, Math.PI, { keep: true, mission: true }));
  toast(G, VEH_DEFS[kind].name + ' is waiting at the pickup.');
}

function currentObjectivePos(G) {
  const flow = G._flow; if (!flow) return null;
  const obj = flow.objectives[G.objectiveIndex];
  if (!obj) return null;
  if (obj.kind === "enter") { const v = G.vehicles.find((q) => q.mission && q.kind === (obj.vehicle || "riot") && !q.dead); if (G.player.type === "veh") return null; return v ? { x: v.x, y: v.y } : null; }
  if (obj.kind === "race" && G.race) { const cp = G.race.pts[G.race.i]; return cp ? { x: cp[0], y: cp[1] } : null; }
  if (obj.kind === "enterBoat") { const reserved = G.vehicles.find(v => v.getawayBoat && !v.dead); if (reserved && !(G.player.type === "veh" && G.player.def.boat)) return { x: reserved.x, y: reserved.y }; let best = null, bd = 1e9; for (const v of G.vehicles) if (v.def.boat && !v.dead) { const d = Math.hypot(v.x - G.player.x, v.y - G.player.y); if (d < bd) { bd = d; best = v; } } return best && !(G.player.type === "veh" && G.player.def.boat) ? { x: best.x, y: best.y } : null; }
  if (obj.kind === "loseWanted") return null;
  return objectivePos(G, obj);
}

function drawAirborne(G,r){for(const v of G.vehicles)if(airborne(v)&&v.x>r.x0-160&&v.x<r.x1+160&&v.y>r.y0-160&&v.y<r.y1+160)drawAircraft(G,v);}

function drawVeh(G, v) {
  if(v.def.aircraft){if(!airborne(v))drawAircraft(G,v);return;}
  const spr = G.assets.sprites["veh_" + v.def.sprite] || {width:200,height:384};
  const ctx = G.ctx;
  ctx.save();
  if(v.def.boat){
    const bridges=G.world.expansion?.bridges?.filter(b=>v.x+100>b.x&&v.x-100<b.x+b.w&&v.y+120>b.y&&v.y-120<b.y+b.h)||[];
    if(bridges.length){ctx.beginPath();ctx.rect(-1000,-1000,WORLD_W+2000,WORLD_H+2000);for(const b of bridges)ctx.rect(b.x,b.y,b.w,b.h);ctx.clip('evenodd');}
  }
  ctx.translate(v.x, v.y);
  const pose = vehiclePose(v, G.ticks / 60, G.settings.reducedMotion);
  ctx.rotate(v.rot + pose.roll);
  ctx.translate(0, pose.heave);
  ctx.scale(1, pose.pitch);
  const sc = vehScale(v.def);
  let sprUse = spr;
  if (v.wrecked) {
    const wreck = G.assets.sprites["veh_" + (v.def.cop ? "metro_wreck" : "fare_wreck")];
    if (wreck) sprUse = wreck;
  }
  ctx.fillStyle = "rgba(0,0,0,0.38)";
  ctx.beginPath(); const body=bodySize(v);ctx.ellipse(2,4,body.w,body.l*.86,0,0,TAU);ctx.fill();
  const fleetSlot={bus:0,ambulance:1,van:2,stitch:3,hog:4,wake:5}[v.kind];
  const atlas=fleetSlot!=null?G.assets.sprites.city_fleet:G.assets.sprites.vehicle_atlas,slot=fleetSlot??{riot:0,nyx:1,dart:2,metro:3,taxi:4,fare:5}[v.kind];
  if(atlas && slot!=null && !v.wrecked) {
    const cw=atlas.width/3,ch=atlas.height/2;
    if(v.paint)ctx.filter=`hue-rotate(${v.paint*68}deg)`;
    const length=v.kind==='bus'?150:v.def.bike?82:v.kind==='wake'?133:v.kind==='van'||v.kind==='ambulance'?128:116;
    ctx.drawImage(atlas,(slot%3)*cw,Math.floor(slot/3)*ch,cw,ch,-length/2,-length/2,length,length);
    ctx.filter='none';if(G.settings.quality!=='low'||v===G.player)drawVehicleFinish(G,v,v.def.bike?24:52,length*.93,pose);
    if(v.def.bike && (v===G.player||v.traffic)){
      ctx.save();ctx.rotate((v.turnSign||0)*.08);ctx.fillStyle=v===G.player?'#513d5e':'#34434b';ctx.beginPath();ctx.ellipse(0,2,8,14,0,0,TAU);ctx.fill();
      ctx.fillStyle=v===G.player?'#d2c5ad':'#27343b';ctx.beginPath();ctx.ellipse(0,-12,6,7,0,0,TAU);ctx.fill();ctx.strokeStyle='#acb7a0';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-6,-4);ctx.lineTo(-11,-11);ctx.moveTo(6,-4);ctx.lineTo(11,-11);ctx.stroke();ctx.restore();
    }
  }else{
    ctx.drawImage(sprUse, -sprUse.width * sc / 2, -sprUse.height * sc / 2, sprUse.width * sc, sprUse.height * sc);
    drawVehicleFinish(G, v, sprUse.width * sc, sprUse.height * sc, pose);
  }
  const opening=G.jack?.v===v ? Math.sin((1-G.jack.t/G.jack.dur)*Math.PI/2) : Math.min(1,(v.doorT||0)*2);
  if(opening>0&&!v.def.bike&&!v.def.boat){
    ctx.save();ctx.translate(-24,-10);ctx.rotate(-opening*1.15);
    ctx.fillStyle='rgba(0,0,0,.45)';ctx.fillRect(-4,1,6,27);
    ctx.fillStyle=v.kind==='riot'?'#92332f':v.kind==='taxi'?'#b28b37':'#414d54';ctx.fillRect(-3,0,5,24);
    ctx.fillStyle='#a3b7bd';ctx.fillRect(-2,2,2,12);ctx.restore();
  }
  if (v.isVan) {
    ctx.fillStyle = "#f2c14e";
    ctx.font = "bold 9px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("PALACE", 0, 4);
  }
  if (v.def.boat) {
    const spd = Math.hypot(v.vx || 0, v.vy || 0);
    if (spd > 22) {
      const len = 14 + Math.min(28, spd * 0.16);
      const a = Math.min(0.55, 0.2 + spd / 400);
      ctx.strokeStyle = `rgba(210, 232, 240, ${a})`;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-7, 10); ctx.lineTo(-15, 10 + len); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(7, 10); ctx.lineTo(15, 10 + len); ctx.stroke();
      ctx.strokeStyle = `rgba(230, 245, 250, ${a * 0.55})`;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(-5, 8); ctx.lineTo(-11, 8 + len * 0.6); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(5, 8); ctx.lineTo(11, 8 + len * 0.6); ctx.stroke();
    }
  }
  ctx.restore();
}



function drawNyxLeds(ctx, sc, night, pulse) {
  const a = (0.35 + 0.5 * night) * pulse;
  if (a < 0.02) return;
  ctx.save();
  const hw = 200 * sc * 0.28;
  const hh = 384 * sc * 0.36;
  // underglow
  const g = ctx.createRadialGradient(0, 6, 4, 0, 8, Math.max(hw, hh) * 1.15);
  g.addColorStop(0, `rgba(255, 80, 210, ${0.55 * a})`);
  g.addColorStop(0.45, `rgba(80, 200, 255, ${0.28 * a})`);
  g.addColorStop(1, "rgba(80, 200, 255, 0)");
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.ellipse(0, 8, hw * 1.35, hh * 1.05, 0, 0, TAU); ctx.fill();
  // side rails
  ctx.strokeStyle = `rgba(255, 70, 200, ${0.8 * a})`;
  ctx.lineWidth = 2.2;
  ctx.beginPath(); ctx.moveTo(-hw, -hh * 0.7); ctx.lineTo(-hw, hh * 0.55); ctx.stroke();
  ctx.strokeStyle = `rgba(70, 230, 255, ${0.8 * a})`;
  ctx.beginPath(); ctx.moveTo(hw, -hh * 0.7); ctx.lineTo(hw, hh * 0.55); ctx.stroke();
  // front bar
  ctx.strokeStyle = `rgba(200, 235, 255, ${0.7 * a})`;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-hw * 0.55, hh * 0.72); ctx.lineTo(hw * 0.55, hh * 0.72); ctx.stroke();
  ctx.restore();
}

function drawHeadCone(ctx, len, halfW, beam, alpha) {
  if (alpha <= 0.01) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.moveTo(-1.6, -len + 2);
  ctx.lineTo(-halfW, -len - beam);
  ctx.lineTo(halfW, -len - beam);
  ctx.lineTo(1.6, -len + 2);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, -len, 0, -len - beam);
  g.addColorStop(0, "rgba(255, 230, 170, 0.95)");
  g.addColorStop(0.22, "rgba(255, 190, 100, 0.42)");
  g.addColorStop(1, "rgba(255, 150, 70, 0)");
  ctx.fillStyle = g;
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-0.8, -len + 1);
  ctx.lineTo(-halfW * 0.22, -len - beam * 0.55);
  ctx.lineTo(halfW * 0.22, -len - beam * 0.55);
  ctx.closePath();
  ctx.fillStyle = "rgba(255, 236, 190, 0.7)";
  ctx.fill();
  ctx.restore();
}

function drawVehLights() {}

function drawChar(G, a) {
  const civilian=!['chaos','hunter','fire'].includes(a.sprite||'chaos');
  const crowd=civilian && G.assets.sprites.crowd_atlas;
  const spr = crowd || G.assets.sprites["char_" + (a.sprite || "chaos")];
  if (!spr) return;
  const ctx = G.ctx, opacity = ctx.globalAlpha;
  const fw = spr.width / (crowd?9:6), fh = spr.height / 8;
  const aiming=a===G.player && G.input.fire && !(G.action?.reloadT>0);
  const dir = ((Math.round((aiming ? a.aimRot??a.rot : a.rot) / (Math.PI / 4))) + 8) % 8;
  const row = (dir + 6) % 8; // sheet row 0 is East
  let col = 4; // idle
  const moving = (a.speed || 0) > 20 || (a === G.player && a.type === "foot" && Math.hypot(G.input.x, G.input.y) > 0.15);
  if (moving) col = Math.floor((a.dist || 0) / 9) % 4;
  if (aiming) col = 5;
  if(crowd) {
    const type=a.copPed||a.sprite==='cop'?2:['m2','m4','guest','synth'].includes(a.sprite)?1:0;
    col=type*3+(moving?Math.floor((a.dist||0)/10)%2:2);
  }
  if (a.dead) { ctx.globalAlpha = opacity * 0.5; col = crowd?Math.floor(col/3)*3+2:4; }
  const sc = crowd ? 56/(fh*.92) : charScale(a.sprite || "chaos", spr);
  ctx.save();
  ctx.translate(a.x, a.y);
  if(a.dead){const fall=clamp((a.deadT||0)*4,0,1);ctx.rotate(fall*.7);ctx.scale(1,1-fall*.64);}
  if (G.jack && a === G.player) {
    const k = 1 - Math.max(0, G.jack.t) / (G.jack.dur || 0.38);
    ctx.scale(1 - 0.3 * k, 1 - 0.55 * k);
  }
  if (a.exitT > 0) {
    const k = Math.min(1, a.exitT);
    ctx.scale(0.7 + 0.3 * k, 0.55 + 0.45 * k);
  }
  if (a.dive > 0) {
    ctx.rotate((a.rot || 0) * 0.15);
    ctx.scale(1.15, 0.42);
  }
  const pose = characterPose(a, moving, G.ticks / 60, G.settings.reducedMotion);
  if(a===G.player && G.action?.dodgeT>0) {ctx.rotate(Math.sin((1-G.action.dodgeT/.34)*Math.PI)*.35);ctx.scale(1,.67);}
  const dx = -fw * 0.5 * sc, dy = -fh * 0.68 * sc + pose.bob + pose.recoil * 1.8, dw = fw * sc * pose.sx, dh = fh * sc * pose.sy;
  // soft south drop shadow
  ctx.save();
  const prevSmooth = ctx.imageSmoothingQuality;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = G.settings.quality==='low'?'low':'medium';
  ctx.fillStyle = "rgba(0,0,0,0.16)";
  ctx.beginPath(); ctx.ellipse(3, dh * 0.36, dw * 0.36, dh * 0.14, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = "rgba(0,0,0,0.28)";
  ctx.beginPath(); ctx.ellipse(2, dh * 0.32, dw * 0.24, dh * 0.09, 0, 0, TAU); ctx.fill();
  ctx.restore();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = G.settings.quality==='low'?'low':'medium';
  const isHero = a.sprite === "chaos" || a === G.player;
  const nightC = nightFactor(G);
  if (G.settings.quality!=='low' && isHero && nightC > 0.18 && !a.dead) {
    ctx.save();
    ctx.shadowColor = `rgba(190, 245, 255, ${0.95 * nightC})`;
    ctx.shadowBlur = 0;
    const o = 1.1;
    for (const [sx, sy] of [[o, 0], [0, -o]]) {
      ctx.shadowOffsetX = sx;
      ctx.shadowOffsetY = sy;
      ctx.drawImage(spr, col * fw, row * fh, fw, fh, dx, dy, dw, dh);
    }
    // pink rim on the north-west edge
    ctx.shadowColor = `rgba(255, 130, 210, ${0.75 * nightC})`;
    ctx.shadowOffsetX = -o; ctx.shadowOffsetY = -o;
    ctx.drawImage(spr, col * fw, row * fh, fw, fh, dx, dy, dw, dh);
    ctx.restore();
  }
  ctx.drawImage(spr, col * fw, row * fh, fw, fh, dx, dy, dw, dh);
  // Aim with the upper body while the locomotion frames keep the legs stepping.
  if(a===G.player && moving && aiming && !G.settings.reducedMotion && !crowd){
    const legRow=((((Math.round(a.rot/(Math.PI/4))+8)%8)+6)%8),legCol=Math.floor((a.dist||0)/9)%4;
    ctx.save();ctx.beginPath();ctx.rect(dx,dy+dh*.69,dw,dh*.31);ctx.clip();
    ctx.drawImage(spr,legCol*fw,legRow*fh,fw,fh,dx,dy,dw,dh);ctx.restore();
  }
  if(a===G.player && G.action?.reloadT>0){
    const k=1-G.action.reloadT/WEAPONS[G.action.weapon].reload,wave=Math.sin(k*Math.PI);
    ctx.save();ctx.rotate(a.rot);ctx.strokeStyle='#a0b59a';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(9,-8);ctx.lineTo(5-wave*7,-3-wave*8);ctx.stroke();ctx.fillStyle='#202e32';ctx.fillRect(3-wave*7,-8-wave*8,4,7);ctx.restore();
  }
  if(a!==G.player&&G.settings.quality!=='low')drawAmbientGesture(G,a);
  if (G.settings.quality!=='low' && isHero && nightC > 0.18 && !a.dead) {
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = opacity * 0.12 * nightC;
    ctx.drawImage(spr, col * fw, row * fh, fw, fh, dx, dy - 1, dw, dh);
    ctx.globalAlpha = opacity;
    ctx.globalCompositeOperation = "source-over";
  }
  ctx.restore();
  ctx.globalAlpha = opacity;
}

const FONT_D = "'Arial Black', 'Arial Bold', Impact, system-ui, sans-serif";
function drawAimGuide(G){
  if(G.player.def?.aircraft||G.scene!=='play'||!G.input.fire||G.action?.dodgeT>0)return;
  const p=G.player,c=G.ctx,rot=p.aimRot??aimDirection(G.input,p.rot,G.cam.rot),h=headingVec(rot);
  let length=200;for(let n=24;n<200;n+=12)if(G.solidAt(p.x+h.x*n,p.y+h.y*n)){length=n;break;}
  const x=p.x+h.x*length,y=p.y+h.y*length;
  c.save();c.strokeStyle=G.hitConfirmT>0?'#fff8e5':'rgba(224,203,158,.7)';c.lineWidth=1.2;c.setLineDash([3,7]);c.beginPath();c.moveTo(p.x+h.x*30,p.y+h.y*30);c.lineTo(x,y);c.stroke();c.setLineDash([]);
  c.beginPath();c.arc(x,y,G.hitConfirmT>0?5:8,0,TAU);c.stroke();
  c.beginPath();c.moveTo(x-12,y);c.lineTo(x-6,y);c.moveTo(x+6,y);c.lineTo(x+12,y);c.moveTo(x,y-12);c.lineTo(x,y-6);c.moveTo(x,y+6);c.lineTo(x,y+12);c.stroke();c.restore();
}
function drawStreetWaypoint(G){
  const job=G.action?.contract,p=job?streetJobTarget(G,job)||G.waypoint:G.waypoint;
  if(G.scene!=='play'||!p)return;
  const c=G.ctx;
  if(Math.hypot(p.x-G.cam.x,p.y-G.cam.y)>1100)return;
  const pulse=G.settings.reducedMotion?1:1+Math.sin(G.ticks*.05)*.08;
  c.save();c.translate(p.x,p.y);c.strokeStyle='#86d6d0';c.fillStyle='rgba(69,151,153,.12)';c.lineWidth=2;
  c.beginPath();c.ellipse(0,0,34*pulse,23*pulse,0,0,TAU);c.fill();c.stroke();
  c.font='800 9px system-ui';c.textAlign='center';c.fillStyle='#102a31';c.fillRect(-61,-53,122,21);c.fillStyle='#c3ece0';
  c.fillText(job?.id==='rescue'?job.stage?'WITNESS DROP':'WITNESS PICKUP':job?.id==='signal'?job.stage===3?'TRANSMIT / 3 SEC':'DEAD DROP / ON FOOT':'BLUE WAYPOINT',0,-39);
  if(job && job.progress>0 && ['rescue','signal'].includes(job.id)){c.fillStyle='#3c5d63';c.fillRect(-30,32,60,3);c.fillStyle='#b9e4cf';c.fillRect(-30,32,60*Math.min(1,job.progress/(job.id==='rescue'?!job.stage?3:2:job.stage===3?3:2)),3);}
  c.restore();
  if(job?.id==='rescue'&&!job.stage){
    if(!G._witness||G._witness.markerX!==p.x){const s=findSafe(G,p.x+66,p.y,9,true,true);G._witness={...s,markerX:p.x,sprite:'worker',rot:-Math.PI/2,speed:0,dist:0};}
    drawChar(G,G._witness);
  }
}
function uiFont(px, w = 700, disp = false) { return `${w} ${Math.round(px)}px ${disp ? FONT_D : "Inter, system-ui, sans-serif"}`; }
function uiPanel(ctx, x, y, w, h, r, opts = {}) {
  ctx.save();
  rounded(ctx, x, y, w, h, r);
  ctx.fillStyle = opts.fill || "rgba(9,22,28,0.85)";
  ctx.fill();
  ctx.lineWidth = Math.max(1, r * 0.12);
  ctx.strokeStyle = opts.stroke || "rgba(255,255,255,0.12)";
  ctx.stroke();
  if (opts.accent) { ctx.save(); rounded(ctx, x, y, w, h, r); ctx.clip(); ctx.fillStyle = opts.accent; ctx.fillRect(x, y, Math.max(3, r * 0.3), h); ctx.restore(); }
  ctx.restore();
}
function uiButton(G, x, y, w, h, label, act, o = {}) {
  const ctx = G.ctx, u = G.ui;
  const idx = o.nav === false ? -1 : G._nav.length;
  const btn = { x, y, w, h, label, act, adj: o.adj };
  G.buttons.push(btn);
  if (idx >= 0) G._nav.push(btn);
  const sel = idx >= 0 && idx === (G.menuSel || 0) && !G.touch;
  ctx.save();
  rounded(ctx, x, y, w, h, Math.min(h / 2, 12 * u));
  if (o.primary) ctx.fillStyle='#dfc496';
  else ctx.fillStyle = sel ? "rgba(162,199,181,0.2)" : "rgba(159,192,179,0.07)";
  ctx.fill();
  ctx.lineWidth = 1.5 * u;
  ctx.strokeStyle = o.primary ? "rgba(255,240,190,0.9)" : sel ? "rgba(242,193,78,0.9)" : "rgba(255,255,255,0.18)";
  ctx.stroke();
  ctx.fillStyle = o.primary ? "#1a1206" : sel ? "#ffe27a" : "#fff";
  ctx.font = uiFont(o.size || Math.min(h * 0.38, 17 * u), 800);
  ctx.textAlign = o.align || "center"; ctx.textBaseline = "middle";
  if(!o.hideLabel)ctx.fillText(label, o.align === "left" ? x + 16 * u : x + w / 2, y + h / 2 + 1,w-24*u);
  if (o.sub) { ctx.font = uiFont(11 * u, 600); ctx.fillStyle = o.primary ? "rgba(26,18,6,0.7)" : "rgba(255,255,255,0.55)"; ctx.textAlign = "right"; ctx.fillText(o.sub, x + w - 14 * u, y + h / 2 + 1); }
  ctx.textBaseline = "alphabetic";
  ctx.restore();
  return btn;
}
function worldToScreen(G, x, y) {
  const S = G.cam.scale * worldZoom(G);
  const dx = x - G.cam.x, dy = y - G.cam.y, c = Math.cos(-G.cam.rot), s = Math.sin(-G.cam.rot);
  return { x: G.canvas.width / 2 + (dx * c - dy * s) * S, y: G.canvas.height / 2 + (dx * s + dy * c) * S };
}
function hintText(G, t) { return G.touch ? t.replace("(E)", "— tap CAR").replace(/press E/gi, "tap TAKE") : t; }
function updateGPS(G) {
  const at = G.waypoint || currentObjectivePos(G);
  if (!at) { G.gpsPts = null; return; }
  if (G._gpsTick === G.ticks && G.gps && G.gps.x === at.x && G.gps.y === at.y) return;
  G._gpsTick = G.ticks;
  if (G.player.type === 'veh' && (G.player.def.boat||G.player.def.aircraft)) { G.gpsPts = [G.player.x,G.player.y,at.x,at.y]; return; }
  const N = G.nav;
  if (!G.gps) G.gps = { D: new Uint16Array(N.NW * N.NH), x: -1e9, y: 0, next: 0 };
  const g = G.gps;
  if (g.x < -1e8 || G.ticks >= g.next && Math.hypot(at.x - g.x, at.y - g.y) > 32) {
    N.flood(g.D, at.x, at.y, 60000); g.x = at.x; g.y = at.y; g.next = G.ticks + 40; G.gpsPts = null;
  }
  if (G.ticks % 15 === 0 || !G.gpsPts) G.gpsPts = N.route(g.D, G.player.x, G.player.y);
}

function drawMinimap(G, x, y, size, span) {
  const ctx = G.ctx, u = G.ui, P = G.player, M = G.minimap;
  ctx.save();
  rounded(ctx, x, y, size, size, 14 * u);
  ctx.fillStyle = "#0b1622"; ctx.fill();
  ctx.clip();
  const k = size / span; // screen px per world px
  const cx = x + size / 2, cy = y + size / 2;
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(M.c, (P.x - span / 2) / M.S, (P.y - span / 2) / M.S, span / M.S, span / M.S, x, y, size, size);
  ctx.fillStyle = "rgba(0,0,0,0.12)"; ctx.fillRect(x, y, size, size);
  const to = (wx, wy) => [cx + (wx - P.x) * k, cy + (wy - P.y) * k];
  // GPS route
  if (G.gpsPts && G.gpsPts.length > 2) {
    ctx.strokeStyle = G.waypoint ? "#29d7ff" : "rgba(255,214,90,0.95)"; ctx.lineWidth = 3.2 * u; ctx.lineJoin = "round"; ctx.lineCap = "round";
    ctx.beginPath(); const p0 = to(P.x, P.y); ctx.moveTo(p0[0], p0[1]);
    for (let i = 0; i < G.gpsPts.length; i += 2) { const p = to(G.gpsPts[i], G.gpsPts[i + 1]); ctx.lineTo(p[0], p[1]); }
    ctx.stroke();
  }
  for(const pad of G.world.expansion?.helipads||[]){const p=to(pad.x,pad.y);ctx.fillStyle="#a4dfcb";ctx.font=uiFont(10*u,900);ctx.textAlign="center";ctx.fillText("H",p[0],p[1]);}
  for (const c of G.cops) { const p = to(c.x, c.y); ctx.fillStyle = ((G.ticks / 8) | 0) % 2 ? "#ff3048" : "#3a6bff"; ctx.beginPath(); ctx.arc(p[0], p[1], 3.5 * u, 0, TAU); ctx.fill(); }
  const at = currentObjectivePos(G);
  if (at) {
    let p = to(at.x, at.y);
    const m = 8 * u; p = [clamp(p[0], x + m, x + size - m), clamp(p[1], y + m, y + size - m)];
    ctx.fillStyle = "#f2c14e"; ctx.strokeStyle = "#1a1206"; ctx.lineWidth = 2 * u;
    ctx.beginPath(); ctx.arc(p[0], p[1], 6 * u, 0, TAU); ctx.fill(); ctx.stroke();
  }
  ctx.restore();
  G.buttons.push({ x, y, w: size, h: size, act: () => { G.scene = 'map'; G.menuSel = 0; } });
  // player arrow
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(P.rot || 0);
  ctx.fillStyle = "#fff"; ctx.strokeStyle = "#ff2d9b"; ctx.lineWidth = 2 * u;
  ctx.beginPath(); ctx.moveTo(0, -8 * u); ctx.lineTo(6 * u, 6 * u); ctx.lineTo(0, 3 * u); ctx.lineTo(-6 * u, 6 * u); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.restore();
  ctx.save(); rounded(ctx, x, y, size, size, 14 * u); ctx.lineWidth = 2 * u; ctx.strokeStyle = "rgba(255,255,255,0.35)"; ctx.stroke(); ctx.restore();
  ctx.fillStyle = "rgba(255,255,255,0.8)"; ctx.font = uiFont(9 * u, 800); ctx.textAlign = "center"; ctx.fillText("N", cx, y + 11 * u);
}
function drawHUD(G) {
  if (G.hideHUD) return;
  if (G.touch) {drawMobileHUD(G,{minimap:drawMinimap,gps:updateGPS,objective:currentObjectivePos,screen:worldToScreen,missionTitle:G.freeRoam?'FREE RIDE':MISSIONS[G.missionIndex]?.title,banner:drawBanner});drawExpansionHUD(G);drawFlightHUD(G);return;}
  const { ctx, canvas } = G;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const u = G.ui, sf = G.safe || { t: 0, r: 0, b: 0, l: 0 };
  const W = canvas.width, H = canvas.height;
  const pad = 10 * u;
  // DOM touch controls use CSS pixels, independently of the canvas UI scale.
  const touchRail = G.touch ? 62 * G.dpr : 0;
  const L = pad + sf.l, T = pad + sf.t, R = W - pad - sf.r - touchRail;
  let _t = performance.now();
  updateGPS(G);
  prof(G, "h_gps", performance.now() - _t); _t = performance.now();
  // minimap + vitals (top-left)
  const mm = Math.round(clamp(Math.min(W, H) * 0.3, 96 * u, 150 * u));
  drawMinimap(G, L, T, mm, G.player.type === "veh" ? 2200 : 1400);
  prof(G, "h_mini", performance.now() - _t);
  const vy = T + mm + 6 * u;
  drawActionHUD(G,L,vy,mm);
  uiPanel(ctx, L, vy, mm, 30 * u, 8 * u);
  ctx.fillStyle = "rgba(255,255,255,0.12)"; ctx.fillRect(L + 8 * u, vy + 7 * u, mm - 16 * u, 5 * u);
  ctx.fillStyle = G.health > 40 ? "#3ce06a" : "#ff3a48"; ctx.fillRect(L + 8 * u, vy + 7 * u, (mm - 16 * u) * clamp(G.health / 100, 0, 1), 5 * u);
  const tl = timeLabel(G.time);
  const icon = tl.phase === "NIGHT" ? "☾" : tl.phase === "DAY" ? "☀" : "◐";
  ctx.font = uiFont(10.5 * u, 800); ctx.textAlign = "left"; ctx.fillStyle = "#fff";
  ctx.fillText(`${icon} ${tl.text}`, L + 8 * u, vy + 24 * u);
  ctx.textAlign = "right"; ctx.fillStyle = "rgba(255,255,255,0.6)"; ctx.font = uiFont(9 * u, 700);
  ctx.fillText(tl.phase, L + mm - 8 * u, vy + 24 * u);
  // chips + stars (top-right, clear of the pause button)
  const rr = R;
  const cw = 150 * u;
  uiPanel(ctx, rr - cw, T, cw, 50 * u, 10 * u, { accent: "#f2c14e" });
  ctx.drawImage(G.assets.chipIcon, rr - cw + 12 * u, T + 7 * u, 17 * u, 17 * u);
  ctx.font = uiFont(15 * u, 800); ctx.textAlign = "left"; ctx.fillStyle = "#ffe27a";
  ctx.fillText(String(G.chips | 0), rr - cw + 34 * u, T + 21 * u);
  const flash = G.evading && G.wanted > 0 && ((G.ticks / 15) | 0) % 2;
  for (let i = 0; i < 5; i++) {
    ctx.globalAlpha = i < G.wanted ? (flash ? 0.35 : 1) : 0.35;
    ctx.drawImage(i < G.wanted ? G.assets.starOn : G.assets.starOff, rr - cw + 12 * u + i * 26 * u, T + 27 * u, 19 * u, 19 * u);
  }
  ctx.globalAlpha = 1;
  prof(G, "h_stars", performance.now() - _t); _t = performance.now();
  // objective (top-center)
  const narrow = W / u < 640;
  const midW = narrow ? R - (L + mm + 10 * u) : Math.min(W * 0.46, 460 * u);
  const midX = narrow ? L + mm + 10 * u + midW / 2 : W / 2;
  let oy = narrow ? T + (G.wanted > 0 ? 78 : 58) * u : T;
  if (G.hint) {
    const title = G.freeRoam ? "FREE RIDE" : MISSIONS[G.missionIndex]?.title || "";
    ctx.font = uiFont(13 * u, 700);
    const lines = wrapLines(ctx, hintText(G, G.hint), midW - 28 * u);
    const ph = (24 + lines.length * 17) * u;
    uiPanel(ctx, midX - midW / 2, oy, midW, ph, 10 * u, { fill: "rgba(10,7,18,0.72)" });
    ctx.textAlign = "center"; ctx.fillStyle = "#f2c14e"; ctx.font = uiFont(9.5 * u, 900);
    ctx.fillText(title + (G.freeRoam?'':'  ' + (G.objectiveIndex + 1) + '/' + (G._flow?.objectives.length || 1)) + (G.district ? '  ·  ' + G.district : ''), midX, oy + 14 * u, midW - 16 * u);
    ctx.fillStyle = "#fff"; ctx.font = uiFont(13 * u, 700);
    lines.forEach((ln, i) => ctx.fillText(ln, midX, oy + (31 + i * 17) * u));
    oy += ph + 6 * u;
  }
  if (G.tip) {
    ctx.font = uiFont(12 * u, 700);
    const lines = wrapLines(ctx, G.tip, midW - 28 * u);
    const ph = (12 + lines.length * 16) * u;
    uiPanel(ctx, midX - midW / 2, oy, midW, ph, 9 * u, { fill: "rgba(8,30,40,0.78)", stroke: "rgba(41,240,255,0.55)" });
    ctx.fillStyle = "#bff8ff"; ctx.textAlign = "center";
    lines.forEach((ln, i) => ctx.fillText(ln, midX, oy + (19 + i * 16) * u));
    oy += ph + 6 * u;
  }
  if (G.radioT > 0) {
    ctx.globalAlpha = Math.min(1, G.radioT);
    const ry = vy + 38 * u;
    uiPanel(ctx, L, ry - 2 * u, mm, 32 * u, 8 * u);
    ctx.textAlign = "left"; ctx.font = uiFont(8.5 * u, 800); ctx.fillStyle = "#29f0ff";
    ctx.fillText("♪ NOW PLAYING", L + 8 * u, ry + 9 * u);
    ctx.font = uiFont(12 * u, 800); ctx.fillStyle = "#fff"; ctx.fillText(G.radioName, L + 8 * u, ry + 24 * u);
    ctx.globalAlpha = 1;
  }
  if (G.toastT > 0 && G.toast) {
    ctx.globalAlpha = Math.min(1, G.toastT * 2);
    ctx.font = uiFont(13 * u, 800); ctx.textAlign = "center";
    const tw = ctx.measureText(G.toast).width + 30 * u;
    const ty = narrow ? Math.max(oy + 8 * u, H * 0.3) : H - sf.b - (G.player.type === "veh" ? 92 : 56) * u;
    uiPanel(ctx, W / 2 - tw / 2, ty, tw, 28 * u, 14 * u, { fill: "rgba(0,0,0,0.65)" });
    ctx.fillStyle = "#fff"; ctx.fillText(G.toast, W / 2, ty + 18.5 * u);
    ctx.globalAlpha = 1;
  }
  prof(G, "h_obj", performance.now() - _t); _t = performance.now();
  // district title card
  if (G.districtT > 0 && G.district) {
    ctx.globalAlpha = Math.min(1, G.districtT, (3 - G.districtT) * 3);
    ctx.font = uiFont(22 * u, 900, true); ctx.textAlign = "center";
    const dy = oy + 34 * u;
    ctx.lineWidth = 5 * u; ctx.strokeStyle = "rgba(0,0,0,0.8)"; ctx.strokeText(G.district, midX, dy);
    ctx.fillStyle = "#ffe27a"; ctx.fillText(G.district, midX, dy);
    ctx.globalAlpha = 1;
  }
  prof(G, "h_dist", performance.now() - _t); _t = performance.now();
  if (G.race) {
    const r = G.race;
    ctx.fillStyle = '#29f0ff'; ctx.font = uiFont(14 * u, 900); ctx.textAlign = 'center';
    const progress = 'LAP ' + Math.min(r.laps, Math.floor(r.i / r.gatesPerLap) + 1) + '/' + r.laps + '  ·  GATE ' + Math.min(r.i + 1, r.pts.length) + '/' + r.pts.length;
    const timing = r.t.toFixed(1) + 's  ·  FIRE ' + r.rivalI + '/' + r.pts.length;
    const label = r.countdown > 0 ? 'READY  ' + Math.ceil(r.countdown) : progress + (narrow ? '' : '  ·  ' + timing);
    ctx.fillText(label, midX, oy + 22 * u, midW); oy += 30 * u;
    if (narrow && r.countdown <= 0) {
      ctx.font = uiFont(11 * u, 800); ctx.fillText(timing, midX, oy + 10 * u, midW); oy += 20 * u;
    }
    if (r.countdown > 0) {
      const cy = Math.max(oy + 35 * u, H * .36);
      uiPanel(ctx, midX - 75 * u, cy - 22 * u, 150 * u, 44 * u, 10 * u, {fill:'rgba(8,18,31,.9)'});
      for (let i=0;i<3;i++) {
        ctx.fillStyle = 3-r.countdown>=i ? '#ffe0a0' : '#33434c';
        ctx.beginPath();ctx.arc(midX+(i-1)*34*u,cy,8*u,0,TAU);ctx.fill();
      }
    }
  }
  if (G.wanted > 0) {
    const max = 7 + G.wanted * 2.5;
    const label = G.evading ? 'SEARCHING  ' + Math.max(0, max - (G.seenT || 0)).toFixed(0) + 's TO LOSE A STAR' : 'SPOTTED — BREAK LINE OF SIGHT';
    ctx.font = uiFont(10 * u, 800); ctx.textAlign = 'right'; ctx.fillStyle = G.evading ? '#29f0ff' : '#ff8c9c';
    ctx.fillText(label, rr, T + 65 * u);
  }
  const objective = G._flow?.objectives[G.objectiveIndex];
  if ((objective?.hold || objective?.hack) && G.missionState.holdT > 0) {
    ctx.font = uiFont(12 * u, 800); ctx.textAlign = 'center'; ctx.fillStyle = '#29f0ff';
    ctx.fillText((objective.hack?'TRANSFERRING  ':'CASING  ') + Math.round(100 * G.missionState.holdT / (objective.hold||objective.hack)) + '% — HOLD STILL', midX, oy + 20 * u, midW);
    oy += 26 * u;
  }
  if (G.missionState.scramblerT > 0) {
    ctx.font = uiFont(12 * u, 800); ctx.textAlign = 'center'; ctx.fillStyle = '#29f0ff';
    const lines = wrapLines(ctx, 'SCRAMBLER  ' + Math.ceil(G.missionState.scramblerT) + 's — NEW CRIMES END THE WINDOW', midW);
    lines.forEach((line, i) => ctx.fillText(line, midX, oy + (20 + i * 16) * u));
    oy += (24 + (lines.length - 1) * 16) * u;
  }
  // speedo (bottom-center)
  if (G.player.type === "veh") {
    const bw = (narrow ? 170 : 210) * u, bx = narrow ? R - bw : W / 2 - bw / 2, by = narrow ? oy : H - 62 * u - sf.b;
    drawSpeedometer(G, bx, by, bw, 50 * u);
  }
  prof(G, "h_spd", performance.now() - _t); _t = performance.now();
  // off-screen objective arrow
  const at = currentObjectivePos(G);
  if (at) {
    const s = worldToScreen(G, at.x, at.y);
    const m = 46 * u;
    const off = s.x < m || s.y < m || s.x > W - m || s.y > H - m;
    const dist = Math.hypot(at.x - G.player.x, at.y - G.player.y);
    if (off) {
      const ang = Math.atan2(s.x - W / 2, -(s.y - H / 2));
      const top = Math.max(oy + 26 * u, m), bot = H - sf.b - 70 * u;
      const cyA = (top + bot) / 2, ry = (bot - top) / 2, rx = W / 2 - m * 1.6;
      const ex = W / 2 + Math.sin(ang) * rx, ey = cyA - Math.cos(ang) * ry;
      ctx.save(); ctx.translate(ex, ey); ctx.rotate(ang);
      ctx.fillStyle = "#f2c14e"; ctx.strokeStyle = "rgba(0,0,0,0.7)"; ctx.lineWidth = 3 * u;
      ctx.beginPath(); ctx.moveTo(0, -16 * u); ctx.lineTo(12 * u, 8 * u); ctx.lineTo(0, 3 * u); ctx.lineTo(-12 * u, 8 * u); ctx.closePath(); ctx.stroke(); ctx.fill();
      ctx.restore();
      ctx.font = uiFont(10 * u, 900); ctx.textAlign = "center"; ctx.fillStyle = "#fff";
      ctx.fillText(`${Math.round(dist / 10)}m`, ex, ey + 24 * u);
    }
  }
  prof(G, "h_arrow", performance.now() - _t); _t = performance.now();
  // floating chip popups (true world positions)
  ctx.textAlign = "center"; ctx.font = uiFont(15 * u, 900);
  for (const f of G.floaters) {
    const s = worldToScreen(G, f.x, f.y);
    ctx.globalAlpha = Math.min(1, f.life * 1.4); ctx.fillStyle = f.color || "#f2c14e";
    ctx.fillText(f.text, s.x, s.y);
  }
  ctx.globalAlpha = 1;
  if (G.banner) drawBanner(G, W, H);
  if (G.settings.showFps) {
    const P = G.prof || {};
    ctx.font = uiFont(10 * u, 800); ctx.textAlign = "right"; ctx.fillStyle = G.fps > 50 ? "#3ce06a" : G.fps > 28 ? "#ffd24a" : "#ff4a5a";
    ctx.fillText(`${(G.presentFps || G.fps) | 0} FPS · ${Math.round((G.resScale || 1) * 100)}% · ${G.worldWidth}×${G.worldHeight} · js ${((P.tick || 0) + (P.render || 0)).toFixed(1)}ms`, rr, T + 64 * u);
  }
  if (!G.touch) { ctx.font = uiFont(10 * u, 700); ctx.textAlign = "right"; ctx.fillStyle = "rgba(255,255,255,0.45)"; ctx.fillText("ESC pause · M map · E car · Space drift", R - (G.fsSupported ? 150 * G.dpr : 0), H - 10 * u - sf.b); }
  drawExpansionHUD(G);drawFlightHUD(G);
}
function drawFlightHUD(G){
  const hint=aviationHint(G);if(!hint)return;
  const c=G.ctx,d=G.touch?G.dpr:G.ui,W=G.canvas.width,H=G.canvas.height;
  const w=Math.min(W-28*d,(G.touch?360:570)*d),x=(W-w)/2;
  const y=G.touch?(H>W?H*.32:H-145*d):H-190*d;
  c.save();c.setTransform(1,0,0,1,0,0);uiPanel(c,x,y,w,53*d,7*d,{accent:'#a0d8d2'});
  const [status,controls]=hint.split('\n');c.textAlign='center';c.fillStyle=G.player.stall?'#ffb093':'#e9d4aa';c.font=uiFont(11*d,800);c.fillText(status,W/2,y+18*d,w-16*d);
  c.fillStyle='#b8d4cf';c.font=uiFont((G.touch?9:11)*d,600);c.fillText(controls,W/2,y+37*d,w-16*d);c.restore();
}
function wrapLines(ctx, text, max) {
  const words = String(text).split(" "); const out = []; let line = "";
  for (const w of words) { const t = line ? line + " " + w : w; if (ctx.measureText(t).width > max && line) { out.push(line); line = w; } else line = t; }
  if (line) out.push(line);
  return out.slice(0, 3);
}

function drawBanner(G, W, H) {
  const b = G.banner;
  if (!b) return;
  const ctx = G.ctx, u = G.ui;
  const k = 1 - b.t / b.max;
  const appear = k < 0.12 ? k / 0.12 : 1;
  const fade = b.t < 0.5 ? b.t / 0.5 : 1;
  const win = b.kind !== "bust";
  ctx.save();
  ctx.globalAlpha = appear * fade;
  const bh = 96 * u, by = H * 0.42 - bh / 2;
  const g = ctx.createLinearGradient(0, by, 0, by + bh);
  g.addColorStop(0, win ? "rgba(20,14,0,0.0)" : "rgba(30,0,0,0)"); g.addColorStop(0.2, win ? "rgba(20,14,0,0.85)" : "rgba(40,0,4,0.85)"); g.addColorStop(0.8, win ? "rgba(20,14,0,0.85)" : "rgba(40,0,4,0.85)"); g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g; ctx.fillRect(0, by, W, bh);
  ctx.textAlign = "center";
  const scale = 0.85 + 0.15 * appear;
  ctx.translate(W / 2, by + bh * 0.62); ctx.scale(scale, scale);
  ctx.font = uiFont(Math.min(54 * u, W / 9), 900, true);
  ctx.lineWidth = 7 * u; ctx.strokeStyle = "#000"; ctx.strokeText(b.title, 0, 0);
  ctx.fillStyle = win ? "#ffe27a" : "#ff4a5a"; ctx.fillText(b.title, 0, 0);
  if (b.sub) { ctx.font = uiFont(13 * u, 700); ctx.fillStyle = "rgba(255,255,255,0.88)"; ctx.fillText(b.sub, 0, 24 * u); }
  ctx.restore();
}

function drawTitle(G) {
  drawTitleScreen(G,{button:uiButton,startNew:()=>startNew(G),continueGame:()=>loadSave(G,'story'),freeRide:()=>startFreeRide(G),settings:()=>{G.pausedFrom='title';G.scene='settings';G.menuSel=0;}});
}

function drawPause(G) {
  const items = [
    ["RESUME", () => { G.scene = "play"; }, { primary: true }],
    ["STORY / DOSSIER", () => {G.scene="dossier";G.menuSel=0;}, {}],
    ["CITY MAP", () => { G.scene = "map"; }, {}],
    ["CREW / CONTRACTS", () => { G.scene='crew';G.menuSel=0; }, {}],
    ["SETTINGS", () => { G.pausedFrom = "pause"; G.scene = "settings"; G.menuSel = 0; }, {}],
    ["SAVE GAME", () => save(G), {}],
    ...(G._flow && G.checkpoint ? [["RETRY OBJECTIVE", () => retryObjective(G), {}]] : []),
    ...(G.fsSupported && !G.standalone ? [[G.isFS() ? "EXIT FULL SCREEN" : "FULL SCREEN", () => G.toggleFS(), {}]] : []),
    ["QUIT TO TITLE", () => { G.scene = "title"; G.menuSel = 0; G.saveExists = !!readJSON(localStorage, SAVE_KEY); }, {}],
  ];
  drawPauseScreen(G,{button:uiButton,panel:uiPanel,items});
}
function drawMap(G) {
  const { ctx, canvas } = G;
  const W = canvas.width, H = canvas.height, u = G.ui, M = G.minimap;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = "rgba(4,2,10,0.9)"; ctx.fillRect(0, 0, W, H);
  const k = Math.min((W - 40 * u) / M.c.width, (H - 80 * u) / M.c.height);
  const mw = M.c.width * k, mh = M.c.height * k, mx = W / 2 - mw / 2, my = 52 * u;
  G.mapView = { x: mx, y: my, w: mw, h: mh, k };
  ctx.drawImage(M.c, mx, my, mw, mh);
  ctx.strokeStyle = "rgba(255,255,255,0.3)"; ctx.lineWidth = 2; ctx.strokeRect(mx, my, mw, mh);
  const to = (x, y) => [mx + x / M.S * k, my + y / M.S * k];
  for(const pad of G.world.expansion?.helipads||[]){const p=to(pad.x,pad.y);ctx.fillStyle="#a4dfcb";ctx.font=uiFont(10*u,900);ctx.textAlign="center";ctx.fillText("H",p[0],p[1]);}
  for(const contact of G.contacts||[]){const p=to(contact.x,contact.y);ctx.fillStyle=contact.color;ctx.beginPath();ctx.arc(p[0],p[1],3*u,0,TAU);ctx.fill();ctx.font=uiFont(7*u,800);ctx.textAlign='left';ctx.fillText(contact.name,p[0]+5*u,p[1]+10*u);}
  for(const s of G.services||[]){const p=to(s.x,s.y);ctx.fillStyle='#83d7d0';ctx.fillRect(p[0]-3*u,p[1]-3*u,6*u,6*u);}
  ctx.textAlign = "center"; ctx.font = uiFont(Math.max(9, 11 * u * Math.min(1, k * 6)), 900);
  const labels = [["THE STRIP", 1964, 2200], ["DOWNTOWN", 900, 1700], ["HARBOUR", 1900, 500], ...[["PORT ROYALE", 7000, 1200], ["MIDTOWN", 5700, 2700], ["EASTSIDE", 8800, 2700], ["IRONSIDE", 7000, 5200], ["OLD TOWN", 2000, 5400], ["SUNSET HILLS", 3000, 8000], ["CROWN AIRFIELD", 8300, 7300]]];
  for (const [n, x, y] of labels.concat((G.world.expansion?.landmarks||[]).filter(p=>p.name!=="CROWN AIRFIELD").map(p=>[p.name,p.x,p.y]))) { const p = to(x, y); ctx.lineWidth = 3; ctx.strokeStyle = "rgba(0,0,0,0.8)"; ctx.strokeText(n, p[0], p[1]); ctx.fillStyle = "rgba(255,240,200,0.92)"; ctx.fillText(n, p[0], p[1]); }
  if (G.gpsPts) { ctx.strokeStyle = G.waypoint ? "#29d7ff" : "#ffd65a"; ctx.lineWidth = 2.5 * u; ctx.beginPath(); const p0 = to(G.player.x, G.player.y); ctx.moveTo(p0[0], p0[1]); for (let i = 0; i < G.gpsPts.length; i += 2) { const p = to(G.gpsPts[i], G.gpsPts[i + 1]); ctx.lineTo(p[0], p[1]); } ctx.stroke(); }
  const at = currentObjectivePos(G);
  if (at) { const p = to(at.x, at.y); ctx.fillStyle = "#f2c14e"; ctx.beginPath(); ctx.arc(p[0], p[1], 7 * u, 0, TAU); ctx.fill(); }
  if (G.waypoint) {
    const wp = to(G.waypoint.x, G.waypoint.y);
    ctx.strokeStyle = '#29d7ff'; ctx.lineWidth = 3 * u;
    ctx.beginPath(); ctx.arc(wp[0], wp[1], 9 * u, 0, TAU); ctx.stroke();
  }
  ctx.fillStyle = '#c5dbe6'; ctx.font = uiFont(11 * u, 800); ctx.textAlign = 'center';
  ctx.fillText('MAP: WAYPOINT · GOLD: JOB · PINK: YOU · CYAN: SERVICES', W / 2, Math.min(H - 12 * u, my + mh + 22 * u),W-24*u);
  uiButton(G, 18 * u, 12 * u, 125 * u, 34 * u, 'JOB ROUTE', () => { G.waypoint = G.action?.contract?streetJobTarget(G,G.action.contract):null; G.gps = null; updateGPS(G); }, {});
  const pp = to(G.player.x, G.player.y);
  ctx.fillStyle = "#ff2d9b"; ctx.beginPath(); ctx.arc(pp[0], pp[1], 6 * u, 0, TAU); ctx.fill(); ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = "#f2c14e"; ctx.font = uiFont(16 * u, 900, true); ctx.textAlign = "left"; ctx.fillText("CROWN CITY", Math.max(mx, 160 * u), 34 * u);
  uiButton(G, W - 130 * u, 12 * u, 112 * u, 34 * u, "CLOSE", () => { G.scene = "play"; }, { primary: true });
}

function drawSettings(G) {
  drawSettingsScreen(G,{button:uiButton,panel:uiPanel,save:saveSettings,quality:()=>{G.resScale=1;fit(G);applyQuality(G);},back:()=>{G.scene=G.pausedFrom||'title';G.menuSel=0;}});
}

function drawBrief(G) {
  drawMissionBrief(G,{button:uiButton,panel:uiPanel,start:()=>startPlayFromBrief(G),brief:jobBrief(G.missionIndex)});
}

function drawVN(G) {
  const { ctx, canvas, assets } = G;
  const n = G.vn.node;
  const bg = assets.sprites["vn_" + n.bg] || assets.title;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const motion = G.settings.reducedMotion ? 0 : Math.min(1, (G.vn.t || 0) / 14);
  const bgScale = Math.max(canvas.width / bg.width, canvas.height / bg.height) * (1.025 + motion * .035);
  const bgW = bg.width * bgScale, bgH = bg.height * bgScale;
  ctx.drawImage(bg, (canvas.width - bgW) / 2 + motion * 8 * G.ui, (canvas.height - bgH) / 2, bgW, bgH);
  // pass 7: calm the busy backdrop so portraits pop (dim + vignette)
  {
    const g = ctx.createRadialGradient(canvas.width / 2, canvas.height * 0.4, canvas.height * 0.2, canvas.width / 2, canvas.height * 0.4, canvas.width * 0.7);
    g.addColorStop(0, "rgba(8,4,18,0.38)");
    g.addColorStop(1, "rgba(4,2,10,0.82)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  const u = G.ui, W = canvas.width, H = canvas.height, sf = G.safe || { l: 0, r: 0, b: 0 };
  const choices = n.choices || [];
  const typedOut = G.vn.char >= (n.text || "").length;
  ctx.font = uiFont(16 * u, 500);
  const tw = W - sf.l - sf.r - 56 * u;
  const lines = wrapLines(ctx, n.text || "", tw);
  const chH = 40 * u, chGap = 8 * u;
  const chW = choices.length > 1 && W > H ? (tw - chGap) / 2 : tw;
  const chRows = choices.length ? Math.ceil(choices.length / (chW < tw ? 2 : 1)) : 0;
  const boxH = Math.max(H * 0.24, (46 + lines.length * 22) * u + (chRows ? chRows * (chH + chGap) + 6 * u : 18 * u));
  const boxY = H - boxH;
  const faceY = H * 0.04;
  const faceH = Math.max(60, boxY - faceY - 26 * u);
  const drawPort = (id, side) => {
    if (!id) return;
    let im = assets.sprites["port_" + id];

    if (!im) return;
    const h = faceH;
    const w = Math.min(W * 0.34, h * 0.9);
    const x = side === "left" ? W * 0.06 : W * 0.94 - w;
    const bob = G.settings.reducedMotion ? 0 : Math.sin((G.vn.t || 0) * 1.4 + (side === "left" ? 0 : 1)) * 2 * u;
    const breathe = G.settings.reducedMotion ? 1 : 1 + Math.sin((G.vn.t || 0) * 1.1) * 0.008;
    ctx.save();
    rounded(ctx, x, faceY, w, h, 16 * u);
    ctx.clip();
    const scale = Math.max(w / im.width, h / im.height) * breathe;
    const dw = im.width * scale, dh = im.height * scale;
    ctx.drawImage(im, x + (w - dw) / 2, faceY + (h - dh) * 0.08 + bob, dw, dh);
    const speaking = n.speaker === id;
    if (!speaking && n.speaker) { ctx.fillStyle = "rgba(6,4,14,0.4)"; ctx.fillRect(x, faceY, w, h); }
    ctx.restore();
    const ch = CHAR[id];
    if (speaking && ch) { ctx.save(); rounded(ctx, x, faceY, w, h, 16 * u); ctx.strokeStyle = ch.color; ctx.globalAlpha = 0.8; ctx.lineWidth = 2.5 * u; ctx.stroke(); ctx.restore(); }
    if (ch) {
      ctx.font = uiFont(13 * u, 900); ctx.fillStyle = ch.color;
      ctx.textAlign = side === "left" ? "left" : "right";
      ctx.fillText(ch.name.toUpperCase(), side === "left" ? x + 4 * u : x + w - 4 * u, faceY + h + 17 * u);
    }
  };
  if (n.left) drawPort(n.left, "left");
  if (n.right) drawPort(n.right, "right");
  const g = ctx.createLinearGradient(0, boxY, 0, H);
  g.addColorStop(0, "rgba(14,10,24,0.95)"); g.addColorStop(1, "rgba(6,4,12,0.98)");
  ctx.fillStyle = g; ctx.fillRect(0, boxY, W, boxH);
  ctx.fillStyle = "#f2c14e"; ctx.fillRect(0, boxY, W, 3 * u);
  const x0 = sf.l + 28 * u;
  const sp = CHAR[n.speaker];
  ctx.textAlign = "left"; ctx.font = uiFont(13 * u, 900); ctx.fillStyle = sp ? sp.color : "#fff";
  ctx.fillText(sp ? sp.name.toUpperCase() : "", x0, boxY + 24 * u);
  ctx.fillStyle = "#f2f2f6"; ctx.font = uiFont(16 * u, 500);
  const shown = (n.text || "").slice(0, Math.max(0, G.vn.char | 0));
  wrapText(ctx, shown, x0, boxY + 48 * u, tw, 22 * u);
  if (choices.length && typedOut) {
    let cy = boxY + (46 + lines.length * 22) * u;
    choices.forEach((ch, i) => {
      const col = chW < tw ? i % 2 : 0, row = chW < tw ? (i / 2) | 0 : i;
      uiButton(G, x0 + col * (chW + chGap), cy + row * (chH + chGap), chW, chH, ch.label, () => {
        if (ch.set) Object.assign(G.flags, ch.set); G.audio.ui(); openVN(G, ch.next);
      }, { size: 13 * u, primary: false });
    });
    G.menuSel = G.vn.sel;
  } else if (!choices.length) {
    ctx.fillStyle = `rgba(255,255,255,${0.35 + 0.25 * Math.sin(G.vn.t * 4)})`;
    ctx.font = uiFont(11 * u, 800); ctx.textAlign = "right";
    ctx.fillText(G.touch ? "TAP TO CONTINUE ▸" : "SPACE / E / CLICK ▸", W - sf.r - 24 * u, H - sf.b - 12 * u);
  }
  // scene wipe
  if (G.vn.wipe > 0) {
    const k = 1 - G.vn.wipe / 0.32;
    const x = canvas.width * k;
    ctx.fillStyle = "#0a0814";
    ctx.fillRect(x, 0, canvas.width - x + 8, canvas.height);
    ctx.fillStyle = "#f2c14e";
    ctx.fillRect(x, 0, 6, canvas.height);
    ctx.fillStyle = "rgba(255, 45, 155, 0.55)";
    ctx.fillRect(x + 6, 0, 3, canvas.height);
  }
}

function rounded(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrapText(ctx, text, x, y, max, lh) {
  const words = text.split(" ");
  let line = "";
  for (const w of words) {
    const t = line ? line + " " + w : w;
    if (ctx.measureText(t).width > max) { ctx.fillText(line, x, y); y += lh; line = w; }
    else line = t;
  }
  if (line) ctx.fillText(line, x, y);
}

function drawEnd(G) {
  const { ctx, canvas } = G;
  const W = canvas.width, H = canvas.height, u = G.ui;
  drawWorld(G);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = "rgba(6,4,12,0.62)"; ctx.fillRect(0, 0, W, H);
  ctx.textAlign = "center";
  ctx.fillStyle = "#ffe27a"; ctx.font = uiFont(Math.min(40 * u, W / 14), 900, true);
  ctx.fillText("THE HOUSE DIDN'T WIN.", W / 2, H * 0.32);
  ctx.fillStyle = "#fff"; ctx.font = uiFont(15 * u, 600);
  ctx.fillText(G.flags.stash==='flip'?'Crew escaped. Some names stayed hidden.':'The archive is public. Southside has its lights back.', W / 2, H * 0.42, W - 32 * u);
  ctx.fillStyle = "#29f0ff"; ctx.font = uiFont(13 * u, 800);
  ctx.fillText(`6 JOBS COMPLETE  ·  ${Math.round(G.chips).toLocaleString()} CHIPS`, W / 2, H * 0.49, W - 32 * u);
  uiButton(G,W/2-110*u,H*.62,220*u,46*u,'KEEP DRIVING',()=>{G.freeRoam=true;G.scene='play';G.wanted=0;setHint(G);save(G);},{primary:true});
  uiButton(G, W / 2 - 110 * u, H * 0.76, 220 * u, 40 * u, "BACK TO TITLE", () => { G.scene = "title"; G.saveExists = true; }, {});
}

/* -------------------- API for tests -------------------- */
function api(G) {
  return {
    G,
    startNew: () => startNew(G),
    startFreeRide: () => startFreeRide(G),
    skipVN: () => {
      if (G.scene !== "vn") return;
      const n = G.vn.node;
      if (n.choices) { Object.assign(G.flags, n.choices[0].set || {}); openVN(G, n.choices[0].next); }
      else openVN(G, n.next);
    },
    skipAllVN: () => { let g = 0; while (G.scene === "vn" && g++ < 20) api(G).skipVN(); },
    goto: (x, y) => { if (G.player.type === "veh") { G.player.x = x; G.player.y = y; } else { G.player.x = x; G.player.y = y; } G.cam.x = x; G.cam.y = y; },
    enterNearest: () => { const v = nearestVeh(G, G.player.x, G.player.y, 160); if (v) enterVeh(G, v, true); },
    showBanner: (title, sub, kind) => showBanner(G, title, sub, kind),
    exit: () => { if (G.player.type === "veh") exitVeh(G); },
    setWanted: (n) => { const prev = G.wanted; G.wanted = n; G.wantedCool = 10; if (prev < 3 && n >= 3 && G.audio.chaseSwell) G.audio.chaseSwell(); },
    setTime: (t) => { G.time = t; },
    setWeather: (w) => { G.weather = w; G.weatherT = 40; },
    completeObjective: () => advanceObjective(G),
    completeMission: () => completeMission(G, true),
    save: () => save(G),
    startPlay: () => { if (G.scene === "brief") startPlayFromBrief(G); },
    setQuality: (q) => { G.settings.quality = q; fit(G); },
    setTimeSpeed: (k) => { G.settings.timeSpeed = k; },
    stuck: (secs = 1.5, dir = 0) => stuckProbe(G, secs, dir),
    findSafe: (x, y) => findSafe(G, x, y, 24, true),
    objPos: () => currentObjectivePos(G),
    fps: () => G.fps,
    boomNear: (dx = 0, dy = -160) => { const v = nearestVeh(G, G.player.x + dx, G.player.y + dy, 400); if (v && v !== G.player) explode(G, v); return !!v; },
    state: () => ({ cops: G.cops.length, district: G.district, fps: G.fps,
      scene: G.scene, mission: G.missionIndex, obj: G.objectiveIndex, chips: G.chips,
      wanted: G.wanted, time: G.time, weather: G.weather, x: G.player.x, y: G.player.y,
      mode: G.player.type, kind: G.player.kind, flags: { ...G.flags }, hint: G.hint, errors: 0,
    }),
  };
}

// test helper: from the player's spot, try walking 8 ways for `secs`; report best escape distance
function stuckProbe(G, secs = 1.5) {
  const P = G.player; const sx = P.x, sy = P.y; let best = 0;
  const p = { x: sx, y: sy };
  for (let a = 0; a < 8; a++) {
    p.x = sx; p.y = sy; p.stuckT = 0;
    const ang = a * Math.PI / 4;
    for (let i = 0; i < secs * 60; i++) moveFoot(G, p, Math.cos(ang) * 2.6, Math.sin(ang) * 2.6);
    best = Math.max(best, Math.hypot(p.x - sx, p.y - sy));
  }
  return { best, reach: navOk(G, sx, sy), surf: G.surfaceAt(sx, sy), cops: G.cops.filter((c) => Math.hypot(c.x - sx, c.y - sy) < 700).length };
}

// Deterministic regression entry points; the shipped game still starts through boot().
export const testing = {
  tick, render, tickPlayer, tickDrive, tickVehicles, tickMission, tickRace, startRace,
  startNew, startFreeRide, tickCollisions, tickPeds, moveFoot, separateCharacters, beginMission, advanceObjective, completeMission, startPlayFromBrief, openVN,
  clearRecoveryState, endLife, busted, wasted, tickPlay, drawAirborne,
  snapshot, restoreState, loadSave, save, retryObjective, currentObjectivePos,
  findSafe, footClear, clearAt, carHit, nearbyInteraction, ensureMissionCar, ensureGetawayBoat, updateGPS, worldToScreen,
  tickWanted, tickCops, crime, damageVeh, explode, makeFoot, makeVeh, enterVeh, exitVeh, shoot, tickBullets, fit, drawHUD,
  drawMap, drawSettings, drawPause, ensureStoryAssets, applyQuality,
};
