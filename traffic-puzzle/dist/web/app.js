/**
 * Application store — the "cold" state (screens, save data, economy, garage,
 * modes, achievements, settings, cloud). Zustand-shaped:
 * `createStore((set, get) => ({ ...state, ...actions }))`.
 * The simulation's hot per-tick state never goes through here.
 */
import { achievementStates, newlyUnlocked } from '../content/achievements.js';
import { CAMPAIGN, getLevelDef } from '../content/campaign.js';
import { dailyLevel, dayIndexOf, dayKeyOf } from '../content/daily.js';
import { endlessLevel, ENDLESS_LIMITS, ENDLESS_OVERFLOW } from '../content/endless.js';
import { exclusiveRewards, findItem, isExclusive, STARTER_ITEMS } from '../content/garage.js';
import { computeReward } from '../core/scoring.js';
import { Sfx } from './audio.js';
import { fetchLeaderboard, fetchMyRank, purchaseRemote, saveLoadoutRemote, setDisplayNameRemote, syncNow } from './net/sync.js';
import { SupaClient, SupaError } from './net/supabase.js';
import { applyDailyCompletion, cleanName, defaultSave, endlessBest, HISTORY_MAX, loadSave, writeSave, } from './save.js';
import { createStore, subscribeSelector } from './store.js';
/** Past daily challenges that can still be played from a link (today − N … today). Future days never. */
export const DAILY_ARCHIVE_DAYS = 6;
let toastId = 0;
const NO_REWARD = { total: 0, vehicles: 0, completion: 0, stars: 0 };
function client(save) {
    const c = save.cloud;
    if (!c.enabled || !c.url || !c.anonKey || !SupaClient.validUrl(c.url))
        return null;
    return new SupaClient(c.url, c.anonKey, c.session);
}
/** Level definition + limits + engine options for a play target (null if it does not exist). */
export function resolveTarget(target) {
    switch (target.kind) {
        case 'campaign': {
            const def = getLevelDef(target.id);
            return def ? { def, limits: {}, engine: {}, mode: 'campaign' } : null;
        }
        case 'daily': {
            const i = dayIndexOf(target.day);
            if (Number.isNaN(i) || i < 0)
                return null;
            return { def: dailyLevel(i), limits: {}, engine: {}, mode: 'daily' };
        }
        case 'endless':
            return {
                def: endlessLevel(target.variant),
                limits: ENDLESS_LIMITS,
                engine: { overflowAt: ENDLESS_OVERFLOW, parMs: Number.POSITIVE_INFINITY },
                mode: 'endless',
            };
        case 'custom':
            return { def: target.def, limits: {}, engine: {}, mode: 'custom' };
    }
}
export function achievementContext(save) {
    return {
        progress: save.progress,
        cleared: save.stats.cleared,
        emergency: save.stats.emergency,
        deadlocks: save.stats.deadlocks,
        dailyCompleted: Object.values(save.daily.results).filter((r) => r.stars > 0).length,
        bestStreak: save.daily.bestStreak,
        endlessBest: endlessBest(save),
        owned: save.owned,
        mods: save.loadout.mods,
    };
}
export function achievementProgress(save) {
    return achievementStates(achievementContext(save));
}
function mergeStats(s, r, extras) {
    const violations = { ...s.violations };
    for (const [k, n] of Object.entries(r.violations)) {
        const key = k;
        violations[key] = (violations[key] ?? 0) + (n ?? 0);
    }
    return {
        cleared: s.cleared + r.cleared,
        mistakes: s.mistakes + r.mistakes,
        played: s.played + 1,
        playMs: s.playMs + r.timeMs,
        departures: s.departures + r.departures,
        emergency: s.emergency + r.emergency,
        deadlocks: s.deadlocks + r.deadlocks,
        hints: s.hints + extras.hints,
        violations,
    };
}
function best(prev, r) {
    return { stars: Math.max(prev?.stars ?? 0, r.stars), bestMs: prev ? Math.min(prev.bestMs, r.timeMs) : r.timeMs };
}
export function createApp(storage = typeof localStorage === 'undefined' ? null : localStorage, opts = {}) {
    const sfx = new Sfx();
    const now = opts.now ?? (() => new Date());
    const initial = loadSave(storage);
    let syncRun = null;
    let syncAgain = false;
    const store = createStore((set, get) => {
        const patchSave = (fn) => set({ save: fn(get().save) });
        const navigate = (screen, target = get().target) => set({ screen, target, nav: get().nav + 1 });
        return {
            screen: 'menu',
            nav: 0,
            save: initial,
            target: null,
            toast: null,
            syncing: false,
            syncMsg: null,
            today: () => dayKeyOf(now()),
            go(screen) {
                navigate(screen, screen === 'play' ? get().target : null);
            },
            play(levelId) {
                if (!getLevelDef(levelId))
                    return;
                navigate('play', { kind: 'campaign', id: levelId });
            },
            playDaily(day) {
                const todayKey = get().today();
                let key = day ?? todayKey;
                const d = dayIndexOf(key);
                const t = dayIndexOf(todayKey);
                if (Number.isNaN(d) || d > t || d < t - DAILY_ARCHIVE_DAYS)
                    key = todayKey;
                navigate('play', { kind: 'daily', day: key });
            },
            playEndless(variant) {
                navigate('play', { kind: 'endless', variant });
            },
            playCustom(def) {
                navigate('play', { kind: 'custom', def });
            },
            finishRun(target, def, result, replay, extras = { hints: 0 }) {
                const s0 = get().save;
                const at = now().toISOString();
                const mode = target.kind;
                const record = {
                    mode,
                    levelId: def.id,
                    name: def.name,
                    completed: result.completed,
                    stars: result.stars,
                    timeMs: result.timeMs,
                    mistakes: result.mistakes,
                    cleared: result.cleared,
                    at,
                };
                const next = {
                    ...s0,
                    stats: mergeStats(s0.stats, result, extras),
                    history: [record, ...s0.history].slice(0, HISTORY_MAX),
                };
                let reward = NO_REWARD;
                let prev;
                let endless;
                let daily;
                const queueCloud = (levelId) => {
                    if (s0.cloud.enabled && replay) {
                        next.cloud = { ...s0.cloud, pending: [...s0.cloud.pending, { levelId, replay, at }].slice(-50) };
                    }
                };
                switch (target.kind) {
                    case 'campaign': {
                        prev = s0.progress[String(def.id)];
                        if (result.completed) {
                            reward = computeReward(def.band, result, prev?.stars ?? 0);
                            next.coins = s0.coins + reward.total;
                            next.progress = { ...s0.progress, [String(def.id)]: best(prev, result) };
                            queueCloud(def.id);
                        }
                        break;
                    }
                    case 'daily': {
                        prev = s0.daily.results[target.day];
                        if (result.completed) {
                            reward = computeReward(def.band, result, prev?.stars ?? 0);
                            next.coins = s0.coins + reward.total;
                            let d = { ...s0.daily, results: { ...s0.daily.results, [target.day]: best(prev, result) } };
                            const counted = target.day === get().today();
                            if (counted)
                                d = applyDailyCompletion(d, target.day);
                            next.daily = d;
                            daily = { streak: d.streak, counted };
                            queueCloud(def.id);
                        }
                        break;
                    }
                    case 'endless': {
                        const e = s0.endless[target.variant];
                        const score = result.cleared;
                        next.endless = { ...s0.endless, [target.variant]: { best: Math.max(e.best, score), runs: e.runs + 1, last: score } };
                        endless = { score, best: Math.max(e.best, score), record: score > e.best && score > 0 };
                        break;
                    }
                    case 'custom':
                        break;
                }
                set({ save: next });
                const achievements = get().checkAchievements();
                if (get().save.cloud.enabled && result.completed && (target.kind === 'campaign' || target.kind === 'daily'))
                    void get().cloudSync();
                return {
                    reward,
                    achievements,
                    prevStars: prev?.stars ?? 0,
                    prevBestMs: prev ? prev.bestMs : null,
                    newStars: result.completed && result.stars > (prev?.stars ?? 0),
                    newBestTime: result.completed && (!prev || result.timeMs < prev.bestMs),
                    endless,
                    daily,
                };
            },
            checkAchievements() {
                const s = get().save;
                const fresh = newlyUnlocked(achievementContext(s), Object.keys(s.achievements));
                if (!fresh.length)
                    return [];
                const at = now().toISOString();
                const achievements = { ...s.achievements };
                for (const a of fresh)
                    achievements[a.id] = at;
                const owned = [...new Set([...s.owned, ...exclusiveRewards(Object.keys(achievements))])];
                set({ save: { ...s, achievements, owned } });
                const last = fresh[fresh.length - 1];
                get().notify(fresh.length === 1 ? `Yangi yutuq: ${last.title}` : `${fresh.length} ta yangi yutuq: ${fresh.map((a) => a.title).join(', ')}`, 'achievement', last.icon);
                return fresh;
            },
            markIntroSeen(id) {
                patchSave((s) => (s.seenIntro.includes(id) ? s : { ...s, seenIntro: [...s.seenIntro, id] }));
            },
            async buy(itemId) {
                const item = findItem(itemId);
                const s = get().save;
                if (!item || s.owned.includes(itemId) || isExclusive(item))
                    return false;
                const c = client(s);
                if (c) {
                    try {
                        const coins = await purchaseRemote(c, itemId);
                        patchSave((x) => ({ ...x, coins, owned: [...x.owned, itemId], cloud: { ...x.cloud, session: c.session } }));
                        get().notify(`${item.name} sotib olindi!`, 'ok');
                        get().checkAchievements();
                        return true;
                    }
                    catch (e) {
                        get().notify(e instanceof SupaError && e.message.includes('insufficient') ? 'Tangalar yetarli emas' : `Xarid xatosi: ${e.message}`, 'err');
                        return false;
                    }
                }
                if (s.coins < item.price) {
                    get().notify('Tangalar yetarli emas', 'err');
                    return false;
                }
                patchSave((x) => ({ ...x, coins: x.coins - item.price, owned: [...x.owned, itemId] }));
                get().notify(`${item.name} sotib olindi!`, 'ok');
                get().checkAchievements();
                return true;
            },
            equip(itemId) {
                const item = findItem(itemId);
                const s = get().save;
                if (!item || !s.owned.includes(itemId))
                    return;
                const l = { ...s.loadout, mods: [...s.loadout.mods] };
                if (item.kind === 'model')
                    l.model = itemId;
                else if (item.kind === 'paint')
                    l.paint = itemId;
                else
                    l.mods = l.mods.includes(itemId) ? l.mods.filter((m) => m !== itemId) : [...l.mods, itemId];
                patchSave((x) => ({ ...x, loadout: l }));
                get().checkAchievements();
                const c = client(get().save);
                if (c)
                    void saveLoadoutRemote(c, l).catch(() => undefined);
            },
            setSetting(key, value) {
                patchSave((s) => ({ ...s, settings: { ...s.settings, [key]: value } }));
                if (key === 'sound')
                    sfx.enabled = value;
                if (key === 'volume')
                    sfx.setVolume(value);
            },
            setProfileName(name) {
                const clean = cleanName(name);
                patchSave((s) => ({ ...s, profile: { ...s.profile, name: clean } }));
                const c = client(get().save);
                if (c && clean.length >= 2) {
                    void setDisplayNameRemote(c, clean)
                        .then(() => get().notify('Ism saqlandi', 'ok'))
                        .catch((e) => get().notify(`Ismni saqlab bo'lmadi: ${e.message}`, 'err'));
                }
            },
            resetProgress() {
                const fresh = defaultSave();
                fresh.settings = get().save.settings;
                fresh.profile = get().save.profile;
                set({ save: fresh });
                get().notify('Progress tozalandi', 'info');
            },
            setCloudConfig(url, anonKey) {
                patchSave((s) => ({ ...s, cloud: { ...s.cloud, url: url.trim(), anonKey: anonKey.trim() } }));
            },
            async cloudConnect(email, password, create) {
                const s = get().save;
                if (!SupaClient.validUrl(s.cloud.url) || !s.cloud.anonKey) {
                    get().notify('Supabase URL (https://...) va anon kalitni kiriting', 'err');
                    return;
                }
                const c = new SupaClient(s.cloud.url, s.cloud.anonKey, null);
                set({ syncing: true, syncMsg: 'Ulanmoqda…' });
                try {
                    if (email && password) {
                        const sess = create ? await c.signUp(email, password) : await c.signIn(email, password);
                        if (!sess) {
                            set({ syncing: false, syncMsg: 'Emailni tasdiqlang, keyin kiring' });
                            return;
                        }
                    }
                    else {
                        await c.signInAnonymously();
                    }
                    patchSave((x) => ({ ...x, cloud: { ...x.cloud, enabled: true, session: c.session } }));
                    set({ syncing: false, syncMsg: 'Ulandi' });
                    await get().cloudSync();
                }
                catch (e) {
                    set({ syncing: false, syncMsg: `Xato: ${e.message}` });
                }
            },
            cloudSync() {
                // one sync at a time; requests arriving meanwhile run once more right after
                if (syncRun) {
                    syncAgain = true;
                    return syncRun;
                }
                syncRun = (async () => {
                    try {
                        do {
                            syncAgain = false;
                            await doSync();
                        } while (syncAgain);
                    }
                    finally {
                        syncRun = null;
                    }
                })();
                return syncRun;
            },
            async leaderboard(levelId, limit = 5) {
                const c = client(get().save);
                if (!c)
                    return null;
                if (syncRun)
                    await syncRun.catch(() => undefined);
                try {
                    const [rows, me] = await Promise.all([fetchLeaderboard(c, levelId, limit), fetchMyRank(c, levelId)]);
                    return { rows, me };
                }
                catch {
                    return null;
                }
            },
            cloudDisconnect() {
                patchSave((s) => ({ ...s, cloud: { ...s.cloud, enabled: false, session: null } }));
                set({ syncMsg: 'Uzildi' });
            },
            notify(text, kind = 'info', icon) {
                set({ toast: { text, kind, icon, id: ++toastId } });
            },
        };
        async function doSync() {
            const s = get().save;
            const c = client(s);
            if (!c || get().syncing)
                return;
            set({ syncing: true, syncMsg: 'Sinxronlanmoqda…' });
            try {
                const out = await syncNow(c, s);
                patchSave((x) => ({
                    ...x,
                    coins: out.coins ?? x.coins,
                    progress: out.progress,
                    daily: { ...x.daily, results: out.daily },
                    owned: out.owned ? [...new Set([...STARTER_ITEMS, ...out.owned, ...exclusiveRewards(Object.keys(x.achievements))])] : x.owned,
                    // keep runs finished while this sync was in flight (they were not in `s`)
                    cloud: {
                        ...x.cloud,
                        session: c.session,
                        pending: [...out.kept, ...x.cloud.pending.filter((r) => !s.cloud.pending.includes(r))],
                        lastSync: now().toISOString(),
                    },
                }));
                set({ syncing: false, syncMsg: `Tayyor: ${out.pushed} ta natija yuborildi${out.rejected ? `, ${out.rejected} rad etildi` : ''}` });
                get().checkAchievements();
            }
            catch (e) {
                set({ syncing: false, syncMsg: `Sinxronlash xatosi: ${e.message}` });
            }
        }
    });
    sfx.enabled = initial.settings.sound;
    sfx.setVolume(initial.settings.volume);
    // persist save changes (debounced)
    let timer = null;
    subscribeSelector(store, (s) => s.save, (save) => {
        if (timer)
            clearTimeout(timer);
        timer = setTimeout(() => writeSave(save, storage), 150);
    });
    return { store, sfx };
}
export function campaignCount() {
    return CAMPAIGN.length;
}
//# sourceMappingURL=app.js.map