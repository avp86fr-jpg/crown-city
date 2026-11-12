const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
const url=process.env.CC_URL||'http://127.0.0.1:8030/';fs.mkdirSync('.qa/precision',{recursive:true});
(async()=>{const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});try{
 const p=await browser.newPage({viewport:{width:1280,height:720},hasTouch:true,isMobile:true}),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.addInitScript(()=>requestAnimationFrame=()=>0);
 await p.goto(url);await p.waitForFunction(()=>window.__CC,null,{polling:100});await p.evaluate(async()=>{window.T=(await import(new URL('src/game.js',location.href).href)).testing;T.startFreeRide(__CC.G);});
 await p.evaluate(()=>{const G=__CC.G,c=G.ctx;c.setTransform(1,0,0,1,0,0);c.fillStyle='#13212b';c.fillRect(0,0,G.canvas.width,G.canvas.height);G.input.fire=true;G.input.mouse.fire=false;G.ticks=100;G.action.reloadT=0;
 for(let i=0;i<3;i++){G.action.weapon=i;G.player=T.makeFoot(G,0,0,Math.PI/2);G.player.aimRot=Math.PI/2;c.save();c.translate(220+i*390,445);c.scale(4,4);T.drawChar(G,G.player);c.restore();c.fillStyle='#e4d7b7';c.font='bold 18px system-ui';c.textAlign='center';c.fillText(['SILENCED .45','VULTURE SMG','BREACHER'][i],220+i*390,535);}
 });await p.screenshot({path:'.qa/precision/weapons.png'});
 await p.evaluate(()=>{const G=__CC.G;G.input.fire=false;G.scene='play';G.hideHUD=true;G.time=13;G.settings.quality='low';G.settings.autoRes=false;G.player=T.makeFoot(G,900,2250,0);Object.assign(G.cam,{x:900,y:2250,rot:0,scale:1.15});T.applyQuality(G);T.fit(G);});
 for(let i=0;i<70;i++){await p.evaluate(()=>{__CC.G.ticks++;T.render(__CC.G);});await p.waitForTimeout(8);}await p.screenshot({path:'.qa/precision/courts.png'});
 assert.deepEqual(await p.evaluate(()=>[[608,2208],[800,2368],[1152,2368]].map(([x,y])=>__CC.G.surfaceAt(x,y))),['walk','walk','walk']);
 await p.setViewportSize({width:844,height:390});await p.evaluate(()=>{const G=__CC.G;G.touch=true;G.hideHUD=false;G.freeRoam=false;G.mode='story';T.beginMission(G,1);G.scene='play';G.objectiveIndex=1;G.player=T.makeVeh('riot',5200,7568,Math.PI/2);G.vehicles=[G.player];T.startRace(G,G._flow.objectives[1]);T.fit(G);G.toastT=G.action.messageT=0;G._syncTouch();});
 for(let i=0;i<70;i++){await p.evaluate(()=>T.render(__CC.G));await p.waitForTimeout(8);}await p.screenshot({path:'.qa/precision/story-grid-mobile.png'});
 assert.equal(await p.evaluate(()=>__CC.G.race.pts.length),32);assert.ok(await p.evaluate(()=>__CC.G.race.pts.every(p=>p[1]>7040)));
 // A current saved grid restores its version and separates both physical bodies.
 const grid=await p.evaluate(()=>{const G=__CC.G,s=T.snapshot(G);T.restoreState(G,s);return{version:s.race.version,dx:G.race.rival.x-G.player.x,dy:G.race.rival.y-G.player.y,countdown:G.race.countdown};});assert.equal(grid.version,2);assert.ok(Math.hypot(grid.dx,grid.dy)>=83);assert.equal(grid.countdown,3);
 // Asset failure still produces the same playable track with incremental paint.
 await p.route('**/assets/world/circuit-*.webp',r=>r.abort());await p.reload();await p.waitForFunction(()=>window.__CC,null,{polling:100});await p.evaluate(async()=>{window.T=(await import(new URL('src/game.js',location.href).href)).testing;const G=__CC.G;T.startFreeRide(G);G.settings.quality='low';T.applyQuality(G);G.player=T.makeFoot(G,3000,7900,0);Object.assign(G.cam,{x:3000,y:7900,rot:0,scale:.7});T.fit(G);});
 for(let i=0;i<120;i++){await p.evaluate(()=>{__CC.G.ticks++;T.render(__CC.G);});await p.waitForTimeout(8);}assert.equal(await p.evaluate(()=>__CC.G.mobileRenderStats.outerPending),0);
 assert.deepEqual(errors,[]);console.log('PASS proportional weapon artwork, repaired courts, mobile story grid/save and procedural fallback');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
