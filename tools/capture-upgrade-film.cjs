/* 60-second release film. Actual fixed-step gameplay with staged starting states
   and cinematic cameras. Offline capture is not a hardware performance claim. */
const {chromium}=require('playwright'),fs=require('node:fs'),{spawn}=require('node:child_process'),{once}=require('node:events');
const OUT='.qa/upgrade-film',preview=process.argv.includes('--preview'),only=process.argv.find(x=>x.startsWith('--only='))?.slice(7).split(',');fs.mkdirSync(OUT,{recursive:true});
const shots=[
 ['hook',1,'CHAOS IS BACK.','A METAWINNERS CRIME STORY'],
 ['crew',2,'STEAL THE KEY. LOSE THE HEAT.','HUNTER / THE FIRST JOB'],
 ['choice',1,'YOUR CALL. YOUR CONSEQUENCES.','STORY / CHOOSE YOUR CREW’S NEXT MOVE'],
 ['convoy',2,'HIT THE CONVOY.','COLD WALLET / THE SEALED ARCHIVE'],
 ['pursuit',2,'MAKE YOUR OWN EXIT.','DRIVE / DRIFT / OUTRUN METRO'],
 ['circuit',3,'TAKE THE GRID.','EXPANDED CIRCUIT / REAL RIVALS / TIME TRIALS'],
 ['racefast',1,'DON’T LIFT.','NEW RACE PACE / REFINED HANDLING'],
 ['combat',2,'ROLL. AIM. RETURN FIRE.','PRECISE SHOOTING / COVER / DODGE'],
 ['rocket',2,'BRING SOMETHING LOUDER.','NEW / CROWN RPG'],
 ['wreck',1,'MAKE AN IMPACT.','NEW / BLAST DAMAGE / VEHICLE WRECKS'],
 ['canal',2,'TAKE THE WATER.','CANAL ROUTES / BOAT GETAWAYS'],
 ['airdrop',2,'DELIVER FROM ABOVE.','PAPER WINGS / AIRDROP CONTRACT'],
 ['heli',1,'RISE ABOVE THE HEAT.','HELICOPTERS / HELIPADS'],
 ['slots',1,'PLAY THE HOUSE.','METAWIN / SLOTS / PLAY CHIPS'],
 ['metro',2,'CATCH YOUR NEXT EXIT.','CROWN TRANSIT / ANIMATED FAST TRAVEL'],
 ['city',1,'A CITY THAT KEEPS MOVING.','REFINED TRAFFIC / PEDESTRIANS / NIGHT LIGHTS'],
 ['frontier',2,'LEAVE THE STRIP BEHIND.','FREE RIDE / THE OPEN WORLD'],
 ['gold',2,'“THE HOUSE ALWAYS WINS, CHAOS.”','GOLD MAGE / THE PALACE ARCHIVE'],
 ['end',2,'','NO CLEAN EXIT / GAMEPLAY & UPGRADES'],
];
let cumulative=0;const edit=shots.map(([id,bars,title,sub])=>{const start=Math.round(cumulative*4*60/128*30);cumulative+=bars;const end=Math.round(cumulative*4*60/128*30);return{id,bars,title,sub,start,end,frames:end-start,duration:(end-start)/30};});if(cumulative!==32)throw Error('Film must be 32 bars / 60 seconds');fs.writeFileSync(OUT+'/edit.json',JSON.stringify(edit,null,2));
(async()=>{const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});const report=only&&fs.existsSync(OUT+'/capture.json')?JSON.parse(fs.readFileSync(OUT+'/capture.json')):[];
try{const page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{requestAnimationFrame=()=>0;let seed=64721;Math.random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);});
 await page.goto(process.env.CC_URL||'http://127.0.0.1:8032/');await page.waitForFunction(()=>window.__CC,null,{polling:100});
 await page.evaluate(async()=>{
  window.T=(await import('./src/game.js')).testing;window.C=await import('./src/circuit_world.js');window.M=await import('./src/motorsport.js');window.A=await import('./src/aviation.js');window.R=await import('./src/transit.js');window.D=await import('./src/airdrop.js');window.S=await import('./src/slots.js');
  const font=new FontFace('FilmAnton','url(about/assets/fonts/anton-latin.woff)');await font.load();document.fonts.add(font);await document.fonts.ready;
  window.film=document.createElement('canvas');film.width=1280;film.height=720;window.filmControl={};
  __CC.G._pulseInput=()=>Object.assign(__CC.G.input,{x:0,y:0,keyDrive:true,fire:false,hand:false,boost:false,sprint:false,brake:false,dodgeP:false,fireP:false,...filmControl});
 });
 for(const shot of edit.filter(s=>!only||only.includes(s.id))){
  await page.evaluate(async name=>{
   const G=__CC.G;localStorage.clear();T.startFreeRide(G);T.clearRecoveryState(G);Object.assign(G,{scene:'play',wanted:0,health:100,_endT:0,chips:1800,time:17,weather:'clear',weatherT:1e8,rainAmt:0,wet:0,fog:0,sand:0,hideHUD:true,toastT:0,banner:null,contactTalk:null,cineLock:false});
   Object.assign(G.settings,{quality:'high',autoRes:false,timeSpeed:0,autoFS:false,reducedMotion:false,showTips:false,aimAssist:false,blood:'full'});G.resScale=1;G.touch=false;T.applyQuality(G);T.fit(G);G.action.contract=null;G.action.messageT=0;G.input.mouse.fire=false;G.input.touchJoy.active=false;G.cam.northUp=true;G.cam.rot=0;filmControl={};window.focusTarget=null;window.shotEvents={};
   const car=(kind,x,y,rot,speed=0)=>{const v=T.makeVeh(kind,x,y,rot,{parked:false,keep:true,health:100});G.vehicles=G.vehicles.filter(o=>Math.hypot(o.x-x,o.y-y)>110);G.vehicles.push(v);T.enterVeh(G,v,true);Object.assign(v,{x,y,rot,vx:Math.sin(rot)*speed,vy:-Math.cos(rot)*speed,airspeed:speed,altitude:0,health:100,dead:false,parked:false});return v;};
   const foot=(x,y,rot=0)=>{const p=T.findSafe(G,x,y,9,true);G.player=T.makeFoot(G,p.x,p.y,rot);};
   if(['hook','pursuit','end'].includes(name)){
    car('riot',2108,name==='pursuit'?3270:3000,0,name==='pursuit'?165:150);G.time=name==='pursuit'?18.1:21.2;G.wet=.35;
    G.vehicles=G.vehicles.filter(v=>v===G.player||Math.abs(v.x-2108)>100||Math.abs(v.y-G.player.y)>500);
    for(let i=0;i<2;i++){const v=T.makeVeh('metro',i?2074:2108,G.player.y+165+i*150,0,{cop:true,ai:true,chasing:true,siren:true,keep:true,parked:false,vx:0,vy:-120});G.vehicles.push(v);G.cops.push(v);}G.wanted=3;
   }
   if(['crew','choice','gold'].includes(name)){const id=name==='gold'?'m5_intro':name==='choice'?'intro_garage4':'intro_garage3';T.openVN(G,id);await Promise.all(G.storyLoads.values());G.vn.char=10000;G.vn.t=4;G.vn.wipe=0;}
   if(name==='convoy'){
    G.freeRoam=false;G.mode='story';T.beginMission(G,0);G.scene='play';G.objectiveIndex=1;const x=G.meta.layout.southbound[1];car('riot',x,1780,Math.PI,145);Object.assign(G.van,{x,y:2010,rot:Math.PI,health:100,loose:false});G.time=17.5;
   }
   if(['circuit','racefast'].includes(name)){
    const s=name==='circuit'?3900:850,at=C.trackPoint(s),v=car('nyx',at.x+Math.cos(at.rot)*30,at.y+Math.sin(at.rot)*30,at.rot,name==='circuit'?220:320);v.racerIndex=0;
    G.vehicles=G.vehicles.filter(o=>o===G.player||!o.circuitRacer&&Math.hypot(o.x-v.x,o.y-v.y)>500);
    for(let i=0;i<(name==='circuit'?3:0);i++){const p=C.trackPoint(s+160+i*240),r=T.makeVeh(i%2?'dart':'nyx',p.x-Math.cos(p.rot)*28,p.y-Math.sin(p.rot)*28,p.rot,{ai:true,circuitRacer:true,racerIndex:i+1,parked:false,keep:true,vx:Math.sin(p.rot)*220,vy:-Math.cos(p.rot)*220});G.vehicles.push(r);}G.time=16;
   }
   if(['combat','rocket','wreck'].includes(name)){
    foot(2108,2870,0);G.vehicles=G.vehicles.filter(v=>Math.abs(v.x-2108)>130||Math.abs(v.y-2750)>450);G.peds=G.peds.filter(p=>Math.hypot(p.x-2108,p.y-2750)>450);G.time=20.1;
    if(name==='combat'){
     G.action.weapon=1;G.action.ammo[1]=28;const p={x:2110,y:2610,rot:Math.PI,vx:0,vy:0,sprite:'cop',copPed:true,hp:90,r:10,walk:30,speed:0,dist:0};G.peds.push(p);focusTarget=p;
     const v=T.makeVeh('metro',2035,2670,Math.PI,{cop:true,siren:true,parked:true});G.vehicles.push(v);G.wanted=2;
    }else{G.action.weapon=3;G.action.ammo[3]=1;const v=T.makeVeh('van',2108,2580,0,{parked:true,keep:true,health:name==='wreck'?4:100});G.vehicles.push(v);focusTarget=v;
     if(name==='wreck'){v.burning=true;v.burnT=.22;v.playerIgnited=true;const second=T.makeVeh('fare',2040,2560,.1,{parked:true,health:42});G.vehicles.push(second);}
    }
   }
   if(name==='canal'){car('wake',6968,4050,Math.PI,65);G.time=17.4;}
   if(name==='airdrop'){
    const target=D.DROP_TARGETS[1],v=car('plane',target.x-560,target.y,Math.PI/2,200);A.restoreAircraft(v,{altitude:90,airspeed:200,vx:200,vy:0,rotor:1});G.action.contract={id:'airdrop',stage:2,t:180,progress:0};G.time=16.5;
   }
   if(name==='heli'){const v=car('heli',7920,3450,0,0);A.restoreAircraft(v,{altitude:65,rotor:1});G.time=20;}
   if(name==='slots'){foot(8624,3372);G.time=21;G.casino.table=S.SLOT_MACHINES[0];G.casino.mode='slots';G.scene='casino';S.initSlots(G);S.spinSlots(G);G.slots.elapsed=.18;}
   if(name==='metro'){foot(10215,4984);G.transit.menu=R.STATIONS.find(s=>s.id==='pinewatch');R.beginJourney(G,'airfield');G.transit.ride.elapsed=6;G.time=18.5;}
   if(name==='city'){foot(2025,2940);G.time=21;for(let i=0;i<540;i++)T.tick(G,1/60);}
   if(name==='frontier'){car('hog',10872,4700,0,100);G.time=16.8;}
   Object.assign(G.cam,{x:G.player.x,y:G.player.y,scale:1.3,rot:0,shake:0});G.filmStart={x:G.player.x,y:G.player.y};T.render(G);
  },shot.id);
  for(let i=0;i<30;i++){await page.evaluate(()=>T.render(__CC.G));await page.waitForTimeout(15);}
  let encoder,closed,stderr='';if(!preview){encoder=spawn('ffmpeg',['-v','error','-y','-f','image2pipe','-framerate','30','-vcodec','png','-i','pipe:0','-an','-c:v','libx264','-preset','veryfast','-crf','18','-pix_fmt','yuv420p',`${OUT}/${shot.id}.mp4`]);encoder.stderr.on('data',d=>stderr+=d);closed=once(encoder,'close');}
  const samples=[0,Math.floor(shot.frames/2),shot.frames-1];let state;
  for(let i=0;i<shot.frames;i++){
   const grab=!preview||samples.includes(i),result=await page.evaluate(({shot,i,grab,sample})=>{
    const G=__CC.G,t=i/30,p=i/(shot.frames-1),name=shot.id;filmControl={};G.input.mouse.fire=false;
    if(['hook','pursuit','end','convoy','canal','frontier'].includes(name))filmControl.y=1;
    if(name==='pursuit'&&t>.8&&t<1.35){filmControl.x=.26;filmControl.hand=true;}else if(name==='pursuit'&&t>=1.35&&t<2.1)filmControl.x=-.22;
    if(['circuit','racefast'].includes(name))Object.assign(filmControl,M.circuitPilot(G,G.player,1/30));
    if(name==='combat'){
     filmControl.fire=t>.65&&t<2.2;filmControl.dodgeP=i===6;filmControl.x=t<.65?-.7:0;
     if(filmControl.fire&&focusTarget){G.input.mouse.fire=true;Object.assign(G.input.mouse,T.worldToScreen(G,focusTarget.x,focusTarget.y-23));}
    }
    if(name==='rocket'&&i===36){T.shoot(G,G.player,true);shotEvents.launched=true;}
    if(name==='canal')filmControl.y=.35;
    if(name==='airdrop'){filmControl.y=0;const target=D.DROP_TARGETS[2-1],pred=D.dropPrediction(G.player);if(!shotEvents.drop&&Math.abs(pred.x-target.x)<8){filmControl.fireP=true;shotEvents.drop=true;}}
    if(name==='heli'){filmControl.boost=true;filmControl.y=.35;}
    if(name==='city'){filmControl.y=.35;}
    T.tick(G,1/60);filmControl.dodgeP=filmControl.fireP=false;T.tick(G,1/60);
    if(['hook','pursuit','end'].includes(name)){G.cam.x=G.player.x+65;G.cam.y=G.player.y+25;G.cam.scale=1.58-p*.1;G.cam.rot=0;}
    if(name==='convoy'){G.cam.x=G.player.x-90;G.cam.y=G.player.y+70;G.cam.scale=1.30;G.cam.rot=0;}
    if(['circuit','racefast'].includes(name)){G.cam.x=G.player.x+Math.sin(G.player.rot)*125;G.cam.y=G.player.y-Math.cos(G.player.rot)*125;G.cam.rot=0;G.cam.scale=name==='circuit'?1.2:1.55;}
    if(['combat','rocket','wreck'].includes(name)){G.cam.x=2100;G.cam.y=name==='combat'?2730:2685;G.cam.scale=name==='combat'?1.65:1.7;G.cam.rot=0;}
    if(name==='canal'){G.cam.x=G.player.x-110;G.cam.y=G.player.y+40;G.cam.scale=1.20;G.cam.rot=0;}
    if(name==='airdrop'){G.cam.x=G.player.x+80;G.cam.y=G.player.y;G.cam.scale=1.25;G.cam.rot=0;}
    if(name==='heli'){G.cam.x=G.player.x-80;G.cam.y=G.player.y-65;G.cam.scale=1.1-p*.12;G.cam.rot=0;}
    if(name==='city'){G.cam.x=2040+p*90;G.cam.y=2850-p*40;G.cam.scale=1.2;G.cam.rot=0;}
    if(name==='frontier'){G.cam.x=G.player.x+150;G.cam.y=G.player.y-40;G.cam.scale=1.15;G.cam.rot=0;}
    G.cam.shake=0;G.toastT=G.action.messageT=0;G.banner=null;T.render(G);if(!grab)return null;
    const c=film.getContext('2d');c.globalAlpha=1;c.globalCompositeOperation='source-over';if(name==='slots')c.drawImage(G.canvas,190,110,900,506.25,0,0,1280,720);else c.drawImage(G.canvas,0,0,1280,720);
    if(['crew','gold'].includes(name)){c.fillStyle='#080f16';c.fillRect(0,535,1280,185);}
    const shade=c.createLinearGradient(0,475,0,720);shade.addColorStop(0,'rgba(4,9,16,0)');shade.addColorStop(1,'rgba(4,9,16,.94)');c.fillStyle=shade;c.fillRect(0,475,1280,245);
    c.fillStyle='rgba(5,10,16,.72)';c.fillRect(0,0,1280,40);c.fillStyle='#e8deca';c.font='600 12px sans-serif';c.fillText('CROWN CITY',36,25);c.textAlign='right';c.fillStyle='#8fccc3';c.fillText('NO CLEAN EXIT  /  GAMEPLAY & UPGRADES',1244,25);c.textAlign='left';
    if(name!=='choice'&&name!=='end'){
     const enter=Math.min(1,t*8),x=44+(1-enter)*24;c.globalAlpha=enter;
     c.fillStyle='#74dccc';c.fillRect(x,592,29,3);c.font='600 13px sans-serif';c.fillText(shot.sub,x+44,599);
     c.font=(name==='gold'?'40':'43')+'px FilmAnton';c.fillStyle='#fff0d8';c.fillText(shot.title,x,656);c.globalAlpha=1;
    }
    if(name==='choice'){c.fillStyle='rgba(5,10,16,.82)';c.fillRect(28,45,510,64);c.fillStyle='#f5deaa';c.font='32px FilmAnton';c.fillText('YOUR CALL. YOUR CONSEQUENCES.',44,91);}
    if(name==='hook'){c.fillStyle='#ffda81';c.font='88px FilmAnton';c.fillText('CROWN CITY.',44,150);}
    if(name==='end'){
     c.fillStyle='rgba(4,10,16,.72)';c.fillRect(0,40,1280,680);c.textAlign='center';c.fillStyle='#7fdbce';c.font='600 16px sans-serif';c.fillText('METAWINNERS / NO CLEAN EXIT',640,185);
     c.fillStyle='#ffe3a0';c.font='118px FilmAnton';c.fillText('CROWN CITY',640,328);c.fillStyle='#fff0d8';c.font='29px FilmAnton';c.fillText('THE HOUSE OWES YOU.',640,389);
     c.fillStyle='#77dace';c.fillRect(449,443,382,58);c.fillStyle='#0a2026';c.font='24px FilmAnton';c.fillText('PLAY FREE. TAKE THE CITY.',640,483);
     c.fillStyle='#e4dfd2';c.font='19px sans-serif';c.fillText('avp86fr-jpg.github.io/crown-city',640,545);
     c.font='13px sans-serif';c.fillStyle='#b5c1c2';c.fillText('Desktop + mobile browsers  /  Independent fan-made game',640,588);
     c.font='11px sans-serif';c.fillText('Captured in-game. Staged cameras and starting situations. Offline 30 fps.',640,665);c.textAlign='left';
    }
    // Short black dips bind the edit to downbeats without full-screen white flashes.
    const dip=i<3?(3-i)/3:0;if(dip){c.fillStyle=`rgba(3,8,14,${dip*.7})`;c.fillRect(0,0,1280,720);}
    if(shot.end===1800&&i>shot.frames-10){c.fillStyle=`rgba(3,8,14,${(i-(shot.frames-10))/9})`;c.fillRect(0,0,1280,720);}
    return {png:film.toDataURL('image/png').split(',')[1],state:{scene:G.scene,x:G.player.x,y:G.player.y,health:G.health,vehicleHealth:G.player.health,altitude:G.player.altitude||0,speed:Math.hypot(G.player.vx||0,G.player.vy||0),particles:G.particles.length,blast:G.blastFX?.bursts.length||0,shots:G.shotsFired,drop:shotEvents.drop,stage:G.action.contract?.stage,parcel:!!G.parcel,targetDead:focusTarget?.dead,targetBurning:focusTarget?.burning}};
   },{shot,i,grab,sample:samples.includes(i)});
   if(result){state=result.state;const png=Buffer.from(result.png,'base64');if(samples.includes(i))fs.writeFileSync(`${OUT}/${shot.id}-${i}.png`,png);if(encoder&&!encoder.stdin.write(png))await once(encoder.stdin,'drain');}
  }
  if(encoder){encoder.stdin.end();const [code]=await closed;if(code)throw Error(stderr);}
  const entry={...shot,state},index=report.findIndex(x=>x.id===shot.id);if(index>=0)report[index]=entry;else report.push(entry);fs.writeFileSync(OUT+'/capture.json',JSON.stringify(report,null,2));console.log(shot.id,JSON.stringify(state));
 }
 if(errors.length)throw Error(errors.join('\n'));console.log('Capture complete, no browser exceptions.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
