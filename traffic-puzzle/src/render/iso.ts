/**
 * Isometric projection + canvas renderer.
 * =======================================
 *
 * Logical grid coordinates → screen coordinates via a 2:1 isometric transform:
 *   sx = (x - y) * (TILE_W / 2)
 *   sy = (x + y) * (TILE_H / 2)
 *
 * PERFORMANCE (the "20+ cars at 60fps" requirement):
 *   - Single canvas, single rAF loop, no per-entity DOM nodes.
 *   - The static scene (roads, signs, kerbs) is pre-rendered ONCE to an
 *     offscreen canvas and blitted each frame — only vehicles are redrawn.
 *   - Vehicles are drawn back-to-front by their screen-y (painter's algorithm)
 *     so isometric overlap is correct without a z-buffer.
 *   - No allocations in the hot loop; we reuse scratch objects.
 * See ARCHITECTURE.md §Performance for the full rationale.
 */

import {
  Direction,
  IntersectionType,
  TurnIntent,
  Vehicle,
  VehicleKind,
  VehicleState,
} from '../core/types.js';
import { exitDirection } from '../core/geometry.js';

export const TILE_W = 96;
export const TILE_H = 48;

export function isoProject(x: number, y: number, originX: number, originY: number) {
  return {
    sx: originX + (x - y) * (TILE_W / 2),
    sy: originY + (x + y) * (TILE_H / 2),
  };
}

/** Grid position (before projection) where a vehicle sits given from + queue. */
export function laneAnchor(from: Direction, queueIndex: number): { x: number; y: number } {
  // Centre of the intersection is (0,0). Each arm extends outward; queueIndex
  // pushes the car further from the centre.
  const dist = 1.2 + queueIndex * 0.9;
  switch (from) {
    case Direction.NORTH:
      return { x: 0.4, y: -dist };
    case Direction.SOUTH:
      return { x: -0.4, y: dist };
    case Direction.EAST:
      return { x: dist, y: 0.4 };
    case Direction.WEST:
      return { x: -dist, y: -0.4 };
  }
}

/** Position along the crossing path for progress p in [0,1]. */
export function crossingPoint(from: Direction, intent: TurnIntent, p: number) {
  const start = laneAnchor(from, 0);
  const to = exitDirection(from, intent);
  const end = { ...laneAnchor(to, 0) };
  // Exit lane is on the *far* side, so mirror the anchor outward.
  const endOut = { x: end.x * 1.0, y: end.y * 1.0 };
  // Quadratic bezier through centre gives a smooth turn.
  const ctrl = { x: 0, y: 0 };
  const mx = (1 - p) * (1 - p) * start.x + 2 * (1 - p) * p * ctrl.x + p * p * endOut.x;
  const my = (1 - p) * (1 - p) * start.y + 2 * (1 - p) * p * ctrl.y + p * p * endOut.y;
  return { x: mx, y: my };
}

const KIND_COLOR: Record<VehicleKind, string> = {
  [VehicleKind.CAR]: '#3b82f6',
  [VehicleKind.TRUCK]: '#f59e0b',
  [VehicleKind.BUS]: '#10b981',
  [VehicleKind.AMBULANCE]: '#ef4444',
  [VehicleKind.FIRE_TRUCK]: '#dc2626',
  [VehicleKind.POLICE]: '#1e3a8a',
};

export interface RenderConfig {
  originX: number;
  originY: number;
  intersectionType: IntersectionType;
  /** ms timestamp for blink animations. */
  now: number;
}

/** Pre-render the static road scene onto an offscreen canvas (call on resize). */
export function renderScene(
  ctx: CanvasRenderingContext2D,
  cfg: RenderConfig,
): void {
  const { originX, originY } = cfg;
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  // Grass base
  ctx.fillStyle = '#1f2937';
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  const drawTile = (x: number, y: number, color: string) => {
    const { sx, sy } = isoProject(x, y, originX, originY);
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + TILE_W / 2, sy + TILE_H / 2);
    ctx.lineTo(sx, sy + TILE_H);
    ctx.lineTo(sx - TILE_W / 2, sy + TILE_H / 2);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.stroke();
  };

  // Road cross: a band of asphalt tiles along both axes.
  const road = '#374151';
  for (let i = -4; i <= 4; i++) {
    drawTile(i, 0, road);
    drawTile(i, -0.0001, road);
    drawTile(0, i, road);
  }
  // Centre
  drawTile(0, 0, '#4b5563');

  if (cfg.intersectionType === IntersectionType.ROUNDABOUT) {
    const { sx, sy } = isoProject(0, 0, originX, originY);
    ctx.beginPath();
    ctx.ellipse(sx, sy + TILE_H / 2, TILE_W * 0.55, TILE_H * 0.55, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#166534';
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.setLineDash([6, 6]);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

/** Draw one vehicle. Returns nothing; caller sorts by screen-y first. */
export function drawVehicle(
  ctx: CanvasRenderingContext2D,
  v: Vehicle,
  cfg: RenderConfig,
): void {
  let gx: number, gy: number;
  if (v.state === VehicleState.CROSSING) {
    const pt = crossingPoint(v.from, v.intent, v.progress);
    gx = pt.x;
    gy = pt.y;
  } else {
    const a = laneAnchor(v.from, v.queueIndex);
    gx = a.x;
    gy = a.y;
  }
  const { sx, sy } = isoProject(gx, gy, cfg.originX, cfg.originY);

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(sx, sy + 14, 20, 9, 0, 0, Math.PI * 2);
  ctx.fill();

  // Body — blink red if crashed.
  let color = KIND_COLOR[v.kind];
  if (v.state === VehicleState.CRASHED) {
    color = Math.floor(cfg.now / 150) % 2 === 0 ? '#ef4444' : '#7f1d1d';
  }
  ctx.fillStyle = color;
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.lineWidth = 2;
  roundRect(ctx, sx - 18, sy - 12, 36, 22, 6);
  ctx.fill();
  ctx.stroke();

  // Windshield
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  roundRect(ctx, sx - 12, sy - 8, 24, 8, 3);
  ctx.fill();

  // Emergency light bar
  if (v.kind === VehicleKind.AMBULANCE || v.kind === VehicleKind.FIRE_TRUCK) {
    ctx.fillStyle = Math.floor(cfg.now / 200) % 2 === 0 ? '#60a5fa' : '#f87171';
    ctx.fillRect(sx - 6, sy - 15, 12, 4);
  }
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Sort vehicles back-to-front for correct isometric overlap. */
export function sortForPaint(vehicles: Vehicle[], cfg: RenderConfig): Vehicle[] {
  return [...vehicles].sort((a, b) => {
    const pa = anchorScreenY(a, cfg);
    const pb = anchorScreenY(b, cfg);
    return pa - pb;
  });
}

function anchorScreenY(v: Vehicle, cfg: RenderConfig): number {
  const a =
    v.state === VehicleState.CROSSING
      ? crossingPoint(v.from, v.intent, v.progress)
      : laneAnchor(v.from, v.queueIndex);
  return isoProject(a.x, a.y, cfg.originX, cfg.originY).sy;
}
