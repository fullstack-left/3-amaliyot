/**
 * Traffic signals (svetofor).
 *
 * A plan is a cycle of green phases; each enabled arm is green in exactly one
 * phase. After every green: amber, then all-red clearance. Arms about to turn
 * green show red+amber during the preceding all-red. The last 1.5 s of green
 * flashes (Uzbek/CIS convention). Optional "flashing" windows switch the whole
 * signal to flashing amber: it no longer regulates and the priority signs apply.
 *
 * Everything is integer ticks → deterministic on every platform.
 */

import { dirFromLetter } from './dir.js';
import { msToTicks } from './kinematics.js';
import type { Aspect, Dir, SignalPlanDef } from './types.js';

export interface SignalPlan {
  readonly cycle: number;
  readonly phaseStart: readonly number[];
  readonly phaseGreen: readonly number[];
  /** Phase index for each arm, −1 if the arm has no signal head. */
  readonly armPhase: readonly number[];
  readonly amber: number;
  readonly allRed: number;
  readonly offset: number;
  readonly flash: number;
  readonly flashing: readonly (readonly [number, number])[];
}

const GREEN_FLASH_TICKS = 90;

export function buildSignalPlan(def: SignalPlanDef): SignalPlan {
  const amber = msToTicks(def.amberMs ?? 2000);
  const allRed = msToTicks(def.allRedMs ?? 1000);
  const phaseStart: number[] = [];
  const phaseGreen: number[] = [];
  const armPhase = [-1, -1, -1, -1];
  let t = 0;
  def.phases.forEach((p, i) => {
    phaseStart.push(t);
    const g = Math.max(1, msToTicks(p.ms));
    phaseGreen.push(g);
    for (const l of p.green) armPhase[dirFromLetter(l)] = i;
    t += g + amber + allRed;
  });
  return {
    cycle: Math.max(1, t),
    phaseStart,
    phaseGreen,
    armPhase,
    amber,
    allRed,
    offset: msToTicks(def.offsetMs ?? 0),
    flash: GREEN_FLASH_TICKS,
    flashing: (def.flashing ?? []).map((w) => [msToTicks(w.fromMs), msToTicks(w.toMs)] as const),
  };
}

function mod(a: number, m: number): number {
  return ((a % m) + m) % m;
}

/** false during flashing-amber windows (signal off → priority signs apply). */
export function isRegulating(plan: SignalPlan, tick: number): boolean {
  for (const [a, b] of plan.flashing) if (tick >= a && tick < b) return false;
  return true;
}

export function aspectAt(plan: SignalPlan, dir: Dir, tick: number): Aspect {
  if (!isRegulating(plan, tick)) return 'flashing_amber';
  const k = plan.armPhase[dir];
  if (k < 0) return 'red';
  const pos = mod(tick + plan.offset, plan.cycle);
  const start = plan.phaseStart[k];
  const g = plan.phaseGreen[k];
  const rel = mod(pos - start, plan.cycle);
  const flash = Math.min(plan.flash, Math.floor(g / 3));
  if (rel < g - flash) return 'green';
  if (rel < g) return 'green_flash';
  if (rel < g + plan.amber) return 'amber';
  const untilGreen = mod(start - pos, plan.cycle);
  if (untilGreen > 0 && untilGreen <= plan.allRed) return 'red_amber';
  return 'red';
}

/** Movement permitted by this aspect? */
export function isGo(a: Aspect): boolean {
  return a === 'green' || a === 'green_flash';
}

/** Ticks until this arm's aspect changes (for the countdown display). */
export function ticksUntilChange(plan: SignalPlan, dir: Dir, tick: number): number {
  const now = aspectAt(plan, dir, tick);
  const horizon = plan.cycle + 1;
  for (let dt = 1; dt <= horizon; dt++) {
    const a = aspectAt(plan, dir, tick + dt);
    const bothGreen = isGo(a) && isGo(now);
    if (a !== now && !bothGreen) return dt;
  }
  return horizon;
}
