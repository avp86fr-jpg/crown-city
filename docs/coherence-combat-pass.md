# Coherence, combat and handling — 2026-11-11

## Characters and presentation

The character renderer previously placed feet below their collision positions and cut some adjacent animation poses into the same frame. Chaos and the crowd now use measured alpha bounds, torso anchors and a common ground origin. Exit animation grows to normal size, wet footsteps and carried props follow the new origin, and repeated rotations cannot address negative animation rows. Night rendering no longer paints the same hero sprite four times.

Gold Mage, Chief, Ice and Steampunk have detailed waist-to-boot costume extensions and smaller upper-body proportions. Their faces and armor use original portrait pixels; complete portraits remain visible in encounters. Gold Mage's supplied JPEG is unchanged, including its SHA-256. Generated lower-body clothing is a game adaptation. See [provenance](character-references.md).

The About gallery includes four fresh game captures. The existing 720p trailer remains the preceding metro/wildlife release capture. Touch interaction icons now follow TALK, REPLAY, RAIL, TAKE and vehicle actions. Desktop and mobile speedometers agree: km/h on roads and knots on water/in aircraft.

## Shooting and movement

- A wall between the shooter and muzzle stops the shot, rather than allowing a projectile to spawn through it. Wrecks block player and police fire.
- Moving and sustained fire widen weapon spread. Releasing the trigger restores accuracy; cover improves it. Damage falls off by weapon range, with the shotgun strongest nearby.
- Mouse aiming and the aim guide use the same chest-height projection as tracers. Clicking a visible torso works with camera rotation and aim assist disabled.
- Car BRAKE overrides a held forward touch stick. Vehicles brake to a stop before reverse engages; DRIFT remains a separate control. Damaged bikes retain their reduced grip on wet surfaces.
- Boats have modest lateral inertia, require docking speed before ordinary disembarkation, and use the existing reachable-land checks. Emergency ejection remains available. Wakes stay below bridge decks.
- Aircraft steering and lean ease into turns. Clearance sweeps cover fuselage, wing span, wingtips and helicopter rotor/tail rather than a small center radius. Exits clear the aircraft body. Runway assist, go-arounds, stalls, landing, save/resume and recovery remain covered by regression checks.
- Pedestrian dives and gathering movement use walkable-ground and vehicle collision checks; water is no longer treated as a safe dive destination.

An initial additional car-inertia adjustment failed the stock Riot race regression. That adjustment was removed before release. The unchanged two-lap physics test completes in 1,463 simulation ticks with the current car handling.

## World and story consistency

The forest extension had filled over the eastern river. The water and bank band now remain continuous, with separate boat surfaces under road bridges. Elevated rail supports leave the river clear. The new regression sails through both eastern road crossings with full health and sweeps the complete boat hull across the river.

Regional train carriages previously switched from one side of the scheduled position to the other at a terminus. They now retain a centered formation; all six carriages across the two trains stay continuous at both reversal times and inside the track endpoints.

The weather sequence used the first occurrence of `clear` to find its next entry, leaving normal play stuck in clear weather. A saved sequence index and remaining interval now advance through rain, fog and sand. Desktop and mobile use the same night crossfade. Sparse river wavelets add motion with a fixed draw budget and avoid bridge decks.

Completed contract IDs now persist in saves. Returning to each contact triggers a personal follow-up instead of silently starting the same job; a second interaction explicitly replays it. Existing saves retain their completed count, but previously completed individual IDs cannot be reconstructed from that count. Active jobs still take priority and cannot be overwritten. A failed portrait request can retry after a delay rather than remaining permanently blocked.

## Mobile measurement

Later profiling review: this older tool sent keyboard input in a touch-capable browser. Keyboard input switches the game to desktop HUD/input mode, so these samples do not measure the full touch-control path. The [world pass](vibrant-world-pass.md) uses CDP touch gestures and asserts that touch mode remains active. The historical numbers below are retained with that limitation.

The pass bounds mobile vehicle collision work around the viewport and nearby player, rejects distant or stationary vehicles before expensive pedestrian impact checks, reuses particle/skid/actor buffers and caches radial effect textures. Local collision, police and mission behavior remain active. Sprite cropping removes redundant draws without changing source textures.

Two fixed-seed before/after comparisons used headless Chromium, 844×390 CSS pixels, DPR 2, low quality, automatic resolution disabled, rain at 21:00 and 4× CPU throttling. Each includes a radio warmup and approximately four seconds of driving. The repeated sequential pair against published commit `217e28e1fcadb58087d26d5c827a5303ad4eecc5` measured:

| Smoothed work | Before | After | Reduction |
| --- | ---: | ---: | ---: |
| Simulation | 21.00 ms | 15.77 ms | 24.9% |
| World rendering | 11.38 ms | 8.90 ms | 21.8% |

Presented frames were 55 over 4.265 seconds and 57 over 4.190 seconds. The initial pair showed the same direction but a larger frame-count difference. Frame-time spikes remain, and a shared host is noisy. These are work-time comparisons, not a promised device FPS or physical Redmi result. [Compact measurements, peaks and initial pair](performance/coherence-comparison.json); reproduce with `tools/mobile-profile.cjs` against separate published/current servers.

## Verification

- Syntax checks and all 13 Node regression files pass, including 15 new checks for this pass.
- The 19-check core Chromium suite passes: both six-job campaign paths, real controls, save/resume, economy, radio/audio, fullscreen, responsive HUD and resolution/battery settings.
- Flight, frontier, transit and vehicle browser suites pass: takeoff/hover/landing, assisted runway landing, boat routes and braking, actual mobile controls, travel/save/recovery and bounded tile caching/audio streams.
- The new coherence browser suite checks character rendering, actual forest-river sailing, recoil, visible-torso mouse aiming, simultaneous touch throttle/brake and completed-contact replay in portrait layout.
- About checks cover gallery assets, responsive layouts, keyboard navigation/focus, links and 720p video/audio/captions.

Physical Redmi testing and a fully manually driven campaign remain unverified. The game retains its illustrated top-down renderer and existing timed rail journeys.
