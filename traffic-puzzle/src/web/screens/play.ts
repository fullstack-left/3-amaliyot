/**
 * Play screen: fixed-timestep loop (60 Hz sim, interpolated render), input,
 * HUD, penalty feedback (whistle + red flash + heart loss), hints, modals.
 */

import { BAND_INFO, LEVEL_COUNT } from '../../content/campaign.js';
import { MODELS } from '../../content/garage.js';
import { REASON_TEXT } from '../../content/rulesText.js';
import { computePar, legalMoves } from '../../core/bot.js';
import { DIR_NAMES_UZ } from '../../core/dir.js';
import { GameEngine, type EngineEvent, type LevelResult } from '../../core/engine.js';
import { TICK_MS } from '../../core/kinematics.js';
import { loadLevel, type Level } from '../../core/level.js';
import { makeReplay } from '../../core/replay.js';
import type { Reward } from '../../core/scoring.js';
import type { Gesture, LevelDef } from '../../core/types.js';
import { resolveTarget, type App } from '../app.js';
import { clear, fmtTime, h } from '../dom.js';
import { icon, REASON_ICON, starRow, type IconName } from '../icons.js';
import { Renderer } from '../render/renderer.js';

const COMMON_MODELS = ['nexia3', 'cobalt', 'spark', 'gentra', 'damas'];

const GESTURE_UZ: Record<Gesture, string> = {
  arms_side: "Qo'llar yonga",
  right_forward: "O'ng qo'l oldinga",
  arm_up: "Qo'l tepada — hamma to'xtaydi",
};

