/**
 * Supabase layer: edge-function anti-cheat flow (mocked GoTrue/PostgREST) and
 * consistency between SQL and TypeScript. Requires `node --experimental-strip-types`
 * (the handler is imported as .ts) and `npm run build:edge` (npm test does both).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHandler, MAX_BODY_BYTES } from '../supabase/functions/submit-run/handler.ts';
import { autoplay, BAND_BONUS, STAR_COINS } from '../dist/core/index.js';
import { getLevel } from '../dist/content/campaign.js';
import { ALL_ITEMS } from '../dist/content/garage.js';

const SQL = readFileSync(new URL('../supabase/migrations/20260927000000_init.sql', import.meta.url), 'utf8');
const ENV = { url: 'https://demo.supabase.co', anonKey: 'ANON', serviceKey: 'SERVICE' };

function backend({ user = { id: 'user-1' }, rpc = () => ({ status: 200, json: { reward: 57, coins: 157, prev_stars: 0 } }) } = {}) {
  const calls = [];
  const fetchFn = async (url, init = {}) => {
    const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ url, init, body });
    if (url.endsWith('/auth/v1/user')) {
      if (init.headers.Authorization !== 'Bearer good-jwt') return new Response('{"msg":"bad jwt"}', { status: 401 });
      return new Response(JSON.stringify(user), { status: 200 });
    }
    if (url.endsWith('/rest/v1/rpc/apply_run')) {
      const r = rpc(body);
      return new Response(JSON.stringify(r.json), { status: r.status });
    }
    return new Response('{}', { status: 404 });
  };
  return { calls, handler: createHandler(ENV, fetchFn) };
}

const post = (body, auth = 'Bearer good-jwt') =>
  new Request('https://fn.local/submit-run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: auth } : {}) },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

test('SQL shop_catalog mirrors the garage catalog exactly', () => {
  const rows = [...SQL.matchAll(/\('([a-z0-9_]+)', '(model|paint|mod)', (\d+)\)/g)].map((m) => ({ id: m[1], kind: m[2], price: Number(m[3]) }));
  assert.equal(rows.length, ALL_ITEMS.length);
  for (const it of ALL_ITEMS) {
    const row = rows.find((r) => r.id === it.id);
    assert.ok(row, `missing ${it.id} in SQL`);
    assert.equal(row.kind, it.kind, it.id);
    assert.equal(row.price, it.price, it.id);
  }
});

test('SQL: RLS enabled everywhere, no client write policies on progress/runs/coins', () => {
  for (const t of ['profiles', 'shop_catalog', 'garage_items', 'garage_loadout', 'level_progress', 'runs']) {
    assert.match(SQL, new RegExp(`alter table public\\.${t}\\s+enable row level security`), t);
  }
  assert.doesNotMatch(SQL, /on public\.(level_progress|runs)\s+for (insert|update|delete|all)/);
  assert.match(SQL, /grant execute on function public\.apply_run\([^)]*\)\s+to service_role;/);
  assert.match(SQL, /revoke all on function public\.apply_run\([^)]*\) from public, anon, authenticated;/);
});

test('edge: CORS preflight, method and auth guards', async () => {
  const { handler, calls } = backend();
  assert.equal((await handler(new Request('https://fn.local', { method: 'OPTIONS' }))).status, 200);
  assert.equal((await handler(new Request('https://fn.local', { method: 'GET' }))).status, 405);
  assert.equal((await handler(post({ levelId: 1 }, null))).status, 401);
  assert.equal((await handler(post({ levelId: 1 }, 'Bearer forged'))).status, 401);
  assert.equal(calls.filter((c) => c.url.includes('apply_run')).length, 0);
});

test('edge: rejects malformed, unknown-level and oversized bodies', async () => {
  const { handler } = backend();
  assert.equal((await handler(post('{nope'))).status, 400);
  assert.equal((await handler(post({ levelId: 999, replay: {} }))).status, 404);
  assert.equal((await handler(post('x'.repeat(MAX_BODY_BYTES + 1)))).status, 413);
});

test('edge: a valid replay is re-simulated server-side and applied with SERVER-derived values', async () => {
  const level = getLevel(12);
  const bot = autoplay(level);
  const { handler, calls } = backend();
  const res = await handler(post({ levelId: 12, replay: bot.replay, claimedStars: 3, claimedCoins: 99999 }));
  assert.equal(res.status, 200);
  const out = await res.json();
  assert.equal(out.ok, true);
  assert.equal(out.coins, 157);
  const rpc = calls.find((c) => c.url.endsWith('/rest/v1/rpc/apply_run'));
  assert.ok(rpc, 'apply_run called');
  assert.equal(rpc.init.headers.Authorization, 'Bearer SERVICE');
  assert.equal(rpc.body.p_user, 'user-1');
  assert.equal(rpc.body.p_level, 12);
  assert.equal(rpc.body.p_time_ms, Math.round((bot.ticks * 1000) / 60));
  assert.ok(rpc.body.p_stars >= 2); // bot is fast and mistake-free
  assert.equal(rpc.body.p_band_bonus, BAND_BONUS.complex);
  assert.equal(rpc.body.p_star_coins, STAR_COINS);
  assert.match(rpc.body.p_replay_hash, /^[0-9a-f]{64}$/);
  // every p_* argument the handler sends exists in the SQL signature (and vice versa)
  const sig = SQL.match(/create or replace function public\.apply_run\(([\s\S]*?)\)\s*returns/)[1];
  const sqlParams = [...sig.matchAll(/(p_[a-z_]+)\s/g)].map((m) => m[1]).sort();
  assert.deepEqual(Object.keys(rpc.body).sort(), sqlParams);
});

test('edge: tampered replays never reach the database', async () => {
  const level = getLevel(12);
  const bot = autoplay(level);
  const cases = [
    { ...bot.replay, endTick: bot.replay.endTick - 60 }, // claims a faster finish
    { ...bot.replay, taps: bot.replay.taps.slice(0, -1) }, // incomplete
    { ...bot.replay, levelId: 13 }, // replay of another level
    { v: 2, taps: [], endTick: 1, levelId: 12 },
    'not a replay',
  ];
  for (const replay of cases) {
    const { handler, calls } = backend();
    const res = await handler(post({ levelId: 12, replay }));
    assert.equal(res.status, 422, JSON.stringify(replay).slice(0, 60));
    assert.equal(calls.filter((c) => c.url.includes('apply_run')).length, 0);
  }
});

test('edge: duplicate replay → 409, database failure → 500', async () => {
  const bot = autoplay(getLevel(3));
  const dup = backend({ rpc: () => ({ status: 409, json: { message: 'duplicate_run', code: '23505' } }) });
  assert.equal((await dup.handler(post({ levelId: 3, replay: bot.replay }))).status, 409);
  const broken = backend({ rpc: () => ({ status: 500, json: { message: 'boom' } }) });
  assert.equal((await broken.handler(post({ levelId: 3, replay: bot.replay }))).status, 500);
});
