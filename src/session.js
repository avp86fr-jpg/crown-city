/* Validated session data and shared coordinate helpers. No browser state here. */
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const finite = (v, fallback, lo = -Infinity, hi = Infinity) =>
  Number.isFinite(v) ? clamp(v, lo, hi) : fallback;
export function readJSON(storage, key, fallback = null) {
  try {
    const value = JSON.parse(storage.getItem(key) || 'null');
    return value && typeof value === 'object' && !Array.isArray(value) ? value : fallback;
  } catch { return fallback; }
}
export function settingsFrom(value, touch = false) {
  const s = value && typeof value === 'object' ? value : {};
  return {
    quality: ['low', 'med', 'high'].includes(s.quality) ? s.quality : touch ? 'low' : 'high',
    timeSpeed: Number.isInteger(s.timeSpeed) ? clamp(s.timeSpeed, 0, 3) : 1,
    master: finite(s.master, 0.9, 0, 1), sfx: finite(s.sfx, 0.8, 0, 1), mus: finite(s.mus, 0.6, 0, 1),
    autoRes: s.autoRes !== false, autoFS: s.autoFS !== false,
    showFps: s.showFps === true, reducedMotion: s.reducedMotion === true,
  };
}
export function flagsFrom(value) {
  const f = value && typeof value === 'object' ? value : {};
  return {
    stash: f.stash === 'flip' ? 'flip' : 'safe', heist: f.heist === 'loud' ? 'loud' : 'quiet',
    finance: f.finance === 'credit' ? 'credit' : 'upfront', scrambler: f.scrambler === true,
    neuralDebt: finite(f.neuralDebt, 0, 0, 600), vaultBag: f.vaultBag === true,
  };
}
export function screenToWorld(G, x, y) {
  const base = Math.sqrt(G.canvas.width * G.canvas.height / (1280 * 720));
  const small = G.cssW && Math.min(G.cssW, G.cssH) < 520 ? 1.12 : 1;
  const scale = G.cam.scale * base * small * (G.zoomMul || 1);
  const dx = (x - G.canvas.width / 2) / scale, dy = (y - G.canvas.height / 2) / scale;
  const c = Math.cos(G.cam.rot), s = Math.sin(G.cam.rot);
  return { x: G.cam.x + dx * c - dy * s, y: G.cam.y + dx * s + dy * c };
}
export function raceCourse(meta, laps = 1) {
  const pts = meta.race.checkpoints;
  // Leave the start line, visit every gate, then return to the start to finish.
  const lap = pts.slice(1).concat([pts[0]]);
  return Array.from({ length: Math.max(1, Math.min(3, laps | 0)) }, () => lap.map(p => p.slice())).flat();
}
export function resetInput(I) {
  for (const k of ['enterP', 'fireP', 'pauseP', 'skipP', 'confirmP', 'mapP', 'radioP',
    'upP', 'downP', 'leftP', 'rightP', 'vnTap', 'fire', 'tFire', 'tBrake', 'tHand', 'tBoost', 'tSprint','weaponP','reloadP','crewP','dodgeP']) I[k] = false;
  I.x = I.y = 0;
  I.mouse.down = I.mouse.fire = false;
  I.touchJoy = { x: 0, y: 0, active: false };
}
