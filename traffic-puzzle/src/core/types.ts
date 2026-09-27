/**
 * Chorraha Boshqaruvi — core domain types.
 *
 * Pure data shapes shared by the engine, renderer, level editor and the
 * Supabase edge function. Nothing in `core/` touches the DOM.
 *
 * World coordinates (top-down, logical):
 *   x → east, y → south (y-down, like a screen), z → up.
 *   1 unit = 1 lane width. The junction centre is (0, 0).
 */

/** Cardinal direction, clockwise: 0 = N, 1 = E, 2 = S, 3 = W. */
export type Dir = 0 | 1 | 2 | 3;
export type DirLetter = 'N' | 'E' | 'S' | 'W';
export type Turn = 'straight' | 'left' | 'right';
export type VehicleKind = 'car' | 'taxi' | 'bus' | 'truck' | 'ambulance' | 'fire' | 'police';
export type JunctionType = 'cross' | 't' | 'roundabout';
/** Physical geometry variant. `cross_ctrl` = cross with a traffic controller in the centre. */
export type GeometryKey = 'cross' | 'cross_ctrl' | 'roundabout';
/** Priority signs: main road (diamond), yield (triangle), stop (octagon). */
export type SignType = 'none' | 'main' | 'yield' | 'stop';
/** Traffic-controller (regulirovshik) body signals. */
export type Gesture = 'arms_side' | 'right_forward' | 'arm_up';
export type BodySide = 'chest' | 'back' | 'left' | 'right';
export type Aspect = 'green' | 'green_flash' | 'amber' | 'red' | 'red_amber' | 'flashing_amber';
export type Band = 'base' | 'complex' | 'roundabout' | 'boss';
export type RegulationMode = 'controller' | 'signal' | 'roundabout' | 'priority' | 'equal';

/**
 * Vehicle lifecycle (state machine):
 *   hidden → queued → approaching → waiting → crossing → exiting → gone
 *   - hidden:      scheduled arrival, not on the map yet
 *   - queued:      in the lane, not the front vehicle
 *   - approaching: front vehicle still rolling up to the stop line
 *   - waiting:     front vehicle stopped at the stop line — the ONLY tappable state
 *   - crossing:    committed, moving through the junction (never stops)
 *   - exiting:     left the conflict area (counted as cleared), driving away
 *   - gone:        despawned
 */
export type VehicleState =
  | 'hidden'
  | 'queued'
  | 'approaching'
  | 'waiting'
  | 'crossing'
  | 'exiting'
  | 'gone';

// ---------------------------------------------------------------------------
// Level authoring format (JSON-compatible)
// ---------------------------------------------------------------------------

export interface SpawnDef {
  kind: VehicleKind;
  turn: Turn;
  /** Rendered with the player's garage car (+bonus coins). */
  hero?: boolean;
}

export interface ArrivalDef extends SpawnDef {
  /** Time after level start when the vehicle appears at the far end of the arm. */
  atMs: number;
}

export interface ArmDef {
  dir: DirLetter;
  sign?: SignType;
  /** Vehicles present at level start, front (stop line) first. */
  queue: SpawnDef[];
  /** Vehicles that drive in later (traffic pressure). */
  arrivals?: ArrivalDef[];
}

export interface SignalPhaseDef {
  /** Arms that get green during this phase. Each arm must be in exactly one phase. */
  green: DirLetter[];
  ms: number;
}

export interface SignalPlanDef {
  phases: SignalPhaseDef[];
  amberMs?: number;
  allRedMs?: number;
  offsetMs?: number;
  /** Periods where the signal is switched to flashing amber (not regulating → signs apply). */
  flashing?: { fromMs: number; toMs: number }[];
}

export interface ControllerPoseDef {
  gesture: Gesture;
  /** The arm the controller's chest faces. */
  facing: DirLetter;
  ms: number;
}

export interface ControllerDef {
  /** Poses loop forever. */
  poses: ControllerPoseDef[];
}

export interface LevelIntro {
  title: string;
  text: string;
}

export interface LevelDef {
  id: number;
  name: string;
  band: Band;
  junction: JunctionType;
  arms: ArmDef[];
  signals?: SignalPlanDef;
  controller?: ControllerDef;
  lives?: number;
  /** Time for the "fast" star. Computed by the autoplay bot when absent. */
  parMs?: number;
  intro?: LevelIntro;
  tip?: string;
  tags?: string[];
}

// ---------------------------------------------------------------------------
// Runtime
// ---------------------------------------------------------------------------

export interface Vehicle {
  readonly id: string;
  readonly idx: number;
  readonly kind: VehicleKind;
  readonly from: Dir;
  readonly turn: Turn;
  readonly to: Dir;
  /** Movement index: from * 3 + turnIndex. */
  readonly move: number;
  readonly length: number;
  readonly width: number;
  readonly emergency: boolean;
  readonly hero: boolean;
  readonly spawnTick: number;
  state: VehicleState;
  /** Lane coordinate of the FRONT bumper (distance from the centre) while in the lane. */
  u: number;
  /** Lane speed (units/s) while queued/approaching. */
  speed: number;
  /** Arc-length position of the FRONT bumper along the movement path while crossing. */
  s: number;
  startTick: number;
  flashUntil: number;
  lockUntil: number;
  clearedTick: number;
}