export function mountPlay(root: HTMLElement, app: App): () => void {
  const { store, sfx } = app;
  const target = store.getState().target;
  const resolved = target ? resolveTarget(target) : null;
  const custom = target?.kind === 'custom';
  const def: LevelDef | undefined = resolved?.def;
  if (!def || !target) {
    store.getState().go('levels');
    return () => undefined;
  }
  const level: Level = loadLevel(def);
  let parMs = def.parMs ?? Number.POSITIVE_INFINITY;
  if (def.parMs === undefined) {
    try {
      parMs = computePar(level);
    } catch {
      store.getState().notify("Diqqat: avtopilot bu bosqichni yecha olmadi — balki uni yechib bo'lmaydi", 'err');
    }
  }

  // ---- DOM -----------------------------------------------------------------
  const canvas = h('canvas', { class: 'play-canvas', 'aria-label': "O'yin maydoni" });
  const heartsEl = h('div', { class: 'hud-hearts', 'aria-label': 'Jonlar' });
  const coinsEl = h('span', null, '0');
  const timeEl = h('span', null, '0.0 s');
  const progEl = h('span', null, '');
  const poseEl = h('div', { class: 'hud-pose hidden' });
  const penaltyEl = h('div', { class: 'penalty-card hidden', role: 'alert' });
  const softEl = h('div', { class: 'soft-toast hidden' });
  const modalLayer = h('div', { class: 'modal-layer' });
  const flashEl = h('div', { class: 'edge-flash' });

  const band = BAND_INFO[def.band];
  const view = h(
    'div',
    { class: 'play' },
    canvas,
    flashEl,
    h(
      'div',
      { class: 'hud-top' },
      h('button', { class: 'hud-btn', title: 'Pauza (P)', 'aria-label': 'Pauza', onclick: () => pause() }, icon('pause')),
      h('div', { class: 'hud-title' }, custom ? icon('wrench') : h('b', null, String(def.id)), ' ', def.name, h('small', null, custom ? 'Muharrir' : band.title)),
      heartsEl,
      h('div', { class: 'hud-chip', title: 'Tangalar' }, icon('coin'), coinsEl),
      h('div', { class: 'hud-chip', title: 'Vaqt / tez yulduz uchun' }, icon('clock'), timeEl, h('small', null, Number.isFinite(parMs) ? ` / ${fmtTime(parMs)}` : '')),
      h('div', { class: 'hud-chip', title: "O'tgan mashinalar" }, icon('car'), progEl),
      h('button', { class: 'hud-btn', title: 'Maslahat (H)', 'aria-label': 'Maslahat', onclick: () => hint() }, icon('bulb')),
      h('button', { class: 'hud-btn', title: 'Qoidalar', onclick: () => showIntro(true) }, '?'),
      h('button', { class: 'hud-btn', title: 'Qayta boshlash (R)', 'aria-label': 'Qayta boshlash', onclick: () => restart() }, icon('restart')),
    ),
    poseEl,
    penaltyEl,
    softEl,
    modalLayer,
  );
  clear(root);
  root.appendChild(view);

  const renderer = new Renderer(canvas);
  renderer.padTop = 64;
  renderer.padBottom = 16;

  // ---- state -----------------------------------------------------------------
  let engine!: GameEngine;
  let offEngine: (() => void) | null = null;
  let raf = 0;
  let last = performance.now();
  let acc = 0;
  let paused = false;
  let modalOpen = false;
  let ended = false;
  let lastPenaltyReason: keyof typeof REASON_TEXT | null = null;
  let penaltyTimer: ReturnType<typeof setTimeout> | null = null;
  let softTimer: ReturnType<typeof setTimeout> | null = null;
  let pointer: { x: number; y: number } | null = null;
  let hintTimer: ReturnType<typeof setTimeout> | null = null;
  const bossArrows = () => store.getState().save.settings.controllerArrows || def.id === 10;

  const applySettings = () => {
    const s = store.getState().save.settings;
    renderer.settings = { spriteCache: s.spriteCache, assist: s.assist, controllerArrows: bossArrows(), perf: s.perf };
  };

  /** Civilian traffic = the common local car park + every model the player owns. */
  function heroLook() {
    const s = store.getState().save;
    const owned = s.owned.filter((id) => MODELS.some((m) => m.id === id));
    return {
      levelId: def!.id,
      ownedModels: [...new Set([...COMMON_MODELS, ...owned])],
      hero: s.loadout,
    };
  }

  function renderHearts() {
    clear(heartsEl);
    for (let i = 0; i < level.lives; i++) heartsEl.appendChild(icon('heart', i < engine.lives ? '' : 'lost'));
  }

  function start() {
    offEngine?.();
    engine = new GameEngine(level, { parMs });
    offEngine = engine.on(onEvent);
    applySettings();
    renderer.setEngine(engine, heroLook());
    ended = false;
    acc = 0;
    last = performance.now();
    lastPenaltyReason = null;
    renderHearts();
    coinsEl.textContent = '0';
    hidePenalty();
  }

  function restart() {
    sfx.click();
    closeModal();
    start();
  }

  // ---- events → feedback -----------------------------------------------------
  function onEvent(e: EngineEvent) {
    const settings = store.getState().save.settings;
    switch (e.type) {
      case 'depart': {
        sfx.go();
        const v = engine.byId.get(e.id);
        if (v?.emergency) sfx.siren(true);
        if (e.deadlock) soft('check', 'Tiqilinch: haydovchilar kelishib oldi — bittasi o‘tadi');
        if (renderer.hintId === e.id) renderer.hintId = null;
        break;
      }
      case 'blocked':
        if (e.reason === 'not_front' || e.reason === 'not_ready') {
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
        renderer.popupAt(e.id, `+${e.coins}`, '#ffd166');
        coinsEl.textContent = String(engine.vehicleCoins);
        break;
      case 'arrive': {
        const v = engine.byId.get(e.id);
        if (v?.emergency) {
          sfx.siren();
          soft(v.kind === 'fire' ? 'warn' : 'plus', v.kind === 'fire' ? "O't o'chirish mashinasi kelyapti!" : 'Tez yordam kelyapti!');
        }
        break;
      }
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
    softTimer = setTimeout(() => softEl.classList.add('hidden'), 1800);
  }

  function showPenalty(reason: keyof typeof REASON_TEXT) {
    const r = REASON_TEXT[reason];
    clear(penaltyEl);
    penaltyEl.append(
      h('div', { class: 'penalty-icon' }, icon(REASON_ICON[reason])),
      h('div', null, h('div', { class: 'penalty-title' }, `YPX hushtagi! ${r.title}`), h('div', { class: 'penalty-text' }, r.text)),
    );
    penaltyEl.classList.remove('hidden');
    if (penaltyTimer) clearTimeout(penaltyTimer);
    penaltyTimer = setTimeout(hidePenalty, 3000);
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
    renderer.hintId = moves[0].id;
    hintTimer = setTimeout(() => (renderer.hintId = null), 3500);
  }

  // ---- modals ----------------------------------------------------------------
  function openModal(content: HTMLElement) {
    clear(modalLayer);
    modalLayer.appendChild(h('div', { class: 'modal-backdrop' }, content));
    modalOpen = true;
  }

  function closeModal() {
    clear(modalLayer);
    modalOpen = false;
    last = performance.now();
  }

  function showIntro(force: boolean) {
    const intro = def!.intro;
    const tip = def!.tip;
    if (!force && (!intro || (store.getState().save.seenIntro.includes(def!.id) && !custom))) return;
    openModal(
      h(
        'div',
        { class: 'modal' },
        h('h2', null, intro?.title ?? def!.name),
        intro ? h('p', null, intro.text) : null,
        tip ? h('p', { class: 'tip' }, icon('bulb'), ' ', tip) : null,
        !intro && !tip ? h('p', null, "Qoidalarni eslang: o'ng qo'l, belgilar, svetofor, maxsus transport, aylanma.") : null,
        h('div', { class: 'modal-actions' }, h('button', { class: 'btn primary', onclick: () => { store.getState().markIntroSeen(def!.id); closeModal(); } }, 'Tushunarli, boshladik!')),
      ),
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
          h('button', { class: 'btn ghost', onclick: () => exit() }, custom ? 'Muharrirga qaytish' : 'Bosqichlar ro‘yxati'),
        ),
      ),
    );
  }

  function exit() {
    closeModal();
    store.getState().go(custom ? 'editor' : 'levels');
  }

  function finish(result: LevelResult) {
    const replay = result.completed ? makeReplay(engine) : null;
    const reward: Reward = store.getState().finishRun(target!, def!, result, replay, { hints: 0 }).reward;
    if (result.completed) sfx.win();
    else sfx.lose();
    const next = !custom && def!.id < LEVEL_COUNT ? def!.id + 1 : null;
    const body = result.completed
      ? h(
          'div',
          { class: 'modal result' },
          h('h2', null, custom ? 'Sinov yakunlandi!' : `${def!.id}-bosqich yakunlandi!`),
          starRow(result.stars, 3, 'big'),
          h(
            'ul',
            { class: 'result-list' },
            h('li', null, icon('star', result.mistakes === 0 ? 'on' : 'off'), result.mistakes === 0 ? ' Xatosiz!' : ` Xatolar: ${result.mistakes}`),
            h('li', null, icon('star', result.timeMs <= parMs ? 'on' : 'off'), result.timeMs <= parMs ? ` Tez: ${fmtTime(result.timeMs)} (chegara ${fmtTime(parMs)})` : ` Vaqt: ${fmtTime(result.timeMs)} (tez yulduz uchun ${fmtTime(parMs)} gacha)`),
            h('li', null, icon('car'), ` ${result.cleared} ta mashina o'tkazildi`),
          ),
          custom
            ? null
            : h(
                'div',
                { class: 'reward' },
                h('div', { class: 'reward-total' }, icon('coin'), ` +${reward.total}`),
                h('small', null, `mashinalar ${reward.vehicles} · bosqich ${reward.completion} · yulduzlar ${reward.stars}`),
              ),
          h(
            'div',
            { class: 'modal-actions' },
            next ? h('button', { class: 'btn primary', onclick: () => { closeModal(); store.getState().play(next); } }, 'Keyingi bosqich ', icon('next')) : null,
            h('button', { class: 'btn', onclick: () => restart() }, 'Qayta o‘ynash'),
            h('button', { class: 'btn ghost', onclick: () => exit() }, custom ? 'Muharrir' : 'Bosqichlar'),
          ),
        )
      : h(
          'div',
          { class: 'modal result lost' },
          h('h2', null, icon('heart', 'lost'), ' Jonlar tugadi'),
          lastPenaltyReason ? h('p', null, h('b', null, REASON_TEXT[lastPenaltyReason].title), ': ', REASON_TEXT[lastPenaltyReason].text) : null,
          def!.tip ? h('p', { class: 'tip' }, icon('bulb'), ' ', def!.tip) : null,
          h('div', { class: 'modal-actions' }, h('button', { class: 'btn primary', onclick: () => restart() }, 'Qayta urinish'), h('button', { class: 'btn ghost', onclick: () => exit() }, 'Chiqish')),
        );
    openModal(body);
  }

  // ---- input -----------------------------------------------------------------
  const localPt = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const onDown = (e: PointerEvent) => {
    sfx.unlock();
    if (modalOpen || ended) return;
    const p = localPt(e);
    const id = renderer.pick(p.x, p.y);
    if (id) engine.tap(id);
  };
  const onMove = (e: PointerEvent) => {
    if (e.pointerType === 'mouse') pointer = localPt(e);
  };
  const onLeave = () => {
    pointer = null;
    renderer.hoverId = null;
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === ' ' || e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
      e.preventDefault();
      if (modalOpen && !ended) closeModal();
      else pause();
    } else if (e.key === 'r' || e.key === 'R') restart();
    else if (e.key === 'h' || e.key === 'H') hint();
  };
  const onVisibility = () => {
    paused = document.hidden;
    last = performance.now();
  };
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerleave', onLeave);
  window.addEventListener('keydown', onKey);
  document.addEventListener('visibilitychange', onVisibility);
  const ro = new ResizeObserver(() => renderer.resize());
  ro.observe(canvas);
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
      acc += Math.min(250, now - last);
      while (acc >= TICK_MS) {
        engine.step();
        acc -= TICK_MS;
      }
    }
    last = now;
    if (pointer) renderer.hoverId = renderer.pick(pointer.x, pointer.y);
    renderer.render(running ? acc / TICK_MS : 0, now);

    const t = fmtTime(engine.timeMs());
    if (t !== lastTimeText) timeEl.textContent = lastTimeText = t;
    const prog = `${engine.cleared}/${engine.total}`;
    if (prog !== lastProg) progEl.textContent = lastProg = prog;
    const pose = engine.pose();
    const poseText = pose && bossArrows()
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
  renderer.resize();
  raf = requestAnimationFrame(frame);
  if (def.intro && (custom || !store.getState().save.seenIntro.includes(def.id))) showIntro(false);

  (window as unknown as Record<string, unknown>).__chorraha = { engine: () => engine, renderer };

  return () => {
    cancelAnimationFrame(raf);
    offEngine?.();
    ro.disconnect();
    unsubSettings();
    canvas.removeEventListener('pointerdown', onDown);
    canvas.removeEventListener('pointermove', onMove);
    canvas.removeEventListener('pointerleave', onLeave);
    window.removeEventListener('keydown', onKey);
    document.removeEventListener('visibilitychange', onVisibility);
    if (penaltyTimer) clearTimeout(penaltyTimer);
    if (softTimer) clearTimeout(softTimer);
    if (hintTimer) clearTimeout(hintTimer);
  };
}
