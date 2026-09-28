# Bosqich yaratish (Level design)

Bosqich — oddiy JSON (`LevelDef`, `src/core/types.ts`). IDE'da avto-to'ldirish uchun schema bor: `levels/level.schema.json`. Uni ishlatish uchun faylga `"$schema": "./level.schema.json"` qo'shing yoki VS Code'ning `json.schemas` sozlamasidan foydalaning. Runtime tekshiruvi `validateLevel()` orqali bo'ladi: xatolar o'zbekcha va aniq qatori bilan chiqadi.

## Format

```jsonc
{
  "id": 51,
  "name": "Mening chorraham",
  "band": "complex",              // base | complex | roundabout | boss
  "junction": "cross",            // cross (4 yo'l) | t (3 yo'l) | roundabout (3–4 yo'l)
  "arms": [
    {
      "dir": "N",                 // N | E | S | W
      "sign": "main",             // none | main (◆) | yield (▽) | stop
      "queue": [                  // boshlanishda turgan mashinalar, stop-chiziqdagisi birinchi
        { "kind": "car", "turn": "straight" },
        { "kind": "bus", "turn": "right" }
      ],
      "arrivals": [               // keyinroq keladiganlar (tirbandlik)
        { "kind": "ambulance", "turn": "left", "atMs": 8000 }
      ]
    },
    { "dir": "E", "sign": "yield", "queue": [{ "kind": "taxi", "turn": "left" }] },
    { "dir": "S", "sign": "main",  "queue": [{ "kind": "car", "turn": "straight", "hero": true }] },
    { "dir": "W", "sign": "yield", "queue": [] }
  ],
  "lives": 3,
  "ambience": "night",            // day | evening | night | rain (faqat ko'rinish, qoidalar o'zgarmaydi)
  "intro": { "title": "Sarlavha", "text": "Bosqich boshida chiqadigan tushuntirish" },
  "tip": "Jarimadan keyin / pauzada ko'rsatiladigan maslahat",
  "coach": [                      // ixtiyoriy: yordamchi qo'l qadamlari (1–12 ta)
    { "vehicle": "E0", "text": "Sharqdan kelayotganning o'ngi bo'sh — uni bosing!" },
    { "vehicle": "S0", "text": "Endi janubdagi mashina o'tadi." }
  ]
}
```

**Mashina id'lari** (`coach` uchun): yo'l harfi + tartib raqami — avval `queue` dagilar (stop-chiziqdagisi `…0`), keyin `arrivals` kelish vaqti bo'yicha. Masalan `S0`, `S1`, keyin `S2` — janubdan birinchi keladigan. Validator id'ni tekshiradi; test esa har bir qadam o'sha paytda **qonuniy yurish** ekanini isbotlaydi.

**Mashina turlari:** `car`, `taxi`, `bus`, `truck`, `police` (sirenasiz — oddiy qoidalar), `ambulance`, `fire` (maxsus transport).

**Yo'nalish (`turn`)** mashina kelayotgan tomonga nisbatan: `straight`, `left`, `right`.

### Svetofor

```json
"signals": {
  "phases": [{ "green": ["N", "S"], "ms": 7000 }, { "green": ["E", "W"], "ms": 7000 }],
  "amberMs": 2000, "allRedMs": 1000, "offsetMs": 0,
  "flashing": [{ "fromMs": 0, "toMs": 14000 }]
}
```

- Har bir yo'l **aynan bitta** fazada yashil bo'ladi.
- `flashing` oraliqlarida svetofor sariq miltillaydi va boshqarmaydi, shunda belgilar (`sign`) ishlaydi.

### Regulirovshik (faqat `cross`)

```json
"controller": { "poses": [
  { "gesture": "right_forward", "facing": "S", "ms": 5000 },
  { "gesture": "arm_up",        "facing": "S", "ms": 1200 },
  { "gesture": "arms_side",     "facing": "N", "ms": 5000 }
] }
```

`facing` — ko'krak qaragan yo'l. Ishoralar jadvali `docs/RULES.md` da. Pozalar tsikl bo'yicha takrorlanadi.

## Validator nimalarni tekshiradi

- Yo'llar soni turga mos: cross — 4, t — 3, aylanma — 3–4. Yo'llar takrorlanmaydi.
- Har bir mashinaning chiqish yo'li mavjud (T-chorrahada yo'q tomonga burilib bo'lmaydi).
- Navbat yo'lga sig'adi: bir yo'lda ko'pi bilan 7 ta mashina.
- Aylanmada svetofor va regulirovshik bo'lmaydi, belgilar e'tiborsiz qoldiriladi (ogohlantirish chiqadi).
- `signals` va `controller` birga bo'lmaydi.
- Regulirovshik darajasida har bir oddiy mashinaning harakatiga **kamida bitta poza** ruxsat beradi, aks holda bosqichni yechib bo'lmaydi.

