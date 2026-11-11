const {chromium}=require('playwright');const assert=require('node:assert/strict');
(async()=>{
 const b=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});const errors=[];
 try{
  const p=await b.newPage({viewport:{width:1280,height:720}});p.on('pageerror',e=>errors.push(e.message));await p.addInitScript(()=>requestAnimationFrame=()=>0);await p.goto(process.env.CC_URL||'http://127.0.0.1:8000/');await p.waitForFunction(()=>!!window.__CC,null,{polling:100});
  await p.evaluate(async()=>{window.T=(await import('./src/game.js')).testing;const G=__CC.G;T.startFreeRide(G);G.settings.autoFS=false;G.settings.timeSpeed=0;G.weatherT=1e9;G.time=15;T.enterVeh(G,G.vehicles.find(v=>v.kind==='heli'),true);G.cam.x=G.player.x;G.cam.y=G.player.y;T.render(G);});
  const step=async n=>p.evaluate(n=>{for(let i=0;i<n;i++)T.tick(__CC.G,1/60);T.render(__CC.G);},n);
  await p.keyboard.down('ShiftLeft');await step(100);await p.keyboard.up('ShiftLeft');const alt=await p.evaluate(()=>__CC.G.player.altitude);assert.ok(alt>80);await step(30);assert.equal(await p.evaluate(()=>__CC.G.player.altitude),alt);
  await p.keyboard.press('KeyE');await step(180);assert.equal(await p.evaluate(()=>__CC.G.player.altitude),0);await p.keyboard.press('KeyE');await step(1);assert.equal(await p.evaluate(()=>__CC.G.player.type),'foot');
  await p.evaluate(()=>{const G=__CC.G;T.enterVeh(G,G.vehicles.find(v=>v.kind==='plane'),true);G.cam.x=G.player.x;G.cam.y=G.player.y;});await p.keyboard.down('KeyW');await step(210);await p.keyboard.up('KeyW');assert.ok(await p.evaluate(()=>__CC.G.player.altitude>35));
  const flight=await p.evaluate(()=>{const G=__CC.G,s=T.snapshot(G);T.restoreState(G,s);return {alt:G.player.altitude,vx:G.player.vx,id:G.player.aircraftId};});assert.ok(flight.alt>35&&flight.vx>300);
  await p.evaluate(()=>{const G=__CC.G;G.wanted=5;G.heliChase=true;G.bullets.push({life:1,x:G.player.x,y:G.player.y});T.busted(G);});await step(10);assert.ok(await p.evaluate(()=>{const G=__CC.G;return G.player.type==='foot'&&!G.wanted&&!G.heliChase&&!G.bullets.length&&!G.cops.length;}));console.log('PASS desktop takeoff, hover, land, exit, plane flight save/resume and busted recovery');
  const context=await b.newContext({viewport:{width:844,height:390},hasTouch:true,isMobile:true,deviceScaleFactor:1});const m=await context.newPage();m.on('pageerror',e=>errors.push(e.message));await m.addInitScript(()=>requestAnimationFrame=()=>0);await m.goto(process.env.CC_URL||'http://127.0.0.1:8000/');await m.waitForFunction(()=>!!window.__CC,null,{polling:100});
  await m.evaluate(async()=>{window.T=(await import('./src/game.js')).testing;const G=__CC.G;T.startFreeRide(G);G.settings.autoFS=false;G.settings.timeSpeed=0;G.weatherT=1e9;G.time=15;T.enterVeh(G,G.vehicles.find(v=>v.kind==='heli'),true);G.cam.x=G.player.x;G.cam.y=G.player.y;G.cam.scale=.85;T.tick(G,1/60);T.render(G);});
  assert.equal(await m.locator('#tBoost span').innerText(),'UP');assert.equal(await m.locator('#tBrake span').innerText(),'DOWN');
  const rect=await m.locator('#tBoost').boundingBox(),cdp=await context.newCDPSession(m);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:rect.x+rect.width/2,y:rect.y+rect.height/2,id:11}]});
  await m.evaluate(()=>{const G=__CC.G;for(let i=0;i<100;i++)T.tick(G,1/60);T.render(G);});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  const mobile=await m.evaluate(()=>({alt:__CC.G.player.altitude,mode:document.getElementById('touch').className,quality:__CC.G.settings.quality,input:__CC.G.input.tBoost}));assert.ok(mobile.alt>80);assert.equal(mobile.input,false);assert.equal(await m.locator('#tEnterL').innerText(),'LAND');
  await m.screenshot({path:'/tmp/crown-aircraft-mobile.png'});await m.touchscreen.tap(...await m.locator('#tEnter').evaluate(el=>{const r=el.getBoundingClientRect();return[r.x+r.width/2,r.y+r.height/2]}));await m.evaluate(()=>{for(let i=0;i<200;i++)T.tick(__CC.G,1/60);T.render(__CC.G);});assert.equal(await m.evaluate(()=>__CC.G.player.altitude),0);
  console.log('PASS mobile UP touch hold, release, visible LAND and complete landing',mobile);assert.deepEqual(errors,[]);console.log('PASS no browser errors');
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
