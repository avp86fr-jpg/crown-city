# Return to Crown: mobile rendering, city AI and story presentation

The reported failure was a black city view with working HUD and controls on Redmi Note / Chrome, cleared by switching quality. The old mobile Performance renderer put the world on a second DOM canvas beneath a transparent HUD. This release removes that compositor dependency: the world and HUD now paint into one opaque visible canvas. The exact physical-phone failure was not reproduced in this environment; the replacement path was tested in Chromium touch emulation.

## Rendering and movement

Performance mode draws directly at 0.75–1× CSS resolution, avoiding a full-frame copy into a high-density canvas. DOM touch controls keep native resolution, while titles and dialogue use up to 2× pixel density. Balanced and Ultra retain their existing richer rendering paths. Canvas restoration clears stale terrain, light and menu caches; tests dispatch restoration events, rather than causing a real GPU reset. Resizing invalidates frozen menu frames.

The build now emits one content-hashed JavaScript module and a versioned stylesheet. This prevents a returning browser from combining cached and fresh game modules across a release. CI rebuilds the committed bundle and rejects a mismatch. Development requires `npm ci`, `npm run build`, and `npm run serve`; deployment remains static, with no runtime packages.

On foot, collision sweeps in small steps and slides only along the requested axes. It no longer invents sideways motion at building corners. Embedded old-save/impact positions recover to a checked safe point. Painted core roofs remain aligned with the city illustration instead of fading as the player approaches an edge. Frontier occlusion remains available.

BRAKE now stops and holds cars and boats, with brake lights on; pulling the stick backwards still selects reverse. Holding BRAKE no longer sends a stationary vehicle backwards.

## City behaviour

- Traffic uses vehicle body length for queue spacing, bounded acceleration/braking, firm red-light stop positions and intersection occupancy. Turn progress follows the curve's actual speed. Wrecked traffic stops following its old route. Spatial buckets are reused.
- Pedestrians wait at the curb for both a signal window and an actual traffic gap. Fleeing people choose an open direction around nearby walls; movement animation reflects distance travelled.
- Boats plan routes with full-hull water clearance, including bridges, slow for other vessels and approaching banks, pass to starboard where clear, and reverse away from piers. All movement still goes through boat physics. Decisions update at roughly six times per second.
- Foot police use a separate walkable navigation field around buildings. Cars slow into turns and probe obstacles. Officers need line of sight to arrest or fire; firing uses explicit cooldowns. Clearing the last star lets officers return to their cruiser and prevents arrests. Stranded officers retire offscreen.
- Wildlife anticipates approaching traffic using the shared local vehicle index. Land animals check body clearance; cats/foxes are less active in daylight. Birds return toward safe habitat in flight instead of teleporting when they would land on water or a wall. Empty-habitat queries are throttled.

These are bounded local behaviours, not a complete traffic simulation. The longer boat regression drives three real harbour vessels for 45 simulated seconds each and checks hull clearance and progress. Foot-police and building-edge tests use both controlled obstacles and the actual world mask.

## Story and audio

Eight new environment paintings frame the story, with location headers, character roles, full original portrait compositions and responsive choice buttons. No NFT portrait was regenerated. Gold Mage's supplied original remains SHA-256 `a21d3e414f5885c2ae84eeed318735c8ad15d8d3d63b5c158e82a5a7a7039a05`.

The skippable 7.5-second opening introduces **Every Debt Has a Name**, then begins Vera's broadcast at the matching in-game time, 11:47 p.m. Reduced Motion proceeds directly to dialogue. The first job now consistently describes the sealed archive key across its briefing, dialogue and objective prompts. A previous three-line dialogue limit is removed; every story speech and choice is checked at 390×844, 844×390 and 320×640.

**Return to Crown** is a new 60-second, 96 BPM arrangement with piano, strings, finger bass, nylon guitar, muted brass and drums. The Ogg export measures about −18.1 LUFS integrated and −1.9 dBTP after encoding. It plays during the opening scenes, lowers for dialogue and resets for a new story. Ogg playback failures retry MP3. Music mute pauses streams; crossfades stay within two streams. Text cues are quieter and rate-limited, sirens pan relative to the camera, and street noise follows local traffic. See the included TimGM attribution/license and `tools/compose-return-to-crown.py`.

The GitHub README and About copy describe the current mechanics and mobile settings. The About story image shows the new dialogue presentation. The existing 44-second Night Dividend trailer and city gallery remain identified as that earlier gameplay capture.

## Performance measurement

`tools/world-profile.cjs` ran the same four scenes against published baseline `8d871f9` and the new direct-canvas rendering path. Both use 844×390 CSS pixels, DPR 2, Performance quality, automatic resolution disabled, actual CDP touch input, 4× CPU throttling, a warm-up and four-second samples.

| Scene | Before FPS | After FPS | Before work p50 / p95 | After work p50 / p95 |
| --- | ---: | ---: | ---: | ---: |
| Boulevard | 25.3 | 42.9 | 10.3 / 19.5 ms | 7.5 / 15.4 ms |
| Regional rail | 40.8 | 42.6 | 4.9 / 9.3 ms | 5.6 / 20.6 ms |
| Forest | 42.6 | 51.3 | 3.8 / 10.1 ms | 4.1 / 13.2 ms |
| Airfield | 28.6 | 41.0 | 8.4 / 46.3 ms | 6.6 / 18.0 ms |

Presented frame rate improved in these samples; CPU callback cost did not improve in every scene. Traffic populations vary, and these short desktop-emulation runs do not establish sustained Redmi performance or a 60 FPS guarantee. Raw results: [before](performance/mobile-ai-before.json), [after](performance/mobile-ai-after.json). Terrain caches stayed within their existing bounds.

## Verification

- `npm run build`, `npm run check`, `npm test`: build, syntax and the 17 Node regression files.
- `npm run test:startup`: fresh default-quality Story, warm saved launch, visible world pixels, simulated context restoration, rotation and all dialogue text/choice layouts.
- `npm run test:story-audio`: real Ogg playback, forced Ogg failure with MP3 recovery, mute/resume and pursuit crossfade.
- `npm run test:browser`: 19 core Chromium checks, including both campaign choice routes, physical race, saves, keyboard/touch controls, fullscreen, quality/menu transitions and audio.
- World, coherence, aircraft, metro, vehicle and frontier browser suites: scenery streaming/recovery, cache bounds, boat and bridge travel, landing, transit time/weather, interaction and mobile controls.
- `npm run test:about`: phone/desktop layouts, images/fonts, gallery navigation/focus, trailer seeking/playback/audio/captions, links and reduced motion.

Browser mission travel is repositioned between many objectives; this is not a manually driven end-to-end campaign. Physical Redmi Note and Safari testing remain unperformed.
