/**
 * The Game Engine — orchestrates the simulation.
 * =============================================
 *
 * Responsibilities:
 *   - Advance the deterministic clock (drives lights + controller).
 *   - Animate CROSSING vehicles (progress 0→1) and retire them.
 *   - Promote the next car in a queue once the front car leaves (QUEUE MGMT).
 *   - Turn a player TAP into either a legal crossing or a collision/penalty,
 *     using the pure Rule Validation Engine.
 *   - Emit typed events (GameEvent) that the UI/audio layer subscribes to.
 *
 * The engine keeps its own IntersectionState and exposes intent methods
 * (`tap`, `update`). It NEVER touches the DOM/UI directly — it only emits
 * events. This is what makes it portable to React Native / Flutter.
 */

import { canVehicleMove } from './rules.js';
import { controllerPoseAt } from './controller.js';
import {
  hydrateLevel,
  isLevelComplete,
  remainingVehicles,
} from './level.js';
import {
  Direction,
  IntersectionState,
  LevelDefinition,
  MoveDecision,
  Vehicle,
  VehicleState,
} from './types.js';

/** How long (ms) a vehicle takes to cross the intersection. */
const CROSS_DURATION_MS = 900;
/** How long the crash/penalty freeze lasts before recovery. */
const CRASH_RECOVERY_MS = 1200;

export type GameEvent =
  | { type: 'MOVE_STARTED'; vehicleId: string }
  | { type: 'MOVE_COMPLETED'; vehicleId: string; coinsAwarded: number }
  | {
      type: 'COLLISION';
      vehicleId: string;
      decision: MoveDecision;
      livesRemaining: number;
    }
  | { type: 'ILLEGAL_TAP'; vehicleId: string; decision: MoveDecision } // denied w/o crash (e.g. red light)
  | { type: 'LEVEL_COMPLETE'; coins: number; timeMs: number }
  | { type: 'GAME_OVER' };

export interface EngineStatus {
  lives: number;
  coins: number;
  elapsedMs: number;
  crossingCount: number;
  remaining: number;
  isComplete: boolean;
  isGameOver: boolean;
  controllerPose?: string;
}

type Listener = (e: GameEvent) => void;

export class GameEngine {
  state: IntersectionState;
  lives: number;
  coins = 0;
  private crashTimers = new Map<string, number>();
  private listeners = new Set<Listener>();
  private complete = false;
  private gameOver = false;
  private levelDef: LevelDefinition;

  constructor(level: LevelDefinition) {
    this.levelDef = level;
    this.state = hydrateLevel(level);
    this.lives = level.lives;
  }

  // --- pub/sub ----------------------------------------------------------
  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  private emit(e: GameEvent) {
    for (const l of this.listeners) l(e);
  }

  // --- introspection ----------------------------------------------------
  getVehicles(): Vehicle[] {
    return Object.values(this.state.vehicles);
  }

  status(): EngineStatus {
    return {
      lives: this.lives,
      coins: this.coins,
      elapsedMs: this.state.clockMs,
      crossingCount: this.getVehicles().filter(
        (v) => v.state === VehicleState.CROSSING,
      ).length,
      remaining: remainingVehicles(this.state).length,
      isComplete: this.complete,
      isGameOver: this.gameOver,
      controllerPose: controllerPoseAt(this.state)?.name,
    };
  }

  /** Preview decision without committing — used to draw hints/tooltips. */
  preview(vehicleId: string): MoveDecision {
    return canVehicleMove(vehicleId, this.state);
  }

  // --- player intent ----------------------------------------------------
  /**
   * Handle a player tap on a vehicle.
   * Legal → the vehicle starts CROSSING.
   * Illegal + real path conflict → COLLISION (lose a life).
   * Illegal but harmless (red light, not-at-front) → ILLEGAL_TAP (no penalty).
   */
  tap(vehicleId: string): void {
    if (this.gameOver || this.complete) return;
    const v = this.state.vehicles[vehicleId];
    if (!v) return;

    const decision = canVehicleMove(vehicleId, this.state);
    if (decision.allowed) {
      v.state = VehicleState.CROSSING;
      v.progress = 0;
      this.emit({ type: 'MOVE_STARTED', vehicleId });
      return;
    }

    // Denied. If the denial involves conflicting vehicles present in the
    // intersection, it's a crash (penalty). Otherwise it's a soft illegal tap.
    if (decision.conflictsWith.length > 0) {
      this.triggerCollision(v, decision);
    } else {
      this.emit({ type: 'ILLEGAL_TAP', vehicleId, decision });
    }
  }

