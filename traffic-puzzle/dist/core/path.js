/**
 * Arc-length parametrised paths.
 *
 * Every movement through a junction is a polyline resampled at a uniform
 * arc-length step, so `sample(s)` is O(1) and the renderer and the rule engine
 * use the SAME trajectory ("what you see is what is checked").
 */
import { lerpAngle } from './dir.js';
export const PATH_STEP = 0.05;
/** Dense sampling resolution used while building (then resampled to PATH_STEP). */
const FINE = 0.01;
export class Path {
    xs;
    ys;
    hs;
    step;
    marks;
    n;
    length;
    constructor(xs, ys, hs, step, marks) {
        this.xs = xs;
        this.ys = ys;
        this.hs = hs;
        this.step = step;
        this.marks = marks;
        this.n = xs.length;
        this.length = (this.n - 1) * step;
    }
    /** Position + heading at arc length `s` (clamped to [0, length]). */
    sample(s, out = { x: 0, y: 0, h: 0 }) {
        let i;
        let f;
        if (s <= 0) {
            i = 0;
            f = 0;
        }
        else {
            const t = s / this.step;
            i = Math.floor(t);
            if (i >= this.n - 1) {
                i = this.n - 2;
                f = 1;
            }
            else {
                f = t - i;
            }
        }
        const xs = this.xs;
        const ys = this.ys;
        out.x = xs[i] + (xs[i + 1] - xs[i]) * f;
        out.y = ys[i] + (ys[i + 1] - ys[i]) * f;
        out.h = lerpAngle(this.hs[i], this.hs[i + 1], f);
        return out;
    }
    mark(name) {
        const m = this.marks[name];
        if (m === undefined)
            throw new Error(`Path mark "${name}" topilmadi`);
        return m;
    }
}
export class PathBuilder {
    xs = [];
    ys = [];
    cum = [];
    marks = {};
    constructor(x, y) {
        this.xs.push(x);
        this.ys.push(y);
        this.cum.push(0);
    }
    get x() {
        return this.xs[this.xs.length - 1];
    }
    get y() {
        return this.ys[this.ys.length - 1];
    }
    get length() {
        return this.cum[this.cum.length - 1];
    }
    push(x, y) {
        const d = Math.hypot(x - this.x, y - this.y);
        if (d < 1e-9)
            return;
        this.cum.push(this.length + d);
        this.xs.push(x);
        this.ys.push(y);
    }
    lineTo(x, y) {
        const x0 = this.x;
        const y0 = this.y;
        const k = Math.max(1, Math.ceil(Math.hypot(x - x0, y - y0) / FINE));
        for (let i = 1; i <= k; i++)
            this.push(x0 + ((x - x0) * i) / k, y0 + ((y - y0) * i) / k);
        return this;
    }
    /** Circular arc around (cx, cy) with radius r from angle a0 to a1 (any sweep). */
    arc(cx, cy, r, a0, a1) {
        const k = Math.max(2, Math.ceil((Math.abs(a1 - a0) * r) / FINE));
        for (let i = 1; i <= k; i++) {
            const a = a0 + ((a1 - a0) * i) / k;
            this.push(cx + r * Math.cos(a), cy + r * Math.sin(a));
        }
        return this;
    }
    /** Arc around (cx, cy) from the current point to (x, y), the short way round. */
    arcTo(cx, cy, x, y) {
        const r = Math.hypot(this.x - cx, this.y - cy);
        const a0 = Math.atan2(this.y - cy, this.x - cx);
        const a1 = Math.atan2(y - cy, x - cx);
        let d = a1 - a0;
        while (d > Math.PI)
            d -= 2 * Math.PI;
        while (d <= -Math.PI)
            d += 2 * Math.PI;
        this.arc(cx, cy, r, a0, a0 + d);
        return this;
    }
    /** Cubic Bézier from the current point. */
    bezierTo(x1, y1, x2, y2, x3, y3) {
        const x0 = this.x;
        const y0 = this.y;
        const est = Math.hypot(x1 - x0, y1 - y0) + Math.hypot(x2 - x1, y2 - y1) + Math.hypot(x3 - x2, y3 - y2);
        const k = Math.max(8, Math.ceil(est / FINE));
        for (let i = 1; i <= k; i++) {
            const t = i / k;
            const mt = 1 - t;
            const a = mt * mt * mt;
            const b = 3 * mt * mt * t;
            const c = 3 * mt * t * t;
            const d = t * t * t;
            this.push(a * x0 + b * x1 + c * x2 + d * x3, a * y0 + b * y1 + c * y2 + d * y3);
        }
        return this;
    }
    /** Remember the current arc length under a name (e.g. "enter", "exit"). */
    mark(name) {
        this.marks[name] = this.length;
        return this;
    }
    /** Resample to a uniform arc-length step. */
    build(step = PATH_STEP) {
        const total = this.length;
        const n = Math.floor(total / step) + 1;
        const xs = new Float64Array(n);
        const ys = new Float64Array(n);
        const hs = new Float64Array(n);
        const cum = this.cum;
        let j = 0;
        for (let k = 0; k < n; k++) {
            const s = k * step;
            while (j < cum.length - 2 && cum[j + 1] < s)
                j++;
            const seg = cum[j + 1] - cum[j];
            let f = seg > 0 ? (s - cum[j]) / seg : 0;
            if (f < 0)
                f = 0;
            else if (f > 1)
                f = 1;
            xs[k] = this.xs[j] + (this.xs[j + 1] - this.xs[j]) * f;
            ys[k] = this.ys[j] + (this.ys[j + 1] - this.ys[j]) * f;
        }
        for (let k = 0; k < n - 1; k++)
            hs[k] = Math.atan2(ys[k + 1] - ys[k], xs[k + 1] - xs[k]);
        hs[n - 1] = n > 1 ? hs[n - 2] : 0;
        return new Path(xs, ys, hs, step, { ...this.marks });
    }
}
//# sourceMappingURL=path.js.map