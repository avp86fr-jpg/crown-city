# Pass 2 progress (resort-island-polish)
- [x] Drive-by arm/window shots, side arc, bike one-hand
- [x] Gangs (Vipers/Rust Kings), roadblocks, cop flanking, search-from-last-seen reinforcements
- [x] Weapon audio per weapon, echo/distant layers, impacts, dryfire, casings, hit markers, reserve ammo
- [x] Gore: persistent fading decals, sprays, flinch, runover gibs (full gore only)
- [x] Hotels redesign, industrial yard dressing, mobile night grade, continuous skid marks
- [x] Vehicle speed table, balance (wanted-scaled damage, mission rewards)
- [x] Map sweep + animation strips + mission bot run (all 6 complete)
- [x] Tests green (424 unit, browser suites), published preview d6043fe, live check OK (desktop 46 fps, mobile 60 fps, 0 errors, 0 SW)
- [x] Bridge pylons moved to deck edge (map audit was failing on outer lane since 029f0b8); promoted to root

# Pass 3 (from main 7b80db0)
- [x] 8-phase gait (4 painted keys + passing poses), crowds 4-phase, topple death + lying pose, walk-to-door + door swing on enter; light map 1/3 res on desktop
- [x] East frontier: roadhouse, motel, farm+barn, crop fields with hay bales, power lines, ranch fences, farm tracks, unbranded road signs; hotel facades deeper (3-5 balcony floors, side returns)
- [x] Three new crew-board jobs with VN beats: NINETY SECONDS (timed heist getaway), SHADOW WORK (tail, then ram-and-takedown), REDLINE EAST (Nyx hypercar sprint through generated gates to the new Roadhouse). Scripted completion checks pass; mission_review test covers stages/targets.
- [x] Removed a real car brand from circuit labels/briefs (now "Crown Grand Prix").
- [x] Pedestrians: 12 painted wardrobe looks (men: suit, tracksuit, beach, hi-vis workwear, elder cardigan, casual cap; women: dress, skirt, suit, beachwear, workwear, elder), district-weighted (island/harbour beach, Ironside/airfield workwear, downtown/Strip suits), ~50/50 sexes, couples pace together, elderly walk slower, body-width variation. Generated offline by tools/make-ped-variants.py from the existing painted crowd (recolour + painted hats/hair), streamed after load.
- [x] Effects: painted layered smoke puffs (smoke, dust, steam, gunsmoke, haze) drifting with the wind field and easing out; muzzle gunsmoke per shot and haze after bursts; glass shards on heavy hits; damage stages (steam <70%, smoke <45%, flicker flames <22% before the burn); spreading blood pools and streaked drops; sea troughs, crest highlights, sun/moon sparkle, double shore foam; lamp reflections on water at night; particle cap drops 45% when fps sags.
## Pass 3b
- [x] Sea: painted swell (dark trough + pale crest band + bright tapered crest), turquoise shallow shelf at beaches, soft animated foam band, sun/moon sparkle, lamp reflections.
- [x] Smoke: 14-lobe painterly puff texture with long alpha falloff, warm lit crown / cool underside, billowing 3-lobe draw.
- [x] Circuit artwork rebaked without the real brand ("CROWN MOTORSPORT PARK"). Vehicle atlases crisped (tools/crisp-vehicles.py).
- [x] Audio mix measured per bus (tools/audio-mix.cjs): no clipping (master peak <=0.73), 2.5–5 kHz share <2%. Heavy gunfire now ducks music 2–4 dB; ambience +3 dB.
- [x] Map restyled as an atlas (gilt frame, grid, compass, scale bar, outlined route, pulsing objective, heading arrow). Ground route chevrons in the world for every GPS route. Clearer hints on 7 old objectives.
- [x] Old Town: market squares, civic halls on greens, terraced rows, mixed roofs; built with a local RNG so the rest of the city is unchanged.
- [x] Response vehicles no longer park inside junctions (gridlock seen in the hand-driven run).
- [x] Driving measured (tools/drive-metrics.mjs): top speed 226 (taxi) to 457 (Nyx); 0–300 in 1.03 s (Nyx), 1.47 s (Dart), 2.03 s (Riot); braking from top speed in about 1 s. Left unchanged.

