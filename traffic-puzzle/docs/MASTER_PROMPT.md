# MASTER PROMPT — "Chorraha Boshqaruvi" (Traffic Puzzle) v2

> Bu hujjat — loyiha ustida ishlash uchun o'zimga yozgan **ishchi prompt/spetsifikatsiya**.
> Har bir qaror, har bir fayl va har bir test shu hujjatdagi talablarga tayanadi.
> Pastdagi "Bajarish rejasi" bo'limidagi katakchalar ish borishi bilan belgilanadi.

---

## 1. Rol

Sen — **Senior Game Architect va Lead Developer**san. Vazifang: real yo'l harakati
qoidalariga (O'zbekiston YHQ / MDH PDD mantig'i) asoslangan, 2D izometrik,
"bosib boshqariladigan" chorraha boshqotirmasini **to'liq, ishlaydigan, testlangan**
holda qurish. Umumiy maslahat emas — **ishlaydigan kod, aniq algoritm, o'lchanadigan natija**.

## 2. Maqsad (o'yin falsafasi)

O'yinchi — chorrahadagi "ko'rinmas tartibga soluvchi". Ekranda izometrik chorraha,
har yo'nalishda navbatda turgan mashinalar. O'yinchi bosgan mashina harakatlanadi —
lekin faqat qoidaga mos bo'lsa. Qoidani buzsa: **YPX hushtagi**, mashinalar **qizil
miltillaydi**, o'yinchi **jon (yurakcha)** yo'qotadi. Maqsad: miya mashqi + qoidalarni
o'rgatish + tezkor qaror.

## 3. Muhit cheklovlari (qat'iy)

| Cheklov | Oqibati |
|---|---|
| npm registry yopiq (tarmoq yo'q) | **Nol runtime dependency**. Zustand, Supabase-js, Vite o'rnatib bo'lmaydi → Zustand-mos store, fetch asosidagi Supabase REST mijoz, `tsc` build. |
| Faqat TypeScript 7 + Node 22 | Testlar `node:test` (ichki) orqali, `dist/` ga qarshi. |
| Foydalanuvchi brauzerda | Natija **GitHub PR** orqali ko'rinadi; o'yin build qilingan holda (`dist/`) commit qilinadi, statik hostingda ishga tushadi. |
| Deno/Postgres yo'q | Supabase SQL va Edge Function yoziladi, typecheck qilinadi, lekin jonli loyihada ishga tushirilmagani **ochiq aytiladi**. |

## 4. Arxitektura qarorlari (o'zgarmas)

1. **Toza yadro (`src/core`)** — DOM/React/Flutter'dan mustaqil, faqat ma'lumot + toza funksiyalar.
   Bir xil kod: brauzer, React Native, Supabase Edge (anti-cheat replay).
2. **Deterministik simulyatsiya** — qat'iy 60 Hz tick, butun sonli vaqt. Bir xil tap-ketma-ketlik → bir xil natija.
3. **O'ng qo'l harakati geometriyasi** — kiruvchi bo'lak harakat yo'nalishining o'ng tomonida (+0.5 bo'lak).
4. **Yo'llar = namunalangan egri chiziqlar (arc-length)** — render va qoidalar **bir xil** traektoriyadan foydalanadi ("ko'rganing — hisoblangani").
5. **To'qnashuv zonalari oldindan hisoblanadi** — har bir manevr juftligi uchun (kesishish / qo'shilish), O(1) qidiruv.
6. **Qoidalar = ustuvorlik zinapoyasi + yo'l berish grafi** — Tarjan SCC bilan tiqilinch (deadlock) aniqlanadi va hal qilinadi.
7. **Fazo-vaqt (space-time) tekshiruvi** — chorrahani kesib o'tayotgan mashinalar bilan zonani bir vaqtda egallash = to'qnashuv.
8. **Simulyatsiya ≠ UI holati** — engine issiq (har tick) holatni, store sovuq (sessiya, garaj, sozlamalar) holatni saqlaydi.

## 5. Funksional talablar va qabul mezonlari

