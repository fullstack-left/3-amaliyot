/**
 * Chorraha Boshqaruvi — Traffic Puzzle
 * =====================================
 * Core domain model.
 *
 * This module is the single source of truth for the game's data shapes.
 * It is deliberately framework-agnostic: no React, no Flutter, no DOM.
 * The same types are consumed by:
 *   - the pure Rule Validation Engine (core/rules.ts)
 *   - the game engine / state store (core/engine.ts, state/store.ts)
 *   - the renderer (render/*), and any UI (React Native / Flutter / web)
 *
 * Design principle: the *rules of the road* are modelled as data + pure
 * functions, so the exact same logic runs on client (optimistic) and can be
 * re-validated on the server (Supabase Edge / Postgres function) for anti-cheat.
 */

// ---------------------------------------------------------------------------
// Geometry & directions
// ---------------------------------------------------------------------------

/**
 * Cardinal directions on the logical (non-isometric) grid.
 * NORTH = up on the logical grid, which we later project to screen isometric.
 *
 * We index them 0..3 clockwise so that "the approach to the right" is a simple
 * modular rotation — this is the backbone of the right-hand rule.
 */
export enum Direction {
  NORTH = 0,
  EAST = 1,
  SOUTH = 2,
  WEST = 3,
}

export const ALL_DIRECTIONS: readonly Direction[] = [
  Direction.NORTH,
  Direction.EAST,
  Direction.SOUTH,
  Direction.WEST,
] as const;

/** Logical grid cell (before isometric projection). */
export interface GridPoint {
  x: number;
  y: number;
}

/** Screen-space point after isometric projection. */
export interface ScreenPoint {
  sx: number;
  sy: number;
}

// ---------------------------------------------------------------------------
// Traffic control infrastructure
// ---------------------------------------------------------------------------

/**
 * The priority tier a given approach (arm of the intersection) carries.
 * This is resolved from signs / markings and fed into the rule engine.
 */
export enum RoadPriority {
  /** Equal-importance road — resolved by the right-hand rule. */
  EQUAL = 'EQUAL',
  /** Main road (rombik / diamond sign) — has priority over secondary. */
  MAIN = 'MAIN',
  /** Secondary road (yield / "yo'l bering" triangle) — must give way. */
  SECONDARY = 'SECONDARY',
}

/** Physical sign placed on an approach. */
export enum SignType {
  NONE = 'NONE',
  MAIN_ROAD = 'MAIN_ROAD', // rombik — asosiy yo'l
  YIELD = 'YIELD', // uchburchak — yo'l bering
  STOP = 'STOP', // to'xtash (stop line)
  ROUNDABOUT = 'ROUNDABOUT', // aylanma harakat
}

export enum TrafficLightPhase {
  GREEN = 'GREEN',
  YELLOW = 'YELLOW',
  RED = 'RED',
}

/**
 * A traffic light attached to an approach. The cycle is deterministic and
 * driven by the engine clock, so the same tick produces the same phase on
 * client and server.
 */
export interface TrafficLight {
  approach: Direction;
  /** Ordered phases the light cycles through. */
  cycle: { phase: TrafficLightPhase; durationMs: number }[];
  /** Offset into the cycle at level start (ms) — lets arms be out of phase. */
  offsetMs: number;
}

// ---------------------------------------------------------------------------
// Intersection topology
// ---------------------------------------------------------------------------

export enum IntersectionType {
  CROSS = 'CROSS', // krestsimon (X)
  T_JUNCTION = 'T_JUNCTION', // T-shaklidagi
  ROUNDABOUT = 'ROUNDABOUT', // aylanma / kalsavoy
}

/**
 * A single arm (approach) of the intersection.
 * Vehicles queue up on an approach and leave toward an exit direction.
 */
export interface Approach {
  direction: Direction;
  sign: SignType;
  priority: RoadPriority;
  /** Whether this arm physically exists (T-junctions omit one). */
  enabled: boolean;
  trafficLight?: TrafficLight;
}

// ---------------------------------------------------------------------------
// Vehicles
// ---------------------------------------------------------------------------

export enum VehicleKind {
  CAR = 'CAR', // oddiy avtomobil (Cobalt, Nexia...)
  TRUCK = 'TRUCK', // yuk mashinasi
  BUS = 'BUS', // avtobus
  AMBULANCE = 'AMBULANCE', // tez yordam
  FIRE_TRUCK = 'FIRE_TRUCK', // o't o'chirish
  POLICE = 'POLICE', // YPX
}

