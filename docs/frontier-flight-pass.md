# Canal, frontier and flight release

The illustrated overhead world grows from 10,240 × 9,216 to 12,288 × 10,240 world units: 33.3% more area. Existing campaign locations and separate Story / Free Ride saves remain compatible.

## Explore and play

- Crown Canal crosses Midtown and Ironside, with three launch docks and road bridges. Boats pass beneath the deck; cars, pedestrians and bullets respect the two levels.
- The outdoor MetaWin terrace has ten tables, cabanas, a bar, guests, a heliport and Gold Mage's House Edge contract. Tables have physical collision footprints.
- Pinewatch Forest, Red Mesa and Sierra Crown add connected roads, camps, a fuel stop, mountain rock formations and a rescue station. Terrain paintings and illustrated pines, slate, mesas and cacti are cached into scenery.
- Four new repeatable, staged contracts bring the total to ten: Under the Bridges (boat ledger run), House Edge (casino evidence), Dead Channel (helicopter relays), Dust to Dawn (desert/forest drive). Ordered gates, vehicle requirements, quiet handoffs, timers and one final reward are enforced.
- Hunter, Gold Mage, Neural, Mask and Fire are discoverable contacts. They have faithful full-body sprite adaptations, original unmodified reference portraits, local dialogue and map markers. Twenty-nine local residents supplement streamed city traffic and pedestrians; table/bench visits use the existing reactive city AI.
- Crown Airfield has a playable twin-prop aircraft and two helicopters. MetaWin has another helicopter; five marked helipads serve the airfield, casino, forest and mountain. Aircraft use altitude, rotor/propeller animation, obstacle clearance, takeoff speed, stalls, safe approach/landing and mid-flight saves. Destroyed aircraft are replaced at their home positions.
- Aircraft use continuous turbine/propeller sound and blade pulses instead of car gears; airspeed adds wind. Canal water and the MetaWin terrace have appropriate water/crowd ambience. Existing original radio music remains available.

Desktop flight: W/S throttle, A/D steer, Shift climb, Space descend, E landing approach; exit after stopping on the ground. Mobile shows UP / DOWN / LAND and retains independent touch ownership. Release the helicopter stick to hover. A plane needs the marked runway and takeoff speed.

## Recovery and AI

Busted or wasted clears chase vehicles and police ownership, bullets, helicopter pursuit, held inputs (including repeat events), race rivals, navigation state, AI reservations and unfinished interaction holds. The recovery tick stops immediately. Mission/economy progress and the current contract stage/time survive; partial holds restart. The world is not reset to a new game. Vehicle queries are indexed and reused per cell/tick, pursuit navigation is skipped without a chase, and pedestrians test a clear footprint before stepping.

## Mobile rendering

`assets/mobile/day` and `night` contain 32 pre-rendered 512px static core tiles, approximately 1.7 MB total. Only visible tiles load; at most 16 are retained. They replace runtime composition of albedo, roofs, water and neon. Rebuild them with `npm run bake:mobile` when core static scenery changes.

Outer scenery uses at most 40 cached 256px images of 512-unit regions. At most two new regions build per frame. Ground caches invalidate when the lazy-loaded terrain/scenery atlases arrive. Roofs, fixtures and foliage are baked once; actors, physics, objectives and aircraft remain live. UI stays at device resolution independently of the world layer.

Chromium comparison: 844 × 390 CSS viewport, DPR 2, touch input, Performance quality, automatic resolution disabled, rainy night, warmed music, identical four-second drive under **4× CPU throttling**. Published `17f89f6` versus this release:

| Metric | Published baseline | Expanded release |
|---|---:|---:|
| Smoothed world render cost | 104.1 ms | 5.6 ms |
| Smoothed simulation cost | 14.0 ms | 13.5 ms |
| Presented frames during sample | 30 / 4.38 s | 68 / 4.12 s |

This is a controlled browser comparison, not a Redmi Note hardware FPS claim. Sampling includes asset preparation and random traffic; physical Android play still needs user/device observation. New terrain is covered by bounded-cache checks and visual/browser tests, not the core-drive comparison. Reproduce using `node tools/mobile-profile.cjs LABEL URL`; benchmark summaries are in `docs/performance/frontier-comparison.json`.

## Validation

- Node suites cover the original campaign, collisions, AI, controls, flight/recovery and expansion. New checks cover every canal crossing, all mission handoffs, wrong-vehicle rejection, quiet delivery, contact/save restoration and boats saved beneath a bridge.
- The existing Chromium suite passes 19 checks, including both campaign branches, touch controls, quality switches, saves, fullscreen and audible music.
- `npm run test:flight`: actual keyboard takeoff, hover, landing, exit, flight saves, busted cleanup and mobile touch UP/LAND.
- `npm run test:frontier`: actual Hunter interaction, pickup, dock entry and a 1,700-unit boat drive through bridges at full hull health; six-location rendering, original contact art, mobile TALK, portrait layout and fullscreen.
- `npm run test:about`: responsive layout, actual screenshot gallery, original Gold Mage portrait, 720p trailer playback with decoded audio and captions. The existing After Hours trailer remains; the gallery now also shows the frontier release.

The changes were developed with an Astra contribution for aviation, recovery, collision integration and AI. Artwork was generated with the image tool from the retained references; no token IDs or NFT metadata were invented.
