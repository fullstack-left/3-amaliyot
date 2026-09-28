# O'yin qoidalari va ularning ustuvorligi

O'yin mashina bosilgan paytda **`canVehicleMove()`** funksiyasi orqali tekshiriladi (`src/core/rules.ts`). Tekshiruv quyidagi tartibda boradi: birinchi buzilgan qoida natijani belgilaydi.

| # | Tekshiruv | Natija | Sabab kodi |
|---|---|---|---|
| 0 | Mashina stop-chiziqda turgan **birinchi** mashinami? | Yo'q bo'lsa — hech narsa bo'lmaydi (jazo yo'q) | `not_front`, `not_ready`, `locked` |
| 1 | **Regulirovshik** ishorasi / **svetofor** ruxsat beradimi? (maxsus transportga bu shart emas) | Jarima | `controller`, `red_light` |
| 2 | Chorrahani kesib o'tayotgan mashina bilan **zona bir vaqtda** egallanadimi? | Jarima ("to'qnashuv xavfi") | `crossing_traffic`, `roundabout_ring` |
| 3 | Stop-chiziqlarda turganlar orasida kimga **yo'l berish** kerak? | Jarima | `emergency`, `main_road`, `right_hand`, `left_turn` |

**Muhim:** mashina faqat **traektoriyasi haqiqatan kesishadigan** (yoki bir bo'lakka qo'shiladigan) mashinaga yo'l beradi. Masalan, qarama-qarshi to'g'ri ketayotganlar yoki ikkita o'ngga buriluvchi bir-biriga xalaqit bermaydi.

---

## 1. Teng ahamiyatli yo'llar (1–10-bosqichlar)

- **O'ng qo'l qoidasi.** O'ng tomondan yaqinlashayotgan mashinaga yo'l beriladi. Janubdan kelayotgan mashinaning (shimolga yuradi) o'ng tomoni — sharq.
- **Chapga burilish.** Chapga burilayotgan mashina qarshidan to'g'riga yoki o'ngga ketayotganga yo'l beradi.
- **Tiqilinch.** To'rt mashina bir-birining o'ngida tursa, hech kim ustun emas. O'yin buni yo'l berish grafidagi terminal sikl sifatida aniqlaydi (Tarjan SCC). Bunday holatda sikldagi istalgan mashina o'ta oladi ("kelishib o'tish"), zanjir o'z-o'zidan yechiladi. *8-bosqich.*

## 2. Ustuvorlik belgilari (11–30-bosqichlar)

| Belgi | Ma'nosi |
|---|---|
| ◆ sariq romb | **Asosiy yo'l** — shu yo'ldagilar ustun |
| ▽ uchburchak | **Yo'l bering** — asosiy yo'ldagilarni o'tkazib yuboring |
| STOP | "Yo'l bering" kabi (mashina baribir stop-chiziqda turadi) |

- Belgilar **o'ng qo'l qoidasidan ustun**.
- Bir xil darajadagi mashinalar o'rtasida (masalan, ikkalasi ham asosiy yo'lda) teng yo'l qoidalari amal qiladi: o'ng qo'l + chapga burilish. *12-bosqich.*

## 3. Svetofor (21-bosqichdan)

| Chiroq | Harakat |
|---|---|
| Yashil / yashil-miltillovchi | Mumkin (miltillasa — tez orada sariq yonadi) |
| Sariq, qizil, qizil+sariq | **Taqiqlangan** — bossangiz jarima |
| Sariq-miltillovchi | Svetofor ishlamayapti — **belgilarga** amal qiling (*24, 27, 42-bosqichlar*) |

- Yashilda chapga burilayotgan mashina qarshidagi (u ham yashilda) to'g'riga va o'ngga ketayotganga yo'l beradi. *22-bosqich.*
- Chiroq yonidagi raqam — joriy rang necha soniya qolganini ko'rsatadi.

## 4. Maxsus transport

- Sirenali **tez yordam** va **o't o'chirish** mashinalari hammadan ustun. Ular svetofor va regulirovshikka bo'ysunmasligi mumkin. Siz yashil chiroqda turgan bo'lsangiz ham, traektoriyasi kesishsa, ularga yo'l bering. *5, 16, 23-bosqichlar.*
- **YPX mashinasi sirenasiz** bo'lsa — oddiy mashina kabi.

## 5. Aylanma harakat (31–50-bosqichlar)

- Halqada harakatlanayotgan mashina **ustun**. Kirmoqchi bo'lgan mashina halqadagi mashina uning kirish joyidan o'tib ketishini kutadi.
- Kirishda kutayotganlar o'zaro teng: kim birinchi kirsa, keyingilar unga yo'l beradi.
- Aniq qoida: kirayotgan mashina qo'shilish zonasini halqadagi mashina bilan bir vaqtda egallasa — jarima. Yetarlicha katta "oyna" bo'lsa — ruxsat.

