#!/usr/bin/env node
/**
 * End-to-end check of the real game in headless Chromium (fails on any console error):
 *   - fresh player: menu → level 1 with the coach → wrong tap = penalty → correct taps
 *     through the real hit-testing path → win + save
 *   - keyboard play (keys 1–4) → 3-star result card; "why?" tooltip on hover
 *   - queue rule; lights / roundabout / boss / night / rain screens
 *   - hash routing: back button, deep links, shared #/custom/ links
 *   - daily challenge, endless mode, statistics, achievements, editor, garage
 *   - offline: service worker installed → reload with the network off still works
 * Screenshots → docs/screenshots (override with SHOTS_DIR).
 */
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { BASE, ROOT, engineState, launch, startServer, vehiclePoint } from './_browser.mjs';

const SHOTS = process.env.SHOTS_DIR ?? resolve(ROOT, 'docs/screenshots');
mkdirSync(SHOTS, { recursive: true });
const errors = [];
const log = (...a) => console.log('•', ...a);
const check = (ok, msg) => {
  if (!ok) errors.push(msg);
  else log('ok:', msg);
};
const stop = await startServer();
const browser = await launch();
const { encodeLevel } = await import(resolve(ROOT, 'dist/web/share.js'));
const { getLevelDef } = await import(resolve(ROOT, 'dist/content/campaign.js'));

