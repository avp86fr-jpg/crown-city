# METAWINNERS: CROWN CITY

An illustrated overhead crime game starring Chaos. Steal a Palace archive, assemble a crew, drive through a living city and decide who gets to read the evidence. Fan-made fiction; play chips have no real-money value.

[Play](https://avp86fr-jpg.github.io/crown-city/) · [Guide](https://avp86fr-jpg.github.io/crown-city/about/)

Serve this directory with any static HTTP server; the game has no build step or runtime package dependencies. For example, `python -m http.server 8000`.

## Controls

| Action | Keyboard / mouse | Touch |
| --- | --- | --- |
| Walk / drive | WASD / arrows | Left stick |
| Sprint / Nyx boost | Shift | RUN / BOOST |
| Interact / enter / exit / station | E | CAR / EXIT / TAKE / TALK / RAIL |
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

C opens repeatable crew contracts: Neural's timed courier run, Mask's black-box pickup and escape, Fire's drift challenge, Hunter's witness pickup/escape, Vera's three dead drops plus evidence upload, and Low Tide: a dock pickup, stationary offshore boat upload and on-foot return. The latter jobs require stopped vehicles or quiet on-foot holds; route markers and progress survive saves and campaign advancement. Contracts pay chips and reputation. CUSTOMS, RESPRAY and MED / AMMO markers offer repairs, three stages of handling/power upgrades, heat-clearing resprays and health/ammunition supplies. Break police line of sight before using a workshop while wanted. Cyan map markers show services; opening a workshop remotely can mark the nearest one in blue.

Optional crew standards reward no civilian harm, controlled force, 400 metres of clean driving, or avoiding Palace security. Bonuses cannot be paid twice for the same campaign job. The dossier keeps completed job times, shots, collateral and crew bonus summaries.

FREE RIDE starts immediately from the title screen, unlocks the vehicle roster and uses its own resumable save slot. KEEP DRIVING also opens free roam after the story ending. Objectives create checkpoints. Version 4 saves retain weapon magazines, upgrades, reputation, active contract, paint, job metrics/journal and free roam alongside campaign/race/dialogue progress. Version 1/2/3 saves are accepted with defaults. Saves remain in local storage on the same device and origin.

## Art, city and audio

Four illustrated atlases cover six cars, a bus, ambulance, armored van, two motorcycles, speedboat, Chaos locomotion/aiming and civilian/police walking. Aiming can animate stepping legs independently; reloads and mounted riders have additional visible motion. Vehicles have steering, suspension, wipers, entry doors, damage and respray feedback. The city adds cafés, market carts, bus shelters, newsstands, loading bays, roof fans/ducts/solar panels, pavement wear, workshop forecourts and pedestrian gestures. Residents visit actual venues, reserve queue positions, stop for conversations, wait at shelters and board stopped buses. Traffic yields to pedestrians and emergency vehicles; civilians react to approaching vehicles and nearby threats. Spatial queries and decisions are throttled independently from movement. Population budgets scale by graphics quality. Roofs fade when they cover the on-foot player. The collision-aligned illustrated city remains the base; the larger yacht retains its earlier art.

Five original arrangements total about six minutes: an on-foot noir score, funk/brass night driving, swung electric-key street music, a faster pursuit track and a dedicated rail journey score. The current 44.1 kHz masters add percussion variation, subsonic filtering and headroom. They stream through the game's Web Audio master bus, crossfade for chases/stations and duck during dialogue/menus. Inactive stations pause; crossfades use at most two streams. Ogg and MP3 variants support different browsers. Weapon, impact, reload and water effects use a bounded reusable PCM bank. Synthesized fallback score and spatial city/vehicle effects remain available. New reload, weapon-change, dodge and radio cues support the action.

[MetaWinners character references and art/audio provenance](docs/character-references.md) · [Implementation and validation notes](docs/improvement-pass.md)

[720p After Hours trailer](about/assets/crown-city-trailer-720p.mp4) · [Release page](https://avp86fr-jpg.github.io/crown-city/about/) · [Media notes](docs/release-media.md) · [Gameplay capture with sound](docs/previews/afterhours-preview.mp4) · [City](docs/previews/afterhours-city.webp) · [Mobile HUD](docs/previews/afterhours-mobile.webp) · [Title](docs/previews/afterhours-title.webp)

Performance mode uses baked day/night city tiles with smooth dusk transitions, smaller mobile atlases, bounded effects and a simpler lighting pipeline. Core tiles use a 16–32 tile cache; the expanded-world cache follows the visible working set with a hard limit of 96 tiles (24 MiB of bitmap pixels). Rotated views cull off-screen corners before building tiles. On touch devices, Chrome composites separate city and HUD canvases, preserving a sharp UI at up to 2× device pixel density. Battery Saver targets 30 presentation frames per second with a 60 Hz simulation step. Hidden tabs stop frame rendering and suspend audio. World and street-detail caches have explicit limits; obsolete crowd image requests no longer load at boot.

## Validation

Run `npm test` and `npm run check` with Node 20 or later. The regression suite exercises actual world/collision/mission/physics logic with a mocked browser, plus action/economy/save validation.

For real-browser checks, run `npm ci` and `npx playwright install chromium` (or set `CHROMIUM_PATH`), start the static server, then run `npm run test:browser`. `GAME_URL` selects another served copy. Screenshots are saved under `.qa/browser/`.

The browser suite covers keyboard and emulated multi-touch controls, responsive menus, Chrome fullscreen entry/exit, directional touch aiming, control preferences, saves, crew work, both campaign routes, a physically simulated race, free roam, automatic resolution changes with sharp UI, battery-saver simulation cadence, streamed station/pursuit music and master muting. It repositions between most mission locations. A fully manually driven campaign, physical-phone/Safari testing and subjective audio/art review remain separate; no device FPS benchmark is claimed.

For the release page, run `npm run test:about` against the local server. `CC_ABOUT_URL` selects another deployment. This verifies responsive layouts, assets, gallery focus/navigation, links, 720p video/audio decoding and captions.

Vehicle collisions use oriented bodies matching the artwork and swept shoreline checks. Bullets resolve the nearest vehicle, person or wall along their path. Cars and bikes can hit citizens and the player on foot; diving does not grant traffic invulnerability. Parked cars and local character separation block overlap. Boats require nearby reachable land for ordinary disembarking; emergency ejection remains possible. See [mobile and collision pass](docs/mobile-collision-pass.md).


## Crown Transit and the wider world

Nine stations connect the subway and elevated regional railway. Approach an M/R entrance on foot and press E or tap RAIL, then choose a destination for 25 chips. Police checks prevent boarding while wanted. Trains accelerate, stop and open their doors; a platform/interior journey leads to a collision-checked street exit. Skip becomes available after boarding and still advances time and any active contract deadline. Train history survives saves; busted/death recovery clears unfinished boarding state.

The city canal, outdoor MetaWin casino, Red Mesa desert, Pinewatch forest, Sierra mountains and airport add road, water and air routes. Use LAND in a plane to assist runway alignment, descent and braking; cancel the approach to go around. Boat BRAKE overrides the forward stick. Directional panel damage persists and reduces handling and power; wrecks retain their vehicle type and remain solid.

Find Chief at East Port station, Ice at Sierra Junction and Steampunk beside Midtown Metro for three new stories. The crew menu now contains 13 repeatable contracts, including canal, casino and helicopter jobs. The Last Witness and Borrowed Minutes require actual train travel. Six wildlife species populate local habitats: deer, foxes, dogs, cats, gulls and pigeons react to nearby traffic, movement and gunfire.

Gold Mage’s portrait is the exact user-supplied reference, also used as the face/armor texture in his world character. [Character provenance](docs/character-references.md) records the reference hash and verified collectible links for Chief, Ice and Steampunk.

Additional browser checks: `npm run test:metro`, `npm run test:vehicles`, `npm run test:flight`, and `npm run test:frontier`. Set `CC_URL` to test another deployment. [Metro, wildlife and vehicle release notes](docs/metro-wildlife-pass.md) include the measured mobile-emulation comparison and limitations.
