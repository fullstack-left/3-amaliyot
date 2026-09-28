import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../dist/web/app.js';
import { loadSave, sanitize, SAVE_KEY, isUnlocked } from '../dist/web/save.js';
import { SupaClient, SupaError } from '../dist/web/net/supabase.js';
import { syncNow } from '../dist/web/net/sync.js';
import { getLevel } from '../dist/content/campaign.js';
import { autoplay } from '../dist/core/index.js';

class MemoryStorage {
  map = new Map();
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { this.map.set(k, String(v)); }
  removeItem(k) { this.map.delete(k); }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const RESULT = {
  levelId: 1, completed: true, ticks: 600, timeMs: 10000, mistakes: 0, livesLeft: 3, cleared: 0, total: 0,
  vehicleCoins: 0, stars: 3, parMs: 20000, endReason: 'cleared', violations: {}, deadlocks: 0, emergency: 0, departures: 0,
};

test('save: corrupt JSON is backed up and replaced with defaults', () => {
  const st = new MemoryStorage();
  st.setItem(SAVE_KEY, '{not json');
  const s = loadSave(st);
  assert.equal(s.coins, 0);
  assert.ok(s.owned.includes('matiz'));
  assert.equal(st.getItem(`${SAVE_KEY}.corrupt`), '{not json');
});

test('save: sanitize keeps only well-typed fields and owned loadout', () => {
  const s = sanitize({
    coins: 120.7,
    progress: { 1: { stars: 9, bestMs: 5000 }, 2: { stars: 'x' } },
    owned: ['cobalt', 42],
    loadout: { model: 'malibu', paint: 'oq', mods: ['neon', 'spoiler'] },
    settings: { sound: false, hacker: true },
  });
  assert.equal(s.coins, 120);
  assert.deepEqual(s.progress, { 1: { stars: 3, bestMs: 5000 } });
  assert.ok(s.owned.includes('cobalt') && !s.owned.includes(42));
  assert.equal(s.loadout.model, 'matiz'); // malibu not owned
  assert.deepEqual(s.loadout.mods, []);
  assert.equal(s.settings.sound, false);
  assert.equal('hacker' in s.settings, false);
});

test('app: finishing a level awards coins once, keeps best stars/time, unlocks the next', async () => {
  const st = new MemoryStorage();
  const app = createApp(st);
  const level = getLevel(1);
  const bot = autoplay(level);
  const result = { ...RESULT, levelId: 1, ticks: bot.ticks, timeMs: 4000, cleared: 2, total: 2, vehicleCoins: 9, stars: 3, parMs: 5500 };
  const campaign = { kind: 'campaign', id: 1 };
  const r1 = app.store.getState().finishRun(campaign, level.def, result, bot.replay).reward;
  assert.equal(r1.total, 9 + 10 + 30);
  assert.equal(app.store.getState().save.coins, 49);
  assert.equal(isUnlocked(app.store.getState().save, 2), true);
  const sum2 = app.store.getState().finishRun(campaign, level.def, { ...result, timeMs: 3500 }, bot.replay);
  assert.equal(sum2.reward.total, 9); // no bonus, no new stars
  assert.equal(sum2.newBestTime, true);
  assert.equal(sum2.newStars, false);
  assert.equal(sum2.prevBestMs, 4000);
  const s = app.store.getState().save;
  assert.equal(s.coins, 58);
  assert.deepEqual(s.progress['1'], { stars: 3, bestMs: 3500 });
  assert.equal(s.cloud.pending.length, 0); // cloud disabled → no pending runs
  await sleep(250);
  assert.equal(JSON.parse(st.getItem(SAVE_KEY)).coins, 58); // persisted (debounced)
});

test('app: failed or custom levels give nothing', () => {
  const app = createApp(new MemoryStorage());
  const def = getLevel(3).def;
  const lost = { ...RESULT, levelId: 3, completed: false, ticks: 10, timeMs: 1000, mistakes: 3, livesLeft: 0, total: 3, endReason: 'lives' };
  assert.equal(app.store.getState().finishRun({ kind: 'campaign', id: 3 }, def, lost, null).reward.total, 0);
  const won = { ...lost, completed: true, stars: 3, vehicleCoins: 6, endReason: 'cleared' };
  assert.equal(app.store.getState().finishRun({ kind: 'custom', def }, def, won, null).reward.total, 0);
  assert.equal(app.store.getState().save.coins, 0);
});

test('garage: buy with enough coins, equip model/paint, toggle mods', async () => {
  const app = createApp(new MemoryStorage());
  const S = () => app.store.getState();
  assert.equal(await S().buy('cobalt'), false); // 0 coins
  app.store.setState({ save: { ...S().save, coins: 500 } });
  assert.equal(await S().buy('cobalt'), true);
  assert.equal(S().save.coins, 150);
  assert.equal(await S().buy('cobalt'), false); // already owned
  S().equip('cobalt');
  assert.equal(S().save.loadout.model, 'cobalt');
  assert.equal(await S().buy('metan'), true);
  S().equip('metan');
  assert.deepEqual(S().save.loadout.mods, ['metan']);
  S().equip('metan');
  assert.deepEqual(S().save.loadout.mods, []);
  S().equip('malibu'); // not owned → ignored
  assert.equal(S().save.loadout.model, 'cobalt');
});

function mockFetch(routes) {
  const calls = [];
  const fn = async (url, init = {}) => {
    calls.push({ url, init, body: init.body ? JSON.parse(init.body) : undefined });
    for (const [pattern, handler] of routes) {
      if (url.includes(pattern)) {
        const { status = 200, json } = await handler(url, init);
        return new Response(json === undefined ? '' : JSON.stringify(json), { status });
      }
    }
    return new Response('{"message":"no route"}', { status: 404 });
  };
  return { fn, calls };
}

const SESSION = { access_token: 'AT', refresh_token: 'RT', expires_in: 3600, user: { id: 'u-1', email: null } };

test('supabase client: anonymous sign-in uses the auth-js wire format', async () => {
  const { fn, calls } = mockFetch([['/auth/v1/signup', () => ({ json: SESSION })]]);
  const c = new SupaClient('https://demo.supabase.co/', 'ANON', null, fn);
  const s = await c.signInAnonymously();
  assert.equal(s.userId, 'u-1');
  assert.equal(calls[0].url, 'https://demo.supabase.co/auth/v1/signup');
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(calls[0].init.headers.apikey, 'ANON');
  assert.equal(calls[0].init.headers.Authorization, undefined);
  assert.deepEqual(calls[0].body, { data: {}, gotrue_meta_security: {} });
});

test('supabase client: authenticated PostgREST + RPC calls and error mapping', async () => {
  const { fn, calls } = mockFetch([
    ['/rest/v1/level_progress', () => ({ json: [{ level_id: 1, stars: 2, best_time_ms: 5000 }] })],
    ['/rest/v1/rpc/purchase_item', () => ({ status: 400, json: { message: 'insufficient_coins', code: 'P0001' } })],
  ]);
  const c = new SupaClient('https://demo.supabase.co', 'ANON', { accessToken: 'AT', refreshToken: 'RT', expiresAt: 9e9, userId: 'u', email: null }, fn);
  const rows = await c.select('level_progress', 'select=level_id,stars,best_time_ms');
  assert.equal(rows.length, 1);
  assert.equal(calls[0].init.headers.Authorization, 'Bearer AT');
  await assert.rejects(c.rpc('purchase_item', { p_item_id: 'x' }), (e) => e instanceof SupaError && e.status === 400 && e.message === 'insufficient_coins');
  assert.equal(SupaClient.validUrl('http://evil.example'), false);
  assert.equal(SupaClient.validUrl('https://x.supabase.co'), true);
});

test('sync: pushes pending runs, drops rejected, keeps offline ones, merges best progress', async () => {
  let n = 0;
  const { fn } = mockFetch([
    ['/functions/v1/submit-run', () => {
      n++;
      if (n === 1) return { json: { ok: true } };
      if (n === 2) return { status: 422, json: { ok: false, error: 'not_completed' } };
      throw new TypeError('offline');
    }],
    ['/rest/v1/profiles', () => ({ json: [{ coins: 777 }] })],
    ['/rest/v1/level_progress', () => ({ json: [{ level_id: 1, stars: 3, best_time_ms: 6000 }, { level_id: 2, stars: 1, best_time_ms: 9000 }] })],
    ['/rest/v1/garage_items', () => ({ json: [{ item_id: 'cobalt' }] })],
  ]);
  const c = new SupaClient('https://demo.supabase.co', 'ANON', { accessToken: 'AT', refreshToken: 'RT', expiresAt: 9e9, userId: 'u-1', email: null }, fn);
  const save = sanitize({});
  save.progress = { 1: { stars: 2, bestMs: 4000 } };
  const run = { levelId: 1, replay: { v: 1, levelId: 1, taps: [], endTick: 1 }, at: 'x' };
  save.cloud = { ...save.cloud, enabled: true, pending: [run, { ...run, levelId: 2 }, { ...run, levelId: 3 }] };
  const out = await syncNow(c, save);
  assert.equal(out.pushed, 1);
  assert.equal(out.rejected, 1);
  assert.equal(out.kept.length, 1);
  assert.equal(out.kept[0].levelId, 3);
  assert.equal(out.coins, 777);
  assert.deepEqual(out.progress['1'], { stars: 3, bestMs: 4000 });
  assert.deepEqual(out.progress['2'], { stars: 1, bestMs: 9000 });
  assert.deepEqual(out.owned, ['cobalt']);
  assert.deepEqual(out.daily, {});
});
