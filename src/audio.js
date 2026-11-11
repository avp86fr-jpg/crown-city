import {createEffects} from './sound_effects.js';
import {createSoundtrack,TRACKS} from './soundtrack.js';
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
    ],
  };
  let ctx, master, limiter, glue, sfx, mus, amb, verb, verbSend, noiseBuf, brownBuf;
  let soundtrack=null, effects=null;
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
    amb = ctx.createGain(); amb.gain.value = 0.55 * A.sfxVol; amb.connect(glue);
    // shared reverb (generated impulse)
    verb = ctx.createConvolver();
    const len = Math.floor(ctx.sampleRate * 1.3), ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
    verb.buffer = ir; verbSend = ctx.createGain(); verbSend.gain.value = 0.32; if (!lite) verbSend.connect(verb); verb.connect(glue);
    // noise buffers
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    { const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
    brownBuf = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate);
    { const d = brownBuf.getChannelData(0); let l = 0; for (let i = 0; i < d.length; i++) { l = (l + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = l * 3.5; } }
    effects=createEffects(ctx,sfx);buildMusic(); buildLoops();
  }
  const now = () => ctx.currentTime;
  const noiseSrc = (buf = noiseBuf, loop = false) => { const s = ctx.createBufferSource(); s.buffer = buf; s.loop = loop; if (!loop) s.playbackRate.value = 0.9 + Math.random() * 0.2; return s; };
  const env = (g, t, a, peak, d, end = 0.0001) => { g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(end, t + a + d); };
  let voices = 0;
  function oneShot(build, dur) { // caps concurrent one-shots so audio never costs frames
    if (!ctx || voices > 22) return;
    voices++; setTimeout(() => voices--, dur * 1000 + 60);
    build(now());
  }
  function panNode(p) { const n = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain(); if (n.pan) n.pan.value = Math.max(-1, Math.min(1, p || 0)); return n; }
  function tone(freq, dur, type = "square", vol = 0.06, glide = 0, out = sfx, t0) {
    oneShot((t) => {
      t = t0 || t;
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type; o.frequency.setValueAtTime(freq, t); if (glide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + glide), t + dur);
      env(g, t, 0.004, vol, dur); o.connect(g); g.connect(out); o.onended=()=>{o.disconnect();g.disconnect();}; o.start(t); o.stop(t + dur + 0.05);
    }, dur);
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
  A.setSfx = (v) => { A.sfxVol = v; if (sfx) { sfx.gain.value = v; amb.gain.value = 0.55 * v; } };
  A.setMus = (v) => { A.musVol = v; if (mus) mus.gain.setTargetAtTime(v * musLevel, now(), 0.1); };
  A.setMaster = (v) => { A.masterVol = v; if (master) master.gain.value = v; };
  A.ui = () => { tone(880, 0.05, "triangle", 0.05); tone(1320, 0.06, "triangle", 0.035, 0, sfx, ctx && now() + 0.035); };
  A.click = () => tone(1400, 0.025, "square", 0.025);
  let lastType=0;
  A.type=()=>{if(ctx&&now()-lastType>.12){lastType=now();effects?.('ui',.012);}};
  A.reload = () => effects?.('reload',.34);
  A.transit = kind => effects?.(kind,.24);
  A.wildlife = (kind,vol=.12,pan=0) => effects?.(kind,vol,pan);
  A.cock = () => noiseHit({dur:.055,vol:.16,type:'highpass',f:2800});
  A.dodge = () => noiseHit({dur:.23,vol:.17,type:'lowpass',f:1200,f2:280});
  A.radioChirp = () => {tone(1100,.04,'sine',.022);tone(1600,.05,'sine',.018,0,sfx,ctx&&now()+.06);};
  A.pickup = () => { if (!ctx) return; const t = now(); [0, 4, 7, 12].forEach((s, i) => tone(mtof(84 + s), 0.12, "triangle", 0.05, 0, sfx, t + i * 0.045)); };
  A.star = () => { if (!ctx) return; const t = now(); tone(988, 0.09, "square", 0.04, 0, sfx, t); tone(740, 0.12, "square", 0.04, 0, sfx, t + 0.1); };
  A.enter = () => { noiseHit({ dur: 0.08, vol: 0.25, type: "lowpass", f: 600 }); tone(110, 0.08, "sine", 0.12, -40); };
  A.exit = () => { noiseHit({ dur: 0.06, vol: 0.2, type: "lowpass", f: 900 }); tone(140, 0.06, "sine", 0.1, -50); };
  A.hit = () => effects?.('impact',.4);
  A.shot = (pan=0,far=0,kind='pistol') => {effects?.(kind,.5*(1-far*.65),pan);};
  A.crash = (amount=1) => {effects?.('metal',Math.min(.65,.25+amount*.2));};
  A.splash = (amount=1) => effects?.('water',Math.min(.55,.2+amount*.2));
  A.boom = () => {
    noiseHit({ dur: 1.6, vol: 0.9, type: "lowpass", f: 2200, f2: 80, rate: 0.6 });
    noiseHit({ dur: 2.2, vol: 0.4, type: "lowpass", f: 600, f2: 60, out: verbSend || sfx, a: 0.02 });
    tone(48, 0.9, "sine", 0.8, -26);
    duck(0.25, 0.8);
  };
  A.horn = (pan = 0) => { if (!ctx) return; const t = now(); for (const f of [392, 494]) tone(f, 0.28, "sawtooth", 0.035, 0, sfx, t); };
  A.yelp = () => {
    oneShot((t) => {
      const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      const base = 320 + Math.random() * 260;
      o.type = "sawtooth"; o.frequency.setValueAtTime(base, t); o.frequency.exponentialRampToValueAtTime(base * 1.6, t + 0.08); o.frequency.exponentialRampToValueAtTime(base * 0.8, t + 0.28);
      f.type = "bandpass"; f.frequency.setValueAtTime(900, t); f.frequency.linearRampToValueAtTime(1600, t + 0.2); f.Q.value = 5;
      env(g, t, 0.02, 0.06, 0.28); o.connect(f); f.connect(g); g.connect(sfx); o.start(t); o.stop(t + 0.35);
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
  A.step = (surf) => noiseHit({ dur: 0.045, vol: surf === "grass" || surf === "sand" ? 0.07 : 0.11, type: "bandpass", f: surf === "grass" ? 900 : surf === "sand" ? 1400 : 2000 + Math.random() * 600, q: 1.5, rate: 0.8 + Math.random() * 0.4 });

  /* -------------- continuous loops: engine, tyres, siren, ambience, rain -------------- */
  const L = {};
  function loopNoise(buf, type, f, q, out, vol = 0) {
    const s = noiseSrc(buf, true), fl = ctx.createBiquadFilter(), g = ctx.createGain();
    fl.type = type; fl.frequency.value = f; fl.Q.value = q; g.gain.value = vol;
    s.connect(fl); fl.connect(g); g.connect(out); s.start();
    return { s, f: fl, g };
  }
  function buildLoops() {
    // engine: 2 detuned saws + sub square -> lowpass (+ waveshaper growl)
    const eg = ctx.createGain(); eg.gain.value = 0;
    const ef = ctx.createBiquadFilter(); ef.type = "lowpass"; ef.frequency.value = 600; ef.Q.value = 4;
    const ws = ctx.createWaveShaper(); const cur = new Float32Array(256); for (let i = 0; i < 256; i++) { const x = i / 128 - 1; cur[i] = Math.tanh(x * 2.4); } ws.curve = cur;
    const o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), o3 = ctx.createOscillator();
    o1.type = "sawtooth"; o2.type = "sawtooth"; o3.type = "square"; o2.detune.value = 14;
    const sub = ctx.createGain(); sub.gain.value = 0.5;
    o1.connect(ws); o2.connect(ws); o3.connect(sub); sub.connect(ws); ws.connect(ef); ef.connect(eg); eg.connect(sfx);
    for (const o of [o1, o2, o3]) { o.frequency.value = 40; o.start(); }
    const rumble = loopNoise(brownBuf, "lowpass", 180, 1, sfx, 0);
    L.engine = { o1, o2, o3, f: ef, g: eg, rumble };
    L.tyre = loopNoise(noiseBuf, "bandpass", 1900, 6, sfx, 0);
    // siren: square through bandpass, pitch LFO handled in update for wail/yelp patterns
    const so = ctx.createOscillator(); so.type = "square"; so.frequency.value = 700;
    const sf = ctx.createBiquadFilter(); sf.type = "bandpass"; sf.frequency.value = 1100; sf.Q.value = 1.2;
    const sg = ctx.createGain(); sg.gain.value = 0; const sp = panNode(0);
    so.connect(sf); sf.connect(sg); sg.connect(sp); sp.connect(sfx); so.start();
    L.siren = { o: so, g: sg, p: sp, ph: 0 };
    // ambience beds
    L.traffic = loopNoise(brownBuf, "lowpass", 420, 0.7, amb, 0);
    L.crowd = loopNoise(noiseBuf, "bandpass", 700, 2.5, amb, 0);
    L.surf = loopNoise(brownBuf, "lowpass", 900, 0.5, amb, 0);
    L.wind = loopNoise(noiseBuf, "highpass", 3000, 0.4, amb, 0);
    L.rain = loopNoise(noiseBuf, "highpass", 2400, 0.6, amb, 0);
  }
  // only touch an AudioParam when the value really changes (keeps the automation timeline tiny)
  const set = (p, v, tc = 0.08) => { if (p._v !== undefined && Math.abs(p._v - v) < Math.max(0.002, Math.abs(v) * 0.01)) return; p._v = v; p.cancelScheduledValues(now()); p.setTargetAtTime(v, now(), tc); };
  // per-class engine character: base pitch, top pitch, filter openness, growl
  const ENG = { hyper: [55, 230, 3800, 0.6], muscle: [32, 150, 1900, 0.9], sports: [48, 210, 3200, 0.6], sedan: [40, 140, 1500, 0.5], police: [40, 165, 2000, 0.6], bike: [62, 260, 3600, 0.4], boat: [30, 110, 900, 0.7] };
  A.setEngine = (on, rpm = 0.3) => { A._eng = on; A._rpm = rpm; };
  A.setRain = (amt) => { A._rain = amt || 0; };

  /* ---------------- dynamic music ---------------- */
  let musLevel = 1, style = "score", nextStyle = "score", seqT = 0, step = 0, timer = null, stems = {};
  function buildMusic() {
    for (const k of ["pad", "arp", "bass", "kick", "snare", "hat", "lead"]) { const g = ctx.createGain(); g.gain.value = 0; g.connect(mus); stems[k] = g; }
    // ping-pong-ish delay on arp/lead
    const d = ctx.createDelay(1); d.delayTime.value = 0.28; const fb = ctx.createGain(); fb.gain.value = 0.32; const dl = ctx.createBiquadFilter(); dl.type = "lowpass"; dl.frequency.value = 2400;
    d.connect(dl); dl.connect(fb); fb.connect(d); dl.connect(mus);
    stems.delay = d;
    stems.pad.connect(verbSend);
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
  function kick(t) { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12); g.gain.setValueAtTime(0.9, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3); o.connect(g); g.connect(stems.kick); o.start(t); o.stop(t + 0.32); }
  function snare(t, soft) { const s = noiseSrc(), f = ctx.createBiquadFilter(), g = ctx.createGain(); f.type = "highpass"; f.frequency.value = soft ? 1200 : 1800; g.gain.setValueAtTime(soft ? 0.25 : 0.5, t); g.gain.exponentialRampToValueAtTime(0.0001, t + (soft ? 0.12 : 0.18)); s.connect(f); f.connect(g); g.connect(stems.snare); g.connect(verbSend); s.start(t); s.stop(t + 0.2);
    const o = ctx.createOscillator(), og = ctx.createGain(); o.frequency.value = 190; og.gain.setValueAtTime(0.3, t); og.gain.exponentialRampToValueAtTime(0.0001, t + 0.08); o.connect(og); og.connect(stems.snare); o.start(t); o.stop(t + 0.1); }
  function hat(t, v) { const s = noiseSrc(), f = ctx.createBiquadFilter(), g = ctx.createGain(); f.type = "highpass"; f.frequency.value = 7000; g.gain.setValueAtTime(0.25 * v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04); s.connect(f); f.connect(g); g.connect(stems.hat); s.start(t); s.stop(t + 0.06); }
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
  let stepDist = 0, gullT = 3, dingT = 2, railT=0;
  A.update = (G, dt) => {
    if (!ctx || ctx.state !== "running") return;
    const P = G.player, play = G.scene === "play";
    if(G.scene==='train'&&(railT-=dt)<0){railT=.68;A.transit('rail');}
    // intensity: 0 calm, 1 mission/active, 2 wanted 1-2, 3 chase (3+ or seen)
    let target = play ? (G.wanted >= 3 ? 3 : G.wanted > 0 ? 2.2 : (G._flow ? 1 : 0.4)) : G.scene === "title" ? 0.9 : 0.3;
    if (G.scene === "vn" || G.scene === "brief") target = 0.2;
    A._int += (target - A._int) * Math.min(1, dt * 0.6);
    A.recordedMusic=soundtrack?.update(G,A.station)||false;
    A.activeStreams=soundtrack?.activeStreams||0;
    A.trackTitle=soundtrack?.title||'CROWN CITY / LIVE SCORE';
    if(A.recordedMusic){for(const s of Object.keys(MIX[0]))set(stems[s].gain,0,.35);}else applyMix(A._int);
    const inCar = play && P.type === "veh";
    if(!A.recordedMusic)wantStyle(G.wanted >= 3 ? "chase" : inCar && A.radio ? A.stations[A.station].style : "score");
    musLevel = G.scene === "title" ? 0.85 : 1;
    // engine
    const E = L.engine;
    if(inCar&&P.def.aircraft&&A._eng!==false&&!P.dead){
      // A continuous turbine / propeller pitch with blade pulses, without car gear changes.
      const heli=P.def.helicopter,rpm=heli?Math.max(.35,P.rotor||0):.3+.7*Math.min(1,(P.airspeed||0)/P.def.max),pulse=.73+.27*Math.sin(now()*Math.PI*2*(heli?11+rpm*6:25+rpm*13));
      const f=heli?76+rpm*59:66+rpm*132;
      set(E.o1.frequency,f,.14);set(E.o2.frequency,f*(heli?1.018:1.009),.14);set(E.o3.frequency,f*.5,.14);
      set(E.f.frequency,heli?520:760+rpm*700,.12);set(E.g.gain,(heli?.075:.065)*rpm*pulse,.018);
      set(E.rumble.g.gain,(heli?.19:.11)*rpm*pulse,.018);set(E.rumble.f.frequency,heli?180:310,.2);set(L.tyre.g.gain,0,.05);
    } else if (inCar && A._eng !== false && !P.dead) {
      const c = ENG[P.def.boat ? "boat" : P.def.bike ? "bike" : P.def.kind] || ENG.sedan;
      const spd = Math.hypot(P.vx, P.vy), top = P.def.max || 300;
      const gearN = 4, k = Math.min(1, spd / top), gear = Math.min(gearN - 1, (k * gearN) | 0), inG = (k * gearN) - gear;
      const rpm = 0.25 + 0.75 * (gear === 0 ? k * gearN : 0.35 + 0.65 * inG) * (G.input.y > 0.1 || G.input.touchJoy?.active ? 1 : 0.8);
      const f = c[0] + (c[1] - c[0]) * rpm;
      set(E.o1.frequency, f, 0.05); set(E.o2.frequency, f * 1.005, 0.05); set(E.o3.frequency, f / 2, 0.05);
      set(E.f.frequency, 300 + c[2] * (0.25 + 0.75 * rpm), 0.06);
      set(E.g.gain, 0.05 + 0.07 * rpm, 0.08); set(E.rumble.g.gain, 0.12 * c[3], 0.1); set(E.rumble.f.frequency, 120 + 200 * rpm, 0.1);
      // tyres: slip = sideways speed
      const side = Math.abs(P.vx * Math.cos(P.rot) + P.vy * Math.sin(P.rot));
      const slip = Math.max(A._skid, Math.min(1, Math.max(0, side - 70) / 160) * (P.def.boat ? 0 : 1));
      set(L.tyre.g.gain, slip * 0.22, 0.05); set(L.tyre.f.frequency, 1500 + 900 * slip, 0.1);
    } else { set(E.g.gain, 0, 0.15); set(E.rumble.g.gain, 0, 0.2); set(L.tyre.g.gain, 0, 0.05); }
    A._skid = Math.max(0, A._skid - dt * 2.5);
    // nearest siren with pan + doppler
    let best = null, bd = 1400;
    if (play) for (const v of G.vehicles) if (v.siren && !v.dead && v !== P) { const d = Math.hypot(v.x - P.x, v.y - P.y); if (d < bd) { bd = d; best = v; } }
    const S = L.siren;
    if (best) {
      S.ph += dt;
      const wail = G.wanted >= 3 ? 0.5 + 0.5 * Math.sign(Math.sin(S.ph * 9)) : 0.5 + 0.5 * Math.sin(S.ph * 2.2); // yelp at 3+, wail below
      const rx = (best.x - P.x) / (bd || 1), ry = (best.y - P.y) / (bd || 1);
      const rel = ((best.vx - (P.vx || 0)) * rx + (best.vy - (P.vy || 0)) * ry); // + moving away
      const dop = Math.max(0.85, Math.min(1.15, 1 - rel / 1200));
      set(S.o.frequency, (620 + 520 * wail) * dop, 0.03);
      set(S.g.gain, 0.09 * Math.pow(1 - bd / 1400, 1.6), 0.08);
      if(S.p.pan){const rot=G.cam.rot||0,screenX=(best.x-P.x)*Math.cos(rot)+(best.y-P.y)*Math.sin(rot);set(S.p.pan,Math.max(-.9,Math.min(.9,screenX/600)),.1);}
    } else set(S.g.gain, 0, 0.2);
    // ambience by district / place
    const dist = (G.district || "").toUpperCase();
    const strip = P.x > 1650 && P.x < 2300 && P.y > 800 && P.y < 3800 || dist.includes("METAWIN");
    const water = G.surfaceAt && (["water", "pier", "canal"].includes(G.surfaceAt(P.x, P.y - 260)) || ["water", "pier", "canal"].includes(G.surfaceAt(P.x, P.y + 260)) || P.y < 1000);
    const night = G.time > 20 || G.time < 6;
    let nearbyTraffic=0;if(play)for(const v of G.vehicles)if(v.traffic&&!v.dead&&Math.abs(v.x-P.x)<700&&Math.abs(v.y-P.y)<700)nearbyTraffic++;
    const busy=Math.min(1,nearbyTraffic/8);
    set(L.traffic.g.gain, play ? .025+.16*busy : 0, 0.6);
    set(L.crowd.g.gain, play ? (strip ? 0.11 : dist.includes("MIDTOWN") || dist.includes("DOWNTOWN") ? 0.05 : 0.015) * (night && strip ? 1.3 : 1) : 0, 0.8);
    set(L.crowd.f.frequency, 600 + 300 * Math.sin(now() * 0.7), 0.4);
    set(L.surf.g.gain, play && water ? 0.16 + 0.08 * Math.sin(now() * 0.5) : 0, 0.8);
    set(L.wind.g.gain,play?(P.def?.aircraft ? .10+Math.min(.13,(P.airspeed||0)/4000):/AIRFIELD|SUNSET|MESA|SIERRA/.test(dist)?.055:dist.includes("FOREST")?.035:.015):.01,1);
    set(L.rain.g.gain, (A._rain || 0) * 0.2, 0.5);
    if (play && water && (gullT -= dt) < 0 && !night) { gullT = 3 + Math.random() * 6; gull(); }
    if (play && strip && (dingT -= dt) < 0) { dingT = 1.2 + Math.random() * 3; ding(); }
    // footsteps
    if (play && P.type === "foot" && (P.speed || 0) > 20) {
      stepDist += (P.speed || 0) * dt;
      if (stepDist > ((P.speed || 0) > 150 ? 34 : 26)) { stepDist = 0; A.step(G.surfaceAt ? G.surfaceAt(P.x, P.y) : "walk"); }
    }
  };
  function gull() { oneShot((t) => { for (let k = 0; k < 2 + (Math.random() * 2 | 0); k++) { const o = ctx.createOscillator(), g = ctx.createGain(), tt = t + k * 0.22; o.type = "triangle"; const b = 1400 + Math.random() * 500; o.frequency.setValueAtTime(b, tt); o.frequency.exponentialRampToValueAtTime(b * 1.5, tt + 0.06); o.frequency.exponentialRampToValueAtTime(b * 0.7, tt + 0.18); env(g, tt, 0.01, 0.025, 0.18); const p = panNode(Math.random() * 2 - 1); o.connect(g); g.connect(p); p.connect(amb); o.start(tt); o.stop(tt + 0.22); } }, 0.9); }
  function ding() { oneShot((t) => { const f = [1568, 2093, 2637][Math.random() * 3 | 0]; const o = ctx.createOscillator(), g = ctx.createGain(); o.type = "sine"; o.frequency.value = f; env(g, t, 0.003, 0.02, 0.6); const p = panNode(Math.random() * 1.6 - 0.8); o.connect(g); g.connect(p); p.connect(amb); g.connect(verbSend); o.start(t); o.stop(t + 0.65); }, 0.7); }
  A.duck = duck;
  // low tier: drop the convolution reverb (the costliest node on weak phones)
  let lite = false;
  A.setLite = (on) => { lite = !!on; if (!verbSend) return; try { verbSend.disconnect(); } catch {} if (!lite) verbSend.connect(verb); };
  // capture tap for recording demos (tests only)
  A.tap = () => { ensure(); const d = ctx.createMediaStreamDestination(); master.connect(d); return d.stream; };
  return A;
}
