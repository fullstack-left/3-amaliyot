/**
 * Cosmetic per-frame effects. Nothing here touches the simulation (determinism
 * and replays are unaffected); everything is pooled / cached so the per-frame
 * cost stays tiny even with 20+ vehicles:
 *   - particles (exhaust puffs on departure, gold sparks when a car clears)
 *   - rain (screen-space streaks + ground splashes) — one stroke per frame
 *   - headlight cones (sprite per heading bucket, additive blending)
 *   - glow sprites (brake lights, lamp bulbs)
 *   - screen shake (penalty / gridlock)
 */

import type { Camera } from './camera.js';

interface Particle {
  kind: 'puff' | 'spark';
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  t0: number;
  life: number;
  size: number;
  color: string;
}

interface Drop {
  x: number;
  y: number;
  len: number;
  speed: number;
}

interface Splash {
  x: number;
  y: number;
  t0: number;
}

const MAX_PARTICLES = 220;
const SPARK_COLORS = ['#ffd166', '#ffe08a', '#fff3c4', '#f4b400'];

export class Effects {
  enabled = true;
  private readonly parts: Particle[] = [];
  private readonly free: Particle[] = [];
  private readonly drops: Drop[] = [];
  private readonly splashes: Splash[] = [];
  private lastMs = 0;
  private shakeAmp = 0;
  private shakeT0 = 0;
  private rainW = 0;
  private rainH = 0;
  private rainLast = 0;

  get count(): number {
    return this.parts.length;
  }

  clear(): void {
    this.free.push(...this.parts);
    this.parts.length = 0;
    this.splashes.length = 0;
    this.shakeAmp = 0;
  }

  private spawn(): Particle | null {
    if (this.parts.length >= MAX_PARTICLES) return null;
    const p = this.free.pop() ?? { kind: 'puff', x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, t0: 0, life: 1, size: 1, color: '#fff' };
    this.parts.push(p);
    return p;
  }

  /** Exhaust puffs behind a vehicle at world (x, y) heading h (radians). */
  puff(x: number, y: number, h: number, now: number): void {
    if (!this.enabled) return;
    const bx = -Math.cos(h);
    const by = -Math.sin(h);
    for (let i = 0; i < 4; i++) {
      const p = this.spawn();
      if (!p) return;
      p.kind = 'puff';
      p.x = x + bx * 0.05 + (Math.random() - 0.5) * 0.12;
      p.y = y + by * 0.05 + (Math.random() - 0.5) * 0.12;
      p.z = 0.12;
      p.vx = bx * (0.5 + Math.random() * 0.5) + (Math.random() - 0.5) * 0.3;
      p.vy = by * (0.5 + Math.random() * 0.5) + (Math.random() - 0.5) * 0.3;
      p.vz = 0.25 + Math.random() * 0.3;
      p.t0 = now + i * 70;
      p.life = 700 + Math.random() * 400;
      p.size = 0.1 + Math.random() * 0.06;
      p.color = i % 2 ? '#c9ced6' : '#e5e7eb';
    }
  }

  /** Gold sparks bursting upward at world (x, y) — a vehicle has cleared. */
  sparks(x: number, y: number, now: number, n = 14): void {
    if (!this.enabled) return;
    for (let i = 0; i < n; i++) {
      const p = this.spawn();
      if (!p) return;
      const a = Math.random() * Math.PI * 2;
      const v = 0.6 + Math.random() * 1.2;
      p.kind = 'spark';
      p.x = x;
      p.y = y;
      p.z = 0.7;
      p.vx = Math.cos(a) * v;
      p.vy = Math.sin(a) * v;
      p.vz = 1.6 + Math.random() * 1.6;
      p.t0 = now;
      p.life = 600 + Math.random() * 500;
      p.size = 0.035 + Math.random() * 0.03;
      p.color = SPARK_COLORS[i % SPARK_COLORS.length];
    }
  }

  shake(amp: number, now: number): void {
    if (!this.enabled) return;
    const cur = this.currentShake(now);
    if (amp >= cur) {
      this.shakeAmp = amp;
      this.shakeT0 = now;
    }
  }

  private currentShake(now: number): number {
    if (this.shakeAmp <= 0) return 0;
    const t = (now - this.shakeT0) / 1000;
    const a = this.shakeAmp * Math.exp(-t * 7);
    if (a < 0.3) {
      this.shakeAmp = 0;
      return 0;
    }
    return a;
  }

