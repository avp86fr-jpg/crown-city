# Final presentation and lighting pass — 2026-11-11

## Rendering and world coherence

- The illustrated core retains its painted perspective. A second roof extrusion had moved roof edges away from the original art. The procedural frontier still uses extruded buildings.
- Obsolete neon/window masks no longer paint displaced signs and pool edges over the updated city. Casino glow samples the actual current roofs, and decorative HVAC no longer covers painted casino signs, pools or helipads. Mobile night tiles were rebaked from the corrected composition.
- The outdoor casino's material is quieter, with stone aisle inlays and subtle table shadows baked into terrain. Felt, guests and character silhouettes remain legible.
- Street lamps use spatial bins. Mobile takes the nearest sixteen; desktop includes light pools crossing viewport edges. Canal lamps without a road-side attribute now produce finite light positions.
- Traffic signals draw live on mobile and desktop from the same phase function used by traffic AI. Nearby signals are indexed, and their light list is reused.
- Muzzle/explosion and damage flash lifetimes now advance in simulation time. Pausing, rendering twice, Battery Saver or rendering no frames cannot alter their duration. Low quality now displays short flash lighting, and no longer retains those flash objects indefinitely.
- The low-quality duplicate source-terrain cache drops from 24 to 8 512×512 RGBA chunks: up to 16 MiB less source canvas memory. The separate finished tile cache remains bounded to the visible working set. This is a cache allocation bound, not total device memory usage.
- Damage vignette, architecture glow, traffic signal heads and bounded shared tree canopies are cached; zero-height core wall/shadow work is skipped. Parked cars, boats and aircraft no longer receive inappropriate mobile car headlights.

## Presentation and repository

The new 44-second trailer has twelve gameplay cuts and an original arranged score, with a matching VEIL FM radio version. All seven gallery captures, the story image and trailer poster are current. See [release-media.md](release-media.md) for capture methodology, attribution and reproduction.

GitHub gains a pull-request/main regression workflow with read-only permissions, pinned checkout/setup-node actions, an npm lockfile install, syntax checks and the Node regression suite. Native GitHub Pages publishing remains in place. A dependency-free local preview server supports byte ranges for reliable video/audio seeking; the About test waits for a decoded frame after a chapter jump.

Gold Mage's supplied JPEG is unchanged (SHA-256 `a21d3e414f5885c2ae84eeed318735c8ad15d8d3d63b5c158e82a5a7a7039a05`).

## Validation

Six targeted regression cases cover rendering-independent effects, current-roof glow alignment, finite canal lights, nearest-light budgets and signal/AI agreement. The Node run passes 140 registered cases plus seven standalone expansion checks. All 19 core browser checks and the world, coherence, flight, metro, vehicle and frontier suites pass, including both story routes, mobile controls, fullscreen and audio. The About suite passes on the range-aware preview server, including actual decoded video seeking. Performance comparison details are recorded separately under `docs/performance/`.
