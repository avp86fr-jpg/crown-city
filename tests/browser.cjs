// Optional real-browser verification. Serve the repository before running.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const base = process.env.GAME_URL || 'http://127.0.0.1:8000/';
const output = path.resolve('.qa/browser');
fs.mkdirSync(output, { recursive: true });
const failures = [];
let checks = 0;
async function check(name, fn) { await fn(); checks++; console.log('PASS', name); }
async function step(page, n = 1) {
  await page.evaluate(n => { const G = __CC.G; for (let i = 0; i < n; i++) T.tick(G, 1 / 60); T.render(G); }, n);
}
async function button(page, label, touch = false) {
  const at = await page.evaluate(label => {
    const G = __CC.G, b = G.buttons.find(b => b.label === label);
    if (!b) throw Error('Button missing: ' + label);
    return { x: (b.x + b.w / 2) / G.canvas.width * innerWidth, y: (b.y + b.h / 2) / G.canvas.height * innerHeight };
  }, label);
  if (touch) await page.touchscreen.tap(at.x, at.y); else await page.mouse.click(at.x, at.y);
  await step(page);
}
async function setup(browser, options = {}) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, ...options });
  const page = await context.newPage();
  page.on('pageerror', e => failures.push(e.message));
  page.on('response', r => { if (r.status() >= 400) failures.push(r.status() + ' ' + r.url()); });
  await page.addInitScript(() => {
    window.requestAnimationFrame = () => 0;
    window.audioGains = [];
    const audio = window.AudioContext || window.webkitAudioContext;
    if (audio) {
      const create = audio.prototype.createGain;
      audio.prototype.createGain = function (...args) { const node = create.apply(this, args); audioGains.push(node); return node; };
    }
  });
  await page.goto(base);
  await page.waitForFunction(() => !!window.__CC, null, { polling: 100 });
  await page.evaluate(async () => {
    window.T = (await import(new URL('src/game.js', location.href).href)).testing;
    window.story = await import(new URL('src/story.js', location.href).href);
    __CC.G.settings.autoFS = false; __CC.G.settings.autoRes = false; T.render(__CC.G);
  });
  return { context, page };
}
async function dialogue(page, choices) {
  for (let i = 0; i < 40; i++) {
    const scene = await page.evaluate(() => __CC.G.scene);
    if (scene !== 'vn') break;
    await page.evaluate(async () => { await Promise.all(__CC.G.storyLoads.values()); __CC.G.vn.char = __CC.G.vn.node.text.length; T.render(__CC.G); });
    const label = await page.evaluate(choices => {
      const n = __CC.G.vn.node;
      return n.choices?.find(c => Object.entries(c.set || {}).every(([k, v]) => choices[k] === v))?.label;
    }, choices);
    if (label) await button(page, label);
    else { await page.keyboard.press('KeyE'); await step(page); }
  }
  if (await page.evaluate(() => __CC.G.scene === 'brief')) await button(page, 'START  ▶');
}
(async () => {
  const executablePath = process.env.CHROMIUM_PATH || (fs.existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined);
  const browser = await chromium.launch({ executablePath, headless: true, args: ['--no-sandbox'] });
  try {
    const { page } = await setup(browser);
    await check('keyboard and E dialogue advance through the opening', async () => {
      await button(page, 'NEW GAME'); await dialogue(page, { stash: 'safe' });
      assert.equal(await page.evaluate(() => __CC.G.scene), 'play');
      assert.equal(await page.evaluate(() => __CC.G.missionIndex), 0);
    });
    await check('real keyboard movement, firing, map clicks, pause, save and reload', async () => {
      await page.evaluate(() => { const G = __CC.G, at = T.findSafe(G, 2108, 2400, 10, true); G.player = T.makeFoot(G, at.x, at.y, 0); });
      const y = await page.evaluate(() => __CC.G.player.y);
      await page.keyboard.down('KeyW'); await step(page, 30); await page.keyboard.up('KeyW'); await step(page);
      assert.ok(await page.evaluate(y => __CC.G.player.y < y - 20, y));
      await page.keyboard.down('KeyK'); await step(page); await page.keyboard.up('KeyK');
      assert.ok(await page.evaluate(() => __CC.G.shotsFired > 0));
      await page.keyboard.press('KeyM'); await step(page);
      assert.equal(await page.evaluate(() => __CC.G.scene), 'map');
      const map = await page.evaluate(() => { const G = __CC.G, m = G.mapView; return { x: (m.x + m.w / 2) / G.canvas.width * innerWidth, y: (m.y + m.h / 2) / G.canvas.height * innerHeight }; });
      await page.mouse.click(map.x, map.y); await step(page);
      assert.ok(await page.evaluate(() => __CC.G.waypoint));
      await button(page, 'JOB ROUTE'); assert.equal(await page.evaluate(() => __CC.G.waypoint), null);
      await button(page, 'CLOSE'); await page.keyboard.press('Escape'); await step(page);
      await button(page, 'SAVE GAME'); await button(page, 'QUIT TO TITLE');
      await page.reload(); await page.waitForFunction(() => !!window.__CC, null, { polling: 100 });
      await page.evaluate(async () => { window.T = (await import(new URL('src/game.js', location.href).href)).testing; T.render(__CC.G); });
      await button(page, 'CONTINUE'); assert.equal(await page.evaluate(() => __CC.G.scene), 'play');
    });
    await check('desktop and phone menus stay in bounds with Continue available', async () => {
      for (const [width, height] of [[1280,720],[844,390],[390,844],[667,375]]) {
        await page.setViewportSize({width,height});
        for (const scene of ['title','pause','map','settings','brief']) {
          await page.evaluate(scene => { const G = __CC.G; G.scene = scene; G.pausedFrom = 'play'; T.fit(G); T.render(G); }, scene);
          assert.deepEqual(await page.evaluate(() => { const G = __CC.G; return G.buttons.filter(b => b.x < 0 || b.y < 0 || b.x + b.w > G.canvas.width + 1 || b.y + b.h > G.canvas.height + 1).map(b => b.label); }), []);
          if (scene === 'title' || scene === 'settings') await page.screenshot({path:path.join(output,`${scene}-${width}.png`)});
        }
      }
    });
    const { page: phone, context: mobile } = await setup(browser, {viewport:{width:390,height:844},hasTouch:true,isMobile:true,deviceScaleFactor:2});
    await phone.evaluate(() => { __CC.startNew(); __CC.skipAllVN(); __CC.startPlay(); T.render(__CC.G); });
    await step(phone, 10);
    await check('multi-touch joystick and RUN release; phone MAP, PAUSE and TAKE work', async () => {
      const cdp = await mobile.newCDPSession(phone);
      const start = await phone.evaluate(() => { const G = __CC.G, a = T.findSafe(G,2108,2400,10,true); G.player = T.makeFoot(G,a.x,a.y,0); return G.player.y; });
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:70,y:650,id:1}]});
      await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:70,y:585,id:1}]});
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:70,y:585,id:1},{x:175,y:794,id:2}]});
      await step(phone,30);
      assert.ok(await phone.evaluate(start => __CC.G.player.y < start - 20, start));
      assert.equal(await phone.evaluate(() => __CC.G.input.tSprint),true);
      await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]}); await step(phone);
      assert.equal(await phone.evaluate(() => __CC.G.input.touchJoy.active || __CC.G.input.tSprint),false);
      await phone.locator('#tMap').tap(); await step(phone); assert.equal(await phone.evaluate(() => __CC.G.scene),'map');
      await button(phone,'CLOSE',true); await phone.locator('#tPause').tap(); await step(phone); assert.equal(await phone.evaluate(() => __CC.G.scene),'pause');
      await button(phone,'RESUME',true);
      await phone.evaluate(() => { const G=__CC.G; G.objectiveIndex=2; const at=__CC.objPos(); G.player=T.makeFoot(G,at.x,at.y,0); G.van.vx=G.van.vy=0; G.van.loose=true; });
      await step(phone,8); assert.equal(await phone.locator('#tEnterL').textContent(),'TAKE');
      await phone.locator('#tEnter').tap(); await step(phone); assert.equal(await phone.evaluate(() => __CC.G.objectiveIndex),3);
    });
    await check('touch HUD clears the DOM controls at both phone orientations', async () => {
      for (const [width,height] of [[390,844],[844,390]]) {
        await phone.setViewportSize({width,height}); await phone.evaluate(() => { const G=__CC.G; T.fit(G); T.render(G); }); await step(phone,8);
        const out = await phone.locator('#touch .btn').evaluateAll(es => es.filter(e=>e.getBoundingClientRect().width).filter(e=>{const r=e.getBoundingClientRect();return r.x<0||r.y<0||r.right>innerWidth+1||r.bottom>innerHeight+1}).map(e=>e.id));
        assert.deepEqual(out,[]); await phone.screenshot({path:path.join(output,`touch-${width}.png`)});
      }
    });
    for (const choices of [{stash:'safe',heist:'quiet',finance:'upfront'},{stash:'flip',heist:'loud',finance:'credit'}]) {
      await check('six-job browser campaign '+Object.values(choices).join('/'), async () => {
        await page.setViewportSize({width:1280,height:720});
        await page.evaluate(() => { __CC.startNew(); });
        for (let i=0;i<65;i++) {
          await dialogue(page,choices);
          if (await page.evaluate(() => __CC.G.scene === 'end')) break;
          await page.evaluate(async () => {
            const G=__CC.G,obj=G._flow.objectives[G.objectiveIndex];
            if (obj.kind==='enter') { T.ensureMissionCar(G); T.enterVeh(G,G.vehicles.find(v=>v.mission&&v.kind===(obj.vehicle||'riot')&&!v.dead),true); }
            else if(obj.kind==='enterBoat') { T.ensureGetawayBoat(G); T.enterVeh(G,G.vehicles.find(v=>v.getawayBoat&&!v.dead),true); }
            else if(obj.kind==='loseWanted') G.wanted=0;
            else if(obj.kind==='race') {
              T.startRace(G,obj); G.race.countdown=0; G.race.started=true;
              let frames=0;
              while(G.race&&frames++<7200) {
                G.ticks++;const car=G.player,cp=G.race.pts[G.race.i];
                let delta=Math.atan2(cp[0]-car.x,-(cp[1]-car.y))-car.rot;
                while(delta>Math.PI)delta-=Math.PI*2;while(delta< -Math.PI)delta+=Math.PI*2;
                T.tickDrive(G,car,{x:Math.max(-1,Math.min(1,delta*2.4)),y:Math.abs(delta)>.8?.4:1,hand:Math.abs(delta)>1.1},1/60,true);
                T.tickVehicles(G,1/60);T.tickRace(G,obj,1/60);
              }
              if(G.missionIndex!==2)throw Error('Physics race did not finish with a win');
              return;
            } else {
              const at=__CC.objPos(); if(!at)throw Error('No target for '+obj.id);
              if(obj.foot||obj.kind==='stealCop')G.player=T.makeFoot(G,at.x,at.y,0);
              else {G.player.x=at.x;G.player.y=at.y;G.player.vx=G.player.vy=0;}
              if(obj.clearHeat)G.wanted=0;
              G.interactP=['collect','stealCop'].includes(obj.kind);
            }
            for(let f=0;f<(obj.hold?125:1);f++)T.tickMission(G,1/60);
            G.interactP=false;T.render(G);
          });
        }
        await dialogue(page,choices);
        const state=await page.evaluate(()=>__CC.state());
        assert.equal(state.scene,'end');assert.equal(state.mission,6);assert.equal(state.chips,choices.stash==='safe'?7500:9200);
        assert.equal(state.flags.neuralDebt,0);
        await page.screenshot({path:path.join(output,`ending-${choices.stash}.png`)});
        await page.evaluate(()=>{T.loadSave(__CC.G);T.render(__CC.G)});assert.equal(await page.evaluate(()=>__CC.G.scene),'end');
      });
    }
    await check('automatic resolution changes keep a rendered frame on screen', async () => {
      const live = await browser.newPage({ viewport: { width: 844, height: 390 } });
      live.on('pageerror', e => failures.push(e.message));
      await live.goto(base); await live.waitForFunction(() => !!window.__CC);
      const result = await live.evaluate(async () => {
        const G = __CC.G;
        G.resScale = 1; G.settings.autoRes = true; G._ar = { t: 2, n: 10, sum: 1 };
        const before = G.canvas.width;
        return new Promise(resolve => requestAnimationFrame(() => {
          const pixels = G.ctx.getImageData(0, 0, G.canvas.width, G.canvas.height).data;
          resolve({ resized: before !== G.canvas.width, painted: pixels.some((v, i) => i % 4 !== 3 && v > 30) });
        }));
      });
      assert.equal(result.resized, true); assert.equal(result.painted, true); await live.close();
    });
    await check('Web Audio starts, produces a signal and mutes through the master bus',async()=>{
      const result=await page.evaluate(async()=>{
        const A=__CC.G.audio;A.unlock();await A.ctx.resume();
        const meter=A.ctx.createAnalyser();meter.fftSize=2048;const data=new Float32Array(meter.fftSize);
        const master=audioGains[0];master.connect(meter);
        A.setMaster(.9);A.shot();await new Promise(r=>setTimeout(r,40));meter.getFloatTimeDomainData(data);
        const signal=data.some(x=>Math.abs(x)>.001);
        A.setMaster(0);await new Promise(r=>setTimeout(r,120));meter.getFloatTimeDomainData(data);
        const muted=data.every(x=>Math.abs(x)<.00001);A.setMaster(.9);master.disconnect(meter);
        return {state:A.ctx.state,signal,muted};
      });
      assert.equal(result.state,'running');assert.equal(result.signal,true);assert.equal(result.muted,true);
    });
    assert.deepEqual(failures,[],'No browser exceptions or HTTP asset failures');
    console.log(`${checks} browser checks passed. Screenshots: ${output}`);
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1});
