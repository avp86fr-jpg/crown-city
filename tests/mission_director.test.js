import { test } from 'node:test';
import assert from 'node:assert/strict';
import { directorState, directorSave, beginJob, tickDirector, finishJob, recordIncident, jobBrief, challengeProgress } from '../src/mission_director.js';

function game(index = 1, extra = {}) {
  return { director: directorState(), missionIndex: index, objectiveIndex: 0, scene: 'play', chips: 400,
    health: 100, shotsFired: 0, wanted: 0, flags: { heist: 'quiet' },
    player: { x: 0, y: 0, type: 'veh', health: 100, vx: 400, vy: 0, def: {} },
    _flow: { objectives: [{ id: 'to_track' }, { id: 'race' }] }, peds: [], cops: [], ...extra };
}
function drive(G, seconds = 12) {
  for (let i = 0; i < seconds * 10; i++) {
    G.player.x += (G.player.vx || 0) * 0.1;
    G.player.y += (G.player.vy || 0) * 0.1;
    tickDirector(G, 0.1);
  }
}

test('all six job briefs contain fixed original guidance and immutable bonus definitions', () => {
  for (let i = 0; i < 6; i++) {
    const brief = jobBrief(i); assert.ok(brief.story.length > 40); assert.ok(brief.tip);
    assert.equal(brief.challenges.length, 2); assert.match(brief.bonusLabel, /^UP TO \+\d+ CHIPS$/);
    assert.ok(Object.isFrozen(brief.challenges[0])); assert.ok(brief.challenge.length > 20);
  }
  assert.equal(jobBrief(6), null);
});

test('objective guidance fires once per objective and remains available after restore', () => {
  const G = game(); beginJob(G);
  assert.equal(tickDirector(G, 0.1).name, 'FIRE'); assert.equal(tickDirector(G, 0.1), null);
  G.objectiveIndex = 1; assert.match(tickDirector(G, 0.1).text, /One full lap/);
  G.director = directorState(directorSave(G.director)); beginJob(G);
  assert.equal(tickDirector(G, 0.1), null); assert.match(G.director.guidance.text, /One full lap/);
  G.scene = 'pause'; const before = G.director.active.elapsed; tickDirector(G, 20);
  assert.equal(G.director.active.elapsed, before);
});

test('a real clean drive earns its bonus once and completion journal survives save/load', () => {
  const G = game(); beginJob(G); drive(G);
  assert.ok(G.director.active.distance >= 4000);
  assert.equal(challengeProgress(G).find(c => c.id === 'wheels').progress, 1);
  const result = finishJob(G, true);
  assert.equal(result.bonus, 350); assert.equal(result.grade, 'CLEAN'); assert.equal(G.chips, 750);
  assert.equal(finishJob(G, true).bonus, 0); assert.equal(G.chips, 750);
  G.director = directorState(directorSave(G.director));
  assert.equal(G.director.history[0].index, 1); assert.match(G.director.history[0].summary, /\+350 chips/);
  beginJob(G); drive(G); assert.equal(finishJob(G, true).bonus, 0); assert.equal(G.chips, 750);
  const saved = directorSave(G.director); assert.equal(saved.last.bonus, 0);
});

test('teleports, stationary engine revving and car swaps cannot earn clean-driving distance', () => {
  const G = game(); beginJob(G);
  for (let i = 0; i < 120; i++) { G.player.x += 500; tickDirector(G, 0.1); }
  assert.equal(G.director.active.distance, 0);
  for (let i = 0; i < 30; i++) tickDirector(G, 0.1);
  G.player = { ...G.player, x: 20 }; tickDirector(G, 0.1);
  assert.equal(G.director.active.distance, 0); assert.equal(finishJob(G, true).bonus, 150);
});

