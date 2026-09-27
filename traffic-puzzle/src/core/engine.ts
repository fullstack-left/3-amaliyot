/**
 * GameEngine — deterministic 60 Hz simulation.
 * ============================================
 *
 * Owns the hot, per-tick state: vehicles, lanes (queues), clock, lives.
 * Exposes two intents:
 *   - tap(id)  → validates with canVehicleMove, then departs / penalises
 *   - step()   → advances exactly one tick (1/60 s)
 * and emits typed EngineEvents for UI / audio / analytics.
 *
 * The engine implements IntersectionState, so it can be handed directly to the
 * pure rule functions. It never touches the DOM.
 *
 * Replay contract: a tap recorded as [t, id] is applied when engine.tick === t,
 * before the next step(). Same taps ⇒ same outcome, on any platform.
 */

import { DIRS, exitOf, movementIndex } from './dir.js';
import { DESPAWN_U, getJunction, type JunctionGeometry } from './junction.js';
import {
  distAt,
  Q_ACCEL,
  Q_DECEL,
  Q_GAP,
  Q_MIN_GAP,
  Q_VMAX,
  TICK_HZ,
  ticksToMs,
} from './kinematics.js';
import type { Level } from './level.js';
import { poseAt, type ActivePose } from './controller.js';
import {
  canVehicleMove,
  regulationMode,
  type IntersectionState,
  type Layout,
  type MoveDecision,
  type Reason,
} from './rules.js';
import { aspectAt, ticksUntilChange } from './signals.js';
import type { Aspect, Dir, RegulationMode, Vehicle } from './types.js';
import { computeStars } from './scoring.js';
import { HERO_BONUS, VEHICLE_SPECS } from './vehicles.js';

export const LOCK_TICKS = 40;
export const FLASH_TICKS = 78;

export interface LevelResult {
  readonly levelId: number;
  readonly completed: boolean;
  readonly ticks: number;
  readonly timeMs: number;
  readonly mistakes: number;
  readonly livesLeft: number;
  readonly cleared: number;
  readonly total: number;
  readonly vehicleCoins: number;
  readonly stars: number;
  readonly parMs: number;
}

export type EngineEvent =
  | { readonly type: 'depart'; readonly id: string; readonly tick: number; readonly deadlock: boolean }
  | { readonly type: 'blocked'; readonly id: string; readonly reason: Reason; readonly tick: number }
  | {
      readonly type: 'penalty';
      readonly id: string;
      readonly reason: Reason;
      readonly culprits: readonly string[];
      readonly lives: number;
      readonly tick: number;
    }
  | { readonly type: 'cleared'; readonly id: string; readonly coins: number; readonly tick: number }
  | { readonly type: 'arrive'; readonly id: string; readonly tick: number }
  | { readonly type: 'won'; readonly result: LevelResult }
  | { readonly type: 'lost'; readonly result: LevelResult };

export interface EngineOptions {
  /** Override the level's par time (ms) used for the "fast" star. */
  parMs?: number;
}

export type EngineStatus = 'playing' | 'won' | 'lost';

export class GameEngine implements IntersectionState {
  tick = 0;
  readonly level: Level;
  readonly layout: Layout;
  readonly junction: JunctionGeometry;
  readonly vehicles: Vehicle[] = [];
  readonly queues: Vehicle[][] = [[], [], [], []];
  readonly byId = new Map<string, Vehicle>();
  /** State-changing taps only (go / violation) — this IS the replay. */
  readonly taps: [number, string][] = [];
  readonly parMs: number;

  lives: number;
  mistakes = 0;
  cleared = 0;
  vehicleCoins = 0;
  status: EngineStatus = 'playing';
  endTick = -1;

  private readonly pending: Vehicle[] = [];
  private readonly lastDeparted: (Vehicle | null)[] = [null, null, null, null];
  private readonly listeners: ((e: EngineEvent) => void)[] = [];

