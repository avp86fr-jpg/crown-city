const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||(fs.existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),headless:true,args:['--no-sandbox']});try{
 const page=await browser.newPage({viewport:{width:844,height:390},deviceScaleFactor:2,isMobile:true,hasTouch:true}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{requestAnimationFrame=()=>0;});await page.goto(process.env.CC_URL||'http://127.0.0.1:8032/');await page.waitForFunction(()=>window.__CC,null,{polling:100});
 await page.evaluate(async()=>{window.T=(await import('./src/game.js')).testing;window.E=await import('./src/explosions.js');const G=__CC.G;T.startFreeRide(G);G.settings.quality='low';G.settings.autoRes=false;G.settings.autoFS=false;G.touch=true;T.applyQuality(G);T.fit(G);__CC.goto(2108,2400);G.cam.scale=1.2;G.cam.rot=0;G.player.rot=Math.PI/2;G.time=12;G.rainAmt=G.fog=G.sand=0;G.action.messageT=G.toastT=0;G.banner=null;G._syncTouch();T.render(G);});
 await page.waitForTimeout(1200);
 // Exercise the actual weapon button and pulse consumption, rather than assigning the slot.
 const weapon=page.locator('[data-action="weapon"]');
 const buttons=await page.locator('button').evaluateAll(bs=>bs.map(b=>({text:b.textContent,action:b.dataset.action,id:b.id})));
 const target=buttons.find(b=>b.action==='weapon'||b.text.trim()==='WEAPON');assert.ok(target,JSON.stringify(buttons));
 const control=target.id?page.locator('#'+target.id):weapon;
 for(let i=0;i<3;i++){await control.tap();await page.evaluate(()=>T.tickPlay(__CC.G,1/60));}
 assert.equal(await page.evaluate(()=>__CC.G.action.weapon),3);
 fs.mkdirSync('.qa/rocket',{recursive:true});
 const lighting=[];
 for(const time of [6.4,12,18.4,0]){
  await page.evaluate(time=>{const G=__CC.G;G.time=time;T.render(G);},time);await page.waitForTimeout(150);await page.evaluate(()=>T.render(__CC.G));
  lighting.push(await page.evaluate(()=>{const G=__CC.G,d=G.ctx.getImageData(G.canvas.width*.2,G.canvas.height*.3,G.canvas.width*.6,G.canvas.height*.4).data;let sum=0,lit=0;for(let i=0;i<d.length;i+=4){sum+=(d[i]+d[i+1]+d[i+2])/3;if(d[i]+d[i+1]+d[i+2]>30)lit++;}return{mean:sum/(d.length/4),lit:lit/(d.length/4)};}));
  await page.screenshot({path:`.qa/rocket/mobile-${time}.png`});
 }
 assert.ok(lighting.every(v=>v.lit>.5),'all four times must render a visible world');assert.ok(lighting[3].mean<lighting[1].mean*.9,'night must read darker than noon');
 await page.evaluate(()=>{const G=__CC.G;G.time=18.4;G.solidAt=()=>false;G.surfaceAt=()=> 'road';G.peds=[];G.cops=[];G.vehicles=[];G.player=T.makeFoot(G,2108,2400,Math.PI/2);G.action.weapon=3;G.action.shotT=G.action.reloadT=0;G.action.ammo[3]=1;G.action.dodgeT=0;T.shoot(G,G.player,true);T.tickRockets(G,.2);T.render(G);});
 assert.equal(await page.evaluate(()=>__CC.G.rockets.length),1);await page.screenshot({path:'.qa/rocket/mobile-launch.png'});
 await page.evaluate(()=>{const G=__CC.G,r=G.rockets[0],v=T.makeVeh('riot',r.x+65,r.y,0);G.vehicles.push(v);T.tickRockets(G,.2);E.tickBlastFX(G,.12);T.render(G);});
 assert.equal(await page.evaluate(()=>__CC.G.rockets.length),0);assert.equal(await page.evaluate(()=>__CC.G.vehicles[0].burning),true);await page.screenshot({path:'.qa/rocket/mobile-blast.png'});
 await page.setViewportSize({width:1280,height:720});await page.evaluate(()=>{const G=__CC.G;G.touch=false;G.settings.quality='high';G._syncTouch();T.fit(G);T.applyQuality(G);T.render(G);});await page.screenshot({path:'.qa/rocket/desktop-blast.png'});
 await page.evaluate(()=>{const G=__CC.G;G.blastFX.bursts=[];G.vehicles=[T.makeVeh('stitch',2100,2410,0)];G.vehicles[0].traffic=true;T.render(G);});await page.screenshot({path:'.qa/rocket/rider.png'});
 assert.deepEqual(errors,[]);console.log('PASS touch launcher cycle, four day/night pixel checks, actual swept rocket impact, mobile/desktop FX, rider rendering; no browser exceptions');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
