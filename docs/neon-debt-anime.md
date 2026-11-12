# Crown City — Neon Debt

An original **one-minute anime-style opening**: city life at dusk, Chaos and Hunter's archive job, a police chase, rooftop movement and combat, a canal getaway, a helicopter, Gold Mage's challenge and a dawn escape.

The film is authored **limited 2D animation**: generated cel-style key art, an eight-frame running cycle, composited character poses and vehicles, camera movement, rotating helicopter blades, animated traffic and pedestrian silhouettes, rain, water wakes, lighting, sparks, smoke and a stylized explosion. It is an illustrated cinematic; it does not depict the game's playable graphics. It is not a claim of fully generated video or frame-by-frame character acting throughout.

Chaos and Hunter's interpretations use their existing design references. **Gold Mage uses the existing supplied portrait**, `assets/portraits/gold_mage_reference.jpg`; no replacement portrait was generated. The game's character files and previous trailers remain unchanged.

## Picture and sound

- 60.000 seconds; 1280 × 720; 24 fps; 1,440 frames.
- 21 sequences timed to 36 bars at 144 BPM.
- H.264 / stereo AAC, web faststart, under 12.4 MB.
- English descriptive captions and an optional standalone watch page at `about/anime/`.
- Original **Neon Debt** electronic-rock score: double-tracked power-chord guitars, picked bass, Rhodes, synth lead, strings, pads, drums and authored sub-bass.
- Trailer Foley includes engines, sirens, footsteps, gunfire, water, helicopter rotors and an explosion. Music ducks at the blast; the master targets −14 LUFS with extra peak headroom before AAC encoding.

The arrangement, source and rendered score are provided under GPL-2.0 through the existing FluidSynth/TimGM6mb pipeline. See [music attribution and license](../assets/music/LICENSE-TimGM.txt). No commercial anime or game soundtrack is used. The SoundFont is not bundled. Character/NFT artwork rights remain with their respective owners; Crown City is an independent fan-made game.

## Rebuild

Serve the repository locally at `http://127.0.0.1:8032/` or set `CC_URL` to the server's root URL with a trailing slash:

```sh
node tools/render-anime-opening.cjs
python tools/compose-neon-debt.py
python tools/assemble-anime-opening.py
```

Use `node tools/render-anime-opening.cjs --preview` for a three-frame-per-shot storyboard. The compositor and shot list are in `tools/anime-opening/scene.js`. WebP art atlases are in `about/assets/anime/`; alpha sprites retain transparent backgrounds. Existing portrait files are read directly. Intermediates, source score WAVs and reports remain in ignored `.qa/anime-opening/`.

Requirements: Playwright/Chromium, FFmpeg, NumPy/SciPy, libfluidsynth and `/usr/share/sounds/sf2/TimGM6mb.sf2`. The renderer is separate from the game loop. The watch page uses metadata-only video preload and does not add any loading cost to the playable game.
