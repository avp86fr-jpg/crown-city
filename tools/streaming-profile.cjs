const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
const url=process.argv[2]||'http://127.0.0.1:8000/',label=process.argv[3]||'after';
fs.mkdirSync('.qa/streaming',{recursive:true});
(async()=>{const b=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});try{
 const p=await b.newPage({viewport:{width:844,height:390},hasTouch:true,isMobile:true,deviceScaleFactor:2}),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.addInitScript(()=>requestAnimationFrame=()=>0);await p.goto(url);await p.waitForFunction(()=>window.__CC,null,{polling:100});await p.evaluate(async()=>{window.T=(await import('./src/game.js')).testing;const G=__CC.G;T.startFreeRide(G);Object.assign(G.settings,{quality:'low',autoRes:false,autoFS:false});T.applyQuality(G);T.fit(G);G.touch=true;G.hideHUD=true;G.scene='play';G.time=16;G.action.messageT=G.toastT=0;});await p.waitForTimeout(1800);
 const cdp=await p.context().newCDPSession(p);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});const results=[];
 for(const [scene,x,y] of [['circuit',2900,7900],['airfield',8300,7700],['forest',11220,2570],['junction',4200,2620]]){
  await p.evaluate(({x,y})=>{const G=__CC.G;G.player=T.makeFoot(G,x,y,0);Object.assign(G.cam,{x,y,rot:0,scale:.7});},{x,y});const frames=[];
  for(let i=0;i<120;i++){const frame=await p.evaluate(()=>{const G=__CC.G;G.ticks++;const t=performance.now();T.render(G);return{work:performance.now()-t,pending:G.mobileRenderStats.outerPending,tiles:G.mobileRenderStats.outerTiles,ground:G.mobileRenderStats.groundChunks};});frames.push(frame);await p.waitForTimeout(5);}
  const work=frames.map(f=>f.work).sort((a,b)=>a-b);results.push({scene,p50:work[60],p95:work[114],max:work[119],framesToReady:frames.findIndex(f=>f.pending===0)+1,tiles:frames.at(-1)});assert.equal(frames.at(-1).pending,0);await p.screenshot({path:`.qa/streaming/${label}-${scene}.jpg`});
 }
 for(const [width,height] of [[844,390],[390,844],[1440,900]]){await p.setViewportSize({width,height});await p.evaluate(()=>{T.fit(__CC.G);__CC.G.scene='map';T.render(__CC.G);});await p.screenshot({path:`.qa/streaming/${label}-map-${width}.png`});}
 assert.deepEqual(errors,[]);console.log(JSON.stringify(results,null,2));fs.writeFileSync(`.qa/streaming/stream-${label}.json`,JSON.stringify(results,null,2));
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