  /** Screen offset for the current shake (CSS px). */
  shakeOffset(now: number, out: { x: number; y: number }): void {
    const a = this.currentShake(now);
    if (a <= 0) {
      out.x = 0;
      out.y = 0;
      return;
    }
    out.x = Math.sin(now * 0.09) * a;
    out.y = Math.cos(now * 0.113) * a * 0.6;
  }

  /** Advance + draw world particles (after all depth-sorted drawables). */
  drawParticles(ctx: CanvasRenderingContext2D, cam: Camera, now: number): void {
    const dt = this.lastMs ? Math.min(50, now - this.lastMs) / 1000 : 0;
    this.lastMs = now;
    const s = cam.scale;
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      const age = now - p.t0;
      if (age < 0) continue;
      if (age >= p.life) {
        this.parts[i] = this.parts[this.parts.length - 1];
        this.parts.pop();
        this.free.push(p);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      if (p.kind === 'spark') {
        p.vz -= 5.5 * dt;
        if (p.z < 0) {
          p.z = 0;
          p.vz *= -0.35;
        }
      } else {
        p.vx *= 1 - 1.6 * dt;
        p.vy *= 1 - 1.6 * dt;
      }
      const k = age / p.life;
      const sx = cam.sx(p.x, p.y);
      const sy = cam.sy(p.x, p.y, p.z);
      if (p.kind === 'puff') {
        ctx.globalAlpha = 0.45 * (1 - k);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(sx, sy, Math.max(1.5, (p.size + k * 0.22) * s), 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.globalAlpha = 1 - k * k;
        ctx.fillStyle = p.color;
        const r = Math.max(1.2, p.size * s);
        ctx.fillRect(sx - r, sy - r, r * 2, r * 2);
      }
    }
    ctx.globalAlpha = 1;
  }

  /** Screen-space rain: slanted streaks + ground splashes. `w`/`h` in CSS px. */
  drawRain(ctx: CanvasRenderingContext2D, w: number, h: number, now: number, topPad: number): void {
    if (!this.enabled) return;
    if (w !== this.rainW || h !== this.rainH) {
      this.rainW = w;
      this.rainH = h;
      this.drops.length = 0;
      const n = Math.round(Math.min(220, (w * h) / 5200));
      for (let i = 0; i < n; i++) {
        this.drops.push({ x: Math.random() * w, y: Math.random() * h, len: 10 + Math.random() * 12, speed: 700 + Math.random() * 500 });
      }
    }
    const dt = Math.min(50, now - (this.rainLast || now)) / 1000;
    this.rainLast = now;
    const wind = 0.22;
    ctx.strokeStyle = 'rgba(200,215,235,0.42)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const d of this.drops) {
      d.y += d.speed * dt;
      d.x += d.speed * wind * dt;
      if (d.y > h) {
        d.y = topPad - d.len - Math.random() * 40;
        d.x = Math.random() * (w + 80) - 80;
        if (this.splashes.length < 26 && Math.random() < 0.55) this.splashes.push({ x: Math.random() * w, y: topPad + Math.random() * (h - topPad), t0: now });
      }
      if (d.x > w) d.x -= w + 60;
      ctx.moveTo(d.x, d.y);
      ctx.lineTo(d.x - d.len * wind, d.y - d.len);
    }
    ctx.stroke();
    ctx.strokeStyle = 'rgba(210,225,245,0.5)';
    for (let i = this.splashes.length - 1; i >= 0; i--) {
      const sp = this.splashes[i];
      const t = (now - sp.t0) / 320;
      if (t >= 1) {
        this.splashes.splice(i, 1);
        continue;
      }
      ctx.globalAlpha = 1 - t;
      ctx.beginPath();
      ctx.ellipse(sp.x, sp.y, 2 + t * 7, 1 + t * 3, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
}

// ---------------------------------------------------------------------------
// Light sprites
// ---------------------------------------------------------------------------

export interface LightSprite {
  readonly canvas: HTMLCanvasElement;
  /** Anchor (CSS px inside the sprite). */
  readonly ax: number;
  readonly ay: number;
  readonly w: number;
  readonly h: number;
}

const CONE_BUCKETS = 64;

/**
 * Headlight cones on the ground, one sprite per heading bucket. Drawn with
 * 'lighter' BEFORE the vehicles, so a car is never brightened by its own lights.
 */
export class HeadlightCache {
  private readonly map = new Map<number, LightSprite>();
  private scale = 0;
  private dpr = 1;

  configure(scale: number, dpr: number): void {
    if (scale !== this.scale || dpr !== this.dpr) {
      this.map.clear();
      this.scale = scale;
      this.dpr = dpr;
    }
  }

  get(heading: number): LightSprite {
    let b = Math.round((heading / (2 * Math.PI)) * CONE_BUCKETS) % CONE_BUCKETS;
    if (b < 0) b += CONE_BUCKETS;
    let sp = this.map.get(b);
    if (!sp) {
      sp = this.render((b * 2 * Math.PI) / CONE_BUCKETS);
      this.map.set(b, sp);
    }
    return sp;
  }

  private render(h: number): LightSprite {
    const s = this.scale;
    const c = Math.cos(h);
    const sn = Math.sin(h);
    // cone in vehicle-local (f forward, r right), origin = front bumper centre
    const local: [number, number][] = [
      [0, -0.3],
      [0, 0.3],
      [2.3, 0.95],
      [2.6, 0],
      [2.3, -0.95],
    ];
    const pts = local.map(([f, r]) => {
      const x = c * f - sn * r;
      const y = sn * f + c * r;
      return [(x - y) * s, ((x + y) * s) / 2] as [number, number];
    });
    const minX = Math.min(...pts.map((p) => p[0])) - 2;
    const maxX = Math.max(...pts.map((p) => p[0])) + 2;
    const minY = Math.min(...pts.map((p) => p[1])) - 2;
    const maxY = Math.max(...pts.map((p) => p[1])) + 2;
    const w = Math.ceil(maxX - minX);
    const hh = Math.ceil(maxY - minY);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.ceil(w * this.dpr));
    canvas.height = Math.max(1, Math.ceil(hh * this.dpr));
    const ctx = canvas.getContext('2d')!;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, -minX * this.dpr, -minY * this.dpr);
    // far point of the beam (f = 2.4, r = 0) in sprite space
    const farX = (c - sn) * 2.4 * s;
    const farY = ((c + sn) * 2.4 * s) / 2;
    const grad = ctx.createLinearGradient(0, 0, farX, farY);
    grad.addColorStop(0, 'rgba(255,238,196,0.55)');
    grad.addColorStop(0.45, 'rgba(255,232,180,0.22)');
    grad.addColorStop(1, 'rgba(255,230,170,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.fill();
    return { canvas, ax: -minX, ay: -minY, w, h: hh };
  }
}

/** Radial glow discs (brake lights, lamp bulbs, sirens), cached per colour + radius. */
export class GlowCache {
  private readonly map = new Map<string, LightSprite>();
  private dpr = 1;

  configure(dpr: number): void {
    if (dpr !== this.dpr) {
      this.map.clear();
      this.dpr = dpr;
    }
  }

  get(rgb: string, radius: number): LightSprite {
    const r = Math.max(2, Math.round(radius));
    const key = `${rgb}|${r}`;
    let sp = this.map.get(key);
    if (!sp) {
      const size = r * 2;
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(size * this.dpr);
      canvas.height = Math.ceil(size * this.dpr);
      const ctx = canvas.getContext('2d')!;
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      const gr = ctx.createRadialGradient(r, r, 0, r, r, r);
      gr.addColorStop(0, `rgba(${rgb},0.95)`);
      gr.addColorStop(0.25, `rgba(${rgb},0.5)`);
      gr.addColorStop(1, `rgba(${rgb},0)`);
      ctx.fillStyle = gr;
      ctx.fillRect(0, 0, size, size);
      sp = { canvas, ax: r, ay: r, w: size, h: size };
      this.map.set(key, sp);
    }
    return sp;
  }
}

/** Draw a light sprite additively at screen (x, y). */
export function drawLight(ctx: CanvasRenderingContext2D, sp: LightSprite, x: number, y: number, a = 1): void {
  const prevOp = ctx.globalCompositeOperation;
  const prevA = ctx.globalAlpha;
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = a;
  ctx.drawImage(sp.canvas, x - sp.ax, y - sp.ay, sp.w, sp.h);
  ctx.globalAlpha = prevA;
  ctx.globalCompositeOperation = prevOp;
}
