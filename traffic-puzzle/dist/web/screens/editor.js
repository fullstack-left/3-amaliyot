/**
 * Level editor (v2): build a LevelDef with forms — queues and timed arrivals,
 * signs, signal timing (phases, amber, all-red, offset, flashing window),
 * a preset or hand-made traffic-controller script, ambience, lives, texts —
 * validate it with the same validator the server uses, watch the autopilot
 * play it live in the preview, prove it solvable, play-test it, and share it
 * as a link (#/custom/L1.…) or JSON. Campaign levels can be loaded as templates.
 */
import { CAMPAIGN, getLevelDef } from '../../content/campaign.js';
import { autoplay, computePar, legalMoves } from '../../core/bot.js';
import { DIR_LETTERS, DIR_NAMES_UZ, dirFromLetter, exitOf } from '../../core/dir.js';
import { GameEngine } from '../../core/engine.js';
import { TICK_MS } from '../../core/kinematics.js';
import { AMBIENCES, GESTURES, loadLevel, MAX_QUEUE, validateLevel } from '../../core/level.js';
import { VEHICLE_KINDS, VEHICLE_SPECS } from '../../core/vehicles.js';
import { clear, fmtTime, h } from '../dom.js';
import { activeArms, DEFAULT_ALL_RED_MS, DEFAULT_AMBER_MS, defaultState, fromDef, migrateDraft, parseImport, phasesFor, PRESETS, standardPhases, toDef, } from '../editor-model.js';
import { copyText } from '../fx.js';
import { AMBIENCE_ICON, AMBIENCE_UZ, icon } from '../icons.js';
import { DEFAULT_RENDER_SETTINGS, Renderer } from '../render/renderer.js';
import { routeHash } from '../router.js';
import { encodeLevel } from '../share.js';
const STORAGE_KEY = 'chorraha.editor.v1';
const TURN_UZ = { straight: "to'g'riga", left: 'chapga', right: "o'ngga" };
const SIGN_UZ = { none: 'belgisiz', main: "asosiy yo'l", yield: "yo'l bering", stop: 'STOP' };
const GESTURE_UZ = { arms_side: "qo'llar yonga", right_forward: "o'ng qo'l oldinga", arm_up: "qo'l tepada" };
const MAX_ARRIVALS = 12;
const MAX_POSES = 16;
function loadDraft() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? migrateDraft(JSON.parse(raw)) : defaultState();
    }
    catch {
        return defaultState();
    }
}
const secs = (ms) => String(Math.round(ms / 100) / 10);
export function mountEditor(root, app) {
    const { store, sfx } = app;
    let state = loadDraft();
    const form = h('div', { class: 'editor-form' });
    const report = h('div', { class: 'editor-report' });
    const json = h('textarea', { class: 'editor-json', spellcheck: 'false', rows: 8, 'aria-label': 'Level JSON yoki havola', placeholder: 'JSON, L1.… kodi yoki havolani shu yerga qo‘ying' });
    const canvas = h('canvas', { class: 'editor-canvas', 'aria-label': "Bosqichning jonli ko'rinishi" });
    const previewStatus = h('div', { class: 'preview-status' });
    const playBtn = h('button', { class: 'btn small', title: "Avtopilot ko'rsatuvini to'xtatish / davom ettirish", onclick: () => toggleDemo() }, icon('pause'));
    const ambPill = h('span', { class: 'amb-pill' });
    const persist = () => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        }
        catch {
            /* ignore */
        }
    };
    /** Structural change: re-render the form + rebuild the preview. */
    const change = (fn) => {
        fn();
        persist();
        render();
        schedulePreview();
    };
    /** Value-only change (typing): keep focus, rebuild the preview. */
    const tweak = (fn) => {
        fn();
        persist();
        check(false);
        schedulePreview();
    };
    const select = (value, options, onchange, label) => h('select', { 'aria-label': label, onchange: (e) => onchange(e.target.value) }, ...options.map(([v, text]) => h('option', { value: v, selected: v === value }, text)));
    const number = (valueSec, onchange, attrs = {}) => h('input', {
        type: 'number',
        step: '0.5',
        min: '0',
        value: valueSec,
        class: 'num',
        ...attrs,
        oninput: (e) => {
            const v = parseFloat(e.target.value);
            if (Number.isFinite(v))
                onchange(v);
        },
    });
    const armEnabled = (d) => activeArms(state).includes(d);
    const turnsFrom = (d) => ['straight', 'left', 'right'].filter((t) => armEnabled(DIR_LETTERS[exitOf(dirFromLetter(d), t)]));
    const kindOptions = VEHICLE_KINDS.map((kd) => [kd, VEHICLE_SPECS[kd].nameUz]);
    function vehicleRow(d, list, k, arrival) {
        const q = list[k];
        const turns = turnsFrom(d);
        if (!turns.includes(q.turn))
            q.turn = turns[0] ?? 'straight';
        return h('div', { class: 'veh-row' }, h('span', { class: 'muted veh-idx' }, `${k + 1}.`), select(q.kind, kindOptions, (v) => change(() => (q.kind = v)), 'Mashina turi'), select(q.turn, turns.map((t) => [t, TURN_UZ[t]]), (v) => change(() => (q.turn = v)), "Yo'nalish"), arrival ? number(secs(q.atMs), (v) => tweak(() => (q.atMs = Math.round(Math.min(600, v) * 1000))), { title: 'Kelish vaqti (soniya)', 'aria-label': 'Kelish vaqti, s', max: '600' }) : null, h('label', { class: 'hero-toggle', title: "Mening mashinam (garajdagi mashina, +5 tanga)" }, h('input', { type: 'checkbox', checked: !!q.hero, onchange: (e) => change(() => (e.target.checked ? (q.hero = true) : delete q.hero)) }), icon('car')), h('button', { class: 'btn ghost small', title: "O'chirish", 'aria-label': "O'chirish", onclick: () => change(() => list.splice(k, 1)) }, icon('close')));
    }
    function render() {
        clear(form);
        const round = state.junction === 'roundabout';
        // --- general ------------------------------------------------------------
        form.append(h('section', { class: 'card' }, h('h2', null, icon('wrench'), ' Umumiy'), h('div', { class: 'form-row' }, h('label', null, 'Nomi ', h('input', { value: state.name, maxlength: '60', oninput: (e) => tweak(() => (state.name = e.target.value)) })), h('label', null, 'Turi ', select(state.junction, [['cross', 'X-chorraha'], ['t', 'T-chorraha'], ['roundabout', 'Aylanma']], (v) => change(() => { state.junction = v; state.band = null; }))), state.junction !== 'cross'
            ? h('label', null, "Yo'q yo'l ", select(state.junction === 't' && state.missing === 'none' ? 'N' : state.missing, [
                ...(round ? [['none', 'hammasi bor (4 ta)']] : []),
                ...DIR_LETTERS.map((d, i) => [d, DIR_NAMES_UZ[i]]),
            ], (v) => change(() => (state.missing = v))))
            : null, h('label', null, 'Muhit ', select(state.ambience, AMBIENCES.map((a) => [a, AMBIENCE_UZ[a]]), (v) => change(() => (state.ambience = v)))), h('label', null, 'Jonlar ', select(String(state.lives), ['1', '2', '3', '4', '5'].map((n) => [n, n]), (v) => change(() => (state.lives = Number(v))))), h('label', null, 'Namuna ', select('', [['', 'bosqichdan nusxa…'], ...CAMPAIGN.map((l) => [String(l.id), `${l.id}. ${l.name}`])], (v) => {
            const src = v ? getLevelDef(Number(v)) : undefined;
            if (src)
                change(() => (state = fromDef(src)));
        }, 'Kampaniya bosqichidan nusxa olish')))));
        // --- regulation ------------------------------------------------------------
        const reg = h('section', { class: 'card' }, h('h2', null, icon('light'), ' Tartibga solish'));
        const regRow = h('div', { class: 'form-row' });
        if (!round) {
            regRow.append(h('label', null, 'Svetofor ', select(state.signals, [['none', "yo'q"], ['two', '2 fazali'], ['four', 'har yo‘lga alohida'], ['flash', 'doim sariq miltillovchi'], ...(state.signals === 'custom' ? [['custom', 'import qilingan fazalar']] : [])], (v) => change(() => {
                state.signals = v;
                if (v === 'two' || v === 'four' || v === 'flash')
                    state.phases = standardPhases({ ...state, phases: [] }, v);
                if (v !== 'none')
                    state.controller = 'none';
            }))));
        }
        if (state.junction === 'cross') {
            regRow.append(h('label', null, 'Regulirovshik ', select(state.controller, [['none', "yo'q"], ['boss1', 'BOSS 1'], ['boss2', 'BOSS 2'], ['boss3', 'BOSS 3'], ['boss4', 'BOSS 4'], ['boss5', 'BOSS 5'], ['custom', "o'zim yozaman"]], (v) => change(() => {
                if (v === 'custom' && state.controller !== 'custom' && state.controller !== 'none')
                    state.poses = PRESETS[state.controller].poses.map((p) => ({ ...p }));
                state.band = null;
                state.controller = v;
                if (v !== 'none')
                    state.signals = 'none';
            }))));
        }
        reg.append(regRow);
        if (!round && state.signals !== 'none' && state.signals !== 'flash' && state.controller === 'none') {
            const phases = phasesFor(state);
            state.phases = phases;
            reg.append(h('div', { class: 'phase-grid' }, ...phases.map((p, i) => h('label', { class: 'phase' }, h('span', null, `${i + 1}-faza: `, h('b', null, p.green.map((d) => DIR_NAMES_UZ[dirFromLetter(d)]).join(' + ')), ' yashil'), number(secs(p.ms), (v) => tweak(() => (state.phases[i] = { ...state.phases[i], ms: Math.max(1000, Math.round(v * 1000)) })), { min: '1', title: 'Yashil davomiyligi, s' }), h('small', null, 's'))), h('label', { class: 'phase' }, h('span', null, 'Sariq'), number(secs(state.amberMs ?? DEFAULT_AMBER_MS), (v) => tweak(() => (state.amberMs = Math.round(v * 1000)))), h('small', null, 's')), h('label', { class: 'phase' }, h('span', null, 'Hammasi qizil'), number(secs(state.allRedMs ?? DEFAULT_ALL_RED_MS), (v) => tweak(() => (state.allRedMs = Math.round(v * 1000)))), h('small', null, 's')), h('label', { class: 'phase' }, h('span', null, 'Siljish (offset)'), number(secs(state.offsetMs), (v) => tweak(() => (state.offsetMs = Math.round(v * 1000)))), h('small', null, 's'))), h('div', { class: 'form-row' }, h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: state.flashing.length > 0, onchange: (e) => change(() => (state.flashing = e.target.checked ? [{ fromMs: 10000, toMs: 20000 }] : [])) }), " Svetofor vaqtincha o'chadi (sariq miltillovchi — belgilar amal qiladi)"), ...state.flashing.map((w, i) => h('span', { class: 'flash-window' }, number(secs(w.fromMs), (v) => tweak(() => (state.flashing[i] = { ...state.flashing[i], fromMs: Math.round(v * 1000) })), { title: 'Boshlanishi, s' }), ' – ', number(secs(w.toMs), (v) => tweak(() => (state.flashing[i] = { ...state.flashing[i], toMs: Math.round(v * 1000) })), { title: 'Tugashi, s' }), h('small', null, ' s')))));
        }
        if (state.junction === 'cross' && state.controller === 'custom') {
            reg.append(h('p', { class: 'muted small' }, "Ishoralar ketma-ket takrorlanadi. Ko'krak/orqa tomondan — to'xtash; chap/o'ng yondan: to'g'ri va o'ngga (qo'llar yonga), o'ng qo'l oldinga — chap yondan hamma yo'nalish, orqadan o'ngga."), h('div', { class: 'pose-list' }, ...state.poses.map((p, i) => h('div', { class: 'veh-row' }, h('span', { class: 'muted veh-idx' }, `${i + 1}.`), select(p.gesture, GESTURES.map((g) => [g, GESTURE_UZ[g]]), (v) => change(() => (p.gesture = v)), 'Ishora'), h('span', { class: 'muted' }, "ko'krak:"), select(p.facing, DIR_LETTERS.map((d, k) => [d, DIR_NAMES_UZ[k]]), (v) => change(() => (p.facing = v)), "Ko'krak tomoni"), number(secs(p.ms), (v) => tweak(() => (p.ms = Math.max(800, Math.round(v * 1000)))), { min: '1', title: 'Davomiyligi, s' }), h('small', null, 's'), h('button', { class: 'btn ghost small', title: "O'chirish", 'aria-label': "O'chirish", disabled: state.poses.length <= 1, onclick: () => change(() => state.poses.splice(i, 1)) }, icon('close')))), state.poses.length < MAX_POSES ? h('button', { class: 'btn small', onclick: () => change(() => state.poses.push({ gesture: 'arm_up', facing: 'N', ms: 1500 })) }, '+ ishora') : null));
        }
        form.append(reg);
        // --- arms ---------------------------------------------------------------
        const grid = h('div', { class: 'arm-grid' });
        DIR_LETTERS.forEach((d, i) => {
            if (!armEnabled(d))
                return;
            const arm = state.arms[d];
            const firstTurn = turnsFrom(d)[0] ?? 'straight';
            grid.appendChild(h('div', { class: 'card arm-card' }, h('h3', null, `${DIR_NAMES_UZ[i]} (${d})`), !round ? h('label', null, 'Belgi ', select(arm.sign, Object.keys(SIGN_UZ).map((sg) => [sg, SIGN_UZ[sg]]), (v) => change(() => (arm.sign = v)))) : null, h('div', { class: 'arm-sub' }, 'Navbatda turganlar'), ...arm.queue.map((_, k) => vehicleRow(d, arm.queue, k, false)), arm.queue.length < MAX_QUEUE ? h('button', { class: 'btn small', onclick: () => change(() => arm.queue.push({ kind: 'car', turn: firstTurn })) }, '+ mashina') : null, h('div', { class: 'arm-sub' }, 'Keyin keladiganlar ', h('small', null, '(vaqti, s)')), ...arm.arrivals.map((_, k) => vehicleRow(d, arm.arrivals, k, true)), arm.arrivals.length < MAX_ARRIVALS
                ? h('button', {
                    class: 'btn small',
                    onclick: () => change(() => arm.arrivals.push({ kind: 'car', turn: firstTurn, atMs: (arm.arrivals[arm.arrivals.length - 1]?.atMs ?? 0) + 3000 })),
                }, '+ keladigan')
                : null));
        });
        form.appendChild(grid);
        // --- texts ------------------------------------------------------------------
        form.append(h('section', { class: 'card' }, h('h2', null, icon('book'), ' Matnlar ', h('small', null, '(ixtiyoriy)')), h('div', { class: 'form-col' }, h('input', { value: state.introTitle, maxlength: '80', placeholder: 'Kirish sarlavhasi', oninput: (e) => tweak(() => (state.introTitle = e.target.value)) }), h('textarea', { rows: 2, maxlength: '400', placeholder: "Kirish matni: o'yinchiga nimani o'rgatmoqchisiz?", oninput: (e) => tweak(() => (state.introText = e.target.value)) }, state.introText), h('input', { value: state.tip, maxlength: '200', placeholder: 'Maslahat (yutqazganda ko‘rinadi)', oninput: (e) => tweak(() => (state.tip = e.target.value)) }), state.coach.length
            ? h('div', { class: 'form-row' }, h('span', { class: 'muted' }, icon('hand'), ` Yordamchi qadamlari: ${state.coach.length} ta (JSON'dan)`), h('button', { class: 'btn ghost small', onclick: () => change(() => (state.coach = [])) }, "O'chirish"))
            : null)));
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
        const count = def.arms.reduce((n, a) => n + a.queue.length + (a.arrivals?.length ?? 0), 0);
        if (runBot) {
            const r = autoplay(loadLevel(def));
            if (!r.completed) {
                report.append(h('p', { class: 'err' }, icon('warn'), " Avtopilot yecha olmadi — bu bosqichni o'tib bo'lmasligi mumkin."));
                return null;
            }
            const par = computePar(loadLevel(def));
            report.append(h('p', { class: 'ok' }, icon('check'), ` To'g'ri va yechiladi. Avtopilot: ${fmtTime((r.ticks * 1000) / 60)}, tez yulduz: ${fmtTime(par)} · ${count} ta mashina`));
            return { ...def, parMs: par };
        }
        report.append(h('p', { class: 'ok' }, icon('check'), ` Tuzilma to‘g‘ri · ${count} ta mashina`));
        return def;
    }
    // ---- live preview: the autopilot plays the level in a loop ----------------------
    const renderer = new Renderer(canvas);
    renderer.settings = { ...DEFAULT_RENDER_SETTINGS, assist: false };
    let engine = null;
    let demoOn = true;
    let doneAt = 0;
    let cooldown = 0;
    let idleTicks = 0;
    let previewTimer = null;
    const lookCtx = () => ({ levelId: 999, ownedModels: ['nexia3', 'cobalt', 'spark', 'gentra', 'damas', 'matiz'], hero: store.getState().save.loadout });
    function rebuildPreview() {
        const def = toDef(state);
        const v = validateLevel(def);
        doneAt = 0;
        idleTicks = 0;
        ambPill.replaceChildren(icon(AMBIENCE_ICON[state.ambience]), ` ${AMBIENCE_UZ[state.ambience]}`);
        if (!v.ok) {
            engine = null;
            renderer.setEngine(null, null);
            previewStatus.replaceChildren(icon('warn'), ` ${v.errors[0]}`);
            previewStatus.className = 'preview-status err';
            return;
        }
        engine = new GameEngine(loadLevel(def));
        engine.on((e) => renderer.onEvent(e));
        renderer.setEngine(engine, lookCtx());
        previewStatus.className = 'preview-status';
    }
    function schedulePreview() {
        if (previewTimer)
            clearTimeout(previewTimer);
        previewTimer = setTimeout(rebuildPreview, 250);
    }
    function toggleDemo() {
        demoOn = !demoOn;
        playBtn.replaceChildren(icon(demoOn ? 'pause' : 'play'));
    }
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    let lastStatus = '';
    const frame = (now) => {
        const dt = Math.min(250, now - last);
        last = now;
        if (engine && demoOn) {
            acc += dt;
            while (acc >= TICK_MS) {
                acc -= TICK_MS;
                if (engine.status === 'playing') {
                    if (--cooldown <= 0) {
                        const m = legalMoves(engine);
                        if (m.length) {
                            engine.tap(m[0].id);
                            cooldown = 24;
                            idleTicks = 0;
                        }
                        else if (engine.queues.some((q) => q[0]?.state === 'waiting'))
                            idleTicks++;
                        else
                            idleTicks = 0;
                    }
                    engine.step();
                }
                else if (!doneAt)
                    doneAt = now;
            }
            if (doneAt && now - doneAt > 1600)
                rebuildPreview();
        }
        renderer.render(engine && demoOn ? acc / TICK_MS : 0, now);
        if (engine) {
            const text = engine.status === 'won'
                ? `Avtopilot yechdi: ${fmtTime(engine.timeMs())} — qayta boshlanadi`
                : idleTicks > 60 * 25
                    ? "Avtopilot hech kimni yubora olmayapti — tiqilinch yoki chiqib bo'lmaydigan holat?"
                    : `Avtopilot o'ynayapti · ${engine.cleared}/${engine.total} · ${fmtTime(engine.timeMs())}`;
            if (text !== lastStatus) {
                lastStatus = text;
                previewStatus.replaceChildren(icon(engine.status === 'won' ? 'check' : idleTicks > 60 * 25 ? 'warn' : 'play'), ` ${text}`);
            }
        }
        else
            lastStatus = '';
        raf = requestAnimationFrame(frame);
    };
    const shareLink = async () => {
        const def = check(false);
        if (!def) {
            store.getState().notify('Avval xatolarni tuzating', 'err');
            return;
        }
        const link = `${location.origin}${location.pathname}${routeHash({ screen: 'play', kind: 'custom', code: encodeLevel(def) })}`;
        json.value = link;
        const ok = await copyText(link);
        store.getState().notify(ok ? "Havola nusxalandi — do'stingizga yuboring!" : 'Havola pastdagi maydonda', ok ? 'ok' : 'info', 'link');
    };
    clear(root);
    root.appendChild(h('div', { class: 'page editor' }, h('header', { class: 'page-head' }, h('button', { class: 'btn ghost', onclick: () => store.getState().go('menu') }, icon('back'), 'Menyu'), h('h1', null, 'Level muharriri')), h('p', { class: 'muted' }, "Chorrahani yig'ing: navbatlar, keyin keladigan mashinalar, belgilar, svetofor vaqtlari yoki regulirovshik. O'ngda avtopilot uni jonli o'ynab ko'rsatadi. " +
        "Tekshirish — validator + avtopilot; havolani do'stingizga yuborsangiz, u ham shu bosqichni o'ynaydi."), h('div', { class: 'editor-layout' }, h('div', { class: 'editor-main' }, form, h('div', { class: 'form-row editor-actions' }, h('button', { class: 'btn', onclick: () => { sfx.click(); check(true); } }, icon('check'), 'Tekshirish'), h('button', { class: 'btn primary', onclick: () => { sfx.unlock(); const def = check(true); if (def)
            store.getState().playCustom(def); } }, icon('play'), "Sinab ko'rish"), h('button', { class: 'btn', onclick: () => void shareLink() }, icon('link'), 'Havolani nusxalash'), h('button', { class: 'btn', onclick: () => { json.value = JSON.stringify(toDef(state), null, 2); } }, 'JSON eksport'), h('button', {
        class: 'btn',
        onclick: () => {
            const r = parseImport(json.value);
            if (r.ok) {
                change(() => (state = fromDef(r.def)));
                store.getState().notify('Bosqich yuklandi', 'ok');
            }
            else
                store.getState().notify(`Import xatosi: ${r.error}`, 'err');
        },
    }, 'Import (JSON / havola)'), h('button', { class: 'btn ghost', onclick: () => change(() => (state = defaultState())) }, icon('restart'), 'Yangidan')), report, json), h('aside', { class: 'editor-preview card' }, h('div', { class: 'preview-head' }, h('b', null, icon('eye'), " Jonli ko'rinish"), ambPill, playBtn), canvas, previewStatus))));
    render();
    const ro = new ResizeObserver(() => renderer.resize());
    ro.observe(canvas);
    rebuildPreview();
    raf = requestAnimationFrame(frame);
    return () => {
        cancelAnimationFrame(raf);
        ro.disconnect();
        if (previewTimer)
            clearTimeout(previewTimer);
    };
}
//# sourceMappingURL=editor.js.map