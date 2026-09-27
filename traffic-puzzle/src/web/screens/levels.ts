/** Level map: 3 chapters × level tiles with stars, locks and boss crowns. */

import { CAMPAIGN, CHAPTERS } from '../../content/campaign.js';
import type { App } from '../app.js';
import { clear, fmtTime, h } from '../dom.js';
import { icon, starRow, type IconName } from '../icons.js';
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
      ...CHAPTERS.map((ch) =>
        h(
          'section',
          { class: 'chapter' },
          h('h2', null, ch.title),
          h('p', { class: 'muted' }, ch.subtitle),
          h(
            'div',
            { class: 'level-grid' },
            ...CAMPAIGN.filter((l) => l.id >= ch.from && l.id <= ch.to).map((l) => {
              const unlocked = isUnlocked(save, l.id);
              const p = save.progress[String(l.id)];
              const boss = l.band === 'boss';
              return h(
                'button',
                {
                  class: `level-tile${boss ? ' boss' : ''}${unlocked ? '' : ' locked'}${p ? ' done' : ''}`,
                  disabled: !unlocked,
                  title: `${l.id}. ${l.name}`,
                  onclick: () => {
                    sfx.unlock();
                    sfx.click();
                    store.getState().play(l.id);
                  },
                },
                h('div', { class: 'tile-top' }, h('span', { class: 'tile-num' }, String(l.id)), h('span', { class: 'tile-icon' }, icon(boss ? 'cop' : ICON[l.junction] ?? 'cross'))),
                h('div', { class: 'tile-name' }, unlocked ? l.name : icon('lock')),
                unlocked ? starRow(p?.stars ?? 0, 3, 'tile-stars') : null,
                p ? h('div', { class: 'tile-time' }, fmtTime(p.bestMs)) : null,
              );
            }),
          ),
        ),
      ),
    ),
  );
  return () => undefined;
}
