/**
 * Level editor: build a LevelDef with forms, validate it with the same
 * validator the server uses, prove it solvable with the bot, play-test it,
 * and export/import JSON.
 */
import { BOSS1, BOSS2, BOSS3, BOSS4, BOSS5 } from '../../content/handmade.js';
import { autoplay, computePar } from '../../core/bot.js';
import { DIR_LETTERS, DIR_NAMES_UZ, exitOf, dirFromLetter } from '../../core/dir.js';
import { loadLevel, validateLevel } from '../../core/level.js';
import { VEHICLE_KINDS, VEHICLE_SPECS } from '../../core/vehicles.js';
import { clear, fmtTime, h } from '../dom.js';
import { icon } from '../icons.js';
const STORAGE_KEY = 'chorraha.editor.v1';
const CONTROLLERS = { none: null, boss1: BOSS1, boss2: BOSS2, boss3: BOSS3, boss4: BOSS4, boss5: BOSS5 };
const TURN_UZ = { straight: "to'g'riga", left: 'chapga', right: "o'ngga" };
const SIGN_UZ = { none: 'belgisiz', main: "asosiy yo'l", yield: "yo'l bering", stop: 'STOP' };
function defaultState() {
    return {
        junction: 'cross',
        missing: 'none',
        arms: {
            N: { sign: 'none', queue: [{ kind: 'car', turn: 'straight' }] },
            E: { sign: 'none', queue: [{ kind: 'car', turn: 'straight' }] },
            S: { sign: 'none', queue: [{ kind: 'car', turn: 'left' }] },
            W: { sign: 'none', queue: [] },
        },
        signals: 'none',
        controller: 'none',
        name: 'Mening chorraham',
    };
}
/** Arms that exist for the current junction type. */
function activeArms(s) {
    if (s.junction === 'cross')
        return [...DIR_LETTERS];
    const missing = s.junction === 't' && s.missing === 'none' ? 'N' : s.missing;
    return DIR_LETTERS.filter((d) => d !== missing);
}
function toDef(s) {
    const armDirs = activeArms(s);
    const def = {
        id: 999,
        name: s.name || 'Maxsus bosqich',
        band: s.controller !== 'none' ? 'boss' : s.junction === 'roundabout' ? 'roundabout' : 'complex',
        junction: s.junction,
        arms: armDirs.map((d) => ({ dir: d, sign: s.junction === 'roundabout' ? 'none' : s.arms[d].sign, queue: s.arms[d].queue.map((q) => ({ ...q })) })),
    };
    if (s.signals !== 'none' && s.junction !== 'roundabout' && s.controller === 'none') {
        const ns = armDirs.filter((d) => d === 'N' || d === 'S');
        const ew = armDirs.filter((d) => d === 'E' || d === 'W');
        def.signals =
            s.signals === 'four'
                ? { phases: armDirs.map((d) => ({ green: [d], ms: 4500 })) }
                : { phases: [{ green: ns, ms: 7000 }, { green: ew, ms: 7000 }].filter((p) => p.green.length) };
        if (s.signals === 'flash')
            def.signals.flashing = [{ fromMs: 0, toMs: 600000 }];
    }
    if (s.controller !== 'none' && s.junction === 'cross')
        def.controller = CONTROLLERS[s.controller];
    return def;
}
function fromDef(def) {
    const s = defaultState();
    s.junction = def.junction;
    s.name = def.name;
    for (const d of DIR_LETTERS)
        s.arms[d] = { sign: 'none', queue: [] };
    for (const a of def.arms)
        s.arms[a.dir] = { sign: a.sign ?? 'none', queue: a.queue.map((q) => ({ ...q })) };
    const present = new Set(def.arms.map((a) => a.dir));
    s.missing = DIR_LETTERS.find((d) => !present.has(d)) ?? 'none';
    s.signals = def.signals ? (def.signals.flashing?.length ? 'flash' : def.signals.phases.length > 2 ? 'four' : 'two') : 'none';
    s.controller = def.controller ? 'boss3' : 'none';
    return s;
}
export function mountEditor(root, app) {
    const { store, sfx } = app;
    let state;
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        state = raw ? JSON.parse(raw) : defaultState();
        if (!state.arms || !state.junction)
            state = defaultState();
    }
    catch {
        state = defaultState();
    }
    const form = h('div', { class: 'editor-form' });
    const report = h('div', { class: 'editor-report' });
    const json = h('textarea', { class: 'editor-json', spellcheck: 'false', rows: 10, 'aria-label': 'Level JSON' });
    const persist = () => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        }
        catch {
            /* ignore */
        }
    };
    const change = (fn) => {
        fn();
        persist();
        render();
    };
    const select = (value, options, onchange) => h('select', { onchange: (e) => onchange(e.target.value) }, ...options.map(([v, label]) => h('option', { value: v, selected: v === value }, label)));
    const armEnabled = (d) => activeArms(state).includes(d);
    function render() {
        clear(form);
        form.append(h('div', { class: 'form-row' }, h('label', null, 'Nomi ', h('input', { value: state.name, oninput: (e) => { state.name = e.target.value; persist(); } })), h('label', null, 'Turi ', select(state.junction, [['cross', 'X-chorraha'], ['t', 'T-chorraha'], ['roundabout', 'Aylanma']], (v) => change(() => (state.junction = v)))), state.junction !== 'cross'
            ? h('label', null, "Yo'q yo'l ", select(state.junction === 't' && state.missing === 'none' ? 'N' : state.missing, [
                ...(state.junction === 'roundabout' ? [['none', "hammasi bor (4 ta)"]] : []),
                ...DIR_LETTERS.map((d, i) => [d, DIR_NAMES_UZ[i]]),
            ], (v) => change(() => (state.missing = v))))
            : null, state.junction !== 'roundabout'
            ? h('label', null, 'Svetofor ', select(state.signals, [['none', "yo'q"], ['two', '2 fazali'], ['four', '4 fazali'], ['flash', 'sariq miltillovchi']], (v) => change(() => (state.signals = v))))
            : null, state.junction === 'cross'
            ? h('label', null, 'Regulirovshik ', select(state.controller, [['none', "yo'q"], ['boss1', 'BOSS 1'], ['boss2', 'BOSS 2'], ['boss3', 'BOSS 3'], ['boss4', 'BOSS 4'], ['boss5', 'BOSS 5']], (v) => change(() => (state.controller = v))))
            : null));
        const grid = h('div', { class: 'arm-grid' });
        DIR_LETTERS.forEach((d, i) => {
            if (!armEnabled(d))
                return;
            const arm = state.arms[d];
            const rows = arm.queue.map((q, k) => {
                const turns = ['straight', 'left', 'right'].filter((t) => armEnabled(DIR_LETTERS[exitOf(dirFromLetter(d), t)]));
                return h('div', { class: 'veh-row' }, h('span', { class: 'muted' }, `${k + 1}.`), select(q.kind, VEHICLE_KINDS.map((kd) => [kd, VEHICLE_SPECS[kd].nameUz]), (v) => change(() => (q.kind = v))), select(q.turn, turns.map((t) => [t, TURN_UZ[t]]), (v) => change(() => (q.turn = v))), h('button', { class: 'btn ghost small', title: "O'chirish", 'aria-label': "O'chirish", onclick: () => change(() => arm.queue.splice(k, 1)) }, icon('close')));
            });
            grid.appendChild(h('div', { class: 'card arm-card' }, h('h3', null, `${DIR_NAMES_UZ[i]} (${d})`), state.junction !== 'roundabout' ? h('label', null, 'Belgi ', select(arm.sign, Object.keys(SIGN_UZ).map((sg) => [sg, SIGN_UZ[sg]]), (v) => change(() => (arm.sign = v)))) : null, ...rows, arm.queue.length < 6
                ? h('button', { class: 'btn small', onclick: () => change(() => arm.queue.push({ kind: 'car', turn: armEnabled(DIR_LETTERS[exitOf(dirFromLetter(d), 'straight')]) ? 'straight' : 'right' })) }, '+ mashina')
                : null));
        });
        form.appendChild(grid);
        check(false);
    }
    function check(runBot) {
        const def = toDef(state);
        const v = validateLevel(def);
        clear(report);
        if (!v.ok) {
            report.append(h('p', { class: 'err' }, icon('warn'), ' Xatolar:'), h('ul', null, ...v.errors.map((e) => h('li', null, e))));
            return null;
        }
        if (v.warnings.length)
            report.append(h('ul', { class: 'warn' }, ...v.warnings.map((w) => h('li', null, w))));
        if (runBot) {
            const r = autoplay(loadLevel(def));
            if (!r.completed) {
                report.append(h('p', { class: 'err' }, icon('warn'), " Avtopilot yecha olmadi — bu bosqichni o'tib bo'lmasligi mumkin."));
                return null;
            }
            const par = computePar(loadLevel(def));
            report.append(h('p', { class: 'ok' }, icon('check'), ` To'g'ri va yechiladi. Avtopilot: ${fmtTime((r.ticks * 1000) / 60)}, tez yulduz: ${fmtTime(par)}`));
            return { ...def, parMs: par };
        }
        report.append(h('p', { class: 'ok' }, icon('check'), ' Tuzilma to‘g‘ri'));
        return def;
    }
    clear(root);
    root.appendChild(h('div', { class: 'page editor' }, h('header', { class: 'page-head' }, h('button', { class: 'btn ghost', onclick: () => store.getState().go('menu') }, icon('back'), 'Menyu'), h('h1', null, 'Level muharriri')), h('p', { class: 'muted' }, "Chorrahani yig'ing, keyin Tekshirish (validator + avtopilot) va Sinab ko'rish. JSON'ni nusxalab, campaign'ga qo'shish mumkin (docs/LEVEL_DESIGN.md)."), form, h('div', { class: 'form-row' }, h('button', { class: 'btn', onclick: () => { sfx.click(); check(true); } }, icon('check'), 'Tekshirish'), h('button', { class: 'btn primary', onclick: () => { sfx.unlock(); const def = check(true); if (def)
            store.getState().playCustom(def); } }, icon('play'), "Sinab ko'rish"), h('button', { class: 'btn', onclick: () => { json.value = JSON.stringify(toDef(state), null, 2); } }, 'JSON eksport'), h('button', {
        class: 'btn',
        onclick: () => {
            try {
                const def = JSON.parse(json.value);
                const v = validateLevel(def);
                if (!v.ok)
                    throw new Error(v.errors.join('; '));
                change(() => (state = fromDef(def)));
                store.getState().notify('JSON yuklandi', 'ok');
            }
            catch (e) {
                store.getState().notify(`JSON xatosi: ${e.message}`, 'err');
            }
        },
    }, 'JSON import'), h('button', { class: 'btn ghost', onclick: () => change(() => (state = defaultState())) }, icon('restart'), 'Yangidan')), report, json));
    render();
    return () => undefined;
}
//# sourceMappingURL=editor.js.map