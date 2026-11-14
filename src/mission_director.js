import {MISSIONS} from './story.js';
import {scoreMission,recordBest,cleanScores,storyTotals} from './story_score.js';
/* Optional crew guidance and job quality. Completion rewards belong to this module;
 * finishJob applies them once. Call recordIncident only at player-attributed sources.
 */
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const number = (n, fallback = 0, max = 1e7) => Number.isFinite(n) ? clamp(n, 0, max) : fallback;
const integer = (n, fallback = 0, max = 1e7) => Math.floor(number(n, fallback, max));
const sample = new WeakMap();
const CONDITIONS = Object.freeze({
  neighbors: Object.freeze({ id: 'neighbors', title: 'People before profit', description: 'Finish without hurting a civilian or getting wasted or busted.', reward: 150 }),
  wheels: Object.freeze({ id: 'wheels', title: 'Keep it straight', description: 'Drive 400 metres without causing a damaging collision.', reward: 200 }),
  measured: Object.freeze({ id: 'measured', title: 'Controlled force', description: 'Complete the interception using six shots or fewer.', reward: 175 }),
  ghost: Object.freeze({ id: 'ghost', title: 'Leave no face', description: 'Do not fire a weapon or let Palace security identify you.', reward: 250 }),
});
const JOBS = [
  ['COLD WALLET', 'HUNTER', 'The convoy carries the key to the Palace debt archive. Get the van open and bring that key home.', 'The convoy is the target. The pavement belongs to everybody.', ['neighbors', 'measured']],
  ['BURNING BRIDGES', 'FIRE', 'Win a full lap at Crown Grand Prix and earn Fire’s Palace service route. Every numbered gate counts.', 'Brake before the bend. You cannot spend a wrecked engine.', ['neighbors', 'wheels']],
  ['DEAD AIR', 'NEURAL', 'A Metro scrambler can hide the archive transfer. Settle my fee, lift the unit, and lose your tail.', 'Take the hardware. Leave the precinct’s people standing.', ['neighbors', 'wheels']],
  ['THE INSIDE LINE', 'MASK', 'Read the south doors, learn the lot, and trace the water exit. A good escape starts before the alarm.', 'Walk like you belong here. Running past a uniform invites a second look.', ['neighbors', 'ghost']],
  ['HOUSE OF GLASS', 'NEURAL', 'The Palace archive names the people Gold Mage erased. Hold the transfer, reach the marina, get it offshore.', 'Quiet buys ninety seconds with the scrambler. Loud buys five stars.', ['neighbors', 'ghost']],
  ['EXIT WOUNDS', 'VERA VALE', 'The Nyx is waiting at the marina. Carry the archive beyond the city and shake the last pursuit.', 'Give me the evidence and a clear signal. Crown City can do the rest.', ['neighbors', 'wheels']],
].map(([title, contact, story, tip, ids], index) => Object.freeze({ index, title:MISSIONS[index].title, contact, story, tip,
  challenge: ids.map(id => CONDITIONS[id].description).join(' '),
  bonusLabel: `UP TO +${ids.reduce((sum, id) => sum + CONDITIONS[id].reward, 0)} CHIPS`,
  challenges: Object.freeze(ids.map(id => CONDITIONS[id])) }));
Object.freeze(JOBS);

const GUIDANCE = [
  { enter_car: ['HUNTER', 'Riot is on the lot. Get close and enter; save your bullets for the van.'],
    hit_van: ['HUNTER', 'Put the convoy engine out. Ram it or shoot until the engine gives out. Keep the sidewalk clear.'],
    grab: ['HUNTER', 'Engine is done. Stop beside the van, then interact to take the sealed archive key.'],
    lose_heat: ['MASK', 'Turn out of their sight. A building between you and Metro is worth more than another mile.'],
    stash: ['HUNTER', 'Bring the key into the garage. Next we find a way into the Palace.'] },
  { to_track: ['FIRE', 'Meet me at the Crown Grand Prix pit desk, south of the river. The lights give you three seconds to get straight.'],
    race: ['FIRE', 'One full lap, every gold gate. Ease off before the corner and drive out of it.'] },
  { pay: ['NEURAL', 'Come to the loft. If you took credit, the six hundred comes from the archive cut.'],
    lift: ['NEURAL', 'The unit is beside Metro. Lift it on foot with interact, or take a cruiser. Your call.'],
    back: ['NEURAL', 'Lose the stars before you bring that thing to my door. I like my windows intact.'] },
  { case: ['MASK', 'On foot. Hold still at the south doors for two seconds. Watch the entrance, not your weapon.'],
    lot: ['MASK', 'Now the lot. Two quiet seconds to read the exit. Walk past uniforms; sprint once you are clear.'],
    exit: ['HUNTER', 'Trace the road to the marina now. When the alarm goes, you will already know the turns.'] },
  { door: ['MASK', 'South entrance. The badge works better when you act like you have used it before.'],
    vault: ['NEURAL', 'Interact with the archive, then stay still for three seconds. Moving or firing cuts the transfer.'],
    marina: ['HUNTER', 'Archive secured. Follow the marina route. Keep the car moving and the pavement clear.'],
    boat: ['HUNTER', 'Your launch is tied up at the water. Get out, walk to it, then enter.'],
    island: ['NEURAL', 'Make the island drop. Keep the bow clear of the piers; the water is your exit.'] },
  { return: ['VERA VALE', 'Back to the marina. Hunter left the Nyx there with the engine ready.'],
    getaway: ['HUNTER', 'Take the Nyx. Use the brakes; all that power still has to make the corner.'],
    highway: ['VERA VALE', 'East highway. Get the archive beyond Gold Mage’s cameras. I am keeping the line open.'],
    survive: ['MASK', 'Last tail. Break their sight, change streets, and let the search run cold.'] },
];

