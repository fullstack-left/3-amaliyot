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
import { dayKeyFromIndex, dayIndexOfId, isDailyId } from '../../content/daily.js';
import { SupaError } from './supabase.js';
export async function syncNow(client, save) {
    const session = await client.ensureSession();
    let pushed = 0;
    let rejected = 0;
    const kept = [];
    for (const run of save.cloud.pending) {
        try {
            const r = await client.invoke('submit-run', { levelId: run.levelId, replay: run.replay });
            if (r.ok)
                pushed++;
            else
                rejected++;
        }
        catch (e) {
            if (e instanceof SupaError && e.status >= 400 && e.status < 500 && e.status !== 401 && e.status !== 429)
                rejected++;
            else
                kept.push(run);
        }
    }
    const [profile] = await client.select('profiles', `select=coins&id=eq.${encodeURIComponent(session.userId)}`);
    const rows = await client.select('level_progress', 'select=level_id,stars,best_time_ms');
    const items = await client.select('garage_items', 'select=item_id');
    const progress = { ...save.progress };
    const daily = { ...save.daily.results };
    const merge = (map, k, r) => {
        const local = map[k];
        map[k] = {
            stars: Math.max(local?.stars ?? 0, r.stars),
            bestMs: local ? Math.min(local.bestMs, r.best_time_ms) : r.best_time_ms,
        };
    };
    for (const r of rows) {
        if (isDailyId(r.level_id))
            merge(daily, dayKeyFromIndex(dayIndexOfId(r.level_id)), r);
        else if (r.level_id >= 1 && r.level_id <= 1000)
            merge(progress, String(r.level_id), r);
    }
    return {
        pushed,
        rejected,
        kept,
        coins: profile ? profile.coins : null,
        progress,
        daily,
        owned: items.map((i) => i.item_id),
        userId: session.userId,
    };
}
/** Server-side purchase (atomic coin check in Postgres). Returns the new balance. */
export async function purchaseRemote(client, itemId) {
    await client.ensureSession();
    return client.rpc('purchase_item', { p_item_id: itemId });
}
export async function saveLoadoutRemote(client, loadout) {
    await client.ensureSession();
    await client.rpc('set_loadout', { p_model: loadout.model, p_paint: loadout.paint, p_mods: loadout.mods });
}
/** Public display name for leaderboards (profiles.display_name, RLS: own row only). */
export async function setDisplayNameRemote(client, name) {
    const session = await client.ensureSession();
    await client.update('profiles', `id=eq.${encodeURIComponent(session.userId)}`, { display_name: name });
}
/** Top results for a level (campaign or daily id); `is_me` marks the caller's row. */
export async function fetchLeaderboard(client, levelId, limit = 10) {
    await client.ensureSession();
    return client.rpc('leaderboard', { p_level: levelId, p_limit: limit });
}
/** The caller's own position on a level's board (null if they have no verified result yet). */
export async function fetchMyRank(client, levelId) {
    await client.ensureSession();
    const rows = await client.rpc('my_rank', { p_level: levelId });
    return Array.isArray(rows) && rows.length ? rows[0] : null;
}
//# sourceMappingURL=sync.js.map