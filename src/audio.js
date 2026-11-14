import {voiceFor,engineState,tyreFor} from './vehicle_voice.js';
import {createEffects,createContactPlayer,surfaceMotion,engineMotion,sceneAcoustics,soundPosition,railMotion} from './sound_effects.js';
import {createSoundtrack,TRACKS} from './soundtrack.js';
import {islandAmbience} from './resort.js';
import {regionalTrainAt,ridePhase} from './transit.js';
/** Crown City sound design: original arranged radio plus synthesized spatial effects.
 *  Buses: sfx / music / ambience -> glue compressor -> limiter -> master.
 *  Dynamic score: a step sequencer with stems (pad, arp, bass, kick, snare, hats, lead) whose
 *  levels follow an intensity value driven by wanted level / chases / missions. In cars the
 *  "radio" picks the style (each station = tempo, key, groove); on foot the city score plays. */
export function createAudio() {
  const A = {
    ctx: null, enabled: true,
    sfxVol: 0.8, musVol: 0.6, masterVol: 0.9,
    station: 0, radio: false, intensity: 0, _int: 0, _skid: 0,
    stations: [
      { name: TRACKS[0].station, style: "synth" },
      { name: TRACKS[1].station, style: "lofi" },
      { name: TRACKS[2].station, style: "house" },
      { name: TRACKS[7].station, style: "synth" },
      { name: TRACKS[8].station, style: "lofi" },
      { name: TRACKS[9].station, style: "house" },
    ],
  };
  let ctx, master, limiter, glue, sfx, mus, amb, verb, verbSend, noiseBuf, brownBuf;
  let soundtrack=null, effects=null,contactSound=null,listener=null;const rollingMix={},engineMix={},acoustics={},position={};
  const STYLES = {
    score: { bpm: 96, root: 45, scale: [0, 2, 3, 5, 7, 8, 10], prog: [0, 5, 3, 6], swing: 0 },
    synth: { bpm: 104, root: 43, scale: [0, 2, 3, 5, 7, 8, 10], prog: [0, 5, 2, 6], swing: 0 },
    house: { bpm: 122, root: 48, scale: [0, 2, 3, 5, 7, 9, 10], prog: [0, 3, 4, 3], swing: 0 },
    lofi: { bpm: 82, root: 41, scale: [0, 2, 4, 7, 9, 11, 14], prog: [0, 5, 1, 4], swing: 0.12 },
    chase: { bpm: 132, root: 40, scale: [0, 1, 3, 5, 7, 8, 10], prog: [0, 1, 5, 6], swing: 0 },
  };
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

  function ensure() {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: "playback" });
    A.ctx = ctx;
    master = ctx.createGain(); master.gain.value = A.masterVol;
    limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -3; limiter.knee.value = 0; limiter.ratio.value = 20; limiter.attack.value = 0.002; limiter.release.value = 0.15;
    glue = ctx.createDynamicsCompressor();
    glue.threshold.value = -18; glue.knee.value = 12; glue.ratio.value = 3; glue.attack.value = 0.01; glue.release.value = 0.25;
    glue.connect(limiter); limiter.connect(master); master.connect(ctx.destination);
    sfx = ctx.createGain(); sfx.gain.value = A.sfxVol; sfx.connect(glue);
    mus = ctx.createGain(); mus.gain.value = 0; mus.connect(glue);
    amb = ctx.createGain(); amb.gain.value = 0.8 * A.sfxVol; amb.connect(glue);
    A._buses = { sfx, mus, amb, glue, limiter, master }; // measurement taps (tools/audio-mix)
    // Performance mode never allocates an unused convolution impulse. Build
    // it once, on demand, if the player later selects a richer sound tier.
    verbSend=ctx.createGain();verbSend.gain.value=.32;if(!lite)verbSend.connect(reverb());
    // noise buffers
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    { const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
    brownBuf = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate);
    { const d = brownBuf.getChannelData(0); let l = 0; for (let i = 0; i < d.length; i++) { l = (l + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = l * 3.5; } }
    effects=createEffects(ctx,sfx);contactSound=createContactPlayer(()=>ctx.currentTime,fx);buildMusic(); buildLoops();
  }
  function reverb(){
    if(verb)return verb;verb=ctx.createConvolver();
    const len=Math.floor(ctx.sampleRate*1.3),ir=ctx.createBuffer(2,len,ctx.sampleRate);
    for(let ch=0;ch<2;ch++){const d=ir.getChannelData(ch);for(let i=0;i<len;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/len,2.6);}
    // Wet effects must pass through the same SFX volume as their dry signal.
    // The arranged soundtrack is already mastered; fallback music uses delay.
    verb.buffer=ir;verb.connect(sfx);return verb;
  }
  const now = () => ctx?.currentTime||0;
  const noiseSrc = (buf = noiseBuf, loop = false) => { const s = ctx.createBufferSource(); s.buffer = buf; s.loop = loop; if (!loop) s.playbackRate.value = 0.9 + Math.random() * 0.2; return s; };
  const env = (g, t, a, peak, d, end = 0.0001) => { g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(end, t + a + d); };
  const voiceEnds=[];
  function oneShot(build, dur) { // caps concurrent one-shots so audio never costs frames
    if(!ctx||ctx.state!=='running'||A.sfxVol<=.001||A.masterVol<=.001)return;
    const t=now();for(let i=voiceEnds.length-1;i>=0;i--)if(voiceEnds[i]<=t)voiceEnds.splice(i,1);
    if(voiceEnds.length>=22)return;voiceEnds.push(t+dur+.06);build(t);
  }
  function fx(...args){return A.sfxVol>.001&&A.masterVol>.001?effects?.(...args):false;}
  function panNode(p) { const n = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain(); if (n.pan) n.pan.value = Math.max(-1, Math.min(1, p || 0)); return n; }
  function tone(freq, dur, type = "square", vol = 0.06, glide = 0, out = sfx, t0) {
    oneShot((t) => {
      t = t0 || t;
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type; o.frequency.setValueAtTime(freq, t); if (glide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + glide), t + dur);
      env(g, t, 0.004, vol, dur); o.connect(g); g.connect(out); o.onended=()=>{o.disconnect();g.disconnect();}; o.start(t); o.stop(t + dur + 0.05);
    },dur+(t0&&ctx?Math.max(0,t0-now()):0));
  }
  function noiseHit({ dur = 0.2, vol = 0.3, type = "bandpass", f = 1200, q = 1, f2 = 0, pan = 0, out = sfx, a = 0.002, rate = 1 }) {
    oneShot((t) => {
      const s = noiseSrc(); s.playbackRate.value = rate; const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, t); fl.Q.value = q;
      if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur);
      const g = ctx.createGain(); env(g, t, a, vol, dur); const p = panNode(pan);
      s.connect(fl); fl.connect(g); g.connect(p); p.connect(out); s.onended=()=>{s.disconnect();fl.disconnect();g.disconnect();p.disconnect();}; s.start(t); s.stop(t + dur + 0.05);
    }, dur);
  }
  function duck(amount = 0.45, hold = 0.5) {
    if (!ctx) return; const t = now(), base = A.musVol * musLevel;
    mus.gain.cancelScheduledValues(t); mus.gain.setValueAtTime(mus.gain.value, t);
    mus.gain.linearRampToValueAtTime(base * amount, t + 0.04); mus.gain.linearRampToValueAtTime(base, t + 0.04 + hold + 0.6);
  }

  /* ---------------- SFX ---------------- */
  A.unlock = () => {
    try {
      if (!(window.AudioContext || window.webkitAudioContext)) return false;
      ensure(); if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      if(!soundtrack && typeof Audio!=='undefined' && ctx.createMediaElementSource) {try{soundtrack=createSoundtrack(ctx,mus);}catch{soundtrack=null;}}
      soundtrack?.start();startMusic(); return true;
    } catch (e) { console.warn('Audio is unavailable; continuing silently.'); return false; }
  };
  const volume=v=>Number.isFinite(v)?Math.max(0,Math.min(1,v)):0;
  const fadeVolume=(p,v)=>{const t=now();p.cancelScheduledValues(t);p.setValueAtTime(p.value,t);p.linearRampToValueAtTime(v,t+.035);};
  A.setSfx = (v) => { A.sfxVol=volume(v);if(sfx){fadeVolume(sfx.gain,A.sfxVol);fadeVolume(amb.gain,.8*A.sfxVol);} };
  A.setMus = (v) => { A.musVol=volume(v);if(mus)mus.gain.setTargetAtTime(A.musVol*musLevel,now(),.1); };
  A.setMaster = (v) => { A.masterVol=volume(v);if(master)fadeVolume(master.gain,A.masterVol); };
  A.ui = () => { tone(880, 0.05, "triangle", 0.05); tone(1320, 0.06, "triangle", 0.035, 0, sfx, ctx && now() + 0.035); };
  A.click = () => tone(1400, 0.025, "square", 0.025);
  let lastType=0;
  A.type=()=>{if(ctx&&now()-lastType>.12){lastType=now();fx('ui',.012);}};
  A.reload = () => fx('reload',.34);
  const cueTimes=new Map();
  function cue(kind,gain,delay=.12,pan=0){if(!ctx)return false;const t=now();if(t-(cueTimes.get(kind)??-Infinity)<delay)return false;const played=fx(kind,gain,pan);if(played)cueTimes.set(kind,t);return played;}
  A.transit=(kind,vol=.24,pan=0)=>cue(kind,vol,kind==='rail'?.22:.6,pan);
  const CASINO={card:'card',deal:'card',chips:'chips',chip:'chips',win:'casinoWin',lose:'casinoLose',push:'casinoPush',open:'casinoOpen',reel:'reelStop'};
  A.casino=kind=>cue(CASINO[kind]||'card',kind==='win'?.25:.20,kind==='card'||kind==='deal'?.055:.15);
  A.race=kind=>cue(({count:'raceCount',go:'raceGo',sector:'raceGate',finish:'raceFinish',invalid:'raceInvalid',service:'pitService'})[kind]||'raceGate',.19,.15);
  A.wildlife = (kind,vol=.12,pan=0) => fx(kind,vol,pan);
  A.cock = () => noiseHit({dur:.055,vol:.16,type:'highpass',f:2800});
  A.dodge = () => noiseHit({dur:.23,vol:.17,type:'lowpass',f:1200,f2:280});
  A.radioChirp = () => {tone(1100,.04,'sine',.022);tone(1600,.05,'sine',.018,0,sfx,ctx&&now()+.06);};
  A.pickup = () => { if (!ctx) return; const t = now(); [0, 4, 7, 12].forEach((s, i) => tone(mtof(84 + s), 0.12, "triangle", 0.05, 0, sfx, t + i * 0.045)); };
  A.star = () => { if (!ctx) return; const t = now(); tone(988, 0.09, "square", 0.04, 0, sfx, t); tone(740, 0.12, "square", 0.04, 0, sfx, t + 0.1); };
  A.enter = () => { if(!cue("door",.2,.25))noiseHit({ dur: 0.08, vol: 0.25, type: "lowpass", f: 600 }); if(ctx)setTimeout(()=>cue("doorShut",.17,.25),420); };
  A.exit = () => { if(!cue("door",.18,.25))noiseHit({ dur: 0.06, vol: 0.2, type: "lowpass", f: 900 }); if(ctx)setTimeout(()=>cue("doorShut",.15,.25),380); };
  A.hit = () => fx('impact',.4);
  A.shot = (pan=0,far=0,kind='pistol') => {fx(kind,.5*(1-far*.65),pan);};
  // Spatial gunfire: close shots get the full layered sample plus a street
  // slapback (stronger between buildings); distant shots roll off to a thump.
  A.gunfire=(kind='pistol',x,y,urban=.6)=>{
    // Mix: heavy shots dip the score briefly (rate-limited) so gunfire reads over music.
    if(ctx&&kind!=="pistol"&&now()-(A._gunDuck||0)>.3){A._gunDuck=now();duck(kind==="shotgun"?.6:.78,.18);}
    if(!ctx||!listener?.player)return A.shot(0,0,kind);
    soundPosition(listener,x,y,1700,position);const d=position.distance,pan=position.pan;
    const base=kind==='shotgun'?.62:kind==='smg'?.46:.36,near=Math.max(0,1-d/650);
    if(near>.02)fx(kind,base*(.35+.65*near),pan);
    if(d>220&&kind!=='pistol')fx('distant',Math.min(.42,base*.8)*Math.max(0,1-d/1700),pan*.7,kind==='shotgun'?.85:1);
    if(kind!=='pistol'||d<300)fx('echo',base*(.18+.3*urban)*Math.max(.15,1-d/1500),-pan*.5,kind==='shotgun'?.85:1);
  };
  A.impact=(kind,x,y,vol=.3)=>{if(!ctx)return;if(listener?.player&&Number.isFinite(x)){soundPosition(listener,x,y,900,position);if(position.gain<.02)return;fx(kind,vol*(.3+.7*position.gain),position.pan);}else fx(kind,vol,0);};
  A.dryfire=()=>fx('dryfire',.3);
  A.hitmark=(kill=false)=>fx(kill?'killmark':'hitmark',kill?.3:.22);
  A.casing=()=>fx('casing',.09);
  A.contact=(event={})=>{
    if(!contactSound||ctx.state!=='running'||A.sfxVol<=0||A.masterVol<=0)return false;
    const P=listener?.player,x=event.x??event.source?.x,y=event.y??event.source?.y;
    let gain=1,pan=event.pan||0;
    if(P&&Number.isFinite(x)&&Number.isFinite(y)){
      soundPosition(listener,x,y,950,position);gain=position.gain;pan=position.pan;
    }
    return contactSound({...event,gain,pan});
  };
  A.crash=(amount=1)=>A.contact({speed:amount*200,material:'body'});
  A.splash=(amount=1)=>A.contact({speed:amount*180,material:'water'});
  A.rocket=()=>cue('rocket',.5,.3);
  A.boom = (x,y) => {
    const position=listener&&Number.isFinite(x)&&Number.isFinite(y)?soundPosition(listener,x,y,1200):{gain:1,pan:0};
    if(cue('explosion',.72*position.gain,.075,position.pan)&&position.gain>.15)duck(.25,.8);
  };
  // horns per model: two detuned reeds at the model's interval, panned and distance-scaled
  A.horn = (pan = 0, v = null) => {if(!ctx)return false;if(!v)return cue('horn',.20,.5,pan);const t=now();if(t-(A._hornT||0)<.35)return false;A._hornT=t;
    let gain=.16;if(listener?.player&&Number.isFinite(v.x)){soundPosition(listener,v.x,v.y,900,position);gain*=position.gain;pan=position.pan;}if(gain<.01)return false;
    const [a,b]=voiceFor(v).horn,len=v===listener?.player?.42:.3+Math.random()*.25;
    oneShot(t0=>{const g=ctx.createGain(),f=ctx.createBiquadFilter(),p=panNode(pan);f.type='bandpass';f.frequency.value=(a+b)*1.4;f.Q.value=.9;env(g,t0,.012,gain,len);
      const os=[a,b].map(fr=>{const o=ctx.createOscillator();o.type='sawtooth';o.frequency.value=fr;o.connect(f);o.start(t0);o.stop(t0+len+.1);return o;});
      f.connect(g);g.connect(p);p.connect(sfx);os[1].onended=()=>{for(const n of [...os,f,g,p])n.disconnect();};},len+.1);return true;};
  A.yelp = () => {
    oneShot((t) => {
      const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      const base = 320 + Math.random() * 260;
      o.type = "sawtooth"; o.frequency.setValueAtTime(base, t); o.frequency.exponentialRampToValueAtTime(base * 1.6, t + 0.08); o.frequency.exponentialRampToValueAtTime(base * 0.8, t + 0.28);
      f.type = "bandpass"; f.frequency.setValueAtTime(900, t); f.frequency.linearRampToValueAtTime(1600, t + 0.2); f.Q.value = 5;
      env(g, t, 0.02, 0.06, 0.28); o.connect(f); f.connect(g); g.connect(sfx);o.onended=()=>{o.disconnect();f.disconnect();g.disconnect();};o.start(t); o.stop(t + 0.35);
    }, 0.35);
  };
  A.skid = () => { A._skid = Math.min(1, A._skid + 0.5); };
  A.banner = (win = true) => {
    if (!ctx) return; const t = now(); duck(0.3, 1.6);
    const ch = win ? [57, 64, 69, 73, 76] : [45, 48, 51, 54];
    ch.forEach((m, i) => { tone(mtof(m), 1.4, "sawtooth", 0.03, 0, verbSend, t + i * 0.06); tone(mtof(m), 1.2, "triangle", 0.05, 0, sfx, t + i * 0.06); });
    if (!win) tone(55, 1.2, "sine", 0.3, -15, sfx, t);
  };
  A.stinger = (st = 0) => { if (!ctx) return; const t = now(); const sets = [[69, 76, 81], [72, 79, 84], [65, 72, 77]]; (sets[st % 3]).forEach((m, i) => tone(mtof(m), 0.25, "triangle", 0.05, 0, sfx, t + i * 0.09)); };
  A.chaseSwell = () => { if (!ctx) return; noiseHit({ dur: 1.4, vol: 0.18, type: "bandpass", f: 300, f2: 3000, q: 2, a: 1.2 }); };
  A.step=(surf,snow=0)=>fx(surf==='water'||surf==='shallow'?'stepWater':snow>.5&&surf!=='road'?'stepSnow':surf==='pier'?'stepWood':['grass','sand','dirt'].includes(surf)?'stepLoose':'stepHard',surf==='grass'||surf==='sand'?.12:snow>.5?.15:.17);

  /* -------------- continuous loops: engine, tyres, siren, ambience, rain -------------- */
  const L = {};
  function loopNoise(buf, type, f, q, out, vol = 0,spatial=false) {
    const s = noiseSrc(buf, true), fl = ctx.createBiquadFilter(), g = ctx.createGain();
    fl.type = type; fl.frequency.value = f; fl.Q.value = q; g.gain.value = vol;
    const p=spatial?panNode(0):null;s.connect(fl);fl.connect(g);if(p){g.connect(p);p.connect(out);}else g.connect(out);s.start();
    return { s, f: fl, g,p };
  }
  function buildLoops() {
    // engine: 2 detuned saws + sub square -> lowpass (+ waveshaper growl)
    const eg = ctx.createGain(); eg.gain.value = 0;
    const ef = ctx.createBiquadFilter(); ef.type = "lowpass"; ef.frequency.value = 600; ef.Q.value = 4;
    const ws = ctx.createWaveShaper(); const cur = new Float32Array(256); for (let i = 0; i < 256; i++) { const x = i / 128 - 1; cur[i] = Math.tanh(x * 2.4); } ws.curve = cur;
    const o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), o3 = ctx.createOscillator();
    o1.type = "sawtooth"; o2.type = "sawtooth"; o3.type = "square"; o2.detune.value = 14;
    const sub = ctx.createGain(); sub.gain.value = 0.5;
    const blade=ctx.createGain();blade.gain.value=1;
    const bladeOsc=ctx.createOscillator(),bladeDepth=ctx.createGain();bladeOsc.type='sine';bladeOsc.frequency.value=14;bladeDepth.gain.value=0;bladeOsc.connect(bladeDepth);bladeDepth.connect(blade.gain);bladeOsc.start();
    o1.connect(ws); o2.connect(ws); o3.connect(sub); sub.connect(ws); ws.connect(ef); ef.connect(eg);eg.connect(blade);blade.connect(sfx);
    // Firing-pulse amplitude modulation gives each class a lumpy, mechanical idle.
    const fire=ctx.createOscillator(),fireDepth=ctx.createGain();fire.type='triangle';fire.frequency.value=20;fireDepth.gain.value=0;fire.connect(fireDepth);fireDepth.connect(eg.gain);fire.start();
    for (const o of [o1, o2, o3]) { o.frequency.value = 40; o.start(); }
    const rumble = loopNoise(brownBuf, "lowpass", 180, 1, sfx, 0);
    L.engine = { o1, o2, o3, f: ef, g: eg, rumble,blade,bladeOsc,bladeDepth,fire,fireDepth,lastRpm:0,gear:0,popT:0 };
    // turbo spool whistle (sine through a narrow bandpass), only on boosted models
    const tu=ctx.createOscillator(),tg=ctx.createGain();tu.type='sine';tu.frequency.value=2200;tg.gain.value=0;tu.connect(tg);tg.connect(sfx);tu.start();L.turbo={o:tu,g:tg,load:0};
    // AI traffic engines: a small fixed pool, spatialised; 3 voices (2 on low tier)
    L.ai=[0,1,2].map(()=>{const o=ctx.createOscillator(),o2=ctx.createOscillator(),f=ctx.createBiquadFilter(),g=ctx.createGain(),p=panNode(0);o.type='sawtooth';o2.type='square';o.frequency.value=40;o2.frequency.value=20;f.type='lowpass';f.frequency.value=500;f.Q.value=1.5;g.gain.value=0;
      const sub=ctx.createGain();sub.gain.value=.35;o.connect(f);o2.connect(sub);sub.connect(f);f.connect(g);g.connect(p);p.connect(sfx);o.start();o2.start();return {o,o2,f,g,p,v:null};});
    L.district=loopNoise(brownBuf,'bandpass',300,.8,amb,0);
    L.tyre = loopNoise(noiseBuf, "bandpass", 1900, 6, sfx, 0);
    L.road=loopNoise(brownBuf,'bandpass',650,.65,sfx,0);
    L.wake=loopNoise(noiseBuf,'lowpass',1200,.5,sfx,0);
    const reverse=ctx.createOscillator(),reverseGain=ctx.createGain();reverse.type='triangle';reverse.frequency.value=150;reverseGain.gain.value=0;reverse.connect(reverseGain);reverseGain.connect(sfx);reverse.start();L.reverse={o:reverse,g:reverseGain};
    const railPulse=ctx.createGain(),railOsc=ctx.createOscillator(),railDepth=ctx.createGain(),railPan=panNode(0);
    railPulse.gain.value=.75;railOsc.frequency.value=3;railDepth.gain.value=.25;railOsc.connect(railDepth);railDepth.connect(railPulse.gain);railOsc.start();railPulse.connect(railPan);railPan.connect(amb);
    L.rail={...loopNoise(brownBuf,'bandpass',280,.6,railPulse,0),osc:railOsc,p:railPan};
    // siren: square through bandpass, pitch LFO handled in update for wail/yelp patterns
    const so = ctx.createOscillator(); so.type = "square"; so.frequency.value = 700;
    const sf = ctx.createBiquadFilter(); sf.type = "bandpass"; sf.frequency.value = 1100; sf.Q.value = 1.2;
    const sg = ctx.createGain(); sg.gain.value = 0; const sp = panNode(0);
    so.connect(sf); sf.connect(sg); sg.connect(sp); sp.connect(sfx); so.start();
    L.siren = { o: so, g: sg, p: sp, ph: 0 };
    // ambience beds
    L.traffic = loopNoise(brownBuf, "lowpass", 420, 0.7, amb, 0,true);
    L.crowd = loopNoise(noiseBuf, "bandpass", 700, 2.5, amb, 0);
    L.surf = loopNoise(brownBuf, "lowpass", 900, 0.5, amb, 0);
    L.wind = loopNoise(noiseBuf, "highpass", 3000, 0.4, amb, 0);
    L.rain = loopNoise(noiseBuf, "highpass", 2400, 0.6, amb, 0);
    // rain layers branch off the same noise source (no extra sources): a mid "wash" that swells over water,
    // and a low roof/body drum that dominates from inside a car
    const branch=(type,f,q)=>{const fl=ctx.createBiquadFilter(),g=ctx.createGain();fl.type=type;fl.frequency.value=f;fl.Q.value=q;g.gain.value=0;L.rain.s.connect(fl);fl.connect(g);g.connect(amb);return {f:fl,g};};
    L.rainWash=branch('bandpass',1100,.7);L.rainDrum=branch('lowpass',420,.9);
  }
  // only touch an AudioParam when the value really changes (keeps the automation timeline tiny)
  const set = (p, v, tc = 0.08) => { if (p._v === v || v!==0&&p._v!==undefined&&Math.abs(p._v-v)<Math.max(.002,Math.abs(v)*.01)) return; p._v = v; p.cancelScheduledValues(now()); p.setTargetAtTime(v, now(), tc); };
  // per-class engine character: base pitch, top pitch, filter openness, growl
  const ENG = { hyper: [55, 230, 3800, 0.6], muscle: [32, 150, 1900, 0.9], sports: [48, 210, 3200, 0.6], sedan: [40, 140, 1500, 0.5], police: [40, 165, 2000, 0.6], bike: [62, 260, 3600, 0.4], boat: [30, 110, 900, 0.7], heavy: [26, 96, 1150, 1.0] };
  // Each model gets its own small, stable detune so two sedans never sound identical.
  const engDetune=d=>{if(d._det==null){let h=0;for(const ch of String(d.sprite||d.name||""))h=(h*31+ch.charCodeAt(0))>>>0;d._det=1+((h%97)/96-.5)*.09;}return d._det;};
  A.setEngine = (on, rpm = 0.3) => { A._eng = on; A._rpm = rpm; };
  A.setRain = (amt) => { A._rain = amt || 0; };
  // distant thunder after a lightning flash: a slowed, panned blast rolling in .4-2.2 s later (heavy rain only)
  A.thunder=()=>{if(!ctx||!(A._thunderGate>.35))return;const d=.4+Math.random()*1.8,pan=Math.random()*1.4-.7;setTimeout(()=>{fx('explosion',.09*A._thunderGate,pan,.32+Math.random()*.08);if(!lite)setTimeout(()=>fx('explosion',.05*A._thunderGate,-pan*.6,.26),260+Math.random()*300);},d*1000);};

  /* ---------------- dynamic music ---------------- */
  let musLevel = 1, style = "score", nextStyle = "score", seqT = 0, step = 0, timer = null, stems = {};
  function buildMusic() {
    for (const k of ["pad", "arp", "bass", "kick", "snare", "hat", "lead"]) { const g = ctx.createGain(); g.gain.value = 0; g.connect(mus); stems[k] = g; }
    // ping-pong-ish delay on arp/lead
    const d = ctx.createDelay(1); d.delayTime.value = 0.28; const fb = ctx.createGain(); fb.gain.value = 0.32; const dl = ctx.createBiquadFilter(); dl.type = "lowpass"; dl.frequency.value = 2400;
    d.connect(dl); dl.connect(fb); fb.connect(d); dl.connect(mus);
    stems.delay = d;
  }
  // stem levels for intensity 0..3
  const MIX = [
    { pad: 0.5, arp: 0.18, bass: 0.0, kick: 0.0, snare: 0.0, hat: 0.05, lead: 0 },
    { pad: 0.42, arp: 0.22, bass: 0.34, kick: 0.0, snare: 0.0, hat: 0.12, lead: 0 },
    { pad: 0.34, arp: 0.22, bass: 0.4, kick: 0.6, snare: 0.32, hat: 0.16, lead: 0.0 },
    { pad: 0.28, arp: 0.2, bass: 0.46, kick: 0.72, snare: 0.42, hat: 0.22, lead: 0.16 },
  ];
  function applyMix(level) {
    const lo = Math.floor(level), hi = Math.min(3, lo + 1), k = level - lo;
    for (const s of Object.keys(MIX[0])) set(stems[s].gain, MIX[lo][s] * (1 - k) + MIX[hi][s] * k, 0.6);
  }
  function startMusic() {
    if (timer || !ctx) return;
    set(mus.gain, A.musVol * musLevel, 0.8);
    seqT = now() + 0.1;
    timer = setInterval(schedule, 60);
  }
  function schedule() {
    if (!ctx || ctx.state !== "running") return;
    if(A.recordedMusic||A.musVol<=.001||document.hidden){seqT=now()+.1;return;}
    const S = STYLES[style];
    const spb = 60 / S.bpm / 4; // 16th
    while (seqT < now() + 0.25) {
      if (step % 16 === 0 && nextStyle !== style) { // switch styles on the bar line (after the fade)
        style = nextStyle; step = 0; continue;
      }
      playStep(S, step, seqT + (step % 2 ? S.swing * spb : 0));
      seqT += spb; step++;
    }
  }
  function playStep(S, i, t) {
    const bar = (i / 16) | 0, s16 = i % 16, chordRoot = S.prog[bar % 4];
    const deg = (n) => { const sc = S.scale, o = Math.floor(n / sc.length); return S.root + sc[((n % sc.length) + sc.length) % sc.length] + 12 * o; };
    const I = A._int;
    const st = style;
    // pad: chord on bar start
    if (s16 === 0) for (const n of [0, 2, 4, 6]) synth(stems.pad, mtof(deg(chordRoot + n) + 12), t, (60 / S.bpm) * 4, "sawtooth", 0.05, 1400 + I * 300, 0.6, 1.2);
    // arp
    const arpPat = st === "house" ? [0, 2, 4, 2] : st === "lofi" ? [0, 4, 2, 6] : [0, 2, 4, 7];
    if (s16 % (st === "lofi" ? 4 : 2) === 0) { const n = arpPat[(s16 / 2) % 4 | 0]; synth(stems.arp, mtof(deg(chordRoot + n) + 24), t, 0.14, st === "lofi" ? "triangle" : "square", 0.05, 2600, 0.002, 0.12, stems.delay); }
    // bass
    const bassHits = st === "house" ? [0, 3, 6, 8, 11, 14] : st === "lofi" ? [0, 7, 10] : I >= 3 ? [0, 2, 4, 6, 8, 10, 12, 14] : [0, 3, 8, 11];
    if (bassHits.includes(s16)) synth(stems.bass, mtof(deg(chordRoot) - 12), t, 0.2, "sawtooth", 0.16, 500 + I * 220, 0.005, 0.18);
    // drums
    const four = st === "house" || st === "chase";
    if (four ? s16 % 4 === 0 : (s16 === 0 || s16 === 10)) kick(t);
    if (s16 === 4 || s16 === 12) snare(t, st === "lofi");
    if (st === "lofi" ? s16 % 4 === 2 : (I >= 3 ? true : s16 % 2 === 0)) hat(t, s16 % 4 === 2 ? 0.7 : 0.4);
    // lead stabs (chase)
    if (I >= 2.5 && (s16 === 0 || s16 === 3 || s16 === 6 || s16 === 14)) synth(stems.lead, mtof(deg(chordRoot + 4) + 12), t, 0.12, "sawtooth", 0.06, 3200, 0.003, 0.1, stems.delay);
  }
  function synth(out, f, t, dur, type, vol, cut, a, rel, send) {
    const o = ctx.createOscillator(), o2 = ctx.createOscillator(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
    o.type = type; o2.type = type; o.frequency.value = f; o2.frequency.value = f; o2.detune.value = 9;
    fl.type = "lowpass"; fl.frequency.setValueAtTime(cut, t); fl.Q.value = 2;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + a); g.gain.setValueAtTime(vol, t + Math.max(a, dur - rel)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + rel);
    o.connect(fl); o2.connect(fl); fl.connect(g); g.connect(out); if (send) g.connect(send);
    o.start(t); o2.start(t); o.stop(t + dur + rel + 0.05); o2.stop(t + dur + rel + 0.05);o2.onended=()=>{o.disconnect();o2.disconnect();fl.disconnect();g.disconnect();};
  }
  function kick(t) { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12); g.gain.setValueAtTime(0.9, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3); o.connect(g); g.connect(stems.kick);o.onended=()=>{o.disconnect();g.disconnect();};o.start(t); o.stop(t + 0.32); }
  function snare(t, soft) { const s = noiseSrc(), f = ctx.createBiquadFilter(), g = ctx.createGain(); f.type = "highpass"; f.frequency.value = soft ? 1200 : 1800; g.gain.setValueAtTime(soft ? 0.25 : 0.5, t); g.gain.exponentialRampToValueAtTime(0.0001, t + (soft ? 0.12 : 0.18)); s.connect(f); f.connect(g); g.connect(stems.snare); s.start(t); s.stop(t + 0.2);
    s.onended=()=>{s.disconnect();f.disconnect();g.disconnect();};
    const o = ctx.createOscillator(), og = ctx.createGain(); o.frequency.value = 190; og.gain.setValueAtTime(0.3, t); og.gain.exponentialRampToValueAtTime(0.0001, t + 0.08); o.connect(og); og.connect(stems.snare);o.onended=()=>{o.disconnect();og.disconnect();};o.start(t); o.stop(t + 0.1); }
  function hat(t, v) { const s = noiseSrc(), f = ctx.createBiquadFilter(), g = ctx.createGain(); f.type = "highpass"; f.frequency.value = 7000; g.gain.setValueAtTime(0.25 * v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04); s.connect(f); f.connect(g); g.connect(stems.hat);s.onended=()=>{s.disconnect();f.disconnect();g.disconnect();};s.start(t); s.stop(t + 0.06); }
  function wantStyle(sty) {
    if (sty === nextStyle) return;
    nextStyle = sty;
    // quick dip so the switch on the next bar line is a crossfade, not a cut
    const t = now(); mus.gain.cancelScheduledValues(t); mus.gain.setValueAtTime(mus.gain.value, t);
    mus.gain.linearRampToValueAtTime(A.musVol * 0.15, t + 0.5); mus.gain.linearRampToValueAtTime(A.musVol * musLevel, t + 2.6);
  }

  /* ---------------- radio API kept for the game ---------------- */
  A.setRadio = (on, st = A.station) => { A.radio = on; A.station = st % A.stations.length; };
  A.nextStation = () => { A.station = (A.station + 1) % A.stations.length; A.radio = true; A.stinger(A.station); return A.stations[A.station].name; };
  A.currentStation = () => A.stations[A.station % A.stations.length].name;

  /* ---------------- per-tick update (cheap: a handful of param ramps) ---------------- */
  let stepDist=0,gullT=3,dingT=2,surfT=2,callT=0,callN=0,coasterT=0,screamT=4,bellT=6,jointY=null,railT=0,scanT=0,scanX=Infinity,scanY=Infinity,lastScene='',lastAudible=false,spatialQueries=0;
  const railWorld={motion:0,gain:0,pan:0},platformDoors=[false,false];
  A.update = (G, dt) => {
    if (!ctx || ctx.state !== "running") return;
    listener=G;
    const P=G.player,play=G.scene==='play',casino=G.scene==='casino',audible=A.sfxVol>.001&&A.masterVol>.001;
    if(!P)return;
    scanT-=dt;
    if(scanT<=0||lastScene!==G.scene||lastAudible!==audible||Math.abs(P.x-scanX)+Math.abs(P.y-scanY)>140){
      scanT=.35;scanX=P.x;scanY=P.y;lastScene=G.scene;lastAudible=audible;
      sceneAcoustics(audible?G:{scene:'silent'},acoustics);spatialQueries++;
      railWorld.motion=railWorld.gain=railWorld.pan=0;
      if(audible&&play&&G.transit&&Math.abs(P.x-10320)<1000)for(let i=0;i<2;i++){
        const train=regionalTrainAt(G.transit.clock,i*99);soundPosition(G,train.x,train.y,1000,position);
        if(position.gain>railWorld.gain){railWorld.motion=Math.min(1,train.speed/240);railWorld.gain=position.gain;railWorld.pan=position.pan;}
        const opening=train.doors>.2;if(opening&&!platformDoors[i]&&position.gain>.2)A.transit('platform',.10*position.gain,position.pan);platformDoors[i]=opening;
      }
    }
    // intensity: 0 calm, 1 mission/active, 2 wanted 1-2, 3 chase (3+ or seen)
    let target = play ? (G.wanted >= 3 ? 3 : G.wanted > 0 ? 2.2 : G.circuitSession?.running ? 2.1 : (G._flow ? 1 : 0.4)) : G.scene === "title" ? 0.9 : 0.3;
    if (G.scene === "vn" || G.scene === "brief") target = 0.2;
    A._int += (target - A._int) * Math.min(1, dt * 0.6);
    A.recordedMusic=soundtrack?.update(G,A.station)||false;
    A.activeStreams=soundtrack?.activeStreams||0;
    A.trackTitle=soundtrack?.title||'CROWN CITY / LIVE SCORE';
    if(A.recordedMusic){for(const s of Object.keys(MIX[0]))set(stems[s].gain,0,.35);}else applyMix(A._int);
    const driving=play&&P.type==='veh',inCar=driving&&audible;
    if(!A.recordedMusic)wantStyle(G.wanted >= 3 ? "chase" : driving && A.radio ? A.stations[A.station].style : "score");
    musLevel=G.scene==='title'?.85:casino?.78:1;set(mus.gain,A.musVol*musLevel,.3);
    // engine
    const E = L.engine;
    if(inCar&&P.def.aircraft&&A._eng!==false&&!P.dead){
      // A continuous turbine / propeller pitch with blade pulses, without car gear changes.
      const heli=P.def.helicopter,rpm=heli?Math.max(.35,P.rotor||0):.3+.7*Math.min(1,(P.airspeed||0)/P.def.max);
      const f=heli?76+rpm*59:66+rpm*132;
      set(E.o1.frequency,f,.14);set(E.o2.frequency,f*(heli?1.018:1.009),.14);set(E.o3.frequency,f*.5,.14);
      // Blade modulation runs at audio rate. Sampling a 17–38Hz rotor pulse
      // in this 15Hz control loop produced false, low-frequency flutter.
      set(E.blade.gain,heli?.74:.86,.2);set(E.bladeDepth.gain,heli?.26:.14,.12);set(E.bladeOsc.frequency,heli?11+rpm*6:25+rpm*13,.25);
      set(E.f.frequency,heli?520:760+rpm*700,.12);set(E.g.gain,(heli?.075:.065)*rpm,.12);
      set(E.rumble.g.gain,(heli?.15:.095)*rpm,.12);set(E.rumble.f.frequency,heli?180:310,.2);set(L.tyre.g.gain,0,.05);
    } else if (inCar && A._eng !== false && !P.dead) {
      set(E.blade.gain,1,.15);set(E.bladeDepth.gain,0,.15);
      const V=voiceFor(P),em=engineMotion(P,G.input,engineMix),load=em.load,st=engineState(P,load,engineMix.voiceState||(engineMix.voiceState={}));
      // reverse and boats keep the original continuous model; road vehicles use per-model gears
      const rpm=em.reverse||P.def.boat?em.rpm:st.rpm,det=engDetune(P.def);
      const f = (V.base + (V.top - V.base) * rpm)*det;
      set(E.o1.frequency, f, 0.05); set(E.o2.frequency, f * V.stack, 0.05); set(E.o3.frequency, f / 2, 0.05);
      // load: throttle opens the filter and adds level; coasting (engine braking) closes it and thins out
      set(E.f.frequency, 260 + V.cut * (0.22 + 0.78 * rpm) * (0.55 + 0.45 * load), 0.06);
      set(E.g.gain, (0.042 + 0.07 * rpm) * (0.7 + 0.3 * load), 0.08); set(E.rumble.g.gain, 0.12 * V.growl * (.6+.4*load), 0.1); set(E.rumble.f.frequency, 110 + 200 * rpm + 120 * V.diesel, 0.1);
      set(E.fire.frequency,f*V.fire,.05);set(E.fireDepth.gain,(.014+.03*V.growl+.035*V.diesel)*(1-rpm*.55),.1);
      // turbo spool rises with boost (load x rpm^2); a lift-off at boost vents through the blow-off valve
      const boost=V.turbo*load*rpm*rpm;set(L.turbo.g.gain,.010*boost,.12);set(L.turbo.o.frequency,1700+2600*rpm,.1);
      if(V.turbo>.35&&L.turbo.load>.8&&load<.6&&rpm>.55){E.popT=Math.max(E.popT,.15);fx('blowoff',.07+.05*V.turbo,(Math.random()-.5)*.2,.9+Math.random()*.2);}
      L.turbo.load=load;
      // Gear changes: a short torque dip on upshift; lift-off crackle on performance cars.
      const gear=st.gear;
      if(gear>E.gear&&rpm>.4&&!P.def.boat){const t=now(),g=E.g.gain;g.cancelScheduledValues(t);g.setValueAtTime(g.value,t);g.linearRampToValueAtTime(.018,t+.06);g.setTargetAtTime((0.042+0.07*rpm)*(0.7+0.3*load),t+.12,.06);g._v=undefined;}
      E.gear=gear;E.popT-=dt;
      if(['hyper','muscle','sports'].includes(P.def.kind)&&E.lastRpm>.62&&rpm<E.lastRpm-.02&&load<.6&&E.popT<=0&&Math.random()<.35){E.popT=.09+Math.random()*.18;fx('backfire',.12+Math.random()*.08,(Math.random()-.5)*.3,.85+Math.random()*.3);}
      E.lastRpm=rpm;
    } else {set(L.turbo.g.gain,0,.1);set(E.bladeDepth.gain,0,.15);set(E.fireDepth.gain,0,.1);set(E.g.gain,0,.15);set(E.rumble.g.gain,0,.2);set(L.tyre.g.gain,0,.05);}
    const backwards=inCar&&!P.dead&&!P.def.boat&&!P.def.aircraft&&!P.def.bike?Math.max(0,-((P.vx||0)*Math.sin(P.rot)-(P.vy||0)*Math.cos(P.rot))-4):0,reverseMix=Math.min(1,backwards/90);
    set(L.reverse.g.gain,.023*reverseMix,.12);set(L.reverse.o.frequency,160+reverseMix*160,.12);
    const surface=inCar?(G.surfaceAt?.(P.x,P.y)||'road'):'walk';surfaceMotion(inCar?P:{type:'foot'},surface,G.wet||0,rollingMix);
    // skid voice by surface: rubber squeal on asphalt, gravel/snow crunch off it, thin hiss on ice
    const TY=tyreFor(surface,G.alpineMix||0,!!P.onIce),onGround=inCar&&!P.def.boat&&!P.def.aircraft&&surface!=='water',skid=onGround?A._skid*.18*(1-TY[2]*.5):0,crunch=onGround?A._skid*.16*TY[2]:0;
    set(L.tyre.g.gain,Math.max(skid,rollingMix.tyre),.07);set(L.tyre.f.frequency,TY[2]>.3?TY[0]+rollingMix.tyre*800:TY[0]*.74+rollingMix.tyre*4500,.15);set(L.tyre.f.Q,TY[1],.2);
    set(L.road.g.gain,rollingMix.roll+crunch,.16);set(L.road.f.frequency,rollingMix.frequency,.2);
    set(L.wake.g.gain,rollingMix.wake,.22);set(L.wake.f.frequency,rollingMix.frequency,.2);
    A._skid = Math.max(0, A._skid - dt * 2.5);
    // nearest siren with pan + doppler
    const best=play&&audible&&!acoustics.siren?.dead?acoustics.siren:null,bd=best?Math.hypot(best.x-P.x,best.y-P.y):1400;
    const S = L.siren;
    if (best) {
      S.ph += dt;
      const wail = G.wanted >= 3 ? 0.5 + 0.5 * Math.sign(Math.sin(S.ph * 9)) : 0.5 + 0.5 * Math.sin(S.ph * 2.2); // yelp at 3+, wail below
      const rx = (best.x - P.x) / (bd || 1), ry = (best.y - P.y) / (bd || 1);
      const rel = (((best.vx||0) - (P.vx || 0)) * rx + ((best.vy||0) - (P.vy || 0)) * ry); // + moving away
      const dop = Math.max(0.85, Math.min(1.15, 1 - rel / 1200));
      set(S.o.frequency, (620 + 520 * wail) * dop, 0.03);
      set(S.g.gain, 0.09 * Math.pow(Math.max(0,1-bd/1400),1.6), 0.08);
      if(S.p.pan){const rot=G.cam.rot||0,screenX=(best.x-P.x)*Math.cos(rot)-(best.y-P.y)*Math.sin(rot);set(S.p.pan,Math.max(-.9,Math.min(.9,screenX/600)),.1);}
    } else set(S.g.gain, 0, 0.2);
    let railSpeed=0,railGain=0,railPan=0;
    if(audible&&G.scene==='train'&&G.transit?.ride){const phase=ridePhase(G.transit.ride);railSpeed=railMotion(phase.id,phase.p);railGain=.13;
      if(railSpeed>.12&&(railT-=dt)<0){railT=1.05-.6*railSpeed;A.transit('rail',.07+.08*railSpeed);}else if(railSpeed<=.12)railT=.18;
    }else if(audible&&play){railSpeed=railWorld.motion;railGain=railWorld.gain*.09;railPan=railWorld.pan;}
    set(L.rail.g.gain,railGain*railSpeed,.2);set(L.rail.f.frequency,150+railSpeed*460,.3);set(L.rail.osc.frequency,2+railSpeed*8,.3);if(L.rail.p.pan)set(L.rail.p.pan,railPan,.2);
    // Ambience follows actual nearby people/vehicles and every canal direction.
    const dist = (G.district || "").toUpperCase();
    const strip = P.x > 1650 && P.x < 2300 && P.y > 800 && P.y < 3800 || dist.includes("METAWIN");
    const water=acoustics.water||0,canal=acoustics.canal||0;
    const night = G.time > 20 || G.time < 6;
    const busy=acoustics.traffic||0,airHeight=P.def?.aircraft?Math.max(0,P.altitude||0):0,ground=Math.max(.12,1-airHeight/360);
    set(L.traffic.g.gain,play&&audible?.16*busy*ground:0,.6);if(L.traffic.p.pan)set(L.traffic.p.pan,acoustics.trafficPan||0,.3);
    const parkCrowd=play&&audible?(islandAmbience(G)?.park||0):0;
    set(L.crowd.g.gain,audible&&(play||casino)?Math.max((casino?.045:strip?.10:.055)*(acoustics.crowd||0)*(night&&strip?1.15:1),parkCrowd*.11)*ground:0,.8);
    set(L.crowd.f.frequency, 600 + 300 * Math.sin(now() * 0.7), 0.4);
    const isle=play&&audible?islandAmbience(G):null,beach=isle?.beach||0,park=isle?.park||0;
    set(L.surf.g.gain,play&&audible?Math.max(water*(canal?.075:.14),beach*.2)*(1+.18*Math.sin(now()*.5))*ground:0,.8);
    if(isle){
     if(beach>.2&&(surfT-=dt)<0){surfT=3.4+Math.random()*3.5;fx('surf',.16*beach*ground,Math.random()*1.2-.6,.85+Math.random()*.25);}
     if(beach>.3&&!night&&(gullT-=dt*.8)<0){gullT=3+Math.random()*5;fx('gull',.07*beach,Math.random()*1.6-.8);}
     if(park>.05&&(callT-=dt)<0){callT=2.38;callN++;fx(callN%4<2?'calliopeA':'calliopeB',.07*park*ground,(G.world.resort.ferris.x-P.x)/900,1);}
     const R=G.world.resort,cp=R?.coasterPos;
     if(cp&&park>.05){const d=Math.hypot(cp.x-P.x,cp.y-P.y);if(d<700&&R.coasterSpeed>.6&&(coasterT-=dt)<0){coasterT=2;fx('coaster',.16*(1-d/700),Math.max(-.9,Math.min(.9,(cp.x-P.x)/500)),.9+R.coasterSpeed*.2);}
      if(d<900&&(screamT-=dt)<0&&(R.coasterSpeed>.85||R.dropFall)){screamT=5+Math.random()*5;fx('screams',.09*(1-d/900),Math.max(-.9,Math.min(.9,(cp.x-P.x)/500)));}}
     if(isle.district==='LUCKY ISLE MARINA'&&(bellT-=dt)<0){bellT=7+Math.random()*9;fx('marinaBell',.05,Math.random()*1.2-.6,.9+Math.random()*.2);}
     if(isle.district==='CROWN BAY BRIDGE'&&P.type==='veh'&&!P.def?.boat&&!P.def?.aircraft){const k=Math.floor((P.y+370)/240);if(jointY!==null&&k!==jointY&&Math.hypot(P.vx||0,P.vy||0)>60)fx('bumper',.12,0,.72);jointY=k;}else jointY=null;
    }set(L.surf.f.frequency,canal?470:900,.8);
    set(L.wind.g.gain,play&&audible?(airHeight>10?.06+Math.min(.13,(P.airspeed||0)/4000):/AIRFIELD|SUNSET|MESA|SIERRA/.test(dist)?.045:dist.includes('FOREST')?.028:.008):0,.6);
    // rain: intensity follows rainAmt, fades with the weather, goes quiet above the snowline (snow falls silent);
    // in a car the hiss is muffled and the roof drum takes over; over water the wash is fuller
    {const snowK=Math.max(0,1-(G.alpineMix||0)/.6),R=play&&audible?Math.min(1,(A._rain||0))*snowK:0,cabin=inCar&&!P.def?.boat&&!P.def?.aircraft,wet=Math.min(1,water*1.4+canal);
     set(L.rain.g.gain,R*(cabin?.07:.2),1.2);set(L.rainWash.g.gain,R*(cabin?.03:.05+.08*wet),1.2);set(L.rainDrum.g.gain,R*(cabin?.2:.035),.9);
     set(L.rainDrum.f.frequency,cabin?380+Math.min(1,Math.hypot(P.vx||0,P.vy||0)/400)*260:520,.6);
     // sparse droplet patter on roofs / bodywork when on foot in heavy rain (skipped on the low tier: voice cap)
     if(R>.45&&!cabin&&!lite&&(A._patT=(A._patT??0)-dt)<0){A._patT=.09+Math.random()*.22/R;fx('stepWater',.018*R,Math.random()*1.6-.8,1.6+Math.random()*.8);}
     A._thunderGate=R;}
    // District beds: Ironside machinery hum, Port Royale harbour drone, Midtown
    // traffic wash, quiet hills. Plus sparse, panned one-shots per district.
    {const D=/IRONSIDE/.test(dist)?[.07,140,'clank',6]:/PORT|HARBOUR/.test(dist)?[.05,110,'foghorn',22]:/MIDTOWN|DOWNTOWN|EASTSIDE|STRIP|PALACE|LOOP/.test(dist)?[.035,520,'horn',9]:/AIRFIELD/.test(dist)?[.03,240,'jetFar',18]:/SUNSET|OLD TOWN/.test(dist)?[.012,700,'dog',14]:[0,300,null,0];
     const quiet=night?.7:1;set(L.district.g.gain,play&&audible&&!P.def?.aircraft?D[0]*quiet:0,1.2);set(L.district.f.frequency,D[1],1);
     if(play&&audible&&D[2]&&(A._distT=(A._distT??9)-dt)<0){A._distT=D[3]*(.6+Math.random()*.8);fx(D[2],D[2]==='horn'?.05:D[2]==='foghorn'?.08:.06,Math.random()*1.6-.8,D[2]==='horn'?.8+Math.random()*.4:1);}}
    if(play&&audible&&water&&(gullT-=dt)<0&&!night){gullT=5+Math.random()*8;fx('gull',.055*water,Math.random()*1.6-.8);}
    if(play&&audible&&strip&&(dingT-=dt)<0){dingT=3+Math.random()*5;fx('casinoPush',.035,Math.random()*1.6-.8);}
    // AI engines: nearest moving civilians within 520px take the pool voices
    {const cap=G.touch&&G.settings?.quality==='low'?2:3,cand=[];
     if(play&&audible)for(const v of G.vehicles){if(v===P||v.dead||v.def?.aircraft||!Number.isFinite(v.x)||!(v.traffic||v.chasing||v.siren))continue;const d=Math.abs(v.x-P.x)+Math.abs(v.y-P.y);if(d<700)cand.push([d,v]);}
     cand.sort((a,b)=>a[0]-b[0]);
     for(let k=0;k<L.ai.length;k++){const Vn=L.ai[k],v=k<cap?cand[k]?.[1]:null;if(!v){set(Vn.g.gain,0,.25);Vn.v=null;continue;}
      soundPosition(G,v.x,v.y,520,position);const sp=Math.hypot(v.vx||0,v.vy||0),es=engineState(v,sp>8?.65:.2,Vn),dx=v.x-P.x,dy=v.y-P.y,dd=Math.hypot(dx,dy)||1;
      const rel=((v.vx||0)-(P.vx||0))*dx/dd+((v.vy||0)-(P.vy||0))*dy/dd,dop=Math.max(.88,Math.min(1.12,1-rel/1500));
      if(Vn.v!==v){Vn.v=v;Vn.o.frequency.cancelScheduledValues(now());Vn.o.frequency._v=undefined;}
      set(Vn.o.frequency,es.freq*dop,.08);set(Vn.o2.frequency,es.freq*.5*dop,.08);set(Vn.f.frequency,220+es.voice.cut*.35*(.3+es.rpm),.1);
      set(Vn.g.gain,.032*position.gain*position.gain*(.5+.5*Math.min(1,sp/120)),.15);if(Vn.p.pan)set(Vn.p.pan,position.pan,.1);}}
    // Crown Peak: mountain wind rises, city beds hush under the snow
    if(play&&audible&&(G.alpineMix||0)>.05){const m=G.alpineMix;set(L.wind.g.gain,.012+.05*m,.8);set(L.wind.f.frequency,1400+900*Math.sin(now()*.23),.8);set(L.traffic.g.gain,.16*busy*ground*(1-.8*m),.6);set(L.district.g.gain,0,1.2);}
    // footsteps
    if (play&&audible&&P.type==='foot'&&!(G.action?.dodgeT>0)&&(P.speed||0)>20) {
      stepDist += (P.speed || 0) * dt;
      if (stepDist > ((P.speed || 0) > 150 ? 34 : 26)) { stepDist = 0; A.step(G.surfaceAt ? G.surfaceAt(P.x, P.y) : "walk",G.alpineMix||0); }
    }else stepDist=0;
  };
  A.duck = duck;
  // low tier: drop the convolution reverb (the costliest node on weak phones)
  let lite = false;
  A.setLite = (on) => { lite = !!on; if (!verbSend) return; try { verbSend.disconnect(); } catch {} if(!lite)verbSend.connect(reverb()); };
  A.soundStats=()=>({effects:effects?.stats(),oneShots:voiceEnds.filter(t=>t>now()).length,spatialQueries,reverb:!!verb&&!lite,continuousSources:ctx?23:0,aiVoices:L.ai?.filter(v=>v.v).length||0,turboLevel:L.turbo?.g.gain.value||0,rotorDepth:L.engine?.bladeDepth.gain.value||0,reverseLevel:L.reverse?.g.gain.value||0,railLevel:L.rail?.g.gain.value||0,rainLevel:L.rain?.g.gain.value||0,rainDrum:L.rainDrum?.g.gain._v||0,rainWash:L.rainWash?.g.gain._v||0,rainHiss:L.rain?.g.gain._v||0,windLevel:L.wind?.g.gain.value||0});
  // capture tap for recording demos (tests only)
  A.tap = () => { ensure(); const d = ctx.createMediaStreamDestination(); master.connect(d); return d.stream; };
  return A;
}
