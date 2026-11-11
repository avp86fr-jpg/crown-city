/* Streaming tile layers, chunked procedural ground, extruded buildings, trees. */
import { CORE, WORLD_W, WORLD_H, CELL, GW, GH, CODE } from "./world.js";

const TAU = Math.PI * 2;
export function loadImg(src) {
  const im = new Image();
  im.decoding = "async";
  im.src = src;
  return im.decode().then(() => im);
}

export class TileLayer {
  constructor(name, keys, size, ext = "webp") {
    this.name = name; this.keys = new Set(keys); this.size = size; this.ext = ext;
    this.img = new Map(); this.pending = new Set(); this.used = new Map();
  }
  get(tx, ty, frame) {
    const k = tx + "_" + ty;
    if (!this.keys.has(k)) return null;
    this.used.set(k, frame);
    const im = this.img.get(k);
    if (im) return im;
    if (!this.pending.has(k)) {
      this.pending.add(k);
      loadImg(`assets/tiles/${this.name}/${k}.${this.ext}`).then((i) => { this.img.set(k, i); this.pending.delete(k); }).catch(() => this.pending.delete(k));
    }
    return null;
  }
  preload(keys) { return Promise.all([...keys].filter((k) => this.keys.has(k)).map((k) => loadImg(`assets/tiles/${this.name}/${k}.${this.ext}`).then((i) => this.img.set(k, i)).catch(() => {}))); }
  draw(ctx, r, frame) {
    const T = this.size;
    const tx0 = Math.max(0, Math.floor(r.x0 / T)), ty0 = Math.max(0, Math.floor(r.y0 / T));
    const tx1 = Math.min(3, Math.floor(r.x1 / T)), ty1 = Math.min(3, Math.floor(r.y1 / T));
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      const im = this.get(tx, ty, frame);
      if (im) ctx.drawImage(im, tx * T, ty * T, T + 0.5, T + 0.5);
    }
  }
  // copy a world-space rect out of the layer (split across tiles)
  drawRect(ctx, sx, sy, sw, sh, frame, mapFn) {
    const T = this.size;
    const tx0 = Math.floor(sx / T), ty0 = Math.floor(sy / T), tx1 = Math.floor((sx + sw - 1) / T), ty1 = Math.floor((sy + sh - 1) / T);
    let ok = true;
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      const im = this.get(tx, ty, frame);
      if (!im) { ok = false; continue; }
      const ax = Math.max(sx, tx * T), ay = Math.max(sy, ty * T);
      const bx = Math.min(sx + sw, tx * T + T), by = Math.min(sy + sh, ty * T + T);
      if (bx <= ax || by <= ay) continue;
      const d = mapFn(ax, ay, bx, by);
      ctx.drawImage(im, ax - tx * T, ay - ty * T, bx - ax, by - ay, d[0], d[1], d[2], d[3]);
    }
    return ok;
  }
  evict(frame, keep = 600) {
    if (this.img.size < 10) return;
    for (const [k, f] of this.used) if (frame - f > keep && this.img.has(k)) { this.img.delete(k); this.used.delete(k); }
  }
}

