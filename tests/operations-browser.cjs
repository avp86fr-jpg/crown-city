const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
const url=process.env.CC_URL||'http://127.0.0.1:8032/';
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});try{
 const page=await browser.newPage({viewport:{width:1280,height:720},hasTouch:true}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{window.requestAnimationFrame=()=>0;});
 if(process.env.CC_SOURCE==='1')await page.route('**/dist/crown-city.*.js',route=>route.fulfill({contentType:'text/javascript',body:"import '/src/main.js';"}));
 await page.goto(url);await page.waitForFunction(()=>window.__CC,null,{polling:100});
 await page.evaluate(async()=>{window.T=(await import('/src/game.js')).testing;window.A=await import('/src/action.js');window.O=await import('/src/crew_operations.js');window.E=await import('/src/expansion.js');window.hooks={moveFoot:T.moveFoot};window.goStage=(kind='fare')=>{const G=__CC.G,p=O.operationTarget(G,G.action.contract);G.player=kind==='foot'?T.makeFoot(G,p.x,p.y):T.makeVeh(kind,p.x,p.y,0);G.vehicles=kind==='foot'?[]:[G.player];G.waypoint=p;G.gps=null;return G.player;};window.act=seconds=>{for(let t=0;t<seconds;t+=.1)A.tickAction(__CC.G,Math.min(.1,seconds-t),hooks);};T.startFreeRide(__CC.G);});
 const cargo=await page.evaluate(()=>{const G=__CC.G;G.scene='play';G.wanted=0;G.input.fire=false;G.peds=[];G.cops=[];G.vehicles=[];const before=G.chips;A.startContract(G,'coldchain');goStage();act(3.1);G.player.health=90;
  const s=T.snapshot(G),integrity=s.action.contract.integrity;T.restoreState(G,s);const saved=G.action.contract.integrity;for(let i=1;i<=3;i++){goStage();act(3.1);}const paid=G.chips;act(2);return{integrity,saved,payout:paid-before,duplicate:G.chips-paid,complete:G.action.completedJobs.includes('coldchain')};});
 assert.equal(cargo.integrity,86.5);assert.equal(cargo.saved,86.5);assert.equal(cargo.payout,2400);assert.equal(cargo.duplicate,0);assert.equal(cargo.complete,true);
 const failure=await page.evaluate(()=>{const G=__CC.G,before=G.chips;A.startContract(G,'coldchain');goStage();act(3.1);G.player.health=0;act(.1);const failed=G.action.contract===null;A.startContract(G,'coldchain');goStage();act(3.1);return{failed,payout:G.chips-before,retry:G.action.contract.integrity};});assert.deepEqual(failure,{failed:true,payout:0,retry:100});
 const flight=await page.evaluate(()=>{const G=__CC.G;G.action.contract=null;G.wanted=0;const before=G.chips;A.startContract(G,'skytrace');goStage('foot');act(2.1);for(const p of O.SKY_SCANS){G.player=T.makeVeh('plane',p.x-370,p.y,Math.PI/2,{altitude:165,vx:230,vy:0,airspeed:230,lean:0});for(let n=0;n<186;n++){G.player.x+=230/60;A.tickAction(G,1/60,hooks);}}
  const scans=G.action.contract.stage,heat=G.wanted;goStage('plane');G.player.altitude=90;G.player.vx=230;act(.1);G.player.altitude=0;G.player.vx=0;act(2.1);goStage('foot');act(3);const blocked=G.action.contract.stage===5&&G.chips===before;G.wanted=0;act(2.1);const paid=G.chips;act(3);return{scans,heat,blocked,payout:paid-before,duplicate:G.chips-paid};});assert.deepEqual(flight,{scans:4,heat:2,blocked:true,payout:3200,duplicate:0});
 fs.mkdirSync('.qa/operations',{recursive:true});
 // Source/browser rendering checks include both full HUD layouts and the actual
 // menu entry. Checkpoints are repositioned; this is not a manually flown route.
 for(const [name,width,height,id,stage,kind] of [['cargo-desktop',1280,720,'coldchain',1,'fare'],['scan-mobile',844,390,'skytrace',2,'plane'],['cargo-portrait',390,844,'coldchain',2,'fare']]){
  await page.setViewportSize({width,height});await page.evaluate(({width,height,id,stage,kind})=>{const G=__CC.G;G.action.contract=null;G.wanted=0;A.startContract(G,id);G.action.contract.stage=stage;G.action.contract.integrity=84;G.action.contract.progress=1.2;goStage(kind);G.touch=width<1000;G.settings.quality='low';G.action.messageT=0;G.toastT=0;G.banner=null;G.settings.showFps=false;G.time=17;G.input.fire=false;if(kind==='plane')Object.assign(G.player,{altitude:165,vx:230,vy:0,airspeed:230});Object.assign(G.cam,{x:G.player.x,y:G.player.y,rot:0,scale:1});T.fit(G);T.applyQuality(G);E.tickExpansion(G,.01);G._syncTouch();},{width,height,id,stage,kind});
  for(let n=0;n<65;n++){await page.evaluate(()=>T.render(__CC.G));await page.waitForTimeout(8);}
  const texts=await page.evaluate(()=>{const G=__CC.G,out=[],old=G.ctx.fillText;G.ctx.fillText=function(text,...rest){out.push(String(text));return old.call(this,text,...rest);};T.drawHUD(G);G.ctx.fillText=old;return out;});
  assert.ok(texts.some(t=>t.includes(id==='coldchain'?'COLD STORAGE':'SKYLINE GHOST')));assert.ok(texts.some(t=>t.includes(id==='coldchain'?'RECORDER':'KTS 45 [32–60]')));
  await page.screenshot({path:'.qa/operations/'+name+'.png'});
 }
 await page.setViewportSize({width:844,height:390});await page.evaluate(()=>{const G=__CC.G;G.scene='crew';G.crewPage=2;G.action.contract=null;T.fit(G);G._syncTouch();T.render(G);});await page.screenshot({path:'.qa/operations/crew-mobile.png'});
 assert.deepEqual(errors,[]);console.log('PASS real-browser cargo damage/save/retry/payout, three flight scans/runway/handoff, desktop/mobile/portrait mission HUD and crew menu');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
