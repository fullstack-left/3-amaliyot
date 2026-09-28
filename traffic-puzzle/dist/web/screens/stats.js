/**
 * Statistics ("Statistika"): totals, accuracy, which rules the player breaks
 * (with the lesson that teaches each one), endless records and run history.
 */
import { LEVEL_COUNT } from '../../content/campaign.js';
import { ENDLESS_INFO, ENDLESS_VARIANTS } from '../../content/endless.js';
import { accuracy, violationBreakdown, weakestRule } from '../../content/practice.js';
import { REASON_TEXT } from '../../content/rulesText.js';
import { clear, fmtTime, h } from '../dom.js';
import { icon, iconOf, REASON_ICON, starRow } from '../icons.js';
import { isUnlocked, liveStreak, totalStars } from '../save.js';
const MODE_ICON = { campaign: 'map', daily: 'calendar', endless: 'infinity', custom: 'wrench' };
function fmtDuration(ms) {
    const min = Math.round(ms / 60000);
    if (min < 60)
        return `${min} daq`;
    return `${Math.floor(min / 60)} soat ${min % 60} daq`;
}
function fmtDate(iso) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime()))
        return '';
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(d.getDate())}.${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
export function mountStats(root, app) {
    const { store, sfx } = app;
    const st = store.getState();
    const save = st.save;
    const s = save.stats;
    const acc = accuracy(s.departures, s.mistakes);
    const breakdown = violationBreakdown(s.violations);
    const weak = weakestRule(s.violations);
    const maxCount = breakdown.reduce((m, r) => Math.max(m, r.count), 0);
    const card = (ic, label, value, sub, cls = '') => h('div', { class: `stat-card ${cls}`.trim() }, icon(ic), h('b', null, value), h('span', null, label), sub ? h('small', null, sub) : null);
    clear(root);
    root.appendChild(h('div', { class: 'page stats-page' }, h('header', { class: 'page-head' }, h('button', { class: 'btn ghost', onclick: () => store.getState().go('menu') }, icon('back'), 'Menyu'), h('h1', null, 'Statistika')), h('div', { class: 'stat-cards' }, card('flag', "O'yinlar", String(s.played), fmtDuration(s.playMs)), card('car', "O'tkazilgan mashinalar", String(s.cleared)), card('target', 'Aniqlik', `${Math.round(acc * 100)}%`, `${s.departures} to'g'ri · ${s.mistakes} xato`, acc >= 0.9 ? 'good' : acc < 0.7 && s.departures + s.mistakes > 10 ? 'bad' : ''), card('star', 'Yulduzlar', `${totalStars(save)}`, `/ ${LEVEL_COUNT * 3}`), card('plus', 'Maxsus transport', String(s.emergency)), card('check', 'Tiqilinch yechildi', String(s.deadlocks)), card('bulb', 'Maslahatlar', String(s.hints)), card('fire', 'Kunlik seriya', String(liveStreak(save.daily, st.today())), `eng uzun: ${save.daily.bestStreak}`)), h('section', { class: 'card' }, h('h2', null, icon('whistle'), ' Qaysi qoidalar buzilgan'), breakdown.length
        ? h('div', { class: 'vbars' }, ...breakdown.map((r) => h('div', { class: 'vbar' }, h('span', { class: 'vbar-label' }, icon(REASON_ICON[r.reason]), ` ${REASON_TEXT[r.reason].title}`), h('span', { class: 'vbar-track' }, h('span', { class: 'vbar-fill', style: { width: `${Math.max(4, Math.round((100 * r.count) / maxCount))}%` } })), h('span', { class: 'vbar-num' }, `${r.count} · ${Math.round(r.share * 100)}%`))))
        : h('p', { class: 'muted' }, "Hali birorta qoida buzilmagan — a'lo!")), weak
        ? h('section', { class: 'card weak-card' }, h('h2', null, icon('target'), " Eng ko'p xato: ", REASON_TEXT[weak.reason].title), h('p', null, REASON_TEXT[weak.reason].text), weak.level
            ? isUnlocked(save, weak.level)
                ? h('button', { class: 'btn primary', onclick: () => { sfx.unlock(); sfx.click(); store.getState().play(weak.level); } }, icon('target'), ` Mashq qilish: ${weak.level}-bosqich`)
                : h('p', { class: 'muted' }, icon('lock'), ` Bu qoida ${weak.level}-bosqichda o'rgatiladi.`)
            : null)
        : null, h('section', { class: 'card' }, h('h2', null, icon('infinity'), ' Cheksiz rejim rekordlari'), h('div', { class: 'endless-records' }, ...ENDLESS_VARIANTS.map((v) => {
        const r = save.endless[v];
        return h('div', { class: 'endless-rec' }, iconOf(ENDLESS_INFO[v].icon, '', 'cross'), h('b', null, ENDLESS_INFO[v].title), h('span', null, `rekord ${r.best}`), h('small', null, r.runs ? `${r.runs} marta · oxirgi ${r.last}` : "hali o'ynalmagan"));
    }))), h('section', { class: 'card' }, h('h2', null, icon('history'), " So'nggi o'yinlar"), save.history.length
        ? h('ul', { class: 'history-list' }, ...save.history.map((r) => h('li', { class: r.completed ? 'won' : 'lost' }, icon(MODE_ICON[r.mode]), h('span', { class: 'h-name' }, r.name), r.mode === 'endless'
            ? h('span', { class: 'h-res' }, `${r.cleared} ta mashina`)
            : r.completed
                ? starRow(r.stars, 3, 'h-stars')
                : h('span', { class: 'h-res lost' }, 'yutqazildi'), h('span', { class: 'h-time' }, fmtTime(r.timeMs)), h('span', { class: 'h-err', title: 'Xatolar' }, icon('whistle'), ` ${r.mistakes}`), h('small', { class: 'h-date' }, fmtDate(r.at)))))
        : h('p', { class: 'muted' }, "Hali o'yin yo'q. Birinchi chorrahani o'ynang!"))));
    return () => undefined;
}
//# sourceMappingURL=stats.js.map