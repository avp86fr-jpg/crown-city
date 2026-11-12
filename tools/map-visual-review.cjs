// Capture the actual shipped renderers at the same authored world locations.
const {chromium}=require('playwright'),fs=require('node:fs');
const url=process.argv[2]||'http://127.0.0.1:8032/';
const places=[['garage',800,3370],['strip',1964,1900],['courts',980,2368],['canal-bridge',6960,2620],['canal-docks',6960,4700],['casino',8200,3200],['airport',8350,7670],['station',10320,4900],['forest',11220,2570],['mountain',11200,8800],['desert',8000,9720],['circuit',4200,8540],['paddock',3500,7520]];
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});fs.mkdirSync('.qa/sustained',{recursive:true});
 try{for(const mode of ['desktop','mobile']){
  const mobile=mode==='mobile',page=await browser.newPage({viewport:mobile?{width:844,height:390}:{width:1280,height:720},isMobile:mobile,hasTouch:mobile}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(()=>{requestAnimationFrame=()=>0;});await page.goto(url);await page.waitForFunction(()=>window.__CC,null,{polling:100});
  await page.evaluate(async mobile=>{window.T=(await import('./src/game.js')).testing;const G=__CC.G;T.startFreeRide(G);G.settings.autoRes=false;G.settings.quality=mobile?'low':'high';G.touch=mobile;G.time=15;G.settings.timeSpeed=0;G.weather='clear';G.weatherT=1e8;G.wet=G.rainAmt=G.fog=0;G.action.messageT=G.toastT=0;T.applyQuality(G);T.fit(G);},mobile);
  const screenshots=[];
  for(const [name,x,y]of places){
   await page.evaluate(({x,y})=>{const G=__CC.G;G.scene='play';G.player=T.makeFoot(G,x,y,0);Object.assign(G.cam,{x,y,rot:0,scale:.85});G.ticks+=600;G._syncTouch();T.fit(G);},{x,y});
   for(let i=0;i<65;i++){await page.evaluate(()=>T.render(__CC.G));await page.waitForTimeout(8);}
   const file=`.qa/sustained/${mode}-${name}.png`;await page.screenshot({path:file});screenshots.push({name,file});
  }
  await page.evaluate(()=>{__CC.G.scene='map';T.render(__CC.G);});await page.screenshot({path:`.qa/sustained/${mode}-map.png`});
  if(errors.length)throw Error(JSON.stringify(errors));
  const sheet=await browser.newPage({viewport:{width:1280,height:Math.ceil(screenshots.length/3)*260}});
  await sheet.setContent('<body style="margin:0;background:#101820;display:grid;grid-template-columns:repeat(3,1fr);gap:6px;color:#fff;font:16px sans-serif">'+screenshots.map(s=>`<div>${mode} / ${s.name}<img style="width:100%" src="${url}${s.file}"></div>`).join(''));
  await sheet.locator('img').evaluateAll(imgs=>Promise.all(imgs.map(im=>im.decode())));await sheet.screenshot({path:`.qa/sustained/${mode}-contact-sheet.png`,fullPage:true});await sheet.close();await page.close();console.log('PASS '+mode+' map and '+places.length+' world locations');
 }}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
