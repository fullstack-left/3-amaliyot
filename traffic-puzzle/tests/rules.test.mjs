import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canVehicleMove, gesturePermits, bodySide } from '../dist/core/index.js';
import { arm, cross, makeLevel, engineFor, stepSeconds } from './helpers.mjs';

const verdict = (eng, id) => canVehicleMove(id, eng);

test("right-hand rule: yield to the vehicle approaching from the right", () => {
  const eng = engineFor(cross({ S: ['car:s'], E: ['car:s'] }));
  const s = verdict(eng, 'S0');
  assert.equal(s.verdict, 'violation');
  assert.equal(s.reason, 'right_hand');
  assert.deepEqual(s.culprits, ['E0']);
  assert.equal(verdict(eng, 'E0').verdict, 'go');
});

test('left turn yields to oncoming straight traffic', () => {
  const eng = engineFor(cross({ S: ['car:l'], N: ['car:s'] }));
  assert.equal(verdict(eng, 'S0').reason, 'left_turn');
  assert.equal(verdict(eng, 'N0').verdict, 'go');
});

test('left turn yields to oncoming right turn (same exit lane)', () => {
  const eng = engineFor(cross({ S: ['car:l'], N: ['car:r'] }));
  assert.equal(verdict(eng, 'S0').reason, 'left_turn');
  assert.equal(verdict(eng, 'N0').verdict, 'go');
});

test('non-conflicting moves are free (fairness)', () => {
  const eng = engineFor(cross({ S: ['car:r'], E: ['car:s'], N: ['car:s'] }));
  // S turning right does not cross E→W or N→S
  assert.equal(verdict(eng, 'S0').verdict, 'go');
});

test('opposing left turns: no mutual priority, but only one may be inside at a time', () => {
  const eng = engineFor(cross({ S: ['car:l'], N: ['car:l'] }));
  assert.equal(verdict(eng, 'S0').verdict, 'go');
  assert.equal(verdict(eng, 'N0').verdict, 'go');
  eng.tap('S0');
  const n = verdict(eng, 'N0');
  assert.equal(n.verdict, 'violation');
  assert.equal(n.reason, 'crossing_traffic');
  assert.deepEqual(n.culprits, ['S0']);
  stepSeconds(eng, 2.5);
  assert.equal(verdict(eng, 'N0').verdict, 'go');
});

test('main road beats the right-hand rule; yield sign must give way', () => {
  const eng = engineFor(
    cross({ S: ['car:s'], E: ['car:s'] }, { signs: { N: 'main', S: 'main', E: 'yield', W: 'yield' } }),
  );
  // E is on S's right, but S is on the main road
  assert.equal(verdict(eng, 'S0').verdict, 'go');
  const e = verdict(eng, 'E0');
  assert.equal(e.reason, 'main_road');
  assert.deepEqual(e.culprits, ['S0']);
});

test('among main-road vehicles the equal-road rules apply (left turn yields)', () => {
  const eng = engineFor(
    cross({ S: ['car:l'], N: ['car:s'], E: ['car:s'] }, { signs: { N: 'main', S: 'main', E: 'stop', W: 'stop' } }),
  );
  assert.equal(verdict(eng, 'S0').reason, 'left_turn');
  assert.equal(verdict(eng, 'N0').verdict, 'go');
  assert.equal(verdict(eng, 'E0').reason, 'main_road');
});

test('emergency vehicle beats signs: main-road car yields to the ambulance', () => {
  const eng = engineFor(
    cross({ S: ['car:s'], E: ['ambulance:s'] }, { signs: { N: 'main', S: 'main', E: 'yield', W: 'yield' } }),
  );
  const s = verdict(eng, 'S0');
  assert.equal(s.reason, 'emergency');
  assert.deepEqual(s.culprits, ['E0']);
  assert.equal(verdict(eng, 'E0').verdict, 'go');
});

const TWO_PHASE = {
  phases: [
    { green: ['N', 'S'], ms: 6000 },
    { green: ['E', 'W'], ms: 6000 },
  ],
};

test('traffic light: red is a violation, green goes', () => {
  const eng = engineFor(cross({ S: ['car:s'], E: ['car:s'] }, { signals: TWO_PHASE }));
  assert.equal(eng.aspect(2), 'green');
  assert.equal(eng.aspect(1), 'red');
  assert.equal(verdict(eng, 'E0').reason, 'red_light');
  // with lights the right-hand rule does not apply between green and red arms
  assert.equal(verdict(eng, 'S0').verdict, 'go');
});

