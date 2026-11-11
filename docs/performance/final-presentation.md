# Final rendering comparison — 2026-11-11

Baseline: `dca5415ffa342a9536b52b921eee852a20b9a620`. Chromium runs in the shared Linux environment, with CPU throttling at 4×. These are browser observations, not measurements from a Redmi handset.

## Actual mobile input

`tools/world-profile.cjs` uses a touch-enabled 844×390 viewport at DPR 2, low quality, fixed resolution, a seeded world, CDP touch drags and four-second samples after warmup. No keyboard event switches the game into desktop mode. Values below are **before / after**. The after sample includes cached signal heads; the later canopy cache affects terrain composition, not its steady mobile draw path.

| Scene | Presented frames/s | Callback work p50 ms | Callback work p95 ms | Source terrain chunks |
|---|---:|---:|---:|---:|
| boulevard | 36.8 / 36.7 | 7.0 / 6.9 | 13.5 / 13.7 | 0 / 0 |
| regional | 47.5 / 38.6 | 4.6 / 5.5 | 8.5 / 9.2 | 6 / 6 |
| forest | 50.0 / 47.1 | 3.8 / 3.6 | 8.2 / 10.5 | 17 / 8 |
| airfield | 36.0 / 32.3 | 6.0 / 6.9 | 20.2 / 44.6 | 24 / 8 |

The FPS results do not show a general improvement. Wall-clock traffic/crowd populations differ between samples; composition, browser scheduling and the host's software rendering also affect presentation. An earlier isolated pair returned 35.6→38.6 FPS at the airfield while the control pair above went the other way. Accordingly this release does not advertise a percentage FPS increase or a 60 FPS target met.

The source canvas bound is deterministic: 24→8 chunks at 512×512 RGBA, reducing that cache's ceiling by 16 MiB. Finished outer tiles are cached separately. New shared canopy artwork has a separate maximum of about 1.7 MiB. The nine-location browser traversal verifies that source and finished tile caches stay within their bounds and visible tiles settle without thrashing.

## Lighting and scenery draw work

`tools/lighting-profile.cjs` freezes the camera and simulation, retains one player and removes traffic/crowds, then samples 60 renders, one per native animation frame. Quality is medium at 1280×720. This isolates render submission, not total frame delivery. Values are **before / after**.

| Scene | Filled paths | Radial gradients constructed | Render p50 ms | Render p95 ms |
|---|---:|---:|---:|---:|
| palace-night | 893 / 479 | 8 / 0 | 136.8 / 99.8 | 193.5 / 299.6 |
| canal-night | 311 / 55 | 31 / 0 | 18.5 / 28.0 | 125.3 / 74.2 |
| palace-day | 937 / 469 | 0 / 0 | 164.5 / 95.6 | 265.9 / 119.6 |

The core uses substantially fewer filled paths, and all three sampled views avoid per-frame radial-gradient construction. The canal now renders previously invalid lamp pools, so the before and after lighting content is not identical. Its median was higher while its upper-tail sample improved. The Palace night upper-tail sample also varied; the reduced operation counts should not be presented as a guarantee of smoother hardware frame pacing.

Six regression tests additionally verify simulation-timed flash expiry, pause/render independence, current-art glow alignment, nearest-lamp budgets, finite canal lamps and agreement between rendered signals and traffic AI. The exact source image for Gold Mage remains unchanged.
