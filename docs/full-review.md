# Full release review

This pass reviews campaign progression, saves, controls, traffic, racing, collisions, world rendering, transit, aircraft, boats, casino play, audio and the release page. It keeps the illustrated overhead view and the existing trailer, screenshots and NFT portraits.

## Fixes

- World chip pickups now save their collected state independently in Story and Free Ride. A new game resets them. Two pickups inside buildings, and two in road lanes, move to reachable pavement. Stable identifiers preserve collection state if their placement changes again.
- Checkpoints copy story flags and vehicle unlocks instead of retaining mutable references to the live session.
- An interrupted race save on foot, in a boat or in an aircraft returns to Fire’s pit meeting. Invalid rival positions restart at the grid; valid circuit saves retain their progress. Recovery does not grant race rewards or duplicate the rival.
- Pointer cancellation releases keyboard, mouse and touch holds, including an interrupted vehicle-entry animation. A held keyboard repeat cannot reactivate movement until a fresh press.
- Circuit drivers plan around parked hulls and wrecks, retain their chosen passing side and check the rear corridor before reversing to make steering room. Physical tests cover both early avoidance and a close, stationary obstruction. Drivers wait when a pedestrian blocks that rear corridor.
- Junctions give an older conflicting turn priority after a complete signal cycle, provided its exit is clear. Reservations retry at 10 Hz; motion and dynamic collision checks continue at 60 Hz. Static collision samples and probe objects are reused.

## Mobile rendering and performance

Performance mode now paints cached street details at their actual composition resolution. Its twelve street-detail canvases use at most **3 MiB instead of 12 MiB**, a 75% reduction for this cache. Desktop retains the larger version, and changing quality releases the obsolete backing canvases. World coordinates, roads and fixture sizes are preserved. This is a cache-specific saving, not a 75% reduction in total game memory.

The [measurement record](full-review-metrics.json) contains actual touch-input frame timings, cold scenery streaming and the seeded traffic soak. Tests use headless Chromium, an 844×390 viewport, DPR2 and 4× CPU throttling. Render resolution stays fixed so automatic scaling cannot conceal extra work. These are emulated measurements; they are not Redmi Note benchmarks.

Repeated runs varied materially. There is no established overall FPS improvement: forest and station workloads improved in some comparisons, while busy streets and airport runs remained mixed. Native image uploads, font initialization and individual Canvas operations can still exceed the scenery time budget. The cold circuit sample still reached approximately 64 ms. A physical-phone profile of busy junctions and first-time scenery loading remains the highest-priority performance follow-up.

The four-minute traffic soak includes actual parked vehicles, pedestrians and collisions. Its longest stop was 43 seconds and longest turn stall was 5 seconds, versus 49 and 8 seconds in the previous release’s recorded soak. Final-minute moving traffic was 56.8%, versus 62.1% previously: the fairness change improves those wait extremes at a throughput cost in this scenario. Tests check finite state, no stale reservations and no approach waiting for a full minute. Safe single-lane obstructions can still form queues. This is local traffic AI, not a simulation of every resident’s daily itinerary.

## Validation

The review includes 294 passing Node regression tests and 20 core Chromium gameplay checks. Fifteen browser suites cover cold/warm mobile startup, simulated context restoration, rotation, every dialogue and choice on small screens, both campaign endings and post-ending Free Ride, shooting, vehicle damage, flight, sailing, canal and world navigation, trains, wildlife, casino play, audio, fullscreen and the About page. The campaign tests drive the circuit with actual physics and reposition between other objectives; they are not a fully manual playthrough.

The new regressions exercise pickup collection through real game ticks, independent saves, checkpoint isolation, malformed race restoration, the title screen’s Continue button, cancelled multi-touch input, passing wrecks without contact, occupied reversing space, and cache memory through quality changes. GitHub’s review workflow now runs the built game in Chromium after its build and Node checks.

Reproduce the main checks with `npm ci`, `npm run build`, `npm test` and `npm run check`. Start `npm run serve`, then run `npm run test:browser` and the additional `test:*` scripts listed in `package.json`. Use `CC_URL` for the game and `CC_ABOUT_URL` for the release page. `node tools/world-profile.cjs LABEL URL` records touch-input timing; `node tools/traffic-audit.mjs` runs the deterministic traffic soak.

The remaining visual weakness is consistency between the painted downtown and the procedural outer districts. The next art pass should focus on those transitions and repeated building silhouettes. The next gameplay review should use a complete manual campaign and longer unscripted driving sessions on a physical phone. No claim of locked 60 FPS or exhaustive device coverage is made.
