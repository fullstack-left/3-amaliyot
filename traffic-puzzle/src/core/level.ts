/**
 * Level validation + loading.
 *
 * `validateLevel` checks an untrusted JSON value (editor import, server input)
 * and reports every problem in Uzbek. `loadLevel` turns a valid LevelDef into
 * the runtime Level (numeric directions, ticks, deterministic vehicle ids).
 */

import { buildController, everPermits } from './controller.js';
import {
  DIR_LETTERS,
  dirFromLetter,
  exitOf,
  isDirLetter,
  TURNS,
} from './dir.js';
import { CROSS, DESPAWN_U, RB, geometryFor, getJunction } from './junction.js';
import { msToTicks, Q_GAP } from './kinematics.js';
import type { Layout } from './rules.js';
import { buildSignalPlan } from './signals.js';
import type {
  Ambience,
  Band,
  CoachStep,
  ControllerDef,
  Dir,
  DirLetter,
  JunctionType,
  LevelDef,
  SignType,
  SpawnDef,
  Turn,
  VehicleKind,
} from './types.js';
import { VEHICLE_KINDS, VEHICLE_SPECS } from './vehicles.js';

export const BANDS: readonly Band[] = ['base', 'complex', 'roundabout', 'boss'];
export const JUNCTION_TYPES: readonly JunctionType[] = ['cross', 't', 'roundabout'];
export const SIGN_TYPES: readonly SignType[] = ['none', 'main', 'yield', 'stop'];
export const GESTURES = ['arms_side', 'right_forward', 'arm_up'] as const;
export const AMBIENCES: readonly Ambience[] = ['day', 'evening', 'night', 'rain'];
export const MAX_VEHICLES = 80;
export const MAX_QUEUE = 7;
export const MAX_COACH_STEPS = 12;

export interface LevelLimits {
  /** Raise the vehicle cap for trusted generated content (endless mode). Never for user input. */
  readonly maxVehicles?: number;
}

export interface SpawnPlan {
  readonly id: string;
  readonly idx: number;
  readonly from: Dir;
  readonly kind: VehicleKind;
  readonly turn: Turn;
  readonly hero: boolean;
  /** true = present at level start (in queue order); false = arrival. */
  readonly initial: boolean;
  readonly atTick: number;
}

export interface Level {
  readonly def: LevelDef;
  readonly id: number;
  readonly name: string;
  readonly band: Band;
  readonly layout: Layout;
  readonly lives: number;
  readonly parMs: number | undefined;
  readonly spawns: readonly SpawnPlan[];
  readonly ambience: Ambience;
  readonly coach: readonly CoachStep[];
}

export interface ValidationResult {
  readonly ok: boolean;
  readonly errors: string[];
  readonly warnings: string[];
}

const isObj = (x: unknown): x is Record<string, unknown> =>
  typeof x === 'object' && x !== null && !Array.isArray(x);
const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);

function checkSpawn(x: unknown, where: string, errors: string[]): x is SpawnDef {
  if (!isObj(x)) {
    errors.push(`${where}: mashina obyekt bo'lishi kerak`);
    return false;
  }
  let ok = true;
  if (!VEHICLE_KINDS.includes(x.kind as VehicleKind)) {
    errors.push(`${where}: noma'lum mashina turi "${String(x.kind)}"`);
    ok = false;
  }
  if (!TURNS.includes(x.turn as Turn)) {
    errors.push(`${where}: noto'g'ri yo'nalish "${String(x.turn)}" (straight | left | right)`);
    ok = false;
  }
  if (x.hero !== undefined && typeof x.hero !== 'boolean') {
    errors.push(`${where}: hero boolean bo'lishi kerak`);
    ok = false;
  }
  return ok;
}