test('NPC damage is reported without being blamed on the player; explicit collision incidents fail the goal', () => {
  const G = game(); beginJob(G); drive(G, 6);
  G.player.health = 50; G.health = 90; G.peds.push({ dead: true }); drive(G, 6);
  assert.equal(G.director.active.damage, 60); assert.equal(G.director.active.civilianHarm, 0);
  assert.equal(challengeProgress(G).find(c => c.id === 'wheels').failed, false);
  recordIncident(G, 'collision');
  assert.equal(challengeProgress(G).find(c => c.id === 'wheels').failed, true);
  assert.equal(finishJob(G, true).bonus, 150);
});

test('player civilian injuries and wasted/busted events invalidate their stated optional goals', () => {
  const G = game(0); beginJob(G); drive(G); recordIncident(G, 'civilian_harm');
  assert.equal(finishJob(G, true).bonus, 0);
  const H = game(1); beginJob(H); drive(H); recordIncident(H, 'death');
  assert.equal(finishJob(H, true).bonus, 0);
  assert.equal(recordIncident(H, 'not_a_kind'), false);
});

test('shot counters are baselined per attempt, persisted as metrics and sampled again on finish', () => {
  const G = game(0, { shotsFired: 50 }); beginJob(G); drive(G, 6);
  G.shotsFired += 4; tickDirector(G, 0.1);
  const saved = directorSave(G.director);
  G.director = directorState(saved); G.shotsFired = 0; beginJob(G); drive(G, 6);
  assert.equal(G.director.active.shots, 4);
  G.shotsFired += 3;
  const done = finishJob(G, true); assert.equal(done.shots, 7); assert.equal(done.bonus, 150);
});

test('quiet Palace suspicion requires an actual guard, facing, line of sight and conspicuous movement', () => {
  const palace = clear => game(3, { player: { x: 0, y: 0, type: 'foot', speed: 100 },
    meta: { interactions: { casinoDoor: [0, 0] } }, nav: { clearLine: () => clear },
    cops: [{ x: 0, y: 100, rot: 0 }], _flow: { objectives: [{ id: 'case' }] } });
  const G = palace(true); beginJob(G); drive(G, 12);
  assert.equal(G.director.active.spotted, true); assert.equal(G.wanted, 0); assert.equal(G.objectiveIndex, 0);
  assert.equal(challengeProgress(G).find(c => c.id === 'ghost').failed, true);
  const H = palace(false); beginJob(H); drive(H, 12); assert.equal(H.director.active.spotted, false);
  const I = palace(true); I.player.speed = 25; beginJob(I); drive(I, 12); assert.equal(I.director.active.spotted, false);
  const J = palace(true); J.cops[0].rot = Math.PI; beginJob(J); drive(J, 12); assert.equal(J.director.active.spotted, false);
});

test('failed attempts earn nothing, retry cleanly, and cannot farm a successful job reward', () => {
  const G = game(); beginJob(G); drive(G); recordIncident(G, 'collision');
  const first = finishJob(G, false); assert.equal(first.bonus, 0); assert.equal(first.grade, 'RETRY'); assert.equal(G.chips, 400);
  beginJob(G); assert.equal(G.director.active.collisions, 0); drive(G);
  assert.equal(finishJob(G, true).bonus, 350); assert.equal(G.director.journal.length, 2);
});

test('restore validates malformed saves and produces detached bounded journal data', () => {
  for (const malformed of [null, undefined, [], 19, 'bad']) assert.equal(directorState(malformed).active, null);
  const D = directorState({ claimed: [1, 1, -1, 8, '2'], active: { job: 2, elapsed: Infinity, collisions: -9 },
    journal: [null, { job: 99 }, { job: 0, won: true, earned: ['arbitrary'], bonus: 1e9 }] });
  assert.deepEqual(D.claimed, [1]); assert.equal(D.active.elapsed, 0); assert.equal(D.active.collisions, 0);
  assert.equal(D.journal.length, 1); assert.equal(D.journal[0].bonus, 0);
  const saved = directorSave(D); saved.active.collisions = 44; saved.journal[0].earned.push('neighbors');
  assert.equal(D.active.collisions, 0); assert.deepEqual(D.journal[0].earned, []);
});
