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



---

# v3 — REJA: funksionallik, chiroylilik, aniqlik

> v2 tahlilidan keyingi reja. Maqsad: o'yinni "ishlaydigan prototip"dan **qayta-qayta o'ynaladigan, chiroyli va tushunarli** mahsulotga aylantirish.
> Har bir band — o'lchanadigan qabul mezoni bilan.

## 9. v2 tahlili: topilgan kamchiliklar

| # | Kamchilik | Qayerda | Oqibati |
|---|---|---|---|
| K1 | Kamera yo'llarni kvadrat deb hisoblaydi (`width / 4R`), aslida yo'llar faqat o'qlar bo'ylab cho'ziladi | `render/camera.ts` | Mobilda chorraha ~1.6× kichik, ekranning yarmi bo'sh maysa |
| K2 | Mashinaning niyati (yo'nalishi) va qaysi biri bosiladigani deyarli ko'rinmaydi | renderer | O'yinchi taxmin qiladi, "aniqlik" past |
| K3 | "Nega mumkin emas?" faqat jarimadan KEYIN tushuntiriladi | play | O'rganish sekin |
| K4 | Faqat kunduzgi sahna, fon siyrak, atmosfera yo'q | `render/scene.ts` | Vizual jihatdan bir xil |
| K5 | 50 bosqich tugagach o'ynashga sabab yo'q (kunlik/cheksiz rejim, yutuqlar yo'q) | — | Qayta o'ynash yo'q |
| K6 | O'yinchi qaysi qoidada ko'p xato qilishini bilmaydi | — | O'quv qiymati yo'qoladi |
| K7 | Muharrirda `arrivals`, svetofor vaqtlari, regulirovshik pozalari tahrirlanmaydi; ko'rinish (preview) yo'q | `screens/editor.ts` | "Oson level yaratish" to'liq emas |
| K8 | URL marshrutlash yo'q (orqaga tugmasi, havola, yangilash ekranni yo'qotadi); offlayn/o'rnatish yo'q | web | Mobil tajriba zaif |
| K9 | Tanga ikonkasi "!"ga, "Qoidalar" ikonkasi telefonga o'xshaydi; shrift tizimga bog'liq | `icons.ts`, CSS | Sifatsiz ko'rinish |
| K10 | Reyting SQL'da bor, lekin UI'da yo'q; kunlik rejim server tomonidan tekshirilmaydi | Supabase | Bulut funksiyasi yarim |

## 10. v3 talablari

### R13 — Aniq kamera (K1)
- Kamera bosqich mazmuniga moslashadi: eng uzun navbat + yo'l uzunligi → `scale = min(W / (2·extent), H / (extent + balandlik))`.
- ✅ Qabul: 390×844 mobil ekranda masshtab ≥ 30 px/birlik (v2: 21).

### R14 — Tushunarlilik (K2, K3)
- Oldingi mashinalar tepasida **niyat belgisi** (↑ ↰ ↱, maxsus transport — xoch).
- **"Nega?" izohi:** sichqoncha ustida yoki uzoq bosishda ko'rsatiladi — qoida nomi va ustun mashinalarga chiziq.
- **Murabbiy (coach):** 1–3-bosqichlarda "qo'l" to'g'ri mashinani ko'rsatadi, izoh esa mashina bo'yicha yoziladi.
- **Sabr pufakchasi:** uzoq kutgan mashina ustida "…", keyin signal chaladi (kosmetik).
- ✅ Qabul: coach matnlari validator bilan tekshiriladi, e2e da qo'l to'g'ri mashina ustida.

### R15 — Atmosfera va vizual boylik (K4, K9)
- `ambience`: kunduz / kechqurun / tun / yomg'ir. Tunda mashina faralari, stop-chiroqlari, fonar yorug'ligi va yonib turgan derazalar bo'ladi; yomg'irda tomchilar va ho'l asfalt.
- Fon: panel uylar (balkonlari bilan), minorali masjid, do'konlar qatori, fonarlar, bekat; yo'lda yo'nalish strelkalari, lyuklar va asfalt teksturasi.
- Effektlar: chiqish tutuni, tanga uchqunlari, jarimada ekran silkinishi, g'alabada konfetti; hammasi "Effektlar" sozlamasi va `prefers-reduced-motion` ga bo'ysunadi.
- Roboto shrifti ilova bilan birga keladi; tanga va kitob ikonkalari qayta chiziladi.
- ✅ Qabul: 24 mashina tunda + yomg'irda ham 60 fps (headless), render < 2 ms/kadr.

### R16 — Yangi rejimlar (K5)
- **Kunlik chorraha:** sanadan deterministik generatsiya qilinadi; haftaning har kuni o'z mavzusiga ega; ketma-ketlik (streak) hisoblanadi; server ham tekshira oladi (id = 100000 + kun raqami).
- **Cheksiz tirbandlik:** oqim tobora zichlashadi; navbat 8 tadan oshsa — "tirbandlik" (game over); rekord saqlanadi. 3 variant: X-chorraha, svetofor, aylanma.
- ✅ Qabul: 14 ketma-ket kunning har biri validatsiyadan o'tadi va avtopilot uni jazosiz yechadi. Cheksiz rejimda hech narsa bosilmasa, tirbandlik bilan tugaydi.

### R17 — Yutuqlar va statistika (K6)
- 18 ta yutuq. Mukofot — eksklyuziv kosmetika: oltin rang, tungi ko'k rang, O'zbekiston bayroqchasi. Tangalar server bilan ziddiyatga kirmasligi uchun tanga berilmaydi.
- Statistika: aniqlik %, qoida bo'yicha xatolar diagrammasi, **"zaif joy"** va shu qoidani o'rgatuvchi bosqichga "Mashq qilish" tugmasi.
- ✅ Qabul: yutuq baholash — toza funksiya, testlangan.

### R18 — Boshqaruv va UX (K8)
- Hash-marshrutlash: `#/levels`, `#/play/12`, `#/daily`, `#/endless/cross`, `#/custom/<level>`. Orqaga tugmasi va sahifani yangilash ishlaydi.
- Klaviatura: `1–4` — yo'l bo'yicha oldingi mashina, `F` — 2× tezlik, `M` — ovoz, `H`, `R`, `P`. HUD'da 2× va ovoz tugmalari.
- Natija oynasi: yulduzlar animatsiyasi, tangalarning sanab ko'rsatilishi, "Yangi rekord!", ulashish tugmasi.
- **PWA:** manifest, service worker (offlayn), ikonkalar, "Ilovani o'rnatish".
- ✅ Qabul: e2e — offlayn holatda sahifa yangilansa ham o'yin ochiladi; orqaga tugmasi ishlaydi.

### R19 — Muharrir v2 (K7)
- `arrivals`, svetofor fazalari va vaqtlari, regulirovshik pozalarini tahrirlash, atmosfera tanlovi.
- Jonli ko'rinish (preview canvas).
- **Havola orqali ulashish:** level URL ichida keladi, ochgan odam uni o'ynaydi.
- ✅ Qabul: encode → decode natijasi aynan bir xil (test); e2e da havola ochiladi va o'ynaladi.

### R20 — Supabase v3 (K10)
- Migratsiya 2: kunlik id'lar, `leaderboard` qaytaradigan `is_me` ustuni.
- Edge function kunlik levelni o'zi generatsiya qilib tekshiradi (±1 kun oynasi).
- UI: natija oynasida reyting (TOP-5), sozlamalarda ism.
- ✅ Qabul: mock testlar — kunlik bosqich qabul/rad etilishi, reyting va ism so'rovlari formati.

### R21 — Sifat
- Barcha yangi toza mantiq testlanadi; umumiy testlar ≥ 90 ta, hammasi yashil.
- e2e yangilanadi, skrinshotlar yangilanadi, konsolda 0 ta xato. Hujjatlar va CI yangilanadi.

## 11. v3 bajarish rejasi

- [ ] 13. Reja (shu bo'lim)
- [ ] 14. Core: `ambience`, `coach`, `maxVehicles`, tirbandlik (overflow), `endReason`, `waitSince` + testlar
- [ ] 15. Kontent: kunlik va cheksiz generatorlar, yutuqlar, mashq xaritasi, eksklyuziv kosmetika, kampaniyaga atmosfera + coach + testlar
- [ ] 16. Saqlash v2 + app store: rejimlar, statistika, yutuqlar, streak, marshrutlash + testlar
- [ ] 17. Render v3: kamera, sahna (binolar, detallar, atmosfera), fonarlar, faralar, yomg'ir, zarrachalar, niyat belgilari, izoh chiziqlari, silkinish
- [ ] 18. Ekranlar: play v3, menyu v3, bosqichlar, statistika, yutuqlar, cheksiz, garaj, sozlamalar
- [ ] 19. Muharrir v2 + havola orqali ulashish
- [ ] 20. Shrift, ikonkalar, PWA (manifest, SW, ikonkalar), marshrutlash
- [ ] 21. Supabase v3 (migratsiya, edge function, reyting UI) + testlar
- [ ] 22. e2e + perf + skrinshotlar, hujjatlar, CI, commit, push, PR
