# Living-world overhaul

This release improves vehicle identity, street behaviour and city artwork, and adds two optional evidence operations. The illustrated top-down camera and existing campaign remain the basis of the game.

## Driving and traffic

Every road vehicle has its own acceleration curve, terminal speed, steering response, lateral grip, braking and coasting. World velocity survives a change in body heading; tire friction brings it back into line. The Riot is loose and torquey, the Dart grips and changes direction quickly, and the Nyx has the strongest high-speed performance. Heavy vehicles respond slowly. Wet pavement and soft surfaces affect braking and traction. A destroyed engine cannot engage reverse, and damage or releasing boost does not instantly clamp collision momentum.

Civilian traffic uses vehicle-specific acceleration, corner speed and following distance, with persistent driver pace. Cruise targets update on road changes and reflect weather and damage. Drivers brake before entering slower roads. Obstruction passing includes wrecks and predicts approaching cars in the adjacent lane. Buses brake into stops, dwell beside waiting passengers and resume; opposite-direction sirens and empty deployed cruisers no longer stop unrelated lanes. Police steering checks navigation around building corners. Boat captains share a spatial query index and can back out of short clear berths.

## Wildlife and pedestrians

Swept car/bike contacts can injure or kill grounded wildlife, including an animal crossed before a same-frame wall collision stops the vehicle. Raised birds, airborne aircraft and map-recovery teleports do not create false impacts. Blood follows the user's setting. Fallen sprites and effects have finite lifetimes; the original habitat population is reused only out of view. The collision pass is independent of the mobile animation cap.

Pedestrian obstacle candidates refresh at a bounded rate while checking current body positions each movement step. Movement sweeps prevent walking through thin obstacles during catch-up frames.

## City art and rendering

The new six-cell overhead furniture atlas replaces the old sheet without adding runtime image requests. Full sprite footprints are checked against roads, water, parking and other fixtures. The authored placement creates 48 clear furniture settings and 147 storefronts. Residential roofs use hip ridges/chimneys, commercial roofs use solar and access areas, and industrial roofs use skylights and equipment. Static roof artwork is baked; Ultra mode adds a small fan-animation pass, respecting Reduced Motion. Painted core roofs receive no duplicate equipment.

Furniture queries use spatial bins. The minimap scrolls a single small overscanned backdrop instead of redrawing terrain and transit labels every frame; objectives, police and player markers remain live. Warm expanded-world views reuse their scenery plan. Source/version checks, bounded decode concurrency, eviction and failure retry remain in place. Updated core tiles and furniture use versioned URLs so a returning browser requests the new artwork.

## New operations

| Contract | Play | Completion and failure |
| --- | --- | --- |
| Cold Storage — Vera | Load a recorder at Crown Air arrivals, drive to Pinewatch Village and Canal South for two three-second checksums, return to Hunter Garage. | Deliver in a stopped road car with no heat. Impacts and long drifts damage integrity. Destroyed evidence fails without a payout; CREW offers a fresh attempt. |
| Skyline Ghost — Neural | Pick up the receiver on foot, fly three continuous scans at 110–210 altitude and 32–60 knots with level wings. MetaWin triggers pursuit. | Return the plane to the airport runway, stop, then deliver on foot after losing heat. A replacement aircraft must take off before satisfying the return leg. |

The clocks start after pickup. Stage, timer, integrity and flight-return state survive saves. Pending collision damage is settled before saving, including recovery autosaves. Payouts are issued only once at the final validated handoff. Wrecked vehicles cannot satisfy the older canal, ridge, airlift or package-return jobs either.

## Validation

The integrated Node run passed 411 tests. The main built-game Chromium suite passed 20 checks, including both campaign endings. Separate browser suites passed mobile cold/warm startup and context restoration, the two new operations, airplane landing and boat braking, animal impacts/blood settings, nine-location world streaming, baked-world recovery and rocket/day-night rendering. The map audit checked 307 road edges and 141 authored vehicles with no parked obstruction or body-overlap findings.

Automated checks include physical handling comparisons at 30/60/120 Hz, complete circuit laps, obstruction queues, boat manoeuvres, thin-wall pedestrian movement, high-speed animal impacts, effect/population bounds, mission failure/retry/save/payout and scenery-cache recovery. Chromium checks exercise both campaign routes, touch controls, fullscreen, cold/warm startup, context restoration, world streaming, new operation HUDs, animal runovers and mobile aircraft/boat controls.

Mission browser checks reposition between destinations and simulate their mechanics; they are not a claim of a fully manually driven campaign. Sustained browser measurements use Android-style viewport/touch emulation and CPU throttling on this host. They cannot establish frame rate or thermal behaviour on a physical Redmi Note.
