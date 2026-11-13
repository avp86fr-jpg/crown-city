const {chromium}=require(process.env.PW||'playwright-core');
(async()=>{const b=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--use-gl=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required']});
const p=await b.newPage({viewport:{width:1280,height:720}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto((process.env.BASE||'http://127.0.0.1:8032/')+'dev.html');await p.waitForFunction(()=>window.__CC,null,{polling:100,timeout:60000});
await p.mouse.click(640,360);await p.waitForTimeout(500);
const res=await p.evaluate(async()=>{const T=(await import('./src/game.js')).testing,G=__CC.G;T.startFreeRide(G);G.scene='play';const A=G.audio;A.unlock();await new Promise(r=>setTimeout(r,800));
 const B=A._buses,ctx=A.ctx;if(!B)return {err:'no buses',state:ctx&&ctx.state};
 const an={};for(const k of ['sfx','mus','amb','master']){const a=ctx.createAnalyser();a.fftSize=4096;B[k].connect(a);an[k]=a;}
 const buf=new Float32Array(4096),fbuf=new Float32Array(2048);const acc={};
 const sample=(phase)=>{for(const k in an){an[k].getFloatTimeDomainData(buf);let s=0,pk=0;for(const v of buf){s+=v*v;pk=Math.max(pk,Math.abs(v));}const rms=Math.sqrt(s/buf.length);
   an[k].getFloatFrequencyData(fbuf);const bin=ctx.sampleRate/4096;let harsh=0,tot=0;for(let i=1;i<fbuf.length;i++){const e=Math.pow(10,fbuf[i]/10);tot+=e;const f=i*bin;if(f>2500&&f<5000)harsh+=e;}
   const a=acc[phase+':'+k]||(acc[phase+':'+k]={n:0,rms:0,pk:0,harsh:0,clip:0});a.n++;a.rms+=rms;a.pk=Math.max(a.pk,pk);a.harsh+=tot>0?harsh/tot:0;if(pk>.99)a.clip++;}};
 const wait=ms=>new Promise(r=>setTimeout(r,ms));
 const phases=[['idle',()=>{}],['drive',()=>{G.input.up=true;}],['guns',()=>{G.input.up=false;A.gunfire&&A.gunfire('smg',G.player.x+40,G.player.y,.7);}],['shotgun',()=>{A.gunfire&&A.gunfire('shotgun',G.player.x+40,G.player.y,.7);}],['explosion',()=>{A.explosion?A.explosion(G.player.x+60,G.player.y):A.boom&&A.boom();}]];
 if(G.player.type==='foot'){const v=T.makeVeh('fare',G.player.x+60,G.player.y,0);G.vehicles.push(v);T.enterVeh(G,v,true);}
 for(const [ph,act] of phases){for(let i=0;i<24;i++){act();await wait(110);sample(ph);}}
 const out={};for(const k in acc){const a=acc[k];out[k]={rmsDb:+(20*Math.log10(a.rms/a.n+1e-9)).toFixed(1),peak:+a.pk.toFixed(3),harsh:+(a.harsh/a.n).toFixed(3),clipFrames:a.clip};}
 return {state:ctx.state,musVol:A.musVol,out,api:Object.keys(A).filter(k=>/gun|expl|boom|shot/.test(k))};});
console.log(JSON.stringify(res,null,1));console.log(errs.slice(0,3));await b.close();})();
