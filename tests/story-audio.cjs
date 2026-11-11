const {chromium}=require('playwright'),assert=require('node:assert/strict');
const url=process.env.CC_URL||'http://127.0.0.1:8000/';
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 try{for(const fallback of [false,true]){
  const context=await browser.newContext({viewport:{width:844,height:390},hasTouch:true,isMobile:true}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  if(fallback)await page.route('**/return-to-crown.ogg',route=>route.abort());
  await page.addInitScript(()=>{window.__media=[];window.Audio=new Proxy(Audio,{construct(Target,args){const el=Reflect.construct(Target,args);__media.push(el);return el;}});});
  await page.goto(url);await page.waitForFunction(()=>!!window.__CC);
  const start=await page.evaluate(async()=>{window.T=(await import(new URL('src/game.js',location.href).href)).testing;const G=__CC.G;G.settings.autoFS=false;const b=G.buttons.find(b=>b.label==='NEW GAME');return{x:(b.x+b.w/2)/G.dpr,y:(b.y+b.h/2)/G.dpr};});
  await page.touchscreen.tap(start.x,start.y);
  await page.waitForFunction(()=>__CC.G.audio.recordedMusic&&__CC.G.audio.trackTitle.startsWith('RETURN TO CROWN')&&__media.some(e=>e.src.includes('return-to-crown')&&!e.paused&&e.currentTime>.25));
  const track=await page.evaluate(()=>{const a=__media.find(e=>e.src.includes('return-to-crown'));return{src:a.src,duration:a.duration,streams:__CC.G.audio.activeStreams};});
  assert.match(track.src,fallback?/return-to-crown\.mp3$/:/return-to-crown\.ogg$/);assert.ok(track.duration>=59&&track.duration<62);assert.ok(track.streams<=2);
  await page.evaluate(()=>{const G=__CC.G;G.settings.mus=0;G.audio.setMus(0);});await page.waitForFunction(()=>__CC.G.audio.activeStreams===0);assert.ok(await page.evaluate(()=>__media.every(e=>e.paused)));
  await page.evaluate(()=>{const G=__CC.G;G.settings.mus=.6;G.audio.setMus(.6);});await page.waitForFunction(()=>__CC.G.audio.recordedMusic&&__CC.G.audio.activeStreams>0);
  await page.evaluate(()=>{const G=__CC.G;G.wanted=3;G.scene='play';});
  await page.waitForFunction(()=>__CC.G.audio.recordedMusic&&__CC.G.audio.trackTitle.startsWith('NO CLEAN EXIT'));assert.ok(await page.evaluate(()=>__CC.G.audio.activeStreams<=2));
  await page.waitForFunction(()=>__CC.G.audio.activeStreams===1);assert.deepEqual(errors,[]);
  console.log(`PASS story score decodes ${fallback?'MP3 after Ogg failure':'Ogg'}, mutes, resumes and crossfades into pursuit within two streams`);
  await context.close();
 }}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
