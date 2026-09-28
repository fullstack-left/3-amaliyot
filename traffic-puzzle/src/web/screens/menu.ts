/**
 * Main menu (v3): live bot-driven intersection in the background, "continue",
 * the daily challenge card (weekday theme, streak), endless mode variants with
 * personal bests, and the rest of the game (levels, garage, rules,
 * achievements, statistics, editor, settings).
 */

import { ACHIEVEMENTS } from '../../content/achievements.js';
import { getLevel, LEVEL_COUNT } from '../../content/campaign.js';
import { dailyAmbience, dailyTheme, dayIndexOf, dayLabel, weekdayOf, WEEKDAYS_UZ } from '../../content/daily.js';
import { ENDLESS_INFO, ENDLESS_VARIANTS } from '../../content/endless.js';
import { legalMoves } from '../../core/bot.js';
import { GameEngine } from '../../core/engine.js';
import { TICK_MS } from '../../core/kinematics.js';
import type { App } from '../app.js';
import { clear, fmtTime, h } from '../dom.js';
import { AMBIENCE_ICON, AMBIENCE_UZ, icon, iconOf, starRow, type IconName } from '../icons.js';
import { DEFAULT_RENDER_SETTINGS, Renderer } from '../render/renderer.js';
import { canInstall, onInstallAvailability, promptInstall } from '../pwa.js';
import { liveStreak, nextLevel, totalStars } from '../save.js';

const DEMO_LEVELS = [22, 31, 20, 47, 36, 50, 24, 43];

