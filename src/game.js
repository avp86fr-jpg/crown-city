import { createAudio } from "./audio.js";
import { CHAR, MISSIONS, VN, missionFlow } from "./story.js";

const SAVE_KEY = "mw_crown_city_v1";
const WORLD = 4096;
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
  if (sprite === "chaos") return 52 / 208;
  if (sprite === "hunter" || sprite === "fire") return 56 / 110;
  return 58 / 110;
}

const SURFACE = { 0: "road", 1: "walk", 2: "build", 3: "water", 4: "sand", 5: "grass", 6: "track", 7: "pier", 8: "canal" };
const GRIP = { road: 1, walk: 0.7, build: 0.2, water: 0.15, sand: 0.45, grass: 0.55, track: 1.05, pier: 0.75, canal: 0.15 };
const FOOT_OK = new Set(["road", "walk", "sand", "grass", "track", "pier"]);

function loadImg(src) {
  const im = new Image();
  im.decoding = "async";
  im.src = src;
  return im.decode().then(() => im);
}

export async function boot() {
  const canvas = document.getElementById("c");
  const wrap = document.getElementById("wrap");
  const ctx = canvas.getContext("2d", { alpha: false });
  const audio = createAudio();
  const input = createInput();

  drawBoot(ctx, canvas, 0.05, "Loading Crown City…");

  const [albedo, neon, windows, puddles, specular, minimap, maskImg, title, starOn, starOff, chipIcon, meta, water0, water1, water2, water3, neonGround, roofs, hero] = await Promise.all([
    loadImg("assets/city/albedo.jpg"),
    loadImg("assets/city/neon.png"),
    loadImg("assets/city/windows.png"),
    loadImg("assets/city/puddles.png"),
    loadImg("assets/city/specular.png"),
    loadImg("assets/city/minimap.png"),
    loadImg("assets/city/mask_gray.png"),
    loadImg("assets/ui/title.jpg"),
    loadImg("assets/ui/star_on.png"),
    loadImg("assets/ui/star_off.png"),
    loadImg("assets/ui/chip.png"),
    fetch("assets/city/meta.json").then((r) => r.json()),
    loadImg("assets/city/water_0.webp"),
    loadImg("assets/city/water_1.webp"),
    loadImg("assets/city/water_2.webp"),
    loadImg("assets/city/water_3.webp"),
    loadImg("assets/city/neon_ground.png"),
    loadImg("assets/city/roofs.webp"),
    loadImg("assets/painted/chaos_hero_cut.png"),
  ]);

  const sprites = {};
  const vehNames = ["nyx", "riot", "dart", "fare", "metro", "stitch", "hog", "wake", "gulf", "taxi", "ambulance", "bus", "fare_wreck", "metro_wreck"];
  const charNames = ["chaos", "hunter", "fire", "cop", "m1", "m2", "m3", "m4", "valet", "cabbie", "worker", "guest", "synth", "prime"];
  const propNames = ["hydrant", "bin", "cone", "newsstand", "planter", "mailbox", "palm"];
  const vnNames = ["strip_night", "garage", "loft", "marina", "palace", "desert", "news", "rooftop"];
  await Promise.all([
    ...vehNames.map((n) => loadImg(`assets/sprites/veh_${n}.png`).then((i) => (sprites["veh_" + n] = i))),
    ...charNames.map((n) => loadImg(`assets/sprites/char_${n}.png`).then((i) => (sprites["char_" + n] = i))),
    ...propNames.map((n) => loadImg(`assets/sprites/prop_${n}.png`).then((i) => (sprites["prop_" + n] = i))),
    ...vnNames.map((n) => loadImg(`assets/vn/${n}.jpg`).then((i) => (sprites["vn_" + n] = i))),
    ...Object.entries(CHAR).map(([id, c]) => loadImg(c.portrait).then((i) => (sprites["port_" + id] = i))),
    loadImg("assets/vera/vera_point.png").then((i) => (sprites["port_vera_point"] = i)),
    loadImg("assets/vera/vera_cross.png").then((i) => (sprites["port_vera_cross"] = i)),
    loadImg("assets/fx/cone_head.png").then((i) => (sprites.cone_head = i)),
    loadImg("assets/fx/cone_tail.png").then((i) => (sprites.cone_tail = i)),
    loadImg("assets/fx/glow_street.png").then((i) => (sprites.glow_street = i)),
    loadImg("assets/fx/glow_lamp.png").then((i) => (sprites.glow_lamp = i)),
    loadImg("assets/fx/explosion.png").then((i) => (sprites.explosion = i)),
    loadImg("assets/fx/smoke.png").then((i) => (sprites.smoke = i)),
    loadImg("assets/fx/spark.png").then((i) => (sprites.spark = i)),
  ]);

  // Collision mask → 2048 grayscale for queries
  const MS = 2048;
  const mcv = document.createElement("canvas");
  mcv.width = mcv.height = MS;
  const mctx = mcv.getContext("2d", { willReadFrequently: true });
  mctx.drawImage(maskImg, 0, 0, MS, MS);
  const mdata = mctx.getImageData(0, 0, MS, MS).data;
  const mscale = MS / WORLD;
  const codeAt = (x, y) => {
    const ix = clamp(x * mscale | 0, 0, MS - 1);
    const iy = clamp(y * mscale | 0, 0, MS - 1);
    return mdata[(iy * MS + ix) * 4];
  };
  const surfaceAt = (x, y) => SURFACE[codeAt(x, y)] || "sand";
  const solidAt = (x, y) => surfaceAt(x, y) === "build";

  const assets = { albedo, neon, neonGround, windows, puddles, specular, minimap, title, starOn, starOff, chipIcon, sprites, meta, water: [water0, water1, water2, water3], roofs, hero };

  const G = {
    canvas, ctx, wrap, audio, input, assets, codeAt, surfaceAt, solidAt, meta,
    scene: "title", // title | vn | play | pause | settings | end
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
    wet: 0,
    fog: 0,
    sand: 0,
    rainAmt: 0,
    lightning: 0,
    lightningT: 8,
    cam: { x: 920, y: 3220, rot: 0, scale: 1.05, northUp: true, shake: 0 },
    titleT: 0,
    player: null,
    vehicles: [],
    peds: [],
    cops: [],
    bullets: [],
    particles: [],
    skids: [],
    props: [],
    van: null,
    race: null,
    vn: null,
    hint: "",
    toast: "",
    toastT: 0,
    radioName: "",
    radioT: 0,
    banner: null,
    jack: null,
    pickups: [],
    floaters: [],
    pausedFrom: "play",
    settingsSel: 0,
    titleSel: 0,
    fade: 1,
    ended: false,
    needsBegin: false,
    ticks: 0,
    dtStat: 0,
    saveExists: !!localStorage.getItem(SAVE_KEY),
    lastShot: 0,
    health: 100,
  };

  setupTouch(G);
  bindKeys(G);
  hookFullscreen(G);
  spawnWorld(G);
  G.player = makeFoot(G, meta.spawns.player[0], meta.spawns.player[1], 0);
  seedPickups(G);

  window.__CC = api(G);
  window.addEventListener("pointerdown", () => G.audio.unlock(), { once: true });

  let acc = 0, last = now();
  const STEP = 1 / 60;
  function frame() {
    const t = now();
    let dt = Math.min(0.05, t - last);
    last = t;
    acc += dt;
    G.dtStat = dt;
    while (acc >= STEP) {
      tick(G, STEP);
      acc -= STEP;
    }
    render(G);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  return G;
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
    r: def.r, torn: false, ...extra,
  };
}

function spawnWorld(G) {
  const meta = G.meta;
  G.props = meta.props.map((p) => ({ ...p, broken: false, vx: 0, vy: 0, spin: 0 }));
  G.vehicles = [];
  // Garage hero cars
  const g = meta.spawns.garage;
  G.vehicles.push(makeVeh("riot", g[0] + 40, g[1] + 30, 0));
  G.vehicles.push(makeVeh("fare", g[0] - 50, g[1] + 40, 0.1));
  G.vehicles.push(makeVeh("hog", g[0] + 90, g[1] - 10, 0.2));
  // PD
  const pd = meta.spawns.pd;
  G.vehicles.push(makeVeh("metro", pd[0] - 40, pd[1], 0, { cop: true }));
  G.vehicles.push(makeVeh("metro", pd[0] + 40, pd[1], 0, { cop: true }));
  const blocked = new Set(["road", "track", "water", "canal", "build"]);
  let parkedN = 0;
  for (const pk of meta.parking) {
    if (parkedN >= 42) break;
    if (blocked.has(G.surfaceAt(pk.x, pk.y))) continue;
    // keep the Strip carriageways and adjacent sidewalk clear
    const stripX = (meta.layout && meta.layout.stripX) || 1964;
    if (Math.abs(pk.x - stripX) < 360) continue;
    const kinds = ["fare", "dart", "riot", "fare"];
    G.vehicles.push(makeVeh(kinds[G.vehicles.length % kinds.length], pk.x, pk.y, pk.rot || 0));
    parkedN++;
  }
  // Marina boats
  for (const s of meta.slips.slice(0, 8)) {
    G.vehicles.push(makeVeh(Math.random() < 0.5 ? "wake" : "gulf", s.x, s.y, s.rot || 0));
  }
  // Unlockables parked mid-game still exist but may be locked to enter
  const palace = meta.spawns.casino || [2560, 2090];
  G.vehicles.push(makeVeh("nyx", palace[0] - 40, palace[1] - 200, Math.PI, { lockedUntil: "nyx" }));
  G.vehicles.push(makeVeh("dart", 2480, 1680, 0, { lockedUntil: "dart" }));
  G.vehicles.push(makeVeh("stitch", 2520, 1680, 0.2, { lockedUntil: "stitch" }));

  // Traffic — busy Strip, light arterials/highway, no side-street spam
  const roads = meta.roads.filter((r) => r.k === "strip" || r.k === "arterial" || r.k === "highway" || r.k === "coast");
  const kinds = ["fare", "dart", "riot", "fare", "metro", "dart"];
  for (let i = 0; i < 48; i++) {
        const stripRoad = roads.find((r) => r.k === "strip") || roads[0];
    const otherRoads = roads.filter((r) => r.k !== "strip");
    const rd = (i < 32 || !otherRoads.length) ? stripRoad : otherRoads[i % otherRoads.length];
    const t = (i / 48 + (i % 5) * 0.13) % 1;
    const lane = trafficLane(rd, i);
    const pos = lanePos(rd, t, lane);
    const rot = pathRot(rd, 1);
    if (Math.hypot(pos.x - g[0], pos.y - g[1]) < 280) continue;
    const layout = G.meta.layout || {};
    const stripX = layout.stripX || 1964;
    const heroX = (layout.northbound && layout.northbound[1]) || 2108;
    // leave the player's mid-northbound lane empty
    if (rd.k === "strip" && Math.abs(pos.x - heroX) < 40) continue;
    const surf = G.surfaceAt(pos.x, pos.y);
    if (surf !== "road" && surf !== "track") continue;
    let dir = i % 2 === 0 ? 1 : -1;
    if (rd.k === "strip") {
      const pathSouth = rd.b[1] > rd.a[1];
      dir = (pos.x < stripX) === pathSouth ? 1 : -1;
    }
    const v = makeVeh(kinds[i % kinds.length], pos.x, pos.y, dir < 0 ? rot + Math.PI : rot, {
      parked: false, traffic: true, path: rd, pt: t, dir, lane, spd: 48 + (i % 5) * 10,
    });
    G.vehicles.push(v);
  }
  // denser opposite-lane traffic on the Strip west carriageway
  const strip = roads.find((r) => r.k === "strip") || roads[0];
  const Lall = G.meta.layout || {};
  const stripX = Lall.stripX || 1964;
  const pathSouth = strip.b[1] > strip.a[1];
  const stripLanes = []
    .concat((Lall.southbound || [1892, 1820, 1748]).map((x) => x - stripX))
    .concat((Lall.northbound || [2036, 2108, 2180]).filter((x, i) => i !== 1).map((x) => x - stripX));
  for (let i = 0; i < 28; i++) {
    const lane = stripLanes[i % stripLanes.length];
    const t = (0.03 + Math.floor(i / stripLanes.length) * 0.16 + (i % stripLanes.length) * 0.03) % 1;
    const pos = lanePos(strip, t, lane);
    if (G.surfaceAt(pos.x, pos.y) !== "road") continue;
    if (G.vehicles.some((o) => o.traffic && Math.hypot(o.x - pos.x, o.y - pos.y) < 90)) continue;
    const dir = (pos.x < stripX) === pathSouth ? 1 : -1;
    const rot = pathRot(strip, dir);
    const v = makeVeh(kinds[i % kinds.length], pos.x, pos.y, rot, {
      parked: false, traffic: true, path: strip, pt: t, dir, lane, spd: 52 + (i % 4) * 8,
    });
    G.vehicles.push(v);
  }
  // Peds — clustered, mixed outfits, no clone parades
  G.peds = [];
  const civic = ["m1", "m2", "m3", "m4", "worker", "cabbie", "prime", "valet"];
  const rare = ["synth"];
  let guestCount = 0;
  const pickSprite = (avoid) => {
    const near = new Set(avoid || []);
    let pool = civic.filter((t) => !near.has(t));
    if (!pool.length) pool = civic.slice();
    let spr = pool[(Math.random() * pool.length) | 0];
    if (guestCount < 4 && Math.random() < 0.03) spr = "guest";
    else if (Math.random() < 0.04) spr = rare[0];
    if (spr === "guest") guestCount++;
    return spr;
  };
  const pushPed = (x, y, rot, sprite, speed) => {
    const nearTypes = G.peds
      .filter((q) => Math.hypot(q.x - x, q.y - y) < 42)
      .map((q) => q.sprite);
    const spr = sprite || pickSprite(nearTypes);
    G.peds.push({
      x, y, rot: rot ?? Math.random() * TAU, vx: 0, vy: 0,
      sprite: spr,
      speed: speed ?? (20 + Math.random() * 28), dist: Math.random() * 20, flee: 0, r: 8, hp: 30, dead: false,
    });
  };
  for (const p of (meta.peds || []).slice(0, 40)) {
    const nearTypes = G.peds.filter((q) => Math.hypot(q.x - p.x, q.y - p.y) < 42).map((q) => q.sprite);
    pushPed(p.x, p.y, undefined, pickSprite(nearTypes));
  }
  const headingOf = (rd) => {
    const dx = rd.b[0] - rd.a[0], dy = rd.b[1] - rd.a[1];
    return Math.atan2(dx, -dy);
  };
  for (const rd of (meta.roads || [])) {
    if (!rd || !rd.a || !rd.b) continue;
    if (rd.k !== "strip" && rd.k !== "arterial" && rd.k !== "street") continue;
    const dx = rd.b[0] - rd.a[0], dy = rd.b[1] - rd.a[1];
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len;
    const w = rd.w || 112;
    const along = headingOf(rd);
    for (const side of [-1, 1]) {
      const ox = nx * side * (w / 2 + 22);
      const oy = ny * side * (w / 2 + 22);
      let s = 70 + Math.random() * 140;
      while (s < len - 70) {
        if (G.peds.length > 240) break;
        const n = Math.random() < 0.5 ? 2 : (Math.random() < 0.55 ? 1 : 3);
        const baseHead = (Math.random() < 0.5 ? along : along + Math.PI) + (Math.random() - 0.5) * 0.5;
        let last = null;
        for (let i = 0; i < n; i++) {
          const d = i * (10 + Math.random() * 8);
          const lat = (Math.random() - 0.5) * 12;
          const x = rd.a[0] + dx * (s + d) / len + ox + nx * lat;
          const y = rd.a[1] + dy * (s + d) / len + oy + ny * lat;
          if (G.surfaceAt(x, y) !== "walk") continue;
          const rot = baseHead + (Math.random() - 0.5) * 0.35 + (Math.random() < 0.12 ? Math.PI * 0.5 * (Math.random() < 0.5 ? 1 : -1) : 0);
          const spd = 18 + Math.random() * 30;
          const spr = pickSprite(last ? [last] : []);
          pushPed(x, y, rot, spr, spd);
          last = spr;
        }
        s += 40 + n * 16 + 40 + Math.random() * 170;
      }
    }
  }
  // valets and door crowds at casino gathers — mixed, not a matching line
  for (const g of (meta.gathers || [])) {
    const n = 2 + ((Math.random() * 2) | 0);
    let last = null;
    for (let i = 0; i < n; i++) {
      const ox = (i - (n - 1) / 2) * (16 + Math.random() * 8) + (Math.random() - 0.5) * 8;
      const oy = (Math.random() - 0.5) * 16;
      const spr = i === 0 && Math.random() < 0.7 ? "valet" : pickSprite(last ? [last, "valet"] : ["valet"]);
      pushPed(g.x + ox, g.y + oy, Math.PI + (Math.random() - 0.5) * 0.8, spr, 8 + Math.random() * 10);
      G.peds[G.peds.length - 1].gather = g;
      last = spr;
    }
  }
  // taxis, a bus, a patrol cop
  const routes = (meta.roads || []).filter((r) => r.k === "strip" || r.k === "arterial" || r.k === "coast");
  if (routes.length) {
    const taxiRoad = routes.find((r) => r.k === "strip") || routes[0];
    for (let i = 0; i < 3; i++) {
      const rd = taxiRoad;
      const t0 = 0.12 + i * 0.13;
      const pos = lanePos(rd, t0, trafficLane(rd, i));
      if (G.surfaceAt(pos.x, pos.y) === "road") {
        G.vehicles.push(makeVeh("taxi", pos.x, pos.y, pathRot(rd, 1), {
          parked: false, traffic: true, path: rd, pt: t0, dir: 1, lane: trafficLane(rd, i),
          spd: 48, taxi: true, role: "taxi",
        }));
      }
    }
    const br = routes.find((r) => r.k === "arterial") || routes[0];
    const bp = lanePos(br, 0.2, trafficLane(br, 0));
    G.vehicles.push(makeVeh("bus", bp.x, bp.y, pathRot(br, 1), {
      parked: false, traffic: true, path: br, pt: 0.2, dir: 1, lane: trafficLane(br, 0),
      spd: 38, role: "bus",
    }));
    const pr = routes[Math.min(1, routes.length - 1)];
    const pp = lanePos(pr, 0.4, trafficLane(pr, 2));
    const patrol = makeVeh("metro", pp.x, pp.y, pathRot(pr, 1), {
      parked: false, traffic: true, path: pr, pt: 0.4, dir: 1, lane: trafficLane(pr, 2),
      spd: 50, cop: true, role: "patrol",
    });
    G.vehicles.push(patrol);
  }
  // harbour boats actually cruise
  for (const v of G.vehicles) {
    if (v.def && v.def.boat) {
      v.parked = false;
      v.role = "boat";
      v.cruise = Math.random() * TAU;
    }
  }
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
    x: 0, y: 0, enter: false, enterP: false, brake: false, fire: false, fireP: false,
    pauseP: false, fsP: false, skipP: false, confirmP: false, backP: false,
    radioP: false, upP: false, downP: false, sprint: false,
    mouse: { x: 0, y: 0, down: false },
    touchJoy: { x: 0, y: 0, active: false },
  };
}

