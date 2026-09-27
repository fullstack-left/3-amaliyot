/**
 * Frame composer.
 *
 * Per frame:
 *   1. blit the cached static scene
 *   2. ground overlays (intent paths, highlight rings)
 *   3. depth-sorted drawables (vehicles + props) — painter's algorithm on x + y
 *   4. screen overlays (controller assist, popups, perf)
 *
 * Positions are interpolated between simulation ticks (alpha ∈ [0,1)): crossing
 * vehicles analytically from the kinematic profile, lane vehicles by speed.
 */

import { DIRS, inLane } from '../../core/dir.js';
import { LOCK_TICKS, type GameEngine } from '../../core/engine.js';
import { distAt, TICK_HZ } from '../../core/kinematics.js';
import type { Vehicle } from '../../core/types.js';
import { Camera, type ScreenPt } from './camera.js';
import { lookFor, redLook, type LookContext, type VehicleLook } from './looks.js';
import { drawController, drawControllerAssist, drawSign, drawTrafficLight, drawTree } from './props.js';
import { renderScene } from './scene.js';
import {
  drawIndicators,
  drawLightBar,
  drawNeon,
  drawVehicleVector,
  pointInPolygon,
  Pose,
  SpriteCache,
  vehicleHull,
} from './vehicles.js';

export interface RenderSettings {
  spriteCache: boolean;
  /** Assist: colour-coded path preview on hover + controller arrows. */
  assist: boolean;
  controllerArrows: boolean;
  perf: boolean;
}

interface Popup {
  x: number;
  y: number;
  text: string;
  color: string;
  t0: number;
}

interface Drawable {
  depth: number;
  kind: 'vehicle' | 'sign' | 'light' | 'tree' | 'controller';
  v: Vehicle | null;
  d: number;
  x: number;
  y: number;
  size: number;
}

export interface VehiclePose {
  x: number;
  y: number;
  h: number;
}

const TREES: readonly [number, number, number][] = [
  [3.2, 3.4, 0.9],
  [5.6, 2.6, 0.8],
  [2.6, 6.0, 1.0],
  [7.2, 4.8, 0.9],
  [4.4, 8.2, 0.8],
  [-3.4, 2.8, 0.8],
  [3.0, -3.2, 0.85],
  [8.5, 2.4, 0.7],
];

export class Renderer {
  readonly cam = new Camera();
  readonly sprites = new SpriteCache(360);
  settings: RenderSettings = { spriteCache: true, assist: true, controllerArrows: false, perf: false };
  hoverId: string | null = null;
  hintId: string | null = null;
  focusIds: readonly string[] = [];
  focusUntil = 0;
  padTop = 0;
  padBottom = 0;
  readonly stats = { fps: 60, frameMs: 16.7, drawMs: 0, drawn: 0 };

  private readonly ctx: CanvasRenderingContext2D;
  private readonly bg = document.createElement('canvas');
  private readonly bgCtx: CanvasRenderingContext2D;
  private engine: GameEngine | null = null;
  private lookCtx: LookContext | null = null;
  private readonly looks = new Map<string, VehicleLook>();
  private readonly pool: Drawable[] = [];
  private readonly list: Drawable[] = [];
  private readonly popups: Popup[] = [];
  private readonly pose: Pose;
  private readonly hull: ScreenPt[] = Array.from({ length: 8 }, () => ({ x: 0, y: 0 }));
  private readonly vp: VehiclePose = { x: 0, y: 0, h: 0 };
  private sceneDirty = true;
  private lastFrame = 0;

  constructor(readonly canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    this.bgCtx = this.bg.getContext('2d', { alpha: false })!;
    this.pose = new Pose(this.cam);
  }

  setEngine(engine: GameEngine | null, lookCtx: LookContext | null): void {
    this.engine = engine;
    this.lookCtx = lookCtx;
    this.looks.clear();
    this.popups.length = 0;
    this.hoverId = this.hintId = null;
    this.focusIds = [];
    this.sceneDirty = true;
    this.resize();
  }

  resize(): void {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(1, this.canvas.clientWidth);
    const h = Math.max(1, this.canvas.clientHeight);
    if (this.canvas.width !== Math.round(w * dpr) || this.canvas.height !== Math.round(h * dpr)) {
      this.canvas.width = Math.round(w * dpr);
      this.canvas.height = Math.round(h * dpr);
    }
    const round = this.engine?.layout.type === 'roundabout';
    const portrait = w < h;
    const radius = round ? (portrait ? 5.4 : 7.0) : portrait ? 4.6 : 6.0;
    this.cam.fit(w, h, dpr, radius, this.padTop, this.padBottom);
    this.sprites.configure(this.cam.scale, dpr);
    this.bg.width = this.canvas.width;
    this.bg.height = this.canvas.height;
    this.sceneDirty = true;
  }

