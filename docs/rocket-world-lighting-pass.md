# Explosive combat, street load and lighting review

The Crown RPG is the fourth weapon (Q or WEAPON). It fires on foot, reloads one round in 2.8 seconds, and uses the same save and ammunition rules as the existing guns. Rockets sweep the whole movement segment against scenery, vehicle hulls and pedestrians. Blast damage falls with distance, respects building cover and bridge/water layers, and can hurt Chaos. Vehicle chain reactions use the existing engine-fire fuse.

Explosions use cached textured fire/smoke paintings, ground marks, shock rings and debris. Performance mode retains at most 8 burst effects, 16 ground marks and 8 rockets. Effects expire using simulation time. Launch and explosion audio use reusable PCM buffers with the existing 12-voice ceiling and positional explosion attenuation. High-speed runovers leave short directional blood smears and tyre marks. Full/Reduced/Off preferences remain available; blood pools, particles and tyre emitters remain bounded. Cosmetic blood randomness is separate from simulation randomness.

Far stationary pedestrians cache their ground eligibility; moving pedestrians and replaced surface queries invalidate it. Crossing and live collision checks remain active. Traffic now lowers district demand by up to 20% after sustained widespread queues, then restores it slowly after circulation recovers. Only eligible offscreen ambient cars retire. The four-minute full-world traffic regression improved from 46.9% moving to 63.6% in the final minute; maximum continuous stop fell from 51 to 39 seconds. These are results for a seeded scenario, not a general speedup claim.

Mobile nights have a stronger continuous ambient tint, weather-responsive paired headlights, boat navigation lights, and police beacons that require an active siren. Reduced-motion mode uses steady mobile emergency lights. Fog and sand have lightweight ambient washes. Desktop daylight shadows soften in overcast weather, and offscreen blast lights skip drawing. Bike riders have cached helmet, visor, jacket, glove, knee and boot artwork; the launcher has its own proportioned tube, sight, grip and muzzle.

Validation:

- 360 Node tests pass, including blast cover, low-frame-rate swept hits, delayed chain reactions, old save compatibility, reloads, recovery cleanup, long-running effect budgets, pedestrian cache invalidation, congestion hysteresis and continuous day/night transitions.
- 20 primary Chromium gameplay checks pass, including both full campaign branches, mobile resolution changes, audio and save separation.
- Additional Chromium checks cover cold/warm mobile startup, canvas recovery, all dialogue layouts, baked terrain streaming, blood preferences, actual touch weapon cycling, rocket impacts and four lighting conditions.
- Map audit: 307 road edges, 141 parked vehicles and 22,340 hull samples. Visual captures reviewed 13 authored locations in both mobile and desktop renderers, including the canal, casino, airport, station, forest, desert, mountain, circuit and paddock.
- Mobile scenery regenerated; its existing artwork remains byte-identical and its source fingerprint is current. NFT portrait assets and trailer files were not changed.

`node tools/sustained-profile.cjs rocket-night URL 360 4 rockets` exercises real RAF timing, repeated rocket fire, district streaming and an advancing day/night cycle on an 844×390 DPR-2 touch viewport with 4× CPU throttling. Its JSON output records rolling frame times, heap, population, active effects, sound voices and renderer caches. This is browser emulation, not a physical Redmi Note thermal/GPU measurement; cold streaming can still cause short spikes. The pull request records the release run results.