Validator yechilishni kafolatlamaydi. Buni **avtopilot** tekshiradi: `autoplay(level)` faqat qonuniy yurishlar qiladi va bosqichni jazosiz tugatishi kerak.

## Uch xil yo'l bilan bosqich qo'shish

1. **O'yin ichidagi muharrir** (Menyu → Level muharriri):
   - **Umumiy:** nom, tur (X / T / aylanma), yo'q yo'l, muhit, jonlar; **Namuna** — istalgan kampaniya bosqichini to'liq ochib, uni o'zgartirish.
   - **Tartibga solish:** svetofor (2 fazali / har yo'lga alohida / doim sariq miltillovchi), har faza yashil vaqti, sariq, "hammasi qizil", siljish (offset), vaqtincha o'chish oralig'i; yoki regulirovshik — BOSS 1–5 yoki **o'zingiz yozgan** ishoralar ketma-ketligi (ishora, ko'krak tomoni, soniya).
   - **Yo'llar:** belgi, navbatdagilar va **keyin keladiganlar** (kelish vaqti soniyada), har bir mashina — tur, yo'nalish, "mening mashinam" (garajdagi mashina, +5 tanga).
   - **Matnlar:** kirish sarlavhasi/matni va maslahat.
   - O'ngdagi **jonli ko'rinish**da avtopilot bosqichni to'xtovsiz o'ynab ko'rsatadi (xato bo'lsa — birinchi xato yoziladi).
   - **Tekshirish** (validator + avtopilot + par vaqti), **Sinab ko'rish**, **Havolani nusxalash**, **JSON eksport**, **Import (JSON / havola)**. Qoralama brauzerda saqlanadi (`chorraha.editor.v1`, eski qoralamalar avtomatik yangilanadi).
2. **Qo'lda** — `src/content/handmade.ts` ga `LevelDef` qo'shing. Qisqa yozuv uchun `armOf('S', ['car:s', 'bus:r'], 'main')` yordamchisi bor. Har bir yangi qoidani alohida, bitta g'oyali bosqichda o'rgating va `intro` yozing.
3. **Generator** — `src/content/generator.ts` dagi `CURRICULUM` ga spetsifikatsiya qo'shing: tur, belgilar/svetofor, navbat uzunligi, arrivals, maxsus transport soni, `minBlocked`. Generator 24 ta deterministik seed sinaydi va eng "qiziqarli" variantni tanlaydi. Nomzod validatsiyadan o'tishi va avtopilot uni jazosiz yechishi shart.

Keyin:

```bash
npm run campaign   # 50 bosqichni muzlatadi: src/content/campaign.data.ts + levels/campaign.json, har biriga parMs
npm test           # 50 bosqich validatsiya + avtopilot + replay tekshiruvi
```

`campaign.data.ts` avtomatik yaratiladi — uni qo'lda tahrirlamang. Generator deterministik: bir xil spetsifikatsiya har doim bir xil bosqich beradi.

## Havola orqali ulashish

Bosqich havolasi: `…/traffic-puzzle/#/custom/L1.<kod>`, bu yerda kod = `base64url(UTF-8(kanonik JSON))`. Kanonik shakl — kalitlar tartibi qat'iy, standart qiymatlar va hosila maydonlar (`parMs`, `tags`) tashlangan, `arrivals` vaqt bo'yicha saralangan. Shuning uchun bir xil bosqich har doim bir xil havola beradi va `encode(decode(kod)) === kod` (test). Havolani ochgan odamda bosqich **o'sha validator** bilan tekshiriladi (ishonchsiz kirish sifatida), keyin o'ynaladi. Havola uzunligi ko'pi bilan 8000 belgi.

## Dizayn bo'yicha maslahatlar

- **Bitta bosqich — bitta g'oya.** O'rgatuvchi bosqichda 2–4 mashina yetarli. Qolganini generator murakkablashtiradi.
- **Tuzoq qo'ying:** "bo'sh ko'ringan" mashina aslida kimgadir yo'l berishi kerak bo'lsin (masalan, o'ngida mashina turibdi).
- **Maxsus transportni `arrivals` bilan** kechroq yuboring. O'yinchi rejasini buzadi va sirena ovozi e'tiborni tortadi.
- Boss darajalarida pozalar orasiga `arm_up` (1–1.5 s) qo'ying, shunda chorraha bo'shashga ulguradi.
- **Tun va yomg'ir** qiyinroq ko'rinadi — ularni o'yinchi qoidani bilgan bosqichlarda ishlating (kampaniyada 27 kunduz, 9 kechqurun, 8 yomg'ir, 6 tun).
- **Yordamchi qadamlari** qisqa bo'lsin: nimani bosish va **nega** (qaysi qoida). Oxirgi qadamdan keyin o'yinchi o'zi davom etadi.
