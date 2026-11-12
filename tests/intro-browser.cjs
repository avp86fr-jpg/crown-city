const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const url = process.env.CC_URL || 'http://127.0.0.1:8000/';

async function playing(page) {
  try {
    // Autoplay policies differ between Chrome installations. Exercise the
    // visible user-gesture fallback when the browser requires it.
    await page.waitForFunction(() => {
      const video = document.querySelector('#introPlayer video');
      return video?.error || video?.currentTime > .3 || document.querySelector('#playIntro')?.hidden === false;
    });
    if (await page.locator('#playIntro').isVisible()) await page.locator('#playIntro').click();
    await page.waitForFunction(() => document.querySelector('#introPlayer video')?.currentTime > .3);
  } catch (error) {
    const details = await page.evaluate(() => {
      const video = document.querySelector('video');
      return { scene: window.__CC?.G.scene, active: window.__CC?.G.introActive, time: video?.currentTime,
        ready: video?.readyState, network: video?.networkState, paused: video?.paused,
        mediaError: video?.error?.message, status: document.querySelector('#introStatus')?.textContent };
    });
    throw new Error(`Intro did not play: ${JSON.stringify(details)}`, { cause: error });
  }
}

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || (fs.existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined), headless: true });
  async function setup(options = {}, init) {
    const context = await browser.newContext(options);
    const page = await context.newPage(), errors = [], movies = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (request.url().endsWith('crown-city-intro.mp4')) movies.push(request.url()); });
    if (init) await page.addInitScript(init);
    await page.goto(url);
    await page.waitForFunction(() => window.__CC?.G.buttons.some(button => button.label === 'WATCH INTRO'));
    await page.evaluate(() => { __CC.G.settings.autoFS = false; });
    async function menu(label) {
      const point = await page.evaluate(label => {
        const G = __CC.G, button = G.buttons.find(button => button.label === label);
        return { x: (button.x + button.w / 2) / G.dpr, y: (button.y + button.h / 2) / G.dpr };
      }, label);
      if (options.hasTouch) await page.touchscreen.tap(point.x, point.y);
      else await page.mouse.click(point.x, point.y);
    }
    return { context, page, errors, movies, menu };
  }
  try {
    for (const viewport of [{ width: 1280, height: 720 }, { width: 390, height: 844 }, { width: 844, height: 390 }]) {
      const { context, page, errors, movies, menu } = await setup({ viewport, hasTouch: viewport.width < 1000, isMobile: viewport.width < 1000 });
      assert.equal(movies.length, 0, 'Do not download the movie on boot');
      await page.evaluate(() => { __CC.G.chips = 1732; localStorage.setItem('intro-save-sentinel', 'unchanged'); });
      const saved = await page.evaluate(() => JSON.stringify(localStorage));
      await menu('WATCH INTRO');
      await playing(page);
      const state = await page.evaluate(() => {
        const video = document.querySelector('#introPlayer video');
        return { ticks: __CC.G.ticks, master: __CC.G.audio.masterVol, duration: video.duration, inline: video.playsInline };
      });
      assert.equal(state.master, 0);
      assert.ok(state.duration > 59 && state.duration < 61 && state.inline);
      await page.waitForTimeout(150);
      assert.equal(await page.evaluate(() => __CC.G.ticks), state.ticks, 'The game pauses during the film');
      const skip = await page.locator('#skipIntro').boundingBox();
      assert.ok(skip.height >= 44 && skip.x >= 0 && skip.x + skip.width <= viewport.width);
      await page.locator('#skipIntro').click();
      assert.deepEqual(await page.evaluate(() => ({ scene: __CC.G.scene, active: __CC.G.introActive, chips: __CC.G.chips, master: __CC.G.audio.masterVol, focus: document.activeElement.id })), { scene: 'title', active: false, chips: 1732, master: .9, focus: 'c' });
      assert.equal(await page.evaluate(() => JSON.stringify(localStorage)), saved, 'Rewatch must not change saves');
      assert.equal(await page.locator('#introPlayer').count(), 0);

      await menu('WATCH INTRO');
      await playing(page);
      assert.ok(await page.locator('video').evaluate(video => video.currentTime < 3), 'Rewatch restarts the movie');
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => !__CC.G.introActive);
      assert.equal(await page.evaluate(() => __CC.G.scene), 'title');

      await menu('NEW GAME');
      await playing(page);
      if (viewport.width === 1280) {
        await page.locator('video').evaluate(video => { video.currentTime = video.duration - .2; });
        await page.waitForFunction(() => !__CC.G.introActive);
      } else await page.locator('#skipIntro').click();
      await page.waitForFunction(() => __CC.G.scene === 'vn' && !__CC.G.vn.pending);
      assert.equal(await page.evaluate(() => __CC.G.vn.id), 'intro_news');
      assert.ok(await page.evaluate(() => __CC.G.vn.t >= 7.5), 'Go directly to dialogue after the movie');
      assert.deepEqual(errors, []);
      await context.close();
      console.log(`PASS ${viewport.width}×${viewport.height}: lazy load, decode, audio, skip, rewatch, save preservation, Escape and story transition`);
    }

    const blocked = await setup({}, () => {
      const original = HTMLMediaElement.prototype.play;
      let first = true;
      HTMLMediaElement.prototype.play = function () {
        if (this.tagName === 'VIDEO' && first) { first = false; return Promise.reject(new DOMException('Test gesture requirement', 'NotAllowedError')); }
        return original.call(this);
      };
    });
    await blocked.menu('WATCH INTRO');
    await blocked.page.locator('#playIntro').waitFor({ state: 'visible' });
    await blocked.page.locator('#playIntro').click();
    await blocked.page.waitForFunction(() => document.querySelector('video')?.currentTime > .1);
    await blocked.page.locator('video').evaluate(video => video.pause());
    await blocked.page.locator('#playIntro').waitFor({ state: 'visible' });
    await blocked.page.locator('#skipIntro').click();
    assert.deepEqual(blocked.errors, []);
    await blocked.context.close();
    console.log('PASS autoplay rejection and paused playback offer a working resume control');

    const missing = await setup();
    await missing.page.route('**/crown-city-intro.mp4', route => route.abort());
    await missing.menu('NEW GAME');
    await missing.page.waitForFunction(() => /could not/.test(document.querySelector('#introStatus')?.textContent));
    await missing.page.locator('#skipIntro').click();
    await missing.page.waitForFunction(() => __CC.G.scene === 'vn');
    assert.deepEqual(missing.errors, []);
    await missing.context.close();
    console.log('PASS unavailable video never blocks the story');

    const reduced = await setup();
    await reduced.page.evaluate(() => { __CC.G.settings.reducedMotion = true; });
    await reduced.menu('NEW GAME');
    await reduced.page.waitForFunction(() => __CC.G.scene === 'vn');
    assert.equal(reduced.movies.length, 0);
    await reduced.context.close();
    console.log('PASS Reduced Motion goes directly to dialogue');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
