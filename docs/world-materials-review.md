# World materials and atmosphere

The illustrated overhead world now uses a new eight-material atlas: fine asphalt, city paving, limestone terrace, woodland soil, desert sand, granite ground, packed trails and blue coastal water. Texture scale is tuned to the vehicles and buildings. Natural terrain retains more of its painted detail instead of being hidden under a nearly opaque flat tint.

The original city receives a selective surface finish using its collision mask. Roads retain their markings, and building and pier footprints are excluded. Shallow water changes tone near land. Outer beaches have restrained wet margins, small pebbles and thin tide lines, replacing thick white cell borders. All 32 core day/night tiles and 26 outer-world sheets are rebuilt for mobile.

## Motion and rendering

- Sea and canal wavelets are anchored to world coordinates and drawn before actors and structures. Their swept footprints are checked against water, including the interior of each footprint so narrow piers cannot be crossed. Surf appears only beside sand/grass banks.
- A common wind field drives desktop canopies, airport windsocks, lifted leaves and rooftop smoke. Plumes originate from visible extraction fans and residential chimneys, with softer visibility at night and in rain. Authored core roofs and helipads receive no invented smoke sources.
- Performance mode caps water at 64 wavelets and 40 shore strokes, and atmosphere at 10 leaves, three plumes and 15 puffs. Water geometry builds at most two chunks per frame and retains at most 80 small plans. Smoke and leaves use analytical animation with no accumulating particles.
- Fine effects stop at distant flight zoom and respect Reduced Motion. Desktop surface finishes retain at most 48 small street-view tiles plus 16 coarse tiles for consistent terrain/water color at flight zoom; mobile uses baked scenery with no live surface composition for the city core.
- Desktop no longer loads four shoreline animation layers or draws two scrolling full-view water passes beneath opaque terrain. One authored base and the shared water-motion pass remain.

## Validation

418 Node regression tests pass, including new tests for shoreline geometry, narrow-pier clearance, smoke fixtures, reduced motion, deterministic wind and cache limits. Dedicated Chromium checks cover both quality modes, sea/canal animation, forest/desert/casino materials and daytime/nighttime smoke. A pixel check confirms water moves while Reduced Motion remains still.

The graphics update preserves collision geometry, missions, NFT portraits, the opening film and the trailer. Texture compression increased the complete set of 26 streamed outer sheets from approximately 6.35 MB to 7.37 MB; only nearby sheets are loaded, and decoded bitmap dimensions/cache budgets are unchanged.

A six-minute Chromium touch-browser run at 844×390, DPR 2 and 4× CPU throttling averaged **55.4 FPS**. Its 30-second samples ranged from **52.7 to 59.5 FPS**, with **18.6–31.4 MiB** of sampled JavaScript heap and no browser errors. The 80-chunk water-plan limit held throughout the route. These are emulation measurements on this host, not a frame-rate guarantee for a physical Redmi Note. The long run covered water, foliage and streamed terrain; the separate day/night browser checks exercise the smoke sources.

## Reproduce

Run `npm run build`, start `npm run serve`, then set `CC_URL` to the preview URL for `npm run test:materials`. `node tools/sustained-profile.cjs materials URL 360 4 world` performs a six-minute, 4× CPU-throttled touch-browser trip across coast, canal, forest, industrial, desert and casino locations, recording frame timing, heap, caches and effect budgets. `node tools/map-visual-review.cjs URL` captures 13 authored locations in both renderers.
