/** The shipped 50-level campaign (frozen data) + lookup helpers. */
import { loadLevel } from '../core/level.js';
import { CAMPAIGN_DATA } from './campaign.data.js';
export const CAMPAIGN = CAMPAIGN_DATA;
export const LEVEL_COUNT = CAMPAIGN.length;
export const BAND_INFO = {
    base: { title: "O'quv va baza", subtitle: "X-chorrahalar, o'ng qo'l qoidasi" },
    complex: { title: 'Murakkablashuv', subtitle: "Belgilar, svetoforlar, navbatlar" },
    roundabout: { title: 'Aylanma va trassalar', subtitle: 'Halqa ustunligi, tirbandlik' },
    boss: { title: 'BOSS', subtitle: 'Regulirovshik ishoralari' },
};
export const CHAPTERS = [
    { title: "1–10 · O'quv va baza", subtitle: "Faqat X-chorrahalar. O'ng qo'l qoidasi.", from: 1, to: 10 },
    { title: '11–30 · Murakkablashuv', subtitle: "Asosiy/ikkinchi darajali yo'llar, svetoforlar, navbatlar.", from: 11, to: 30 },
    { title: '31–50 · Aylanma va trassalar', subtitle: 'Aylanma harakat, tirbandlik, final boss.', from: 31, to: 50 },
];
const cache = new Map();
export function getLevelDef(id) {
    return CAMPAIGN.find((l) => l.id === id);
}
export function getLevel(id) {
    let l = cache.get(id);
    if (!l) {
        const def = getLevelDef(id);
        if (!def)
            throw new Error(`Bosqich ${id} topilmadi`);
        l = loadLevel(def);
        cache.set(id, l);
    }
    return l;
}
//# sourceMappingURL=campaign.js.map