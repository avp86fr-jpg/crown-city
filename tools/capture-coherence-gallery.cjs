/* Staged screenshots rendered by the running game, without changing source art. */
const {chromium}=require('playwright'),fs=require('fs');
(async()=>{
 const b=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 const out='.qa/coherence-gallery';fs.mkdirSync(out,{recursive:true});
 try{
  const p=await b.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1});
  p.on('pageerror',e=>{throw e;});await p.addInitScript(()=>requestAnimationFrame=()=>0);
  await p.goto(process.env.CC_URL||'http://127.0.0.1:8000/');await p.addStyleTag({content:'#screenTools{display:none}'});await p.waitForFunction(()=>window.__CC,null,{polling:100});
  await p.evaluate(async()=>{window.T=(await import('./src/game.js')).testing;T.startFreeRide(__CC.G);Object.assign(__CC.G.settings,{quality:'med',autoRes:false,timeSpeed:0,autoFS:false});T.applyQuality(__CC.G);T.fit(__CC.G);});
  for(const [name,x,y,scale,time] of [['afterhours-street',2108,2940,1.23,16.7],['frontier-casino',7980,3235,1.13,16.7],['metro-station',6250,3480,1.35,16.8],['pinewatch-wildlife',11220,2570,1.28,16.8]]){
   await p.evaluate(({x,y,scale,time})=>{const G=__CC.G,at=T.findSafe(G,x-110,y+130,8,true);G.scene='play';G.player=T.makeFoot(G,at.x,at.y,0);G.wanted=0;G.health=100;G.weather='clear';G.weatherT=1e8;G.rainAmt=G.fog=G.sand=G.wet=0;G.time=time;G.hideHUD=true;G.action.contract=null;G.action.messageT=0;G.toastT=0;G.contactTalk=null;for(let i=0;i<45;i++)T.tick(G,1/60);Object.assign(G.cam,{x,y,scale,rot:0});T.render(G);},{x,y,scale,time});
   for(let i=0;i<28;i++){await p.evaluate(()=>T.render(__CC.G));await p.waitForTimeout(40);}
   await p.locator('#c').screenshot({path:`${out}/${name}.png`});console.log('Captured',name);
  }
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
