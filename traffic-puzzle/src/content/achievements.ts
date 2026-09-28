/**
 * Achievements ("Yutuqlar"). Pure: each achievement derives its progress from
 * an AchievementContext built out of the save data, so evaluation is testable
 * and never needs event history. Rewards are exclusive cosmetics (no coins, so
 * the server-authoritative economy stays consistent).
 */

import { CAMPAIGN } from './campaign.js';

export interface AchievementContext {
  /** Campaign progress by level id. */
  readonly progress: Readonly<Record<string, { readonly stars: number }>>;
  readonly cleared: number;
  readonly emergency: number;
  readonly deadlocks: number;
  readonly dailyCompleted: number;
  readonly bestStreak: number;
  /** Best single endless run (vehicles through), over all variants. */
  readonly endlessBest: number;
  readonly owned: readonly string[];
  /** Currently installed mods. */
  readonly mods: readonly string[];
}

export interface AchievementDef {
  readonly id: string;
  readonly title: string;
  readonly desc: string;
  /** Icon key (rendered by the web client). */
  readonly icon: string;
  readonly goal: number;
  /** Exclusive garage item granted on unlock. */
  readonly reward?: string;
  value(ctx: AchievementContext): number;
}

const done = (ctx: AchievementContext, id: number): boolean => (ctx.progress[String(id)]?.stars ?? 0) > 0;
const countDone = (ctx: AchievementContext, from: number, to: number): number => {
  let n = 0;
  for (let id = from; id <= to; id++) if (done(ctx, id)) n++;
  return n;
};
const starsTotal = (ctx: AchievementContext): number => Object.values(ctx.progress).reduce((s, p) => s + p.stars, 0);
const threeStars = (ctx: AchievementContext): number => Object.values(ctx.progress).filter((p) => p.stars >= 3).length;
const BOSSES = CAMPAIGN.filter((l) => l.band === 'boss').map((l) => l.id);
const NIGHT = CAMPAIGN.filter((l) => l.ambience === 'night').map((l) => l.id);
const MODEL_IDS = ['matiz', 'damas', 'nexia3', 'spark', 'cobalt', 'gentra', 'tracker', 'malibu'];

export const ACHIEVEMENTS: readonly AchievementDef[] = [
  { id: 'first_win', title: 'Birinchi chorraha', desc: "1-bosqichni o'ting", icon: 'flag', goal: 1, value: (c) => (done(c, 1) ? 1 : 0) },
  { id: 'chapter1', title: "O'quvchi", desc: "1–10-bosqichlarning hammasini o'ting", icon: 'book', goal: 10, reward: 'bayroq', value: (c) => countDone(c, 1, 10) },
  { id: 'chapter2', title: 'Tajribali haydovchi', desc: "11–30-bosqichlarni o'ting", icon: 'diamond', goal: 20, value: (c) => countDone(c, 11, 30) },
  { id: 'chapter3', title: 'Chorraha ustasi', desc: "31–50-bosqichlarni o'ting", icon: 'ring', goal: 20, value: (c) => countDone(c, 31, 50) },
  { id: 'boss_first', title: 'Regulirovshikni tushundim', desc: "10-bosqich (birinchi boss)ni o'ting", icon: 'cop', goal: 1, value: (c) => (done(c, 10) ? 1 : 0) },
  { id: 'boss_all', title: 'Boss ovchisi', desc: "Barcha 5 ta boss bosqichni o'ting", icon: 'crown', goal: BOSSES.length, reward: 'oltin', value: (c) => BOSSES.filter((id) => done(c, id)).length },
  { id: 'boss_perfect', title: 'Sovuqqon', desc: 'Boss bosqichni 3 yulduz bilan yakunlang', icon: 'medal', goal: 1, value: (c) => (BOSSES.some((id) => (c.progress[String(id)]?.stars ?? 0) >= 3) ? 1 : 0) },
  { id: 'stars_30', title: 'Yulduzlar', desc: "Jami 30 ta yulduz to'plang", icon: 'star', goal: 30, value: starsTotal },
  { id: 'perfect_10', title: "A'lochi", desc: '10 ta bosqichni 3 yulduz bilan yakunlang', icon: 'trophy', goal: 10, value: threeStars },
  { id: 'stars_all', title: 'Mukammal', desc: "Barcha 150 ta yulduzni to'plang", icon: 'trophy', goal: CAMPAIGN.length * 3, value: starsTotal },
  { id: 'night_3', title: 'Tungi qorovul', desc: "3 ta tungi bosqichni o'ting", icon: 'moon', goal: 3, value: (c) => NIGHT.filter((id) => done(c, id)).length },
  { id: 'cars_300', title: "Chorraha xo'jayini", desc: "Jami 300 ta mashinani o'tkazing", icon: 'car', goal: 300, value: (c) => c.cleared },
  { id: 'emergency_15', title: "Tez yordam do'sti", desc: "15 ta maxsus transportni o'tkazing", icon: 'plus', goal: 15, value: (c) => c.emergency },
  { id: 'deadlock_3', title: 'Muzokarachi', desc: '3 marta tiqilinchni yeching', icon: 'check', goal: 3, value: (c) => c.deadlocks },
  { id: 'daily_1', title: 'Kunlik mashq', desc: 'Kunlik chorrahani yakunlang', icon: 'calendar', goal: 1, value: (c) => c.dailyCompleted },
  { id: 'streak_7', title: 'Bir hafta ketma-ket', desc: "7 kun ketma-ket kunlik chorrahani o'ting", icon: 'fire', goal: 7, reward: 'tungi', value: (c) => c.bestStreak },
  { id: 'endless_50', title: 'Tirbandlikka qarshi', desc: "Cheksiz rejimda bir o'yinda 50 ta mashina", icon: 'infinity', goal: 50, reward: 'qovun', value: (c) => c.endlessBest },
  { id: 'endless_100', title: 'Temir asab', desc: "Cheksiz rejimda bir o'yinda 100 ta mashina", icon: 'infinity', goal: 100, value: (c) => c.endlessBest },
  { id: 'garage_5', title: 'Kolleksioner', desc: "Garajda 5 ta model to'plang", icon: 'car', goal: 5, value: (c) => c.owned.filter((id) => MODEL_IDS.includes(id)).length },
  { id: 'metan', title: 'Tejamkor', desc: "Mashinangizga metan ballon o'rnating", icon: 'wrench', goal: 1, value: (c) => (c.mods.includes('metan') ? 1 : 0) },
];

export interface AchievementState {
  readonly def: AchievementDef;
  readonly value: number;
  readonly done: boolean;
  /** 0..1 */
  readonly ratio: number;
}

export function achievementStates(ctx: AchievementContext): AchievementState[] {
  return ACHIEVEMENTS.map((def) => {
    const value = Math.max(0, def.value(ctx));
    return { def, value: Math.min(value, def.goal), done: value >= def.goal, ratio: Math.min(1, value / def.goal) };
  });
}

/** Achievements satisfied by `ctx` that are not yet in `unlocked`. */
export function newlyUnlocked(ctx: AchievementContext, unlocked: Iterable<string>): AchievementDef[] {
  const have = new Set(unlocked);
  return achievementStates(ctx)
    .filter((s) => s.done && !have.has(s.def.id))
    .map((s) => s.def);
}

export function findAchievement(id: string): AchievementDef | undefined {
  return ACHIEVEMENTS.find((a) => a.id === id);
}