test('traffic light: amber also prohibits; later E/W gets green', () => {
  const eng = engineFor(cross({ S: ['car:s'], E: ['car:s'] }, { signals: TWO_PHASE }));
  stepSeconds(eng, 6.5); // NS amber
  assert.equal(eng.aspect(2), 'amber');
  assert.equal(verdict(eng, 'S0').reason, 'red_light');
  stepSeconds(eng, 3); // after amber (2 s) + all-red (1 s) → E/W green
  assert.equal(eng.aspect(1), 'green');
  assert.equal(verdict(eng, 'E0').verdict, 'go');
});

test('on green, a left turn yields to oncoming straight traffic (also green)', () => {
  const eng = engineFor(cross({ S: ['car:l'], N: ['car:s'] }, { signals: TWO_PHASE }));
  assert.equal(verdict(eng, 'S0').reason, 'left_turn');
  assert.equal(verdict(eng, 'N0').verdict, 'go');
});

test('emergency vehicle may pass a red light and green traffic must yield to it', () => {
  const eng = engineFor(cross({ S: ['car:s'], E: ['ambulance:s'] }, { signals: TWO_PHASE }));
  assert.equal(eng.aspect(1), 'red');
  assert.equal(verdict(eng, 'E0').verdict, 'go');
  assert.equal(verdict(eng, 'S0').reason, 'emergency');
});

test('flashing amber: signal off → priority signs apply', () => {
  const eng = engineFor(
    cross(
      { S: ['car:s'], E: ['car:s'] },
      {
        signals: { ...TWO_PHASE, flashing: [{ fromMs: 0, toMs: 60000 }] },
        signs: { N: 'main', S: 'main', E: 'yield', W: 'yield' },
      },
    ),
  );
  assert.equal(eng.aspect(1), 'flashing_amber');
  assert.equal(eng.mode(), 'priority');
  assert.equal(verdict(eng, 'E0').reason, 'main_road');
  assert.equal(verdict(eng, 'S0').verdict, 'go');
});

test('controller gestures follow the real signal table', () => {
  // facing N: chest = N, back = S, right side = E, left side = W
  assert.equal(bodySide(0, 0), 'chest');
  assert.equal(bodySide(0, 2), 'back');
  assert.equal(bodySide(0, 1), 'right');
  assert.equal(bodySide(0, 3), 'left');
  // arms sideways: sides go straight/right, never left; chest/back stop
  assert.equal(gesturePermits('arms_side', 'left', 'straight'), true);
  assert.equal(gesturePermits('arms_side', 'right', 'right'), true);
  assert.equal(gesturePermits('arms_side', 'left', 'left'), false);
  assert.equal(gesturePermits('arms_side', 'chest', 'straight'), false);
  assert.equal(gesturePermits('arms_side', 'back', 'right'), false);
  // right arm forward: left side all, chest right only, right side/back nothing
  assert.equal(gesturePermits('right_forward', 'left', 'left'), true);
  assert.equal(gesturePermits('right_forward', 'chest', 'right'), true);
  assert.equal(gesturePermits('right_forward', 'chest', 'straight'), false);
  assert.equal(gesturePermits('right_forward', 'right', 'straight'), false);
  assert.equal(gesturePermits('right_forward', 'back', 'right'), false);
  // arm up: everything stops
  for (const side of ['chest', 'back', 'left', 'right'])
    for (const t of ['straight', 'left', 'right']) assert.equal(gesturePermits('arm_up', side, t), false);
});

test('controller overrides everything: forbidden move is a violation, permitted one goes', () => {
  const level = makeLevel(
    'cross',
    [arm('N', ['car:s']), arm('E', ['car:l']), arm('S', ['car:r']), arm('W', ['car:s'])],
    {
      band: 'boss',
      controller: {
        poses: [
          { gesture: 'right_forward', facing: 'S', ms: 5000 },
          { gesture: 'arms_side', facing: 'N', ms: 5000 },
          { gesture: 'arms_side', facing: 'E', ms: 5000 },
        ],
      },
    },
  );
  const eng = engineFor(level);
  // facing S: left side = E (all directions), chest = S (right only), W = right side, N = back
  assert.equal(verdict(eng, 'E0').verdict, 'go');
  assert.equal(verdict(eng, 'S0').verdict, 'go');
  assert.equal(verdict(eng, 'W0').reason, 'controller');
  assert.equal(verdict(eng, 'N0').reason, 'controller');
  stepSeconds(eng, 5.2);
  // arms sideways facing N: E and W may go straight/right; E's left turn is forbidden now
  assert.equal(verdict(eng, 'W0').verdict, 'go');
  assert.equal(verdict(eng, 'E0').reason, 'controller');
  assert.equal(verdict(eng, 'N0').reason, 'controller');
});

