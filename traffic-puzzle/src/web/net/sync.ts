/**
 * Offline-first progression sync.
 *
 *   1. Pending replays (recorded while offline) are pushed to the `submit-run`
 *      edge function, which RE-SIMULATES them with the same core engine and is
 *      the only writer of progress + coins (anti-cheat).
 *   2. Server state (coins, progress, garage) is pulled and merged:
 *      coins and owned items are server-authoritative, progress keeps the best
 *      of both sides.
 * Rejected runs (4xx) are dropped; network failures keep them for next time.
 */

import type { LevelProgress, PendingRun, SaveData } from '../save.js';
import { SupaClient, SupaError } from './supabase.js';

export interface SubmitRunResponse {
  ok: boolean;
  error?: string;
  result?: { stars: number; timeMs: number; mistakes: number };
  reward?: { total: number };
  coins?: number;
}

export interface SyncOutcome {
  pushed: number;
  rejected: number;
  kept: PendingRun[];
  coins: number | null;
  progress: Record<string, LevelProgress>;
  owned: string[] | null;
  userId: string;
}

interface ProgressRow {
  level_id: number;
  stars: number;
  best_time_ms: number;
}

export async function syncNow(client: SupaClient, save: SaveData): Promise<SyncOutcome> {
  const session = await client.ensureSession();
  let pushed = 0;
  let rejected = 0;
  const kept: PendingRun[] = [];

  for (const run of save.cloud.pending) {
    try {
      const r = await client.invoke<SubmitRunResponse>('submit-run', { levelId: run.levelId, replay: run.replay });
      if (r.ok) pushed++;
      else rejected++;
    } catch (e) {
      if (e instanceof SupaError && e.status >= 400 && e.status < 500 && e.status !== 401 && e.status !== 429) rejected++;
      else kept.push(run);
    }
  }

  const [profile] = await client.select<{ coins: number }>('profiles', `select=coins&id=eq.${encodeURIComponent(session.userId)}`);
  const rows = await client.select<ProgressRow>('level_progress', 'select=level_id,stars,best_time_ms');
  const items = await client.select<{ item_id: string }>('garage_items', 'select=item_id');

  const progress: Record<string, LevelProgress> = { ...save.progress };
  for (const r of rows) {
    const k = String(r.level_id);
    const local = progress[k];
    progress[k] = {
      stars: Math.max(local?.stars ?? 0, r.stars),
      bestMs: local ? Math.min(local.bestMs, r.best_time_ms) : r.best_time_ms,
    };
  }

  return {
    pushed,
    rejected,
    kept,
    coins: profile ? profile.coins : null,
    progress,
    owned: items.map((i) => i.item_id),
    userId: session.userId,
  };
}

/** Server-side purchase (atomic coin check in Postgres). Returns the new balance. */
export async function purchaseRemote(client: SupaClient, itemId: string): Promise<number> {
  await client.ensureSession();
  return client.rpc<number>('purchase_item', { p_item_id: itemId });
}

export async function saveLoadoutRemote(client: SupaClient, loadout: SaveData['loadout']): Promise<void> {
  await client.ensureSession();
  await client.rpc('set_loadout', { p_model: loadout.model, p_paint: loadout.paint, p_mods: loadout.mods });
}
