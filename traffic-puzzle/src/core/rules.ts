/**
 * Rule Validation Engine — `canVehicleMove(vehicleId, state)`.
 * ============================================================
 *
 * Answers: "if the player taps this vehicle NOW, is it legal? If not, why, and
 * which vehicles had priority / would be hit?"
 *
 * Priority ladder (first failing rung wins):
 *
 *   0. Readiness     only the front vehicle stopped at the stop line (`waiting`).
 *                    Anything else is a soft "wait" — no penalty (queue rule).
 *   1. Regulation    traffic controller (boss) → traffic light. Emergency
 *                    vehicles are exempt. Violation = penalty.
 *   2. Space-time    would we occupy a conflict zone at the same time as a
 *                    vehicle already crossing? → collision (penalty).
 *   3. Right-of-way  a YIELD GRAPH over the vehicles present at the stop lines:
 *                    edge a → b  ⇔  a must yield to b. Edge rules:
 *                      - emergency vehicle beats everyone
 *                      - roundabout: no mutual priority (ring handled in 2)
 *                      - signals / controller: left turn yields to oncoming
 *                        straight/right traffic
 *                      - signs: secondary yields to main road
 *                      - equal roads: right-hand rule + left turn yields to
 *                        oncoming straight/right traffic
 *                    A vehicle may go iff it has no outgoing edge, OR it sits
 *                    in a TERMINAL strongly-connected component of size > 1
 *                    (a genuine deadlock — drivers "agree", one proceeds).
 *                    SCCs via Tarjan's algorithm.
 *
 * Only vehicles whose trajectories actually conflict (precomputed zones) can
 * create an obligation, so puzzles stay fair and explainable.
 *
 * Every function here is PURE: no mutation, no I/O, no randomness — the same
 * code re-validates replays on the server.
 */

import { controllerPermits, type ControllerPlan } from './controller.js';
import { opposite, rightOf } from './dir.js';
import type { JunctionGeometry } from './junction.js';
import { TICK_HZ, timeAt } from './kinematics.js';
import { aspectAt, isGo, isRegulating, type SignalPlan } from './signals.js';
import type { GeometryKey, JunctionType, RegulationMode, SignType, Vehicle } from './types.js';

export type Verdict = 'go' | 'wait' | 'violation';

export type Reason =
  | 'not_found'
  | 'not_front'
  | 'not_ready'
  | 'locked'
  | 'controller'
  | 'red_light'
  | 'crossing_traffic'
  | 'roundabout_ring'
  | 'emergency'
  | 'main_road'
  | 'right_hand'
  | 'left_turn';

export interface MoveDecision {
  readonly allowed: boolean;
  readonly verdict: Verdict;
  readonly reason: Reason | null;
  /** Vehicles that had priority / would have been hit. */
  readonly culprits: readonly string[];
  /** True when the move is allowed only by deadlock resolution. */
  readonly deadlock: boolean;
}

export interface Layout {
  readonly type: JunctionType;
  readonly geometry: GeometryKey;
  readonly armEnabled: readonly boolean[];
  readonly sign: readonly SignType[];
  /** 2 = main road, 1 = unsigned, 0 = yield/stop. */
  readonly priority: readonly number[];
  readonly hasPrioritySigns: boolean;
  readonly signals: SignalPlan | null;
  readonly controller: ControllerPlan | null;
  readonly stopU: number;
}

export interface IntersectionState {
  readonly tick: number;
  readonly layout: Layout;
  readonly junction: JunctionGeometry;
  readonly vehicles: readonly Vehicle[];
  /** Per arm, the vehicles still in the lane, front first. */
  readonly queues: readonly (readonly Vehicle[])[];
  readonly byId: ReadonlyMap<string, Vehicle>;
}

/** An approaching front vehicle this close to the stop line already has its rights. */
export const PRESENT_U = 1.2;
/** Safety margin between occupancy windows (seconds). */
export const TIME_MARGIN = 0.12;

const REASON_RANK: Partial<Record<Reason, number>> = {
  emergency: 4,
  main_road: 3,
  right_hand: 2,
  left_turn: 1,
};

