# Crown City — No Clean Exit

A separate **60-second, 1280 × 720, 30 fps** gameplay film. The previous trailer and its poster remain unchanged. The new MP4 is H.264 with stereo AAC, web faststart and an approximately −14 LUFS music/effects master.

## The cut

- **0:00–0:07.5:** Chaos, Hunter and the first job. A story choice establishes the crew's stakes.
- **0:07.5–0:15:** Cold Wallet's convoy interception and a police getaway.
- **0:15–0:22.5:** The expanded circuit, rival drivers, technical corners and the fast straight.
- **0:22.5–0:31.9:** Dodge, aimed shooting, the new Crown RPG, blast damage and vehicle wrecks.
- **0:31.9–0:41.3:** Canal sailing, a successful Paper Wings package drop and a helicopter departure.
- **0:41.3–0:48.8:** Play-chip slots, animated rail travel and city traffic at night.
- **0:48.8–1:00:** The forest frontier, Gold Mage's challenge and a final invitation to play.

All gameplay and story frames come from this game. The capture tool stages starting situations, controls, camera positions and time of day; it steps the simulation at 60 Hz and records at 30 fps. This is an offline cinematic capture, **not a mobile frame-rate benchmark**. Narrative portraits use the game's existing artwork, including the supplied Gold Mage reference. The soundtrack and Foley are a trailer mix rather than a recording of the game's live audio output.

The English WebVTT file repeats the on-screen headings and feature captions. The film has no spoken dialogue. Its short black dips avoid full-screen white-flash transitions.

## Music

**Heat Check** is a new, original 60-second, 128 BPM D-minor action-funk arrangement: Rhodes, muted guitar, bass, brass, warm pads and drums. Its 32 bars align with the picture cuts. Authored engine, rotor, siren, weapon, water and transit effects follow the gameplay; explosions briefly duck the music.

The source and rendered score use the existing FluidSynth/TimGM6mb pipeline and are provided under GPL-2.0, consistent with [the included attribution and license](../assets/music/LICENSE-TimGM.txt). No commercial game soundtrack or third-party song composition is used. The SoundFont is not bundled. Game/NFT artwork rights remain with their respective owners; this is an independent fan-made game.

## Rebuild

Run from the repository root with a local web server at `http://127.0.0.1:8032/` (or set `CC_URL`):

```sh
node tools/capture-upgrade-film.cjs
python tools/compose-upgrade-film.py
python tools/assemble-upgrade-film.py
```

Requirements: Playwright, Chromium, FFmpeg, Python NumPy/SciPy, libfluidsynth and `/usr/share/sounds/sf2/TimGM6mb.sf2`. Intermediate captures and WAV files stay in ignored `.qa/upgrade-film/`. `--preview` saves a three-frame storyboard for each shot; `--only=id,id` re-records selected shots.

Published assets:

- `about/assets/crown-city-no-clean-exit-60s-720p.mp4`
- `about/assets/crown-city-no-clean-exit-60s-720p-poster.webp`
- `about/assets/crown-city-no-clean-exit-60s-720p.en.vtt`

The assembly tool verifies every shot's frame count, performs two-pass loudness normalization, checks the final duration and exports a poster from the finished film.
