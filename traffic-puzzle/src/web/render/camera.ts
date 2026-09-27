/**
 * 2:1 isometric camera.
 *
 *   sx = cx + (x − y)·s
 *   sy = cy + (x + y)·s/2 − z·s·Z_SCALE
 *
 * +x (east) goes down-right on screen, +y (south) down-left, so north is
 * up-right and the viewer looks from the south-east.
 */

export const Z_SCALE = 0.95;

export interface ScreenPt {
  x: number;
  y: number;
}

export class Camera {
  scale = 40;
  cx = 0;
  cy = 0;
  width = 0;
  height = 0;
  dpr = 1;

  /** Fit a world disc of `radius` into the viewport, leaving room for HUD bars. */
  fit(width: number, height: number, dpr: number, radius: number, topPad = 0, bottomPad = 0): void {
    this.width = width;
    this.height = height;
    this.dpr = dpr;
    const availH = Math.max(100, height - topPad - bottomPad);
    this.scale = Math.max(9, Math.min(width / (4 * radius), availH / (2 * radius + 1.4)));
    this.cx = width / 2;
    this.cy = topPad + availH / 2 + this.scale * 0.35;
  }

  sx(x: number, y: number): number {
    return this.cx + (x - y) * this.scale;
  }

  sy(x: number, y: number, z = 0): number {
    return this.cy + (x + y) * this.scale * 0.5 - z * this.scale * Z_SCALE;
  }

  project(x: number, y: number, z: number, out: ScreenPt): ScreenPt {
    out.x = this.cx + (x - y) * this.scale;
    out.y = this.cy + (x + y) * this.scale * 0.5 - z * this.scale * Z_SCALE;
    return out;
  }

  /** Screen point → ground (z = 0) world point. */
  unproject(px: number, py: number): [number, number] {
    const a = (px - this.cx) / this.scale;
    const b = (2 * (py - this.cy)) / this.scale;
    return [(a + b) / 2, (b - a) / 2];
  }
}

/** A projector with its own origin — used to render sprites off-screen. */
export function localCamera(scale: number, cx: number, cy: number): Camera {
  const c = new Camera();
  c.scale = scale;
  c.cx = cx;
  c.cy = cy;
  return c;
}
