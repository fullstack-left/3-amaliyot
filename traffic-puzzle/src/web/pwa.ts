/**
 * Progressive Web App glue: service-worker registration (offline play) and the
 * "install" prompt. Everything is optional — the game works without it (e.g.
 * opened from file://, or in browsers without service workers).
 */

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<(available: boolean) => void>();

function emit(): void {
  for (const fn of listeners) fn(deferred !== null);
}

export function initInstallPrompt(): void {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    emit();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    emit();
  });
}

export function canInstall(): boolean {
  return deferred !== null;
}

/** Show the browser's install dialog. Resolves true when the user accepted. */
export async function promptInstall(): Promise<boolean> {
  const d = deferred;
  if (!d) return false;
  deferred = null;
  emit();
  await d.prompt();
  const choice = await d.userChoice;
  return choice.outcome === 'accepted';
}

export function onInstallAvailability(fn: (available: boolean) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Register ./sw.js on http(s) origins (not on file:// and not when unsupported). */
export function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return;
  if (location.protocol !== 'https:' && location.protocol !== 'http:') return;
  const go = () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      /* offline support is best-effort */
    });
  };
  if (document.readyState === 'complete') go();
  else window.addEventListener('load', go, { once: true });
}