function bindKeys(G) {
  const down = new Set();
  const I = G.input;
  const on = (e, d) => {
    const k = e.code;
    if (d) down.add(k); else down.delete(k);
    if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(k)) e.preventDefault();
    if (d && k === "KeyE") I.enterP = true;
    if (d && (k === "KeyK" || k === "KeyJ" || k === "ControlLeft")) I.fireP = true;
    if (d && (k === "Escape" || k === "KeyP")) I.pauseP = true;
    if (d && k === "KeyF") I.fsP = true;
    if (d && (k === "Enter" || k === "Space")) { I.skipP = true; I.confirmP = true; }
    if (d && k === "KeyR") I.radioP = true;
    if (d && (k === "ArrowUp" || k === "KeyW")) I.upP = true;
    if (d && (k === "ArrowDown" || k === "KeyS")) I.downP = true;
  };
  window.addEventListener("keydown", (e) => on(e, true));
  window.addEventListener("keyup", (e) => on(e, false));
  const pulse = () => {
    I.sprint = down.has("ShiftLeft") || down.has("ShiftRight");
    I.brake = down.has("Space");
    I.fire = down.has("KeyK") || down.has("KeyJ") || down.has("ControlLeft") || I.mouse.down;
    let x = 0, y = 0;
    if (down.has("KeyA") || down.has("ArrowLeft")) x -= 1;
    if (down.has("KeyD") || down.has("ArrowRight")) x += 1;
    if (down.has("KeyW") || down.has("ArrowUp")) y += 1;
    if (down.has("KeyS") || down.has("ArrowDown")) y -= 1;
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
  c.addEventListener("pointerdown", (e) => { set(e); G.input.mouse.down = true; G.audio.unlock(); });
  window.addEventListener("pointerup", () => { G.input.mouse.down = false; });
}

function setupTouch(G) {
  const touch = document.getElementById("touch");
  const coarse = window.matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0;
  const startTouch = () => { if (coarse) touch.classList.remove("hidden"); };
  window.addEventListener("touchstart", startTouch, { once: true, passive: true });
  if (coarse) touch.classList.remove("hidden");
  const joy = document.getElementById("joy");
  const knob = document.getElementById("knob");
  const stick = (e, end) => {
    e.preventDefault();
    if (end) {
      G.input.touchJoy = { x: 0, y: 0, active: false };
      knob.style.left = "38px"; knob.style.top = "38px";
      return;
    }
    const r = joy.getBoundingClientRect();
    const t = e.changedTouches ? e.changedTouches[0] : e;
    let x = (t.clientX - r.left - r.width / 2) / (r.width / 2);
    let y = -((t.clientY - r.top - r.height / 2) / (r.height / 2));
    const m = Math.hypot(x, y) || 1;
    if (m > 1) { x /= m; y /= m; }
    G.input.touchJoy = { x, y, active: true };
    knob.style.left = 38 + x * 36 + "px";
    knob.style.top = 38 - y * 36 + "px";
  };
  ["pointerdown", "pointermove"].forEach((ev) => joy.addEventListener(ev, (e) => stick(e, false)));
  ["pointerup", "pointercancel", "pointerleave"].forEach((ev) => joy.addEventListener(ev, (e) => stick(e, true)));
  const hold = (id, fn) => {
    const el = document.getElementById(id);
    el.addEventListener("pointerdown", (e) => { e.preventDefault(); fn(true); });
    ["pointerup", "pointercancel", "pointerleave"].forEach((ev) => el.addEventListener(ev, () => fn(false)));
  };
  hold("tEnter", (d) => { if (d) G.input.enterP = true; });
  hold("tBrake", (d) => { G.input.brake = d; if (d) G.input.sprint = true; });
  hold("tFire", (d) => { G.input.fire = d; if (d) G.input.fireP = true; });
  hold("tPause", (d) => { if (d) G.input.pauseP = true; });
  hold("tFs", (d) => { if (d) G.input.fsP = true; });
}

function hookFullscreen(G) {
  G.toggleFS = async () => {
    const el = G.wrap;
    try {
      if (!document.fullscreenElement) {
        if (el.requestFullscreen) await el.requestFullscreen();
        else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
        else {
          el.classList.add("fake-fs");
        }
        if (screen.orientation && screen.orientation.lock) {
          try { await screen.orientation.lock("landscape"); } catch {}
        }
      } else {
        await document.exitFullscreen();
        el.classList.remove("fake-fs");
      }
    } catch {
      el.classList.toggle("fake-fs");
    }
    fit(G);
  };
  window.addEventListener("resize", () => fit(G));
  fit(G);
}

function fit(G) {
  const c = G.canvas;
  const w = G.wrap.clientWidth || window.innerWidth;
  const h = G.wrap.clientHeight || window.innerHeight;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  c.width = Math.max(640, Math.round(w * dpr));
  c.height = Math.max(360, Math.round(h * dpr));
}

/* -------------------- Save -------------------- */
function snapshot(G) {
  return {
    v: 1,
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
    health: G.health,
  };
}
function save(G) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(snapshot(G))); G.saveExists = true; toast(G, "Saved."); } catch {}
}
function loadSave(G) {
  let d;
  try { d = JSON.parse(localStorage.getItem(SAVE_KEY) || "null"); } catch { d = null; }
  if (!d) return false;
  G.flags = { ...G.flags, ...d.flags };
  G.missionIndex = d.missionIndex || 0;
  G.objectiveIndex = d.objectiveIndex || 0;
  G.unlocked = d.unlocked || G.unlocked;
  G.chips = d.chips ?? G.chips;
  G.wanted = d.wanted || 0;
  G.time = d.time ?? G.time;
  G.weather = d.weather || "clear";
  G.health = d.health ?? 100;
  if (d.ptype === "veh" && d.vehKind) {
    const v = nearestVeh(G, d.px, d.py, 80, d.vehKind) || spawnPlayerCar(G, d.vehKind, d.px, d.py, d.prot);
    enterVeh(G, v, true);
  } else {
    G.player = makeFoot(G, d.px, d.py, d.prot || 0);
  }
  G._flow = missionFlow(MISSIONS[G.missionIndex] ? MISSIONS[G.missionIndex].id : "cold_wallet", G.flags);
  if (G._flow && G._flow.onStart && G._flow.onStart.spawnVan) spawnVan(G);
  setHint(G);
  return true;
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
  if (G.input.fsP) { G.toggleFS(); G.input.fsP = false; }
  if (G.scene === "title") return tickTitle(G, dt);
  if (G.scene === "settings") return tickSettings(G, dt);
  if (G.scene === "vn") return tickVN(G, dt);
  if (G.scene === "end") return tickEnd(G, dt);
  if (G.scene === "pause") return tickPause(G, dt);
  tickPlay(G, dt);
  G.input.enterP = G.input.fireP = G.input.pauseP = G.input.skipP = G.input.confirmP = G.input.radioP = G.input.upP = G.input.downP = false;
}

function tickTitle(G, dt) {
  G.fade = Math.max(0, G.fade - dt * 0.8);
  G.titleT = (G.titleT || 0) + dt;
  const L = G.meta.layout || {};
  const lane = (L.northbound && L.northbound[1]) || 2108;
  G.cam.x = lane;
  G.cam.y = 1100 + ((G.titleT * 36) % 2200);
  G.cam.rot = 0;
  G.cam.scale = 0.70;
  G.cam.northUp = true;
  G.time = 19.55;
  G.weather = "clear";
  tickVehicles(G, dt);
  tickPeds(G, dt);
  tickLife(G, dt);
  G.ticks++;
  const items = G.saveExists ? ["NEW GAME", "CONTINUE", "SETTINGS", "FULL SCREEN"] : ["NEW GAME", "SETTINGS", "FULL SCREEN"];
  if (G.input.upP) G.titleSel = (G.titleSel + items.length - 1) % items.length;
  if (G.input.downP) G.titleSel = (G.titleSel + 1) % items.length;
  // mouse hover
  const hit = titleHit(G);
  if (hit >= 0) G.titleSel = hit;
  if (G.input.confirmP || (G.input.mouse.down && hit >= 0)) {
    const it = items[G.titleSel];
    G.audio.click();
    if (it === "NEW GAME") startNew(G);
    else if (it === "CONTINUE") { if (loadSave(G)) { G.scene = "play"; toast(G, "Welcome back to Crown City."); } }
    else if (it === "SETTINGS") { G.pausedFrom = "title"; G.scene = "settings"; }
    else if (it === "FULL SCREEN") G.toggleFS();
    G.input.mouse.down = false;
  }
  G.input.confirmP = G.input.upP = G.input.downP = G.input.pauseP = false;
}