### Pass 3b wrap-up (Nov 13 20:20 CET)
- f706ceb: sign-face cache, cheaper wet reflections/drain steam, gradient HUD panels with gilt rule, contract objective banner, SHADOW WORK pin-to-stall, persistent job markers, rebake. Tests 424/424 green, audit:map clean.
- Bot runs: m4 (vault→marina→boat→island) completed by driving in 85 s; SHADOW WORK reached stage 2 by driving, then stuck (sedan could not be stalled by a bike) → fixed; NINETY SECONDS stage 0 marker loss → fixed, reached stage 1 in 41 s.
- Night fps, same session back-to-back (swiftshader, 1280x720 high, 23:00): Strip 25.6 → 35.8, downtown 22.7 → 33.8 (7b80db0 → d7cf13633a5e). Phone mode (844x390 low) 286/370 → 303/333 uncapped (both far above 60; noise). 50+ desktop night not reached in this headless renderer.
- Published preview 4760107 (bundle d7cf13633a5e): copy verified (assets 328/328, css 1/1, diff -rq identical, bundle cmp OK), live check desktop+mobile title→VN→play, 0 errors, 0 4xx, no SW, noindex; root untouched (eb08a8621909).
- Re-run of jobs after fixes: SHADOW WORK reached tail stage in 86 s but the bot then failed to hold tail range (bot limitation, not verified end-to-end); REDLINE EAST and NINETY SECONDS end-to-end not verified this pass.
- Contact sheet: /workspace/cc_work/contact_pass3b.jpg (432 KB).

# Pass 4 (Nov 13, 21:00-21:50 CET)
- Commits 268a80f, c2b7c5a (+ PROGRESS). Preview bundle d0b1f1122786 (cc_pages aad4e6e). Root untouched (eb08a8621909).
- Night perf: desktop world layer renders at 0.78 internal scale when dark (hysteresis, HUD native); vignette folded into the multiply light map (one fewer full-frame composite); vehicle atlases pre-downscaled once (512->224 px cells).
  Measured back-to-back, swiftshader 1280x720 high, 23:00, 4 runs each (before adbf420 / after c2b7c5a): Strip 37.5/35.7/38.5/40.2 -> 42.2/25.6*/48.8/46.7; Downtown 35.2/34.5/34.1/36.8 -> 39.8/25.4*/39.2/48.5 (*run 2 had 5 bot browsers running). Day unchanged (~43-50). Mobile low uncapped 250-500 fps both.
  Finding: frame time is raster-bound in the GPU process; JS-side draw timings move to whichever call syncs (removing all chars cut JS render 14->1 ms with ~0 fps change).
- Missions (bots, low quality): SHADOW WORK complete by driving in 50 s; REDLINE EAST complete (1 harness assist leaving spawn, gate sprint driven 32 s); NINETY SECONDS stages 0-1 driven (garage in 33 s by car), stage 2 not completed by bot; story m0 complete with 2 assists (bot wedged in a pile-up outside Hunter Garage), m1 reached race, then stopped for budget.
- Lose-heat: 5 + 2.2 s per star (was 7 + 2.5), 1.5x faster once 900+ units from the last sighting.
- AI/traffic/stalled cars snap back to their last dry spot instead of sitting in the sea (player can still drive off a pier).
- Smoke: cool contact shadow under pale puffs, slightly brighter smoke; sea swell bolder (wider/stronger trough and crest).
- Economy: body armour (400, soaks 60% of bullet/blast damage, saved), street tune extended to 5 stages at 500/800/1200/1700/2400 (stages 4-5 add less top speed). Unit test added (425 tests).
- Load: circuit paint (1.3 MB, 4096 px) now streams only when the camera nears the park on desktop. Desktop transfer 9.1 -> 7.8 MB, JS heap 25 -> 22 MB after 10 s play.
- Pedestrians: backpacks, briefcases, shoulder bags and totes per wardrobe look (55% carry one).
- Getaway: on-foot arrival at the garage now tells you to take the Riot in the bay.

