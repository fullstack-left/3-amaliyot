/**
 * Stars + coin rewards. Shared by client and server so both compute the same
 * economy from the same verified result.
 *
 *   ★ completion   ★ no mistakes   ★ time ≤ par
 *
 * Coins = vehicle coins (+hero bonus) + band bonus on FIRST clear
 *       + 10 per NEWLY earned star. Failed attempts earn nothing (no farming).
 */
export const BAND_BONUS = {
    base: 10,
    complex: 15,
    roundabout: 20,
    boss: 50,
};
export const STAR_COINS = 10;
export function computeStars(mistakes, timeMs, parMs) {
    return 1 + (mistakes === 0 ? 1 : 0) + (timeMs <= parMs ? 1 : 0);
}
export function computeReward(band, result, prevBestStars) {
    if (!result.completed)
        return { total: 0, vehicles: 0, completion: 0, stars: 0 };
    const vehicles = result.vehicleCoins;
    const completion = prevBestStars <= 0 ? BAND_BONUS[band] : 0;
    const stars = STAR_COINS * Math.max(0, result.stars - prevBestStars);
    return { total: vehicles + completion + stars, vehicles, completion, stars };
}
//# sourceMappingURL=scoring.js.map