## 6. Regulirovshik (boss: 10, 20, 30, 40, 50)

Regulirovshik **svetofor va belgilardan ustun**. Uning ko'kragi qaragan tomon yerdagi oq uchburchak bilan ko'rsatilgan.

| Ishora | Chap va o'ng yonidan | Ko'kragi tomonidan | Orqasi tomonidan |
|---|---|---|---|
| **Qo'llar yonga** (yoki pastga) | to'g'riga va o'ngga ✅, chapga ❌ | ❌ | ❌ |
| **O'ng qo'l oldinga** | chap yonidan: **hammasi** ✅; o'ng yonidan: ❌ | faqat o'ngga ✅ | ❌ |
| **Qo'l tepaga** | ❌ | ❌ | ❌ |

- Ishora almashganda, chorrahada qolgan mashinalar harakatini yakunlaydi. Yangi ruxsat olganlar ularga yo'l beradi (2-tekshiruv).
- 10-bosqichda va sozlamalardagi "Oson rejim" yoqilganda ishora matn va yashil/qizil belgilar bilan tushuntiriladi.

## 7. Jazo, jonlar, yulduzlar

- Buzilish: **YPX hushtagi**, aybdor mashina qizil miltillab "tortiladi", ustunlikka ega mashinalar sariq halqa bilan ko'rsatiladi, **1 jon** kamayadi. Jon tugasa — bosqich yutqaziladi.
- ★ bosqich o'tildi · ★ xatosiz · ★ tez (par vaqtidan tez; par = avtopilot vaqti × 1.25 + 2.5 s).
- Tangalar: har bir mashina (hamda o'z mashinangiz uchun +5), birinchi o'tishda bosqich bonusi, har bir **yangi** yulduz uchun +10. Yutqazilgan urinish tanga bermaydi.

## 8. O'yin qoidani qanday tushuntiradi

| Yordam | Qachon | Nima ko'rsatadi |
|---|---|---|
| **Yo'nalish belgisi** | doim, oldingi mashinalar tepasida | ↑ to'g'riga, ↰ chapga, ↱ o'ngga; "Klaviatura raqamlari" yoqilsa — 1–4 tugmasi |
| **"Nega?" izohi** | sichqoncha mashina ustida / telefonda 0.45 s uzoq bosish (sozlamalar: "Oldindan ko'rsatish") | Yashil — o'tishi mumkin; qizil — qaysi qoida taqiqlaydi va kimga yo'l berish kerak (sariq halqa + uzuq chiziq). Bu aynan jarimani hisoblaydigan `canVehicleMove()` natijasi |
| **Yordamchi qo'l** | 1, 2, 3, 5, 11, 21, 31-bosqichlar, birinchi o'tishgacha | Qaysi mashinani bosish kerakligini ko'rsatadi va nega shunday ekanini yozadi; mashina o'tgach keyingi qadam |
| **Maslahat (`H`)** | istalgan payt | Hozir qonuniy o'ta oladigan mashinani yashil halqa bilan belgilaydi (statistikada hisoblanadi) |
| **Sabr pufakchasi** | mashina 8 s kutsa "…", 14 s kutsa "!" va signal | Faqat bezak: qoidalarga ta'sir qilmaydi, lekin tirbandlikni sezdiradi |
| **Mashq qilish** | natija oynasi (yutqazganda) va Statistika | Eng ko'p buzilgan qoida → uni o'rgatuvchi bosqich: o'ng qo'l — 1, chapga burilish — 3, to'qnashuv xavfi — 4, maxsus transport — 5, regulirovshik — 10, asosiy yo'l — 11, svetofor — 21, aylanma — 31 |

## 9. Rejimlar va atmosfera

- **Kunlik chorraha** — qoidalar kampaniyadagi bilan bir xil; bosqich sanadan yaratiladi (dushanba — teng yo'llar, seshanba — asosiy yo'l, chorshanba — svetofor, payshanba — aylanma, juma — T-chorraha, shanba — regulirovshik, yakshanba — sirenalar kuni). Ketma-ketlik faqat **bugungi** bosqich uchun hisoblanadi.
- **Cheksiz tirbandlik** — mashinalar tobora tez keladi. Bir yo'lda **7 tadan ko'p** mashina to'plansa (ya'ni 8-chisi kelsa) yoki 3 marta qoida buzilsa — o'yin tugaydi. Natija — o'tkazilgan mashinalar soni; tanga berilmaydi.
- **Kechqurun, tun, yomg'ir** — faqat ko'rinish: qoidalar o'zgarmaydi, lekin mashinalarni faralar va stop-chiroqlar bo'yicha kuzatishga to'g'ri keladi.

> Bu — o'quv maqsadidagi soddalashtirilgan model: har yo'nalishda bitta bo'lak, piyodalar, tramvay va qayrilib olish yo'q. Rasmiy YHQ matni o'rnini bosmaydi.
