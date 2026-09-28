/**
 * Endless mode ("Cheksiz tirbandlik").
 *
 * A long, deterministic stream of arrivals whose gaps shrink over time. The run
 * ends when lives run out or a lane holds more than ENDLESS_OVERFLOW vehicles
 * (gridlock). Score = vehicles brought through. Local-only: no coins, so the
 * server-authoritative economy is never contradicted.
 *
 * Tuning (npm test prints it): the gap shrinks from ~3 s to its minimum within
 * ~85 arrivals, above the junction's capacity — even the 0.2 s-reaction bot
 * gridlocks after ~70–115 vehicles (2.5–3 min), so every run ends.
 */
import { DIR_LETTERS, dirFromLetter, exitOf } from '../core/dir.js';
import { mulberry32 } from './generator.js';
export const ENDLESS_VARIANTS = ['cross', 'signals', 'roundabout'];
export const ENDLESS_BASE_ID = 200000;
/** More than this many vehicles in one lane = gridlock. */
export const ENDLESS_OVERFLOW = 7;
export const ENDLESS_ARRIVALS = 320;
export const ENDLESS_LIMITS = { maxVehicles: 400 };
export const ENDLESS_INFO = {
    cross: {
        title: 'X-chorraha',
        subtitle: "Belgisiz chorraha, oqim tobora zichlashadi.",
        icon: 'cross',
        ambience: 'day',
        flow: { start: 3000, decay: 0.982, min: 650 },
    },
    signals: {
        title: 'Tungi svetofor',
        subtitle: 'Yashilni kuting — lekin navbat 7 tadan oshmasin!',
        icon: 'light',
        ambience: 'night',
        flow: { start: 3400, decay: 0.984, min: 950 },
    },
    roundabout: {
        title: 'Katta halqa',
        subtitle: "Aylanmada bo'sh oynalarni tez toping.",
        icon: 'ring',
        ambience: 'evening',
        flow: { start: 3000, decay: 0.982, min: 700 },
    },
};
export const isEndlessId = (id) => Number.isInteger(id) && id >= ENDLESS_BASE_ID && id < ENDLESS_BASE_ID + ENDLESS_VARIANTS.length;
const TURNS_W = {
    default: [
        ['straight', 0.45],
        ['left', 0.25],
        ['right', 0.3],
    ],
    ring: [
        ['straight', 0.4],
        ['left', 0.35],
        ['right', 0.25],
    ],
};
const KINDS = [
    ['car', 0.64],
    ['taxi', 0.14],
    ['bus', 0.08],
    ['truck', 0.09],
    ['police', 0.05],
];
function pick(r, items) {
    const total = items.reduce((s, [, w]) => s + w, 0);
    let x = r() * total;
    for (const [it, w] of items) {
        x -= w;
        if (x < 0)
            return it;
    }
    return items[items.length - 1][0];
}
const cache = new Map();
/** `flow` override exists for difficulty tuning (tests/tools); the game uses the defaults. */
export function endlessLevel(variant, flow) {
    const hit = flow ? undefined : cache.get(variant);
    if (hit)
        return hit;
    const info = flow ? { ...ENDLESS_INFO[variant], flow } : ENDLESS_INFO[variant];
    const index = ENDLESS_VARIANTS.indexOf(variant);
    const r = mulberry32(0xc0ffee + index * 7919);
    const dirs = [...DIR_LETTERS];
    const turnW = TURNS_W[variant === 'roundabout' ? 'ring' : 'default'];
    const arms = dirs.map((dir) => ({
        dir,
        queue: [{ kind: 'car', turn: r() < 0.6 ? 'straight' : 'right' }],
        arrivals: [],
    }));
    let t = 2500;
    let gap = info.flow.start;
    let lastArm = -1;
    let repeats = 0;
    for (let n = 0; n < ENDLESS_ARRIVALS; n++) {
        let a = Math.floor(r() * arms.length);
        if (a === lastArm && ++repeats >= 2) {
            a = (a + 1 + Math.floor(r() * (arms.length - 1))) % arms.length;
            repeats = 0;
        }
        else if (a !== lastArm) {
            repeats = 0;
        }
        lastArm = a;
        const kind = n % 23 === 22 ? (n % 46 === 45 ? 'fire' : 'ambulance') : pick(r, KINDS);
        const from = dirFromLetter(arms[a].dir);
        let turn = pick(r, turnW);
        if (!dirs.includes(DIR_LETTERS[exitOf(from, turn)]))
            turn = 'straight';
        arms[a].arrivals.push({ kind, turn, atMs: Math.round(t) });
        t += gap;
        gap = Math.max(info.flow.min, gap * info.flow.decay);
    }
    const def = {
        id: ENDLESS_BASE_ID + index,
        name: `Cheksiz: ${info.title}`,
        band: variant === 'roundabout' ? 'roundabout' : 'complex',
        junction: variant === 'roundabout' ? 'roundabout' : 'cross',
        arms,
        lives: 3,
        ambience: info.ambience,
        tags: ['endless'],
        intro: {
            title: `Cheksiz tirbandlik: ${info.title}`,
            text: `${info.subtitle} Qancha ko'p mashinani o'tkazsangiz — shuncha yaxshi. ` +
                `Bir yo'lda ${ENDLESS_OVERFLOW} tadan ortiq mashina to'planib qolsa — tirbandlik, o'yin tugaydi.`,
        },
    };
    if (variant === 'signals') {
        const signals = {
            phases: [
                { green: ['N', 'S'], ms: 6000 },
                { green: ['E', 'W'], ms: 6000 },
            ],
            amberMs: 1500,
            allRedMs: 800,
        };
        def.signals = signals;
    }
    if (!flow)
        cache.set(variant, def);
    return def;
}
//# sourceMappingURL=endless.js.map