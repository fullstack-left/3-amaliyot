/**
 * Isometric vehicle drawing.
 *
 * Vehicles are stacks of oriented boxes (body, cabin, cargo…) projected with the
 * 2:1 camera. Only faces whose outward normal points toward the viewer
 * (n.x + n.y > 0) are drawn, then the top — correct for convex boxes without a
 * z-buffer. Static appearance is rendered into a SPRITE per (look, heading
 * bucket) and cached (LRU); per-frame effects (sirens, indicators, neon, penalty
 * flash) are drawn on top.
 */

import { Camera, localCamera, Z_SCALE, type ScreenPt } from './camera.js';
import { alpha, shade } from './color.js';
import { LOOK_BODY_Z, type VehicleLook } from './looks.js';

type Ctx = CanvasRenderingContext2D;

/** Local (forward f, right r, up z) → screen, for a vehicle centred at (x, y) with heading h. */
export class Pose {
  x = 0;
  y = 0;
  c = 1;
  s = 0;
  constructor(public cam: Camera) {}

  set(x: number, y: number, h: number): this {
    this.x = x;
    this.y = y;
    this.c = Math.cos(h);
    this.s = Math.sin(h);
    return this;
  }

  p(f: number, r: number, z: number, out: ScreenPt): ScreenPt {
    const wx = this.x + this.c * f - this.s * r;
    const wy = this.y + this.s * f + this.c * r;
    return this.cam.project(wx, wy, z, out);
  }
}

const P: ScreenPt[] = Array.from({ length: 8 }, () => ({ x: 0, y: 0 }));

