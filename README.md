# METAWINNERS: CROWN CITY

An illustrated overhead crime game starring Chaos. Steal a Palace archive, assemble a crew, drive through a living city and decide who gets to read the evidence. Fan-made fiction; play chips have no real-money value.

[Play](https://avp86fr-jpg.github.io/crown-city/) · [Guide](https://avp86fr-jpg.github.io/crown-city/about/)

The published game is static and needs no runtime packages. For development, run `npm ci`, `npm run build`, then `npm run serve`. Rebuild after changing `src/`: the build emits one content-hashed module and versions the stylesheet, so a returning mobile browser loads a consistent release. The preview server supports video/audio byte ranges.

## Controls

| Action | Keyboard / mouse | Touch |
| --- | --- | --- |
| Walk / drive | WASD / arrows | Left stick |
| Sprint / Nyx boost | Shift | RUN / BOOST |
| Interact / enter / exit / station | E | CAR / EXIT / TAKE / TALK / RAIL |
| Shoot / aim | K / J / click to aim | Hold AIM / FIRE; drag to aim independently |
| Airplane cargo release (Paper Wings) | K / J | DROP |
| Circuit time trial (at pit desk) | E | TRIAL |
| Change weapon | Q | WEAPON |
| Reload | X | RELOAD |
| Dodge on foot / drift in a vehicle | Space | ROLL / DRIFT |
| Crew contracts / nearby workshop | C | CREW |
| Radio station | R | Settings → Radio |
| Map / waypoint | M, click the map | MAP, tap the map |
| Pause / dossier | Escape | Pause button → Story / Dossier |
| Enter / exit fullscreen | F / fullscreen button | Fullscreen button; no forced rotation |

Settings → Controls includes left-handed layout, control size, opacity, aim assist, vibration and street tips. Fullscreen is requested from a direct click/key gesture in Chrome, with a visible exit option.

Weapons have distinct magazines, cadence, spread and damage. Moving and sustained bursts widen the aim cone; releasing fire restores accuracy. Long shots lose damage, with the shotgun tuned for close range. Walls stop the muzzle and wrecks provide cover. Mouse aim follows the visible torso even with a rotated camera. Empty magazines reload automatically; X reloads early. The silenced .45 is quieter, the Vulture SMG fires quickly and the Breacher shoots a spread of pellets. Sprinting and dodge rolls use stamina. Standing still beside a wall grants cover protection; rolls briefly evade shots. Ammunition refills per magazine without a separate reserve-ammo inventory.

## Campaign and crew work

Six connected jobs follow Gold Mage's forged debt ledger: intercept and disable the van, earn Fire's trust over one full lap of the Grand Prix circuit, obtain Neural's blackout, scout the Palace on foot, transfer the archive under pressure and escape by boat/Nyx. Protecting the ledger or selling a decoy changes the payout and ending. Quiet/loud entry changes pursuit pressure; Neural's deferred fee is deducted once from the vault cut.

Two additional crew contracts extend the evidence story: **Paper Wings** requires three manual airplane drops and a runway return; **The Eighth Sector** requires a clean timed lap and a telemetry upload. **Bugatti / Crown Motorsport Park** occupies the southwest edge: a wider technical course, ten pit garages, transport paddock, medical/control buildings, connected pit entry/exit and two grandstands. Five opponents share the track. Visit the pit desk for a reusable loaner; choose Club (180s), Sport (150s) or Pro (125s) in CREW → WORKSHOP. Each class saves its own best. The pit lane has a 40 km/h limiter. Records from the smaller circuit reset because the layout changed. The map has direct routes to the casino, circuit and airport.

[Circuit, recovery and casino pass](docs/circuit-paddock-pass.md) records the latest validation and mobile testing limits. [Earlier road and AI review](docs/coherence-and-circuit.md).

Lost the Riot? Visit Hunter Garage on foot, then open **CREW → WORKSHOP → RECOVER RIOT**. Recovery is free once active jobs and wanted stars are cleared; occupied bays delay delivery. The existing car is reused. Expansion mission clocks start at pickup, including when you take the train there.

C opens repeatable crew contracts: Neural's timed courier run, Mask's black-box pickup and escape, Fire's drift challenge, Hunter's witness pickup/escape, Vera's three dead drops plus evidence upload, and Low Tide: a dock pickup, stationary offshore boat upload and on-foot return. The latter jobs require stopped vehicles or quiet on-foot holds; route markers and progress survive saves and campaign advancement. Contracts pay chips and reputation. CUSTOMS, RESPRAY and MED / AMMO markers offer repairs, three stages of handling/power upgrades, heat-clearing resprays and health/ammunition supplies. Break police line of sight before using a workshop while wanted. Cyan map markers show services; opening a workshop remotely can mark the nearest one in blue.

Optional crew standards reward no civilian harm, controlled force, 400 metres of clean driving, or avoiding Palace security. Bonuses cannot be paid twice for the same campaign job. The dossier keeps completed job times, shots, collateral and crew bonus summaries.

FREE RIDE starts immediately from the title screen, unlocks the vehicle roster and uses its own resumable save slot. KEEP DRIVING also opens free roam after the story ending. Objectives create checkpoints. Version 5 saves retain weapon magazines, upgrades, reputation, active contract, paint, job metrics/journal and free roam alongside campaign/race/dialogue progress. Version 1/2/3/4 saves are accepted with defaults. Saves remain in local storage on the same device and origin.

## Art, city and audio

Four illustrated atlases cover six cars, a bus, ambulance, armored van, two motorcycles, speedboat, Chaos locomotion/aiming and civilian/police walking. On-foot aiming uses separate, proportioned sidearm, SMG and shotgun artwork; manual mouse aim stays on the cursor, with limited assistance for touch. Reloads and mounted riders have additional visible motion. Vehicles have steering, suspension, wipers, entry doors, damage and respray feedback. The city adds cafés, market carts, bus shelters, newsstands, loading bays, roof fans/ducts/solar panels, pavement wear, workshop forecourts and pedestrian gestures. Residents visit actual venues, reserve queue positions, stop for conversations, wait at shelters and board stopped buses. Traffic yields to pedestrians and emergency vehicles; civilians react to approaching vehicles and nearby threats. Spatial queries and decisions are throttled independently from movement. Population budgets scale by graphics quality. Frontier roofs fade when they cover the on-foot player; the illustrated core stays aligned with its painted footprint. Foot movement sweeps its collision circle and slides along walls without inventing sideways motion. The collision-aligned illustrated city remains the base; the larger yacht retains its earlier art.

Six original arrangements cover a noir city score, funk/brass driving, electric-key street music, pursuit, rail journeys and **Return to Crown**, a dedicated 60-second story overture. The opening has a skippable title sequence; eight illustrated locations frame the dialogue, with intact original character portraits, complete wrapped text and touch-sized choices. Reduced Motion starts directly with dialogue.

Music streams through the Web Audio master bus, crossfades for chases/stations and lowers during dialogue/menus. Inactive stations pause, crossfades use at most two streams, and music muting stops decoding. Ogg and MP3 variants support different browsers. Weapon, impact, reload and water effects use a bounded reusable PCM bank. Quieter text cues, camera-relative siren panning and population-scaled street ambience keep the mix readable. Original music and art provenance are documented below.

[MetaWinners character references and art/audio provenance](docs/character-references.md) · [Implementation and validation notes](docs/improvement-pass.md)

[720p After Hours trailer](about/assets/crown-city-trailer-720p.mp4) · [Release page](https://avp86fr-jpg.github.io/crown-city/about/) · [Media notes](docs/release-media.md) · [Gameplay capture with sound](docs/previews/afterhours-preview.mp4) · [City](docs/previews/afterhours-city.webp) · [Mobile HUD](docs/previews/afterhours-mobile.webp) · [Title](docs/previews/afterhours-title.webp)

Performance mode uses baked day/night city tiles with smooth dusk transitions, smaller mobile atlases, bounded effects and a simpler lighting pipeline. Core tiles use a 16–32 tile cache; the expanded-world cache follows the visible working set with a hard limit of 96 tiles (24 MiB of bitmap pixels). Rotated views cull off-screen corners before building tiles. On mobile Performance mode, the world and HUD draw directly into one visible canvas at 0.75–1× CSS resolution; native DOM touch controls remain sharp. This avoids both a fragile separate world layer and an expensive full-frame copy. Dialogue/title scenes use up to 2× pixel density. Balanced/Ultra keep their richer rendering paths. Canvas restoration invalidates stale terrain/menu caches. Battery Saver targets 30 presentation frames per second with a 60 Hz simulation step. Hidden tabs stop frame rendering and suspend audio. World and street-detail caches have explicit limits; obsolete crowd image requests no longer load at boot.

## Validation

Run `npm run build`, `npm test` and `npm run check` with Node 20 or later. `npm run test:startup` covers cold/warm mobile Story launches, simulated context recovery, orientation and complete responsive dialogue text. `npm run test:story-audio` verifies opening-score playback, Ogg-to-MP3 recovery, mute and bounded crossfades. The regression suite exercises actual world/collision/mission/physics logic with a mocked browser, plus action/economy/save validation.

For real-browser checks, run `npm ci` and `npx playwright install chromium` (or set `CHROMIUM_PATH`), start the static server, then run `npm run test:browser`. `CC_URL` (or `GAME_URL`) selects another served copy. Screenshots are saved under `.qa/browser/`.

The browser suite covers keyboard and emulated multi-touch controls, responsive menus, Chrome fullscreen entry/exit, directional touch aiming, control preferences, saves, crew work, both campaign routes, a physically simulated race, free roam, adaptive resolution, direct mobile rendering, battery-saver simulation cadence, streamed station/pursuit music and master muting. It repositions between most mission locations. A fully manually driven campaign, physical-phone/Safari testing and subjective audio/art review remain separate; no device FPS benchmark is claimed.

For the release page, run `npm run test:about` against the local server. `CC_ABOUT_URL` selects another deployment. This verifies responsive layouts, assets, gallery focus/navigation, links, 720p video/audio decoding and captions.

Vehicle collisions use oriented bodies matching the artwork and swept shoreline checks. Bullets resolve the nearest vehicle, person or wall along their path. Cars and bikes can hit citizens and the player on foot; diving does not grant traffic invulnerability. Parked cars and local character separation block overlap. Boats require nearby reachable land for ordinary disembarking; emergency ejection remains possible. See [mobile and collision pass](docs/mobile-collision-pass.md).


## Crown Transit and the wider world

Nine stations connect the subway and elevated regional railway. Approach an M/R entrance on foot and press E or tap RAIL, then choose a destination for 25 chips. Police checks prevent boarding while wanted. Trains accelerate, stop and open their doors; a platform/interior journey leads to a collision-checked street exit. Skip becomes available after boarding and still advances time and any active contract deadline. Train history survives saves; busted/death recovery clears unfinished boarding state.

The city canal, outdoor MetaWin casino, Red Mesa desert, Pinewatch forest, Sierra mountains and airport add road, water and air routes. Use LAND in a plane to assist runway alignment, descent and braking; cancel the approach to go around. BRAKE overrides the forward stick. In cars, keep holding it after stopping to reverse; release to drive forward. Boat and bike brakes remain stop-only. Boat exits require docking speed and nearby reachable land. Directional panel damage persists and reduces handling and power; wrecks retain their vehicle type and remain solid.

Find Chief at East Port station, Ice at Sierra Junction and Steampunk beside Midtown Metro for three new stories. The crew menu now contains 13 repeatable contracts, including canal, casino and helicopter jobs. The Last Witness and Borrowed Minutes require actual train travel. Six wildlife species populate local habitats: deer, foxes, dogs, cats, gulls and pigeons react to nearby traffic, movement and gunfire.

Gold Mage’s portrait is the exact user-supplied reference, also used as the face/armor texture in his world character. [Character provenance](docs/character-references.md) records the reference hash and verified collectible links for Chief, Ice and Steampunk.

Additional browser checks: `npm run test:metro`, `npm run test:vehicles`, `npm run test:flight`, and `npm run test:frontier`. Set `CC_URL` to test another deployment. [Metro, wildlife and vehicle release notes](docs/metro-wildlife-pass.md) include the measured mobile-emulation comparison and limitations.

## Coherence, combat and handling polish

Character animation uses measured artwork bounds and grounded feet; repeat turns cannot select invalid frames. Gold Mage, Chief, Ice and Steampunk combine unchanged original portrait pixels with detailed lower-body clothing. Their complete source portraits remain visible in dialogue. Completed crew contracts are now remembered by ID, with personal follow-up conversations and an explicit REPLAY action.

The eastern forest river stays navigable under road bridges and the elevated railway. Train carriages remain continuous when reversing at termini. Aircraft clearance includes wing spans, tips and rotor sweep, and steering eases into turns. Pedestrian dives respect banks and walls. Rain, fog and sand now cycle correctly, with saved weather timing and consistent day/night lighting across quality modes.

Run `npm run test:coherence` for the new real-browser regression checks. [Pass notes](docs/coherence-combat-pass.md) and the [mobile comparison](docs/performance/coherence-comparison.json) record the verification and remaining physical-device limits.

## Detailed world and mobile streaming

The current scenery pass adds painted materials, detailed street furniture, botanical ground cover, a ranger camp, fuel forecourt and mountain rescue outpost. Crown Airfield has three paved taxiway links, runway 09/27 numbers, hold-short lines, aircraft stands, service lanes, animated windsocks and night edge lights. The outpost buildings, tents and pumps have matching solid footprints; roads, helipads and mission approaches remain open.

Train arrivals retain active waypoints and rebuild GPS. Full journeys and skips advance weather and contract deadlines, with expired jobs reported on arrival. Station artwork, rail sleepers and mobile text layout are cached. Street/collision buckets are reused, and the mobile terrain cache now evicts old offscreen chunks during long exploration. Failed mobile tiles retry with a delay.

`npm run test:world` checks actual touch travel, network recovery, nine distant destinations and cache bounds. `node tools/world-profile.cjs LABEL URL` measures whole animation callbacks with actual CDP touch input, frame intervals and warmed drawing-call counts. [World pass notes](docs/vibrant-world-pass.md) include paired results and physical-device limitations.

The city AI pass adds body-length traffic spacing, firm red-light stops, intersection occupancy, safe pedestrian crossing gaps, water-checked boat routes and backing away from piers. Police use separate foot navigation around buildings, limited firing cadence and visible stand-down behaviour. Animals anticipate approaching traffic and birds return to safe ground without teleporting. See [mobile and AI release notes](docs/mobile-ai-pass.md).

The world layout pass rebuilds block frontages, accessible parking courts and road connections. Junction paint follows actual road arms; traffic reserves turns and checks exit space. Airport arrivals and a Pinewatch village court give empty areas usable destinations. A unified map palette, calmer street textures, coordinated roofs and cached foliage improve visual consistency. Material-specific impacts, surface rolling noise and boat wakes improve physical feedback. See [world layout and traffic validation](docs/world-plan-pass.md).

The mobility pass connects the canal visibly to the river, aligns bridge lanes and dock collisions, and gives county borders textured distant scenery. MetaWin has a playable blackjack table with saved hands. Holding a car's BRAKE stops it, then engages reverse after a short pause. Five flyable airport planes have marked stands, connected taxiways and persistent liveries. Regional platforms fit all three carriages and show their next departure. Spatial ambience, rotor modulation, material footsteps and casino/rail cues use bounded audio resources; roof, aircraft and scenery caches reduce repeated drawing. See [mobility pass notes and validation](docs/mobility-world-pass.md). The new trailer is unchanged.

## Street AI and casino update

Chaos now walks with proportional stick control; hold RUN or Shift to sprint. Hunter Garage has a reserved Riot bay and a clear street exit. Busted releases you at Metro Police and saves that position. Drivers respect full-body clearance, signal around parked obstructions when a neighbouring lane is clear, and use safer dead-end turns. Residents steer around parked cars and clear crossings before resuming their activities.

Three slot machines on the southeast side of the MetaWin terrace accept 10, 25 or 50 game chips. Approach on foot and press E or tap PLAY. The paytable is visible before spinning; results persist through leaving and reloading. The chips have no real-money value. See [the core-game review and AI changes](docs/ai-reliability-pass.md).

See [the precision, campaign and streaming pass](docs/precision-campaign-pass.md) for circuit race migration, obstruction recovery, canal repairs and measured limits.