export function jobBrief(index) { return JOBS[index] || null; }

function metrics(s = {}) {
  return { elapsed: number(s.elapsed, 0, 86400), distance: number(s.distance), drivingTime: number(s.drivingTime, 0, 86400),
    shots: integer(s.shots), civilianHarm: integer(s.civilianHarm), collisions: integer(s.collisions), deaths: integer(s.deaths),
    damage: number(s.damage), peakHeat: integer(s.peakHeat, 0, 5), spotted: s.spotted === true,
    hits: integer(s.hits), nearMiss: integer(s.nearMiss), drift: number(s.drift, 0, 86400) };
}
function cleanDebrief(s) {
  if (!s || !Number.isInteger(s.job) || !JOBS[s.job]) return null;
  const earned = JOBS[s.job].challenges.filter(c => Array.isArray(s.earned) && s.earned.includes(c.id)).map(c => c.id);
  return decorate({ job: s.job, title: JOBS[s.job].title, won: s.won === true, attempt: integer(s.attempt, 1),
    ...metrics(s), earned: s.won === true ? earned : [],
    bonus: s.won === true ? integer(s.bonus, 0, JOBS[s.job].challenges.filter(c => earned.includes(c.id)).reduce((sum, c) => sum + c.reward, 0)) : 0,
    approach: s.approach === 'loud' ? 'loud' : 'quiet' });
}
function decorate(entry) {
  const minutes = Math.floor(entry.elapsed / 60), seconds = Math.floor(entry.elapsed % 60).toString().padStart(2, '0');
  return { ...entry, index: entry.job, grade: !entry.won ? 'RETRY' : entry.earned.length === JOBS[entry.job].challenges.length ? 'CLEAN' : entry.earned.length ? 'COMPLETE' : 'ROUGH',
    summary: `${minutes}:${seconds} · ${entry.shots} shots · ${entry.civilianHarm} civilian hits · +${entry.bonus} chips` };
}
export function directorState(saved = {}) {
  if (!saved || typeof saved !== 'object') saved = {};
  const active = saved.active && Number.isInteger(saved.active.job) && JOBS[saved.active.job]
    ? { job: saved.active.job, attempt: integer(saved.active.attempt, 1), ...metrics(saved.active),
      lastObjective: typeof saved.active.lastObjective === 'string' ? saved.active.lastObjective.slice(0, 80) : '',
      approach: saved.active.approach === 'loud' ? 'loud' : 'quiet' } : null;
  return { version: 1, active, attempt: integer(saved.attempt),
    claimed: [...new Set((Array.isArray(saved.claimed) ? saved.claimed : []).filter(i => Number.isInteger(i) && JOBS[i]))],
    journal: (Array.isArray(saved.journal) ? saved.journal : []).slice(-16).map(cleanDebrief).filter(Boolean),
    last: cleanDebrief(saved.last), suspicion: number(saved.suspicion, 0, 1), guidance: null,
    scores: cleanScores(saved.scores), bestTotal: number(saved.bestTotal, 0, 1e7),
    get history() { return this.journal; } };
}
export function directorSave(D) {
  const clean = directorState(D);
  return { version: 1, active: clean.active, attempt: clean.attempt, claimed: clean.claimed,
    journal: clean.journal, last: clean.last, suspicion: clean.suspicion, scores: clean.scores, bestTotal: clean.bestTotal };
}
function state(G) { return G.director || (G.director = directorState()); }
function baseline(G, D) {
  const p = G.player || {};
  const b = { hits: number(G.shotsHit), missT: 0, combo: 0, comboT: 0, shots: number(G.shotsFired), health: number(G.health, 100, 100), vehicle: p,
    vehicleHealth: number(p.health, 100, 100), x: p.x, y: p.y, recentShot: 0, warning: false };
  sample.set(D, b); return b;
}
export function beginJob(G) {
  const D = state(G), job = G.missionIndex;
  if (G.freeRoam || !JOBS[job]) { D.active = null; return null; }
  // Resuming the same attempt must not erase incidents or reset the clock.
  if (D.active?.job === job) { if (!sample.has(D)) baseline(G, D); return D.active; }
  D.attempt++; D.suspicion = 0; D.guidance = null;
  D.active = { job, attempt: D.attempt, ...metrics(), lastObjective: '', approach: G.flags?.heist === 'loud' ? 'loud' : 'quiet' };
  baseline(G, D); return D.active;
}
export function recordIncident(G, kind, amount = 1) {
  const A = state(G).active;
  if (!A || A.job !== G.missionIndex) return false;
  const value = Math.ceil(number(amount, 0, 1000)); if (!value) return false;
  if (kind === 'civilian_harm') A.civilianHarm += value;
  else if (kind === 'collision') A.collisions += value;
  else if (kind === 'death') A.deaths += value;
  else if (kind === 'spotted') A.spotted = true;
  else return false;
  return true;
}
function observe(G, D, dt) {
  const A = D.active, p = G.player || {}, b = sample.get(D) || baseline(G, D);
  const shots = number(G.shotsFired), fired = Math.max(0, shots - b.shots); b.shots = shots;
  A.shots += fired; b.recentShot = fired ? 1.5 : Math.max(0, b.recentShot - dt);
  const health = number(G.health, 100, 100);
  A.damage += Math.max(0, b.health - health); b.health = health;
  const sameVehicle = b.vehicle === p, vehicleHealth = number(p.health, 100, 100);
  if (sameVehicle && p.type === 'veh') A.damage += Math.max(0, b.vehicleHealth - vehicleHealth);
  const step = sameVehicle ? Math.hypot(p.x - b.x, p.y - b.y) : 0;
  const speed = Math.hypot(p.vx || 0, p.vy || 0);
  // Count measured continuous motion only; entering cars, respawns and teleport jumps earn no distance.
  if (dt > 0 && p.type === 'veh' && !p.def?.boat && !p.def?.aircraft && speed > 20 && step > 0 && step <= speed * dt * 1.6 + 4) {
    A.distance += step; A.drivingTime += dt;
  }
  const hits = number(G.shotsHit); A.hits += Math.max(0, hits - (b.hits ?? hits)); b.hits = hits;
  // stunts: drifting (sideways slip at speed) and near misses past traffic
  if (dt > 0 && p.type === 'veh' && !p.def?.boat && !p.def?.aircraft && speed > 150) {
    const side = Math.abs((p.vx || 0) * Math.cos(p.rot || 0) + (p.vy || 0) * Math.sin(p.rot || 0));
    if (side > speed * .38) { A.drift += dt; b.driftT = (b.driftT || 0) + dt; if (b.driftT > 1) { b.driftT = 0; pop(G, b, 20, 'DRIFT'); } } else b.driftT = 0;
    b.missT = Math.max(0, (b.missT || 0) - dt);
    if (b.missT <= 0) for (const v of G.vehicles || []) { if (v === p || v.dead || !v.traffic) continue; const d = Math.hypot(v.x - p.x, v.y - p.y);
      if (d < 52 && d > 30 && !(p.impactT > 0)) { A.nearMiss++; b.missT = .8; pop(G, b, 50, 'NEAR MISS'); break; } }
  }
  b.comboT = Math.max(0, (b.comboT || 0) - dt); if (!b.comboT) b.combo = 0;
  b.vehicle = p; b.vehicleHealth = vehicleHealth; b.x = p.x; b.y = p.y;
  A.peakHeat = Math.max(A.peakHeat, integer(G.wanted, 0, 5));
  return b;
}
function pop(G, b, pts, label) { b.combo = b.comboT > 0 ? b.combo + 1 : 1; b.comboT = 2.5; G.scorePop = { pts, label, combo: b.combo, t: 1.2 }; }
function security(G, D, b, dt) {
  const A = D.active, p = G.player, at = G.meta?.interactions?.casinoDoor;
  if ((A.job !== 3 && A.job !== 4) || A.approach !== 'quiet' || G.objectiveIndex > 1 || !at || !p) { D.suspicion = 0; return null; }
  const close = Math.hypot(p.x - at[0], p.y - at[1]) < 440;
  const conspicuous = b.recentShot > 0 || G.wanted > 0 || (p.type === 'foot' ? p.speed > 85 : Math.hypot(p.vx || 0, p.vy || 0) > 70);
  let seen = false;
  if (close && conspicuous && G.nav?.clearLine) {
    guards: for (const group of [G.cops, G.peds]) for (const guard of group || []) {
      if (group === G.peds && !guard.copPed) continue;
      if (guard.dead) continue;
      const dx = p.x - guard.x, dy = p.y - guard.y, dist = Math.hypot(dx, dy);
      if (dist > 220) continue;
      const facing = (dx * Math.sin(guard.rot || 0) - dy * Math.cos(guard.rot || 0)) / Math.max(1, dist);
      if (facing > 0.25 && G.nav.clearLine(guard.x, guard.y, p.x, p.y)) { seen = true; break guards; }
    }
  }
  D.suspicion = clamp(D.suspicion + dt * (seen ? 0.34 : -0.23), 0, 1);
  if (D.suspicion >= 1 && !A.spotted) {
    A.spotted = true;
    return { name: 'MASK', text: 'They have your face. The route is still open. Break their sight and keep the archive moving.' };
  }
  if (D.suspicion > 0.45 && !b.warning) {
    b.warning = true;
    return { name: 'MASK', text: 'That uniform is watching you. Slow to a walk or put a wall between you.' };
  }
  return null;
}
export function tickDirector(G, dt) {
  if (G.scene !== 'play' || G.freeRoam || !JOBS[G.missionIndex]) return null;
  const D = state(G); if (!D.active || D.active.job !== G.missionIndex) beginJob(G);
  dt = number(dt, 0, 0.25);
  D.active.elapsed += dt;
  const b = observe(G, D, dt), alert = security(G, D, b, dt);
  const objective = G._flow?.objectives?.[G.objectiveIndex];
  const key = `${G.missionIndex}:${objective?.id || G.objectiveIndex}`;
  const words = GUIDANCE[G.missionIndex]?.[objective?.id];
  if (D.guidance?.key !== key) D.guidance = words ? { name: words[0], text: words[1], key } : null;
  if (D.active.lastObjective !== key) {
    D.active.lastObjective = key;
    return alert || D.guidance;
  }
  return alert;
}
function qualifies(id, A) {
  if (A.elapsed < 10 || A.deaths > 0) return false;
  if (id === 'neighbors') return A.civilianHarm === 0;
  if (id === 'wheels') return A.distance >= 4000 && A.drivingTime >= 8 && A.collisions === 0;
  if (id === 'measured') return A.shots <= 6 && A.civilianHarm === 0;
  if (id === 'ghost') return A.approach === 'quiet' && A.shots === 0 && !A.spotted && A.civilianHarm === 0;
  return false;
}
export function challengeProgress(G) {
  const A = G.director?.active, brief = jobBrief(G.missionIndex);
  if (!A || !brief) return [];
  return brief.challenges.map(c => ({ ...c, failed: A.deaths > 0 ||
    (c.id === 'neighbors' && A.civilianHarm > 0) || (c.id === 'wheels' && A.collisions > 0) ||
    (c.id === 'measured' && (A.shots > 6 || A.civilianHarm > 0)) ||
    (c.id === 'ghost' && (A.approach !== 'quiet' || A.shots > 0 || A.spotted || A.civilianHarm > 0)),
    progress: c.id === 'wheels' ? Math.min(1, A.distance / 4000, A.drivingTime / 8) : 1 }));
}
export function finishJob(G, won) {
  const D = state(G), A = D.active;
  if (!A || A.job !== G.missionIndex) return D.last ? { ...D.last, bonus: 0, paid: false } : null;
  observe(G, D, 0);
  const brief = JOBS[A.job], claimed = D.claimed.includes(A.job);
  const earned = won ? brief.challenges.filter(c => qualifies(c.id, A)).map(c => c.id) : [];
  const bonus = won && !claimed ? brief.challenges.filter(c => earned.includes(c.id)).reduce((sum, c) => sum + c.reward, 0) : 0;
  const result = decorate({ job: A.job, attempt: A.attempt, title: brief.title, won: !!won, ...metrics(A),
    approach: A.approach, earned, bonus });
  if (won && !claimed) { D.claimed.push(A.job); G.chips = number(G.chips, 0, 1e9) + bonus; }
  if (won) { const score = scoreMission(A, A.job), best = recordBest(D, A.job, score); result.score = score; result.newBest = best;
    const tot = storyTotals(D, JOBS.length).total; D.bestTotal = Math.max(number(D.bestTotal, 0, 1e7), tot); }
  D.journal.push(result); D.journal = D.journal.slice(-16); D.last = result; D.active = null; D.suspicion = 0;
  return { ...result, paid: won && !claimed };
}
