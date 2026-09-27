/** Test helpers: tiny DSL for building levels. Tests run against the compiled dist/. */
import { loadLevel, GameEngine } from '../dist/core/index.js';

/** 'car:straight' | 'ambulance:left' | { kind, turn } */
export function spawn(s) {
  if (typeof s !== 'string') return s;
  const [kind, turn] = s.split(':');
  return { kind, turn: { s: 'straight', l: 'left', r: 'right' }[turn] ?? turn };
}

export function arm(dir, queue = [], extra = {}) {
  return { dir, queue: queue.map(spawn), ...extra };
}

export function makeLevel(junction, arms, extra = {}) {
  return loadLevel({ id: extra.id ?? 999, name: 'test', band: extra.band ?? 'base', junction, arms, ...extra });
}

/** Cross junction with the given queues per arm, e.g. { S: ['car:s'], E: ['car:s'] }. */
export function cross(queues, extra = {}) {
  const arms = ['N', 'E', 'S', 'W'].map((d) => arm(d, queues[d] ?? [], extra.signs ? { sign: extra.signs[d] ?? 'none' } : {}));
  const { signs, ...rest } = extra;
  return makeLevel('cross', arms, rest);
}

export function engineFor(level, opts) {
  return new GameEngine(level, opts);
}

export function stepSeconds(engine, s) {
  engine.stepMany(Math.round(s * 60));
}
