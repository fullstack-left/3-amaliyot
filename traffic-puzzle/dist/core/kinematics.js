/**
 * Deterministic motion model.
 *
 * The simulation runs at a fixed 60 Hz. Every vehicle that enters the junction
 * starts from rest and follows the SAME speed profile (constant acceleration,
 * then constant cruise). Identical profiles guarantee that a follower on a
 * shared lane can never catch its leader, which keeps merge zones short and
 * collision prediction exact.
 */
export const TICK_HZ = 60;
export const TICK_MS = 1000 / TICK_HZ;
/** Junction crossing profile. */
export const ACCEL = 4.2; // units / s²
export const VMAX = 3.2; // units / s
const T_ACC = VMAX / ACCEL;
const S_ACC = (VMAX * VMAX) / (2 * ACCEL);
/** Queue (lane) movement. */
export const Q_VMAX = 2.6;
export const Q_ACCEL = 5.0;
export const Q_DECEL = 7.0;
/** Bumper-to-bumper gap between queued vehicles. */
export const Q_GAP = 0.4;
/** Minimum gap kept while following. */
export const Q_MIN_GAP = 0.25;
/** Distance travelled `t` seconds after starting from rest. */
export function distAt(t) {
    if (t <= 0)
        return 0;
    if (t <= T_ACC)
        return 0.5 * ACCEL * t * t;
    return S_ACC + VMAX * (t - T_ACC);
}
/** Time (s) needed to travel `s` units from rest. Inverse of distAt. */
export function timeAt(s) {
    if (s <= 0)
        return 0;
    if (s <= S_ACC)
        return Math.sqrt((2 * s) / ACCEL);
    return T_ACC + (s - S_ACC) / VMAX;
}
export function speedAt(t) {
    if (t <= 0)
        return 0;
    return t < T_ACC ? ACCEL * t : VMAX;
}
export function msToTicks(ms) {
    return Math.round((ms * TICK_HZ) / 1000);
}
export function ticksToMs(ticks) {
    return Math.round((ticks * 1000) / TICK_HZ);
}
//# sourceMappingURL=kinematics.js.map