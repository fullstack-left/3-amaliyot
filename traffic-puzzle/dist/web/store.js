/**
 * Zustand-compatible store (`create((set, get, api) => state)`), dependency-free.
 *
 * In React Native swap this file for `import { create } from 'zustand'` — the
 * store definitions using it do not change. Hot per-frame state (vehicles) is
 * NOT stored here; it lives in the GameEngine and is read by the renderer.
 */
export function createStore(init) {
    let state;
    const listeners = new Set();
    const setState = (partial, replace) => {
        const next = typeof partial === 'function' ? partial(state) : partial;
        if (Object.is(next, state))
            return;
        const prev = state;
        state = replace ? next : { ...state, ...next };
        listeners.forEach((l) => l(state, prev));
    };
    const getState = () => state;
    const subscribe = (l) => {
        listeners.add(l);
        return () => {
            listeners.delete(l);
        };
    };
    const api = { getState, setState, subscribe };
    state = init(setState, getState, api);
    return api;
}
/** Subscribe to a derived slice; the listener fires only when the slice changes. */
export function subscribeSelector(api, selector, listener, equals = Object.is) {
    let current = selector(api.getState());
    return api.subscribe((s) => {
        const next = selector(s);
        if (!equals(next, current)) {
            const prev = current;
            current = next;
            listener(next, prev);
        }
    });
}
//# sourceMappingURL=store.js.map