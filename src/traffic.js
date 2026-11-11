/* Road graph, lane-following traffic with turns + lights, ambient pedestrians, nav field for cops. */
import { CORE, WORLD_W, WORLD_H } from "./world.js";
const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;

export function buildGraph(W, meta) {
  const segs = [];
  for (const s of W.roads) {
    const a = s.v ? [s.c, s.a] : [s.a, s.c], b = s.v ? [s.c, s.b] : [s.b, s.c];
    segs.push({ a, b, w: s.w, lanes: s.lanes, med: s.med, k: s.k });
  }
  for (const r of meta.roads || []) {
    if (r.k === "track") continue;
    const lanes = r.k === "strip" ? 3 : r.w >= 180 ? 2 : 1;
    const med = r.k === "strip" ? 72 : 0;
    segs.push({ a: r.a.slice(), b: r.b.slice(), w: r.w, lanes, med, k: r.k });
  }
  const nodes = [], nmap = new Map();
  const nodeAt = (x, y) => {
    const k = Math.round(x / 6) + "," + Math.round(y / 6);
    let n = nmap.get(k);
    if (!n) {
      for (const m of nodes) if (Math.abs(m.x - x) < 14 && Math.abs(m.y - y) < 14) { n = m; break; }
      if (!n) { n = { x, y, edges: [], id: nodes.length, hw: 0, hh: 0, sig: false }; nodes.push(n); }
      nmap.set(k, n);
    }
    return n;
  };
  const isV = (s) => Math.abs(s.a[0] - s.b[0]) < 1;
  const isH = (s) => Math.abs(s.a[1] - s.b[1]) < 1;
  for (const s of segs) {
    const pts = [s.a, s.b];
    for (const o of segs) {
      if (o === s) continue;
      if (isV(s) && isH(o)) {
        const x = s.a[0], y = o.a[1];
        if (y > Math.min(s.a[1], s.b[1]) + 1 && y < Math.max(s.a[1], s.b[1]) - 1 && x >= Math.min(o.a[0], o.b[0]) - 1 && x <= Math.max(o.a[0], o.b[0]) + 1) pts.push([x, y]);
      } else if (isH(s) && isV(o)) {
        const y = s.a[1], x = o.a[0];
        if (x > Math.min(s.a[0], s.b[0]) + 1 && x < Math.max(s.a[0], s.b[0]) - 1 && y >= Math.min(o.a[1], o.b[1]) - 1 && y <= Math.max(o.a[1], o.b[1]) + 1) pts.push([x, y]);
      }
      // endpoint of o lying on s (T junctions)
      for (const e of [o.a, o.b]) {
        if (isV(s) && Math.abs(e[0] - s.a[0]) < 2 && e[1] > Math.min(s.a[1], s.b[1]) + 1 && e[1] < Math.max(s.a[1], s.b[1]) - 1) pts.push([s.a[0], e[1]]);
        if (isH(s) && Math.abs(e[1] - s.a[1]) < 2 && e[0] > Math.min(s.a[0], s.b[0]) + 1 && e[0] < Math.max(s.a[0], s.b[0]) - 1) pts.push([e[0], s.a[1]]);
      }
    }
    const dx = s.b[0] - s.a[0], dy = s.b[1] - s.a[1], L = Math.hypot(dx, dy) || 1;
    pts.sort((p, q) => ((p[0] - s.a[0]) * dx + (p[1] - s.a[1]) * dy) - ((q[0] - s.a[0]) * dx + (q[1] - s.a[1]) * dy));
    const ns = pts.map((p) => nodeAt(p[0], p[1]));
    for (const n of ns) { if (isV(s)) n.hw = Math.max(n.hw, s.w / 2); else if (isH(s)) n.hh = Math.max(n.hh, s.w / 2); else { n.hw = Math.max(n.hw, s.w / 3); n.hh = Math.max(n.hh, s.w / 3); } }
    for (let i = 0; i < ns.length - 1; i++) {
      const A = ns[i], B = ns[i + 1];
      if (A === B) continue;
      const len = Math.hypot(B.x - A.x, B.y - A.y);
      if (len < 20) continue;
      const e = { A, B, len, dx: (B.x - A.x) / len, dy: (B.y - A.y) / len, w: s.w, lanes: s.lanes, med: s.med, k: s.k, id: 0 };
      A.edges.push(e); B.edges.push(e);
    }
  }
  const edges = [];
  for (const n of nodes) for (const e of n.edges) if (!edges.includes(e)) { e.id = edges.length; edges.push(e); }
  // signals
  const sigs = (meta.signals || []).concat(W.signals || []);
  for (const s of sigs) {
    let best = null, bd = 60;
    for (const n of nodes) { const d = Math.hypot(n.x - s.x, n.y - s.y); if (d < bd) { bd = d; best = n; } }
    if (best && best.edges.length >= 3) best.sig = true;
  }
  return { nodes, edges };
}

