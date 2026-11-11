/* Living streets: local decisions run at 8 Hz; movement remains frame-rate independent.
 * begin(dt) before traffic.tick(), steerPed(p,dt) after existing hurt/flee handling,
 * trafficSpeed(v,want) before traffic integrates speed. No rendering dependency.
 */
const TAU = Math.PI * 2;
const SAFE = new Set(['walk', 'lot', 'pier', 'grass', 'sand', 'dirt']);
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const angle = n => ((n + Math.PI) % TAU + TAU) % TAU - Math.PI;
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

/** Buckets use floor, including negative coordinates, and queries cover their full radius. */
export function createStreetIndex(size = 160) {
  const cells = new Map();
  return {
    rebuild(items) {
      cells.clear();
      for (const item of items) {
        if (item.dead || !Number.isFinite(item.x) || !Number.isFinite(item.y)) continue;
        const key = `${Math.floor(item.x / size)},${Math.floor(item.y / size)}`;
        if (!cells.has(key)) cells.set(key, []);
        cells.get(key).push(item);
      }
    },
    query(x, y, radius, visit) {
      const r2 = radius * radius;
      for (let ix = Math.floor((x - radius) / size); ix <= Math.floor((x + radius) / size); ix++) {
        for (let iy = Math.floor((y - radius) / size); iy <= Math.floor((y + radius) / size); iy++) {
          for (const item of cells.get(`${ix},${iy}`) || []) {
            if ((item.x - x) ** 2 + (item.y - y) ** 2 <= r2) visit(item);
          }
        }
      }
    },
  };
}

