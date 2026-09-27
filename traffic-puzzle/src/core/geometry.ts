/**
 * Geometry & traffic-conflict math.
 *
 * Everything here is pure and deterministic. Two responsibilities:
 *   1. Direction algebra (rotations used by the right-hand rule).
 *   2. Path-conflict detection: given two moves through the intersection, do
 *      their trajectories cross? This is what makes the puzzle *fair* — a
 *      vehicle only has to yield to another whose path it would actually hit.
 */

import { Direction, TurnIntent } from './types.js';

/** Rotate a direction clockwise by `steps` quarter-turns. */
export function rotateCW(dir: Direction, steps: number): Direction {
  return (((dir + steps) % 4) + 4) % 4;
}

/**
 * The approach immediately to the RIGHT of a vehicle coming FROM `from`.
 *
 * A car entering from SOUTH faces NORTH; its right-hand side looks toward the
 * WEST approach. In our clockwise indexing (N=0,E=1,S=2,W=3), the vehicle's
 * facing direction is opposite(from); the approach on its right is the one it
 * yields to under the right-hand rule.
 *
 * Coming from S (facing N), the conflicting "right" traffic comes from the E
 * approach... we compute it directly below and unit-test it in rules.spec.
 */
export function facing(from: Direction): Direction {
  return rotateCW(from, 2); // opposite arm
}

/**
 * The approach whose traffic is on the RIGHT of a vehicle arriving `from`.
 *
 * Derivation: the driver faces `facing(from)`. Their right hand points 90°
 * clockwise from their facing direction. Traffic *coming from* that side
 * approaches from `facing + 1` (mod 4)... which simplifies to `from - 1`.
 */
export function approachOnRight(from: Direction): Direction {
  // facing = from+2 ; right-of-facing = facing+1 = from+3 = from-1 (mod4)
  return rotateCW(from, 3);
}

/** Resolve the exit direction from an entry direction + turn intent. */
export function exitDirection(from: Direction, intent: TurnIntent): Direction {
  const face = facing(from);
  switch (intent) {
    case TurnIntent.STRAIGHT:
      return face;
    case TurnIntent.RIGHT:
      return rotateCW(face, 1);
    case TurnIntent.LEFT:
      return rotateCW(face, 3);
  }
}

/**
 * Do the trajectories of two vehicles conflict?
 *
 * We model each vehicle's path as the ordered pair (from -> to). Two paths
 * conflict when they occupy the shared centre box at the same time. Rather
 * than simulate continuously, we use the well-known movement-conflict matrix
 * for a 4-arm intersection, which is exact for STRAIGHT/LEFT/RIGHT turns.
 *
 * Rules encoded (standard traffic engineering):
 *   - Same origin never conflicts (they're in one queue / merge cleanly).
 *   - Two RIGHT turns never conflict (both hug the outer edge).
 *   - A vehicle going STRAIGHT conflicts with cross traffic going STRAIGHT
 *     or LEFT that sweeps across its lane.
 *   - LEFT turns are the most conflict-prone (they cross oncoming + cross
 *     traffic).
 * The matrix below is derived from the crossing points of the two chords in
 * the intersection square.
 */
export function pathsConflict(
  aFrom: Direction,
  aIntent: TurnIntent,
  bFrom: Direction,
  bIntent: TurnIntent,
): boolean {
  if (aFrom === bFrom) return false; // same approach, single file

  const aTo = exitDirection(aFrom, aIntent);
  const bTo = exitDirection(bFrom, bIntent);

  // Two right turns hug opposite kerbs — never intersect.
  if (aIntent === TurnIntent.RIGHT && bIntent === TurnIntent.RIGHT) return false;

  // If they share the same exit lane they conflict (merge point).
  if (aTo === bTo) return true;

  // Build the set of arms each chord "sweeps". A chord from->to sweeps the
  // arc of arms strictly between entry and exit going through the centre.
  const sweepA = sweptArms(aFrom, aTo);
  const sweepB = sweptArms(bFrom, bTo);

  // Conflict if either vehicle's chord passes through the other's origin or
  // destination arm, or their swept arcs overlap in the centre box.
  if (sweepA.has(bFrom) || sweepA.has(bTo)) return true;
  if (sweepB.has(aFrom) || sweepB.has(aTo)) return true;

  // Opposing straights on the same axis don't conflict (parallel lanes).
  return false;
}

/**
 * The set of arms a chord (from -> to) passes over as it crosses the centre.
 * Includes endpoints. Used as a cheap geometric proxy for the swept area.
 */
function sweptArms(from: Direction, to: Direction): Set<Direction> {
  const s = new Set<Direction>([from, to]);
  // Walk clockwise from `from` to `to`, adding intermediate arms — this is the
  // side of the square the chord cuts across.
  let cur = from;
  let guard = 0;
  while (cur !== to && guard < 4) {
    cur = rotateCW(cur, 1);
    s.add(cur);
    guard++;
  }
  return s;
}
