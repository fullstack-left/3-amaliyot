/**
 * submit-run — server-side anti-cheat.
 *
 * The client sends { levelId, replay } — never a score. We:
 *   1. identify the caller from their JWT (GoTrue GET /auth/v1/user),
 *   2. re-simulate the replay with the SAME deterministic core engine,
 *   3. hand the verified result to `apply_run` (SQL, service role), which
 *      computes the reward under an advisory lock, de-duplicates replays and
 *      is the only writer of progress + coins.
 *
 * Dependency-free (plain fetch) so it runs unchanged on Supabase Edge (Deno)
 * and in Node tests.
 */

import { BAND_BONUS, STAR_COINS, loadLevel, verifyReplay, type Replay } from '../_shared/chorraha/core/index.js';
import { CAMPAIGN } from '../_shared/chorraha/content/campaign.js';

export interface EdgeEnv {
  url: string;
  anonKey: string;
  serviceKey: string;
}

type FetchFn = (input: string, init?: RequestInit) => Promise<Response>;

export const MAX_BODY_BYTES = 256_000;

export const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

export function createHandler(env: EdgeEnv, fetchFn: FetchFn = (i, init) => fetch(i, init)): (req: Request) => Promise<Response> {
  const base = env.url.replace(/\/+$/, '');
  const service = {
    apikey: env.serviceKey,
    Authorization: `Bearer ${env.serviceKey}`,
    'Content-Type': 'application/json',
  };

  return async (req: Request): Promise<Response> => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
    if (req.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405);

    const auth = req.headers.get('Authorization') ?? '';
    if (!auth.startsWith('Bearer ')) return json({ ok: false, error: 'unauthorized' }, 401);
    const who = await fetchFn(`${base}/auth/v1/user`, { headers: { apikey: env.anonKey, Authorization: auth } });
    if (!who.ok) return json({ ok: false, error: 'unauthorized' }, 401);
    const user = (await who.json()) as { id?: unknown };
    if (typeof user.id !== 'string') return json({ ok: false, error: 'unauthorized' }, 401);

    const text = await req.text();
    if (text.length > MAX_BODY_BYTES) return json({ ok: false, error: 'too_large' }, 413);
    let body: { levelId?: unknown; replay?: unknown };
    try {
      body = JSON.parse(text) as typeof body;
    } catch {
      return json({ ok: false, error: 'bad_json' }, 400);
    }
    const def = CAMPAIGN.find((l) => l.id === body.levelId);
    if (!def) return json({ ok: false, error: 'unknown_level' }, 404);

    const verdict = verifyReplay(loadLevel(def), body.replay as Replay, def.parMs);
    if (!verdict.ok) return json({ ok: false, error: verdict.error ?? 'invalid_replay' }, 422);
    const r = verdict.result;

    const rpc = await fetchFn(`${base}/rest/v1/rpc/apply_run`, {
      method: 'POST',
      headers: service,
      body: JSON.stringify({
        p_user: user.id,
        p_level: def.id,
        p_stars: r.stars,
        p_time_ms: r.timeMs,
        p_vehicle_coins: r.vehicleCoins,
        p_band_bonus: BAND_BONUS[def.band],
        p_star_coins: STAR_COINS,
        p_replay: body.replay,
        p_replay_hash: await sha256Hex(JSON.stringify(body.replay)),
        p_result: r,
      }),
    });
    if (!rpc.ok) {
      const err = (await rpc.json().catch(() => ({}))) as { message?: string };
      if (err.message === 'duplicate_run') return json({ ok: false, error: 'duplicate_run' }, 409);
      return json({ ok: false, error: 'db_error' }, 500);
    }
    const out = (await rpc.json()) as { reward: number; coins: number; prev_stars: number };
    return json({
      ok: true,
      result: { stars: r.stars, timeMs: r.timeMs, mistakes: r.mistakes },
      reward: { total: out.reward },
      coins: out.coins,
    });
  };
}
