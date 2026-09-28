import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  getJunction,
  inLane,
  outLane,
  exitOf,
  rightOf,
  leftOf,
  opposite,
  movementIndex,
  DIRS,
  TURNS,
  CROSS,
  RB,
  DESPAWN_U,
  distAt,
  timeAt,
} from '../dist/core/index.js';

const close = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;

test('direction algebra: right/left/opposite/exit (right-hand traffic)', () => {
  // N=0 E=1 S=2 W=3. Driver from S heads north: right side = E, left side = W.
  assert.equal(rightOf(2), 1);
  assert.equal(leftOf(2), 3);
  assert.equal(rightOf(0), 3); // from N (heading south) the right is W
  assert.equal(opposite(1), 3);
  assert.equal(exitOf(2, 'straight'), 0);
  assert.equal(exitOf(2, 'right'), 1);
  assert.equal(exitOf(2, 'left'), 3);
  assert.equal(exitOf(1, 'left'), 2); // from E turning left goes south
});

test('lanes follow right-hand traffic', () => {
  // incoming lane is on the right of the travel direction
  assert.deepEqual(inLane(2, 5), [0.5, 5]); // from S heading N → east half
  assert.deepEqual(inLane(0, 5), [-0.5, -5]); // from N heading S → west half
  assert.deepEqual(inLane(1, 5), [5, -0.5]); // from E heading W → north half
  assert.deepEqual(inLane(3, 5), [-5, 0.5]); // from W heading E → south half
  assert.deepEqual(outLane(0, 5), [0.5, -5]); // leaving to N on the east half
  assert.deepEqual(outLane(2, 5), [-0.5, 5]);
});

test('every path starts at the stop line and ends on the correct exit lane', () => {
  for (const key of ['cross', 'cross_ctrl', 'roundabout']) {
    const g = getJunction(key);
    const stopU = key === 'roundabout' ? RB.stopU : CROSS.stopU;
    for (const from of DIRS) {
      for (const turn of TURNS) {
        const p = g.paths[movementIndex(from, turn)];
        const [sx, sy] = inLane(from, stopU);
        const start = p.sample(0);
        assert.ok(close(start.x, sx, 1e-9) && close(start.y, sy, 1e-9), `${key} ${from} ${turn} start`);
        const end = p.sample(p.length);
        const [ex, ey] = outLane(exitOf(from, turn), DESPAWN_U);
        assert.ok(Math.hypot(end.x - ex, end.y - ey) < 0.06, `${key} ${from} ${turn} end`);
        assert.ok(p.mark('enter') < p.mark('exit'));
      }
    }
  }
});

test('paths are smooth (no heading jumps > 12° between samples)', () => {
  for (const key of ['cross', 'cross_ctrl', 'roundabout']) {
    const g = getJunction(key);
    for (const p of g.paths) {
      for (let i = 1; i < p.n - 1; i++) {
        let d = Math.abs(p.hs[i] - p.hs[i - 1]);
        if (d > Math.PI) d = 2 * Math.PI - d;
        assert.ok(d < (12 * Math.PI) / 180, `${key}: jump ${((d * 180) / Math.PI).toFixed(1)}° at ${i}`);
      }
    }
  }
});

/**
 * Reference model: 8 boundary ports around the junction square in CCW order.
 * Two movements cross iff their chords interleave, merge iff they share an exit.
 * Natural left-turn arcs additionally make OPPOSING left turns cross.
 */
function expectedCrossConflicts() {
  const entry = [1, 7, 5, 3]; // N,E,S,W entry ports
  const exitPort = [0, 6, 4, 2]; // exits toward N,E,S,W
  const chord = (from, turn) => [entry[from], exitPort[exitOf(from, turn)]];
  const between = (a, b, x) => {
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    return x > lo && x < hi;
  };
  const table = new Map();
  for (const fa of DIRS)
    for (const ta of TURNS)
      for (const fb of DIRS)
        for (const tb of TURNS) {
          if (fa === fb) continue;
          const [a1, a2] = chord(fa, ta);
          const [b1, b2] = chord(fb, tb);
          let kind = null;
          if (a2 === b2) kind = 'merge';
          else if (between(a1, a2, b1) !== between(a1, a2, b2)) kind = 'cross';
          if (ta === 'left' && tb === 'left' && fb === opposite(fa)) kind = 'cross';
          table.set(`${movementIndex(fa, ta)}:${movementIndex(fb, tb)}`, kind);
        }
  return table;
}

test('cross-junction conflict matrix == traffic-engineering reference (16 cross + 12 merge + opposing lefts)', () => {
  const g = getJunction('cross');
  const ref = expectedCrossConflicts();
  let crossings = 0;
  let merges = 0;
  for (const [key, kind] of ref) {
    const [a, b] = key.split(':').map(Number);
    const z = g.conflict(a, b);
    assert.equal(z ? z.kind : null, kind, `movement ${a} vs ${b}`);
    if (a < b && kind === 'cross') crossings++;
    if (a < b && kind === 'merge') merges++;
  }
  assert.equal(crossings, 18);
  assert.equal(merges, 12);
});

test('opposing straights and two right turns never conflict; zones are symmetric', () => {
  for (const key of ['cross', 'cross_ctrl']) {
    const g = getJunction(key);
    assert.equal(g.conflict(movementIndex(2, 'straight'), movementIndex(0, 'straight')), null);
    assert.equal(g.conflict(movementIndex(2, 'right'), movementIndex(0, 'right')), null);
    assert.equal(g.conflict(movementIndex(2, 'right'), movementIndex(1, 'left')), null);
    for (let a = 0; a < 12; a++)
      for (let b = 0; b < 12; b++) {
        const z1 = g.conflict(a, b);
        const z2 = g.conflict(b, a);
        assert.equal(!!z1, !!z2);
        if (z1) {
          assert.equal(z1.a0, z2.b0);
          assert.equal(z1.a1, z2.b1);
          assert.ok(z1.a0 <= z1.a1 && z1.b0 <= z1.b1);
        }
      }
  }
});

test('roundabout: entering conflicts only with ring traffic passing the entry', () => {
  const g = getJunction('roundabout');
  // From S going right (S→E) exits before passing E's entry → no conflict with E straight.
  assert.equal(g.conflict(movementIndex(2, 'right'), movementIndex(1, 'straight')), null);
  // From S going straight passes E's entry → merge conflict with E entering.
  const z = g.conflict(movementIndex(1, 'straight'), movementIndex(2, 'straight'));
  assert.ok(z && z.kind === 'merge');
});

test('controller geometry keeps the centre free (driving around the regulirovshik)', () => {
  const g = getJunction('cross_ctrl');
  for (const p of g.paths) {
    for (let i = 0; i < p.n; i++) assert.ok(Math.hypot(p.xs[i], p.ys[i]) >= 0.49);
  }
});

test('kinematics: timeAt is the inverse of distAt', () => {
  for (const t of [0, 0.1, 0.5, 0.76, 1, 2.5, 7]) assert.ok(close(timeAt(distAt(t)), t, 1e-9));
});
