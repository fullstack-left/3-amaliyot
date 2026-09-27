# Supabase: bulutli saqlash va anti-cheat

O'yin **Supabase'siz ham to'liq ishlaydi** (localStorage). Supabase ulansa:

- progress va tangalar qurilmalar orasida sinxronlanadi;
- natijalar **serverda tekshiriladi**: klient "3 yulduz oldim" demaydi, faqat bosishlar ro'yxatini (replay) yuboradi. Server uni **o'sha o'yin yadrosi** bilan qayta o'ynaydi;
- xaridlar Postgres ichida atomik tarzda tekshiriladi.

## Arxitektura

```
O'yin (brauzer)                         Supabase
────────────────                        ─────────────────────────────────────────────
anonim kirish  ──POST /auth/v1/signup──▶ GoTrue (anonymous sign-ins)
bosqich tugadi ──POST /functions/v1/submit-run { levelId, replay }──▶ Edge Function
                                          1. GET /auth/v1/user   → kim yubordi
                                          2. verifyReplay()      → yadro bilan qayta simulyatsiya
                                          3. rpc apply_run(...)  → service role
                                             • advisory lock (user+level)
                                             • replay SHA-256 takrorini rad etish
                                             • mukofot (birinchi o'tish bonusi 1 marta)
                                             • eng yaxshi progress + tangalar
sinxronlash    ──GET /rest/v1/profiles, level_progress, garage_items──▶ RLS: faqat o'zinikini o'qish
xarid          ──POST /rest/v1/rpc/purchase_item──▶ SECURITY DEFINER, atomik tanga tekshiruvi
```

Klient progress va tangalarni **to'g'ridan-to'g'ri yoza olmaydi**: jadvallarda INSERT/UPDATE siyosatlari yo'q, yozish faqat SECURITY DEFINER funksiyalar orqali bo'ladi.

## Ulash (qadamma-qadam)

1. [supabase.com](https://supabase.com) da loyiha yarating.
2. **Anonymous sign-ins** ni yoqing: *Authentication → Sign In / Providers → Allow anonymous sign-ins*. Email kirish ham ishlaydi.
3. **Migratsiyani ishga tushiring.** Ikki usuldan biri:
   - SQL Editor'ga `supabase/migrations/20260927000000_init.sql` ni qo'yib, **Run** bosing;
   - yoki CLI bilan:
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
5. **O'yinda:** *Sozlamalar → Bulutli saqlash*. `Project URL` va `anon` (publishable) kalitni kiriting, **Saqlash**, keyin **Ulanish** bosing. Email/parol ixtiyoriy, bo'sh qoldirsangiz anonim kirish bo'ladi.

## Jadvallar

| Jadval | Mazmuni | Klient huquqi |
|---|---|---|
| `profiles` | tangalar, ism | o'zinikini o'qish, faqat `display_name` ni o'zgartirish |
| `level_progress` | bosqich bo'yicha eng yaxshi yulduz va vaqt | o'qish |
| `runs` | tasdiqlangan replay'lar (`replay_hash` unikal) | o'qish |
| `shop_catalog` | narxlar (`src/content/garage.ts` bilan bir xil — test tekshiradi) | hamma o'qiydi |
| `garage_items`, `garage_loadout` | sotib olinganlar, tanlangan mashina | o'qish; yozish `purchase_item` / `set_loadout` orqali |

Funksiyalar:

- `purchase_item(p_item_id)` — narxni tekshiradi, tanga yechadi, buyumni qo'shadi va yangi balansni qaytaradi.
- `set_loadout(...)` — faqat egalik qilingan buyumlarni tanlashga ruxsat beradi.
- `apply_run(...)` — faqat `service_role` chaqira oladi.
- `leaderboard(level, limit)` — ommaviy reyting.

## Sinxronlash qoidalari (offline-first)

- Tarmoq yo'q paytda tugatilgan bosqichlar navbatga yoziladi va keyingi sinxronda yuboriladi.
- Rad etilgan replay (4xx) tashlanadi. Tarmoq xatosi bo'lsa, replay navbatda qoladi.
- Tangalar va garaj **serverdagi holatga** tenglashadi. Yulduzlar va vaqtdan ikkala tomondagining **eng yaxshisi** olinadi.
- Ulangan paytda xaridlar faqat server orqali bo'ladi.

## Nima tekshirilgan va nima tekshirilmagan

| | Holat |
|---|---|
| REST mijozning so'rov formati (auth-js manbasidagi `signInAnonymously` / `token` so'rovlari bilan solishtirilgan) | ✅ testlar (mock fetch) |
| Sinxronlash mantiqi (yuborish / rad etish / navbatda qoldirish / birlashtirish) | ✅ testlar |
| Edge function oqimi: 401/405/400/404/413/422/409/500, soxta replay'lar DB'ga yetib bormasligi, `apply_run` parametrlari SQL imzosiga mosligi | ✅ testlar (mock GoTrue/PostgREST) |
| SQL katalog = TS katalog, RLS barcha jadvallarda, `apply_run` faqat `service_role` uchun | ✅ testlar (SQL matnini tekshiradi) |
| SQL migratsiyani **jonli Postgres'da** ishga tushirish, deploy qilingan function | ❌ **tekshirilmagan** — build muhitida tarmoq va Postgres yo'q edi. Birinchi ulanishda migratsiya xatolarini kuzating. |

## Qolgan xavflar

- Bot yordamida **haqiqiy** (lekin avtomatik) replay'lar yaratib tanga yig'ish mumkin. Bir xil replay ikki marta qabul qilinmaydi, ammo boshqacha vaqtlardagi replay'lar qabul qilinadi. Kerak bo'lsa `apply_run` ga soatiga cheklov (rate limit) qo'shing.
- Barcha narsalar kosmetik, shuning uchun o'yin muvozanatiga xavf yo'q.
