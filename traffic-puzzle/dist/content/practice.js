/**
 * Learning analytics: which rule does the player break most, and which lesson
 * teaches it. Pure functions — used by the statistics screen and result cards.
 */
/** Teaching level for each violation reason. */
export const PRACTICE_LEVEL = {
    right_hand: 1,
    left_turn: 3,
    crossing_traffic: 4,
    emergency: 5,
    controller: 10,
    main_road: 11,
    red_light: 21,
    roundabout_ring: 31,
};
/** Tie-break order (more fundamental rules first). */
const ORDER = [
    'right_hand',
    'left_turn',
    'crossing_traffic',
    'main_road',
    'emergency',
    'red_light',
    'roundabout_ring',
    'controller',
];
/** Violation reasons sorted by frequency (desc), with their share of all violations. */
export function violationBreakdown(v) {
    const total = ORDER.reduce((s, r) => s + (v[r] ?? 0), 0);
    return ORDER.filter((r) => (v[r] ?? 0) > 0)
        .map((reason) => ({ reason, count: v[reason] ?? 0, share: total ? (v[reason] ?? 0) / total : 0, level: PRACTICE_LEVEL[reason] ?? null }))
        .sort((a, b) => b.count - a.count || ORDER.indexOf(a.reason) - ORDER.indexOf(b.reason));
}
export function weakestRule(v) {
    return violationBreakdown(v)[0] ?? null;
}
/** Accuracy = legal departures / all state-changing taps. */
export function accuracy(departures, mistakes) {
    const all = departures + mistakes;
    return all === 0 ? 1 : departures / all;
}
//# sourceMappingURL=practice.js.map