// Export the authored circuit renderer, never screenshots with actors or HUD.
// Re-run whenever CIRCUIT_VERSION, its geometry or materials change.
const {chromium}=require('playwright'),fs=require('node:fs');
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});try{
 const p=await b.newPage();await p.addInitScript(()=>requestAnimationFrame=()=>0);await p.goto(process.env.CC_URL||'http://127.0.0.1:8030/');await p.waitForFunction(()=>window.__CC&&__CC.G.ground.materialsReady,null,{polling:100});
 fs.mkdirSync('assets/world',{recursive:true});
 for(const low of [true,false]){const data=await p.evaluate(async low=>{const {CIRCUIT,CIRCUIT_VERSION}=await import('./src/circuit_world.js'),G=__CC.G,c=document.createElement('canvas'),scale=(low?2048:4096)/CIRCUIT.w;
 c.width=Math.ceil(CIRCUIT.w*scale);c.height=Math.ceil(CIRCUIT.h*scale);const x=c.getContext('2d',{alpha:false});x.scale(scale,scale);x.translate(-CIRCUIT.x,-CIRCUIT.y);
 G.ground.drawCircuit(x,{x0:CIRCUIT.x,y0:CIRCUIT.y,x1:CIRCUIT.x+CIRCUIT.w,y1:CIRCUIT.y+CIRCUIT.h},low?.5:1,true);
 return {version:CIRCUIT_VERSION,width:c.width,height:c.height,webp:c.toDataURL('image/webp',.9).split(',')[1]};},low);
 const file=`assets/world/circuit-v${data.version}-${low?'mobile':'desktop'}.webp`;fs.writeFileSync(file,Buffer.from(data.webp,'base64'));console.log(file,data.width,data.height,fs.statSync(file).size);
 }
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
