/**
 * Seeded level generator + curriculum.
 * ===================================
 *
 * `generateLevel(spec, seed)` builds a candidate LevelDef from a curriculum
 * spec. `buildGeneratedLevel(spec)` tries a deterministic sequence of seeds and
 * keeps the most "interesting" candidate that
 *   1. passes validation,
 *   2. is solved by the autoplay bot with ZERO penalties,
 *   3. has at least `minBlocked` front vehicles blocked by the rules at start
 *      (so there is an actual decision to make).
 *
 * The result is frozen into campaign.data.ts by scripts/build-campaign.mjs, so
 * the shipped levels never change unless the build is re-run on purpose.
 */

import { autoplay } from '../core/bot.js';
import { buildController, everPermits } from '../core/controller.js';
import { DIR_LETTERS, TURNS, dirFromLetter, exitOf } from '../core/dir.js';
import { GameEngine } from '../core/engine.js';
import { loadLevel, validateLevel } from '../core/level.js';
import { canVehicleMove } from '../core/rules.js';
import type {
  ArmDef,
  Band,
  ControllerDef,
  DirLetter,
  JunctionType,
  LevelDef,
  LevelIntro,
  SignType,
  SignalPlanDef,
  Turn,
  VehicleKind,
} from '../core/types.js';
import { BOSS3, BOSS4, BOSS5 } from './handmade.js';

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Rng = () => number;
const randInt = (r: Rng, a: number, b: number): number => a + Math.floor(r() * (b - a + 1));
function weighted<T>(r: Rng, items: readonly [T, number][]): T {
  const total = items.reduce((s, [, w]) => s + w, 0);
  let x = r() * total;
  for (const [it, w] of items) {
    x -= w;
    if (x < 0) return it;
  }
  return items[items.length - 1][0];
}

export interface GenSpec {
  id: number;
  name: string;
  band: Band;
  junction: JunctionType;
  /** Number of arms for roundabouts (3 or 4). T-junctions always have 3. */
  armCount?: 3 | 4;
  signs?: 'none' | 'priority';
  signals?: 'none' | 'two_phase' | 'four_phase';
  flashing?: { fromMs: number; toMs: number }[];
  controller?: ControllerDef;
  queue: [number, number];
  arrivals?: number;
  arrivalStartMs?: number;
  arrivalGapMs?: number;
  emergency?: number;
  fire?: boolean;
  police?: boolean;
  minBlocked?: number;
  intro?: LevelIntro;
  tip?: string;
}

const TURN_WEIGHTS: Record<'default' | 'roundabout', [Turn, number][]> = {
  default: [
    ['straight', 0.45],
    ['left', 0.25],
    ['right', 0.3],
  ],
  roundabout: [
    ['straight', 0.4],
    ['left', 0.35],
    ['right', 0.25],
  ],
};

function chooseArms(spec: GenSpec, r: Rng): DirLetter[] {
  const all = [...DIR_LETTERS];
  const count = spec.junction === 'cross' ? 4 : spec.junction === 't' ? 3 : (spec.armCount ?? 4);
  if (count === 4) return all;
  const missing = randInt(r, 0, 3);
  return all.filter((_, i) => i !== missing);
}

function chooseSigns(spec: GenSpec, arms: DirLetter[], r: Rng): Map<DirLetter, SignType> {
  const m = new Map<DirLetter, SignType>();
  for (const a of arms) m.set(a, 'none');
  if (spec.signs !== 'priority' || spec.junction === 'roundabout') return m;
  let mainAxis: DirLetter[];
  if (spec.junction === 't') {
    // the bar of the T (two opposite arms) is the main road
    mainAxis = arms.includes('N') && arms.includes('S') ? ['N', 'S'] : ['E', 'W'];
  } else {
    mainAxis = r() < 0.5 ? ['N', 'S'] : ['E', 'W'];
  }
  const minor: SignType = r() < 0.3 ? 'stop' : 'yield';
  for (const a of arms) m.set(a, mainAxis.includes(a) ? 'main' : minor);
  return m;
}

function chooseSignals(spec: GenSpec, arms: DirLetter[], r: Rng): SignalPlanDef | undefined {
  if (!spec.signals || spec.signals === 'none') return undefined;
  let phases: SignalPlanDef['phases'];
  if (spec.signals === 'four_phase') {
    phases = arms.map((a) => ({ green: [a], ms: 4500 }));
  } else {
    const ns = arms.filter((a) => a === 'N' || a === 'S');
    const ew = arms.filter((a) => a === 'E' || a === 'W');
    const g = 6000 + 500 * randInt(r, 0, 4);
    phases = [
      { green: ns, ms: g },
      { green: ew, ms: g },
    ].filter((p) => p.green.length > 0);
  }
  const plan: SignalPlanDef = { phases, offsetMs: 500 * randInt(r, 0, 6) };
  if (spec.flashing) plan.flashing = spec.flashing;
  return plan;
}

