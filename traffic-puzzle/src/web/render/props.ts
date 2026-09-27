/**
 * Depth-sorted props: sign poles, traffic lights, the traffic controller
 * (regulirovshik), trees. Plates/heads are screen-aligned billboards so they
 * stay readable at any zoom.
 */

import { bodySide, gesturePermits, type ActivePose } from '../../core/controller.js';
import { DIR_VEC, inLane, rot } from '../../core/dir.js';
import type { Aspect, Dir, Gesture, SignType, Turn } from '../../core/types.js';
import { Camera, type ScreenPt } from './camera.js';

type Ctx = CanvasRenderingContext2D;
const S: ScreenPt = { x: 0, y: 0 };
const S2: ScreenPt = { x: 0, y: 0 };

/** Roadside position to the right of the incoming lane of arm d, at distance u. */
export function roadside(d: Dir, u: number, extra = 1.12): [number, number] {
  const [x, y] = inLane(d, u);
  const [dx, dy] = DIR_VEC[d];
  // right of the inbound heading (−dx, −dy) is (dy, −dx)
  return [x + dy * extra, y - dx * extra];
}

function pole(ctx: Ctx, cam: Camera, x: number, y: number, h: number): ScreenPt {
  cam.project(x, y, 0, S);
  cam.project(x, y, h, S2);
  ctx.strokeStyle = '#6b7280';
  ctx.lineWidth = Math.max(1.5, cam.scale * 0.06);
  ctx.beginPath();
  ctx.moveTo(S.x, S.y);
  ctx.lineTo(S2.x, S2.y);
  ctx.stroke();
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath();
  ctx.ellipse(S.x, S.y, cam.scale * 0.12, cam.scale * 0.06, 0, 0, Math.PI * 2);
  ctx.fill();
  return { x: S2.x, y: S2.y };
}

export function drawSign(ctx: Ctx, cam: Camera, d: Dir, sign: SignType, stopU: number, roundabout: boolean): void {
  if (sign === 'none' && !roundabout) return;
  const [x, y] = roadside(d, stopU + 0.45);
  const top = pole(ctx, cam, x, y, 1.35);
  const r = Math.max(7, cam.scale * 0.27);
  const cx = top.x;
  const cy = top.y - r * 0.7;
  ctx.lineJoin = 'round';
  if (roundabout) {
    ctx.fillStyle = '#1d4ed8';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = Math.max(1.2, r * 0.16);
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.5, 0.3, Math.PI * 1.75);
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(cx + r * 0.55, cy - r * 0.05);
    ctx.lineTo(cx + r * 0.25, cy - r * 0.05);
    ctx.lineTo(cx + r * 0.42, cy + r * 0.3);
    ctx.fill();
    return;
  }
  if (sign === 'main') {
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(cx, cy - r);
    ctx.lineTo(cx + r, cy);
    ctx.lineTo(cx, cy + r);
    ctx.lineTo(cx - r, cy);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#f5b700';
    const k = 0.68;
    ctx.beginPath();
    ctx.moveTo(cx, cy - r * k);
    ctx.lineTo(cx + r * k, cy);
    ctx.lineTo(cx, cy + r * k);
    ctx.lineTo(cx - r * k, cy);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx, cy - r);
    ctx.lineTo(cx + r, cy);
    ctx.lineTo(cx, cy + r);
    ctx.lineTo(cx - r, cy);
    ctx.closePath();
    ctx.stroke();
  } else if (sign === 'yield') {
    ctx.fillStyle = '#d62828';
    ctx.beginPath();
    ctx.moveTo(cx - r, cy - r * 0.75);
    ctx.lineTo(cx + r, cy - r * 0.75);
    ctx.lineTo(cx, cy + r);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.58, cy - r * 0.5);
    ctx.lineTo(cx + r * 0.58, cy - r * 0.5);
    ctx.lineTo(cx, cy + r * 0.48);
    ctx.closePath();
    ctx.fill();
  } else if (sign === 'stop') {
    ctx.fillStyle = '#d62828';
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = Math.PI / 8 + (i * Math.PI) / 4;
      const px = cx + r * Math.cos(a);
      const py = cy + r * Math.sin(a);
      if (i) ctx.lineTo(px, py);
      else ctx.moveTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${Math.round(r * 0.62)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('STOP', cx, cy + 1);
  }
}

