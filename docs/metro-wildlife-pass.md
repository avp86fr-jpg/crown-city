# Metro, wildlife and vehicle polish — 2026-11-11

## Reference correction and presentation

The previous retained Gold Mage image was altered. The supplied 1280-square JPEG now replaces it byte-for-byte, with a new runtime filename to avoid stale image caches. Dialogue, contact panels, the About page, its story/casino captures and the trailer use the correction. The world character uses original portrait pixels within a traced silhouette over a small animated robe; the old generated atlas column is never drawn. Chief, Ice and Steampunk were verified against their public collectible pages and added as open-world contacts with original Crown City dialogue. See [provenance](character-references.md).

## Playable changes

- Nine detailed stations connect five subway stops and four elevated regional stops. Two regional trains run a repeating schedule with acceleration, deceleration and station dwell. Ticket selection, platform arrival, animated doors, departure, window travel and alighting lead to a safe street exit. One fare covers transfers. Wanted players cannot board; skipping preserves elapsed world/contract time.
- The Last Witness, Below the Static and Borrowed Minutes bring the crew roster to 13 contracts. Two require recorded train journeys, with progress retained across saves. Chief waits at East Port, Ice at Sierra and Steampunk at Midtown. Station forecourts remove both visible props and their colliders and leave existing roads clear.
- Six wildlife species use local habitat groups and a four-pose illustrated atlas. Dogs, cats, deer, foxes, gulls and pigeons wander and flee nearby vehicles, gunfire or approaching players. Birds lift off and return to safe habitat. Low mode limits active wildlife to 18, while distant animals do not simulate.
- Vehicle damage records front/rear/side impact panels, deforms body detail and affects grip, power, braking and top speed. Cars, bikes, boats and buses retain their own wreck art. Debris and explosions are bounded and stopped wrecks sleep. Local character separation and vehicle collision continue blocking overlap.
- Boat braking overrides forward touch input, shoreline collisions reset stale yaw, and boats no longer produce tyre dust/skids. Plane neutral touch input holds cruise; LAND aligns a final approach, checks remaining runway, descends and brakes after touchdown. Cancelling returns manual control.
- Night lighting and mobile tile colors blend through dusk and midnight. Water glints, forest fireflies and desert particles have fixed draw budgets and respect reduced motion. Five remastered original 44.1 kHz arrangements include Last Train Home; train doors, departure and wildlife add bounded PCM cues. Streams remain limited to two during transitions.

## Mobile work and measurement

The largest measured cost was local character separation. The new grid reuses arrays, uses numeric cell keys and squared distances, precomputes foot probes and caches stationary vehicle resolution. Low-mode pedestrian thinking is limited to the visible area plus a margin, while nearby, police and mission actors remain active. Distant ambient boats skip physics. Simulation remains 60 Hz; optional Battery Saver presents at 30 Hz.

The mobile renderer reuses actor buffers, blends baked day/night city tiles, prioritizes visible outer tiles and excludes corners outside a rotated viewport. Its cache follows the working set with a maximum of 96 outer tiles (24 MiB of bitmap pixels). This avoids repeated eviction/rebuilds in wide views; a rotated airport view was checked until its tile queue settled to zero.

A fixed-seed, 4× CPU-throttled Chromium driving comparison at 844×390 CSS pixels and DPR 2 reduced smoothed simulation work from 22.40 to 11.05 ms (50.7%) and rendering from 8.02 to 6.54 ms (18.4%). Presented frames increased from 43 over 4.24 seconds to 68 over 4.16 seconds. These are one controlled sample on a shared host, not physical Redmi measurements or a device FPS guarantee. Population and startup timing differ slightly. [Raw compact comparison](performance/metro-comparison.json); reproduce with `node tools/mobile-profile.cjs LABEL URL` against baseline and current servers.

## Verification

`npm run check` and all 12 Node regression files pass. New tests cover station exits/contact targets, ticket eligibility and charges, journey timing and cancellation, contract train gates, persistent travel history, regional timetable continuity, wildlife limits/solids, lighting periodicity, exact Gold Mage image bytes, directional damage, wreck dynamics, boat braking and assisted aircraft landing. Existing suites cover campaign/action/economy/save state, collision modes, recovery and city AI.

The browser suites check the actual mobile RAIL and LAND controls, train ticket selection/boarding/skip/arrival, portrait and landscape layouts, fullscreen, decoded streamed music, save/resume, vehicle damage and boat braking. Existing campaign, frontier and flight regressions are included. About checks cover all seven gallery images and seven crew portraits, 320px layouts, keyboard lightbox focus and actual 720p video/audio decoding. The refreshed trailer uses actual staged game frames and is not a frame-rate benchmark.

Physical Redmi testing, a fully manually driven campaign and subjective audio tuning on phone speakers remain outside this emulated validation. Transit uses a timed animated journey and analytical regional trains rather than a fully simulated underground city.
