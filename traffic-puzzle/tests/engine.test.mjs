import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  autoplay,
  computePar,
  computeReward,
  computeStars,
  makeReplay,
  verifyReplay,
  validateLevel,
  loadLevel,
  CROSS,
} from '../dist/core/index.js';
import { arm, cross, makeLevel, engineFor, stepSeconds } from './helpers.mjs';

test('queue advances smoothly: next car reaches the stop line and becomes waiting', () => {
  const eng = engineFor(cross({ W: ['car:r', 'bus:s', 'car:l'] }));
  const [a, b, c] = ['W0', 'W1', 'W2'].map((id) => eng.byId.get(id));
  assert.equal(a.state, 'waiting');
  assert.equal(b.state, 'queued');
  assert.equal(eng.tap('W0').verdict, 'go');
  let prevGap = Infinity;
  for (let i = 0; i < 180; i++) {
    eng.step();
    // car-following: the bus never overlaps the departing car while on the lane
    if (a.state === 'crossing' && a.s < CROSS.stopU) {
      const leaderRear = CROSS.stopU - a.s + a.length;
      assert.ok(b.u >= leaderRear + 0.2, `gap violated at tick ${eng.tick}`);
    }
    // no overlap inside the queue
    assert.ok(c.u >= b.u + b.length + 0.2);
    prevGap = Math.min(prevGap, c.u - (b.u + b.length));
  }
  assert.equal(b.state, 'waiting');
  assert.equal(b.u, CROSS.stopU);
  assert.equal(c.state, 'queued');
});

test('penalty flow: lives decrease, culprits flash, 0 lives → lost', () => {
  const eng = engineFor(cross({ S: ['car:s'], E: ['car:s'] }, { lives: 2 }));
  const events = [];
  eng.on((e) => events.push(e.type));
  eng.tap('S0');
  assert.equal(eng.lives, 1);
  assert.ok(eng.byId.get('E0').flashUntil > eng.tick);
  stepSeconds(eng, 1); // lock expires
  eng.tap('S0');
  assert.equal(eng.lives, 0);
  assert.equal(eng.status, 'lost');
  assert.deepEqual(events.filter((t) => t !== 'blocked'), ['penalty', 'penalty', 'lost']);
  assert.equal(eng.result().stars, 0);
});

test('arrivals spawn at the far end and join the queue', () => {
  const level = makeLevel('cross', [
    arm('N'),
    arm('E'),
    arm('S', ['car:s'], { arrivals: [{ kind: 'ambulance', turn: 'straight', atMs: 1000 }] }),
    arm('W'),
  ]);
  const eng = engineFor(level);
  const amb = eng.byId.get('S1');
  assert.equal(amb.state, 'hidden');
  stepSeconds(eng, 1.05);
  assert.equal(amb.state, 'queued');
  eng.tap('S0');
  stepSeconds(eng, 5);
  assert.equal(amb.state, 'waiting');
  eng.tap('S1');
  stepSeconds(eng, 4);
  assert.equal(eng.status, 'won');
});

test('win: all vehicles cleared → won event with stars and coins', () => {
  const eng = engineFor(cross({ S: ['car:s'], E: ['car:s'] }), { parMs: 60_000 });
  let won = null;
  eng.on((e) => {
    if (e.type === 'won') won = e.result;
  });
  eng.tap('E0');
  stepSeconds(eng, 2);
  eng.tap('S0');
  stepSeconds(eng, 3);
  assert.ok(won);
  assert.equal(won.completed, true);
  assert.equal(won.stars, 3);
  assert.equal(won.cleared, 2);
  assert.ok(won.vehicleCoins >= 4); // 2 + 2 (+5 hero bonus)
});

test('stars and rewards', () => {
  assert.equal(computeStars(0, 10_000, 20_000), 3);
  assert.equal(computeStars(1, 10_000, 20_000), 2);
  assert.equal(computeStars(0, 30_000, 20_000), 2);
  assert.equal(computeStars(2, 30_000, 20_000), 1);
  const first = computeReward('base', { completed: true, stars: 3, vehicleCoins: 9 }, 0);
  assert.deepEqual(first, { total: 9 + 10 + 30, vehicles: 9, completion: 10, stars: 30 });
  const replay = computeReward('base', { completed: true, stars: 3, vehicleCoins: 9 }, 2);
  assert.equal(replay.total, 9 + 10); // only the newly earned star
  assert.equal(computeReward('boss', { completed: false, stars: 0, vehicleCoins: 50 }, 0).total, 0);
});

