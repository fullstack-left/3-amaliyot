/**
 * Daily challenge ("Kunlik chorraha").
 *
 * Each calendar day maps to a deterministic level: day index → weekday theme →
 * seeded generator → bot-verified candidate → par time. The server can rebuild
 * the exact same level from the id alone, so daily runs are verifiable
 * (supabase/functions/submit-run).
 *
 *   id = 100000 + dayIndex,  dayIndex = days since 2026-01-01
 */
import { computePar } from '../core/bot.js';
import { loadLevel } from '../core/level.js';
import { buildGeneratedLevel } from './generator.js';
import { BOSS2 } from './handmade.js';
export const DAILY_BASE_ID = 100000;
export const DAILY_MAX_ID = 199999;
const EPOCH_MS = Date.UTC(2026, 0, 1);
const DAY_MS = 86_400_000;
export const MONTHS_UZ = [
    'yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun',
    'iyul', 'avgust', 'sentyabr', 'oktyabr', 'noyabr', 'dekabr',
];
export const WEEKDAYS_UZ = ['Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba', 'Yakshanba'];
const pad = (n) => String(n).padStart(2, '0');
/** Local calendar date of `date` as YYYY-MM-DD (the player's day, not UTC). */
export function dayKeyOf(date) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
/** Days since 2026-01-01 for a YYYY-MM-DD key (NaN when malformed). */
export function dayIndexOf(key) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
    if (!m)
        return Number.NaN;
    const t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    const back = new Date(t);
    if (back.getUTCMonth() !== Number(m[2]) - 1 || back.getUTCDate() !== Number(m[3]))
        return Number.NaN;
    return Math.round((t - EPOCH_MS) / DAY_MS);
}
export function dayKeyFromIndex(i) {
    const d = new Date(EPOCH_MS + i * DAY_MS);
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}
/** Day index of the UTC calendar date at `nowMs` (the server's notion of "today"). */
export function utcDayIndex(nowMs) {
    return Math.floor((nowMs - EPOCH_MS) / DAY_MS);
}
/**
 * Which daily challenges the server accepts at `nowMs`: the player's local
 * "today" is within ±1 day of UTC, and the client lets players replay the last
 * `archiveDays` days — so [UTC today − archiveDays − 1, UTC today + 1].
 */
export function dailyAcceptable(dayIndex, nowMs, archiveDays = 6) {
    const t = utcDayIndex(nowMs);
    return Number.isInteger(dayIndex) && dayIndex >= 0 && dayIndex >= t - archiveDays - 1 && dayIndex <= t + 1;
}
export const dailyId = (dayIndex) => DAILY_BASE_ID + dayIndex;
export const isDailyId = (id) => Number.isInteger(id) && id >= DAILY_BASE_ID && id <= DAILY_MAX_ID;
export const dayIndexOfId = (id) => id - DAILY_BASE_ID;
/** 0 = Monday … 6 = Sunday (2026-01-01 was a Thursday). */
export function weekdayOf(dayIndex) {
    return (((dayIndex + 3) % 7) + 7) % 7;
}
/** "28-sentyabr" */
export function dayLabel(dayIndex) {
    const d = new Date(EPOCH_MS + dayIndex * DAY_MS);
    return `${d.getUTCDate()}-${MONTHS_UZ[d.getUTCMonth()]}`;
}
/** Monday … Sunday. */
export const DAILY_THEMES = [
    {
        title: "Teng yo'llar",
        subtitle: "Belgisiz chorraha: o'ng qo'l qoidasi va chapga burilish.",
        icon: 'cross',
        spec: { band: 'base', junction: 'cross', queue: [1, 2], arrivals: 3, minBlocked: 2 },
    },
    {
        title: "Asosiy yo'l",
        subtitle: "Romb va uchburchak belgilar: kim ustun?",
        icon: 'diamond',
        spec: { band: 'complex', junction: 'cross', signs: 'priority', queue: [2, 3], arrivals: 3, minBlocked: 2 },
    },
    {
        title: 'Svetofor',
        subtitle: 'Faqat yashilda yuring, chapga buriluvchi qarshidagini kutadi.',
        icon: 'light',
        spec: { band: 'complex', junction: 'cross', signals: 'two_phase', queue: [2, 3], arrivals: 4, police: true, minBlocked: 1 },
    },
    {
        title: 'Aylanma',
        subtitle: "Halqadagilar ustun — bo'sh oynani toping.",
        icon: 'ring',
        spec: { band: 'roundabout', junction: 'roundabout', queue: [2, 3], arrivals: 4 },
    },
    {
        title: 'T-chorraha',
        subtitle: "Uch yo'l, belgilar va keyin keladiganlar.",
        icon: 'tee',
        spec: { band: 'complex', junction: 't', signs: 'priority', queue: [2, 3], arrivals: 4, minBlocked: 1 },
    },
    {
        title: 'Regulirovshik',
        subtitle: "Boshqaruvchining ishoralari svetofor va belgilardan ustun.",
        icon: 'cop',
        spec: { band: 'boss', junction: 'cross', controller: BOSS2, queue: [2, 3], arrivals: 3 },
    },
    {
        title: 'Sirenalar kuni',
        subtitle: "Tez yordam va o't o'chirish mashinalari — doimo birinchi.",
        icon: 'plus',
        spec: { band: 'complex', junction: 'cross', signs: 'priority', queue: [2, 3], arrivals: 4, emergency: 2, fire: true, minBlocked: 1 },
    },
];
export function dailyTheme(dayIndex) {
    return DAILY_THEMES[weekdayOf(dayIndex)];
}
const AMBIENCE_CYCLE = ['day', 'evening', 'rain', 'night'];
export function dailyAmbience(dayIndex) {
    return AMBIENCE_CYCLE[((dayIndex % 4) + 4) % 4];
}
const cache = new Map();
/**
 * The level for a day. Always succeeds: if the themed spec finds no candidate,
 * progressively relaxed specs are tried (tested for 60 consecutive days).
 */
export function dailyLevel(dayIndex) {
    const hit = cache.get(dayIndex);
    if (hit)
        return hit;
    const def = buildDailyLevel(dayIndex);
    cache.set(dayIndex, def);
    return def;
}
/** Uncached generation (same result every time — used by tests and the server). */
export function buildDailyLevel(dayIndex) {
    if (!Number.isInteger(dayIndex) || dayIndex < 0 || dayIndex > DAILY_MAX_ID - DAILY_BASE_ID) {
        throw new Error(`Kunlik bosqich indeksi noto'g'ri: ${dayIndex}`);
    }
    const theme = dailyTheme(dayIndex);
    const base = {
        ...theme.spec,
        id: dailyId(dayIndex),
        name: `Kunlik: ${dayLabel(dayIndex)}`,
        intro: { title: `${WEEKDAYS_UZ[weekdayOf(dayIndex)]}: ${theme.title}`, text: theme.subtitle },
        tip: theme.subtitle,
    };
    const attempts = [
        base,
        { ...base, minBlocked: 0 },
        { ...base, minBlocked: 0, arrivals: 0, emergency: 0, queue: [1, 2] },
    ];
    let def = null;
    for (const spec of attempts) {
        try {
            def = { ...buildGeneratedLevel(spec).def };
            break;
        }
        catch {
            /* try the next, more relaxed spec */
        }
    }
    if (!def)
        throw new Error(`Kunlik bosqich yaratilmadi: ${dayIndex}`);
    def.ambience = dailyAmbience(dayIndex);
    def.tags = ['daily'];
    def.parMs = computePar(loadLevel(def));
    return def;
}
//# sourceMappingURL=daily.js.map