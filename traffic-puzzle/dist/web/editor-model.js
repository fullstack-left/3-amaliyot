/**
 * Level-editor model (pure, no DOM): the form state and its lossless mapping
 * to/from LevelDef, import parsing (JSON / "L1." code / link) and migration of
 * drafts saved by the v1 editor. Every campaign level round-trips through
 * fromDef → toDef unchanged (tests/editor.test.mjs).
 */
import { BOSS1, BOSS2, BOSS3, BOSS4, BOSS5 } from '../content/handmade.js';
import { DIR_LETTERS } from '../core/dir.js';
import { AMBIENCES, BANDS, validateLevel } from '../core/level.js';
import { decodeLevel } from './share.js';
export const PRESETS = {
    boss1: BOSS1,
    boss2: BOSS2,
    boss3: BOSS3,
    boss4: BOSS4,
    boss5: BOSS5,
};
/** "Always flashing" is stored as one window this long. */
export const ALWAYS_FLASH_MS = 600000;
export const DEFAULT_AMBER_MS = 2000;
export const DEFAULT_ALL_RED_MS = 1000;
export function emptyArm() {
    return { sign: 'none', queue: [], arrivals: [] };
}
export function defaultState() {
    return {
        v: 2,
        junction: 'cross',
        missing: 'none',
        arms: {
            N: { sign: 'none', queue: [{ kind: 'car', turn: 'straight' }], arrivals: [] },
            E: { sign: 'none', queue: [{ kind: 'car', turn: 'straight' }], arrivals: [] },
            S: { sign: 'none', queue: [{ kind: 'car', turn: 'left' }], arrivals: [] },
            W: emptyArm(),
        },
        signals: 'none',
        phases: [],
        amberMs: null,
        allRedMs: null,
        offsetMs: 0,
        flashing: [],
        controller: 'none',
        poses: BOSS1.poses.map((p) => ({ ...p })),
        ambience: 'day',
        lives: 3,
        band: null,
        name: 'Mening chorraham',
        introTitle: '',
        introText: '',
        tip: '',
        coach: [],
    };
}
/** Arms that exist for the current junction type. */
export function activeArms(s) {
    if (s.junction === 'cross')
        return [...DIR_LETTERS];
    const missing = s.junction === 't' && s.missing === 'none' ? 'N' : s.missing;
    return DIR_LETTERS.filter((d) => d !== missing);
}
/** Standard phase groupings (N+S / E+W, or one per arm) keeping the current durations. */
export function standardPhases(s, mode) {
    const arms = activeArms(s);
    const groups = mode === 'four' ? arms.map((d) => [d]) : [arms.filter((d) => d === 'N' || d === 'S'), arms.filter((d) => d === 'E' || d === 'W')].filter((g) => g.length);
    const dflt = mode === 'four' ? 4500 : 7000;
    return groups.map((green, i) => ({ green, ms: s.phases[i]?.ms ?? dflt }));
}
export function phasesFor(s) {
    if (s.signals === 'none')
        return [];
    if (s.signals === 'custom') {
        const arms = new Set(activeArms(s));
        return s.phases.map((p) => ({ green: p.green.filter((d) => arms.has(d)), ms: p.ms })).filter((p) => p.green.length);
    }
    if (s.signals === 'flash' && s.phases.length) {
        // keep imported phases for an always-flashing plan (they matter once it stops flashing)
        const arms = new Set(activeArms(s));
        const kept = s.phases.map((p) => ({ green: p.green.filter((d) => arms.has(d)), ms: p.ms })).filter((p) => p.green.length);
        if (kept.length)
            return kept;
    }
    return standardPhases(s, s.signals);
}
export function toDef(s) {
    const armDirs = activeArms(s);
    const round = s.junction === 'roundabout';
    const useController = s.controller !== 'none' && s.junction === 'cross';
    const derivedBand = useController ? 'boss' : round ? 'roundabout' : 'complex';
    const def = {
        id: 999,
        name: s.name.trim() || 'Maxsus bosqich',
        band: s.band ?? derivedBand,
        junction: s.junction,
        arms: armDirs.map((d) => {
            const a = s.arms[d];
            return {
                dir: d,
                sign: round ? 'none' : a.sign,
                queue: a.queue.map((q) => ({ ...q })),
                ...(a.arrivals.length ? { arrivals: a.arrivals.map((q) => ({ ...q })).sort((x, y) => x.atMs - y.atMs) } : {}),
            };
        }),
    };
    if (s.ambience !== 'day')
        def.ambience = s.ambience;
    if (s.lives !== 3)
        def.lives = s.lives;
    if (s.introTitle.trim() || s.introText.trim())
        def.intro = { title: s.introTitle.trim() || def.name, text: s.introText.trim() };
    if (s.tip.trim())
        def.tip = s.tip.trim();
    if (s.coach.length)
        def.coach = s.coach.map((c) => ({ ...c }));
    if (s.signals !== 'none' && !round && !useController) {
        def.signals = { phases: phasesFor(s) };
        if (s.amberMs !== null)
            def.signals.amberMs = s.amberMs;
        if (s.allRedMs !== null)
            def.signals.allRedMs = s.allRedMs;
        if (s.offsetMs)
            def.signals.offsetMs = s.offsetMs;
        if (s.signals === 'flash')
            def.signals.flashing = [{ fromMs: 0, toMs: ALWAYS_FLASH_MS }];
        else {
            const windows = s.flashing.filter((w) => w.toMs > w.fromMs).map((w) => ({ ...w }));
            if (windows.length)
                def.signals.flashing = windows;
        }
    }
    if (useController)
        def.controller = s.controller === 'custom' ? { poses: s.poses.map((p) => ({ ...p })) } : { poses: PRESETS[s.controller].poses.map((p) => ({ ...p })) };
    return def;
}
function samePoses(a, b) {
    return a.length === b.length && a.every((p, i) => p.gesture === b[i].gesture && p.facing === b[i].facing && p.ms === b[i].ms);
}
export function fromDef(def) {
    const s = defaultState();
    s.junction = def.junction;
    s.name = def.name;
    s.band = def.band;
    for (const d of DIR_LETTERS)
        s.arms[d] = emptyArm();
    for (const a of def.arms) {
        s.arms[a.dir] = { sign: a.sign ?? 'none', queue: a.queue.map((q) => ({ ...q })), arrivals: (a.arrivals ?? []).map((q) => ({ ...q })) };
    }
    const present = new Set(def.arms.map((a) => a.dir));
    s.missing = DIR_LETTERS.find((d) => !present.has(d)) ?? 'none';
    s.ambience = def.ambience ?? 'day';
    s.lives = def.lives ?? 3;
    s.introTitle = def.intro?.title ?? '';
    s.introText = def.intro?.text ?? '';
    s.tip = def.tip ?? '';
    s.coach = (def.coach ?? []).map((c) => ({ ...c }));
    if (def.signals) {
        const sg = def.signals;
        s.phases = sg.phases.map((p) => ({ green: [...p.green], ms: p.ms }));
        s.amberMs = sg.amberMs ?? null;
        s.allRedMs = sg.allRedMs ?? null;
        s.offsetMs = sg.offsetMs ?? 0;
        const windows = (sg.flashing ?? []).map((w) => ({ fromMs: w.fromMs, toMs: w.toMs }));
        const always = windows.length === 1 && windows[0].fromMs === 0 && windows[0].toMs === ALWAYS_FLASH_MS;
        s.flashing = always ? [] : windows;
        const same = (a) => a.length === s.phases.length && a.every((p, i) => p.green.join() === s.phases[i].green.join());
        s.signals = always ? 'flash' : same(standardPhases(s, 'two')) ? 'two' : same(standardPhases(s, 'four')) ? 'four' : 'custom';
    }
    if (def.controller) {
        const preset = Object.keys(PRESETS).find((k) => samePoses(PRESETS[k].poses, def.controller.poses));
        s.controller = preset ?? 'custom';
        s.poses = def.controller.poses.map((p) => ({ ...p }));
    }
    return s;
}
const isObj = (x) => typeof x === 'object' && x !== null && !Array.isArray(x);
/** Accept a draft saved by any editor version; unknown/invalid fields fall back to defaults. */
export function migrateDraft(raw) {
    const base = defaultState();
    if (!isObj(raw) || !isObj(raw.arms) || typeof raw.junction !== 'string')
        return base;
    const d = raw;
    const arms = {};
    for (const l of DIR_LETTERS) {
        const a = isObj(d.arms[l]) ? d.arms[l] : {};
        arms[l] = { sign: a.sign ?? 'none', queue: Array.isArray(a.queue) ? a.queue : [], arrivals: Array.isArray(a.arrivals) ? a.arrivals : [] };
    }
    const oneOf = (v, all, dflt) => (all.includes(v) ? v : dflt);
    // v1 drafts: `flash` single window / signals 'flash' meant always flashing
    const legacyFlash = isObj(d.flash) ? [{ fromMs: Number(d.flash.fromMs) || 0, toMs: Number(d.flash.toMs) || 0 }] : [];
    return {
        ...base,
        v: 2,
        junction: oneOf(d.junction, ['cross', 't', 'roundabout'], 'cross'),
        missing: oneOf(d.missing, ['none', ...DIR_LETTERS], 'none'),
        arms,
        signals: oneOf(d.signals, ['none', 'two', 'four', 'flash', 'custom'], 'none'),
        phases: Array.isArray(d.phases) ? d.phases : [],
        amberMs: Number.isFinite(d.amberMs) ? d.amberMs : null,
        allRedMs: Number.isFinite(d.allRedMs) ? d.allRedMs : null,
        offsetMs: Number.isFinite(d.offsetMs) ? d.offsetMs : 0,
        flashing: Array.isArray(d.flashing) ? d.flashing : legacyFlash,
        controller: oneOf(d.controller, ['none', 'boss1', 'boss2', 'boss3', 'boss4', 'boss5', 'custom'], 'none'),
        poses: Array.isArray(d.poses) && d.poses.length ? d.poses : base.poses,
        ambience: oneOf(d.ambience, AMBIENCES, 'day'),
        lives: Number.isInteger(d.lives) && d.lives >= 1 && d.lives <= 9 ? d.lives : 3,
        band: d.band && BANDS.includes(d.band) ? d.band : null,
        name: typeof d.name === 'string' ? d.name : base.name,
        introTitle: typeof d.introTitle === 'string' ? d.introTitle : '',
        introText: typeof d.introText === 'string' ? d.introText : '',
        tip: typeof d.tip === 'string' ? d.tip : '',
        coach: Array.isArray(d.coach) ? d.coach : [],
    };
}
/** Accepts level JSON, an "L1.…" code or a full link containing #/custom/L1.… */
export function parseImport(text) {
    const t = text.trim();
    if (!t)
        return { ok: false, error: "Maydon bo'sh" };
    const m = /(L\d+\.[A-Za-z0-9_-]+)/.exec(t);
    if (!t.startsWith('{') && m) {
        const r = decodeLevel(m[1]);
        return r.ok ? { ok: true, def: r.def } : { ok: false, error: r.error };
    }
    try {
        const def = JSON.parse(t);
        const v = validateLevel(def);
        return v.ok ? { ok: true, def } : { ok: false, error: v.errors.join('; ') };
    }
    catch (e) {
        return { ok: false, error: e.message };
    }
}
//# sourceMappingURL=editor-model.js.map