/** Emergency vehicles that always have absolute priority. */
export const EMERGENCY_KINDS: readonly VehicleKind[] = [
  VehicleKind.AMBULANCE,
  VehicleKind.FIRE_TRUCK,
] as const;

export enum TurnIntent {
  STRAIGHT = 'STRAIGHT', // to'g'riga
  LEFT = 'LEFT', // chapga
  RIGHT = 'RIGHT', // o'ngga
}

export enum VehicleState {
  /** Sitting in the queue, not yet at the stop line. */
  QUEUED = 'QUEUED',
  /** First in queue, stopped at the intersection, awaiting player tap. */
  WAITING = 'WAITING',
  /** Player tapped, currently crossing the intersection. */
  CROSSING = 'CROSSING',
  /** Successfully cleared the intersection. */
  CLEARED = 'CLEARED',
  /** Involved in a collision / penalty. */
  CRASHED = 'CRASHED',
}

export interface Vehicle {
  id: string;
  kind: VehicleKind;
  /** The arm the vehicle approaches from. */
  from: Direction;
  /** Where it intends to go. Used for conflict-path checks. */
  intent: TurnIntent;
  /** 0 = at the stop line (front of queue), 1,2,3 = further back. */
  queueIndex: number;
  state: VehicleState;
  /** Cosmetic id from the garage (skins / mods). Purely visual. */
  skinId?: string;
  /**
   * Continuous progress 0..1 across the intersection while CROSSING.
   * Owned by the engine's animation step; the rule engine ignores it.
   */
  progress: number;
  /** Cached exit direction, derived from `from` + `intent`. */
  to: Direction;
}

// ---------------------------------------------------------------------------
// Level design
// ---------------------------------------------------------------------------

/** One entry in an approach's spawn queue (front-to-back order). */
export interface SpawnSpec {
  kind: VehicleKind;
  intent: TurnIntent;
  skinId?: string;
}

export interface ApproachDesign {
  direction: Direction;
  sign: SignType;
  enabled?: boolean; // default true
  /** Front-to-back queue of vehicles that start on this arm. */
  queue: SpawnSpec[];
  trafficLight?: TrafficLight;
}

export interface LevelDefinition {
  id: number;
  name: string;
  type: IntersectionType;
  /** Player lives for this level. */
  lives: number;
  /** Star thresholds by remaining time (ms) — index 0 => 1 star. */
  starThresholdsMs?: [number, number, number];
  approaches: ApproachDesign[];
  /** Boss levels place a traffic controller (regulirovshik) in the centre. */
  controller?: ControllerScript;
  /** Free-form tags for grouping (tutorial, roundabout, boss...). */
  tags?: string[];
}

/**
 * Regulirovshik (traffic controller) script for boss levels. The controller's
 * body/baton pose dictates which approaches may move, overriding all signs and
 * lights while active.
 */
export interface ControllerScript {
  poses: ControllerPose[];
  loop: boolean;
}

export interface ControllerPose {
  /** Human-readable pose name shown to the player. */
  name: string;
  /** Approaches allowed to move straight/right during this pose. */
  allow: Direction[];
  durationMs: number;
}

// ---------------------------------------------------------------------------
// Runtime intersection state (fed to the rule engine)
// ---------------------------------------------------------------------------

export interface IntersectionState {
  type: IntersectionType;
  approaches: Record<Direction, Approach>;
  vehicles: Record<string, Vehicle>;
  /** Monotonic ms since level start; drives lights & controller. */
  clockMs: number;
  controller?: ControllerScript;
}

// ---------------------------------------------------------------------------
// Rule engine results
// ---------------------------------------------------------------------------

export enum DenyReason {
  NOT_AT_FRONT = 'NOT_AT_FRONT', // ikkinchi mashina — navbat kutmoqda
  RED_LIGHT = 'RED_LIGHT',
  MUST_YIELD_RIGHT = 'MUST_YIELD_RIGHT', // o'ng qo'l qoidasi
  MUST_YIELD_MAIN_ROAD = 'MUST_YIELD_MAIN_ROAD',
  MUST_YIELD_EMERGENCY = 'MUST_YIELD_EMERGENCY',
  MUST_YIELD_ROUNDABOUT = 'MUST_YIELD_ROUNDABOUT',
  CONTROLLER_FORBIDS = 'CONTROLLER_FORBIDS',
  NOT_MOVABLE = 'NOT_MOVABLE', // wrong state (crossing/cleared)
}

export interface MoveDecision {
  allowed: boolean;
  reason?: DenyReason;
  /** Ids of vehicles this one conflicts with (drives crash animation). */
  conflictsWith: string[];
  /** Human-readable explanation (uz) for tooltips / tutorial. */
  explanation: string;
}
