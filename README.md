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
| Shoot / aim | K / J / click to aim | Hold AIM / FIRE; drag to aim independently |
| Change weapon | Q | WEAPON |
| Reload | X | RELOAD |
| Dodge on foot / drift in a vehicle | Space | ROLL / DRIFT |
| Crew contracts / nearby workshop | C | CREW |
| Radio station | R | Settings → Radio |
| Map / waypoint | M, click the map | MAP, tap the map |
| Pause / dossier | Escape | Pause button → Story / Dossier |
| Enter / exit fullscreen | F / fullscreen button | Fullscreen button; no forced rotation |

Settings → Controls includes left-handed layout, control size, opacity, aim assist, vibration and street tips. Fullscreen is requested from a direct click/key gesture in Chrome, with a visible exit option.

Weapons have distinct magazines, cadence, spread and damage. Empty magazines reload automatically; X reloads early. The silenced .45 is quieter, the Vulture SMG fires quickly and the Breacher shoots a spread of pellets. Sprinting and dodge rolls use stamina. Standing still beside a wall grants cover protection; rolls briefly evade shots. Ammunition refills per magazine without a separate reserve-ammo inventory.

## Campaign and crew work

Six connected jobs follow Gold Mage's forged debt ledger: intercept and disable the van, earn Fire's trust in a two-lap race, obtain Neural's blackout, scout the Palace on foot, transfer the archive under pressure and escape by boat/Nyx. Protecting the ledger or selling a decoy changes the payout and ending. Quiet/loud entry changes pursuit pressure; Neural's deferred fee is deducted once from the vault cut.

C opens repeatable crew contracts: Neural's timed courier run, Mask's black-box pickup and escape, Fire's drift challenge, Hunter's witness pickup/escape, and Vera's three dead drops plus evidence upload. The latter jobs require stopped vehicles or quiet on-foot holds; route markers and progress survive saves and campaign advancement. Contracts pay chips and reputation. CUSTOMS, RESPRAY and MED / AMMO markers offer repairs, three stages of handling/power upgrades, heat-clearing resprays and health/ammunition supplies. Break police line of sight before using a workshop while wanted. Cyan map markers show services; opening a workshop remotely can mark the nearest one in blue.

Optional crew standards reward no civilian harm, controlled force, 400 metres of clean driving, or avoiding Palace security. Bonuses cannot be paid twice for the same campaign job. The dossier keeps completed job times, shots, collateral and crew bonus summaries.

KEEP DRIVING after the ending opens persistent free roam with contracts and workshops. Objectives create checkpoints. Version 3 saves retain weapon magazines, upgrades, reputation, active contract, paint, job metrics/journal and free roam alongside campaign/race/dialogue progress. Version 1/2 saves are accepted with defaults. Saves remain in local storage on the same device and origin.

## Art, city and audio

Four illustrated atlases cover six cars, a bus, ambulance, armored van, two motorcycles, speedboat, Chaos locomotion/aiming and civilian/police walking. Aiming can animate stepping legs independently; reloads and mounted riders have additional visible motion. Vehicles have steering, suspension, wipers, entry doors, damage and respray feedback. The city adds cafés, market carts, bus shelters, newsstands, loading bays, roof fans/ducts/solar panels, pavement wear, workshop forecourts and pedestrian gestures. Residents visit actual venues, reserve queue positions, stop for conversations, wait at shelters and board stopped buses. Traffic yields to pedestrians and emergency vehicles; civilians react to approaching vehicles and nearby threats. Spatial queries and decisions are throttled independently from movement. Population budgets scale by graphics quality. Roofs fade when they cover the on-foot player. The collision-aligned illustrated city remains the base; the larger yacht retains its earlier art.

Three original arranged radio loops total about 3½ minutes: funk/brass night driving, swung electric-key street music and a faster pursuit track. They stream through the game's Web Audio master bus, crossfade for chases/stations and duck during dialogue/menus. Synthesized fallback score and spatial city/vehicle effects remain available. New reload, weapon-change, dodge and radio cues support the action.

[MetaWinners character references and art/audio provenance](docs/character-references.md) · [Implementation and validation notes](docs/improvement-pass.md)

[720p After Hours trailer](about/assets/crown-city-trailer-720p.mp4) · [Release page](https://avp86fr-jpg.github.io/crown-city/about/) · [Media notes](docs/release-media.md) · [Gameplay capture with sound](docs/previews/afterhours-preview.mp4) · [City](docs/previews/afterhours-city.webp) · [Mobile HUD](docs/previews/afterhours-mobile.webp) · [Title](docs/previews/afterhours-title.webp)

Performance mode renders the city at a lower resolution while preserving a sharp UI at up to 2× device pixel density. Battery Saver presents at 30 fps while the simulation stays at 60 Hz. Hidden tabs stop frame rendering and suspend audio. World and street-detail caches have explicit limits; obsolete crowd image requests no longer load at boot.

## Validation

Run `npm test` and `npm run check` with Node 20 or later. The regression suite exercises actual world/collision/mission/physics logic with a mocked browser, plus action/economy/save validation.

For real-browser checks, run `npm ci` and `npx playwright install chromium` (or set `CHROMIUM_PATH`), start the static server, then run `npm run test:browser`. `GAME_URL` selects another served copy. Screenshots are saved under `.qa/browser/`.

The browser suite covers keyboard and emulated multi-touch controls, responsive menus, Chrome fullscreen entry/exit, directional touch aiming, control preferences, saves, crew work, both campaign routes, a physically simulated race, free roam, automatic resolution changes with sharp UI, battery-saver simulation cadence, streamed station/pursuit music and master muting. It repositions between most mission locations. A fully manually driven campaign, physical-phone/Safari testing and subjective audio/art review remain separate; no device FPS benchmark is claimed.

For the release page, run `npm run test:about` against the local server. `CC_ABOUT_URL` selects another deployment. This verifies responsive layouts, assets, gallery focus/navigation, links, 720p video/audio decoding and captions.
