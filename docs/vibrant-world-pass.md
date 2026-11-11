# Detailed world, transit and mobile streaming — 2026-11-11

## World and visual changes

Eight new painted materials cover woodland, desert, mountain stone, plaza paving, asphalt, sidewalks, gravel and water. Chunk painting adds botanical clusters and pebble fans; mown airfield margins use a textured grass material. The canal, river and pools have more surface detail. A transparent six-object atlas replaces primitive café, market-cart, bus-shelter, planter-bench, loading-supply and newsstand drawings. Low quality now retains all these fixtures in cached scenery. All 32 day/night mobile core tiles were rebaked.

Pinewatch has a ranger cabin, two tent decks, picnic area, trail map and fire ring. Red Mesa has a supply building and a fuel forecourt east of the highway. Sierra has a rescue building and equipment. Building, tent and pump footprints participate in collision; cleared forecourts restore the road beneath them. Named contacts, station exits and helipads stay accessible.

Crown Airfield has three paved connections between apron and runway, hold-short markings, 09/27 runway numbers, numbered aircraft stands, service lanes, touchdown wear, night edge lights and animated windsocks. The markings are visual guidance; existing aircraft steering, takeoff and LAND assist remain the flight controls.

Six About screenshots were refreshed from the actual renderer. The driving screenshot and 720p trailer remain from the preceding release, as stated on the page. The Gold Mage JPEG is unchanged and still matches the supplied reference hash. No character identity was regenerated.

## Transit and correctness

- Arrival retains the player's active waypoint and invalidates the old GPS route so it can be rebuilt from the destination.
- Full and skipped journeys advance weather and contract clocks by exactly the remaining journey duration. Large weather steps use bounded exponential blending and do not create particle bursts offscreen.
- A contract that expires on a train clears its old guidance and is reported on arrival.
- Stations cache their paving, canopy, stairs, benches and signs. Lights and interaction prompts remain dynamic. Regional track sleepers are a repeating cached strip; timetables no longer allocate stop arrays every draw. Station names sit beside the elevated tracks where trains cannot cover them.
- Failed transit art and mobile tiles retry after a delay instead of hammering the network or remaining permanently unavailable. A browser test deliberately fails a tile request, verifies backoff, then confirms recovery.

## Mobile work and memory

Offscreen terrain composition passes frame zero. Previously, every ground chunk consequently looked current, so the eviction filter retained all chunks accumulated during exploration. A separate usage clock now evicts old entries. The low-quality source-ground cache is capped at 24 chunks; the existing outer bitmap cache has its own viewport-sized limit, bounded at 96. These bounds cover the stated caches, not total browser/GPU memory.

Streaming builds at most two outer chunks per render and stops after the first if elapsed composition work exceeds 5 ms. This is a scheduling budget, not a guarantee that an individual chunk finishes in 5 ms. The new grass material replaces thousands of per-cell grass strokes while building airport chunks. Street and collision indices reuse buckets and collision-pair buffers; parked/parked pairs are skipped earlier. Mobile hint wrapping is cached, and minimaps omit offscreen station/pad labels. Sand effects use a smaller bounded budget.

## Frame review

`tools/world-profile.cjs` uses actual CDP joystick touches and asserts touch mode throughout, with 844×390 CSS pixels, DPR 2, low quality, automatic resolution disabled, seed 77123 and 4× CPU throttling. It warms each of four locations, then records approximately four seconds of real animation callbacks. Work time includes simulation catch-up, rendering and HUD; frame intervals also include browser/host scheduling.

The final sequential pair against published commit `28859c3` was mixed:

| Scene | Presented FPS, before → after | Median callback work, ms | 95th percentile work, ms |
| --- | ---: | ---: | ---: |
| Boulevard | 30.8 → 36.4 | 9.5 → 7.0 | 17.2 → 12.5 |
| Regional | 33.0 → 28.3 | 7.3 → 7.4 | 26.6 → 28.2 |
| Forest | 31.7 → 37.4 | 5.4 → 5.0 | 23.6 → 13.3 |
| Airfield | 33.1 → 30.2 | 7.1 → 8.2 | 26.8 → 22.4 |

Boulevard and forest improved in that pair. Station and airfield presented rates were lower; the airfield's long work spikes were shorter. The warmed station probe reduced `fillRect` calls from 344 to 12, and repeated mobile text measurements from 13 to zero. The station's timing did not consistently track those reductions on this shared host. Earlier development pairs vary and are retained in the [complete measurements](performance/world-comparison.json), rather than being used to claim a guaranteed FPS increase.

The historical `tools/mobile-profile.cjs` uses keyboard events. Those events switch the game away from touch mode, even in a touch-capable browser. This pass uses the new tool to exercise the actual mobile HUD/control path.

These measurements are short, shared-host Chromium comparisons. They are not physical Xiaomi Redmi results. Frame spikes remain, and a fully manually driven campaign and long physical-phone thermal/memory run are unverified.

## Validation

- Syntax checks and 135 Node tests passed across 14 files, including eight new world/transit/cache/collision checks. The existing expansion file also runs its seven internal checks.
- The 19-check core browser suite passed both campaign branches, controls, save/resume, economy, audio, fullscreen, responsive HUD and resolution/battery behavior.
- Aviation, vehicle, frontier and coherence browser suites passed: actual mobile LAND and BRAKE, real boat movement under river bridges, shooting/recoil/aiming, damage persistence and recovery.
- The new world browser suite passed a nine-destination exploration tour with both terrain caches bounded, station reuse through dusk, failed-tile recovery, a real touch train journey retaining its job route, and runway lighting with reduced motion enabled.
- Transit and About browser suites verify tickets, boarding/arrival, portrait controls, train audio, cache settling, gallery navigation, responsive layouts and the 720p trailer's video/audio/captions.
