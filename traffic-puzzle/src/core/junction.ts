/**
 * Junction geometry + precomputed conflict zones.
 * ==============================================
 *
 * For every movement (arm × turn) we build the exact trajectory a vehicle's
 * FRONT bumper follows: stop line → through the junction → exit lane → despawn.
 *
 * Then, for every ordered pair of movements from different arms, we compute a
 * CONFLICT ZONE by sampling both paths and finding where their centre lines come
 * closer than CLEAR_DIST (≈ vehicle width + margin):
 *
 *   - "cross": trajectories intersect at an angle → the zone is the whole
 *     overlapping stretch on each path.
 *   - "merge": trajectories become co-directional (same exit lane, or the
 *     roundabout ring) → the zone is cut to the merge point + MERGE_LEN, after
 *     which the vehicles simply follow each other.
 *
 * Zones are expressed as arc-length intervals [a0, a1] on path A and [b0, b1]
 * on path B. The rule engine turns them into time windows (space-time check).
 * All of this is computed ONCE per geometry and cached → O(1) lookups at runtime.
 */

import {
  DIRS,
  DIR_VEC,
  MOVEMENTS,
  TURNS,
  angleDiff,
  armAngle,
  exitOf,
  inLane,
  movementFrom,
  movementIndex,
  outLane,
} from './dir.js';
import { Path, PathBuilder } from './path.js';
import type { Dir, GeometryKey, JunctionType, Turn } from './types.js';

/** Cross junction: box half-size (one lane per direction) and stop line. */
export const CROSS = {
  box: 1,
  stopU: 1.75,
  crosswalkNear: 1.08,
  crosswalkFar: 1.62,
} as const;

/** Roundabout dimensions. */
export const RB = {
  island: 1.45,
  ring: 2.1,
  outer: 2.65,
  /** Where the entry/exit curves meet the straight arm lanes. */
  curveU: 3.2,
  stopU: 3.8,
  /** Angular offset of entry/exit points from the arm axis (radians). */
  delta: 0.62,
} as const;

export const DESPAWN_U = 13.5;
export const CLEAR_DIST = 0.72;
export const CODIR_ANGLE = 0.44; // ≈ 25°
export const MERGE_LEN = 1.2;
export const ZONE_EXT = 1.5;
/** Front bumper this far past the junction exit ⇒ vehicle counts as cleared. */
export const CLEARED_AFTER_EXIT = 1.2;

export interface ConflictZone {
  readonly a0: number;
  readonly a1: number;
  readonly b0: number;
  readonly b1: number;
  readonly kind: 'cross' | 'merge';
}

export function geometryFor(type: JunctionType, hasController: boolean): GeometryKey {
  if (type === 'roundabout') return 'roundabout';
  return hasController ? 'cross_ctrl' : 'cross';
}

// ---------------------------------------------------------------------------
// Path construction
// ---------------------------------------------------------------------------

function buildCrossPath(from: Dir, turn: Turn, ctrl: boolean): Path {
  const B = CROSS.box;
  const to = exitOf(from, turn);
  const [x0, y0] = inLane(from, CROSS.stopU);
  const b = new PathBuilder(x0, y0);
  const [ex, ey] = inLane(from, B);
  b.lineTo(ex, ey).mark('enter');
  const [ox, oy] = outLane(to, B);
  const [dx, dy] = DIR_VEC[from];
  if (turn === 'straight') {
    b.lineTo(ox, oy);
  } else if (turn === 'right') {
    // Hug the near corner: quarter circle r = 0.5.
    b.arcTo((dx + dy) * B, (dy - dx) * B, ox, oy);
  } else if (!ctrl) {
    // Natural left turn: quarter circle r = 1.5 around the far-left corner.
    b.arcTo((dx - dy) * B, (dy + dx) * B, ox, oy);
  } else {
    // Controller in the centre: drive around him (r = 0.5 around the origin).
    const [mx, my] = inLane(from, 0);
    b.lineTo(mx, my);
    const [nx, ny] = outLane(to, 0);
    b.arcTo(0, 0, nx, ny);
    b.lineTo(ox, oy);
  }
  b.mark('exit');
  const [fx, fy] = outLane(to, DESPAWN_U);
  b.lineTo(fx, fy);
  return b.build();
}

function buildRoundaboutPath(from: Dir, turn: Turn): Path {
  const to = exitOf(from, turn);
  const R = RB.ring;
  const K = 0.6;
  const [x0, y0] = inLane(from, RB.stopU);
  const b = new PathBuilder(x0, y0);
  const [cx0, cy0] = inLane(from, RB.curveU);
  b.lineTo(cx0, cy0).mark('enter');

  // Right-hand traffic circulates counter-clockwise on the map = decreasing θ
  // in the y-down world. Entry point is "downstream" of the arm axis, exit
  // point "upstream" (a circulating car passes an arm's exit before its entry).
  const thIn = armAngle(from) - RB.delta;
  const thOut = armAngle(to) + RB.delta;
  let sweep = (thIn - thOut) % (2 * Math.PI);
  if (sweep < 0) sweep += 2 * Math.PI;
  if (sweep < 1e-6) sweep += 2 * Math.PI;

  const pInX = R * Math.cos(thIn);
  const pInY = R * Math.sin(thIn);
  const tInX = Math.sin(thIn);
  const tInY = -Math.cos(thIn);
  const [hx, hy] = DIR_VEC[from];
  b.bezierTo(cx0 - hx * K, cy0 - hy * K, pInX - tInX * K, pInY - tInY * K, pInX, pInY);
  b.mark('ring');
  b.arc(0, 0, R, thIn, thIn - sweep);
  b.mark('ringEnd');

  const pOutX = R * Math.cos(thOut);
  const pOutY = R * Math.sin(thOut);
  const tOutX = Math.sin(thOut);
  const tOutY = -Math.cos(thOut);
  const [qx, qy] = outLane(to, RB.curveU);
  const [ox, oy] = DIR_VEC[to];
  b.bezierTo(pOutX + tOutX * K, pOutY + tOutY * K, qx - ox * K, qy - oy * K, qx, qy);
  b.mark('exit');
  const [fx, fy] = outLane(to, DESPAWN_U);
  b.lineTo(fx, fy);
  return b.build();
}