export function mountMenu(root: HTMLElement, app: App): () => void {
  const { store, sfx } = app;
  const st = store.getState();
  const save = st.save;
  const today = st.today();
  const dayIdx = dayIndexOf(today);
  const theme = dailyTheme(dayIdx);
  const amb = dailyAmbience(dayIdx);
  const dailyRes = save.daily.results[today];
  const streak = liveStreak(save.daily, today);
  const doneCount = Object.keys(save.progress).length;
  const cont = nextLevel(save, LEVEL_COUNT);
  const achDone = Object.keys(save.achievements).length;
  const canvas = h('canvas', { class: 'menu-canvas', 'aria-hidden': 'true' });
  const act = (fn: () => void) => () => {
    sfx.unlock();
    sfx.click();
    fn();
  };
  const btn = (ic: IconName, label: string, onclick: () => void, cls = 'btn', extra?: string) =>
    h('button', { class: cls, onclick: act(onclick) }, icon(ic), label, extra ? h('span', { class: 'btn-extra' }, extra) : null);

  const installBtn = h(
    'button',
    {
      class: `btn install-btn${canInstall() ? '' : ' hidden'}`,
      title: "O'yinni telefon/kompyuterga o'rnatish (internetsiz ham ishlaydi)",
      onclick: act(() => {
        void promptInstall().then((ok) => ok && store.getState().notify("O'rnatildi! Endi internetsiz ham o'ynash mumkin.", 'ok', 'install'));
      }),
    },
    icon('install'),
    "O'rnatish",
  );
  const offInstall = onInstallAvailability((ok) => installBtn.classList.toggle('hidden', !ok));

  const dailyCard = h(
    'section',
    { class: `mode-card daily${dailyRes ? ' done' : ''}` },
    h(
      'div',
      { class: 'mode-head' },
      h('span', { class: 'mode-ic' }, icon('calendar')),
      h('div', null, h('b', null, 'Kunlik chorraha'), h('small', null, `${WEEKDAYS_UZ[weekdayOf(dayIdx)]}, ${dayLabel(dayIdx)}`)),
      streak > 0 ? h('span', { class: 'streak', title: 'Ketma-ket kunlar' }, icon('fire'), ` ${streak}`) : null,
    ),
    h(
      'div',
      { class: 'mode-theme' },
      iconOf(theme.icon, 'theme-ic', 'cross'),
      h('div', null, h('b', null, theme.title), h('small', null, theme.subtitle)),
      h('span', { class: 'amb', title: AMBIENCE_UZ[amb] }, icon(AMBIENCE_ICON[amb])),
    ),
    dailyRes
      ? h(
          'div',
          { class: 'mode-status' },
          starRow(dailyRes.stars, 3),
          h('small', null, ` eng yaxshi: ${fmtTime(dailyRes.bestMs)}`),
          h('button', { class: 'btn small', onclick: act(() => store.getState().playDaily()) }, 'Qayta'),
        )
      : h('button', { class: 'btn primary', onclick: act(() => store.getState().playDaily()) }, icon('play'), "Bugungi chorrahani o'ynash"),
  );

  const endlessCard = h(
    'section',
    { class: 'mode-card endless' },
    h(
      'div',
      { class: 'mode-head' },
      h('span', { class: 'mode-ic' }, icon('infinity')),
      h('div', null, h('b', null, 'Cheksiz tirbandlik'), h('small', null, "Bir yo'lda 7 tadan ko'p mashina — o'yin tugaydi")),
    ),
    h(
      'div',
      { class: 'variant-row' },
      ...ENDLESS_VARIANTS.map((v) => {
        const inf = ENDLESS_INFO[v];
        const best = save.endless[v].best;
        return h(
          'button',
          { class: 'variant', title: inf.subtitle, onclick: act(() => store.getState().playEndless(v)) },
          iconOf(inf.icon, 'variant-ic', 'cross'),
          h('span', { class: 'variant-name' }, inf.title),
          h('small', null, best ? `rekord ${best}` : 'yangi'),
        );
      }),
    ),
  );

  clear(root);
  root.appendChild(
    h(
      'div',
      { class: 'menu' },
      canvas,
      h(
        'div',
        { class: 'menu-panel' },
        h('div', { class: 'logo' }, icon('light', 'logo-ic')),
        h('h1', null, 'Chorraha Boshqaruvi'),
        h('p', { class: 'subtitle' }, "Siz — chorrahaning ko'rinmas tartibga soluvchisisiz. Qoidani bilgan — birinchi o'tkazadi!"),
        h(
          'div',
          { class: 'menu-stats' },
          h('span', { title: 'Tangalar' }, icon('coin'), ` ${save.coins}`),
          h('span', { title: 'Yulduzlar' }, icon('star', 'on'), ` ${totalStars(save)} / ${LEVEL_COUNT * 3}`),
          h('span', { title: "O'tilgan bosqichlar" }, icon('flag'), ` ${doneCount} / ${LEVEL_COUNT}`),
          h('span', { title: 'Yutuqlar' }, icon('trophy'), ` ${achDone} / ${ACHIEVEMENTS.length}`),
        ),
        btn('play', doneCount ? `Davom etish (${cont}-bosqich)` : "O'ynashni boshlash", () => store.getState().play(cont), 'btn primary big'),
        h('div', { class: 'mode-cards' }, dailyCard, endlessCard),
        h(
          'div',
          { class: 'menu-grid' },
          btn('map', 'Bosqichlar', () => store.getState().go('levels')),
          btn('car', 'Garaj', () => store.getState().go('garage')),
          btn('book', 'Qoidalar', () => store.getState().go('rules')),
          btn('trophy', 'Yutuqlar', () => store.getState().go('achievements'), 'btn', `${achDone}/${ACHIEVEMENTS.length}`),
          btn('chart', 'Statistika', () => store.getState().go('stats')),
          btn('wrench', 'Level muharriri', () => store.getState().go('editor')),
          btn('gear', 'Sozlamalar', () => store.getState().go('settings')),
          installBtn,
        ),
        h('p', { class: 'fineprint' }, "O'zbekiston yo'l harakati qoidalari mantig'iga asoslangan o'quv-boshqotirma o'yin."),
      ),
    ),
  );

  // background demo: the autoplay bot plays a real campaign level
  const renderer = new Renderer(canvas);
  renderer.settings = { ...DEFAULT_RENDER_SETTINGS, assist: false };
  let idx = Math.floor(Math.random() * DEMO_LEVELS.length);
  let engine = new GameEngine(getLevel(DEMO_LEVELS[idx]));
  const lookCtx = () => ({ levelId: DEMO_LEVELS[idx], ownedModels: ['nexia3', 'cobalt', 'spark', 'gentra', 'damas', 'matiz'], hero: save.loadout });
  renderer.setEngine(engine, lookCtx());
  engine.on((e) => renderer.onEvent(e));
  let raf = 0;
  let last = performance.now();
  let acc = 0;
  let cooldown = 0;
  let doneAt = 0;
  const frame = (now: number) => {
    acc += Math.min(250, now - last);
    last = now;
    while (acc >= TICK_MS) {
      acc -= TICK_MS;
      if (engine.status === 'playing') {
        if (--cooldown <= 0) {
          const m = legalMoves(engine);
          if (m.length) {
            engine.tap(m[0].id);
            cooldown = 30;
          }
        }
        engine.step();
      } else if (!doneAt) {
        doneAt = now;
      }
    }
    if (doneAt && now - doneAt > 1500) {
      idx = (idx + 1) % DEMO_LEVELS.length;
      engine = new GameEngine(getLevel(DEMO_LEVELS[idx]));
      renderer.setEngine(engine, lookCtx());
      engine.on((e) => renderer.onEvent(e));
      doneAt = 0;
    }
    renderer.render(acc / TICK_MS, now);
    raf = requestAnimationFrame(frame);
  };
  const ro = new ResizeObserver(() => renderer.resize());
  ro.observe(canvas);
  raf = requestAnimationFrame(frame);
  return () => {
    cancelAnimationFrame(raf);
    ro.disconnect();
    offInstall();
  };
}