function poly(ctx: Ctx, pts: ScreenPt[], n: number, fill: string): void {
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < n; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

/** Brightness of a side face from its world normal (light from the south-west, above). */
function faceK(nx: number, ny: number): number {
  return 0.8 + 0.14 * ny - 0.12 * nx;
}

interface Face {
  nx: number;
  ny: number;
  corners: [number, number][]; // (f, r) pairs
}

function faces(pose: Pose, f0: number, f1: number, r0: number, r1: number): Face[] {
  const { c, s } = pose;
  return [
    { nx: c, ny: s, corners: [[f1, r0], [f1, r1]] },
    { nx: -c, ny: -s, corners: [[f0, r1], [f0, r0]] },
    { nx: -s, ny: c, corners: [[f1, r1], [f0, r1]] },
    { nx: s, ny: -c, corners: [[f0, r0], [f1, r0]] },
  ];
}

export function drawBox(
  ctx: Ctx,
  pose: Pose,
  f0: number,
  f1: number,
  r0: number,
  r1: number,
  z0: number,
  z1: number,
  side: string,
  top: string,
): void {
  for (const fc of faces(pose, f0, f1, r0, r1)) {
    if (fc.nx + fc.ny <= 0) continue;
    const [[fa, ra], [fb, rb]] = fc.corners;
    pose.p(fa, ra, z0, P[0]);
    pose.p(fb, rb, z0, P[1]);
    pose.p(fb, rb, z1, P[2]);
    pose.p(fa, ra, z1, P[3]);
    poly(ctx, P, 4, shade(side, faceK(fc.nx, fc.ny)));
  }
  pose.p(f0, r0, z1, P[0]);
  pose.p(f1, r0, z1, P[1]);
  pose.p(f1, r1, z1, P[2]);
  pose.p(f0, r1, z1, P[3]);
  poly(ctx, P, 4, shade(top, 1.06));
}

/** A rectangle painted on one side face of a box (windows, stripes, lights). */
function sideQuad(
  ctx: Ctx,
  pose: Pose,
  face: 'front' | 'back' | 'right' | 'left',
  a0: number,
  a1: number,
  plane: number,
  z0: number,
  z1: number,
  color: string,
): void {
  const { c, s } = pose;
  let nx: number;
  let ny: number;
  if (face === 'front') [nx, ny] = [c, s];
  else if (face === 'back') [nx, ny] = [-c, -s];
  else if (face === 'right') [nx, ny] = [-s, c];
  else [nx, ny] = [s, -c];
  if (nx + ny <= 0.02) return;
  const at = (a: number, z: number, o: ScreenPt) =>
    face === 'front' || face === 'back' ? pose.p(plane, a, z, o) : pose.p(a, plane, z, o);
  at(a0, z0, P[0]);
  at(a1, z0, P[1]);
  at(a1, z1, P[2]);
  at(a0, z1, P[3]);
  poly(ctx, P, 4, shade(color, faceK(nx, ny) + 0.12));
}

function topQuad(ctx: Ctx, pose: Pose, f0: number, f1: number, r0: number, r1: number, z: number, color: string): void {
  pose.p(f0, r0, z, P[0]);
  pose.p(f1, r0, z, P[1]);
  pose.p(f1, r1, z, P[2]);
  pose.p(f0, r1, z, P[3]);
  poly(ctx, P, 4, color);
}

function shadow(ctx: Ctx, pose: Pose, hl: number, hw: number): void {
  const e = 0.07;
  pose.p(-hl - e, -hw - e, 0, P[0]);
  pose.p(hl + e, -hw - e, 0, P[1]);
  pose.p(hl + e, hw + e, 0, P[2]);
  pose.p(-hl - e, hw + e, 0, P[3]);
  poly(ctx, P, 4, 'rgba(20,24,30,0.28)');
}

function wheels(ctx: Ctx, pose: Pose, hl: number, hw: number, sport: boolean): void {
  const inset = Math.min(0.24, hl * 0.4);
  for (const fw of [hl - inset, -hl + inset]) {
    for (const side of [1, -1]) {
      const r0 = side > 0 ? hw - 0.12 : -hw;
      const r1 = side > 0 ? hw : -hw + 0.12;
      drawBox(ctx, pose, fw - 0.12, fw + 0.12, r0, r1, 0, 0.2, '#1b1e23', '#2a2e35');
      if (sport) sideQuad(ctx, pose, side > 0 ? 'right' : 'left', fw - 0.07, fw + 0.07, side > 0 ? hw + 0.001 : -hw - 0.001, 0.05, 0.15, '#f2c14e');
    }
  }
}

function drawSedan(ctx: Ctx, pose: Pose, l: VehicleLook): void {
  const hl = l.length / 2;
  const hw = l.width / 2;
  const zb = LOOK_BODY_Z;
  const zt = zb + l.bodyH;
  const has = (m: string) => l.mods.includes(m);
  shadow(ctx, pose, hl, hw);
  wheels(ctx, pose, hl, hw, has('sport_wheels'));
  drawBox(ctx, pose, -hl, hl, -hw, hw, zb, zt, l.color, l.color);
  // lights
  sideQuad(ctx, pose, 'front', hw - 0.16, hw - 0.04, hl + 0.001, zt - 0.1, zt - 0.03, '#fff7cc');
  sideQuad(ctx, pose, 'front', -hw + 0.04, -hw + 0.16, hl + 0.001, zt - 0.1, zt - 0.03, '#fff7cc');
  sideQuad(ctx, pose, 'back', -hw + 0.04, -hw + 0.15, -hl - 0.001, zt - 0.1, zt - 0.03, '#c81e1e');
  sideQuad(ctx, pose, 'back', hw - 0.15, hw - 0.04, -hl - 0.001, zt - 0.1, zt - 0.03, '#c81e1e');
  if (l.decal === 'police') {
    sideQuad(ctx, pose, 'right', -hl + 0.05, hl - 0.05, hw + 0.001, zb + 0.08, zb + 0.15, '#1d4ed8');
    sideQuad(ctx, pose, 'left', -hl + 0.05, hl - 0.05, -hw - 0.001, zb + 0.08, zb + 0.15, '#1d4ed8');
  }
  if (has('metan')) {
    // open trunk lid + methane cylinder sticking out (comedic)
    drawBox(ctx, pose, -hl - 0.12, -hl + 0.3, -hw + 0.1, hw - 0.1, zt - 0.02, zt + 0.16, '#dfe6ec', '#f4f7fa');
    drawBox(ctx, pose, -hl - 0.14, -hl - 0.1, -0.05, 0.05, zt + 0.02, zt + 0.12, '#d62828', '#ff4d4d');
    drawBox(ctx, pose, -hl + 0.28, -hl + 0.33, -hw + 0.06, hw - 0.06, zt + 0.16, zt + 0.42, l.color, l.color);
  }
  const cf0 = -hl + l.length * l.cabinBack;
  const cf1 = hl - l.length * l.cabinFront;
  const ci = l.inset;
  drawBox(ctx, pose, cf0, cf1, -hw + ci, hw - ci, zt, zt + l.cabinH, l.glass, l.roof);
  const roofZ = zt + l.cabinH;
  if (has('spoiler')) {
    drawBox(ctx, pose, -hl + 0.02, -hl + 0.05, -hw + 0.12, -hw + 0.16, zt, zt + 0.12, '#222', '#333');
    drawBox(ctx, pose, -hl + 0.02, -hl + 0.05, hw - 0.16, hw - 0.12, zt, zt + 0.12, '#222', '#333');
    drawBox(ctx, pose, -hl - 0.02, -hl + 0.12, -hw + 0.02, hw - 0.02, zt + 0.12, zt + 0.16, '#1b1e23', '#30343c');
  }
  if (has('gilam')) {
    drawBox(ctx, pose, cf0 + 0.06, cf1 - 0.06, -hw - 0.04, hw + 0.04, roofZ, roofZ + 0.12, '#9b1c31', '#c0392b');
    topQuad(ctx, pose, cf0 + 0.1, cf1 - 0.1, -0.03, 0.03, roofZ + 0.121, '#f1c40f');
  }
  if (has('shashka') || l.decal === 'taxi') {
    drawBox(ctx, pose, -0.07, 0.07, -0.13, 0.13, roofZ, roofZ + 0.08, '#f7d046', '#ffe27a');
    sideQuad(ctx, pose, 'right', -0.06, 0.0, 0.131, roofZ + 0.01, roofZ + 0.07, '#111');
    sideQuad(ctx, pose, 'left', 0.0, 0.06, -0.131, roofZ + 0.01, roofZ + 0.07, '#111');
    sideQuad(ctx, pose, 'front', -0.12, -0.02, 0.071, roofZ + 0.01, roofZ + 0.07, '#111');
    sideQuad(ctx, pose, 'back', 0.02, 0.12, -0.071, roofZ + 0.01, roofZ + 0.07, '#111');
  }
}

function drawBus(ctx: Ctx, pose: Pose, l: VehicleLook): void {
  const hl = l.length / 2;
  const hw = l.width / 2;
  shadow(ctx, pose, hl, hw);
  wheels(ctx, pose, hl, hw, false);
  drawBox(ctx, pose, -hl, hl, -hw, hw, 0.12, 0.95, l.color, l.roof);
  for (const side of ['right', 'left'] as const) {
    const plane = side === 'right' ? hw + 0.001 : -hw - 0.001;
    sideQuad(ctx, pose, side, -hl + 0.12, hl - 0.12, plane, 0.52, 0.84, l.glass);
    sideQuad(ctx, pose, side, -hl + 0.06, hl - 0.06, plane, 0.3, 0.36, '#f4f7f8');
  }
  sideQuad(ctx, pose, 'front', -hw + 0.05, hw - 0.05, hl + 0.001, 0.45, 0.88, l.glass);
  sideQuad(ctx, pose, 'back', -hw + 0.08, hw - 0.08, -hl - 0.001, 0.6, 0.85, l.glass);
}

function drawTruck(ctx: Ctx, pose: Pose, l: VehicleLook): void {
  const hl = l.length / 2;
  const hw = l.width / 2;
  shadow(ctx, pose, hl, hw);
  wheels(ctx, pose, hl, hw, false);
  drawBox(ctx, pose, -hl, hl - 0.56, -hw, hw, 0.22, 0.92, '#8a96a3', '#a7b1bc');
  drawBox(ctx, pose, hl - 0.52, hl, -hw + 0.02, hw - 0.02, 0.12, 0.78, l.color, l.color);
  sideQuad(ctx, pose, 'front', -hw + 0.06, hw - 0.06, hl + 0.001, 0.46, 0.72, l.glass);
  sideQuad(ctx, pose, 'right', hl - 0.4, hl - 0.1, hw - 0.019, 0.46, 0.7, l.glass);
  sideQuad(ctx, pose, 'left', hl - 0.4, hl - 0.1, -hw + 0.019, 0.46, 0.7, l.glass);
}

function drawVan(ctx: Ctx, pose: Pose, l: VehicleLook): void {
  const hl = l.length / 2;
  const hw = l.width / 2;
  shadow(ctx, pose, hl, hw);
  wheels(ctx, pose, hl, hw, false);
  drawBox(ctx, pose, -hl, hl, -hw, hw, 0.1, 0.74, l.color, l.roof);
  sideQuad(ctx, pose, 'front', -hw + 0.05, hw - 0.05, hl + 0.001, 0.42, 0.68, l.glass);
  for (const side of ['right', 'left'] as const) {
    const plane = side === 'right' ? hw + 0.001 : -hw - 0.001;
    sideQuad(ctx, pose, side, hl - 0.42, hl - 0.08, plane, 0.44, 0.66, l.glass);
    sideQuad(ctx, pose, side, -hl + 0.05, hl - 0.05, plane, 0.27, 0.35, '#d62828');
  }
  topQuad(ctx, pose, -0.28, 0.08, -0.05, 0.05, 0.742, '#d62828');
  topQuad(ctx, pose, -0.15, -0.05, -0.18, 0.18, 0.742, '#d62828');
}

function drawFire(ctx: Ctx, pose: Pose, l: VehicleLook): void {
  const hl = l.length / 2;
  const hw = l.width / 2;
  shadow(ctx, pose, hl, hw);
  wheels(ctx, pose, hl, hw, false);
  drawBox(ctx, pose, -hl, hl - 0.52, -hw, hw, 0.12, 0.72, l.color, shade(l.color, 0.9));
  drawBox(ctx, pose, hl - 0.5, hl, -hw + 0.02, hw - 0.02, 0.12, 0.8, l.color, l.color);
  sideQuad(ctx, pose, 'front', -hw + 0.06, hw - 0.06, hl + 0.001, 0.48, 0.74, l.glass);
  for (const side of ['right', 'left'] as const) {
    const plane = side === 'right' ? hw + 0.001 : -hw - 0.001;
    sideQuad(ctx, pose, side, -hl + 0.05, hl - 0.6, plane, 0.3, 0.36, '#f4f4f4');
  }
  // ladder
  drawBox(ctx, pose, -hl + 0.05, hl - 0.55, -0.2, -0.15, 0.72, 0.8, '#c9ced6', '#e2e6ec');
  drawBox(ctx, pose, -hl + 0.05, hl - 0.55, 0.15, 0.2, 0.72, 0.8, '#c9ced6', '#e2e6ec');
  for (let f = -hl + 0.15; f < hl - 0.6; f += 0.22) topQuad(ctx, pose, f, f + 0.04, -0.15, 0.15, 0.79, '#e2e6ec');
}

export function drawVehicleVector(ctx: Ctx, pose: Pose, l: VehicleLook): void {
  switch (l.style) {
    case 'sedan':
      return drawSedan(ctx, pose, l);
    case 'bus':
      return drawBus(ctx, pose, l);
    case 'truck':
      return drawTruck(ctx, pose, l);
    case 'van':
      return drawVan(ctx, pose, l);
    case 'fire':
      return drawFire(ctx, pose, l);
  }
}

// ---------------------------------------------------------------------------
// Sprite cache
// ---------------------------------------------------------------------------

export const HEADING_BUCKETS = 64;

export interface Sprite {
  readonly canvas: HTMLCanvasElement;
  readonly w: number;
  readonly h: number;
  readonly ax: number;
  readonly ay: number;
}

/** LRU cache of pre-rendered vehicle sprites keyed by look + heading bucket. */
export class SpriteCache {
  private readonly map = new Map<string, Sprite>();
  hits = 0;
  misses = 0;
  private scale = 0;
  private dpr = 1;

  constructor(private readonly max = 320) {}

  get size(): number {
    return this.map.size;
  }

  /** Scale/DPR changes invalidate every sprite. */
  configure(scale: number, dpr: number): void {
    if (scale !== this.scale || dpr !== this.dpr) {
      this.map.clear();
      this.scale = scale;
      this.dpr = dpr;
    }
  }

  get(look: VehicleLook, heading: number): Sprite {
    let b = Math.round((heading / (2 * Math.PI)) * HEADING_BUCKETS) % HEADING_BUCKETS;
    if (b < 0) b += HEADING_BUCKETS;
    const key = `${look.key}#${b}`;
    const hit = this.map.get(key);
    if (hit) {
      this.hits++;
      this.map.delete(key);
      this.map.set(key, hit);
      return hit;
    }
    this.misses++;
    const sprite = this.render(look, (b * 2 * Math.PI) / HEADING_BUCKETS);
    this.map.set(key, sprite);
    if (this.map.size > this.max) this.map.delete(this.map.keys().next().value as string);
    return sprite;
  }

  private render(look: VehicleLook, heading: number): Sprite {
    const s = this.scale;
    const half = (Math.hypot(look.length, look.width) / 2 + 0.16) * Math.SQRT2 * s;
    const top = (look.topZ + 0.5) * s * Z_SCALE;
    const w = Math.ceil(half * 2 + 6);
    const h = Math.ceil(half + top + 6);
    const ax = w / 2;
    const ay = h - half / 2 - 3;
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(w * this.dpr);
    canvas.height = Math.ceil(h * this.dpr);
    const ctx = canvas.getContext('2d')!;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const pose = new Pose(localCamera(s, ax, ay)).set(0, 0, heading);
    drawVehicleVector(ctx, pose, look);
    return { canvas, w, h, ax, ay };
  }
}

// ---------------------------------------------------------------------------
// Per-frame effects
// ---------------------------------------------------------------------------

const Q: ScreenPt = { x: 0, y: 0 };

export function drawLightBar(ctx: Ctx, pose: Pose, l: VehicleLook, nowMs: number, active: boolean): void {
  if (l.lightBar === 'none') return;
  const phase = Math.floor(nowMs / 160) % 2 === 0;
  const s = pose.cam.scale;
  for (const side of [-1, 1]) {
    pose.p(l.barF, side * 0.1, l.barZ + 0.05, Q);
    let color: string;
    if (l.lightBar === 'police' && !active) color = side < 0 ? '#1e3a8a' : '#7f1d1d';
    else color = (side < 0) === phase ? '#2f7bff' : '#ff2d2d';
    if (active) {
      ctx.fillStyle = alpha(color, 0.25);
      ctx.beginPath();
      ctx.arc(Q.x, Q.y, s * 0.22, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(Q.x, Q.y, Math.max(1.5, s * 0.055), 0, Math.PI * 2);
    ctx.fill();
  }
}

export function drawIndicators(ctx: Ctx, pose: Pose, l: VehicleLook, turn: 'left' | 'right', nowMs: number): void {
  if (Math.floor(nowMs / 380) % 2 === 1) return;
  const hl = l.length / 2;
  const hw = l.width / 2 + 0.01;
  const r = turn === 'right' ? hw : -hw;
  const z = LOOK_BODY_Z + Math.min(0.3, l.bodyH * 0.7);
  ctx.fillStyle = '#ffab00';
  const rad = Math.max(1.4, pose.cam.scale * 0.045);
  for (const f of [hl - 0.04, -hl + 0.04]) {
    pose.p(f, r, z, Q);
    ctx.beginPath();
    ctx.arc(Q.x, Q.y, rad, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function drawNeon(ctx: Ctx, pose: Pose, l: VehicleLook, nowMs: number): void {
  const a = 0.35 + 0.25 * Math.sin(nowMs / 180);
  const hl = l.length / 2 + 0.12;
  const hw = l.width / 2 + 0.12;
  pose.p(-hl, -hw, 0.01, P[0]);
  pose.p(hl, -hw, 0.01, P[1]);
  pose.p(hl, hw, 0.01, P[2]);
  pose.p(-hl, hw, 0.01, P[3]);
  poly(ctx, P, 4, `rgba(0, 229, 255, ${a.toFixed(3)})`);
}

/** Screen-space convex hull of a vehicle (for hit testing). */
export function vehicleHull(pose: Pose, l: VehicleLook, out: ScreenPt[]): number {
  const hl = l.length / 2;
  const hw = l.width / 2;
  let k = 0;
  for (const z of [0, l.topZ]) {
    for (const [f, r] of [
      [-hl, -hw],
      [hl, -hw],
      [hl, hw],
      [-hl, hw],
    ] as const) {
      pose.p(f, r, z, out[k++]);
    }
  }
  return convexHull(out, k);
}

/** Andrew's monotone chain, in place; returns hull size. */
function convexHull(pts: ScreenPt[], n: number): number {
  const a = pts.slice(0, n).sort((p, q) => p.x - q.x || p.y - q.y);
  const cross = (o: ScreenPt, p: ScreenPt, q: ScreenPt) => (p.x - o.x) * (q.y - o.y) - (p.y - o.y) * (q.x - o.x);
  const lower: ScreenPt[] = [];
  for (const p of a) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: ScreenPt[] = [];
  for (let i = a.length - 1; i >= 0; i--) {
    const p = a[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  const hull = lower.slice(0, -1).concat(upper.slice(0, -1));
  for (let i = 0; i < hull.length; i++) {
    pts[i] = { x: hull[i].x, y: hull[i].y };
  }
  return hull.length;
}

export function pointInPolygon(px: number, py: number, pts: ScreenPt[], n: number): boolean {
  let inside = false;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const a = pts[i];
    const b = pts[j];
    if (a.y > py !== b.y > py && px < ((b.x - a.x) * (py - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}
