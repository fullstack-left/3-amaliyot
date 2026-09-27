/** Settings: sound, learning aids, performance switches, cloud (Supabase) sync, reset. */

import type { App } from '../app.js';
import { clear, h } from '../dom.js';
import { icon, type IconName } from '../icons.js';
import type { Settings } from '../save.js';

const TOGGLES: [keyof Settings, IconName, string, string][] = [
  ['sound', 'sound', 'Ovoz', 'YPX hushtagi, sirena, tanga ovozlari'],
  ['vibrate', 'whistle', 'Tebranish', 'Jarimada telefon titraydi (qo‘llab-quvvatlansa)'],
  ['assist', 'check', "Oldindan ko'rsatish", "Sichqoncha ustida: yo'l yashil — mumkin, qizil — mumkin emas"],
  ['controllerArrows', 'cop', 'Oson rejim (boss)', 'Regulirovshik ishorasini matn va belgilar bilan tushuntirish'],
  ['spriteCache', 'car', 'Sprayt kesh', "Mashinalarni oldindan chizib qo'yish (tez). O'chirib, farqni solishtiring"],
  ['perf', 'clock', 'Performance paneli', 'FPS, kadr vaqti, kesh statistikasi'],
  ['unlockAll', 'lock', 'Barcha bosqichlarni ochish', "O'qituvchi / test rejimi"],
];

export function mountSettings(root: HTMLElement, app: App): () => void {
  const { store, sfx } = app;
  const cloudStatus = h('p', { class: 'muted cloud-status' });
  const urlIn = h('input', { type: 'url', placeholder: 'https://xxxx.supabase.co', autocomplete: 'off', spellcheck: 'false' });
  const keyIn = h('input', { type: 'password', placeholder: 'anon / publishable key', autocomplete: 'off' });
  const emailIn = h('input', { type: 'email', placeholder: 'email (ixtiyoriy)', autocomplete: 'email' });
  const passIn = h('input', { type: 'password', placeholder: 'parol (ixtiyoriy)', autocomplete: 'current-password' });
  const toggles = h('div', { class: 'settings-list' });

  function render() {
    const s = store.getState();
    const set = s.save.settings;
    clear(toggles);
    for (const [key, ic, label, desc] of TOGGLES) {
      const input = h('input', {
        type: 'checkbox',
        checked: set[key],
        onchange: (e: Event) => {
          sfx.click();
          store.getState().setSetting(key, (e.target as HTMLInputElement).checked);
        },
      });
      toggles.appendChild(h('label', { class: 'setting' }, input, h('span', null, h('b', null, icon(ic), ` ${label}`), h('small', null, desc))));
    }
    const c = s.save.cloud;
    if (document.activeElement !== urlIn) urlIn.value = c.url;
    if (document.activeElement !== keyIn) keyIn.value = c.anonKey;
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
  root.appendChild(
    h(
      'div',
      { class: 'page' },
      h('header', { class: 'page-head' }, h('button', { class: 'btn ghost', onclick: () => store.getState().go('menu') }, icon('back'), 'Menyu'), h('h1', null, 'Sozlamalar')),
      h('section', { class: 'card' }, h('h2', null, "O'yin"), toggles),
      h(
        'section',
        { class: 'card' },
        h('h2', null, icon('cloud'), ' Bulutli saqlash (Supabase)'),
        h(
          'p',
          { class: 'muted' },
          "Natijalar serverga \"replay\" ko'rinishida yuboriladi va o'sha o'yin yadrosi bilan qayta tekshiriladi (anti-cheat). " +
            "Ulanganda tangalar va garaj serverdagi holatga tenglashadi, yulduzlarning eng yaxshisi saqlanadi. Sozlash: docs/SUPABASE.md.",
        ),
        h('div', { class: 'form-row' }, urlIn, keyIn, h('button', { class: 'btn small', onclick: () => { saveCfg(); store.getState().notify('Saqlandi', 'ok'); } }, 'Saqlash')),
        h('div', { class: 'form-row' }, emailIn, passIn),
        h(
          'div',
          { class: 'form-row' },
          h('button', { class: 'btn primary small', onclick: () => { saveCfg(); void store.getState().cloudConnect(emailIn.value || undefined, passIn.value || undefined, false); } }, 'Ulanish / Kirish'),
          h('button', { class: 'btn small', onclick: () => { saveCfg(); void store.getState().cloudConnect(emailIn.value, passIn.value, true); } }, "Ro'yxatdan o'tish"),
          h('button', { class: 'btn small', onclick: () => void store.getState().cloudSync() }, 'Sinxronlash'),
          h('button', { class: 'btn ghost small', onclick: () => store.getState().cloudDisconnect() }, 'Uzish'),
        ),
        cloudStatus,
      ),
      h(
        'section',
        { class: 'card danger' },
        h('h2', null, 'Progress'),
        h(
          'button',
          {
            class: 'btn danger small',
            onclick: () => {
              if (confirm("Barcha progress, tangalar va garaj o'chiriladi. Davom etasizmi?")) store.getState().resetProgress();
            },
          },
          "Progressni o'chirish",
        ),
      ),
    ),
  );
  render();
  const unsub = store.subscribe(render);
  return unsub;
}
