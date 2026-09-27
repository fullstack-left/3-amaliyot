/**
 * Traffic controller (regulirovshik) — boss levels.
 *
 * Real CIS/Uzbek traffic-controller signals, relative to the controller's body:
 *
 *   arms_side (arms extended sideways or lowered):
 *     from his LEFT and RIGHT sides → straight and right turn allowed
 *     from his CHEST and BACK       → everything prohibited
 *   right_forward (right arm extended forward):
 *     from his LEFT side  → all directions allowed
 *     from his CHEST      → right turn only
 *     from his RIGHT side and BACK → prohibited
 *   arm_up (arm raised):
 *     everything prohibited (like amber)
 *
 * Controller signals override traffic lights and priority signs.
 */

import { dirFromLetter, opposite, rot } from './dir.js';
import { msToTicks } from './kinematics.js';
import type { BodySide, ControllerDef, Dir, Gesture, Turn } from './types.js';

export interface ControllerPose {
  readonly gesture: Gesture;
  readonly facing: Dir;
  readonly start: number;
  readonly ticks: number;
}

export interface ControllerPlan {
  readonly poses: readonly ControllerPose[];
  readonly cycle: number;
}

export function buildController(def: ControllerDef): ControllerPlan {
  const poses: ControllerPose[] = [];
  let t = 0;
  for (const p of def.poses) {
    const ticks = Math.max(1, msToTicks(p.ms));
    poses.push({ gesture: p.gesture, facing: dirFromLetter(p.facing), start: t, ticks });
    t += ticks;
  }
  return { poses, cycle: Math.max(1, t) };
}

export interface ActivePose {
  readonly pose: ControllerPose;
  readonly index: number;
  /** Ticks remaining in this pose. */
  readonly remaining: number;
}

export function poseAt(plan: ControllerPlan, tick: number): ActivePose {
  const pos = ((tick % plan.cycle) + plan.cycle) % plan.cycle;
  for (let i = 0; i < plan.poses.length; i++) {
    const p = plan.poses[i];
    if (pos < p.start + p.ticks) return { pose: p, index: i, remaining: p.start + p.ticks - pos };
  }
  const last = plan.poses[plan.poses.length - 1];
  return { pose: last, index: plan.poses.length - 1, remaining: 1 };
}

/**
 * Which side of the controller's body faces traffic arriving from `from`.
 * A person facing north has his right hand pointing east → right side = facing + 1.
 */
export function bodySide(facing: Dir, from: Dir): BodySide {
  if (from === facing) return 'chest';
  if (from === opposite(facing)) return 'back';
  return from === rot(facing, 1) ? 'right' : 'left';
}

export function gesturePermits(gesture: Gesture, side: BodySide, turn: Turn): boolean {
  switch (gesture) {
    case 'arm_up':
      return false;
    case 'arms_side':
      return (side === 'left' || side === 'right') && turn !== 'left';
    case 'right_forward':
      if (side === 'left') return true;
      if (side === 'chest') return turn === 'right';
      return false;
  }
}

export function controllerPermits(plan: ControllerPlan, tick: number, from: Dir, turn: Turn): boolean {
  const { pose } = poseAt(plan, tick);
  return gesturePermits(pose.gesture, bodySide(pose.facing, from), turn);
}

/** Does ANY pose of the script ever permit this movement? (level validation) */
export function everPermits(plan: ControllerPlan, from: Dir, turn: Turn): boolean {
  return plan.poses.some((p) => gesturePermits(p.gesture, bodySide(p.facing, from), turn));
}
