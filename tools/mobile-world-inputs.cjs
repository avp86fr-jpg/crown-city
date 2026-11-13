const fs=require('node:fs'),crypto=require('node:crypto');
const inputs=['src/game.js','src/world.js','src/render_world.js','src/mobile_renderer.js','src/citylife.js','src/architecture_art.js','src/street_design.js','src/world_details.js','src/expansion_world.js','src/transit.js','src/world_hubs.js','src/world_streets.js','src/urban_courts.js','src/circuit_world.js','src/world_limits.js','src/action.js','assets/city/meta.json','assets/city/mask_gray.png','assets/premium/world-materials.webp','assets/premium/frontier-scenery.webp','assets/premium/street-furniture.webp','assets/world/circuit-v2-mobile.webp',...fs.readdirSync('assets/tex').sort().map(n=>'assets/tex/'+n)];
inputs.push('tools/bake-mobile-world.cjs','tools/mobile-world-inputs.cjs');
const signature=()=>{const hash=crypto.createHash('sha256');for(const file of inputs){hash.update(file);hash.update(fs.readFileSync(file));}return hash.digest('hex').slice(0,12);};
module.exports={inputs,signature};