function civilianKind(spec: GenSpec, r: Rng): VehicleKind {
  const items: [VehicleKind, number][] = [
    ['car', 0.62],
    ['taxi', 0.14],
    ['bus', 0.08],
    ['truck', 0.1],
  ];
  if (spec.police) items.push(['police', 0.06]);
  return weighted(r, items);
}

export function generateLevel(spec: GenSpec, seed: number): LevelDef {
  const r = mulberry32(seed);
  const arms = chooseArms(spec, r);
  const armSet = new Set(arms);
  const signs = chooseSigns(spec, arms, r);
  const signals = chooseSignals(spec, arms, r);
  const plan = spec.controller ? buildController(spec.controller) : null;
  const weights = TURN_WEIGHTS[spec.junction === 'roundabout' ? 'roundabout' : 'default'];

  const turnFor = (dir: DirLetter, emergency: boolean): Turn => {
    const d = dirFromLetter(dir);
    const ok = weights.filter(
      ([t]) =>
        armSet.has(DIR_LETTERS[exitOf(d, t)]) && (!plan || emergency || everPermits(plan, d, t)),
    );
    return weighted(r, ok.length ? ok : TURNS.map((t) => [t, 1] as [Turn, number]));
  };

  const defs: ArmDef[] = arms.map((dir) => ({ dir, sign: signs.get(dir) ?? 'none', queue: [], arrivals: [] }));
  for (const a of defs) {
    const n = randInt(r, spec.queue[0], spec.queue[1]);
    for (let k = 0; k < n; k++) a.queue.push({ kind: civilianKind(spec, r), turn: turnFor(a.dir, false) });
  }
  const arrivals = spec.arrivals ?? 0;
  const start = spec.arrivalStartMs ?? 5000;
  const gap = spec.arrivalGapMs ?? 2600;
  for (let i = 0; i < arrivals; i++) {
    const a = defs[randInt(r, 0, defs.length - 1)];
    const atMs = start + i * gap + 100 * randInt(r, 0, 8);
    a.arrivals!.push({ kind: civilianKind(spec, r), turn: turnFor(a.dir, false), atMs });
  }

  // Emergency vehicles: half of them arrive later (siren from afar), the rest wait at start.
  const emergency = spec.emergency ?? 0;
  for (let e = 0; e < emergency; e++) {
    const kind: VehicleKind = spec.fire && e % 2 === 1 ? 'fire' : 'ambulance';
    const a = defs[randInt(r, 0, defs.length - 1)];
    const late = arrivals > 0 && e % 2 === 0;
    const spawn = { kind, turn: turnFor(a.dir, true) };
    if (late) a.arrivals!.push({ ...spawn, atMs: start + 1500 + 3000 * e + 100 * randInt(r, 0, 10) });
    else if (a.queue.length > 0) a.queue.splice(randInt(r, 0, a.queue.length - 1), 1, spawn);
    else a.queue.push(spawn);
  }

  for (const a of defs) {
    if (a.arrivals && a.arrivals.length === 0) delete a.arrivals;
    if (a.sign === 'none') delete a.sign;
  }

  const def: LevelDef = {
    id: spec.id,
    name: spec.name,
    band: spec.band,
    junction: spec.junction,
    arms: defs,
  };
  if (signals) def.signals = signals;
  if (spec.controller) def.controller = spec.controller;
  if (spec.intro) def.intro = spec.intro;
  if (spec.tip) def.tip = spec.tip;
  return def;
}

/** How many decisions the level forces at the start (higher = more interesting). */
export function interest(def: LevelDef): number {
  const eng = new GameEngine(loadLevel(def));
  let blocked = 0;
  let deadlock = 0;
  for (const q of eng.queues) {
    const f = q[0];
    if (!f) continue;
    const d = canVehicleMove(f.id, eng);
    if (d.verdict === 'violation') blocked++;
    if (d.deadlock) deadlock = 1;
  }
  const turns = new Set(def.arms.flatMap((a) => a.queue.map((s) => s.turn))).size;
  return blocked + deadlock + 0.1 * turns;
}

export interface Candidate {
  readonly def: LevelDef;
  readonly seed: number;
  readonly score: number;
  readonly botTicks: number;
}