  constructor(level: Level, opts: EngineOptions = {}) {
    this.level = level;
    this.layout = level.layout;
    this.junction = getJunction(level.layout.geometry);
    this.lives = level.lives;
    this.parMs = opts.parMs ?? level.parMs ?? Number.POSITIVE_INFINITY;

    for (const sp of level.spawns) {
      const spec = VEHICLE_SPECS[sp.kind];
      const v: Vehicle = {
        id: sp.id,
        idx: sp.idx,
        kind: sp.kind,
        from: sp.from,
        turn: sp.turn,
        to: exitOf(sp.from, sp.turn),
        move: movementIndex(sp.from, sp.turn),
        length: spec.length,
        width: spec.width,
        emergency: spec.emergency,
        hero: sp.hero,
        spawnTick: sp.initial ? 0 : sp.atTick,
        state: sp.initial ? 'queued' : 'hidden',
        u: DESPAWN_U,
        speed: 0,
        s: 0,
        startTick: -1,
        flashUntil: -1,
        lockUntil: -1,
        clearedTick: -1,
      };
      this.vehicles.push(v);
      this.byId.set(v.id, v);
      if (sp.initial) this.queues[sp.from].push(v);
      else this.pending.push(v);
    }
    this.pending.sort((a, b) => a.spawnTick - b.spawnTick || a.idx - b.idx);

    const stopU = this.layout.stopU;
    for (const d of DIRS) {
      let u = stopU;
      this.queues[d].forEach((v, k) => {
        v.u = u;
        v.state = k === 0 ? 'waiting' : 'queued';
        u += v.length + Q_GAP;
      });
    }
  }

  // --- events ----------------------------------------------------------------
  on(fn: (e: EngineEvent) => void): () => void {
    this.listeners.push(fn);
    return () => {
      const i = this.listeners.indexOf(fn);
      if (i >= 0) this.listeners.splice(i, 1);
    };
  }

  private emit(e: EngineEvent): void {
    for (const l of this.listeners) l(e);
  }

  // --- queries (renderer / HUD) ---------------------------------------------
  get total(): number {
    return this.vehicles.length;
  }

  mode(): RegulationMode {
    return regulationMode(this.layout, this.tick);
  }

  aspect(d: Dir): Aspect | null {
    return this.layout.signals ? aspectAt(this.layout.signals, d, this.tick) : null;
  }

  aspectCountdown(d: Dir): number {
    return this.layout.signals ? ticksUntilChange(this.layout.signals, d, this.tick) : 0;
  }

  pose(): ActivePose | null {
    return this.layout.controller ? poseAt(this.layout.controller, this.tick) : null;
  }

  preview(id: string): MoveDecision {
    return canVehicleMove(id, this);
  }

  timeMs(): number {
    return ticksToMs(this.endTick >= 0 ? this.endTick : this.tick);
  }

  result(): LevelResult {
    const ticks = this.endTick >= 0 ? this.endTick : this.tick;
    const timeMs = ticksToMs(ticks);
    const completed = this.status === 'won';
    return {
      levelId: this.level.id,
      completed,
      ticks,
      timeMs,
      mistakes: this.mistakes,
      livesLeft: this.lives,
      cleared: this.cleared,
      total: this.vehicles.length,
      vehicleCoins: this.vehicleCoins,
      stars: completed ? computeStars(this.mistakes, timeMs, this.parMs) : 0,
      parMs: this.parMs,
    };
  }

  // --- intent: tap ----------------------------------------------------------
  tap(id: string): MoveDecision {
    const d = canVehicleMove(id, this);
    if (this.status !== 'playing') return { ...d, allowed: false, verdict: 'wait', reason: 'not_ready' };
    const v = this.byId.get(id);
    if (!v) return d;

    if (d.verdict === 'go') {
      this.taps.push([this.tick, id]);
      v.state = 'crossing';
      v.startTick = this.tick;
      v.s = 0;
      v.speed = 0;
      const q = this.queues[v.from];
      const i = q.indexOf(v);
      if (i >= 0) q.splice(i, 1);
      this.lastDeparted[v.from] = v;
      this.emit({ type: 'depart', id, tick: this.tick, deadlock: d.deadlock });
    } else if (d.verdict === 'violation') {
      this.taps.push([this.tick, id]);
      this.lives--;
      this.mistakes++;
      v.lockUntil = this.tick + LOCK_TICKS;
      v.flashUntil = this.tick + FLASH_TICKS;
      for (const c of d.culprits) {
        const o = this.byId.get(c);
        if (o) o.flashUntil = this.tick + FLASH_TICKS;
      }
      this.emit({ type: 'penalty', id, reason: d.reason!, culprits: d.culprits, lives: this.lives, tick: this.tick });
      if (this.lives <= 0) {
        this.status = 'lost';
        this.endTick = this.tick;
        this.emit({ type: 'lost', result: this.result() });
      }
    } else {
      this.emit({ type: 'blocked', id, reason: d.reason!, tick: this.tick });
    }
    return d;
  }

