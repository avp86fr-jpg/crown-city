# Crown City implementation and verification

## Current scope

The illustrated overhead camera and original collision/world layout are retained. The game now combines six narrative jobs, three repeatable crew contracts, three weapon behaviors, stamina/roll/cover mechanics, vehicle workshops and post-story free roam.

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

The new atlases provide cars, Chaos and civilian/police art. Runtime effects add steering, suspension, rain wipers, entry/exit doors, recoil, breathing, dodges and falls. Cached street furniture, pavement detail and roof equipment enrich the existing painted world; quality tiers bound crowd/traffic budgets and roof detail. Roof transparency improves on-foot readability. Existing motorcycles, boats and utility vehicles are retained.

Three original arranged Ogg radio tracks stream after audio unlock. Stations and high-intensity pursuit crossfade through the existing master/music buses, with dialogue/menu ducking and synthesized fallback. Their provenance and character reference links are recorded in [the reference notes](character-references.md).

Story art remains deferred, tile requests coalesce and missing tiles back off. Navigation work is bounded by simulation ticks. Menu scenes reuse a frozen world. Adaptive resolution changes happen before rendering to avoid a cleared/black frame. Focus loss releases inputs and pauses play. Corrupt settings, unsupported audio and blocked save storage are handled without preventing gameplay.

## Verification and limits

43 Node tests and 13 real Chromium checks pass. Run `npm test`, `npm run check` and `npm run test:browser` against a served copy. Node regressions include real collision data, reachable mission anchors, physically driven racing, campaign branches, archive interruption, actual bullet damage to the convoy, contract payments, workshop requirements, stamina/cover/roll behavior and save migration.

Real Chromium checks include keyboard and emulated multi-touch controls, magazine/reload/roll/crew controls, menus at 1280×720, 844×390, 390×844 and 667×375, saves/contract guidance, both six-job choice routes, post-story free roam, adaptive-resolution rendering, actual streamed station/pursuit playback and master muting. Browser exceptions and failed asset requests fail the suite. Browser campaign travel is repositioned between most objectives; racing uses actual physics and road collision.

A scripted normal-frame-loop capture demonstrates driving, firing, rolling, city animation and actual mixed audio. It is not a manually completed campaign. Physical phones, Safari, subjective listening/art review and a full manually driven campaign remain unverified; no device performance benchmark is claimed.

Production is unchanged until the source pull request is merged/published.