  private triggerCollision(v: Vehicle, decision: MoveDecision) {
    v.state = VehicleState.CRASHED;
    this.crashTimers.set(v.id, CRASH_RECOVERY_MS);
    for (const otherId of decision.conflictsWith) {
      const o = this.state.vehicles[otherId];
      if (o && (o.state === VehicleState.WAITING || o.state === VehicleState.CROSSING)) {
        o.state = VehicleState.CRASHED;
        this.crashTimers.set(o.id, CRASH_RECOVERY_MS);
      }
    }
    this.lives -= 1;
    this.emit({
      type: 'COLLISION',
      vehicleId: v.id,
      decision,
      livesRemaining: this.lives,
    });
    if (this.lives <= 0) {
      this.gameOver = true;
      this.emit({ type: 'GAME_OVER' });
    }
  }

  // --- simulation step --------------------------------------------------
  /**
   * Advance the world by `dtMs`. Call from a rAF/game loop with the frame
   * delta. Deterministic given the same dt sequence.
   */
  update(dtMs: number): void {
    if (this.gameOver || this.complete) return;
    this.state.clockMs += dtMs;

    // 1) progress crossing vehicles
    for (const v of this.getVehicles()) {
      if (v.state === VehicleState.CROSSING) {
        v.progress += dtMs / CROSS_DURATION_MS;
        if (v.progress >= 1) {
          v.progress = 1;
          v.state = VehicleState.CLEARED;
          const award = this.coinReward(v);
          this.coins += award;
          this.emit({ type: 'MOVE_COMPLETED', vehicleId: v.id, coinsAwarded: award });
          this.promoteQueue(v.from);
        }
      }
    }

    // 2) tick crash recovery timers
    for (const [id, remaining] of Array.from(this.crashTimers.entries())) {
      const left = remaining - dtMs;
      if (left <= 0) {
        this.crashTimers.delete(id);
        const v = this.state.vehicles[id];
        if (v && v.state === VehicleState.CRASHED) {
          // Recovered crashed cars go back to waiting/queued as appropriate.
          v.progress = 0;
          v.state = v.queueIndex === 0 ? VehicleState.WAITING : VehicleState.QUEUED;
        }
      } else {
        this.crashTimers.set(id, left);
      }
    }

    // 3) completion check
    if (!this.gameOver && isLevelComplete(this.state)) {
      this.complete = true;
      this.emit({
        type: 'LEVEL_COMPLETE',
        coins: this.coins,
        timeMs: this.state.clockMs,
      });
    }
  }

  /**
   * QUEUE MANAGEMENT: when the front car of an approach clears, shift the
   * remaining cars forward and promote the new front car to WAITING.
   */
  private promoteQueue(from: Direction): void {
    const queue = this.getVehicles()
      .filter(
        (v) =>
          v.from === from &&
          (v.state === VehicleState.QUEUED || v.state === VehicleState.WAITING),
      )
      .sort((a, b) => a.queueIndex - b.queueIndex);

    queue.forEach((v, idx) => {
      v.queueIndex = idx;
      v.state = idx === 0 ? VehicleState.WAITING : VehicleState.QUEUED;
    });
  }

  private coinReward(v: Vehicle): number {
    // Emergency/heavy vehicles are worth a little more — small economy hook.
    switch (v.kind) {
      case 'AMBULANCE':
      case 'FIRE_TRUCK':
        return 15;
      case 'BUS':
      case 'TRUCK':
        return 8;
      default:
        return 5;
    }
  }

  /** Restart the current level from scratch. */
  reset(): void {
    this.state = hydrateLevel(this.levelDef);
    this.lives = this.levelDef.lives;
    this.coins = 0;
    this.complete = false;
    this.gameOver = false;
    this.crashTimers.clear();
  }
}
