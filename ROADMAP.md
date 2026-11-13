# Crown City — improvement roadmap

Prioritised by impact per effort. Impact and effort are H / M / L. Sources: passes 3–6
(metrics, contact sheets, bot playthroughs of the story, NINETY SECONDS and free roam)
and the pass 6 live check. Status is updated per pass.

| # | Item | Impact | Effort | Why | Status |
|---|------|--------|--------|-----|--------|
| 1 | Mobile fps benchmark fix | M | L | `perf.cjs mobile` reports 300–550 fps because the low-quality mobile path was never actually rendering in the probe; we have no real mobile number to protect. | done (pass 7: frame sync + 6× CPU throttle) |
| 2 | Stunt ramps | H | M | Open world has caches, traps and fares but nothing to *do* with a fast car; jumps are the classic reward loop and the map has long straights. | done (pass 7: 10 ramps, open ground only) |
| 3 | Open-world onboarding + progress | H | L | Caches, speed traps and taxi fares exist but nothing tells the player; first-time hints and a progress line make them discoverable. | done (pass 7: hints + CITY LIFE in pause) |
| 4 | Repaint weakest vehicles (bus first) | M | L | The bus reads as a plain cream box next to the painted cars; van and stitch are flat too. | partial (pass 7: bus livery; van/stitch open) |
| 5 | Gridlock on the Strip and downtown | H | H | 2–3 genuine gridlocks per 40 s at peak and ~12 cars stopped >20 s downtown (mostly lights). Needs junction-level fixes (turn-box blocking, median U-turns), not more relief. | open |
| 6 | Landmarks, props, filling empty areas | H | H | Districts still share the same roofs and kerb furniture; outskirts and the east grid have empty lots. Needs baked art (bake:world) per district: a landmark each, props, plaza dressing. | open |
| 7 | Cop and combat depth | H | M | Pursuit, flanking, roadblocks and foot cops exist; missing: spike strips, PIT manoeuvres, cover-aware foot cops, heli spotlight search, surrender/bust choice. | open |
| 8 | Economy sinks | M | L | Chips pile up after the story (8k+ by mission 6). Add property/safehouse buys, cosmetic resprays, garage slots. | partial (pass 7: paint job 300) |
| 9 | More painted walk frames and clothing shapes | M | M | Crowd uses four keys per direction and 12 looks; dresses/skirts added, but coats, hats variety and a run cycle for civilians are missing. | open |
| 10 | Sea and explosions | M | M | Sea at normal zoom is mostly a static texture with swell; explosions lack debris chunks, scorch decals that persist and a shock ring on the water. | open |
| 11 | Chaos sprite polish | M | M | Hero is the most-seen sprite: walk frames are fine but coat motion, aim pose and hit reactions are stiff. Keep white helm, red visor mark, purple coat. | open |
| 12 | Audio and music variety | M | M | Few stations and loops repeat inside 10 minutes; ambient beds per district (harbour gulls, casino murmur) would carry the new life. Original audio only. | open |
| 13 | Onboarding and tutorial | H | M | First mission explains driving but not the phone/crew board, workshop, heat, or free roam activities; mobile players miss the controls. | partial (item 3) |
| 14 | Save and progression | M | M | Story save and free-ride save are separate; open-world progress has its own key; no stats page, no 100% tracker. One profile with a stats screen. | open |
| 15 | Night fps on desktop | L | M | 44–49 fps headless at night; mostly the light map. | open |

Notes
- Bot "STUCK" entries in the story run were bot limits (boat exit, wrong-way jam), not game blockers; the marina hint was clarified in pass 6.
- Metrics harness: `cc_work/aimetrics.cjs` (stuck, gridlock excluding light queues, cars on screen, ped strays, reversals).
