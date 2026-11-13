# Crown City resort + polish pass (Nov 13, branch `resort-island-polish`, local only — NOT pushed)
Base: origin/main 42549f3. Server: `PORT=8032 node tools/serve.cjs`. Chromium symlink /usr/bin/chromium -> google-chrome.
Scripts: /workspace/cc_work/shots.cjs (screenshots), sim.cjs (bridge drive + FPS), probe.cjs.
Before screenshots: /workspace/cc_before/.

Done:
- src/resort.js: north annex (NORTH=2816, y<0) with own grid W.north; Lucky Isle (beaches, 6 hotels+pools, Wild Crown Park w/ ferris wheel, coaster, carousel, spinner, drop tower, bumper cars), marina + boats, lighthouse jetty, Crown Bay Bridge (x=5600) joined to the boulevard; roads in W.roads -> traffic graph; lamps; districts; boats under bridge.
- Hooks: world.js (codeAt/districtAt/applyResort), game.js (render hooks, minimap oy, nav OY, save clamps), mobile_renderer.js, traffic.js createNav OY, aviation clamp, world_limits markers.
- Audio: island ambience (surf, gulls, calliope, coaster, screams, marina bell, bridge joints) + new original track tools/compose-lucky-isle.py -> assets/music/lucky-isle.* (ISLAND FM, auto on island).
- Tests updated for y-offset (canal_limits, game, living_traffic).
TODO: district texture pass, perf check, rebake mobile world (`npm run bake:world`) at end, npm test, zip.


## 2026-11-13 afternoon - district pass + final
- Roof variety (architecture_art.js): tinted membranes, rooftop gardens, rooftop pools on flat non-industrial roofs.
- District colour grade per procedural district (render_world.js, soft-light, subtle).
- Courtyards too tight for parking (empty bays) become gardens with lawn, path, trees, benches.
- Rebaked mobile world (npm run bake:world), npm test 424/424 pass, build ok.
- Sim FPS: desktop swiftshader median 51 min 44; mobile low median 60 min 58.
- Zip: /workspace/CrownCity_resort_build.zip (not pushed).
