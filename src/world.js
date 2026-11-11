/* Crown City world: painted core (tiled, streamed) + procedural outer districts.
   One collision grid, one road graph, chunked ground renderer, extruded buildings. */
import {applyExpansion,terrainRegion} from './expansion_world.js';
import {applyTransitWorld} from './transit.js';
import {applyWorldDetails} from './world_details.js';
export const CORE = 4096;
export const WORLD_W = 12288;
export const WORLD_H = 10240;
export const CELL = 16;
export const GW = WORLD_W / CELL, GH = WORLD_H / CELL;
// codes: 0 road 1 walk 2 build 3 water 4 sand 5 grass 6 track 7 pier 8 canal 9 lot 10 dirt 255 core
export const CODE = { road: 0, walk: 1, build: 2, water: 3, sand: 4, grass: 5, track: 6, pier: 7, canal: 8, lot: 9, dirt: 10 };

function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const DISTRICTS = [
  { id: "port", name: "PORT ROYALE", r: [4096, 0, 6144, 1600] },
  { id: "downtown", name: "MIDTOWN", r: [4096, 1600, 3304, 2300] },
  { id: "eastside", name: "EASTSIDE", r: [7400, 1600, 2840, 2300] },
  { id: "industrial", name: "IRONSIDE", r: [4096, 3900, 6144, 2700] },
  { id: "oldtown", name: "OLD TOWN", r: [0, 4096, 4096, 2504] },
  { id: "suburb", name: "SUNSET HILLS", r: [0, 6800, 6500, 2416] },
  { id: "airfield", name: "CROWN AIRFIELD", r: [6500, 6800, 3740, 2416] },
];
export const CORE_DISTRICTS = [
  { name: "THE STRIP", r: [1672, 860, 584, 2960] },
  { name: "HARBOUR", r: [0, 0, 4096, 900] },
  { name: "DOWNTOWN", r: [400, 900, 1272, 2000] },
  { name: "CROWN LOOP", r: [2500, 2650, 1300, 650] },
  { name: "SOUTHSIDE", r: [400, 2900, 1300, 1196] },
  { name: "PALACE ROW", r: [2256, 900, 1600, 1750] },
  { name: "DESERT EDGE", r: [3600, 3000, 496, 1096] },
];
export function districtAt(x, y) {
  const biome=terrainRegion(x,y);if(biome)return biome==='forest'?'PINEWATCH FOREST':biome==='desert'?'RED MESA':'SIERRA CROWN';
  if(x>=6784&&x<=7152&&y>560&&y<6800)return 'CROWN CANAL';
  if(x>=7540&&x<=8960&&y>=2820&&y<=3590)return 'METAWIN TERRACE';
  if (x < CORE && y < CORE) {
    for (const d of CORE_DISTRICTS) { const r = d.r; if (x >= r[0] && y >= r[1] && x < r[0] + r[2] && y < r[1] + r[3]) return d.name; }
    return "CROWN CITY";
  }
  for (const d of DISTRICTS) { const r = d.r; if (x >= r[0] && y >= r[1] && x < r[0] + r[2] && y < r[1] + r[3]) return d.name; }
  return "OUTSKIRTS";
}

