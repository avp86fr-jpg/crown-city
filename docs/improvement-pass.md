# Campaign and reliability improvement pass

## Mission progression

| Job | Gameplay change |
| --- | --- |
| Cold Wallet | Deliberate package collection; an intercepted van stops cruising when disabled. |
| Neon Mile | Two ordered laps, a frozen countdown, a shared course for both drivers and real defeat/retry. A stock Riot can win. |
| Neural | Reachable entrance, clear-heat handoff, upfront payment or a fee deducted once from vault loot. A short balance can be deferred. |
| Casing the Palace | Two distinct reachable locations, on foot, with a short stationary scouting hold. Optional scrambler can be taken on foot or obtained with a police car. |
| Palace Heist | Quiet preparation grants a temporary no-new-dispatch window; loud entry begins at five stars. Loot is awarded once. A reserved boat waits at a reachable slip. |
| Exit Liquidity | Return to the marina, take the unlocked Nyx, reach the highway and lose the police. |

## Controls and presentation

Keyboard north/forward now agrees with touch and vehicle steering. Mouse aim uses the inverse camera transform. Focus loss releases held controls and pauses active play. Touch gains MAP and contextual TAKE. The map supports a blue personal waypoint and a return to the job route. HUD includes objective progress, race progress and pursuit feedback. Landscape settings use two columns. Existing painted city, character portraits and vehicle art are retained.

## Loading and performance

Story art loads per scene rather than blocking the title. The shared image loader handles cached events, missing decode support, errors and timeouts. Tile preloads share pending requests, missing tiles back off and small tile layers can evict old images. GPS work is limited by simulation ticks. Paused screens reuse a frozen world render. Unsupported audio and malformed settings no longer prevent starting the game.

## Verification and limits

27 automated tests pass against the actual repository world and collision PNG with mocked canvas/DOM/audio. Two choice routes traverse all six mission state machines, with test repositioning between objectives. The separate stock-Riot race test drives both laps using real physics, road data and collision checks without checkpoint teleporting. Button bounds are checked at 1280×720, 844×390 and 390×844.

The existing production title and opening dialogue were inspected in the shared browser. Local Chromium could not launch in this environment because socket creation was denied. The modified version still needs real-browser visual, touch, audio and full manually driven campaign playtesting before release; no frame-rate benchmark is claimed.