export function buildGeneratedLevel(spec: GenSpec, tries = 24): Candidate {
  let best: Candidate | null = null;
  for (let k = 0; k < tries; k++) {
    const seed = (spec.id * 7919 + k * 104729) >>> 0;
    const def = generateLevel(spec, seed);
    if (!validateLevel(def).ok) continue;
    const bot = autoplay(loadLevel(def), { reactionTicks: 12 });
    if (!bot.completed || bot.penalties > 0) continue;
    const score = interest(def);
    if (score < (spec.minBlocked ?? 0)) continue;
    if (!best || score > best.score) best = { def, seed, score, botTicks: bot.ticks };
    if (best.score >= (spec.minBlocked ?? 0) + 2) break;
  }
  if (!best) throw new Error(`Level ${spec.id}: generator mos variant topa olmadi`);
  return best;
}

// ---------------------------------------------------------------------------
// Curriculum: specs for every level that is not hand-made
// ---------------------------------------------------------------------------

const TIP = {
  base: "O'ng tomonni tekshiring: o'ngdan kelayotgan mashina ustun. Chapga buriluvchi qarshidagini kutadi.",
  signs: "Sariq romb (asosiy yo'l) tomondagilar birinchi. Uchburchak / STOP tomondagilar ularni o'tkazib yuboradi.",
  lights: 'Faqat yashil chiroqda yuboring. Yashilda chapga buriluvchi qarshidagiga yo‘l beradi.',
  ring: "Halqadagi mashina o'tib ketgach, bo'sh oynaga yuboring.",
  boss: "Boshqaruvchining ko'kragi qaragan tomonga va qo'llariga qarang.",
};

