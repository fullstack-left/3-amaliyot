/**
 * Versioned local save (localStorage). Corrupt or unknown data never crashes
 * the game: it is backed up under `<key>.corrupt` and replaced with defaults.
 *
 * v2 (game v3) adds: achievements, daily results + streak, endless records,
 * run history, richer stats (violations by rule…), effects/volume settings and
 * a display name. v1 saves are migrated transparently by `sanitize`.
 */

import { dayIndexOf } from '../content/daily.js';
import { ENDLESS_VARIANTS, type EndlessVariant } from '../content/endless.js';
import { exclusiveRewards, STARTER_ITEMS, STARTER_LOADOUT } from '../content/garage.js';
import type { Replay } from '../core/replay.js';
import type { Reason } from '../core/rules.js';

export const SAVE_KEY = 'chorraha.save.v1';
export const SAVE_VERSION = 2;
export const HISTORY_MAX = 30;
export const NAME_MAX = 24;

export interface Settings {
  sound: boolean;
  vibrate: boolean;
  /** Colour-coded hover preview + "why" explanations — learning aid. */
  assist: boolean;
  /** Green/red arrows explaining the traffic controller's current signal. */
  controllerArrows: boolean;
  spriteCache: boolean;
  perf: boolean;
  unlockAll: boolean;
  /** Particles, rain, screen shake, confetti. Off also when the OS asks for reduced motion. */
  effects: boolean;
  /** Master volume 0..1. */
  volume: number;
  /** Show 1–4 keyboard badges next to the front vehicles. */
  keyHints: boolean;
}

export interface CloudSession {
  accessToken: string;
  refreshToken: string;
  /** Epoch seconds. */
  expiresAt: number;
  userId: string;
  email: string | null;
}

export interface PendingRun {
  levelId: number;
  replay: Replay;
  at: string;
}

export interface CloudState {
  url: string;
  anonKey: string;
  enabled: boolean;
  session: CloudSession | null;
  pending: PendingRun[];
  lastSync: string | null;
}

export interface LevelProgress {
  stars: number;
  bestMs: number;
}

export type RunMode = 'campaign' | 'daily' | 'endless' | 'custom';

export interface RunRecord {
  mode: RunMode;
  levelId: number;
  name: string;
  completed: boolean;
  stars: number;
  timeMs: number;
  mistakes: number;
  cleared: number;
  at: string;
}

export interface DailyState {
  /** Best result per day key (YYYY-MM-DD). */
  results: Record<string, LevelProgress>;
  streak: number;
  bestStreak: number;
  lastDay: string | null;
}

export interface EndlessRecord {
  best: number;
  runs: number;
  last: number;
}

export interface Stats {
  cleared: number;
  mistakes: number;
  played: number;
  playMs: number;
  departures: number;
  emergency: number;
  deadlocks: number;
  hints: number;
  violations: Partial<Record<Reason, number>>;
}

export interface SaveData {
  version: number;
  coins: number;
  progress: Record<string, LevelProgress>;
  seenIntro: number[];
  owned: string[];
  loadout: { model: string; paint: string; mods: string[] };
  settings: Settings;
  stats: Stats;
  cloud: CloudState;
  /** Unlocked achievement id → ISO date. */
  achievements: Record<string, string>;
  daily: DailyState;
  endless: Record<EndlessVariant, EndlessRecord>;
  history: RunRecord[];
  profile: { name: string };
}

export const VIOLATION_REASONS: readonly Reason[] = [
  'controller',
  'red_light',
  'crossing_traffic',
  'roundabout_ring',
  'emergency',
  'main_road',
  'right_hand',
  'left_turn',
];

export function defaultSave(): SaveData {
  return {
    version: SAVE_VERSION,
    coins: 0,
    progress: {},
    seenIntro: [],
    owned: [...STARTER_ITEMS],
    loadout: { model: STARTER_LOADOUT.model, paint: STARTER_LOADOUT.paint, mods: [] },
    settings: {
      sound: true,
      vibrate: true,
      assist: true,
      controllerArrows: false,
      spriteCache: true,
      perf: false,
      unlockAll: false,
      effects: true,
      volume: 0.8,
      keyHints: false,
    },
    stats: { cleared: 0, mistakes: 0, played: 0, playMs: 0, departures: 0, emergency: 0, deadlocks: 0, hints: 0, violations: {} },
    cloud: { url: '', anonKey: '', enabled: false, session: null, pending: [], lastSync: null },
    achievements: {},
    daily: { results: {}, streak: 0, bestStreak: 0, lastDay: null },
    endless: { cross: { best: 0, runs: 0, last: 0 }, signals: { best: 0, runs: 0, last: 0 }, roundabout: { best: 0, runs: 0, last: 0 } },
    history: [],
    profile: { name: '' },
  };
}

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const isCount = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x) && x >= 0;
const isDayKey = (k: string): boolean => !Number.isNaN(dayIndexOf(k));

