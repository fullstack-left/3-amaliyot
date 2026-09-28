/**
 * Vehicle appearance ("look"). Purely cosmetic and deterministic:
 * the same level + vehicle id always gets the same model and paint.
 * The player's hero car uses the equipped garage model, paint and mods.
 */
import { findModel, findPaint, MODELS } from '../../content/garage.js';
import { VEHICLE_SPECS } from '../../core/vehicles.js';
const CIVILIAN_PAINTS = [
    ['#eef2f6', 30],
    ['#b9c3cd', 18],
    ['#23272f', 12],
    ['#7d8793', 8],
    ['#d62828', 7],
    ['#2563eb', 7],
    ['#7a1f2b', 6],
    ['#1f9d55', 5],
    ['#e8d9b0', 7],
];
const GLASS = '#9cc3e4';
const TINT = '#1a2130';
const BODY_Z = 0.1;
export function hash32(s) {
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
}
function pickWeighted(h, items) {
    const total = items.reduce((s, [, w]) => s + w, 0);
    let x = h % total;
    for (const [c, w] of items) {
        if (x < w)
            return c;
        x -= w;
    }
    return items[0][0];
}
function sedan(key, kind, modelId, color, mods, decal, lightBar) {
    const spec = VEHICLE_SPECS[kind];
    const m = findModel(modelId).shape;
    const length = spec.length * m.length;
    const topZ = BODY_Z + m.bodyH + m.cabinH;
    return {
        key,
        style: 'sedan',
        length,
        width: spec.width * m.width,
        bodyH: m.bodyH,
        cabinH: m.cabinH,
        cabinFront: m.cabinFront,
        cabinBack: m.cabinBack,
        inset: m.inset,
        color,
        roof: color,
        glass: mods.includes('tint') ? TINT : GLASS,
        decal,
        mods,
        lightBar,
        barF: (length * (m.cabinBack - m.cabinFront)) / 2,
        barZ: topZ,
        topZ,
    };
}
function special(key, kind) {
    const spec = VEHICLE_SPECS[kind];
    const base = {
        key,
        length: spec.length,
        width: spec.width,
        cabinFront: 0,
        cabinBack: 0,
        inset: 0,
        glass: GLASS,
        mods: [],
    };
    switch (kind) {
        case 'bus':
            return { ...base, style: 'bus', bodyH: 0.83, cabinH: 0, color: '#1b9aaa', roof: '#e9f3f5', decal: 'none', lightBar: 'none', barF: 0, barZ: 0.95, topZ: 0.95 };
        case 'truck':
            return { ...base, style: 'truck', bodyH: 0.7, cabinH: 0, color: '#f08a24', roof: '#8a96a3', decal: 'none', lightBar: 'none', barF: 0, barZ: 0.92, topZ: 0.92 };
        case 'ambulance':
            return { ...base, style: 'van', bodyH: 0.64, cabinH: 0, color: '#f7f7f5', roof: '#f7f7f5', decal: 'ambulance', lightBar: 'emergency', barF: spec.length / 2 - 0.3, barZ: 0.74, topZ: 0.74 };
        case 'fire':
            return { ...base, style: 'fire', bodyH: 0.68, cabinH: 0, color: '#d7261e', roof: '#d7261e', decal: 'fire', lightBar: 'emergency', barF: spec.length / 2 - 0.25, barZ: 0.8, topZ: 0.86 };
        default:
            return sedan(key, kind, 'cobalt', '#eef2f6', [], 'none', 'none');
    }
}
export function lookFor(v, ctx) {
    const h = hash32(`${ctx.levelId}:${v.id}`);
    if (v.hero) {
        const mods = [...ctx.hero.mods].sort();
        return sedan(`hero|${ctx.hero.model}|${ctx.hero.paint}|${mods.join(',')}`, 'car', ctx.hero.model, findPaint(ctx.hero.paint).color, mods, mods.includes('shashka') ? 'taxi' : 'none', 'none');
    }
    switch (v.kind) {
        case 'car': {
            const pool = ctx.ownedModels.length ? ctx.ownedModels : MODELS.map((m) => m.id);
            const model = pool[h % pool.length];
            const color = pickWeighted(h >>> 8, CIVILIAN_PAINTS);
            return sedan(`car|${model}|${color}`, 'car', model, color, [], 'none', 'none');
        }
        case 'taxi':
            return sedan(`taxi|${h % 2}`, 'taxi', h % 2 ? 'cobalt' : 'nexia3', '#f5c518', ['shashka'], 'taxi', 'none');
        case 'police':
            return sedan('police', 'police', 'cobalt', '#f4f6f8', [], 'police', 'police');
        default:
            return special(v.kind, v.kind);
    }
}
const redCache = new Map();
/** Penalty flash variant (red body, same geometry). */
export function redLook(l) {
    let r = redCache.get(l.key);
    if (!r) {
        r = { ...l, key: `${l.key}|RED`, color: '#ff2b2b', roof: '#ff5b5b', glow: true };
        redCache.set(l.key, r);
    }
    return r;
}
export const LOOK_BODY_Z = BODY_Z;
//# sourceMappingURL=looks.js.map