export function validateLevel(input: unknown, limits: LevelLimits = {}): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!isObj(input)) return { ok: false, errors: ["Level JSON obyekt bo'lishi kerak"], warnings };
  const d = input;

  if (!Number.isInteger(d.id) || (d.id as number) < 1) errors.push('id: musbat butun son bo‘lishi kerak');
  if (typeof d.name !== 'string' || !d.name.trim()) errors.push("name: bo'sh bo'lmasligi kerak");
  if (!BANDS.includes(d.band as Band)) errors.push(`band: ${BANDS.join(' | ')}`);
  const type = d.junction as JunctionType;
  if (!JUNCTION_TYPES.includes(type)) errors.push(`junction: ${JUNCTION_TYPES.join(' | ')}`);
  if (d.lives !== undefined && (!Number.isInteger(d.lives) || (d.lives as number) < 1 || (d.lives as number) > 9)) {
    errors.push('lives: 1..9');
  }
  if (d.parMs !== undefined && (!isNum(d.parMs) || d.parMs <= 0)) errors.push('parMs: musbat son');
  if (d.ambience !== undefined && !AMBIENCES.includes(d.ambience as Ambience)) errors.push(`ambience: ${AMBIENCES.join(' | ')}`);
  const vehicleIds = new Set<string>();

  const armsSet = new Set<DirLetter>();
  let total = 0;
  const spawnsToCheck: { dir: DirLetter; turn: Turn; emergency: boolean; where: string }[] = [];
  const stopU = type === 'roundabout' ? RB.stopU : CROSS.stopU;

  if (!Array.isArray(d.arms)) {
    errors.push("arms: massiv bo'lishi kerak");
  } else {
    d.arms.forEach((a: unknown, i: number) => {
      const w = `arms[${i}]`;
      if (!isObj(a)) {
        errors.push(`${w}: obyekt bo'lishi kerak`);
        return;
      }
      const dir = a.dir;
      if (!isDirLetter(dir)) {
        errors.push(`${w}.dir: ${DIR_LETTERS.join(' | ')}`);
        return;
      }
      if (armsSet.has(dir)) errors.push(`${w}.dir: "${dir}" takrorlangan`);
      armsSet.add(dir);
      if (a.sign !== undefined && !SIGN_TYPES.includes(a.sign as SignType)) {
        errors.push(`${w}.sign: ${SIGN_TYPES.join(' | ')}`);
      }
      const queue = a.queue;
      if (!Array.isArray(queue)) {
        errors.push(`${w}.queue: massiv bo'lishi kerak`);
        return;
      }
      if (queue.length > MAX_QUEUE) errors.push(`${w}.queue: ko'pi bilan ${MAX_QUEUE} ta mashina`);
      let laneLen = 0;
      queue.forEach((s: unknown, k: number) => {
        if (checkSpawn(s, `${w}.queue[${k}]`, errors)) {
          total++;
          laneLen += VEHICLE_SPECS[s.kind].length + Q_GAP;
          spawnsToCheck.push({ dir, turn: s.turn, emergency: VEHICLE_SPECS[s.kind].emergency, where: `${w}.queue[${k}]` });
        }
      });
      if (stopU + laneLen > DESPAWN_U - 0.3) errors.push(`${w}.queue: navbat yo'lga sig'maydi (juda uzun)`);
      const arrivals = a.arrivals;
      const count = queue.length + (Array.isArray(arrivals) ? arrivals.length : 0);
      for (let k = 0; k < count; k++) vehicleIds.add(`${dir}${k}`);
      if (arrivals !== undefined) {
        if (!Array.isArray(arrivals)) errors.push(`${w}.arrivals: massiv bo'lishi kerak`);
        else
          arrivals.forEach((s: unknown, k: number) => {
            const ww = `${w}.arrivals[${k}]`;
            if (checkSpawn(s, ww, errors)) {
              const at = (s as unknown as Record<string, unknown>).atMs;
              if (!isNum(at) || at < 0) errors.push(`${ww}.atMs: 0 yoki musbat son`);
              total++;
              spawnsToCheck.push({ dir, turn: s.turn, emergency: VEHICLE_SPECS[s.kind].emergency, where: ww });
            }
          });
      }
    });

    const n = armsSet.size;
    if (type === 'cross' && n !== 4) errors.push("cross chorrahada 4 ta yo'l bo'lishi kerak");
    if (type === 't' && n !== 3) errors.push("T-chorrahada 3 ta yo'l bo'lishi kerak");
    if (type === 'roundabout' && (n < 3 || n > 4)) errors.push("aylanmada 3 yoki 4 ta yo'l bo'lishi kerak");
    for (const s of spawnsToCheck) {
      const exit = DIR_LETTERS[exitOf(dirFromLetter(s.dir), s.turn)];
      if (!armsSet.has(exit)) errors.push(`${s.where}: "${s.turn}" yo'nalishida chiqish yo'li (${exit}) yo'q`);
    }
    if (type === 'roundabout') {
      for (const a of d.arms as Record<string, unknown>[]) {
        if (isObj(a) && a.sign !== undefined && a.sign !== 'none') {
          warnings.push(`aylanma: ${String(a.dir)} belgisi e'tiborsiz qoldiriladi (aylanmada halqa ustun)`);
        }
      }
    }
  }
  if (total < 1) errors.push("Kamida bitta mashina bo'lishi kerak");
  const maxVehicles = limits.maxVehicles ?? MAX_VEHICLES;
  if (total > maxVehicles) errors.push(`Ko'pi bilan ${maxVehicles} ta mashina`);

  // coach (interactive tutorial)
  if (d.coach !== undefined) {
    if (!Array.isArray(d.coach) || d.coach.length === 0 || d.coach.length > MAX_COACH_STEPS) {
      errors.push(`coach: 1..${MAX_COACH_STEPS} ta qadamdan iborat massiv`);
    } else {
      d.coach.forEach((c: unknown, i: number) => {
        if (!isObj(c) || typeof c.vehicle !== 'string' || typeof c.text !== 'string' || !c.text.trim()) {
          errors.push(`coach[${i}]: { vehicle: "E0", text: "..." }`);
        } else if (!vehicleIds.has(c.vehicle)) {
          errors.push(`coach[${i}].vehicle: "${c.vehicle}" mashinasi yo'q`);
        }
      });
    }
  }

  // signals
  if (d.signals !== undefined) {
    const sp = d.signals;
    if (type === 'roundabout') errors.push("signals: aylanmada svetofor qo'llab-quvvatlanmaydi");
    if (d.controller !== undefined) errors.push("signals va controller birga bo'lishi mumkin emas");
    if (!isObj(sp) || !Array.isArray(sp.phases) || sp.phases.length === 0) {
      errors.push("signals.phases: bo'sh bo'lmagan massiv");
    } else {
      const covered = new Map<string, number>();
      sp.phases.forEach((p: unknown, i: number) => {
        if (!isObj(p) || !Array.isArray(p.green) || !isNum(p.ms) || p.ms < 1000) {
          errors.push(`signals.phases[${i}]: { green: [...], ms >= 1000 }`);
          return;
        }
        for (const l of p.green) {
          if (!isDirLetter(l) || !armsSet.has(l)) errors.push(`signals.phases[${i}].green: "${String(l)}" yo'l mavjud emas`);
          else covered.set(l, (covered.get(l) ?? 0) + 1);
        }
      });
      for (const a of armsSet) {
        const c = covered.get(a) ?? 0;
        if (c !== 1) errors.push(`signals: "${a}" yo'li aynan bitta fazada yashil bo'lishi kerak (hozir ${c})`);
      }
      for (const k of ['amberMs', 'allRedMs', 'offsetMs'] as const) {
        if (sp[k] !== undefined && (!isNum(sp[k]) || (sp[k] as number) < 0)) errors.push(`signals.${k}: 0 yoki musbat`);
      }
      if (sp.flashing !== undefined) {
        if (!Array.isArray(sp.flashing)) errors.push('signals.flashing: massiv');
        else
          sp.flashing.forEach((w: unknown, i: number) => {
            if (!isObj(w) || !isNum(w.fromMs) || !isNum(w.toMs) || w.fromMs < 0 || w.toMs <= w.fromMs) {
              errors.push(`signals.flashing[${i}]: { fromMs < toMs }`);
            }
          });
      }
    }
  }

  // controller
  if (d.controller !== undefined) {
    const c = d.controller;
    if (type !== 'cross') errors.push('controller: faqat cross chorrahada');
    if (!isObj(c) || !Array.isArray(c.poses) || c.poses.length === 0) {
      errors.push("controller.poses: bo'sh bo'lmagan massiv");
    } else {
      let poseErr = false;
      c.poses.forEach((p: unknown, i: number) => {
        if (
          !isObj(p) ||
          !(GESTURES as readonly string[]).includes(p.gesture as string) ||
          !isDirLetter(p.facing) ||
          !isNum(p.ms) ||
          p.ms < 800
        ) {
          errors.push(`controller.poses[${i}]: { gesture, facing, ms >= 800 }`);
          poseErr = true;
        }
      });
      if (!poseErr) {
        const plan = buildController(c as unknown as ControllerDef);
        for (const s of spawnsToCheck) {
          if (!s.emergency && !everPermits(plan, dirFromLetter(s.dir), s.turn)) {
            errors.push(`${s.where}: boshqaruvchi hech qachon bu harakatga (${s.dir} → ${s.turn}) ruxsat bermaydi`);
          }
        }
      }
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}

export function loadLevel(def: LevelDef, limits: LevelLimits = {}): Level {
  const v = validateLevel(def, limits);
  if (!v.ok) throw new Error(`Level ${String(def.id)} noto'g'ri:\n- ${v.errors.join('\n- ')}`);

  const armEnabled = [false, false, false, false];
  const sign: SignType[] = ['none', 'none', 'none', 'none'];
  for (const a of def.arms) {
    const d = dirFromLetter(a.dir);
    armEnabled[d] = true;
    sign[d] = def.junction === 'roundabout' ? 'none' : (a.sign ?? 'none');
  }
  const priority = sign.map((s) => (s === 'main' ? 2 : s === 'yield' || s === 'stop' ? 0 : 1));
  const hasPrioritySigns = sign.some((s, i) => armEnabled[i] && s !== 'none');
  const geometry = geometryFor(def.junction, !!def.controller);
  const layout: Layout = {
    type: def.junction,
    geometry,
    armEnabled,
    sign,
    priority,
    hasPrioritySigns,
    signals: def.signals ? buildSignalPlan(def.signals) : null,
    controller: def.controller ? buildController(def.controller) : null,
    stopU: getJunction(geometry).stopU,
  };

  const spawns: SpawnPlan[] = [];
  let idx = 0;
  const explicitHero = def.arms.some((a) => a.queue.some((s) => s.hero) || (a.arrivals ?? []).some((s) => s.hero));
  let heroAssigned = explicitHero;
  for (const a of def.arms) {
    const from = dirFromLetter(a.dir);
    let k = 0;
    for (const s of a.queue) {
      let hero = !!s.hero;
      if (!heroAssigned && s.kind === 'car') {
        hero = true;
        heroAssigned = true;
      }
      spawns.push({ id: `${a.dir}${k++}`, idx: idx++, from, kind: s.kind, turn: s.turn, hero, initial: true, atTick: 0 });
    }
    const arrivals = [...(a.arrivals ?? [])].sort((x, y) => x.atMs - y.atMs);
    for (const s of arrivals) {
      spawns.push({
        id: `${a.dir}${k++}`,
        idx: idx++,
        from,
        kind: s.kind,
        turn: s.turn,
        hero: !!s.hero,
        initial: false,
        atTick: Math.max(1, msToTicks(s.atMs)),
      });
    }
  }

  return {
    def,
    id: def.id,
    name: def.name,
    band: def.band,
    layout,
    lives: def.lives ?? 3,
    parMs: def.parMs,
    spawns,
    ambience: def.ambience ?? 'day',
    coach: def.coach ?? [],
  };
}
