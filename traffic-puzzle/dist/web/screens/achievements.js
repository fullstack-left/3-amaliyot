/** Achievements ("Yutuqlar"): progress toward each goal and the exclusive garage rewards. */
import { findItem } from '../../content/garage.js';
import { achievementProgress } from '../app.js';
import { clear, h } from '../dom.js';
import { icon, iconOf } from '../icons.js';
export function mountAchievements(root, app) {
    const { store } = app;
    const save = store.getState().save;
    const states = achievementProgress(save);
    const done = states.filter((s) => s.done).length;
    // unlocked first (newest first), then by progress
    const sorted = [...states].sort((a, b) => {
        const ua = save.achievements[a.def.id];
        const ub = save.achievements[b.def.id];
        if (ua && ub)
            return ub.localeCompare(ua);
        if (ua || ub)
            return ua ? -1 : 1;
        return b.ratio - a.ratio;
    });
    clear(root);
    root.appendChild(h('div', { class: 'page' }, h('header', { class: 'page-head' }, h('button', { class: 'btn ghost', onclick: () => store.getState().go('menu') }, icon('back'), 'Menyu'), h('h1', null, 'Yutuqlar'), h('div', { class: 'head-stats' }, icon('trophy'), ` ${done} / ${states.length}`)), h('p', { class: 'muted' }, "Ba'zi yutuqlar garajda faqat shu yo'l bilan ochiladigan maxsus rang yoki tuning beradi (tanga emas)."), h('div', { class: 'ach-grid' }, ...sorted.map((s) => {
        const at = save.achievements[s.def.id];
        const reward = s.def.reward ? findItem(s.def.reward) : undefined;
        return h('div', { class: `ach-card${at ? ' done' : ''}` }, h('div', { class: 'ach-ic' }, iconOf(s.def.icon)), h('div', { class: 'ach-body' }, h('b', null, s.def.title), h('small', null, s.def.desc), h('div', { class: 'ach-progress' }, h('span', { style: { width: `${Math.round(s.ratio * 100)}%` } })), h('div', { class: 'ach-meta' }, h('span', null, at ? `${new Date(at).toLocaleDateString()}` : `${s.value} / ${s.def.goal}`), reward ? h('span', { class: 'ach-reward' }, icon(reward.kind === 'paint' ? 'palette' : 'wrench'), ` ${reward.name}`) : null)), at ? h('span', { class: 'ach-check' }, icon('check')) : null);
    }))));
    return () => undefined;
}
//# sourceMappingURL=achievements.js.map