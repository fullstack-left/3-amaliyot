export const CAMPAIGN_DATA = [
    {
        "id": 1,
        "name": "O'ng qo'l qoidasi",
        "band": "base",
        "junction": "cross",
        "arms": [
            {
                "dir": "N",
                "sign": "none",
                "queue": []
            },
            {
                "dir": "E",
                "sign": "none",
                "queue": [
                    {
                        "kind": "car",
                        "turn": "straight"
                    }
                ]
            },
            {
                "dir": "S",
                "sign": "none",
                "queue": [
                    {
                        "kind": "car",
                        "turn": "straight"
                    }
                ]
            },
            {
                "dir": "W",
                "sign": "none",
                "queue": []
            }
        ],
        "intro": {
            "title": "1-dars: O'ng qo'l qoidasi",
            "text": "Belgisiz (teng ahamiyatli) chorrahada har bir haydovchi O'NG tomonidan kelayotgan mashinaga yo'l beradi. Qaysi mashinaning o'ng tomoni bo'sh bo'lsa — o'sha birinchi o'tadi. Mashinani bosing!"
        },
        "tip": "Janubdagi mashinaning o'ng tomonida sharqdagi mashina turibdi — avval o'shani yuboring.",
        "coach": [
            {
                "vehicle": "E0",
                "text": "Sharqdan kelayotgan mashinaning o'ng tomoni bo'sh — u birinchi o'tadi. Uni bosing!"
            },
            {
                "vehicle": "S0",
                "text": "Endi janubdagi mashinaning o'ng tomoni bo'shadi. Yo'l ochiq — yuboring."
            }
        ],
        "parMs": 5500
    },
    {
        "id": 2,
        "name": "Kim birinchi?",
        "band": "base",
        "junction": "cross",
        "arms": [
            {
                "dir": "N",
                "sign": "none",
                "queue": []
            },
            {
                "dir": "E",
                "sign": "none",
                "queue": [
                    {
                        "kind": "car",
                        "turn": "straight"
                    }
                ]
            },
            {
                "dir": "S",
                "sign": "none",
                "queue": [
                    {
                        "kind": "car",
                        "turn": "straight"
                    }
                ]
            },
            {
                "dir": "W",
                "sign": "none",
                "queue": [
                    {
                        "kind": "car",
                        "turn": "straight"
                    }
                ]
            }
        ],
        "intro": {
            "title": "2-dars: Zanjir",
            "text": "Uchta mashina — har biri o'ngdagisini kutadi. Zanjirning boshini toping: o'ng tomoni bo'sh mashina."
        },
        "tip": "Sharqdagi mashinaning o'ng tomoni bo'sh. Keyin janubdagi, oxirida g'arbdagi.",
        "coach": [
            {
                "vehicle": "E0",
                "text": "Zanjir boshi: sharqdagi mashinaning o'ngida hech kim yo'q."
            },
            {
                "vehicle": "S0",
                "text": "Janubdagi mashina sharqdagini kutgan edi. Endi uning navbati."
            },
            {
                "vehicle": "W0",
                "text": "G'arbdagi mashina janubdagini kutdi. Oxirgisini yuboring."
            }
        ],
        "parMs": 6500
    },
    {
        "id": 3,
        "name": "Chapga burilish",
        "band": "base",
        "junction": "cross",
        "arms": [
            {
                "dir": "N",
                "sign": "none",
                "queue": [
                    {
                        "kind": "car",
                        "turn": "straight"
                    }
                ]
            },
            {
                "dir": "E",
                "sign": "none",
                "queue": [
                    {
                        "kind": "car",
                        "turn": "right"
                    }
                ]
            },
            {
                "dir": "S",
                "sign": "none",
                "queue": [
                    {
                        "kind": "car",
                        "turn": "left"
                    }
                ]
            },
            {
                "dir": "W",
                "sign": "none",
                "queue": []
            }
        ],
        "intro": {
            "title": "3-dars: Chapga burilish",
            "text": "Chapga burilayotgan mashina QARSHIDAN to'g'riga yoki o'ngga ketayotgan mashinaga yo'l beradi. O'ngga burilish ko'pincha hech kimga xalaqit bermaydi."
        },
        "tip": "Janubdagi mashina chapga buriladi — qarshidagi (shimoldagi) to'g'riga ketuvchini kutadi.",
        "coach": [
            {
                "vehicle": "E0",
                "text": "O'ngga burilayotgan mashina hech kimning yo'lini kesmaydi — bemalol yuboring."
            },
            {
                "vehicle": "N0",
                "text": "Shimoldagi mashina to'g'riga ketadi, uning o'ng tomoni bo'sh."
            },
            {
                "vehicle": "S0",
                "text": "Chapga buriluvchi qarshidan kelgan mashinani kutdi. Endi o'tishi mumkin."
            }
        ],
        "parMs": 5500
    },
    {
        "id": 4,
        "name": "Tartib zanjiri",
        "band": "base",
        "junction": "cross",
        "arms": [
            {
                "dir": "N",
                "sign": "none",
                "queue": [
                    {
                        "kind": "car",
                        "turn": "straight"
                    }
                ]
            },
            {
                "dir": "E",
                "sign": "none",
                "queue": [
                    {
                        "kind": "car",
                        "turn": "right"
                    }
                ]
            },
            {
                "dir": "S",
                "sign": "none",
                "queue": [
                    {
                        "kind": "car",
                        "turn": "left"
                    }
                ]
            },
            {
                "dir": "W",
                "sign": "none",
                "queue": [
                    {
                        "kind": "car",
                        "turn": "right"
                    }
                ]
            }
        ],
        "tip": "Shimoldagi mashina o'ngidagi (g'arbdagi) mashinani kutadi, janubdagi esa shimoldagini.",
        "parMs": 7000
    },
    {
        "id": 5,
        "name": "Tez yordam!",
        "band": "base",
        "junction": "cross",
        "arms": [
            {
                "dir": "N",
                "sign": "none",
                "queue": []
            },
            {
                "dir": "E",
                "sign": "none",
                "queue": [
                    {
                        "kind": "car",
                        "turn": "straight"
                    }
                ]
            },
            {
                "dir": "S",
                "sign": "none",
                "queue": [
                    {
                        "kind": "ambulance",
                        "turn": "straight"
                    }
                ]
            },
            {
                "dir": "W",
                "sign": "none",
                "queue": [
                    {
                        "kind": "car",
                        "turn": "left"
                    }
                ]
            }
        ],
        "intro": {
            "title": "5-dars: Maxsus transport",
            "text": "Chiroqlari yonib, sirena chalayotgan tez yordam va o't o'chirish mashinalari DOIMO ustun. Ularni birinchi navbatda yuboring — qolganlar kutadi."
        },
        "tip": "Avval tez yordam, keyin sharqdagi, oxirida chapga buriluvchi.",
        "coach": [
            {
                "vehicle": "S0",
                "text": "Tez yordam — doimo birinchi! Sirenali mashinani yuboring."
            },
            {
                "vehicle": "E0",
                "text": "Sharqdagi mashinaning o'ng tomoni bo'sh."
            },
            {
                "vehicle": "W0",
                "text": "Chapga buriluvchi qarshidagi mashinani kutdi — endi uning navbati."
            }
        ],
        "parMs": 7500
    },
    {
        "id": 6,
        "name": "Navbat",
        "band": "base",
        "junction": "cross",
        "arms": [
            {
                "dir": "N",
                "sign": "none",
                "queue": []
            },
            {
                "dir": "E",
                "sign": "none",
                "queue": [
                    {
                        "kind": "car",
                        "turn": "straight"
                    }
                ]
            },
            {
                "dir": "S",
                "sign": "none",
                "queue": [
                    {
                        "kind": "car",
                        "turn": "right"
                    },
                    {
                        "kind": "car",
                        "turn": "straight"
                    }
                ]
            },
            {
                "dir": "W",
                "sign": "none",
                "queue": [
                    {
                        "kind": "car",
                        "turn": "left"
                    }
                ]
            }
        ],
        "intro": {
            "title": "6-dars: Navbat",
            "text": "Bir yo'lda bir nechta mashina bo'lsa, faqat stop-chiziqdagi birinchisi harakatlana oladi. Orqadagini bosish hech narsa qilmaydi — jazo ham yo'q."
        },
        "parMs": 7000
    },
    {
        "id": 7,
        "name": "Chilonzor chorrahasi",
        "band": "base",
        "junction": "cross",
        "arms": [
            {
                "dir": "N",
                "queue": [
                    {
                        "kind": "car",
                        "turn": "right"
                    }
                ]
            },
            {
                "dir": "E",
                "queue": [
                    {
                        "kind": "car",
                        "turn": "left"
                    }
                ]
            },
            {
                "dir": "S",
                "queue": [
                    {
                        "kind": "car",
                        "turn": "left"
                    },
                    {
                        "kind": "taxi",
                        "turn": "left"
                    }
                ]
            },
            {
                "dir": "W",
                "queue": [
                    {
                        "kind": "car",
                        "turn": "straight"
                    },
                    {
                        "kind": "car",
                        "turn": "left"
                    }
                ]
            }
        ],
        "tip": "O'ng tomonni tekshiring: o'ngdan kelayotgan mashina ustun. Chapga buriluvchi qarshidagini kutadi.",
        "parMs": 10000
    },
    {
        "id": 8,
        "name": "Tiqilinch",
        "band": "base",
        "junction": "cross",
        "arms": [
            {
                "dir": "N",
                "sign": "none",
                "queue": [
                    {
                        "kind": "car",
                        "turn": "straight"
                    },
                    {
                        "kind": "car",
                        "turn": "right"
                    }
                ]
            },
            {
                "dir": "E",
                "sign": "none",
                "queue": [
                    {
                        "kind": "car",
                        "turn": "straight"
                    }
                ]
            },
            {
                "dir": "S",
                "sign": "none",
                "queue": [
                    {
                        "kind": "car",
                        "turn": "straight"
                    },
                    {
                        "kind": "car",
                        "turn": "left"
                    }
                ]
            },
            {
                "dir": "W",
                "sign": "none",
                "queue": [
                    {
                        "kind": "car",
                        "turn": "straight"
                    }
                ]
            }
        ],
        "intro": {
            "title": "8-dars: Tiqilinch",
            "text": "To'rtta mashina — har birining o'ngida boshqasi. Hech kim ustun emas! Bunday holatda haydovchilar kelishib o'tadi: istalgan bittasini yuboring, zanjir o'zi yechiladi."
        },
        "ambience": "evening",
        "parMs": 10000
    },
    {
        "id": 9,
        "name": "Sirena ovozi",
        "band": "base",
        "junction": "cross",
        "arms": [
            {
                "dir": "N",
                "queue": [
                    {
                        "kind": "truck",
                        "turn": "left"
                    },
                    {
                        "kind": "car",
                        "turn": "right"
                    }
                ]
            },
            {
                "dir": "E",
                "queue": [
                    {
                        "kind": "ambulance",
                        "turn": "straight"
                    },
                    {
                        "kind": "car",
                        "turn": "right"
                    }
                ]
            },
            {
                "dir": "S",
                "queue": [
                    {
                        "kind": "taxi",
                        "turn": "straight"
                    },
                    {
                        "kind": "bus",
                        "turn": "left"
                    }
                ]
            },
            {
                "dir": "W",
                "queue": [
                    {
                        "kind": "car",
                        "turn": "straight"
                    }
                ]
            }
        ],
        "tip": "O'ng tomonni tekshiring: o'ngdan kelayotgan mashina ustun. Chapga buriluvchi qarshidagini kutadi.",
        "parMs": 12000
    },
    {
        "id": 10,
        "name": "BOSS: Regulirovshik",
        "band": "boss",
        "junction": "cross",
        "controller": {
            "poses": [
                {
                    "gesture": "arms_side",
                    "facing": "N",
                    "ms": 6000
                },
                {
                    "gesture": "arm_up",
                    "facing": "N",
                    "ms": 1500
                },
                {
                    "gesture": "arms_side",
                    "facing": "E",
                    "ms": 6000
                },
                {
                    "gesture": "arm_up",
                    "facing": "E",
                    "ms": 1500
                }
            ]
        },
        "arms": [
            {
                "dir": "N",
                "sign": "none",
                "queue": [
                    {
                        "kind": "car",
                        "turn": "straight"
                    },
                    {
                        "kind": "car",
                        "turn": "right"
                    },
                    {
                        "kind": "taxi",
                        "turn": "straight"
                    }
                ],
                "arrivals": [
                    {
                        "kind": "car",
                        "turn": "straight",
                        "atMs": 9000
                    }
                ]
            },
            {
                "dir": "E",
                "sign": "none",
                "queue": [
                    {
                        "kind": "car",
                        "turn": "straight"
                    },
                    {
                        "kind": "bus",
                        "turn": "right"
                    },
                    {
                        "kind": "car",
                        "turn": "straight"
                    }
                ]
            },
            {
                "dir": "S",
                "sign": "none",
                "queue": [
                    {
                        "kind": "car",
                        "turn": "right"
                    },
                    {
                        "kind": "car",
                        "turn": "straight"
                    },
                    {
                        "kind": "truck",
                        "turn": "straight"
                    }
                ],
                "arrivals": [
                    {
                        "kind": "car",
                        "turn": "right",
                        "atMs": 13000
                    }
                ]
            },
            {
                "dir": "W",
                "sign": "none",
                "queue": [
                    {
                        "kind": "taxi",
                        "turn": "straight"
                    },
                    {
                        "kind": "car",
                        "turn": "straight"
                    },
                    {
                        "kind": "car",
                        "turn": "right"
                    }
                ]
            }
        ],
        "intro": {
            "title": "BOSS: Yo‘l harakati boshqaruvchisi",
            "text": "Qo'llari YON tomonga uzatilgan: uning chap va o'ng yonidan kelayotganlar to'g'riga va o'ngga yuradi, ko'kragi va orqasi tomonidagilar — TO'XTAYDI. Qo'l TEPAGA ko'tarilgan — hamma to'xtaydi. Boshqaruvchi svetofor va belgilardan ustun!"
        },
        "tip": "Uning yuzi va ko'kragi qaragan tomonga e'tibor bering: o'sha tomon va orqa tomon to'xtaydi.",
        "ambience": "evening",
        "parMs": 33000
    },
    {
        "id": 11,
        "name": "Asosiy yo'l",
        "band": "complex",
        "junction": "cross",
        "arms": [
            {
                "dir": "N",
                "sign": "main",
                "queue": [
                    {
                        "kind": "car",
                        "turn": "right"
                    }
                ]
            },
            {
                "dir": "E",
                "sign": "yield",
                "queue": [
                    {
                        "kind": "car",
                        "turn": "straight"
                    }
                ]
            },
            {
                "dir": "S",
                "sign": "main",
                "queue": [
                    {
                        "kind": "car",
                        "turn": "straight"
                    }
                ]
            },
            {
                "dir": "W",
                "sign": "yield",
                "queue": [
                    {
                        "kind": "car",
                        "turn": "left"
                    }
                ]
            }
        ],
        "intro": {
            "title": "11-dars: Asosiy yo'l",
            "text": "Sariq romb — ASOSIY yo'l. Qizil hoshiyali uchburchak — \"YO'L BERING\": bu tomondagi mashina asosiy yo'ldagilarni o'tkazib yuboradi. Belgilar o'ng qo'l qoidasidan USTUN!"
        },
        "coach": [
            {
                "vehicle": "S0",
                "text": "Sariq romb — asosiy yo'l. Janubdagi mashina o'ng tomonga qaramasdan o'tadi."
            },
            {
                "vehicle": "N0",
                "text": "Shimoldagi mashina ham asosiy yo'lda — yuboring."
            },
            {
                "vehicle": "E0",
                "text": "Asosiy yo'l bo'shadi. Endi \"yo'l bering\" tomonidagilar o'tadi."
            },
            {
                "vehicle": "W0",
                "text": "Chapga buriluvchi qarshidagi mashinani kutdi. Endi uning navbati."
            }
        ],
        "parMs": 7500
    },
    {
        "id": 12,
        "name": "Asosiy yo'lda chapga",
        "band": "complex",
        "junction": "cross",
        "arms": [
            {
                "dir": "N",
                "sign": "main",
                "queue": [
                    {
                        "kind": "car",
                        "turn": "straight"
                    }
                ]
            },
            {
                "dir": "E",
                "sign": "stop",
                "queue": [
                    {
                        "kind": "car",
                        "turn": "straight"
                    }
                ]
            },
            {
                "dir": "S",
                "sign": "main",
                "queue": [
                    {
                        "kind": "car",
                        "turn": "left"
                    },
                    {
                        "kind": "car",
                        "turn": "straight"
                    }
                ]
            },
            {
                "dir": "W",
                "sign": "stop",
                "queue": [
                    {
                        "kind": "car",
                        "turn": "right"
                    }
                ]
            }
        ],
        "intro": {
            "title": "12-dars: Asosiy yo'l ichida",
            "text": "Asosiy yo'ldagi mashinalar o'zaro teng: chapga burilayotgani qarshidan to'g'riga kelayotganga yo'l beradi. STOP belgisi ham \"yo'l bering\" kabi ishlaydi."
        },
        "parMs": 8500
    },
    {
        "id": 13,
        "name": "Yunusobod",
        "band": "complex",
        "junction": "cross",
        "arms": [
            {
                "dir": "N",
                "sign": "main",
                "queue": [
                    {
                        "kind": "car",
                        "turn": "right"
                    },
                    {
                        "kind": "car",
                        "turn": "right"
                    }
                ]
            },
            {
                "dir": "E",
                "sign": "stop",
                "queue": [
                    {
                        "kind": "taxi",
                        "turn": "straight"
                    },
                    {
                        "kind": "truck",
                        "turn": "straight"
                    }
                ]
            },
            {
                "dir": "S",
                "sign": "main",
                "queue": [
                    {
                        "kind": "car",
                        "turn": "left"
                    },
                    {
                        "kind": "bus",
                        "turn": "right"
                    }
                ]
            },
            {
                "dir": "W",
                "sign": "stop",
                "queue": [
                    {
                        "kind": "taxi",
                        "turn": "straight"
                    },
                    {
                        "kind": "car",
                        "turn": "left"
                    }
                ]
            }
        ],
        "tip": "Sariq romb (asosiy yo'l) tomondagilar birinchi. Uchburchak / STOP tomondagilar ularni o'tkazib yuboradi.",
        "parMs": 11000
    },
    {
        "id": 14,
        "name": "T-chorraha",
        "band": "complex",
        "junction": "t",
        "arms": [
            {
                "dir": "N",
                "sign": "main",
                "queue": [
                    {
                        "kind": "car",
                        "turn": "straight"
                    },
                    {
                        "kind": "bus",
                        "turn": "right"
                    }
                ]
            },
            {
                "dir": "S",
                "sign": "main",
                "queue": [
                    {
                        "kind": "car",
                        "turn": "left"
                    },
                    {
                        "kind": "taxi",
                        "turn": "left"
                    }
                ]
            },
            {
                "dir": "W",
                "sign": "yield",
                "queue": [
                    {
                        "kind": "car",
                        "turn": "right"
                    },
                    {
                        "kind": "car",
                        "turn": "left"
                    }
                ]
            }
        ],
        "tip": "Sariq romb (asosiy yo'l) tomondagilar birinchi. Uchburchak / STOP tomondagilar ularni o'tkazib yuboradi.",
        "parMs": 9500
    },
    {
        "id": 15,
        "name": "Olmazor",
        "band": "complex",
        "junction": "cross",
        "arms": [
            {
                "dir": "N",
                "sign": "main",
                "queue": [
                    {
                        "kind": "taxi",
                        "turn": "left"
                    },
                    {
                        "kind": "car",
                        "turn": "straight"
                    }
                ]
            },
            {
                "dir": "E",
                "sign": "yield",
                "queue": [
                    {
                        "kind": "car",
                        "turn": "left"
                    },
                    {
                        "kind": "taxi",
                        "turn": "straight"
                    },
                    {
                        "kind": "car",
                        "turn": "right"
                    }
                ]
            },
            {
                "dir": "S",
                "sign": "main",
                "queue": [
                    {
                        "kind": "ambulance",
                        "turn": "right"
                    },
                    {
                        "kind": "car",
                        "turn": "left"
                    }
                ]
            },
            {
                "dir": "W",
                "sign": "yield",
                "queue": [
                    {
                        "kind": "car",
                        "turn": "straight"
                    },
                    {
                        "kind": "car",
                        "turn": "left"
                    }
                ]
            }
        ],
        "tip": "Sariq romb (asosiy yo'l) tomondagilar birinchi. Uchburchak / STOP tomondagilar ularni o'tkazib yuboradi.",
        "parMs": 13000
    },
    {
        "id": 16,
        "name": "Ikkinchi yo‘lda tez yordam",
        "band": "complex",
        "junction": "cross",
        "arms": [
            {
                "dir": "N",
                "sign": "main",
                "queue": [
                    {
                        "kind": "car",
                        "turn": "straight"
                    },
                    {
                        "kind": "car",
                        "turn": "right"
                    }
                ]
            },
            {
                "dir": "E",
                "sign": "yield",
                "queue": [
                    {
                        "kind": "ambulance",
                        "turn": "straight"
                    },
                    {
                        "kind": "car",
                        "turn": "left"
                    }
                ]
            },
            {
                "dir": "S",
                "sign": "main",
                "queue": [
                    {
                        "kind": "car",
                        "turn": "straight"
                    },
                    {
                        "kind": "car",
                        "turn": "left"
                    }
                ]
            },
            {
                "dir": "W",
                "sign": "yield",
                "queue": [
                    {
                        "kind": "car",
                        "turn": "right"
                    }
                ]
            }
        ],
        "intro": {
            "title": "Maxsus transport belgilarga qaramaydi",
            "text": "Tez yordam \"yo'l bering\" tomonida tursa ham u USTUN. Asosiy yo'ldagilar ham unga yo'l beradi!"
        },
        "ambience": "rain",
        "parMs": 10000
    },
    {
        "id": 17,
        "name": "Bozor yo‘li",
        "band": "complex",
        "junction": "t",
        "arms": [
            {
                "dir": "E",
                "sign": "main",
                "queue": [
                    {
                        "kind": "truck",
                        "turn": "left"
                    },
                    {
                        "kind": "car",
                        "turn": "straight"
                    }
                ],
                "arrivals": [
                    {
                        "kind": "bus",
                        "turn": "straight",
                        "atMs": 8400
                    }
                ]
            },
            {
                "dir": "S",
                "sign": "yield",
                "queue": [
                    {
                        "kind": "bus",
                        "turn": "right"
                    },
                    {
                        "kind": "car",
                        "turn": "left"
                    }
                ]
            },
            {
                "dir": "W",
                "sign": "main",
                "queue": [
                    {
                        "kind": "taxi",
                        "turn": "straight"
                    },
                    {
                        "kind": "taxi",
                        "turn": "straight"
                    }
                ],
                "arrivals": [
                    {
                        "kind": "truck",
                        "turn": "straight",
                        "atMs": 5500
                    },
                    {
                        "kind": "taxi",
                        "turn": "right",
                        "atMs": 10700
                    }
                ]
            }
        ],
        "tip": "Sariq romb (asosiy yo'l) tomondagilar birinchi. Uchburchak / STOP tomondagilar ularni o'tkazib yuboradi.",
        "parMs": 23500
    },
    {
        "id": 18,
        "name": "Mirobod",
        "band": "complex",
        "junction": "cross",
        "arms": [
            {
                "dir": "N",
                "sign": "stop",
                "queue": [
                    {
                        "kind": "car",
                        "turn": "straight"
                    },
                    {
                        "kind": "car",
                        "turn": "left"
                    },
                    {
                        "kind": "taxi",
                        "turn": "left"
                    }
                ]
            },
            {
                "dir": "E",
                "sign": "main",
                "queue": [
                    {
                        "kind": "car",
                        "turn": "straight"
                    },
                    {
                        "kind": "car",
                        "turn": "right"
                    },
                    {
                        "kind": "taxi",
                        "turn": "left"
                    }
                ]
            },
            {
                "dir": "S",
                "sign": "stop",
                "queue": [
                    {
                        "kind": "car",
                        "turn": "straight"
                    },
                    {
                        "kind": "car",
                        "turn": "right"
                    },
                    {
                        "kind": "truck",
                        "turn": "left"
                    }
                ]
            },
            {
                "dir": "W",
                "sign": "main",
                "queue": [
                    {
                        "kind": "taxi",
                        "turn": "left"
                    },
                    {
                        "kind": "car",
                        "turn": "left"
                    },
                    {
                        "kind": "bus",
                        "turn": "left"
                    }
                ]
            }
        ],
        "tip": "Sariq romb (asosiy yo'l) tomondagilar birinchi. Uchburchak / STOP tomondagilar ularni o'tkazib yuboradi.",
        "ambience": "evening",
        "parMs": 17500
    },
    {
        "id": 19,
        "name": "Sergeli",
        "band": "complex",
        "junction": "cross",
        "arms": [
            {
                "dir": "N",
                "sign": "main",
                "queue": [
                    {
                        "kind": "car",
                        "turn": "left"
                    },
                    {
                        "kind": "car",
                        "turn": "right"
                    },
                    {
                        "kind": "car",
                        "turn": "right"
                    }
                ],
                "arrivals": [
                    {
                        "kind": "car",
                        "turn": "left",
                        "atMs": 8200
                    },
                    {
                        "kind": "car",
                        "turn": "left",
                        "atMs": 13400
                    }
                ]
            },
            {
                "dir": "E",
                "sign": "yield",
                "queue": [
                    {
                        "kind": "car",
                        "turn": "straight"
                    },
                    {
                        "kind": "taxi",
                        "turn": "left"
                    },
                    {
                        "kind": "car",
                        "turn": "left"
                    }
                ],
                "arrivals": [
                    {
                        "kind": "car",
                        "turn": "straight",
                        "atMs": 10900
                    }
                ]
            },
            {
                "dir": "S",
                "sign": "main",
                "queue": [
                    {
                        "kind": "taxi",
                        "turn": "straight"
                    },
                    {
                        "kind": "car",
                        "turn": "left"
                    }
                ],
                "arrivals": [
                    {
                        "kind": "ambulance",
                        "turn": "right",
                        "atMs": 7500
                    }
                ]
            },
            {
                "dir": "W",
                "sign": "yield",
                "queue": [
                    {
                        "kind": "bus",
                        "turn": "straight"
                    },
                    {
                        "kind": "truck",
                        "turn": "straight"
                    },
                    {
                        "kind": "car",
                        "turn": "straight"
                    }
                ],
                "arrivals": [
                    {
                        "kind": "car",
                        "turn": "straight",
                        "atMs": 5000
                    }
                ]
            }
        ],
        "tip": "Sariq romb (asosiy yo'l) tomondagilar birinchi. Uchburchak / STOP tomondagilar ularni o'tkazib yuboradi.",
        "ambience": "rain",
        "parMs": 27500
    },
    {
        "id": 20,
        "name": "BOSS: Chorsu regulirovshigi",
        "band": "boss",
        "junction": "cross",
        "controller": {
            "poses": [
                {
                    "gesture": "right_forward",
                    "facing": "S",
                    "ms": 5500
                },
                {
                    "gesture": "arm_up",
                    "facing": "S",
                    "ms": 1500
                },
                {
                    "gesture": "arms_side",
                    "facing": "N",
                    "ms": 5000
                },
                {
                    "gesture": "arm_up",
                    "facing": "N",
                    "ms": 1500
                },
                {
                    "gesture": "right_forward",
                    "facing": "N",
                    "ms": 5500
                },
                {
                    "gesture": "arm_up",
                    "facing": "N",
                    "ms": 1500
                },
                {
                    "gesture": "arms_side",
                    "facing": "E",
                    "ms": 5000
                },
                {
                    "gesture": "arm_up",
                    "facing": "E",
                    "ms": 1500
                }
            ]
        },
        "arms": [
            {
                "dir": "N",
                "sign": "none",
                "queue": [
                    {
                        "kind": "car",
                        "turn": "straight"
                    },
                    {
                        "kind": "car",
                        "turn": "right"
                    },
                    {
                        "kind": "car",
                        "turn": "straight"
                    }
                ],
                "arrivals": [
                    {
                        "kind": "car",
                        "turn": "right",
                        "atMs": 15000
                    }
                ]
            },
            {
                "dir": "E",
                "sign": "none",
                "queue": [
                    {
                        "kind": "car",
                        "turn": "left"
                    },
                    {
                        "kind": "car",
                        "turn": "straight"
                    },
                    {
                        "kind": "bus",
                        "turn": "right"
                    }
                ],
                "arrivals": [
                    {
                        "kind": "car",
                        "turn": "left",
                        "atMs": 9000
                    }
                ]
            },
            {
                "dir": "S",
                "sign": "none",
                "queue": [
                    {
                        "kind": "car",
                        "turn": "right"
                    },
                    {
                        "kind": "taxi",
                        "turn": "straight"
                    },
                    {
                        "kind": "car",
                        "turn": "straight"
                    }
                ],
                "arrivals": [
                    {
                        "kind": "car",
                        "turn": "straight",
                        "atMs": 18000
                    }
                ]
            },
            {
                "dir": "W",
                "sign": "none",
                "queue": [
                    {
                        "kind": "car",
                        "turn": "left"
                    },
                    {
                        "kind": "car",
                        "turn": "straight"
                    },
                    {
                        "kind": "truck",
                        "turn": "straight"
                    }
                ],
                "arrivals": [
                    {
                        "kind": "car",
                        "turn": "straight",
                        "atMs": 12000
                    }
                ]
            }
        ],
        "intro": {
            "title": "BOSS 2: O'ng qo'l oldinga",
            "text": "Yangi ishora — O'NG QO'L OLDINGA: uning CHAP yonidan kelayotganlar hamma yo'nalishga (chapga ham!) yuradi, KO'KRAGI tomonidagilar faqat o'ngga buriladi, o'ng yoni va orqasi tomonidagilar — to'xtaydi."
        },
        "ambience": "evening",
        "parMs": 39000
    },
    {
        "id": 21,
        "name": "Svetofor",
        "band": "complex",
        "junction": "cross",
        "signals": {
            "phases": [
                {
                    "green": [
                        "N",
                        "S"
                    ],
                    "ms": 7000
                },
                {
                    "green": [
                        "E",
                        "W"
                    ],
                    "ms": 7000
                }
            ]
        },
        "arms": [
            {
                "dir": "N",
                "sign": "none",
                "queue": [
                    {
                        "kind": "car",
                        "turn": "straight"
                    },
                    {
                        "kind": "car",
                        "turn": "right"
                    }
                ]
            },
            {
                "dir": "E",
                "sign": "none",
                "queue": [
                    {
                        "kind": "car",
                        "turn": "straight"
                    }
                ]
            },
            {
                "dir": "S",
                "sign": "none",
                "queue": [
                    {
                        "kind": "car",
                        "turn": "straight"
                    }
                ]
            },
            {
                "dir": "W",
                "sign": "none",
                "queue": [
                    {
                        "kind": "car",
                        "turn": "straight"
                    },
                    {
                        "kind": "car",
                        "turn": "straight"
                    }
                ]
            }
        ],
        "intro": {
            "title": "21-dars: Svetofor",
            "text": "Svetofor ishlayotganda: YASHIL — yurish mumkin, SARIQ va QIZIL — to'xtash. Yashil miltillasa — tez orada sariq yonadi. Qizilda yuborish — jarima!"
        },
        "coach": [
            {
                "vehicle": "N0",
                "text": "Shimol–janub yo‘nalishida yashil yondi. Yashilda yuring!"
            },
            {
                "vehicle": "S0",
                "text": "Qarshi tomon ham yashil — to'g'ri ketayotganlar bir-birini kesmaydi."
            },
            {
                "vehicle": "N1",
                "text": "Navbatdagi mashina ham yashilda o'ngga buriladi."
            },
            {
                "vehicle": "E0",
                "text": "Endi sharq–g‘arb yashil. Qizilda kutganlar yo‘lga chiqadi."
            },
            {
                "vehicle": "W0",
                "text": "G'arbdagi mashina ham yashilda."
            },
            {
                "vehicle": "W1",
                "text": "Oxirgi mashina — yashil o‘chmasdan yuboring!"
            }
        ],
        "parMs": 19000
    },
    {
        "id": 22,
        "name": "Yashilda chapga",
        "band": "complex",
        "junction": "cross",
        "signals": {
            "phases": [
                {
                    "green": [
                        "N",
                        "S"
                    ],
                    "ms": 7000
                },
                {
                    "green": [
                        "E",
                        "W"
                    ],
                    "ms": 7000
                }
            ]
        },
        "arms": [
            {
                "dir": "N",
                "sign": "none",
                "queue": [
                    {
                        "kind": "car",
                        "turn": "straight"
                    },
                    {
                        "kind": "car",
                        "turn": "right"
                    }
                ]
            },
            {
                "dir": "E",
                "sign": "none",
                "queue": [
                    {
                        "kind": "car",
                        "turn": "right"
                    }
                ]
            },
            {
                "dir": "S",
                "sign": "none",
                "queue": [
                    {
                        "kind": "car",
                        "turn": "left"
                    },
                    {
                        "kind": "car",
                        "turn": "straight"
                    }
                ]
            },
            {
                "dir": "W",
                "sign": "none",
                "queue": [
                    {
                        "kind": "car",
                        "turn": "left"
                    }
                ]
            }
        ],
        "intro": {
            "title": "Yashil chiroqda chapga burilish",
            "text": "Yashilda chapga burilayotgan mashina qarshidan (u ham yashilda) to'g'riga va o'ngga ketayotganlarga yo'l beradi."
        },
        "parMs": 18000
    },
    {
        "id": 23,
        "name": "Qizilda tez yordam",
        "band": "complex",
        "junction": "cross",
        "signals": {
            "phases": [
                {
                    "green": [
                        "N",
                        "S"
                    ],
                    "ms": 7000
                },
                {
                    "green": [
                        "E",
                        "W"
                    ],
                    "ms": 7000
                }
            ]
        },
        "arms": [
            {
                "dir": "N",
                "sign": "none",
                "queue": [
                    {
                        "kind": "car",
                        "turn": "left"
                    }
                ]
            },
            {
                "dir": "E",
                "sign": "none",
                "queue": [
                    {
                        "kind": "ambulance",
                        "turn": "straight"
                    }
                ]
            },
            {
                "dir": "S",
                "sign": "none",
                "queue": [
                    {
                        "kind": "car",
                        "turn": "straight"
                    },
                    {
                        "kind": "car",
                        "turn": "right"
                    }
                ]
            },
            {
                "dir": "W",
                "sign": "none",
                "queue": [
                    {
                        "kind": "car",
                        "turn": "straight"
                    },
                    {
                        "kind": "car",
                        "turn": "right"
                    }
                ]
            }
        ],
        "intro": {
            "title": "Maxsus transport svetoforga bo‘ysunmaydi",
            "text": "Tez yordam qizil chiroqda ham o‘tishi mumkin. Yashil chiroq sizga yonsa ham — unga yo‘l bering!"
        },
        "parMs": 18000
    },
    {
        "id": 24,
        "name": "Sariq miltillovchi",
        "band": "complex",
        "junction": "cross",
        "signals": {
            "phases": [
                {
                    "green": [
                        "N",
                        "S"
                    ],
                    "ms": 7000
                },
                {
                    "green": [
                        "E",
                        "W"
                    ],
                    "ms": 7000
                }
            ],
            "flashing": [
                {
                    "fromMs": 0,
                    "toMs": 600000
                }
            ]
        },
        "arms": [
            {
                "dir": "N",
                "sign": "yield",
                "queue": [
                    {
                        "kind": "car",
                        "turn": "straight"
                    }
                ]
            },
            {
                "dir": "E",
                "sign": "main",
                "queue": [
                    {
                        "kind": "car",
                        "turn": "straight"
                    },
                    {
                        "kind": "car",
                        "turn": "right"
                    }
                ]
            },
            {
                "dir": "S",
                "sign": "yield",
                "queue": [
                    {
                        "kind": "car",
                        "turn": "left"
                    }
                ]
            },
            {
                "dir": "W",
                "sign": "main",
                "queue": [
                    {
                        "kind": "car",
                        "turn": "straight"
                    }
                ]
            }
        ],
        "intro": {
            "title": "Svetofor o‘chiq (sariq miltillaydi)",
            "text": "Sariq chiroq miltillasa — svetofor boshqarmayapti. Unda BELGILARGA qarang: sariq romb — asosiy yo'l, uchburchak — yo'l bering."
        },
        "ambience": "night",
        "parMs": 7500
    },
    {
        "id": 25,
        "name": "Yashnobod svetofori",
        "band": "complex",
        "junction": "cross",
        "arms": [
            {
                "dir": "N",
                "queue": [
                    {
                        "kind": "car",
                        "turn": "left"
                    },
                    {
                        "kind": "taxi",
                        "turn": "straight"
                    }
                ]
            },
            {
                "dir": "E",
                "queue": [
                    {
                        "kind": "car",
                        "turn": "left"
                    },
                    {
                        "kind": "car",
                        "turn": "straight"
                    }
                ]
            },
            {
                "dir": "S",
                "queue": [
                    {
                        "kind": "car",
                        "turn": "straight"
                    },
                    {
                        "kind": "car",
                        "turn": "straight"
                    },
                    {
                        "kind": "car",
                        "turn": "right"
                    }
                ]
            },
            {
                "dir": "W",
                "queue": [
                    {
                        "kind": "car",
                        "turn": "straight"
                    },
                    {
                        "kind": "car",
                        "turn": "straight"
                    },
                    {
                        "kind": "taxi",
                        "turn": "right"
                    }
                ]
            }
        ],
        "signals": {
            "phases": [
                {
                    "green": [
                        "N",
                        "S"
                    ],
                    "ms": 8000
                },
                {
                    "green": [
                        "E",
                        "W"
                    ],
                    "ms": 8000
                }
            ],
            "offsetMs": 2000
        },
        "tip": "Faqat yashil chiroqda yuboring. Yashilda chapga buriluvchi qarshidagiga yo‘l beradi.",
        "parMs": 20500
    },
    {
        "id": 26,
        "name": "Svetoforli T",
        "band": "complex",
        "junction": "t",
        "arms": [
            {
                "dir": "N",
                "queue": [
                    {
                        "kind": "car",
                        "turn": "right"
                    },
                    {
                        "kind": "car",
                        "turn": "right"
                    },
                    {
                        "kind": "bus",
                        "turn": "right"
                    }
                ]
            },
            {
                "dir": "E",
                "queue": [
                    {
                        "kind": "police",
                        "turn": "right"
                    },
                    {
                        "kind": "car",
                        "turn": "right"
                    }
                ]
            },
            {
                "dir": "W",
                "queue": [
                    {
                        "kind": "car",
                        "turn": "straight"
                    },
                    {
                        "kind": "truck",
                        "turn": "straight"
                    },
                    {
                        "kind": "car",
                        "turn": "left"
                    }
                ]
            }
        ],
        "signals": {
            "phases": [
                {
                    "green": [
                        "N"
                    ],
                    "ms": 7500
                },
                {
                    "green": [
                        "E",
                        "W"
                    ],
                    "ms": 7500
                }
            ],
            "offsetMs": 2500
        },
        "tip": "Faqat yashil chiroqda yuboring. Yashilda chapga buriluvchi qarshidagiga yo‘l beradi.",
        "ambience": "rain",
        "parMs": 18000
    },
    {
        "id": 27,
        "name": "Tungi rejim",
        "band": "complex",
        "junction": "cross",
        "arms": [
            {
                "dir": "N",
                "sign": "main",
                "queue": [
                    {
                        "kind": "truck",
                        "turn": "straight"
                    },
                    {
                        "kind": "car",
                        "turn": "straight"
                    }
                ]
            },
            {
                "dir": "E",
                "sign": "yield",
                "queue": [
                    {
                        "kind": "police",
                        "turn": "straight"
                    },
                    {
                        "kind": "car",
                        "turn": "left"
                    }
                ]
            },
            {
                "dir": "S",
                "sign": "main",
                "queue": [
                    {
                        "kind": "car",
                        "turn": "left"
                    },
                    {
                        "kind": "taxi",
                        "turn": "left"
                    },
                    {
                        "kind": "car",
                        "turn": "straight"
                    }
                ]
            },
            {
                "dir": "W",
                "sign": "yield",
                "queue": [
                    {
                        "kind": "car",
                        "turn": "right"
                    },
                    {
                        "kind": "car",
                        "turn": "straight"
                    }
                ]
            }
        ],
        "signals": {
            "phases": [
                {
                    "green": [
                        "N",
                        "S"
                    ],
                    "ms": 7000
                },
                {
                    "green": [
                        "E",
                        "W"
                    ],
                    "ms": 7000
                }
            ],
            "offsetMs": 1000,
            "flashing": [
                {
                    "fromMs": 0,
                    "toMs": 14000
                }
            ]
        },
        "intro": {
            "title": "Tungi rejim",
            "text": "Avval svetofor sariq miltillaydi (belgilar ishlaydi), 14 soniyadan keyin esa yoqiladi — endi chiroqqa qarang!"
        },
        "tip": "Faqat yashil chiroqda yuboring. Yashilda chapga buriluvchi qarshidagiga yo‘l beradi.",
        "ambience": "night",
        "parMs": 12500
    },
    {
        "id": 28,
        "name": "Shayxontohur",
        "band": "complex",
        "junction": "cross",
        "arms": [
            {
                "dir": "N",
                "sign": "yield",
                "queue": [
                    {
                        "kind": "car",
                        "turn": "straight"
                    },
                    {
                        "kind": "car",
                        "turn": "straight"
                    },
                    {
                        "kind": "taxi",
                        "turn": "right"
                    }
                ]
            },
            {
                "dir": "E",
                "sign": "main",
                "queue": [
                    {
                        "kind": "car",
                        "turn": "straight"
                    },
                    {
                        "kind": "car",
                        "turn": "left"
                    },
                    {
                        "kind": "car",
                        "turn": "right"
                    }
                ],
                "arrivals": [
                    {
                        "kind": "truck",
                        "turn": "right",
                        "atMs": 10900
                    },
                    {
                        "kind": "car",
                        "turn": "right",
                        "atMs": 15600
                    }
                ]
            },
            {
                "dir": "S",
                "sign": "yield",
                "queue": [
                    {
                        "kind": "car",
                        "turn": "straight"
                    },
                    {
                        "kind": "car",
                        "turn": "straight"
                    },
                    {
                        "kind": "taxi",
                        "turn": "right"
                    }
                ],
                "arrivals": [
                    {
                        "kind": "car",
                        "turn": "left",
                        "atMs": 7900
                    },
                    {
                        "kind": "car",
                        "turn": "straight",
                        "atMs": 13600
                    }
                ]
            },
            {
                "dir": "W",
                "sign": "main",
                "queue": [
                    {
                        "kind": "truck",
                        "turn": "left"
                    },
                    {
                        "kind": "car",
                        "turn": "straight"
                    },
                    {
                        "kind": "car",
                        "turn": "straight"
                    }
                ],
                "arrivals": [
                    {
                        "kind": "car",
                        "turn": "straight",
                        "atMs": 5200
                    }
                ]
            }
        ],
        "tip": "Sariq romb (asosiy yo'l) tomondagilar birinchi. Uchburchak / STOP tomondagilar ularni o'tkazib yuboradi.",
        "ambience": "evening",
        "parMs": 29500
    },
    {
        "id": 29,
        "name": "Yakkasaroy",
        "band": "complex",
        "junction": "cross",
        "arms": [
            {
                "dir": "N",
                "queue": [
                    {
                        "kind": "taxi",
                        "turn": "straight"
                    },
                    {
                        "kind": "car",
                        "turn": "straight"
                    },
                    {
                        "kind": "bus",
                        "turn": "straight"
                    }
                ]
            },
            {
                "dir": "E",
                "queue": [
                    {
                        "kind": "ambulance",
                        "turn": "straight"
                    },
                    {
                        "kind": "car",
                        "turn": "left"
                    }
                ]
            },
            {
                "dir": "S",
                "queue": [
                    {
                        "kind": "car",
                        "turn": "left"
                    },
                    {
                        "kind": "car",
                        "turn": "straight"
                    }
                ],
                "arrivals": [
                    {
                        "kind": "truck",
                        "turn": "straight",
                        "atMs": 5200
                    },
                    {
                        "kind": "ambulance",
                        "turn": "left",
                        "atMs": 7300
                    }
                ]
            },
            {
                "dir": "W",
                "queue": [
                    {
                        "kind": "car",
                        "turn": "straight"
                    },
                    {
                        "kind": "car",
                        "turn": "straight"
                    },
                    {
                        "kind": "car",
                        "turn": "right"
                    }
                ],
                "arrivals": [
                    {
                        "kind": "truck",
                        "turn": "straight",
                        "atMs": 8000
                    },
                    {
                        "kind": "taxi",
                        "turn": "straight",
                        "atMs": 10200
                    },
                    {
                        "kind": "taxi",
                        "turn": "straight",
                        "atMs": 13200
                    }
                ]
            }
        ],
        "signals": {
            "phases": [
                {
                    "green": [
                        "N",
                        "S"
                    ],
                    "ms": 6500
                },
                {
                    "green": [
                        "E",
                        "W"
                    ],
                    "ms": 6500
                }
            ],
            "offsetMs": 2000
        },
        "tip": "Faqat yashil chiroqda yuboring. Yashilda chapga buriluvchi qarshidagiga yo‘l beradi.",
        "ambience": "rain",
        "parMs": 39000
    },
    {
        "id": 30,
        "name": "BOSS: Beshyog‘och",
        "band": "boss",
        "junction": "cross",
        "arms": [
            {
                "dir": "N",
                "queue": [
                    {
                        "kind": "car",
                        "turn": "left"
                    },
                    {
                        "kind": "car",
                        "turn": "straight"
                    },
                    {
                        "kind": "car",
                        "turn": "left"
                    },
                    {
                        "kind": "bus",
                        "turn": "left"
                    }
                ],
                "arrivals": [
                    {
                        "kind": "taxi",
                        "turn": "straight",
                        "atMs": 7700
                    },
                    {
                        "kind": "car",
                        "turn": "left",
                        "atMs": 10500
                    },
                    {
                        "kind": "ambulance",
                        "turn": "left",
                        "atMs": 6800
                    }
                ]
            },
            {
                "dir": "E",
                "queue": [
                    {
                        "kind": "car",
                        "turn": "straight"
                    },
                    {
                        "kind": "car",
                        "turn": "left"
                    },
                    {
                        "kind": "car",
                        "turn": "left"
                    },
                    {
                        "kind": "taxi",
                        "turn": "straight"
                    }
                ],
                "arrivals": [
                    {
                        "kind": "taxi",
                        "turn": "straight",
                        "atMs": 13600
                    },
                    {
                        "kind": "taxi",
                        "turn": "straight",
                        "atMs": 15900
                    }
                ]
            },
            {
                "dir": "S",
                "queue": [
                    {
                        "kind": "car",
                        "turn": "left"
                    },
                    {
                        "kind": "car",
                        "turn": "straight"
                    },
                    {
                        "kind": "car",
                        "turn": "left"
                    },
                    {
                        "kind": "bus",
                        "turn": "straight"
                    }
                ],
                "arrivals": [
                    {
                        "kind": "bus",
                        "turn": "right",
                        "atMs": 5200
                    },
                    {
                        "kind": "car",
                        "turn": "left",
                        "atMs": 18000
                    }
                ]
            },
            {
                "dir": "W",
                "queue": [
                    {
                        "kind": "bus",
                        "turn": "right"
                    },
                    {
                        "kind": "bus",
                        "turn": "straight"
                    },
                    {
                        "kind": "car",
                        "turn": "right"
                    },
                    {
                        "kind": "car",
                        "turn": "straight"
                    }
                ]
            }
        ],
        "controller": {
            "poses": [
                {
                    "gesture": "right_forward",
                    "facing": "S",
                    "ms": 4500
                },
                {
                    "gesture": "arm_up",
                    "facing": "S",
                    "ms": 1200
                },
                {
                    "gesture": "arms_side",
                    "facing": "N",
                    "ms": 4500
                },
                {
                    "gesture": "arm_up",
                    "facing": "N",
                    "ms": 1200
                },
                {
                    "gesture": "right_forward",
                    "facing": "W",
                    "ms": 4500
                },
                {
                    "gesture": "arm_up",
                    "facing": "W",
                    "ms": 1200
                },
                {
                    "gesture": "arms_side",
                    "facing": "E",
                    "ms": 4500
                },
                {
                    "gesture": "arm_up",
                    "facing": "E",
                    "ms": 1200
                },
                {
                    "gesture": "right_forward",
                    "facing": "N",
                    "ms": 4500
                },
                {
                    "gesture": "arm_up",
                    "facing": "N",
                    "ms": 1200
                },
                {
                    "gesture": "right_forward",
                    "facing": "E",
                    "ms": 4500
                },
                {
                    "gesture": "arm_up",
                    "facing": "E",
                    "ms": 1200
                }
            ]
        },
        "tip": "Boshqaruvchining ko'kragi qaragan tomonga va qo'llariga qarang.",
        "ambience": "night",
        "parMs": 83500
    },
    {
        "id": 31,
        "name": "Aylanma harakat",
        "band": "roundabout",
        "junction": "roundabout",
        "arms": [
            {
                "dir": "N",
                "sign": "none",
                "queue": [
                    {
                        "kind": "car",
                        "turn": "straight"
                    }
                ]
            },
            {
                "dir": "E",
                "sign": "none",
                "queue": [
                    {
                        "kind": "car",
                        "turn": "left"
                    }
                ]
            },
            {
                "dir": "S",
                "sign": "none",
                "queue": [
                    {
                        "kind": "car",
                        "turn": "right"
                    }
                ]
            },
            {
                "dir": "W",
                "sign": "none",
                "queue": [
                    {
                        "kind": "car",
                        "turn": "straight"
                    }
                ]
            }
        ],
        "intro": {
            "title": "31-dars: Aylanma harakat",
            "text": "Aylanmaga kirayotgan mashina HALQADA harakatlanayotganlarga yo'l beradi. Halqaga kirgan mashina ustun. Bo'sh \"oyna\"ni kutib, keyin yuboring. Kutayotganlar o'zaro teng."
        },
        "coach": [
            {
                "vehicle": "S0",
                "text": "Aylanmada hamma soat miliga teskari yuradi. O'ngga buriluvchining yo'li eng qisqa."
            },
            {
                "vehicle": "N0",
                "text": "Halqada hozir xalaqit beradigan mashina yo'q — kiring."
            },
            {
                "vehicle": "E0",
                "text": "Halqadagi mashina o'tib ketgach kiring — bo'sh oynani kuting."
            },
            {
                "vehicle": "W0",
                "text": "Oxirgisi: halqa bo'shashini kuting va yuboring."
            }
        ],
        "parMs": 11000
    },
    {
        "id": 32,
        "name": "Kichik halqa",
        "band": "roundabout",
        "junction": "roundabout",
        "arms": [
            {
                "dir": "N",
                "queue": [
                    {
                        "kind": "truck",
                        "turn": "right"
                    },
                    {
                        "kind": "car",
                        "turn": "right"
                    }
                ]
            },
            {
                "dir": "E",
                "queue": [
                    {
                        "kind": "car",
                        "turn": "straight"
                    }
                ]
            },
            {
                "dir": "S",
                "queue": [
                    {
                        "kind": "car",
                        "turn": "left"
                    }
                ]
            },
            {
                "dir": "W",
                "queue": [
                    {
                        "kind": "car",
                        "turn": "right"
                    },
                    {
                        "kind": "car",
                        "turn": "straight"
                    }
                ]
            }
        ],
        "tip": "Halqadagi mashina o'tib ketgach, bo'sh oynaga yuboring.",
        "parMs": 11000
    },
    {
        "id": 33,
        "name": "Uch yo‘lli halqa",
        "band": "roundabout",
        "junction": "roundabout",
        "arms": [
            {
                "dir": "N",
                "queue": [
                    {
                        "kind": "car",
                        "turn": "straight"
                    },
                    {
                        "kind": "bus",
                        "turn": "left"
                    }
                ]
            },
            {
                "dir": "E",
                "queue": [
                    {
                        "kind": "bus",
                        "turn": "right"
                    },
                    {
                        "kind": "taxi",
                        "turn": "right"
                    }
                ]
            },
            {
                "dir": "S",
                "queue": [
                    {
                        "kind": "car",
                        "turn": "straight"
                    },
                    {
                        "kind": "car",
                        "turn": "right"
                    }
                ]
            }
        ],
        "tip": "Halqadagi mashina o'tib ketgach, bo'sh oynaga yuboring.",
        "parMs": 9500
    },
    {
        "id": 34,
        "name": "Uchtepa aylanasi",
        "band": "roundabout",
        "junction": "roundabout",
        "arms": [
            {
                "dir": "N",
                "queue": [
                    {
                        "kind": "taxi",
                        "turn": "straight"
                    },
                    {
                        "kind": "car",
                        "turn": "left"
                    }
                ]
            },
            {
                "dir": "E",
                "queue": [
                    {
                        "kind": "car",
                        "turn": "right"
                    },
                    {
                        "kind": "truck",
                        "turn": "straight"
                    }
                ]
            },
            {
                "dir": "S",
                "queue": [
                    {
                        "kind": "car",
                        "turn": "straight"
                    },
                    {
                        "kind": "car",
                        "turn": "straight"
                    }
                ],
                "arrivals": [
                    {
                        "kind": "bus",
                        "turn": "left",
                        "atMs": 5500
                    },
                    {
                        "kind": "taxi",
                        "turn": "straight",
                        "atMs": 8300
                    }
                ]
            },
            {
                "dir": "W",
                "queue": [
                    {
                        "kind": "car",
                        "turn": "left"
                    },
                    {
                        "kind": "car",
                        "turn": "left"
                    }
                ],
                "arrivals": [
                    {
                        "kind": "car",
                        "turn": "right",
                        "atMs": 10200
                    }
                ]
            }
        ],
        "tip": "Halqadagi mashina o'tib ketgach, bo'sh oynaga yuboring.",
        "parMs": 23000
    },
    {
        "id": 35,
        "name": "Bektemir aylanasi",
        "band": "roundabout",
        "junction": "roundabout",
        "arms": [
            {
                "dir": "N",
                "queue": [
                    {
                        "kind": "car",
                        "turn": "right"
                    },
                    {
                        "kind": "taxi",
                        "turn": "left"
                    }
                ]
            },
            {
                "dir": "E",
                "queue": [
                    {
                        "kind": "truck",
                        "turn": "straight"
                    },
                    {
                        "kind": "car",
                        "turn": "left"
                    },
                    {
                        "kind": "car",
                        "turn": "straight"
                    }
                ]
            },
            {
                "dir": "S",
                "queue": [
                    {
                        "kind": "bus",
                        "turn": "left"
                    },
                    {
                        "kind": "taxi",
                        "turn": "straight"
                    }
                ]
            },
            {
                "dir": "W",
                "queue": [
                    {
                        "kind": "car",
                        "turn": "right"
                    },
                    {
                        "kind": "car",
                        "turn": "left"
                    },
                    {
                        "kind": "car",
                        "turn": "right"
                    }
                ]
            }
        ],
        "tip": "Halqadagi mashina o'tib ketgach, bo'sh oynaga yuboring.",
        "parMs": 15500
    },
    {
        "id": 36,
        "name": "Aylanmada tez yordam",
        "band": "roundabout",
        "junction": "roundabout",
        "arms": [
            {
                "dir": "N",
                "sign": "none",
                "queue": [
                    {
                        "kind": "car",
                        "turn": "straight"
                    },
                    {
                        "kind": "car",
                        "turn": "right"
                    }
                ]
            },
            {
                "dir": "E",
                "sign": "none",
                "queue": [
                    {
                        "kind": "ambulance",
                        "turn": "left"
                    }
                ]
            },
            {
                "dir": "S",
                "sign": "none",
                "queue": [
                    {
                        "kind": "car",
                        "turn": "straight"
                    }
                ]
            },
            {
                "dir": "W",
                "sign": "none",
                "queue": [
                    {
                        "kind": "car",
                        "turn": "left"
                    },
                    {
                        "kind": "car",
                        "turn": "straight"
                    }
                ]
            }
        ],
        "ambience": "rain",
        "parMs": 12000
    },
    {
        "id": 37,
        "name": "Qo‘yliq halqasi",
        "band": "roundabout",
        "junction": "roundabout",
        "arms": [
            {
                "dir": "N",
                "queue": [
                    {
                        "kind": "car",
                        "turn": "straight"
                    },
                    {
                        "kind": "taxi",
                        "turn": "right"
                    }
                ],
                "arrivals": [
                    {
                        "kind": "car",
                        "turn": "straight",
                        "atMs": 11000
                    }
                ]
            },
            {
                "dir": "S",
                "queue": [
                    {
                        "kind": "car",
                        "turn": "straight"
                    },
                    {
                        "kind": "car",
                        "turn": "straight"
                    },
                    {
                        "kind": "truck",
                        "turn": "straight"
                    }
                ],
                "arrivals": [
                    {
                        "kind": "car",
                        "turn": "left",
                        "atMs": 7700
                    },
                    {
                        "kind": "bus",
                        "turn": "straight",
                        "atMs": 13500
                    }
                ]
            },
            {
                "dir": "W",
                "queue": [
                    {
                        "kind": "taxi",
                        "turn": "right"
                    },
                    {
                        "kind": "car",
                        "turn": "left"
                    },
                    {
                        "kind": "car",
                        "turn": "left"
                    }
                ],
                "arrivals": [
                    {
                        "kind": "car",
                        "turn": "right",
                        "atMs": 5200
                    }
                ]
            }
        ],
        "tip": "Halqadagi mashina o'tib ketgach, bo'sh oynaga yuboring.",
        "ambience": "evening",
        "parMs": 28500
    },
    {
        "id": 38,
        "name": "Oqtepa aylanasi",
        "band": "roundabout",
        "junction": "roundabout",
        "arms": [
            {
                "dir": "N",
                "queue": [
                    {
                        "kind": "car",
                        "turn": "left"
                    },
                    {
                        "kind": "taxi",
                        "turn": "straight"
                    },
                    {
                        "kind": "car",
                        "turn": "straight"
                    }
                ]
            },
            {
                "dir": "E",
                "queue": [
                    {
                        "kind": "bus",
                        "turn": "right"
                    },
                    {
                        "kind": "car",
                        "turn": "straight"
                    },
                    {
                        "kind": "car",
                        "turn": "left"
                    }
                ]
            },
            {
                "dir": "S",
                "queue": [
                    {
                        "kind": "car",
                        "turn": "straight"
                    },
                    {
                        "kind": "truck",
                        "turn": "right"
                    },
                    {
                        "kind": "car",
                        "turn": "left"
                    }
                ]
            },
            {
                "dir": "W",
                "queue": [
                    {
                        "kind": "ambulance",
                        "turn": "straight"
                    },
                    {
                        "kind": "car",
                        "turn": "straight"
                    },
                    {
                        "kind": "car",
                        "turn": "left"
                    }
                ]
            }
        ],
        "tip": "Halqadagi mashina o'tib ketgach, bo'sh oynaga yuboring.",
        "parMs": 19000
    },
    {
        "id": 39,
        "name": "Bodomzor aylanasi",
        "band": "roundabout",
        "junction": "roundabout",
        "arms": [
            {
                "dir": "N",
                "queue": [
                    {
                        "kind": "car",
                        "turn": "straight"
                    },
                    {
                        "kind": "car",
                        "turn": "straight"
                    },
                    {
                        "kind": "car",
                        "turn": "straight"
                    }
                ],
                "arrivals": [
                    {
                        "kind": "taxi",
                        "turn": "left",
                        "atMs": 5300
                    },
                    {
                        "kind": "taxi",
                        "turn": "straight",
                        "atMs": 13000
                    }
                ]
            },
            {
                "dir": "E",
                "queue": [
                    {
                        "kind": "car",
                        "turn": "left"
                    },
                    {
                        "kind": "taxi",
                        "turn": "straight"
                    },
                    {
                        "kind": "bus",
                        "turn": "right"
                    }
                ],
                "arrivals": [
                    {
                        "kind": "car",
                        "turn": "left",
                        "atMs": 7800
                    }
                ]
            },
            {
                "dir": "S",
                "queue": [
                    {
                        "kind": "truck",
                        "turn": "left"
                    },
                    {
                        "kind": "bus",
                        "turn": "left"
                    },
                    {
                        "kind": "car",
                        "turn": "straight"
                    }
                ]
            },
            {
                "dir": "W",
                "queue": [
                    {
                        "kind": "car",
                        "turn": "straight"
                    },
                    {
                        "kind": "car",
                        "turn": "left"
                    },
                    {
                        "kind": "car",
                        "turn": "left"
                    }
                ],
                "arrivals": [
                    {
                        "kind": "truck",
                        "turn": "straight",
                        "atMs": 11000
                    }
                ]
            }
        ],
        "tip": "Halqadagi mashina o'tib ketgach, bo'sh oynaga yuboring.",
        "ambience": "rain",
        "parMs": 28000
    },
    {
        "id": 40,
        "name": "BOSS: Katta regulirovshik",
        "band": "boss",
        "junction": "cross",
        "arms": [
            {
                "dir": "N",
                "queue": [
                    {
                        "kind": "car",
                        "turn": "right"
                    },
                    {
                        "kind": "bus",
                        "turn": "straight"
                    },
                    {
                        "kind": "taxi",
                        "turn": "right"
                    },
                    {
                        "kind": "truck",
                        "turn": "left"
                    }
                ],
                "arrivals": [
                    {
                        "kind": "car",
                        "turn": "left",
                        "atMs": 20600
                    }
                ]
            },
            {
                "dir": "E",
                "queue": [
                    {
                        "kind": "car",
                        "turn": "left"
                    },
                    {
                        "kind": "car",
                        "turn": "left"
                    },
                    {
                        "kind": "car",
                        "turn": "right"
                    },
                    {
                        "kind": "car",
                        "turn": "straight"
                    }
                ],
                "arrivals": [
                    {
                        "kind": "car",
                        "turn": "right",
                        "atMs": 5000
                    },
                    {
                        "kind": "bus",
                        "turn": "straight",
                        "atMs": 13600
                    },
                    {
                        "kind": "car",
                        "turn": "right",
                        "atMs": 15700
                    }
                ]
            },
            {
                "dir": "S",
                "queue": [
                    {
                        "kind": "truck",
                        "turn": "right"
                    },
                    {
                        "kind": "bus",
                        "turn": "straight"
                    },
                    {
                        "kind": "taxi",
                        "turn": "straight"
                    },
                    {
                        "kind": "taxi",
                        "turn": "straight"
                    }
                ],
                "arrivals": [
                    {
                        "kind": "bus",
                        "turn": "straight",
                        "atMs": 8400
                    },
                    {
                        "kind": "car",
                        "turn": "left",
                        "atMs": 23900
                    },
                    {
                        "kind": "ambulance",
                        "turn": "left",
                        "atMs": 6500
                    }
                ]
            },
            {
                "dir": "W",
                "queue": [
                    {
                        "kind": "car",
                        "turn": "straight"
                    },
                    {
                        "kind": "ambulance",
                        "turn": "straight"
                    },
                    {
                        "kind": "car",
                        "turn": "left"
                    },
                    {
                        "kind": "car",
                        "turn": "straight"
                    }
                ],
                "arrivals": [
                    {
                        "kind": "car",
                        "turn": "straight",
                        "atMs": 10700
                    },
                    {
                        "kind": "taxi",
                        "turn": "right",
                        "atMs": 18300
                    }
                ]
            }
        ],
        "controller": {
            "poses": [
                {
                    "gesture": "arms_side",
                    "facing": "E",
                    "ms": 4000
                },
                {
                    "gesture": "arm_up",
                    "facing": "E",
                    "ms": 1000
                },
                {
                    "gesture": "right_forward",
                    "facing": "N",
                    "ms": 4000
                },
                {
                    "gesture": "arm_up",
                    "facing": "N",
                    "ms": 1000
                },
                {
                    "gesture": "right_forward",
                    "facing": "E",
                    "ms": 4000
                },
                {
                    "gesture": "arm_up",
                    "facing": "E",
                    "ms": 1000
                },
                {
                    "gesture": "arms_side",
                    "facing": "N",
                    "ms": 4000
                },
                {
                    "gesture": "arm_up",
                    "facing": "N",
                    "ms": 1000
                },
                {
                    "gesture": "right_forward",
                    "facing": "S",
                    "ms": 4000
                },
                {
                    "gesture": "arm_up",
                    "facing": "S",
                    "ms": 1000
                },
                {
                    "gesture": "right_forward",
                    "facing": "W",
                    "ms": 4000
                },
                {
                    "gesture": "arm_up",
                    "facing": "W",
                    "ms": 1000
                }
            ]
        },
        "tip": "Boshqaruvchining ko'kragi qaragan tomonga va qo'llariga qarang.",
        "ambience": "evening",
        "parMs": 62500
    },
    {
        "id": 41,
        "name": "Trassa: Halqa yo‘li",
        "band": "roundabout",
        "junction": "roundabout",
        "arms": [
            {
                "dir": "N",
                "queue": [
                    {
                        "kind": "car",
                        "turn": "right"
                    },
                    {
                        "kind": "car",
                        "turn": "left"
                    },
                    {
                        "kind": "truck",
                        "turn": "left"
                    }
                ]
            },
            {
                "dir": "E",
                "queue": [
                    {
                        "kind": "truck",
                        "turn": "left"
                    },
                    {
                        "kind": "car",
                        "turn": "right"
                    },
                    {
                        "kind": "police",
                        "turn": "left"
                    }
                ]
            },
            {
                "dir": "S",
                "queue": [
                    {
                        "kind": "car",
                        "turn": "straight"
                    },
                    {
                        "kind": "car",
                        "turn": "straight"
                    },
                    {
                        "kind": "police",
                        "turn": "left"
                    }
                ],
                "arrivals": [
                    {
                        "kind": "police",
                        "turn": "straight",
                        "atMs": 10400
                    },
                    {
                        "kind": "car",
                        "turn": "straight",
                        "atMs": 13300
                    },
                    {
                        "kind": "car",
                        "turn": "straight",
                        "atMs": 16100
                    },
                    {
                        "kind": "police",
                        "turn": "left",
                        "atMs": 18500
                    }
                ]
            },
            {
                "dir": "W",
                "queue": [
                    {
                        "kind": "car",
                        "turn": "left"
                    },
                    {
                        "kind": "car",
                        "turn": "straight"
                    },
                    {
                        "kind": "car",
                        "turn": "left"
                    }
                ],
                "arrivals": [
                    {
                        "kind": "police",
                        "turn": "left",
                        "atMs": 5800
                    },
                    {
                        "kind": "car",
                        "turn": "right",
                        "atMs": 7600
                    }
                ]
            }
        ],
        "tip": "Halqadagi mashina o'tib ketgach, bo'sh oynaga yuboring.",
        "parMs": 36000
    },
    {
        "id": 42,
        "name": "Trassa: O‘chgan svetofor",
        "band": "complex",
        "junction": "cross",
        "arms": [
            {
                "dir": "N",
                "sign": "stop",
                "queue": [
                    {
                        "kind": "car",
                        "turn": "straight"
                    },
                    {
                        "kind": "taxi",
                        "turn": "straight"
                    },
                    {
                        "kind": "taxi",
                        "turn": "right"
                    }
                ],
                "arrivals": [
                    {
                        "kind": "police",
                        "turn": "straight",
                        "atMs": 11000
                    }
                ]
            },
            {
                "dir": "E",
                "sign": "main",
                "queue": [
                    {
                        "kind": "car",
                        "turn": "left"
                    },
                    {
                        "kind": "taxi",
                        "turn": "straight"
                    },
                    {
                        "kind": "truck",
                        "turn": "straight"
                    }
                ],
                "arrivals": [
                    {
                        "kind": "bus",
                        "turn": "left",
                        "atMs": 5100
                    },
                    {
                        "kind": "police",
                        "turn": "straight",
                        "atMs": 8000
                    },
                    {
                        "kind": "truck",
                        "turn": "right",
                        "atMs": 12900
                    }
                ]
            },
            {
                "dir": "S",
                "sign": "stop",
                "queue": [
                    {
                        "kind": "car",
                        "turn": "left"
                    },
                    {
                        "kind": "car",
                        "turn": "straight"
                    },
                    {
                        "kind": "car",
                        "turn": "straight"
                    }
                ]
            },
            {
                "dir": "W",
                "sign": "main",
                "queue": [
                    {
                        "kind": "car",
                        "turn": "straight"
                    },
                    {
                        "kind": "car",
                        "turn": "straight"
                    },
                    {
                        "kind": "car",
                        "turn": "right"
                    }
                ]
            }
        ],
        "signals": {
            "phases": [
                {
                    "green": [
                        "N",
                        "S"
                    ],
                    "ms": 6500
                },
                {
                    "green": [
                        "E",
                        "W"
                    ],
                    "ms": 6500
                }
            ],
            "offsetMs": 3000,
            "flashing": [
                {
                    "fromMs": 20000,
                    "toMs": 36000
                }
            ]
        },
        "tip": "Svetofor 20-soniyada o‘chadi (sariq miltillaydi) — o‘shanda belgilarga o‘ting!",
        "ambience": "night",
        "parMs": 30500
    },
    {
        "id": 43,
        "name": "Trassa: Sirenalar",
        "band": "complex",
        "junction": "cross",
        "arms": [
            {
                "dir": "N",
                "sign": "main",
                "queue": [
                    {
                        "kind": "truck",
                        "turn": "left"
                    },
                    {
                        "kind": "bus",
                        "turn": "left"
                    },
                    {
                        "kind": "car",
                        "turn": "straight"
                    }
                ],
                "arrivals": [
                    {
                        "kind": "taxi",
                        "turn": "straight",
                        "atMs": 8400
                    }
                ]
            },
            {
                "dir": "E",
                "sign": "stop",
                "queue": [
                    {
                        "kind": "car",
                        "turn": "straight"
                    },
                    {
                        "kind": "car",
                        "turn": "straight"
                    },
                    {
                        "kind": "car",
                        "turn": "straight"
                    }
                ],
                "arrivals": [
                    {
                        "kind": "car",
                        "turn": "straight",
                        "atMs": 5300
                    },
                    {
                        "kind": "ambulance",
                        "turn": "left",
                        "atMs": 6600
                    }
                ]
            },
            {
                "dir": "S",
                "sign": "main",
                "queue": [
                    {
                        "kind": "car",
                        "turn": "straight"
                    },
                    {
                        "kind": "fire",
                        "turn": "right"
                    },
                    {
                        "kind": "car",
                        "turn": "straight"
                    }
                ],
                "arrivals": [
                    {
                        "kind": "car",
                        "turn": "right",
                        "atMs": 13600
                    }
                ]
            },
            {
                "dir": "W",
                "sign": "stop",
                "queue": [
                    {
                        "kind": "police",
                        "turn": "straight"
                    },
                    {
                        "kind": "car",
                        "turn": "straight"
                    },
                    {
                        "kind": "police",
                        "turn": "left"
                    }
                ],
                "arrivals": [
                    {
                        "kind": "car",
                        "turn": "right",
                        "atMs": 10200
                    }
                ]
            }
        ],
        "tip": "Sariq romb (asosiy yo'l) tomondagilar birinchi. Uchburchak / STOP tomondagilar ularni o'tkazib yuboradi.",
        "ambience": "rain",
        "parMs": 27000
    },
    {
        "id": 44,
        "name": "Trassa: Uch yo‘l",
        "band": "roundabout",
        "junction": "roundabout",
        "arms": [
            {
                "dir": "N",
                "queue": [
                    {
                        "kind": "taxi",
                        "turn": "straight"
                    },
                    {
                        "kind": "truck",
                        "turn": "straight"
                    },
                    {
                        "kind": "car",
                        "turn": "straight"
                    }
                ],
                "arrivals": [
                    {
                        "kind": "car",
                        "turn": "right",
                        "atMs": 13200
                    }
                ]
            },
            {
                "dir": "S",
                "queue": [
                    {
                        "kind": "car",
                        "turn": "left"
                    },
                    {
                        "kind": "car",
                        "turn": "straight"
                    },
                    {
                        "kind": "truck",
                        "turn": "straight"
                    }
                ],
                "arrivals": [
                    {
                        "kind": "taxi",
                        "turn": "left",
                        "atMs": 8300
                    },
                    {
                        "kind": "truck",
                        "turn": "straight",
                        "atMs": 10700
                    },
                    {
                        "kind": "car",
                        "turn": "left",
                        "atMs": 15400
                    },
                    {
                        "kind": "truck",
                        "turn": "left",
                        "atMs": 18200
                    }
                ]
            },
            {
                "dir": "W",
                "queue": [
                    {
                        "kind": "truck",
                        "turn": "right"
                    },
                    {
                        "kind": "truck",
                        "turn": "left"
                    },
                    {
                        "kind": "car",
                        "turn": "right"
                    }
                ],
                "arrivals": [
                    {
                        "kind": "truck",
                        "turn": "left",
                        "atMs": 5600
                    }
                ]
            }
        ],
        "tip": "Halqadagi mashina o'tib ketgach, bo'sh oynaga yuboring.",
        "ambience": "evening",
        "parMs": 35500
    },
    {
        "id": 45,
        "name": "Trassa: Svetoforli T",
        "band": "complex",
        "junction": "t",
        "arms": [
            {
                "dir": "E",
                "queue": [
                    {
                        "kind": "car",
                        "turn": "straight"
                    },
                    {
                        "kind": "car",
                        "turn": "straight"
                    },
                    {
                        "kind": "car",
                        "turn": "left"
                    }
                ],
                "arrivals": [
                    {
                        "kind": "truck",
                        "turn": "straight",
                        "atMs": 8300
                    }
                ]
            },
            {
                "dir": "S",
                "queue": [
                    {
                        "kind": "car",
                        "turn": "left"
                    },
                    {
                        "kind": "taxi",
                        "turn": "left"
                    },
                    {
                        "kind": "car",
                        "turn": "left"
                    }
                ],
                "arrivals": [
                    {
                        "kind": "car",
                        "turn": "right",
                        "atMs": 5500
                    },
                    {
                        "kind": "car",
                        "turn": "right",
                        "atMs": 13200
                    },
                    {
                        "kind": "car",
                        "turn": "left",
                        "atMs": 15400
                    }
                ]
            },
            {
                "dir": "W",
                "queue": [
                    {
                        "kind": "car",
                        "turn": "right"
                    },
                    {
                        "kind": "police",
                        "turn": "straight"
                    },
                    {
                        "kind": "car",
                        "turn": "right"
                    }
                ],
                "arrivals": [
                    {
                        "kind": "car",
                        "turn": "right",
                        "atMs": 10500
                    }
                ]
            }
        ],
        "signals": {
            "phases": [
                {
                    "green": [
                        "S"
                    ],
                    "ms": 7500
                },
                {
                    "green": [
                        "E",
                        "W"
                    ],
                    "ms": 7500
                }
            ],
            "offsetMs": 1500
        },
        "tip": "Faqat yashil chiroqda yuboring. Yashilda chapga buriluvchi qarshidagiga yo‘l beradi.",
        "parMs": 32000
    },
    {
        "id": 46,
        "name": "Trassa: Halqada sirena",
        "band": "roundabout",
        "junction": "roundabout",
        "arms": [
            {
                "dir": "N",
                "queue": [
                    {
                        "kind": "truck",
                        "turn": "right"
                    },
                    {
                        "kind": "car",
                        "turn": "straight"
                    },
                    {
                        "kind": "car",
                        "turn": "straight"
                    }
                ],
                "arrivals": [
                    {
                        "kind": "bus",
                        "turn": "left",
                        "atMs": 5300
                    }
                ]
            },
            {
                "dir": "E",
                "queue": [
                    {
                        "kind": "truck",
                        "turn": "right"
                    },
                    {
                        "kind": "car",
                        "turn": "right"
                    },
                    {
                        "kind": "car",
                        "turn": "straight"
                    }
                ],
                "arrivals": [
                    {
                        "kind": "car",
                        "turn": "right",
                        "atMs": 10300
                    },
                    {
                        "kind": "truck",
                        "turn": "straight",
                        "atMs": 15600
                    }
                ]
            },
            {
                "dir": "S",
                "queue": [
                    {
                        "kind": "car",
                        "turn": "left"
                    },
                    {
                        "kind": "car",
                        "turn": "right"
                    },
                    {
                        "kind": "taxi",
                        "turn": "straight"
                    }
                ],
                "arrivals": [
                    {
                        "kind": "car",
                        "turn": "right",
                        "atMs": 7700
                    },
                    {
                        "kind": "car",
                        "turn": "straight",
                        "atMs": 12900
                    },
                    {
                        "kind": "ambulance",
                        "turn": "straight",
                        "atMs": 6900
                    }
                ]
            },
            {
                "dir": "W",
                "queue": [
                    {
                        "kind": "fire",
                        "turn": "left"
                    },
                    {
                        "kind": "car",
                        "turn": "straight"
                    },
                    {
                        "kind": "car",
                        "turn": "straight"
                    }
                ]
            }
        ],
        "tip": "Halqadagi mashina o'tib ketgach, bo'sh oynaga yuboring.",
        "ambience": "night",
        "parMs": 31000
    },
    {
        "id": 47,
        "name": "Trassa: Buyuk Ipak yo‘li",
        "band": "complex",
        "junction": "cross",
        "arms": [
            {
                "dir": "N",
                "sign": "main",
                "queue": [
                    {
                        "kind": "car",
                        "turn": "straight"
                    },
                    {
                        "kind": "car",
                        "turn": "straight"
                    },
                    {
                        "kind": "truck",
                        "turn": "straight"
                    },
                    {
                        "kind": "truck",
                        "turn": "right"
                    }
                ],
                "arrivals": [
                    {
                        "kind": "car",
                        "turn": "straight",
                        "atMs": 5300
                    }
                ]
            },
            {
                "dir": "E",
                "sign": "yield",
                "queue": [
                    {
                        "kind": "car",
                        "turn": "straight"
                    },
                    {
                        "kind": "police",
                        "turn": "straight"
                    },
                    {
                        "kind": "car",
                        "turn": "left"
                    },
                    {
                        "kind": "car",
                        "turn": "right"
                    }
                ],
                "arrivals": [
                    {
                        "kind": "truck",
                        "turn": "straight",
                        "atMs": 13400
                    },
                    {
                        "kind": "bus",
                        "turn": "right",
                        "atMs": 15900
                    }
                ]
            },
            {
                "dir": "S",
                "sign": "main",
                "queue": [
                    {
                        "kind": "car",
                        "turn": "left"
                    },
                    {
                        "kind": "car",
                        "turn": "left"
                    },
                    {
                        "kind": "car",
                        "turn": "right"
                    }
                ],
                "arrivals": [
                    {
                        "kind": "car",
                        "turn": "right",
                        "atMs": 7600
                    },
                    {
                        "kind": "bus",
                        "turn": "straight",
                        "atMs": 10400
                    },
                    {
                        "kind": "car",
                        "turn": "left",
                        "atMs": 18700
                    }
                ]
            },
            {
                "dir": "W",
                "sign": "yield",
                "queue": [
                    {
                        "kind": "bus",
                        "turn": "straight"
                    },
                    {
                        "kind": "car",
                        "turn": "left"
                    },
                    {
                        "kind": "car",
                        "turn": "straight"
                    },
                    {
                        "kind": "car",
                        "turn": "right"
                    }
                ]
            }
        ],
        "tip": "Sariq romb (asosiy yo'l) tomondagilar birinchi. Uchburchak / STOP tomondagilar ularni o'tkazib yuboradi.",
        "ambience": "evening",
        "parMs": 34000
    },
    {
        "id": 48,
        "name": "Trassa: Har kimga navbat",
        "band": "complex",
        "junction": "cross",
        "arms": [
            {
                "dir": "N",
                "queue": [
                    {
                        "kind": "bus",
                        "turn": "left"
                    },
                    {
                        "kind": "car",
                        "turn": "straight"
                    },
                    {
                        "kind": "car",
                        "turn": "left"
                    }
                ],
                "arrivals": [
                    {
                        "kind": "car",
                        "turn": "right",
                        "atMs": 10800
                    },
                    {
                        "kind": "car",
                        "turn": "straight",
                        "atMs": 13000
                    }
                ]
            },
            {
                "dir": "E",
                "queue": [
                    {
                        "kind": "taxi",
                        "turn": "left"
                    },
                    {
                        "kind": "car",
                        "turn": "straight"
                    },
                    {
                        "kind": "car",
                        "turn": "left"
                    }
                ],
                "arrivals": [
                    {
                        "kind": "car",
                        "turn": "right",
                        "atMs": 5700
                    }
                ]
            },
            {
                "dir": "S",
                "queue": [
                    {
                        "kind": "car",
                        "turn": "left"
                    },
                    {
                        "kind": "bus",
                        "turn": "left"
                    },
                    {
                        "kind": "truck",
                        "turn": "right"
                    }
                ]
            },
            {
                "dir": "W",
                "queue": [
                    {
                        "kind": "car",
                        "turn": "left"
                    },
                    {
                        "kind": "taxi",
                        "turn": "straight"
                    },
                    {
                        "kind": "car",
                        "turn": "left"
                    }
                ],
                "arrivals": [
                    {
                        "kind": "car",
                        "turn": "left",
                        "atMs": 7600
                    }
                ]
            }
        ],
        "signals": {
            "phases": [
                {
                    "green": [
                        "N"
                    ],
                    "ms": 4500
                },
                {
                    "green": [
                        "E"
                    ],
                    "ms": 4500
                },
                {
                    "green": [
                        "S"
                    ],
                    "ms": 4500
                },
                {
                    "green": [
                        "W"
                    ],
                    "ms": 4500
                }
            ],
            "offsetMs": 3000
        },
        "intro": {
            "title": "To‘rt fazali svetofor",
            "text": "Har bir yo‘l alohida yashil oladi. Faqat yashil yo‘lni yuboring."
        },
        "tip": "Faqat yashil chiroqda yuboring. Yashilda chapga buriluvchi qarshidagiga yo‘l beradi.",
        "parMs": 47500
    },
    {
        "id": 49,
        "name": "Trassa: Katta halqa",
        "band": "roundabout",
        "junction": "roundabout",
        "arms": [
            {
                "dir": "N",
                "queue": [
                    {
                        "kind": "car",
                        "turn": "right"
                    },
                    {
                        "kind": "car",
                        "turn": "left"
                    },
                    {
                        "kind": "car",
                        "turn": "straight"
                    },
                    {
                        "kind": "car",
                        "turn": "straight"
                    }
                ],
                "arrivals": [
                    {
                        "kind": "bus",
                        "turn": "straight",
                        "atMs": 13100
                    }
                ]
            },
            {
                "dir": "E",
                "queue": [
                    {
                        "kind": "car",
                        "turn": "straight"
                    },
                    {
                        "kind": "car",
                        "turn": "right"
                    },
                    {
                        "kind": "car",
                        "turn": "straight"
                    }
                ],
                "arrivals": [
                    {
                        "kind": "police",
                        "turn": "right",
                        "atMs": 18100
                    }
                ]
            },
            {
                "dir": "S",
                "queue": [
                    {
                        "kind": "car",
                        "turn": "straight"
                    },
                    {
                        "kind": "car",
                        "turn": "right"
                    },
                    {
                        "kind": "car",
                        "turn": "left"
                    }
                ],
                "arrivals": [
                    {
                        "kind": "car",
                        "turn": "straight",
                        "atMs": 5700
                    },
                    {
                        "kind": "car",
                        "turn": "left",
                        "atMs": 8400
                    },
                    {
                        "kind": "car",
                        "turn": "left",
                        "atMs": 10900
                    },
                    {
                        "kind": "bus",
                        "turn": "straight",
                        "atMs": 15400
                    },
                    {
                        "kind": "car",
                        "turn": "right",
                        "atMs": 21200
                    }
                ]
            },
            {
                "dir": "W",
                "queue": [
                    {
                        "kind": "bus",
                        "turn": "right"
                    },
                    {
                        "kind": "car",
                        "turn": "left"
                    },
                    {
                        "kind": "bus",
                        "turn": "straight"
                    },
                    {
                        "kind": "police",
                        "turn": "straight"
                    }
                ],
                "arrivals": [
                    {
                        "kind": "car",
                        "turn": "straight",
                        "atMs": 24000
                    },
                    {
                        "kind": "ambulance",
                        "turn": "straight",
                        "atMs": 7300
                    }
                ]
            }
        ],
        "tip": "Halqadagi mashina o'tib ketgach, bo'sh oynaga yuboring.",
        "ambience": "rain",
        "parMs": 41500
    },
    {
        "id": 50,
        "name": "FINAL BOSS: Toshkent tirbandligi",
        "band": "boss",
        "junction": "cross",
        "arms": [
            {
                "dir": "N",
                "queue": [
                    {
                        "kind": "car",
                        "turn": "left"
                    },
                    {
                        "kind": "car",
                        "turn": "right"
                    },
                    {
                        "kind": "fire",
                        "turn": "straight"
                    },
                    {
                        "kind": "car",
                        "turn": "straight"
                    }
                ],
                "arrivals": [
                    {
                        "kind": "car",
                        "turn": "right",
                        "atMs": 16000
                    },
                    {
                        "kind": "car",
                        "turn": "straight",
                        "atMs": 20900
                    },
                    {
                        "kind": "car",
                        "turn": "right",
                        "atMs": 27600
                    }
                ]
            },
            {
                "dir": "E",
                "queue": [
                    {
                        "kind": "truck",
                        "turn": "straight"
                    },
                    {
                        "kind": "car",
                        "turn": "right"
                    },
                    {
                        "kind": "car",
                        "turn": "right"
                    },
                    {
                        "kind": "car",
                        "turn": "straight"
                    }
                ],
                "arrivals": [
                    {
                        "kind": "car",
                        "turn": "left",
                        "atMs": 7900
                    },
                    {
                        "kind": "car",
                        "turn": "straight",
                        "atMs": 12000
                    },
                    {
                        "kind": "taxi",
                        "turn": "right",
                        "atMs": 18300
                    },
                    {
                        "kind": "police",
                        "turn": "right",
                        "atMs": 25600
                    }
                ]
            },
            {
                "dir": "S",
                "queue": [
                    {
                        "kind": "car",
                        "turn": "straight"
                    },
                    {
                        "kind": "car",
                        "turn": "left"
                    },
                    {
                        "kind": "car",
                        "turn": "right"
                    },
                    {
                        "kind": "bus",
                        "turn": "straight"
                    },
                    {
                        "kind": "car",
                        "turn": "right"
                    }
                ],
                "arrivals": [
                    {
                        "kind": "taxi",
                        "turn": "straight",
                        "atMs": 5600
                    },
                    {
                        "kind": "bus",
                        "turn": "right",
                        "atMs": 9400
                    },
                    {
                        "kind": "car",
                        "turn": "left",
                        "atMs": 29700
                    },
                    {
                        "kind": "ambulance",
                        "turn": "straight",
                        "atMs": 6500
                    }
                ]
            },
            {
                "dir": "W",
                "queue": [
                    {
                        "kind": "truck",
                        "turn": "right"
                    },
                    {
                        "kind": "car",
                        "turn": "right"
                    },
                    {
                        "kind": "car",
                        "turn": "left"
                    },
                    {
                        "kind": "car",
                        "turn": "straight"
                    }
                ],
                "arrivals": [
                    {
                        "kind": "car",
                        "turn": "right",
                        "atMs": 14300
                    },
                    {
                        "kind": "bus",
                        "turn": "straight",
                        "atMs": 23400
                    }
                ]
            }
        ],
        "controller": {
            "poses": [
                {
                    "gesture": "arms_side",
                    "facing": "N",
                    "ms": 3500
                },
                {
                    "gesture": "arm_up",
                    "facing": "N",
                    "ms": 900
                },
                {
                    "gesture": "right_forward",
                    "facing": "W",
                    "ms": 3500
                },
                {
                    "gesture": "arm_up",
                    "facing": "W",
                    "ms": 900
                },
                {
                    "gesture": "arms_side",
                    "facing": "E",
                    "ms": 3500
                },
                {
                    "gesture": "arm_up",
                    "facing": "E",
                    "ms": 900
                },
                {
                    "gesture": "right_forward",
                    "facing": "S",
                    "ms": 3500
                },
                {
                    "gesture": "arm_up",
                    "facing": "S",
                    "ms": 900
                },
                {
                    "gesture": "right_forward",
                    "facing": "E",
                    "ms": 3500
                },
                {
                    "gesture": "arm_up",
                    "facing": "E",
                    "ms": 900
                },
                {
                    "gesture": "arms_side",
                    "facing": "N",
                    "ms": 3500
                },
                {
                    "gesture": "arm_up",
                    "facing": "N",
                    "ms": 900
                },
                {
                    "gesture": "right_forward",
                    "facing": "N",
                    "ms": 3500
                },
                {
                    "gesture": "arm_up",
                    "facing": "N",
                    "ms": 900
                },
                {
                    "gesture": "arms_side",
                    "facing": "E",
                    "ms": 3500
                },
                {
                    "gesture": "arm_up",
                    "facing": "E",
                    "ms": 900
                }
            ]
        },
        "intro": {
            "title": "FINAL BOSS",
            "text": "Eng tez regulirovshik, eng katta tirbandlik, tez yordam va o‘t o‘chirish. Barcha qoidalarni eslang!"
        },
        "tip": "Boshqaruvchining ko'kragi qaragan tomonga va qo'llariga qarang.",
        "ambience": "night",
        "parMs": 54500
    }
];
//# sourceMappingURL=campaign.data.js.map