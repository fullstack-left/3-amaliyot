/**
 * Player-facing explanations (Uzbek) for every rule-engine reason, plus the
 * in-game rulebook. Kept separate from core/ so the engine stays language-free.
 */
export const REASON_TEXT = {
    not_found: { title: 'Topilmadi', text: 'Bunday mashina yo‘q.', icon: 'warn' },
    not_front: { title: 'Navbat', text: "Bu mashina navbatda turibdi — avval oldingisi o'tishi kerak.", icon: 'clock' },
    not_ready: { title: 'Hali tayyor emas', text: 'Mashina stop-chiziqqa yetib kelmagan.', icon: 'clock' },
    locked: { title: 'Kuting', text: 'Bir lahza — inspektor hali tekshiryapti.', icon: 'clock' },
    controller: {
        title: 'Boshqaruvchi ishorasi',
        text: "Tartibga soluvchining ishorasi bu harakatga ruxsat bermaydi. Ko'kragi va orqasi tomondan — to'xtash!",
        icon: 'cop',
    },
    red_light: {
        title: 'Taqiqlovchi chiroq',
        text: 'Qizil, sariq yoki qizil+sariq chiroqda harakatlanish taqiqlanadi. Yashilni kuting.',
        icon: 'light',
    },
    crossing_traffic: {
        title: "To'qnashuv xavfi!",
        text: "Chorrahada harakatni yakunlayotgan mashina bor — u o'tib ketishini kuting.",
        icon: 'warn',
    },
    roundabout_ring: {
        title: 'Aylanma harakat',
        text: "Halqada harakatlanayotgan mashina ustun. U o'tgach, bo'sh oynaga kiring.",
        icon: 'ring',
    },
    emergency: {
        title: 'Maxsus transport',
        text: "Sirenali tez yordam / o't o'chirish mashinasiga yo'l bering — ular doimo ustun.",
        icon: 'plus',
    },
    main_road: {
        title: "Asosiy yo'l",
        text: "\"Yo'l bering\" / STOP belgisi: asosiy yo'ldagi mashinalarni o'tkazib yuboring.",
        icon: 'diamond',
    },
    right_hand: {
        title: "O'ng qo'l qoidasi",
        text: "Teng ahamiyatli yo'llarda o'ng tomondan kelayotgan mashinaga yo'l bering.",
        icon: 'next',
    },
    left_turn: {
        title: 'Chapga burilish',
        text: "Chapga burilayotganda qarshidan to'g'riga yoki o'ngga ketayotgan mashinaga yo'l bering.",
        icon: 'turnLeft',
    },
};
export const RULEBOOK = [
    {
        icon: 'next',
        title: "Teng ahamiyatli yo'llar",
        points: [
            "O'ng tomondan kelayotgan mashinaga yo'l beriladi (o'ng qo'l qoidasi).",
            "Chapga burilayotgan mashina qarshidan to'g'riga va o'ngga ketayotganlarga yo'l beradi.",
            "Hamma bir-birini kutsa (tiqilinch) — haydovchilar kelishadi: bittasi o'tadi.",
        ],
    },
    {
        icon: 'diamond',
        title: 'Ustuvorlik belgilari',
        points: [
            "Sariq romb — asosiy yo'l: bu yo'ldagilar ustun.",
            "Uchburchak (yo'l bering) va STOP — asosiy yo'ldagilarni o'tkazib yuboring.",
            "Belgilar o'ng qo'l qoidasidan ustun. Bir xil darajadagilar o'rtasida esa teng yo'l qoidalari amal qiladi.",
        ],
    },
    {
        icon: 'light',
        title: 'Svetofor',
        points: [
            'Yashil (va yashil miltillovchi) — yurish mumkin.',
            'Sariq, qizil, qizil+sariq — harakatlanish taqiqlanadi.',
            'Yashilda chapga burilayotgan — qarshidagi to‘g‘riga/o‘ngga ketayotganga yo‘l beradi.',
            'Sariq miltillovchi — svetofor ishlamayapti, belgilarga amal qiling.',
        ],
    },
    {
        icon: 'cop',
        title: 'Tartibga soluvchi (regulirovshik)',
        points: [
            "Qo'llar yonga: chap va o'ng yonidan — to'g'riga va o'ngga; ko'krak va orqa tomondan — to'xtash.",
            "O'ng qo'l oldinga: chap yonidan — hamma yo'nalishga; ko'krak tomondan — faqat o'ngga; o'ng yon va orqa — to'xtash.",
            "Qo'l tepaga: hamma to'xtaydi.",
            "Boshqaruvchi svetofor va belgilardan ustun.",
        ],
    },
    {
        icon: 'ring',
        title: 'Aylanma harakat',
        points: [
            'Halqada harakatlanayotgan mashina ustun.',
            'Kirayotganlar bo‘sh oynani kutadi; kutayotganlar o‘zaro teng.',
        ],
    },
    {
        icon: 'plus',
        title: 'Maxsus transport',
        points: [
            'Sirenali tez yordam va o‘t o‘chirish mashinalari doimo ustun.',
            'Ular svetofor va belgilarga bo‘ysunmasligi mumkin — yashil chiroqda turgan bo‘lsangiz ham, ularga yo‘l bering.',
            'YPX mashinasi sirenasiz bo‘lsa — oddiy qoidalar amal qiladi.',
        ],
    },
    {
        icon: 'whistle',
        title: "Jazo va jonlar",
        points: [
            "Qoidani buzsangiz — YPX hushtagi, mashinalar qizil miltillaydi, 1 jon kamayadi.",
            "Chorrahada o'tib borayotgan mashina bilan to'qnashuv xavfi ham jazo.",
            "Navbatdagi (orqadagi) mashinani bosish — jazosiz, shunchaki hech narsa bo'lmaydi.",
        ],
    },
];
//# sourceMappingURL=rulesText.js.map