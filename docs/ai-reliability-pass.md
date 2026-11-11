# Street AI, starting area and recovery

The main weakness was disagreement between systems. Traffic advanced a route coordinate even when physics moved the body elsewhere; pedestrians treated some crosswalk paint as a place to stand; the garage car was placed by a radial search instead of a designed driveway. More decorative detail would not fix those behaviours.

## Changes

- Traffic commits route progress only after testing the complete oriented body against terrain, vehicles and people. Small collision corrections ease back into the route; substantial crashes still hand the vehicle to physics. Very light contacts no longer unpark an entire row of cars.
- Drivers check the adjacent lane and signal before passing a stationary obstruction. The merge follows a smooth path, checks the rear gap and remains subject to body clearance. Drivers still wait when there is no safe passing lane.
- Narrow coast roads use one lane per direction. Their previous two-lane assignment left less room than a car body and made the diagonal coastal connector reject its own exit.
- Dead-end turns begin before the road cap and use matching entry/exit tangents. Ambient routing excludes spurs with no physically valid turnaround. Those roads remain accessible to the player.
- Crosswalk paint inside a marked roadway is classified as road. Pedestrians clear crossings before socialising. A resident obstructing a stopped driver steps aside instead of mutually waiting.
- Walkers and venue visitors share obstacle steering, retain a passing side, avoid parked bodies and allow personal space. Spawn candidates reject buildings and vehicles. A redundant player-only panic rule no longer makes safe sidewalk residents dive.
- Cruisers brake for other vehicles and stay put while officers are outside. Returning officers steer around obstacles. An empty cruiser no longer fires while its crew is deployed.
- Chaos walks at up to 76 world units/second instead of 110. Full joystick deflection no longer automatically sprints at 175. RUN/Shift explicitly selects a 136-unit sprint; partial stick movement is proportional.
- Hunter Garage has an authored courtyard, reserved Riot bay, spare-car bay, foot spawn and a checked driveway. Metro Police has a named building, clear entrance and two marked cruiser spaces. Their visible geometry and collision share the same dimensions.
- Busted clears the chase and releases Chaos at the police entrance, then saves that position. Campaign progress remains intact.
- Three MetaWin terrace slot cabinets are playable on foot. Stakes are 10/25/50 game chips. Reels stop individually, reduced motion shortens the reveal, and the displayed paytable covers pairs and triples. A spin's stake and outcome are saved before the animation; leaving or reloading cannot reroll or pay twice.

## Remaining weaknesses and next focus

The largest remaining quality gap is the city between authored locations. Procedural blocks repeat, some old painted details do not communicate their function, and short sightlines can make the route hard to read. A focused district pass should author block-by-block entrances, service alleys, crossings and vehicle access using shared geometry, starting with Southside and the Strip.

Pedestrians now avoid local obstacles, but still use a local planner and venue visits rather than a connected sidewalk itinerary. The next AI improvement should be a sidewalk/crossing graph with destinations and persistent daily routines. Single-lane roads can still queue behind an abandoned player vehicle; a visible towing/incident response would make that situation feel intentional.

Police pursuit remains arcade-oriented. Crew deployment is more coherent, but searches, perimeter positions, witnesses and escalation would benefit from explicit shared states. Mission variety and consequences need a separate authored gameplay pass after street navigation is dependable.

Mobile checks use desktop Chromium with touch and CPU throttling. They can expose regressions, but are not measurements on a physical Redmi Note. No blanket device-FPS guarantee is implied.

The About page, new trailer, music files and original NFT portraits are unchanged by this pass.

## Validation

- 250 Node tests passed, including actual world collision, mission/save recovery, parked-car physics, local avoidance, lane changes, casino persistence and responsive layouts.
- The three-minute blocked-lane test uses the real collision solver: eight queued cars do not overlap or move the parked obstacle, and resume when it leaves.
- Five-minute isolated road-graph soak: 62.0% moving in final samples, longest turn stop 15 seconds. Four-minute full simulation: 48.0% moving in final samples, longest turn stop 27 seconds. Traffic still queues: the longest overall full-world stop was 76 seconds, and 1.0% of final samples had waited more than 45 seconds.
- 19 core Chromium browser checks passed, including both story branches, Chrome fullscreen, saves, audio, touch controls, quality changes and rotation.
- Mobile startup/context-recovery checks passed. New real-touch tests verify slot entry/spin/single settlement, portrait controls, two marked police cruisers and police release persistence after reload. Existing blackjack touch/save checks passed.
- Source syntax, whitespace and immutable-bundle build checks passed.

## Mobile performance review

The local planner now reuses vehicle/person candidates across its steering probes, and reuses the candidate arrays. Hub artwork is composed once per location. Traffic and population budgets were not lowered to obtain the measurements. Wrecks remain obstacles in the pedestrian index without triggering threat reactions.

The same 844×390 touch viewport, DPR 2, low quality and 4× Chromium CPU throttle were used sequentially. Each scenario sampled four seconds of real touch-driven play. This is a constrained desktop comparison, not a phone benchmark.

| Scenario | Published build FPS, two runs | Release sample FPS | Release callback work, median / p95 |
| --- | ---: | ---: | ---: |
| Boulevard | 36.6–40.8 | 36.7 | 8.4 / 27.2 ms |
| Regional station | 48.4–49.4 | 43.4 | 5.7 / 9.6 ms |
| Forest | 53.3–57.2 | 56.7 | 3.8 / 7.7 ms |
| Airfield | 43.5–44.6 | 47.6 | 5.5 / 12.2 ms |

Results are mixed. The dense boulevard still has limited frame-time headroom; the regional sample is slower. The airfield sample improves, and the forest remains within baseline variation. Live AI produces different visible actor counts and camera positions, so these short samples cannot isolate every cause. The query cache lowers repeated steering work, but this release is not a blanket frame-rate fix. Profile the dense street/HUD workload on a physical Redmi Note before increasing population or world-detail budgets. [Recorded samples](performance/ai-reliability-comparison.json) include both baselines and the intermediate uncached implementation.
