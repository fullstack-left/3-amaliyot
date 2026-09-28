/** Garage: buy local car models, paints and (humorous) tuning; live rotating preview. */
import { findAchievement } from '../../content/achievements.js';
import { EXCLUSIVE_MODS, EXCLUSIVE_PAINTS, isExclusive, MODELS, MODS, PAINTS } from '../../content/garage.js';
import { clear, h } from '../dom.js';
import { icon } from '../icons.js';
import { localCamera } from '../render/camera.js';
import { withGrade } from '../render/color.js';
import { lookFor } from '../render/looks.js';
import { drawFlag, drawLightBar, drawNeon, drawVehicleVector, Pose } from '../render/vehicles.js';
export function mountGarage(root, app) {
    const { store, sfx } = app;
    let tab = 'model';
    const preview = h('canvas', { class: 'garage-preview', 'aria-label': 'Mashina ko‘rinishi' });
    const listEl = h('div', { class: 'item-grid' });
    const coinsEl = h('div', { class: 'head-stats' });
    const tabsEl = h('div', { class: 'tabs', role: 'tablist' });
    clear(root);
    root.appendChild(h('div', { class: 'page garage' }, h('header', { class: 'page-head' }, h('button', { class: 'btn ghost', onclick: () => store.getState().go('menu') }, icon('back'), 'Menyu'), h('h1', null, 'Garaj'), coinsEl), h('div', { class: 'garage-body' }, h('div', { class: 'garage-stage' }, preview, h('p', { class: 'muted' }, "Sizning mashinangiz har bosqichda yo'lda chiqadi — uni o'tkazsangiz +5 tanga.")), h('div', { class: 'garage-shop' }, tabsEl, listEl))));
    function renderList() {
        const s = store.getState().save;
        coinsEl.replaceChildren(icon('coin'), document.createTextNode(` ${s.coins}`));
        clear(tabsEl);
        [
            ['model', 'car', 'Modellar'],
            ['paint', 'palette', 'Ranglar'],
            ['mod', 'wrench', 'Tuning'],
        ].forEach(([t, ic, label]) => tabsEl.appendChild(h('button', { class: `tab${t === tab ? ' active' : ''}`, role: 'tab', 'aria-selected': t === tab ? 'true' : 'false', onclick: () => { tab = t; renderList(); } }, icon(ic), label)));
        clear(listEl);
        const items = tab === 'model' ? MODELS : tab === 'paint' ? [...PAINTS, ...EXCLUSIVE_PAINTS] : [...MODS, ...EXCLUSIVE_MODS];
        for (const it of items) {
            const owned = s.owned.includes(it.id);
            const exclusive = isExclusive(it);
            const equipped = it.kind === 'model' ? s.loadout.model === it.id : it.kind === 'paint' ? s.loadout.paint === it.id : s.loadout.mods.includes(it.id);
            let action;
            if (!owned && exclusive) {
                const ach = it.kind !== 'model' && it.exclusive ? findAchievement(it.exclusive) : undefined;
                action = h('button', { class: 'btn small ghost lock-note', title: ach?.desc ?? '', onclick: () => { sfx.click(); store.getState().go('achievements'); } }, icon('trophy'), ` Yutuq: ${ach?.title ?? '?'}`);
            }
            else if (!owned) {
                action = h('button', {
                    class: 'btn primary small',
                    disabled: s.coins < it.price,
                    onclick: async () => {
                        sfx.unlock();
                        if (await store.getState().buy(it.id)) {
                            sfx.coin();
                            store.getState().equip(it.id);
                        }
                    },
                }, icon('coin'), ` ${it.price}`);
            }
            else if (it.kind === 'mod') {
                action = h('button', { class: `btn small${equipped ? ' on' : ''}`, onclick: () => { sfx.click(); store.getState().equip(it.id); } }, equipped ? icon('check') : null, equipped ? "O'rnatilgan" : "O'rnatish");
            }
            else {
                action = h('button', { class: `btn small${equipped ? ' on' : ''}`, disabled: equipped, onclick: () => { sfx.click(); store.getState().equip(it.id); } }, equipped ? icon('check') : null, equipped ? 'Tanlangan' : 'Tanlash');
            }
            listEl.appendChild(h('div', { class: `item-card${equipped ? ' equipped' : ''}${exclusive ? ' exclusive' : ''}${exclusive && !owned ? ' locked' : ''}` }, it.kind === 'paint' ? h('div', { class: 'swatch', style: { background: it.color } }) : h('div', { class: 'item-icon' }, icon(it.kind === 'model' ? 'car' : exclusive ? 'trophy' : 'wrench')), h('div', { class: 'item-name' }, it.name, exclusive ? h('span', { class: 'tag' }, 'maxsus') : null), it.kind === 'mod' ? h('div', { class: 'item-desc' }, it.desc) : null, action));
        }
    }
    // rotating preview
    const ctx = preview.getContext('2d');
    let raf = 0;
    const draw = (now) => {
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const w = preview.clientWidth;
        const hh = preview.clientHeight;
        if (preview.width !== Math.round(w * dpr)) {
            preview.width = Math.round(w * dpr);
            preview.height = Math.round(hh * dpr);
        }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        const g = ctx.createLinearGradient(0, 0, 0, hh);
        g.addColorStop(0, '#dfe9f3');
        g.addColorStop(1, '#b8c6d6');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, hh);
        const scale = Math.min(w / 3.2, hh / 1.9);
        const cam = localCamera(scale, w / 2, hh * 0.62);
        ctx.fillStyle = '#9aa9b9';
        ctx.beginPath();
        ctx.ellipse(w / 2, hh * 0.62, scale * 1.25 * Math.SQRT2, scale * 0.625 * Math.SQRT2, 0, 0, Math.PI * 2);
        ctx.fill();
        const s = store.getState().save;
        const look = lookFor({ id: 'hero', kind: 'car', hero: true }, { levelId: 0, ownedModels: [], hero: s.loadout });
        const pose = new Pose(cam).set(0, 0, now / 2200);
        withGrade('day', () => {
            if (look.mods.includes('neon'))
                drawNeon(ctx, pose, look, now);
            drawVehicleVector(ctx, pose, look);
            drawLightBar(ctx, pose, look, now, false);
            if (look.mods.includes('bayroq'))
                drawFlag(ctx, pose, look, now);
        });
        raf = requestAnimationFrame(draw);
    };
    renderList();
    const unsub = store.subscribe((st, prev) => {
        if (st.save !== prev.save)
            renderList();
    });
    raf = requestAnimationFrame(draw);
    return () => {
        cancelAnimationFrame(raf);
        unsub();
    };
}
//# sourceMappingURL=garage.js.map