function startNew(G) {
  G.flags = { stash: "safe", heist: "quiet", scrambler: false };
  G.missionIndex = 0;
  G.objectiveIndex = 0;
  G.unlocked = ["riot", "fare", "hog", "wake", "gulf"];
  G.chips = 400;
  G.wanted = 0;
  G.time = 19.4;
  G.weather = "clear";
  G.health = 100;
  G.ended = false;
  spawnWorld(G);
  const s = G.meta.spawns.player;
  G.player = makeFoot(G, s[0], s[1], 0);
  G.needsBegin = true;
  G.weatherT = 90;
  openVN(G, "intro_news");
}

function titleHit(G) {
  const items = G.saveExists ? ["NEW GAME", "CONTINUE", "SETTINGS", "FULL SCREEN"] : ["NEW GAME", "SETTINGS", "FULL SCREEN"];
  const c = G.canvas, mx = G.input.mouse.x, my = G.input.mouse.y;
  const scale = c.height / 1080;
  const x0 = 80 * (c.width / 1920);
  let y = 520 * scale;
  for (let i = 0; i < items.length; i++) {
    if (mx > x0 && mx < x0 + 460 * scale && my > y && my < y + 52 * scale) return i;
    y += 58 * scale;
  }
  return -1;
}

function tickSettings(G) {
  if (G.input.pauseP || G.input.skipP && false) {}
  if (G.input.upP) G.settingsSel = (G.settingsSel + 5) % 6;
  if (G.input.downP) G.settingsSel = (G.settingsSel + 1) % 6;
  const rows = ["sfx", "mus", "north", "radio", "fs", "back"];
  const r = rows[G.settingsSel];
  if (G.input.x < -0.5 && r === "sfx") G.audio.setSfx(clamp(G.audio.sfxVol - 0.02, 0, 1));
  if (G.input.x > 0.5 && r === "sfx") G.audio.setSfx(clamp(G.audio.sfxVol + 0.02, 0, 1));
  if (G.input.x < -0.5 && r === "mus") G.audio.setMus(clamp(G.audio.musVol - 0.02, 0, 1));
  if (G.input.x > 0.5 && r === "mus") G.audio.setMus(clamp(G.audio.musVol + 0.02, 0, 1));
  if (G.input.confirmP) {
    if (r === "north") G.cam.northUp = !G.cam.northUp;
    if (r === "radio") toast(G, G.audio.nextStation());
    if (r === "fs") G.toggleFS();
    if (r === "back") G.scene = G.pausedFrom || "title";
  }
  if (G.input.pauseP) G.scene = G.pausedFrom || "title";
  G.input.confirmP = G.input.pauseP = G.input.upP = G.input.downP = false;
}

function tickPause(G) {
  if (G.input.pauseP) { G.scene = "play"; G.input.pauseP = false; return; }
  if (G.input.upP) G.settingsSel = (G.settingsSel + 3) % 4;
  if (G.input.downP) G.settingsSel = (G.settingsSel + 1) % 4;
  if (G.input.confirmP) {
    const i = G.settingsSel;
    if (i === 0) G.scene = "play";
    if (i === 1) { G.pausedFrom = "pause"; G.scene = "settings"; }
    if (i === 2) { save(G); }
    if (i === 3) G.scene = "title";
  }
  G.input.confirmP = G.input.upP = G.input.downP = G.input.pauseP = false;
}

function tickEnd(G) {
  if (G.input.confirmP || G.input.pauseP) { G.scene = "title"; G.saveExists = true; }
  G.input.confirmP = G.input.pauseP = false;
}

function openVN(G, page) {
  const p = typeof page === "function" ? page() : page;
  if (p === "play") {
    G.scene = "play";
    if (G.needsBegin) { G.needsBegin = false; beginMission(G, G.missionIndex); }
    return;
  }
  if (p === "end") { G.scene = "end"; G.ended = true; save(G); return; }
  const node = VN[p];
  if (!node) { G.scene = "play"; return; }
  G.vn = { id: p, node, t: 0, sel: 0, char: 0, wipe: 0.32, typed: 0 };
  G.scene = "vn";
}

function tickVN(G, dt) {
  G.vn.t += dt;
  if (G.vn.wipe > 0) G.vn.wipe = Math.max(0, G.vn.wipe - dt);
  const n = G.vn.node;
  const text = n.text || "";
  const total = text.length;
  if (G.vn.char < total) {
    const before = G.vn.char | 0;
    G.vn.char = Math.min(total, G.vn.char + dt * 52);
    const after = G.vn.char | 0;
    if (after > before && after - (G.vn.typed || 0) >= 2 && text[after - 1] !== " ") {
      G.audio.type();
      G.vn.typed = after;
    }
  }
  const typedOut = G.vn.char >= total;
  const choices = n.choices || [];
  if (choices.length && typedOut) {
    if (G.input.upP) G.vn.sel = (G.vn.sel + choices.length - 1) % choices.length;
    if (G.input.downP) G.vn.sel = (G.vn.sel + 1) % choices.length;
  }
  // click choices
  if (G.input.mouse.down && choices.length && typedOut) {
    const hit = vnChoiceHit(G);
    if (hit >= 0) G.vn.sel = hit;
  }
  if (G.input.confirmP || G.input.skipP || (G.input.mouse.down && G.vn.t > 0.25)) {
    if (!typedOut && !G.input.skipP) {
      G.vn.char = total;
      G.input.mouse.down = false;
    } else {
      if (choices.length) {
        const ch = choices[G.vn.sel];
        if (ch.set) Object.assign(G.flags, ch.set);
        G.audio.ui();
        openVN(G, ch.next);
      } else {
        G.audio.ui();
        openVN(G, n.next);
      }
      G.input.mouse.down = false;
    }
  }
  G.input.confirmP = G.input.skipP = G.input.upP = G.input.downP = false;
}

function vnChoiceHit(G) {
  const n = G.vn.node;
  const ch = n.choices || [];
  const c = G.canvas;
  const boxY = c.height * 0.76;
  const mx = G.input.mouse.x, my = G.input.mouse.y;
  for (let i = 0; i < ch.length; i++) {
    const y = boxY + 8 + i * 36;
    if (my > y && my < y + 32 && mx > c.width * 0.08 && mx < c.width * 0.92) return i;
  }
  return -1;
}

function beginMission(G, idx) {
  G.missionIndex = idx;
  G.objectiveIndex = 0;
  const flow = missionFlow(MISSIONS[idx].id, G.flags);
  G._flow = flow;
  if (flow && flow.onStart) applyEffects(G, flow.onStart);
  if (flow && flow.onStart && flow.onStart.spawnVan) spawnVan(G);
  setHint(G);
  toast(G, MISSIONS[idx].title);
}

function setHint(G) {
  const flow = G._flow || missionFlow(MISSIONS[G.missionIndex].id, G.flags);
  G._flow = flow;
  const obj = flow && flow.objectives[G.objectiveIndex];
  G.hint = obj ? obj.hint : (G.missionIndex >= MISSIONS.length ? "Crown City is yours." : "");
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
  const s = G.meta.spawns.van;
  const v = makeVeh("van", s[0] - 40, 960, 0, { parked: false, isVan: true, traffic: false });
  v.vy = 40;
  G.van = v;
  G.vehicles.push(v);
}

function objectivePos(G, obj) {
  if (!obj || !obj.at) return null;
  if (obj.at === "van" && G.van) return { x: G.van.x, y: G.van.y };
  const s = G.meta.spawns[obj.at];
  if (s) return { x: s[0], y: s[1] };
  return null;
}

function advanceObjective(G) {
  const flow = G._flow;
  const obj = flow.objectives[G.objectiveIndex];
  if (obj.id === "grab" && flow.onGrab) applyEffects(G, flow.onGrab);
  if (obj.id === "pay" && flow.onPay) applyEffects(G, flow.onPay);
  if (obj.id === "vault" && flow.onVault) applyEffects(G, flow.onVault);
  if (flow.midVN && flow.midVN.after === obj.id) {
    G.objectiveIndex++;
    setHint(G);
    openVN(G, flow.midVN.page);
    return;
  }
  G.objectiveIndex++;
  G.audio.pickup();
  if (G.objectiveIndex >= flow.objectives.length) {
    completeMission(G, true);
  } else {
    setHint(G);
    toast(G, "Objective clear.");
    save(G);
  }
}

function completeMission(G, won) {
  const flow = G._flow;
  if (!won && flow.loseVN) { openVN(G, flow.loseVN); return; }
  if (won && flow.onWin) applyEffects(G, flow.onWin);
  if (won) {
    const title = (MISSIONS[G.missionIndex] && MISSIONS[G.missionIndex].title) || "JOB";
    showBanner(G, "JOB DONE", title, "win");
  }
  G.missionIndex++;
  G.objectiveIndex = 0;
  G.race = null;
  G.needsBegin = true;
  save(G);
  if (G.missionIndex >= MISSIONS.length) {
    const page = typeof flow.winVN === "function" ? flow.winVN() : flow.winVN;
    openVN(G, page);
    return;
  }
  const next = missionFlow(MISSIONS[G.missionIndex].id, G.flags);
  const start = next && next.startVN;
  const win = typeof flow.winVN === "function" ? flow.winVN() : flow.winVN;
  // Show win VN, then that page's next is play which begins the new mission
  if (win) {
    // temporarily: after win VN, begin next mission
    const node = VN[win];
    if (node) {
      const orig = node.next;
      node.next = start || "play";
      openVN(G, win);
      // restore after opening — actually open uses the node live, keep next as start
      // We'll hook: if page next is a start VN of next mission, beginMission on play
    }
  } else if (start) openVN(G, start);
  else beginMission(G, G.missionIndex);
}

