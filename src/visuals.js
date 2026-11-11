import {LIGHT} from './lighting.js';
/* Rendering-only effects. No collision, economy or mission state is changed here. */
const TAU = Math.PI * 2;
const clamp = (n, a = 0, b = 1) => Math.max(a, Math.min(b, n));
export const hash = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
export function vehiclePose(v, time, reduced = false) {
  const speed = Math.hypot(v.vx || 0, v.vy || 0);
  if (reduced) return { roll: 0, heave: 0, pitch: 1, wheel: (v.turnSign || 0) * 0.36, speed };
  return {
    roll: (v.lean || 0) * (v.def.bike ? 0.42 : 0.12),
    heave: v.def.boat ? Math.sin(time * 2.2 + v.x * .013) * 1.5 : Math.sin(time * (8 + speed * .08) + v.x) * Math.min(.65, speed / 180),
    pitch: 1 + clamp(v.visualAccel || 0, -1, 1) * .018,
    wheel: (v.turnSign || 0) * .36, speed,
  };
}
export function characterPose(a, moving, time, reduced = false) {
  const stride = (a.dist || 0) / 9 * Math.PI / 2;
  const recoil = clamp((a.shotTick ?? -1000) + 9 - time * 60, 0, 9) / 9;
  return reduced ? { bob: 0, sx: 1, sy: 1, recoil } : {
    bob: moving ? -Math.abs(Math.sin(stride)) * 1.5 : Math.sin(time * 2.4 + a.x) * .35,
    sx: moving ? 1 + Math.sin(stride * 2) * .012 : 1,
    sy: moving ? 1 - Math.sin(stride * 2) * .012 : 1 + Math.sin(time * 2.4 + a.x) * .007,
    recoil,
  };
}
function ellipse(ctx, x, y, rx, ry) { ctx.beginPath(); ctx.ellipse(x, y, Math.max(.01, rx), Math.max(.01, ry), 0, 0, TAU); ctx.fill(); }
export function drawVehicleFinish(G, v, w, h, pose) {
  const ctx = G.ctx;
  ctx.save();
  if(G.settings.quality==='low'){
    if(v.fwd< -8){ctx.fillStyle='#d4eeeb';ctx.fillRect(-w*.25,h*.4,4,3);ctx.fillRect(w*.25-4,h*.4,4,3);}
    if(v.braking&&!v.dead){ctx.fillStyle='#ff6756';ctx.fillRect(-w*.28,h*.4,5,3);ctx.fillRect(w*.28-5,h*.4,5,3);}
    ctx.restore();return;
  }
  // A moving clear-coat highlight follows the car's angle to the city lights.
  ctx.globalCompositeOperation = 'screen';
  const sheen = ctx.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2);
  const band = .45 + Math.sin(v.rot * 2 + .6) * .18;
  sheen.addColorStop(0, 'rgba(100,170,230,0)');
  sheen.addColorStop(Math.max(0, band - .12), 'rgba(100,170,230,0)');
  sheen.addColorStop(band, 'rgba(190,225,255,0.24)');
  sheen.addColorStop(Math.min(1, band + .12), 'rgba(100,170,230,0)');
  sheen.addColorStop(1, 'rgba(100,170,230,0)');
  ctx.fillStyle = sheen;
  // Stay inside the windshield/body rather than lighting transparent sprite margins.
  ellipse(ctx, 0, -h * .02, w * .28, h * .30);
  ctx.globalCompositeOperation = 'source-over';
  if (!v.def.bike && !v.def.boat) {
    for (const side of [-1, 1]) for (const front of [-1, 1]) {
      ctx.save(); ctx.translate(side * w * .39, front * h * .28);
      if (front < 0) ctx.rotate(pose.wheel);
      ctx.fillStyle = '#10171d'; ctx.fillRect(-2.5, -6, 5, 12);
      ctx.strokeStyle = 'rgba(205,221,230,.65)'; ctx.lineWidth = .7;
      const spin = Math.sin((v.visualTravel || 0) * .23) * 3.5;
      ctx.beginPath(); ctx.moveTo(-1.6, spin); ctx.lineTo(1.6, spin); ctx.stroke(); ctx.restore();
    }
    if(v.braking&&!v.dead){ctx.fillStyle='#ef6153';ctx.fillRect(-w*.29,h*.39,5,3);ctx.fillRect(w*.29-5,h*.39,5,3);}
    // Reverse lights are distinct from the warm brake lamps.
    if ((v.fwd || 0) < -8) { ctx.fillStyle = '#d3f4ff'; ctx.fillRect(-w * .24, h * .39, 3, 2); ctx.fillRect(w * .24 - 3, h * .39, 3, 2); }
  }
  if (G.rainAmt > .15 && !v.def.bike && !v.def.boat && !v.dead) {
    const angle = G.settings.reducedMotion ? -.4 : Math.sin(G.ticks / 60 * 5) * .75;
    ctx.strokeStyle = 'rgba(10,20,29,.85)'; ctx.lineWidth = .8;
    for (const side of [-1,1]) {
      const x = side * w * .11, y = -h * .13;
      ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x + Math.sin(angle) * w * .16,y - Math.cos(angle) * w * .16);ctx.stroke();
    }
  }
  if (v.health < 65 && !v.dead) {
    ctx.strokeStyle = 'rgba(18,22,29,.7)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(-w * .12, -h * .21); ctx.lineTo(w * .13, -h * .11); ctx.lineTo(-w * .07, -h * .04); ctx.stroke();
  }
  ctx.restore();
}