export const CURRICULUM: readonly GenSpec[] = [
  { id: 7, name: 'Chilonzor chorrahasi', band: 'base', junction: 'cross', queue: [1, 2], minBlocked: 2, tip: TIP.base },
  { id: 9, name: 'Sirena ovozi', band: 'base', junction: 'cross', queue: [1, 2], emergency: 1, minBlocked: 2, tip: TIP.base },
  { id: 13, name: 'Yunusobod', band: 'complex', junction: 'cross', signs: 'priority', queue: [2, 2], minBlocked: 2, tip: TIP.signs },
  { id: 14, name: 'T-chorraha', band: 'complex', junction: 't', signs: 'priority', queue: [2, 3], minBlocked: 1, tip: TIP.signs },
  { id: 15, name: 'Olmazor', band: 'complex', junction: 'cross', signs: 'priority', queue: [2, 3], emergency: 1, minBlocked: 2, tip: TIP.signs },
  { id: 17, name: 'Bozor yo‘li', band: 'complex', junction: 't', signs: 'priority', queue: [2, 3], arrivals: 3, minBlocked: 1, tip: TIP.signs },
  { id: 18, name: 'Mirobod', band: 'complex', junction: 'cross', signs: 'priority', queue: [3, 3], minBlocked: 2, tip: TIP.signs },
  { id: 19, name: 'Sergeli', band: 'complex', junction: 'cross', signs: 'priority', queue: [2, 3], arrivals: 4, emergency: 1, minBlocked: 2, tip: TIP.signs },
  { id: 25, name: 'Yashnobod svetofori', band: 'complex', junction: 'cross', signals: 'two_phase', queue: [2, 3], police: true, minBlocked: 2, tip: TIP.lights },
  { id: 26, name: 'Svetoforli T', band: 'complex', junction: 't', signals: 'two_phase', queue: [2, 3], police: true, minBlocked: 1, tip: TIP.lights },
  {
    id: 27,
    name: 'Tungi rejim',
    band: 'complex',
    junction: 'cross',
    signs: 'priority',
    signals: 'two_phase',
    flashing: [{ fromMs: 0, toMs: 14000 }],
    queue: [2, 3],
    police: true,
    minBlocked: 1,
    intro: {
      title: 'Tungi rejim',
      text: "Avval svetofor sariq miltillaydi (belgilar ishlaydi), 14 soniyadan keyin esa yoqiladi — endi chiroqqa qarang!",
    },
    tip: TIP.lights,
  },
  { id: 28, name: 'Shayxontohur', band: 'complex', junction: 'cross', signs: 'priority', queue: [3, 3], arrivals: 5, police: true, minBlocked: 2, tip: TIP.signs },
  { id: 29, name: 'Yakkasaroy', band: 'complex', junction: 'cross', signals: 'two_phase', queue: [2, 3], arrivals: 4, emergency: 2, police: true, minBlocked: 2, tip: TIP.lights },
  { id: 30, name: 'BOSS: Beshyog‘och', band: 'boss', junction: 'cross', controller: BOSS3, queue: [3, 4], arrivals: 6, emergency: 1, tip: TIP.boss },
  { id: 32, name: 'Kichik halqa', band: 'roundabout', junction: 'roundabout', queue: [1, 2], tip: TIP.ring },
  { id: 33, name: 'Uch yo‘lli halqa', band: 'roundabout', junction: 'roundabout', armCount: 3, queue: [2, 2], tip: TIP.ring },
  { id: 34, name: 'Uchtepa aylanasi', band: 'roundabout', junction: 'roundabout', queue: [2, 2], arrivals: 3, tip: TIP.ring },
  { id: 35, name: 'Bektemir aylanasi', band: 'roundabout', junction: 'roundabout', queue: [2, 3], police: true, tip: TIP.ring },
  { id: 37, name: 'Qo‘yliq halqasi', band: 'roundabout', junction: 'roundabout', armCount: 3, queue: [2, 3], arrivals: 4, tip: TIP.ring },
  { id: 38, name: 'Oqtepa aylanasi', band: 'roundabout', junction: 'roundabout', queue: [2, 3], emergency: 1, police: true, tip: TIP.ring },
  { id: 39, name: 'Bodomzor aylanasi', band: 'roundabout', junction: 'roundabout', queue: [3, 3], arrivals: 4, tip: TIP.ring },
  { id: 40, name: 'BOSS: Katta regulirovshik', band: 'boss', junction: 'cross', controller: BOSS4, queue: [4, 4], arrivals: 8, emergency: 2, tip: TIP.boss },
  { id: 41, name: 'Trassa: Halqa yo‘li', band: 'roundabout', junction: 'roundabout', queue: [3, 3], arrivals: 6, police: true, tip: TIP.ring },
  {
    id: 42,
    name: 'Trassa: O‘chgan svetofor',
    band: 'complex',
    junction: 'cross',
    signs: 'priority',
    signals: 'two_phase',
    flashing: [{ fromMs: 20000, toMs: 36000 }],
    queue: [3, 3],
    arrivals: 4,
    police: true,
    minBlocked: 1,
    tip: 'Svetofor 20-soniyada o‘chadi (sariq miltillaydi) — o‘shanda belgilarga o‘ting!',
  },
  { id: 43, name: 'Trassa: Sirenalar', band: 'complex', junction: 'cross', signs: 'priority', queue: [3, 3], arrivals: 4, emergency: 2, fire: true, police: true, minBlocked: 2, tip: TIP.signs },
  { id: 44, name: 'Trassa: Uch yo‘l', band: 'roundabout', junction: 'roundabout', armCount: 3, queue: [3, 3], arrivals: 6, tip: TIP.ring },
  { id: 45, name: 'Trassa: Svetoforli T', band: 'complex', junction: 't', signals: 'two_phase', queue: [3, 3], arrivals: 5, police: true, minBlocked: 1, tip: TIP.lights },
  { id: 46, name: 'Trassa: Halqada sirena', band: 'roundabout', junction: 'roundabout', queue: [3, 3], arrivals: 5, emergency: 2, fire: true, tip: TIP.ring },
  { id: 47, name: 'Trassa: Buyuk Ipak yo‘li', band: 'complex', junction: 'cross', signs: 'priority', queue: [3, 4], arrivals: 6, police: true, minBlocked: 2, tip: TIP.signs },
  {
    id: 48,
    name: 'Trassa: Har kimga navbat',
    band: 'complex',
    junction: 'cross',
    signals: 'four_phase',
    queue: [3, 3],
    arrivals: 4,
    police: true,
    minBlocked: 3,
    intro: { title: 'To‘rt fazali svetofor', text: 'Har bir yo‘l alohida yashil oladi. Faqat yashil yo‘lni yuboring.' },
    tip: TIP.lights,
  },
  { id: 49, name: 'Trassa: Katta halqa', band: 'roundabout', junction: 'roundabout', queue: [3, 4], arrivals: 8, emergency: 1, police: true, tip: TIP.ring },
  {
    id: 50,
    name: 'FINAL BOSS: Toshkent tirbandligi',
    band: 'boss',
    junction: 'cross',
    controller: BOSS5,
    queue: [4, 5],
    arrivals: 12,
    arrivalGapMs: 2200,
    emergency: 2,
    fire: true,
    police: true,
    intro: {
      title: 'FINAL BOSS',
      text: 'Eng tez regulirovshik, eng katta tirbandlik, tez yordam va o‘t o‘chirish. Barcha qoidalarni eslang!',
    },
    tip: TIP.boss,
  },
];
