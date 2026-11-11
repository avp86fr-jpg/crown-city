# Campaign and reliability improvement pass

## Mission progression

| Job | Gameplay change |
| --- | --- |
| Cold Wallet | Deliberate package collection; an intercepted van stops cruising when disabled. |
| Neon Mile | Two ordered laps, a frozen countdown, a shared course for both drivers and real defeat/retry. A stock Riot can win. |
| Neural | Reachable entrance, clear-heat handoff, upfront payment or a fee deducted once from vault loot. A short balance can be deferred. |
| Casing the Palace | Two distinct reachable locations, on foot, with a short stationary scouting hold. Optional scrambler can be taken on foot or obtained with a police car. |
| Palace Heist | Quiet preparation grants a temporary no-new-dispatch window; loud entry begins at five stars. Loot is awarded once. A reserved boat waits at a reachable slip. |
| Exit Liquidity | Return to the marina, take the unlocked Nyx, reach the highway and lose the police. |

## Controls and presentation

Keyboard north/forward now agrees with touch and vehicle steering. Mouse aim uses the inverse camera transform. Focus loss releases held controls and pauses active play. Touch gains MAP and contextual TAKE. The map supports a blue personal waypoint and a return to the job route. HUD includes objective progress, race progress and pursuit feedback. Landscape settings use two columns. Existing painted city, character portraits and vehicle art are retained.

## Loading and performance

Story art loads per scene rather than blocking the title. The shared image loader handles cached events, missing decode support, errors and timeouts. Tile preloads share pending requests, missing tiles back off and small tile layers can evict old images. GPS work is limited by simulation ticks. Paused screens reuse a frozen world render. Unsupported audio and malformed settings no longer prevent starting the game.

## Verification and limits

31 automated tests pass against the actual repository world and collision PNG with mocked canvas/DOM/audio. Two choice routes traverse all six mission state machines, with test repositioning between objectives. The separate stock-Riot race test drives both laps using real physics, road data and collision checks without checkpoint teleporting. Button bounds are checked at 1280×720, 844×390 and 390×844.

The modified build now passes nine real Chromium checks (`npm run test:browser`): opening dialogue with E, keyboard movement/shooting, map waypoints, pause/save/reload, menu bounds at 1280×720, 844×390, 390×844 and 667×375, emulated multi-touch movement/RUN and TAKE/MAP/PAUSE, both campaign choice routes, a rendered frame during automatic resolution changes, and actual Web Audio output/master muting. Each campaign run physically simulates the two-lap race with the stock Riot; travel between the other objectives is repositioned. Browser exceptions and HTTP asset failures fail the suite. Browser screenshots are saved under `.qa/browser/`.

Browser testing found and fixed landscape title-menu clipping when Continue is present, objective text beneath phone buttons, a black frame during automatic resolution changes, E failing to advance dialogue, and delayed touch controls when leaving a menu. Touch pickup hints now say TAKE; phone pursuit/race/scrambler feedback fits the available space. The ending uses the game world and shows completed jobs/chips, removing the old menu baked into the title-image background. Quitting to the title tolerates blocked local storage, and the keyboard shooting instructions match the controls.

The real-browser run is automated. A fully manually driven campaign, physical phone/Safari testing and listening-based audio review remain separate; no device performance or frame-rate benchmark is claimed. These changes are prepared on the existing pull request; production has not been changed.

## Graphics and animation pass

The later visual pass adds directional vehicle finish highlights, steered wheels, suspension pitch, windshield wipers, idle boat heave, character footplant/breathing/recoil and a cleaner hero rim. Hero visibility through roofs is applied only when a projected roof covers the player. New effects include soft expanding smoke/dust, moving spark streaks, layered fire, an explosion shockwave and widening directional wakes. Medium/high quality blends water animation frames. Tree canopies gain layered volume and wind. Commercial signs and trim lights, road-only wet light streaks, world-space rain ripples, street steam and a cached vignette add depth without replacing collision-aligned city art.

Race gates have a segmented ground halo and illuminated side posts. The countdown has staged lights, and the speed display includes a speed bar and vehicle health. Story backdrops are cover-cropped with a slow push rather than stretched; portrait motion is subtler. Reduced Motion freezes new decorative movement and suppresses camera shake/strong lightning. Low graphics caps reflections/signs and omits steam and canopy detail.

The [animation](previews/graphics-animation.webp) and [still](previews/graphics-night.webp) come from the actual engine running a scripted race with real assets and a native Canvas backend. They are renderer previews, not browser captures. No video assets are downloaded by gameplay. The test harness optionally accepts a native Canvas backend for inspection; normal tests require no extra packages.

The graphics verification also rendered 18 native Canvas combinations: three viewport sizes × three graphics tiers × two motion settings, plus the story screen. Vera now uses a newly generated high-resolution transparent portrait, with its art brief recorded in [art direction](art-direction.md). Real-browser/touch verification is described above.
