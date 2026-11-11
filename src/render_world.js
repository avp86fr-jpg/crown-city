/* Streaming tile layers, chunked procedural ground, extruded buildings, trees. */
import { terrainRegion, drawExpansionGround } from "./expansion_world.js";
import {drawWorldDetails} from './world_details.js';
import { CORE, WORLD_W, WORLD_H, CELL, GW, GH, CODE } from "./world.js";

const TAU = Math.PI * 2;
import { loadImage as loadImg } from "./assets.js";
const roofParallax=(offset,k)=>Math.max(-24,Math.min(24,offset*k));
// Roof art, rooftop details and neon share the same capped perspective.
// Callers can reuse `out` while painting a complete building batch.
export function projectedRoofBounds(b,cam,out={}){
  const k=(b.core?0:b.hgt)/(980/Math.max(.45,cam.scale));
  out.x=b.x+roofParallax(b.x-cam.x,k);out.y=b.y+roofParallax(b.y-cam.y,k);
  out.w=b.x+b.w+roofParallax(b.x+b.w-cam.x,k)-out.x;
  out.h=b.y+b.h+roofParallax(b.y+b.h-cam.y,k)-out.y;
  return out;
}

export class TileLayer {
  constructor(name, keys, size, ext = "webp") {
    this.name = name; this.keys = new Set(keys); this.size = size; this.ext = ext;
    this.img = new Map(); this.pending = new Map(); this.used = new Map(); this.retryAt = new Map();
  }
  get(tx, ty, frame) {
    const k = tx + "_" + ty;
    if (!this.keys.has(k)) return null;
    this.used.set(k, frame);
    const im = this.img.get(k);
    if (im) return im;
    this.request(k, frame);
    return null;
  }
  request(k, frame = 0) {
    if (this.img.has(k)) return Promise.resolve(this.img.get(k));
    if (this.pending.has(k)) return this.pending.get(k);
    if ((this.retryAt.get(k) || 0) > frame) return Promise.resolve(null);
    const promise = loadImg(`assets/tiles/${this.name}/${k}.${this.ext}`)
      .then(im => { this.img.set(k, im); this.retryAt.delete(k); return im; })
      .catch(() => { this.retryAt.set(k, frame + 600); return null; })
      .finally(() => this.pending.delete(k));
    this.pending.set(k, promise);
    return promise;
  }
  preload(keys) {
    return Promise.all([...keys].filter(k => this.keys.has(k)).map(k => { this.used.set(k, 0); return this.request(k, 0); }));
  }
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
    for (const [k, f] of this.used) if (frame - f > keep && this.img.has(k)) { this.img.delete(k); this.used.delete(k); }
  }
}

