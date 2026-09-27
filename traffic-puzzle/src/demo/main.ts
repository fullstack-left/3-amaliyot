/**
 * Browser prototype entry point.
 * Wires the framework-agnostic engine to a canvas + minimal HUD so the team
 * can actually PLAY the design in a browser (no React/Flutter needed here).
 */

import { GameEngine } from '../core/engine.js';
import { canVehicleMove } from '../core/rules.js';
import { controllerPoseAt } from '../core/controller.js';
import { phaseAt } from '../core/lights.js';
import { CAMPAIGN } from '../levels/levels.js';
import {
  Direction,
  TrafficLightPhase,
  Vehicle,
  VehicleState,
} from '../core/types.js';
import {
  RenderConfig,
  drawVehicle,
  isoProject,
  laneAnchor,
  renderScene,
  sortForPaint,
  TILE_H,
} from '../render/iso.js';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
const hud = {
  level: document.getElementById('level')!,
  lives: document.getElementById('lives')!,
  coins: document.getElementById('coins')!,
  msg: document.getElementById('msg')!,
  pose: document.getElementById('pose')!,
};

let levelIndex = 0;
let engine = new GameEngine(CAMPAIGN[levelIndex]);
let sceneCanvas = document.createElement('canvas');
let sceneCtx = sceneCanvas.getContext('2d')!;

function cfg(now: number): RenderConfig {
  return {
    originX: canvas.width / 2,
    originY: canvas.height / 2 - 40,
    intersectionType: engine.state.type,
    now,
  };
}

function rebuildScene() {
  sceneCanvas.width = canvas.width;
  sceneCanvas.height = canvas.height;
  renderScene(sceneCtx, cfg(0));
}

function resize() {
  canvas.width = canvas.clientWidth;
  canvas.height = canvas.clientHeight;
  rebuildScene();
}
window.addEventListener('resize', resize);

function loadLevel(i: number) {
  levelIndex = Math.max(0, Math.min(CAMPAIGN.length - 1, i));
  engine = new GameEngine(CAMPAIGN[levelIndex]);
  bindEngine();
  rebuildScene();
  flash(`${CAMPAIGN[levelIndex].name}`);
}

function bindEngine() {
  engine.subscribe((e) => {
    if (e.type === 'COLLISION') {
      flash(`💥 ${e.decision.explanation}  (Jon: ${e.livesRemaining})`, '#ef4444');
    } else if (e.type === 'ILLEGAL_TAP') {
      flash(`⛔ ${e.decision.explanation}`, '#f59e0b');
    } else if (e.type === 'MOVE_COMPLETED') {
      flash(`✅ +${e.coinsAwarded} tanga`, '#10b981');
    } else if (e.type === 'LEVEL_COMPLETE') {
      flash(`🏁 Bosqich tamom! Keyingi bosqich uchun bosing.`, '#10b981');
    } else if (e.type === 'GAME_OVER') {
      flash(`☠️ O'yin tugadi. Qayta boshlash uchun R.`, '#ef4444');
    }
  });
}

let msgTimer = 0;
function flash(text: string, color = '#e5e7eb') {
  hud.msg.textContent = text;
  (hud.msg as HTMLElement).style.color = color;
  msgTimer = 2500;
}

// --- hit testing: map a click to the nearest front-waiting vehicle ---------
canvas.addEventListener('click', (ev) => {
  const rect = canvas.getBoundingClientRect();
  const mx = ev.clientX - rect.left;
  const my = ev.clientY - rect.top;
  const c = cfg(performance.now());

  let best: Vehicle | undefined;
  let bestD = 32 * 32; // 32px pick radius²
  for (const v of engine.getVehicles()) {
    if (v.state === VehicleState.CLEARED) continue;
    const a =
      v.state === VehicleState.CROSSING
        ? laneAnchor(v.from, 0)
        : laneAnchor(v.from, v.queueIndex);
    const { sx, sy } = isoProject(a.x, a.y, c.originX, c.originY);
    const d = (sx - mx) ** 2 + (sy - my) ** 2;
    if (d < bestD) {
      bestD = d;
      best = v;
    }
  }
  if (best) engine.tap(best.id);
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'r' || e.key === 'R') loadLevel(levelIndex);
  if (e.key === 'n' || e.key === 'N') loadLevel(levelIndex + 1);
  if (e.key === 'p' || e.key === 'P') loadLevel(levelIndex - 1);
});

// advance to next level when complete and player clicks
canvas.addEventListener('dblclick', () => {
  const st = engine.status();
  if (st.isComplete) loadLevel(levelIndex + 1);
  if (st.isGameOver) loadLevel(levelIndex);
});

// --- main loop -------------------------------------------------------------
let last = performance.now();
function frame(now: number) {
  const dt = Math.min(50, now - last);
  last = now;

  engine.update(dt);
  const st = engine.status();
  const c = cfg(now);

  // blit static scene
  ctx.drawImage(sceneCanvas, 0, 0);

  // draw traffic lights per approach
  drawLights(c);

  // draw vehicles back-to-front
  const sorted = sortForPaint(
    engine.getVehicles().filter((v) => v.state !== VehicleState.CLEARED),
    c,
  );
  for (const v of sorted) drawVehicle(ctx, v, c);

  // HUD
  hud.level.textContent = `Bosqich ${CAMPAIGN[levelIndex].id}`;
  hud.lives.textContent = '❤️'.repeat(Math.max(0, st.lives));
  hud.coins.textContent = `🪙 ${st.coins}`;
  hud.pose.textContent = st.controllerPose ? `👮 ${st.controllerPose}` : '';

  if (msgTimer > 0) {
    msgTimer -= dt;
    if (msgTimer <= 0) hud.msg.textContent = '';
  }

  requestAnimationFrame(frame);
}

function drawLights(c: RenderConfig) {
  for (const dir of [Direction.NORTH, Direction.EAST, Direction.SOUTH, Direction.WEST]) {
    const ap = engine.state.approaches[dir as Direction];
    if (!ap?.enabled || !ap.trafficLight) continue;
    const phase = phaseAt(ap.trafficLight, engine.state.clockMs);
    const a = laneAnchor(dir as Direction, -0.6);
    const { sx, sy } = isoProject(a.x, a.y, c.originX, c.originY);
    ctx.fillStyle =
      phase === TrafficLightPhase.GREEN
        ? '#22c55e'
        : phase === TrafficLightPhase.YELLOW
          ? '#eab308'
          : '#ef4444';
    ctx.beginPath();
    ctx.arc(sx, sy - TILE_H, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#000';
    ctx.stroke();
  }
}

// boot
resize();
bindEngine();
flash(CAMPAIGN[0].name);
requestAnimationFrame(frame);

// expose for console debugging / tutorials
(window as any).__tp = { engine, canVehicleMove, controllerPoseAt, loadLevel };
