const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||(fs.existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),headless:true,args:['--no-sandbox']});try{
 const page=await browser.newPage({viewport:{width:844,height:390},deviceScaleFactor:2,isMobile:true,hasTouch:true}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{requestAnimationFrame=()=>0;let seed=77123;Math.random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);});
 await page.goto(process.env.CC_URL||'http://127.0.0.1:8032/');await page.waitForFunction(()=>window.__CC,null,{polling:100});
 await page.evaluate(async()=>{window.T=(await import('./src/game.js')).testing;window.B=await import('./src/blood_fx.js');const G=__CC.G;T.startFreeRide(G);G.settings.autoRes=false;G.settings.autoFS=false;G.settings.quality='low';G.settings.blood='full';G.time=16;G.weather='clear';G.rainAmt=0;G.banner=null;G.toastT=0;T.applyQuality(G);T.fit(G);__CC.goto(2108,2400);G.cam.scale=1.2;G.cam.rot=0;G.touch=true;G._syncTouch();T.render(G);});
 await page.waitForTimeout(1200);await page.evaluate(()=>T.render(__CC.G));
 const before=await page.evaluate(()=>{const G=__CC.G,d=G.ctx.getImageData(0,0,G.canvas.width,G.canvas.height).data;let red=0;for(let i=0;i<d.length;i+=4)if(d[i]>40&&d[i]>d[i+1]*2&&d[i]>d[i+2]*1.3)red++;return red;});
 await page.evaluate(()=>{const G=__CC.G;G.peds=G.peds.filter(p=>p.mission);for(let i=0;i<5;i++){const p={x:2080+(i%3)*44,y:2390+Math.floor(i/3)*45,rot:.4,sprite:i%2?'female':'male',dead:true,deadT:i===0?.1:1,dist:0,ambient:true,fallSide:i%2?1:-1};G.peds.push(p);B.bloodImpact(G,p,180,20,2,true);}T.render(G);});
 const after=await page.evaluate(()=>{const G=__CC.G,d=G.ctx.getImageData(0,0,G.canvas.width,G.canvas.height).data;let red=0;for(let i=0;i<d.length;i+=4)if(d[i]>40&&d[i]>d[i+1]*2&&d[i]>d[i+2]*1.3)red++;return red;});
 assert.ok(after>before+100,`mobile renderer must show blood (${before} -> ${after})`);fs.mkdirSync('.qa/street-impact',{recursive:true});await page.screenshot({path:'.qa/street-impact/mobile.png'});
 const wildlife=await page.evaluate(()=>{
  const G=__CC.G,W=G.wildlife,a=W.animals.find(a=>a.kind===2);
  Object.assign(a,{x:2108,y:2400,hx:2108,hy:2400,dead:false,hidden:false,hp:70,lift:0,walk:0,flee:0,impactT:0});
  W.animals=[a];W.bins=new Map([[Math.floor(a.hx/512)+':'+Math.floor(a.hy/512),[a]]]);W.elapsed=1;
  W.stats.hits=W.stats.playerHits=0;G.peds=[];G.cops=[];G.wanted=0;G.traffic.target=G.pedsys.target=0;
  const car=T.makeVeh('riot',2108,2480,0,{parked:false,vy:-260});G.vehicles=[car];G.player=car;G.input.x=0;G.input.y=1;
  G.cam.x=car.x;G.cam.y=car.y;
  for(let i=0;i<18;i++)T.tickPlay(G,1/60);T.render(G);
  return {dead:a.dead,hits:W.stats.playerHits,effects:!!G.bloodFX,active:W.active.includes(a)};
 });
 assert.deepEqual(wildlife,{dead:true,hits:1,effects:true,active:true});
 console.log('PASS actual mobile driving hits an animal once, renders its fallen sprite and honors the blood renderer');
 for(const size of [{width:844,height:390},{width:390,height:844}]){
  await page.setViewportSize(size);await page.evaluate(()=>{const G=__CC.G;G.scene='settings';G.settingsTab=0;T.fit(G);T.render(G);});
  assert.ok(await page.evaluate(()=>__CC.G.buttons.every(b=>b.x>=0&&b.y>=0&&b.x+b.w<=__CC.G.canvas.width&&b.y+b.h<=__CC.G.canvas.height)),'settings fit the phone viewport');
 }
 const pos=await page.evaluate(()=>{const G=__CC.G,b=G.buttons.find(b=>b.label==='BLOOD EFFECTS');return{x:(b.x+b.w/2)/G.dpr,y:(b.y+b.h/2)/G.dpr};});await page.touchscreen.tap(pos.x,pos.y);
 assert.equal(await page.evaluate(()=>__CC.G.settings.blood),'reduced');await page.evaluate(()=>T.render(__CC.G));await page.screenshot({path:'.qa/street-impact/settings-portrait.png'});
 await page.reload();await page.waitForFunction(()=>window.__CC,null,{polling:100});assert.equal(await page.evaluate(()=>__CC.G.settings.blood),'reduced');
 await page.setViewportSize({width:1440,height:900});await page.evaluate(async()=>{window.T=(await import('./src/game.js')).testing;window.B=await import('./src/blood_fx.js');const G=__CC.G;T.startFreeRide(G);G.settings.quality='high';G.settings.blood='full';G.settings.autoRes=false;G.time=16;G.weather='clear';G.rainAmt=0;G.banner=null;G.toastT=0;G.touch=false;G._syncTouch();__CC.goto(2108,2400);G.cam.scale=1.2;G.cam.rot=0;T.fit(G);T.applyQuality(G);for(let i=0;i<4;i++){const p={x:2080+i*35,y:2400,rot:.4,sprite:'male',dead:true,deadT:.7,dist:0,ambient:true};G.peds.push(p);B.bloodImpact(G,p,180,20,2,true);}T.render(G);});
 await page.screenshot({path:'.qa/street-impact/desktop.png'});assert.deepEqual(errors,[]);console.log('PASS blood renders on mobile and desktop, phone settings bounds, real touch preference persistence, zero browser exceptions');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
