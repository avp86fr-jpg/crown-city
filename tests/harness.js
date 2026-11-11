import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { boot, testing } from '../src/game.js';
export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Decode the repository's grayscale collision PNG using Node's standard library.
// Rendering is mocked; collision, roads, navigation, physics and mission code are real.
function maskPixels() {
  const png = fs.readFileSync(path.join(root, 'assets/city/mask_gray.png'));
  const width = png.readUInt32BE(16), height = png.readUInt32BE(20);
  if (png[24] !== 8 || png[25] !== 0) throw new Error('Expected 8-bit grayscale collision mask');
  const chunks = [];
  for (let offset = 8; offset < png.length;) {
    const size = png.readUInt32BE(offset), name = png.toString('ascii', offset + 4, offset + 8);
    if (name === 'IDAT') chunks.push(png.subarray(offset + 8, offset + 8 + size));
    offset += size + 12;
  }
  const data = zlib.inflateSync(Buffer.concat(chunks));
  const pixels = new Uint8Array(width * height);
  const paeth = (a, b, c) => { const p = a + b - c, x = Math.abs(p - a), y = Math.abs(p - b), z = Math.abs(p - c); return x <= y && x <= z ? a : y <= z ? b : c; };
  for (let y = 0, offset = 0; y < height; y++) {
    const filter = data[offset++];
    for (let x = 0; x < width; x++) {
      const i = y * width + x, a = x ? pixels[i - 1] : 0, b = y ? pixels[i - width] : 0, c = x && y ? pixels[i - width - 1] : 0;
      const predictor = [0, a, b, (a + b) >>> 1, paeth(a, b, c)][filter];
      if (predictor === undefined) throw new Error('Unknown PNG filter');
      pixels[i] = (data[offset++] + predictor) & 255;
    }
  }
  return { pixels, width, height };
}

export async function harness({ width = 1280, height = 720, stored = {}, raster = null } = {}) {
  const mask = maskPixels(), nodes = new Map(), events = new Map(), calls = [], storage = new Map(Object.entries(stored));
  const noop = () => {};
  const on = (type, fn) => { if (!events.has(type)) events.set(type, []); events.get(type).push(fn); };
  function element(tag) {
    const listeners = new Map(), classes = new Set();
    const node = { width: 1280, height: 720, clientWidth: width, clientHeight: height, hidden: false,
      style: { setProperty: noop }, dataset: {}, appendChild: noop, querySelector: () => null,
      classList: { add: (...xs) => xs.forEach(x => classes.add(x)), remove: (...xs) => xs.forEach(x => classes.delete(x)),
        contains: x => classes.has(x), toggle: (x, on) => on ? classes.add(x) : classes.delete(x) },
      getBoundingClientRect: () => ({ left: 0, top: 0, width, height }), setPointerCapture: noop,
      addEventListener: (type, fn) => { if (!listeners.has(type)) listeners.set(type, []); listeners.get(type).push(fn); },
      dispatch(type, data) { for (const fn of listeners.get(type) || []) fn({ preventDefault: noop, stopPropagation: noop, ...data }); }
    };
    let image = null;
    const ctx = new Proxy({ canvas: node }, {
      get(object, key) {
        if (key in object) return object[key];
        if (key === 'drawImage') return img => { image = img; };
        if (key === 'measureText') return text => ({ width: String(text).length * 7 });
        if (key === 'createLinearGradient' || key === 'createRadialGradient') return () => ({ addColorStop: noop });
        if (key === 'createPattern') return () => ({ setTransform: noop });
        if (key === 'createImageData') return (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) });
        if (key === 'getImageData') return (x, y, w, h) => {
          const data = new Uint8ClampedArray(w * h * 4);
          if (image?._src === 'assets/city/mask_gray.png') {
            for (let iy = 0; iy < h; iy++) for (let ix = 0; ix < w; ix++) {
              const code = mask.pixels[Math.floor((iy + 0.5) * mask.height / h) * mask.width + Math.floor((ix + 0.5) * mask.width / w)];
              const i = (iy * w + ix) * 4; data[i] = data[i + 1] = data[i + 2] = code; data[i + 3] = 255;
            }
          }
          return { data };
        };
        return noop;
      }
    });
    if (raster && (tag === 'canvas' || tag === 'c')) {
      const canvas = raster.createCanvas(node.width, node.height);
      const { width: _w, height: _h, ...props } = node;
      Object.assign(canvas, props);
      return canvas;
    }
    node.getContext = () => ctx;
    return node;
  }
  class Image {
    constructor() { this.width = this.height = this.naturalWidth = 128; }
    set src(src) {
      this._src = src; calls.push(src);
      const exists = fs.existsSync(path.join(root, src));
      if (exists && /\.png$/.test(src)) { const b = fs.readFileSync(path.join(root, src)); this.width = b.readUInt32BE(16); this.height = b.readUInt32BE(20); }
      if (src === 'assets/city/mask_gray.png') this.width = this.height = 4096;
      queueMicrotask(() => exists ? this.onload?.() : this.onerror?.());
    }
    get src() { return this._src; }
    decode() { return Promise.resolve(); }
  }
  if (raster) {
    class RasterImage extends raster.Image {
      set src(src) { calls.push(src); super.src = fs.readFileSync(path.join(root, src)); }
    }
    globalThis.Image = RasterImage;
  } else globalThis.Image = Image;
  globalThis.window = { innerWidth: width, innerHeight: height, devicePixelRatio: 1, addEventListener: on, matchMedia: () => ({ matches: false }) };
  globalThis.document = { hidden: false, body: element('body'), documentElement: element('html'),
    getElementById: id => { if (!nodes.has(id)) nodes.set(id, element(id)); return nodes.get(id); },
    createElement: element, addEventListener: on, querySelectorAll: () => [] };
  Object.defineProperty(globalThis, 'navigator', { value: { maxTouchPoints: 0, userAgent: 'test', platform: 'test' }, configurable: true });
  globalThis.localStorage = { getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v) };
  globalThis.fetch = async url => ({ ok: fs.existsSync(path.join(root, url)), json: async () => JSON.parse(fs.readFileSync(path.join(root, url), 'utf8')) });
  globalThis.matchMedia = window.matchMedia;
  globalThis.getComputedStyle = () => ({ paddingTop: '0', paddingRight: '0', paddingBottom: '0', paddingLeft: '0' });
  globalThis.screen = { orientation: { lock: async () => {} } };
  globalThis.requestAnimationFrame = noop;
  globalThis.DOMMatrix = raster?.DOMMatrix || class { constructor(values) { this.values = values; } };
  const G = await boot();
  const dispatch = (type, value) => { for (const fn of events.get(type) || []) fn({ preventDefault: noop, repeat: false, ...value }); };
  const readyVN = () => Promise.all(G.storyLoads.values());
  return { G, T: testing, dispatch, nodes, calls, storage, readyVN };
}