// ---------------------------------------------------------------------------
// Conflict zones
// ---------------------------------------------------------------------------

function round4(v: number): number {
  return Math.round(v * 1e4) / 1e4;
}

/** Zone between A and B, oriented (a* on A, b* on B), or null if they never meet. */
export function computeZone(A: Path, B: Path): ConflictZone | null {
  const endA = Math.min(A.n - 1, Math.ceil((A.mark('exit') + ZONE_EXT) / A.step));
  const endB = Math.min(B.n - 1, Math.ceil((B.mark('exit') + ZONE_EXT) / B.step));
  const c2 = CLEAR_DIST * CLEAR_DIST;
  const ax = A.xs;
  const ay = A.ys;
  const bx = B.xs;
  const by = B.ys;
  let minI = Infinity;
  let maxI = -1;
  let minJ = Infinity;
  let maxJ = -1;
  let mI = -1;
  let mJ = -1;
  let mKey = Infinity;
  for (let i = 0; i <= endA; i++) {
    const x = ax[i];
    const y = ay[i];
    for (let j = 0; j <= endB; j++) {
      const dx = x - bx[j];
      if (dx > CLEAR_DIST || dx < -CLEAR_DIST) continue;
      const dy = y - by[j];
      if (dx * dx + dy * dy >= c2) continue;
      if (i < minI) minI = i;
      if (i > maxI) maxI = i;
      if (j < minJ) minJ = j;
      if (j > maxJ) maxJ = j;
      if (i + j < mKey && Math.abs(angleDiff(A.hs[i], B.hs[j])) < CODIR_ANGLE) {
        mKey = i + j;
        mI = i;
        mJ = j;
      }
    }
  }
  if (maxI < 0) return null;
  const merge = mI >= 0;
  const cells = Math.round(MERGE_LEN / A.step);
  const a1 = merge ? Math.min(maxI, mI + cells) : maxI;
  const b1 = merge ? Math.min(maxJ, mJ + cells) : maxJ;
  return {
    a0: round4(minI * A.step),
    a1: round4(a1 * A.step),
    b0: round4(minJ * B.step),
    b1: round4(b1 * B.step),
    kind: merge ? 'merge' : 'cross',
  };
}

// ---------------------------------------------------------------------------
// Geometry object (cached)
// ---------------------------------------------------------------------------

export class JunctionGeometry {
  readonly stopU: number;
  readonly paths: readonly Path[];
  private readonly zones: (ConflictZone | null)[];
  private readonly clear: Float64Array;

  constructor(readonly key: GeometryKey) {
    this.stopU = key === 'roundabout' ? RB.stopU : CROSS.stopU;
    const paths: Path[] = [];
    for (const from of DIRS) {
      for (const turn of TURNS) {
        paths[movementIndex(from, turn)] =
          key === 'roundabout'
            ? buildRoundaboutPath(from, turn)
            : buildCrossPath(from, turn, key === 'cross_ctrl');
      }
    }
    this.paths = paths;
    this.clear = new Float64Array(MOVEMENTS);
    for (let m = 0; m < MOVEMENTS; m++) this.clear[m] = paths[m].mark('exit') + CLEARED_AFTER_EXIT;

    this.zones = new Array<ConflictZone | null>(MOVEMENTS * MOVEMENTS).fill(null);
    for (let a = 0; a < MOVEMENTS; a++) {
      for (let b = a + 1; b < MOVEMENTS; b++) {
        if (movementFrom(a) === movementFrom(b)) continue; // same lane → queue handles it
        const z = computeZone(paths[a], paths[b]);
        if (!z) continue;
        this.zones[a * MOVEMENTS + b] = z;
        this.zones[b * MOVEMENTS + a] = { a0: z.b0, a1: z.b1, b0: z.a0, b1: z.a1, kind: z.kind };
      }
    }
  }

  /** Oriented conflict zone between movement `ma` (A) and `mb` (B), or null. */
  conflict(ma: number, mb: number): ConflictZone | null {
    return this.zones[ma * MOVEMENTS + mb];
  }

  /** Arc length at which a vehicle on movement `m` counts as cleared. */
  clearS(m: number): number {
    return this.clear[m];
  }
}

const CACHE = new Map<GeometryKey, JunctionGeometry>();

export function getJunction(key: GeometryKey): JunctionGeometry {
  let g = CACHE.get(key);
  if (!g) {
    g = new JunctionGeometry(key);
    CACHE.set(key, g);
  }
  return g;
}