// Ground-only light streaks: samples exclude buildings, roofs and water.
export function drawWetReflections(G, r, night) {
  if (G.wet < .08 || night < .1) return;
  const ctx = G.ctx, low = G.settings.quality === 'low';
  const max = low ? 16 : G.settings.quality === 'med' ? 36 : 60;
  let count = 0;
  const emit = (x, y, rgb, strength, seed) => {
    if (x < r.x0 - 80 || x > r.x1 + 80 || y < r.y0 - 130 || y > r.y1 || count >= max) return;
    count++;
    const phase = G.settings.reducedMotion ? 0 : G.ticks / 60;
    const length = 55 + hash(seed) * 75, width = 18 + hash(seed + 3) * 15;
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    for (let j = 0; j < (low ? 6 : 12); j++) {
      const k = j / (low ? 6 : 12), yy = y + 9 + k * length;
      if (!['road', 'walk', 'lot', 'pier'].includes(G.surfaceAt(x, yy))) continue;
      const wave = Math.sin(phase * 1.6 + k * 18 + seed) * (2 + k * 3);
      const alpha = (1 - k) * G.wet * night * strength * (.4 + hash(seed + j) * .28);
      ctx.fillStyle = `rgba(${rgb},${alpha})`;
      ellipse(ctx, x + wave, yy, width * (1 - k * .65), 1.1 + hash(seed + j) * 1.8);
    }
    ctx.restore();
  };
  for (const l of G.meta.lights) emit(l.x, l.y, l.kind === 'neon' ? '255,65,167' : '255,204,128', .8, l.x * .3 + l.y);
  for (const v of G.vehicles) if (!v.dead) {
    const h = Math.cos(v.rot), s = Math.sin(v.rot);
    emit(v.x + s * 28, v.y - h * 28, '164,217,255', .8, v.x);
    if (v.cop) emit(v.x, v.y + 10, (G.ticks % 40 < 20) ? '255,55,90' : '55,139,255', 1, v.y);
  }
}

export function drawAtmosphere(G, r, night) {
  const ctx = G.ctx, low = G.settings.quality === 'low', t = G.settings.reducedMotion ? 0 : G.ticks / 60;
  // Steam stays anchored at selected street drains; only the wisps drift.
  if (!low) {
    const step = 320;
    for (let x = Math.floor(r.x0 / step) * step; x < r.x1; x += step) for (let y = Math.floor(r.y0 / step) * step; y < r.y1; y += step) {
      const seed = x * .13 + y * .71;
      if (hash(seed) > .28 || !['road', 'walk'].includes(G.surfaceAt(x, y))) continue;
      for (let i = 0; i < 3; i++) {
        const age = ((t * .25 + hash(seed + i) + i / 3) % 1);
        ctx.save(); ctx.globalAlpha = Math.sin(age * Math.PI) * (.045 + night * .04);
        ctx.fillStyle = '#a5c4d4'; ellipse(ctx, x + Math.sin(t + seed + i) * age * 11, y - age * 55, 7 + age * 17, 4 + age * 8); ctx.restore();
      }
    }
  }
  // Stable world-space rain ripples; no allocation or random flicker per frame.
  if (G.rainAmt > .15 && !G.settings.reducedMotion) {
    const step = low ? 180 : 95;
    ctx.save(); ctx.lineWidth = .8;
    for (let x = Math.floor(r.x0 / step) * step; x < r.x1; x += step) for (let y = Math.floor(r.y0 / step) * step; y < r.y1; y += step) {
      const seed = hash(x + y * 17), xx = x + seed * step, yy = y + hash(x * 3 + y) * step;
      if (!['road', 'lot', 'water', 'canal'].includes(G.surfaceAt(xx, yy))) continue;
      const age = (t * 1.1 + seed * 11) % 1;
      ctx.strokeStyle = `rgba(178,212,231,${(1 - age) * G.rainAmt * .28})`;
      ctx.beginPath(); ctx.ellipse(xx, yy, 1 + age * 10, .5 + age * 4, 0, 0, TAU); ctx.stroke();
    }
    ctx.restore();
  }
}

