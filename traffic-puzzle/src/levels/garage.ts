/**
 * Garage catalog — models & cosmetic mods.
 * All items are purely visual (skinId on a Vehicle). No gameplay effect,
 * keeping the puzzle fair regardless of what the player buys.
 */

import { GarageItem } from '../state/store.js';

export const GARAGE: GarageItem[] = [
  // Models (local avtopark)
  { id: 'cobalt', name: 'Chevrolet Cobalt', price: 0, type: 'MODEL' },
  { id: 'nexia', name: 'Nexia 3', price: 40, type: 'MODEL' },
  { id: 'malibu', name: 'Malibu 2', price: 120, type: 'MODEL' },
  { id: 'damas', name: 'Damas', price: 30, type: 'MODEL' },
  // Cosmetic mods
  { id: 'sport-wheels', name: 'Sport g‘ildiraklar', price: 60, type: 'MOD' },
  { id: 'spoiler', name: 'Spoyler', price: 50, type: 'MOD' },
  { id: 'metan-ballon', name: 'Metan gaz baloni (hajviy)', price: 25, type: 'MOD' },
  { id: 'ecu-tune', name: 'ECU tuning ovozi', price: 80, type: 'MOD' },
];
