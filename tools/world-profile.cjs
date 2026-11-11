// Actual touch-input comparison across four world locations. No device-FPS claim.
const {chromium}=require('playwright'),fs=require('fs');
const label=process.argv[2]||'world',url=process.argv[3]||'http://127.0.0.1:8000/';
const percentile=(a,p)=>a.length?[...a].sort((x,y)=>x-y)[Math.min(a.length-1,Math.floor(a.length*p))]:0;
(async()=>{const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});try{
 const p=await browser.newPage({viewport:{width:844,height:390},hasTouch:true,isMobile:true,deviceScaleFactor:2});
 await p.addInitScript(()=>{
  let seed=77123;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const raf=requestAnimationFrame.bind(window);window.__frameBench={on:false,samples:[]};
  window.requestAnimationFrame=cb=>raf(t=>{const b=__frameBench,G=window.__CC?.G,frames=G?.renderCount||0,ticks=G?.ticks||0,start=performance.now();cb(t);if(b.on&&G){const shown=(G.renderCount||0)>frames;b.samples.push({work:performance.now()-start,gap:b.last?t-b.last:0,present:shown&&b.lastShown?t-b.lastShown:0,ticks:G.ticks-ticks,shown,touch:G.touch});b.last=t;if(shown)b.lastShown=t;}});
 });
 await p.goto(url);await p.waitForFunction(()=>window.__CC);await p.evaluate(()=>__CC.G.settings.autoFS=false);await p.touchscreen.tap(800,100);
 await p.evaluate(async()=>{window.T=(await import('./src/game.js')).testing;T.startFreeRide(__CC.G);Object.assign(__CC.G.settings,{quality:'low',autoRes:false,timeSpeed:0});__CC.G.resScale=1;T.applyQuality(__CC.G);T.fit(__CC.G);});
 const cdp=await p.context().newCDPSession(p);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});const result={environment:{viewport:[844,390],dpr:2,cpuThrottle:4,quality:'low',autoResolution:false,seed:77123,input:'CDP touch drag; no keyboard events',sampleSeconds:4},scenarios:[]};
 for(const scene of ['boulevard','regional','forest','airfield']){
  await p.evaluate(scene=>{const G=__CC.G;G.scene='play';G.wanted=0;G.health=100;G._endT=0;G.touch=true;G.weather='clear';G.rainAmt=G.wet=G.fog=0;G.weatherT=1e8;G.time=scene==='boulevard'?21:16.5;G.action.contract=null;G.contactTalk=null;G.action.messageT=0;G.toastT=0;G.cam.rot=0;
   if(scene==='boulevard'||scene==='airfield'){const kind=scene==='airfield'?'plane':'riot',v=G.vehicles.find(v=>v.kind===kind&&!v.dead);T.enterVeh(G,v,true);Object.assign(v,{x:scene==='airfield'?6900:2108,y:scene==='airfield'?7500:2700,rot:scene==='airfield'?Math.PI/2:0,vx:0,vy:0,altitude:0,airspeed:0,landing:false});}
   else{const at=scene==='regional'?{x:10215,y:4984}:T.findSafe(G,11220,2570,8,true);G.player=T.makeFoot(G,at.x,at.y,0);}
   G.cam.x=G.player.x;G.cam.y=G.player.y;G.cam.scale=1;G._syncTouch();T.render(G);
  },scene);
  await p.waitForTimeout(2500);
  const drawCalls=await p.evaluate(()=>{const methods=['fillRect','stroke','fill','drawImage','fillText','measureText'],proto=CanvasRenderingContext2D.prototype,originals={},counts={};for(const name of methods){originals[name]=proto[name];counts[name]=0;proto[name]=function(...args){counts[name]++;return originals[name].apply(this,args);};}try{T.render(__CC.G);}finally{for(const name of methods)proto[name]=originals[name];}return counts;});
  const box=await p.locator('#joy').boundingBox(),origin={x:box.x+box.width/2,y:box.y+box.height/2,id:9};
  if(scene!=='regional'){await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[origin]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...origin,x:origin.x+(scene==='airfield'?55:0),y:origin.y-(scene==='airfield'?0:55)}]});}
  const start=await p.evaluate(()=>{Object.assign(__frameBench,{on:true,samples:[],last:0,lastShown:0});return {t:performance.now(),ticks:__CC.G.ticks,frames:__CC.G.renderCount};});await p.waitForTimeout(4000);
  const data=await p.evaluate(start=>{__frameBench.on=false;const G=__CC.G;return {seconds:(performance.now()-start.t)/1000,ticks:G.ticks-start.ticks,frames:G.renderCount-start.frames,samples:__frameBench.samples,touch:G.touch,peds:G.peds.length,vehicles:G.vehicles.length,position:[G.player.x,G.player.y],altitude:G.player.altitude||0,prof:G.prof,tiles:G.mobileRenderStats};},start);
  if(scene!=='regional')await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});if(!data.touch||data.samples.some(s=>!s.touch))throw Error('Profile lost touch mode');
  const present=data.samples.filter(s=>s.present).map(s=>s.present),work=data.samples.map(s=>s.work);
  result.scenarios.push({scene,...data,samples:undefined,drawCalls,workMsPerSecond:work.reduce((a,b)=>a+b,0)/data.seconds,presentedFps:data.frames/data.seconds,workP50:percentile(work,.5),workP95:percentile(work,.95),frameP50:percentile(present,.5),frameP95:percentile(present,.95),over50ms:present.filter(v=>v>50).length});
  console.log(scene,JSON.stringify({fps:data.frames/data.seconds,workP50:percentile(work,.5),workP95:percentile(work,.95),touch:data.touch,tiles:data.tiles}));
 }
 fs.mkdirSync('.qa/world',{recursive:true});fs.writeFileSync(`.qa/world/${label}.json`,JSON.stringify(result,null,2));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
