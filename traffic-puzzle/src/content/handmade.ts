/**
 * Hand-authored levels: every new mechanic is introduced by a level designed
 * around exactly one rule, with an intro card. The rest of the campaign is
 * produced by the seeded generator (generator.ts) and frozen by
 * scripts/build-campaign.mjs.
 */

import type {
  ArmDef,
  ControllerDef,
  DirLetter,
  LevelDef,
  SignType,
  SpawnDef,
  VehicleKind,
} from '../core/types.js';

const TURN = { s: 'straight', l: 'left', r: 'right' } as const;

/** 'car:s' → { kind: 'car', turn: 'straight' } */
export function v(code: string): SpawnDef {
  const [k, t] = code.split(':');
  return { kind: k as VehicleKind, turn: TURN[t as keyof typeof TURN] };
}

export function armOf(
  dir: DirLetter,
  codes: string[] = [],
  sign: SignType = 'none',
  arrivals: [string, number][] = [],
): ArmDef {
  const a: ArmDef = { dir, sign, queue: codes.map(v) };
  if (arrivals.length) a.arrivals = arrivals.map(([c, atMs]) => ({ ...v(c), atMs }));
  return a;
}

// ---------------------------------------------------------------------------
// Traffic controller scripts (boss levels)
// ---------------------------------------------------------------------------

export const BOSS1: ControllerDef = {
  poses: [
    { gesture: 'arms_side', facing: 'N', ms: 6000 },
    { gesture: 'arm_up', facing: 'N', ms: 1500 },
    { gesture: 'arms_side', facing: 'E', ms: 6000 },
    { gesture: 'arm_up', facing: 'E', ms: 1500 },
  ],
};

export const BOSS2: ControllerDef = {
  poses: [
    { gesture: 'right_forward', facing: 'S', ms: 5500 },
    { gesture: 'arm_up', facing: 'S', ms: 1500 },
    { gesture: 'arms_side', facing: 'N', ms: 5000 },
    { gesture: 'arm_up', facing: 'N', ms: 1500 },
    { gesture: 'right_forward', facing: 'N', ms: 5500 },
    { gesture: 'arm_up', facing: 'N', ms: 1500 },
    { gesture: 'arms_side', facing: 'E', ms: 5000 },
    { gesture: 'arm_up', facing: 'E', ms: 1500 },
  ],
};

function script(order: [('arms_side' | 'right_forward'), DirLetter][], ms: number, upMs: number): ControllerDef {
  const poses: ControllerDef['poses'] = [];
  for (const [gesture, facing] of order) {
    poses.push({ gesture, facing, ms });
    poses.push({ gesture: 'arm_up', facing, ms: upMs });
  }
  return { poses };
}

export const BOSS3 = script(
  [
    ['right_forward', 'S'],
    ['arms_side', 'N'],
    ['right_forward', 'W'],
    ['arms_side', 'E'],
    ['right_forward', 'N'],
    ['right_forward', 'E'],
  ],
  4500,
  1200,
);

export const BOSS4 = script(
  [
    ['arms_side', 'E'],
    ['right_forward', 'N'],
    ['right_forward', 'E'],
    ['arms_side', 'N'],
    ['right_forward', 'S'],
    ['right_forward', 'W'],
  ],
  4000,
  1000,
);

export const BOSS5 = script(
  [
    ['arms_side', 'N'],
    ['right_forward', 'W'],
    ['arms_side', 'E'],
    ['right_forward', 'S'],
    ['right_forward', 'E'],
    ['arms_side', 'N'],
    ['right_forward', 'N'],
    ['arms_side', 'E'],
  ],
  3500,
  900,
);

const TWO_PHASE = {
  phases: [
    { green: ['N', 'S'] as DirLetter[], ms: 7000 },
    { green: ['E', 'W'] as DirLetter[], ms: 7000 },
  ],
};

// ---------------------------------------------------------------------------
// Levels
// ---------------------------------------------------------------------------

