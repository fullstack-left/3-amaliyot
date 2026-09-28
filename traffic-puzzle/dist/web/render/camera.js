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
export class Camera {
    scale = 40;
    cx = 0;
    cy = 0;
    width = 0;
    height = 0;
    dpr = 1;
    /**
     * Fit the junction CONTENT into the viewport, leaving room for HUD bars.
     *
     * `extent` is how far along each arm (world units from the centre) must stay
     * visible. Arms run along the screen diagonals, so an arm of length E spans
     * ±E·s horizontally and ±E·s/2 vertically — the fit uses exactly that (plus
     * headroom for vehicle/sign heights) instead of a bounding disc, which wasted
     * ~40 % of a portrait phone screen.
     */
    fit(width, height, dpr, extent, topPad = 0, bottomPad = 0, maxScale = 72) {
        this.width = width;
        this.height = height;
        this.dpr = dpr;
        const availH = Math.max(100, height - topPad - bottomPad);
        this.scale = Math.max(9, Math.min((width - 16) / (2 * extent), availH / (extent + 1.7), maxScale));
        this.cx = width / 2;
        this.cy = topPad + availH / 2 + this.scale * 0.35;
    }
    sx(x, y) {
        return this.cx + (x - y) * this.scale;
    }
    sy(x, y, z = 0) {
        return this.cy + (x + y) * this.scale * 0.5 - z * this.scale * Z_SCALE;
    }
    project(x, y, z, out) {
        out.x = this.cx + (x - y) * this.scale;
        out.y = this.cy + (x + y) * this.scale * 0.5 - z * this.scale * Z_SCALE;
        return out;
    }
    /** Screen point → ground (z = 0) world point. */
    unproject(px, py) {
        const a = (px - this.cx) / this.scale;
        const b = (2 * (py - this.cy)) / this.scale;
        return [(a + b) / 2, (b - a) / 2];
    }
}
/** A projector with its own origin — used to render sprites off-screen. */
export function localCamera(scale, cx, cy) {
    const c = new Camera();
    c.scale = scale;
    c.cx = cx;
    c.cy = cy;
    return c;
}
//# sourceMappingURL=camera.js.map