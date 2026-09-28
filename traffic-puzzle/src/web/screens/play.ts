/**
 * Play screen (v3): fixed-timestep loop (60 Hz sim, interpolated render, 1×/2×),
 * input (tap, long-press / hover "why?", keyboard 1–4), per-mode HUD (campaign,
 * daily, endless, custom), interactive coach, penalty feedback, hints and a
 * rich result card (animated stars, coin count-up, records, violations,
 * achievements, practice suggestion, streak, share, confetti).
 */

import { BAND_INFO, LEVEL_COUNT } from '../../content/campaign.js';
import { dayIndexOf, dayLabel, weekdayOf, WEEKDAYS_UZ } from '../../content/daily.js';
import { ENDLESS_INFO } from '../../content/endless.js';
import { MODELS } from '../../content/garage.js';
import { PRACTICE_LEVEL, violationBreakdown } from '../../content/practice.js';
import { REASON_TEXT } from '../../content/rulesText.js';
import { computePar, legalMoves } from '../../core/bot.js';
import { DIR_NAMES_UZ, DIRS } from '../../core/dir.js';
import { GameEngine, type EngineEvent, type LevelResult } from '../../core/engine.js';
import { TICK_HZ, TICK_MS } from '../../core/kinematics.js';
import { loadLevel, type Level } from '../../core/level.js';
import { makeReplay } from '../../core/replay.js';
import type { MoveDecision, Reason } from '../../core/rules.js';
import type { Gesture, LevelDef } from '../../core/types.js';
import { resolveTarget, type App, type PlayTarget, type RunSummary } from '../app.js';
import { clear, fmtTime, h, type Child } from '../dom.js';
import { copyText, countUp, launchConfetti, prefersReducedMotion } from '../fx.js';
import { AMBIENCE_ICON, AMBIENCE_UZ, icon, iconOf, REASON_ICON, starRow, type IconName } from '../icons.js';
import { KEY_OF_DIR, Renderer } from '../render/renderer.js';
import { routeHash } from '../router.js';
import { isUnlocked } from '../save.js';
import { encodeLevel } from '../share.js';

const COMMON_MODELS = ['nexia3', 'cobalt', 'spark', 'gentra', 'damas'];
const LONG_PRESS_MS = 450;
const IMPATIENT_S = 14;

const GESTURE_UZ: Record<Gesture, string> = {
  arms_side: "Qo'llar yonga",
  right_forward: "O'ng qo'l oldinga",
  arm_up: "Qo'l tepada — hamma to'xtaydi",
};

const REASON_ORDER_HINT: Partial<Record<Reason, string>> = {
  right_hand: "O'ngdagi mashina sariq halqa bilan belgilangan.",
  left_turn: "Qarshidagi mashina sariq halqa bilan belgilangan.",
  main_road: "Asosiy yo'ldagi mashina sariq halqa bilan belgilangan.",
  emergency: 'Maxsus transport sariq halqa bilan belgilangan.',
  roundabout_ring: 'Halqadagi mashina sariq halqa bilan belgilangan.',
  crossing_traffic: "Yo'lingizni kesib o'tayotgan mashina belgilangan.",
};

interface HeadInfo {
  readonly badge: Child;
  readonly title: string;
  readonly sub: string;
}

function headInfo(target: PlayTarget, def: LevelDef): HeadInfo {
  switch (target.kind) {
    case 'campaign':
      return { badge: h('b', null, String(def.id)), title: def.name, sub: BAND_INFO[def.band].title };
    case 'daily': {
      const i = dayIndexOf(target.day);
      return { badge: icon('calendar'), title: `Kunlik: ${dayLabel(i)}`, sub: `${WEEKDAYS_UZ[weekdayOf(i)]} · ${def.intro?.title.split(': ')[1] ?? ''}` };
    }
    case 'endless':
      return { badge: icon('infinity'), title: `Cheksiz: ${ENDLESS_INFO[target.variant].title}`, sub: "Tirbandlik bo'lguncha" };
    case 'custom':
      return { badge: icon('wrench'), title: def.name, sub: 'Muharrir sinovi' };
  }
}

function shareLink(target: PlayTarget, def: LevelDef): string {
  const base = `${location.origin}${location.pathname}`;
  switch (target.kind) {
    case 'campaign':
      return base + routeHash({ screen: 'play', kind: 'campaign', id: def.id });
    case 'daily':
      return base + routeHash({ screen: 'play', kind: 'daily', day: target.day });
    case 'endless':
      return base + routeHash({ screen: 'play', kind: 'endless', variant: target.variant });
    case 'custom':
      return base + routeHash({ screen: 'play', kind: 'custom', code: encodeLevel(def) });
  }
}

