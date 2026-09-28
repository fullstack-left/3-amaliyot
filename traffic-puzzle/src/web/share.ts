/**
 * Level sharing by link: LevelDef ⇄ compact URL-safe code.
 *
 *   code = "L1." + base64url(UTF-8(canonical JSON))
 *
 * Canonical = fixed key order, defaults and derived fields (parMs, tags)
 * dropped — so encode(decode(code)) === code and the same level always yields
 * the same link. Decoding validates with the regular (untrusted-input) level
 * validator.
 */

import { validateLevel } from '../core/level.js';
import type { ArmDef, LevelDef, SpawnDef } from '../core/types.js';

export const SHARE_PREFIX = 'L1.';
export const SHARE_MAX_LENGTH = 8000;

function spawn(s: SpawnDef & { atMs?: number }): Record<string, unknown> {
  const o: Record<string, unknown> = { kind: s.kind, turn: s.turn };
  if (s.atMs !== undefined) o.atMs = s.atMs;
  if (s.hero) o.hero = true;
  return o;
}

function arm(a: ArmDef): Record<string, unknown> {
  const o: Record<string, unknown> = { dir: a.dir };
  if (a.sign && a.sign !== 'none') o.sign = a.sign;
  o.queue = a.queue.map(spawn);
  if (a.arrivals && a.arrivals.length) o.arrivals = [...a.arrivals].sort((x, y) => x.atMs - y.atMs).map(spawn);
  return o;
}

/** Canonical, JSON-ready form of a level (stable key order, no derived fields). */
export function canonicalLevel(def: LevelDef): Record<string, unknown> {
  const o: Record<string, unknown> = { id: def.id, name: def.name, band: def.band, junction: def.junction };
  if (def.ambience && def.ambience !== 'day') o.ambience = def.ambience;
  if (def.lives !== undefined && def.lives !== 3) o.lives = def.lives;
  o.arms = [...def.arms].sort((a, b) => 'NESW'.indexOf(a.dir) - 'NESW'.indexOf(b.dir)).map(arm);
  if (def.signals) {
    const s = def.signals;
    const sig: Record<string, unknown> = { phases: s.phases.map((p) => ({ green: [...p.green], ms: p.ms })) };
    if (s.amberMs !== undefined) sig.amberMs = s.amberMs;
    if (s.allRedMs !== undefined) sig.allRedMs = s.allRedMs;
    if (s.offsetMs) sig.offsetMs = s.offsetMs;
    if (s.flashing && s.flashing.length) sig.flashing = s.flashing.map((w) => ({ fromMs: w.fromMs, toMs: w.toMs }));
    o.signals = sig;
  }
  if (def.controller) o.controller = { poses: def.controller.poses.map((p) => ({ gesture: p.gesture, facing: p.facing, ms: p.ms })) };
  if (def.intro) o.intro = { title: def.intro.title, text: def.intro.text };
  if (def.tip) o.tip = def.tip;
  if (def.coach && def.coach.length) o.coach = def.coach.map((c) => ({ vehicle: c.vehicle, text: c.text }));
  return o;
}

function toBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function encodeLevel(def: LevelDef): string {
  return SHARE_PREFIX + toBase64Url(new TextEncoder().encode(JSON.stringify(canonicalLevel(def))));
}

export type DecodeResult = { readonly ok: true; readonly def: LevelDef } | { readonly ok: false; readonly error: string };

export function decodeLevel(code: string): DecodeResult {
  if (typeof code !== 'string' || !code.startsWith(SHARE_PREFIX)) return { ok: false, error: "Havola formati noto'g'ri" };
  if (code.length > SHARE_MAX_LENGTH) return { ok: false, error: 'Havola juda uzun' };
  const body = code.slice(SHARE_PREFIX.length);
  if (!/^[A-Za-z0-9_-]+$/.test(body)) return { ok: false, error: "Havolada ruxsat etilmagan belgilar bor" };
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(fromBase64Url(body)));
  } catch {
    return { ok: false, error: "Havolani o'qib bo'lmadi" };
  }
  const v = validateLevel(parsed);
  if (!v.ok) return { ok: false, error: v.errors[0] ?? 'Bosqich noto‘g‘ri' };
  return { ok: true, def: parsed as LevelDef };
}
