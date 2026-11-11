# METAWINNERS: CROWN CITY

An illustrated overhead crime game starring Chaos. Steal a Palace archive, assemble a crew, drive through a living city and decide who gets to read the evidence. Fan-made fiction; play chips have no real-money value.

[Play](https://avp86fr-jpg.github.io/crown-city/) · [Guide](https://avp86fr-jpg.github.io/crown-city/about/)

Serve this directory with any static HTTP server; the game has no build step or runtime package dependencies. For example, `python -m http.server 8000`.

## Controls

| Action | Keyboard / mouse | Touch |
| --- | --- | --- |
| Walk / drive | WASD / arrows | Left stick |
| Sprint / Nyx boost | Shift | RUN / BOOST |
| Interact / enter / exit | E | CAR / EXIT / TAKE |
| Shoot | K / J / click to aim | FIRE |
| Change weapon | Q | WEAPON |
| Reload | X | RELOAD |
| Dodge on foot / drift in a vehicle | Space | ROLL / DRIFT |
| Crew contracts / nearby workshop | C | CREW |
| Radio station | R | Settings → Radio |
| Map / waypoint | M, click the map | MAP, tap the map |
| Pause | Escape | Pause button |

Weapons have distinct magazines, cadence, spread and damage. Empty magazines reload automatically; X reloads early. The silenced .45 is quieter, the Vulture SMG fires quickly and the Breacher shoots a spread of pellets. Sprinting and dodge rolls use stamina. Standing still beside a wall grants cover protection; rolls briefly evade shots. Ammunition refills per magazine without a separate reserve-ammo inventory.

## Campaign and crew work

Six connected jobs follow Gold Mage's forged debt ledger: intercept and disable the van, earn Fire's trust in a two-lap race, obtain Neural's blackout, scout the Palace on foot, transfer the archive under pressure and escape by boat/Nyx. Protecting the ledger or selling a decoy changes the payout and ending. Quiet/loud entry changes pursuit pressure; Neural's deferred fee is deducted once from the vault cut.

C opens repeatable crew contracts: Neural's timed courier run, Mask's black-box pickup and escape, and Fire's drift challenge. Contracts pay chips and reputation. CUSTOMS, RESPRAY and MED / AMMO markers offer repairs, three stages of handling/power upgrades, heat-clearing resprays and health/ammunition supplies. Break police line of sight before using a workshop while wanted. Cyan map markers show services; opening a workshop remotely can mark the nearest one in blue.

KEEP DRIVING after the ending opens persistent free roam with contracts and workshops. Objectives create checkpoints. Version 3 saves retain weapon magazines, upgrades, reputation, active contract, paint and free roam alongside campaign/race/dialogue progress. Version 1/2 saves are accepted with defaults. Saves remain in local storage on the same device and origin.

## Art, city and audio

New illustrated atlases cover six cars, Chaos locomotion/aiming and civilian/police walking. Vehicles have steering, suspension, wipers, entry doors, damage and respray feedback. The city adds cafés, market carts, bus shelters, newsstands, loading bays, roof fans/ducts/solar panels, pavement wear, workshop forecourts and pedestrian gestures. Population budgets scale by graphics quality. Roofs fade when they cover the on-foot player. Existing collision-aligned painted city, bikes, boats and utility vehicles are retained.

Three original arranged radio loops total about 3½ minutes: funk/brass night driving, swung electric-key street music and a faster pursuit track. They stream through the game's Web Audio master bus, crossfade for chases/stations and duck during dialogue/menus. Synthesized fallback score and spatial city/vehicle effects remain available. New reload, weapon-change, dodge and radio cues support the action.

[MetaWinners character references and art/audio provenance](docs/character-references.md) · [Implementation and validation notes](docs/improvement-pass.md)

[Gameplay video with sound](docs/previews/premium-preview.mp4) · [City capture](docs/previews/premium-city.webp) · [Night driving](docs/previews/premium-driving.webp) · [Crew board](docs/previews/premium-crew.webp)

## Validation

Run `npm test` and `npm run check` with Node 20 or later. The regression suite exercises actual world/collision/mission/physics logic with a mocked browser, plus action/economy/save validation.

For real-browser checks, run `npm ci` and `npx playwright install chromium` (or set `CHROMIUM_PATH`), start the static server, then run `npm run test:browser`. `GAME_URL` selects another served copy. Screenshots are saved under `.qa/browser/`.

The browser suite covers keyboard and emulated multi-touch controls, responsive menus, saves, crew work, both campaign routes, a physically simulated race, free roam, automatic resolution changes, streamed station/pursuit music and master muting. It repositions between most mission locations. A fully manually driven campaign, physical-phone/Safari testing and subjective audio/art review remain separate; no device FPS benchmark is claimed.
