/**
 * Tiny colour helpers with caching (no per-frame string allocation for hot colours)
 * + ambience grading.
 *
 * Grading is a colour transform applied at DRAW time (`g(color)`): the static
 * scene, props and vehicle sprites are painted with graded colours, while light
 * sources (head/tail lights, lit windows, signal lamps, sirens) use raw colours.
 * That gives evening / night / rain looks without any full-screen compositing
 * pass per frame. Each grade has its own cache, so switching is free.
 */
const cache = new Map();
function parse(hex) {
    const h = hex.replace('#', '');
    const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
/** Multiply brightness (k < 1 darker, k > 1 lighter). */
export function shade(hex, k) {
    const key = `${hex}|${k.toFixed(3)}`;
    let v = cache.get(key);
    if (!v) {
        const [r, g, b] = parse(hex);
        const f = (c) => Math.max(0, Math.min(255, Math.round(k >= 1 ? c + (255 - c) * (k - 1) : c * k)));
        v = `rgb(${f(r)},${f(g)},${f(b)})`;
        cache.set(key, v);
    }
    return v;
}
/** Like `shade` but returns hex (safe to feed into `shade`/`g` again). */
export function shadeHex(hex, k) {
    const [r, gg, b] = parse(hex);
    const f = (c) => Math.max(0, Math.min(255, Math.round(k >= 1 ? c + (255 - c) * (k - 1) : c * k)));
    return `#${[f(r), f(gg), f(b)].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}
export function alpha(hex, a) {
    const key = `${hex}|a${a.toFixed(3)}`;
    let v = cache.get(key);
    if (!v) {
        const [r, g, b] = parse(hex);
        v = `rgba(${r},${g},${b},${a})`;
        cache.set(key, v);
    }
    return v;
}
export const PALETTE = {
    grass: '#8cc26a',
    grassDark: '#7bb05a',
    grassLight: '#9ccd79',
    sidewalk: '#dcd5c6',
    sidewalkDark: '#cbc3b2',
    curb: '#b7ae9d',
    asphalt: '#4b5059',
    asphaltLight: '#565c66',
    asphaltDark: '#42464e',
    line: '#f5f5f0',
    island: '#77b25a',
    water: '#6cc3e8',
};
export const GRADES = {
    day: null,
    evening: { mul: [0.98, 0.8, 0.7], add: [14, 6, 16], sat: 0.92 },
    night: { mul: [0.34, 0.4, 0.6], add: [10, 14, 30], sat: 0.62 },
    rain: { mul: [0.74, 0.78, 0.84], add: [10, 12, 18], sat: 0.66 },
};
/** How strongly artificial light shows up (street lamps, windows, headlights). */
export const LIGHT_LEVEL = { day: 0, evening: 0.55, night: 1, rain: 0.7 };
let gradeName = 'day';
let grade = null;
const gradeCaches = new Map();
let gcache = null;
export function setGrade(a) {
    if (a === gradeName)
        return;
    gradeName = a;
    grade = GRADES[a];
    let c = gradeCaches.get(a);
    if (!c)
        gradeCaches.set(a, (c = new Map()));
    gcache = c;
}
export function currentGrade() {
    return gradeName;
}
const clamp255 = (v) => Math.max(0, Math.min(255, Math.round(v)));
const hex2 = (v) => clamp255(v).toString(16).padStart(2, '0');
function gradeRgb(r, gg, b, s) {
    const lum = 0.3 * r + 0.59 * gg + 0.11 * b;
    const sr = lum + (r - lum) * s.sat;
    const sg = lum + (gg - lum) * s.sat;
    const sb = lum + (b - lum) * s.sat;
    return [sr * s.mul[0] + s.add[0], sg * s.mul[1] + s.add[1], sb * s.mul[2] + s.add[2]];
}
function applyGrade(color, s) {
    if (color[0] === '#') {
        const [r, gg, b] = parse(color);
        const [R, G, B] = gradeRgb(r, gg, b, s);
        return `#${hex2(R)}${hex2(G)}${hex2(B)}`;
    }
    const m = /^rgba?\(([^)]+)\)$/.exec(color.trim());
    if (!m)
        return color;
    const parts = m[1].split(',').map((p) => parseFloat(p));
    const [R, G, B] = gradeRgb(parts[0], parts[1], parts[2], s);
    return parts.length > 3 ? `rgba(${clamp255(R)},${clamp255(G)},${clamp255(B)},${parts[3]})` : `rgb(${clamp255(R)},${clamp255(G)},${clamp255(B)})`;
}
/**
 * Colour under the current ambience. Hex in → hex out (so `shade()` still
 * works on it); rgb()/rgba() in → same form out. Identity during the day.
 */
export function g(color) {
    if (!grade || !gcache)
        return color;
    let v = gcache.get(color);
    if (v === undefined) {
        v = applyGrade(color, grade);
        gcache.set(color, v);
    }
    return v;
}
/** Run `fn` under a specific grade and restore the previous one. */
export function withGrade(a, fn) {
    const prev = gradeName;
    setGrade(a);
    try {
        return fn();
    }
    finally {
        setGrade(prev);
    }
}
/** Deterministic PRNG (Park–Miller) for scene decoration. */
export function prng(seed) {
    let s = (Math.abs(Math.floor(seed)) % 2147483646) + 1;
    return () => (s = (s * 16807) % 2147483647) / 2147483647;
}
//# sourceMappingURL=color.js.map