/** Level map: 3 chapters with progress bars × level tiles (stars, best time, locks, boss, ambience, tutorial). */

import { CAMPAIGN, CHAPTERS } from '../../content/campaign.js';
import type { App } from '../app.js';
import { clear, fmtTime, h } from '../dom.js';
import { AMBIENCE_ICON, AMBIENCE_UZ, icon, starRow, type IconName } from '../icons.js';
import { isUnlocked, totalStars } from '../save.js';

const ICON: Record<string, IconName> = { cross: 'cross', t: 'tee', roundabout: 'ring' };

export function mountLevels(root: HTMLElement, app: App): () => void {
  const { store, sfx } = app;
  const save = store.getState().save;
  clear(root);
  root.appendChild(
    h(
      'div',
      { class: 'page' },
      h(
        'header',
        { class: 'page-head' },
        h('button', { class: 'btn ghost', onclick: () => store.getState().go('menu') }, icon('back'), 'Menyu'),
        h('h1', null, 'Bosqichlar'),
        h('div', { class: 'head-stats' }, icon('star', 'on'), ` ${totalStars(save)}   `, icon('coin'), ` ${save.coins}`),
      ),
      ...CHAPTERS.map((ch) => {
        const levels = CAMPAIGN.filter((l) => l.id >= ch.from && l.id <= ch.to);
        const done = levels.filter((l) => save.progress[String(l.id)]).length;
        const stars = levels.reduce((s, l) => s + (save.progress[String(l.id)]?.stars ?? 0), 0);
        return h(
          'section',
          { class: 'chapter' },
          h(
            'div',
            { class: 'chapter-head' },
            h('div', null, h('h2', null, ch.title), h('p', { class: 'muted' }, ch.subtitle)),
            h(
              'div',
              { class: 'chapter-progress', title: `${done}/${levels.length} bosqich, ${stars}/${levels.length * 3} yulduz` },
              h('div', { class: 'bar' }, h('span', { style: { width: `${Math.round((100 * done) / levels.length)}%` } })),
              h('small', null, `${done}/${levels.length} · `, icon('star', 'on'), ` ${stars}/${levels.length * 3}`),
            ),
          ),
          h(
            'div',
            { class: 'level-grid' },
            ...levels.map((l) => {
              const unlocked = isUnlocked(save, l.id);
              const p = save.progress[String(l.id)];
              const boss = l.band === 'boss';
              const amb = l.ambience ?? 'day';
              return h(
                'button',
                {
                  class: `level-tile${boss ? ' boss' : ''}${unlocked ? '' : ' locked'}${p ? ' done' : ''}${p?.stars === 3 ? ' perfect' : ''}`,
                  disabled: !unlocked,
                  title: `${l.id}. ${l.name}${amb !== 'day' ? ` · ${AMBIENCE_UZ[amb]}` : ''}${l.coach?.length ? ' · yordamchi bilan' : ''}`,
                  onclick: () => {
                    sfx.unlock();
                    sfx.click();
                    store.getState().play(l.id);
                  },
                },
                h(
                  'div',
                  { class: 'tile-top' },
                  h('span', { class: 'tile-num' }, String(l.id)),
                  h(
                    'span',
                    { class: 'tile-icons' },
                    l.coach?.length ? icon('hand', 'tile-coach') : null,
                    amb !== 'day' ? icon(AMBIENCE_ICON[amb], `tile-amb amb-${amb}`) : null,
                    icon(boss ? 'cop' : ICON[l.junction] ?? 'cross'),
                  ),
                ),
                h('div', { class: 'tile-name' }, unlocked ? l.name : icon('lock')),
                unlocked ? starRow(p?.stars ?? 0, 3, 'tile-stars') : null,
                p ? h('div', { class: 'tile-time' }, icon('clock'), ` ${fmtTime(p.bestMs)}`) : null,
              );
            }),
          ),
        );
      }),
    ),
  );
  return () => undefined;
}