## Pass 5 — sprites + AI coherence (preview only)
- Traffic: knocked-loose ambient cars now try to rejoin the nearest same-direction lane (canDepart/poseClear) after 1.6 s, despawn out of view after 6 s instead of turning into parked lane blockers (Hunter Garage pile-up). Deadlock relief: cars still >12 s out of view retire, >18 s in view fade out over 2 s; frozen non-turning junction owners release their reservation. Smooth heading blend (rotOff) on rejoin.
- Pedestrians: mid-block kerb crossings invalidated so walkers continue to the corner crosswalk instead of crowding; blocked-reversal delay 1.4 s (0.6 s while crossing) to cut jitter.
- Sprites: painted headlamp/tail lenses with highlights (brighter at night), tighter contact shadow under cars; crowd looks regenerated with dress/skirt silhouettes (5 looks) following walk-frame leg spread.
- Metrics (40 s × 6 districts, before→after): stuck>20 s 22→13, stuck>12 s 47→37, knocked cars in road at garage 2→0, v-v impacts ~0 both. Downtown light queues still count as stuck (2→7, mostly red-light queues); midtown showed 3.35% ped-on-road samples (crosswalk counting), garage reversals 0.8/min.

## Pass 6 — sprites, AI, cops, open world, density (preview only)
- Vehicles: painted tyres (rolling tread, sidewall light, alloy glint); damage reads in stages — dent highlights/shadows from 80% wear, frosted crazed windscreen from 50%, rear screen from 28% health; longer engine smoke with a lit crown so dark smoke shows on asphalt.
- Pedestrians: soft dark silhouette rim on all crowd looks; suit/cardigan/grey-suit recoloured (navy, plum, teal) so looks separate at street zoom. Kerb-corner strays (only carriageway on all cardinal rays) now find the diagonal pavement; blocked walkers sidestep before reversing.
- Traffic: red-light queues (front car at red and the chain behind it on the same edge) tracked as `redQueue`; they are never faded out in view. Out-of-view relief needs 14 s and a 260 px off-screen margin; in-view fade only after 26 s of non-queue gridlock. Crashed cars may swing into the nearest lane after 3.5 s (never against its flow).
- Cops: stand-down and released roadblock cruisers rejoin traffic as patrol cars (no more parked cruisers in lanes), and wait for their officers to climb back in.
- Density: district character (busy core/Strip 1.15, industrial/harbour .72, island .45, wilderness .36) × clock (small hours .55, late .8, rush 1.2 busy). Multi-lane roads weighted over backstreets; busy districts feed from just off-screen. Mix: taxis downtown/late, buses by day, vans and stitch in industrial, bikes. Peds follow density (flatter). Mobile low budget unchanged.
- Open world (src/open_world.js): 36 hidden chip caches against walls across ~16 districts (150 each, 2500 for all), 10 speed traps on the longest straights (110+ km/h pays, best kept), taxi fares in free roam (stop a taxi at the kerb), ambient events spawned out of view: buskers with gathering crowds, roadside police stops in parking bays, van deliveries with a courier carrying boxes, beach crowds with parasols. Progress in `crowncity.openworld.v1`. 32 shop/home/office/workshop signs (was 16), shop awning colours vary.
- Story: marina objective hint says to dock and step ashore.

## Pass 7 — roadmap top items (preview only)
- ROADMAP.md: 15 prioritised items with impact/effort/why/status.
- Stunt ramps: 10 painted ramps on open ground (dirt/sand/grass) with a verified clear run-up and landing strip; 230+ px/s and straight on launches the car (held velocity, lifted body, ground shadow), landing pays 40 + 4/m, +200 first time, best per ramp saved.
- Onboarding: one-time hints the first time a cache, speed trap, ramp or taxi is relevant; pause menu CITY LIFE n/56 shows caches/traps/jumps/fares.
- Bus livery (teal stripes, gold pinline, panel seams, route board); bus/van tyres pulled inside the body.
- Economy: PAINT JOB / 300 at workshops (cosmetic). Respray stand-down cops now rejoin traffic instead of parking in lanes.
- Mobile benchmark: perf.cjs syncs each frame with a canvas readback and supports THROTTLE (CDP CPU throttling); 6× gives 32–51 fps on the mobile low path.

