# Canals, casino and mobility

This pass keeps the illustrated overhead view and original character portraits. The new trailer, its music, and the entire `about/` page are unchanged.

## A connected, readable world

The canal now meets the southern river through visible water. Its old collision override allowed boats across strips drawn as dry pavement. Dock collision follows the exact pier rectangles; the southern endpoint no longer extends the canal onto land. Nine canal bridges have walkable verges, and bridge lane markings continue the roads they carry. Road decks remain above boats, with clearance obstacles for low aircraft.

County gateways, wharf labels, mooring details, navigation buoys and border markers clarify routes and limits. The world boundary checks the full rotated vehicle hull. Beyond the boundary, cached woodland, desert, rock and water scenery replaces empty black space. This is a backdrop beyond a fixed playable border, not an extension of the map.

## Play, drive and travel

The MetaWin terrace has a playable blackjack table. Approach the marked table on foot and press **E / PLAY**, or tap **PLAY** on a phone. Stakes are 20, 50 or 100 game chips. Hit, stand and first-hand double are supported; blackjack pays 3:2 and the dealer stands on every 17. A live hand, its deck and the deducted wager save together. Reloading resumes that hand; leaving stands and settles it once. Story and Free Ride retain separate saves. This table complements the Gold Mage mission.

In cars, **hold BRAKE to stop, pause briefly, then reverse**. Release it to restore forward-stick driving. Reverse has a lower speed cap and white lamps; motorcycles and boats keep stop-only brake pedals. Glancing vehicle contacts conserve momentum while dissipating sideways motion, with lower bounce for boats. Terrain and border contacts still use swept movement and full oriented bodies.

Five flyable planes occupy numbered airport stands with individual liveries. Wider paved taxiway links, hold-short lines and service-lane markings match their hulls. Planes taxi at limited speed off the runway, turn more tightly on the ground and take off along the runway. Occupied stands defer respawning until clear. Aircraft liveries and identities survive saves.

Regional station platforms now fit all three carriages. Doors open toward the correct platform on every carriage; arrival boards follow the actual timetable. Street entrances and roads remain below the elevated platforms. Journey scenery is cached, and sliding-door artwork uses the correct image regions.

## Sound and rendering

Canal ambience samples east and west as well as north and south. Nearby traffic and people determine the sound mix. Material footsteps, card/chip sounds, train movement, station cues and a restrained reverse whine improve feedback. Aircraft blade modulation runs at audio rate instead of aliasing through the game update loop. Pause fades weather and vehicle loops; SFX and master mute also silence reverb. A departing siren cannot send invalid values into Web Audio.

Rendering reuses spatial queries and tile descriptors, culls exact offscreen building/tree bounds and skips sorting warmed tile queues. Roof textures retain their resolution within a 12 MiB cache. Wider mobile tile caches shrink after zooming in. Aircraft bodies, platforms and journey backgrounds are cached; rotors, doors and damage remain animated. Rooftop equipment and neon use the same capped projection as their roofs.

## Verification

All 235 unit tests pass. The regression suite covers actual world geometry, vehicle physics, aircraft clearance/taxiing, station doors, casino settlements and save restoration. Chromium checks exercise real keyboard and touch controls, cold/warm mobile startup, context restoration, orientation, full-screen mode, missions, boat routes, trains, aircraft and audio. `npm run test:mobility` runs the new casino touch/reload checks; `npm run test:soundscape` runs live Web Audio validation.

The first four-second sample showed a regional-station slowdown. A cache review found no repeated tile/platform rebuilds. A longer back-to-back comparison used eight seconds per location, an 844×390 touch viewport, DPR 2, 4× CPU throttling, Performance quality and automatic resolution disabled. Tests and other browser captures were stopped. Both sets of measurements are retained in the [raw comparison](performance/mobility-comparison.json).

| Scene | Before FPS | After FPS | Before p95 callback | After p95 callback |
| --- | ---: | ---: | ---: | ---: |
| Boulevard | 45.4 | 44.3 | 15.1 ms | 18.3 ms |
| Regional | 51.5 | 52.0 | 9.2 ms | 7.4 ms |
| Forest | 58.4 | 59.3 | 7.3 ms | 5.0 ms |
| Airfield | 41.9 | 40.7 | 46.3 ms | 27.7 ms |

The longer samples show reduced high-percentile work at the regional station, forest and airfield, with broadly similar average frame rates. Downtown p95 is worse in this sample. Changed audio random-number consumption and the additional aircraft produce different actor populations; these are not identical simulation replays. The measured rendering improvements therefore do not establish a uniform FPS gain.

On an identical world/camera, building/tree image calls fell from 54 to 16 in Midtown and 72 to 39 in Pinewatch by excluding offscreen geometry. These counts cover those render passes, not all frame work. Live Web Audio checks found 17 reused persistent sources, completed one-shots returning to zero active voices and exact silence under master mute.

Physical Redmi Note testing remains necessary. Busy downtown traffic and new scenery during longer flights remain the clearest performance targets. Trains use scheduled travel and an animated journey scene; airport planes are flyable props, not a scheduled airline simulation. County boundaries remain explicit, and blackjack currently supports one player table without splitting or insurance.