export function drawParticleFX(ctx, p) {
  const age = 1 - clamp(p.life / (p.maxLife || p.life || 1));
  ctx.save();
  if (p.kind === 'wake') {
    ctx.translate(p.x,p.y); ctx.rotate(p.rot || 0);
    const spread = 4 + age * (p.width || 26);
    ctx.globalAlpha = (1 - age) * .45 * (p.a ?? 1);
    ctx.strokeStyle = '#daf9ff'; ctx.lineWidth = 1.4 - age * .7;
    for (const side of [-1,1]) {
      ctx.beginPath(); ctx.moveTo(side * 3,0); ctx.quadraticCurveTo(side * spread * .65,5 + age * 7,side * spread, 12 + age * 16); ctx.stroke();
    }
    ctx.globalAlpha *= .45; ctx.strokeStyle = '#7cc5d4'; ctx.lineWidth = 3;
    ctx.beginPath();ctx.ellipse(0,10,spread*.7,4+age*7,0,0,TAU);ctx.stroke();
  } else if (p.kind === 'fire') {
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = (1 - age) * .8;
    const r=4+age*14;ctx.drawImage(LIGHT.radial('rgba(255,154,45,.95)',64),p.x-r,p.y-r*1.4,r*2,r*2.8);
    ctx.fillStyle='#fff1a3';ellipse(ctx,p.x,p.y,r*.18,r*.5*(1-age));
  } else if (p.kind === 'trail' || p.kind === 'boost') {
    ctx.globalCompositeOperation = 'lighter';ctx.globalAlpha = clamp(p.life*4)*(p.a??1);
    ctx.strokeStyle = p.col || (p.kind === 'trail' ? '#ff4676' : '#7df5ff');ctx.lineWidth = 2 + (1-age)*2;
    ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x-(p.vx||0)*.05,p.y-(p.vy||0)*.05);ctx.stroke();
    ctx.fillStyle = '#d7fbff';ellipse(ctx,p.x,p.y,1.3,1.3);
  } else if (p.kind === 'spark') {
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = clamp(p.life * 4);
    ctx.strokeStyle = '#ffd3a0'; ctx.lineWidth = 1.3;
    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - (p.vx || 0) * .035, p.y - (p.vy || 0) * .035); ctx.stroke();
    ctx.fillStyle = '#fff6d1'; ellipse(ctx, p.x, p.y, 1.6, 1.6);
  } else if (p.kind === 'smoke' || p.kind === 'dust') {
    const size = (p.kind === 'smoke' ? 6 : 3) + age * (p.kind === 'smoke' ? 22 : 14);
    ctx.globalAlpha = (1 - age) * .42 * (p.a ?? 1);
    const col=p.kind==='dust'?'178,151,111':p.dark?'34,39,48':'166,181,196';
    ctx.drawImage(LIGHT.radial(`rgba(${col},.65)`,64),p.x-size,p.y-size*.8,size*2,size*1.6);
  } else if (p.kind === 'boom') {
    ctx.globalCompositeOperation = 'lighter';
    const radius = (p.big ? 90 : 36) * age + 3;
    ctx.strokeStyle = `rgba(255,184,92,${(1 - age) * .8})`; ctx.lineWidth = 1 + (1 - age) * 5;
    ctx.beginPath(); ctx.arc(p.x, p.y, radius, 0, TAU); ctx.stroke();
    ctx.globalAlpha=(1-age)*.7;ctx.drawImage(LIGHT.radial('rgba(255,168,74,.95)',128),p.x-radius*1.2,p.y-radius*1.2,radius*2.4,radius*2.4);
  } else if (p.kind === 'footstep') {
    ctx.globalAlpha = (1 - age) * .2; ctx.strokeStyle = '#bbd5dd'; ctx.lineWidth = .7;
    ctx.beginPath(); ctx.ellipse(p.x, p.y, 2 + age * 8, 1 + age * 3, 0, 0, TAU); ctx.stroke();
  } else { ctx.restore(); return false; }
  ctx.restore(); return true;
}

