/** In-game rulebook. */

import { RULEBOOK } from '../../content/rulesText.js';
import type { App } from '../app.js';
import { clear, h } from '../dom.js';
import { icon, type IconName } from '../icons.js';

export function mountRules(root: HTMLElement, app: App): () => void {
  clear(root);
  root.appendChild(
    h(
      'div',
      { class: 'page' },
      h('header', { class: 'page-head' }, h('button', { class: 'btn ghost', onclick: () => app.store.getState().go('menu') }, icon('back'), 'Menyu'), h('h1', null, 'Qoidalar')),
      h('p', { class: 'muted' }, "O'yin qoidalari yo'l harakati qoidalarining chorrahalar bo'limiga asoslangan (soddalashtirilgan o'quv modeli)."),
      h(
        'div',
        { class: 'rule-grid' },
        ...RULEBOOK.map((sec) =>
          h('section', { class: 'card rule-card' }, h('h2', null, icon(sec.icon as IconName), ` ${sec.title}`), h('ul', null, ...sec.points.map((p) => h('li', null, p)))),
        ),
      ),
    ),
  );
  return () => undefined;
}
