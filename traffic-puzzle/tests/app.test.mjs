/** v3 web layer: save v2, streaks, modes via finishRun, achievements, routing, share links, sync extensions. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp, resolveTarget, achievementContext } from '../dist/web/app.js';
import { applyDailyCompletion, liveStreak, loadSave, sanitize, SAVE_KEY, HISTORY_MAX, defaultSave } from '../dist/web/save.js';
import { parseHash, routeHash } from '../dist/web/router.js';
import { encodeLevel, decodeLevel, canonicalLevel, SHARE_PREFIX } from '../dist/web/share.js';
import { SupaClient } from '../dist/web/net/supabase.js';
import { fetchLeaderboard, setDisplayNameRemote, syncNow } from '../dist/web/net/sync.js';
import { getLevel, CAMPAIGN } from '../dist/content/campaign.js';
import { dailyId, dayIndexOf } from '../dist/content/daily.js';
import { autoplay } from '../dist/core/index.js';

class MemoryStorage {
  map = new Map();
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { this.map.set(k, String(v)); }
  removeItem(k) { this.map.delete(k); }
}
const RESULT = {
  levelId: 1, completed: true, ticks: 600, timeMs: 10000, mistakes: 0, livesLeft: 3, cleared: 4, total: 4,
  vehicleCoins: 8, stars: 3, parMs: 20000, endReason: 'cleared', violations: {}, deadlocks: 0, emergency: 0, departures: 4,
};
const fixedNow = (iso) => () => new Date(iso);

test('save v2: a v1 save migrates with its data intact and new sections defaulted', () => {
  const st = new MemoryStorage();
  st.setItem(SAVE_KEY, JSON.stringify({
    version: 1, coins: 77, progress: { 1: { stars: 2, bestMs: 5000 } }, owned: ['matiz', 'cobalt'],
    settings: { sound: false }, stats: { cleared: 12, mistakes: 3, played: 4, playMs: 60000 },
  }));
  const s = loadSave(st);
  assert.equal(s.version, 2);
  assert.equal(s.coins, 77);
  assert.deepEqual(s.progress['1'], { stars: 2, bestMs: 5000 });
  assert.equal(s.stats.cleared, 12);
  assert.deepEqual(s.stats.violations, {});
  assert.equal(s.settings.sound, false);
  assert.equal(s.settings.effects, true);
  assert.equal(s.settings.volume, 0.8);
  assert.deepEqual(s.daily, { results: {}, streak: 0, bestStreak: 0, lastDay: null });
  assert.equal(s.endless.cross.best, 0);
  assert.deepEqual(s.achievements, {});
  // a save from a future version is not trusted
  st.setItem(SAVE_KEY, JSON.stringify({ version: 99, coins: 5 }));
  assert.equal(loadSave(st).coins, 0);
});

test('save v2: sanitize validates every new section', () => {
  const s = sanitize({
    settings: { volume: 7, effects: false },
    stats: { violations: { right_hand: 4, hacked: 9, red_light: -1 }, hints: 2 },
    achievements: { chapter1: '2026-09-01T00:00:00Z', bad: 5 },
    owned: [],
    loadout: { model: 'matiz', paint: 'sariq', mods: ['bayroq'] },
    daily: { results: { '2026-09-27': { stars: 3, bestMs: 20000 }, 'yesterday': { stars: 1, bestMs: 1 } }, streak: 4, bestStreak: 2, lastDay: '2026-09-27' },
    endless: { cross: { best: 55.7, runs: 3, last: 10 }, bogus: { best: 1 } },
    history: [{ mode: 'daily', levelId: 100269, name: 'x', completed: true, stars: 2, timeMs: 1, mistakes: 0, cleared: 3, at: 'now' }, { mode: 'hack' }],
    profile: { name: '  <b>Ali</b>\n  Valiyev  ' },
  });
  assert.equal(s.settings.volume, 1);
  assert.equal(s.settings.effects, false);
  assert.deepEqual(s.stats.violations, { right_hand: 4 });
  assert.equal(s.stats.hints, 2);
  assert.deepEqual(Object.keys(s.achievements), ['chapter1']);
  assert.ok(s.owned.includes('bayroq'), 'exclusive reward re-granted from achievements');
  assert.deepEqual(s.loadout.mods, ['bayroq']);
  assert.deepEqual(Object.keys(s.daily.results), ['2026-09-27']);
  assert.equal(s.daily.bestStreak, 4, 'best streak can never be below the current one');
  assert.deepEqual(s.endless.cross, { best: 55, runs: 3, last: 10 });
  assert.equal(s.history.length, 1);
  assert.equal(s.profile.name, 'bAli/b Valiyev');
});

test('daily streak: consecutive days grow it, gaps reset it, same day counts once', () => {
  let d = defaultSave().daily;
  d = applyDailyCompletion(d, '2026-09-25');
  d = applyDailyCompletion(d, '2026-09-26');
  d = applyDailyCompletion(d, '2026-09-26');
  d = applyDailyCompletion(d, '2026-09-27');
  assert.equal(d.streak, 3);
  assert.equal(liveStreak(d, '2026-09-28'), 3, 'still alive the next day');
  assert.equal(liveStreak(d, '2026-09-29'), 0, 'broken after a missed day');
  d = applyDailyCompletion(d, '2026-09-30');
  assert.equal(d.streak, 1);
  assert.equal(d.bestStreak, 3);
});

test('finishRun: daily reward, best result, streak only for today', () => {
  const app = createApp(new MemoryStorage(), { now: fixedNow('2026-09-27T10:00:00') });
  const S = () => app.store.getState();
  assert.equal(S().today(), '2026-09-27');
  const target = { kind: 'daily', day: '2026-09-27' };
  const { def } = resolveTarget(target);
  assert.equal(def.id, dailyId(dayIndexOf('2026-09-27')));
  const sum = S().finishRun(target, def, { ...RESULT, levelId: def.id, stars: 2 }, null);
  assert.ok(sum.reward.total > 0);
  assert.deepEqual(sum.daily, { streak: 1, counted: true });
  assert.equal(S().save.daily.results['2026-09-27'].stars, 2);
  assert.equal(S().save.coins, sum.reward.total);
  const again = S().finishRun(target, def, { ...RESULT, levelId: def.id, stars: 3, timeMs: 9000 }, null);
  assert.equal(again.reward.total, RESULT.vehicleCoins + 10, 'vehicles + one newly earned star, no second completion bonus');
  assert.equal(S().save.daily.results['2026-09-27'].stars, 3);
  // an older day can be replayed but never extends the streak
  const old = { kind: 'daily', day: '2026-09-20' };
  const oldSum = S().finishRun(old, resolveTarget(old).def, RESULT, null);
  assert.equal(oldSum.daily.counted, false);
  assert.equal(S().save.daily.streak, 1);
});

test('finishRun: endless records the best score and never pays coins', () => {
  const app = createApp(new MemoryStorage());
  const S = () => app.store.getState();
  const target = { kind: 'endless', variant: 'roundabout' };
  const r = resolveTarget(target);
  assert.equal(r.engine.overflowAt, 7);
  assert.ok(r.limits.maxVehicles >= 400);
  const run = { ...RESULT, completed: false, stars: 0, endReason: 'gridlock', cleared: 42, vehicleCoins: 90 };
  const a = S().finishRun(target, r.def, run, null);
  assert.deepEqual(a.endless, { score: 42, best: 42, record: true });
  const b = S().finishRun(target, r.def, { ...run, cleared: 30 }, null);
  assert.deepEqual(b.endless, { score: 30, best: 42, record: false });
  assert.deepEqual(S().save.endless.roundabout, { best: 42, runs: 2, last: 30 });
  assert.equal(S().save.coins, 0);
});

test('finishRun: stats, history and achievements (with exclusive rewards)', () => {
  const app = createApp(new MemoryStorage(), { now: fixedNow('2026-09-27T12:00:00Z') });
  const S = () => app.store.getState();
  let last;
  for (let id = 1; id <= 10; id++) {
    const def = getLevel(id).def;
    last = S().finishRun({ kind: 'campaign', id }, def, {
      ...RESULT, levelId: id, stars: 3, mistakes: id === 2 ? 1 : 0, violations: id === 2 ? { right_hand: 1 } : {},
      emergency: id === 5 ? 1 : 0, deadlocks: id === 8 ? 1 : 0,
    }, null, { hints: 1 });
  }
  const s = S().save;
  assert.equal(s.stats.played, 10);
  assert.equal(s.stats.cleared, 40);
  assert.equal(s.stats.departures, 40);
  assert.equal(s.stats.hints, 10);
  assert.deepEqual(s.stats.violations, { right_hand: 1 });
  assert.equal(s.stats.emergency, 1);
  assert.equal(s.history.length, 10);
  assert.equal(s.history[0].levelId, 10, 'newest first');
  for (const id of ['first_win', 'chapter1', 'boss_first', 'boss_perfect', 'stars_30', 'perfect_10']) {
    assert.ok(s.achievements[id], `achievement ${id}`);
  }
  assert.ok(last.achievements.some((a) => a.id === 'chapter1'), 'returned in the summary of the run that unlocked it');
  assert.ok(s.owned.includes('bayroq'), 'chapter1 reward granted');
  assert.equal(S().toast.kind, 'achievement');
  // history is capped
  for (let i = 0; i < HISTORY_MAX + 5; i++) S().finishRun({ kind: 'custom', def: getLevel(1).def }, getLevel(1).def, RESULT, null);
  assert.equal(S().save.history.length, HISTORY_MAX);
  // exclusive items cannot be bought, only earned
  assert.equal(achievementContext(S().save).progress['1'].stars, 3);
});

test('garage purchases and equipment can unlock achievements', async () => {
  const app = createApp(new MemoryStorage());
  const S = () => app.store.getState();
  app.store.setState({ save: { ...S().save, coins: 100 } });
  assert.equal(await S().buy('metan'), true);
  assert.equal(S().save.achievements.metan, undefined, 'owning is not enough');
  S().equip('metan');
  assert.ok(S().save.achievements.metan, 'installing it is');
  assert.equal(await S().buy('oltin'), false, 'exclusive paint is not for sale');
});

test('router: every route round-trips; junk falls back to the menu', () => {
  const routes = [
    '#/', '#/levels', '#/garage', '#/settings', '#/rules', '#/editor', '#/stats', '#/achievements',
    '#/play/12', '#/daily', '#/daily/2026-09-28', '#/endless/signals', `#/custom/${SHARE_PREFIX}abc_DEF-1`,
  ];
  for (const h of routes) assert.equal(routeHash(parseHash(h)), h, h);
  for (const bad of ['#/play/0', '#/play/abc', '#/play/1.5', '#/daily/2026-13-01', '#/endless/moon', '#/nope', '#/levels/1', '#/custom/<script>']) {
    assert.deepEqual(parseHash(bad), { screen: 'menu' }, bad);
  }
  assert.deepEqual(parseHash(''), { screen: 'menu' });
  assert.deepEqual(parseHash('#/play/7/'), { screen: 'play', kind: 'campaign', id: 7 });
});

test('share links: canonical, exact round-trip, validated on decode', () => {
  for (const id of [1, 12, 20, 24, 31]) {
    const def = CAMPAIGN.find((l) => l.id === id);
    const code = encodeLevel(def);
    assert.ok(code.startsWith(SHARE_PREFIX) && /^[A-Za-z0-9_.-]+$/.test(code));
    const back = decodeLevel(code);
    assert.equal(back.ok, true, `level ${id}: ${back.error}`);
    assert.deepEqual(back.def, JSON.parse(JSON.stringify(canonicalLevel(def))));
    assert.equal(encodeLevel(back.def), code, 'encode(decode(code)) === code');
  }
  // key order and derived fields do not change the link
  const a = CAMPAIGN[0];
  const shuffled = { parMs: 1, tags: ['x'], arms: [...a.arms].reverse(), junction: a.junction, band: a.band, name: a.name, id: a.id, intro: a.intro, tip: a.tip, coach: a.coach };
  assert.equal(encodeLevel(shuffled), encodeLevel(a));
  assert.equal(decodeLevel('nope').ok, false);
  assert.equal(decodeLevel(`${SHARE_PREFIX}!!!`).ok, false);
  assert.equal(decodeLevel(`${SHARE_PREFIX}${'A'.repeat(9000)}`).ok, false);
  const invalid = encodeLevel({ ...a, junction: 't' }); // cross arms on a T junction
  assert.equal(decodeLevel(invalid).ok, false);
});

function mockFetch(routes) {
  const calls = [];
  const fn = async (url, init = {}) => {
    calls.push({ url, init, body: init.body ? JSON.parse(init.body) : undefined });
    for (const [pattern, handler] of routes) {
      if (url.includes(pattern)) {
        const { status = 200, json } = await handler(url, init);
        return new Response(status === 204 || json === undefined ? null : JSON.stringify(json), { status });
      }
    }
    return new Response('{"message":"no route"}', { status: 404 });
  };
  return { fn, calls };
}
const SESSION = { accessToken: 'AT', refreshToken: 'RT', expiresAt: 9e9, userId: 'u-1', email: null };

test('sync v3: daily rows go to daily results; display name + leaderboard requests', async () => {
  const today = dailyId(dayIndexOf('2026-09-27'));
  const { fn, calls } = mockFetch([
    ['/rest/v1/profiles?select', () => ({ json: [{ coins: 5 }] })],
    ['/rest/v1/level_progress', () => ({ json: [{ level_id: 3, stars: 2, best_time_ms: 7000 }, { level_id: today, stars: 3, best_time_ms: 21000 }] })],
    ['/rest/v1/garage_items', () => ({ json: [] })],
    ['/rest/v1/profiles?id=eq.', () => ({ status: 204 })],
    ['/rest/v1/rpc/leaderboard', () => ({ json: [{ rank: 1, display_name: 'Ali', stars: 3, best_time_ms: 9000, is_me: true }] })],
  ]);
  const c = new SupaClient('https://demo.supabase.co', 'ANON', SESSION, fn);
  const out = await syncNow(c, sanitize({}));
  assert.deepEqual(out.progress, { 3: { stars: 2, bestMs: 7000 } });
  assert.deepEqual(out.daily, { '2026-09-27': { stars: 3, bestMs: 21000 } });

  await setDisplayNameRemote(c, 'Ali');
  const patch = calls.find((x) => x.init.method === 'PATCH');
  assert.equal(patch.url, 'https://demo.supabase.co/rest/v1/profiles?id=eq.u-1');
  assert.deepEqual(patch.body, { display_name: 'Ali' });
  assert.equal(patch.init.headers.Prefer, 'return=minimal');
  assert.equal(patch.init.headers.Authorization, 'Bearer AT');

  const rows = await fetchLeaderboard(c, 12, 5);
  assert.equal(rows[0].is_me, true);
  const rpc = calls.find((x) => x.url.endsWith('/rest/v1/rpc/leaderboard'));
  assert.deepEqual(rpc.body, { p_level: 12, p_limit: 5 });
});

test('resolveTarget: campaign, daily, endless and custom targets', () => {
  assert.equal(resolveTarget({ kind: 'campaign', id: 999 }), null);
  assert.equal(resolveTarget({ kind: 'daily', day: 'x' }), null);
  assert.equal(resolveTarget({ kind: 'campaign', id: 7 }).def.id, 7);
  assert.equal(resolveTarget({ kind: 'endless', variant: 'cross' }).mode, 'endless');
  const def = getLevel(2).def;
  assert.equal(resolveTarget({ kind: 'custom', def }).def, def);
  const bot = autoplay(getLevel(2));
  assert.equal(bot.completed, true);
});
