# METAWINNERS: CROWN CITY

Fan-made top-down city action game starring Chaos. Play chips only, no real money.

[Play](https://avp86fr-jpg.github.io/crown-city/) · [Guide](https://avp86fr-jpg.github.io/crown-city/about/)

Serve this directory with any static HTTP server; no build or runtime dependencies are required. For example, `python -m http.server 8000`.

## Controls

WASD / arrows move or drive, E enters/exits and takes marked packages, K / J / click fires, Space drifts, Shift sprints/boosts, R changes radio, M opens the map, Escape pauses. Click the map to set a blue waypoint; JOB ROUTE returns to the gold objective. Touch controls include TAKE/ENTER and MAP. Settings include graphics quality, automatic resolution and reduced motion.

## Campaign

Six connected jobs: intercept the seed-plate van, win a two-lap street race, deliver to Neural, scout the Palace on foot, execute the quiet/loud heist and escape by boat, then take the Nyx from the marina to the highway. An unpaid Neural fee comes out of the vault payout. Quiet preparation grants a temporary scrambler window; new crimes cancel it.

Objectives create local checkpoints. RETRY OBJECTIVE restores the current checkpoint, including cash and payment state. Version 2 saves retain race progress, dialogue transitions, vehicle condition and the ending; previous saves are accepted with defaults. Saves remain in browser local storage on the same device and origin.

## Graphics and animation

The renderer adds commercial neon accents, wet-road light streaks, rain ripples, drifting steam, layered tree canopies with wind and a cached vignette. Vehicles articulate their front wheels, react to acceleration/braking, bob on water and run rain wipers. Characters have footplant motion, breathing and shot recoil. Boat wakes, smoke, dust, sparks, fire and explosions use continuous lifetime-based effects. Water frames blend on medium/high quality. Cutscenes use a slow cover-cropped camera move. Reduced Motion disables the new decorative actor/camera motion and trims lightning.

[Animated renderer preview](docs/previews/graphics-animation.webp) · [Night race still](docs/previews/graphics-night.webp)

## Validation

Run `npm test` and `npm run check` with Node 20 or later. Tests use the actual world, collision mask, mission logic and vehicle physics with a mocked browser/canvas. They cover presentation bounds and reduced motion, both campaign choice routes (moving between objectives in the test), a physically driven two-lap race, reachability, checkpoint/save recovery, controls, responsive button bounds and asset request behavior.

For browser checks, run `npm ci` and `npx playwright install chromium` (or set `CHROMIUM_PATH` to an installed Chromium), start the static server above, then run `npm run test:browser`. Set `GAME_URL` to test a different served copy. Screenshots are saved under `.qa/browser/`.

The Chromium suite covers desktop and emulated multi-touch controls, menu layouts, saves, both campaign routes, a physically simulated race, automatic resolution changes and Web Audio signal/muting. It repositions between mission locations and does not replace a fully manual campaign run or testing on physical phones. See [the improvement notes](docs/improvement-pass.md) for scope and verification.

[Browser phone capture](docs/previews/browser-touch.png) · [Browser landscape capture](docs/previews/browser-landscape.png)
