/**
 * Direction algebra + right-hand-traffic lane geometry.
 *
 * Directions are indexed clockwise (N=0, E=1, S=2, W=3) so "the approach on my
 * right" and turn exits are pure modular arithmetic.
 */
export const DIRS = [0, 1, 2, 3];
export const DIR_LETTERS = ['N', 'E', 'S', 'W'];
export const DIR_NAMES_UZ = ['Shimol', 'Sharq', 'Janub', "G'arb"];
/** Unit vector pointing from the centre toward each arm (y-down world). */
export const DIR_VEC = [
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 0],
];
export const TURNS = ['straight', 'left', 'right'];
export const MOVEMENTS = 12;
export function rot(d, k) {
    return ((((d + k) % 4) + 4) % 4);
}
export function opposite(d) {
    return rot(d, 2);
}
/**
 * The arm whose traffic is on the RIGHT of a driver arriving from `d`.
 * Arriving from S the driver heads north; their right hand points east → E.
 */
export function rightOf(d) {
    return rot(d, 3);
}
/** The arm on the driver's LEFT. */
export function leftOf(d) {
    return rot(d, 1);
}
/** Exit arm for a vehicle arriving from `from` making `turn`. */
export function exitOf(from, turn) {
    const heading = opposite(from);
    if (turn === 'straight')
        return heading;
    return turn === 'right' ? rot(heading, 1) : rot(heading, 3);
}
export function turnIndex(t) {
    return t === 'straight' ? 0 : t === 'left' ? 1 : 2;
}
export function movementIndex(from, turn) {
    return from * 3 + turnIndex(turn);
}
export function movementFrom(move) {
    return Math.floor(move / 3);
}
export function movementTurn(move) {
    return TURNS[move % 3];
}
export function dirFromLetter(l) {
    const i = DIR_LETTERS.indexOf(l);
    if (i < 0)
        throw new Error(`Noto'g'ri yo'nalish: ${String(l)}`);
    return i;
}
export function isDirLetter(x) {
    return typeof x === 'string' && DIR_LETTERS.includes(x);
}
/** Angle of an arm in the y-down world (E = 0, S = +π/2, W = π, N = −π/2). */
export function armAngle(d) {
    const [x, y] = DIR_VEC[d];
    return Math.atan2(y, x);
}
/**
 * Point on the INCOMING lane of arm `d` at distance `u` from the centre.
 * Right-hand traffic: the incoming lane is on the right of the travel
 * direction, i.e. offset +0.5 lane to the right of the heading.
 *   from S → (0.5, u), from N → (−0.5, −u), from E → (u, −0.5), from W → (−u, 0.5)
 */
export function inLane(d, u) {
    const [dx, dy] = DIR_VEC[d];
    return [dx * u + 0.5 * dy, dy * u - 0.5 * dx];
}
/**
 * Point on the OUTGOING lane toward arm `d` at distance `u` from the centre.
 *   to N → (0.5, −u), to S → (−0.5, u), to E → (u, 0.5), to W → (−u, −0.5)
 */
export function outLane(d, u) {
    const [dx, dy] = DIR_VEC[d];
    return [dx * u - 0.5 * dy, dy * u + 0.5 * dx];
}
/** Heading angle of traffic arriving from `d` (pointing toward the centre). */
export function inHeading(d) {
    const [dx, dy] = DIR_VEC[d];
    return Math.atan2(-dy, -dx);
}
/** Signed smallest difference a − b in (−π, π]. */
export function angleDiff(a, b) {
    let d = (a - b) % (2 * Math.PI);
    if (d > Math.PI)
        d -= 2 * Math.PI;
    if (d <= -Math.PI)
        d += 2 * Math.PI;
    return d;
}
export function lerpAngle(a, b, f) {
    return a + angleDiff(b, a) * f;
}
//# sourceMappingURL=dir.js.map