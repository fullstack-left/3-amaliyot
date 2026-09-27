/**
 * Versioned local save (localStorage). Corrupt or unknown data never crashes
 * the game: it is backed up under `<key>.corrupt` and replaced with defaults.
 */

import { STARTER_ITEMS, STARTER_LOADOUT } from '../content/garage.js';
import type { Replay } from '../core/replay.js';

export const SAVE_KEY = 'chorraha.save.v1';
export const SAVE_VERSION = 1;

export interface Settings {
  sound: boolean;
  vibrate: boolean;
  /** Colour-coded hover preview (allowed / not allowed) — learning aid. */
  assist: boolean;
  /** Green/red arrows explaining the traffic controller's current signal. */
  controllerArrows: boolean;
  spriteCache: boolean;
  perf: boolean;
  unlockAll: boolean;
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

export interface SaveData {
  version: number;
  coins: number;
  progress: Record<string, LevelProgress>;
  seenIntro: number[];
  owned: string[];
  loadout: { model: string; paint: string; mods: string[] };
  settings: Settings;
  stats: { cleared: number; mistakes: number; played: number; playMs: number };
  cloud: CloudState;
}

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
    },
    stats: { cleared: 0, mistakes: 0, played: 0, playMs: 0 },
    cloud: { url: '', anonKey: '', enabled: false, session: null, pending: [], lastSync: null },
  };
}

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);

/** Merge a parsed object onto defaults, keeping only well-typed fields. */
export function sanitize(raw: unknown): SaveData {
  const d = defaultSave();
  if (!isObj(raw)) return d;
  if (typeof raw.coins === 'number' && Number.isFinite(raw.coins) && raw.coins >= 0) d.coins = Math.floor(raw.coins);
  if (isObj(raw.progress)) {
    for (const [k, v] of Object.entries(raw.progress)) {
      if (isObj(v) && typeof v.stars === 'number' && typeof v.bestMs === 'number') {
        d.progress[k] = { stars: Math.max(0, Math.min(3, Math.floor(v.stars))), bestMs: Math.max(0, v.bestMs) };
      }
    }
  }
  if (Array.isArray(raw.seenIntro)) d.seenIntro = raw.seenIntro.filter((x): x is number => typeof x === 'number');
  if (Array.isArray(raw.owned)) d.owned = [...new Set([...STARTER_ITEMS, ...raw.owned.filter((x): x is string => typeof x === 'string')])];
  if (isObj(raw.loadout)) {
    const l = raw.loadout;
    if (typeof l.model === 'string' && d.owned.includes(l.model)) d.loadout.model = l.model;
    if (typeof l.paint === 'string' && d.owned.includes(l.paint)) d.loadout.paint = l.paint;
    if (Array.isArray(l.mods)) d.loadout.mods = l.mods.filter((m): m is string => typeof m === 'string' && d.owned.includes(m));
  }
  if (isObj(raw.settings)) {
    for (const k of Object.keys(d.settings) as (keyof Settings)[]) {
      if (typeof raw.settings[k] === 'boolean') d.settings[k] = raw.settings[k] as boolean;
    }
  }
  if (isObj(raw.stats)) {
    for (const k of Object.keys(d.stats) as (keyof SaveData['stats'])[]) {
      if (typeof raw.stats[k] === 'number') d.stats[k] = raw.stats[k] as number;
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
