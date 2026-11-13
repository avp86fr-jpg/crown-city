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