test('replay: identical taps reproduce the identical result; tampering is rejected', () => {
  const level = cross({ N: ['car:s', 'car:l'], E: ['car:s', 'bus:r'], S: ['car:l'], W: ['taxi:s', 'car:r'] });
  const bot = autoplay(level, { reactionTicks: 10 });
  assert.equal(bot.completed, true);
  assert.equal(bot.penalties, 0);
  const ok = verifyReplay(level, bot.replay, 60_000);
  assert.equal(ok.ok, true, ok.error);
  assert.equal(ok.result.ticks, bot.ticks);
  // determinism: run twice
  assert.deepEqual(verifyReplay(level, bot.replay, 60_000).result, ok.result);

  // tampering 1: claim an earlier finish
  assert.equal(verifyReplay(level, { ...bot.replay, endTick: bot.ticks - 30 }).ok, false);
  // tampering 2: drop a tap → level cannot complete
  assert.equal(verifyReplay(level, { ...bot.replay, taps: bot.replay.taps.slice(1) }).ok, false);
  // tampering 3: unknown vehicle id
  const bad = bot.replay.taps.map(([t, id], i) => [t, i === 0 ? 'X9' : id]);
  assert.equal(verifyReplay(level, { ...bot.replay, taps: bad }).error, 'unknown_vehicle');
  // tampering 4: out-of-order taps
  const swapped = [...bot.replay.taps].reverse();
  assert.equal(verifyReplay(level, { ...bot.replay, taps: swapped }).error, 'tap_order');
});

test('replay of a live engine session verifies', () => {
  const level = cross({ S: ['car:s'], E: ['car:s'], N: ['car:l'] });
  const eng = engineFor(level);
  // S0 → E0 (right-hand), E0 → N0 (right-hand), N0 → S0 (left turn yields to oncoming):
  // a 3-vehicle yield cycle, so S0 may go by deadlock resolution.
  const d1 = eng.tap('S0');
  assert.equal(d1.verdict, 'go');
  assert.equal(d1.deadlock, true);
  stepSeconds(eng, 0.8);
  const d2 = eng.tap('E0'); // S0 is still crossing E0's path → collision risk
  assert.equal(d2.verdict, 'violation');
  assert.equal(d2.reason, 'crossing_traffic');
  stepSeconds(eng, 1.5);
  eng.tap('W0'); // no such vehicle: ignored, not recorded
  stepSeconds(eng, 0.5);
  for (let i = 0; i < 60 * 60 && eng.status === 'playing'; i++) {
    for (const id of ['N0', 'E0', 'S0']) {
      if (eng.preview(id).allowed) eng.tap(id);
    }
    eng.step();
  }
  assert.equal(eng.status, 'won');
  const rep = makeReplay(eng);
  const v = verifyReplay(level, rep, eng.parMs);
  assert.equal(v.ok, true, v.error);
  assert.equal(v.result.mistakes, 1);
  assert.equal(v.result.mistakes, eng.mistakes);
  assert.equal(v.result.ticks, eng.result().ticks);
});

test('bot solves a deadlock level and computes a sane par', () => {
  const level = cross({ N: ['car:s'], E: ['car:s'], S: ['car:s'], W: ['car:s'] });
  const r = autoplay(level);
  assert.equal(r.completed, true);
  assert.equal(r.penalties, 0);
  const par = computePar(level);
  assert.ok(par >= 3000 && par <= 20_000, `par=${par}`);
});

test('validator reports precise errors (uz)', () => {
  const bad = {
    id: 0,
    name: '',
    band: 'x',
    junction: 'cross',
    arms: [
      { dir: 'N', queue: [{ kind: 'car', turn: 'straight' }] },
      { dir: 'N', queue: [{ kind: 'ufo', turn: 'up' }] },
      { dir: 'S', queue: [] },
    ],
  };
  const v = validateLevel(bad);
  assert.equal(v.ok, false);
  const text = v.errors.join('\n');
  assert.match(text, /id/);
  assert.match(text, /name/);
  assert.match(text, /band/);
  assert.match(text, /takrorlangan/);
  assert.match(text, /ufo/);
  assert.match(text, /4 ta yo'l/);

  const t = validateLevel({
    id: 1,
    name: 'T',
    band: 'complex',
    junction: 't',
    arms: [
      { dir: 'E', queue: [] },
      { dir: 'W', queue: [] },
      { dir: 'S', queue: [{ kind: 'car', turn: 'straight' }] }, // would exit to N, which does not exist
    ],
  });
  assert.equal(t.ok, false);
  assert.match(t.errors.join(), /chiqish yo'li \(N\)/);

  const sig = validateLevel({
    id: 2,
    name: 's',
    band: 'complex',
    junction: 'cross',
    arms: ['N', 'E', 'S', 'W'].map((d) => ({ dir: d, queue: [{ kind: 'car', turn: 'right' }] })),
    signals: { phases: [{ green: ['N', 'S'], ms: 5000 }] },
  });
  assert.equal(sig.ok, false);
  assert.match(sig.errors.join(), /aynan bitta fazada/);
  assert.throws(() => loadLevel(bad));
});
