#!/usr/bin/env node
/**
 * End-to-end check of the real game in headless Chromium:
 * menu → level 1 (wrong tap = penalty, then correct taps through the real
 * hit-testing path) → win + save; queue rule; lights / roundabout / boss
 * screens; garage purchase; editor; mobile layout. Fails on any console error.
 * Screenshots → docs/screenshots (override with SHOTS_DIR).
 */
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { BASE, ROOT, engineState, launch, startServer, vehiclePoint } from './_browser.mjs';

const SHOTS = process.env.SHOTS_DIR ?? resolve(ROOT, 'docs/screenshots');
mkdirSync(SHOTS, { recursive: true });
const errors = [];
const log = (...a) => console.log('•', ...a);
const stop = await startServer();
const browser = await launch();

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
async function openLevel(page, id, wait = 1500) {
  await page.goto(BASE);
  await page.click('button:has-text("Bosqichlar")');
  await page.click(`.level-tile:has(.tile-num:text-is("${id}"))`);
  await page.waitForTimeout(300);
  const intro = await page.$('.modal button:has-text("Tushunarli")');
  if (intro) await intro.click();
  await page.waitForTimeout(wait);
}
const unlocked = { version: 1, coins: 2600, settings: { unlockAll: true, sound: false } };

try {
  // --- fresh player: menu → level 1 ---------------------------------------
  const page = await newPage({ width: 1280, height: 760 });
  await page.goto(BASE);
  await page.waitForSelector('.menu-panel');
  await page.waitForTimeout(2000);
  await shot(page, '01-menu');
  await page.click('button:has-text("Bosqichlar")');
  await page.click('.level-tile >> nth=0');
  await page.waitForSelector('.modal');
  await shot(page, '03-level1-intro');
  await page.click('button:has-text("Tushunarli")');
  await page.waitForTimeout(400);
  await tapVehicle(page, 'S0'); // must yield to E0 (right-hand rule)
  await page.waitForSelector('.penalty-card:not(.hidden)');
  await page.waitForTimeout(150);
  await shot(page, '04-level1-penalty');
  let s = await engineState(page);
  log('after wrong tap', JSON.stringify(s));
  if (s.lives !== 2 || s.mistakes !== 1) errors.push('level 1: penalty not applied');
  await page.waitForTimeout(900);
  await tapVehicle(page, 'E0');
  await page.waitForTimeout(1600);
  await tapVehicle(page, 'S0');
  await page.waitForSelector('.modal.result', { timeout: 8000 });
  s = await engineState(page);
  if (s.status !== 'won') errors.push('level 1: not won');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('chorraha.save.v1') ?? '{}'));
  log('saved', JSON.stringify({ coins: saved.coins, progress: saved.progress }));
  if (!(saved.coins > 0) || !saved.progress?.['1']) errors.push('level 1: save not written');

  // --- other mechanics -------------------------------------------------------
  const p2 = await newPage({ width: 1280, height: 760 }, unlocked);
  await openLevel(p2, 6, 1200);
  const second = await p2.evaluate(() => window.__chorraha.engine().queues[2][1].id);
  await tapVehicle(p2, second);
  await p2.waitForTimeout(200);
  s = await engineState(p2);
  if (s.lives !== 3 || s.mistakes !== 0) errors.push('queue: tapping the second car must be harmless');
  await openLevel(p2, 21, 3000);
  await shot(p2, '06-traffic-lights');
  await openLevel(p2, 31, 800);
  await p2.evaluate(() => { const e = window.__chorraha.engine(); const f = e.queues.find((q) => q[0])[0]; e.tap(f.id); });
  await p2.waitForTimeout(900);
  await shot(p2, '07-roundabout');
  await openLevel(p2, 10, 2500);
  await shot(p2, '08-boss-controller');

  await p2.goto(BASE);
  await p2.click('button:has-text("Garaj")');
  await p2.click('.item-card:has-text("Cobalt") button');
  await p2.click('.tab:has-text("Tuning")');
  for (const name of ['Spoyler', 'Metan', 'ECU tuning']) await p2.click(`.item-card:has-text("${name}") button`);
  await p2.waitForTimeout(700);
  await shot(p2, '10-garage');
  const loadout = await p2.evaluate(() => JSON.parse(localStorage.getItem('chorraha.save.v1')).loadout);
  if (loadout.model !== 'cobalt' || !loadout.mods.includes('metan')) errors.push('garage: purchase/equip failed');

  await p2.click('.page-head button:has-text("Menyu")');
  await p2.click('button:has-text("Level muharriri")');
  await p2.click('button:has-text("Tekshirish")');
  const report = (await p2.textContent('.editor-report')).trim();
  log('editor:', report.slice(0, 80));
  if (!report.includes("To'g'ri")) errors.push('editor: default level should validate');

  const mob = await newPage({ width: 390, height: 844 }, unlocked);
  await openLevel(mob, 12, 1500);
  await shot(mob, '14-mobile-play');
} catch (e) {
  errors.push(`script: ${e.message}`);
} finally {
  await browser.close();
  stop();
}
console.log('\nERRORS:', errors.length ? errors : 'none');
process.exit(errors.length ? 1 : 0);
