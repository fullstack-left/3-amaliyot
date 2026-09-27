# 🚦 Chorraha Boshqaruvi — Traffic Puzzle

Real yo'l harakati qoidalariga asoslangan **2D izometrik** boshqotirma o'yin.
O'yinchi chorrahada "ko'rinmas tartibga soluvchi" rolini bajaradi: qaysi mashinaga
bossa, o'sha harakatlanadi — lekin faqat qoidaga muvofiq bo'lsa.

Bu papkada **framework'dan mustaqil o'yin yadrosi** (toza TypeScript) va uni
darhol o'ynash uchun **brauzer prototipi** bor. Arxitektura RN/Flutter + Supabase
uchun mo'ljallangan — batafsil: [`ARCHITECTURE.md`](./ARCHITECTURE.md).

## O'ynash (prototip)

```bash
cd traffic-puzzle
npm run build          # TypeScript -> dist/  (tsc, dependency'siz)
npm run serve          # http://localhost:8080 ni oching
# yoki index.html ni statik server orqali oching
```

**Boshqaruv:** mashinani bosing (harakatlansin) · `R` qayta boshlash ·
`N` keyingi bosqich · `P` oldingi · bosqich tugagach 2 marta bosing.

## Testlar

```bash
npm test               # build + engine testlari (13/13 pass)
```

## Yadro qoidalari (Rule Validation Engine)

`core/rules.ts` dagi `canVehicleMove()` — o'yin miyasi. Ustuvorlik zinapoyasi:

1. Navbat (front-of-queue) 2. Svetofor 3. Boshqaruvchi (boss)
4. Maxsus transport 5. Aylanma 6. Asosiy yo'l 7. **O'ng qo'l qoidasi**

Har bir funksiya **toza** — bir xil kod klientda ham, Supabase Edge Function'da
ham (anti-cheat) ishlaydi.

## Tuzilma

| Papka | Vazifa |
|-------|--------|
| `src/core/` | domen modeli, geometriya, qoidalar, engine (toza TS) |
| `src/state/` | Zustand shaklidagi store (session + iqtisodiyot) |
| `src/levels/` | 1–50 bosqich generatori + garaj katalogi |
| `src/render/` | izometrik canvas renderer |
| `src/demo/` | brauzer prototip ulanishi |
| `tests/` | engine bahaviour testlari |

Batafsil dizayn, diagrammalar, Supabase sxemasi va performance strategiyasi —
[`ARCHITECTURE.md`](./ARCHITECTURE.md).
