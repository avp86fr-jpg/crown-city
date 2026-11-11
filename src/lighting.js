/* Time of day + light map. Ambient multiply pass at reduced resolution with additive lights. */
const TAU = Math.PI * 2;
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// key frames: hour -> ambient rgb (multiply), sun elevation handled separately
const AMB = [
  [0, [71, 84, 124]], [4.5, [73, 86, 126]], [5.6, [120, 92, 120]], [6.4, [236, 170, 140]], [7.4, [255, 236, 214]],
  [9, [255, 255, 250]], [16, [255, 252, 244]], [17.4, [255, 214, 168]], [18.4, [236, 140, 112]], [19.3, [130, 84, 126]],
  [20.2, [75, 85, 130]], [21, [71, 84, 124]], [24, [71, 84, 124]],
];
export function ambientAt(t) {
  for (let i = 0; i < AMB.length - 1; i++) {
    const [h0, c0] = AMB[i], [h1, c1] = AMB[i + 1];
    if (t >= h0 && t <= h1) {
      const k = (t - h0) / (h1 - h0 || 1);
      const s = k * k * (3 - 2 * k);
      return [lerp(c0[0], c1[0], s), lerp(c0[1], c1[1], s), lerp(c0[2], c1[2], s)];
    }
  }
  return AMB[0][1];
}
export function darkness(t) {
  const a = ambientAt(t);
  return clamp(1 - (a[0] + a[1] + a[2]) / 765, 0, 1);
}
// sun direction (unit vector pointing FROM sun along ground) and shadow length factor
export function sunAt(t) {
  const day = clamp((t - 6) / 13, 0, 1); // 6:00 -> 19:00
  const up = Math.sin(day * Math.PI);
  const az = lerp(-Math.PI * 0.5, Math.PI * 0.5, day); // east -> west
  // light comes from (cos(az)*-1 ...) ; shadow falls away from the sun
  const sx = Math.sin(az), sy = -0.45; // sun slightly south -> shadows fall north
  const L = Math.hypot(sx, sy) || 1;
  const alive = t > 6 && t < 19.2;
  return { x: sx / L, y: sy / L, len: alive ? clamp(0.25 / Math.max(0.18, up), 0.25, 1.4) : 0, alpha: alive ? clamp(up * 1.6, 0, 1) * 0.34 : 0, up };
}
export function timeLabel(t) {
  const h = t | 0, m = ((t % 1) * 60) | 0;
  const phase = t < 5.5 ? "NIGHT" : t < 7.5 ? "DAWN" : t < 17 ? "DAY" : t < 19.8 ? "DUSK" : "NIGHT";
  return { text: `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`, phase };
}

const sprites = new Map();
function radial(color, size = 128) {
  const k = color + size;
  if (sprites.has(k)) return sprites.get(k);
  const c = document.createElement("canvas"); c.width = c.height = size;
  const x = c.getContext("2d");
  const g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, color); g.addColorStop(0.25, color.replace(/[\d.]+\)$/, (m) => (parseFloat(m) * 0.55).toFixed(3) + ")"));
  g.addColorStop(0.6, color.replace(/[\d.]+\)$/, (m) => (parseFloat(m) * 0.16).toFixed(3) + ")"));
  g.addColorStop(1, "rgba(0,0,0,0)");
  x.fillStyle = g; x.fillRect(0, 0, size, size);
  sprites.set(k, c); return c;
}
function cone(color) {
  const k = "cone" + color;
  if (sprites.has(k)) return sprites.get(k);
  const W = 128, H = 256;
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const x = c.getContext("2d");
  const g = x.createLinearGradient(0, H, 0, 0);
  g.addColorStop(0, color); g.addColorStop(0.35, color.replace(/[\d.]+\)$/, "0.45)")); g.addColorStop(1, "rgba(0,0,0,0)");
  x.fillStyle = g;
  x.beginPath(); x.moveTo(W / 2 - 6, H); x.lineTo(0, 10); x.quadraticCurveTo(W / 2, -10, W, 10); x.lineTo(W / 2 + 6, H); x.closePath(); x.fill();
  // soften edges
  const c2 = document.createElement("canvas"); c2.width = W; c2.height = H;
  const y = c2.getContext("2d"); y.filter = "blur(6px)"; y.drawImage(c, 0, 0);
  sprites.set(k, c2); return c2;
}
export const LIGHT = { radial, cone };

export function createLighting() {
  const cv = document.createElement("canvas");
  const lx = cv.getContext("2d");
  const sh = document.createElement("canvas");
  const sx = sh.getContext("2d");
  return {
    cv, lx, sh, sx,
    resize(w, h, q) {
      const d = q === "low" ? 3 : 2;
      const W = Math.max(64, Math.ceil(w / d)), H = Math.max(64, Math.ceil(h / d));
      if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; sh.width = W; sh.height = H; }
      this.div = d;
    },
  };
}