  private look(v: Vehicle): VehicleLook {
    let l = this.looks.get(v.id);
    if (!l) {
      l = lookFor(v, this.lookCtx ?? { levelId: 0, ownedModels: [], hero: { model: 'matiz', paint: 'sariq', mods: [] } });
      this.looks.set(v.id, l);
    }
    return l;
  }

  /** Centre + heading of a vehicle at the interpolated time. */
  vehiclePose(v: Vehicle, alpha: number, out: VehiclePose = this.vp): VehiclePose {
    const e = this.engine!;
    const L = v.length;
    let fx: number;
    let fy: number;
    let rx: number;
    let ry: number;
    if (v.state === 'crossing' || v.state === 'exiting' || v.state === 'gone') {
      const path = e.junction.paths[v.move];
      const s = Math.min(path.length, distAt((e.tick + alpha - v.startTick) / TICK_HZ));
      const f = path.sample(s);
      fx = f.x;
      fy = f.y;
      const rs = s - L;
      if (rs >= 0) {
        const r = path.sample(rs);
        rx = r.x;
        ry = r.y;
      } else {
        [rx, ry] = inLane(v.from, e.layout.stopU - rs);
      }
    } else {
      let u = Math.max(e.layout.stopU, v.u - (v.speed * alpha) / TICK_HZ);
      // penalty "lurch": the offender jolts forward and back
      if (v.lockUntil > e.tick) {
        const t = (e.tick + alpha - (v.lockUntil - LOCK_TICKS)) / TICK_HZ;
        if (t < 0.4) u -= 0.3 * Math.sin((Math.PI * t) / 0.4);
      }
      [fx, fy] = inLane(v.from, u);
      [rx, ry] = inLane(v.from, u + L);
    }
    out.x = (fx + rx) / 2;
    out.y = (fy + ry) / 2;
    out.h = Math.atan2(fy - ry, fx - rx);
    return out;
  }

  popupAt(id: string, text: string, color: string): void {
    const e = this.engine;
    const v = e?.byId.get(id);
    if (!e || !v) return;
    const p = this.vehiclePose(v, 0, { x: 0, y: 0, h: 0 });
    this.popups.push({ x: this.cam.sx(p.x, p.y), y: this.cam.sy(p.x, p.y, 1), text, color, t0: performance.now() });
  }

  popupScreen(x: number, y: number, text: string, color: string): void {
    this.popups.push({ x, y, text, color, t0: performance.now() });
  }

  /** Tap → vehicle id (front-most hit, with a finger-friendly fallback radius). */
  pick(px: number, py: number): string | null {
    const e = this.engine;
    if (!e) return null;
    let best: Vehicle | null = null;
    let bestDepth = -Infinity;
    let near: Vehicle | null = null;
    let nearD = (Math.max(22, this.cam.scale * 0.7)) ** 2;
    for (const v of e.vehicles) {
      if (v.state !== 'waiting' && v.state !== 'approaching' && v.state !== 'queued') continue;
      const p = this.vehiclePose(v, 0, { x: 0, y: 0, h: 0 });
      this.pose.set(p.x, p.y, p.h);
      const n = vehicleHull(this.pose, this.look(v), this.hull);
      if (pointInPolygon(px, py, this.hull, n) && p.x + p.y > bestDepth) {
        best = v;
        bestDepth = p.x + p.y;
      }
      const cx = this.cam.sx(p.x, p.y);
      const cy = this.cam.sy(p.x, p.y, 0.3);
      const d = (cx - px) ** 2 + (cy - py) ** 2;
      if (d < nearD) {
        nearD = d;
        near = v;
      }
    }
    return (best ?? near)?.id ?? null;
  }

  private drawable(): Drawable {
    const d = this.pool[this.list.length] ?? (this.pool[this.list.length] = { depth: 0, kind: 'tree', v: null, d: 0, x: 0, y: 0, size: 1 });
    this.list.push(d);
    return d;
  }

