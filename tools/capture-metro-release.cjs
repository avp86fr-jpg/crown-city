/* Deterministic 720p game-frame captures. Requires the local server and Chromium. */
const {chromium}=require('playwright'),fs=require('fs'),path=require('path');
(async()=>{const b=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});const out='.qa/metro-media';fs.mkdirSync(out,{recursive:true});try{
 const p=await b.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1});p.on('pageerror',e=>{throw e;});await p.addInitScript(()=>requestAnimationFrame=()=>0);await p.goto('http://127.0.0.1:8000/');await p.waitForFunction(()=>window.__CC,null,{polling:100});
 await p.evaluate(async()=>{window.T=(await import('./src/game.js')).testing;window.R=await import('./src/transit.js');const G=__CC.G;T.startFreeRide(G);G.settings.quality='med';G.settings.timeSpeed=0;G.settings.autoRes=false;G.settings.reducedMotion=false;G.settings.autoFS=false;G.time=17;G.weatherT=1e9;G.hideHUD=true;G.cam.northUp=true;T.applyQuality(G);T.fit(G);});
 for(const name of (process.argv.length>2?process.argv.slice(2):['drive','canal','story','rail','forest'])){
  const dir=path.join(out,name);fs.mkdirSync(dir,{recursive:true});await p.keyboard.up('KeyW');
  const dialogue=await p.evaluate(async name=>{const G=__CC.G;G.scene='play';G.wanted=0;G.health=100;G._endT=0;G.hideHUD=true;G.toastT=0;G.action.messageT=0;G.action.contract=null;G.rainAmt=0;G.time=17;G.cam.rot=0;
   if(name==='drive'){const v=G.vehicles.find(v=>v.kind==='riot');T.enterVeh(G,v,true);Object.assign(v,{x:2108,y:2790,rot:0,vx:0,vy:-100});G.cam.x=v.x;G.cam.y=v.y;G.cam.scale=1.05;G.time=18.3;}
   if(name==='canal'){const v=G.vehicles.find(v=>v.canalDock);T.enterVeh(G,v,true);Object.assign(v,{x:6968,y:3040,rot:Math.PI,vx:0,vy:75});G.cam.x=v.x;G.cam.y=v.y;G.cam.scale=1.05;G.time=16.7;}
   if(name==='story'){T.openVN(G,'m5_intro');await Promise.all(G.storyLoads.values());G.vn.char=10000;G.vn.t=2;}
   if(name==='rail'){const station=R.STATIONS.find(s=>s.id==='midtown'),e=R.stationExit(station);G.player=T.makeFoot(G,e.x,e.y,0);R.interactTransit(G);R.beginJourney(G,'airfield');G.transit.ride.elapsed=2.5;}
   if(name==='forest'){const at=T.findSafe(G,11220,2610,8,true);G.player=T.makeFoot(G,at.x,at.y,Math.PI/2);G.cam.x=11220;G.cam.y=2570;G.cam.scale=1.28;G.time=16.8;T.tickWildlife(G,.5);}
   T.render(G);return name==='story'?G.vn.node.text:null;
  },name);
  for(let i=0;i<18;i++){await p.evaluate(()=>T.render(__CC.G));await p.waitForTimeout(35);}
  if(dialogue)fs.writeFileSync(path.join(out,'dialogue.txt'),dialogue);
  if(name==='drive'||name==='canal')await p.keyboard.down('KeyW');
  for(let i=0;i<134;i++){
   const png=await p.evaluate(name=>{const G=__CC.G;T.tick(G,1/60);T.tick(G,1/60);if(name==='forest'){G.cam.x=11220;G.cam.y=2570;G.cam.scale=1.28;}T.render(G);return G.canvas.toDataURL('image/png').split(',')[1];},name);
   fs.writeFileSync(path.join(dir,String(i).padStart(4,'0')+'.png'),Buffer.from(png,'base64'));
  }
  console.log('Captured',name,'134 frames');
 }
 await p.keyboard.up('KeyW');
 // The landing page uses current captures, including the supplied Gold Mage reference.
 fs.copyFileSync(path.join(out,'story','0060.png'),path.join(out,'story.png'));
 for(const [name,x,y,scale] of [['station',6250,3480,1.35],['forest-shot',11220,2570,1.28]]){
  await p.evaluate(({x,y,scale})=>{const G=__CC.G;G.scene='play';G.hideHUD=true;G.wanted=0;const at=T.findSafe(G,x,y+100,8,true);G.player=T.makeFoot(G,at.x,at.y,0);G.cam.x=x;G.cam.y=y;G.cam.rot=0;G.cam.scale=scale;G.time=16.8;T.tickWildlife(G,.5);T.tickTransit(G,.5);T.render(G);},{x,y,scale});for(let i=0;i<18;i++){await p.evaluate(()=>T.render(__CC.G));await p.waitForTimeout(35);}await p.locator('#c').screenshot({path:path.join(out,name+'.png')});
 }
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