function progressEntry(v: unknown): LevelProgress | null {
  if (!isObj(v) || typeof v.stars !== 'number' || typeof v.bestMs !== 'number' || !Number.isFinite(v.bestMs)) return null;
  return { stars: Math.max(0, Math.min(3, Math.floor(v.stars))), bestMs: Math.max(0, v.bestMs) };
}

export function cleanName(name: string): string {
  // eslint-disable-next-line no-control-regex
  return name.replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, NAME_MAX);
}

/** Merge a parsed object onto defaults, keeping only well-typed fields. */
export function sanitize(raw: unknown): SaveData {
  const d = defaultSave();
  if (!isObj(raw)) return d;
  if (isCount(raw.coins)) d.coins = Math.floor(raw.coins);
  if (isObj(raw.progress)) {
    for (const [k, v] of Object.entries(raw.progress)) {
      const p = progressEntry(v);
      if (p && /^\d+$/.test(k)) d.progress[k] = p;
    }
  }
  if (Array.isArray(raw.seenIntro)) d.seenIntro = raw.seenIntro.filter((x): x is number => typeof x === 'number');
  if (isObj(raw.achievements)) {
    for (const [k, v] of Object.entries(raw.achievements)) if (typeof v === 'string') d.achievements[k] = v;
  }
  const exclusives = exclusiveRewards(Object.keys(d.achievements));
  const owned = Array.isArray(raw.owned) ? raw.owned.filter((x): x is string => typeof x === 'string') : [];
  d.owned = [...new Set([...STARTER_ITEMS, ...owned, ...exclusives])];
  if (isObj(raw.loadout)) {
    const l = raw.loadout;
    if (typeof l.model === 'string' && d.owned.includes(l.model)) d.loadout.model = l.model;
    if (typeof l.paint === 'string' && d.owned.includes(l.paint)) d.loadout.paint = l.paint;
    if (Array.isArray(l.mods)) d.loadout.mods = l.mods.filter((m): m is string => typeof m === 'string' && d.owned.includes(m));
  }
  if (isObj(raw.settings)) {
    const s = raw.settings;
    for (const k of Object.keys(d.settings) as (keyof Settings)[]) {
      if (k === 'volume') {
        if (typeof s.volume === 'number' && Number.isFinite(s.volume)) d.settings.volume = Math.max(0, Math.min(1, s.volume));
      } else if (typeof s[k] === 'boolean') {
        (d.settings as unknown as Record<string, boolean>)[k] = s[k] as boolean;
      }
    }
  }
  if (isObj(raw.stats)) {
    const st = raw.stats;
    for (const k of ['cleared', 'mistakes', 'played', 'playMs', 'departures', 'emergency', 'deadlocks', 'hints'] as const) {
      if (isCount(st[k])) d.stats[k] = st[k] as number;
    }
    if (isObj(st.violations)) {
      for (const r of VIOLATION_REASONS) if (isCount(st.violations[r])) d.stats.violations[r] = Math.floor(st.violations[r] as number);
    }
  }
  if (isObj(raw.cloud)) {
    const c = raw.cloud;
    if (typeof c.url === 'string') d.cloud.url = c.url;
    if (typeof c.anonKey === 'string') d.cloud.anonKey = c.anonKey;
    if (typeof c.enabled === 'boolean') d.cloud.enabled = c.enabled;
    if (isObj(c.session) && typeof c.session.accessToken === 'string') d.cloud.session = c.session as unknown as CloudSession;
    if (Array.isArray(c.pending)) d.cloud.pending = c.pending.filter((p) => isObj(p) && typeof p.levelId === 'number') as PendingRun[];
    if (typeof c.lastSync === 'string') d.cloud.lastSync = c.lastSync;
  }
  if (isObj(raw.daily)) {
    const dl = raw.daily;
    if (isObj(dl.results)) {
      for (const [k, v] of Object.entries(dl.results)) {
        const p = progressEntry(v);
        if (p && isDayKey(k)) d.daily.results[k] = p;
      }
    }
    if (isCount(dl.streak)) d.daily.streak = Math.floor(dl.streak);
    if (isCount(dl.bestStreak)) d.daily.bestStreak = Math.max(Math.floor(dl.bestStreak), d.daily.streak);
    if (typeof dl.lastDay === 'string' && isDayKey(dl.lastDay)) d.daily.lastDay = dl.lastDay;
  }
  if (isObj(raw.endless)) {
    for (const v of ENDLESS_VARIANTS) {
      const e = raw.endless[v];
      if (isObj(e)) {
        d.endless[v] = {
          best: isCount(e.best) ? Math.floor(e.best) : 0,
          runs: isCount(e.runs) ? Math.floor(e.runs) : 0,
          last: isCount(e.last) ? Math.floor(e.last) : 0,
        };
      }
    }
  }
  if (Array.isArray(raw.history)) {
    const modes: readonly RunMode[] = ['campaign', 'daily', 'endless', 'custom'];
    d.history = raw.history
      .filter(
        (r): r is RunRecord =>
          isObj(r) &&
          modes.includes(r.mode as RunMode) &&
          typeof r.levelId === 'number' &&
          typeof r.name === 'string' &&
          typeof r.completed === 'boolean' &&
          isCount(r.stars) &&
          isCount(r.timeMs) &&
          isCount(r.mistakes) &&
          isCount(r.cleared) &&
          typeof r.at === 'string',
      )
      .slice(0, HISTORY_MAX);
  }
  if (isObj(raw.profile) && typeof raw.profile.name === 'string') d.profile.name = cleanName(raw.profile.name);
  return d;
}