/* ---------- procedural ground chunks ---------- */
const CH = 512;
export function makeGround(W, tex, codeAt) {
  const cache = new Map();
  const order = [];
  const pats = {};
  const scratch = document.createElement("canvas").getContext("2d");
  for (const k of Object.keys(tex)) pats[k] = scratch.createPattern(tex[k], "repeat");
  const codeTex = { [CODE.road]: "asphalt", [CODE.walk]: "paver", [CODE.grass]: "grass", [CODE.sand]: "sand", [CODE.track]: "asphalt_hw", [CODE.pier]: "pier", [CODE.lot]: "lot", [CODE.dirt]: "dirt", [CODE.build]: "concrete" };
  const g = W.grid;
  const cellAt = (cx, cy) => (cx < 0 || cy < 0 || cx >= GW || cy >= GH) ? 254 : g[cy * GW + cx];
  function render(ix, iy) {
    const c = document.createElement("canvas");
    c.width = c.height = CH;
    const x = c.getContext("2d");
    const ox = ix * CH, oy = iy * CH;
    x.translate(-ox, -oy);
    const cx0 = ox / CELL, cy0 = oy / CELL, n = CH / CELL;
    let any = false;
    for (let cy = cy0; cy < cy0 + n; cy++) {
      let run = -1, start = 0;
      for (let cx = cx0; cx <= cx0 + n; cx++) {
        const v = cx < cx0 + n ? cellAt(cx, cy) : -2;
        if (v !== run) {
          if (run >= 0 && run !== 255 && run !== CODE.water && run !== CODE.canal) {
            const t = run === CODE.walk && cellDistrict(W, start * CELL, cy * CELL) === "warm" ? "paver_warm" : codeTex[run];
            x.fillStyle = pats[t] || pats.concrete;
            x.fillRect(start * CELL, cy * CELL, (cx - start) * CELL, CELL);
            any = true;
          }
          run = v; start = cx;
        }
      }
    }
    if (!any) return null;
    // curbs + shore foam + grass edges
    for (let cy = cy0; cy < cy0 + n; cy++) for (let cx = cx0; cx < cx0 + n; cx++) {
      const v = cellAt(cx, cy);
      if (v === 255) continue;
      const px = cx * CELL, py = cy * CELL;
      if (v === CODE.walk) {
        const R = cellAt(cx + 1, cy), L = cellAt(cx - 1, cy), U = cellAt(cx, cy - 1), D = cellAt(cx, cy + 1);
        x.fillStyle = "#cfcac0";
        if (R === CODE.road) x.fillRect(px + CELL - 3, py, 3, CELL);
        if (L === CODE.road) x.fillRect(px, py, 3, CELL);
        if (U === CODE.road) x.fillRect(px, py, CELL, 3);
        if (D === CODE.road) x.fillRect(px, py + CELL - 3, CELL, 3);
        x.fillStyle = "rgba(0,0,0,0.25)";
        if (R === CODE.road) x.fillRect(px + CELL, py, 2, CELL);
        if (L === CODE.road) x.fillRect(px - 2, py, 2, CELL);
        if (U === CODE.road) x.fillRect(px, py - 2, CELL, 2);
        if (D === CODE.road) x.fillRect(px, py + CELL, CELL, 2);
      } else if (v === CODE.water) {
        const land = (q) => q !== CODE.water && q !== 254 && q !== CODE.canal;
        x.fillStyle = "rgba(225,240,245,0.32)";
        if (land(cellAt(cx + 1, cy))) x.fillRect(px + CELL - 5, py, 5, CELL);
        if (land(cellAt(cx - 1, cy))) x.fillRect(px, py, 5, CELL);
        if (land(cellAt(cx, cy - 1))) x.fillRect(px, py, CELL, 5);
        if (land(cellAt(cx, cy + 1))) x.fillRect(px, py + CELL - 5, CELL, 5);
      } else if (v === CODE.grass) {
        const e = cellAt(cx, cy - 1);
        if (e !== CODE.grass && e !== 255) { x.fillStyle = "rgba(20,40,10,0.25)"; x.fillRect(px, py, CELL, 3); }
      }
    }
    // road markings
    const rx0 = ox - 400, ry0 = oy - 400, rx1 = ox + CH + 400, ry1 = oy + CH + 400;
    for (const s of W.roads) {
      const r = s.v ? [s.c - s.w / 2, s.a, s.w, s.b - s.a] : [s.a, s.c - s.w / 2, s.b - s.a, s.w];
      if (r[0] > rx1 || r[1] > ry1 || r[0] + r[2] < rx0 || r[1] + r[3] < ry0) continue;
      drawMarkings(x, W, s);
    }
    for (const n of W.inter) {
      if (n.x < rx0 || n.x > rx1 || n.y < ry0 || n.y > ry1) continue;
      drawIntersection(x, W, n, pats);
    }
    for (const l of W.lots) {
      if (l.x > rx1 || l.y > ry1 || l.x + l.w < rx0 || l.y + l.h < ry0) continue;
      drawLot(x, l);
    }
    for (const f of W.features) {
      if (f.x > rx1 + 400 || f.y > ry1 + 400 || f.x + (f.w || 0) < rx0 - 400 || f.y + (f.h || 0) < ry0 - 400) continue;
      drawFeature(x, f, pats);
    }
    for (const p of W.piers) {
      if (p.x > rx1 || p.y > ry1 || p.x + p.w < rx0 || p.y + p.h < ry0) continue;
      x.fillStyle = pats.pier || "#6b5a44"; x.fillRect(p.x, p.y, p.w, p.h);
      x.fillStyle = "rgba(0,0,0,0.35)"; for (let yy = p.y; yy < p.y + p.h; yy += 12) x.fillRect(p.x, yy, p.w, 2);
      x.fillStyle = "#3a3026"; for (let yy = p.y + 20; yy < p.y + p.h; yy += 60) { x.fillRect(p.x - 4, yy, 6, 6); x.fillRect(p.x + p.w - 2, yy, 6, 6); }
    }
    for (const p of W.pools) {
      if (p.x > rx1 || p.y > ry1 || p.x + p.w < rx0 || p.y + p.h < ry0) continue;
      x.fillStyle = "#e9e4da"; x.fillRect(p.x - 4, p.y - 4, p.w + 8, p.h + 8);
      x.fillStyle = "#3fc4e0"; x.fillRect(p.x, p.y, p.w, p.h);
      x.fillStyle = "rgba(255,255,255,0.35)"; x.fillRect(p.x + 3, p.y + 3, p.w - 6, 3);
    }
    // ---- hand-paint pass (baked once per chunk): weathering, stains, patches, cracks, tufts
    {
      let sd = (ix * 73856093) ^ (iy * 19349663); sd = Math.abs(sd) % 233280 || 7;
      const rn = () => ((sd = (sd * 9301 + 49297) % 233280) / 233280);
      for (let i = 0; i < 16; i++) {
        const gx = ox + rn() * CH, gy = oy + rn() * CH, gr = 40 + rn() * 150;
        const k = rn(); const col = k < 0.55 ? "rgba(25,20,15,0.10)" : k < 0.8 ? "rgba(255,236,200,0.06)" : "rgba(90,110,140,0.07)";
        const gd = x.createRadialGradient(gx, gy, 0, gx, gy, gr); gd.addColorStop(0, col); gd.addColorStop(1, "rgba(0,0,0,0)");
        x.fillStyle = gd; x.fillRect(gx - gr, gy - gr, gr * 2, gr * 2);
      }
      for (let i = 0; i < 46; i++) {
        const px = ox + rn() * CH, py = oy + rn() * CH;
        const v = cellAt((px / CELL) | 0, (py / CELL) | 0);
        if (v === CODE.road || v === CODE.lot || v === CODE.track) {
          const t = rn();
          if (t < 0.35) { // oil stain
            const rr = 5 + rn() * 9; x.fillStyle = "rgba(10,8,6,0.22)";
            x.beginPath(); x.ellipse(px, py, rr * 1.6, rr, rn() * 3, 0, TAU); x.fill();
            x.fillStyle = "rgba(10,8,6,0.18)"; x.beginPath(); x.ellipse(px + rr, py + 2, rr * 0.6, rr * 0.4, 0, 0, TAU); x.fill();
          } else if (t < 0.55) { // patch repair
            const pw = 20 + rn() * 50, ph = 14 + rn() * 30; x.fillStyle = rn() < 0.5 ? "rgba(0,0,0,0.13)" : "rgba(255,255,255,0.05)";
            x.fillRect(px, py, pw, ph); x.strokeStyle = "rgba(0,0,0,0.18)"; x.lineWidth = 1; x.strokeRect(px, py, pw, ph);
          } else { // crack
            x.strokeStyle = "rgba(15,12,10,0.38)"; x.lineWidth = 1 + rn();
            x.beginPath(); x.moveTo(px, py); let cx = px, cy = py;
            for (let j = 0; j < 5; j++) { cx += (rn() - 0.5) * 26; cy += (rn() - 0.5) * 26; x.lineTo(cx, cy); }
            x.stroke();
          }
        } else if (v === CODE.grass) {
          const rr = 6 + rn() * 16; x.fillStyle = rn() < 0.5 ? "rgba(30,60,15,0.25)" : "rgba(190,210,110,0.16)";
          x.beginPath(); x.ellipse(px, py, rr, rr * 0.8, 0, 0, TAU); x.fill();
        } else if (v === CODE.walk) {
          if (rn() < 0.5) { x.fillStyle = "rgba(0,0,0,0.12)"; x.beginPath(); x.arc(px, py, 2 + rn() * 3, 0, TAU); x.fill(); } // gum / stains
        }
      }
    }
    // under-building footprint (dark slab, mostly hidden by walls)
    for (const b of W.buildings) {
      if (b.x > rx1 || b.y > ry1 || b.x + b.w < rx0 || b.y + b.h < ry0) continue;
      x.fillStyle = "rgba(20,18,22,0.85)"; x.fillRect(b.x - 2, b.y - 2, b.w + 4, b.h + 4);
    }
    return c;
  }
  return {
    draw(ctx, r, frame) {
      const ix0 = Math.max(0, Math.floor(r.x0 / CH)), iy0 = Math.max(0, Math.floor(r.y0 / CH));
      const ix1 = Math.min(WORLD_W / CH - 1, Math.floor(r.x1 / CH)), iy1 = Math.min(WORLD_H / CH - 1, Math.floor(r.y1 / CH));
      let built = 0;
      for (let iy = iy0; iy <= iy1; iy++) for (let ix = ix0; ix <= ix1; ix++) {
        const k = ix + iy * 100;
        let e = cache.get(k);
        if (!e) {
          if (built >= 2 && frame > 2) continue; // budget per frame
          e = { c: render(ix, iy), f: frame }; built++;
          cache.set(k, e); order.push(k);
        }
        e.f = frame;
        if (e.c) ctx.drawImage(e.c, ix * CH, iy * CH);
      }
      if (cache.size > 70) {
        for (const [k, e] of cache) if (frame - e.f > 240) cache.delete(k);
      }
    },
    warm(r) { this.draw({ drawImage() {} }, r, 0); },
    cache,
  };
}