  // --- simulation -----------------------------------------------------------
  step(): void {
    if (this.status !== 'playing') return;
    const t = ++this.tick;

    while (this.pending.length > 0 && this.pending[0].spawnTick <= t) this.spawn(this.pending.shift()!);

    for (const v of this.vehicles) {
      if (v.state !== 'crossing' && v.state !== 'exiting') continue;
      const path = this.junction.paths[v.move];
      v.s = distAt((t - v.startTick) / TICK_HZ);
      if (v.state === 'crossing' && v.s >= this.junction.clearS(v.move)) {
        v.state = 'exiting';
        v.clearedTick = t;
        this.cleared++;
        const coins = VEHICLE_SPECS[v.kind].coins + (v.hero ? HERO_BONUS : 0);
        this.vehicleCoins += coins;
        this.emit({ type: 'cleared', id: v.id, coins, tick: t });
      }
      if (v.s >= path.length) {
        v.s = path.length;
        v.state = 'gone';
      }
    }

    this.updateLanes();

    if (this.cleared === this.vehicles.length) {
      this.status = 'won';
      this.endTick = t;
      this.emit({ type: 'won', result: this.result() });
    }
  }

  /** Advance n ticks (stops early when the level ends). */
  stepMany(n: number): void {
    for (let i = 0; i < n && this.status === 'playing'; i++) this.step();
  }

  private spawn(v: Vehicle): void {
    const q = this.queues[v.from];
    const back = q[q.length - 1];
    v.u = Math.max(DESPAWN_U, back ? back.u + back.length + Q_GAP : 0);
    v.speed = Q_VMAX;
    v.state = 'queued';
    q.push(v);
    this.emit({ type: 'arrive', id: v.id, tick: this.tick });
  }

  /**
   * Lane kinematics: every vehicle drives toward its slot (front = stop line,
   * then one vehicle length + gap per place) with bounded acceleration and a
   * braking curve, never closer than Q_MIN_GAP to the vehicle ahead — including
   * the one that just departed while it is still on the incoming lane.
   */
  private updateLanes(): void {
    const dt = 1 / TICK_HZ;
    const stopU = this.layout.stopU;
    for (const d of DIRS) {
      const q = this.queues[d];
      let target = stopU;
      let leaderRear = Number.NEGATIVE_INFINITY;
      const lead = this.lastDeparted[d];
      if (lead && lead.state === 'crossing') leaderRear = stopU - lead.s + lead.length;
      for (let k = 0; k < q.length; k++) {
        const v = q[k];
        const dist = v.u - target;
        const desired = dist > 0 ? Math.min(Q_VMAX, Math.sqrt(2 * Q_DECEL * dist)) : 0;
        v.speed = v.speed < desired ? Math.min(desired, v.speed + Q_ACCEL * dt) : desired;
        let nu = v.u - v.speed * dt;
        if (nu < target) nu = target;
        const minU = leaderRear + Q_MIN_GAP;
        if (nu < minU) {
          nu = Math.min(v.u, Math.max(minU, target));
          v.speed = (v.u - nu) / dt;
        }
        v.u = nu;
        if (v.u - target < 1e-4 && v.speed < 0.05) {
          v.u = target;
          v.speed = 0;
        }
        if (k === 0) v.state = v.u === target && v.speed === 0 ? 'waiting' : 'approaching';
        else v.state = 'queued';
        leaderRear = v.u + v.length;
        target += v.length + Q_GAP;
      }
    }
  }
}