test('deadlock: four straights at an equal junction → any one may proceed (Tarjan SCC)', () => {
  const eng = engineFor(cross({ N: ['car:s'], E: ['car:s'], S: ['car:s'], W: ['car:s'] }));
  for (const id of ['N0', 'E0', 'S0', 'W0']) {
    const d = verdict(eng, id);
    assert.equal(d.verdict, 'go', id);
    assert.equal(d.deadlock, true, id);
  }
  eng.tap('S0');
  // the cycle is broken: N still yields to W (on its right); N-S vs S-N never conflict physically
  assert.equal(verdict(eng, 'N0').reason, 'right_hand');
  assert.deepEqual(verdict(eng, 'N0').culprits, ['W0']);
  // E is physically in S0's path → space-time rung fires first
  assert.equal(verdict(eng, 'E0').reason, 'crossing_traffic');
  // W is now free by the rules, but S0 is crossing its path
  assert.equal(verdict(eng, 'W0').reason, 'crossing_traffic');
  stepSeconds(eng, 2.5);
  assert.equal(verdict(eng, 'W0').verdict, 'go');
  assert.equal(verdict(eng, 'W0').deadlock, false);
});

test('queue: tapping the second car does nothing (no penalty)', () => {
  const eng = engineFor(cross({ W: ['car:r', 'car:s'] }));
  const d = eng.tap('W1');
  assert.equal(d.verdict, 'wait');
  assert.equal(d.reason, 'not_front');
  assert.equal(eng.lives, 3);
  assert.equal(eng.mistakes, 0);
});

test('space-time: yield to a vehicle completing its crossing, go once it has passed', () => {
  const eng = engineFor(cross({ E: ['car:s'], S: ['car:s'] }));
  eng.tap('E0');
  const s = verdict(eng, 'S0');
  assert.equal(s.reason, 'crossing_traffic');
  assert.deepEqual(s.culprits, ['E0']);
  stepSeconds(eng, 2);
  assert.equal(verdict(eng, 'S0').verdict, 'go');
});

test('roundabout: circulating traffic has priority; waiting entries have none among themselves', () => {
  const level = makeLevel('roundabout', [arm('N'), arm('E', ['car:s']), arm('S', ['car:s']), arm('W')], { band: 'roundabout' });
  const eng = engineFor(level);
  assert.equal(eng.mode(), 'roundabout');
  assert.equal(verdict(eng, 'S0').verdict, 'go');
  assert.equal(verdict(eng, 'E0').verdict, 'go');
  eng.tap('S0'); // S → N passes E's entry
  stepSeconds(eng, 0.5);
  const e = verdict(eng, 'E0');
  assert.equal(e.verdict, 'violation');
  assert.equal(e.reason, 'roundabout_ring');
  stepSeconds(eng, 3);
  assert.equal(verdict(eng, 'E0').verdict, 'go');
});

test('T-junction with equal roads: the stem yields to the vehicle on its right', () => {
  const level = makeLevel('t', [arm('E', ['car:s']), arm('S', ['car:l']), arm('W', [])], { band: 'complex' });
  const eng = engineFor(level);
  assert.equal(verdict(eng, 'S0').reason, 'right_hand');
  assert.equal(verdict(eng, 'E0').verdict, 'go');
});

test('after a violation the vehicle is locked briefly (no double penalty)', () => {
  const eng = engineFor(cross({ S: ['car:s'], E: ['car:s'] }));
  assert.equal(eng.tap('S0').verdict, 'violation');
  assert.equal(eng.lives, 2);
  const again = eng.tap('S0');
  assert.equal(again.verdict, 'wait');
  assert.equal(again.reason, 'locked');
  assert.equal(eng.lives, 2);
});

test('an approaching front vehicle close to its stop line already has priority', () => {
  const eng = engineFor(cross({ E: ['car:r', 'car:s'], S: ['car:s'] }));
  eng.tap('E0'); // E turns right (no conflict with S-straight... E1 will advance)
  // wait until E1 is approaching and close to the stop line
  let guard = 0;
  while (eng.byId.get('E1').u - eng.layout.stopU > 1.0 && guard++ < 200) eng.step();
  const e1 = eng.byId.get('E1');
  assert.ok(e1.state === 'approaching' || e1.state === 'waiting');
  // S must yield to E1 (right-hand) as soon as E1 is present
  const s = verdict(eng, 'S0');
  assert.equal(s.verdict, 'violation');
  assert.ok(s.reason === 'right_hand' || s.reason === 'crossing_traffic');
});
