/**
 * Autoplay bot — greedy legal player.
 *
 * Every `reactionTicks` it taps one front vehicle whose move is legal right now
 * (emergency vehicles first, then by spawn order). It never commits a violation.
 *
 * Uses:
 *   - solvability proof for every campaign level (tests + build script),
 *   - par time for the "fast" star,
 *   - hint system ("which car can go?"),
 *   - animated menu background.
 *
 * Greedy is complete here because the world only moves forward: vehicles leave,
 * signals/controller cycle, deadlocks are resolved by the SCC rule — so if every
 * movement is permitted at some point, the bot finishes.
 */

import { GameEngine } from './engine.js';
import type { Level } from './level.js';
import { makeReplay, type Replay } from './replay.js';
import { canVehicleMove } from './rules.js';
import type { Vehicle } from './types.js';

export interface AutoplayOptions {
  reactionTicks?: number;
  maxTicks?: number;
}

export interface AutoplayResult {
  readonly completed: boolean;
  readonly ticks: number;
  readonly taps: number;
  readonly penalties: number;
  readonly replay: Replay;
}

/** Legal candidates right now, best first. */
export function legalMoves(engine: GameEngine): Vehicle[] {
  const out: Vehicle[] = [];
  for (const q of engine.queues) {
    const f = q[0];
    if (f && f.state === 'waiting' && canVehicleMove(f.id, engine).allowed) out.push(f);
  }
  out.sort((a, b) => Number(b.emergency) - Number(a.emergency) || a.idx - b.idx);
  return out;
}

export function autoplay(level: Level, opts: AutoplayOptions = {}): AutoplayResult {
  const reaction = opts.reactionTicks ?? 12;
  const maxTicks = opts.maxTicks ?? 60 * 60 * 6;
  const engine = new GameEngine(level, { parMs: Number.POSITIVE_INFINITY });
  let cooldown = 0;
  let taps = 0;
  while (engine.status === 'playing' && engine.tick < maxTicks) {
    if (cooldown <= 0) {
      const moves = legalMoves(engine);
      if (moves.length > 0) {
        engine.tap(moves[0].id);
        taps++;
        cooldown = reaction;
      }
    } else {
      cooldown--;
    }
    engine.step();
  }
  return {
    completed: engine.status === 'won',
    ticks: engine.endTick >= 0 ? engine.endTick : engine.tick,
    taps,
    penalties: engine.mistakes,
    replay: makeReplay(engine),
  };
}

/** Par time: a human-realistic bot (0.3 s reactions) + 25 % + 2.5 s slack, rounded to 0.5 s. */
export function computePar(level: Level): number {
  const r = autoplay(level, { reactionTicks: 18 });
  if (!r.completed) throw new Error(`Level ${level.id}: avtopilot yecha olmadi`);
  const ms = (r.ticks * 1000) / 60;
  return Math.ceil((ms * 1.25 + 2500) / 500) * 500;
}
