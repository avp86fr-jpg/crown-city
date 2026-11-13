# Mission review

The review covers the six campaign missions and 17 crew contracts, including quiet/loud campaign branches, evidence operations, racing, aircraft, boat and railway jobs. Automated checks exercise progression, interruption, recovery, save restoration and payouts; they do not replace physical-phone playtesting.

## Fixes and clearer instructions

- Low Tide rejects destroyed and zero-health boats during the offshore upload. Its brief now specifies the three-second stop, wanted-state requirement and final on-foot return.
- Night Shift requires stopped handoffs without gunfire. Wrecks, boats and aircraft cannot act as couriers. Its brief explains that the 100-second clock starts after pickup.
- Smoke Signal awards drift points only in a working car, excluding wrecks and motorcycles.
- Convoy guidance no longer promises a fixed number of pistol hits. Quiet-job bonuses say “do not fire” instead of referring to a holster mechanic that does not exist.
- Mission debrief titles use the campaign's canonical titles to prevent future text drift.

## Runtime work

Steady objectives reuse their guidance object instead of allocating one each simulation tick. Palace security scans avoid building a filtered pedestrian list and a combined police list. Contract dispatch uses indexed membership/definition lookups, and expansion jobs no longer calculate a route target simply to identify their job type before calculating it again.

New regressions cover every expansion stage's target, text and save boundary; campaign intros/endings across branch choices; interrupted boat uploads; invalid drift vehicles; courier handoff conditions and single payouts; and guidance reuse. Existing browser suites verify campaign completion, crew operations and portrait/landscape dialogue placement. Static mobile scenery is regenerated to match the release's source fingerprint.