function tickPlay(G, dt) {
  if (G.cineLock) {
    G.ticks++;
    if (G.radioT > 0) G.radioT = Math.max(G.radioT, 1.1);
    tickParticles(G, 1 / 60);
    return;
  }
  if (G.input.pauseP) { G.scene = "pause"; G.settingsSel = 0; G.pausedFrom = "play"; return; }
  if (G.input.radioP && G.player.type === "veh") {
    G.radioName = G.audio.nextStation();
    G.radioT = 2.5;
  }
  G.ticks++;
  // clock: 6 minutes per day
  G.time = (G.time + dt * (24 / 360)) % 24;
  tickWeather(G, dt);
  tickPlayer(G, dt);
  tickVehicles(G, dt);
  tickJack(G, dt);
  tickPeds(G, dt);
  tickCops(G, dt);
  tickLife(G, dt);
  tickBullets(G, dt);
  tickProps(G, dt);
  tickParticles(G, dt);
  tickWanted(G, dt);
  tickPickups(G, dt);
  tickCamera(G, dt);
  tickMission(G, dt);
  if (G.toastT > 0) G.toastT -= dt;
  if (G.radioT > 0) G.radioT -= dt;
  if (G.banner) {
    G.banner.t -= dt;
    if (G.banner.t <= 0) G.banner = null;
  }
  const rpm = G.player.type === "veh" ? Math.min(1, Math.hypot(G.player.vx, G.player.vy) / (G.player.def.max || 200)) : 0;
  G.audio.setEngine(G.player.type === "veh", rpm, G.player.type === "veh");
  G.audio.setRain(G.rainAmt);
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
    for (let i = 0; i < 8; i++) {
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
      G.lightning = 1;
      G.cam.shake = Math.max(G.cam.shake, 10);
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
  G.cam.shake = Math.max(G.cam.shake || 0, amt);
}

function headingVec(rot) { return { x: Math.sin(rot), y: -Math.cos(rot) }; }
function rightVec(rot) { return { x: Math.cos(rot), y: Math.sin(rot) }; }

function tickPlayer(G, dt) {
  if (G.player.type === "veh") return tickDrive(G, G.player, G.input, dt, true);
  const p = G.player;
  const aim = Math.atan2(0, -1);
  // steer with input
  if (Math.hypot(G.input.x, G.input.y) > 0.15) {
    p.rot = Math.atan2(G.input.x, G.input.y);
  }
  const sp = (G.input.sprint ? 165 : 95);
  const wish = Math.min(1, Math.hypot(G.input.x, G.input.y));
  const h = headingVec(p.rot);
  let nx = p.x + h.x * sp * wish * dt;
  let ny = p.y + h.y * sp * wish * dt;
  const surf = G.surfaceAt(nx, ny);
  if (!FOOT_OK.has(surf) && surf !== "water") {
    if (FOOT_OK.has(G.surfaceAt(nx, p.y))) ny = p.y;
    else if (FOOT_OK.has(G.surfaceAt(p.x, ny))) nx = p.x;
    else { nx = p.x; ny = p.y; }
  }
  if (surf === "water" || surf === "canal") { nx = p.x; ny = p.y; }
  p.speed = Math.hypot(nx - p.x, ny - p.y) / dt;
  p.dist += p.speed * dt;
  p.x = nx; p.y = ny;
  if (p.exitT > 0) p.exitT -= dt * 2.2;
  if (G.input.enterP) tryEnter(G);
  if (G.input.fire && now() - G.lastShot > 0.22) shoot(G, p, true);
}

function tickDrive(G, v, input, dt, isPlayer) {
  const def = v.def;
  const surf = G.surfaceAt(v.x, v.y);
  if (!def.boat && (surf === "water" || surf === "canal")) {
    // splash and eject if player
    v.vx *= 0.3; v.vy *= 0.3;
    if (isPlayer && Math.hypot(v.vx, v.vy) < 20) { exitVeh(G); toast(G, "You bailed before it sank."); return; }
  }
  if (def.boat && surf !== "water" && surf !== "canal" && surf !== "pier") {
    v.vx *= 0.5; v.vy *= 0.5;
  }
  const h = headingVec(v.rot);
  const r = rightVec(v.rot);
  let fwd = v.vx * h.x + v.vy * h.y;
  let lat = v.vx * r.x + v.vy * r.y;
  const throttle = Math.max(0, input.y);
  const reverse = Math.max(0, -input.y);
  // hypercar launch: extra torque low in the rev range
  const launch = (def.sprite === "nyx" && isPlayer) ? 1 + 0.45 * Math.max(0, 1 - Math.abs(fwd) / 160) : 1;
  fwd += def.accel * launch * throttle * dt;
  fwd -= def.brake * 0.35 * reverse * dt;
  if (input.brake) fwd *= Math.max(0.2, 1 - 2.2 * dt);
  const isNyx = !!(isPlayer && def.sprite === "nyx");
  let grip = def.grip * (GRIP[surf] || 0.7) * (G.wet > 0.3 ? 0.72 : 1) * (G.sand > 0.4 && surf === "sand" ? 0.7 : 1) * (input.brake ? 0.4 : 1);
  const speed0 = Math.abs(fwd);
  const drifting = isNyx && speed0 > 70 && (Math.abs(input.x) > 0.5 || (input.brake && Math.abs(input.x) > 0.2));
  v.drifting = drifting;
  if (drifting) grip *= 0.38;
  if (isNyx && input.sprint && throttle > 0) {
    v.boost = 1;
    fwd += def.accel * 0.9 * dt;
  } else v.boost = 0;
  const speed = Math.abs(fwd);
  const steer = input.x * def.steer * (drifting ? 1.25 : 1) * Math.sign(fwd || 1) * Math.min(1, speed / 50);
  v.rot = v.rot + steer * (speed / 90) * dt * 2.4;
  v.lean = lerp(v.lean || 0, input.x * Math.min(1, speed / 140) * (def.bike ? 0.55 : 0.22), 8 * dt);
  v.turnSign = input.x;
  // slip
  v.braking = !!(input && input.brake);
  v.fwd = fwd;
  if (Math.abs(lat) > (drifting ? 22 : 40) && speed > (drifting ? 50 : 80)) {
    G.skids.push({ x: v.x, y: v.y, a: drifting ? 0.85 : 0.7, rot: v.rot });
    if (G.skids.length > 500) G.skids.splice(0, 80);
    if (isPlayer && Math.random() < 0.5) {
      const back = headingVec(v.rot);
      G.particles.push({ kind: "smoke", x: v.x - back.x * 16, y: v.y - back.y * 16, vx: -back.x * 20 + (Math.random()-0.5)*20, vy: -back.y * 20, life: 0.55, frame: 0 });
    }
  }
  if (isNyx && Math.abs(fwd) > 190 && (G.ticks % 1) === 0) {
    // rear light streaks at speed (pass 7)
    const bk = headingVec(v.rot), rt = rightVec(v.rot);
    for (const side of [-1, 1]) {
      G.particles.push({ kind: "trail", x: v.x - bk.x * 26 + rt.x * side * 9, y: v.y - bk.y * 26 + rt.y * side * 9,
        vx: 0, vy: 0, life: 0.22, a: Math.min(1, (Math.abs(fwd) - 190) / 120) });
    }
  }
  if (v.boost && isPlayer && Math.abs(fwd) > 200) addShake(G, 1.6);
  if (v.boost && isPlayer) {
    const back = headingVec(v.rot);
    if ((G.ticks % 2) === 0) {
      G.particles.push({
        kind: "boost", x: v.x - back.x * 18, y: v.y - back.y * 18,
        vx: -back.x * 80 + (Math.random() - 0.5) * 30, vy: -back.y * 80 + (Math.random() - 0.5) * 30,
        life: 0.28, a: 1, col: Math.random() < 0.5 ? "#ff4ad2" : "#29f0ff",
      });
    }
  }
  lat *= Math.exp(-grip * (drifting ? 3.2 : 7) * dt);
  fwd *= Math.exp(-0.35 * dt);
  fwd = clamp(fwd, -def.max * 0.4, def.max * (v.boost ? 1.22 : 1));
  const nh = headingVec(v.rot);
  const nr = rightVec(v.rot);
  v.vx = nh.x * fwd + nr.x * lat;
  v.vy = nh.y * fwd + nr.y * lat;
  let nx = v.x + v.vx * dt;
  let ny = v.y + v.vy * dt;
  if (solidAtSafe(G, nx, ny, v.r * 0.6)) {
    // slide
    if (!solidAtSafe(G, nx, v.y, v.r * 0.6)) ny = v.y, v.vy *= -0.2, v.vx *= 0.7;
    else if (!solidAtSafe(G, v.x, ny, v.r * 0.6)) nx = v.x, v.vx *= -0.2, v.vy *= 0.7;
    else { nx = v.x; ny = v.y; v.vx *= -0.3; v.vy *= -0.3; }
    if (Math.hypot(v.vx, v.vy) > 40) {
      G.audio.crash(); bumpWanted(G, 0); smashNear(G, nx, ny, 40, Math.hypot(v.vx, v.vy));
      addShake(G, Math.min(14, Math.hypot(v.vx, v.vy) / 18));
      G.particles.push({ kind: "flash", x: nx, y: ny, life: 0.1, a: 1 });
      for (let i = 0; i < 16; i++) G.particles.push({ kind: "spark", x: nx, y: ny, vx: (Math.random()-0.5)*320, vy: (Math.random()-0.5)*320, life: 0.18 + Math.random() * 0.2 });
      v.health = (v.health || 100) - Math.min(40, Math.hypot(v.vx, v.vy) / 8);
      if (v.health < 25 && !v.wrecked) { v.wrecked = true; if (v.health < 12) v.burning = true; callAmbulance(G, nx, ny); }
      scarePeds(G, nx, ny, 260);
    }
  }
  v.x = nx; v.y = ny;
  smashNear(G, v.x, v.y, v.r + 8, Math.hypot(v.vx, v.vy));
  if (def.boat && Math.hypot(v.vx, v.vy) > 40) {
    G.particles.push({ kind: "wake", x: v.x - nh.x * 16, y: v.y - nh.y * 16, vx: -nh.x * 6, vy: -nh.y * 6, life: 0.22, a: 0.28 });
  }
  const spdNow = Math.hypot(v.vx, v.vy);
  if (isPlayer && spdNow > 50 && (G.wet > 0.25 || ["water","canal","pier"].includes(G.surfaceAt(v.x + nh.x * 30, v.y + nh.y * 30)))) {
    if ((G.ticks % 3) === 0) {
      G.particles.push({ kind: "splash", x: v.x - nh.x * 12, y: v.y - nh.y * 12, vx: (Math.random()-0.5)*30, vy: -30, life: 0.35, a: 0.7 });
    }
  }
  if (isPlayer && surf === "sand" && spdNow > 40 && (G.ticks % 2) === 0) {
    G.particles.push({ kind: "dust", x: v.x - nh.x * 10, y: v.y - nh.y * 10, vx: -nh.x * 10, vy: -nh.y * 10, life: 0.4, a: 0.5 });
  }
  if (v.burning) {
    if ((G.ticks % 2) === 0) G.particles.push({ kind: "smoke", x: v.x, y: v.y, vx: (Math.random()-0.5)*20, vy: -30, life: 0.6, frame: 0 });
  }
  if (isPlayer && input.enterP) exitVeh(G);
  if (isPlayer && input.fire && now() - G.lastShot > 0.28) shoot(G, v, false);
}

function solidAtSafe(G, x, y, r) {
  return G.solidAt(x, y) || G.solidAt(x + r, y) || G.solidAt(x - r, y) || G.solidAt(x, y + r) || G.solidAt(x, y - r);
}

function tryEnter(G, instant) {
  const p = G.player;
  if (p.type === "veh") return;
  if (G.jack) return;
  const v = nearestVeh(G, p.x, p.y, 42);
  if (v) enterVeh(G, v, instant);
}

function nearestVeh(G, x, y, r, kind) {
  let best = null, bd = r;
  for (const v of G.vehicles) {
    if (v.driver && v !== G.player) continue;
    if (kind && v.kind !== kind) continue;
    const d = Math.hypot(v.x - x, v.y - y);
    if (d < bd) { bd = d; best = v; }
  }
  return best;
}

function enterVeh(G, v, instant) {
  if (!v) return;
  if (v.lockedUntil && !G.unlocked.includes(v.lockedUntil) && !G.unlocked.includes(v.kind)) {
    toast(G, "Still locked. Earn it first.");
    return;
  }
  if (v.def.boat && !["water", "canal", "pier"].includes(G.surfaceAt(v.x, v.y))) {
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
  v.parked = false;
  v.driver = "player";
  v.traffic = false;
  G.player = v;
  G.audio.enter();
  if (!G.audio.radio) G.audio.setRadio(true);
  const name = G.audio.currentStation ? G.audio.currentStation() : (G.audio.stations && G.audio.stations[G.audio.station || 0].name) || "VEIL FM";
  G.radioName = name;
  G.radioT = 3.2;
  if (G.audio.stinger) G.audio.stinger(G.audio.station || 0);
  if (v.def && v.def.cop) bumpWanted(G, 1);
}

function exitVeh(G) {
  const v = G.player;
  if (v.type !== "veh") return;
  const h = headingVec(v.rot);
  const r = rightVec(v.rot);
  v.driver = null;
  v.vx *= 0.3; v.vy *= 0.3;
  const foot = makeFoot(G, v.x + r.x * 22, v.y + r.y * 22, v.rot);
  foot.exitT = 1;
  if (!FOOT_OK.has(G.surfaceAt(foot.x, foot.y))) {
    foot.x = v.x - r.x * 22; foot.y = v.y - r.y * 22;
  }
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
  G.lastShot = now();
  const rot = from.rot;
  const h = headingVec(rot);
  const speed = 520;
  G.bullets.push({ x: from.x + h.x * 16, y: from.y + h.y * 16, vx: h.x * speed, vy: h.y * speed, life: 0.7, friend: true });
  G.audio.shot();
  // muzzle flash
  G.particles.push({ kind: "flash", x: from.x + h.x * 16, y: from.y + h.y * 16, life: 0.08, a: 1 });
  bumpWanted(G, 1);
}

function tickBullets(G, dt) {
  for (const b of G.bullets) {
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    if (G.solidAt(b.x, b.y)) { b.life = 0; continue; }
    for (const p of G.peds) {
      if (p.dead) continue;
      if (Math.hypot(p.x - b.x, p.y - b.y) < 12) {
        p.hp -= 20; p.flee = 4; b.life = 0;
        if (p.hp <= 0) { p.dead = true; G.audio.hit(); bumpWanted(G, 1); }
      }
    }
    // hit player if enemy bullet
    if (!b.friend && Math.hypot(G.player.x - b.x, G.player.y - b.y) < 14) {
      G.health -= 8; b.life = 0;
      if (G.health <= 0) respawn(G);
    }
  }
  G.bullets = G.bullets.filter((b) => b.life > 0);
}

function respawn(G) {
  G.health = 100;
  const s = G.meta.spawns.garage;
  if (G.player.type === "veh") exitVeh(G);
  G.player.x = s[0]; G.player.y = s[1];
  const heat = G.wanted;
  G.wanted = Math.max(0, G.wanted - 1);
  if (heat > 0) showBanner(G, "BUSTED BY METRO", "Back to Hunter's lot", "bust");
  else showBanner(G, "LIGHTS OUT", "Metro dumped you at the garage", "bust");
}

function bumpWanted(G, n) {
  const prev = G.wanted;
  G.wanted = clamp(G.wanted + n, 0, 5);
  G.wantedCool = 10 + G.wanted * 4;
  if (G.wanted > prev) G.audio.star();
  if (prev < 3 && G.wanted >= 3 && G.audio.chaseSwell) G.audio.chaseSwell();
}

function tickWanted(G, dt) {
  if (G.wanted <= 0) return;
  G.wantedCool -= dt;
  if (G.wantedCool <= 0) {
    G.wanted = Math.max(0, G.wanted - 1);
    G.wantedCool = 8;
    if (G.wanted === 0) toast(G, "Heat's gone.");
  }
  // spawn cops — more cars, closer, as the stars climb
  const need = G.wanted === 1 ? 2 : G.wanted * 2 + (G.wanted >= 4 ? 2 : 0);
  G.cops = G.cops.filter((c) => c.alive !== false);
  if (G.cops.length < need) {
    const a = Math.random() * TAU;
    const d = (G.wanted >= 4 ? 280 : 420) + Math.random() * 200;
    const x = G.player.x + Math.cos(a) * d;
    const y = G.player.y + Math.sin(a) * d;
    if (G.surfaceAt(x, y) === "road" || G.surfaceAt(x, y) === "track") {
      const v = makeVeh("metro", x, y, a, { parked: false, cop: true, ai: true });
      G.vehicles.push(v);
      G.cops.push(v);
    }
  }
}

function tickCops(G, dt) {
  if (G.wanted <= 0) return;
  const p = G.player;
  const heading = headingVec(p.rot || 0);
  const right = rightVec(p.rot || 0);
  let ci = 0;
  for (const c of G.cops) {
    if (!c || c === G.player) continue;
    const role = (ci++) % 3;
    let tx, ty;
    if (role === 0) { tx = p.x + heading.x * 200 + right.x * 110; ty = p.y + heading.y * 200 + right.y * 110; }
    else if (role === 1) { tx = p.x + heading.x * 200 - right.x * 110; ty = p.y + heading.y * 200 - right.y * 110; }
    else { tx = p.x - heading.x * 90; ty = p.y - heading.y * 90; }
    const dx = tx - c.x, dy = ty - c.y;
    const ang = Math.atan2(dx, -dy);
    const turn = 2.2 + G.wanted * 0.25;
    c.rot = c.rot + angNorm(ang - c.rot) * turn * dt;
    const throttle = 0.72 + Math.min(0.35, G.wanted * 0.08);
    const input = { x: clamp(angNorm(ang - c.rot) * 2, -1, 1), y: throttle, brake: false, fire: false, enterP: false };
    tickDrive(G, c, input, dt, false);
    const dxp = p.x - c.x, dyp = p.y - c.y;
    const dist = Math.hypot(dxp, dyp);
    const shootP = G.wanted >= 3 ? 0.05 : 0.02;
    if (G.player.type === "foot" && dist < 220 + G.wanted * 20 && Math.random() < shootP) {
      const h = headingVec(c.rot);
      const sp = 380 + G.wanted * 30;
      G.bullets.push({ x: c.x + h.x * 16, y: c.y + h.y * 16, vx: h.x * sp, vy: h.y * sp, life: 0.7, friend: false });
    }
    // pinch on foot at 3+ stars
    if (G.player.type === "foot" && dist < 22 && G.wanted >= 2) {
      G.health = 0;
      respawn(G);
    }
  }
}

function tickVehicles(G, dt) {
  for (const v of G.vehicles) {
    if (v === G.player) continue;
    if (v.ai) continue;
    if (v.isVan) {
      // drive south on the strip
      const sx = (G.meta.layout && G.meta.layout.stripX) || 1964;
      v.x = lerp(v.x, sx - 80, 0.4 * dt);
      v.y += 70 * dt;
      v.rot = 0;
      if (v.y > 3600) v.y = 900;
      continue;
    }
    if (v.role === "boat" && v.def && v.def.boat) {
      v.cruise = (v.cruise || 0) + dt * 0.15;
      const mx = (G.meta.spawns && G.meta.spawns.marina) ? G.meta.spawns.marina[0] : 1920;
      const my = 520;
      const ox = Math.cos(v.cruise) * 280;
      const oy = Math.sin(v.cruise * 0.7) * 90;
      const tx = mx + ox, ty = my + oy;
      const ang = Math.atan2(tx - v.x, -(ty - v.y));
      v.rot = v.rot + angNorm(ang - v.rot) * 1.4 * dt;
      const h = headingVec(v.rot);
      if (["water", "canal", "pier"].includes(G.surfaceAt(v.x + h.x * 20, v.y + h.y * 20))) {
        v.x += h.x * 46 * dt; v.y += h.y * 46 * dt;
      }
      if ((G.ticks % 8) === 0) G.particles.push({ kind: "wake", x: v.x - h.x * 14, y: v.y - h.y * 14, vx: -h.x * 5, vy: -h.y * 5, life: 0.18, a: 0.25 });
      continue;
    }
    if (v.role === "ambulance" && v.target && v !== G.player) {
      const ang = Math.atan2(v.target.x - v.x, -(v.target.y - v.y));
      v.rot = v.rot + angNorm(ang - v.rot) * 2.4 * dt;
      const input = { x: clamp(angNorm(ang - v.rot) * 2, -1, 1), y: 0.85, brake: false, fire: false, enterP: false };
      tickDrive(G, v, input, dt, false);
      v.siren = true;
      if (Math.hypot(v.x - v.target.x, v.y - v.target.y) < 50) { v.parked = true; v.target = null; v.vx = 0; v.vy = 0; }
      continue;
    }
    if (v.traffic && v.path) {
      const rd = v.path;
      const len = Math.hypot(rd.b[0] - rd.a[0], rd.b[1] - rd.a[1]) || 1;
      let spd = v.spd || 55;
      const posNow = lanePos(rd, v.pt, v.lane ?? trafficLane(rd, 0));
      if (!lightHeld(G, rd, posNow)) { spd = 0; v.braking = true; }
      else v.braking = false;
      if (v.role === "taxi") {
        v.hold = (v.hold || 0) - dt;
        if (v.hold > 0) { spd = 0; v.braking = true; }
        else if (Math.random() < 0.002) v.hold = 2.2 + Math.random() * 2;
      }
      const prevPt = v.pt;
      v.pt += (v.dir || 1) * (spd / len) * dt;
      if (v.pt > 1 || v.pt < 0) { v.dir *= -1; v.pt = clamp(v.pt, 0, 1); }
      const pos = lanePos(rd, v.pt, v.lane ?? trafficLane(rd, 0));
      v.rot = pathRot(rd, v.dir || 1);
      v.x = pos.x; v.y = pos.y;
      v.vx = Math.sin(v.rot) * spd;
      v.vy = -Math.cos(v.rot) * spd;
      v.lean = lerp(v.lean || 0, (v.pt - prevPt) * 0, 4 * dt);
      v.turnSign = 0;
    }
  }
  if (G._ambT) G._ambT -= dt;
  if (G.race && G.race.rival) {
    const riv = G.race.rival;
    const pts = G.meta.race.pts;
    const i = G.race.rivalI % pts.length;
    const t = pts[i];
    const ang = Math.atan2(t[0] - riv.x, -(t[1] - riv.y));
    riv.rot = riv.rot + angNorm(ang - riv.rot) * 3 * dt;
    const input = { x: clamp(angNorm(ang - riv.rot) * 2, -1, 1), y: 0.9, brake: false, fire: false, enterP: false };
    tickDrive(G, riv, input, dt, false);
    if (Math.hypot(riv.x - t[0], riv.y - t[1]) < 60) G.race.rivalI++;
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
  for (const p of G.peds) {
    if (p.dead) continue;
    if (Math.hypot(p.x - x, p.y - y) < r) {
      p.flee = 3.5;
      p.rot = Math.atan2(p.x - x, -(p.y - y));
    }
  }
}

function callAmbulance(G, x, y) {
  if (G._ambT && G._ambT > 0) return;
  G._ambT = 18;
  let amb = G.vehicles.find((v) => v.role === "ambulance");
  const roads = (G.meta.roads || []).filter((r) => r.k !== "alley" && r.k !== "track");
  let pos = { x: x + 220, y: y + 80 };
  for (const rd of roads) {
    const p = lanePos(rd, 0.5, trafficLane(rd, 0));
    if (G.surfaceAt(p.x, p.y) === "road") { pos = p; break; }
  }
  if (!amb) {
    amb = makeVeh("ambulance", pos.x, pos.y, 0, { parked: false, traffic: false, role: "ambulance", spd: 90, ai: true });
    G.vehicles.push(amb);
  }
  amb.parked = false;
  amb.wrecked = false;
  amb.target = { x, y };
  amb.ai = true;
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
  const shooting = !!(pl.type === "foot" && G.input && G.input.fire);
  if (shooting) scarePeds(G, pl.x, pl.y, 280);
  for (const b of G.bullets || []) scarePeds(G, b.x, b.y, 80);
  const sx = (G.meta.layout && G.meta.layout.stripX) || 1964;
  for (const p of G.peds) {
    if (p.dead) continue;
    if (Math.hypot(p.x - G.cam.x, p.y - G.cam.y) > 1100) continue;
    const dx = p.x - pl.x, dy = p.y - pl.y;
    const dist = Math.hypot(dx, dy);
    if (pl.type === "veh" && pSpd > 55 && dist < 78 && !(p.dive > 0)) {
      p.dive = 0.7;
      p.flee = 2.2;
      const side = Math.atan2(dx, -dy) + (Math.random() < 0.5 ? 1.2 : -1.2);
      p.rot = side;
      p.vx = Math.sin(side) * 140;
      p.vy = -Math.cos(side) * 140;
    }
    if (p.dive > 0) {
      p.dive -= dt;
      p.x += (p.vx || 0) * dt;
      p.y += (p.vy || 0) * dt;
      p.vx = (p.vx || 0) * 0.9;
      p.vy = (p.vy || 0) * 0.9;
      p.dist += 40 * dt;
      p.speed = 80;
      continue;
    }
    if (p.flee > 0) {
      p.flee -= dt;
      p.rot = Math.atan2(p.x - pl.x, -(p.y - pl.y));
    } else if (p.gather && p.flee <= 0) {
      const g = p.gather;
      const d = Math.hypot(p.x - g.x, p.y - g.y);
      if (d > 28) p.rot = Math.atan2(g.x - p.x, -(g.y - p.y));
      else if (Math.random() < 0.02) p.rot += (Math.random() - 0.5) * 1.2;
    } else if (Math.random() < 0.02) {
      // prefer staying on walk; at a signal try to cross
      p.rot += (Math.random() - 0.5) * 0.8;
    }
    const h = headingVec(p.rot);
    const spd = p.flee > 0 ? p.speed * 1.8 : (p.gather && Math.hypot(p.x - (p.gather.x||p.x), p.y - (p.gather.y||p.y)) < 28 ? p.speed * 0.15 : p.speed);
    let nx = p.x + h.x * spd * dt;
    let ny = p.y + h.y * spd * dt;
    const s = G.surfaceAt(nx, ny);
    // allow crosswalk (road) only near a signal when that axis is green, or if already fleeing
    if (s === "road" && p.flee <= 0) {
      const held = !G.meta.signals || G.meta.signals.some((sig) => {
        const d = Math.hypot(nx - sig.x, ny - sig.y);
        if (d > (sig.r || 160)) return false;
        const phase = ((G.ticks / 60) % 16);
        const goingNS = Math.abs(h.y) > Math.abs(h.x);
        const nsGreen = phase < 7;
        return goingNS ? nsGreen : (phase >= 8 && phase < 15);
      });
      if (!held) { p.rot += 0.9; nx = p.x; ny = p.y; }
    } else if (!FOOT_OK.has(s)) {
      p.rot += 0.8; nx = p.x; ny = p.y;
    }
    p.x = nx; p.y = ny; p.dist += spd * dt; p.speed = spd;
    if (pl.type === "veh" && dist < pl.r * 0.7 && pSpd > 90) {
      p.dead = true; bumpWanted(G, 1); G.audio.hit();
      scarePeds(G, p.x, p.y, 300);
      callAmbulance(G, p.x, p.y);
    }
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
    p.x += (p.vx || 0) * dt; p.y += (p.vy || 0) * dt; p.life -= dt;
    if (p.frame != null) p.frame += dt * 12;
  }
  if (G.particles.length > 800) G.particles.splice(0, 300);
  G.particles = G.particles.filter((p) => p.life > 0);
  for (const s of G.skids) s.a -= dt * 0.15;
  G.skids = G.skids.filter((s) => s.a > 0);
}

function tickCamera(G, dt) {
  const p = G.player;
  const spd = p.type === "veh" ? Math.hypot(p.vx, p.vy) : p.speed || 0;
  const onFoot = p.type !== "veh";
  const tgtScale = onFoot
    ? lerp(1.12, 0.96, clamp(spd / 90, 0, 1))
    : lerp(0.90, 0.58, clamp(spd / 280, 0, 1));
  G.cam.scale = lerp(G.cam.scale, tgtScale, 3 * dt);
  const look = p.type === "veh" ? 0.18 * Math.hypot(p.vx || 0, p.vy || 0) : 0;
  const hx = p.type === "veh" ? Math.sin(p.rot) * look : 0;
  const hy = p.type === "veh" ? -Math.cos(p.rot) * look : 0;
  G.cam.x = lerp(G.cam.x, p.x + hx, 6 * dt);
  G.cam.y = lerp(G.cam.y, p.y + hy, 6 * dt);
  if (G.cam.northUp || p.type !== "veh") G.cam.rot = lerp(G.cam.rot, 0, 4 * dt);
  else G.cam.rot = G.cam.rot + angNorm(p.rot - G.cam.rot) * 3 * dt;
  if (G.cam.shake > 0) G.cam.shake = Math.max(0, G.cam.shake - 18 * dt);
}

function tickMission(G, dt) {
  if (!MISSIONS[G.missionIndex]) return;
  const flow = G._flow || missionFlow(MISSIONS[G.missionIndex].id, G.flags);
  G._flow = flow;
  if (!flow) return;
  const obj = flow.objectives[G.objectiveIndex];
  if (!obj) return;
  const p = G.player;
  const at = objectivePos(G, obj);
  if (obj.kind === "enter") {
    if (p.type === "veh" && (!obj.near || Math.hypot(p.x - G.meta.spawns[obj.near][0], p.y - G.meta.spawns[obj.near][1]) < 200))
      advanceObjective(G);
  } else if (obj.kind === "goto" || obj.kind === "collect") {
    if (at && Math.hypot(p.x - at.x, p.y - at.y) < (obj.r || 80)) advanceObjective(G);
  } else if (obj.kind === "loseWanted") {
    if (G.wanted === 0) advanceObjective(G);
  } else if (obj.kind === "enterBoat") {
    if (p.type === "veh" && p.def.boat) advanceObjective(G);
  } else if (obj.kind === "stealCop") {
    if ((p.type === "veh" && p.kind === "metro") || (G.flags.scrambler && at && Math.hypot(p.x - at.x, p.y - at.y) < 80)) {
      G.flags.scrambler = true;
      advanceObjective(G);
    }
  } else if (obj.kind === "race") {
    if (!G.race) startRace(G, obj);
    else tickRace(G, obj, dt);
  }
}

function startRace(G, obj) {
  const pts = G.meta.race.checkpoints;
  const start = G.meta.spawns.raceStart;
  G.race = { i: 0, pts, t: 0, rivalI: 0, rival: null, started: false, countdown: 3 };
  // park player at start if close
  const riv = makeVeh("dart", start[0] + 30, start[1], 0, { parked: false, ai: false });
  G.vehicles.push(riv);
  G.race.rival = riv;
  toast(G, "Hold at the lights…");
}

function tickRace(G, obj, dt) {
  const R = G.race;
  R.t += dt;
  if (R.countdown > 0) {
    R.countdown -= dt;
    if (R.countdown <= 0) { toast(G, "GO."); R.started = true; }
    return;
  }
  const cp = R.pts[R.i];
  if (cp && Math.hypot(G.player.x - cp[0], G.player.y - cp[1]) < 70) {
    R.i++;
    G.audio.pickup();
    if (R.i >= R.pts.length) {
      const playerWon = !R.rival || R.rivalI < R.pts.length || R.i >= R.rivalI;
      // finish: if player completed all cps first
      completeMission(G, true);
    } else toast(G, `Checkpoint ${R.i}/${R.pts.length}`);
  }
}

function tickTitleDummy() {}

/* -------------------- Render -------------------- */
function render(G) {
  const { ctx, canvas } = G;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = "#07060a";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (G.scene === "title" || (G.scene === "settings" && G.pausedFrom === "title")) {
    drawTitle(G);
    if (G.scene === "settings") drawSettings(G);
    return;
  }
  if (G.scene === "vn") { drawVN(G); return; }
  if (G.scene === "end") { drawEnd(G); return; }
  drawWorld(G);
  drawHUD(G);
  if (G.scene === "pause") drawPause(G);
  if (G.scene === "settings") drawSettings(G);
}

function viewForLife(cam) {
  return 760 / cam.scale;
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
  // traffic lights at intersections
  const phase = ((t / 60) % 16);
  const nsGreen = phase < 7;
  const amber = (phase >= 7 && phase < 8) || (phase >= 15);
  for (const s of (G.meta.signals || [])) {
    if (Math.abs(s.x - cam.x) > view || Math.abs(s.y - cam.y) > view) continue;
    for (const [dx, dy, ns] of [[-22, -22, true], [22, 22, true], [-22, 22, false], [22, -22, false]]) {
      const go = ns ? nsGreen : (phase >= 8 && phase < 15);
      const col = amber ? "#ffb000" : go ? "#3ce06a" : "#ff3a3a";
      ctx.save();
      ctx.translate(s.x + dx, s.y + dy);
      ctx.fillStyle = "#1a1a1e";
      ctx.fillRect(-3, -8, 6, 16);
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(0, go || amber ? -3 : 3, 2.6, 0, TAU); ctx.fill();
      ctx.restore();
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
  const ang = t * 0.007;
  return {
    x: 2720 + Math.cos(ang) * 160,
    y: 1860 + Math.sin(ang) * 140,
    rot: ang + Math.PI / 2,
    beam: ang * 1.6,
  };
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
  const { ctx, canvas, cam, assets } = G;
  const night = nightFactor(G);
  const dusk = duskFactor(G);
  const sh = cam.shake || 0;
  const ox = sh ? (Math.random() - 0.5) * sh * 2 : 0;
  const oy = sh ? (Math.random() - 0.5) * sh * 2 : 0;
  ctx.save();
  ctx.translate(canvas.width / 2 + ox, canvas.height / 2 + oy);
  ctx.scale(cam.scale * (canvas.height / 720), cam.scale * (canvas.height / 720));
  ctx.rotate(-cam.rot);
  ctx.translate(-cam.x, -cam.y);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(assets.albedo, 0, 0);
  drawBuildingHeight(G, cam);
  // animated water
  if (assets.water) {
    const wi = ((G.ticks / 12) | 0) % 4;
    ctx.drawImage(assets.water[wi], 0, 0);
  }
  if (G.wet > 0.15) {
    ctx.globalAlpha = 0.45 * G.wet;
    ctx.drawImage(assets.puddles, 0, 0);
    ctx.globalAlpha = 1;
    if (assets.specular) {
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = 0.18 * G.wet;
      // scrolling highlight
      ctx.drawImage(assets.specular, (G.ticks % 40) - 20, 0);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    }
  }
  drawLife(G, cam, viewForLife(cam));
  // skids
  ctx.strokeStyle = "rgba(10,10,12,0.45)";
  ctx.lineWidth = 3;
  for (const s of G.skids) {
    ctx.save();
    ctx.globalAlpha = s.a * 0.8;
    ctx.translate(s.x, s.y);
    ctx.rotate(s.rot || 0);
    ctx.beginPath(); ctx.moveTo(-7, 8); ctx.lineTo(-7, -8);
    ctx.moveTo(7, 8); ctx.lineTo(7, -8);
    ctx.stroke();
    ctx.restore();
  }
  ctx.globalAlpha = 1;
  const view = 700 / cam.scale;
  // Painted city already has palms; skip the old procedural sprites.
  for (const p of G.props) {
    if (Math.abs(p.x - cam.x) > view || Math.abs(p.y - cam.y) > view) continue;
    const spr = assets.sprites["prop_" + p.kind];
    if (!spr) continue;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot || 0);
    ctx.globalAlpha = p.broken ? 0.7 : 1;
    ctx.drawImage(spr, -16, -16, 32, 32);
    ctx.restore();
  }
  for (const c of G.pickups) {
    if (c.got) continue;
    if (Math.abs(c.x - cam.x) > view || Math.abs(c.y - cam.y) > view) continue;
    const bob = Math.sin((G.ticks + c.x) * 0.15) * 3;
    ctx.save();
    ctx.translate(c.x, c.y + bob);
    if (G.assets.chipIcon) ctx.drawImage(G.assets.chipIcon, -10, -10, 20, 20);
    else { ctx.fillStyle = "#f2c14e"; ctx.beginPath(); ctx.arc(0, 0, 7, 0, TAU); ctx.fill(); }
    ctx.restore();
  }
  const actors = [];
  for (const v of G.vehicles) actors.push(v);
  for (const p of G.peds) actors.push(p);
  if (G.jack && G.player.type === "foot") {
    /* player already in actors if type foot — yes below */
  }
  if (G.player.type === "foot") actors.push(G.player);
  actors.sort((a, b) => a.y - b.y);
  for (const a of actors) {
    if (Math.abs(a.x - cam.x) > view * 1.1 || Math.abs(a.y - cam.y) > view * 1.1) continue;
    if (a.type === "veh" || a.def) drawVeh(G, a);
    else drawChar(G, a);
  }

  // colour grade (multiply in world, via screen overlay after)
  // night + dusk composites
  if (night > 0.02 || dusk > 0.02) {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (dusk > 0.02 && night < 0.85) {
      const dw = dusk * (1 - night * 0.75);
      ctx.globalCompositeOperation = "overlay";
      ctx.fillStyle = `rgba(255, 150, 80, ${0.42 * dw})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.globalCompositeOperation = "screen";
      ctx.fillStyle = `rgba(255, 140, 90, ${0.16 * dw})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = `rgba(255, 90, 140, ${0.05 * dw})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    if (night > 0.02) {
      ctx.globalCompositeOperation = "multiply";
      // cool navy, slightly deeper for contrast — not brown
      ctx.fillStyle = `rgba(16, 20, 52, ${0.30 + 0.06 * night})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = `rgba(8, 10, 28, ${0.06 * night})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.globalCompositeOperation = "source-over";
    }
    ctx.restore();
    // additive lights in world space
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const pulse = 0.78 + 0.22 * Math.sin(G.ticks * 0.09);
    const sheen = G.wet + night * 0.12;
    // pass 8: signs flick on through golden hour, full at night
    const lit = Math.max(night, 0.5 * dusk);
    if (lit > 0.02) {
      // colored light on the ground first (pink/cyan washes)
      if (assets.neonGround) {
        ctx.globalAlpha = (0.30 + 0.06 * pulse) * lit;
        ctx.drawImage(assets.neonGround, 0, 0);
      }
      // crisp sign tubes, mild flicker cycle
      const flicker = 0.92 + 0.08 * Math.sin(G.ticks * 0.21) * (0.4 + 0.6 * pulse);
      ctx.globalAlpha = Math.min(1, (0.9 + 0.1 * pulse) * lit * flicker);
      if (assets.neon) ctx.drawImage(assets.neon, 0, 0);
      drawMarquees(G, cam, view, lit);
      ctx.globalAlpha = (0.55 + 0.12 * pulse) * night;
      if (assets.windows && night > 0.02) ctx.drawImage(assets.windows, 0, 0);
      // tight warm lamps, not muddy blobs
      let nL = 0;
      const lampSeen = new Set();
      for (const L of G.meta.lights) {
        if (L.kind && L.kind !== "street") continue;
        if (Math.abs(L.x - cam.x) > view || Math.abs(L.y - cam.y) > view) continue;
        const lk = `${L.x / 28 | 0},${L.y / 28 | 0}`;
        if (lampSeen.has(lk)) continue;
        lampSeen.add(lk);
        if (++nL > 90) break;
        const grd = ctx.createRadialGradient(L.x, L.y, 0, L.x, L.y, 26);
        grd.addColorStop(0, "rgba(255, 220, 160, 0.85)");
        grd.addColorStop(0.22, "rgba(255, 190, 110, 0.28)");
        grd.addColorStop(0.6, "rgba(255, 160, 70, 0.08)");
        grd.addColorStop(1, "rgba(255, 140, 50, 0)");
        ctx.globalAlpha = 0.85 * Math.max(night, 0.35 * dusk);
        ctx.fillStyle = grd;
        ctx.beginPath(); ctx.arc(L.x, L.y, 26, 0, TAU); ctx.fill();
      }
      // extra in-view sign pools from meta.neons (casts color onto the street)
      let nN = 0;
      for (const N of G.meta.neons) {
        const nx = N.x + N.w * 0.5, ny = N.y + N.h + 16;
        if (Math.abs(nx - cam.x) > view || Math.abs(ny - cam.y) > view) continue;
        if (++nN > 18) break;
        const col = N.color || "#ff2d9b";
        const r = Math.max(36, Math.min(N.w * 0.42, 88));
        const blink = ((G.ticks + nN * 17) % 220);
        const fl = (nN % 6 === 2 && blink < 6) ? 0.18 : (0.85 + 0.15 * Math.sin(G.ticks * 0.11 + nN));
        const g2 = ctx.createRadialGradient(nx, ny, 0, nx, ny, r);
        g2.addColorStop(0, hexA(col, 0.78 * pulse * fl));
        g2.addColorStop(0.35, hexA(col, 0.28 * fl));
        g2.addColorStop(1, hexA(col, 0));
        ctx.globalAlpha = 1.0 * lit;
        ctx.fillStyle = g2;
        ctx.beginPath(); ctx.ellipse(nx, ny, r, r * 0.45, 0, 0, TAU); ctx.fill();
        if (sheen > 0.12) {
          ctx.globalAlpha = 0.4 * sheen * lit;
          ctx.beginPath(); ctx.ellipse(nx, ny + 12, r * 0.9, r * 0.22, 0, 0, TAU); ctx.fill();
        }
      }
    }
    // wet road glitter
    if (sheen > 0.2 && assets.specular) {
      ctx.globalAlpha = 0.16 * sheen;
      ctx.drawImage(assets.specular, (G.ticks % 40) - 20, 0);
    }
    if (G.wet > 0.2 && assets.puddles && night > 0.15) {
      ctx.globalAlpha = 0.2 * G.wet;
      ctx.drawImage(assets.puddles, 0, 0);
    }
    // vehicle lights
    for (const v of G.vehicles) {
      if (!(v.type === "veh" || v.def)) continue;
      if (Math.abs(v.x - cam.x) > view || Math.abs(v.y - cam.y) > view) continue;
      drawVehLights(G, v, night);
    }
    if (G.player.type === "veh") drawVehLights(G, G.player, night);
    if (night > 0.25 && cam.scale < 1.65) drawHeli(G, night, true);
    ctx.restore();
    // redraw the hero after the grade so they stay readable at night
    if (night > 0.05 || dusk > 0.05) {
      if (G.player.type === "veh" || G.player.def) {
        drawVeh(G, G.player);
        if (night > 0.05) {
          ctx.save();
          ctx.globalCompositeOperation = "lighter";
          drawVehLights(G, G.player, night);
          ctx.restore();
        }
      } else drawChar(G, G.player);
    }
  }

  const nightH = nightFactor(G);
  if (nightH > 0.25 && cam.scale < 1.65) drawHeli(G, nightH, false);
  for (const p of G.particles) {
    if (p.kind === "rain") {
      ctx.strokeStyle = "rgba(180,200,220,0.55)";
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + 3, p.y + 12); ctx.stroke();
    } else if (p.kind === "sand") {
      ctx.fillStyle = "rgba(200,160,90,0.35)";
      ctx.fillRect(p.x, p.y, 3, 2);
    } else if (p.kind === "wake") {
      ctx.strokeStyle = `rgba(210,230,240,${Math.max(0, 0.35 * p.life)})`;
      ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.arc(p.x, p.y, 2.2, 0, TAU); ctx.stroke();
    } else if (p.kind === "flash") {
      ctx.fillStyle = "#fff";
      ctx.beginPath(); ctx.arc(p.x, p.y, 6, 0, TAU); ctx.fill();
    } else if (p.kind === "spray") {
      ctx.fillStyle = "rgba(120,180,220,0.5)";
      ctx.fillRect(p.x, p.y, 2, 4);
    } else if (p.kind === "trail") {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = Math.max(0, p.life * 3.2) * (p.a ?? 1);
      ctx.fillStyle = "#ff2f4a";
      ctx.beginPath(); ctx.arc(p.x, p.y, 2.6, 0, TAU); ctx.fill();
      ctx.restore();
    } else if (p.kind === "boost") {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = Math.max(0, p.life * 3);
      ctx.fillStyle = p.col || "#29f0ff";
      ctx.beginPath(); ctx.arc(p.x, p.y, 3.2, 0, TAU); ctx.fill();
      ctx.restore();
    } else if (p.kind === "spark") {
      const sp = assets.sprites.spark;
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life * 4);
      if (sp) ctx.drawImage(sp, p.x - 8, p.y - 8, 16, 16);
      else { ctx.fillStyle = "#ffe8a0"; ctx.fillRect(p.x, p.y, 2, 2); }
      ctx.restore();
    } else if (p.kind === "smoke") {
      const sm = assets.sprites.smoke;
      const fr = Math.min(3, (p.frame | 0));
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life * 1.2);
      if (sm) ctx.drawImage(sm, fr * 64, 0, 64, 64, p.x - 24, p.y - 24, 48, 48);
      ctx.restore();
    } else if (p.kind === "boom") {
      const ex = assets.sprites.explosion;
      const fr = Math.min(4, (p.frame | 0));
      if (ex) ctx.drawImage(ex, fr * 64, 0, 64, 64, p.x - 28, p.y - 28, 56, 56);
    } else if (p.kind === "bits") {
      ctx.fillStyle = "rgba(80,70,60,0.8)";
      ctx.fillRect(p.x, p.y, 3, 3);
    } else if (p.kind === "splash") {
      ctx.fillStyle = `rgba(200,220,235,${Math.max(0, (p.a||0.6)*p.life*2)})`;
      ctx.beginPath(); ctx.ellipse(p.x, p.y, 5, 3, 0, 0, TAU); ctx.fill();
    } else if (p.kind === "dust") {
      ctx.fillStyle = `rgba(180,150,100,${Math.max(0, (p.a||0.5)*p.life)})`;
      ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, TAU); ctx.fill();
    }
  }
  if (G.fog > 0.05) {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = `rgba(160,170,180,${0.28 * G.fog})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
  }
  if (G.lightning > 0.05) {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = `rgba(230,240,255,${0.55 * G.lightning})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
  }
  ctx.restore();
}

function drawVeh(G, v) {
  const spr = G.assets.sprites["veh_" + v.def.sprite];
  if (!spr) return;
  const ctx = G.ctx;
  ctx.save();
  ctx.translate(v.x, v.y);
  ctx.rotate(v.rot + (v.lean || 0) * 0.35);
  const sc = vehScale(v.def);
  let sprUse = spr;
  if (v.wrecked) {
    const wreck = G.assets.sprites["veh_" + (v.def.cop ? "metro_wreck" : "fare_wreck")];
    if (wreck) sprUse = wreck;
  }
  ctx.fillStyle = "rgba(0,0,0,0.38)";
  ctx.beginPath(); ctx.ellipse(3, 6, sprUse.width * sc * 0.38, sprUse.height * sc * 0.28, 0, 0, TAU); ctx.fill();
  ctx.drawImage(sprUse, -sprUse.width * sc / 2, -sprUse.height * sc / 2, sprUse.width * sc, sprUse.height * sc);
  // fake wheel hubs (readable motion at this scale)
  if (!v.def.boat && !v.def.bike) {
    const wr = 3.2;
    const wy = sprUse.height * sc * 0.28;
    const wx = sprUse.width * sc * 0.32;
    ctx.fillStyle = "rgba(16,16,18,0.85)";
    for (const [sx, sy] of [[-wx, -wy], [wx, -wy], [-wx, wy], [wx, wy]]) {
      ctx.beginPath(); ctx.ellipse(sx, sy, wr, wr * 0.7, 0, 0, TAU); ctx.fill();
    }
  }
  if (v.isVan) {
    ctx.fillStyle = "#f2c14e";
    ctx.font = "bold 9px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("SEED", 0, 4);
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

function drawVehLights(G, v, night) {
  if (!v || !v.def || v.def.boat) return;
  if (v.parked && v !== G.player && !(v.def && v.def.cop && G.wanted > 0)) return;
  const ctx = G.ctx;
  const sprH = (G.assets.sprites["veh_" + v.def.sprite] || { height: 200 }).height;
  const sc = vehScale(v.def);
  const len = sprH * sc * 0.45;
  const cones = G.assets.sprites;
  ctx.save();
  ctx.translate(v.x, v.y);
  ctx.rotate(v.rot);
  const lit = night > 0.08 || G.fog > 0.3;
  if (v.def.sprite === "nyx" && night > 0.05) {
    drawNyxLeds(ctx, sc, night, 0.75 + 0.25 * Math.sin((G.ticks || 0) * 0.12));
  }
  if (lit && !v.def.bike) {
    const isNyx = v.def.sprite === "nyx";
    drawHeadCone(ctx, len, isNyx ? 16 : 14, isNyx ? 110 : 80, (isNyx ? 0.9 : 0.72) * Math.max(night, 0.3));
  } else if (lit && v.def.bike) {
    drawHeadCone(ctx, len, 8, 52, 0.58 * night);
  }
  // tail / brake
  if (cones.cone_tail && !v.def.bike) {
    const brake = v.braking || (v.fwd != null && v.fwd < -10);
    ctx.globalAlpha = (brake ? 0.7 : 0.28) * Math.max(night, 0.2);
    ctx.drawImage(cones.cone_tail, -18, len - 10, 36, 40);
  }
  // indicators
  const turning = Math.abs(v.turnSign || 0) > 0.35 || v.role === "taxi" && v.hold > 0;
  if (turning && !v.def.bike) {
    const left = (v.turnSign || 0) < 0 || (v.role === "taxi" && v.hold > 0);
    const on = ((G.ticks / 8) | 0) % 2 === 0;
    if (on) {
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = "#ffb000";
      const side = left ? -sc * 70 : sc * 70;
      ctx.beginPath(); ctx.arc(side * 0.28, -len * 0.7, 3.2, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(side * 0.28, len * 0.55, 3.2, 0, TAU); ctx.fill();
    }
  }
  if (v.siren && night > 0.05) {
    const left = ((G.ticks / 6) | 0) % 2 === 0;
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = left ? "rgba(255,50,60,0.95)" : "rgba(255,255,255,0.9)";
    ctx.beginPath(); ctx.arc(0, -4, 8, 0, TAU); ctx.fill();
  }
  // police bar
  if (v.def.cop && night > 0.1) {
    const left = ((G.ticks / 8) | 0) % 2 === 0;
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = left ? "rgba(60,110,255,0.9)" : "rgba(255,50,60,0.9)";
    ctx.beginPath(); ctx.arc(left ? -8 : 8, -2, 7, 0, TAU); ctx.fill();
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

function drawChar(G, a) {
  const spr = G.assets.sprites["char_" + (a.sprite || "chaos")];
  if (!spr) return;
  const ctx = G.ctx;
  const fw = spr.width / 6, fh = spr.height / 8;
  const dir = ((Math.round(a.rot / (Math.PI / 4))) + 8) % 8;
  const row = (dir + 6) % 8; // sheet row 0 is East
  let col = 4; // idle
  const moving = (a.speed || 0) > 20 || (a === G.player && a.type === "foot" && Math.hypot(G.input.x, G.input.y) > 0.15);
  if (moving) col = Math.floor((a.dist || 0) / 9) % 4;
  if (a === G.player && G.input.fire) col = 5;
  if (a.dead) { ctx.globalAlpha = 0.5; col = 4; }
  const sc = charScale(a.sprite || "chaos", spr);
  ctx.save();
  ctx.translate(a.x, a.y);
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
  const dx = -fw * 0.5 * sc, dy = -fh * 0.68 * sc, dw = fw * sc, dh = fh * sc;
  // soft south drop shadow
  ctx.save();
  const prevSmooth = ctx.imageSmoothingQuality;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.fillStyle = "rgba(0,0,0,0.16)";
  ctx.beginPath(); ctx.ellipse(3, dh * 0.36, dw * 0.36, dh * 0.14, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = "rgba(0,0,0,0.28)";
  ctx.beginPath(); ctx.ellipse(2, dh * 0.32, dw * 0.24, dh * 0.09, 0, 0, TAU); ctx.fill();
  ctx.restore();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  const isHero = a.sprite === "chaos" || a === G.player;
  const nightC = nightFactor(G);
  if (isHero && nightC > 0.18 && !a.dead) {
    ctx.save();
    ctx.shadowColor = `rgba(190, 245, 255, ${0.95 * nightC})`;
    ctx.shadowBlur = 0;
    const o = 2.8;
    for (const [sx, sy] of [[-o, 0], [o, 0], [0, -o], [0, o], [-o, -o], [o, o], [-o, o], [o, -o]]) {
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
  if (isHero && nightC > 0.18 && !a.dead) {
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 0.32 * nightC;
    ctx.drawImage(spr, col * fw, row * fh, fw, fh, dx, dy - 1, dw, dh);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

function drawHUD(G) {
  if (G.hideHUD) return;
  const { ctx, canvas } = G;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.save();
  const s = canvas.height / 720;
  ctx.scale(s, s);
  const W = canvas.width / s, H = 720;
  // minimap
  const mm = 160, mx = 16, my = H - mm - 16;
  ctx.save();
  ctx.beginPath(); ctx.arc(mx + mm / 2, my + mm / 2, mm / 2, 0, TAU); ctx.clip();
  const worldToM = 512 / WORLD;
  const sx = G.player.x * worldToM, sy = G.player.y * worldToM;
  const zoom = 2.2;
  ctx.drawImage(G.assets.minimap, mx + mm / 2 - sx * zoom, my + mm / 2 - sy * zoom, 512 * zoom, 512 * zoom);
  ctx.fillStyle = "#ff2d9b";
  ctx.beginPath(); ctx.arc(mx + mm / 2, my + mm / 2, 4, 0, TAU); ctx.fill();
  // objective
  const flow = G._flow;
  const obj = flow && flow.objectives[G.objectiveIndex];
  const at = objectivePos(G, obj);
  if (at) {
    ctx.fillStyle = "#f2c14e";
    ctx.beginPath();
    ctx.arc(mx + mm / 2 + (at.x - G.player.x) * worldToM * zoom, my + mm / 2 + (at.y - G.player.y) * worldToM * zoom, 4, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
  ctx.beginPath(); ctx.arc(mx + mm / 2, my + mm / 2, mm / 2, 0, TAU);
  ctx.strokeStyle = "rgba(255,255,255,0.35)"; ctx.lineWidth = 2; ctx.stroke();

  // chips + wanted (compact corner card, away from world signs)
  ctx.fillStyle = "rgba(6,4,12,0.72)";
  rounded(ctx, W - 236, 12, 220, 86, 10); ctx.fill();
  ctx.fillStyle = "#f2c14e";
  ctx.fillRect(W - 236, 12, 4, 86);
  ctx.drawImage(G.assets.chipIcon, W - 220, 20, 24, 24);
  ctx.fillStyle = "#f2c14e";
  ctx.font = "700 18px system-ui";
  ctx.textAlign = "left";
  ctx.fillText(String(G.chips | 0) + " chips", W - 188, 38);
  for (let i = 0; i < 5; i++) {
    ctx.drawImage(i < G.wanted ? G.assets.starOn : G.assets.starOff, W - 220 + i * 26, 50, 20, 20);
  }
  const hh = G.time | 0, mmn = ((G.time % 1) * 60) | 0;
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.font = "11px system-ui";
  ctx.fillText(`${String(hh).padStart(2, "0")}:${String(mmn).padStart(2, "0")}  ${G.weather}`, W - 188, 88);

  // mission hint
  if (G.hint) {
    ctx.textAlign = "center";
    ctx.font = "600 16px system-ui";
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    const text = (MISSIONS[G.missionIndex] ? MISSIONS[G.missionIndex].title + " — " : "") + G.hint;
    const tw = ctx.measureText(text).width;
    ctx.fillRect(W / 2 - tw / 2 - 14, H - 54, tw + 28, 32);
    ctx.fillStyle = "#fff";
    ctx.fillText(text, W / 2, H - 32);
  }
  // speedo
  if (G.player.type === "veh") {
    const spd = Math.hypot(G.player.vx, G.player.vy);
    const kmh = (spd * 0.85) | 0;
    ctx.textAlign = "right";
    ctx.fillStyle = "#fff";
    ctx.font = "700 36px system-ui";
    ctx.fillText(String(kmh), W - 24, H - 48);
    ctx.font = "12px system-ui";
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.fillText(G.player.def.name, W - 24, H - 28);
  }
  // mission arrow (screen edge)
  if (at) {
    const dx = at.x - G.player.x, dy = at.y - G.player.y;
    if (Math.hypot(dx, dy) > 140) {
      const ang = Math.atan2(dx, -dy) - G.cam.rot;
      ctx.save();
      ctx.translate(W / 2, 80);
      ctx.rotate(ang);
      ctx.fillStyle = "#f2c14e";
      ctx.beginPath(); ctx.moveTo(0, -16); ctx.lineTo(10, 8); ctx.lineTo(-10, 8); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  }
  if (G.toastT > 0) {
    ctx.textAlign = "center";
    ctx.globalAlpha = Math.min(1, G.toastT);
    ctx.font = "600 20px system-ui";
    ctx.fillStyle = "#fff";
    ctx.fillText(G.toast, W / 2, 120);
    ctx.globalAlpha = 1;
  }
  if (G.radioT > 0) {
    const a = Math.min(1, G.radioT, 0.4 + G.radioT);
    ctx.save();
    ctx.globalAlpha = Math.min(1, G.radioT);
    ctx.textAlign = "left";
    ctx.fillStyle = "rgba(0,0,0,0.62)";
    ctx.fillRect(14, 36, 268, 40);
    ctx.fillStyle = "#29f0ff";
    ctx.font = "10px system-ui";
    ctx.fillText("NOW PLAYING", 22, 50);
    ctx.fillStyle = "#fff";
    ctx.font = "700 16px system-ui";
    ctx.fillText(G.radioName, 22, 68);
    ctx.restore();
  }
  // floating chip popups
  ctx.save();
  ctx.textAlign = "center";
  ctx.font = "700 16px system-ui";
  for (const f of G.floaters) {
    ctx.globalAlpha = Math.min(1, f.life * 1.4);
    ctx.fillStyle = f.color || "#f2c14e";
    // convert world to a rough screen offset from player
    const sx = W / 2 + (f.x - G.player.x) * G.cam.scale * (720 / 720);
    const sy = 200 + (f.y - G.player.y) * G.cam.scale;
    ctx.fillText(f.text, sx, sy);
  }
  ctx.restore();
  if (G.banner) drawBanner(G, W, H);
  // health
  ctx.fillStyle = "rgba(6,4,12,0.7)";
  ctx.fillRect(16, 16, 124, 12);
  ctx.fillStyle = "#f2c14e";
  ctx.fillRect(16, 16, 124, 2);
  ctx.fillStyle = G.health > 40 ? "#39ff14" : "#ff3344";
  ctx.fillRect(18, 20, 120 * (G.health / 100), 6);
  ctx.restore();
}

function drawBanner(G, W, H) {
  const b = G.banner;
  if (!b) return;
  const ctx = G.ctx;
  const k = 1 - b.t / b.max;
  const appear = k < 0.12 ? k / 0.12 : 1;
  const fade = b.t < 0.5 ? b.t / 0.5 : 1;
  const scale = 0.82 + 0.18 * appear;
  const win = b.kind !== "bust";
  ctx.save();
  ctx.translate(W / 2, H * 0.28);
  ctx.scale(scale, scale);
  ctx.globalAlpha = appear * fade;
  ctx.fillStyle = win ? "rgba(8, 6, 0, 0.82)" : "rgba(20, 0, 0, 0.85)";
  ctx.fillRect(-W * 0.52, -52, W * 1.04, 118);
  ctx.fillStyle = win ? "#f2c14e" : "#ff2a3a";
  ctx.fillRect(-W * 0.52, -52, W * 1.04, 6);
  ctx.fillRect(-W * 0.52, 60, W * 1.04, 6);
  ctx.textAlign = "center";
  ctx.font = "800 72px 'Arial Black', 'Arial Bold', Impact, system-ui, sans-serif";
  ctx.lineWidth = 8;
  ctx.strokeStyle = "#000";
  ctx.strokeText(b.title, 0, 28);
  ctx.fillStyle = win ? "#ffe27a" : "#ffd0d0";
  ctx.fillText(b.title, 0, 28);
  if (b.sub) {
    ctx.font = "700 18px system-ui";
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.fillText(b.sub, 0, 52);
  }
  ctx.restore();
}

function drawTitle(G) {
  const { ctx, canvas, assets } = G;
  // live dusk flyover of the wide boulevard
  drawWorld(G);
  const W = canvas.width, H = canvas.height;
  const s = H / 1080;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  // left vignette so type stays readable; never covers the hero face on the right
  const g = ctx.createLinearGradient(0, 0, W * 0.62, 0);
  g.addColorStop(0, "rgba(6, 4, 12, 0.82)");
  g.addColorStop(0.55, "rgba(6, 4, 12, 0.42)");
  g.addColorStop(1, "rgba(6, 4, 12, 0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W * 0.62, H);
  // top/bottom film bars
  ctx.fillStyle = "#08060c";
  ctx.fillRect(0, 0, W, 36 * s);
  ctx.fillRect(0, H - 70 * s, W, 70 * s);
  ctx.fillStyle = "#f2c14e";
  const pw = 28 * s;
  for (let x = 10; x < W; x += pw * 2) ctx.fillRect(x, H - 52 * s, pw, 28 * s);

  // neon sweep
  const pulse = 0.55 + 0.45 * Math.sin((G.titleT || 0) * 3);
  ctx.save();
  ctx.globalAlpha = 0.18 + 0.12 * pulse;
  ctx.fillStyle = "#ff2d9b";
  ctx.fillRect(0, 36 * s, W, 3 * s);
  ctx.fillStyle = "#29f0ff";
  ctx.fillRect(0, 39 * s, W, 2 * s);
  ctx.restore();

  // logo — original, not a GTA pastiche
  ctx.textAlign = "left";
  ctx.fillStyle = "#ff2d9b";
  ctx.font = `700 ${Math.round(22 * s)}px system-ui`;
  const x0 = 80 * (W / 1920);
  ctx.fillText("METAWINNERS", x0, 160 * s);
  ctx.fillStyle = "#f2c14e";
  ctx.fillRect(x0, 172 * s, 120 * s, 4 * s);
  ctx.font = `800 ${Math.round(92 * s)}px "Arial Black", "Arial Bold", Impact, system-ui, sans-serif`;
  ctx.lineWidth = 10 * s;
  ctx.strokeStyle = "rgba(0,0,0,0.85)";
  ctx.strokeText("CROWN", x0, 270 * s);
  ctx.strokeText("CITY", x0, 354 * s);
  ctx.fillStyle = "#ffe27a";
  ctx.fillText("CROWN", x0, 270 * s);
  ctx.fillText("CITY", x0, 354 * s);
  ctx.font = `${Math.round(22 * s)}px system-ui`;
  ctx.fillStyle = "rgba(255,255,255,0.82)";
  ctx.fillText("The house always wins. Until it doesn't.", x0, 410 * s);
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.font = `${Math.round(16 * s)}px system-ui`;
  ctx.fillText("A fan-made top-down heist in the desert neon.", x0, 438 * s);

  const items = G.saveExists ? ["NEW GAME", "CONTINUE", "SETTINGS", "FULL SCREEN"] : ["NEW GAME", "SETTINGS", "FULL SCREEN"];
  let y = 520 * s;
  items.forEach((it, i) => {
    const sel = i === G.titleSel;
    ctx.font = `700 ${Math.round(sel ? 30 : 26) * s}px system-ui`;
    ctx.fillStyle = sel ? "#f2c14e" : "rgba(255,255,255,0.82)";
    ctx.fillText((sel ? "▸  " : "    ") + it, x0, y + 28 * s);
    y += 58 * s;
  });

  // Chaos hero, right side, face kept clear of type
  if (assets.hero) {
    const im = assets.hero;
    const hH = H * 0.92;
    const sc = hH / im.height;
    const dw = im.width * sc, dh = im.height * sc;
    const hx = W - dw + 20 * s, hy = H - dh + 10 * s;
    ctx.save();
    ctx.shadowColor = "rgba(255, 45, 155, 0.35)";
    ctx.shadowBlur = 40 * s;
    ctx.drawImage(im, hx, hy, dw, dh);
    ctx.restore();
  }

  ctx.fillStyle = "rgba(255,255,255,0.4)";
  ctx.font = `${Math.round(13 * s)}px system-ui`;
  ctx.textAlign = "left";
  ctx.fillText("Fan-made. Play chips only. Not affiliated with MetaWin or any studio.", 24 * s, H - 16 * s);
}


function drawPause(G) {
  const { ctx, canvas } = G;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = "rgba(4,2,10,0.72)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const items = ["RESUME", "SETTINGS", "SAVE", "TITLE"];
  ctx.textAlign = "center";
  ctx.font = "800 56px 'Arial Black', system-ui";
  ctx.fillStyle = "#f2c14e";
  ctx.fillText("PAUSED", canvas.width / 2, canvas.height * 0.26);
  ctx.fillStyle = "#ff2d9b";
  ctx.fillRect(canvas.width / 2 - 40, canvas.height * 0.28, 80, 3);
  ctx.font = "700 24px system-ui";
  items.forEach((it, i) => {
    const sel = i === G.settingsSel;
    ctx.fillStyle = sel ? "#29f0ff" : "#fff";
    ctx.fillText((sel ? "▸  " : "") + it, canvas.width / 2, canvas.height * 0.4 + i * 44);
  });
}

function drawSettings(G) {
  const { ctx, canvas } = G;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = "rgba(4,2,10,0.72)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const rows = [
    `SFX  ${Math.round(G.audio.sfxVol * 100)}%`,
    `MUSIC  ${Math.round(G.audio.musVol * 100)}%`,
    `CAMERA  ${G.cam.northUp ? "NORTH UP" : "CHASE"}`,
    `RADIO  ${G.audio.stations[G.audio.station].name}`,
    "FULL SCREEN",
    "BACK",
  ];
  ctx.textAlign = "center";
  ctx.font = "800 44px 'Arial Black', system-ui";
  ctx.fillStyle = "#f2c14e";
  ctx.fillText("SETTINGS", canvas.width / 2, canvas.height * 0.20);
  ctx.fillStyle = "#ff2d9b";
  ctx.fillRect(canvas.width / 2 - 40, canvas.height * 0.22, 80, 3);
  ctx.font = "700 22px system-ui";
  rows.forEach((it, i) => {
    const sel = i === G.settingsSel;
    ctx.fillStyle = sel ? "#29f0ff" : "#fff";
    ctx.fillText((sel ? "▸  " : "") + it, canvas.width / 2, canvas.height * 0.34 + i * 42);
  });
}

function drawVN(G) {
  const { ctx, canvas, assets } = G;
  const n = G.vn.node;
  const bg = assets.sprites["vn_" + n.bg] || assets.title;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(bg, 0, 0, canvas.width, canvas.height);
  // pass 7: calm the busy backdrop so portraits pop (dim + vignette)
  {
    const g = ctx.createRadialGradient(canvas.width / 2, canvas.height * 0.4, canvas.height * 0.2, canvas.width / 2, canvas.height * 0.4, canvas.width * 0.7);
    g.addColorStop(0, "rgba(8,4,18,0.38)");
    g.addColorStop(1, "rgba(4,2,10,0.82)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  const vk = Math.max(1, Math.min(1.6, canvas.height / 720));
  // portraits occupy the TOP 72%, text sits in the bottom band — never over faces
  const faceH = canvas.height * 0.70;
  const faceY = canvas.height * 0.04;
  const drawPort = (id, side) => {
    if (!id) return;
    let im = assets.sprites["port_" + id];
    if (id === "vera") {
      const cycle = ((G.vn.t / 2.6) | 0) % 3;
      im = cycle === 1 && assets.sprites.port_vera_point ? assets.sprites.port_vera_point
        : cycle === 2 && assets.sprites.port_vera_cross ? assets.sprites.port_vera_cross
        : im;
    }
    if (!im) return;
    const w = canvas.width * 0.34;
    const h = faceH;
    const x = side === "left" ? canvas.width * 0.03 : canvas.width * 0.63;
    const bob = Math.sin((G.vn.t || 0) * 1.4 + (side === "left" ? 0 : 1)) * 6;
    const breathe = 1 + Math.sin((G.vn.t || 0) * 1.1) * 0.016;
    const intro = 1 - Math.min(1, (G.vn.wipe || 0) / 0.32) * 0.04;
    ctx.save();
    rounded(ctx, x, faceY, w, h, 18);
    ctx.clip();
    const scale = Math.max(w / im.width, h / im.height) * breathe * intro;
    const dw = im.width * scale, dh = im.height * scale;
    // bias upward so faces stay high; bob never pushes them into the text band
    ctx.drawImage(im, x + (w - dw) / 2, faceY + (h - dh) * 0.08 + bob, dw, dh);
    // listener steps back a touch; speaker keeps full light + a thin rim in their colour
    const speaking = n.speaker === id;
    if (!speaking && n.speaker) { ctx.fillStyle = "rgba(6,4,14,0.38)"; ctx.fillRect(x, faceY, w, h); }
    ctx.restore();
    if (speaking && CHAR[id]) {
      ctx.save(); rounded(ctx, x, faceY, w, h, 18);
      ctx.strokeStyle = CHAR[id].color; ctx.globalAlpha = 0.75; ctx.lineWidth = 2; ctx.stroke(); ctx.restore();
    }
    // name
    const ch = CHAR[id];
    ctx.font = "700 18px system-ui";
    ctx.fillStyle = ch.color;
    ctx.textAlign = side === "left" ? "left" : "right";
    ctx.fillText(ch.name, side === "left" ? x + 8 : x + w - 8, faceY + h + 4);
  };
  if (n.left) drawPort(n.left, "left");
  if (n.right) drawPort(n.right, "right");
  // dialogue box BOTTOM
  const boxY = canvas.height * 0.76;
  ctx.fillStyle = "rgba(6,4,12,0.90)";
  ctx.fillRect(0, boxY, canvas.width, canvas.height - boxY);
  ctx.fillStyle = "#f2c14e";
  ctx.fillRect(0, boxY, canvas.width, 3);
  ctx.fillStyle = "#ff2d9b";
  ctx.fillRect(0, boxY + 3, canvas.width, 1);
  const sp = CHAR[n.speaker];
  ctx.font = `700 ${Math.round(18 * vk)}px system-ui`;
  ctx.fillStyle = sp ? sp.color : "#fff";
  ctx.textAlign = "left";
  ctx.fillText(sp ? sp.name : "", canvas.width * 0.05, boxY + 28 * vk);
  ctx.fillStyle = "#f2f2f6";
  ctx.font = `${Math.round(18 * vk)}px system-ui`;
  const shown = (n.text || "").slice(0, Math.max(0, G.vn.char | 0));
  wrapText(ctx, shown, canvas.width * 0.05, boxY + 56 * vk, canvas.width * 0.9, 24 * vk);

  const choices = n.choices || [];
  choices.forEach((ch, i) => {
    ctx.fillStyle = i === G.vn.sel ? "#f2c14e" : "rgba(255,255,255,0.85)";
    ctx.fillText((i === G.vn.sel ? "▸ " : "  ") + ch.label, canvas.width * 0.05, boxY + (56 + 44 + i * 30) * vk);
  });
  if (!choices.length) {
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.font = "14px system-ui";
    ctx.textAlign = "right";
    ctx.fillText("E / Space / tap  —  continue", canvas.width * 0.95, canvas.height - 16);
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
  const { ctx, canvas, assets } = G;
  ctx.drawImage(assets.title, 0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "rgba(6,4,12,0.55)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.textAlign = "center";
  ctx.fillStyle = "#f2c14e";
  ctx.font = "700 48px system-ui";
  ctx.fillText("THE HOUSE DIDN'T WIN.", canvas.width / 2, canvas.height * 0.28);
  ctx.fillStyle = "#fff";
  ctx.font = "22px system-ui";
  ctx.fillText("You never typed the phrase. Play chips only.", canvas.width / 2, canvas.height * 0.38);
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.font = "16px system-ui";
  ctx.fillText("Space  —  title", canvas.width / 2, canvas.height * 0.7);
}

/* -------------------- API for tests -------------------- */
function api(G) {
  return {
    G,
    startNew: () => startNew(G),
    skipVN: () => {
      if (G.scene !== "vn") return;
      const n = G.vn.node;
      if (n.choices) { Object.assign(G.flags, n.choices[0].set || {}); openVN(G, n.choices[0].next); }
      else openVN(G, n.next);
    },
    skipAllVN: () => { let g = 0; while (G.scene === "vn" && g++ < 20) api(G).skipVN(); },
    goto: (x, y) => { if (G.player.type === "veh") { G.player.x = x; G.player.y = y; } else { G.player.x = x; G.player.y = y; } G.cam.x = x; G.cam.y = y; },
    enterNearest: () => tryEnter(G, true),
    showBanner: (title, sub, kind) => showBanner(G, title, sub, kind),
    exit: () => { if (G.player.type === "veh") exitVeh(G); },
    setWanted: (n) => { const prev = G.wanted; G.wanted = n; G.wantedCool = 10; if (prev < 3 && n >= 3 && G.audio.chaseSwell) G.audio.chaseSwell(); },
    setTime: (t) => { G.time = t; },
    setWeather: (w) => { G.weather = w; G.weatherT = 40; },
    completeObjective: () => advanceObjective(G),
    completeMission: () => completeMission(G, true),
    save: () => save(G),
    state: () => ({
      scene: G.scene, mission: G.missionIndex, obj: G.objectiveIndex, chips: G.chips,
      wanted: G.wanted, time: G.time, weather: G.weather, x: G.player.x, y: G.player.y,
      mode: G.player.type, kind: G.player.kind, flags: { ...G.flags }, hint: G.hint, errors: 0,
    }),
  };
}
