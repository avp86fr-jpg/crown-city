// Missing terrain downloads must retain the incremental renderer, then recover.
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||(fs.existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),args:['--no-sandbox']});try{
 const p=await browser.newPage({viewport:{width:844,height:390},deviceScaleFactor:2,isMobile:true,hasTouch:true}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 let requests=0;await p.route('**/assets/world/mobile/**',route=>{requests++;return route.fulfill({status:503,body:'intentional scenery fallback test'});});
 await p.addInitScript(()=>requestAnimationFrame=()=>0);await p.goto(process.env.CC_URL||'http://127.0.0.1:8032/');await p.waitForFunction(()=>window.__CC,null,{polling:100});
 await p.evaluate(async()=>{window.T=(await import('./src/game.js')).testing;const G=__CC.G;T.startFreeRide(G);G.settings.quality='low';G.settings.autoRes=false;G.settings.reducedMotion=true;G.time=12;G.touch=true;G.hideHUD=true;G.rainAmt=G.wet=G.fog=0;G.player=T.makeFoot(G,8120,3200,0);Object.assign(G.cam,{x:8120,y:3200,rot:0,scale:1});T.applyQuality(G);T.fit(G);});
 const warm=async(n=80)=>{for(let i=0;i<n;i++){await p.evaluate(()=>T.render(__CC.G));await p.waitForTimeout(15);}};
 await warm();const failed=await p.evaluate(()=>({...__CC.G.mobileRenderStats}));assert.ok(requests>0);assert.equal(failed.bakedReady,0);assert.equal(failed.outerPending,0);assert.ok(failed.outerTiles>0);
 const count=requests;await warm(20);assert.equal(requests,count,'unavailable terrain must not retry each frame');
 await p.evaluate(()=>{const G=__CC.G;window.before=G.ctx.getImageData(0,0,G.canvas.width,G.canvas.height).data;});
 fs.mkdirSync('.qa/sustained',{recursive:true});await p.screenshot({path:'.qa/sustained/terrain-fallback.png'});
 await p.unroute('**/assets/world/mobile/**');await p.evaluate(()=>{__CC.G.ticks+=1801;});await warm();
 const recovered=await p.evaluate(()=>{const G=__CC.G,d=G.ctx.getImageData(0,0,G.canvas.width,G.canvas.height).data;let difference=0,lit=0;for(let i=0;i<d.length;i+=4){difference+=Math.abs(d[i]-before[i])+Math.abs(d[i+1]-before[i+1])+Math.abs(d[i+2]-before[i+2]);if(Math.max(d[i],d[i+1],d[i+2])>30)lit++;}return{...G.mobileRenderStats,lit:lit/(d.length/4),difference:difference/(d.length/4*3)};});
 assert.ok(recovered.bakedReady>0);assert.equal(recovered.outerPending,0);assert.ok(recovered.bakedBytes<=64*1024*1024);assert.ok(recovered.lit>.7);assert.ok(recovered.difference<20,JSON.stringify(recovered));
 await p.screenshot({path:'.qa/sustained/terrain-recovered.png'});console.log('PASS missing mobile sheets paint procedural scenery, back off, and recover matching artwork',recovered);
 await p.evaluate(()=>{const G=__CC.G;G.settings.quality='high';T.applyQuality(G);T.fit(G);T.render(G);});assert.equal(await p.evaluate(()=>__CC.G.bakedWorld),null);assert.deepEqual(errors,[]);console.log('PASS switching quality releases mobile sheets; no browser exceptions');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
