/**
 * Level validation + loading.
 *
 * `validateLevel` checks an untrusted JSON value (editor import, server input)
 * and reports every problem in Uzbek. `loadLevel` turns a valid LevelDef into
 * the runtime Level (numeric directions, ticks, deterministic vehicle ids).
 */
import { buildController, everPermits } from './controller.js';
import { DIR_LETTERS, dirFromLetter, exitOf, isDirLetter, TURNS, } from './dir.js';
import { CROSS, DESPAWN_U, RB, geometryFor, getJunction } from './junction.js';
import { msToTicks, Q_GAP } from './kinematics.js';
import { buildSignalPlan } from './signals.js';
import { VEHICLE_KINDS, VEHICLE_SPECS } from './vehicles.js';
export const BANDS = ['base', 'complex', 'roundabout', 'boss'];
export const JUNCTION_TYPES = ['cross', 't', 'roundabout'];
export const SIGN_TYPES = ['none', 'main', 'yield', 'stop'];
export const GESTURES = ['arms_side', 'right_forward', 'arm_up'];
export const MAX_VEHICLES = 80;
export const MAX_QUEUE = 7;
const isObj = (x) => typeof x === 'object' && x !== null && !Array.isArray(x);
const isNum = (x) => typeof x === 'number' && Number.isFinite(x);
function checkSpawn(x, where, errors) {
    if (!isObj(x)) {
        errors.push(`${where}: mashina obyekt bo'lishi kerak`);
        return false;
    }
    let ok = true;
    if (!VEHICLE_KINDS.includes(x.kind)) {
        errors.push(`${where}: noma'lum mashina turi "${String(x.kind)}"`);
        ok = false;
    }
    if (!TURNS.includes(x.turn)) {
        errors.push(`${where}: noto'g'ri yo'nalish "${String(x.turn)}" (straight | left | right)`);
        ok = false;
    }
    if (x.hero !== undefined && typeof x.hero !== 'boolean') {
        errors.push(`${where}: hero boolean bo'lishi kerak`);
        ok = false;
    }
    return ok;
}
export function validateLevel(input) {
    const errors = [];
    const warnings = [];
    if (!isObj(input))
        return { ok: false, errors: ["Level JSON obyekt bo'lishi kerak"], warnings };
    const d = input;
    if (!Number.isInteger(d.id) || d.id < 1)
        errors.push('id: musbat butun son bo‘lishi kerak');
    if (typeof d.name !== 'string' || !d.name.trim())
        errors.push("name: bo'sh bo'lmasligi kerak");
    if (!BANDS.includes(d.band))
        errors.push(`band: ${BANDS.join(' | ')}`);
    const type = d.junction;
    if (!JUNCTION_TYPES.includes(type))
        errors.push(`junction: ${JUNCTION_TYPES.join(' | ')}`);
    if (d.lives !== undefined && (!Number.isInteger(d.lives) || d.lives < 1 || d.lives > 9)) {
        errors.push('lives: 1..9');
    }
    if (d.parMs !== undefined && (!isNum(d.parMs) || d.parMs <= 0))
        errors.push('parMs: musbat son');
    const armsSet = new Set();
    let total = 0;
    const spawnsToCheck = [];
    const stopU = type === 'roundabout' ? RB.stopU : CROSS.stopU;
    if (!Array.isArray(d.arms)) {
        errors.push("arms: massiv bo'lishi kerak");
    }
    else {
        d.arms.forEach((a, i) => {
            const w = `arms[${i}]`;
            if (!isObj(a)) {
                errors.push(`${w}: obyekt bo'lishi kerak`);
                return;
            }
            const dir = a.dir;
            if (!isDirLetter(dir)) {
                errors.push(`${w}.dir: ${DIR_LETTERS.join(' | ')}`);
                return;
            }
            if (armsSet.has(dir))
                errors.push(`${w}.dir: "${dir}" takrorlangan`);
            armsSet.add(dir);
            if (a.sign !== undefined && !SIGN_TYPES.includes(a.sign)) {
                errors.push(`${w}.sign: ${SIGN_TYPES.join(' | ')}`);
            }
            const queue = a.queue;
            if (!Array.isArray(queue)) {
                errors.push(`${w}.queue: massiv bo'lishi kerak`);
                return;
            }
            if (queue.length > MAX_QUEUE)
                errors.push(`${w}.queue: ko'pi bilan ${MAX_QUEUE} ta mashina`);
            let laneLen = 0;
            queue.forEach((s, k) => {
                if (checkSpawn(s, `${w}.queue[${k}]`, errors)) {
                    total++;
                    laneLen += VEHICLE_SPECS[s.kind].length + Q_GAP;
                    spawnsToCheck.push({ dir, turn: s.turn, emergency: VEHICLE_SPECS[s.kind].emergency, where: `${w}.queue[${k}]` });
                }
            });
            if (stopU + laneLen > DESPAWN_U - 0.3)
                errors.push(`${w}.queue: navbat yo'lga sig'maydi (juda uzun)`);
            const arrivals = a.arrivals;
            if (arrivals !== undefined) {
                if (!Array.isArray(arrivals))
                    errors.push(`${w}.arrivals: massiv bo'lishi kerak`);
                else
                    arrivals.forEach((s, k) => {
                        const ww = `${w}.arrivals[${k}]`;
                        if (checkSpawn(s, ww, errors)) {
                            const at = s.atMs;
                            if (!isNum(at) || at < 0)
                                errors.push(`${ww}.atMs: 0 yoki musbat son`);
                            total++;
                            spawnsToCheck.push({ dir, turn: s.turn, emergency: VEHICLE_SPECS[s.kind].emergency, where: ww });
                        }
                    });
            }
        });
        const n = armsSet.size;
        if (type === 'cross' && n !== 4)
            errors.push("cross chorrahada 4 ta yo'l bo'lishi kerak");
        if (type === 't' && n !== 3)
            errors.push("T-chorrahada 3 ta yo'l bo'lishi kerak");
        if (type === 'roundabout' && (n < 3 || n > 4))
            errors.push("aylanmada 3 yoki 4 ta yo'l bo'lishi kerak");
        for (const s of spawnsToCheck) {
            const exit = DIR_LETTERS[exitOf(dirFromLetter(s.dir), s.turn)];
            if (!armsSet.has(exit))
                errors.push(`${s.where}: "${s.turn}" yo'nalishida chiqish yo'li (${exit}) yo'q`);
        }
        if (type === 'roundabout') {
            for (const a of d.arms) {
                if (isObj(a) && a.sign !== undefined && a.sign !== 'none') {
                    warnings.push(`aylanma: ${String(a.dir)} belgisi e'tiborsiz qoldiriladi (aylanmada halqa ustun)`);
                }
            }
        }
    }
    if (total < 1)
        errors.push("Kamida bitta mashina bo'lishi kerak");
    if (total > MAX_VEHICLES)
        errors.push(`Ko'pi bilan ${MAX_VEHICLES} ta mashina`);
    // signals
    if (d.signals !== undefined) {
        const sp = d.signals;
        if (type === 'roundabout')
            errors.push("signals: aylanmada svetofor qo'llab-quvvatlanmaydi");
        if (d.controller !== undefined)
            errors.push("signals va controller birga bo'lishi mumkin emas");
        if (!isObj(sp) || !Array.isArray(sp.phases) || sp.phases.length === 0) {
            errors.push("signals.phases: bo'sh bo'lmagan massiv");
        }
        else {
            const covered = new Map();
            sp.phases.forEach((p, i) => {
                if (!isObj(p) || !Array.isArray(p.green) || !isNum(p.ms) || p.ms < 1000) {
                    errors.push(`signals.phases[${i}]: { green: [...], ms >= 1000 }`);
                    return;
                }
                for (const l of p.green) {
                    if (!isDirLetter(l) || !armsSet.has(l))
                        errors.push(`signals.phases[${i}].green: "${String(l)}" yo'l mavjud emas`);
                    else
                        covered.set(l, (covered.get(l) ?? 0) + 1);
                }
            });
            for (const a of armsSet) {
                const c = covered.get(a) ?? 0;
                if (c !== 1)
                    errors.push(`signals: "${a}" yo'li aynan bitta fazada yashil bo'lishi kerak (hozir ${c})`);
            }
            for (const k of ['amberMs', 'allRedMs', 'offsetMs']) {
                if (sp[k] !== undefined && (!isNum(sp[k]) || sp[k] < 0))
                    errors.push(`signals.${k}: 0 yoki musbat`);
            }
            if (sp.flashing !== undefined) {
                if (!Array.isArray(sp.flashing))
                    errors.push('signals.flashing: massiv');
                else
                    sp.flashing.forEach((w, i) => {
                        if (!isObj(w) || !isNum(w.fromMs) || !isNum(w.toMs) || w.fromMs < 0 || w.toMs <= w.fromMs) {
                            errors.push(`signals.flashing[${i}]: { fromMs < toMs }`);
                        }
                    });
            }
        }
    }
    // controller
    if (d.controller !== undefined) {
        const c = d.controller;
        if (type !== 'cross')
            errors.push('controller: faqat cross chorrahada');
        if (!isObj(c) || !Array.isArray(c.poses) || c.poses.length === 0) {
            errors.push("controller.poses: bo'sh bo'lmagan massiv");
        }
        else {
            let poseErr = false;
            c.poses.forEach((p, i) => {
                if (!isObj(p) ||
                    !GESTURES.includes(p.gesture) ||
                    !isDirLetter(p.facing) ||
                    !isNum(p.ms) ||
                    p.ms < 800) {
                    errors.push(`controller.poses[${i}]: { gesture, facing, ms >= 800 }`);
                    poseErr = true;
                }
            });
            if (!poseErr) {
                const plan = buildController(c);
                for (const s of spawnsToCheck) {
                    if (!s.emergency && !everPermits(plan, dirFromLetter(s.dir), s.turn)) {
                        errors.push(`${s.where}: boshqaruvchi hech qachon bu harakatga (${s.dir} → ${s.turn}) ruxsat bermaydi`);
                    }
                }
            }
        }
    }
    return { ok: errors.length === 0, errors, warnings };
}
export function loadLevel(def) {
    const v = validateLevel(def);
    if (!v.ok)
        throw new Error(`Level ${String(def.id)} noto'g'ri:\n- ${v.errors.join('\n- ')}`);
    const armEnabled = [false, false, false, false];
    const sign = ['none', 'none', 'none', 'none'];
    for (const a of def.arms) {
        const d = dirFromLetter(a.dir);
        armEnabled[d] = true;
        sign[d] = def.junction === 'roundabout' ? 'none' : (a.sign ?? 'none');
    }
    const priority = sign.map((s) => (s === 'main' ? 2 : s === 'yield' || s === 'stop' ? 0 : 1));
    const hasPrioritySigns = sign.some((s, i) => armEnabled[i] && s !== 'none');
    const geometry = geometryFor(def.junction, !!def.controller);
    const layout = {
        type: def.junction,
        geometry,
        armEnabled,
        sign,
        priority,
        hasPrioritySigns,
        signals: def.signals ? buildSignalPlan(def.signals) : null,
        controller: def.controller ? buildController(def.controller) : null,
        stopU: getJunction(geometry).stopU,
    };
    const spawns = [];
    let idx = 0;
    const explicitHero = def.arms.some((a) => a.queue.some((s) => s.hero) || (a.arrivals ?? []).some((s) => s.hero));
    let heroAssigned = explicitHero;
    for (const a of def.arms) {
        const from = dirFromLetter(a.dir);
        let k = 0;
        for (const s of a.queue) {
            let hero = !!s.hero;
            if (!heroAssigned && s.kind === 'car') {
                hero = true;
                heroAssigned = true;
            }
            spawns.push({ id: `${a.dir}${k++}`, idx: idx++, from, kind: s.kind, turn: s.turn, hero, initial: true, atTick: 0 });
        }
        const arrivals = [...(a.arrivals ?? [])].sort((x, y) => x.atMs - y.atMs);
        for (const s of arrivals) {
            spawns.push({
                id: `${a.dir}${k++}`,
                idx: idx++,
                from,
                kind: s.kind,
                turn: s.turn,
                hero: !!s.hero,
                initial: false,
                atTick: Math.max(1, msToTicks(s.atMs)),
            });
        }
    }
    return {
        def,
        id: def.id,
        name: def.name,
        band: def.band,
        layout,
        lives: def.lives ?? 3,
        parMs: def.parMs,
        spawns,
    };
}
//# sourceMappingURL=level.js.map