/**
 * Garage catalog — local car park models, paints and (mostly humorous) tuning.
 * Everything here is COSMETIC: it never changes gameplay, so the puzzle stays fair.
 * Prices are mirrored in supabase/migrations (shop_catalog) for server-side purchases.
 */
const shape = (length, width, bodyH, cabinH, cabinFront, cabinBack, inset = 0.06) => ({ length, width, bodyH, cabinH, cabinFront, cabinBack, inset });
export const MODELS = [
    { kind: 'model', id: 'matiz', name: 'Daewoo Matiz', price: 0, shape: shape(0.88, 0.94, 0.22, 0.25, 0.2, 0.08), defaultPaint: 'sariq' },
    { kind: 'model', id: 'damas', name: 'Chevrolet Damas', price: 120, shape: shape(0.92, 0.96, 0.24, 0.36, 0.05, 0.02, 0.03), defaultPaint: 'oq' },
    { kind: 'model', id: 'nexia3', name: 'Chevrolet Nexia 3', price: 150, shape: shape(1.0, 1.0, 0.21, 0.21, 0.28, 0.22), defaultPaint: 'kumush' },
    { kind: 'model', id: 'spark', name: 'Chevrolet Spark', price: 200, shape: shape(0.93, 0.97, 0.22, 0.24, 0.22, 0.08), defaultPaint: 'kok' },
    { kind: 'model', id: 'cobalt', name: 'Chevrolet Cobalt', price: 350, shape: shape(1.04, 1.0, 0.22, 0.21, 0.27, 0.24), defaultPaint: 'oq' },
    { kind: 'model', id: 'gentra', name: 'Chevrolet Gentra', price: 450, shape: shape(1.03, 1.0, 0.21, 0.22, 0.28, 0.23), defaultPaint: 'qora' },
    { kind: 'model', id: 'tracker', name: 'Chevrolet Tracker', price: 700, shape: shape(1.02, 1.06, 0.28, 0.24, 0.22, 0.08), defaultPaint: 'qizil' },
    { kind: 'model', id: 'malibu', name: 'Chevrolet Malibu 2', price: 1000, shape: shape(1.12, 1.04, 0.2, 0.2, 0.3, 0.25), defaultPaint: 'qora' },
];
export const PAINTS = [
    { kind: 'paint', id: 'oq', name: 'Oq', price: 0, color: '#eef2f6' },
    { kind: 'paint', id: 'sariq', name: 'Sariq', price: 0, color: '#f5c518' },
    { kind: 'paint', id: 'kumush', name: 'Kumush', price: 40, color: '#b9c3cd' },
    { kind: 'paint', id: 'qora', name: 'Qora', price: 40, color: '#23272f' },
    { kind: 'paint', id: 'qizil', name: 'Qizil', price: 60, color: '#d62828' },
    { kind: 'paint', id: 'kok', name: "Ko'k", price: 60, color: '#2563eb' },
    { kind: 'paint', id: 'yashil', name: 'Yashil', price: 60, color: '#1f9d55' },
    { kind: 'paint', id: 'olcha', name: 'Olcha', price: 80, color: '#7a1f2b' },
    { kind: 'paint', id: 'xameleon', name: 'Xameleon', price: 200, color: '#7c3aed' },
];
export const MODS = [
    { kind: 'mod', id: 'sport_wheels', name: "ECU tuning: sport g'ildiraklar", price: 120, desc: "Oltin disklar. Tezlik o'zgarmaydi, lekin ko'rinishi — 300 km/soat." },
    { kind: 'mod', id: 'spoiler', name: 'Spoyler', price: 90, desc: 'Orqa qanot. Chorrahada aerodinamika shart!' },
    { kind: 'mod', id: 'metan', name: 'Metan ballon (bagajda)', price: 40, desc: "Bagaj yopilmaydi, lekin yoqilg'i arzon!" },
    { kind: 'mod', id: 'tint', name: 'Tonirovka', price: 60, desc: "Qoraytirilgan oynalar (faqat o'yinda ruxsat etilgan)." },
    { kind: 'mod', id: 'neon', name: 'Neon yoritish', price: 150, desc: 'Mashina ostida yonib-o‘chadigan neon.' },
    { kind: 'mod', id: 'shashka', name: 'Taksi shashkasi', price: 50, desc: 'Tomda "TAXI" belgisi.' },
    { kind: 'mod', id: 'gilam', name: 'Tomda gilam', price: 80, desc: 'Bozordan qaytyapmiz — tomda o‘ralgan gilam.' },
];
export const STARTER_LOADOUT = { model: 'matiz', paint: 'sariq', mods: [] };
export const STARTER_ITEMS = ['matiz', 'oq', 'sariq'];
export const ALL_ITEMS = [...MODELS, ...PAINTS, ...MODS];
export function findItem(id) {
    return ALL_ITEMS.find((i) => i.id === id);
}
export function findModel(id) {
    return MODELS.find((m) => m.id === id) ?? MODELS[0];
}
export function findPaint(id) {
    return PAINTS.find((p) => p.id === id) ?? PAINTS[0];
}
//# sourceMappingURL=garage.js.map