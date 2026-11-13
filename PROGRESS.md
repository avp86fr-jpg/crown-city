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
