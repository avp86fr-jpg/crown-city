# Crown City implementation and verification

## Current scope

The illustrated overhead camera and original collision/world layout are retained. The game now combines six narrative jobs, five repeatable crew contracts, three weapon behaviors, stamina/roll/cover mechanics, vehicle workshops and post-story free roam.

| Job | Mechanics and stakes |
| --- | --- |
| Cold Wallet | Disable the convoy van with weapon or collision damage, then deliberately collect the archive key. |
| Burning Bridges | Win two ordered laps against Fire; a stock Riot can win. Defeat returns to a retry. |
| Dead Air | Pay/defer the blackout fee, steal the Metro scrambler and deliver it without heat. |
| The Inside Line | Scout two reachable Palace locations on foot while stationary; choose quiet/loud entry. |
| House of Glass | Loud entry attracts police immediately; start a stationary three-second archive transfer, then escape to the reserved boat. Movement or shooting interrupts the transfer. |
| Exit Wounds | Return to the marina for the Nyx, carry the evidence to the highway and lose pursuit. The ledger choice changes the ending. |

The original screenplay in `src/screenplay.js` gives the crew personal motives, connects the jobs to Southside's forged debts and ties the finale to Chaos's erased history. Dialogue and encrypted radio messages follow mission state. The events are fictional adaptations, not NFT lore claims.

## Action and economy

The .45, SMG and shotgun have distinct capacity, rate, spread and damage; magazines reload on empty or X. Sprinting consumes stamina, rolls cost a fixed amount and have a cooldown, stationary cover reduces incoming damage, and part of the roll avoids bullets. These remain arcade mechanics: there is no separate reserve-ammo inventory or skeletal/3D character system.

Crew work includes a timed clean-heat courier delivery, a marked pickup followed by a two-star escape, and a timed drift-points challenge. Completion pays once and earns reputation. Contracts and their remaining time persist in saves; personal/contract waypoints remain separate from the gold mission marker.

Workshops charge chips for repairs, respray/heat removal, health/magazine supplies and three tuning stages. Vehicle and line-of-sight requirements prevent remote repair/instant escape. Tuning derives from stock definitions so repeated entry cannot compound it or alter NPC vehicle definitions. Checkpoint/save restoration can roll it back. KEEP DRIVING enables saved free roam after the final story scene.

## Presentation and loading

The new atlases provide cars, Chaos and civilian/police art. Runtime effects add steering, suspension, rain wipers, entry/exit doors, recoil, breathing, dodges and falls. Cached street furniture, pavement detail and roof equipment enrich the existing painted world; quality tiers bound crowd/traffic budgets and roof detail. Roof transparency improves on-foot readability. A companion atlas replaces the bus, ambulance, armored courier van, sport bike, cruiser and speedboat. Aiming layers keep stepping legs active, reloads have visible hand movement, and bike riders are drawn while occupied.

Three original arranged Ogg radio tracks stream after audio unlock. Stations and high-intensity pursuit crossfade through the existing master/music buses, with dialogue/menu ducking and synthesized fallback. Their provenance and character reference links are recorded in [the reference notes](character-references.md).

Story art remains deferred, tile requests coalesce and missing tiles back off. Navigation work is bounded by simulation ticks. Menu scenes reuse a frozen world. Adaptive resolution changes happen before rendering to avoid a cleared/black frame. Focus loss releases inputs and pauses play. Corrupt settings, unsupported audio and blocked save storage are handled without preventing gameplay.

## Verification and limits

73 Node tests and 17 real Chromium checks pass. Run `npm test`, `npm run check` and `npm run test:browser` against a served copy. Node regressions include real collision data, reachable mission anchors, physically driven racing, campaign branches, archive interruption, actual bullet damage to the convoy, contract payments, workshop requirements, stamina/cover/roll behavior and save migration.

Real Chromium checks include keyboard and emulated multi-touch controls, magazine/reload/roll/crew controls, menus at 1280×720, 844×390, 390×844 and 667×375, saves/contract guidance, both six-job choice routes, post-story free roam, adaptive-resolution rendering, actual streamed station/pursuit playback and master muting. Browser exceptions and failed asset requests fail the suite. Browser campaign travel is repositioned between most objectives; racing uses actual physics and road collision.

A scripted normal-frame-loop capture demonstrates driving, firing, rolling, city animation and actual mixed audio. It is not a manually completed campaign. Physical phones, Safari, subjective listening and a full manually driven campaign remain unverified; no device performance benchmark is claimed.

## Astra-assisted second pass

Astra implemented the city AI and optional mission director, wrote their behavioral tests, and reviewed the final integration. The city now schedules finite café/market/newsstand visits, reserves distinct queue positions, pairs conversations, reacts to approaching traffic/sirens/gunfire and boards waiting residents onto buses stopped at actual shelters. Traffic courtesy uses local spatial indexes. Decisions run at a lower frequency than movement; quality tiers reduce decision/index work.

Two additional crew jobs are available on the second crew-board page: Hunter's stopped-car witness pickup, two-star escape and safe garage delivery; Vera's three ordered on-foot evidence holds and final upload at Neural's loft. Blue routes persist across campaign transitions. Optional campaign bonuses track player-attributed civilian harm, collisions, shot counts, continuous driving distance and quiet Palace security exposure. Job journals preserve times and earned bonuses. Completion pays once per campaign job; instant objective jumps cannot earn clean-driving distance. Player-triggered explosion chains count as collateral; NPC-triggered explosions do not.

The mobile HUD is arranged around the thumb areas. Fire is a second directional stick, independent from movement. Control size, opacity, left-handed layout, vibration, aim assist and tips are configurable and persisted. Settings use three tabs; briefings and the dossier explain the current story and crew goals. The fullscreen button and F run directly within browser activation; entry and exit pass actual Chromium tests. Ordinary game taps do not force fullscreen or rotation. The fullscreen control is hidden on overlay menus that already expose navigation, preventing it from covering map buttons.

World rendering can use a lower-resolution offscreen canvas while the UI stays sharp at up to 2× device pixel density. Offscreen buffers clear every frame, including while tiles load. Population spawning uses world viewport dimensions rather than device pixels. Battery Saver limits presentation to 30 fps while fixed simulation steps continue; hidden tabs skip rendering and suspend audio. Procedural ground and road-detail caches have explicit limits. Eleven obsolete crowd requests (1,593,130 compressed bytes) were removed from boot; the new fleet atlas adds a single request.

The Chromium battery sample used a 390×844 emulated phone: the UI remained 780 pixels wide while the world rendered at 314 pixels. During a 1.2-second sample, 18 frames were presented and 62 simulation ticks ran. This validates independent cadence in the shared test environment, not a physical-device FPS guarantee. A scripted live capture observed 20 conversations and 19 venue visits, with no browser errors. Screenshots were visually reviewed. New checks cover real fullscreen gestures, directional multi-touch, saved control preferences, expanded menus, both campaign routes, sharp UI during automatic resolution changes, battery mode and audio playback/muting.

[Latest scripted gameplay with mixed audio](previews/afterhours-preview.mp4) · [City](previews/afterhours-city.webp) · [Mobile HUD](previews/afterhours-mobile.webp) · [Title](previews/afterhours-title.webp)

Production is unchanged until the source pull request is merged/published.
