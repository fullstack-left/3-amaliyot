/**
 * Stars + coin rewards. Shared by client and server so both compute the same
 * economy from the same verified result.
 *
 *   ★ completion   ★ no mistakes   ★ time ≤ par
 *
 * Coins = vehicle coins (+hero bonus) + band bonus on FIRST clear
 *       + 10 per NEWLY earned star. Failed attempts earn nothing (no farming).
 */

import type { Band } from './types.js';

export const BAND_BONUS: Readonly<Record<Band, number>> = {
  base: 10,
  complex: 15,
  roundabout: 20,
  boss: 50,
};

export const STAR_COINS = 10;

export function computeStars(mistakes: number, timeMs: number, parMs: number): number {
  return 1 + (mistakes === 0 ? 1 : 0) + (timeMs <= parMs ? 1 : 0);
}

export interface RewardInput {
  readonly completed: boolean;
  readonly stars: number;
  readonly vehicleCoins: number;
}

export interface Reward {
  readonly total: number;
  readonly vehicles: number;
  readonly completion: number;
  readonly stars: number;
}

export function computeReward(band: Band, result: RewardInput, prevBestStars: number): Reward {
  if (!result.completed) return { total: 0, vehicles: 0, completion: 0, stars: 0 };
  const vehicles = result.vehicleCoins;
  const completion = prevBestStars <= 0 ? BAND_BONUS[band] : 0;
  const stars = STAR_COINS * Math.max(0, result.stars - prevBestStars);
  return { total: vehicles + completion + stars, vehicles, completion, stars };
}