/* ---------------- generation ---------------- */
export function buildWorld(meta, coreMask, coreMS) {
  const rnd = mulberry(1337);
  const R = (a, b) => a + (b - a) * rnd();
  const grid = new Uint8Array(GW * GH);
  const W = { grid, roads: [], buildings: [], trees: [], lots: [], lamps: [], signals: [], piers: [], waterRects: [], props: [], parking: [], features: [], containers: [], cranes: [], pools: [] };
  const coreCell = (cx, cy) => cx * CELL < CORE && cy * CELL < CORE;
  // base terrain
  for (let cy = 0; cy < GH; cy++) for (let cx = 0; cx < GW; cx++) {
    const x = cx * CELL + 8, y = cy * CELL + 8;
    let c = CODE.grass;
    if (coreCell(cx, cy)) c = 255;
    else {
      const coast = 700 + 50 * Math.sin(x / 640) + 24 * Math.sin(x / 210);
      if (y < coast) c = CODE.water;
      else if (y < coast + 70) c = CODE.sand;
      else if (x > 10040 || y > 9060) c = CODE.sand;
      else if (x < 420) c = CODE.sand;
      else if ((x < 4180 && y < 4096) || (y < 4170 && x < 4096)) c = CODE.sand;
      else if (y > 3900 && y < 6700 && x > 4096) c = CODE.dirt;
    }
    grid[cy * GW + cx] = c;
  }
  const fill = (x, y, w, h, code, onlyIf) => {
    const x0 = Math.max(0, Math.floor(x / CELL)), y0 = Math.max(0, Math.floor(y / CELL));
    const x1 = Math.min(GW, Math.ceil((x + w) / CELL)), y1 = Math.min(GH, Math.ceil((y + h) / CELL));
    for (let cy = y0; cy < y1; cy++) for (let cx = x0; cx < x1; cx++) {
      const i = cy * GW + cx;
      if (onlyIf && !onlyIf(grid[i])) continue;
      grid[i] = code;
    }
  };
  W.fill = fill;
  // river
  const RIVER = [6600, 6800];
  fill(0, RIVER[0], WORLD_W, RIVER[1] - RIVER[0], CODE.water);
  fill(0, RIVER[0] - 40, WORLD_W, 40, CODE.sand, (c) => c !== 255);
  fill(0, RIVER[1], WORLD_W, 40, CODE.sand, (c) => c !== 255);
  W.waterRects.push([0, RIVER[0], WORLD_W, RIVER[1] - RIVER[0]]);
  W.river = RIVER;

  // road network
  const SW = 30; // sidewalk
  const V = [ // vertical roads: x, y0, y1, w, lanes, median, kind
    [500, 3900, 9000, 200, 2, 0, "arterial"],
    [980, 3900, 9000, 200, 2, 0, "arterial"],
    [1964, 3820, 9000, 320, 2, 40, "boulevard"],
    [2900, 3900, 9000, 200, 2, 0, "arterial"],
    [3840, 3900, 9000, 200, 2, 0, "highway"],
    [4700, 860, 9000, 200, 2, 0, "arterial"],
    [5600, 860, 9000, 320, 2, 40, "boulevard"],
    [6500, 860, 9000, 200, 2, 0, "arterial"],
    [7400, 860, 6800, 200, 2, 0, "arterial"],
    [8300, 860, 6800, 320, 2, 40, "boulevard"],
    [9200, 860, 6800, 200, 2, 0, "arterial"],
    [10000, 860, 9000, 200, 2, 0, "arterial"],
  ];
  const H = [ // horizontal: y, x0, x1, w
    [860, 4700, 10000, 200, 2, 0, "coast"],
    [1600, 3720, 10000, 200, 2, 0, "arterial"],
    [2620, 3720, 10000, 320, 2, 40, "boulevard"],
    [3900, 3840, 10000, 240, 2, 40, "highway"],
    [4800, 500, 10000, 200, 2, 0, "arterial"],
    [5800, 500, 10000, 200, 2, 0, "arterial"],
    [7300, 500, 6500, 200, 2, 0, "arterial"],
    [8200, 500, 6500, 200, 2, 0, "arterial"],
    [9000, 500, 10000, 200, 2, 0, "arterial"],
  ];
  // side streets (1+1) splitting big blocks, skipping airfield/park blocks
  const SIDE_V = [[1470, 3900, 6200], [2430, 3900, 6200], [3370, 3900, 6200], [5150, 1600, 3900], [6050, 1600, 3900], [6950, 1600, 3900], [7850, 1600, 3900], [8750, 1600, 3900], [9600, 1600, 3900],
    [1470, 7300, 9000], [2430, 7300, 9000], [3370, 7300, 9000], [5150, 3900, 5800], [7850, 3900, 5800], [740, 7300, 9000]];
  const SIDE_H = [[2110, 4700, 10000], [3260, 4700, 10000], [4350, 500, 3840], [5300, 500, 3840], [6200, 500, 3840], [7750, 500, 6500], [8600, 500, 6500], [5300, 4700, 10000]];
  const segs = [];
  for (const [x, y0, y1, w, lanes, med, k] of V) segs.push({ v: true, c: x, a: y0, b: y1, w, lanes, med, k });
  for (const [y, x0, x1, w, lanes, med, k] of H) segs.push({ v: false, c: y, a: x0, b: x1, w, lanes, med, k });
  for (const [x, y0, y1] of SIDE_V) segs.push({ v: true, c: x, a: y0, b: y1, w: 112, lanes: 1, med: 0, k: "street" });
  for (const [y, x0, x1] of SIDE_H) segs.push({ v: false, c: y, a: x0, b: x1, w: 112, lanes: 1, med: 0, k: "street" });
  const rectOf = (s, pad = 0) => s.v ? [s.c - s.w / 2 - pad, s.a - pad, s.w + pad * 2, s.b - s.a + pad * 2] : [s.a - pad, s.c - s.w / 2 - pad, s.b - s.a + pad * 2, s.w + pad * 2];
  // clip inside core (keep only stubs from the core ring outward)
  const notCoreInterior = (c) => c !== 255;
  for (const s of segs) {
    const r = rectOf(s, SW);
    if (s.k !== "highway") fill(r[0], r[1], r[2], r[3], CODE.walk, (c) => c !== 255 && c !== CODE.road);
  }
  for (const s of segs) {
    const r = rectOf(s, 0);
    fill(r[0], r[1], r[2], r[3], CODE.road, (c) => c !== 255 || true);
  }
  // re-protect the core interior except where stubs exit the ring
  for (let cy = 0; cy < CORE / CELL; cy++) for (let cx = 0; cx < CORE / CELL; cx++) {
    const x = cx * CELL + 8, y = cy * CELL + 8;
    const stub = (x > 3930 && y < 4000) || (y > 3990) ;
    if (!stub) grid[cy * GW + cx] = 255;
    else if (grid[cy * GW + cx] !== CODE.road) grid[cy * GW + cx] = 255;
  }
  W.roads = segs;
  W.sw = SW;
  // bridges: walkway rails over the river handled by road stamping (road overrides water)

  // intersections
  const nodes = [];
  for (const a of segs) if (a.v) for (const b of segs) if (!b.v) {
    if (b.c >= a.a - 1 && b.c <= a.b + 1 && a.c >= b.a - 1 && a.c <= b.b + 1) nodes.push({ x: a.c, y: b.c, vs: a, hs: b });
  }
  W.inter = nodes;
  for (const n of nodes) {
    // crosswalk-friendly intersection: signals on bigger roads
    if (n.vs.w >= 200 && n.hs.w >= 200 && !(n.x < CORE && n.y < CORE)) W.signals.push({ x: n.x, y: n.y, r: Math.max(n.vs.w, n.hs.w) / 2 + 60, gen: true });
  }

  // blocks: cells bounded by roads -> flood fill rectangles of non-road/non-walk land
  const xsB = [...new Set(segs.filter((s) => s.v).map((s) => s.c))].sort((a, b) => a - b);
  const ysB = [...new Set(segs.filter((s) => !s.v).map((s) => s.c))].sort((a, b) => a - b);
  const blocks = [];
  const roadAt = (v, c, p) => segs.find((s) => s.v === v && s.c === c && p >= s.a - 5 && p <= s.b + 5);
  const allX = [420, ...xsB, 10240], allY = [700, ...ysB, 9216];
  for (let i = 0; i < allX.length - 1; i++) for (let j = 0; j < allY.length - 1; j++) {
    const x0 = allX[i], x1 = allX[i + 1], y0 = allY[j], y1 = allY[j + 1];
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    const L = roadAt(true, x0, cy), Rr = roadAt(true, x1, cy), T = roadAt(false, y0, cx), B = roadAt(false, y1, cx);
    const bx0 = x0 + (L ? L.w / 2 + SW : 0), bx1 = x1 - (Rr ? Rr.w / 2 + SW : 0);
    const by0 = y0 + (T ? T.w / 2 + SW : 0), by1 = y1 - (B ? B.w / 2 + SW : 0);
    if (bx1 - bx0 < 60 || by1 - by0 < 60) continue;
    // skip core and river and ocean
    if (bx1 <= CORE + 40 && by1 <= CORE + 40) continue;
    if (by0 >= RIVER[0] - 50 && by1 <= RIVER[1] + 50) continue;
    if (by1 < 760) continue;
    blocks.push({ x: bx0, y: by0, w: bx1 - bx0, h: by1 - by0, L: !!L, R: !!Rr, T: !!T, B: !!B });
  }
  // trim blocks against river / core / coast
  for (const b of blocks) {
    if (b.y < RIVER[0] && b.y + b.h > RIVER[0] - 40) b.h = RIVER[0] - 50 - b.y;
    if (b.y < RIVER[1] + 40 && b.y + b.h > RIVER[1]) { const ny = RIVER[1] + 50; b.h -= ny - b.y; b.y = ny; }
    if (b.x < CORE + 60 && b.y < CORE + 60) { if (b.x < CORE) { const nx = CORE + 60; b.w -= nx - b.x; b.x = nx; } }
    if (b.y < 900 && b.y + b.h > 700) { const ny = 960; b.h -= ny - b.y; b.y = ny; }
  }
  // Global road coordinates used to split plots even where those roads did not
  // exist. Join adjoining land parcels before choosing any building footprint.
  let parcels=blocks.filter(b=>b.w>80&&b.h>80),merged=true;
  const district=b=>DISTRICTS.find(d=>b.x+b.w/2>=d.r[0]&&b.x+b.w/2<d.r[0]+d.r[2]&&b.y+b.h/2>=d.r[1]&&b.y+b.h/2<d.r[1]+d.r[3])?.id;
  while(merged){merged=false;outer:for(let i=0;i<parcels.length;i++)for(let j=i+1;j<parcels.length;j++){
    let a=parcels[i],b=parcels[j];if(district(a)!==district(b))continue;
    if(a.x>b.x)[a,b]=[b,a];
    if(a.y===b.y&&a.h===b.h&&Math.abs(a.x+a.w-b.x)<1&&!a.R&&!b.L&&a.T===b.T&&a.B===b.B){Object.assign(parcels[i],{...a,w:a.w+b.w,R:b.R});parcels.splice(j,1);merged=true;break outer;}
    if(a.y>b.y)[a,b]=[b,a];
    if(a.x===b.x&&a.w===b.w&&Math.abs(a.y+a.h-b.y)<1&&!a.B&&!b.T&&a.L===b.L&&a.R===b.R){Object.assign(parcels[i],{...a,h:a.h+b.h,B:b.B});parcels.splice(j,1);merged=true;break outer;}
  }}
  W.blocks=parcels;

  const dOf = (x, y) => { for (const d of DISTRICTS) { const r = d.r; if (x >= r[0] && y >= r[1] && x < r[0] + r[2] && y < r[1] + r[3]) return d.id; } return "oldtown"; };
  const addB = (x, y, w, h, hgt, roof, wall, kind, extra) => {
    if (w < 24 || h < 24) return null;
    const b = { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h), hgt, roof, wall, kind, ...extra };
    W.buildings.push(b);
    fill(b.x + 2, b.y + 2, b.w - 4, b.h - 4, CODE.build);
    return b;
  };
  const tree = (x, y, s) => { W.trees.push({ x, y, r: s || R(16, 26), t: (rnd() * 3) | 0 }); };
  const WALLS = { brick: ["#7a3f32", "#5e2f27"], cream: ["#c9b79a", "#9e8c72"], grey: ["#8a8d93", "#62656b"], glass: ["#4a6b82", "#2f4658"], dark: ["#3d3f47", "#2a2b31"], white: ["#d8d4cc", "#aaa59c"], tan: ["#b99c76", "#8c7456"], blue: ["#5b6d8c", "#3f4c64"], rust: ["#8c5a3c", "#64402a"] };
  W.WALLS = WALLS;
  const pick = (arr) => arr[(rnd() * arr.length) | 0];
  let civicSquare = 0;
  for (const b of W.blocks) {
    const d = dOf(b.x + b.w / 2, b.y + b.h / 2);
    b.d = d;
    const big = b.w * b.h;
    // Small slivers are planted setbacks, never overlapping miniature buildings.
    if(Math.min(b.w,b.h)<156){fill(b.x,b.y,b.w,b.h,CODE.grass);W.features.push({k:'park',x:b.x,y:b.y,w:b.w,h:b.h,pocket:true});if(b.w>110&&b.h>110)tree(b.x+b.w/2,b.y+b.h/2,16);continue;}
    // street trees on the sidewalk edge (not in the industrial/airfield zones)
    if (d === "eastside" || d === "oldtown" || d === "suburb" || d === "downtown" || d === "port") {
      const step = d === "downtown" ? 170 : 140;
      for (let x = b.x + 50; x < b.x + b.w - 40; x += step) { if (rnd() < 0.8) W.trees.push({ x, y: b.y - SW * 0.45, r: R(10, 13), t: (rnd() * 3) | 0, street: true }); if (rnd() < 0.8) W.trees.push({ x: x + step / 2, y: b.y + b.h + SW * 0.45, r: R(10, 13), t: (rnd() * 3) | 0, street: true }); }
      for (let y = b.y + 50; y < b.y + b.h - 40; y += step) { if (rnd() < 0.8) W.trees.push({ x: b.x - SW * 0.45, y, r: R(10, 13), t: (rnd() * 3) | 0, street: true }); if (rnd() < 0.8) W.trees.push({ x: b.x + b.w + SW * 0.45, y: y + step / 2, r: R(10, 13), t: (rnd() * 3) | 0, street: true }); }
    }
    if (d === "downtown") {
      if (rnd() < 0.16 && big < 600000) { // plaza
        fill(b.x, b.y, b.w, b.h, CODE.walk); W.features.push({ k: "plaza", x: b.x, y: b.y, w: b.w, h: b.h });
        // Keep each civic space legible: two planted squares for each fountain,
        // with ordered edge trees and a clear public route through the middle.
        const fountain=civicSquare++%3===0,cx=b.x+b.w/2,cy=b.y+b.h/2,r=Math.min(68,Math.min(b.w,b.h)*.16);
        if(fountain){W.features.push({k:'fountain',x:cx,y:cy,r});fill(cx-r,cy-r,r*2,r*2,CODE.water);}
        else{for(const sx of [0,1])for(const sy of [0,1]){const x=b.x+36+sx*b.w/2,y=b.y+36+sy*b.h/2,w=b.w/2-72,h=b.h/2-72;if(w>24&&h>24){fill(x,y,w,h,CODE.grass);W.features.push({k:'park',x,y,w,h,pocket:true});}}}
        for(const px of [.16,.84])for(const py of [.16,.34,.66,.84])tree(b.x+b.w*px+R(-3,3),b.y+b.h*py+R(-3,3),18);
        continue;
      }
      fill(b.x, b.y, b.w, b.h, CODE.walk);
      // A common material palette and a walkable court tie each city block together.
      const nx=Math.max(1,Math.ceil(b.w/360)),ny=Math.max(1,Math.ceil(b.h/360)),cw=b.w/nx,ch=b.h/ny;
      const mat=pick(['glass','gravel2','tar']),wall=mat==='glass'?'glass':pick(['grey','cream']);
      for(let i=0;i<nx;i++)for(let j=0;j<ny;j++){
        const w=Math.min(250,cw-64),h=Math.min(230,ch-64);if(w<72||h<72)continue;
        const tall=R(70,140);addB(b.x+i*cw+(cw-w)/2,b.y+j*ch+(ch-h)/2,w,h,tall,mat,wall,'tower');
      }
    } else if (d === "eastside" || d === "oldtown") {
      if (rnd() < (d === "eastside" ? 0.12 : 0.1)) { // park
        fill(b.x, b.y, b.w, b.h, CODE.grass); W.features.push({ k: "park", x: b.x, y: b.y, w: b.w, h: b.h });
        fill(b.x, b.y + b.h / 2 - 12, b.w, 24, CODE.walk); fill(b.x + b.w / 2 - 12, b.y, 24, b.h, CODE.walk);
        if (b.w > 300 && b.h > 300) { const pr = Math.min(b.w, b.h) * 0.18; fill(b.x + b.w * 0.25 - pr / 2, b.y + b.h * 0.25 - pr / 2, pr, pr, CODE.water); W.features.push({ k: "pond", x: b.x + b.w * 0.25, y: b.y + b.h * 0.25, r: pr / 2 }); }
        const n = Math.floor(big / 9000);
        for (let i = 0; i < n; i++) { const x = R(b.x + 20, b.x + b.w - 20), y = R(b.y + 20, b.y + b.h - 20); if (Math.abs(x - b.x - b.w / 2) > 30 && Math.abs(y - b.y - b.h / 2) > 30) tree(x, y); }
        continue;
      }
      // perimeter block: rows along each edge, courtyard inside
      const dep = Math.min(d === "eastside" ? 104 : 76,b.w*.28,b.h*.28);
      const hg = d === "eastside" ? [38, 72] : [20, 34];
      const roofs = d === "eastside" ? ["gravel", "tar", "terra2", "gravel2"] : ["terra", "terra2", "terra", "gravel"];
      const walls = d === "eastside" ? ["brick", "cream", "grey", "tan", "rust"] : ["brick", "cream", "tan", "white", "brick"];
      fill(b.x, b.y, b.w, b.h, d === "oldtown" ? CODE.grass : CODE.lot);
      const blockRoof=pick(roofs),blockWall=pick(walls),gate=b.B?'B':b.T?'T':b.R?'R':'L';
      const row = (x0, y0, len, horiz, side) => {
        let s = 0;
        while (s < len - 30) {
          let wlen = Math.min(len - s, R(d === "eastside" ? 90 : 56, d === "eastside" ? 200 : 100));
          if (len - s - wlen < 40) wlen = len - s;
          const gap=6,hgt=R(hg[0],hg[1]);
          const opening=side===gate&&s<len/2+56&&s+wlen>len/2-56;
          if(!opening){if(horiz)addB(x0+s,y0,wlen-gap,dep,hgt,blockRoof,blockWall,d==='eastside'?'apt':'house');
          else addB(x0,y0+s,dep,wlen-gap,hgt,blockRoof,blockWall,d==='eastside'?'apt':'house');}
          s += wlen;
        }
      };
      row(b.x, b.y, b.w, true,"T");
      row(b.x, b.y + b.h - dep, b.w, true,"B");
      if (b.h - dep * 2 > 60) {
        row(b.x, b.y + dep + 4, b.h - dep * 2 - 8, false,"L");
        row(b.x + b.w - dep, b.y + dep + 4, b.h - dep * 2 - 8, false,"R");
      }
      const ix = b.x + dep + 10, iy = b.y + dep + 10, iw = b.w - dep * 2 - 20, ih = b.h - dep * 2 - 20;
      if (iw > 40 && ih > 40) {
        if (d === "oldtown") { for (let i = 0; i < Math.floor(iw * ih / 7000); i++) tree(R(ix + 10, ix + iw - 10), R(iy + 10, iy + ih - 10)); }
        else {const entry=gate==='B'?{x:b.x+b.w/2,y:b.y+b.h+SW+10}:gate==='T'?{x:b.x+b.w/2,y:b.y-SW-10}:gate==='R'?{x:b.x+b.w+SW+10,y:b.y+b.h/2}:{x:b.x-SW-10,y:b.y+b.h/2};W.lots.push({x:ix,y:iy,w:iw,h:ih,k:'parking',entry});}
      }
    } else if (d === "industrial" || d === "port") {
      fill(b.x, b.y, b.w, b.h, CODE.lot);
      const entry=b.B?{x:b.x+b.w/2,y:b.y+b.h+SW+10}:b.L?{x:b.x-SW-10,y:b.y+b.h-135}:b.R?{x:b.x+b.w+SW+10,y:b.y+b.h-135}:{x:b.x+b.w/2,y:b.y-SW-10};
      W.lots.push({x:b.x,y:b.y,w:b.w,h:b.h,k:d==='port'?'yard':'industrial',entry});
      if (d === "port" && rnd() < 0.55) { // container yard
        const cw = 72, chh = 26;
        for (let y = b.y + 30; y < b.y + b.h - 40; y += chh + 22) {
          for (let x = b.x + 30; x < b.x + b.w - cw - 20; x += cw + 10) {
            if (rnd() < 0.18) continue;
            const stack = 1 + ((rnd() * 3) | 0);
            const col = pick(["#b0402c", "#2c6fb0", "#d2a12c", "#3c8c4c", "#8c8c94", "#c45a1c", "#5a3c8c"]);
            const bb = addB(x, y, cw, chh, 10 * stack, "container", "dark", "container", { color: col });
          }
        }
        W.cranes.push({ x: b.x + b.w * 0.5, y: b.y + 20, w: Math.min(260, b.w * 0.6) });
      } else {
        // warehouses
        const n = b.w > 700 ? 2 : 1;
        for (let i = 0; i < n && b.h >= 360; i++) {
          const w = b.w / n - 128, h = Math.max(48,Math.min(b.h*.55,b.h-240));
          addB(b.x + i * (b.w / n) + 64, b.y + 30, w, h, R(28, 46), pick(["metal", "metal", "metal2", "gravel2"]), pick(["grey", "rust", "dark", "blue"]), "warehouse");
        }

        if (rnd() < 0.2) W.features.push({ k: "tanks", x: b.x + b.w - 80, y: b.y + b.h - 80 });
      }
    } else if (d === "suburb") {
      fill(b.x, b.y, b.w, b.h, CODE.grass);
      const lot = 170;
      const nx = Math.max(1, Math.floor(b.w / lot)), ny = Math.max(1, Math.floor(b.h / lot));
      const lw = b.w / nx, lh = b.h / ny;
      for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
        if (j > 0 && j < ny - 1 && i > 0 && i < nx - 1) { tree(b.x + (i + 0.5) * lw, b.y + (j + 0.5) * lh, 24); continue; }
        const x = b.x + i * lw, y = b.y + j * lh;
        const hw = R(70, 100), hh = R(60, 84);
        const hx = x + (lw - hw) / 2, hy = y + (lh - hh) / 2;
        addB(hx, hy, hw, hh, R(18, 26), pick(["terra", "terra2", "gravel"]), pick(["white", "cream", "tan"]), "villa");
        if (rnd() < 0.55) {
          const px = hx + (i === 0 ? hw + 10 : -50), py = hy + 10;
          if (px > x + 4 && px + 40 < x + lw - 4) { fill(px, py, 40, 26, CODE.water); W.pools.push({ x: px, y: py, w: 40, h: 26 }); }
        }
        tree(x + 18, y + 18, 18); tree(x + lw - 18, y + lh - 18, 18);
      }
    } else if (d === "airfield") {
      fill(b.x, b.y, b.w, b.h, CODE.grass);
    }
  }
  // airfield runway + hangars across the airfield district (one big tarmac)
  {
    const r = [6620, 7420, 3300, 160];
    fill(r[0], r[1], r[2], r[3], CODE.track);
    W.features.push({ k: "runway", x: r[0], y: r[1], w: r[2], h: r[3] });
    const ap = [6620, 7620, 3300, 340];
    fill(ap[0], ap[1], ap[2], ap[3], CODE.lot);
    W.lots.push({ x: ap[0], y: ap[1], w: ap[2], h: ap[3], k: "apron" });
    for (let i = 0; i < 5; i++) addB(6720 + i * 640, 8000, 440, 150, 40, "metal", "grey", "hangar");
    W.features.push({ k: "plane", x: 7400, y: 7790, rot: Math.PI / 2 });
    W.features.push({ k: "plane", x: 8600, y: 7790, rot: Math.PI / 2 });
    W.features.push({ k: "tower", x: 9900, y: 7700 });
  }
  // piers into the ocean along the port
  for (let x = 4500; x < 9900; x += 700) {
    const y1 = 700 + 50 * Math.sin(x / 640);
    fill(x, 380, 70, y1 - 360, CODE.pier);
    W.piers.push({ x, y: 380, w: 70, h: y1 - 360 });
  }
  // lamps along sidewalks of non-highway roads (both sides), every 180
  for (const s of segs) {
    if (s.k === "highway") continue;
    const step = 190;
    for (let p = s.a + 90; p < s.b - 60; p += step) {
      for (const side of [-1, 1]) {
        const off = s.w / 2 + 10;
        const x = s.v ? s.c + side * off : p, y = s.v ? p : s.c + side * off;
        if (x < CORE && y < CORE) continue;
        const c = grid[((y / CELL) | 0) * GW + ((x / CELL) | 0)];
        if (c === CODE.walk) W.lamps.push({ x, y, side, v: s.v });
      }
    }
  }
  // Parked cars are placed in checked marked bays after every clearing operation.
  // Curb positions inside travel lanes used to create permanent traffic blockages.
  // core buildings join the extruded set (heights from meta), roof painted layer is reused
  applyExpansion(W,{CELL,GW,CODE,WORLD_W,WORLD_H});
  applyWorldDetails(W,{CODE});
  applyTransitWorld(W,{CODE});
  // A tree canopy may not cover a basin, even when its trunk is on dry ground.
  const basins=W.features.filter(f=>f.k==='fountain'||f.k==='pond');
  W.trees=W.trees.filter(t=>!basins.some(f=>Math.hypot(t.x-f.x,t.y-f.y)<f.r*1.2+t.r+12));
  planParking(W);
  W.coreBuildings = (meta.buildings || []).map((b) => ({ ...b, core: true }));
  return W;
}

