// Isolated source-module Web Audio QA with real mobile Chromium, independent of the current bundle.
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 const errors=[],report={};fs.mkdirSync('.qa/mobility',{recursive:true});
 try{
  const page=await browser.newPage({viewport:{width:844,height:390},isMobile:true,hasTouch:true});page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/__audioqa',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><button id="start">START SOUND</button>'}));
  await page.goto(new URL('__audioqa',process.env.CC_URL||'http://127.0.0.1:8000/').href);
  await page.evaluate(async()=>{
   window.Audio=undefined;const {createAudio}=await import(new URL('src/audio.js',location.href).href);window.A=createAudio();A.setLite(true);A.setMus(0);
   window.counts={sources:0,ended:0,convolvers:0};for(const method of ['createBufferSource','createOscillator']){const original=AudioContext.prototype[method];AudioContext.prototype[method]=function(...args){const s=original.apply(this,args);counts.sources++;s.addEventListener('ended',()=>counts.ended++);return s;};}const original=AudioContext.prototype.createConvolver;AudioContext.prototype.createConvolver=function(...args){counts.convolvers++;return original.apply(this,args);};
   document.querySelector('#start').onclick=()=>{A.unlock();const stream=A.tap(),source=A.ctx.createMediaStreamSource(stream);window.analyser=A.ctx.createAnalyser();analyser.fftSize=1024;source.connect(analyser);const silent=A.ctx.createGain();silent.gain.value=0;analyser.connect(silent);silent.connect(A.ctx.destination);};
   window.G={scene:'play',player:{type:'foot',x:6000,y:2400,rot:0,speed:0},cam:{rot:0},input:{y:0,brake:false,touchJoy:{active:false}},settings:{mus:0},vehicles:[],peds:[],wanted:0,time:15,wet:0,district:'MIDTOWN',surfaceAt:()=> 'walk'};
   window.read=async()=>{let peak=0,total=0,n=0;const data=new Float32Array(analyser.fftSize);for(let i=0;i<12;i++){analyser.getFloatTimeDomainData(data);for(const v of data){peak=Math.max(peak,Math.abs(v));total+=v*v;n++;}await new Promise(r=>setTimeout(r,20));}return{rms:Math.sqrt(total/n),peak,stats:A.soundStats(),counts:{...counts}};};
  });
  await page.locator('#start').tap();await page.waitForFunction(()=>A.ctx?.state==='running');
  report.init=await page.evaluate(()=>({stats:A.soundStats(),counts:{...counts}}));assert.equal(report.init.counts.sources,19);assert.equal(report.init.counts.convolvers,0);
  await page.evaluate(()=>{G.player={...G.player,type:'veh',kind:'heli',def:{aircraft:true,helicopter:true,max:310},vx:0,vy:-180,altitude:120,airspeed:180,rotor:1};A.setRain(1);window.tick=setInterval(()=>A.update(G,1/15),1000/15);});
  await page.waitForTimeout(1500);report.heli=await page.evaluate(()=>read());assert.ok(report.heli.rms>.005);assert.ok(report.heli.stats.rotorDepth>.25);assert.equal(report.heli.counts.sources,19);
  await page.evaluate(()=>{G.scene='pause';});await page.waitForTimeout(3500);report.pause=await page.evaluate(()=>read());assert.ok(report.pause.rms<.001);for(const k of ['rotorDepth','reverseLevel','railLevel','rainLevel','windLevel'])assert.ok(report.pause.stats[k]<.001,k);
  await page.evaluate(()=>{G.scene='casino';A.casino('chips');A.casino('card');});report.casino=await page.evaluate(()=>read());assert.ok(report.casino.peak>.005);await page.waitForTimeout(500);assert.equal((await page.evaluate(()=>A.soundStats())).effects.voices,0);
  await page.evaluate(()=>{A.casino('win');A.setMaster(0);});await page.waitForTimeout(150);report.mute=await page.evaluate(()=>read());assert.ok(report.mute.peak<.00001);const sources=report.mute.counts.sources;await page.evaluate(()=>{A.casino('open');A.horn();A.ui();});assert.equal(await page.evaluate(()=>counts.sources),sources);
  await page.evaluate(()=>{A.setMaster(.9);A.setRain(0);G.scene='play';G.player={type:'veh',x:6000,y:2400,rot:0,speed:0,def:{kind:'sedan',max:220},vx:0,vy:70};});await page.waitForTimeout(1000);report.reverse=await page.evaluate(()=>read());assert.ok(report.reverse.stats.reverseLevel>.015);assert.ok(report.reverse.rms>.004);
  await page.evaluate(()=>{G.scene='train';G.transit={ride:{elapsed:5,duration:26}};});await page.waitForTimeout(400);report.boarding=await page.evaluate(()=>read());assert.ok(report.boarding.stats.railLevel<.001);
  await page.evaluate(()=>{G.transit.ride.elapsed=12;});await page.waitForTimeout(1000);report.riding=await page.evaluate(()=>read());assert.ok(report.riding.stats.railLevel>.12);
  await page.evaluate(()=>{G.transit.ride.elapsed=25;});await page.waitForTimeout(1200);report.alighting=await page.evaluate(()=>read());assert.ok(report.alighting.stats.railLevel<.001);
  await page.evaluate(()=>{A.setLite(false);A.setLite(true);A.setLite(false);});assert.equal(await page.evaluate(()=>counts.convolvers),1);
  await page.evaluate(()=>{G.scene='pause';A.boom();});await page.waitForTimeout(350);await page.evaluate(()=>A.setSfx(0));await page.waitForTimeout(180);report.sfxMute=await page.evaluate(()=>read());assert.ok(report.sfxMute.peak<.00001,'reverb must obey SFX mute');
  await page.evaluate(()=>{clearInterval(tick);A.setMaster(0);});await page.waitForTimeout(2500);report.final=await page.evaluate(()=>read());assert.equal(report.final.stats.effects.voices,0);assert.equal(report.final.counts.sources-report.final.counts.ended,19);assert.deepEqual(errors,[]);
  fs.writeFileSync('.qa/mobility/audio-browser.json',JSON.stringify(report,null,2));console.log('PASS real mobile Chromium: 19 reused sources, no low-tier convolution, audible rotor/casino/reverse, pause fade, true SFX/master silence including reverb, one-shot cleanup and no Web Audio errors');console.log(JSON.stringify({heliRMS:report.heli.rms,pauseRMS:report.pause.rms,casinoPeak:report.casino.peak,mutedPeak:report.mute.peak,reverseRMS:report.reverse.rms,liveSources:report.final.counts.sources-report.final.counts.ended}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
