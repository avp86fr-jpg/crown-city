# METAWINNERS: CROWN CITY

Fan-made top-down city action game starring Chaos. Play chips only, no real money.

[Play](https://avp86fr-jpg.github.io/crown-city/) · [Guide](https://avp86fr-jpg.github.io/crown-city/about/)

Serve this directory with any static HTTP server; no build or runtime dependencies are required. For example, `python -m http.server 8000`.

## Controls

WASD / arrows move or drive, E enters/exits and takes marked packages, Space fires, Shift sprints/boosts, R changes radio, M opens the map, Escape pauses. Click the map to set a blue waypoint; JOB ROUTE returns to the gold objective. Touch controls include TAKE/ENTER and MAP. Settings include graphics quality, automatic resolution and camera shake.

## Campaign

Six connected jobs: intercept the seed-plate van, win a two-lap street race, deliver to Neural, scout the Palace on foot, execute the quiet/loud heist and escape by boat, then take the Nyx from the marina to the highway. An unpaid Neural fee comes out of the vault payout. Quiet preparation grants a temporary scrambler window; new crimes cancel it.

Objectives create local checkpoints. RETRY OBJECTIVE restores the current checkpoint, including cash and payment state. Version 2 saves retain race progress, dialogue transitions, vehicle condition and the ending; previous saves are accepted with defaults. Saves remain in browser local storage on the same device and origin.

## Validation

Run `npm test` and `npm run check` with Node 20 or later. Tests use the actual world, collision mask, mission logic and vehicle physics with a mocked browser/canvas. They cover both campaign choice routes (moving between objectives in the test), a physically driven two-lap race, reachability, checkpoint/save recovery, controls, responsive button bounds and asset request behavior.

These checks do not replace browser visual, audio and touch playtesting. See [the improvement notes](docs/improvement-pass.md) for scope and remaining verification.
