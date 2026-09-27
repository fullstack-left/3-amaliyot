/**
 * Application store — the "cold" state (screens, save data, economy, garage,
 * settings, cloud). Zustand-shaped: `createStore((set, get) => ({ ...state, ...actions }))`.
 * The simulation's hot per-tick state never goes through here.
 */
import { CAMPAIGN, getLevelDef } from '../content/campaign.js';
import { findItem, STARTER_ITEMS } from '../content/garage.js';
import { computeReward } from '../core/scoring.js';
import { Sfx } from './audio.js';
import { purchaseRemote, saveLoadoutRemote, syncNow } from './net/sync.js';
import { SupaClient, SupaError } from './net/supabase.js';
import { defaultSave, loadSave, writeSave } from './save.js';
import { createStore, subscribeSelector } from './store.js';
let toastId = 0;
function client(save) {
    const c = save.cloud;
    if (!c.enabled || !c.url || !c.anonKey || !SupaClient.validUrl(c.url))
        return null;
    return new SupaClient(c.url, c.anonKey, c.session);
}
export function createApp(storage = typeof localStorage === 'undefined' ? null : localStorage) {
    const sfx = new Sfx();
    const initial = loadSave(storage);
    const store = createStore((set, get) => {
        const patchSave = (fn) => set({ save: fn(get().save) });
        return {
            screen: 'menu',
            nav: 0,
            save: initial,
            levelId: 1,
            custom: null,
            toast: null,
            syncing: false,
            syncMsg: null,
            go(screen) {
                set({ screen, nav: get().nav + 1 });
            },
            play(levelId) {
                if (!getLevelDef(levelId))
                    return;
                set({ screen: 'play', levelId, custom: null, nav: get().nav + 1 });
            },
            playCustom(def) {
                set({ screen: 'play', custom: def, levelId: def.id, nav: get().nav + 1 });
            },
            finishLevel(def, result, replay, custom) {
                const save = get().save;
                const key = String(def.id);
                const prev = save.progress[key];
                const reward = custom ? { total: 0, vehicles: 0, completion: 0, stars: 0 } : computeReward(def.band, result, prev?.stars ?? 0);
                patchSave((s) => {
                    const next = {
                        ...s,
                        stats: {
                            cleared: s.stats.cleared + result.cleared,
                            mistakes: s.stats.mistakes + result.mistakes,
                            played: s.stats.played + 1,
                            playMs: s.stats.playMs + result.timeMs,
                        },
                    };
                    if (custom || !result.completed)
                        return next;
                    next.coins = s.coins + reward.total;
                    next.progress = {
                        ...s.progress,
                        [key]: {
                            stars: Math.max(prev?.stars ?? 0, result.stars),
                            bestMs: prev ? Math.min(prev.bestMs, result.timeMs) : result.timeMs,
                        },
                    };
                    if (s.cloud.enabled && replay) {
                        next.cloud = { ...s.cloud, pending: [...s.cloud.pending, { levelId: def.id, replay, at: new Date().toISOString() }].slice(-50) };
                    }
                    return next;
                });
                if (!custom && result.completed && get().save.cloud.enabled)
                    void get().cloudSync();
                return reward;
            },
            markIntroSeen(id) {
                patchSave((s) => (s.seenIntro.includes(id) ? s : { ...s, seenIntro: [...s.seenIntro, id] }));
            },
            async buy(itemId) {
                const item = findItem(itemId);
                const s = get().save;
                if (!item || s.owned.includes(itemId))
                    return false;
                const c = client(s);
                if (c) {
                    try {
                        const coins = await purchaseRemote(c, itemId);
                        patchSave((x) => ({ ...x, coins, owned: [...x.owned, itemId], cloud: { ...x.cloud, session: c.session } }));
                        get().notify(`${item.name} sotib olindi!`, 'ok');
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
                const c = client(get().save);
                if (c)
                    void saveLoadoutRemote(c, l).catch(() => undefined);
            },
            setSetting(key, value) {
                patchSave((s) => ({ ...s, settings: { ...s.settings, [key]: value } }));
                if (key === 'sound')
                    sfx.enabled = value;
            },
            resetProgress() {
                const fresh = defaultSave();
                fresh.settings = get().save.settings;
                set({ save: fresh });
                get().notify('Progress tozalandi', 'info');
            },
            setCloudConfig(url, anonKey) {
                patchSave((s) => ({ ...s, cloud: { ...s.cloud, url: url.trim(), anonKey: anonKey.trim() } }));
            },
            async cloudConnect(email, password, create) {
                const s = get().save;
                if (!SupaClient.validUrl(s.cloud.url) || !s.cloud.anonKey) {
                    get().notify("Supabase URL (https://...) va anon kalitni kiriting", 'err');
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
            async cloudSync() {
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
                        owned: out.owned ? [...new Set([...STARTER_ITEMS, ...out.owned])] : x.owned,
                        cloud: { ...x.cloud, session: c.session, pending: out.kept, lastSync: new Date().toISOString() },
                    }));
                    set({ syncing: false, syncMsg: `Tayyor: ${out.pushed} ta natija yuborildi${out.rejected ? `, ${out.rejected} rad etildi` : ''}` });
                }
                catch (e) {
                    set({ syncing: false, syncMsg: `Sinxronlash xatosi: ${e.message}` });
                }
            },
            cloudDisconnect() {
                patchSave((s) => ({ ...s, cloud: { ...s.cloud, enabled: false, session: null } }));
                set({ syncMsg: 'Uzildi' });
            },
            notify(text, kind = 'info') {
                set({ toast: { text, kind, id: ++toastId } });
            },
        };
    });
    sfx.enabled = initial.settings.sound;
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