function decision(
  verdict: Verdict,
  reason: Reason | null,
  culprits: readonly string[] = [],
  deadlock = false,
): MoveDecision {
  return { allowed: verdict === 'go', verdict, reason, culprits, deadlock };
}

export function regulationMode(layout: Layout, tick: number): RegulationMode {
  if (layout.controller) return 'controller';
  if (layout.signals && isRegulating(layout.signals, tick)) return 'signal';
  if (layout.type === 'roundabout') return 'roundabout';
  if (layout.hasPrioritySigns) return 'priority';
  return 'equal';
}

/** Is `o` currently allowed to move by the regulation (so others must respect it)? */
export function isActive(o: Vehicle, mode: RegulationMode, layout: Layout, tick: number): boolean {
  if (o.emergency) return true;
  if (mode === 'controller') return controllerPermits(layout.controller!, tick, o.from, o.turn);
  if (mode === 'signal') return isGo(aspectAt(layout.signals!, o.from, tick));
  return true;
}

/** Front vehicles standing at (or just arriving at) their stop lines. */
export function presentVehicles(state: IntersectionState): Vehicle[] {
  const out: Vehicle[] = [];
  const stopU = state.layout.stopU;
  for (const q of state.queues) {
    const f = q[0];
    if (!f) continue;
    if (f.state === 'waiting' || (f.state === 'approaching' && f.u - stopU <= PRESENT_U)) out.push(f);
  }
  return out;
}

function leftTurnRule(a: Vehicle, b: Vehicle): Reason | null {
  return a.turn === 'left' && b.from === opposite(a.from) && b.turn !== 'left' ? 'left_turn' : null;
}

function equalRoadRule(a: Vehicle, b: Vehicle): Reason | null {
  if (b.from === rightOf(a.from)) return 'right_hand';
  return leftTurnRule(a, b);
}

/** Must `a` yield to `b`? Returns the rule that obliges it, or null. */
export function mustYield(
  a: Vehicle,
  b: Vehicle,
  mode: RegulationMode,
  layout: Layout,
  junction: JunctionGeometry,
): Reason | null {
  if (a.from === b.from) return null;
  if (!junction.conflict(a.move, b.move)) return null;
  if (b.emergency && !a.emergency) return 'emergency';
  if (a.emergency && !b.emergency) return null;
  const both = a.emergency && b.emergency;
  switch (mode) {
    case 'controller':
    case 'signal':
      return both ? equalRoadRule(a, b) : leftTurnRule(a, b);
    case 'roundabout':
      return both ? equalRoadRule(a, b) : null;
    case 'priority': {
      if (!both) {
        const pa = layout.priority[a.from];
        const pb = layout.priority[b.from];
        if (pa < pb) return 'main_road';
        if (pa > pb) return null;
      }
      return equalRoadRule(a, b);
    }
    case 'equal':
      return equalRoadRule(a, b);
  }
}

/**
 * Space-time check: vehicles already in the junction whose conflict-zone
 * occupancy window would overlap ours if we started NOW.
 */
export function spaceTimeConflicts(v: Vehicle, state: IntersectionState): string[] {
  const out: string[] = [];
  for (const x of state.vehicles) {
    if (x === v || (x.state !== 'crossing' && x.state !== 'exiting')) continue;
    if (x.from === v.from) continue; // same lane: identical profiles, follower can never catch up
    const z = state.junction.conflict(v.move, x.move);
    if (!z) continue;
    const rel = (x.startTick - state.tick) / TICK_HZ;
    const aStart = timeAt(z.a0);
    const aEnd = timeAt(z.a1 + v.length);
    const bStart = rel + timeAt(z.b0);
    const bEnd = rel + timeAt(z.b1 + x.length);
    if (aStart < bEnd + TIME_MARGIN && bStart < aEnd + TIME_MARGIN) out.push(x.id);
  }
  return out;
}