export const HANDMADE: readonly LevelDef[] = [
  {
    id: 1,
    name: "O'ng qo'l qoidasi",
    band: 'base',
    junction: 'cross',
    arms: [armOf('N'), armOf('E', ['car:s']), armOf('S', ['car:s']), armOf('W')],
    intro: {
      title: "1-dars: O'ng qo'l qoidasi",
      text:
        "Belgisiz (teng ahamiyatli) chorrahada har bir haydovchi O'NG tomonidan kelayotgan mashinaga yo'l beradi. " +
        "Qaysi mashinaning o'ng tomoni bo'sh bo'lsa — o'sha birinchi o'tadi. Mashinani bosing!",
    },
    tip: "Janubdagi mashinaning o'ng tomonida sharqdagi mashina turibdi — avval o'shani yuboring.",
  },
  {
    id: 2,
    name: 'Kim birinchi?',
    band: 'base',
    junction: 'cross',
    arms: [armOf('N'), armOf('E', ['car:s']), armOf('S', ['car:s']), armOf('W', ['car:s'])],
    intro: {
      title: '2-dars: Zanjir',
      text: "Uchta mashina — har biri o'ngdagisini kutadi. Zanjirning boshini toping: o'ng tomoni bo'sh mashina.",
    },
    tip: "Sharqdagi mashinaning o'ng tomoni bo'sh. Keyin janubdagi, oxirida g'arbdagi.",
  },
  {
    id: 3,
    name: 'Chapga burilish',
    band: 'base',
    junction: 'cross',
    arms: [armOf('N', ['car:s']), armOf('E', ['car:r']), armOf('S', ['car:l']), armOf('W')],
    intro: {
      title: '3-dars: Chapga burilish',
      text:
        "Chapga burilayotgan mashina QARSHIDAN to'g'riga yoki o'ngga ketayotgan mashinaga yo'l beradi. " +
        "O'ngga burilish ko'pincha hech kimga xalaqit bermaydi.",
    },
    tip: "Janubdagi mashina chapga buriladi — qarshidagi (shimoldagi) to'g'riga ketuvchini kutadi.",
  },
  {
    id: 4,
    name: 'Tartib zanjiri',
    band: 'base',
    junction: 'cross',
    arms: [armOf('N', ['car:s']), armOf('E', ['car:r']), armOf('S', ['car:l']), armOf('W', ['car:r'])],
    tip: "Shimoldagi mashina o'ngidagi (g'arbdagi) mashinani kutadi, janubdagi esa shimoldagini.",
  },
  {
    id: 5,
    name: 'Tez yordam!',
    band: 'base',
    junction: 'cross',
    arms: [armOf('N'), armOf('E', ['car:s']), armOf('S', ['ambulance:s']), armOf('W', ['car:l'])],
    intro: {
      title: '5-dars: Maxsus transport',
      text:
        "Chiroqlari yonib, sirena chalayotgan tez yordam va o't o'chirish mashinalari DOIMO ustun. " +
        'Ularni birinchi navbatda yuboring — qolganlar kutadi.',
    },
    tip: 'Avval tez yordam, keyin sharqdagi, oxirida chapga buriluvchi.',
  },
  {
    id: 6,
    name: 'Navbat',
    band: 'base',
    junction: 'cross',
    arms: [armOf('N'), armOf('E', ['car:s']), armOf('S', ['car:r', 'car:s']), armOf('W', ['car:l'])],
    intro: {
      title: '6-dars: Navbat',
      text:
        "Bir yo'lda bir nechta mashina bo'lsa, faqat stop-chiziqdagi birinchisi harakatlana oladi. " +
        "Orqadagini bosish hech narsa qilmaydi — jazo ham yo'q.",
    },
  },
  {
    id: 8,
    name: 'Tiqilinch',
    band: 'base',
    junction: 'cross',
    arms: [
      armOf('N', ['car:s', 'car:r']),
      armOf('E', ['car:s']),
      armOf('S', ['car:s', 'car:l']),
      armOf('W', ['car:s']),
    ],
    intro: {
      title: '8-dars: Tiqilinch',
      text:
        "To'rtta mashina — har birining o'ngida boshqasi. Hech kim ustun emas! Bunday holatda haydovchilar " +
        "kelishib o'tadi: istalgan bittasini yuboring, zanjir o'zi yechiladi.",
    },
  },
  {
    id: 10,
    name: 'BOSS: Regulirovshik',
    band: 'boss',
    junction: 'cross',
    controller: BOSS1,
    arms: [
      armOf('N', ['car:s', 'car:r', 'taxi:s'], 'none', [['car:s', 9000]]),
      armOf('E', ['car:s', 'bus:r', 'car:s']),
      armOf('S', ['car:r', 'car:s', 'truck:s'], 'none', [['car:r', 13000]]),
      armOf('W', ['taxi:s', 'car:s', 'car:r']),
    ],
    intro: {
      title: 'BOSS: Yo‘l harakati boshqaruvchisi',
      text:
        "Qo'llari YON tomonga uzatilgan: uning chap va o'ng yonidan kelayotganlar to'g'riga va o'ngga yuradi, " +
        "ko'kragi va orqasi tomonidagilar — TO'XTAYDI. Qo'l TEPAGA ko'tarilgan — hamma to'xtaydi. " +
        "Boshqaruvchi svetofor va belgilardan ustun!",
    },
    tip: "Uning yuzi va ko'kragi qaragan tomonga e'tibor bering: o'sha tomon va orqa tomon to'xtaydi.",
  },
  {
    id: 11,
    name: "Asosiy yo'l",
    band: 'complex',
    junction: 'cross',
    arms: [
      armOf('N', ['car:r'], 'main'),
      armOf('E', ['car:s'], 'yield'),
      armOf('S', ['car:s'], 'main'),
      armOf('W', ['car:l'], 'yield'),
    ],
    intro: {
      title: "11-dars: Asosiy yo'l",
      text:
        "Sariq romb — ASOSIY yo'l. Qizil hoshiyali uchburchak — \"YO'L BERING\": bu tomondagi mashina asosiy yo'ldagilarni " +
        "o'tkazib yuboradi. Belgilar o'ng qo'l qoidasidan USTUN!",
    },
  },
  {
    id: 12,
    name: "Asosiy yo'lda chapga",
    band: 'complex',
    junction: 'cross',
    arms: [
      armOf('N', ['car:s'], 'main'),
      armOf('E', ['car:s'], 'stop'),
      armOf('S', ['car:l', 'car:s'], 'main'),
      armOf('W', ['car:r'], 'stop'),
    ],
    intro: {
      title: "12-dars: Asosiy yo'l ichida",
      text:
        "Asosiy yo'ldagi mashinalar o'zaro teng: chapga burilayotgani qarshidan to'g'riga kelayotganga yo'l beradi. " +
        "STOP belgisi ham \"yo'l bering\" kabi ishlaydi.",
    },
  },
  {
    id: 16,
    name: 'Ikkinchi yo‘lda tez yordam',
    band: 'complex',
    junction: 'cross',
    arms: [
      armOf('N', ['car:s', 'car:r'], 'main'),
      armOf('E', ['ambulance:s', 'car:l'], 'yield'),
      armOf('S', ['car:s', 'car:l'], 'main'),
      armOf('W', ['car:r'], 'yield'),
    ],
    intro: {
      title: 'Maxsus transport belgilarga qaramaydi',
      text: "Tez yordam \"yo'l bering\" tomonida tursa ham u USTUN. Asosiy yo'ldagilar ham unga yo'l beradi!",
    },
  },
  {
    id: 20,
    name: 'BOSS: Chorsu regulirovshigi',
    band: 'boss',
    junction: 'cross',
    controller: BOSS2,
    arms: [
      armOf('N', ['car:s', 'car:r', 'car:s'], 'none', [['car:r', 15000]]),
      armOf('E', ['car:l', 'car:s', 'bus:r'], 'none', [['car:l', 9000]]),
      armOf('S', ['car:r', 'taxi:s', 'car:s'], 'none', [['car:s', 18000]]),
      armOf('W', ['car:l', 'car:s', 'truck:s'], 'none', [['car:s', 12000]]),
    ],
    intro: {
      title: "BOSS 2: O'ng qo'l oldinga",
      text:
        "Yangi ishora — O'NG QO'L OLDINGA: uning CHAP yonidan kelayotganlar hamma yo'nalishga (chapga ham!) yuradi, " +
        "KO'KRAGI tomonidagilar faqat o'ngga buriladi, o'ng yoni va orqasi tomonidagilar — to'xtaydi.",
    },
  },
  {
    id: 21,
    name: 'Svetofor',
    band: 'complex',
    junction: 'cross',
    signals: TWO_PHASE,
    arms: [armOf('N', ['car:s', 'car:r']), armOf('E', ['car:s']), armOf('S', ['car:s']), armOf('W', ['car:s', 'car:s'])],
    intro: {
      title: '21-dars: Svetofor',
      text:
        "Svetofor ishlayotganda: YASHIL — yurish mumkin, SARIQ va QIZIL — to'xtash. Yashil miltillasa — tez orada " +
        "sariq yonadi. Qizilda yuborish — jarima!",
    },
  },
  {
    id: 22,
    name: 'Yashilda chapga',
    band: 'complex',
    junction: 'cross',
    signals: TWO_PHASE,
    arms: [
      armOf('N', ['car:s', 'car:r']),
      armOf('E', ['car:r']),
      armOf('S', ['car:l', 'car:s']),
      armOf('W', ['car:l']),
    ],
    intro: {
      title: 'Yashil chiroqda chapga burilish',
      text: "Yashilda chapga burilayotgan mashina qarshidan (u ham yashilda) to'g'riga va o'ngga ketayotganlarga yo'l beradi.",
    },
  },
  {
    id: 23,
    name: 'Qizilda tez yordam',
    band: 'complex',
    junction: 'cross',
    signals: TWO_PHASE,
    arms: [
      armOf('N', ['car:l']),
      armOf('E', ['ambulance:s']),
      armOf('S', ['car:s', 'car:r']),
      armOf('W', ['car:s', 'car:r']),
    ],
    intro: {
      title: 'Maxsus transport svetoforga bo‘ysunmaydi',
      text: 'Tez yordam qizil chiroqda ham o‘tishi mumkin. Yashil chiroq sizga yonsa ham — unga yo‘l bering!',
    },
  },
  {
    id: 24,
    name: 'Sariq miltillovchi',
    band: 'complex',
    junction: 'cross',
    signals: { ...TWO_PHASE, flashing: [{ fromMs: 0, toMs: 600000 }] },
    arms: [
      armOf('N', ['car:s'], 'yield'),
      armOf('E', ['car:s', 'car:r'], 'main'),
      armOf('S', ['car:l'], 'yield'),
      armOf('W', ['car:s'], 'main'),
    ],
    intro: {
      title: 'Svetofor o‘chiq (sariq miltillaydi)',
      text: "Sariq chiroq miltillasa — svetofor boshqarmayapti. Unda BELGILARGA qarang: sariq romb — asosiy yo'l, uchburchak — yo'l bering.",
    },
  },
  {
    id: 31,
    name: 'Aylanma harakat',
    band: 'roundabout',
    junction: 'roundabout',
    arms: [armOf('N', ['car:s']), armOf('E', ['car:l']), armOf('S', ['car:r']), armOf('W', ['car:s'])],
    intro: {
      title: '31-dars: Aylanma harakat',
      text:
        "Aylanmaga kirayotgan mashina HALQADA harakatlanayotganlarga yo'l beradi. Halqaga kirgan mashina ustun. " +
        "Bo'sh \"oyna\"ni kutib, keyin yuboring. Kutayotganlar o'zaro teng.",
    },
  },
  {
    id: 36,
    name: 'Aylanmada tez yordam',
    band: 'roundabout',
    junction: 'roundabout',
    arms: [
      armOf('N', ['car:s', 'car:r']),
      armOf('E', ['ambulance:l']),
      armOf('S', ['car:s']),
      armOf('W', ['car:l', 'car:s']),
    ],
  },
];

export function handmade(id: number): LevelDef | undefined {
  return HANDMADE.find((l) => l.id === id);
}