### R1 — Grid, yo'llar va harakat holat-mashinasi
- Holatlar: `hidden → queued → approaching → waiting → crossing → exiting → gone`.
- Mashina **faqat bosilganda** harakatlanadi; bosilgandan keyin to'xtamaydi (majburiyat).
- ✅ Qabul: har bir manevr (to'g'ri/chap/o'ng) uchun yo'l stop-chiziqdan boshlanadi, to'g'ri chiqish bo'lagiga tushadi; testda tekshiriladi.

### R2 — To'qnashuv aniqlash (geometriya)
- Qarama-qarshi to'g'ri harakatlar **to'qnashmaydi**; ikki o'ngga burilish **to'qnashmaydi**.
- Standart 4 tomonli chorraha jadvali: 16 kesishish + 12 qo'shilish juftligi (+ tabiiy yoy sababli qarama-qarshi chap burilishlar).
- ✅ Qabul: konflikt matritsasi test bilan standart jadvalga solishtiriladi.

### R3 — Qoidalar (Rule Validation Engine) — `canVehicleMove(vehicleId, state)`
Ustuvorlik tartibi (birinchi rad etgan g'olib):
0. Tayyorlik: faqat stop-chiziqdagi birinchi mashina (`waiting`). Aks holda — **jazosiz** "kut".
1. **Tartibga soluvchi (boss)** — haqiqiy ishoralar: qo'llar yonga / o'ng qo'l oldinga / qo'l tepaga; ko'krak, orqa, chap/o'ng yon.
2. **Svetofor** — yashil/yashil-miltillovchi ruxsat; sariq, qizil, qizil+sariq taqiq; sariq-miltillovchi → belgilar ishlaydi.
3. **Fazo-vaqt**: chorrahadagi (crossing) mashina bilan zona to'qnashuvi → jazo.
4. **Maxsus transport** (tez yordam, o't o'chirish) — doimiy ustunlik, svetofor/ishoraga bo'ysunmaydi.
5. **Aylanma** — halqadagilar ustun (fazo-vaqt orqali), kutayotganlar o'zaro tengsiz.
6. **Asosiy yo'l ◆ / Yo'l bering ▽ / STOP** — ikkinchi darajali yo'l asosiy yo'lga yo'l beradi.
7. **Teng yo'llar**: o'ng qo'l qoidasi + chapga burilayotgan qarshidan to'g'ri/o'ngga ketayotganga yo'l beradi.
8. **Tiqilinch**: yo'l berish grafida terminal sikl bo'lsa — sikl a'zosi o'tishi mumkin ("kelishib o'tish").
- ✅ Qabul: har bir qoida uchun alohida test ssenariysi.

### R4 — Jazo va jonlar
- Buzilish → `penalty` hodisasi, jon −1, aybdor + ustun mashinalar qizil miltillaydi, YPX hushtagi.
- 0 jon → bosqich yutqazildi.
- ✅ Qabul: engine testida jon kamayishi, lock, lost holati tekshiriladi.

### R5 — Navbat boshqaruvi
- Bir bo'lakda ketma-ket mashinalar; 2-mashinani bosish **hech narsa qilmaydi** (jazosiz) toki 1-chi ketmaguncha.
- Oldingi mashina ketganda keyingilar silliq (tezlanish/tormoz, masofa saqlash) oldinga siljiydi.
- Keyinroq keladigan mashinalar (`arrivals`) — tirbandlik uchun.

### R6 — Bosqichlar (1–50 + boss)
- 1–10: faqat X-chorraha, teng yo'llar, kam mashina, o'ng qo'l qoidasi o'rgatiladi.
- 11–30: asosiy/ikkinchi darajali yo'llar, bir yo'nalishda 2–3 mashina; 21+ svetofor.
- 31–50: aylanma harakat, keyin aralash "trassalar".
- 10, 20, 30, 40, 50: **BOSS** — markazda regulirovshik, juda yuqori tirbandlik.
- ✅ Qabul: 50 bosqichning hammasi validatsiyadan o'tadi va avtopilot (bot) jazosiz yechadi; par vaqti hisoblangan.

### R7 — Level data strukturasi
- JSON-mos `LevelDef` interfeysi + JSON Schema + runtime validator + muharrir (editor) ekrani.

### R8 — Iqtisod, garaj, tuning
- Tangalar: har bir mashina + bosqich bonusi + yulduz bonusi (qayta o'ynashda faqat yangi yulduzlar).
- Garaj: mahalliy modellar (Matiz, Nexia 3, Spark, Cobalt, Gentra, Damas, Tracker, Malibu), ranglar,
  tuning: ECU sport g'ildiraklar, spoyler, **metan ballon (bagajda)**, tonirovka, neon, taksi shashkasi, tomda gilam.
- O'yinchining mashinasi har bosqichda "qahramon" sifatida chiqadi (+bonus).

### R9 — Render va performance (20+ mashina, 60 fps)
- Statik sahna offscreen kesh, mashina spraytlari LRU kesh (heading bucket), painter's algorithm,
  interpolatsiya, DPR, yashirin tabda pauza, FPS/perf overlay, stress-test rejimi.

### R10 — Saqlash va Supabase
- localStorage (versiyalangan, migratsiya). Supabase: SQL (RLS, RPC), `submit-run` Edge Function
  (replay'ni shu yadro bilan qayta simulyatsiya), fetch asosidagi REST mijoz, offline navbat.

### R11 — Audio/UX
- WebAudio sintez: YPX hushtagi, sirena, tanga, signal (gudok), g'alaba/mag'lubiyat.
- Menyular: bosh menyu (fonda avtopilot chorraha), bosqichlar xaritasi, garaj, sozlamalar, qoidalar, muharrir.
- Yo'l-yo'riq: qoida kartalari, niyat (yo'nalish) strelkalari, burilish chiroqlari, maslahat (hint).

### R12 — Hujjat va sifat
- README, ARCHITECTURE, RULES, LEVEL_DESIGN, SUPABASE, REACT_NATIVE port qo'llanmasi.
- `npm test` = build + barcha testlar yashil. CI workflow.

## 6. Sifat mezonlari (Definition of Done)
- `tsc --strict` xatosiz.
- Barcha testlar yashil (geometriya, har bir qoida, engine, determinizm/replay, 50 bosqich).
- O'yin brauzerda ishga tushadi, konsolda xato yo'q (Playwright bilan tekshiriladi, skrinshot).
- Hujjatlarda nima tekshirilgan, nima tekshirilmagani (Supabase jonli) ochiq yozilgan.

## 7. Bajarish rejasi

- [x] 1. Master prompt (shu hujjat)
- [x] 2. Core geometriya: yo'nalishlar, o'ng qo'l bo'laklari, yo'llar (cross, cross-ctrl, T, aylanma), konflikt zonalari
- [x] 3. Core qoidalar: svetofor, regulirovshik, yo'l berish grafi, SCC, fazo-vaqt, `canVehicleMove`
- [x] 4. Core engine: 60 Hz, navbat kinematikasi, arrivals, jazo, ball, replay, bot, validator
- [x] 5. Core testlar
- [x] 6. Kontent: qo'lda + generator + 50 bosqich, garaj katalogi
- [x] 7. Web render
- [x] 8. Web ilova (ekranlar, audio, saqlash, store)
- [x] 9. Supabase (SQL, Edge Function, REST mijoz)
- [x] 10. Playwright bilan vizual tekshiruv
- [x] 11. Hujjatlar + CI
- [x] 12. Yakuniy build, test, commit, push, PR yangilash

## 8. Natija (tekshirilgan holat)

| Talab | Holat | Dalil |
|---|---|---|
| R1–R5 qoidalar, geometriya, navbat, jazo | ✅ | geometry, rules, engine testlari (40 test) |
| R6 50 bosqich + boss | ✅ | `tests/campaign.test.mjs`: hammasi validatsiya + avtopilot + replay |
| R7 level format + editor | ✅ | `levels/level.schema.json`, validator, muharrir ekrani |
| R8 iqtisod, garaj, tuning | ✅ | `tests/web.test.mjs`, brauzer e2e (xarid + o'rnatish) |
| R9 performance | ✅ | 24 mashina: 60 fps, render 0.27–0.39 ms (kesh bilan) — `npm run perf` |
| R10 saqlash + Supabase | ✅ / ⚠ | testlar (mock); **jonli Supabase loyihada ishga tushirilmagan** |
| R11 audio/UX | ✅ | brauzer e2e, 0 konsol xatosi, skrinshotlar `docs/screenshots/` |
| R12 hujjatlar + CI | ✅ | README, ARCHITECTURE, docs/*, `.github/workflows/traffic-puzzle.yml` |