/** Tarjan's strongly-connected components. Returns component id per node. */
export function tarjanScc(n: number, adj: readonly (readonly number[])[]): number[] {
  const index = new Array<number>(n).fill(-1);
  const low = new Array<number>(n).fill(0);
  const onStack = new Array<boolean>(n).fill(false);
  const comp = new Array<number>(n).fill(-1);
  const stack: number[] = [];
  let counter = 0;
  let compCount = 0;
  const visit = (u: number): void => {
    index[u] = low[u] = counter++;
    stack.push(u);
    onStack[u] = true;
    for (const w of adj[u]) {
      if (index[w] < 0) {
        visit(w);
        low[u] = Math.min(low[u], low[w]);
      } else if (onStack[w]) {
        low[u] = Math.min(low[u], index[w]);
      }
    }
    if (low[u] === index[u]) {
      for (;;) {
        const w = stack.pop()!;
        onStack[w] = false;
        comp[w] = compCount;
        if (w === u) break;
      }
      compCount++;
    }
  };
  for (let u = 0; u < n; u++) if (index[u] < 0) visit(u);
  return comp;
}

export interface YieldGraph {
  readonly nodes: readonly Vehicle[];
  readonly adj: readonly (readonly number[])[];
  readonly reasons: ReadonlyMap<number, Reason>;
}

/** Build the right-of-way graph among the active vehicles present at stop lines. */
export function buildYieldGraph(state: IntersectionState, mode: RegulationMode, extra?: Vehicle): YieldGraph {
  const nodes = presentVehicles(state).filter((o) => isActive(o, mode, state.layout, state.tick));
  if (extra && !nodes.includes(extra)) nodes.push(extra);
  const n = nodes.length;
  const adj: number[][] = nodes.map(() => []);
  const reasons = new Map<number, Reason>();
  for (let a = 0; a < n; a++) {
    for (let b = 0; b < n; b++) {
      if (a === b) continue;
      const r = mustYield(nodes[a], nodes[b], mode, state.layout, state.junction);
      if (r) {
        adj[a].push(b);
        reasons.set(a * n + b, r);
      }
    }
  }
  return { nodes, adj, reasons };
}

/**
 * THE validation function.
 */
export function canVehicleMove(vehicleId: string, state: IntersectionState): MoveDecision {
  const v = state.byId.get(vehicleId);
  if (!v) return decision('wait', 'not_found');

  // --- 0. readiness (soft) ------------------------------------------------
  if (v.state === 'queued') return decision('wait', 'not_front');
  if (v.state !== 'waiting') return decision('wait', 'not_ready');
  if (state.tick < v.lockUntil) return decision('wait', 'locked');

  const { layout, tick } = state;
  const mode = regulationMode(layout, tick);

  // --- 1. regulation --------------------------------------------------------
  if (!v.emergency) {
    if (mode === 'controller' && !controllerPermits(layout.controller!, tick, v.from, v.turn)) {
      return decision('violation', 'controller');
    }
    if (mode === 'signal' && !isGo(aspectAt(layout.signals!, v.from, tick))) {
      return decision('violation', 'red_light');
    }
  }

  // --- 2. space-time collision with vehicles already crossing ---------------
  const hits = spaceTimeConflicts(v, state);
  if (hits.length > 0) {
    return decision('violation', mode === 'roundabout' ? 'roundabout_ring' : 'crossing_traffic', hits);
  }

  // --- 3. right-of-way graph ------------------------------------------------
  const g = buildYieldGraph(state, mode, v);
  const vi = g.nodes.indexOf(v);
  const out = g.adj[vi];
  if (out.length === 0) return decision('go', null);

  const comp = tarjanScc(g.nodes.length, g.adj);
  const c = comp[vi];
  let size = 0;
  let terminal = true;
  for (let i = 0; i < g.nodes.length; i++) {
    if (comp[i] !== c) continue;
    size++;
    for (const j of g.adj[i]) if (comp[j] !== c) terminal = false;
  }
  if (size > 1 && terminal) return decision('go', null, [], true);

  let best: Reason = 'left_turn';
  for (const j of out) {
    const r = g.reasons.get(vi * g.nodes.length + j)!;
    if ((REASON_RANK[r] ?? 0) > (REASON_RANK[best] ?? 0)) best = r;
  }
  return decision(
    'violation',
    best,
    out.map((j) => g.nodes[j].id),
  );
}