  render(alpha: number, nowMs: number): void {
    const t0 = performance.now();
    const dt = this.lastFrame ? t0 - this.lastFrame : 16.7;
    this.lastFrame = t0;
    this.stats.frameMs = this.stats.frameMs * 0.9 + dt * 0.1;
    this.stats.fps = 1000 / Math.max(1, this.stats.frameMs);

    const ctx = this.ctx;
    const e = this.engine;
    const cam = this.cam;
    const dpr = cam.dpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (!e) {
      ctx.fillStyle = '#8cc26a';
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      return;
    }
    if (this.sceneDirty) {
      this.bgCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      renderScene(this.bgCtx, cam, e.layout);
      this.sceneDirty = false;
    }
    ctx.drawImage(this.bg, 0, 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    this.drawGroundOverlays(ctx, alpha, nowMs);

    // ---- build + sort drawables -------------------------------------------
    this.list.length = 0;
    for (const v of e.vehicles) {
      if (v.state === 'hidden' || v.state === 'gone') continue;
      const p = this.vehiclePose(v, alpha);
      const d = this.drawable();
      d.kind = 'vehicle';
      d.v = v;
      d.depth = p.x + p.y;
    }
    const layout = e.layout;
    for (const dir of DIRS) {
      if (!layout.armEnabled[dir]) continue;
      if (layout.sign[dir] !== 'none' || layout.type === 'roundabout') {
        const d = this.drawable();
        d.kind = 'sign';
        d.v = null;
        d.d = dir;
        const [x, y] = inLane(dir, layout.stopU + 0.45);
        d.depth = x + y + 1.2;
      }
      if (layout.signals) {
        const d = this.drawable();
        d.kind = 'light';
        d.v = null;
        d.d = dir;
        const [x, y] = inLane(dir, layout.stopU);
        d.depth = x + y + 1.3;
      }
    }
    for (const [x, y, size] of TREES) {
      if (layout.type !== 'roundabout' && (Math.abs(x) < 1.6 || Math.abs(y) < 1.6)) continue;
      const d = this.drawable();
      d.kind = 'tree';
      d.v = null;
      d.x = x;
      d.y = y;
      d.size = size;
      d.depth = x + y;
    }
    if (layout.type === 'roundabout') {
      const d = this.drawable();
      d.kind = 'tree';
      d.v = null;
      d.x = 0;
      d.y = 0;
      d.size = 1.25;
      d.depth = 0;
    }
    if (layout.controller) {
      const d = this.drawable();
      d.kind = 'controller';
      d.v = null;
      d.depth = 0;
    }
    this.list.sort((a, b) => a.depth - b.depth);

    const pose = e.pose();
    let drawn = 0;
    for (const d of this.list) {
      switch (d.kind) {
        case 'vehicle':
          this.drawVehicle(ctx, d.v!, alpha, nowMs);
          drawn++;
          break;
        case 'sign':
          drawSign(ctx, cam, d.d as 0 | 1 | 2 | 3, layout.sign[d.d], layout.stopU, layout.type === 'roundabout');
          break;
        case 'light': {
          const a = e.aspect(d.d as 0 | 1 | 2 | 3);
          if (a) drawTrafficLight(ctx, cam, d.d as 0 | 1 | 2 | 3, layout.stopU, a, e.aspectCountdown(d.d as 0 | 1 | 2 | 3), nowMs);
          break;
        }
        case 'tree':
          drawTree(ctx, cam, d.x, d.y, d.size);
          break;
        case 'controller':
          if (pose) drawController(ctx, cam, pose.pose.gesture, pose.pose.facing);
          break;
      }
    }

    if (pose && this.settings.controllerArrows) drawControllerAssist(ctx, cam, pose, layout.armEnabled, layout.stopU);
    this.drawPopups(ctx);
    this.stats.drawn = drawn;
    this.stats.drawMs = this.stats.drawMs * 0.9 + (performance.now() - t0) * 0.1;
    if (this.settings.perf) this.drawPerf(ctx, e);
  }

  private drawVehicle(ctx: CanvasRenderingContext2D, v: Vehicle, alpha: number, nowMs: number): void {
    const e = this.engine!;
    const p = this.vehiclePose(v, alpha);
    this.pose.set(p.x, p.y, p.h);
    let look = this.look(v);
    if (look.mods.includes('neon')) drawNeon(ctx, this.pose, look, nowMs);
    const flashing = v.flashUntil > e.tick && Math.floor(nowMs / 140) % 2 === 0;
    if (flashing) look = redLook(look);
    if (this.settings.spriteCache) {
      const sp = this.sprites.get(look, p.h);
      const sx = this.cam.sx(p.x, p.y);
      const sy = this.cam.sy(p.x, p.y);
      ctx.drawImage(sp.canvas, sx - sp.ax, sy - sp.ay, sp.w, sp.h);
    } else {
      drawVehicleVector(ctx, this.pose, look);
    }
    const base = this.look(v);
    drawLightBar(ctx, this.pose, base, nowMs, v.emergency);
    if (v.turn !== 'straight' && v.state !== 'exiting') drawIndicators(ctx, this.pose, base, v.turn, nowMs);
  }

  private ring(ctx: CanvasRenderingContext2D, v: Vehicle, alpha: number, color: string, width: number): void {
    const p = this.vehiclePose(v, alpha);
    const r = (v.length / 2 + 0.25) * this.cam.scale;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.ellipse(this.cam.sx(p.x, p.y), this.cam.sy(p.x, p.y), r * 1.2, r * 0.6, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  private drawGroundOverlays(ctx: CanvasRenderingContext2D, alpha: number, nowMs: number): void {
    const e = this.engine!;
    const cam = this.cam;
    // intent paths of the front vehicles
    for (const q of e.queues) {
      const v = q[0];
      if (!v || (v.state !== 'waiting' && v.state !== 'approaching')) continue;
      const path = e.junction.paths[v.move];
      const end = path.mark('exit') + 0.5;
      const hovered = v.id === this.hoverId;
      const hinted = v.id === this.hintId;
      let color = 'rgba(255,255,255,0.32)';
      let width = Math.max(2, cam.scale * 0.1);
      if (hinted) {
        color = `rgba(34,197,94,${(0.55 + 0.35 * Math.sin(nowMs / 150)).toFixed(3)})`;
        width *= 1.6;
      } else if (hovered) {
        color = 'rgba(255,209,102,0.9)';
        if (this.settings.assist) color = e.preview(v.id).allowed ? 'rgba(34,197,94,0.9)' : 'rgba(239,68,68,0.9)';
        width *= 1.5;
      }
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      for (let s = 0; s <= end; s += 0.25) {
        const pt = path.sample(s);
        const x = cam.sx(pt.x, pt.y);
        const y = cam.sy(pt.x, pt.y);
        if (s === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      // arrow head
      const a = path.sample(end);
      const b = path.sample(end - 0.3);
      const ax = cam.sx(a.x, a.y);
      const ay = cam.sy(a.x, a.y);
      const bx = cam.sx(b.x, b.y);
      const by = cam.sy(b.x, b.y);
      const ang = Math.atan2(ay - by, ax - bx);
      const hs = width * 2.4;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(ax + Math.cos(ang) * hs * 0.6, ay + Math.sin(ang) * hs * 0.6);
      ctx.lineTo(ax + Math.cos(ang + 2.5) * hs, ay + Math.sin(ang + 2.5) * hs);
      ctx.lineTo(ax + Math.cos(ang - 2.5) * hs, ay + Math.sin(ang - 2.5) * hs);
      ctx.closePath();
      ctx.fill();
    }
    // rings
    if (this.hoverId) {
      const v = e.byId.get(this.hoverId);
      if (v && v.state !== 'hidden' && v.state !== 'gone') this.ring(ctx, v, alpha, 'rgba(255,255,255,0.8)', 2);
    }
    if (this.hintId) {
      const v = e.byId.get(this.hintId);
      if (v && (v.state === 'waiting' || v.state === 'approaching')) {
        this.ring(ctx, v, alpha, `rgba(34,197,94,${(0.6 + 0.4 * Math.sin(nowMs / 120)).toFixed(3)})`, 3);
      }
    }
    if (performance.now() < this.focusUntil) {
      for (const id of this.focusIds) {
        const v = e.byId.get(id);
        if (v && v.state !== 'hidden' && v.state !== 'gone') {
          this.ring(ctx, v, alpha, `rgba(250,204,21,${(0.6 + 0.4 * Math.sin(nowMs / 90)).toFixed(3)})`, 3);
        }
      }
    }
  }

  private drawPopups(ctx: CanvasRenderingContext2D): void {
    const now = performance.now();
    for (let i = this.popups.length - 1; i >= 0; i--) {
      const p = this.popups[i];
      const t = (now - p.t0) / 1100;
      if (t >= 1) {
        this.popups.splice(i, 1);
        continue;
      }
      ctx.globalAlpha = 1 - t * t;
      ctx.font = `800 ${Math.round(Math.max(13, this.cam.scale * 0.42))}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(0,0,0,0.55)';
      ctx.strokeText(p.text, p.x, p.y - t * 36);
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, p.x, p.y - t * 36);
      ctx.globalAlpha = 1;
    }
  }

  private drawPerf(ctx: CanvasRenderingContext2D, e: GameEngine): void {
    const s = this.stats;
    const hitRate = this.sprites.hits + this.sprites.misses > 0 ? (100 * this.sprites.hits) / (this.sprites.hits + this.sprites.misses) : 100;
    const lines = [
      `FPS ${s.fps.toFixed(0)}  kadr ${s.frameMs.toFixed(1)} ms  chizish ${s.drawMs.toFixed(2)} ms`,
      `mashinalar ${s.drawn}/${e.vehicles.length}  spraytlar ${this.sprites.size} (hit ${hitRate.toFixed(1)}%)  kesh ${this.settings.spriteCache ? 'ON' : 'OFF'}`,
      `tick ${e.tick}  rejim ${e.mode()}`,
    ];
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(8, this.padTop + 8, 330, 18 * lines.length + 8);
    ctx.fillStyle = '#b9f6ca';
    ctx.font = '12px ui-monospace, monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    lines.forEach((l, i) => ctx.fillText(l, 14, this.padTop + 13 + i * 18));
  }

}