async function newPage(viewport, save) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  if (save) await ctx.addInitScript((s) => localStorage.setItem('chorraha.save.v1', s), JSON.stringify(save));
  const page = await ctx.newPage();
  page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`));
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  return page;
}
const shot = (page, name) => page.screenshot({ path: resolve(SHOTS, `${name}.jpg`), type: 'jpeg', quality: 78 });
async function tapVehicle(page, id) {
  const pt = await vehiclePoint(page, id);
  if (!pt) throw new Error(`vehicle ${id} not found`);
  await page.mouse.click(pt.x, pt.y);
}
async function dismissIntro(page) {
  await page.waitForTimeout(300);
  const intro = await page.$('.modal button:has-text("Tushunarli")');
  if (intro) await intro.click();
}
async function openLevel(page, id, wait = 1500) {
  await page.goto(BASE);
  await page.click('button:has-text("Bosqichlar")');
  await page.click(`.level-tile:has(.tile-num:text-is("${id}"))`);
  await dismissIntro(page);
  await page.waitForTimeout(wait);
}
const hash = (page) => page.evaluate(() => location.hash);
const unlocked = { version: 1, coins: 2600, settings: { unlockAll: true, sound: false } };

try {
  // --- fresh player: menu → level 1 with the coach ----------------------------
  const page = await newPage({ width: 1280, height: 760 });
  await page.goto(BASE);
  await page.waitForSelector('.menu-panel');
  await page.waitForTimeout(2000);
  await shot(page, '01-menu');
  await page.click('button:has-text("Bosqichlar")');
  check((await hash(page)) === '#/levels', 'routing: levels screen has #/levels');
  await page.click('.level-tile >> nth=0');
  await page.waitForSelector('.modal');
  await shot(page, '03-level1-intro');
  await page.click('button:has-text("Tushunarli")');
  await page.waitForTimeout(400);
  check(await page.isVisible('.coach-bar:not(.hidden)'), 'coach: tutorial bar visible on a first play');
  await tapVehicle(page, 'S0'); // must yield to E0 (right-hand rule)
  await page.waitForSelector('.penalty-card:not(.hidden)');
  await page.waitForTimeout(150);
  await shot(page, '04-level1-penalty');
  let s = await engineState(page);
  log('after wrong tap', JSON.stringify(s));
  check(s.lives === 2 && s.mistakes === 1, 'level 1: penalty applied (−1 heart)');
  await page.waitForTimeout(900);
  await tapVehicle(page, 'E0');
  await page.waitForTimeout(300);
  check((await page.textContent('.coach-count'))?.trim() === '2/2', 'coach: advances to step 2 after the right car goes');
  await page.waitForTimeout(1300);
  await tapVehicle(page, 'S0');
  await page.waitForSelector('.modal.result', { timeout: 8000 });
  s = await engineState(page);
  check(s.status === 'won', 'level 1: won');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('chorraha.save.v1') ?? '{}'));
  log('saved', JSON.stringify({ coins: saved.coins, progress: saved.progress, achievements: Object.keys(saved.achievements ?? {}) }));
  check(saved.coins > 0 && !!saved.progress?.['1'], 'level 1: save written');
  check(!!saved.achievements?.first_win, 'achievements: "first_win" unlocked');
  await page.goBack();
  await page.waitForTimeout(300);
  check((await hash(page)) === '#/levels' && (await page.isVisible('.level-grid')), 'routing: back button returns to the level list');

  // --- keyboard play → perfect result, why tooltip ---------------------------------
  const p2 = await newPage({ width: 1280, height: 760 }, unlocked);
  await openLevel(p2, 1, 400);
  await p2.keyboard.press('2'); // E0 (E = key 2) has priority
  await p2.waitForTimeout(1500);
  await p2.keyboard.press('3'); // then S0
  await p2.waitForSelector('.modal.result', { timeout: 8000 });
  s = await engineState(p2);
  check(s.status === 'won' && s.mistakes === 0, 'keyboard: keys 1–4 send the front car of each arm');
  await p2.waitForTimeout(1300);
  await shot(p2, '11-result');

  await openLevel(p2, 12, 1500);
  const fronts = await p2.evaluate(() => window.__chorraha.engine().queues.map((q) => q[0]?.id).filter(Boolean));
  let whyBad = false;
  for (const id of fronts) {
    const pt = await vehiclePoint(p2, id);
    await p2.mouse.move(pt.x, pt.y);
    await p2.waitForTimeout(250);
    if (await p2.isVisible('.why-tip.bad')) {
      whyBad = true;
      break;
    }
  }
  check(whyBad, '"why?" tooltip explains a forbidden move on hover');
  await shot(p2, '05-why-tooltip');
  await p2.mouse.move(5, 700);

  // --- other mechanics -------------------------------------------------------------
  await openLevel(p2, 6, 1200);
  const second = await p2.evaluate(() => window.__chorraha.engine().queues[2][1].id);
  await tapVehicle(p2, second);
  await p2.waitForTimeout(200);
  s = await engineState(p2);
  check(s.lives === 3 && s.mistakes === 0, 'queue: tapping the second car is harmless');
  await openLevel(p2, 21, 3000);
  await shot(p2, '06-traffic-lights');
  await openLevel(p2, 31, 800);
  await p2.evaluate(() => {
    const e = window.__chorraha.engine();
    const f = e.queues.find((q) => q[0])[0];
    e.tap(f.id);
  });
  await p2.waitForTimeout(900);
  await shot(p2, '07-roundabout');
  await openLevel(p2, 10, 2500);
  await shot(p2, '08-boss-controller');
  await openLevel(p2, 24, 2500);
  await shot(p2, '09-night');
  await openLevel(p2, 16, 2500);
  await shot(p2, '09-rain');
  const perf = await newPage({ width: 1280, height: 760 }, { ...unlocked, settings: { ...unlocked.settings, perf: true } });
  await openLevel(perf, 50, 3500);
  const perfStats = await perf.evaluate(() => ({ ...window.__chorraha.renderer.stats }));
  log('final boss render', JSON.stringify({ drawMs: perfStats.drawMs.toFixed(2), drawn: perfStats.drawn, fps: perfStats.fps.toFixed(0) }));
  check(perfStats.drawMs < 4, 'perf: final boss frame renders in < 4 ms (headless, software canvas)');
  await shot(perf, '12-final-boss-perf');

  // --- routing: deep links and shared custom levels -----------------------------------
  await p2.goto(`${BASE}#/play/5`);
  await dismissIntro(p2);
  check((await p2.evaluate(() => window.__chorraha.engine().level.id)) === 5, 'routing: #/play/5 deep link opens level 5');
  const def21 = getLevelDef(21);
  await p2.goto(`${BASE}#/custom/${encodeLevel(def21)}`);
  await dismissIntro(p2);
  check((await p2.evaluate(() => window.__chorraha.engine().level.def.name)) === def21.name, 'routing: shared #/custom/L1.… link opens the level');

  // --- daily + endless ------------------------------------------------------------------
  await p2.goto(BASE);
  await p2.click('.mode-card.daily button');
  await dismissIntro(p2);
  check((await hash(p2)).startsWith('#/daily/') && (await p2.evaluate(() => window.__chorraha.engine().level.id)) >= 100000, 'daily: today’s challenge opens');
  await p2.goto(BASE);
  await p2.click('.variant >> nth=0');
  await dismissIntro(p2);
  check((await p2.evaluate(() => window.__chorraha.engine().overflowAt)) === 7, 'endless: gridlock limit is active');

  // --- pages ------------------------------------------------------------------------------
  await p2.goto(BASE);
  await p2.click('button:has-text("Statistika")');
  check(await p2.isVisible('.stat-cards'), 'statistics screen renders');
  await shot(p2, '15-stats');
  await p2.goto(`${BASE}#/achievements`);
  check(await p2.isVisible('.ach-grid'), 'achievements screen renders');
  await shot(p2, '16-achievements');

  await p2.goto(BASE);
  await p2.click('button:has-text("Garaj")');
  await p2.click('.item-card:has-text("Cobalt") button');
  await p2.click('.tab:has-text("Tuning")');
  for (const name of ['Spoyler', 'Metan', 'ECU tuning']) await p2.click(`.item-card:has-text("${name}") button`);
  await p2.waitForTimeout(700);
  await shot(p2, '10-garage');
  const loadout = await p2.evaluate(() => JSON.parse(localStorage.getItem('chorraha.save.v1')).loadout);
  check(loadout.model === 'cobalt' && loadout.mods.includes('metan'), 'garage: purchase + equip');

  await p2.click('.page-head button:has-text("Menyu")');
  await p2.click('button:has-text("Level muharriri")');
  await p2.click('button:has-text("Tekshirish")');
  const report = (await p2.textContent('.editor-report')).trim();
  log('editor:', report.slice(0, 90));
  check(report.includes("To'g'ri"), 'editor: default level validates and is solvable');
  await p2.selectOption('select[aria-label="Kampaniya bosqichidan nusxa olish"]', '22');
  await p2.waitForTimeout(2200);
  await shot(p2, '17-editor');

  // --- mobile -------------------------------------------------------------------------------
  const mob = await newPage({ width: 390, height: 844 }, unlocked);
  await mob.goto(BASE);
  await mob.waitForTimeout(1200);
  await shot(mob, '02-menu-mobile');
  await openLevel(mob, 12, 1500);
  await shot(mob, '14-mobile-play');
  await mob.goto(`${BASE}#/endless/cross`);
  await dismissIntro(mob);
  await mob.waitForTimeout(7000);
  await shot(mob, '13-endless-mobile');

  // --- offline (PWA) --------------------------------------------------------------------------
  const off = await newPage({ width: 1280, height: 760 }, unlocked);
  await off.goto(BASE);
  await off.waitForSelector('.menu-panel');
  const ready = await off.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await off.reload();
  await off.waitForSelector('.menu-panel');
  const controlled = await off.evaluate(() => !!navigator.serviceWorker.controller);
  check(ready && controlled, 'pwa: service worker installed and controlling the page');
  await off.context().setOffline(true);
  await off.reload();
  await off.waitForSelector('.menu-panel', { timeout: 8000 });
  await off.click('button:has-text("Bosqichlar")');
  await off.click('.level-tile:has(.tile-num:text-is("3"))');
  await dismissIntro(off);
  check((await off.evaluate(() => window.__chorraha.engine().level.id)) === 3, 'pwa: the game loads and plays offline');
  await off.context().setOffline(false);
} catch (e) {
  errors.push(`script: ${e.message}`);
} finally {
  await browser.close();
  stop();
}
console.log('\nERRORS:', errors.length ? errors : 'none');
process.exit(errors.length ? 1 : 0);
