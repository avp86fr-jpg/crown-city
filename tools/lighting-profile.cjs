// Isolated render submission cost. This deliberately does not measure presented FPS.
const {chromium}=require('playwright'),fs=require('fs');
const label=process.argv[2]||'lighting',url=process.argv[3]||'http://127.0.0.1:8000/';
(async()=>{const b=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});try{
 const p=await b.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1});
 await p.addInitScript(()=>{window.benchFrame=requestAnimationFrame.bind(window);requestAnimationFrame=()=>0;let seed=817;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};});
 await p.goto(url);await p.waitForFunction(()=>window.__CC,null,{polling:100});
 await p.evaluate(async()=>{window.T=(await import('./src/game.js')).testing;const G=__CC.G;T.startFreeRide(G);Object.assign(G.settings,{quality:'med',autoRes:false,timeSpeed:0,autoFS:false});G.hideHUD=true;G.wanted=0;G.rainAmt=G.fog=G.wet=0;G.peds=[];G.vehicles=[];T.applyQuality(G);T.fit(G);});
 const cdp=await p.context().newCDPSession(p);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});const results=[];
 for(const [name,x,y,time] of [['palace-night',2108,2300,21],['canal-night',6968,3450,21],['palace-day',2108,2300,15]]){
  await p.evaluate(({x,y,time})=>{const G=__CC.G;G.time=time;G.player=T.makeFoot(G,x,y,0);Object.assign(G.cam,{x,y,scale:1.2,rot:0,shake:0});},{x,y,time});
  for(let i=0;i<30;i++){await p.evaluate(()=>T.render(__CC.G));await p.waitForTimeout(30);}
  const result=await p.evaluate(async()=>{
   const G=__CC.G,proto=CanvasRenderingContext2D.prototype,methods=['fillRect','drawImage','fill','stroke','createRadialGradient'],calls={},old={};
   for(const m of methods){old[m]=proto[m];calls[m]=0;proto[m]=function(...args){calls[m]++;return old[m].apply(this,args);};}
   try{T.render(G);}finally{for(const m of methods)proto[m]=old[m];}
   const samples=[];for(let i=0;i<60;i++){await new Promise(benchFrame);G.ticks++;const t=performance.now();T.render(G);samples.push(performance.now()-t);}
   samples.sort((a,b)=>a-b);return {drawCalls:calls,renderP50:samples[30],renderP95:samples[57],renderMean:samples.reduce((a,b)=>a+b,0)/samples.length};
  });results.push({scene:name,...result});console.log(name,JSON.stringify(result));
 }
 fs.writeFileSync(`.qa/world/${label}.json`,JSON.stringify({environment:{quality:'med',viewport:[1280,720],cpuThrottle:4,frames:60,actors:'one fixed player, no traffic or crowds',metric:'render submission milliseconds, one sample per native animation frame; no simulation'},scenarios:results},null,2));
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
