const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
const url=process.env.CC_URL||'http://127.0.0.1:8032/';
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||(fs.existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:1000,height:600},hasTouch:true,isMobile:true}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>requestAnimationFrame=()=>0);await page.goto(url);await page.waitForFunction(()=>window.__CC,null,{polling:100});
  await page.evaluate(async()=>{window.T=(await import('./src/game.js')).testing;window.WM=await import('./src/water_motion.js');window.WE=await import('./src/world_effects.js');const G=__CC.G;T.startFreeRide(G);G.touch=true;G.hideHUD=true;G.settings.autoRes=false;G.settings.timeSpeed=0;G.weatherT=1e8;G.weather='clear';G.rainAmt=G.fog=G.sand=G.wet=0;});
  fs.mkdirSync('.qa/materials',{recursive:true});
  for(const quality of ['low','high']){
   await page.evaluate(quality=>{const G=__CC.G;G.settings.quality=quality;T.applyQuality(G);T.fit(G);},quality);
   for(const [place,x,y] of [['sea',5520,430],['canal',6960,3460],['forest',11220,2570],['desert',8000,9720],['casino',8200,3200],['harbour',2300,330]]){
    await page.evaluate(({x,y})=>{const G=__CC.G;G.time=14;G.player=T.makeFoot(G,x,y,0);if(G.codeAt(x,y)===3||G.codeAt(x,y)===8){const boat=G.vehicles.find(v=>v.def.boat&&!v.dead);if(boat)T.enterVeh(G,boat,true);}Object.assign(G.cam,{x,y,scale:1,rot:0});G._syncTouch();},{x,y});
    for(let i=0;i<50;i++){await page.evaluate(()=>{__CC.G.ticks++;T.render(__CC.G);});await page.waitForTimeout(15);}
    const result=await page.evaluate(()=>({water:__CC.G.waterMotionStats,render:__CC.G.mobileRenderStats,materials:__CC.G.ground.materialsReady}));
    assert.ok(result.materials);
    if(place==='sea'||place==='canal')assert.ok(result.water.waves>0,quality+' '+place+' live water');
    if(quality==='low')assert.equal(result.render.outerPending,0,place);
    await page.screenshot({path:`.qa/materials/${quality}-${place}.png`});
   }
   // Source-based smoke: find a real industrial roof, then check day/night.
   await page.evaluate(()=>{const G=__CC.G,b=G.world.buildings.find(b=>b.kind==='warehouse'&&WE.smokeOrigin(b));if(!b)throw Error('no smoke fixture');G.player=T.makeFoot(G,b.x,b.y,0);Object.assign(G.cam,{x:b.x+b.w/2,y:b.y+b.h/2,scale:1,rot:0});});
   for(const hour of [14,22]){
    await page.evaluate(hour=>{__CC.G.time=hour;},hour);
    for(let i=0;i<35;i++){await page.evaluate(()=>{__CC.G.ticks+=2;T.render(__CC.G);});await page.waitForTimeout(15);}
    const atmosphere=await page.evaluate(()=>__CC.G.atmosphereStats);assert.ok(atmosphere.plumes>0);assert.ok(atmosphere.puffs<=(quality==='low'?15:56));
    await page.screenshot({path:`.qa/materials/${quality}-smoke-${hour}.png`});
   }
   // Isolate water animation to verify pixel motion without actors or weather.
   const pixels=await page.evaluate(()=>{
    const G=__CC.G,old=G.ctx,c=document.createElement('canvas');c.width=512;c.height=256;G.ctx=c.getContext('2d');G.ctx.translate(-5200,-220);
    const rect={x0:5200,y0:220,x1:5712,y1:476};
    const frame=t=>{G.ticks=t;G.ctx.clearRect(5200,220,512,256);for(let i=0;i<8;i++)WM.drawWaterMotion(G,rect);return c.toDataURL();};
    G.settings.reducedMotion=false;const a=frame(120),b=frame(240);
    G.settings.reducedMotion=true;const stillA=frame(400),stillB=frame(700);G.settings.reducedMotion=false;G.ctx=old;return {moving:a!==b,still:stillA===stillB};
   });assert.ok(pixels.moving);assert.ok(pixels.still);
   if(quality==='high'){
    await page.evaluate(()=>{const G=__CC.G;G.player=T.makeFoot(G,1964,1900,0);Object.assign(G.cam,{x:1964,y:1300,scale:.4,rot:0});G.time=14;});
    for(let i=0;i<30;i++){await page.evaluate(()=>T.render(__CC.G));await page.waitForTimeout(15);}
    const distant=await page.evaluate(()=>({tiles:__CC.G.ground.coreFinish.distant.size,near:__CC.G.ground.coreFinish.cache.size,unused:[1,2,3].map(i=>__CC.G.assets.layers['water'+i].img.size)}));
    assert.ok(distant.tiles>0&&distant.tiles<=16);assert.ok(distant.near<=48);assert.deepEqual(distant.unused,[0,0,0]);
    await page.screenshot({path:'.qa/materials/high-distant-city.png'});
   }
   console.log('PASS '+quality+' terrain, sea/canal motion, real vent sources, day/night and reduced motion');
  }
  assert.deepEqual(errors,[]);console.log('PASS no browser exceptions');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
