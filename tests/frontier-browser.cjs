const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('fs');
const base=process.env.CC_URL||'http://127.0.0.1:8000/';
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});const errors=[],failed=[];fs.mkdirSync('.qa/frontier',{recursive:true});try{
 const p=await b.newPage({viewport:{width:1280,height:720}});p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.status()>=400)failed.push(r.url());});
 await p.addInitScript(()=>requestAnimationFrame=()=>0);await p.goto(base);await p.waitForFunction(()=>window.__CC,null,{polling:100});
 await p.evaluate(async()=>{window.T=(await import('./src/game.js')).testing;const G=__CC.G;T.startFreeRide(G);G.settings.timeSpeed=0;G.weatherT=1e9;G.time=15;G.rainAmt=0;G.settings.quality='low';G.settings.autoRes=false;T.applyQuality(G);T.fit(G);G.player=T.makeFoot(G,6810,1250,0);G.cam.x=G.player.x;G.cam.y=G.player.y;T.tick(G,1/60);T.render(G);});
 const step=async n=>p.evaluate(n=>{for(let i=0;i<n;i++)T.tick(__CC.G,1/60);T.render(__CC.G);},n);
 await p.keyboard.press('KeyE');await step(130);assert.equal(await p.evaluate(()=>__CC.G.action.contract.id),'canal');assert.equal(await p.evaluate(()=>__CC.G.action.contract.stage),1);
 await p.evaluate(()=>{const G=__CC.G;G.player.x=6880;G.player.y=1240;T.tick(G,1/60);});await p.keyboard.press('KeyE');await step(35);assert.equal(await p.evaluate(()=>__CC.G.player.kind),'wake');
 await p.keyboard.down('KeyW');await step(450);await p.keyboard.up('KeyW');const boat=await p.evaluate(()=>({y:__CC.G.player.y,health:__CC.G.player.health,stage:__CC.G.action.contract.stage}));assert.ok(boat.y>2400,JSON.stringify(boat));assert.ok(boat.health>95);assert.ok(boat.stage>=2);console.log('PASS talk to Hunter, collect, enter the dock boat and drive below bridges',boat);
 // Capture the real new world with settled textures and a fixed overhead camera.
 for(const [name,x,y,scale] of [['casino',8210,3250,.78],['canal',6968,3450,.9],['forest',11300,4850,.8],['mountain',11200,9550,.8],['desert',5670,9690,.9],['airport',7140,7630,.8]]){
  await p.evaluate(({x,y,scale})=>{const G=__CC.G;G.action.contract=null;const safe=T.findSafe(G,x,y,8,true);G.player=T.makeFoot(G,safe.x,safe.y,0);G.wanted=0;G.hideHUD=true;G.settings.quality='med';T.fit(G);G.cam.x=x;G.cam.y=y;G.cam.rot=0;G.cam.scale=scale;T.render(G);},{x,y,scale});
  for(let i=0;i<12;i++){await p.evaluate(()=>T.render(__CC.G));await p.waitForTimeout(50);}await p.screenshot({path:'.qa/frontier/'+name+'.png'});
 }
 // Real mobile touches must reach TALK and fullscreen in portrait as well as landscape.
 const ctx=await b.newContext({viewport:{width:844,height:390},hasTouch:true,isMobile:true,deviceScaleFactor:2}),m=await ctx.newPage();m.on('pageerror',e=>errors.push(e.message));m.on('response',r=>{if(r.status()>=400)failed.push(r.url());});await m.goto(base);await m.waitForFunction(()=>window.__CC);
 await m.evaluate(async()=>{window.T=(await import('./src/game.js')).testing;const G=__CC.G;T.startFreeRide(G);G.settings.timeSpeed=0;G.time=15;G.weatherT=1e9;G.player=T.makeFoot(G,7695,3430,0);G.cam.x=G.player.x;G.cam.y=G.player.y;});
 await m.waitForFunction(()=>document.getElementById('tEnterL').textContent==='TALK');await m.locator('#tEnter').tap();await m.waitForFunction(()=>__CC.G.action.contract?.id==='casino');await m.waitForTimeout(1000);
 assert.ok(await m.evaluate(()=>__CC.G.expansionState.visited.includes('gold_mage')));await m.screenshot({path:'.qa/frontier/mobile-landscape.png'});
 await m.setViewportSize({width:390,height:844});await m.waitForTimeout(400);assert.ok(await m.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await m.screenshot({path:'.qa/frontier/mobile-portrait.png'});
 await m.locator('#tFS').tap();await m.waitForFunction(()=>!!document.fullscreenElement);console.log('PASS mobile TALK, casino job, portrait layout and Chrome fullscreen');
 assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);console.log('PASS all frontier assets load without browser errors');
 }finally{await b.close()}})().catch(e=>{console.error(e);process.exitCode=1});
