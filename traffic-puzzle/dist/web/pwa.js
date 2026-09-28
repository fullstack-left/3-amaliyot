/**
 * Progressive Web App glue: service-worker registration (offline play) and the
 * "install" prompt. Everything is optional — the game works without it (e.g.
 * opened from file://, or in browsers without service workers).
 */
let deferred = null;
const listeners = new Set();
function emit() {
    for (const fn of listeners)
        fn(deferred !== null);
}
export function initInstallPrompt() {
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferred = e;
        emit();
    });
    window.addEventListener('appinstalled', () => {
        deferred = null;
        emit();
    });
}
export function canInstall() {
    return deferred !== null;
}
/** Show the browser's install dialog. Resolves true when the user accepted. */
export async function promptInstall() {
    const d = deferred;
    if (!d)
        return false;
    deferred = null;
    emit();
    await d.prompt();
    const choice = await d.userChoice;
    return choice.outcome === 'accepted';
}
export function onInstallAvailability(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
}
/** Register ./sw.js on http(s) origins (not on file:// and not when unsupported). */
export function registerServiceWorker() {
    if (!('serviceWorker' in navigator))
        return;
    if (location.protocol !== 'https:' && location.protocol !== 'http:')
        return;
    const go = () => {
        navigator.serviceWorker.register('./sw.js').catch(() => {
            /* offline support is best-effort */
        });
    };
    if (document.readyState === 'complete')
        go();
    else
        window.addEventListener('load', go, { once: true });
}
//# sourceMappingURL=pwa.js.map