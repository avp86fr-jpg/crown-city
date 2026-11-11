# World layout, traffic flow and physical feedback

This pass addresses disconnected road routes, cars parked in active lanes, overlapping buildings and intersections that eventually stopped circulating. It keeps the illustrated overhead view and original character portraits.

## Layout and presentation

District blocks are derived from the roads that actually border them. Previously, projected coordinates from unrelated streets subdivided blocks into overlapping fragments. Buildings now have setbacks, smaller roof projections and coordinated materials within each block. Courtyards have entrances; industrial plots reserve loading courts instead of filling every corner with warehouses.

Parking is planned after the canal, airport, scenery and transit clearances. Full-size bays share an aisle and a checked driveway to the street. Seeded vehicles must fit their complete oriented hull, avoid other vehicles and pass a 5×5 surface check with an eight-unit margin. This includes the mission Riot and police parking: their original corner-only checks missed small roadway intrusions. The parked fleet follows the marked bay orientation, and garage/player mission anchors follow the relocated Riot.

| Generated world audit | Before | After |
| --- | ---: | ---: |
| Building overlaps | 40 | 0 |
| Building–road overlaps | 26 | 0 |
| Planned parked cars on roads | 61 | 0 |

The revised outer world retains 587 buildings in 167 coherent plots. Its 20 usable parking courts contain 102 marked bays, with 88 planned occupied spaces and room for the player. The airport entrance uses a reserved pedestrian space, and village approaches also exclude parking. The audit samples full vehicle hulls along the court driveways and checks tree clearance.

The airport has a terminal and arrivals forecourt; Pinewatch has a supply/lodge court. Repeated fountain squares become a mixture of planted greens and paved plazas. Trees leave water features and access routes clear. T-junctions show their actual arms, stop lines face incoming traffic, and median refuges leave crossings open. Maintained streets have restrained wear, with heavier weathering around docks and industrial yards. Tree canopies and fountain depth are baked into bounded caches.

The map uses one muted palette derived from the actual terrain throughout the world. Removing the separate illustrated core-map overlay also removes a 512,546-byte image request from startup.

## Traffic and physical response

The road graph deduplicates overlapping records and joins short collinear seams. Cars reserve junctions before entry, check whether their exit has room for the whole vehicle and test their actual turning curve. Closely linked junctions share reservations; compatible straight lanes can proceed together, with aged priority for waiting approaches. A waiting cross-lane car no longer blocks a turn merely because it intersects an imaginary straight-ahead ray. Large buses avoid lanes too narrow for their bodies. Gentle queue contacts no longer turn active drivers into permanently abandoned vehicles; nudged parked cars still coast and settle through physics.

Pedestrians keep clearing roads beyond the visible simulation budget. They finish crossings without random idle pauses, seek a real opposite verge and recover toward a sidewalk after fleeing. Traffic uses vehicle and pedestrian dimensions rather than a broad proximity radius, so parallel sidewalk walkers do not freeze an adjacent lane. Spawn spacing reduces bunching. Ambulances retain their lane routes instead of driving directly through blocks toward casualties; service stops last eight seconds and unresolved responses expire after 75 seconds.

Bodywork, concrete and boat-hull impacts have different severity-dependent sounds, stereo position and distance falloff. Per-body and global retrigger limits prevent a resting collision from producing a barrage of impact sounds. Rolling noise varies with surface and wetness. Boats use continuous propeller load and wake noise; their damage artwork and lights no longer inherit car-specific details. Sound variations reuse a bounded PCM bank.

## Validation and limits

All 186 Node regression checks across 22 files pass, including new layout, parking, impact-feedback, junction-paint and traffic-soak checks. The new traffic tests include sixteen queued cars clearing a four-way signal without overlaps, blocked-exit recovery and pedestrians turning away from walls. Nineteen core Chromium checks pass; additional browser suites cover mobile startup, streaming, boating, aircraft, rail, weather and sound.

Deterministic traffic measurements use a stationary player on a sidewalk and the actual road graph:

| Scenario | Moving samples late in run | Longest stopped car | Longest stopped during a turn |
| --- | ---: | ---: | ---: |
| Five minutes, 34 cars, isolated traffic | 55.7% | 41 s | 0 s |
| Four minutes, 54 cars, complete game physics/AI | 37.5% | 137 s | 44 s |

The isolated run has zero vehicle overlaps. The complete run includes parked cars, pedestrians, emergency responses and collision physics. It no longer collapses into the original permanent network standstill, but **long queues remain at maximum population**: 11.3% of its final-minute vehicle samples had been stationary for over 45 seconds. Population was not reduced to conceal this. Congestion-aware routing and better coordination between continuous pedestrian flows and turning traffic remain useful follow-up work.

The initial AI revision increased downtown simulation cost. Caching static curb geometry by exact position/heading and rejecting distant bodies before narrow collision checks reduced repeated work without changing deterministic traffic outcomes. The final paired profile uses an 844×390 touch viewport, DPR 2, 4× CPU throttling, Performance quality and automatic resolution disabled. Each warmed scenario samples four seconds; tests and other browser captures were stopped during profiling.

| Mobile-emulation scene | Before FPS | Final FPS | Before p95 callback work | Final p95 callback work |
| --- | ---: | ---: | ---: | ---: |
| Downtown boulevard | 45.7 | 49.9 | 13.3 ms | 12.9 ms |
| Regional road | 45.6 | 51.5 | 12.4 ms | 9.3 ms |
| Forest | 56.5 | 58.6 | 7.9 ms | 6.9 ms |
| Airfield | 39.8 | 56.1 | 27.1 ms | 8.7 ms |

[Raw profiles](performance/worldflow-comparison.json) include the initial intermediate result as well as the optimized build. These are short samples on a shared Linux host; population and actor positions can differ after layout corrections. They cannot establish frame rates or GPU stability on a physical Redmi Note. The simulation remains an arcade open world: player-made obstructions can legitimately produce queues, and automated travel checks do not replace a fully manually driven campaign.

Current in-game captures: [Midtown](previews/worldflow-midtown.jpg), [parking courts](previews/worldflow-court.jpg), [airport arrivals](previews/worldflow-airport.jpg).
