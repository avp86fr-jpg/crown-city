// Real-time RAF soak. Emulation compares builds; it is not a Redmi benchmark.
// node tools/sustained-profile.cjs LABEL URL [seconds=360] [cpu=4] [idle|flight|street]
const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path');
(async()=>{
 const [label='soak',url='http://127.0.0.1:8032/',seconds='360',cpu='4',route='idle']=process.argv.slice(2);
 const out=path.resolve('.qa/sustained');fs.mkdirSync(out,{recursive:true});
 const browser=await chromium.launch({executablePath:process.env.CHROME||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--enable-precise-memory-info']});
 try{
  const page=await browser.newPage({viewport:{width:844,height:390},deviceScaleFactor:2,isMobile:true,hasTouch:true});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{let seed=77123;Math.random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);});
  await page.goto(url);await page.waitForFunction(()=>window.__CC);
  await page.evaluate(async(route)=>{
   window.T=(await import('./src/game.js')).testing;__CC.startFreeRide();const G=__CC.G;
   G.settings.quality='low';G.settings.autoRes=true;G.settings.timeSpeed=0;G.time=21;G.rainAmt=.5;G.wet=.7;G.weather='rain';G.weatherT=1e8;T.fit(G);T.applyQuality(G);
   __CC.goto(2108,2600);G.player.rot=0;
   if(route==='flight'){
    const plane=G.vehicles.find(v=>v.kind==='plane');T.enterVeh(G,plane,true);Object.assign(plane,{x:2108,y:2600,rot:Math.PI/2,vx:300,vy:0,airspeed:300,altitude:220,verticalSpeed:0});G.cam.x=plane.x;G.cam.y=plane.y;
    const points=[[10000,2400],[11000,7000],[7600,8600],[2200,8600],[2108,2600]];let goal=0;
    const pulse=G._pulseInput;G._pulseInput=()=>{pulse();const at=points[goal];if(Math.hypot(at[0]-plane.x,at[1]-plane.y)<380)goal=(goal+1)%points.length;const error=Math.atan2(at[0]-plane.x,-(at[1]-plane.y))-plane.rot;G.input.x=Math.max(-1,Math.min(1,Math.atan2(Math.sin(error),Math.cos(error))*1.6));G.input.y=.7;G.input.keyDrive=true;G.input.touchJoy.active=false;};
   }
   if(route==='street'){
    // Alternate dense streets and streaming boundaries. Repeated real bullet
    // impacts exercise casualty reactions, response vehicles and effect expiry.
    const points=[[2108,2400],[1900,3450],[5600,2600],[10500,7500],[2108,2400],[3100,1800],[8000,8600],[2108,2400]];
    let nextMove=G.ticks+45*60,nextShot=G.ticks+180,point=0;
    const pulse=G._pulseInput;G._pulseInput=()=>{pulse();G.health=100;
      if(G.ticks>=nextMove){point=(point+1)%points.length;__CC.goto(...points[point]);nextMove=G.ticks+45*60;}
      if(G.ticks>=nextShot){nextShot=G.ticks+180;
        const p=G.peds.find(p=>!p.dead&&!p.mission&&!p.copPed&&Math.hypot(p.x-G.player.x,p.y-G.player.y)<550);
        if(p){G.bullets.push({x:p.x-16,y:p.y,vx:600,vy:0,life:.2,friend:true,damage:200});T.tickBullets(G,1/30);}
      }
    };
   }

   window.soak={last:performance.now(),frames:[],prof:[],start:performance.now(),startFrames:G.renderCount,startTicks:G.ticks};
   const sample=t=>{soak.frames.push(t-soak.last);soak.last=t;soak.prof.push({...G.prof});requestAnimationFrame(sample);};requestAnimationFrame(sample);
  },route);
  await page.touchscreen.tap(420,190);await page.evaluate(()=>{__CC.G.touch=true;__CC.G._syncTouch();});
  const cdp=await page.context().newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:Number(cpu)});await cdp.send('Performance.enable');
  const samples=[];const initial=await page.evaluate(()=>({frames:soak.startFrames,ticks:soak.startTicks}));let lastFrames=initial.frames,lastTicks=initial.ticks,lastTime=0;
  for(let elapsed=0;elapsed<Number(seconds);elapsed+=30){
   await page.waitForTimeout(Math.min(30,Number(seconds)-elapsed)*1000);
   const s=await page.evaluate(()=>{
    const G=__CC.G,frames=soak.frames.splice(0).sort((a,b)=>a-b),profs=soak.prof.splice(0),avg={};for(const p of profs)for(const [k,v]of Object.entries(p))avg[k]=(avg[k]||0)+v/profs.length;
    const cache={};for(const [k,v]of Object.entries(G))if(v instanceof Map)cache[k]=v.size;
    return {seconds:(performance.now()-soak.start)/1000,frames:G.renderCount,ticks:G.ticks,rafP50:frames[Math.floor(frames.length*.5)],rafP95:frames[Math.floor(frames.length*.95)],rafP99:frames[Math.floor(frames.length*.99)],over50:frames.filter(x=>x>50).length,rafSamples:frames.length,prof:avg,max:G.profMax,entities:Object.fromEntries(['vehicles','peds','cops','particles','skids','flashes','floaters','bullets'].map(k=>[k,G[k]?.length])),cache,renderer:G.mobileRenderStats,world:[G.worldWidth,G.worldHeight],resolution:G.resScale||1,heap:performance.memory?.usedJSHeapSize,scene:G.scene,touch:G.touch,position:[G.player.x,G.player.y],deadPeds:G.peds.filter(p=>p.dead).length,deadVehicles:G.vehicles.filter(v=>v.dead).length,coreBytes:[...(G.mobileTiles?.values()||[])].reduce((s,e)=>s+(e.image?.width||0)*(e.image?.height||0)*4,0),audioStreams:G.audio.activeStreams};
   });
   s.fps=(s.frames-lastFrames)/(s.seconds-lastTime);s.simHz=(s.ticks-lastTicks)/(s.seconds-lastTime);lastFrames=s.frames;lastTicks=s.ticks;lastTime=s.seconds;
   s.metrics=(await cdp.send('Performance.getMetrics')).metrics.filter(m=>/JSHeapUsedSize|Nodes|Documents|TaskDuration/.test(m.name));
   s.effects=await page.evaluate(()=>{const G=__CC.G;return{drops:G.bloodFX?.drops.length||0,stains:G.bloodFX?.stains.length||0,pool:G.bloodFX?.pool.length||0,population:G.traffic.population};});
   samples.push(s);fs.writeFileSync(path.join(out,label+'.json'),JSON.stringify({url,route,cpu:Number(cpu),errors,samples},null,2));
   console.log(JSON.stringify({seconds:Math.round(s.seconds),fps:s.fps,simHz:s.simHz,rafP95:s.rafP95,heap:s.heap,entities:s.entities,prof:s.prof}));
   if(elapsed===0||elapsed+30>=Number(seconds))await page.screenshot({path:path.join(out,label+'-'+Math.round(s.seconds)+'.png')});
   if(elapsed+30>=Number(seconds)){
    await cdp.send('Profiler.enable');await cdp.send('Profiler.start');await page.waitForTimeout(5000);const {profile}=await cdp.send('Profiler.stop');fs.writeFileSync(path.join(out,label+'.cpuprofile'),JSON.stringify(profile));
   }
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
