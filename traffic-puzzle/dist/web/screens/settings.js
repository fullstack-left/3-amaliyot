/** Settings: sound, learning aids, performance switches, cloud (Supabase) sync, reset. */
import { clear, h } from '../dom.js';
import { icon } from '../icons.js';
import { NAME_MAX } from '../save.js';
const TOGGLES = [
    ['sound', 'sound', 'Ovoz', 'YPX hushtagi, sirena, tanga ovozlari'],
    ['vibrate', 'whistle', 'Tebranish', 'Jarimada telefon titraydi (qo‘llab-quvvatlansa)'],
    ['assist', 'eye', "Oldindan ko'rsatish va \"Nega?\"", "Sichqoncha ustida (telefonda — uzoq bosib): yo'l yashil — mumkin, qizil — mumkin emas, sababi bilan"],
    ['controllerArrows', 'cop', 'Oson rejim (boss)', 'Regulirovshik ishorasini matn va belgilar bilan tushuntirish'],
    ['keyHints', 'keyboard', 'Klaviatura raqamlari', "Oldingi mashinalar ustida 1–4 raqamlari (Shimol, Sharq, Janub, G'arb)"],
    ['effects', 'fire', 'Effektlar', "Uchqunlar, tutun, yomg'ir tomchilari, ekran silkinishi, konfetti"],
    ['spriteCache', 'car', 'Sprayt kesh', "Mashinalarni oldindan chizib qo'yish (tez). O'chirib, farqni solishtiring"],
    ['perf', 'clock', 'Performance paneli', 'FPS, kadr vaqti, kesh statistikasi'],
    ['unlockAll', 'lock', 'Barcha bosqichlarni ochish', "O'qituvchi / test rejimi"],
];
export function mountSettings(root, app) {
    const { store, sfx } = app;
    const cloudStatus = h('p', { class: 'muted cloud-status' });
    const urlIn = h('input', { type: 'url', placeholder: 'https://xxxx.supabase.co', autocomplete: 'off', spellcheck: 'false' });
    const keyIn = h('input', { type: 'password', placeholder: 'anon / publishable key', autocomplete: 'off' });
    const emailIn = h('input', { type: 'email', placeholder: 'email (ixtiyoriy)', autocomplete: 'email' });
    const passIn = h('input', { type: 'password', placeholder: 'parol (ixtiyoriy)', autocomplete: 'current-password' });
    const toggles = h('div', { class: 'settings-list' });
    const volume = h('input', {
        type: 'range',
        min: '0',
        max: '100',
        step: '5',
        'aria-label': 'Ovoz balandligi',
        oninput: (e) => store.getState().setSetting('volume', Number(e.target.value) / 100),
        onchange: () => sfx.coin(),
    });
    const volumeOut = h('span', { class: 'slider-val' });
    const nameIn = h('input', { type: 'text', maxlength: String(NAME_MAX), placeholder: 'Ismingiz (reyting uchun)', autocomplete: 'nickname' });
    function render() {
        const s = store.getState();
        const set = s.save.settings;
        clear(toggles);
        for (const [key, ic, label, desc] of TOGGLES) {
            const input = h('input', {
                type: 'checkbox',
                checked: set[key],
                onchange: (e) => {
                    sfx.click();
                    store.getState().setSetting(key, e.target.checked);
                },
            });
            toggles.appendChild(h('label', { class: 'setting' }, input, h('span', null, h('b', null, icon(ic), ` ${label}`), h('small', null, desc))));
        }
        if (document.activeElement !== volume)
            volume.value = String(Math.round(set.volume * 100));
        volumeOut.textContent = `${Math.round(set.volume * 100)}%`;
        if (document.activeElement !== nameIn)
            nameIn.value = s.save.profile.name;
        const c = s.save.cloud;
        if (document.activeElement !== urlIn)
            urlIn.value = c.url;
        if (document.activeElement !== keyIn)
            keyIn.value = c.anonKey;
        cloudStatus.textContent = [
            c.enabled ? `Holat: ulangan${c.session?.email ? ` (${c.session.email})` : ' (anonim)'}` : 'Holat: ulanmagan',
            c.pending.length ? `· navbatda ${c.pending.length} ta natija` : '',
            c.lastSync ? `· oxirgi sinxron: ${new Date(c.lastSync).toLocaleString()}` : '',
            s.syncMsg ? `· ${s.syncMsg}` : '',
        ]
            .filter(Boolean)
            .join(' ');
    }
    const saveCfg = () => store.getState().setCloudConfig(urlIn.value, keyIn.value);
    clear(root);
    root.appendChild(h('div', { class: 'page' }, h('header', { class: 'page-head' }, h('button', { class: 'btn ghost', onclick: () => store.getState().go('menu') }, icon('back'), 'Menyu'), h('h1', null, 'Sozlamalar')), h('section', { class: 'card' }, h('h2', null, "O'yin"), toggles, h('label', { class: 'setting slider-row' }, h('span', null, h('b', null, icon('sound'), ' Ovoz balandligi'), h('small', null, 'Barcha ovozlar uchun')), volume, volumeOut)), h('section', { class: 'card' }, h('h2', null, icon('user'), ' Profil'), h('p', { class: 'muted' }, "Ism reyting jadvalida ko'rinadi (bulutga ulanganda). 2–24 belgi."), h('div', { class: 'form-row' }, nameIn, h('button', { class: 'btn small', onclick: () => { store.getState().setProfileName(nameIn.value); store.getState().notify('Ism saqlandi', 'ok', 'user'); } }, 'Saqlash'))), h('section', { class: 'card' }, h('h2', null, icon('keyboard'), ' Klaviatura'), h('ul', { class: 'kbd-list cols' }, h('li', null, h('kbd', null, '1'), '–', h('kbd', null, '4'), " Shimol / Sharq / Janub / G'arb mashinasini yuborish"), h('li', null, h('kbd', null, 'H'), ' Maslahat'), h('li', null, h('kbd', null, 'F'), ' 2× tezlik'), h('li', null, h('kbd', null, 'M'), ' Ovozni o‘chirish/yoqish'), h('li', null, h('kbd', null, 'R'), ' Qayta boshlash'), h('li', null, h('kbd', null, 'P'), ' / ', h('kbd', null, 'Esc'), ' Pauza'), h('li', null, h('kbd', null, '?'), ' Bosqich qoidasi'))), h('section', { class: 'card' }, h('h2', null, icon('cloud'), ' Bulutli saqlash (Supabase)'), h('p', { class: 'muted' }, "Natijalar serverga \"replay\" ko'rinishida yuboriladi va o'sha o'yin yadrosi bilan qayta tekshiriladi (anti-cheat). " +
        "Ulanganda tangalar va garaj serverdagi holatga tenglashadi, yulduzlarning eng yaxshisi saqlanadi. Sozlash: docs/SUPABASE.md."), h('div', { class: 'form-row' }, urlIn, keyIn, h('button', { class: 'btn small', onclick: () => { saveCfg(); store.getState().notify('Saqlandi', 'ok'); } }, 'Saqlash')), h('div', { class: 'form-row' }, emailIn, passIn), h('div', { class: 'form-row' }, h('button', { class: 'btn primary small', onclick: () => { saveCfg(); void store.getState().cloudConnect(emailIn.value || undefined, passIn.value || undefined, false); } }, 'Ulanish / Kirish'), h('button', { class: 'btn small', onclick: () => { saveCfg(); void store.getState().cloudConnect(emailIn.value, passIn.value, true); } }, "Ro'yxatdan o'tish"), h('button', { class: 'btn small', onclick: () => void store.getState().cloudSync() }, 'Sinxronlash'), h('button', { class: 'btn ghost small', onclick: () => store.getState().cloudDisconnect() }, 'Uzish')), cloudStatus), h('section', { class: 'card danger' }, h('h2', null, 'Progress'), h('button', {
        class: 'btn danger small',
        onclick: () => {
            if (confirm("Barcha progress, tangalar va garaj o'chiriladi. Davom etasizmi?"))
                store.getState().resetProgress();
        },
    }, "Progressni o'chirish"))));
    render();
    const unsub = store.subscribe(render);
    return unsub;
}
//# sourceMappingURL=settings.js.map