export function loadSave(storage: Storage | null = typeof localStorage === 'undefined' ? null : localStorage): SaveData {
  if (!storage) return defaultSave();
  const text = storage.getItem(SAVE_KEY);
  if (!text) return defaultSave();
  try {
    const raw = JSON.parse(text) as unknown;
    if (isObj(raw) && typeof raw.version === 'number' && raw.version > SAVE_VERSION) throw new Error('newer save');
    return sanitize(raw);
  } catch {
    storage.setItem(`${SAVE_KEY}.corrupt`, text);
    return defaultSave();
  }
}

export function writeSave(data: SaveData, storage: Storage | null = typeof localStorage === 'undefined' ? null : localStorage): void {
  try {
    storage?.setItem(SAVE_KEY, JSON.stringify(data));
  } catch {
    /* quota / private mode — the game keeps working in memory */
  }
}

export function totalStars(save: SaveData): number {
  return Object.values(save.progress).reduce((s, p) => s + p.stars, 0);
}

export function isUnlocked(save: SaveData, id: number): boolean {
  if (save.settings.unlockAll || id === 1) return true;
  return (save.progress[String(id - 1)]?.stars ?? 0) > 0;
}

export function nextLevel(save: SaveData, count: number): number {
  for (let id = 1; id <= count; id++) if (!save.progress[String(id)]) return id;
  return count;
}

// ---------------------------------------------------------------------------
// Daily streak (pure)
// ---------------------------------------------------------------------------

/** Record completing the daily of `dayKey` (call only for the player's current day). */
export function applyDailyCompletion(daily: DailyState, dayKey: string): DailyState {
  if (daily.lastDay === dayKey) return daily;
  const prev = daily.lastDay ? dayIndexOf(daily.lastDay) : Number.NaN;
  const cur = dayIndexOf(dayKey);
  if (Number.isNaN(cur)) return daily;
  const streak = prev === cur - 1 ? daily.streak + 1 : 1;
  return { ...daily, streak, bestStreak: Math.max(daily.bestStreak, streak), lastDay: dayKey };
}

/** Streak to display today: alive if the last completion was today or yesterday. */
export function liveStreak(daily: DailyState, todayKey: string): number {
  if (!daily.lastDay) return 0;
  const gap = dayIndexOf(todayKey) - dayIndexOf(daily.lastDay);
  return gap === 0 || gap === 1 ? daily.streak : 0;
}

export function endlessBest(save: SaveData): number {
  return Math.max(0, ...ENDLESS_VARIANTS.map((v) => save.endless[v].best));
}
