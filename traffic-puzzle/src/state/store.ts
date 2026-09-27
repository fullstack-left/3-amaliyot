/**
 * Game store — Zustand-shaped, framework-agnostic.
 * ================================================
 *
 * In a real React Native app you'd write:
 *
 *   import { create } from 'zustand';
 *   export const useGameStore = create<GameStore>()((set, get) => ({ ... }));
 *
 * To keep this repo dependency-free and runnable in a plain browser, we ship a
 * tiny `create` that mirrors Zustand's `(set, get) => state` contract and its
 * `subscribe`/`getState`/`setState` API. Swapping in real Zustand later is a
 * one-line import change — the store definition below is unchanged.
 *
 * WHY a store on top of the engine?
 *   - The engine owns the *simulation* (mutable, tick-driven).
 *   - The store owns *meta/session* state that React should re-render on:
 *     lives, coins, current level index, garage/economy, UI flags, and a
 *     serialisable snapshot of vehicles for the renderer.
 *   - This separation keeps hot per-frame mutation out of React's diffing.
 */

import { GameEngine, GameEvent } from '../core/engine.js';
import { LevelDefinition, Vehicle } from '../core/types.js';

// --- minimal Zustand-compatible create() ----------------------------------
type SetState<T> = (partial: Partial<T> | ((s: T) => Partial<T>)) => void;
type GetState<T> = () => T;
type StoreApi<T> = {
  getState: GetState<T>;
  setState: SetState<T>;
  subscribe: (fn: (s: T, prev: T) => void) => () => void;
};

export function create<T>(
  init: (set: SetState<T>, get: GetState<T>, api: StoreApi<T>) => T,
): StoreApi<T> {
  let state: T;
  const listeners = new Set<(s: T, prev: T) => void>();
  const setState: SetState<T> = (partial) => {
    const prev = state;
    const next = typeof partial === 'function' ? (partial as any)(state) : partial;
    state = { ...state, ...next };
    listeners.forEach((l) => l(state, prev));
  };
  const getState: GetState<T> = () => state;
  const subscribe = (fn: (s: T, prev: T) => void) => {
    listeners.add(fn);
    return () => listeners.delete(fn);
  };
  const api: StoreApi<T> = { getState, setState, subscribe };
  state = init(setState, getState, api);
  return api;
}

// --- economy / garage ------------------------------------------------------
export interface GarageItem {
  id: string;
  name: string;
  price: number;
  type: 'MODEL' | 'MOD';
}

export interface GameStore {
  // session / progression
  levelIndex: number;
  totalCoins: number;
  lives: number;
  coins: number; // coins earned this level
  status: 'idle' | 'playing' | 'won' | 'lost';
  vehicles: Vehicle[]; // snapshot for the renderer
  lastEvent?: GameEvent;
  ownedSkins: string[];
  equippedSkin?: string;

  // engine handle (not for rendering — imperative)
  engine?: GameEngine;

  // actions
  loadLevel: (level: LevelDefinition) => void;
  tap: (vehicleId: string) => void;
  syncFromEngine: () => void;
  buy: (item: GarageItem) => boolean;
  equip: (skinId: string) => void;
}

export const gameStore = create<GameStore>((set, get) => ({
  levelIndex: 0,
  totalCoins: 0,
  lives: 3,
  coins: 0,
  status: 'idle',
  vehicles: [],
  ownedSkins: ['default'],
  equippedSkin: 'default',

  loadLevel(level) {
    const engine = new GameEngine(level);
    engine.subscribe((e) => {
      // Fold engine events into store meta-state.
      const s = get();
      if (e.type === 'MOVE_COMPLETED') {
        set({ coins: s.coins + e.coinsAwarded });
      } else if (e.type === 'COLLISION') {
        set({ lives: e.livesRemaining });
      } else if (e.type === 'LEVEL_COMPLETE') {
        set({
          status: 'won',
          totalCoins: s.totalCoins + e.coins,
        });
      } else if (e.type === 'GAME_OVER') {
        set({ status: 'lost' });
      }
      set({ lastEvent: e });
    });
    set({
      engine,
      status: 'playing',
      lives: engine.lives,
      coins: 0,
      vehicles: engine.getVehicles(),
    });
  },

  tap(vehicleId) {
    get().engine?.tap(vehicleId);
    get().syncFromEngine();
  },

  /** Pull a fresh vehicle snapshot after a tick / tap. */
  syncFromEngine() {
    const e = get().engine;
    if (!e) return;
    const st = e.status();
    set({
      vehicles: e.getVehicles().map((v) => ({ ...v })),
      lives: st.lives,
      coins: st.coins,
    });
  },

  buy(item) {
    const s = get();
    if (s.totalCoins < item.price) return false;
    set({
      totalCoins: s.totalCoins - item.price,
      ownedSkins: s.ownedSkins.includes(item.id)
        ? s.ownedSkins
        : [...s.ownedSkins, item.id],
    });
    return true;
  },

  equip(skinId) {
    if (get().ownedSkins.includes(skinId)) set({ equippedSkin: skinId });
  },
}));