## Pass 8 — every open roadmap item (preview only)
- Explosions: white-hot core flash, fast shock ring + slower dust ring, tumbling debris that bounces and stays 30 s, painted flame tongues burning 3–5 s on the scorch, cracked scorch decal with embers; water blasts throw a collapsing white column and three spreading rings.
- Sea: boat foam wakes (bounded stern samples spreading into a V over 3 s).
- Vehicles: armoured van repainted navy (glass kept dark) with roof ID plate, amber beacons and rear chevrons; bike red/contrast lift.
- Crowd: caps, sun hats, beanies and fedoras (~38%), scarves (~16%). Chaos: sprint after-image + boot dust, white hit flash, red visor glow at night/while aiming that lights the night pass.
- Open world: 3 city ramps (Port Royale, Midtown), 30 painted landmarks on empty lawns/lots/sand/dirt (solid to the player, discoverable), 8 properties 1,500–12,500 chips (stand on the marker to buy; safehouse clears heat, rent 3% every 3 min), CITY LIFE stats card with completion %, three-card first-play primer.
- Cops: spike strips ahead of 3★+ roadblocks (flat tyres: half speed, sparks; repair/respray fixes), dispatch radio line when heat rises.
- Traffic: deadlock breaker (nose-to-nose / 3-car knots, out-of-view stalled blockers). Strip+downtown at 17:30, 40 s: gridlock>20 s 10→7, stuck>20 s 21→12.
- Audio: two new original compositions (tools/compose-pass8.py: OPEN ROAD 89.3, TIDE FM 93.5) plus the unused AFTER HOURS track; radio dial 3→6; harbour piece on night beaches/piers.
- Mobile night: veil folded into the multiply grade, cached headlight beam sprite, 10 lamp pools instead of 22. Synchronous render benchmark (no throttle): night 2.98→2.75 ms median (noisy); throttled rAF fps runs vary 25–45 between identical runs, so not used as evidence.

## Pass 9 — weak spots + optimisation (preview only)
- Profiling: CDP CPU profile (mobile night: 71% idle, JS <2%); new section profiler (G._profSync flushes the canvas per section) and interleaved A/B bench (cc_work/dbgbench.cjs, secprof.cjs).
- Street fixtures: sprite canvases trimmed to footprint (less overdraw); dev dbg toggles on mobile (noBase, noMulM, noLampM, noVL, noResort).
- Landmarks by place category, core city first (8 city landmarks), car parks excluded.
- Property marker: name, price and rent card within 300 px; owned shows SAFEHOUSE + rent.
- Bike livery: white twin stripes + gold pinstripes.
- Traffic: backoff for nose-to-nose pairs, junction owner release at 6 s.
- Cops: PIT from 3 stars, cover-seeking foot cops.
- Chaos coat hem sway (procedural).
- Real-input checks: boat wake (107 wake samples at 224 speed), spike strip flattens a keyboard-driven car.
- Not done: save unification (reverted, conflicts with tested design), desktop night lighting look, rooftop/kerb variety, painted walk frames.

## Pass 10 — audit, road coherence, light-map cache (promoted to root)
- Audit: 16 districts x day/night x desktop/mobile screenshots (cc_work/audit10.cjs). Worst: flat dark desktop nights away from the core, forest bandstand reading as a stop sign, roads ending in grass.
- Road coherence (tools/road-coherence.mjs, now part of audit:map; fails on uncapped dead ends, unjoined crossings and paving gaps; warns on lane-count joins and unsignalled major junctions):
  - Canal: every bridge deck left a 16 px promenade strip across the road at both banks (7 roads); deck now spans the cleared bank.
  - Lucky Isle bridge: a 100 px sand/promenade gap between the island grid and the deck; paved approach with kerbs and centre lines.
  - Frontier: later roads' dirt shoulders cut stripes across earlier roads at junctions; shoulders now cleared before paving.
  - Three dead ends at y 6800 stop at open grass: end-of-road terminus drawn on desktop and mobile.
  - Strip 1964,3900 signal now attaches to its node.
  - Remaining warnings: 2 unsignalled Strip four-ways, 1 lane-count change at 2800,2620 (Palace Row, 1 lane + median to 2 lanes).
- Desktop night: warm lamp spill + stronger light-map pools; static light map cached (see ROADMAP 15).

## Pass 11 — optimisation on everything (preview only)

