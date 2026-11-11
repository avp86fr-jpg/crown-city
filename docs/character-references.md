# MetaWinners references and adaptation notes

The upgraded game keeps its illustrated overhead camera. Character identities use the MetaWinners collection as visual reference; Crown City's events, dialogue and music are original fan-made fiction.

## Verified collectible references

- Collection: https://opensea.io/collection/metawinners-1
- CHAOS, token 2: https://opensea.io/item/ethereum/0x74f70713b0515e9f520d6c764352e45e227839b7/2
- GOLD MAGE, token 1761: https://opensea.io/item/ethereum/0x74f70713b0515e9f520d6c764352e45e227839b7/1761
- CHIEF, token 3: https://opensea.io/item/ethereum/0x74f70713b0515e9f520d6c764352e45e227839b7/3
- ICE, token 4: https://opensea.io/item/ethereum/0x74f70713b0515e9f520d6c764352e45e227839b7/4
- STEAMPUNK, token 5: https://opensea.io/item/ethereum/0x74f70713b0515e9f520d6c764352e45e227839b7/5
- Collection trait list: https://opensea.io/collection/metawinners-1/traits

The individual Chaos and Gold Mage identities were checked on OpenSea. The user supplied the definitive Gold Mage image for the current release; earlier retained imagery was incorrect. The existing portraits of Hunter, Fire, Neural and Mask were inspected locally and retained. Their specific token numbers were not independently established in this pass; none are invented here. Vera Vale is an original Crown City character.

## Art used in gameplay

`assets/premium/chaos.webp` is a newly generated six-column, eight-direction animation sheet, using the existing Chaos portrait and previous sprite sheet as references. It retains the white cracked helmet, red visor insignia, green armor and purple split coat. Four locomotion poses, idle and aiming frames are used by the engine. Aiming follows the shot direction; dodge, recoil, breathing and falls add procedural motion.

`assets/premium/crowd.webp` provides illustrated civilian and police walk/idle views in a nine-column, eight-direction sheet. These original city residents replace the old block-style civilian sprites. The atlas uses two walking poses and one idle pose per archetype.

`assets/premium/vehicles.webp` is a new six-car atlas: red striped muscle coupe, violet-black hypercar, teal sports coupe, navy/white pursuit sedan, mustard taxi and graphite sedan. Designs are unbranded. Wheel steering, suspension, wipers, entry/exit doors, damage, paint changes and vehicle lights remain runtime effects. `assets/premium/city-fleet.webp` adds a matching bus, ambulance, armored Palace courier van, sport motorcycle, cruiser and speedboat. It was generated from the first vehicle atlas as a style reference; the larger yacht retains its earlier art.

All four atlases were generated with the built-in image-generation tool and compressed to WebP. Chaos and crowd frames now use measured alpha bounds and torso anchors, including the mobile variants; no claim of 3D models or skeletal animation is made. Sprite anchors and direction transitions still warrant physical-device/manual art review.

## Original score

`tools/compose-score.py` synthesizes five authored arrangements at 44.1 kHz stereo from original note/drum patterns, without external samples or music:

- VEIL FM 98.6: **Afterhours**, approximately 71 seconds, funk bass/guitar/brass.
- CHIP RADIO 104.2: **Sidewalk Stories**, approximately 83 seconds, swung drums and electric keys.
- NIGHT SHIFT 107.7: **No Clean Exit**, approximately 58 seconds, faster pursuit arrangement.

The browser streams the Ogg tracks into the game's Web Audio master bus, fades between stations/pursuit, and ducks music during dialogue and menus. Synthesized score fallback remains available when a media stream cannot start. The five Ogg files total approximately 5.1 MB; MP3 fallbacks are available. Tracks stream on demand and do not block boot.

- CITY SCORE: **Midnight Receipts**, approximately 89 seconds.
- CROWN TRANSIT: **Last Train Home**, approximately 82 seconds.

The current master uses a subsonic high-pass filter, gentle saturation, humanized percussion velocities and peak headroom. Only two streams may overlap during a transition.

## Release cover and trailer

The corrected About/title cover depicts Chaos and a single complete red muscle coupe. It does not contain a generated Gold Mage. Gold Mage’s About card and story scenes use `assets/portraits/gold_mage_reference.jpg`, byte-identical to the user’s supplied 1280×1280 JPEG. Its SHA-256 is `a21d3e414f5885c2ae84eeed318735c8ad15d8d3d63b5c158e82a5a7a7039a05`. The new filename also avoids stale browser image caches. The old retained image was altered; earlier documentation calling it original was incorrect. The gallery contains actual updated-game screenshots. The 720p trailer combines staged Chromium gameplay captures with the cover title cards and the original Afterhours score. See [release-media.md](release-media.md) for the source material, encoding and validation.

## Frontier cast and scenery

`assets/premium/frontier-cast.webp` retains generated adaptations of Hunter, Neural, Mask and Fire. Its old Gold Mage column is **never drawn**. Gold Mage instead uses the supplied reference pixels as a silhouette-clipped face/armor texture above a separately drawn lower-body costume. No helmet or face regeneration is involved. His contact-panel portrait and all story portraits show the complete supplied image. Chief, Ice and Steampunk also use their collectible portrait pixels for the face and armor; their full portraits remain visible at encounters.

The new portraits were downloaded from the collectible image URLs embedded in the corresponding public OpenSea pages on 2026-11-11. Their identity/type names and token IDs were checked there. Story roles and dialogue are original fiction.

`wildlife.webp` is a generated 4×6 atlas: deer, fox, dog, cat, gull and pigeon, with four poses each. A second image-tool pass removed the background. `transit.webp` is a generated atlas of the subway entrance, train roof, regional platform canopy and side-view carriage. Runtime doors, train timetables, route movement, shadows and station signage remain separate from the artwork. WebP conversion and resizing are mechanical exports.

`frontier-terrain.webp` supplies forest floor, sand, slate and casino paving. `frontier-scenery.webp` supplies a painted pine, slate outcrop, red mesa and cactus cluster. Both are original generated environmental atlases. Mechanical resizing and WebP compression retain alpha where present.

## Grounding and costume pass

`src/sprite_frames.js` records measured alpha bounds for every Chaos and crowd frame, scaled to the existing mobile textures. Figures use a common foot origin and a torso anchor rather than each cell’s geometric center. No source atlas pixels were repainted.

`assets/premium/contact-costumes.webp` contains four waist-to-boot extensions generated with the image tool from the Gold Mage, Chief, Ice and Steampunk costume palettes. The generation explicitly excluded heads, helmets, faces, arms and upper torsos. Runtime rendering combines those extensions with smaller silhouette clips of the original portraits for adult proportions. Gold Mage’s original cyan insignia and horns remain sourced from the supplied image, whose file hash is unchanged. The lower-body costumes are game adaptations, not additional NFT source art. The retained generated PNG was mechanically resized and exported as a transparent WebP.

## World material and street furniture pass

`assets/premium/world-materials.webp` contains eight original generated materials: woodland floor, desert sand, slate, plaza brick, asphalt, concrete paving, trail gravel and water. The source PNG was mechanically resized to 1536×768 and exported to WebP. Runtime patterns control scale and blend water/lawn color inside cached terrain chunks.

`assets/premium/street-furniture.webp` is a transparent original generated 3×2 atlas of a café, produce cart, bus shelter, flower-planter bench, loading supplies and newsstand, mechanically resized to 1152×768. These replace the previous primitive fixture paintings; day/night mobile core tiles were rebaked from the actual renderer. No NFT character or portrait was regenerated for this pass.