export function laneOff(e, lane) {
  const laneW = (e.w / 2 - e.med / 2) / e.lanes;
  return e.med / 2 + laneW * (lane + 0.5);
}
// point on edge travelling forward (A->B) or backward, at distance s from the start node
export function edgePoint(e, fwd, s, lane) {
  const dx = fwd ? e.dx : -e.dx, dy = fwd ? e.dy : -e.dy;
  const S = fwd ? e.A : e.B;
  const off = laneOff(e, lane);
  return { x: S.x + dx * s + (-dy) * off, y: S.y + dy * s + dx * off, rot: Math.atan2(dx, -dy), dx, dy };
}
function trimAt(n, e) {
  if (n.edges.length <= 1) return 0;
  const horizontal = Math.abs(e.dx) > Math.abs(e.dy);
  return (horizontal ? n.hw : n.hh) + 8;
}
export function lightGreen(G, n, e) {
  if (!n.sig) return true;
  const phase = ((G.ticks / 60) % 16);
  const ns = Math.abs(e.dy) > Math.abs(e.dx);
  return ns ? phase < 6.6 : (phase >= 8 && phase < 14.6);
}

const KSPEED = { highway: 165, strip: 120, boulevard: 120, coast: 110, arterial: 105, street: 72 };

export function createTraffic(G) {
  const graph = G.graph;
  const T = {
    target: 34,
    spawnCar(near, minD, maxD, kind) {
      for (let tries = 0; tries < 24; tries++) {
        const e = graph.edges[(Math.random() * graph.edges.length) | 0];
        const fwd = Math.random() < 0.5;
        const t0 = trimAt(fwd ? e.A : e.B, e), t1 = trimAt(fwd ? e.B : e.A, e);
        if (e.len - t0 - t1 < 60) continue;
        const s = t0 + Math.random() * (e.len - t0 - t1);
        const lane = (Math.random() * e.lanes) | 0;
        const p = edgePoint(e, fwd, s, lane);
        const d = Math.hypot(p.x - near.x, p.y - near.y);
        if (d < minD || d > maxD) continue;
        if (G.vehicles.some((v) => Math.abs(v.x - p.x) < 90 && Math.abs(v.y - p.y) < 90)) continue;
        const kinds = ["fare", "fare", "dart", "riot", "taxi", "fare", "dart", "bus", "fare", "taxi", "stitch", "hog"];
        const k = kind || kinds[(Math.random() * kinds.length) | 0];
        const v = G.makeVeh(k, p.x, p.y, p.rot, { parked: false, traffic: true, tr: { e, fwd, s, lane, spd: 0, turn: null }, ambient: true });
        v.cruise = (KSPEED[e.k] || 100) * (0.8 + Math.random() * 0.3) * (k === "bus" ? 0.7 : 1);
        G.vehicles.push(v);
        return v;
      }
      return null;
    },
    tick(dt) {
      const P = G.player;
      // population
      let n = 0;
      for (const v of G.vehicles) if (v.traffic && v.tr) n++;
      if (G.ticks % 15 === 0) {
        { const vw = G.canvas.width / (G.cam.scale || 1) * 0.55, vh = G.canvas.height / (G.cam.scale || 1) * 0.55; const minD = Math.hypot(vw, vh) + 60; for (let k = 0; k < 3 && n + k < T.target; k++) T.spawnCar(P, minD, minD + 900); }
        G.vehicles = G.vehicles.filter((v) => {
          if (v === P || v.mission || v.isVan || v.role === "boat" || v.chasing || v.pdCar || v.keep) return true;
          if (!v.ambient && !v.loose) return true;
          return Math.hypot(v.x - P.x, v.y - P.y) < 2400;
        });
      }
      // spatial hash for following
      const hash = new Map();
      const HK = (x, y) => ((x / 160) | 0) + ((y / 160) | 0) * 1000;
      for (const v of G.vehicles) { const k = HK(v.x, v.y); if (!hash.has(k)) hash.set(k, []); hash.get(k).push(v); }
      if (P.type === "foot") { const k = HK(P.x, P.y); if (!hash.has(k)) hash.set(k, []); hash.get(k).push(P); }
      for (const p of G.peds) if (!p.dead && p.onRoad) { const k = HK(p.x, p.y); if (!hash.has(k)) hash.set(k, []); hash.get(k).push(p); }
      const ahead = (v, hx, hy, range) => {
        let best = range;
        const cx = (v.x / 160) | 0, cy = (v.y / 160) | 0;
        for (let ix = cx - 1; ix <= cx + 1; ix++) for (let iy = cy - 1; iy <= cy + 1; iy++) {
          const l = hash.get(ix + iy * 1000); if (!l) continue;
          for (const o of l) {
            if (o === v) continue;
            const dx = o.x - v.x, dy = o.y - v.y;
            const f = dx * hx + dy * hy;
            if (f <= 0 || f > best) continue;
            const lat = Math.abs(-dx * hy + dy * hx);
            if (lat < (o.type === "veh" || o.def ? 30 : 18)) best = f;
          }
        }
        return best;
      };
      for (const v of G.vehicles) {
        const tr = v.tr;
        if (!v.traffic || !tr || v === P) continue;
        if (Math.abs(v.x - P.x) > 2600 || Math.abs(v.y - P.y) > 2600) continue;
        const hx = Math.sin(v.rot), hy = -Math.cos(v.rot);
        let want = v.cruise;
        const gap = ahead(v, hx, hy, 170);
        if (gap < 170) want = Math.min(want, Math.max(0, (gap - 62) * 1.6));
        if (gap < 64) want = 0;
        v.blockedT = gap < 70 ? (v.blockedT || 0) + dt : 0;
        if (v.blockedT > 2.5 && P.type === "veh" && Math.hypot(P.x - v.x, P.y - v.y) < 140 && !v.honked) { v.honked = true; if (G.audio.horn) G.audio.horn(); }
        if (v.blockedT < 0.5) v.honked = false;
        const e = tr.e;
        if (!tr.turn) {
          const end = tr.fwd ? e.B : e.A;
          const stopAt = e.len - trimAt(end, e);
          const toStop = stopAt - tr.s;
          if (end.sig && !lightGreen(G, end, e) && toStop > 4 && toStop < 150) want = Math.min(want, Math.max(0, (toStop - 10) * 1.4));
          if (end.edges.length > 1 && toStop < 90) want = Math.min(want, Math.max(45, v.cruise * 0.55));
          tr.spd = lerp(tr.spd, want, (want < tr.spd ? 4 : 1.2) * dt);
          tr.s += tr.spd * dt;
          if (tr.s >= stopAt) {
            // pick next edge
            const opts = end.edges.filter((o) => o !== e);
            let ne = opts.length ? opts[(Math.random() * opts.length) | 0] : e;
            // prefer straight on bigger roads
            const straight = opts.find((o) => Math.abs((o.A === end ? o.dx : -o.dx) * (tr.fwd ? e.dx : -e.dx) + (o.A === end ? o.dy : -o.dy) * (tr.fwd ? e.dy : -e.dy)) > 0.9);
            if (straight && Math.random() < 0.55) ne = straight;
            const nfwd = ne.A === end;
            const nlane = Math.min(tr.lane, ne.lanes - 1);
            const ns = trimAt(end, ne);
            const p0 = edgePoint(e, tr.fwd, tr.s, tr.lane);
            const p2 = edgePoint(ne, nfwd, ne === e ? 0 : ns, nlane);
            let p1;
            const den = p0.dx * p2.dy - p0.dy * p2.dx;
            if (Math.abs(den) < 0.2) p1 = ne === e ? { x: end.x + p0.dx * 60, y: end.y + p0.dy * 60 } : { x: (p0.x + p2.x) / 2, y: (p0.y + p2.y) / 2 };
            else {
              const t = ((p2.x - p0.x) * p2.dy - (p2.y - p0.y) * p2.dx) / den;
              p1 = { x: p0.x + p0.dx * t, y: p0.y + p0.dy * t };
            }
            if (ne === e) { tr.fwd = !tr.fwd; }
            const L = Math.hypot(p1.x - p0.x, p1.y - p0.y) + Math.hypot(p2.x - p1.x, p2.y - p1.y);
            tr.turn = { p0, p1, p2, u: 0, L: Math.max(10, L), ne, nfwd: ne === e ? tr.fwd : nfwd, nlane, ns: ne === e ? 0 : ns };
            v.turnSign = Math.sign((p0.dx * p2.dy - p0.dy * p2.dx)) || 0;
          } else {
            const p = edgePoint(e, tr.fwd, tr.s, tr.lane);
            v.x = p.x; v.y = p.y;
            v.rot = v.rot + ((((p.rot - v.rot + Math.PI) % TAU) + TAU) % TAU - Math.PI) * Math.min(1, 10 * dt);
            v.turnSign = 0;
          }
        }
        if (tr.turn) {
          const t = tr.turn;
          tr.spd = lerp(tr.spd, Math.min(want, 70), 3 * dt);
          t.u += tr.spd * dt / t.L;
          const u = Math.min(1, t.u), iu = 1 - u;
          const x = iu * iu * t.p0.x + 2 * iu * u * t.p1.x + u * u * t.p2.x;
          const y = iu * iu * t.p0.y + 2 * iu * u * t.p1.y + u * u * t.p2.y;
          const tx = 2 * iu * (t.p1.x - t.p0.x) + 2 * u * (t.p2.x - t.p1.x), ty = 2 * iu * (t.p1.y - t.p0.y) + 2 * u * (t.p2.y - t.p1.y);
          v.x = x; v.y = y;
          if (Math.hypot(tx, ty) > 0.01) v.rot = Math.atan2(tx, -ty);
          if (t.u >= 1) { tr.e = t.ne; tr.fwd = t.nfwd; tr.lane = t.nlane; tr.s = t.ns; tr.turn = null; v.turnSign = 0; }
        }
        v.vx = Math.sin(v.rot) * tr.spd; v.vy = -Math.cos(v.rot) * tr.spd;
        v.braking = want < tr.spd - 5 || tr.spd < 3;
        v.fwd = tr.spd;
      }
    },
  };
  return T;
}

