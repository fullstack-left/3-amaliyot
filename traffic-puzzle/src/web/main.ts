/**
 * Bootstrap: app store → screen router (+ URL hash: back button, reloads,
 * shared links) → toasts → PWA (offline service worker, install prompt).
 */

import { createApp, type AppState, type Screen } from './app.js';
import { h } from './dom.js';
import { iconOf } from './icons.js';
import { initInstallPrompt, registerServiceWorker } from './pwa.js';
import { parseHash, routeHash, type Route } from './router.js';
import { isUnlocked } from './save.js';
import { mountAchievements } from './screens/achievements.js';
import { mountEditor } from './screens/editor.js';
import { mountGarage } from './screens/garage.js';
import { mountLevels } from './screens/levels.js';
import { mountMenu } from './screens/menu.js';
import { mountPlay } from './screens/play.js';
import { mountRules } from './screens/rules.js';
import { mountSettings } from './screens/settings.js';
import { mountStats } from './screens/stats.js';
import { decodeLevel, encodeLevel } from './share.js';
import { subscribeSelector } from './store.js';

const SCREENS: Record<Screen, typeof mountMenu> = {
  menu: mountMenu,
  levels: mountLevels,
  play: mountPlay,
  garage: mountGarage,
  settings: mountSettings,
  rules: mountRules,
  editor: mountEditor,
  stats: mountStats,
  achievements: mountAchievements,
};

/** Store state → URL route. */
function routeOf(s: AppState): Route {
  if (s.screen !== 'play') return { screen: s.screen };
  const t = s.target;
  if (!t) return { screen: 'menu' };
  switch (t.kind) {
    case 'campaign':
      return { screen: 'play', kind: 'campaign', id: t.id };
    case 'daily':
      return { screen: 'play', kind: 'daily', day: t.day };
    case 'endless':
      return { screen: 'play', kind: 'endless', variant: t.variant };
    case 'custom':
      return { screen: 'play', kind: 'custom', code: encodeLevel(t.def) };
  }
}

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

  // --- URL ⇄ state ---------------------------------------------------------
  let fromUrl = false;
  const applyRoute = (route: Route) => {
    const s = store.getState();
    fromUrl = true;
    try {
      if (route.screen !== 'play') {
        s.go(route.screen);
        return;
      }
      switch (route.kind) {
        case 'campaign':
          if (isUnlocked(s.save, route.id)) s.play(route.id);
          else {
            s.notify(`${route.id}-bosqich hali ochilmagan — avvalgilarini o'ting`, 'info', 'lock');
            s.go('levels');
          }
          break;
        case 'daily':
          s.playDaily(route.day ?? undefined);
          break;
        case 'endless':
          s.playEndless(route.variant);
          break;
        case 'custom': {
          const r = decodeLevel(route.code);
          if (r.ok) s.playCustom(r.def);
          else {
            s.notify(`Ulashilgan bosqichni ochib bo'lmadi: ${r.error}`, 'err');
            s.go('menu');
          }
          break;
        }
      }
    } finally {
      fromUrl = false;
    }
  };

  // re-mount on every navigation (also "next level" while already on the play screen)
  subscribeSelector(
    store,
    (s) => s.nav,
    () => {
      const s = store.getState();
      const hash = routeHash(routeOf(s));
      if (location.hash !== hash) {
        if (fromUrl) history.replaceState(null, '', hash);
        else history.pushState(null, '', hash);
      }
      show(s.screen);
    },
  );
  window.addEventListener('popstate', () => applyRoute(parseHash(location.hash)));

  // --- toasts ----------------------------------------------------------------
  let toastTimer: ReturnType<typeof setTimeout> | null = null;
  subscribeSelector(
    store,
    (s) => s.toast,
    (t) => {
      if (!t) return;
      toastEl.replaceChildren(...(t.icon ? [iconOf(t.icon, '', 'check')] : []), document.createTextNode(` ${t.text}`));
      toastEl.className = `toast ${t.kind}`;
      if (toastTimer) clearTimeout(toastTimer);
      toastTimer = setTimeout(() => toastEl.classList.add('hidden'), t.kind === 'achievement' ? 4200 : 2600);
    },
  );

  window.addEventListener('pointerdown', () => app.sfx.unlock(), { once: true });
  initInstallPrompt();
  registerServiceWorker();

  // first screen: from the URL (reload / shared link), else the menu
  const initial = parseHash(location.hash);
  if (initial.screen === 'menu') show('menu');
  else applyRoute(initial);
  // grant achievements already earned by older saves (v1 migration, cloud sync)
  setTimeout(() => store.getState().checkAchievements(), 600);
}

boot();