export function drawGrade(G) {
  const ctx = G.ctx, {width:w,height:h} = G.canvas;
  const key = `${w}:${h}`;
  if (G._grade?.key !== key) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d');
    const v = x.createRadialGradient(w * .5, h * .44, h * .25, w * .5, h * .5, Math.max(w, h) * .65);
    v.addColorStop(0, 'rgba(6,12,25,0)'); v.addColorStop(.65, 'rgba(7,11,28,.06)'); v.addColorStop(1, 'rgba(3,6,18,.31)');
    x.fillStyle = v; x.fillRect(0,0,w,h); G._grade = { key, c };
  }
  ctx.save(); ctx.setTransform(1,0,0,1,0,0); ctx.drawImage(G._grade.c,0,0);
  ctx.restore();
}

export function drawArchitectureLights(G, r, night) {
  if (night < .1) return;
  const ctx = G.ctx, time = G.settings.reducedMotion ? 0 : G.ticks / 60;
  const buildings = G.bld.inView(r), D = 980 / Math.max(.45, G.cam.scale);
  let signs = 0;
  for (const b of buildings) {
    if (!['shop', 'loft', 'garage', 'office', 'casino'].includes(b.kind)) continue;
    const h = b.core ? Math.min(70, b.hgt || 24) : b.hgt;
    const k = h / D, rx = b.x + (b.x - G.cam.x) * k, ry = b.y + (b.y - G.cam.y) * k;
    const rw = b.w * (1 + k), rh = b.h * (1 + k);
    const color = b.kind === 'loft' ? '98,208,255' : b.kind === 'garage' ? '255,165,76' : b.kind === 'casino' ? '255,106,194' : ['60,219,232', '244,104,171', '255,193,106'][Math.floor(hash(b.seed) * 3)];
    ctx.save();
    // Corner strips give selected commercial buildings a clear silhouette.
    ctx.globalCompositeOperation = 'screen';
    ctx.strokeStyle = `rgba(${color},${night * .65})`; ctx.lineWidth = 1.6;
    if (b.kind !== 'office') {
      ctx.beginPath(); ctx.moveTo(rx + 5, ry + Math.min(38, rh * .25)); ctx.lineTo(rx + 5, ry + 5); ctx.lineTo(rx + Math.min(55, rw * .35), ry + 5); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(rx + rw - 5, ry + rh - Math.min(38, rh * .25)); ctx.lineTo(rx + rw - 5, ry + rh - 5); ctx.lineTo(rx + rw - Math.min(55, rw * .35), ry + rh - 5); ctx.stroke();
    }
    ctx.restore();
    if (b.kind === 'office' || b.kind === 'casino' || rw < 65 || rh < 55 || signs++ > (G.settings.quality === 'low' ? 5 : 15)) continue;
    const label = b.kind === 'loft' ? 'NEURAL' : b.kind === 'garage' ? 'CUSTOMS' : ['AFTER HOURS', 'OPEN 24', 'NIGHT MARKET', 'CROWN CLUB'][Math.floor(hash(b.seed + 1) * 4)];
    const sw = Math.min(rw - 16, 140), sh = 24, sx = rx + (rw - sw) / 2, sy = ry + rh - 36;
    ctx.save();
    const glow = ctx.createRadialGradient(sx + sw / 2, sy + 12, 3, sx + sw / 2, sy + 12, sw * .7);
    glow.addColorStop(0, `rgba(${color},${night * .22})`); glow.addColorStop(1, `rgba(${color},0)`);
    ctx.globalCompositeOperation = 'screen'; ctx.fillStyle = glow; ctx.fillRect(sx - sw * .3, sy - sw * .5, sw * 1.6, sw * 1.3);
    ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = '#101925'; ctx.fillRect(sx,sy,sw,sh);
    ctx.strokeStyle = `rgba(${color},${.3 + night * .65})`; ctx.lineWidth = 1; ctx.strokeRect(sx + 1,sy + 1,sw - 2,sh - 2);
    ctx.fillStyle = `rgb(${color})`; ctx.textAlign = 'center'; ctx.font = '700 10px system-ui, sans-serif';
    ctx.fillText(label, sx + sw / 2, sy + 16, sw - 10);
    // A slow travelling trim light, with no random flashing.
    const dot = (time * 12 + b.seed) % (sw - 8);
    ctx.fillStyle = '#e7fcff'; ctx.fillRect(sx + 4 + dot, sy + sh - 3, 4, 1);
    ctx.restore();
  }
}