function cellDistrict(W, x, y) { return (y > 6800 && x < 6500) ? "warm" : "cool"; }

function dash(x, ax, ay, bx, by, on, off, w, col) {
  x.strokeStyle = col; x.lineWidth = w; x.setLineDash(on ? [on, off] : []);
  x.beginPath(); x.moveTo(ax, ay); x.lineTo(bx, by); x.stroke(); x.setLineDash([]);
}
function drawMarkings(x, W, s) {
  const half = s.w / 2;
  const lanes = s.lanes, med = s.med;
  const laneW = (half - med / 2) / lanes;
  const L = (o, a, b) => s.v ? [s.c + o, a, s.c + o, b] : [a, s.c + o, b, s.c + o];
  // trim at intersections handled by drawIntersection painting over
  const a = s.a, b = s.b;
  if (med > 0) {
    // planted median
    const m = s.v ? [s.c - med / 2, a, med, b - a] : [a, s.c - med / 2, b - a, med];
    x.fillStyle = "#cfcac0"; x.fillRect(m[0], m[1], m[2], m[3]);
    x.fillStyle = "#4f7a38"; x.fillRect(m[0] + 4, m[1] + 4, m[2] - 8, m[3] - 8);
  } else if (lanes > 1 || s.k === "street") {
    const p = L(-2, a, b), q = L(2, a, b);
    dash(x, p[0], p[1], p[2], p[3], 0, 0, 2.5, "#e8b830");
    dash(x, q[0], q[1], q[2], q[3], 0, 0, 2.5, "#e8b830");
  }
  for (let k = 1; k < lanes; k++) {
    for (const sg of [-1, 1]) {
      const o = sg * (med / 2 + laneW * k);
      const p = L(o, a, b);
      dash(x, p[0], p[1], p[2], p[3], 22, 26, 2.5, "rgba(240,240,240,0.85)");
    }
  }
  if (s.k === "highway" || s.k === "boulevard") {
    for (const sg of [-1, 1]) { const p = L(sg * (half - 8), a, b); dash(x, p[0], p[1], p[2], p[3], 0, 0, 2.5, "rgba(240,240,240,0.8)"); }
  }
}
function drawIntersection(x, W, n, pats) {
  const hw = n.vs.w / 2, hh = n.hs.w / 2;
  x.fillStyle = pats.asphalt; x.fillRect(n.x - hw, n.y - hh, hw * 2, hh * 2);
  // zebra crossings on each approach (only if that road continues)
  x.fillStyle = "rgba(240,240,236,0.88)";
  const zw = 22;
  const vCont = (dy) => (dy < 0 ? n.y - hh > n.vs.a + 4 : n.y + hh < n.vs.b - 4);
  const hCont = (dx) => (dx < 0 ? n.x - hw > n.hs.a + 4 : n.x + hw < n.hs.b - 4);
  if (n.vs.k === "highway" && n.hs.k === "highway") return;
  for (const dy of [-1, 1]) if (vCont(dy)) {
    const y0 = dy < 0 ? n.y - hh - zw - 6 : n.y + hh + 6;
    if (n.vs.k !== "highway") for (let xx = n.x - hw + 6; xx < n.x + hw - 8; xx += 14) x.fillRect(xx, y0, 8, zw);
    // stop line
    x.fillRect(dy < 0 ? n.x - hw + 4 : n.x + 2, dy < 0 ? y0 - 10 : y0 + zw + 6, hw - 6, 4);
  }
  for (const dx of [-1, 1]) if (hCont(dx)) {
    const x0 = dx < 0 ? n.x - hw - zw - 6 : n.x + hw + 6;
    if (n.hs.k !== "highway") for (let yy = n.y - hh + 6; yy < n.y + hh - 8; yy += 14) x.fillRect(x0, yy, zw, 8);
    x.fillRect(dx < 0 ? x0 - 10 : x0 + zw + 6, dx < 0 ? n.y + 2 : n.y - hh + 4, 4, hh - 6);
  }
}
function drawLot(x, l) {
  if (l.k === "parking" || l.k === "industrial") {
    x.strokeStyle = "rgba(235,235,230,0.55)"; x.lineWidth = 2;
    const rowH = 110;
    for (let y = l.y + 20; y + rowH / 2 < l.y + l.h; y += rowH) {
      for (let xx = l.x + 16; xx < l.x + l.w - 16; xx += 40) {
        x.beginPath(); x.moveTo(xx, y); x.lineTo(xx, y + 46); x.stroke();
      }
    }
    x.fillStyle = "rgba(0,0,0,0.08)";
    for (let i = 0; i < 6; i++) x.fillRect(l.x + ((i * 97) % Math.max(1, l.w - 40)), l.y + ((i * 53) % Math.max(1, l.h - 30)), 30, 18);
  } else if (l.k === "yard") {
    x.fillStyle = "rgba(240,200,40,0.6)";
    for (let xx = l.x; xx < l.x + l.w; xx += 120) x.fillRect(xx, l.y + l.h - 8, 60, 4);
  } else if (l.k === "apron") {
    x.strokeStyle = "rgba(240,200,40,0.8)"; x.lineWidth = 3;
    for (let xx = l.x + 300; xx < l.x + l.w; xx += 600) { x.beginPath(); x.moveTo(xx, l.y); x.quadraticCurveTo(xx, l.y + 150, xx + 160, l.y + 170); x.stroke(); }
  }
}
function drawFeature(x, f, pats) {
  if (f.k === "runway") {
    x.fillStyle = "rgba(245,245,245,0.9)";
    for (let xx = f.x + 160; xx < f.x + f.w - 160; xx += 120) x.fillRect(xx, f.y + f.h / 2 - 3, 60, 6);
    for (const ex of [f.x + 20, f.x + f.w - 100]) for (let yy = f.y + 14; yy < f.y + f.h - 14; yy += 18) x.fillRect(ex, yy, 80, 9);
    x.fillRect(f.x, f.y + 4, f.w, 3); x.fillRect(f.x, f.y + f.h - 7, f.w, 3);
  } else if (f.k === "plaza") {
    x.strokeStyle = "rgba(120,100,80,0.35)"; x.lineWidth = 6;
    x.strokeRect(f.x + 20, f.y + 20, f.w - 40, f.h - 40);
  } else if (f.k === "fountain") {
    x.fillStyle = "#d9d2c2"; x.beginPath(); x.arc(f.x, f.y, f.r * 1.15, 0, TAU); x.fill();
    x.fillStyle = "#4fb8d8"; x.beginPath(); x.arc(f.x, f.y, f.r, 0, TAU); x.fill();
    x.fillStyle = "#d9d2c2"; x.beginPath(); x.arc(f.x, f.y, f.r * 0.25, 0, TAU); x.fill();
  } else if (f.k === "park") {
    x.fillStyle = "rgba(255,255,255,0.05)"; x.fillRect(f.x, f.y, f.w, f.h);
  } else if (f.k === "pond") {
    x.fillStyle = "rgba(60,90,40,0.5)"; x.beginPath(); x.arc(f.x, f.y, f.r * 1.2, 0, TAU); x.fill();
  } else if (f.k === "tanks") {
    for (let i = 0; i < 2; i++) {
      x.fillStyle = "#b8bcc2"; x.beginPath(); x.arc(f.x + i * 70 - 35, f.y, 30, 0, TAU); x.fill();
      x.fillStyle = "rgba(0,0,0,0.2)"; x.beginPath(); x.arc(f.x + i * 70 - 30, f.y + 5, 22, 0, TAU); x.fill();
    }
  }
}

