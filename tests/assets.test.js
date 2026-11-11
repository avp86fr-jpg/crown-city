import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadImage } from '../src/assets.js';
import { TileLayer } from '../src/render_world.js';

test('cached image events can settle synchronously, without requiring decode()', async () => {
  globalThis.Image = class { set src(value) { this.naturalWidth = 32; this.onload(); } };
  const image = await loadImage('cached.png'); assert.equal(image.naturalWidth, 32);
});

test('a failed image rejects and a silent request has a bounded timeout', async () => {
  globalThis.Image = class { set src(value) { this.onerror(); } };
  await assert.rejects(loadImage('missing.png'), /unavailable/);
  globalThis.Image = class { set src(value) {} };
  await assert.rejects(loadImage('stalled.png', 5), /timed out/);
});

test('tile preload and rendering share one pending request, then can evict it', async () => {
  let count = 0;
  globalThis.Image = class { set src(value) { count++; this.naturalWidth = 32; queueMicrotask(() => this.onload()); } };
  const layer = new TileLayer('albedo', ['0_0'], 1024);
  const pending = layer.preload(['0_0']); layer.get(0, 0, 1); layer.get(0, 0, 2);
  await pending; assert.equal(count, 1); assert.ok(layer.get(0, 0, 2));
  layer.evict(1000); assert.equal(layer.img.size, 0);
});

test('missing tiles back off instead of retrying every render frame', async () => {
  let count = 0;
  globalThis.Image = class { set src(value) { count++; queueMicrotask(() => this.onerror()); } };
  const layer = new TileLayer('albedo', ['0_0'], 1024);
  layer.get(0, 0, 0); await Promise.all(layer.pending.values());
  for (let frame = 1; frame < 600; frame++) layer.get(0, 0, frame);
  assert.equal(count, 1);
  layer.get(0, 0, 600); await Promise.all(layer.pending.values()); assert.equal(count, 2);
});
