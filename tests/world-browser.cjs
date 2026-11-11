const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('fs');
const url=process.env.CC_URL||'http://127.0.0.1:8000/';
(async()=>{const b=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});try{
 const p=await b.newPage({viewport:{width:844,height:390},deviceScaleFactor:2,hasTouch:true,isMobile:true}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 let tileRequests=0;await p.route('**/assets/mobile/day/3_0.webp',route=>{tileRequests++;return tileRequests===1?route.fulfill({status:503,body:'intentional cache recovery test'}):route.continue();});
 await p.addInitScript(()=>requestAnimationFrame=()=>0);await p.goto(url);await p.waitForFunction(()=>window.__CC,null,{polling:100});
 await p.evaluate(async()=>{window.T=(await import('./src/game.js')).testing;window.R=await import('./src/transit.js');const G=__CC.G;T.startFreeRide(G);Object.assign(G.settings,{quality:'low',autoFS:false,autoRes:false,timeSpeed:0});G.time=12;G.touch=true;G.hideHUD=true;G.weather='clear';G.weatherT=1e8;G.rainAmt=G.sand=G.fog=G.wet=0;T.applyQuality(G);T.fit(G);});
 const place=async(x,y,scale=1)=>p.evaluate(({x,y,scale})=>{const G=__CC.G,at=T.findSafe(G,x,y,8,true);G.player=T.makeFoot(G,at.x,at.y,0);Object.assign(G.cam,{x,y,scale,rot:0});G.wanted=0;G.contactTalk=null;G.contactNear=null;G.transit.near=null;G._syncTouch();T.render(G);},{x,y,scale});
 const warm=async(n=30)=>{for(let i=0;i<n;i++){await p.evaluate(()=>T.render(__CC.G));await p.waitForTimeout(25);}};
 await place(3350,400);await warm(12);assert.equal(tileRequests,1);
 await p.evaluate(()=>{const G=__CC.G;for(let i=0;i<80;i++){G.ticks++;T.render(G);}});assert.equal(tileRequests,1,'failed tile must back off');
 await p.evaluate(()=>{__CC.G.ticks+=601;T.render(__CC.G);});await warm(10);assert.equal(tileRequests,2);assert.ok(await p.evaluate(()=>__CC.G.mobileTiles.get('3:0:false')?.image));console.log('PASS a failed mobile tile retries after a delay and recovers');
 fs.mkdirSync('.qa/world',{recursive:true});
 for(const [name,x,y,scale] of [
  ['mobile-forest',11220,2570,1.1],['mobile-rangers',11280,4940,1.35],['mobile-casino',8120,3200,.9],['mobile-canal',6968,3450,1.05],
  ['mobile-airport',8240,7650,.65],['mobile-red-mesa',5650,9720,1],['mobile-rescue',11200,9580,1.2],['mobile-regional',10320,4900,1.05],['mobile-metro',6250,3480,1.2],
 ]){
  await place(x,y,scale);await warm();const stat=await p.evaluate(()=>__CC.G.mobileRenderStats);
  assert.equal(stat.outerPending,0,name);assert.ok(stat.outerTiles<=stat.outerLimit,name);assert.ok(stat.groundChunks<=stat.groundLimit,name);assert.equal(await p.evaluate(()=>__CC.G.touch),true);
  await p.screenshot({path:`.qa/world/${name}.png`});
 }
 console.log('PASS nine distant locations stream fully with bounded outer and ground caches');
 const builds=await p.evaluate(()=>__CC.G.stationArtBuilds);await p.evaluate(()=>{for(let i=0;i<90;i++){__CC.G.time=17+i/30;T.render(__CC.G);}});assert.equal(await p.evaluate(()=>__CC.G.stationArtBuilds),builds);console.log('PASS station artwork is reused through dusk');
 await p.evaluate(()=>{const G=__CC.G,e=R.stationExit(R.STATIONS[1]);G.player=T.makeFoot(G,e.x,e.y,0);G.cam.x=e.x;G.cam.y=e.y;G.chips=1000;G.hideHUD=false;G.action.contract={id:'clockwork',stage:1,t:120,progress:0};G.waypoint={x:6130,y:3555};G.weatherT=100;G.weather='rain';G.time=20;T.tick(G,1/60);G._syncTouch();T.render(G);});
 await p.locator('#tEnter').tap();await p.evaluate(()=>{T.tick(__CC.G,1/60);T.render(__CC.G);});
 const tapButton=async(label)=>{const pos=await p.evaluate(label=>{const G=__CC.G,button=G.buttons.find(b=>b.label?.includes(label));if(!button)throw Error('missing '+label);return{x:(button.x+button.w/2)/G.dpr,y:(button.y+button.h/2)/G.dpr};},label);await p.touchscreen.tap(pos.x,pos.y);};
 await tapButton('AIRFIELD EAST');await p.evaluate(()=>{for(let i=0;i<430;i++)T.tick(__CC.G,1/60);T.render(__CC.G);});await tapButton('SKIP JOURNEY');
 const arrived=await p.evaluate(()=>({scene:__CC.G.scene,point:__CC.G.waypoint,weather:__CC.G.weatherT,remaining:__CC.G.action.contract.t,near:__CC.G.transit.near.id}));assert.equal(arrived.scene,'play');assert.deepEqual(arrived.point,{x:6130,y:3555});assert.ok(arrived.weather<80&&arrived.weather>60);assert.ok(arrived.remaining>80&&arrived.remaining<100);assert.equal(arrived.near,'airfield');console.log('PASS real touch train journey preserves its mission route and advances weather/time');
 await place(8350,7500,.8);await p.evaluate(()=>{__CC.G.time=21;__CC.G.hideHUD=true;__CC.G.settings.reducedMotion=true;T.render(__CC.G);});await warm();await p.screenshot({path:'.qa/world/mobile-runway-night.png'});
 assert.ok(await p.evaluate(()=>__CC.G.street.atlas&&__CC.G.street.revision>0));assert.deepEqual(errors,[]);console.log('PASS new scenery assets, runway night rendering and no browser exceptions');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
