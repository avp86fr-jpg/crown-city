/* Actual fixed-step gameplay, staged starting conditions and cinematic cameras.
   --preview renders three samples per shot; full mode pipes PNGs to FFmpeg.
   This offline 30 fps capture is not a performance benchmark. */
const {chromium}=require('playwright'),fs=require('fs'),{spawn}=require('child_process'),{once}=require('events');
const preview=process.argv.includes('--preview'),out='.qa/final-media';fs.mkdirSync(out,{recursive:true});
const shots=[
 ['pursuit',4,'MAKE YOUR OWN HEAT.','01 / THE STREETS'],
 ['street',2,'EVERY DEBT HAS A NAME.','02 / CROWN CITY'],
 ['canal',4,'ALWAYS HAVE A SECOND EXIT.','03 / CROWN CANAL'],
 ['casino',2,'THE HOUSE KEEPS TWO SETS OF BOOKS.','04 / METAWIN TERRACE'],
 ['gold',2,'GOLD MAGE OWNS THE NIGHT.','05 / THE PALACE ARCHIVE'],
 ['heli',4,'TAKE THE HIGH ROAD.','06 / SPARROW'],
 ['plane',4,'LEAVE THE SKYLINE BEHIND.','07 / CROWN AIRFIELD'],
 ['forest',4,'THE CITY IS ONLY THE BEGINNING.','08 / PINEWATCH'],
 ['train',4,'ONE LAST TRAIN.','09 / CROWN TRANSIT'],
 ['combat',4,'NO CLEAN GETAWAYS.','10 / THE HEAT'],
 ['night',6,'THE HOUSE OWES YOU.','11 / AFTER HOURS'],
 ['end',4,'','12 / YOUR NIGHT STARTS HERE'],
];
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});const report=process.argv.some(a=>a.startsWith('--only='))&&fs.existsSync(`${out}/capture-report.json`)?JSON.parse(fs.readFileSync(`${out}/capture-report.json`)):[];
try{
 const page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{requestAnimationFrame=()=>0;let seed=90421;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};});
 await page.goto(process.env.CC_URL||'http://127.0.0.1:8000/');await page.waitForFunction(()=>window.__CC,null,{polling:100});
 await page.evaluate(async()=>{
  window.T=(await import('./src/game.js')).testing;window.R=await import('./src/transit.js');window.A=await import('./src/aviation.js');
  const font=new FontFace('FilmAnton','url(about/assets/fonts/anton-latin.woff)');await font.load();document.fonts.add(font);
  window.film=document.createElement('canvas');film.width=1280;film.height=720;
  window.filmControl={};__CC.G._pulseInput=()=>Object.assign(__CC.G.input,{x:0,y:0,keyDrive:true,fire:false,hand:false,boost:false,sprint:false,...filmControl});
 });
 for(const [name,duration,headline,chapter] of shots.filter(s=>!process.argv.some(a=>a.startsWith('--only='))||process.argv.find(a=>a.startsWith('--only=')).slice(7).split(',').includes(s[0]))){
  await page.evaluate(async name=>{
   const G=__CC.G;T.startFreeRide(G);T.clearRecoveryState(G);G.scene='play';G.wanted=0;G.health=100;G._endT=0;G.chips=1000;
   Object.assign(G.settings,{quality:'med',autoRes:false,timeSpeed:0,autoFS:false,reducedMotion:false});G.resScale=1;T.applyQuality(G);T.fit(G);
   Object.assign(G,{weather:'clear',weatherT:1e9,rainAmt:0,wet:0,fog:0,sand:0,time:16.8,hideHUD:true,toastT:0,contactTalk:null});
   G.action.contract=null;G.action.messageT=0;G.input.touchJoy.active=false;G.input.mouse.down=G.input.mouse.fire=false;G.cam.northUp=true;G.cam.rot=0;G.cineLock=false;G._filmStart=null;window.filmControl={};
   const car=(kind,x,y,rot,speed=0)=>{const v=G.vehicles.filter(v=>v.kind===kind&&!v.dead).sort((a,b)=>Math.hypot(a.x-x,a.y-y)-Math.hypot(b.x-x,b.y-y))[0]||T.makeVeh(kind,x,y,rot);if(!G.vehicles.includes(v))G.vehicles.push(v);T.enterVeh(G,v,true);Object.assign(v,{x,y,rot,vx:Math.sin(rot)*speed,vy:-Math.cos(rot)*speed,health:100,dead:false,parked:false,altitude:0,airspeed:speed,landing:false});return v;};
   const foot=(x,y)=>{const p=T.findSafe(G,x,y,8,true);G.player=T.makeFoot(G,p.x,p.y,0);};
   if(['pursuit','night','end'].includes(name)){
    const night=name!=='pursuit';car('riot',2108,night?2900:2820,0,135);G.time=night?21:17.2;G.wet=night?.48:0;
    for(let i=0;i<2;i++){const c=T.makeVeh('metro',i?2074:2105,G.player.y+155+i*160,0,{vx:0,vy:-120,cop:true,ai:true,chasing:true,siren:true,keep:true,parked:false});G.vehicles.push(c);G.cops.push(c);}G.wanted=3;G.seenT=0;
   }
   if(name==='street'){foot(2030,2950);for(let i=0;i<720;i++)T.tick(G,1/60);}
   if(name==='canal'){car('wake',6968,3160,Math.PI,90);G.time=17;}
   if(name==='casino'){foot(8050,3280);G.time=17.5;}
   if(name==='gold'){T.openVN(G,'m5_intro');await Promise.all(G.storyLoads.values());G.vn.char=10000;G.vn.t=2;}
   if(name==='heli'){const v=car('heli',7920,3450,0);A.restoreAircraft(v,{altitude:0,rotor:.8});G.time=17.5;}
   if(name==='plane'){const v=car('plane',7220,7500,Math.PI/2,155);A.restoreAircraft(v,{altitude:0,airspeed:155,vx:155,rotor:1});G.time=16.6;}
   if(name==='forest'){car('hog',10872,4750,0,80);G.time=16.5;}
   if(name==='train'){foot(10215,4984);G.transit.clock=35;G.time=18;}
   if(name==='combat'){
    foot(2140,2950);G.time=18;G.player.rot=0;G.action.weapon=1;G.action.ammo[1]=30;
    const v=T.makeVeh('metro',2100,2740,Math.PI,{cop:true,ai:true,siren:true,parked:false,keep:true,health:100});G.vehicles.push(v);G.cops.push(v);G.wanted=2;
    const cover=T.makeVeh('fare',2110,2920,0,{parked:true});G.vehicles.push(cover);
   }
   Object.assign(G.cam,{x:G.player.x,y:G.player.y,scale:1.2,rot:0,shake:0});
   if(name==='casino')Object.assign(G.cam,{x:8005,y:3230,scale:1.2});
   if(name==='train')Object.assign(G.cam,{x:10320,y:4900,scale:1.2});
   G._filmStart={x:G.cam.x,y:G.cam.y};
   T.render(G);
  },name);
  for(let i=0;i<30;i++){await page.evaluate(()=>T.render(__CC.G));await page.waitForTimeout(20);}
  let encoder=null,done=null,stderr='';
  if(!preview){encoder=spawn('ffmpeg',['-v','error','-y','-f','image2pipe','-framerate','30','-vcodec','png','-i','pipe:0','-an','-c:v','libx264','-preset','fast','-crf','19','-pix_fmt','yuv420p',`${out}/${name}.mp4`]);encoder.stderr.on('data',d=>stderr+=d);done=once(encoder,'close');}
  const frames=Math.round(duration*30),samples=[0,Math.floor(frames*.5),frames-1];let state;
  for(let i=0;i<frames;i++){
   const grab=!preview||samples.includes(i);
   const result=await page.evaluate(({name,i,frames,grab,headline,chapter,samples})=>{
    const G=__CC.G,t=i/30,p=i/Math.max(1,frames-1);window.filmControl={};
    if(['pursuit','night','end','canal','forest','plane'].includes(name))filmControl.y=1;
    if(name==='heli'){filmControl.boost=true;if(t>1.3)filmControl.y=.5;}
    if(name==='combat'){filmControl.fire=t>.35&&t<2.9;filmControl.x=t>2.9?.45:0;}
    if(name==='street')filmControl.y=.3;
    T.tick(G,1/60);T.tick(G,1/60);
    if(['pursuit','night','end'].includes(name)){G.cam.x=G.player.x+65;G.cam.y=G.player.y+15;G.cam.scale=1.48-p*.1;G.cam.rot=0;}
    if(name==='canal'){G.cam.x=G.player.x-125;G.cam.y=G.player.y+35;G.cam.scale=1.16;G.cam.rot=0;}
    if(name==='street'){G.cam.x=2100+p*60;G.cam.y=2920-p*35;G.cam.scale=1.32;}
    if(name==='casino'){G.cam.x=7960+p*125;G.cam.y=3205+p*28;G.cam.scale=1.22-p*.1;}
    if(name==='heli'){G.cam.x=G.player.x-90;G.cam.y=G.player.y-45;G.cam.scale=1.12-p*.13;G.cam.rot=0;}
    if(name==='plane'){G.cam.x=G.player.x+100;G.cam.y=G.player.y;G.cam.scale=1.1-p*.18;G.cam.rot=0;}
    if(name==='forest'){G.cam.x=G.player.x+175;G.cam.y=G.player.y-70;G.cam.scale=1.15;G.cam.rot=0;}
    if(name==='train'){G.cam.x=10300;G.cam.y=4930-p*70;G.cam.scale=1.2+p*.08;}
    if(name==='combat'){G.cam.x=2120;G.cam.y=2850;G.cam.scale=1.7;G.cam.rot=0;G.input.mouse.fire=false;}
    G.cam.shake=0;G.toastT=0;G.action.messageT=0;
    T.render(G);if(!grab)return null;
    const c=film.getContext('2d');c.globalAlpha=1;c.drawImage(G.canvas,0,0,1280,720);
    const raw=film.toDataURL('image/png').split(',')[1];
    // Graphics are confined to the film, never shipped into the gameplay renderer.
    if(name==='gold'){c.fillStyle='#0c1017';c.fillRect(0,548,1280,172);}
    const shade=c.createLinearGradient(0,460,0,720);shade.addColorStop(0,'rgba(4,12,16,0)');shade.addColorStop(1,'rgba(4,12,16,.94)');c.fillStyle=shade;c.fillRect(0,460,1280,260);
    c.fillStyle='#79d8c8';c.fillRect(48,596,36,3);c.font='600 13px sans-serif';c.fillText(chapter,98,603);
    c.fillStyle='#f6edd6';c.font='38px FilmAnton';c.fillText(headline,48,656);
    c.font='600 12px sans-serif';c.fillStyle='#e3dfcd';c.textAlign='right';c.fillText('CROWN CITY  /  AFTER HOURS',1232,48);c.textAlign='left';
    if(name==='pursuit'&&t<1.45){c.globalAlpha=Math.min(1,(1.45-t)*3);c.font='82px FilmAnton';c.fillText('CROWN CITY.',48,142);c.globalAlpha=1;}
    if(name==='end'){
     c.fillStyle='rgba(5,14,18,.76)';c.fillRect(0,0,1280,720);c.textAlign='center';
     c.fillStyle='#79d8c8';c.font='700 16px sans-serif';c.fillText('AFTER HOURS',640,190);
     c.fillStyle='#fff1d6';c.font='122px FilmAnton';c.fillText('CROWN CITY.',640,343);
     c.font='29px FilmAnton';c.fillText('THE HOUSE OWES YOU.',640,400);
     c.fillStyle='#79d8c8';c.fillRect(490,456,300,54);c.fillStyle='#0b2426';c.font='22px FilmAnton';c.fillText('PLAY FREE IN YOUR BROWSER',640,491);
     c.fillStyle='#efecd9';c.font='18px sans-serif';c.fillText('avp86fr-jpg.github.io/crown-city',640,557);
     c.font='13px sans-serif';c.fillStyle='#c0c9c5';c.fillText('An independent MetaWinners-inspired crime story',640,600);c.textAlign='left';
    }
    return {png:film.toDataURL('image/png').split(',')[1],raw:samples?.includes?.(i)?raw:null,state:{scene:G.scene,x:G.player.x,y:G.player.y,health:G.health,vehicleHealth:G.player.health,altitude:G.player.altitude||0,speed:Math.hypot(G.player.vx||0,G.player.vy||0),particles:G.particles.length}};
   },{name,i,frames,grab,headline,chapter,samples});
   if(result){state=result.state;const png=Buffer.from(result.png,'base64');if(samples.includes(i)){fs.writeFileSync(`${out}/${name}-${i}.png`,png);if(result.raw)fs.writeFileSync(`${out}/${name}-raw-${i}.png`,Buffer.from(result.raw,'base64'));}if(encoder&&!encoder.stdin.write(png))await once(encoder.stdin,'drain');}
  }
  if(encoder){encoder.stdin.end();const [code]=await done;if(code!==0)throw Error(stderr);}
  const entry={name,duration,frames,state},old=report.findIndex(s=>s.name===name);if(old>=0)report[old]=entry;else report.push(entry);fs.writeFileSync(`${out}/capture-report.json`,JSON.stringify(report,null,2));console.log(name,JSON.stringify(state));
 }
 if(errors.length)throw Error(errors.join('\n'));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
