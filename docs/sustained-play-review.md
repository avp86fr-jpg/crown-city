# Sustained play, racing and world review

The reported problem appears after two to five minutes on Redmi Note Chrome. This pass targets work that repeats during longer travel, accumulated combat debris and the slow circuit pace. It retains the illustrated overhead view, existing trailer and original NFT portraits.

## Mobile rendering and simulation

The outer world now streams 26 pre-rendered WebP scenery sheets, totaling 7.65 MB on disk. They use the same terrain, buildings, roofs, foliage and street art as the existing mobile renderer. Only nearby sheets download, with at most two requests in flight. Actors, traffic, water overlays, lighting, trains, casino activity and missions remain live. Desktop keeps its existing renderer.

Each sheet holds sixteen terrain tiles without creating sixteen additional canvases. Normal flight views retain roughly three to five decoded sheets; the hard ceiling is sixteen sheets / 64 MiB. Narrowing the view immediately retires cold sheets, and late image decodes close if their request was evicted. A failed download falls back to the incremental scenery renderer, with retry backoff. Source signatures and image-dimension tests prevent stale terrain from shipping after world changes. Rebuild with a local server running: `CC_URL=http://127.0.0.1:8000/ npm run bake:world`, then `npm run build`.

The downtown bitmap cache also trims when returning from a wide view, even if no new tiles load. It retains the current visible set before evicting old day/night tiles. Adaptive resolution now waits for sustained headroom before increasing detail and respects the mobile raster floor, avoiding repeated ineffective canvas resizing.

On touch devices in Performance quality, ambient traffic and pedestrian updates run at 30 Hz with the full elapsed simulation time. Player physics, weapons and player–vehicle contacts retain their 60 Hz checks. Tests verify equal player travel, the traffic clock and impacts between ambient updates. Desktop and other quality settings retain the previous scheduling.

Dead ambient pedestrians and transient wrecks retire after a delay. Nearby bodies fade rather than disappear abruptly; owned and mission vehicles remain recoverable. A ten-minute combat-debris stress test checks bounded population growth. The idle browser comparison did not demonstrate a steadily growing JavaScript heap: these changes address measured repeated work and accumulation paths, without claiming a proven device-specific memory leak.

## Racing and gameplay fixes

Circuit drivers plan speed from upcoming curvature and available braking distance. They accelerate on straights instead of carrying a distant corner's low speed across the whole section. Fire has a fixed faster pace, with no rubber-banding; the stock Riot remains capable of winning. The automated story race takes approximately **57 seconds versus 99 seconds** in the previous release. Circuit time targets are 100 / 80 / 65 seconds for Club / Sport / Pro.

A clean inside line at a hairpin could jump between centre-line projections and be falsely marked as a shortcut. Validation now checks actual vehicle travel as well as sequential course progress. Full inside and outside laps pass with real physics and intact vehicles; reverse and skipped-sector protections remain. Class records retain their own best time instead of inheriting another class's faster record.

Foot recovery and dismount searches reject parked vehicle hulls, including wrecks. Rotated aircraft clearance includes the wing tips. Boats check their full reversing corridor against land, moving vessels and wrecks, then recheck while backing out. Mobile flight status fits within the objective panel, with consistent speed units and one LAND action.

## World review and limits

The deterministic geometry audit covers **307 road segments and 22,340 vehicle-hull samples**, both directions and all lanes. It also checks starting road/boat placement and vehicle overlaps. No failures were found in that sample. The visual review captures thirteen locations in both mobile and desktop renderers: downtown, courts, canal bridges and docks, casino, airport, station, forest, mountains, desert, circuit and paddock. This is a clearance and presentation audit, not a claim that every unscripted traffic situation is solved or a redesign of the map.

The remaining art weakness is repeated scenery in the outer districts and its transition into painted downtown. Dense physical queues, first-use image decoding and real-device thermal behavior still deserve observation. Browser CPU throttling is useful for comparing code paths but cannot establish sustained FPS on the user's phone.

## Measurements and validation

The [measurement record](performance/sustained-play.json) compares six-minute real-time mobile flight loops in headless Chromium at 844×390, DPR2 and 4× CPU throttling, with automatic resolution enabled, night/rain and vehicle radio. It records frame intervals, simulation/render cost, entity counts, cache sizes, heap and browser exceptions every thirty seconds. Routes use actual flight physics.

Across the five samples from minute four onward, mean simulation cost fell from 3.57 to 1.90 ms and world-render cost from 5.39 to 3.70 ms. Presented frame rate averaged 42.4 before and 47.1 after, with new thirty-second windows ranging from 39.0 to 50.6 FPS. The final new sample had no unfinished terrain tiles, versus five before; downtown cache pixels fell from 9 to 6 MiB. The new JavaScript heap ranged from 18.0 to 24.8 MiB, with no rising trend, and both runs reported no browser exceptions.

These are diagnostic comparisons on a shared host, not Redmi benchmarks or a locked-60-FPS claim. Baseline mid-run overlapped Node regressions; the comparison above uses later samples. Vehicle positions and actor counts diverge as the simulation advances, limiting direct FPS attribution. Image decoding still produces occasional slow frames, and six minutes does not cover every thermal or memory condition on a physical phone.

Validation includes **307 Node regressions and 20 core Chromium gameplay checks**, plus the mobile startup, missing-terrain and specialized browser suites. Campaign checks cover both endings and post-ending Free Ride, using actual circuit driving and repositioning between other objectives; this is not a fully manual campaign playthrough.

Reproduce with `node tools/sustained-profile.cjs LABEL URL 360 4 flight`, `node tools/race-profile.mjs`, `npm run audit:map`, `npm test` and the browser suites in `package.json`. The missing-sheet browser regression checks fallback, retry, matching artwork and quality-change disposal. GitHub CI now runs the geometry audit and missing-sheet browser check as well as the existing build, Node and campaign regressions.
