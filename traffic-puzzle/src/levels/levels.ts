/**
 * Level design — 1..50 progression + boss levels.
 * ===============================================
 *
 * Levels are plain data (LevelDefinition), so designers can author them by
 * hand or export from a tool. Below we provide:
 *   - A handful of hand-tuned tutorial levels (1-3) with exact wording.
 *   - A deterministic procedural generator for the full 1..50 curriculum that
 *     follows the design brief:
 *       1-10  : CROSS intersections, equal roads, few cars → teach right-hand.
 *       11-30 : main/secondary signs + traffic lights, 2-3 car queues.
 *       31-50 : roundabouts + heavier traffic.
 *       every 10th (10,20,30,40,50): BOSS — regulirovshik controller.
 *
 * The generator is seeded and deterministic so the same level id always yields
 * the same layout (important for leaderboards / server re-validation).
 */

import {
  Direction,
  IntersectionType,
  LevelDefinition,
  SignType,
  TrafficLightPhase,
  TurnIntent,
  VehicleKind,
} from '../core/types.js';

// --- tiny deterministic PRNG (mulberry32) ---------------------------------
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(r: () => number, arr: readonly T[]): T {
  return arr[Math.floor(r() * arr.length)];
}

const NORMAL_KINDS: readonly VehicleKind[] = [
  VehicleKind.CAR,
  VehicleKind.CAR,
  VehicleKind.CAR,
  VehicleKind.TRUCK,
  VehicleKind.BUS,
];
const INTENTS: readonly TurnIntent[] = [
  TurnIntent.STRAIGHT,
  TurnIntent.STRAIGHT,
  TurnIntent.RIGHT,
  TurnIntent.LEFT,
];

const GREEN_RED_CYCLE = [
  { phase: TrafficLightPhase.GREEN, durationMs: 4000 },
  { phase: TrafficLightPhase.YELLOW, durationMs: 1000 },
  { phase: TrafficLightPhase.RED, durationMs: 4000 },
];

// --- hand-authored tutorials ----------------------------------------------
const TUTORIALS: LevelDefinition[] = [
  {
    id: 1,
    name: '1-dars: O‘ng qo‘l qoidasi',
    type: IntersectionType.CROSS,
    lives: 3,
    tags: ['tutorial'],
    approaches: [
      { direction: Direction.SOUTH, sign: SignType.NONE, queue: [{ kind: VehicleKind.CAR, intent: TurnIntent.STRAIGHT }] },
      { direction: Direction.WEST, sign: SignType.NONE, queue: [{ kind: VehicleKind.CAR, intent: TurnIntent.STRAIGHT }] },
    ],
  },
  {
    id: 2,
    name: '2-dars: Kim birinchi?',
    type: IntersectionType.CROSS,
    lives: 3,
    tags: ['tutorial'],
    approaches: [
      { direction: Direction.SOUTH, sign: SignType.NONE, queue: [{ kind: VehicleKind.CAR, intent: TurnIntent.STRAIGHT }] },
      { direction: Direction.EAST, sign: SignType.NONE, queue: [{ kind: VehicleKind.CAR, intent: TurnIntent.STRAIGHT }] },
      { direction: Direction.NORTH, sign: SignType.NONE, queue: [{ kind: VehicleKind.CAR, intent: TurnIntent.RIGHT }] },
    ],
  },
  {
    id: 3,
    name: '3-dars: Navbat',
    type: IntersectionType.CROSS,
    lives: 3,
    tags: ['tutorial'],
    approaches: [
      {
        direction: Direction.WEST,
        sign: SignType.NONE,
        queue: [
          { kind: VehicleKind.CAR, intent: TurnIntent.STRAIGHT },
          { kind: VehicleKind.CAR, intent: TurnIntent.RIGHT },
        ],
      },
      { direction: Direction.SOUTH, sign: SignType.NONE, queue: [{ kind: VehicleKind.CAR, intent: TurnIntent.STRAIGHT }] },
    ],
  },
];