export function createCityAI(G) {
  const people = createStreetIndex(), cars = createStreetIndex(), places = createStreetIndex(256);
  let brains = new WeakMap(), drivers = new WeakMap();
  const reservations = new Map(), events = [];
  let clock = 0, refresh = 0, serial = 0, fixtureSource = null;
  const stats = { decisions: 0, reactions: 0, conversations: 0, visits: 0, boarded: 0, indexBuilds: 0 };
  const rng = brain => {
    brain.seed = (Math.imul(brain.seed, 1664525) + 1013904223) >>> 0;
    return brain.seed / 4294967296;
  };
  function brain(p) {
    let b = brains.get(p);
    if (!b) {
      b = { seed: (++serial * 2654435761) >>> 0, mode: 'walk', next: clock,
        socialAt: clock + 1 + serial % 4, goal: null, until: 0, blocked: 0, partner: null, fixture: null };
      brains.set(p, b);
      // The same public state can drive cup, bag, conversation and waiting poses.
      p.cityState = b;
      if (p.gather) { b.goal = { ...p.gather }; b.mode = 'visit'; b.until = clock + 6 + rng(b) * 8; p.gather = null; }
    }
    return b;
  }
  function safe(x, y, radius = 7) {
    if (!SAFE.has(G.surfaceAt(x, y))) return false;
    if (!G.solidAt) return true;
    return !G.solidAt(x, y) && !G.solidAt(x - radius, y) && !G.solidAt(x + radius, y)
      && !G.solidAt(x, y - radius) && !G.solidAt(x, y + radius);
  }
  function pathClear(a, b) {
    const steps = Math.max(1, Math.ceil(distance(a, b) / 16));
    for (let i = 1; i <= steps; i++) if (!safe(a.x + (b.x - a.x) * i / steps, a.y + (b.y - a.y) * i / steps)) return false;
    return true;
  }
  const visible = (a, b) => !G.nav?.clearLine || G.nav.clearLine(a.x, a.y, b.x, b.y);
  function release(p, b) {
    if (b.fixture) {
      const guests = reservations.get(b.fixture);
      guests?.delete(p);
      if (!guests?.size) reservations.delete(b.fixture);
    }
    const other = b.partner && brains.get(b.partner);
    if (other?.partner === p) {
      other.partner = null; other.mode = 'walk'; other.until = 0; other.next = clock + 1;
    }
    b.partner = null; b.goal = null; b.fixture = null; b.mode = 'walk'; b.blocked = 0;
    p.cityActivity = null;
  }
  function alarm(p, source, duration) {
    const b = brain(p);
    release(p, b);
    p.flee = Math.max(p.flee || 0, duration); p.threatX = source.x; p.threatY = source.y;
    b.next = clock + duration + 1; b.socialAt = clock + duration + 4;
    stats.reactions++;
  }
  function react(p) {
    if (p.dead || p.copPed || p.mission || p.dive > 0) return;
    for (const event of events) {
      if (event.until > clock && distance(p, event) < event.radius && visible(p, event)) {
        if (!(p.flee > 1)) alarm(p, event, event.kind === 'horn' ? 1.2 : 4);
        return;
      }
    }
    cars.query(p.x, p.y, 250, v => {
      if (p.dive > 0 || v.dead) return;
      const vx = v.vx || 0, vy = v.vy || 0, speed2 = vx * vx + vy * vy;
      const dx = p.x - v.x, dy = p.y - v.y;
      if (v.siren && dx * dx + dy * dy < 125 ** 2 && !(p.flee > 0.7) && visible(p, v)) {
        alarm(p, v, 1.8);
      }
      if (speed2 < 55 ** 2) return;
      const t = (dx * vx + dy * vy) / speed2;
      if (t <= 0 || t > 0.85) return;
      const missX = dx - vx * t, missY = dy - vy * t;
      if (missX * missX + missY * missY > ((v.r || 24) * 0.65 + 10) ** 2 || !visible(p, v)) return;
      alarm(p, v, 3);
      const speed = Math.sqrt(speed2), side = dx * vy - dy * vx >= 0 ? 1 : -1;
      // Pick a genuinely safe escape side; never dive through a wall or into water.
      for (const sign of [side, -side]) {
        const ax = vy / speed * sign, ay = -vx / speed * sign;
        if (pathClear(p, { x: p.x + ax * 34, y: p.y + ay * 34 })) {
          p.dive = 0.42; p.vx = ax * 150; p.vy = ay * 150; p.rot = Math.atan2(ax, -ay); break;
        }
      }
    });
  }
  function pickVisit(p, b) {
    let chosen = null, best = Infinity;
    places.query(p.x, p.y, 420, f => {
      if (f.kind === 4 || f === b.lastFixture) return;
      const occupied = [...(reservations.get(f) || [])].map(other => brains.get(other)?.slot);
      if (occupied.length >= 3) return;
      let slot = 0; while (occupied.includes(slot)) slot++;
      const rot = f.rot || 0, offset = (slot - 1) * 23;
      const goal = { x: f.x + Math.cos(rot) * offset - Math.sin(rot) * 36,
        y: f.y + Math.sin(rot) * offset + Math.cos(rot) * 36 };
      const score = distance(p, goal) + rng(b) * 110;
      if (score < best && pathClear(p, goal)) { chosen = { f, goal, slot }; best = score; }
    });
    if (!chosen) return false;
    b.fixture = chosen.f; b.goal = chosen.goal; b.slot = chosen.slot; b.mode = 'visit';
    if (!reservations.has(chosen.f)) reservations.set(chosen.f, new Set());
    reservations.get(chosen.f).add(p);
    b.until = clock + 22; b.blocked = 0; stats.visits++;
    return true;
  }
  function decide(p, b) {
    stats.decisions++;
    b.next = clock + 0.4 + rng(b) * 0.25;
    if (b.mode === 'talk' && (!b.partner || b.partner.dead || b.partner.flee > 0 || clock > b.until || distance(p, b.partner) > 95)) release(p, b);
    if (b.mode === 'pause' && clock > b.until) {
      b.lastFixture = b.fixture; release(p, b); b.next = clock + 5 + rng(b) * 5;
      p.hx = Math.sin(p.rot) > 0 ? 1 : -1; p.hy = 0;
      return;
    }
    if (b.mode === 'visit' && clock > b.until) release(p, b);
    if (b.mode !== 'walk' || p.crossing || !safe(p.x, p.y)) return;
    if (clock > b.socialAt) {
      b.socialAt = clock + 8 + rng(b) * 10;
      let partner = null;
      people.query(p.x, p.y, 50, other => {
        if (partner || other === p || other.copPed || other.mission || other.flee > 0 || other.crossing || other.dead) return;
        const ob = brain(other);
        if (ob.mode === 'walk' && distance(p, other) > 17 && pathClear(p, other)) partner = other;
      });
      if (partner && rng(b) < 0.5) {
        const ob = brain(partner), until = clock + 3 + rng(b) * 4;
        for (const [a, ab, other] of [[p, b, partner], [partner, ob, p]]) {
          ab.mode = 'talk'; ab.partner = other; ab.until = until; ab.socialAt = until + 18;
          a.cityActivity = 'conversation';
        }
        stats.conversations++; return;
      }
    }
    if (rng(b) < 0.3) pickVisit(p, b);
  }

  const api = {
    stats,
    reset() {
      // Reservations and conversation partners must not survive an actor reset.
      for(const p of G.peds||[]){p.cityState=null;p.cityActivity=null;p.cityBoarded=false;p.flee=0;p.dive=0;p.threatX=p.threatY=undefined;}
      brains=new WeakMap();drivers=new WeakMap();reservations.clear();events.length=0;
      people.rebuild([]);cars.rebuild([]);refresh=0;
    },
    emit(kind, x, y, options = {}) {
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      events.push({ kind, x, y, radius: options.radius ?? (kind === 'horn' ? 90 : 260), until: clock + (options.duration ?? 1.5) });
      if (events.length > 16) events.shift();
      refresh = 0;
    },
    begin(dt) {
      clock += clamp(dt, 0, 0.25); refresh -= dt;
      if (refresh > 0) return;
      refresh = G.settings?.quality === 'low' ? 0.18 : 0.12;
      for (let i = events.length - 1; i >= 0; i--) if (events[i].until <= clock) events.splice(i, 1);
      const focus = G.cam || G.player;
      const alive = new Set((G.peds || []).filter(p => !p.dead));
      for (const [fixture, guests] of reservations) {
        for (const p of guests) if (!alive.has(p)) guests.delete(p);
        if (!guests.size) reservations.delete(fixture);
      }
      const local = (G.peds || []).filter(p => Math.abs(p.x - focus.x) < 1550 && Math.abs(p.y - focus.y) < 1300);
      people.rebuild(local);
      cars.rebuild((G.vehicles || []).concat(G.player?.type === 'veh' && !G.vehicles?.includes(G.player) ? [G.player] : []).filter(v=>!v.def?.boat&&!(v.def?.aircraft&&v.altitude>10)&&Math.abs(v.x-focus.x)<1750&&Math.abs(v.y-focus.y)<1500));
      if (fixtureSource !== G.street?.fixtures) { fixtureSource = G.street?.fixtures; places.rebuild(fixtureSource || []); }
      stats.indexBuilds++;
      for (const p of local) react(p);
      // Waiting passengers board only a stopped bus beside their actual shelter.
      for (const p of local) {
        const b = brains.get(p);
        if (p.dead || p.flee > 0 || p.mission || !p.ambient || b?.mode !== 'pause' || b.fixture?.kind !== 2) continue;
        cars.query(p.x, p.y, 115, v => {
          const d = drivers.get(v);
          if (v.kind === 'bus' && d?.stop === b.fixture && d.until > clock && Math.hypot(v.vx || 0, v.vy || 0) < 8 && !p.cityBoarded) {
            p.cityBoarded = true; v.cityPassengers = (v.cityPassengers || 0) + 1; stats.boarded++;
            release(p, b);
          }
        });
      }
      if (local.some(p => p.cityBoarded)) G.peds = G.peds.filter(p => !p.cityBoarded);
    },
    steerPed(p, dt) {
      if (p.dead || p.copPed || p.mission || p.flee > 0 || p.dive > 0) return false;
      const b = brain(p);
      if (clock >= b.next) decide(p, b);
      if (b.mode === 'walk') return false;
      if (b.mode === 'talk' || b.mode === 'pause') {
        p.speed = 0; p.vx = p.vy = 0; p.onRoad = false;
        const target = b.partner || b.fixture;
        if (target) p.rot += angle(Math.atan2(target.x - p.x, -(target.y - p.y)) - p.rot) * Math.min(1, dt * 5);
        return true;
      }
      if (!b.goal) { release(p, b); return false; }
      if (distance(p, b.goal) < 9) {
        b.mode = 'pause'; b.until = clock + (b.fixture?.kind === 2 ? 18 : 4 + rng(b) * 7);
        p.cityActivity = ['coffee', 'shopping', 'bus', 'rest', 'delivery', 'news'][b.fixture?.kind] || 'rest';
        p.speed = 0; return true;
      }
      const wanted = Math.atan2(b.goal.x - p.x, -(b.goal.y - p.y)), speed = p.walk || 32;
      let moved = false;
      for (const turn of [0, 0.5, -0.5, 1, -1]) {
        const rot = wanted + turn, step = Math.min(speed * Math.min(dt, 0.1), distance(p, b.goal));
        const x = p.x + Math.sin(rot) * step, y = p.y - Math.cos(rot) * step;
        if (!safe(x, y) || !safe(p.x + Math.sin(rot) * 16, p.y - Math.cos(rot) * 16)) continue;
        p.x = x; p.y = y; p.rot += angle(rot - p.rot) * Math.min(1, dt * 9);
        p.speed = speed; p.dist = (p.dist || 0) + step; p.onRoad = false; moved = true; break;
      }
      b.blocked = moved ? 0 : b.blocked + dt;
      if (!moved) p.speed = 0;
      if (b.blocked > 1.2) { b.lastFixture = b.fixture; release(p, b); b.next = clock + 4; }
      return true;
    },
    trafficSpeed(v, want) {
      if (!v.traffic || v === G.player || v.siren || v.dead) return want;
      let d = drivers.get(v);
      if (!d) { d = { next: 0, cap: Infinity, until: 0, cooldown: 0, stop: null }; drivers.set(v, d); }
      if (clock < d.until) return 0;
      if (clock < d.next) return Math.min(want, d.cap);
      d.next = clock + 0.12; d.cap = Infinity;
      const hx = Math.sin(v.rot), hy = -Math.cos(v.rot);
      people.query(v.x, v.y, 145, p => {
        if (p.dead || p.cityBoarded) return;
        const dx = p.x - v.x, dy = p.y - v.y, ahead = dx * hx + dy * hy;
        if (ahead > 0 && ahead < 140 && Math.abs(dx * hy - dy * hx) < (v.r || 24) + 12) {
          d.cap = Math.min(d.cap, Math.max(0, (ahead - 48) * 1.25));
        }
      });
      cars.query(v.x, v.y, 230, other => {
        if (other === v || !other.siren) return;
        const along = (other.x - v.x) * hx + (other.y - v.y) * hy;
        const side = Math.abs((other.x - v.x) * hy - (other.y - v.y) * hx);
        if (along > -190 && along < 80 && side < 85) d.cap = Math.min(d.cap, 20);
      });
      if (v.kind === 'bus' && clock > d.cooldown) {
        places.query(v.x, v.y, 100, f => {
          if (f.kind !== 2 || clock < d.until || Math.abs((f.x - v.x) * hx + (f.y - v.y) * hy) > 32) return;
          d.stop = f; d.until = clock + 4; d.cooldown = clock + 35; d.cap = 0;
        });
      }
      return Math.min(want, d.cap);
    },
  };
  return api;
}