/* ---------- pedestrians ---------- */
const PED_SPR = ["m1", "m2", "m3", "m4", "worker", "cabbie", "prime", "valet", "guest", "synth", "m1", "m3"];
export function createPeds(G) {
  const surf = (x, y) => G.surfaceAt(x, y);
  const P = {
    target: 64,
    spawn(near, minD, maxD) {
      for (let i = 0; i < 30; i++) {
        const a = Math.random() * TAU, d = minD + Math.random() * (maxD - minD);
        const x = near.x + Math.cos(a) * d, y = near.y + Math.sin(a) * d;
        if (surf(x, y) !== "walk") continue;
        // orient along the sidewalk
        const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => surf(x + dx * 40, y + dy * 40) === "walk");
        const dd = dirs.length ? dirs[(Math.random() * dirs.length) | 0] : [1, 0];
        const n = Math.random() < 0.3 ? 2 : 1;
        for (let k = 0; k < n; k++) {
          G.peds.push({
            x: x + k * 14 * -dd[1], y: y + k * 14 * dd[0], rot: Math.atan2(dd[0], -dd[1]), vx: 0, vy: 0,
            sprite: PED_SPR[(Math.random() * PED_SPR.length) | 0], speed: 0, walk: 26 + Math.random() * 22,
            dist: Math.random() * 20, flee: 0, r: 8, hp: 30, dead: false, ambient: true, idle: 0, hx: dd[0], hy: dd[1],
          });
        }
        return true;
      }
      return false;
    },
    tick(dt) {
      const pl = G.player;
      if (G.ticks % 10 === 0) {
        const live = G.peds.filter((p) => !p.dead && p.ambient).length;
        if (live < P.target) { const vw = G.canvas.width / (G.cam.scale || 1) * 0.55, vh = G.canvas.height / (G.cam.scale || 1) * 0.55; const minD = Math.hypot(vw, vh) + 40; for (let k = 0; k < 3 && live + k < P.target; k++) P.spawn(pl, minD, minD + 600); }
        G.peds = G.peds.filter((p) => !p.ambient || Math.hypot(p.x - pl.x, p.y - pl.y) < 1700 || (p.dead && p.deadT < 30));
      }
    },
    walkAmbient(p, dt) {
      // stays on sidewalks, turns at corners, crosses at green
      if (p.idle > 0) { p.idle -= dt; p.speed = 0; return; }
      if (Math.random() < 0.0015) { p.idle = 1.5 + Math.random() * 3; return; }
      const look = 18;
      const ahead = surf(p.x + p.hx * look, p.y + p.hy * look);
      const ok = (s) => s === "walk" || s === "grass" || s === "pier" || s === "sand";
      if (p.crossing) {
        if (ok(ahead) && surf(p.x, p.y) !== "road") p.crossing = false;
      } else if (!ok(ahead)) {
        if (ahead === "road" && Math.random() < 0.35 && G.crossOk && G.crossOk(p)) { p.crossing = true; }
        else {
          const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => !(dx === -p.hx && dy === -p.hy) && ok(surf(p.x + dx * look, p.y + dy * look)));
          const d = dirs.length ? dirs[(Math.random() * dirs.length) | 0] : [-p.hx, -p.hy];
          p.hx = d[0]; p.hy = d[1];
        }
      }
      const tr = Math.atan2(p.hx, -p.hy);
      p.rot = p.rot + ((((tr - p.rot + Math.PI) % TAU) + TAU) % TAU - Math.PI) * Math.min(1, 8 * dt);
      const sp = p.crossing ? p.walk * 1.4 : p.walk;
      p.x += Math.sin(p.rot) * sp * dt; p.y += -Math.cos(p.rot) * sp * dt;
      p.speed = sp; p.dist += sp * dt;
      p.onRoad = p.crossing;
    },
  };
  return P;
}