export function drawTrafficLight(ctx: Ctx, cam: Camera, d: Dir, stopU: number, aspect: Aspect, countdown: number, nowMs: number): void {
  const [x, y] = roadside(d, stopU + 0.05, 1.3);
  const top = pole(ctx, cam, x, y, 1.75);
  const r = Math.max(3, cam.scale * 0.1);
  const w = r * 2.8;
  const h = r * 7.4;
  const bx = top.x - w / 2;
  const by = top.y - h;
  ctx.fillStyle = '#1f2328';
  ctx.beginPath();
  ctx.roundRect(bx, by, w, h, r * 0.8);
  ctx.fill();
  const blinkSlow = Math.floor(nowMs / 500) % 2 === 0;
  const blinkFast = Math.floor(nowMs / 250) % 2 === 0;
  const on = {
    red: aspect === 'red' || aspect === 'red_amber',
    amber: aspect === 'amber' || aspect === 'red_amber' || (aspect === 'flashing_amber' && blinkSlow),
    green: aspect === 'green' || (aspect === 'green_flash' && blinkFast),
  };
  const lamps: [boolean, string, string][] = [
    [on.red, '#ff3b30', '#4a1414'],
    [on.amber, '#ffcc00', '#4a3d0a'],
    [on.green, '#34c759', '#123d1f'],
  ];
  lamps.forEach(([lit, c, dim], i) => {
    const ly = by + r * 1.25 + i * r * 2.45;
    if (lit) {
      ctx.fillStyle = c + '55';
      ctx.beginPath();
      ctx.arc(top.x, ly, r * 1.9, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = lit ? c : dim;
    ctx.beginPath();
    ctx.arc(top.x, ly, r, 0, Math.PI * 2);
    ctx.fill();
  });
  if (aspect !== 'flashing_amber' && countdown > 0) {
    const secs = Math.ceil(countdown / 60);
    if (secs <= 99) {
      ctx.fillStyle = '#111';
      ctx.beginPath();
      ctx.roundRect(bx + w + 2, by + h * 0.35, r * 3.2, r * 2.4, 3);
      ctx.fill();
      ctx.fillStyle = on.green ? '#34c759' : on.red || on.amber ? '#ff6b5e' : '#ddd';
      ctx.font = `bold ${Math.round(r * 1.8)}px ui-monospace, monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(secs), bx + w + 2 + r * 1.6, by + h * 0.35 + r * 1.25);
    }
  }
}

export function drawTree(ctx: Ctx, cam: Camera, x: number, y: number, size: number): void {
  cam.project(x, y, 0, S);
  const s = cam.scale * size;
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath();
  ctx.ellipse(S.x + s * 0.15, S.y, s * 0.55, s * 0.28, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#7a5230';
  ctx.fillRect(S.x - s * 0.07, S.y - s * 0.7, s * 0.14, s * 0.7);
  ctx.fillStyle = '#3f8f3a';
  ctx.beginPath();
  ctx.arc(S.x, S.y - s * 1.05, s * 0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#56a84c';
  ctx.beginPath();
  ctx.arc(S.x - s * 0.15, S.y - s * 1.2, s * 0.33, 0, Math.PI * 2);
  ctx.fill();
}

// ---------------------------------------------------------------------------
// Traffic controller (regulirovshik)
// ---------------------------------------------------------------------------

const UNIFORM = '#2b3a55';
const SKIN = '#e0ac7e';

/** Draw the controller at the centre, chest facing arm `facing`, in the given gesture. */
export function drawController(ctx: Ctx, cam: Camera, gesture: Gesture, facing: Dir): void {
  const s = cam.scale;
  // forward (chest) and right-hand vectors in world space
  const [fx, fy] = DIR_VEC[facing];
  const [rx, ry] = DIR_VEC[rot(facing, 1)];
  const W = (f: number, r: number, z: number, out: ScreenPt) => cam.project(fx * f + rx * r, fy * f + ry * r, z, out);
  const line = (a: [number, number, number], b: [number, number, number], color: string, width: number) => {
    W(a[0], a[1], a[2], S);
    W(b[0], b[1], b[2], S2);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(S.x, S.y);
    ctx.lineTo(S2.x, S2.y);
    ctx.stroke();
  };

  // platform + chest-direction wedge
  cam.project(0, 0, 0, S);
  ctx.fillStyle = '#f4f4f4';
  ctx.beginPath();
  ctx.ellipse(S.x, S.y, s * 0.3 * Math.SQRT2, s * 0.15 * Math.SQRT2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#d62828';
  ctx.beginPath();
  ctx.ellipse(S.x, S.y, s * 0.2 * Math.SQRT2, s * 0.1 * Math.SQRT2, 0, 0, Math.PI * 2);
  ctx.fill();
  const wedge: ScreenPt[] = [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }];
  W(0.95, 0, 0.01, wedge[0]);
  W(0.35, 0.2, 0.01, wedge[1]);
  W(0.35, -0.2, 0.01, wedge[2]);
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.beginPath();
  ctx.moveTo(wedge[0].x, wedge[0].y);
  ctx.lineTo(wedge[1].x, wedge[1].y);
  ctx.lineTo(wedge[2].x, wedge[2].y);
  ctx.closePath();
  ctx.fill();

  const lw = Math.max(2, s * 0.09);
  // legs
  line([0, 0.06, 0], [0, 0.06, 0.34], '#1f2a3d', lw);
  line([0, -0.06, 0], [0, -0.06, 0.34], '#1f2a3d', lw);
  // torso (thick vertical stroke) + belt
  line([0, 0, 0.36], [0, 0, 0.66], UNIFORM, Math.max(4, s * 0.24));
  line([0.01, -0.1, 0.4], [0.01, 0.1, 0.4], '#f4f4f4', Math.max(1.5, s * 0.05));
  // chest badge (only meaningful when visible)
  const chestVisible = fx + fy > -0.01;
  if (chestVisible) line([0.08, 0.03, 0.56], [0.08, 0.05, 0.58], '#f5c518', Math.max(2, s * 0.06));

  // arms
  const shoulderR: [number, number, number] = [0, 0.13, 0.64];
  const shoulderL: [number, number, number] = [0, -0.13, 0.64];
  let handR: [number, number, number];
  let handL: [number, number, number];
  if (gesture === 'arms_side') {
    handR = [0, 0.5, 0.66];
    handL = [0, -0.5, 0.66];
  } else if (gesture === 'right_forward') {
    handR = [0.42, 0.14, 0.64];
    handL = [0, -0.17, 0.36];
  } else {
    handR = [0, 0.16, 1.08];
    handL = [0, -0.17, 0.36];
  }
  line(shoulderL, handL, UNIFORM, Math.max(2, s * 0.08));
  line(shoulderR, handR, UNIFORM, Math.max(2, s * 0.08));
  // white gloves
  for (const hnd of [handL, handR]) {
    W(hnd[0], hnd[1], hnd[2], S);
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(S.x, S.y, Math.max(1.5, s * 0.05), 0, Math.PI * 2);
    ctx.fill();
  }
  // baton (tayoqcha) in the right hand, striped
  const dir = [handR[0] - shoulderR[0], handR[1] - shoulderR[1], handR[2] - shoulderR[2]];
  const len = Math.hypot(dir[0], dir[1], dir[2]) || 1;
  const k = 0.3 / len;
  for (let i = 0; i < 4; i++) {
    const a: [number, number, number] = [handR[0] + dir[0] * k * (i / 4), handR[1] + dir[1] * k * (i / 4), handR[2] + dir[2] * k * (i / 4)];
    const b: [number, number, number] = [handR[0] + dir[0] * k * ((i + 1) / 4), handR[1] + dir[1] * k * ((i + 1) / 4), handR[2] + dir[2] * k * ((i + 1) / 4)];
    line(a, b, i % 2 ? '#111' : '#fff', Math.max(1.8, s * 0.05));
  }

  // head + cap
  W(0, 0, 0.78, S);
  ctx.fillStyle = SKIN;
  ctx.beginPath();
  ctx.arc(S.x, S.y, Math.max(3, s * 0.11), 0, Math.PI * 2);
  ctx.fill();
  if (chestVisible) {
    // face toward the chest direction
    W(0.08, 0.035, 0.8, S2);
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.arc(S2.x, S2.y, Math.max(0.8, s * 0.018), 0, Math.PI * 2);
    ctx.fill();
    W(0.08, -0.035, 0.8, S2);
    ctx.beginPath();
    ctx.arc(S2.x, S2.y, Math.max(0.8, s * 0.018), 0, Math.PI * 2);
    ctx.fill();
  }
  W(0, 0, 0.88, S);
  ctx.fillStyle = '#f4f4f4';
  ctx.beginPath();
  ctx.ellipse(S.x, S.y, s * 0.14, s * 0.07, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1f2a3d';
  ctx.fillRect(S.x - s * 0.1, S.y + s * 0.02, s * 0.2, s * 0.03);
}

/** Assist overlay: green/red turn arrows at each stop line for the current pose. */
export function drawControllerAssist(ctx: Ctx, cam: Camera, pose: ActivePose, armEnabled: readonly boolean[], stopU: number): void {
  for (let d = 0; d < 4; d++) {
    if (!armEnabled[d]) continue;
    const from = d as Dir;
    const side = bodySide(pose.pose.facing, from);
    const turns: Turn[] = ['left', 'straight', 'right'];
    const [bx, by] = inLane(from, stopU + 0.55);
    cam.project(bx, by, 0.02, S);
    turns.forEach((t, i) => {
      const ok = gesturePermits(pose.pose.gesture, side, t);
      const x = S.x + (i - 1) * cam.scale * 0.34;
      const y = S.y - cam.scale * 0.55;
      const r = cam.scale * 0.15;
      ctx.fillStyle = ok ? 'rgba(22,163,74,0.92)' : 'rgba(220,38,38,0.85)';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      drawTurnGlyph(ctx, x, y, r * 0.62, ok ? t : null);
    });
  }
}

/** White vector glyph: straight / left / right arrow, or a cross when `turn` is null. */
function drawTurnGlyph(ctx: Ctx, x: number, y: number, s: number, turn: Turn | null): void {
  ctx.strokeStyle = '#fff';
  ctx.fillStyle = '#fff';
  ctx.lineWidth = Math.max(1.4, s * 0.32);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  if (turn === null) {
    ctx.moveTo(x - s * 0.7, y - s * 0.7);
    ctx.lineTo(x + s * 0.7, y + s * 0.7);
    ctx.moveTo(x + s * 0.7, y - s * 0.7);
    ctx.lineTo(x - s * 0.7, y + s * 0.7);
    ctx.stroke();
    return;
  }
  const side = turn === 'left' ? -1 : 1;
  let tipX = x;
  let tipY = y - s;
  let ang = -Math.PI / 2;
  if (turn === 'straight') {
    ctx.moveTo(x, y + s);
    ctx.lineTo(x, y - s * 0.35);
  } else {
    ctx.moveTo(x - side * s * 0.35, y + s);
    ctx.lineTo(x - side * s * 0.35, y - s * 0.05);
    ctx.quadraticCurveTo(x - side * s * 0.35, y - s * 0.55, x + side * s * 0.25, y - s * 0.55);
    tipX = x + side * s;
    tipY = y - s * 0.55;
    ang = side > 0 ? 0 : Math.PI;
  }
  ctx.stroke();
  const hs = s * 0.62;
  ctx.beginPath();
  ctx.moveTo(tipX, tipY);
  ctx.lineTo(tipX - Math.cos(ang - 0.6) * hs, tipY - Math.sin(ang - 0.6) * hs);
  ctx.lineTo(tipX - Math.cos(ang + 0.6) * hs, tipY - Math.sin(ang + 0.6) * hs);
  ctx.closePath();
  ctx.fill();
}