/* ---------- facades + roofs ---------- */
function facade(kind, lit) {
  const c = document.createElement("canvas");
  c.width = 128; c.height = 56;
  const x = c.getContext("2d");
  const fl = 14; // one floor = 14 height units
  for (let f = 0; f < 4; f++) {
    for (let i = 0; i < 8; i++) {
      const wx = i * 16 + 4, wy = f * fl + 4;
      if (lit) {
        const on = ((i * 7 + f * 13 + (kind.length * 3)) % 5) < 2;
        if (!on) continue;
        x.fillStyle = ((i + f) % 3 === 0) ? "rgba(255,214,140,0.95)" : "rgba(255,236,190,0.85)";
        x.fillRect(wx, wy, 9, 7);
      } else {
        x.fillStyle = kind === "glass" ? "rgba(150,200,230,0.5)" : "rgba(20,24,34,0.72)";
        x.fillRect(wx, wy, 9, 7);
        x.fillStyle = "rgba(255,255,255,0.12)"; x.fillRect(wx, wy, 9, 2);
      }
    }
    if (!lit) { x.fillStyle = "rgba(0,0,0,0.12)"; x.fillRect(0, f * fl + fl - 2, 128, 2); }
  }
  return c;
}
export function makeBuildings(W, tex, coreRoofs) {
  const pat = {};
  const s = document.createElement("canvas").getContext("2d");
  for (const k of ["glass", "gravel", "gravel2", "tar", "concrete", "metal", "metal2", "terra", "terra2"]) {
    const t = tex["roof_" + k] || tex[k];
    if (t) pat[k] = s.createPattern(t, "repeat");
  }
  const fac = { day: s.createPattern(facade("std", false), "repeat"), glass: s.createPattern(facade("glass", false), "repeat"), lit: s.createPattern(facade("std", true), "repeat") };
  // spatial bins
  const BIN = 512, bins = new Map();
  const all = W.buildings.concat(W.coreBuildings);
  all.forEach((b, i) => {
    b.seed = (b.x * 31 + b.y * 17) % 997;
    for (let bx = Math.floor(b.x / BIN); bx <= Math.floor((b.x + b.w) / BIN); bx++)
      for (let by = Math.floor(b.y / BIN); by <= Math.floor((b.y + b.h) / BIN); by++) {
        const k = bx + by * 100; if (!bins.has(k)) bins.set(k, []); bins.get(k).push(b);
      }
  });
  const treeBins = new Map();
  for (const t of W.trees) { const k = Math.floor(t.x / BIN) + Math.floor(t.y / BIN) * 100; if (!treeBins.has(k)) treeBins.set(k, []); treeBins.get(k).push(t); }
  function inView(r, binsMap) {
    const out = new Set();
    for (let bx = Math.floor(r.x0 / BIN); bx <= Math.floor(r.x1 / BIN); bx++)
      for (let by = Math.floor(r.y0 / BIN); by <= Math.floor(r.y1 / BIN); by++) {
        const l = binsMap.get(bx + by * 100); if (l) for (const b of l) out.add(b);
      }
    return out;
  }
  const wallCol = (b) => {
    const w = W.WALLS[b.wall] || (b.core ? coreWall(b) : W.WALLS.grey);
    return w;
  };
  function coreWall(b) {
    const k = b.kind;
    if (k === "casino") return ["#3a2436", "#24161f"];
    if (k === "warehouse") return W.WALLS.rust;
    if (k === "office") return W.WALLS.glass;
    if (k === "villa") return W.WALLS.cream;
    if (k === "apt") return W.WALLS.tan;
    return W.WALLS.brick;
  }
  function project(cam, D, px, py, h) {
    const k = h / D;
    return [px + (px - cam.x) * k, py + (py - cam.y) * k];
  }
  // ---- painted roof bake: texture + per-building tint + grime + sun gradient + AO edge + parapet + details
  const roofCache = new Map();
  function roofSprite(b) {
    let c = roofCache.get(b);
    if (c) { roofCache.delete(b); roofCache.set(b, c); return c; }
    const sc = Math.min(1, 256 / Math.max(b.w, b.h));
    const W = Math.max(8, Math.round(b.w * sc)), H = Math.max(8, Math.round(b.h * sc));
    c = document.createElement("canvas"); c.width = W; c.height = H;
    const x = c.getContext("2d");
    x.scale(sc, sc);
    const p = pat[b.roof] || pat.gravel;
    const ts = (b.roof === "terra" || b.roof === "terra2") ? 0.42 : b.roof === "glass" ? 1 : 0.65;
    p.setTransform(new DOMMatrix([ts, 0, 0, ts, (b.seed % 64), (b.seed % 48)]));
    x.fillStyle = p; x.fillRect(0, 0, b.w, b.h);
    const TINTS = ["rgba(255,220,180,0.10)", "rgba(120,140,170,0.12)", "rgba(0,0,0,0.16)", "rgba(255,255,255,0.06)", "rgba(90,60,40,0.12)"];
    x.fillStyle = TINTS[b.seed % TINTS.length]; x.fillRect(0, 0, b.w, b.h);
    // grime / water stains: soft painted blotches
    let sd = b.seed * 9301 + 49297; const rn = () => ((sd = (sd * 9301 + 49297) % 233280) / 233280);
    const nb = 2 + ((b.w * b.h) / 12000 | 0);
    for (let i = 0; i < Math.min(nb, 9); i++) {
      const gx = rn() * b.w, gy = rn() * b.h, gr = 10 + rn() * Math.min(b.w, b.h) * 0.35;
      const g = x.createRadialGradient(gx, gy, 0, gx, gy, gr);
      const dark = rn() < 0.7;
      g.addColorStop(0, dark ? "rgba(20,14,10,0.16)" : "rgba(255,245,225,0.10)"); g.addColorStop(1, "rgba(0,0,0,0)");
      x.fillStyle = g; x.fillRect(gx - gr, gy - gr, gr * 2, gr * 2);
    }
    const gg = x.createLinearGradient(0, 0, b.w, b.h);
    gg.addColorStop(0, "rgba(255,250,235,0.12)"); gg.addColorStop(1, "rgba(0,0,0,0.18)");
    x.fillStyle = gg; x.fillRect(0, 0, b.w, b.h);
    // inner AO along the parapet
    const ao = Math.min(14, Math.min(b.w, b.h) * 0.12);
    for (const [gx0, gy0, gx1, gy1, rx, ry, rw, rh] of [[0, 0, 0, ao, 0, 0, b.w, ao], [0, b.h, 0, b.h - ao, 0, b.h - ao, b.w, ao], [0, 0, ao, 0, 0, 0, ao, b.h], [b.w, 0, b.w - ao, 0, b.w - ao, 0, ao, b.h]]) {
      const g = x.createLinearGradient(gx0, gy0, gx1, gy1); g.addColorStop(0, "rgba(0,0,0,0.28)"); g.addColorStop(1, "rgba(0,0,0,0)");
      x.fillStyle = g; x.fillRect(rx, ry, rw, rh);
    }
    x.strokeStyle = "rgba(0,0,0,0.4)"; x.lineWidth = 3; x.strokeRect(1.5, 1.5, b.w - 3, b.h - 3);
    x.strokeStyle = "rgba(255,255,255,0.2)"; x.lineWidth = 1.5; x.strokeRect(4, 4, b.w - 8, b.h - 8);
    roofDetails(x, b, 0, 0, b.w, b.h);
    roofCache.set(b, c);
    if (roofCache.size > 160) roofCache.delete(roofCache.keys().next().value);
    return c;
  }
  function wall(ctx, a, b, qa, qb, col, hgt, facP, sun, nx, ny) {
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(qb[0], qb[1]); ctx.lineTo(qa[0], qa[1]); ctx.closePath();
    const lit = 0.55 + 0.45 * Math.max(0, nx * sun.x + ny * sun.y);
    ctx.fillStyle = col; ctx.fill();
    if (facP && hgt > 16) {
      const ex = b[0] - a[0], ey = b[1] - a[1], len = Math.hypot(ex, ey) || 1;
      const vx = (qa[0] - a[0]) / hgt, vy = (qa[1] - a[1]) / hgt;
      facP.setTransform(new DOMMatrix([ex / len, ey / len, vx, vy, a[0], a[1]]));
      ctx.fillStyle = facP; ctx.fill();
    }
    ctx.fillStyle = `rgba(0,0,0,${(1 - lit) * 0.75})`; ctx.fill();
  }
  return {
    all, inView: (r) => inView(r, bins),
    draw(ctx, cam, r, frame, sun, opts) {
      const D = 980 / Math.max(0.45, cam.scale);
      const list = [...inView(r, bins)];
      // far-from-camera first so near walls overlap correctly
      for (const b of list) { const dx = b.x + b.w / 2 - cam.x, dy = b.y + b.h / 2 - cam.y; b._dk = dx * dx + dy * dy; }
      list.sort((p, q) => q._dk - p._dk);
      for (const b of list) {
        const h = b.core ? Math.min(70, (b.hgt || 24) * 1.0) : b.hgt;
        const x0 = b.x, y0 = b.y, x1 = b.x + b.w, y1 = b.y + b.h;
        const P = (px, py) => project(cam, D, px, py, h);
        const r00 = P(x0, y0), r10 = P(x1, y0), r11 = P(x1, y1), r01 = P(x0, y1);
        const col = wallCol(b);
        const fp = !opts.low && b.kind !== "container" && b.kind !== "hangar" ? (b.wall === "glass" ? fac.glass : fac.day) : null;
        if (cam.y > y1) wall(ctx, [x0, y1], [x1, y1], r01, r11, col[0], h, fp, sun, 0, 1);
        if (cam.y < y0) wall(ctx, [x0, y0], [x1, y0], r00, r10, col[1], h, fp, sun, 0, -1);
        if (cam.x < x0) wall(ctx, [x0, y0], [x0, y1], r00, r01, col[1], h, fp, sun, -1, 0);
        if (cam.x > x1) wall(ctx, [x1, y0], [x1, y1], r10, r11, col[0], h, fp, sun, 1, 0);
        // roof
        const rx = r00[0], ry = r00[1], rw = r11[0] - r00[0], rh = r11[1] - r00[1];
        let drawn = false;
        if (b.core && coreRoofs) {
          const kx = rw / b.w, ky = rh / b.h;
          drawn = coreRoofs.drawRect(ctx, b.x, b.y, b.w, b.h, frame, (ax, ay, bx, by) => [rx + (ax - b.x) * kx, ry + (ay - b.y) * ky, (bx - ax) * kx + 0.6, (by - ay) * ky + 0.6]);
        }
        if (!drawn) {
          if (b.kind === "container") {
            ctx.fillStyle = b.color || "#888"; ctx.fillRect(rx, ry, rw, rh);
            ctx.fillStyle = "rgba(0,0,0,0.22)";
            for (let i = 4; i < rw - 2; i += 6) ctx.fillRect(rx + i, ry, 2, rh);
          } else {
            // baked, hand-painted roof sprite (paid once per building, then one drawImage)
            ctx.drawImage(roofSprite(b), rx, ry, rw, rh);
          }
        }
        // ambient occlusion at the base of tall buildings
      }
    },
    drawLit(ctx, cam, r, night) {
      // lit windows pass (additive, after the light map)
      const D = 980 / Math.max(0.45, cam.scale);
      for (const b of inView(r, bins)) {
        if (b.kind === "container" || b.kind === "hangar") continue;
        const h = b.core ? Math.min(70, (b.hgt || 24)) : b.hgt;
        if (h < 18) continue;
        const x0 = b.x, y0 = b.y, x1 = b.x + b.w, y1 = b.y + b.h;
        const P = (px, py) => project(cam, D, px, py, h);
        const f = fac.lit;
        const go = (a, bb) => {
          const qa = P(a[0], a[1]), qb = P(bb[0], bb[1]);
          const ex = bb[0] - a[0], ey = bb[1] - a[1], len = Math.hypot(ex, ey) || 1;
          f.setTransform(new DOMMatrix([ex / len, ey / len, (qa[0] - a[0]) / h, (qa[1] - a[1]) / h, a[0] + (b.seed % 7) * ex / len, a[1] + (b.seed % 7) * ey / len]));
          ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(bb[0], bb[1]); ctx.lineTo(qb[0], qb[1]); ctx.lineTo(qa[0], qa[1]); ctx.closePath();
          ctx.fillStyle = f; ctx.fill();
        };
        ctx.globalAlpha = night * (0.55 + 0.45 * ((b.seed % 5) / 4));
        if (cam.y > y1) go([x0, y1], [x1, y1]);
        if (cam.y < y0) go([x0, y0], [x1, y0]);
        if (cam.x < x0) go([x0, y0], [x0, y1]);
        if (cam.x > x1) go([x1, y0], [x1, y1]);
      }
      ctx.globalAlpha = 1;
    },
    shadows(ctx, cam, r, sun) {
      // ground shadows, drawn opaque into a mask
      if (sun.len < 0.02) return;
      ctx.fillStyle = "#000";
      for (const b of inView(r, bins)) {
        const h = b.core ? Math.min(70, (b.hgt || 24)) : b.hgt;
        const dx = -sun.x * h * sun.len, dy = -sun.y * h * sun.len;
        shadowHull(ctx, b.x, b.y, b.w, b.h, dx, dy);
      }
      for (const t of inViewTrees(r)) {
        ctx.beginPath(); ctx.ellipse(t.x - sun.x * 26 * sun.len, t.y - sun.y * 26 * sun.len, t.r, t.r * 0.9, 0, 0, TAU); ctx.fill();
      }
    },
    trees(ctx, cam, r, opts) {
      const D = 980 / Math.max(0.45, cam.scale);
      for (const t of inViewTrees(r)) {
        const k = 28 / D;
        const x = t.x + (t.x - cam.x) * k, y = t.y + (t.y - cam.y) * k;
        ctx.fillStyle = "#4a3422"; ctx.fillRect(t.x - 2, t.y - 2, 4, 4);
        const g = t.t === 0 ? ["#2f5a26", "#4d8a37", "#6fb04a"] : t.t === 1 ? ["#2a4f2c", "#3f7a3c", "#5f9e52"] : ["#3c5a22", "#5f8a2e", "#86b04a"];
        ctx.fillStyle = g[0]; ctx.beginPath(); ctx.arc(x, y, t.r, 0, TAU); ctx.fill();
        ctx.fillStyle = g[1]; ctx.beginPath(); ctx.arc(x - t.r * 0.18, y - t.r * 0.18, t.r * 0.74, 0, TAU); ctx.fill();
        if (!opts.low) { ctx.fillStyle = g[2]; ctx.beginPath(); ctx.arc(x - t.r * 0.32, y - t.r * 0.34, t.r * 0.36, 0, TAU); ctx.fill(); }
      }
    },
  };
  function inViewTrees(r) { return inView(r, treeBins); }
}
function shadowHull(ctx, x, y, w, h, dx, dy) {
  const pts = [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
  const all = pts.concat(pts.map((p) => [p[0] + dx, p[1] + dy]));
  // convex hull (monotone chain) of 8 pts
  all.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const p of all) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  for (let i = all.length - 1; i >= 0; i--) { const p = all[i]; while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
  const hull = lo.slice(0, -1).concat(up.slice(0, -1));
  ctx.beginPath(); ctx.moveTo(hull[0][0], hull[0][1]);
  for (let i = 1; i < hull.length; i++) ctx.lineTo(hull[i][0], hull[i][1]);
  ctx.closePath(); ctx.fill();
}
function roofDetails(ctx, b, rx, ry, rw, rh) {
  const s = b.seed;
  const kx = rw / b.w;
  if (b.helipad) {
    const r = Math.min(rw, rh) * 0.3;
    ctx.fillStyle = "#3a3d44"; ctx.beginPath(); ctx.arc(rx + rw / 2, ry + rh / 2, r, 0, TAU); ctx.fill();
    ctx.strokeStyle = "#f2c14e"; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = "#eee"; ctx.font = `800 ${Math.round(r)}px system-ui`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("H", rx + rw / 2, ry + rh / 2 + 1); ctx.textBaseline = "alphabetic";
    return;
  }
  if (b.roof === "terra" || b.roof === "terra2") {
    // ridge line
    ctx.strokeStyle = "rgba(60,20,10,0.45)"; ctx.lineWidth = 3;
    ctx.beginPath();
    if (rw > rh) { ctx.moveTo(rx + rh * 0.4, ry + rh / 2); ctx.lineTo(rx + rw - rh * 0.4, ry + rh / 2); }
    else { ctx.moveTo(rx + rw / 2, ry + rw * 0.4); ctx.lineTo(rx + rw / 2, ry + rh - rw * 0.4); }
    ctx.stroke();
    ctx.fillStyle = "rgba(0,0,0,0.16)";
    if (rw > rh) ctx.fillRect(rx, ry + rh / 2, rw, rh / 2); else ctx.fillRect(rx + rw / 2, ry, rw / 2, rh);
    return;
  }
  const n = Math.min(5, Math.floor((b.w * b.h) / 9000) + 1);
  for (let i = 0; i < n; i++) {
    const u = ((s * (i + 3) * 37) % 100) / 100, v = ((s * (i + 7) * 53) % 100) / 100;
    const w = (14 + (s + i * 5) % 14) * kx, h = (12 + (s + i * 3) % 10) * kx;
    const x = rx + 8 + u * Math.max(1, rw - w - 16), y = ry + 8 + v * Math.max(1, rh - h - 16);
    ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.fillRect(x + 3, y + 3, w, h);
    ctx.fillStyle = "#9aa0a8"; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = "#6e737b"; ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
    ctx.fillStyle = "#3a3d42"; ctx.beginPath(); ctx.arc(x + w / 2, y + h / 2, Math.min(w, h) * 0.3, 0, TAU); ctx.fill();
  }
}
