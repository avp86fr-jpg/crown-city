const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const base = process.env.CC_ABOUT_URL || 'http://127.0.0.1:8000/about/';
(async () => {
  const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium',headless:true,args:['--no-sandbox']});
  const page = await browser.newPage({viewport:{width:1440,height:1000}});
  const errors = [], failures = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('response', r => { if(r.status() >= 400) failures.push(`${r.status()} ${r.url()}`); });
  const out = path.join(__dirname,'../.qa/release');fs.mkdirSync(out,{recursive:true});
  try {
    await page.goto(base);
    await page.evaluate(async () => {
      for (const img of document.images) if (img.src) {img.loading = 'eager';await img.decode();}
      await document.fonts.ready;
    });
    assert.equal(await page.title(),'Crown City — After Hours');
    assert.equal(await page.evaluate(()=>document.fonts.check('24px Anton')),true);
    assert.equal(await page.locator('.gallery img').count(),7);
    assert.equal(await page.locator('.crew-card img').count(),7);
    console.log('PASS all cover, screenshot, portrait and font assets load');
    for (const [width,height] of [[1440,1000],[390,844],[844,390],[320,700]]) {
      await page.setViewportSize({width,height});
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth),`Horizontal overflow at ${width}`);
      await page.screenshot({path:path.join(out,`about-${width}.png`),fullPage:true});
    }
    console.log('PASS desktop, phone and landscape layouts have no horizontal overflow');
    await page.setViewportSize({width:390,height:844});
    await page.locator('[data-shot="0"]').click();
    assert.equal(await page.locator('#lightbox').evaluate(e=>e.open),true);
    assert.equal(await page.locator('#close-gallery').evaluate(e=>e===document.activeElement),true);
    await page.keyboard.press('ArrowRight');assert.equal(await page.locator('#shot-count').textContent(),'2 / 7');
    await page.locator('#previous-shot').click();assert.equal(await page.locator('#shot-count').textContent(),'1 / 7');
    await page.locator('#previous-shot').click();assert.equal(await page.locator('#shot-count').textContent(),'7 / 7');
    await page.keyboard.press('Escape');assert.equal(await page.locator('#lightbox').evaluate(e=>e.open),false);
    assert.equal(await page.locator('[data-shot="0"]').evaluate(e=>e===document.activeElement),true);
    assert.equal(await page.locator('body').evaluate(e=>e.classList.contains('gallery-open')),false);
    console.log('PASS screenshot gallery, wrapping navigation, Escape and focus restoration');
    await page.getByText('Mobile & fullscreen',{exact:false}).click();
    assert.equal(await page.locator('details').nth(1).evaluate(e=>e.open),true);
    for(const a of await page.locator('a[href^="#"]').all()) {
      const href=await a.getAttribute('href');assert.equal(await page.locator(href).count(),1,href);
    }
    const plays=await page.locator('a[href="../"]').count();assert.equal(plays,5);
    console.log('PASS play links, section links and expandable controls');
    await page.locator('[data-watch]').click();
    await page.waitForFunction(()=>{const v=document.querySelector('video');return v.readyState>=2&&v.currentTime>.5},{},{timeout:30000});
    const media=await page.locator('video').evaluate(v=>({width:v.videoWidth,height:v.videoHeight,duration:v.duration,muted:v.muted,volume:v.volume,decodedAudio:v.webkitAudioDecodedByteCount,inline:v.playsInline}));
    assert.equal(media.width,1280);assert.equal(media.height,720);assert.ok(media.duration>=44 && media.duration<44.2);assert.equal(media.muted,false);assert.ok(media.volume>0);assert.ok(media.decodedAudio>0);assert.equal(media.inline,true);
    assert.equal(await page.locator('[data-time]').count(),6);
    await page.locator('[data-time="26"]').click();
    await page.waitForFunction(()=>{const v=document.querySelector('video');return !v.seeking&&v.readyState>=2&&v.currentTime>=26&&v.currentTime<29;});
    await page.locator('video').evaluate(v=>new Promise(resolve=>v.requestVideoFrameCallback((now,frame)=>resolve(frame.mediaTime)))).then(t=>assert.ok(t>=26&&t<29));
    await page.waitForFunction(()=>document.querySelector('[data-time="26"]').getAttribute('aria-current')==='true');
    console.log('PASS trailer chapter controls seek to the train sequence');
    await page.locator('video').evaluate(v=>{v.pause();v.textTracks[0].mode='showing';});
    await page.waitForFunction(()=>document.querySelector('track').readyState===2);
    assert.ok(await page.locator('video').evaluate(v=>v.textTracks[0].cues.length>=7));
    console.log('PASS 720p trailer plays inline, decodes audio and loads captions',media);
    await page.setViewportSize({width:1280,height:720});
    await page.locator('video').evaluate(v=>{v.textTracks[0].mode='disabled';v.currentTime=8;});
    await page.waitForFunction(()=>{const v=document.querySelector('video');return !v.seeking&&v.readyState>=2&&Math.abs(v.currentTime-8)<.2;});
    await page.locator('video').screenshot({path:path.join(out,'trailer-playback.png')});
    await page.emulateMedia({reducedMotion:'reduce'});
    assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).scrollBehavior),'auto');
    assert.deepEqual(errors,[]);assert.deepEqual(failures,[]);
    console.log('PASS reduced motion, no browser exceptions or failed assets');
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