// --- procedural generator --------------------------------------------------
function bossLevel(id: number): LevelDefinition {
  const heavy = id >= 30;
  const armCars = (dir: Direction, n: number) =>
    Array.from({ length: n }, (_, i) => ({
      kind: i === 0 && dir === Direction.NORTH ? VehicleKind.AMBULANCE : pick(rng(id * 100 + dir * 10 + i), NORMAL_KINDS),
      intent: pick(rng(id * 7 + dir + i), INTENTS),
    }));

  return {
    id,
    name: `${id}-bosqich: BOSS — Yo‘l harakati boshqaruvchisi`,
    type: id >= 30 ? IntersectionType.ROUNDABOUT : IntersectionType.CROSS,
    lives: 3,
    tags: ['boss', 'controller'],
    controller: {
      loop: true,
      poses: [
        { name: 'Ko‘krak — Shim.-Jan. ochiq', allow: [Direction.NORTH, Direction.SOUTH], durationMs: 5000 },
        { name: 'Yon — Sharq-G‘arb ochiq', allow: [Direction.EAST, Direction.WEST], durationMs: 5000 },
      ],
    },
    approaches: [
      { direction: Direction.NORTH, sign: SignType.NONE, queue: armCars(Direction.NORTH, heavy ? 3 : 2) },
      { direction: Direction.EAST, sign: SignType.NONE, queue: armCars(Direction.EAST, heavy ? 3 : 2) },
      { direction: Direction.SOUTH, sign: SignType.NONE, queue: armCars(Direction.SOUTH, heavy ? 3 : 2) },
      { direction: Direction.WEST, sign: SignType.NONE, queue: armCars(Direction.WEST, heavy ? 3 : 2) },
    ],
  };
}

export function generateLevel(id: number): LevelDefinition {
  if (id <= TUTORIALS.length) return TUTORIALS[id - 1];
  if (id % 10 === 0) return bossLevel(id);

  const r = rng(id * 2654435761);

  // Difficulty band selection per the design brief.
  let type = IntersectionType.CROSS;
  let useSigns = false;
  let useLights = false;
  let maxQueue = 1;

  if (id <= 10) {
    type = IntersectionType.CROSS;
    maxQueue = 1;
  } else if (id <= 30) {
    type = IntersectionType.CROSS;
    useSigns = r() > 0.4;
    useLights = !useSigns && r() > 0.5;
    maxQueue = 2 + (r() > 0.5 ? 1 : 0);
  } else {
    type = IntersectionType.ROUNDABOUT;
    maxQueue = 2 + (r() > 0.4 ? 1 : 0);
  }

  // Choose which arms are active (3 or 4).
  const arms: Direction[] = [Direction.NORTH, Direction.EAST, Direction.SOUTH, Direction.WEST];
  const activeArms = r() > 0.5 ? arms : arms.slice(0, 3);

  // For sign levels, pick one axis as the main road.
  const mainAxisNS = r() > 0.5;

  const approaches = activeArms.map((dir) => {
    let sign = SignType.NONE;
    if (useSigns) {
      const isMain = mainAxisNS
        ? dir === Direction.NORTH || dir === Direction.SOUTH
        : dir === Direction.EAST || dir === Direction.WEST;
      sign = isMain ? SignType.MAIN_ROAD : SignType.YIELD;
    }
    const n = 1 + Math.floor(r() * maxQueue);
    const queue = Array.from({ length: n }, () => ({
      kind: pick(r, NORMAL_KINDS),
      intent: pick(r, INTENTS),
    }));

    const arm: LevelDefinition['approaches'][number] = { direction: dir, sign, queue };
    if (useLights) {
      arm.trafficLight = {
        approach: dir,
        cycle: GREEN_RED_CYCLE,
        // Opposite arms share phase; perpendicular arms are offset half-cycle.
        offsetMs: dir === Direction.NORTH || dir === Direction.SOUTH ? 0 : 5000,
      };
    }
    return arm;
  });

  const band = id <= 10 ? 'baza' : id <= 30 ? 'murakkab' : 'aylanma';
  return {
    id,
    name: `${id}-bosqich (${band})`,
    type,
    lives: 3,
    tags: [band, ...(useSigns ? ['signs'] : []), ...(useLights ? ['lights'] : [])],
    approaches,
  };
}

/** The full 50-level campaign, generated once. */
export const CAMPAIGN: LevelDefinition[] = Array.from({ length: 50 }, (_, i) =>
  generateLevel(i + 1),
);
