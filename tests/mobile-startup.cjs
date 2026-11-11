// Cold/warm Chrome launch, real story buttons, one-canvas pixels and restoration.
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
const url=process.env.CC_URL||'http://127.0.0.1:8000/';fs.mkdirSync('.qa/ai',{recursive:true});
(async()=>{const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});const errors=[];
try{
 const context=await browser.newContext({viewport:{width:844,height:390},hasTouch:true,isMobile:true,deviceScaleFactor:2});const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 async function ready(){await page.goto(url);await page.waitForFunction(()=>!!window.__CC);await page.evaluate(async()=>{window.T=(await import(new URL('src/game.js',location.href).href)).testing;__CC.G.settings.autoFS=false;});}
 async function tap(label){await page.waitForFunction(label=>__CC.G.buttons.some(b=>b.label===label),label);const b=await page.evaluate(label=>{const G=__CC.G,b=G.buttons.find(b=>b.label===label);return{x:(b.x+b.w/2)/G.dpr,y:(b.y+b.h/2)/G.dpr};},label);await page.touchscreen.tap(b.x,b.y);}
 async function worldPixels(){await page.waitForTimeout(1000);return page.evaluate(()=>{const G=__CC.G,c=G.ctx,W=G.canvas.width,H=G.canvas.height,d=c.getImageData(W*.25,H*.25,W*.5,H*.5).data;let opaque=0,lit=0;for(let i=0;i<d.length;i+=4){if(d[i+3]===255)opaque++;if(Math.max(d[i],d[i+1],d[i+2])>30)lit++;}return{opaque:opaque/(d.length/4),lit:lit/(d.length/4),quality:G.settings.quality,layered:G.layered,scene:G.scene};});}
 await ready();assert.equal(await page.evaluate(()=>__CC.G.settings.quality),'low');await tap('NEW GAME');await page.waitForFunction(()=>__CC.G.scene==='vn'&&!__CC.G.vn.pending);
 await page.waitForTimeout(600);await page.screenshot({path:'.qa/ai/opening-mobile.png'});await tap('SKIP OPENING');
 await page.waitForFunction(()=>__CC.G.vn.t>=7.5);await page.evaluate(()=>{__CC.G.vn.char=__CC.G.vn.node.text.length;});await page.waitForTimeout(100);await page.screenshot({path:'.qa/ai/dialogue-mobile.png'});
 for(let i=0;i<15&&await page.evaluate(()=>__CC.G.scene==='vn');i++){
  await page.waitForFunction(()=>!__CC.G.vn.pending);await page.evaluate(()=>{__CC.G.vn.char=__CC.G.vn.node.text.length;});await page.waitForTimeout(100);
  const label=await page.evaluate(()=>__CC.G.vn.node.choices?.[0]?.label||'CONTINUE  →');await tap(label);await page.waitForTimeout(100);
 }
 await tap('START  ▶');await page.waitForFunction(()=>__CC.G.scene==='play');let pixels=await worldPixels();assert.ok(pixels.opaque>.99&&pixels.lit>.3,JSON.stringify(pixels));assert.equal(pixels.quality,'low');assert.equal(pixels.layered,false);
 console.log('PASS default mobile Story starts with a painted world without changing quality',pixels);
 await page.addStyleTag({content:'#c{background:#000!important}.world-layer{display:none!important}'});pixels=await worldPixels();assert.ok(pixels.lit>.3);
 console.log('PASS world is visible without a second composited canvas or transparent CSS');
 await page.evaluate(()=>{const G=__CC.G;G.canvas.dispatchEvent(new Event('contextlost',{cancelable:true}));G.canvas.dispatchEvent(new Event('contextrestored'));G.scene='play';});pixels=await worldPixels();assert.ok(pixels.lit>.3);assert.ok(await page.evaluate(()=>__CC.G.renderRecovery>0));
 console.log('PASS simulated context restoration rebuilds the world without a settings change');
 await page.setViewportSize({width:390,height:844});pixels=await worldPixels();assert.ok(pixels.lit>.3);await page.screenshot({path:'.qa/ai/world-portrait.png'});
 await page.setViewportSize({width:844,height:390});await page.evaluate(()=>{T.save(__CC.G);});await ready();await tap('CONTINUE');await page.waitForFunction(()=>['play','brief'].includes(__CC.G.scene));if(await page.evaluate(()=>__CC.G.scene==='brief'))await tap('START  ▶');pixels=await worldPixels();assert.ok(pixels.lit>.3);await page.screenshot({path:'.qa/ai/world-landscape.png'});
 console.log('PASS rotation and a warm saved-game launch retain visible world pixels');
 // Inspect dialogue choices and intact original portraits in both phone orientations.
 for(const [width,height] of [[390,844],[844,390],[1280,720]]){
  await page.setViewportSize({width,height});await page.evaluate(async()=>{const G=__CC.G;T.openVN(G,'m4_intro');await Promise.all(G.storyLoads.values());G.vn.char=G.vn.node.text.length;G.vn.wipe=0;T.render(G);});await page.waitForTimeout(150);
  const buttons=await page.evaluate(()=>{const G=__CC.G;return G.buttons.map(b=>({x:b.x,y:b.y,w:b.w,h:b.h,W:G.canvas.width,H:G.canvas.height}));});assert.ok(buttons.length>=2);assert.ok(buttons.every(b=>b.x>=0&&b.y>=0&&b.x+b.w<=b.W+1&&b.y+b.h<=b.H+1));await page.screenshot({path:`.qa/ai/choices-${width}.png`});
 }
 await page.evaluate(async()=>{const G=__CC.G;T.openVN(G,'m5_intro');await Promise.all(G.storyLoads.values());G.vn.char=G.vn.node.text.length;G.vn.wipe=0;T.render(G);});await page.waitForTimeout(100);await page.screenshot({path:'.qa/ai/gold-mage-dialogue.png'});
 // Every speech must be painted in full, including the final lines on phones.
 for(const [width,height] of [[390,844],[844,390],[320,640]]){
  await page.setViewportSize({width,height});
  const problems=await page.evaluate(async()=>{
   const {VN}=await import(new URL('src/story.js',location.href).href),G=__CC.G,issues=[];
   for(const [id,node] of Object.entries(VN)){
    T.openVN(G,id);await Promise.all(G.storyLoads.values());G.vn.char=node.text.length;G.vn.t=10;G.vn.wipe=0;
    const calls=[],original=G.ctx.fillText;G.ctx.fillText=function(text,x,y,...rest){calls.push({text:String(text),y});return original.call(this,text,x,y,...rest);};
    try{T.render(G);}finally{G.ctx.fillText=original;}
    if(!calls.map(c=>c.text).join(' ').replace(/\s+/g,' ').includes(node.text.replace(/\s+/g,' ')))issues.push(id+': incomplete text');
    if(calls.some(c=>c.y>G.canvas.height||c.y<0))issues.push(id+': clipped text');
    if(G.buttons.some(b=>b.x<0||b.y<0||b.x+b.w>G.canvas.width+1||b.y+b.h>G.canvas.height+1))issues.push(id+': clipped choice');
   }return issues;
  });assert.deepEqual(problems,[],`${width}x${height}`);
 }
 console.log('PASS every story speech and choice fits portrait, landscape and small phones');
 assert.deepEqual(errors,[]);console.log('PASS responsive dialogue choices, Gold Mage reference and no browser exceptions');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
