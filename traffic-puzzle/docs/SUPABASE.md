# Supabase: bulutli saqlash va anti-cheat

O'yin **Supabase'siz ham to'liq ishlaydi** (localStorage). Supabase ulansa:

- progress va tangalar qurilmalar orasida sinxronlanadi;
- natijalar **serverda tekshiriladi**: klient "3 yulduz oldim" demaydi, faqat bosishlar ro'yxatini (replay) yuboradi. Server uni **o'sha o'yin yadrosi** bilan qayta o'ynaydi;
- **kunlik chorraha** natijalari ham tekshiriladi: server kunlik bosqichni id'sidan **o'zi qayta yaratadi** (o'sha deterministik generator);
- natija oynasida **reyting** (TOP-5 va o'z o'rningiz) chiqadi, ism sozlamalarda o'zgartiriladi;
- xaridlar Postgres ichida atomik tarzda tekshiriladi.

Cheksiz rejim serverga yuborilmaydi (tanga bermaydi, rekordlar mahalliy).

## Arxitektura

```
O'yin (brauzer)                         Supabase
────────────────                        ─────────────────────────────────────────────
anonim kirish  ──POST /auth/v1/signup──▶ GoTrue (anonymous sign-ins)
bosqich tugadi ──POST /functions/v1/submit-run { levelId, replay }──▶ Edge Function
                                          1. GET /auth/v1/user   → kim yubordi
                                          2. resolveLevel(id)    → kampaniya bosqichi yoki kunlik
                                             bosqichni id'dan qayta yaratish (faqat ruxsat oynasida)
                                          3. verifyReplay()      → yadro bilan qayta simulyatsiya
                                          4. rpc apply_run(...)  → service role
                                             • advisory lock (user+level)
                                             • replay SHA-256 takrorini rad etish
                                             • mukofot (birinchi o'tish bonusi 1 marta)
                                             • eng yaxshi progress + tangalar
sinxronlash    ──GET /rest/v1/profiles, level_progress, garage_items──▶ RLS: faqat o'zinikini o'qish
xarid          ──POST /rest/v1/rpc/purchase_item──▶ SECURITY DEFINER, atomik tanga tekshiruvi
reyting        ──POST /rest/v1/rpc/leaderboard, my_rank──▶ SECURITY DEFINER, faqat ism + natija
ism            ──PATCH /rest/v1/profiles?id=eq.<uid> { display_name }──▶ RLS + ustun darajasidagi ruxsat
```

Klient progress va tangalarni **to'g'ridan-to'g'ri yoza olmaydi**: jadvallarda INSERT/UPDATE siyosatlari yo'q, yozish faqat SECURITY DEFINER funksiyalar orqali bo'ladi.

## Ulash (qadamma-qadam)

1. [supabase.com](https://supabase.com) da loyiha yarating.
2. **Anonymous sign-ins** ni yoqing: *Authentication → Sign In / Providers → Allow anonymous sign-ins*. Email kirish ham ishlaydi.
3. **Migratsiyalarni ishga tushiring** (tartib bilan: avval `20260927000000_init.sql`, keyin `20260928000000_v3.sql`). Ikki usuldan biri:
   - SQL Editor'ga har birini navbat bilan qo'yib, **Run** bosing;
   - yoki CLI bilan (ikkalasini ham o'zi qo'llaydi):
     ```bash
     supabase link --project-ref <REF>
     supabase db push
     ```
4. **Edge function'ni deploy qiling:**
   ```bash
   cd traffic-puzzle
   npm run build:edge                      # yadro → supabase/functions/_shared/chorraha
   supabase functions deploy submit-run
   ```
   `SUPABASE_URL`, `SUPABASE_ANON_KEY` va `SUPABASE_SERVICE_ROLE_KEY` platforma tomonidan beriladi. Loyihangizda yangi API kalitlari tizimi yoqilgan bo'lsa, ularning nomlarini dashboard'dagi *Edge Functions → Secrets* bo'limida tekshiring.
5. **O'yinda:** *Sozlamalar → Bulutli saqlash*. `Project URL` va `anon` (publishable) kalitni kiriting, **Saqlash**, keyin **Ulanish** bosing. Email/parol ixtiyoriy, bo'sh qoldirsangiz anonim kirish bo'ladi. *Sozlamalar → Profil* da reyting uchun ism kiriting (2–24 belgi).

## Jadvallar

| Jadval | Mazmuni | Klient huquqi |
|---|---|---|
| `profiles` | tangalar, ism | o'zinikini o'qish, faqat `display_name` ni o'zgartirish |
| `level_progress` | bosqich bo'yicha eng yaxshi yulduz va vaqt: kampaniya `1..1000`, kunlik `100000 + kun` (kun = 2026-01-01 dan beri) | o'qish |
| `runs` | tasdiqlangan replay'lar (`replay_hash` unikal) | o'qish |
| `shop_catalog` | narxlar (`src/content/garage.ts` bilan bir xil — test tekshiradi) | hamma o'qiydi |
| `garage_items`, `garage_loadout` | sotib olinganlar, tanlangan mashina | o'qish; yozish `purchase_item` / `set_loadout` orqali |

Funksiyalar:

- `purchase_item(p_item_id)` — narxni tekshiradi, tanga yechadi, buyumni qo'shadi va yangi balansni qaytaradi.
- `set_loadout(...)` — faqat egalik qilingan buyumlarni tanlashga ruxsat beradi.
- `apply_run(...)` — faqat `service_role` chaqira oladi.
- `leaderboard(level, limit)` — ommaviy reyting (ko'pi bilan 100 qator); v3 da `is_me` ustuni chaqiruvchining o'z qatorini belgilaydi.
- `my_rank(level)` — (v3) kirgan foydalanuvchining o'rni va jami o'yinchilar soni, TOP'dan tashqarida bo'lsa ham.

**Kunlik bosqichlar oynasi.** Server kunlik id'ni faqat UTC bo'yicha `bugun − 7 … bugun + 1` oralig'ida qabul qiladi: +1 va −1 — vaqt mintaqalari (o'yinchining "bugun"i mahalliy sana), qolgan 6 kun — o'yindagi arxiv (oxirgi 6 kunning bosqichlari havola orqali o'ynaladi). Boshqa kunlar `404 unknown_level`. Bir kunning replay'ini boshqa kun uchun yuborish `422` — bosqich boshqacha, replay mos kelmaydi.

## Sinxronlash qoidalari (offline-first)

- Tarmoq yo'q paytda tugatilgan bosqichlar navbatga yoziladi va keyingi sinxronda yuboriladi.
- Rad etilgan replay (4xx) tashlanadi. Tarmoq xatosi bo'lsa, replay navbatda qoladi.
- Tangalar va garaj **serverdagi holatga** tenglashadi. Yulduzlar va vaqtdan ikkala tomondagining **eng yaxshisi** olinadi.
- Ulangan paytda xaridlar faqat server orqali bo'ladi.
- Bir vaqtda faqat bitta sinxronlash ishlaydi; shu paytda kelgan so'rovlar undan keyin yana bir marta bajariladi. Sinxron davomida tugatilgan bosqichlar navbatdan **yo'qolmaydi** (v3 da tuzatilgan xato, regressiya testi bor).
- Reyting sinxron tugagach o'qiladi — yangi natijangiz reytingda bo'ladi.

## Nima tekshirilgan va nima tekshirilmagan

| | Holat |
|---|---|
| REST mijozning so'rov formati (auth-js manbasidagi `signInAnonymously` / `token` so'rovlari bilan solishtirilgan) | ✅ testlar (mock fetch) |
| Sinxronlash mantiqi (yuborish / rad etish / navbatda qoldirish / birlashtirish) | ✅ testlar |
| Edge function oqimi: 401/405/400/404/413/422/409/500, soxta replay'lar DB'ga yetib bormasligi, `apply_run` parametrlari SQL imzosiga mosligi | ✅ testlar (mock GoTrue/PostgREST) |
| SQL katalog = TS katalog, RLS barcha jadvallarda, `apply_run` faqat `service_role` uchun | ✅ testlar (SQL matnini tekshiradi) |
| v3: kunlik oynasi, kunlik replay serverda qayta yaratilgan bosqichga qarshi tekshirilishi, boshqa kunning replay'i rad etilishi, migratsiya 2 (id oralig'i, `is_me`, `my_rank` huquqlari), reyting/ism so'rovlari formati, sinxron poygasi | ✅ testlar (mock) |
| SQL migratsiyalarni **jonli Postgres'da** ishga tushirish, deploy qilingan function, haqiqiy reyting | ❌ **tekshirilmagan** — build muhitida tarmoq va Postgres yo'q edi. Birinchi ulanishda migratsiya xatolarini kuzating. |

## Qolgan xavflar

- Bot yordamida **haqiqiy** (lekin avtomatik) replay'lar yaratib tanga yig'ish mumkin. Bir xil replay ikki marta qabul qilinmaydi, ammo boshqacha vaqtlardagi replay'lar qabul qilinadi. Kerak bo'lsa `apply_run` ga soatiga cheklov (rate limit) qo'shing.
- Kunlik oyna tufayli bir o'yinchi haftasiga ko'pi bilan ~9 ta kunlik bosqich uchun tanga oladi — cheklangan.
- Kunlik bosqichni server birinchi marta yaratganda generator + avtopilot ishlaydi (bir necha yuz ms); natija edge instansiyasida keshlanadi.
- Barcha narsalar kosmetik, shuning uchun o'yin muvozanatiga xavf yo'q.
