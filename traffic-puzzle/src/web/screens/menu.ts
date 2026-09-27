/** Main menu with a live, bot-driven intersection in the background. */

import { getLevel, LEVEL_COUNT } from '../../content/campaign.js';
import { legalMoves } from '../../core/bot.js';
import { GameEngine } from '../../core/engine.js';
import { TICK_MS } from '../../core/kinematics.js';
import type { App } from '../app.js';
import { clear, h } from '../dom.js';
import { icon, type IconName } from '../icons.js';
import { Renderer } from '../render/renderer.js';
import { nextLevel, totalStars } from '../save.js';

const DEMO_LEVELS = [22, 31, 20, 47, 36, 50];

export function mountMenu(root: HTMLElement, app: App): () => void {
  const { store, sfx } = app;
  const save = store.getState().save;
  const canvas = h('canvas', { class: 'menu-canvas', 'aria-hidden': 'true' });
  const cont = nextLevel(save, LEVEL_COUNT);
  const btn = (ic: IconName, label: string, onclick: () => void, cls = 'btn') =>
    h('button', { class: cls, onclick: () => { sfx.unlock(); sfx.click(); onclick(); } }, icon(ic), label);

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
          h('span', { title: "O'tilgan bosqichlar" }, icon('flag'), ` ${Object.keys(save.progress).length} / ${LEVEL_COUNT}`),
        ),
        h(
          'div',
          { class: 'menu-buttons' },
          btn('play', Object.keys(save.progress).length ? `Davom etish (${cont}-bosqich)` : "O'ynashni boshlash", () => store.getState().play(cont), 'btn primary big'),
          btn('map', 'Bosqichlar', () => store.getState().go('levels')),
          btn('car', 'Garaj', () => store.getState().go('garage')),
          btn('book', 'Qoidalar', () => store.getState().go('rules')),
          btn('wrench', 'Level muharriri', () => store.getState().go('editor')),
          btn('gear', 'Sozlamalar', () => store.getState().go('settings')),
        ),
        h('p', { class: 'fineprint' }, "O'zbekiston yo'l harakati qoidalari mantig'iga asoslangan o'quv-boshqotirma o'yin."),
      ),
    ),
  );

  // background demo: the autoplay bot plays a real campaign level
  const renderer = new Renderer(canvas);
  renderer.settings = { spriteCache: true, assist: false, controllerArrows: false, perf: false };
  let idx = Math.floor(Math.random() * DEMO_LEVELS.length);
  let engine = new GameEngine(getLevel(DEMO_LEVELS[idx]));
  const lookCtx = () => ({ levelId: DEMO_LEVELS[idx], ownedModels: ['nexia3', 'cobalt', 'spark', 'gentra', 'damas', 'matiz'], hero: save.loadout });
  renderer.setEngine(engine, lookCtx());
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
  };
}