export function drawObjectiveHalo(G, at, race) {
  const ctx = G.ctx, t = G.settings.reducedMotion ? 0 : G.ticks / 60;
  const radius = race ? 58 : 32;
  ctx.save(); ctx.translate(at.x, at.y);
  const g = ctx.createRadialGradient(0,0,2,0,0,radius * 1.6);
  g.addColorStop(0, 'rgba(255,213,117,.03)'); g.addColorStop(.6, 'rgba(255,213,117,.12)'); g.addColorStop(1,'rgba(255,213,117,0)');
  ctx.fillStyle = g; ellipse(ctx,0,0,radius * 1.6,radius * 1.6);
  ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(255,218,137,.7)'; ctx.beginPath(); ctx.arc(0,0,radius,0,TAU);ctx.stroke();
  ctx.lineWidth = 3;
  for(let i=0;i<4;i++) {
    const a=i*TAU/4+t*.45; ctx.strokeStyle='#ffe0a3'; ctx.beginPath(); ctx.arc(0,0,radius+5,a,a+.52);ctx.stroke();
  }
  if(race) {
    for(const side of [-1,1]) {
      ctx.fillStyle='#111d2b'; ctx.fillRect(side*radius-5,-15,10,30);
      ctx.fillStyle='#61eaff'; ctx.fillRect(side*radius-2,-13,4,26);
      ctx.fillStyle='rgba(97,234,255,.16)'; ellipse(ctx,side*radius,0,15,23);
    }
    ctx.fillStyle='#d8faff';ctx.font='700 11px system-ui, sans-serif';ctx.textAlign='center';
    ctx.fillText(G.race.i === G.race.pts.length-1 ? 'FINISH' : 'CHECKPOINT',0,-radius-13);
  } else {
    const y=-radius-12-Math.sin(t*2)*2;
    ctx.fillStyle='#ffe1a3';ctx.beginPath();ctx.moveTo(-5,y-4);ctx.lineTo(0,y+2);ctx.lineTo(5,y-4);ctx.closePath();ctx.fill();
  }
  ctx.restore();
}

export function drawSpeedometer(G, x, y, w, h) {
  const ctx=G.ctx,u=G.ui,v=G.player,speed=Math.hypot(v.vx,v.vy),ratio=clamp(speed/v.def.max);
  ctx.save();
  const bg=ctx.createLinearGradient(x,y,x+w,y+h);bg.addColorStop(0,'rgba(12,25,39,.94)');bg.addColorStop(1,'rgba(8,12,23,.88)');
  ctx.fillStyle=bg;ctx.fillRect(x,y,w,h);
  ctx.fillStyle='#64e4ed';ctx.fillRect(x,y,3*u,h);
  ctx.fillStyle='#effaff';ctx.font=`900 ${Math.round(25*u)}px ${"Inter, system-ui, sans-serif"}`;ctx.textAlign='left';
  const nautical=v.def.boat||v.def.aircraft;
  ctx.fillText(String(Math.round(speed*(nautical?.1944:.36))).padStart(2,'0'),x+12*u,y+30*u);
  ctx.fillStyle='#8da9bc';ctx.font=`700 ${Math.round(8*u)}px Inter, system-ui, sans-serif`;ctx.fillText(nautical?'KTS':'KM/H',x+13*u,y+42*u);
  ctx.textAlign='right';ctx.fillStyle='#e2c790';ctx.font=`700 ${Math.round(9*u)}px Inter, system-ui, sans-serif`;
  ctx.fillText(v.def.name.toUpperCase(),x+w-11*u,y+15*u,w-72*u);
  const bars=12,bw=(w-82*u)/bars;
  for(let i=0;i<bars;i++) {ctx.fillStyle=i/bars<ratio?(i>9?'#ff7b85':'#6bdae5'):'#263847';ctx.fillRect(x+70*u+i*bw,y+25*u,Math.max(1,bw-2*u),7*u);}
  const health=clamp((v.health??100)/100);
  ctx.fillStyle='#263847';ctx.fillRect(x+70*u,y+39*u,w-82*u,2*u);
  ctx.fillStyle=health>.4?'#86cbb8':'#ff8d75';ctx.fillRect(x+70*u,y+39*u,(w-82*u)*health,2*u);
  ctx.restore();
}
