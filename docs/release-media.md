# Night Dividend release media

The About page uses current game captures, the existing illustrated key art and a new 44-second gameplay film. Video remains `preload="none"`; portraits and screenshots load lazily. Six accessible scene buttons seek to pursuit, canal, casino/story, aircraft, train and combat sequences. Opening the screenshot gallery or hiding the browser pauses playback. The gallery supports keyboard navigation, Escape and focus restoration; reduced motion disables smooth scrolling.

## Film and screenshots

`about/assets/crown-city-trailer-720p.mp4` is 1280×720, 30 fps H.264 with stereo 48 kHz AAC and fast-start metadata. Twelve cuts follow the score's 120 BPM bars: pursuit, street life, canal escape, MetaWin terrace, Gold Mage, helicopter lift-off, runway takeoff, forest motorcycle ride, regional train departure, street combat, a night escape and the end card. English WebVTT captions describe the music, sounds and on-screen text. There is no voice-over.

`tools/capture-final-trailer.cjs` starts the actual game in Chromium, stages starting locations, vehicles, weather and wanted levels, then advances real game controls, physics, AI and rendering in 1/60-second steps. The film presents two steps per frame. Cameras and typography are directed for the edit; most gameplay HUD elements are hidden. This offline capture is not a device frame-rate measurement. `--preview` captures representative stills; `--only=name,...` replaces individual shots. `tools/build-final-trailer.py` assembles the edit, sound mix, poster and WebP gallery exports.

All seven gallery images and the story image are from the current capture. The poster is a gameplay frame. The hero/social cover remains separate promotional illustration: Chaos beside one red Riot V8 with ivory stripes. Gold Mage uses the exact supplied JPEG, not a regenerated portrait. See [character-references.md](character-references.md). Anton is locally hosted under its included SIL Open Font License.

## Music and sound

**Night Dividend** is an original D-minor funk composition with finger bass, Rhodes, muted guitar, trumpet/trombone responses, vibraphone and a drum kit. The film arrangement has an opening hook, breaks, a lift into the flight sequence, a final build and a resolved outro. Engines, distant sirens, transition swishes and gunfire accents are authored sound design; they are mixed separately from the game capture. The final mix targets −16 LUFS and −1.5 dBTP.

The game also receives a 64-second radio arrangement on VEIL FM. Ogg and MP3 versions are lazy streams; the existing two-stream crossfade limit remains. `tools/compose-night-dividend.py` renders through the installed FluidSynth library using TimGM6mb instruments. The arrangement/source and rendered new track are provided under GPL-2.0; credits and the license are in `assets/music/LICENSE-TimGM.txt`. The SoundFont is not bundled. The score uses no commercial GTA recordings or third-party song composition.

## Reproduction and checks

Start `npm run serve` for a local preview on port 8000 (or set `PORT`). The preview server supports HTTP byte ranges so chapter seeking works like GitHub Pages. Then run:

1. `python3 tools/compose-night-dividend.py`
2. `node tools/capture-final-trailer.cjs`
3. `python3 tools/build-final-trailer.py`
4. `npm run test:about`

Capture requires Playwright/Chromium and FFmpeg. Score rendering additionally uses Python NumPy/SciPy, libfluidsynth and `/usr/share/sounds/sf2/TimGM6mb.sf2`. No live recording device or network music service is used.

The About suite verifies assets/fonts, 320px phone through desktop layouts, gallery focus/navigation, links, fullscreen-related instructions, actual trailer playback and decoded audio, 44-second duration, chapter seeking, captions and reduced motion. Mobile hardware performance is assessed separately from offline film capture.
