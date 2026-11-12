# Street life and impact pass

## Combat presentation

Bullet wounds and vehicle impacts now produce directional blood spray. Heavy fatal impacts add small illustrated debris; fading ground stains use a single cached 512 × 96 atlas. Rain washes stains faster. These effects are separate from gameplay collision and use bounded particle pools: Performance allows 48 airborne particles and 32 stains; Balanced/Quality allows 144 and 96. Full, Reduced and Off preferences persist in Display settings. Ground marks avoid water and buildings, and a new game resets the effect state.

Fallen characters ease into a directional pose and no longer retain idle breathing. Civilian silhouettes vary subtly in stature. Performance traffic now draws brake and reverse lamps. Higher-quality car clearcoat highlights share a 16-frame atlas instead of allocating a gradient for every visible vehicle on every frame. Original NFT portraits and the trailer are unchanged.

## Pedestrians and traffic

Fleeing residents check a full-body corridor against terrain, parked hulls and predicted moving traffic. They favor a safe verge, use the same local avoidance as ordinary walkers, and cower briefly when every corridor is blocked. People who encounter a nearby visible casualty react once to that body; weak references avoid keeping removed actors alive. A crossing blocked for longer than a signal cycle prompts a clear route along the curb instead of an indefinite wait in the same place.

Traffic demand varies by district and hour: nightlife and commute periods are busier, rural roads and the early morning quieter. Demand is capped at 125% of the quality preset (30 ambient traffic vehicles on Performance). Spawning selects cached local roads weighted by usable length and lanes, checks braking room ahead and behind, and pauses replenishment when sustained queues affect a substantial fraction of the local population. Reductions retire only unseen, unprotected ambient cars. Player, mission and responding service vehicles remain protected.

## Validation

- 347 Node regressions pass, including real bullet/runover effects, ten simulated minutes of continuous impacts, effect preferences and cleanup, predicted vehicle avoidance, casualty reactions and blocked-crossing recovery.
- The map audit checks 307 graph edges and 22,340 vehicle hull samples with no reported road, surface, parking or overlap errors.
- Seeded four-minute full-game traffic: 57.7% of final samples moving, maximum stop 46 seconds, maximum stop inside a turn 3 seconds, no final persistent jams. The published baseline was 60.3%, 42 seconds and 5 seconds respectively. Denser demand is a tradeoff; this does not claim that every real-world traffic configuration is jam-free.
- Chromium checks cover the mobile and desktop blood layers, both phone settings layouts, touch selection and preference persistence. The new browser regression also runs in GitHub Actions.

All 17 Chromium suites pass, including 20 core gameplay checks, startup/context recovery, terrain fallback, campaign branches, driving, sailing, flying, transit, casino, sound and presentation. The extended `street` profile exercises repeated bullet impacts and changes district every 45 simulation seconds, recording effect pools, traffic demand, heap size and frame intervals. CPU-throttled Chromium cannot establish Redmi Note thermal behavior or its sustained hardware frame rate. Sustained-run results are included in the release pull request.