- Desktop night: drawMarquees batches bulbs into one path per state; vehicle tyres use cached 28x56 sprites; warm lamp spill limited to 7 nearest pools. Per Strip night frame: fills 498 -> 101, fillRects 310 -> 92. e_misc 2.06 -> ~0.9 ms.
- Real rAF loop (headless swiftshader, 16 s/scene): Strip 48.5 -> 53.7-53.9 fps, downtown 58.1 -> 56.6-59.2, midtown 57.3 -> 57.2-59.8. Still not a locked 60 headless; the remaining cost is the light map (l_map ~6.9 ms) and drawImage/save churn.
- adaptRes: desktop sheds resolution from ~52 fps (phones keep 45) and won't retry a failed scale for 45 s.
- Traffic: signal at the Strip x 1600 crossing. 4-minute full soak: 57.8 -> 63.6% moving, worst stall 59 -> 34 s. Signalling 2620 as well gridlocked the short link (119 s), so it was not kept.
- Combat: 55 ms hit-stop on player kills, knockback on flinch (stays off solids/water), shake when hit and on kills.
- Sound: heavy crashes add a low crumple and a glass tail; contact pitch jitter; vans/buses/ambulance get a heavy engine class; per-model engine detune.
- Not done this pass: mission pacing, animation frames, centre-art variety, economy sinks.

## Pass 12 — visor lock + Wild Crown Park polish (preview)
- Chaos's red visor glow no longer floats off the helm on left/right headings: it is pinned to the painted slit (hidden when the visor faces away) and is a tight 7×5 highlight instead of a 14×10 blob on skinny profile frames.
- Wild Crown Park: brick-kerbed promenades and a paved apron that meets the south resort road, ticket booths and path lamps, richer ride pads, a carousel with horses under a scalloped canopy, coaster trestle legs and a named station, a readable drop-tower shaft, and more night lighting (path lamps, spinner, bumper, canopy halo). Static work stays in the cached chunks; animation is still a handful of arcs and cached paths.

## Pass 13 — rain (preview)
- Replaced sparse 3×9 screen ticks (mobile) and world-space 3×12 particles (desktop) with pre-rendered wind-angled streak sheets in two/three parallax layers, tiled via cached repeating patterns (no per-frame gradients, no rain particle allocations).
- Ground: splash ripples on roads and sidewalks, painted puddles, and cheap lamp/headlight sheen on the mobile path (desktop already had wet reflections). Slight uniform cool multiply veil; intensity follows the existing rainAmt ease-in/out.
- Removed the full-view wet wash (`rgba(30,40,60,.18)` over the whole camera AABB) that darkened buildings as well as roads and could read as a muddy band. No new radial or diagonal rain overlay. Light-map vignette is unchanged (radial, corners only).
- Gates: 429 unit tests, `npm run check`, `audit:map` clean (pre-existing capped dead-ends / known join + signal notes only). Browser suites: browser, world, baked-world, materials, mobility, coherence, street-impact — all pass.
- Local fps (swiftshader): mobile 844×390 low night rain ~225 fps (3.7–4.4 ms); desktop 1280×720 high night rain ~26 fps in a tight render loop (was ~42 without the new overlay on this software rasterizer; real GPU cost is a few pattern fills).
- Contact sheet: `/workspace/cc_work/contact_pass13_rain.jpg`. Root stays pass 11.

## Pass 14 — Crown Peak alpine region + headlight cones (preview)
- New 3,072 px annex below the southern frontier (own collision grid `W.south`, `src/alpine.js`). Two entry roads leave the y 9800 frontier road at x 9216 / 10624, form the Frostfall village loop, then one plowed switchback climbs four hairpins to the summit plaza and the Crown Peak observatory (landmark). Guardrails with chevrons on every downhill/outer bend, icy patches, tyre ruts, plowed banks.
- Frostfall village: 10+ chalets (varied wood, trim, gable/ridge roofs, balconies, chimneys with drifting smoke, warm windows and snow pools at night), boardwalks, fences, props, lamps. Mirror Lake (frozen, drivable, grip .36), pine forests (~1.7k, snow-laden), rock cliffs with snow crests, a chair lift with moving chairs, sea to the west.
- Painted once into cached 512 px chunks (half-res on low). Snowfall: three (low: two) pre-rendered parallax pattern layers, replaces rain overlay inside the region. Grip: packed snow road .8, ice patches .5, off-road snow .72, lake .36. Minimap/atlas colours the annex as snow; landmarks CROWN PEAK / FROSTFALL / MIRROR LAKE; four chip caches. Peds in the snow get knit hats and scarves (overlay).
- Mobile night headlights: pre-rendered warm soft cone (additive) replaces the flat grey trapezoid; rain streak sheets slightly denser/brighter, more so by day.
- Gates: 432 unit tests (new tests/alpine.test.js), check, audit:map clean (coherence H now includes the annex), build reproducible, 7 browser suites pass.

