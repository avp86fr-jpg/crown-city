# Precision, campaign and streaming pass

Fire's second story mission now starts at the Grand Prix pit desk and runs one full lap of the large circuit, with 32 ordered gates. The old Crown Loop remains a city district and a location for separate street jobs. The storyline, objective text, briefing and radio guidance agree on the new venue. An optional time trial cannot take over the story meeting.

The two starting cars occupy separate grid lanes. Fire follows the actual circuit with a fixed, reduced pace; there is no positional rubber-banding. An untuned Riot completed the physics regression in 103.0 seconds with its bodywork intact. A blocked start waits for space. Current race saves preserve gate, rival and countdown progress; pre-update street-race saves restart safely at the new grid. Failure returns to the pit meeting without awarding chips.

## Combat and artwork

Manual mouse aim is authoritative, including rotated cameras and torso-height projection. Touch assistance chooses alignment rather than proximity, rejects targets behind walls and applies only a small angular correction. Held aim updates between rounds. The guide follows the selected aim and stops at walls, and its circle reflects distance-dependent spread. Sidearm and SMG dispersion is lower, projectiles travel faster, and shotgun pellets are distributed across the cone rather than clumping randomly.

The three held weapons have individual metal, grip, barrel and magazine silhouettes, with lengths of 13, 18 and 24 world units against Chaos's 50-unit height. Shared dimensions place the projectile origin at the drawn barrel. The aiming pose no longer uses the atlas's embedded oversized gun. Original NFT portraits and character art remain intact.

[Weapon presentation plate](previews/precision-weapons.png) · [Story grid on mobile](previews/precision-story-grid.png)

## Obstructions and city water

Traffic retries passing after an adjacent lane clears, including when already stopped. It checks candidate lane changes against vehicle hulls, pedestrians and world collision. If steering room is missing and the rear corridor is clear, it reverses slowly to create space. It waits if vehicles or people occupy that space. Checks are scheduled at half-second intervals; parked vehicles are never pushed or teleported to unblock a route.

The seeded four-minute full simulation retained 62.1% moving traffic in its final minute (previous release: 59.7%). Maximum stationary time inside a turn fell from 26 to 8 seconds. Long stops still exist: the longest was 49 seconds and 0.1% of final-minute samples were stopped over 45 seconds. Single-lane roads with no legal passing space intentionally queue.

Three isolated water fragments in the original downtown artwork now form two paved service courts, including a repaired road crossing. Their collision surfaces match the paving. A whole-world flood-fill audit leaves the connected sea/canal/river system and the two intentional civic fountains. Harbour connections, bridge underpasses and boat routes remain water.

[Repaired courts](previews/precision-courts.png)

## Streaming measurements

Scenery construction yields between roofs, trees, road wear and fixtures. Each suspended job owns its visible-object list; another tile cannot overwrite it while the job waits. Scenery atlases decode to immutable images at their sampling size. Offscreen paint uses CPU canvases, then bounded immutable tile bitmaps. Race venue artwork is pre-rendered at 2048 pixels for Performance and 4096 for desktop; incremental procedural rendering remains available if those files fail to load. Quality changes release the superseded circuit bitmap.

The table reports synchronous render work in headless Chrome with an 844×390 touch viewport, DPR2 and 4× CPU throttling. Each cold location contains 120 manually rendered frames. The baseline is main commit `8830fd1`; the exact samples and method are in [precision-metrics.json](precision-metrics.json).

| Cold location | Previous p95 / peak | Updated p95 / peak | Frames until all visible tiles ready, before → after |
| --- | --- | --- | --- |
| Circuit | 12.3 / 341.9 ms | 6.8 / 60.6 ms | 21 → 19 |
| Airport | 15.0 / 38.2 ms | 14.3 / 58.9 ms | 54 → 67 |
| Forest | 10.2 / 333.6 ms | 10.7 / 21.4 ms | 31 → 33 |
| Junction | 31.7 / 223.0 ms | 12.0 / 26.2 ms | 39 → 82 |

This reduces the largest composition stalls, at the cost of finishing some distant detail across more frames. Airport peaks did not improve in this run. Native image uploads, font initialization and individual drawing operations can still exceed the time budget. These numbers are not a Redmi Note FPS measurement, and the game does not claim locked 60 FPS.

Regenerate venue artwork after changing its geometry or materials with `CC_URL=http://127.0.0.1:8030/ npm run bake:circuit`; the tool exports the game renderer without actors or HUD. The mobile and desktop files are approximately 417 KiB and 1.4 MiB. Normal source changes still require `npm run build`.

## Campaign and release validation

The campaign order remains Cold Wallet → Burning Bridges → Dead Air → The Inside Line → House of Glass → Exit Wounds. Tests complete the safe/quiet/upfront and flip/loud/credit routes, check one-time payments and deferred debt, restore checkpoints and the reserved getaway, reach both endings, and reload post-ending Keep Driving without restarting mission one. The browser campaign drives the circuit using game physics and a steering controller; other mission transitions reposition between objectives. This is not a full manual playthrough.

Validation includes the Node regression suite; 19 core browser checks; cold and warm mobile Story launch without changing quality; context restoration; portrait/landscape text and control layouts; live touch circuit/airdrop/workshop controls; weapon presentation and muzzle alignment; old race migration; and the missing-venue-image fallback. No trailer or About media was edited.
