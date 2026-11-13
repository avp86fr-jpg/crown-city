// Optional real-browser verification. Serve the repository before running.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const base = process.env.CC_URL || process.env.GAME_URL || 'http://127.0.0.1:8000/';
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
    if (!b) throw Error('Button missing: ' + label + ' in ' + G.scene + ': ' + G.buttons.map(b=>b.label).join(', '));
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
      await button(page, 'NEW GAME'); await page.locator('#skipIntro').click(); await step(page); await dialogue(page, { stash: 'safe' });
      assert.equal(await page.evaluate(() => __CC.G.scene), 'play');
      assert.equal(await page.evaluate(() => __CC.G.missionIndex), 0);
    });
    await check('real keyboard movement, firing, map clicks, pause, save and reload', async () => {
      await page.evaluate(() => {
        const G=__CC.G;
        // This check measures keyboard input. A randomly spawned car crossing
        // the 38 px walking corridor made the assertion depend on traffic luck.
        // Hull avoidance and runovers have their own physical regression tests.
        G.vehicles=G.vehicles.filter(v=>Math.hypot(v.x-2108,v.y-2400)>180);
        G.peds=G.peds.filter(p=>Math.hypot(p.x-2108,p.y-2400)>180);
        G.streetVehicleSource=null;G.nearVehicles=null;
        const at=T.findSafe(G,2108,2400,10,true);G.player=T.makeFoot(G,at.x,at.y,0);
      });
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
    await check('Continue recovers an interrupted race save through the actual title button', async () => {
      const {page: recovery,context}=await setup(browser,{viewport:{width:844,height:390},hasTouch:true,isMobile:true});
      try {
        await recovery.evaluate(()=>{
          const G=__CC.G;T.startNew(G);G.missionIndex=1;G.objectiveIndex=1;G.needsBegin=false;G.scene='play';
          const saved=T.snapshot(G);saved.race={version:2,i:4,rivalI:3,t:20,countdown:0,rival:{x:2300,y:7900,rot:Math.PI/2}};
          localStorage.setItem('mw_crown_city_v1',JSON.stringify(saved));
        });
        await recovery.reload();await recovery.waitForFunction(()=>!!window.__CC,null,{polling:100});
        await recovery.evaluate(async()=>{window.T=(await import(new URL('src/game.js',location.href).href)).testing;T.render(__CC.G);});
        await button(recovery,'CONTINUE',true);
        assert.deepEqual(await recovery.evaluate(()=>({scene:__CC.G.scene,mission:__CC.G.missionIndex,objective:__CC.G.objectiveIndex,race:__CC.G.race})),{scene:'play',mission:1,objective:0,race:null});
      } finally {await context.close();await page.bringToFront();await page.evaluate(()=>{__CC.G.scene='play';T.render(__CC.G);});}
    });
    await check('weapon changes, reloads, dodge and crew contracts respond to keyboard input', async () => {
      await page.keyboard.press('KeyQ'); await step(page);assert.equal(await page.evaluate(()=>__CC.G.action.weapon),1);
      await page.keyboard.down('KeyK');await step(page,7);await page.keyboard.up('KeyK');assert.ok(await page.evaluate(()=>__CC.G.action.ammo[1]<28));
      await page.keyboard.press('KeyX');await step(page);assert.ok(await page.evaluate(()=>__CC.G.action.reloadT>0));await step(page,100);assert.equal(await page.evaluate(()=>__CC.G.action.ammo[1]),28);
      await page.keyboard.press('Space');await step(page);assert.ok(await page.evaluate(()=>__CC.G.action.dodgeT>0));await step(page,30);
      await page.keyboard.press('KeyC');await step(page);assert.equal(await page.evaluate(()=>__CC.G.scene),'crew');
      await button(page,'TAKE JOB / +650');assert.equal(await page.evaluate(()=>__CC.G.action.contract.id),'courier');
      await page.evaluate(()=>{const G=__CC.G;__CC.save();T.loadSave(G);T.render(G)});assert.equal(await page.evaluate(()=>__CC.G.action.contract.id),'courier');assert.ok(await page.evaluate(()=>__CC.G.waypoint));
      await page.keyboard.press('KeyC');await step(page);await button(page,'CANCEL CONTRACT');await button(page,'BACK TO CITY');
    });
    await check('workshop buttons repair, tune and respray a nearby car with persistent costs',async()=>{
      await page.evaluate(()=>{const G=__CC.G,s=G.services.find(s=>s.id==='garage');const car=T.makeVeh('riot',s.x,s.y,0);G.vehicles.push(car);T.enterVeh(G,car,true);car.health=20;car.wrecked=true;G.chips=1400;G.wanted=0;G.evading=true;});
      await page.keyboard.press('KeyC');await step(page);assert.equal(await page.evaluate(()=>__CC.G.scene),'garage');
      await button(page,'REPAIR / 120');assert.equal(await page.evaluate(()=>__CC.G.player.health),100);assert.equal(await page.evaluate(()=>__CC.G.chips),1280);
      await button(page,'ENGINE + TIRES / 500');assert.equal(await page.evaluate(()=>__CC.G.action.upgrades),1);
      await button(page,'LOSE HEAT / 250');assert.equal(await page.evaluate(()=>__CC.G.player.paint),1);assert.equal(await page.evaluate(()=>__CC.G.chips),530);
      await button(page,'BACK TO CITY');await page.evaluate(()=>{T.loadSave(__CC.G);T.render(__CC.G)});assert.equal(await page.evaluate(()=>__CC.G.action.upgrades),1);assert.equal(await page.evaluate(()=>__CC.G.player.paint),1);
    });
    await check('desktop and phone menus stay in bounds with Continue available', async () => {
      for (const [width, height] of [[1280,720],[844,390],[390,844],[667,375]]) {
        await page.setViewportSize({width,height});
        for (const scene of ['title','pause','map','settings','brief','crew','garage','dossier']) {
          await page.evaluate(scene => { const G = __CC.G; G.scene = scene; G.pausedFrom = 'play'; T.fit(G); T.render(G); }, scene);
          assert.deepEqual(await page.evaluate(() => { const G = __CC.G; return G.buttons.filter(b => b.x < 0 || b.y < 0 || b.x + b.w > G.canvas.width + 1 || b.y + b.h > G.canvas.height + 1).map(b => b.label); }), []);
          if (['title','settings','crew','garage'].includes(scene)) await page.screenshot({path:path.join(output,`${scene}-${width}.png`)});
        }
      }
    });
    await check('Chrome fullscreen enters and exits through real click and F gestures',async()=>{
      await page.setViewportSize({width:1280,height:720});await page.evaluate(()=>{const G=__CC.G;G.scene='play';T.fit(G);T.render(G);G._syncTouch();});
      await page.locator('#tFS').click();await page.waitForFunction(()=>!!document.fullscreenElement,null,{polling:100});
      assert.equal(await page.locator('#tFS').getAttribute('aria-pressed'),'true');
      await page.keyboard.press('KeyF');await page.waitForFunction(()=>!document.fullscreenElement,null,{polling:100});
      assert.equal(await page.locator('#tFS').getAttribute('aria-pressed'),'false');
      await page.keyboard.press('KeyF');await page.waitForFunction(()=>!!document.fullscreenElement,null,{polling:100});
      await page.locator('#tFS').click();await page.waitForFunction(()=>!document.fullscreenElement,null,{polling:100});
    });
    const { page: phone, context: mobile } = await setup(browser, {viewport:{width:390,height:844},hasTouch:true,isMobile:true,deviceScaleFactor:2});
    await phone.evaluate(() => { __CC.startNew(); __CC.skipAllVN(); __CC.startPlay(); T.render(__CC.G); });
    await step(phone, 10);
    await check('multi-touch joystick and RUN release; phone MAP, PAUSE and TAKE work', async () => {
      const cdp = await mobile.newCDPSession(phone);
      const start = await phone.evaluate(() => {
        const G=__CC.G;
        // This verifies touch input, not an accidental traffic encounter. A
        // clear starting circle alone does not guarantee a clear running path.
        for(const [ox,oy]of [[2108,2400],[8200,3200]])for(let dy=-144;dy<=144;dy+=24)for(let dx=-144;dx<=144;dx+=24){
          const x=ox+dx,y=oy+dy;
          if(G.surfaceAt(x,y)==='road'||G.vehicles.some(v=>Math.hypot(v.x-x,v.y-y)<220)||G.peds.some(p=>Math.hypot(p.x-x,p.y-y)<90))continue;
          let clear=true;for(let d=0;d<=96;d+=8)if(!T.footClear(G,x,y-d,12)){clear=false;break;}
          if(clear){G.player=T.makeFoot(G,x,y,0);return y;}
        }
        throw Error('No clear corridor for the touch movement check');
      });
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:70,y:650,id:1}]});
      await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:70,y:585,id:1}]});
      await phone.waitForFunction(()=>__CC.G.input.touchJoy.active&&__CC.G.input.touchJoy.y>.8,null,{polling:50});
      const run=await phone.locator('#tSprint').boundingBox();
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:70,y:585,id:1},{x:run.x+run.width/2,y:run.y+run.height/2,id:2}]});
      await phone.waitForFunction(()=>__CC.G.input.tSprint,null,{polling:50});
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
    await check('phone weapon, reload, roll and crew buttons are usable',async()=>{
      await phone.locator('#tWeapon').tap();await step(phone);assert.equal(await phone.evaluate(()=>__CC.G.action.weapon),1);
      const fire=await phone.locator('#tFire').boundingBox(),cdp=await mobile.newCDPSession(phone);
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:fire.x+fire.width/2,y:fire.y+fire.height/2,id:19}]});await step(phone,5);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
      await phone.locator('#tReload').tap();await step(phone);assert.ok(await phone.evaluate(()=>__CC.G.action.reloadT>0));
      await phone.locator('#tDodge').tap();await step(phone);assert.ok(await phone.evaluate(()=>__CC.G.action.dodgeT>0));await step(phone,25);
      await phone.locator('#tCrew').tap();await step(phone);assert.equal(await phone.evaluate(()=>__CC.G.scene),'crew');await button(phone,'BACK TO CITY',true);
    });
    await check('mobile dual-stick aiming changes shot direction while movement remains independent',async()=>{
      await phone.evaluate(()=>{const G=__CC.G;G.scene='play';G.settings.aimAssist=false;G.player=T.makeFoot(G,2108,2400,0);G.action.shotT=G.action.reloadT=G.action.dodgeT=0;G.action.ammo[1]=28;G.action.messageT=0;G.action.messages=[];G._syncTouch();T.render(G);});
      const fire=await phone.locator('#tFire').boundingBox(),x=fire.x+fire.width/2,y=fire.y+fire.height/2,cdp=await mobile.newCDPSession(phone);
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:65,y:650,id:31},{x,y,id:32}]});
      await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:65,y:600,id:31},{x:x+45,y,id:32}]});await step(phone,15);
      const state=await phone.evaluate(()=>({angle:__CC.G.player.aimRot,joy:__CC.G.input.touchJoy.active,aim:__CC.G.input.touchAim.aiming}));
      assert.ok(Math.abs(state.angle-Math.PI/2)<.15);assert.ok(state.joy&&state.aim);
      await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await step(phone);assert.equal(await phone.evaluate(()=>__CC.G.input.touchAim.active||__CC.G.input.tFire),false);
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:65,y:650,id:41},{x,y,id:42}]});
      await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:65,y:600,id:41},{x:x+45,y,id:42}]});await step(phone);
      await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});await step(phone);
      assert.equal(await phone.evaluate(()=>__CC.G.input.touchJoy.active||__CC.G.input.touchAim.active||__CC.G.input.tFire||__CC.G.input.x!==0||__CC.G.input.y!==0),false);
    });
    await check('mobile layout, opacity and aim settings persist; dossier and new contracts open',async()=>{
      await phone.locator('#tPause').tap();await step(phone);await button(phone,'SETTINGS',true);await button(phone,'CONTROLS',true);
      await button(phone,'THUMB LAYOUT',true);await button(phone,'CONTROL OPACITY',true);await button(phone,'CONTROL SIZE',true);
      assert.equal(await phone.evaluate(()=>__CC.G.settings.leftHanded),true);assert.equal(await phone.locator('body').evaluate(e=>e.classList.contains('left-handed')),true);
      assert.equal(await phone.evaluate(()=>JSON.parse(localStorage.getItem('mw_crown_city_settings')).leftHanded),true);
      await button(phone,'BACK',true);await button(phone,'STORY / DOSSIER',true);assert.equal(await phone.evaluate(()=>__CC.G.scene),'dossier');await button(phone,'BACK TO CITY',true);
      await phone.locator('#tCrew').tap();await step(phone);
      const nextJobs=await phone.evaluate(()=>__CC.G.buttons.find(b=>/^JOBS 1 \/ \d+/.test(b.label))?.label);
      assert.ok(nextJobs,'crew menu offers the next page of jobs');await button(phone,nextJobs,true);
      await button(phone,'TAKE JOB / +950',true);assert.equal(await phone.evaluate(()=>__CC.G.action.contract.id),'rescue');
      await phone.evaluate(()=>{__CC.save();T.loadSave(__CC.G);T.render(__CC.G)});assert.ok(await phone.evaluate(()=>__CC.G.waypoint));
      await phone.locator('#tCrew').tap();await step(phone);await button(phone,'CANCEL CONTRACT',true);await button(phone,'BACK TO CITY',true);
      await phone.evaluate(()=>{const G=__CC.G;G.settings.leftHanded=false;G.settings.controlSize=1;G._syncTouch();});
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
              const {circuitPilot}=await import('./src/motorsport.js');
              T.startRace(G,obj); G.player.racerIndex=0;G.race.countdown=0; G.race.started=true;
              let frames=0;
              while(G.race&&frames++<60*240) {
                G.ticks++;const car=G.player;
                T.tickDrive(G,car,circuitPilot(G,car,1/60),1/60,true);G.cam.x=car.x;G.cam.y=car.y;
                T.tickVehicles(G,1/60);T.tickRace(G,obj,1/60);
              }
              if(G.missionIndex!==2)throw Error('Physics race did not finish with a win');
              return;
            } else {
              const at=__CC.objPos(); if(!at)throw Error('No target for '+obj.id);
              if(obj.foot||obj.kind==='stealCop')G.player=T.makeFoot(G,at.x,at.y,0);
              else {G.player.x=at.x;G.player.y=at.y;G.player.vx=G.player.vy=0;}
              if(obj.clearHeat)G.wanted=0;
              if(obj.kind==='intercept')G.van.health=65;
              G.interactP=['collect','stealCop'].includes(obj.kind);
            }
            for(let f=0;f<((obj.hold||obj.hack)?Math.ceil((obj.hold||obj.hack)*60)+1:1);f++)T.tickMission(G,1/60);
            G.interactP=false;T.render(G);
          });
        }
        await dialogue(page,choices);
        const state=await page.evaluate(()=>__CC.state());
        assert.equal(state.scene,'end');assert.equal(state.mission,6);assert.equal(state.chips,choices.stash==='safe'?8700:10400);
        assert.equal(state.flags.neuralDebt,0);
        await page.screenshot({path:path.join(output,`ending-${choices.stash}.png`)});
        await page.evaluate(()=>{T.loadSave(__CC.G);T.render(__CC.G)});assert.equal(await page.evaluate(()=>__CC.G.scene),'end');
        await button(page,'KEEP DRIVING');assert.equal(await page.evaluate(()=>__CC.G.scene),'play');
        await page.evaluate(()=>{T.loadSave(__CC.G);T.render(__CC.G)});assert.equal(await page.evaluate(()=>__CC.G.scene),'play');assert.equal(await page.evaluate(()=>__CC.G.freeRoam),true);
      });
    }
    await check('automatic resolution changes keep a rendered frame on screen', async () => {
      const live = await browser.newPage({ viewport: { width: 844, height: 390 } });
      live.on('pageerror', e => failures.push(e.message));
      await live.goto(base); await live.waitForFunction(() => !!window.__CC);
      const before = await live.evaluate(async () => {
        const G = __CC.G;
        const T=(await import(new URL('src/game.js',location.href).href)).testing;
        G.resScale = 1; G.settings.autoRes = true; T.fit(G); G._ar = { t: 2, n: 10, sum: 1 };
        return {world:G.worldWidth,ui:G.canvas.width,frames:G.renderCount};
      });
      // The title paints at 30 Hz; an animation callback can precede its next
      // presentation. Wait for the actual resize and draw, not a single RAF.
      await live.waitForFunction(before=>__CC.G.worldWidth<before.world&&__CC.G.renderCount>before.frames,before,{timeout:5000});
      const result=await live.evaluate(before=>{
        const G=__CC.G,pixels=G.ctx.getImageData(0,0,G.canvas.width,G.canvas.height).data;
        return {sharpUI:before.ui===G.canvas.width,painted:pixels.some((v,i)=>i%4!==3&&v>30)};
      },before);
      assert.equal(result.sharpUI,true); assert.equal(result.painted, true); await live.close();
    });
    await check('battery saver lowers presentation rate while simulation and native touch controls continue',async()=>{
      const live=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2,hasTouch:true,isMobile:true});
      live.on('pageerror',e=>failures.push(e.message));await live.goto(base);await live.waitForFunction(()=>!!window.__CC);
      const result=await live.evaluate(async()=>{
        const G=__CC.G;__CC.startNew();__CC.skipAllVN();__CC.startPlay();G.settings.batterySaver=true;G.settings.quality='low';G.settings.autoRes=false;G.resScale=.7;
        const T=(await import(new URL('src/game.js',location.href).href)).testing;T.fit(G);T.render(G);
        const ui=G.canvas.width,world=G.worldWidth,tick=G.ticks,frames=G.renderCount;
        await new Promise(r=>setTimeout(r,1200));return {ui,world,frames:G.renderCount-frames,ticks:G.ticks-tick};
      });
      assert.ok(result.ui>=292&&result.ui<=390);assert.equal(result.world,result.ui);assert.ok(result.frames>=10&&result.frames<=42);assert.ok(result.ticks>result.frames*1.5);
      console.log('Battery sample:',JSON.stringify(result));await live.close();
    });
    await check('arranged music streams, changes station and yields to the pursuit track',async()=>{
      await page.evaluate(()=>{const G=__CC.G;G.scene='play';G.wanted=0;G.audio.station=0;if(G.player.type!=='veh')T.enterVeh(G,G.vehicles.find(v=>!v.dead&&!v.def.boat),true);G.audio.unlock();G.audio.update(G,.1)});
      await page.waitForFunction(()=>{__CC.G.audio.update(__CC.G,.1);return __CC.G.audio.recordedMusic;},null,{polling:100});
      assert.ok(await page.evaluate(()=>__CC.G.audio.trackTitle.includes('NIGHT DIVIDEND')));
      await page.evaluate(()=>{const G=__CC.G;G.audio.nextStation();G.audio.update(G,.1)});
      await page.waitForFunction(()=>{__CC.G.audio.update(__CC.G,.1);return __CC.G.audio.recordedMusic;},null,{polling:100});assert.ok(await page.evaluate(()=>__CC.G.audio.trackTitle.includes('SIDEWALK')));
      await page.evaluate(()=>{const G=__CC.G;G.wanted=4;G.audio.update(G,.1)});await page.waitForFunction(()=>{__CC.G.audio.update(__CC.G,.1);return __CC.G.audio.recordedMusic;},null,{polling:100});assert.ok(await page.evaluate(()=>__CC.G.audio.trackTitle.includes('NO CLEAN EXIT')));
    });
    await check('on-foot score pauses inactive stations and Free Ride preserves the story save',async()=>{
      await page.evaluate(()=>{const G=__CC.G;G.wanted=0;G.player=T.makeFoot(G,760,3180,0);G.audio.update(G,.1);});
      await page.waitForFunction(()=>{const G=__CC.G;G.audio.update(G,.1);return G.audio.recordedMusic&&G.audio.trackTitle.includes('MIDNIGHT')&&G.audio.activeStreams===1;},null,{polling:100});
      const story=await page.evaluate(()=>localStorage.getItem('mw_crown_city_v1'));
      await page.evaluate(()=>{const G=__CC.G;G.scene='title';T.render(G);});await button(page,'FREE RIDE');
      assert.equal(await page.evaluate(()=>__CC.G.mode),'freeride');assert.equal(await page.evaluate(()=>__CC.G.scene),'play');
      assert.equal(await page.evaluate(()=>localStorage.getItem('mw_crown_city_v1')),story);
      await page.evaluate(()=>{__CC.G.chips=2244;__CC.save();__CC.G.scene='title';T.render(__CC.G);});await button(page,'FREE RIDE');assert.equal(await page.evaluate(()=>__CC.G.chips),2244);
    });
    await check('mobile canvas retains visible world pixels through menus, quality switches and rotation',async()=>{
      for(const [width,height] of [[390,844],[844,390]]){
        await phone.setViewportSize({width,height});
        for(const [scene,quality] of [['play','low'],['pause','low'],['title','low'],['play','high'],['play','low']]){
          const painted=await phone.evaluate(({scene,quality})=>{const G=__CC.G;G.scene=scene;G.settings.quality=quality;T.fit(G);T.render(G);const d=G.ctx.getImageData(G.canvas.width*.25,G.canvas.height*.25,G.canvas.width*.5,G.canvas.height*.5).data;let lit=0,opaque=0;for(let i=0;i<d.length;i+=4){if(d[i+3]===255)opaque++;if(Math.max(d[i],d[i+1],d[i+2])>30)lit++;}return {opaque:opaque/(d.length/4),lit:lit/(d.length/4),layered:G.layered};},{scene,quality});
          assert.equal(painted.layered,false);assert.equal(painted.opaque,1);assert.ok(painted.lit>.1,JSON.stringify({scene,quality,painted}));
        }
        assert.equal(await phone.evaluate(()=>__CC.G.worldWidth===__CC.G.canvas.width),true);
      }
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