## Pass 15 — Crown Peak polish (preview)
- Chalets: top-down snow-laden roofs with shingle eaves, pillowy snow edges, blue-shaded ridge slopes, cross-gable wings on larger chalets, dormers, skylights, back decks, icicles, SE blue cast shadows; shovelled stone footpaths with snow banks; parked snow-capped cars between chalets (solid); string lights on the eaves at night; grey chimney smoke, stronger by day.
- Summit: snowy stone viewpoint plaza (flagstones, snow in joints, plowed rim), parking apron with bays, benches, coin telescope, three flags, stepped entrance to the observatory.
- Dusk: ambient multiply is pulled to cool neutral inside the region (desktop light map + mobile tint; mobile warm wash cut by 85%), so snow no longer goes salmon.
- Switchbacks: darker asphalt, orange snow poles with reflectors on both verges, heavier guardrails, blue drop shading on the outer side of rails, extra 16% camera zoom-out at speed in the region; M map/minimap roads drawn dark on snow.
- Textures: wind-sculpted drifts (sastrugi), sparkle, natural branch snow clumps on pines, broken stratified snow ledges on rocks, frozen lake skate loops and cracks.
- Winter hats/scarves now sit on the head/neck of the standing sprites (was drawn at the feet). Snowfall over the open sea reduced to 12%.
- Measured grip (dart, 0.45 s right steer at ~295 px/s): city asphalt slip 9°, snow road 11°, frozen lake 23°.

## Pass 16 — world global coherence (preview only)
- New `tools/world-coherence.mjs` wired into `npm run audit:map`: trees/buildings/decor on roads, pickups/spawn reachability, boats on land, cars in water. First run found 14 kerb trees on carriageway + 2 compounds (exempted as paved); now 0.
- Snowline gradient across the frontier strip (y 9880–10240), reduced sand band on the annex top.
- Desert rocks removed within 220 px of the snow entry roads (decor, decorBins, obstacles, collision). Known: mobile baked sheet 4_4 still shows two rock clusters near x 8850–9580 — source not yet traced.
- Kerb trees nudged off the road; winter hats only in snow, smaller beanie/scarf; snowfall over the sea at 12%.

## Pass 17 — world, AI, Crown Peak polish, vehicle audio + SFX, story scoring, technical pass (preview only)
- Mobile bake root cause: `bake:world` composes tiles with the *built* bundle (`dist/`), so a bake run before `npm run build` re-bakes stale scenery. Order is now build → bake → build. Entry-road rocks gone from mobile sheet 4_4; desktop radius widened (340 px) so the last faint rock is removed.
- Chalet roofs: wide timber/shingle eave band with courses, dark ridge beam with snow crumbs, wind-scoured shingle patches, stone/brick chimneys. Snowmobiles + ski racks, chair-lift chairs with backrest/footrest and riders, breath puffs on pedestrians in the snow.
- Snowfall: far+mid flake layers pre-composited into one tile and the haze fill folded in (desktop 3 full-screen fills + haze → 2; low tier 2 → 1).
- AI: alpine roads cruise 64 (was 100 default), 25 % slower corners, 0.6× braking and 1.35× headway on snow; village pedestrians spawn on shovelled chalet paths; horns per model/spatialised.
- Vehicle audio (`src/vehicle_voice.js`): 15 model voices, per-model gear model, load-based tone/engine braking, turbo spool + blow-off, horns per model, tyre voice per surface (asphalt/dirt/sand/snow/ice), 3 spatialised AI engine voices with doppler (2 on low tier), door open/shut, snow/water footsteps, mountain wind and hushed city beds in the snow.
- Story scoring (`src/story_score.js`): per-job points + S/A/B/C (time, accuracy, stunts/near misses/drifts, heat, damage, collateral), painted results card with count-up and sting, best per job + best total in the story save only, STORY SCORE in pause menu and stats card, end-of-story final score card, live NEAR MISS / DRIFT combo pop-up. Tests in `tests/story_score.test.js`.
- Mobile audio unlock retries on later gestures until the context is running.
