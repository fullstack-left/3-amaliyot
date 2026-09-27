/**
 * Zustand-compatible store (`create((set, get, api) => state)`), dependency-free.
 *
 * In React Native swap this file for `import { create } from 'zustand'` — the
 * store definitions using it do not change. Hot per-frame state (vehicles) is
 * NOT stored here; it lives in the GameEngine and is read by the renderer.
 */

export type SetState<T> = (partial: Partial<T> | ((s: T) => Partial<T>), replace?: boolean) => void;
export type GetState<T> = () => T;
export type Listener<T> = (state: T, prev: T) => void;

export interface StoreApi<T> {
  getState: GetState<T>;
  setState: SetState<T>;
  subscribe: (listener: Listener<T>) => () => void;
}

export function createStore<T>(init: (set: SetState<T>, get: GetState<T>, api: StoreApi<T>) => T): StoreApi<T> {
  let state: T;
  const listeners = new Set<Listener<T>>();
  const setState: SetState<T> = (partial, replace) => {
    const next = typeof partial === 'function' ? partial(state) : partial;
    if (Object.is(next, state)) return;
    const prev = state;
    state = replace ? (next as T) : { ...state, ...next };
    listeners.forEach((l) => l(state, prev));
  };
  const getState: GetState<T> = () => state;
  const subscribe = (l: Listener<T>) => {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  };
  const api: StoreApi<T> = { getState, setState, subscribe };
  state = init(setState, getState, api);
  return api;
}

/** Subscribe to a derived slice; the listener fires only when the slice changes. */
export function subscribeSelector<T, U>(
  api: StoreApi<T>,
  selector: (s: T) => U,
  listener: (value: U, prev: U) => void,
  equals: (a: U, b: U) => boolean = Object.is,
): () => void {
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
