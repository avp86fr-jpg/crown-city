# Final experience pass

This release polishes the existing world, campaign, traffic and audio. It preserves the overhead illustrated style, original NFT portraits and existing trailer.

## World and graphics

Forest floors now read as ground beneath the tree canopy. Mountain terrain uses quieter weathered stone, natural surface variation and roadside delineators. Decoration is aligned to world coordinates across streamed tiles and avoids road/court collision cells. These changes are baked into static scenery; they add no live particle layer or full-screen lighting pass. Mobile terrain is regenerated from the same sources as desktop.

Mobile streaming prepares one upcoming terrain sheet along the vehicle's path once the visible terrain is ready. It uses the existing spare cache slot and two-request ceiling. Ready terrain also avoids repeated distance sorting. This targets district transitions without increasing the decoded-image budget; it does not guarantee that image decoding never stalls.

## Missions and player mechanics

- Casing objectives require Chaos to stop and lower his weapon. Leaving a transfer, firing or becoming airborne cancels its interaction; returning requires a fresh interaction.
- Witness pickup and delivery require an intact road car, no gunfire and no wanted heat. Hovering aircraft and destroyed vehicles cannot complete them. Flying does not earn road-driving bonuses.
- The loud archive route now acknowledges the alarm, with its own dialogue and the correct Palace setting. Circuit contract guidance derives from the current sector, so a custom map waypoint cannot redirect its mission target.
- Circuit wrecks retire only after 90 seconds and out of view. Replacements wait for an unseen, clear grid position, preserving activity without vehicles appearing in front of the player.
- Dismounting checks neighboring vehicle hulls as well as terrain. Rear exits account for vehicle length and rotation; blocked exits leave the driver inside. Boat fallback uses the bank already checked for docking distance.
- Restoring a police-car save preserves wanted heat and the jammer timer. It no longer repeats the theft crime or ejects another driver. Actual theft still produces the normal consequences.

## AI and sound

Pedestrians account for parked queues and wrecks before crossing. Buses service shelters on their curb side, outside a turn and from the outer lane. Wrecked sirens no longer suppress nearby traffic speed. Ground wildlife avoids vehicle hulls while airborne birds retain flight freedom. Conversation partners clear their activity state when interrupted.

Opposing canal boats previously stopped nose-to-nose indefinitely. They now choose a shallow starboard passing line early, align with canal lanes after turns, and brake according to projected hull width. The new one-minute physical test completes at least three opposing passes without contact, beaching or damage. All seven new AI regressions were also run against the previous release and failed there, confirming the original behaviors.

Opening a map or menu ducks the current recording rather than retuning the radio or pursuit music. During a slow track load, the outgoing recording bridges the transition without enabling a second synthesized score over it. Failed playback backs off, stalled transitions eventually yield to fallback, and music mute survives visibility changes and later unlocks. Reverse engine pitch uses one continuous gear, including mobile brake-to-reverse. Rolling no longer produces walking footsteps.

## Review limits

Validation uses the repository's collision map and actual game physics, Node regressions, Chromium gameplay suites, visual captures and a sustained mobile-emulation run. Campaign automation drives the circuit but repositions between other objectives; it is not a completely manual playthrough. CPU-throttled Chromium cannot establish Redmi Note thermal behavior or sustained hardware frame rate. First-time decoding and dense physical queues remain performance risks worth observing in actual play.
