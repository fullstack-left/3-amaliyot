/** v3 content: daily challenge, endless mode, achievements, practice analytics, coach, exclusives. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { autoplay, GameEngine, loadLevel, validateLevel, verifyReplay } from '../dist/core/index.js';
import { CAMPAIGN } from '../dist/content/campaign.js';
import {
  buildDailyLevel, dailyAmbience, dailyId, dailyLevel, dailyTheme, dayIndexOf, dayKeyFromIndex, dayLabel,
  DAILY_THEMES, isDailyId, weekdayOf,
} from '../dist/content/daily.js';
import { endlessLevel, ENDLESS_LIMITS, ENDLESS_OVERFLOW, ENDLESS_VARIANTS, isEndlessId } from '../dist/content/endless.js';
import { ACHIEVEMENTS, achievementStates, newlyUnlocked } from '../dist/content/achievements.js';
import { PRACTICE_LEVEL, violationBreakdown, weakestRule, accuracy } from '../dist/content/practice.js';
import { ALL_ITEMS, EXCLUSIVE_ITEMS, exclusiveRewards, findItem, findPaint } from '../dist/content/garage.js';

const TODAY = dayIndexOf('2026-09-27');

test('daily: calendar arithmetic', () => {
  assert.equal(dayIndexOf('2026-01-01'), 0);
  assert.equal(dayKeyFromIndex(TODAY), '2026-09-27');
  assert.equal(dayIndexOf('2026-09-28') - TODAY, 1);
  assert.ok(Number.isNaN(dayIndexOf('2026-02-30')));
  assert.ok(Number.isNaN(dayIndexOf('27.09.2026')));
  assert.equal(weekdayOf(dayIndexOf('2026-09-28')), 0); // Monday
  assert.equal(weekdayOf(dayIndexOf('2026-01-01')), 3); // Thursday
  assert.equal(dayLabel(TODAY), '27-sentyabr');
  assert.equal(DAILY_THEMES.length, 7);
  assert.ok(isDailyId(dailyId(TODAY)) && !isDailyId(12) && !isDailyId(200000));
  assert.deepEqual([0, 1, 2, 3, 4].map(dailyAmbience), ['day', 'evening', 'rain', 'night', 'day']);
});

test('daily: 14 consecutive days validate, are solved by the bot without penalties, and are deterministic', () => {
  const junctions = new Set();
  for (let i = TODAY; i < TODAY + 14; i++) {
    const def = dailyLevel(i);
    assert.equal(def.id, dailyId(i));
    assert.equal(validateLevel(def).ok, true, `day ${dayKeyFromIndex(i)}: ${validateLevel(def).errors}`);
    assert.ok(def.parMs > 0);
    assert.equal(def.ambience, dailyAmbience(i));
    const bot = autoplay(loadLevel(def));
    assert.equal(bot.completed, true, dayKeyFromIndex(i));
    assert.equal(bot.penalties, 0, dayKeyFromIndex(i));
    assert.equal(verifyReplay(loadLevel(def), bot.replay, def.parMs).ok, true);
    junctions.add(def.junction);
    if (i < TODAY + 3) assert.deepEqual(buildDailyLevel(i), def, 'uncached rebuild is identical');
  }
  assert.deepEqual([...junctions].sort(), ['cross', 'roundabout', 't']);
  assert.equal(dailyTheme(dayIndexOf('2026-10-03')).title, 'Regulirovshik'); // Saturday
  assert.ok(dailyLevel(dayIndexOf('2026-10-03')).controller);
});

test('endless: valid long streams that always end in gridlock (idle and skilled)', () => {
  for (const v of ENDLESS_VARIANTS) {
    const def = endlessLevel(v);
    assert.ok(isEndlessId(def.id));
    assert.equal(validateLevel(def).ok, false, 'too many vehicles for untrusted input');
    assert.equal(validateLevel(def, ENDLESS_LIMITS).ok, true);
    const level = loadLevel(def, ENDLESS_LIMITS);
    assert.ok(level.spawns.length > 300);

    const idle = new GameEngine(level, { overflowAt: ENDLESS_OVERFLOW });
    for (let n = 0; n < 60 * 90 && idle.status === 'playing'; n++) idle.step();
    assert.equal(idle.endReason, 'gridlock', `${v}: idle player must gridlock within 90 s`);

    const bot = autoplay(level, { reactionTicks: 12, engine: { overflowAt: ENDLESS_OVERFLOW }, maxTicks: 60 * 60 * 20 });
    assert.equal(bot.completed, false, `${v}: even a perfect bot eventually gridlocks`);
    assert.equal(bot.penalties, 0);
    assert.ok(bot.cleared >= 60 && bot.cleared <= 200, `${v}: bot cleared ${bot.cleared}`);
    console.log(`  endless ${v}: idle gridlock ${(idle.tick / 60).toFixed(1)} s, bot ${bot.cleared} vehicles in ${(bot.ticks / 60).toFixed(0)} s`);
  }
});

const ctx = (over = {}) => ({
  progress: {}, cleared: 0, emergency: 0, deadlocks: 0, dailyCompleted: 0, bestStreak: 0, endlessBest: 0, owned: ['matiz'], mods: [], ...over,
});

test('achievements: unique, reachable goals; progress and unlock evaluation', () => {
  const ids = ACHIEVEMENTS.map((a) => a.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ACHIEVEMENTS.length >= 18);
  for (const a of ACHIEVEMENTS) {
    assert.ok(a.goal >= 1 && a.title && a.desc && a.icon, a.id);
    if (a.reward) assert.ok(EXCLUSIVE_ITEMS.some((i) => i.id === a.reward && i.exclusive === a.id), `${a.id} reward`);
  }
  assert.deepEqual(newlyUnlocked(ctx(), []), []);

  const progress = {};
  for (let id = 1; id <= 10; id++) progress[id] = { stars: id === 10 ? 3 : 2 };
  const c = ctx({ progress, cleared: 320, emergency: 3, endlessBest: 64, mods: ['metan'] });
  const got = newlyUnlocked(c, ['first_win']).map((a) => a.id).sort();
  assert.deepEqual(got, ['boss_first', 'boss_perfect', 'cars_300', 'chapter1', 'endless_50', 'metan'].sort());
  const st = achievementStates(c).find((s) => s.def.id === 'stars_30');
  assert.equal(st.value, 21);
  assert.equal(st.done, false);
  assert.ok(Math.abs(st.ratio - 0.7) < 1e-9);
  // night levels are counted from the campaign's ambience
  const nights = CAMPAIGN.filter((l) => l.ambience === 'night').map((l) => l.id);
  assert.ok(nights.length >= 3);
  const nightCtx = ctx({ progress: Object.fromEntries(nights.slice(0, 3).map((id) => [id, { stars: 1 }])) });
  assert.ok(newlyUnlocked(nightCtx, []).some((a) => a.id === 'night_3'));
});

test('practice analytics: weakest rule, breakdown, accuracy', () => {
  assert.equal(weakestRule({}), null);
  const w = weakestRule({ red_light: 2, right_hand: 5, left_turn: 5 });
  assert.equal(w.reason, 'right_hand'); // tie with left_turn → more fundamental rule first
  assert.equal(w.count, 5);
  assert.equal(w.level, 1);
  const b = violationBreakdown({ red_light: 1, main_road: 3 });
  assert.deepEqual(b.map((x) => x.reason), ['main_road', 'red_light']);
  assert.ok(Math.abs(b[0].share - 0.75) < 1e-9);
  assert.equal(accuracy(0, 0), 1);
  assert.equal(accuracy(9, 1), 0.9);
  for (const id of Object.values(PRACTICE_LEVEL)) assert.ok(CAMPAIGN.some((l) => l.id === id), `practice level ${id}`);
});

test('coach: every tutorial script is a legal solution, step by step', () => {
  const coached = CAMPAIGN.filter((l) => l.coach);
  assert.deepEqual(coached.map((l) => l.id), [1, 2, 3, 5, 11, 21, 31]);
  for (const def of coached) {
    const eng = new GameEngine(loadLevel(def));
    const ids = def.coach.map((s) => s.vehicle);
    assert.equal(new Set(ids).size, eng.vehicles.length, `level ${def.id}: coach covers every vehicle once`);
    for (const step of def.coach) {
      let tapped = false;
      for (let n = 0; n < 60 * 40 && !tapped; n++) {
        const v = eng.byId.get(step.vehicle);
        if (v.state === 'waiting' && eng.preview(v.id).allowed) {
          assert.equal(eng.tap(v.id).verdict, 'go');
          tapped = true;
        } else {
          eng.step();
        }
      }
      assert.ok(tapped, `level ${def.id}: coach step ${step.vehicle} never became legal`);
    }
    for (let n = 0; n < 60 * 20 && eng.status === 'playing'; n++) eng.step();
    assert.equal(eng.status, 'won', `level ${def.id}`);
    assert.equal(eng.mistakes, 0);
  }
});

test('garage exclusives: achievement rewards, not purchasable', () => {
  assert.equal(ALL_ITEMS.some((i) => i.exclusive), false, 'shop catalog has no exclusives');
  assert.deepEqual(exclusiveRewards(['chapter1', 'boss_all']).sort(), ['bayroq', 'oltin']);
  assert.equal(findItem('qovun').kind, 'mod');
  assert.equal(findPaint('oltin').color, '#d4a93a');
});
