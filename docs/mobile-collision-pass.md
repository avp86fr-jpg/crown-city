# Mobile, collisions and Free Ride

This release keeps the illustrated overhead view and fixes the reported Redmi Note rendering load, altered promotional Gold Mage, doubled-car cover composition and inconsistent impacts.

## Rendering and presentation

Performance mode uses a bounded twelve-tile city cache, precomposing the painted ground, roofs, light accents and street details. Small mobile atlases reduce decoding/resampling costs. The city renders at a maximum 1× pixel density before adaptive resolution; the HUD stays at up to 2×. On touch devices, separate transparent HUD and city canvases let Chrome composite the layers. Menus freeze the city, and the static title cover no longer simulates traffic behind it. Effects are bounded; props, pickups, people, traffic, boats, weapon tracers and pursuit helicopters remain visible. Richer lighting stays available in Balanced/Quality. Water now fills the view beyond the northern map edge.

The corrected title/About cover contains one complete red coupe beside Chaos. Gold Mage is absent from generated cover art; the original portrait file is unchanged and loads directly in the About crew card. Trailer title cards/poster, social card and gameplay screenshots were refreshed. The 31.1-second trailer is 1280×720 H.264 with 48 kHz stereo AAC and the original Afterhours arrangement.

## Mechanics

- Oriented vehicle bodies follow vehicle/bike/boat dimensions. Spatial indexing bounds contact pairing. Mass-based separation checks terrain before pushing a vehicle.
- Driving sweeps the full hull in short steps; boats reject land and piers. Spawn/resume positions search for hull clearance in water. Boarding has a consistent 104-unit reach on keyboard and touch. Ordinary disembarking requires a nearby reachable bank; destruction permits emergency ejection.
- Shots sweep along their travelled segment and hit the nearest wall, vehicle or character. Citizens can be shot or struck by vehicles, including during dives. Traffic also hits the player on foot, with a short recovery interval. Stationary vehicles block walking; local character circles prevent crowds stacking.
- Cornering assistance reduces excessive speed through hard turns. The stock Riot still completes the real two-lap course with collision enabled.
- FREE RIDE starts immediately with a separate save slot. It never advances campaign objectives. Resume retains its cash, vehicles, upgrades and contracts while story progress stays in the original slot. Legacy story saves remain supported.
- Low Tide is the sixth repeatable crew contract: collect a dock manifest on foot, hold a boat at an offshore buoy to upload it, then return the original on foot. Its three stages and marker survive saving. Crew debriefs connect the witness, receipts and harbour jobs to the Palace archive story.

## Audio

Midnight Receipts adds an original noir arrangement for walking and menus. Three driving/pursuit stations remain. Inactive tracks pause; crossfades use at most two media streams. Hidden pages pause streams and suspend audio. Ogg/MP3 variants support different browsers. A reusable PCM effects bank supplies distinct weapon reports, reloads, impacts and water sounds, with twelve concurrent voices and node cleanup.

## Measurement and checks

`tools/mobile-profile.cjs LABEL [URL]` records the same night-driving workload at 844×390 CSS pixels, DPR 2 and 4× CDP CPU throttling. Audio is warmed before measurement and automatic resolution is disabled. The recorded baseline was the previous published commit `be56a60`. Smoothed render cost fell from **156.0 ms to 59.6 ms**, about **62% lower**; the UI remained 1688×780. Simulation cost increased from 10.5 to 14.8 ms with stronger collision checks. Raw comparison metadata is in [performance/mobile-comparison.json](performance/mobile-comparison.json). This headless software-rendered benchmark is not a physical Redmi Note frame-rate claim; traffic is stochastic and these short samples do not establish a sustained device FPS.

Validation includes the Node world/physics/mission suites and nine new collision/mode regressions, both campaign choice routes and their physical race, real Chromium keyboard/multi-touch/fullscreen checks, layer/quality/orientation transitions, soundtrack playback and muting, separate story/Free Ride saves, and About video/audio/caption/gallery/responsive checks. Browser travel between most story objectives is repositioned. Physical-phone and Safari checks remain unperformed.