/* ---------- procedural ground chunks ---------- */
const CH = 512;
export function makeGround(W, tex, codeAt) {
  const cache = new Map();
  const pats = {};let revision=0,useId=0;
  loadImg('assets/premium/frontier-scenery.webp').then(im=>{W.sceneryAtlas=im;for(const e of cache.values())if(e.c)e.c.width=1;cache.clear();revision++;}).catch(()=>{});
  // Eight material paintings, decoded once; detail is baked into streamed chunks.
  loadImg('assets/premium/world-materials.webp').then(atlas=>{
    ['forest','desert','mountain','casino','asphalt','paver','trail','water'].forEach((name,i)=>{
      const tile=document.createElement('canvas');tile.width=tile.height=256;
      tile.getContext('2d').drawImage(atlas,(i%4)*atlas.width/4,Math.floor(i/4)*atlas.height/2,atlas.width/4,atlas.height/2,0,0,256,256);
      // Quiet limestone tones keep the casino's green felt and characters readable.
      if(name==='casino'){const c=tile.getContext('2d');c.fillStyle='rgba(185,177,157,.58)';c.fillRect(0,0,256,256);}
      if(name==='asphalt'){const c=tile.getContext('2d');c.fillStyle='rgba(48,53,56,.64)';c.fillRect(0,0,256,256);}
      pats[name]=scratch.createPattern(tile,'repeat');
      const scale=name==='casino'?.3:name==='paver'?.22:name==='asphalt'?.25:name==='forest'?.55:.8;
      pats[name].setTransform(new DOMMatrix([scale,0,0,scale,0,0]));
      if(name==='forest'){
        const lawn=document.createElement('canvas');lawn.width=lawn.height=256;const ctx=lawn.getContext('2d');ctx.drawImage(tile,0,0);ctx.fillStyle='rgba(74,99,60,.78)';ctx.fillRect(0,0,256,256);pats.grass=scratch.createPattern(lawn,'repeat');pats.grass.setTransform(new DOMMatrix([.6,0,0,.6,0,0]));
      }
    });
    for(const e of cache.values())if(e.c)e.c.width=1;cache.clear();revision++;
  }).catch(()=>{});
  const scratch = document.createElement("canvas").getContext("2d");
  for (const k of Object.keys(tex)) pats[k] = scratch.createPattern(tex[k], "repeat");
  const codeTex = { [CODE.road]: "asphalt", [CODE.walk]: "paver", [CODE.grass]: "grass", [CODE.sand]: "sand", [CODE.track]: "asphalt_hw", [CODE.pier]: "pier", [CODE.lot]: "lot", [CODE.dirt]: "dirt", [CODE.build]: "concrete" };
  const g = W.grid;
  const cellAt = (cx, cy) => (cx < 0 || cy < 0 || cx >= GW || cy >= GH) ? 254 : g[cy * GW + cx];
  function textureAt(code,x,y){
    const region=terrainRegion(x,y),C=W.expansion?.casino;
    if(region&&region!=='mountain'&&code===CODE.dirt)return 'trail';
    if(region&&(code===CODE.grass||code===CODE.sand||code===CODE.dirt||code===CODE.build))return region;
    if((code===CODE.walk||code===CODE.build)&&C&&x>=C.x&&x<C.x+C.w&&y>=C.y&&y<C.y+C.h)return 'casino';
    return code===CODE.walk&&cellDistrict(W,x,y)==='warm'?'paver_warm':codeTex[code];
  }
  function render(ix, iy) {
    const c = document.createElement("canvas");
    c.width = c.height = CH;
    const x = c.getContext("2d");
    const ox = ix * CH, oy = iy * CH;
    x.translate(-ox, -oy);
    const cx0 = ox / CELL, cy0 = oy / CELL, n = CH / CELL;
    let any = false;
    for (let cy = cy0; cy < cy0 + n; cy++) {
      let run = -1, start = 0, runTex=null;
      for (let cx = cx0; cx <= cx0 + n; cx++) {
        const v = cx < cx0 + n ? cellAt(cx, cy) : -2;
        const currentTex=textureAt(v,cx*CELL,cy*CELL);
        if (v !== run || currentTex !== runTex) {
          if(run===CODE.water){
            x.fillStyle=pats.water||'#24585b';x.fillRect(start*CELL,cy*CELL,(cx-start)*CELL,CELL);
            x.fillStyle='rgba(15,48,56,.66)';x.fillRect(start*CELL,cy*CELL,(cx-start)*CELL,CELL);any=true;
          }else if (run >= 0 && run !== 255 && run !== CODE.canal) {
            const t = runTex;
            x.fillStyle = pats[t] || pats[codeTex[run]] || pats.concrete;
            x.fillRect(start * CELL, cy * CELL, (cx - start) * CELL, CELL);
            any = true;
          }
          run = v; start = cx; runTex=currentTex;
        }
      }
    }
    // Water-only chunks still need painted water and shoreline detail.
    if (!any && ox<CORE && oy<CORE) return null;
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
    drawExpansionGround(x,W,{x0:ox,y0:oy,x1:ox+CH,y1:oy+CH},pats);
    drawWorldDetails(x,W,{x0:ox,y0:oy,x1:ox+CH,y1:oy+CH},pats,codeAt);
    for (const p of W.piers) {
      if (p.x > rx1 || p.y > ry1 || p.x + p.w < rx0 || p.y + p.h < ry0) continue;
      x.fillStyle = pats.pier || "#6b5a44"; x.fillRect(p.x, p.y, p.w, p.h);
      x.fillStyle = "rgba(0,0,0,0.35)"; for (let yy = p.y; yy < p.y + p.h; yy += 12) x.fillRect(p.x, yy, p.w, 2);
      x.fillStyle = "#3a3026"; for (let yy = p.y + 20; yy < p.y + p.h; yy += 60) { x.fillRect(p.x - 4, yy, 6, 6); x.fillRect(p.x + p.w - 2, yy, 6, 6); }
    }
    for (const p of W.pools) {
      if (p.x > rx1 || p.y > ry1 || p.x + p.w < rx0 || p.y + p.h < ry0) continue;
      x.fillStyle = "#e9e4da"; x.fillRect(p.x - 4, p.y - 4, p.w + 8, p.h + 8);
      x.fillStyle = pats.water||"#3fc4e0"; x.fillRect(p.x, p.y, p.w, p.h);
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
          const maintained=v!==CODE.lot&&!(px>4096&&(py<1600||py>3900&&py<6600));
          if(maintained&&i%4!==0)continue;
          x.save();x.globalAlpha=maintained?.42:.8;
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
          x.restore();
        } else if (v === CODE.grass) {
          const rr = 6 + rn() * 16; x.fillStyle = rn() < 0.5 ? "rgba(30,60,15,0.25)" : "rgba(190,210,110,0.16)";
          x.beginPath(); x.ellipse(px, py, rr, rr * 0.8, 0, 0, TAU); x.fill();
        } else if (v === CODE.walk) {
          if (rn() < 0.5) { x.fillStyle = "rgba(0,0,0,0.12)"; x.beginPath(); x.arc(px, py, 2 + rn() * 3, 0, TAU); x.fill(); } // gum / stains
        }
      }
    }
    // ---- per-cell brushwork: lawn dabs, shrubs, flower beds, gutters and building AO
    {
      let sd = (ix * 2654435761 ^ iy * 40503) >>> 0; sd = sd % 233280 || 11;
      const rn = () => ((sd = (sd * 9301 + 49297) % 233280) / 233280);
      const shrubs = [];
      for (let cy = cy0; cy < cy0 + n; cy++) for (let cx = cx0; cx < cx0 + n; cx++) {
        const v = cellAt(cx, cy), px = cx * CELL, py = cy * CELL;
        if (v === CODE.grass && !terrainRegion(px,py)) {
          // The grass material supplies fine detail. Keep runway margins mown and clear.
          if(px>=6500&&px<10240&&py>=7240&&py<8200)continue;
          const edge = cellAt(cx + 1, cy) !== CODE.grass || cellAt(cx - 1, cy) !== CODE.grass || cellAt(cx, cy + 1) !== CODE.grass || cellAt(cx, cy - 1) !== CODE.grass;
          const t = rn();
          if (edge ? t < 0.16 : t < 0.035) shrubs.push([px + CELL / 2 + (rn() - 0.5) * 8, py + CELL / 2 + (rn() - 0.5) * 8, edge ? 7 + rn() * 5 : 9 + rn() * 9, rn()]);
          else if (!edge && t < 0.05) { // flower bed
            const fc = ["#e8507a", "#f2c14e", "#f4f0e8", "#b06ae0"][(rn() * 4) | 0];
            x.fillStyle = "rgba(70,48,30,0.55)"; x.beginPath(); x.ellipse(px + 8, py + 8, 9, 6, 0, 0, TAU); x.fill();
            x.fillStyle = fc; for (let k = 0; k < 7; k++) { x.beginPath(); x.arc(px + 2 + rn() * 12, py + 4 + rn() * 8, 1.6, 0, TAU); x.fill(); }
          }
        } else if (v === CODE.road || v === CODE.track) {
          // gutter grime along curbs
          x.fillStyle = "rgba(12,10,8,0.16)";
          if (cellAt(cx + 1, cy) === CODE.walk) x.fillRect(px + CELL - 7, py, 7, CELL);
          if (cellAt(cx - 1, cy) === CODE.walk) x.fillRect(px, py, 7, CELL);
          if (cellAt(cx, cy + 1) === CODE.walk) x.fillRect(px, py + CELL - 7, CELL, 7);
          if (cellAt(cx, cy - 1) === CODE.walk) x.fillRect(px, py, CELL, 7);
        } else if (v === CODE.walk || v === CODE.lot) {
          // soft ambient occlusion at building bases
          x.fillStyle = "rgba(10,8,14,0.20)";
          if (cellAt(cx + 1, cy) === CODE.build) x.fillRect(px + CELL - 6, py, 6, CELL);
          if (cellAt(cx - 1, cy) === CODE.build) x.fillRect(px, py, 6, CELL);
          if (cellAt(cx, cy + 1) === CODE.build) x.fillRect(px, py + CELL - 6, CELL, 6);
          if (cellAt(cx, cy - 1) === CODE.build) x.fillRect(px, py, CELL, 6);
        }
      }
      for (const [sx, sy, sr, sv] of shrubs) { // painted shrubs: shadow, body clumps, sunlit rim
        x.fillStyle = "rgba(8,14,6,0.35)"; x.beginPath(); x.ellipse(sx + sr * 0.35, sy + sr * 0.4, sr * 1.05, sr * 0.8, 0, 0, TAU); x.fill();
        const base = sv < 0.5 ? [34, 78, 30] : [52, 92, 34];
        for (let k = 0; k < 4; k++) {
          const a = k * 1.7 + sv * 6, d = sr * 0.35;
          x.fillStyle = `rgb(${base[0] + k * 6},${base[1] + k * 8},${base[2] + k * 3})`;
          x.beginPath(); x.arc(sx + Math.cos(a) * d, sy + Math.sin(a) * d, sr * (0.72 - k * 0.08), 0, TAU); x.fill();
        }
        x.fillStyle = "rgba(190,230,120,0.30)"; x.beginPath(); x.arc(sx - sr * 0.3, sy - sr * 0.3, sr * 0.38, 0, TAU); x.fill();
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
    maxChunks:64,
    get revision(){return revision;},
    draw(ctx, r, frame) {
      // Offscreen mobile composition deliberately passes frame=0. A separate usage
      // clock is required or every such chunk stays "current" and can never evict.
      const stamp=++useId;
      const ix0 = Math.max(0, Math.floor(r.x0 / CH)), iy0 = Math.max(0, Math.floor(r.y0 / CH));
      const ix1 = Math.min(WORLD_W / CH - 1, Math.floor(r.x1 / CH)), iy1 = Math.min(WORLD_H / CH - 1, Math.floor(r.y1 / CH));
      let built = 0;
      for (let iy = iy0; iy <= iy1; iy++) for (let ix = ix0; ix <= ix1; ix++) {
        const k = ix + iy * 100;
        let e = cache.get(k);
        if (!e) {
          if (built >= 2 && frame > 2) continue; // budget per frame
          e = { c: render(ix, iy), f: stamp }; built++;
          cache.set(k, e);
        }
        e.f = stamp;
        if (e.c) ctx.drawImage(e.c, ix * CH, iy * CH);
      }
      if (cache.size > this.maxChunks) {
        const cold=[...cache].filter(([,e])=>e.f!==stamp).sort((a,b)=>a[1].f-b[1].f);
        for(const [key,e] of cold){if(cache.size<=this.maxChunks)break;cache.delete(key);if(e.c)e.c.width=e.c.height=1;}
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
  } else if (lanes > 1 || s.k === "street" || s.k === "frontier") {
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
  if (s.k === "highway" || s.k === "boulevard" || s.k === "frontier") {
    for (const sg of [-1, 1]) { const p = L(sg * (half - 8), a, b); dash(x, p[0], p[1], p[2], p[3], 0, 0, 2.5, "rgba(240,240,240,0.8)"); }
  }
}
// A junction's actual arms drive paint as well as geometry: never paint a
// fourth crossing across the closed side of a T junction.
export function junctionApproaches(W,n){
  const hw=n.vs.w/2,hh=n.hs.w/2;
  const roads=W.roads||[n.vs,n.hs],out=[];
  for(const [v,side] of [[true,-1],[true,1],[false,-1],[false,1]]){
    const centre=v?n.y:n.x,half=v?hh:hw,c=v?n.x:n.y;
    const candidates=roads.filter(s=>s.v===v&&Math.abs(s.c-c)<2&&s.a<=centre+1&&s.b>=centre-1);
    const reaches=candidates.filter(s=>side<0?s.a<centre-half-4:s.b>centre+half+4);
    if(!reaches.length)continue;
    const road=reaches.reduce((a,b)=>a.w>b.w?a:b),distance=side<0?centre-road.a:road.b-centre;
    out.push({v,side,road,distance,half});
  }return out;
}
function laneArrow(x,cx,cy,rot){
  x.save();x.translate(cx,cy);x.rotate(rot);x.strokeStyle='rgba(239,235,218,.65)';x.lineWidth=2.5;x.lineCap='butt';
  x.beginPath();x.moveTo(0,13);x.lineTo(0,-12);x.moveTo(-7,-4);x.lineTo(0,-12);x.lineTo(7,-4);x.stroke();x.restore();
}
export function drawIntersection(x,W,n,pats){
  const hw=n.vs.w/2,hh=n.hs.w/2,arms=junctionApproaches(W,n);
  x.fillStyle=pats.asphalt||'#34393b';x.fillRect(n.x-hw,n.y-hh,hw*2,hh*2);
  const rural=n.vs.k==='frontier'&&n.hs.k==='frontier';
  for(const a of arms){
    const {v,side,road,half}=a,width=road.w/2,med=road.med||0,zw=18,clear=42;
    // Remove centre/lane marks beneath the crossing and stop position. Refuges
    // stay visible, instead of yellow lines running through zebra stripes.
    x.fillStyle=pats.asphalt||'#34393b';
    if(v)x.fillRect(n.x-width,n.y+side*half+(side<0?-clear:0),width*2,clear);
    else x.fillRect(n.x+side*half+(side<0?-clear:0),n.y-width,clear,width*2);
    const at=(v?n.y:n.x)+side*(half+7)+(side<0?-zw:0);
    if(!rural&&road.k!=='highway'){
      x.fillStyle='rgba(238,235,220,.8)';
      for(let q=-width+8;q+8<width-7;q+=14){
        if(med&&q<med/2+3&&q+8>-med/2-3)continue;
        if(v)x.fillRect(n.x+q,at,8,zw);else x.fillRect(at,n.y+q,zw,8);
      }
    }
    if(med){
      x.fillStyle='#b8b6a8';
      if(v)x.fillRect(n.x-med/2+3,n.y+side*half+(side<0?-31:5),med-6,26);
      else x.fillRect(n.x+side*half+(side<0?-31:5),n.y-med/2+3,26,med-6);
    }
    if(rural||road.k==='highway')continue;
    const line=(v?n.y:n.x)+side*(half+35),incoming=v?side:-side,laneStart=incoming<0?-width+6:med/2+6,laneWidth=width-med/2-12;
    x.fillStyle='rgba(239,235,220,.85)';
    if(v)x.fillRect(n.x+laneStart,line-2,laneWidth,4);else x.fillRect(line-2,n.y+laneStart,4,laneWidth);
    if(a.distance>half+130){
      const lanes=road.lanes||1,lw=(width-med/2)/lanes;
      for(let lane=0;lane<lanes;lane++){
        const offset=incoming*(med/2+lw*(lane+.5)),along=side*(half+92);
        laneArrow(x,n.x+(v?offset:along),n.y+(v?along:offset),v?(side<0?Math.PI:0):(side<0?Math.PI/2:-Math.PI/2));
      }
    }
  }
  // Re-establish the continuous kerb on the closed side of a T junction.
  x.strokeStyle='#bcb9ad';x.lineWidth=3;x.setLineDash([]);
  for(const [v,side] of [[true,-1],[true,1],[false,-1],[false,1]]){
    if(arms.some(a=>a.v===v&&a.side===side))continue;
    x.beginPath();if(v){x.moveTo(n.x-hw,n.y+side*hh);x.lineTo(n.x+hw,n.y+side*hh);}else{x.moveTo(n.x+side*hw,n.y-hh);x.lineTo(n.x+side*hw,n.y+hh);}x.stroke();
  }
}
export function drawLot(x,l){
  if(Array.isArray(l.bays)){
    // Paint the exact plan used by vehicle placement. Bay width/depth includes
    // door space and bumper clearance; entrances face the shared driving aisle.
    x.strokeStyle='rgba(228,225,207,.64)';x.lineWidth=2;
    for(const b of l.bays){
      x.save();x.translate(b.x,b.y);x.rotate(b.rot||0);const w=b.w/2,h=b.l/2;
      x.beginPath();x.moveTo(-w,h);x.lineTo(-w,-h);x.lineTo(w,-h);x.lineTo(w,h);x.stroke();
      x.fillStyle='#b8b5a3';x.fillRect(-Math.min(19,w-5),-h+10,Math.min(38,b.w-10),5);
      x.fillStyle='rgba(13,18,19,.15)';x.fillRect(-Math.min(19,w-5),-h+15,Math.min(38,b.w-10),3);x.restore();
    }
    const aisle=l.aisle;
    if(aisle&&aisle.w>180&&aisle.h>50){
      x.strokeStyle='rgba(231,218,173,.3)';x.lineWidth=2;x.setLineDash([16,22]);
      x.beginPath();if(aisle.w>aisle.h){x.moveTo(aisle.x+20,aisle.y+aisle.h/2);x.lineTo(aisle.x+aisle.w-20,aisle.y+aisle.h/2);}else{x.moveTo(aisle.x+aisle.w/2,aisle.y+20);x.lineTo(aisle.x+aisle.w/2,aisle.y+aisle.h-20);}x.stroke();x.setLineDash([]);
    }
    return;
  }
  if(l.k==='parking'||l.k==='industrial'){
    // Legacy lots get correctly scaled spaces, never miniature 40×46 markings.
    x.strokeStyle='rgba(228,225,207,.5)';x.lineWidth=2;
    for(let yy=l.y+16;yy+120<l.y+l.h-16;yy+=240)for(let xx=l.x+16;xx+64<l.x+l.w-16;xx+=64){x.beginPath();x.moveTo(xx,yy+120);x.lineTo(xx,yy);x.lineTo(xx+64,yy);x.lineTo(xx+64,yy+120);x.stroke();}
  }else if(l.k==='yard'){
    x.fillStyle='rgba(240,200,40,.6)';for(let xx=l.x;xx<l.x+l.w;xx+=120)x.fillRect(xx,l.y+l.h-8,60,4);
  }else if(l.k==='apron'){
    x.strokeStyle='rgba(240,200,40,.8)';x.lineWidth=3;for(let xx=l.x+300;xx<l.x+l.w;xx+=600){x.beginPath();x.moveTo(xx,l.y);x.quadraticCurveTo(xx,l.y+150,xx+160,l.y+170);x.stroke();}
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
    // The square foundation matches the blocked basin footprint; the circular
    // bowl is inset above it. Every gradient/ripple is baked into terrain once.
    const r=f.r;
    x.fillStyle='#9d9d8c';x.fillRect(f.x-r,f.y-r,r*2,r*2);
    x.fillStyle='rgba(12,27,26,.22)';x.beginPath();x.ellipse(f.x+5,f.y+8,r*1.15,r*1.08,0,0,TAU);x.fill();
    const stone=x.createLinearGradient(f.x-r,f.y-r,f.x+r,f.y+r);stone.addColorStop(0,'#e2dac4');stone.addColorStop(.65,'#b7b49e');stone.addColorStop(1,'#808879');
    x.fillStyle=stone;x.beginPath();x.arc(f.x,f.y,r*1.15,0,TAU);x.fill();
    const water=x.createRadialGradient(f.x-r*.25,f.y-r*.3,1,f.x,f.y,r);water.addColorStop(0,'#65979a');water.addColorStop(.52,'#396f79');water.addColorStop(1,'#193f4b');
    x.fillStyle=water;x.beginPath();x.arc(f.x,f.y,r,0,TAU);x.fill();
    x.strokeStyle='rgba(216,239,224,.28)';x.lineWidth=1.5;
    for(const rr of [.42,.72]){x.beginPath();x.ellipse(f.x,f.y+1,r*rr,r*rr*.93,0,.2,TAU-.2);x.stroke();}
    x.strokeStyle='rgba(247,240,219,.65)';x.lineWidth=2;x.beginPath();x.arc(f.x,f.y,r*1.08,Math.PI,Math.PI*1.8);x.stroke();
    x.fillStyle='rgba(16,45,49,.35)';x.beginPath();x.ellipse(f.x+4,f.y+5,r*.23,r*.2,0,0,TAU);x.fill();
    x.fillStyle='#c3c6af';x.beginPath();x.arc(f.x,f.y,r*.17,0,TAU);x.fill();
    x.fillStyle='#e4ebdb';x.beginPath();x.arc(f.x-1,f.y-2,r*.09,0,TAU);x.fill();
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
  // Small shared canopy variants replace per-tree gradients and leaf paths.
  // 3 palettes × 8 orientations × 2 detail tiers, at most 1.7 MiB of canvas art.
  const treeArt=new Map();
  function canopy(t,low){
    const palette=Math.min(2,t.t||0),angle=((Math.round(t.x*8/TAU)%8)+8)%8,key=palette+':'+angle+':'+!!low;
    if(treeArt.has(key))return treeArt.get(key);
    const cv=document.createElement('canvas');cv.width=cv.height=96;const c=cv.getContext('2d'),r=40,cx=45,cy=43;
    const colors=palette===0?['#263f31','#466349','#78865a']:palette===1?['#263e35','#405e4b','#718568']:['#39472e','#5b6c44','#8c9365'];
    // An irregular, softly lobed canopy and contact shadow share this small
    // cached sprite. No new gradients or shadow paths are paid per visible tree.
    c.fillStyle='rgba(8,17,13,.25)';c.beginPath();c.ellipse(cx+7,cy+11,r*1.03,r*.78,.2,0,TAU);c.fill();
    const gradient=c.createRadialGradient(cx-r*.3,cy-r*.35,1,cx,cy,r);gradient.addColorStop(0,colors[2]);gradient.addColorStop(.55,colors[1]);gradient.addColorStop(1,colors[0]);
    const points=[];for(let i=0;i<12;i++){const a=i*TAU/12+angle*TAU/8,rr=r*(.84+((i*7+angle*3)%5)/25);points.push([cx+Math.cos(a)*rr,cy+Math.sin(a)*rr]);}
    c.fillStyle=gradient;c.beginPath();c.moveTo((points[11][0]+points[0][0])/2,(points[11][1]+points[0][1])/2);
    for(let i=0;i<12;i++){const p=points[i],q=points[(i+1)%12];c.quadraticCurveTo(p[0],p[1],(p[0]+q[0])/2,(p[1]+q[1])/2);}c.closePath();c.fill();
    for(let i=0;i<(low?3:6);i++){const a=i*TAU/6+angle*TAU/8;c.fillStyle=colors[i%2?1:0];c.globalAlpha=.3;c.beginPath();c.arc(cx+Math.cos(a)*r*.45,cy+Math.sin(a)*r*.45,r*.34,0,TAU);c.fill();}
    c.globalAlpha=1;c.fillStyle=colors[2];c.beginPath();c.ellipse(cx-r*.27,cy-r*.32,r*.26,r*.21,-.5,0,TAU);c.fill();
    treeArt.set(key,cv);return cv;
  }
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
    b.seed = Math.abs(Math.floor(b.x * 31 + b.y * 17)) % 997;
    for (let bx = Math.floor(b.x / BIN); bx <= Math.floor((b.x + b.w) / BIN); bx++)
      for (let by = Math.floor(b.y / BIN); by <= Math.floor((b.y + b.h) / BIN); by++) {
        const k = bx + by * 100; if (!bins.has(k)) bins.set(k, []); bins.get(k).push(b);
      }
  });
  const treeBins = new Map();
  for (const t of W.trees) { const k = Math.floor(t.x / BIN) + Math.floor(t.y / BIN) * 100; if (!treeBins.has(k)) treeBins.set(k, []); treeBins.get(k).push(t); }
  // Static geometry changes only when a world is built. Reuse candidate lists
  // while the view moves inside the same bins instead of rebuilding Sets for
  // every roof, window, foliage and shadow pass. Exact bounds still run below.
  const buildingQueries=new Map(),treeQueries=new Map(),visibleBuildings=[],visibleTrees=[],drawOrder=[];
  const maxHeight=all.reduce((h,b)=>Math.max(h,b.core?0:b.hgt||0),0),maxTreeRadius=W.trees.reduce((r,t)=>Math.max(r,t.r*(t.pine?1.7:1.25)),0);
  const queryStats={builds:0,buildingCandidates:0,buildings:0,treeCandidates:0,trees:0};
  function candidates(r,binsMap,cache,pad){
    const x0=Math.floor((r.x0-pad)/BIN),y0=Math.floor((r.y0-pad)/BIN),x1=Math.floor((r.x1+pad)/BIN),y1=Math.floor((r.y1+pad)/BIN),key=x0+':'+y0+':'+x1+':'+y1;
    let list=cache.get(key);if(list)return list;
    const seen=new Set();list=[];
    for(let bx=x0;bx<=x1;bx++)for(let by=y0;by<=y1;by++){
      const bin=binsMap.get(bx+by*100);if(bin)for(const item of bin)if(!seen.has(item)){seen.add(item);list.push(item);}
    }
    cache.set(key,list);queryStats.builds++;if(cache.size>8)cache.delete(cache.keys().next().value);return list;
  }
  function inView(r,pad=24,sun=null){
    const list=candidates(r,bins,buildingQueries,sun?maxHeight*sun.len:pad),out=visibleBuildings;out.length=0;
    for(const b of list){
      const h=b.core?0:b.hgt||0,dx=sun?-sun.x*h*sun.len:0,dy=sun?-sun.y*h*sun.len:0;
      if(b.x+Math.min(0,dx)-pad>r.x1||b.y+Math.min(0,dy)-pad>r.y1||b.x+b.w+Math.max(0,dx)+pad<r.x0||b.y+b.h+Math.max(0,dy)+pad<r.y0)continue;
      out.push(b);
    }
    queryStats.buildingCandidates=list.length;queryStats.buildings=out.length;return out;
  }
  function inViewTrees(r,shadow=null){
    const extra=shadow?26*shadow.len:80,list=candidates(r,treeBins,treeQueries,maxTreeRadius+extra),out=visibleTrees;out.length=0;
    for(const t of list){
      const radius=t.r*(t.pine?1.7:1.25),dx=shadow?-shadow.x*26*shadow.len:0,dy=shadow?-shadow.y*26*shadow.len:0,pad=shadow?radius:radius+extra;
      if(t.x+dx+pad<r.x0||t.x+dx-pad>r.x1||t.y+dy+pad<r.y0||t.y+dy-pad>r.y1)continue;
      out.push(t);
    }
    queryStats.treeCandidates=list.length;queryStats.trees=out.length;return out;
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
    // Keep roof parallax within its block instead of stretching a distant
    // tower over a neighbouring roadway. The static/mobile footprint stays valid.
    return [px+roofParallax(px-cam.x,k),py+roofParallax(py-cam.y,k)];
  }
  // ---- painted roof bake: texture + per-building tint + grime + sun gradient + AO edge + parapet + details
  const roofCache = new Map(),roofBudget=12*1024*1024;let roofBytes=0;
  function roofSprite(b) {
    let entry=roofCache.get(b);
    if(entry){roofCache.delete(b);roofCache.set(b,entry);return entry.c;}
    const sc = Math.min(1, 256 / Math.max(b.w, b.h));
    const W = Math.max(8, Math.round(b.w * sc)), H = Math.max(8, Math.round(b.h * sc));
    const c = document.createElement("canvas"); c.width = W; c.height = H;
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
    entry={c,bytes:W*H*4};roofCache.set(b,entry);roofBytes+=entry.bytes;
    while(roofCache.size>160||roofBytes>roofBudget){const key=roofCache.keys().next().value,old=roofCache.get(key);roofCache.delete(key);roofBytes-=old.bytes;old.c.width=old.c.height=1;}
    queryStats.roofBytes=roofBytes;queryStats.roofEntries=roofCache.size;queryStats.roofBudget=roofBudget;
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
    all, inView: (r,pad=24) => inView(r,pad),queryStats,
    // Camera-independent roofs and foliage are baked into mobile scenery tiles.
    staticDraw(ctx,r){
      for(const b of inView(r,18)){
        if(b.core)continue;
        ctx.fillStyle='rgba(10,16,18,.3)';ctx.fillRect(b.x+9,b.y+12,b.w+5,b.h+5);
        if(b.kind==='container'){ctx.fillStyle=b.color||'#7e7770';ctx.fillRect(b.x,b.y,b.w,b.h);ctx.fillStyle='rgba(0,0,0,.2)';for(let x=b.x+4;x<b.x+b.w;x+=7)ctx.fillRect(x,b.y,2,b.h);}
        else ctx.drawImage(roofSprite(b),b.x,b.y,b.w,b.h);
      }
      this.trees(ctx,{x:0,y:0,scale:1},r,{low:false,static:true,time:0});
    },
    draw(ctx, cam, r, frame, sun, opts) {
      const D = 980 / Math.max(0.45, cam.scale);
      const list=drawOrder;list.length=0;for(const b of inView(r))list.push(b);
      // far-from-camera first so near walls overlap correctly
      for (const b of list) { const dx = b.x + b.w / 2 - cam.x, dy = b.y + b.h / 2 - cam.y; b._dk = dx * dx + dy * dy; }
      list.sort((p, q) => q._dk - p._dk);
      for (const b of list) {
        // Preserve the painted core's own perspective; a second extrusion
        // doubles its edges and separates the roof from the lighting.
        const h = b.core ? 0 : b.hgt;
        const x0 = b.x, y0 = b.y, x1 = b.x + b.w, y1 = b.y + b.h;
        const P = (px, py) => project(cam, D, px, py, h);
        const r00 = P(x0, y0), r10 = P(x1, y0), r11 = P(x1, y1), r01 = P(x0, y1);
        const hero=opts.player;
        const covered=!b.core&&hero?.type==='foot' && hero.x>r00[0]-12 && hero.x<r11[0]+12 && hero.y-22>r00[1] && hero.y-22<r11[1];
        ctx.save();if(covered)ctx.globalAlpha*=.24;
        const col = wallCol(b);
        const fp = !opts.low && b.kind !== "container" && b.kind !== "hangar" ? (b.wall === "glass" ? fac.glass : fac.day) : null;
        if (h>0&&cam.y > y1) wall(ctx, [x0, y1], [x1, y1], r01, r11, col[0], h, fp, sun, 0, 1);
        if (h>0&&cam.y < y0) wall(ctx, [x0, y0], [x1, y0], r00, r10, col[1], h, fp, sun, 0, -1);
        if (h>0&&cam.x < x0) wall(ctx, [x0, y0], [x0, y1], r00, r01, col[1], h, fp, sun, -1, 0);
        if (h>0&&cam.x > x1) wall(ctx, [x1, y0], [x1, y1], r10, r11, col[0], h, fp, sun, 1, 0);
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
        ctx.restore();
      }
    },
    drawLit(ctx, cam, r, night) {
      // lit windows pass (additive, after the light map)
      const D = 980 / Math.max(0.45, cam.scale);
      for (const b of inView(r)) {
        if (b.kind === "container" || b.kind === "hangar") continue;
        const h = b.core ? 0 : b.hgt;
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
      for (const b of inView(r,0,sun)) {
        const h = b.core ? 0 : b.hgt;
        if(!h)continue; // The illustrated core already includes ground shadows.
        const dx = -sun.x * h * sun.len, dy = -sun.y * h * sun.len;
        shadowHull(ctx, b.x, b.y, b.w, b.h, dx, dy);
      }
      for (const t of inViewTrees(r,sun)) {
        ctx.beginPath(); ctx.ellipse(t.x - sun.x * 26 * sun.len, t.y - sun.y * 26 * sun.len, t.r, t.r * 0.9, 0, 0, TAU); ctx.fill();
      }
    },
    trees(ctx, cam, r, opts) {
      const D = 980 / Math.max(0.45, cam.scale);
      for (const t of inViewTrees(r)) {
        const k = 28 / D;
        const wind = opts.time ? Math.sin(opts.time * 1.25 + t.x * .019 + t.y * .012) * 1.6 : 0;
        const x = opts.static?t.x:t.x + (t.x - cam.x) * k + wind, y = opts.static?t.y:t.y + (t.y - cam.y) * k + wind * .35;
        if(t.pine){
          ctx.fillStyle='rgba(11,24,25,.32)';ctx.beginPath();ctx.ellipse(x+10,y+12,t.r*1.1,t.r*.7,-.6,0,TAU);ctx.fill();
          if(W.sceneryAtlas){const im=W.sceneryAtlas;ctx.drawImage(im,0,0,im.width/2,im.height/2,x-t.r*1.3,y-t.r*1.65,t.r*2.6,t.r*3.1);continue;}
          for(let layer=0;layer<4;layer++){
            const rad=t.r*(1-layer*.19);ctx.fillStyle=['#203e36','#305848','#426d51','#779065'][layer];ctx.beginPath();
            for(let i=0;i<20;i++){const a=i*TAU/20+t.x*.013,rr=rad*(i%2?.52:1),px=x+Math.cos(a)*rr-layer*1.4,py=y+Math.sin(a)*rr-layer*1.8;i?ctx.lineTo(px,py):ctx.moveTo(px,py);}
            ctx.closePath();ctx.fill();
          }continue;
        }
        ctx.fillStyle = "#4a3422"; ctx.fillRect(t.x - 2, t.y - 2, 4, 4);
        ctx.drawImage(canopy(t,opts.low),x-t.r,y-t.r,t.r*2,t.r*2);
      }
    },
  };
}
function shadowHull(ctx, x, y, w, h, dx, dy) {
  // A rectangle extruded along one vector always has this six-vertex hull.
  // Avoid sorting eight allocated points for every visible building each frame.
  const x1=x+w,y1=y+h;ctx.beginPath();
  if(dx>=0&&dy>=0){ctx.moveTo(x,y);ctx.lineTo(x1,y);ctx.lineTo(x1+dx,y+dy);ctx.lineTo(x1+dx,y1+dy);ctx.lineTo(x+dx,y1+dy);ctx.lineTo(x,y1);}
  else if(dx>=0){ctx.moveTo(x,y);ctx.lineTo(x+dx,y+dy);ctx.lineTo(x1+dx,y+dy);ctx.lineTo(x1+dx,y1+dy);ctx.lineTo(x1,y1);ctx.lineTo(x,y1);}
  else if(dy<0){ctx.moveTo(x+dx,y+dy);ctx.lineTo(x1+dx,y+dy);ctx.lineTo(x1,y);ctx.lineTo(x1,y1);ctx.lineTo(x,y1);ctx.lineTo(x+dx,y1+dy);}
  else{ctx.moveTo(x,y);ctx.lineTo(x1,y);ctx.lineTo(x1,y1);ctx.lineTo(x1+dx,y1+dy);ctx.lineTo(x+dx,y1+dy);ctx.lineTo(x+dx,y+dy);}
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