export function mountPlay(root: HTMLElement, app: App): () => void {
  const { store, sfx } = app;
  const target = store.getState().target;
  const resolved = target ? resolveTarget(target) : null;
  if (!target || !resolved) {
    store.getState().go('levels');
    return () => undefined;
  }
  const def = resolved.def;
  const mode = target.kind;
  const endless = mode === 'endless';
  const custom = mode === 'custom';
  let level: Level;
  try {
    level = loadLevel(def, resolved.limits);
  } catch (e) {
    store.getState().notify(`Bosqichni ochib bo'lmadi: ${(e as Error).message}`, 'err');
    store.getState().go('menu');
    return () => undefined;
  }
  let parMs = resolved.engine.parMs ?? def.parMs ?? Number.POSITIVE_INFINITY;
  if (!endless && def.parMs === undefined) {
    try {
      parMs = computePar(level);
    } catch {
      store.getState().notify("Diqqat: avtopilot bu bosqichni yecha olmadi — balki uni yechib bo'lmaydi", 'err');
    }
  }
  const info = headInfo(target, def);
  const endlessBest0 = endless ? store.getState().save.endless[target.variant].best : 0;

  // ---- DOM -----------------------------------------------------------------
  const canvas = h('canvas', { class: 'play-canvas', 'aria-label': "O'yin maydoni" });
  const heartsEl = h('div', { class: 'hud-hearts', 'aria-label': 'Jonlar' });
  const coinsEl = h('span', null, '0');
  const timeEl = h('span', null, '0.0 s');
  const progEl = h('span', null, '');
  const scoreEl = h('span', null, '0');
  const poseEl = h('div', { class: 'hud-pose hidden' });
  const penaltyEl = h('div', { class: 'penalty-card hidden', role: 'alert' });
  const softEl = h('div', { class: 'soft-toast hidden' });
  const whyEl = h('div', { class: 'why-tip hidden', role: 'tooltip' });
  const coachText = h('div', { class: 'coach-text' });
  const coachCount = h('span', { class: 'coach-count' });
  const coachEl = h(
    'div',
    { class: 'coach-bar hidden', role: 'status' },
    h('div', { class: 'coach-hand' }, icon('hand')),
    h('div', { class: 'coach-body' }, h('div', { class: 'coach-title' }, 'Yordamchi ', coachCount), coachText),
    h('button', { class: 'coach-close', title: "Yordamchini yopish", 'aria-label': 'Yopish', onclick: () => closeCoach() }, icon('close')),
  );
  const modalLayer = h('div', { class: 'modal-layer' });
  const flashEl = h('div', { class: 'edge-flash' });
  const speedBtn = h('button', { class: 'hud-btn', title: '2× tezlik (F)', 'aria-label': 'Tezlik', onclick: () => toggleSpeed() }, icon('speed'));
  const muteBtn = h('button', { class: 'hud-btn', title: 'Ovoz (M)', 'aria-label': 'Ovoz', onclick: () => toggleMute() });

  const chips: Child[] = endless
    ? [
        h('div', { class: 'hud-chip score', title: "O'tkazilgan mashinalar" }, icon('car'), scoreEl, h('small', null, ` / rekord ${endlessBest0}`)),
        h('div', { class: 'hud-chip', title: 'Vaqt' }, icon('clock'), timeEl),
      ]
    : [
        custom ? null : h('div', { class: 'hud-chip', title: 'Tangalar' }, icon('coin'), coinsEl),
        h('div', { class: 'hud-chip', title: 'Vaqt / tez yulduz uchun' }, icon('clock'), timeEl, h('small', null, Number.isFinite(parMs) ? ` / ${fmtTime(parMs)}` : '')),
        h('div', { class: 'hud-chip', title: "O'tgan mashinalar" }, icon('car'), progEl),
      ];

  const hud = h(
    'div',
    { class: 'hud-top' },
    h('button', { class: 'hud-btn', title: 'Pauza (P)', 'aria-label': 'Pauza', onclick: () => pause() }, icon('pause')),
    h(
      'div',
      { class: 'hud-title' },
      info.badge,
      ' ',
      info.title,
      ' ',
      h('span', { class: 'hud-amb', title: AMBIENCE_UZ[level.ambience] }, icon(AMBIENCE_ICON[level.ambience])),
      h('small', null, info.sub),
    ),
    heartsEl,
    ...chips,
    h('div', { class: 'hud-actions' },
      h('button', { class: 'hud-btn', title: 'Maslahat (H)', 'aria-label': 'Maslahat', onclick: () => hint() }, icon('bulb')),
      speedBtn,
      muteBtn,
      h('button', { class: 'hud-btn', title: 'Bosqich qoidasi (?)', 'aria-label': 'Qoida', onclick: () => showIntro(true) }, '?'),
      h('button', { class: 'hud-btn', title: 'Qayta boshlash (R)', 'aria-label': 'Qayta boshlash', onclick: () => restart() }, icon('restart')),
    ),
  );
  const view = h('div', { class: `play amb-${level.ambience}` }, canvas, flashEl, hud, poseEl, penaltyEl, whyEl, coachEl, softEl, modalLayer);
  clear(root);
  root.appendChild(view);

  const renderer = new Renderer(canvas);
  /** Space kept free for the coach bar for the whole run (the camera must not jump when it closes). */
  let coachReserve = false;
  const layoutPads = () => {
    renderer.padTop = hud.offsetHeight + 6;
    renderer.padBottom = coachReserve ? Math.max(64, coachEl.offsetHeight) + 24 : 16;
    renderer.resize();
  };

  // ---- state -----------------------------------------------------------------
  let engine!: GameEngine;
  let offEngine: (() => void) | null = null;
  let raf = 0;
  let last = performance.now();
  let acc = 0;
  let speed = 1;
  let paused = false;
  let modalOpen = false;
  let ended = false;
  let hintsUsed = 0;
  let lastPenaltyReason: Reason | null = null;
  let penaltyTimer: ReturnType<typeof setTimeout> | null = null;
  let softTimer: ReturnType<typeof setTimeout> | null = null;
  let hintTimer: ReturnType<typeof setTimeout> | null = null;
  let whyTimer: ReturnType<typeof setTimeout> | null = null;
  let pressTimer: ReturnType<typeof setTimeout> | null = null;
  let pressId: string | null = null;
  let pressWhy = false;
  let pointer: { x: number; y: number } | null = null;
  let whyPinned = false;
  let whyKey = '';
  let coachIdx = 0;
  let coachOn = false;
  let stopConfetti: (() => void) | null = null;
  const honked = new Set<string>();
  const laneWarned = [false, false, false, false];
  const bossArrows = () => store.getState().save.settings.controllerArrows || def.id === 10;
  const effectsOn = () => store.getState().save.settings.effects && !prefersReducedMotion();

  const applySettings = () => {
    const s = store.getState().save.settings;
    renderer.settings = {
      spriteCache: s.spriteCache,
      assist: s.assist,
      controllerArrows: bossArrows(),
      perf: s.perf,
      effects: s.effects && !prefersReducedMotion(),
      keyHints: s.keyHints,
    };
    muteBtn.replaceChildren(icon(s.sound ? 'sound' : 'soundOff'));
    muteBtn.classList.toggle('off', !s.sound);
  };

  /** Civilian traffic = the common local car park + every model the player owns. */
  function heroLook() {
    const s = store.getState().save;
    const owned = s.owned.filter((id) => MODELS.some((m) => m.id === id));
    return { levelId: def.id, ownedModels: [...new Set([...COMMON_MODELS, ...owned])], hero: s.loadout };
  }

  function renderHearts() {
    clear(heartsEl);
    for (let i = 0; i < level.lives; i++) heartsEl.appendChild(icon('heart', i < engine.lives ? '' : 'lost'));
  }

  function start() {
    offEngine?.();
    engine = new GameEngine(level, { ...resolved!.engine, parMs });
    offEngine = engine.on(onEvent);
    applySettings();
    renderer.setEngine(engine, heroLook());
    ended = false;
    acc = 0;
    hintsUsed = 0;
    last = performance.now();
    lastPenaltyReason = null;
    honked.clear();
    laneWarned.fill(false);
    renderHearts();
    coinsEl.textContent = '0';
    scoreEl.textContent = '0';
    hidePenalty();
    clearWhy();
    stopConfetti?.();
    coachOn = level.coach.length > 0 && (mode !== 'campaign' || !store.getState().save.progress[String(def.id)]);
    coachIdx = 0;
    updateCoach();
    if (coachReserve !== coachOn) {
      coachReserve = coachOn;
      requestAnimationFrame(layoutPads);
    }
  }

  function restart() {
    sfx.click();
    closeModal();
    start();
  }

  // ---- coach -------------------------------------------------------------------
  function updateCoach() {
    const steps = level.coach;
    while (coachOn && coachIdx < steps.length) {
      const v = engine.byId.get(steps[coachIdx].vehicle);
      if (v && (v.state === 'crossing' || v.state === 'exiting' || v.state === 'gone')) coachIdx++;
      else break;
    }
    const active = coachOn && coachIdx < steps.length;
    coachEl.classList.toggle('hidden', !active);
    renderer.coachId = active ? steps[coachIdx].vehicle : null;
    if (active) {
      coachText.textContent = steps[coachIdx].text;
      coachCount.textContent = `${coachIdx + 1}/${steps.length}`;
    } else if (coachOn && steps.length) {
      soft('check', "Zo'r! Endi o'zingiz davom eting.");
    }
  }

  function closeCoach() {
    coachOn = false;
    updateCoach();
  }

  // ---- events → feedback -----------------------------------------------------
  function onEvent(e: EngineEvent) {
    const settings = store.getState().save.settings;
    renderer.onEvent(e);
    switch (e.type) {
      case 'depart': {
        sfx.go();
        const v = engine.byId.get(e.id);
        if (v?.emergency) sfx.siren(true);
        if (e.deadlock) soft('check', 'Tiqilinch: haydovchilar kelishib oldi — bittasi o‘tadi');
        if (renderer.hintId === e.id) renderer.hintId = null;
        if (renderer.why?.id === e.id) clearWhy();
        if (coachOn) updateCoach();
        break;
      }
      case 'blocked':
        if (e.reason === 'not_front' || e.reason === 'not_ready' || e.reason === 'locked') {
          sfx.honk();
          soft(REASON_ICON[e.reason], REASON_TEXT[e.reason].text);
        }
        break;
      case 'penalty': {
        sfx.whistle();
        if (settings.vibrate) navigator.vibrate?.([120, 60, 180]);
        lastPenaltyReason = e.reason;
        showPenalty(e.reason);
        renderer.focusIds = e.culprits;
        renderer.focusUntil = performance.now() + 2200;
        renderHearts();
        heartsEl.classList.remove('shake');
        void heartsEl.offsetWidth;
        heartsEl.classList.add('shake');
        flashEl.classList.remove('on');
        void flashEl.offsetWidth;
        flashEl.classList.add('on');
        break;
      }
      case 'cleared':
        sfx.coin();
        if (endless) {
          renderer.popupAt(e.id, '+1', '#86efac');
          scoreEl.textContent = String(engine.cleared);
        } else {
          renderer.popupAt(e.id, custom ? '+1' : `+${e.coins}`, '#ffd166');
          coinsEl.textContent = String(engine.vehicleCoins);
        }
        break;
      case 'arrive': {
        const v = engine.byId.get(e.id);
        if (v?.emergency) {
          sfx.siren();
          soft(v.kind === 'fire' ? 'warn' : 'plus', v.kind === 'fire' ? "O't o'chirish mashinasi kelyapti!" : 'Tez yordam kelyapti!');
        }
        if (endless && v) {
          const n = engine.laneCount(v.from);
          if (n >= engine.overflowAt - 1 && !laneWarned[v.from]) {
            laneWarned[v.from] = true;
            soft('warn', `Diqqat: ${DIR_NAMES_UZ[v.from]} yo'li to'lib bormoqda (${n}/${engine.overflowAt})!`);
          } else if (n < engine.overflowAt - 2) laneWarned[v.from] = false;
        }
        break;
      }
      case 'gridlock':
        sfx.lose();
        soft('warn', `Tirbandlik: ${DIR_NAMES_UZ[e.dir]} yo'li to'lib ketdi!`);
        break;
      case 'won':
        ended = true;
        setTimeout(() => finish(e.result), 450);
        break;
      case 'lost':
        ended = true;
        setTimeout(() => finish(e.result), 900);
        break;
    }
  }

  function soft(ic: IconName, text: string) {
    softEl.replaceChildren(icon(ic), document.createTextNode(text));
    softEl.classList.remove('hidden');
    if (softTimer) clearTimeout(softTimer);
    softTimer = setTimeout(() => softEl.classList.add('hidden'), 2000);
  }

  function showPenalty(reason: Reason) {
    const r = REASON_TEXT[reason];
    clear(penaltyEl);
    penaltyEl.append(
      h('div', { class: 'penalty-icon' }, icon(REASON_ICON[reason])),
      h(
        'div',
        null,
        h('div', { class: 'penalty-title' }, `YPX hushtagi! ${r.title}`),
        h('div', { class: 'penalty-text' }, r.text),
        REASON_ORDER_HINT[reason] ? h('div', { class: 'penalty-hint' }, REASON_ORDER_HINT[reason]) : null,
      ),
    );
    penaltyEl.classList.remove('hidden');
    if (penaltyTimer) clearTimeout(penaltyTimer);
    penaltyTimer = setTimeout(hidePenalty, 3200);
  }

  function hidePenalty() {
    penaltyEl.classList.add('hidden');
  }

  function hint() {
    if (ended) return;
    const moves = legalMoves(engine);
    if (hintTimer) clearTimeout(hintTimer);
    if (moves.length === 0) {
      soft('clock', 'Hozir hech kim o‘ta olmaydi — kuting (svetofor, boshqaruvchi yoki chorrahadagi mashina).');
      return;
    }
    hintsUsed++;
    renderer.hintId = moves[0].id;
    hintTimer = setTimeout(() => (renderer.hintId = null), 3500);
  }

  function toggleSpeed() {
    speed = speed === 1 ? 2 : 1;
    speedBtn.classList.toggle('on', speed === 2);
    speedBtn.title = speed === 2 ? 'Oddiy tezlik (F)' : '2× tezlik (F)';
    soft('speed', speed === 2 ? 'Tezlik: 2×' : 'Tezlik: 1×');
  }

  function toggleMute() {
    const s = store.getState().save.settings;
    store.getState().setSetting('sound', !s.sound);
    soft(s.sound ? 'soundOff' : 'sound', s.sound ? "Ovoz o'chirildi" : 'Ovoz yoqildi');
  }

  // ---- "why?" tooltip ------------------------------------------------------------
  function clearWhy() {
    if (whyTimer) clearTimeout(whyTimer);
    whyTimer = null;
    whyPinned = false;
    renderer.why = null;
    whyEl.classList.add('hidden');
    whyKey = '';
  }

  /** Evaluate + show the "why?" tooltip for a vehicle (cheap when nothing changed). */
  function showWhy(id: string) {
    const d = engine.preview(id);
    renderer.why = { id, allowed: d.allowed, reason: d.reason, culprits: d.culprits };
    const key = `${id}|${d.verdict}|${d.reason}|${d.culprits.join(',')}`;
    if (key !== whyKey) {
      whyKey = key;
      fillWhy(d);
    }
    whyEl.classList.remove('hidden');
  }

  /** Long-press: keep the tooltip for `ms`. */
  function pinWhy(id: string, ms: number) {
    if (whyTimer) clearTimeout(whyTimer);
    whyPinned = true;
    whyTimer = setTimeout(clearWhy, ms);
    showWhy(id);
  }

  function fillWhy(d: MoveDecision) {
    whyEl.className = `why-tip ${d.allowed ? 'ok' : d.verdict === 'violation' ? 'bad' : 'wait'}`;
    if (d.allowed) {
      whyEl.replaceChildren(
        h('div', { class: 'why-title' }, icon('check'), d.deadlock ? " Mumkin (tiqilinch yechimi)" : " Yo'l ochiq"),
        h('div', { class: 'why-text' }, d.deadlock ? "Hamma bir-birini kutyapti — bu mashina birinchi o'tishi mumkin." : "Bossangiz, mashina qoidaga muvofiq o'tadi."),
      );
      return;
    }
    const r = d.reason ? REASON_TEXT[d.reason] : null;
    const parts: Node[] = [
      h('div', { class: 'why-title' }, icon(d.reason ? REASON_ICON[d.reason] : 'warn'), d.verdict === 'violation' ? ` Hozir mumkin emas: ${r?.title ?? ''}` : ` ${r?.title ?? 'Kuting'}`),
      h('div', { class: 'why-text' }, r?.text ?? ''),
    ];
    if (d.culprits.length) parts.push(h('div', { class: 'why-hint' }, `${d.culprits.length} ta mashinaga yo'l bering (sariq halqa).`));
    whyEl.replaceChildren(...parts);
  }

  function placeWhy() {
    const why = renderer.why;
    if (!why) return;
    const v = engine.byId.get(why.id);
    if (!v || (v.state !== 'waiting' && v.state !== 'approaching')) {
      clearWhy();
      return;
    }
    const pt = renderer.vehicleScreen(why.id, 1.05);
    if (!pt) return;
    const w = whyEl.offsetWidth;
    const hh = whyEl.offsetHeight;
    const vw = canvas.clientWidth;
    const x = Math.max(8, Math.min(vw - w - 8, pt.x - w / 2));
    let y = pt.y - hh - 14;
    if (y < renderer.padTop) y = pt.y + 56;
    whyEl.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
  }

  // ---- modals ----------------------------------------------------------------
  function openModal(content: HTMLElement) {
    clear(modalLayer);
    modalLayer.appendChild(h('div', { class: 'modal-backdrop' }, content));
    modalOpen = true;
    clearWhy();
  }

  function closeModal() {
    clear(modalLayer);
    modalOpen = false;
    last = performance.now();
  }

  function showIntro(force: boolean) {
    const intro = def.intro;
    const tip = def.tip;
    const seen = store.getState().save.seenIntro.includes(def.id);
    if (!force && (!intro || (seen && mode === 'campaign'))) return;
    openModal(
      h(
        'div',
        { class: 'modal' },
        h('h2', null, intro?.title ?? def.name),
        intro ? h('p', null, intro.text) : null,
        tip ? h('p', { class: 'tip' }, icon('bulb'), ' ', tip) : null,
        !intro && !tip ? h('p', null, "Qoidalarni eslang: o'ng qo'l, belgilar, svetofor, maxsus transport, aylanma.") : null,
        level.ambience !== 'day' ? h('p', { class: 'muted amb-note' }, icon(AMBIENCE_ICON[level.ambience]), ` ${AMBIENCE_UZ[level.ambience]}: qoidalar o'zgarmaydi, faqat ko'rinish qiyinlashadi.`) : null,
        coachOn ? h('p', { class: 'muted' }, icon('hand'), " Yordamchi qo'l qaysi mashinani bosishni ko'rsatadi.") : null,
        h('div', { class: 'modal-actions' }, h('button', { class: 'btn primary', onclick: () => { store.getState().markIntroSeen(def.id); closeModal(); } }, 'Tushunarli, boshladik!')),
      ),
    );
  }

  function shortcutsCard(): HTMLElement {
    const row = (k: string, t: string) => h('li', null, h('kbd', null, k), ` ${t}`);
    return h(
      'ul',
      { class: 'kbd-list' },
      row('1–4', 'Shimol / Sharq / Janub / G‘arb mashinasini yuborish'),
      row('H', 'Maslahat'),
      row('F', '2× tezlik'),
      row('M', 'Ovoz'),
      row('R', 'Qayta boshlash'),
      row('P', 'Pauza'),
    );
  }

  function pause() {
    if (ended || modalOpen) return;
    sfx.click();
    openModal(
      h(
        'div',
        { class: 'modal' },
        h('h2', null, icon('pause'), ' Pauza'),
        h(
          'div',
          { class: 'modal-actions col' },
          h('button', { class: 'btn primary', onclick: () => closeModal() }, 'Davom etish'),
          h('button', { class: 'btn', onclick: () => restart() }, 'Qayta boshlash'),
          h('button', { class: 'btn', onclick: () => { closeModal(); showIntro(true); } }, 'Bosqich qoidasi'),
          h('button', { class: 'btn ghost', onclick: () => exit() }, custom ? 'Muharrirga qaytish' : mode === 'campaign' ? 'Bosqichlar ro‘yxati' : 'Menyu'),
        ),
        h('details', { class: 'kbd-details' }, h('summary', null, icon('keyboard'), ' Klaviatura'), shortcutsCard()),
      ),
    );
  }

  function exit() {
    closeModal();
    store.getState().go(custom ? 'editor' : mode === 'campaign' ? 'levels' : 'menu');
  }

  async function share(result: LevelResult) {
    const link = shareLink(target!, def);
    const text = endless
      ? `Chorraha Boshqaruvi — ${info.title}: ${result.cleared} ta mashina o'tkazdim!`
      : custom
        ? `Chorraha Boshqaruvi — mening bosqichim: "${def.name}". Yecha olasizmi?`
        : `Chorraha Boshqaruvi — ${info.title}: ${result.stars}/3 yulduz, ${fmtTime(result.timeMs)}`;
    const nav = navigator as Navigator & { share?: (d: { title?: string; text?: string; url?: string }) => Promise<void> };
    if (nav.share && matchMedia('(pointer: coarse)').matches) {
      try {
        await nav.share({ title: 'Chorraha Boshqaruvi', text, url: link });
        return;
      } catch {
        /* cancelled → fall back to copying */
      }
    }
    const ok = await copyText(`${text}\n${link}`);
    store.getState().notify(ok ? 'Havola nusxalandi' : `Havola: ${link}`, ok ? 'ok' : 'info', 'link');
  }

  // ---- result card -------------------------------------------------------------
  function statTile(ic: IconName, label: string, value: Child, ok?: boolean): HTMLElement {
    return h('div', { class: `res-stat${ok === true ? ' good' : ok === false ? ' bad' : ''}` }, icon(ic), h('div', null, h('small', null, label), h('b', null, value)));
  }

  function violationList(result: LevelResult): HTMLElement | null {
    const rows = violationBreakdown(result.violations);
    if (!rows.length) return null;
    return h(
      'div',
      { class: 'res-violations' },
      h('div', { class: 'res-sub' }, 'Buzilgan qoidalar'),
      ...rows.map((r) => h('div', { class: 'res-vrow' }, icon(REASON_ICON[r.reason]), ` ${REASON_TEXT[r.reason].title}`, h('span', { class: 'res-vcount' }, `×${r.count}`))),
    );
  }

  function achievementRow(summary: RunSummary): HTMLElement | null {
    if (!summary.achievements.length) return null;
    return h(
      'div',
      { class: 'res-ach' },
      h('div', { class: 'res-sub' }, icon('trophy'), ' Yangi yutuq'),
      ...summary.achievements.map((a) => h('div', { class: 'ach-chip' }, iconOf(a.icon), h('span', null, h('b', null, a.title), h('small', null, a.desc)))),
    );
  }

  function practiceButton(reason: Reason | null): HTMLElement | null {
    if (!reason || mode === 'custom') return null;
    const lvl = PRACTICE_LEVEL[reason];
    const save = store.getState().save;
    if (!lvl || lvl === def.id || !isUnlocked(save, lvl)) return null;
    return h('button', { class: 'btn', onclick: () => { closeModal(); store.getState().play(lvl); } }, icon('target'), ` Mashq: ${lvl}-bosqich`);
  }

  function finish(result: LevelResult) {
    const replay = result.completed ? makeReplay(engine) : null;
    const summary = store.getState().finishRun(target!, def, result, replay, { hints: hintsUsed });
    if (result.completed) sfx.win();
    else if (result.endReason !== 'gridlock') sfx.lose();
    clearWhy();
    renderer.coachId = null;
    coachEl.classList.add('hidden');
    openModal(endless ? endlessCard(result, summary) : result.completed ? winCard(result, summary) : lossCard(result, summary));
    if (result.completed && result.stars === 3 && effectsOn()) stopConfetti = launchConfetti(view);
  }

  function winCard(result: LevelResult, summary: RunSummary): HTMLElement {
    const next = mode === 'campaign' && def.id < LEVEL_COUNT ? def.id + 1 : null;
    const title = mode === 'campaign' ? `${def.id}-bosqich yakunlandi!` : mode === 'daily' ? 'Kunlik chorraha yakunlandi!' : 'Sinov yakunlandi!';
    const coinEl = h('span', { class: 'count' }, '+0');
    const badges: Child[] = [];
    if (mode !== 'custom' && summary.prevStars === 0) badges.push(h('span', { class: 'res-badge new' }, icon('flag'), ' Birinchi marta!'));
    else if (summary.newStars) badges.push(h('span', { class: 'res-badge up' }, icon('star', 'on'), ` +${result.stars - summary.prevStars} yulduz`));
    if (summary.newBestTime && summary.prevBestMs !== null) badges.push(h('span', { class: 'res-badge rec' }, icon('clock'), ` Yangi rekord: −${fmtTime(summary.prevBestMs - result.timeMs)}`));
    if (result.mistakes === 0) badges.push(h('span', { class: 'res-badge clean' }, icon('check'), ' Xatosiz'));
    const fast = result.timeMs <= parMs;
    const card = h(
      'div',
      { class: 'modal result' },
      h('h2', null, title),
      h('div', { class: 'res-stars' }, starRow(result.stars, 3, 'big anim')),
      badges.length ? h('div', { class: 'res-badges' }, ...badges) : null,
      h(
        'div',
        { class: 'res-grid' },
        statTile('whistle', 'Xatolar', result.mistakes === 0 ? 'yo‘q' : String(result.mistakes), result.mistakes === 0),
        statTile('clock', Number.isFinite(parMs) ? `Vaqt (tez: ${fmtTime(parMs)})` : 'Vaqt', fmtTime(result.timeMs), Number.isFinite(parMs) ? fast : undefined),
        statTile('car', "O'tkazildi", `${result.cleared} ta`),
        statTile('bulb', 'Maslahat', String(hintsUsed)),
      ),
      violationList(result),
      mode === 'custom'
        ? null
        : h(
            'div',
            { class: 'reward' },
            h('div', { class: 'reward-total' }, icon('coin'), ' ', coinEl),
            h('small', null, `mashinalar ${summary.reward.vehicles} · bosqich ${summary.reward.completion} · yulduzlar ${summary.reward.stars}`),
          ),
      summary.daily
        ? h('div', { class: 'res-streak' }, icon('fire'), summary.daily.counted ? ` Ketma-ket: ${summary.daily.streak} kun` : " Bu kun seriyaga qo'shilmaydi (bugungi emas)")
        : null,
      achievementRow(summary),
      h(
        'div',
        { class: 'modal-actions' },
        next ? h('button', { class: 'btn primary', onclick: () => { closeModal(); store.getState().play(next); } }, 'Keyingi bosqich ', icon('next')) : null,
        mode === 'campaign' && def.id === LEVEL_COUNT ? h('span', { class: 'res-final' }, icon('crown'), " Barcha bosqichlar o'tildi!") : null,
        h('button', { class: 'btn', onclick: () => restart() }, 'Qayta o‘ynash'),
        h('button', { class: 'btn', title: 'Ulashish', onclick: () => void share(result) }, icon('share'), ' Ulashish'),
        h('button', { class: 'btn ghost', onclick: () => exit() }, custom ? 'Muharrir' : mode === 'campaign' ? 'Bosqichlar' : 'Menyu'),
      ),
    );
    if (mode !== 'custom') setTimeout(() => countUp(coinEl, summary.reward.total, 900, '+'), 450);
    return card;
  }

  function lossCard(result: LevelResult, summary: RunSummary): HTMLElement {
    const r = lastPenaltyReason ? REASON_TEXT[lastPenaltyReason] : null;
    return h(
      'div',
      { class: 'modal result lost' },
      h('h2', null, icon('heart', 'lost'), ' Jonlar tugadi'),
      r ? h('p', null, h('b', null, r.title), ': ', r.text) : null,
      violationList(result),
      def.tip ? h('p', { class: 'tip' }, icon('bulb'), ' ', def.tip) : null,
      achievementRow(summary),
      h(
        'div',
        { class: 'modal-actions' },
        h('button', { class: 'btn primary', onclick: () => restart() }, 'Qayta urinish'),
        practiceButton(lastPenaltyReason),
        h('button', { class: 'btn ghost', onclick: () => exit() }, 'Chiqish'),
      ),
    );
  }

  function endlessCard(result: LevelResult, summary: RunSummary): HTMLElement {
    const e = summary.endless!;
    const scoreEl2 = h('span', { class: 'count' }, '0');
    const gridlock = result.endReason === 'gridlock';
    const card = h(
      'div',
      { class: 'modal result endless' },
      h('h2', null, icon(gridlock ? 'warn' : 'heart', gridlock ? '' : 'lost'), gridlock ? ' Tirbandlik!' : ' Jonlar tugadi'),
      h('p', { class: 'muted' }, gridlock ? `Bir yo'lda ${engine.overflowAt} tadan ortiq mashina to'planib qoldi.` : "Qoidalarni 3 marta buzdingiz."),
      h('div', { class: 'endless-score' }, h('small', null, "O'tkazilgan mashinalar"), scoreEl2),
      h('div', { class: 'res-badges' }, e.record ? h('span', { class: 'res-badge rec' }, icon('trophy'), ' Yangi rekord!') : h('span', { class: 'res-badge' }, icon('trophy'), ` Rekord: ${e.best}`)),
      h('div', { class: 'res-grid' }, statTile('clock', 'Chidadingiz', fmtTime(result.timeMs)), statTile('whistle', 'Xatolar', String(result.mistakes), result.mistakes === 0)),
      violationList(result),
      achievementRow(summary),
      h('p', { class: 'muted small' }, "Cheksiz rejim tanga bermaydi — bu faqat mahorat sinovi."),
      h(
        'div',
        { class: 'modal-actions' },
        h('button', { class: 'btn primary', onclick: () => restart() }, icon('restart'), ' Yana'),
        h('button', { class: 'btn', onclick: () => void share(result) }, icon('share'), ' Ulashish'),
        practiceButton(lastPenaltyReason),
        h('button', { class: 'btn ghost', onclick: () => exit() }, 'Menyu'),
      ),
    );
    setTimeout(() => countUp(scoreEl2, e.score, 1000), 300);
    return card;
  }

  // ---- input -----------------------------------------------------------------
  const localPt = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const tap = (id: string) => {
    if (modalOpen || ended) return;
    if (whyPinned) clearWhy();
    engine.tap(id);
  };
  const onDown = (e: PointerEvent) => {
    sfx.unlock();
    if (modalOpen || ended) return;
    const p = localPt(e);
    const id = renderer.pick(p.x, p.y);
    if (e.pointerType === 'mouse') {
      if (id) tap(id);
      return;
    }
    // touch / pen: short press = tap, long press = "why?"
    pressId = id;
    pressWhy = false;
    if (pressTimer) clearTimeout(pressTimer);
    if (id && store.getState().save.settings.assist) {
      pressTimer = setTimeout(() => {
        pressWhy = true;
        const v = engine.byId.get(id);
        if (v && (v.state === 'waiting' || v.state === 'approaching')) {
          navigator.vibrate?.(15);
          pinWhy(id, 3500);
        }
      }, LONG_PRESS_MS);
    }
  };
  const onUp = (e: PointerEvent) => {
    if (e.pointerType === 'mouse') return;
    if (pressTimer) clearTimeout(pressTimer);
    pressTimer = null;
    if (pressId && !pressWhy) tap(pressId);
    pressId = null;
  };
  const onCancel = () => {
    if (pressTimer) clearTimeout(pressTimer);
    pressTimer = null;
    pressId = null;
  };
  const onMove = (e: PointerEvent) => {
    if (e.pointerType === 'mouse') pointer = localPt(e);
  };
  const onLeave = () => {
    pointer = null;
    renderer.hoverId = null;
    if (!whyPinned) clearWhy();
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return;
    const k = e.key;
    if (k === ' ' || k === 'p' || k === 'P' || k === 'Escape') {
      e.preventDefault();
      if (modalOpen && !ended) closeModal();
      else pause();
    } else if (k === 'r' || k === 'R') restart();
    else if (k === 'h' || k === 'H') hint();
    else if (k === 'f' || k === 'F') toggleSpeed();
    else if (k === 'm' || k === 'M') toggleMute();
    else if (k === '?' || k === '/') showIntro(true);
    else if (k >= '1' && k <= '4') {
      const d = KEY_OF_DIR.indexOf(Number(k));
      const v = d >= 0 ? engine.queues[d][0] : undefined;
      if (v) tap(v.id);
      else soft('warn', `${DIR_NAMES_UZ[d] ?? ''} tomonda mashina yo'q`);
    }
  };
  const onVisibility = () => {
    paused = document.hidden;
    last = performance.now();
  };
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onCancel);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerleave', onLeave);
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  window.addEventListener('keydown', onKey);
  document.addEventListener('visibilitychange', onVisibility);
  const ro = new ResizeObserver(() => layoutPads());
  ro.observe(canvas);
  ro.observe(hud);
  const unsubSettings = store.subscribe((s, prev) => {
    if (s.save.settings !== prev.save.settings) applySettings();
  });

  // ---- loop ------------------------------------------------------------------
  let lastTimeText = '';
  let lastProg = '';
  let lastPose = '';
  const frame = (now: number) => {
    const running = !paused && !modalOpen && !ended;
    if (running) {
      acc += Math.min(250, now - last) * speed;
      while (acc >= TICK_MS) {
        engine.step();
        acc -= TICK_MS;
      }
    }
    last = now;
    if (running) {
      if (pointer) {
        const id = renderer.pick(pointer.x, pointer.y);
        renderer.hoverId = id;
        if (!whyPinned) {
          const v = id ? engine.byId.get(id) : undefined;
          const eligible = !!v && store.getState().save.settings.assist && (v.state === 'waiting' || v.state === 'approaching') && engine.queues[v.from][0] === v;
          if (eligible) showWhy(id!);
          else if (renderer.why) clearWhy();
        }
      }
      if (renderer.why && (whyPinned || !pointer)) showWhy(renderer.why.id);
    }
    renderer.render(running ? acc / TICK_MS : 0, now);
    placeWhy();

    if (running) {
      // impatience honk (once per vehicle)
      for (const d of DIRS) {
        const v = engine.queues[d][0];
        if (v && v.state === 'waiting' && v.waitSince >= 0 && !honked.has(v.id) && (engine.tick - v.waitSince) / TICK_HZ >= IMPATIENT_S) {
          honked.add(v.id);
          sfx.honk();
        }
      }
    }

    const t = fmtTime(engine.timeMs());
    if (t !== lastTimeText) timeEl.textContent = lastTimeText = t;
    const prog = `${engine.cleared}/${engine.total}`;
    if (prog !== lastProg) progEl.textContent = lastProg = prog;
    const pose = engine.pose();
    const poseText =
      pose && bossArrows()
        ? `${GESTURE_UZ[pose.pose.gesture]}${pose.pose.gesture === 'arm_up' ? '' : ` · ko'krak: ${DIR_NAMES_UZ[pose.pose.facing]}`} · ${Math.ceil(pose.remaining / 60)} s`
        : '';
    if (poseText !== lastPose) {
      lastPose = poseText;
      poseEl.replaceChildren(icon('cop'), document.createTextNode(` ${poseText}`));
      poseEl.classList.toggle('hidden', !poseText);
    }
    raf = requestAnimationFrame(frame);
  };

  start();
  layoutPads();
  raf = requestAnimationFrame(frame);
  if (def.intro && (mode !== 'campaign' || !store.getState().save.seenIntro.includes(def.id))) showIntro(false);

  (window as unknown as Record<string, unknown>).__chorraha = { engine: () => engine, renderer, speed: () => speed };

  return () => {
    cancelAnimationFrame(raf);
    offEngine?.();
    ro.disconnect();
    unsubSettings();
    stopConfetti?.();
    canvas.removeEventListener('pointerdown', onDown);
    canvas.removeEventListener('pointerup', onUp);
    canvas.removeEventListener('pointercancel', onCancel);
    canvas.removeEventListener('pointermove', onMove);
    canvas.removeEventListener('pointerleave', onLeave);
    window.removeEventListener('keydown', onKey);
    document.removeEventListener('visibilitychange', onVisibility);
    for (const t of [penaltyTimer, softTimer, hintTimer, whyTimer, pressTimer]) if (t) clearTimeout(t);
  };
}