/* ---------- nav field (cars) ---------- */
export function createNav(G) {
  let N_raw = null;
  const C = 32, NW = Math.ceil(WORLD_W / C), NH = Math.ceil(WORLD_H / C);
  const pass = new Uint8Array(NW * NH);
  for (let y = 0; y < NH; y++) for (let x = 0; x < NW; x++) {
    let ok = 1;
    for (const [ox, oy] of [[16, 16], [6, 6], [26, 6], [6, 26], [26, 26]]) {
      const s = G.surfaceAt(x * C + ox, y * C + oy);
      if (s === "build" || s === "water" || s === "canal") { ok = 0; break; }
    }
    pass[y * NW + x] = ok;
  }
  // cars need room: erode by one cell so the flow field never threads 1-cell alleys
  {
    const raw = pass.slice();
    for (let y = 1; y < NH - 1; y++) for (let x = 1; x < NW - 1; x++) {
      const i = y * NW + x;
      if (raw[i] && !(raw[i - 1] && raw[i + 1] && raw[i - NW] && raw[i + NW])) pass[i] = 0;
    }
    N_raw = raw;
  }
  const dist = new Uint16Array(NW * NH);
  const q = new Int32Array(NW * NH);
  const N = {
    C, NW, NH, pass, dist, t: 0, get raw() { return N_raw; },
    update(tx, ty, force) {
      N.t -= 1;
      if (N.t > 0 && !force) return;
      N.t = 24;
      N.flood(dist, tx, ty, 170);
    },
    flood(D, tx, ty, maxD) {
      D.fill(65535);
      let cx = clamp((tx / C) | 0, 0, NW - 1), cy = clamp((ty / C) | 0, 0, NH - 1);
      if (!pass[cy * NW + cx]) {
        outer: for (let r = 1; r < 6; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
          const x = cx + dx, y = cy + dy; if (x < 0 || y < 0 || x >= NW || y >= NH) continue;
          if (pass[y * NW + x]) { cx = x; cy = y; break outer; }
        }
      }
      let h = 0, t = 0;
      q[t++] = cy * NW + cx; D[cy * NW + cx] = 0;
      while (h < t) {
        const i = q[h++]; const d = D[i];
        if (d > maxD) continue;
        const x = i % NW, y = (i / NW) | 0;
        if (x > 0) { const j = i - 1; if (pass[j] && D[j] === 65535) { D[j] = d + 1; q[t++] = j; } }
        if (x < NW - 1) { const j = i + 1; if (pass[j] && D[j] === 65535) { D[j] = d + 1; q[t++] = j; } }
        if (y > 0) { const j = i - NW; if (pass[j] && D[j] === 65535) { D[j] = d + 1; q[t++] = j; } }
        if (y < NH - 1) { const j = i + NW; if (pass[j] && D[j] === 65535) { D[j] = d + 1; q[t++] = j; } }
      }
    },
    // GPS: route polyline from (x,y) to the target of field R
    route(R, x, y) {
      let cx = clamp((x / C) | 0, 0, NW - 1), cy = clamp((y / C) | 0, 0, NH - 1);
      const pts = [];
      if (R[cy * NW + cx] === 65535) return pts;
      for (let s = 0; s < 900; s++) {
        let best = R[cy * NW + cx], bx = cx, by = cy;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = cx + dx, ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= NW || ny >= NH) continue;
          const d = R[ny * NW + nx]; if (d < best) { best = d; bx = nx; by = ny; }
        }
        if (bx === cx && by === cy) break;
        cx = bx; cy = by;
        if (s % 3 === 0) pts.push(cx * C + C / 2, cy * C + C / 2);
      }
      return pts;
    },
    // returns a steering point a few cells downhill from (x,y)
    next(x, y, steps = 3) {
      let cx = clamp((x / C) | 0, 0, NW - 1), cy = clamp((y / C) | 0, 0, NH - 1);
      if (dist[cy * NW + cx] === 65535) {
        // off the car grid (curb, eroded edge): head for the best nearby reachable cell
        let bd = 65535, bx = -1, by = -1;
        for (let r = 1; r <= 4 && bx < 0; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
          const nx = cx + dx, ny = cy + dy; if (nx < 0 || ny < 0 || nx >= NW || ny >= NH) continue;
          const d = dist[ny * NW + nx]; if (d < bd) { bd = d; bx = nx; by = ny; }
        }
        if (bx < 0) return null;
        return { x: bx * C + C / 2, y: by * C + C / 2, d: bd };
      }
      for (let s = 0; s < steps; s++) {
        let best = dist[cy * NW + cx], bx = cx, by = cy;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
          const nx = cx + dx, ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= NW || ny >= NH) continue;
          if (dx && dy && (!pass[cy * NW + nx] || !pass[ny * NW + cx])) continue;
          const d = dist[ny * NW + nx];
          if (d < best) { best = d; bx = nx; by = ny; }
        }
        if (bx === cx && by === cy) break;
        cx = bx; cy = by;
      }
      return { x: cx * C + C / 2, y: cy * C + C / 2, d: dist[cy * NW + cx] };
    },
    clearLine(x0, y0, x1, y1) {
      const L = Math.hypot(x1 - x0, y1 - y0), n = Math.ceil(L / 24);
      for (let i = 1; i < n; i++) {
        const x = x0 + (x1 - x0) * i / n, y = y0 + (y1 - y0) * i / n;
        if (!N_raw[((y / C) | 0) * NW + ((x / C) | 0)]) return false;
      }
      return true;
    },
  };
  return N;
}