/* Marked parking courts share their geometry with cars and ground paint. */
export function planParking(W){
  W.parking=[];const allowed=new Set([CODE.lot,CODE.walk,CODE.grass,CODE.dirt,CODE.road]);
  const rectClear=(r,bay=false)=>{
    if(r.x<CORE&&r.y<CORE||r.x<0||r.y<0||r.x+r.w>=WORLD_W||r.y+r.h>=WORLD_H)return false;
    for(let y=Math.floor(r.y/CELL);y<=Math.floor((r.y+r.h)/CELL);y++)for(let x=Math.floor(r.x/CELL);x<=Math.floor((r.x+r.w)/CELL);x++){
      const code=W.grid[y*GW+x];if(bay?code!==CODE.lot:!allowed.has(code))return false;
    }
    return !W.trees.some(t=>t.x+t.r>r.x&&t.x-t.r<r.x+r.w&&t.y+t.r>r.y&&t.y-t.r<r.y+r.h);
  };
  const corridor=(a,b)=>({x:Math.min(a.x,b.x)-48,y:Math.min(a.y,b.y)-48,w:Math.abs(a.x-b.x)+96,h:Math.abs(a.y-b.y)+96});
  for(const lot of W.lots){
    if(lot.k==='apron')continue;lot.bays=[];
    if(!lot.entry||lot.k==='yard'||lot.w<180||lot.h<240)continue;
    let chosen=null;
    for(const bottom of [true,false]){
      const y=bottom?lot.y+lot.h-76:lot.y+76,aisleY=y+(bottom?-108:108),centre={x:lot.x+lot.w/2,y:aisleY};
      const aisle={x:lot.x+18,y:aisleY-46,w:lot.w-36,h:92};if(!rectClear(aisle))continue;
      let route=null;for(const bend of [{x:centre.x,y:lot.entry.y},{x:lot.entry.x,y:centre.y}]){const rs=[corridor(centre,bend),corridor(bend,lot.entry)];if(rs.every(r=>rectClear(r))){route=rs;break;}}if(!route)continue;
      const bays=[];for(let x=lot.x+48;x<lot.x+lot.w-40;x+=72){
        const r={x:x-32,y:y-60,w:64,h:120};if(!rectClear(r,true)||route.some(d=>r.x<d.x+d.w&&r.x+r.w>d.x&&r.y<d.y+d.h&&r.y+r.h>d.y))continue;
        bays.push({x,y,rot:bottom?0:Math.PI,w:64,l:120,occupied:false});
      }
      if(bays.length&&(!chosen||bays.length>chosen.bays.length))chosen={bays,aisle,route};
    }
    if(!chosen)continue;lot.bays=chosen.bays;lot.aisle=chosen.aisle;lot.driveways=chosen.route;
    const intersects=(p,r)=>p.x+(p.r||0)>r.x&&p.x-(p.r||0)<r.x+r.w&&p.y+(p.r||0)>r.y&&p.y-(p.r||0)<r.y+r.h;
    W.lamps=W.lamps.filter(p=>!chosen.route.some(r=>intersects({...p,r:12},r)));
    W.features=W.features.filter(p=>p.k!=='tanks'||![chosen.aisle,...chosen.route,...chosen.bays.map(b=>({x:b.x-32,y:b.y-60,w:64,h:120}))].some(r=>intersects({...p,r:70},r)));
    for(const r of chosen.route)W.fill(r.x,r.y,r.w,r.h,CODE.lot,c=>c!==CODE.road);
    const reserved=bay=>(lot.walkways||[]).some(r=>bay.x+bay.w/2>r.x&&bay.x-bay.w/2<r.x+r.w&&bay.y+bay.l/2>r.y&&bay.y-bay.l/2<r.y+r.h);
    // Reserve pedestrian approaches without renumbering the other spaces: an
    // already empty bay can become a path without moving the parked population.
    for(let i=0;i<lot.bays.length;i++){const bay=lot.bays[i];if(i%4===3||reserved(bay)||W.parking.length>=220)continue;bay.occupied=true;W.parking.push({...bay,lot:W.lots.indexOf(lot),planned:true});}
    lot.bays=lot.bays.filter(bay=>!reserved(bay));
  }
  W.parkingPlan={bays:W.lots.reduce((n,l)=>n+(l.bays?.length||0),0),occupied:W.parking.length};
}

/* ---------------- collision ---------------- */
export function makeCollision(W, coreMask, coreMS) {
  const sc = coreMS / CORE;
  return (x, y) => {
    if (x < 0 || y < 0 || x >= WORLD_W || y >= WORLD_H) return CODE.build;
    const g = W.grid[((y / CELL) | 0) * GW + ((x / CELL) | 0)];
    if (g !== 255) return g;
    return coreMask[((y * sc) | 0) * coreMS + ((x * sc) | 0)];
  };
}
