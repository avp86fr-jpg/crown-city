/** Original synthesized radio + SFX. No copyrighted music. */
export function createAudio() {
  const A = {
    ctx: null,
    master: null,
    sfx: null,
    mus: null,
    enabled: true,
    sfxVol: 0.7,
    musVol: 0.45,
    engine: null,
    rain: null,
    radio: null,
    station: 0,
    _wantEngine: false,
  };

  function ensure() {
    if (A.ctx) return;
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    A.ctx = ctx;
    A.master = ctx.createGain();
    A.master.gain.value = 1;
    A.master.connect(ctx.destination);
    A.sfx = ctx.createGain();
    A.sfx.gain.value = A.sfxVol;
    A.sfx.connect(A.master);
    A.mus = ctx.createGain();
    A.mus.gain.value = A.musVol;
    A.mus.connect(A.master);
  }

  A.unlock = () => {
    ensure();
    if (A.ctx.state === "suspended") A.ctx.resume();
  };

  A.setSfx = (v) => { A.sfxVol = v; if (A.sfx) A.sfx.gain.value = v; };
  A.setMus = (v) => { A.musVol = v; if (A.mus) A.mus.gain.value = v; };

  function beep(freq, dur, type = "square", gain = 0.08, slide = 0) {
    if (!A.ctx || !A.enabled) return;
    const o = A.ctx.createOscillator();
    const g = A.ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    if (slide) o.frequency.linearRampToValueAtTime(freq + slide, A.ctx.currentTime + dur);
    g.gain.value = gain;
    g.gain.exponentialRampToValueAtTime(0.0001, A.ctx.currentTime + dur);
    o.connect(g).connect(A.sfx);
    o.start();
    o.stop(A.ctx.currentTime + dur);
  }

  A.ui = () => beep(440, 0.06, "square", 0.05);
  A.pickup = () => { beep(520, 0.08, "triangle", 0.07, 200); };
  A.hit = () => beep(90, 0.16, "sawtooth", 0.1, -40);
  A.shot = () => { beep(280, 0.05, "square", 0.07, -120); beep(90, 0.08, "sawtooth", 0.05); };
  A.enter = () => beep(180, 0.1, "triangle", 0.06, 80);
  A.exit = () => beep(160, 0.1, "triangle", 0.06, -80);
  A.star = () => beep(600, 0.12, "square", 0.06, 200);
  A.banner = (win = true) => {
    if (win) { beep(392, 0.12, "square", 0.09); setTimeout(() => beep(523, 0.12, "square", 0.09), 90); setTimeout(() => beep(784, 0.28, "square", 0.1), 180); }
    else { beep(196, 0.2, "sawtooth", 0.1, -40); setTimeout(() => beep(130, 0.4, "sawtooth", 0.12, -50), 160); }
  };
  A.stinger = (station = 0) => {
    const hooks = [
      [392, 494, 587],
      [262, 330, 392],
      [220, 277, 330],
      [349, 415, 523],
      [196, 247, 330],
    ];
    const notes = hooks[station % hooks.length];
    notes.forEach((n, i) => setTimeout(() => beep(n, 0.11, "square", 0.07), i * 70));
  };
  A.crash = () => {
    beep(55, 0.28, "sawtooth", 0.16, -35);
    beep(180, 0.09, "square", 0.08, -80);
    beep(420, 0.05, "triangle", 0.05, -200);
    if (!A.ctx || !A.enabled) return;
    const ctx = A.ctx;
    const n = 0.18;
    const buf = ctx.createBuffer(1, ctx.sampleRate * n, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = 900;
    const g = ctx.createGain();
    g.gain.value = 0.14;
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + n);
    src.connect(f).connect(g).connect(A.sfx);
    src.start();
  };
  A.click = () => beep(300, 0.04, "square", 0.04);
  A.type = () => beep(760 + Math.random() * 80, 0.018, "square", 0.028);
  A.chaseSwell = () => {
    if (A._swellT && performance.now() - A._swellT < 8000) return;
    A._swellT = performance.now();
    const hook = [196, 247, 311, 392, 523, 392];
    hook.forEach((n, i) => setTimeout(() => beep(n, 0.16, "sawtooth", 0.07 + i * 0.008, 20), i * 90));
    setTimeout(() => beep(311, 0.4, "triangle", 0.06, -40), 580);
  };

  A.setEngine = (on, rpm = 0.3, drive = false) => {
    ensure();
    if (!A.ctx || !A.enabled) return;
    if (!drive || !on) {
      if (A.engine) {
        try { A.engine.osc.stop(); } catch {}
        A.engine = null;
      }
      return;
    }
    if (!A.engine) {
      const osc = A.ctx.createOscillator();
      const g = A.ctx.createGain();
      const f = A.ctx.createBiquadFilter();
      osc.type = "sawtooth";
      f.type = "lowpass";
      f.frequency.value = 400;
      g.gain.value = 0.03;
      osc.connect(f).connect(g).connect(A.sfx);
      osc.start();
      A.engine = { osc, g, f };
    }
    const hz = 50 + rpm * 140;
    A.engine.osc.frequency.setTargetAtTime(hz, A.ctx.currentTime, 0.05);
    A.engine.f.frequency.setTargetAtTime(300 + rpm * 900, A.ctx.currentTime, 0.05);
    A.engine.g.gain.setTargetAtTime(0.02 + rpm * 0.04, A.ctx.currentTime, 0.05);
  };

  A.setRain = (amt) => {
    ensure();
    if (!A.ctx || !A.enabled) return;
    if (amt < 0.05) {
      if (A.rain) {
        A.rain.g.gain.setTargetAtTime(0, A.ctx.currentTime, 0.2);
      }
      return;
    }
    if (!A.rain) {
      const buf = A.ctx.createBuffer(1, A.ctx.sampleRate * 2, A.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      const src = A.ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      const f = A.ctx.createBiquadFilter();
      f.type = "highpass";
      f.frequency.value = 800;
      const g = A.ctx.createGain();
      g.gain.value = 0;
      src.connect(f).connect(g).connect(A.sfx);
      src.start();
      A.rain = { src, g };
    }
    A.rain.g.gain.setTargetAtTime(0.04 * amt, A.ctx.currentTime, 0.3);
  };

  const STATIONS = [
    { name: "VEIL FM", seed: 1, tempo: 0.22, wave: "square" },
    { name: "CHIP AM", seed: 7, tempo: 0.32, wave: "triangle" },
    { name: "NIGHT DECK", seed: 13, tempo: 0.18, wave: "sawtooth" },
    { name: "CROWN WAVE", seed: 19, tempo: 0.26, wave: "square" },
    { name: "RUGCUT RADIO", seed: 29, tempo: 0.28, wave: "triangle" },
  ];
  A.stations = STATIONS;

  A.setRadio = (on, station = A.station) => {
    ensure();
    A.station = station % STATIONS.length;
    if (!A.ctx || !A.enabled) return;
    if (A.radio) {
      A.radio.dead = true;
      try { A.radio.osc.stop(); } catch {}
      A.radio = null;
    }
    if (!on) return;
    const st = STATIONS[A.station];
    const osc = A.ctx.createOscillator();
    const g = A.ctx.createGain();
    osc.type = st.wave;
    g.gain.value = 0.03;
    osc.connect(g).connect(A.mus);
    osc.start();
    const radio = { osc, g, dead: false, t: 0, seed: st.seed, tempo: st.tempo };
    A.radio = radio;
    const scale = [0, 3, 5, 7, 10, 12];
    const tick = () => {
      if (radio.dead || A.radio !== radio) return;
      radio.t++;
      const n = scale[(radio.t * 3 + radio.seed * 2) % scale.length];
      const base = 110 * (radio.seed % 3 === 0 ? 2 : 1);
      osc.frequency.setTargetAtTime(base * Math.pow(2, n / 12), A.ctx.currentTime, 0.01);
      g.gain.setTargetAtTime(0.025, A.ctx.currentTime, 0.01);
      setTimeout(tick, st.tempo * 1000);
    };
    tick();
  };

  A.nextStation = () => {
    A.setRadio(true, (A.station + 1) % STATIONS.length);
    A.stinger(A.station);
    return STATIONS[A.station].name;
  };
  A.currentStation = () => STATIONS[A.station % STATIONS.length].name;

  return A;
}
