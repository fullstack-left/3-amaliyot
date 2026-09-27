/** Bootstrap: app store → screen router → toasts. */

import { createApp, type Screen } from './app.js';
import { h } from './dom.js';
import { mountEditor } from './screens/editor.js';
import { mountGarage } from './screens/garage.js';
import { mountLevels } from './screens/levels.js';
import { mountMenu } from './screens/menu.js';
import { mountPlay } from './screens/play.js';
import { mountRules } from './screens/rules.js';
import { mountSettings } from './screens/settings.js';
import { subscribeSelector } from './store.js';

const SCREENS: Record<Screen, typeof mountMenu> = {
  menu: mountMenu,
  levels: mountLevels,
  play: mountPlay,
  garage: mountGarage,
  settings: mountSettings,
  rules: mountRules,
  editor: mountEditor,
};

function boot(): void {
  const root = document.getElementById('app');
  if (!root) throw new Error('#app topilmadi');
  const app = createApp();
  const { store } = app;

  const screenHost = h('div', { class: 'screen-host' });
  const toastEl = h('div', { class: 'toast hidden', role: 'status', 'aria-live': 'polite' });
  root.replaceChildren(screenHost, toastEl);

  let cleanup: (() => void) | null = null;
  const show = (screen: Screen) => {
    cleanup?.();
    cleanup = SCREENS[screen](screenHost, app);
    screenHost.dataset.screen = screen;
    window.scrollTo(0, 0);
  };

  // re-mount on every navigation (also "next level" while already on the play screen)
  subscribeSelector(
    store,
    (s) => s.nav,
    () => show(store.getState().screen),
  );

  let toastTimer: ReturnType<typeof setTimeout> | null = null;
  subscribeSelector(
    store,
    (s) => s.toast,
    (t) => {
      if (!t) return;
      toastEl.textContent = t.text;
      toastEl.className = `toast ${t.kind}`;
      if (toastTimer) clearTimeout(toastTimer);
      toastTimer = setTimeout(() => toastEl.classList.add('hidden'), 2600);
    },
  );

  window.addEventListener('pointerdown', () => app.sfx.unlock(), { once: true });
  show(store.getState().screen);
}

boot();
