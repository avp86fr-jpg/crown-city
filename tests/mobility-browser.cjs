// Integrated terrace gameplay: real phone touches, bankroll persistence and rotation.
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
const url=process.env.CC_URL||'http://127.0.0.1:8000/';
fs.mkdirSync('.qa/mobility',{recursive:true});
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 const errors=[],failed=[];
 try{
  const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,deviceScaleFactor:2});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)failed.push(r.url());});
  async function ready(){await page.goto(url);await page.waitForFunction(()=>window.__CC,null,{timeout:60000});await page.evaluate(async()=>{window.T=(await import(new URL('src/game.js',location.href).href)).testing;__CC.G.settings.autoFS=false;});}
  async function tap(label){
   await page.waitForFunction(label=>__CC.G.buttons.some(b=>b.label===label),label);
   const point=await page.evaluate(label=>{const G=__CC.G,b=G.buttons.find(b=>b.label===label),rect=G.canvas.getBoundingClientRect();return {x:rect.left+(b.x+b.w/2)*rect.width/G.canvas.width,y:rect.top+(b.y+b.h/2)*rect.height/G.canvas.height};},label);
   await page.touchscreen.tap(point.x,point.y);
  }
  async function entry(){await page.waitForFunction(()=>document.getElementById('tEnterL').textContent==='PLAY');await page.locator('#tEnter').tap();await page.waitForFunction(()=>__CC.G.scene==='casino');await page.waitForFunction(()=>__CC.G.casino.delay===0);}
  async function state(){return page.evaluate(()=>({scene:__CC.G.scene,chips:__CC.G.chips,casino:JSON.parse(JSON.stringify(__CC.G.casino)),saved:JSON.parse(localStorage.getItem('mw_crown_city_freeride_v1'))}));}
  await ready();await page.evaluate(async()=>{
   const G=__CC.G,{CASINO_TABLE}=await import(new URL('src/casino.js',location.href).href);T.startFreeRide(G);G.settings.timeSpeed=0;G.settings.autoFS=false;G.wanted=0;G.action.contract=null;G.chips=400;
   G.player=T.makeFoot(G,CASINO_TABLE.entryX,CASINO_TABLE.entryY,0);G.cam.x=G.player.x;G.cam.y=G.player.y;G.weatherT=1e9;G.time=15;G.audio.setMaster?.(0);
  });
  await page.waitForFunction(()=>document.getElementById('tEnterL').textContent==='PLAY');await page.screenshot({path:'.qa/mobility/casino-world-portrait.png'});
  await entry();assert.equal((await state()).chips,400);await page.screenshot({path:'.qa/mobility/casino-portrait.png'});
  // Constant RNG produces a real deck with a six-point opening and a safe hit.
  await page.evaluate(()=>{window.casinoRandom=Math.random;Math.random=()=>.01;});
  await tap('DEAL · 20 CHIPS');await page.waitForFunction(()=>__CC.G.casino.round?.phase==='player'&&__CC.G.casino.delay===0);
  let s=await state();assert.equal(s.chips,380);assert.equal(s.saved.chips,380);assert.deepEqual(s.saved.casino.round,s.casino.round);
  const original=s.casino.round;
  await page.reload();await page.waitForFunction(()=>window.__CC,null,{timeout:60000});await page.evaluate(async()=>{window.T=(await import(new URL('src/game.js',location.href).href)).testing;__CC.G.settings.autoFS=false;T.startFreeRide(__CC.G);});
  await page.waitForFunction(()=>__CC.G.scene==='play');s=await state();assert.equal(s.chips,380);assert.deepEqual(s.casino.round,original);await entry();
  await tap('HIT');await page.waitForFunction(()=>__CC.G.casino.round.player.length===3&&__CC.G.casino.delay===0);s=await state();assert.equal(s.chips,380);assert.deepEqual(s.saved.casino.round,s.casino.round);
  await page.setViewportSize({width:844,height:390});await page.waitForTimeout(350);await page.screenshot({path:'.qa/mobility/casino-landscape.png'});
  const layout=await page.evaluate(()=>{const G=__CC.G;return {W:G.canvas.width,H:G.canvas.height,buttons:G.buttons.map(({x,y,w,h,label})=>({x,y,w,h,label})),scroll:document.documentElement.scrollWidth<=innerWidth};});assert.ok(layout.scroll);assert.ok(layout.buttons.every(b=>b.x>=0&&b.y>=0&&b.x+b.w<=layout.W+1&&b.y+b.h<=layout.H+1));
  await tap('STAND');await page.waitForFunction(()=>__CC.G.casino.round.phase==='result');s=await state();assert.equal(s.casino.round.outcome,'win');assert.equal(s.chips,420);assert.equal(s.saved.chips,420);assert.equal(s.casino.played,1);
  await page.screenshot({path:'.qa/mobility/casino-result-landscape.png'});await tap('LEAVE TABLE');await page.waitForFunction(()=>__CC.G.scene==='play');s=await state();assert.equal(s.chips,420);assert.equal(s.casino.played,1);
  // Another live hand is automatically stood/settled when the player leaves.
  await entry();await page.evaluate(()=>{Math.random=()=>.01;});await tap('DEAL · 20 CHIPS');await page.waitForFunction(()=>__CC.G.casino.round.phase==='player'&&__CC.G.casino.delay===0);await tap('STAND & LEAVE');await page.waitForFunction(()=>__CC.G.scene==='play');s=await state();assert.equal(s.casino.round.phase,'result');assert.equal(s.chips,400);assert.equal(s.saved.chips,400);assert.equal(s.casino.played,2);
  await page.reload();await page.waitForFunction(()=>window.__CC,null,{timeout:60000});await page.evaluate(async()=>{const T=(await import(new URL('src/game.js',location.href).href)).testing;T.startFreeRide(__CC.G);});s=await state();assert.equal(s.chips,400);assert.equal(s.casino.played,2);
  assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
  console.log('PASS real touch PLAY, deal, reload exact live hand, hit, stand, single payout, leave settlement and settled reload');
  console.log('PASS portrait390x844 / landscape844x390 screenshots, button bounds and no browser errors');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
