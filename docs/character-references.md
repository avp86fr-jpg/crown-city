# MetaWinners references and adaptation notes

The upgraded game keeps its illustrated overhead camera. Character identities use the MetaWinners collection as visual reference; Crown City's events, dialogue and music are original fan-made fiction.

## Verified collectible references

- Collection: https://opensea.io/collection/metawinners-1
- CHAOS, token 2: https://opensea.io/item/ethereum/0x74f70713b0515e9f520d6c764352e45e227839b7/2
- GOLD MAGE, token 1761: https://opensea.io/item/ethereum/0x74f70713b0515e9f520d6c764352e45e227839b7/1761
- Collection trait list: https://opensea.io/collection/metawinners-1/traits

The individual Chaos and Gold Mage identities were checked on OpenSea. The existing portraits of Hunter, Fire, Neural and Mask were inspected locally and retained. Their specific token numbers were not independently established in this pass; none are invented here. Vera Vale is an original Crown City character.

## Art used in gameplay

`assets/premium/chaos.webp` is a newly generated six-column, eight-direction animation sheet, using the existing Chaos portrait and previous sprite sheet as references. It retains the white cracked helmet, red visor insignia, green armor and purple split coat. Four locomotion poses, idle and aiming frames are used by the engine. Aiming follows the shot direction; dodge, recoil, breathing and falls add procedural motion.

`assets/premium/crowd.webp` provides illustrated civilian and police walk/idle views in a nine-column, eight-direction sheet. These original city residents replace the old block-style civilian sprites. The atlas uses two walking poses and one idle pose per archetype.

`assets/premium/vehicles.webp` is a new six-car atlas: red striped muscle coupe, violet-black hypercar, teal sports coupe, navy/white pursuit sedan, mustard taxi and graphite sedan. Designs are unbranded. Wheel steering, suspension, wipers, entry/exit doors, damage, paint changes and vehicle lights remain runtime effects. `assets/premium/city-fleet.webp` adds a matching bus, ambulance, armored Palace courier van, sport motorcycle, cruiser and speedboat. It was generated from the first vehicle atlas as a style reference; the larger yacht retains its earlier art.

All four atlases were generated with the built-in image-generation tool and compressed to WebP. The regular cell grids are used directly; no claim of 3D models or skeletal animation is made. Sprite anchors and direction transitions still warrant physical-device/manual art review.

## Original score

`tools/compose-score.py` synthesizes three authored arrangements from original note/drum patterns, without external samples or music:

- VEIL FM 98.6: **Afterhours**, approximately 71 seconds, funk bass/guitar/brass.
- CHIP RADIO 104.2: **Sidewalk Stories**, approximately 83 seconds, swung drums and electric keys.
- NIGHT SHIFT 107.7: **No Clean Exit**, approximately 58 seconds, faster pursuit arrangement.

The browser streams the Ogg tracks into the game's Web Audio master bus, fades between stations/pursuit, and ducks music during dialogue and menus. Synthesized score fallback remains available when a media stream cannot start. The three files total approximately 1.8 MB; they do not block boot.
