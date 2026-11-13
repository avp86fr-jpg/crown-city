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
