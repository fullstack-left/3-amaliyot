/**
 * Static scene layer: ground, roads, sidewalks, markings, roundabout island,
 * the city around the junction, ambience (evening / night / rain) lighting.
 * Rendered ONCE per level / resize / ambience into an offscreen canvas and
 * blitted every frame (the single most important render optimisation).
 *
 * OCCLUSION-SAFE PLACEMENT. The static layer is painted under every vehicle,
 * so a static object must never cover a vehicle that stands BEHIND it. With the
 * 2:1 camera a box of height h covers the ground region swept by its footprint
 * shifted by (−t, −t), t ∈ [0, 0.95·h]. Vehicles on the incoming/outgoing
 * lanes never go beyond |lateral| 0.85 of their arm axis, hence:
 *   - NW quadrant (x, y ≤ −2.2): behind all traffic — any height;
 *   - NE quadrant: x0 ≥ 0.85 + 0.95·h and y1 ≤ −2.2;
 *   - SW quadrant: y0 ≥ 0.85 + 0.95·h and x1 ≤ −2.2;
 *   - SE quadrant (in front of the junction): low objects only.
 * Tall things vehicles can pass behind (trees, lamps, the island monument) are
 * NOT here — they are depth-sorted props described by `sceneInfo()`.
 */
import { DIR_VEC, DIRS, exitOf } from '../../core/dir.js';
import { CROSS, RB } from '../../core/junction.js';
import { g, LIGHT_LEVEL, PALETTE, prng, shade } from './color.js';
import { lookFor } from './looks.js';
import { drawTree } from './props.js';
import { drawVehicleVector, Pose } from './vehicles.js';
export const EXTENT = 26;
const WALK = 0.5;
const FLOOR_H = 0.62;
/** Point on arm d at distance u from the centre, lateral l (l > 0 = right of the OUTWARD direction). */
export function armPt(d, u, l) {
    const [dx, dy] = DIR_VEC[d];
    return [dx * u - dy * l, dy * u + dx * l];
}
const TREE_SPOTS = [
    // NW (behind the junction)
    [-2.35, -2.35, 0.9, 'round'],
    [-3.8, -4.7, 0.85, 'round'],
    [-2.35, -5.2, 0.75, 'poplar'],
    [-11.4, -3.3, 1.0, 'round'],
    [-12.2, -6.4, 0.9, 'round'],
    [-5.8, -11.6, 0.95, 'round'],
    [-2.3, -9.6, 0.9, 'poplar'],
    [-2.3, -12.4, 0.9, 'poplar'],
    [-9.6, -2.3, 0.85, 'poplar'],
    [-13.4, -2.3, 0.85, 'poplar'],
    // NE
    [2.35, -2.35, 0.8, 'round'],
    [2.5, -5.0, 0.9, 'round'],
    [9.8, -4.5, 0.9, 'round'],
    [3.3, -9.6, 0.9, 'round'],
    [11.2, -2.3, 0.8, 'poplar'],
    [2.3, -12.2, 0.85, 'poplar'],
    // SW
    [-2.35, 2.35, 0.8, 'round'],
    [-4.4, 4.5, 0.9, 'round'],
    [-10.8, 3.2, 0.9, 'round'],
    [-2.4, 8.6, 0.85, 'round'],
    [-12.4, 2.3, 0.8, 'poplar'],
    [-2.3, 12.4, 0.85, 'poplar'],
    // SE (in front) — small, set back from the lanes
    [3.4, 6.1, 0.72, 'round'],
    [8.7, 5.7, 0.76, 'round'],
    [3.1, 9.1, 0.78, 'round'],
    [7.9, 9.9, 0.72, 'round'],
    [11.4, 2.4, 0.7, 'round'],
    [12.3, 8.3, 0.85, 'round'],
    [9.4, 12.9, 0.85, 'round'],
    [6.9, 12.7, 0.8, 'round'],
    [12.6, 13.2, 0.8, 'poplar'],
    [2.9, 13.0, 0.75, 'poplar'],
];
/** Footprints (with margin) that trees must avoid when an arm is closed (T junction). */
function closureRects(layout) {
    const c = closures(layout);
    const out = [];
    const add = (r, m = 0.4) => out.push([r.x0 - m, r.y0 - m, r.x1 + m, r.y1 + m]);
    if (c.school)
        add({ x0: c.school.x0, y0: c.school.y0, x1: c.school.x1, y1: c.schoolHedge.y1 });
    if (c.tea)
        add(c.tea);
    if (c.south !== null)
        add({ x0: -1.8, y0: 1.9 + c.south, x1: 1.8, y1: 3.0 + c.south });
    if (c.west)
        add(c.west);
    return out;
}
/** Distance from a ground point to the nearest place a vehicle can be (0 = on it). */
function trafficDistance(layout, x, y) {
    const round = layout.type === 'roundabout';
    let best = round ? Math.max(0, Math.hypot(x, y) - (RB.outer + 0.2)) : Math.max(0, Math.max(Math.abs(x), Math.abs(y)) - 1.3);
    const u0 = round ? RB.curveU - 0.6 : 1.0;
    for (const d of DIRS) {
        if (!layout.armEnabled[d])
            continue;
        const [dx, dy] = DIR_VEC[d];
        const u = x * dx + y * dy;
        if (u < u0)
            continue;
        const l = -x * dy + y * dx;
        best = Math.min(best, Math.max(0, Math.abs(l) - 1.0));
    }
    return best;
}
/**
 * Could this tree overlap a vehicle on screen? The tree covers the ground points
 * (x − t, y − t) for t up to 0.95·height; vehicles (up to ~1 unit tall) reach
 * t ≈ −1. A canopy-sized margin is kept around every lane.
 */
function treeNearTraffic(layout, t) {
    const height = t.kind === 'poplar' ? 2.6 * t.size : 1.6 * t.size;
    const margin = (t.kind === 'poplar' ? 0.4 : 0.62) * t.size + 0.35;
    for (let k = -1.0; k <= 0.95 * height + 0.2; k += 0.2) {
        if (trafficDistance(layout, t.x - k, t.y - k) < margin)
            return true;
    }
    return false;
}
const infoCache = new WeakMap();
export function sceneInfo(layout) {
    const hit = infoCache.get(layout);
    if (hit)
        return hit;
    const round = layout.type === 'roundabout';
    const lamps = [];
    for (const d of DIRS) {
        if (!layout.armEnabled[d])
            continue;
        const u1 = layout.stopU + 1.2;
        const u2 = layout.stopU + 5.5;
        const [x1, y1] = armPt(d, u1, 1.3);
        const [hx1, hy1] = armPt(d, u1, 0.55);
        const [x2, y2] = armPt(d, u2, -1.3);
        const [hx2, hy2] = armPt(d, u2, -0.55);
        lamps.push({ x: x1, y: y1, hx: hx1, hy: hy1 }, { x: x2, y: y2, hx: hx2, hy: hy2 });
    }
    const blocked = closureRects(layout);
    const trees = [];
    const staticTrees = [];
    for (const [x, y, size, kind] of TREE_SPOTS) {
        if (round && Math.hypot(x, y) < RB.outer + WALK + 0.8)
            continue;
        if (blocked.some(([a, b, c, d]) => x > a && x < c && y > b && y < d))
            continue;
        const t = { x, y, size, kind };
        (treeNearTraffic(layout, t) ? trees : staticTrees).push(t);
    }
    const info = { lamps, trees, staticTrees, monument: round };
    infoCache.set(layout, info);
    return info;
}
// ---------------------------------------------------------------------------
// Primitive helpers (all colours pass through the ambience grade `g`)
// ---------------------------------------------------------------------------
function groundPoly(ctx, cam, pts, fill) {
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(cam.sx(x, y), cam.sy(x, y)) : ctx.moveTo(cam.sx(x, y), cam.sy(x, y))));
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
}
function rect(ctx, cam, x0, y0, x1, y1, fill, z = 0) {
    ctx.beginPath();
    ctx.moveTo(cam.sx(x0, y0), cam.sy(x0, y0, z));
    ctx.lineTo(cam.sx(x1, y0), cam.sy(x1, y0, z));
    ctx.lineTo(cam.sx(x1, y1), cam.sy(x1, y1, z));
    ctx.lineTo(cam.sx(x0, y1), cam.sy(x0, y1, z));
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
}
/** Ground ellipse = world circle of radius r at (x, y). */
function disc(ctx, cam, x, y, r, fill, z = 0) {
    ctx.beginPath();
    ctx.ellipse(cam.sx(x, y), cam.sy(x, y, z), r * cam.scale * Math.SQRT2, (r * cam.scale * Math.SQRT2) / 2, 0, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
}
/** Quad on the east-facing plane x = X. */
function eFace(ctx, cam, X, y0, y1, z0, z1, fill) {
    ctx.beginPath();
    ctx.moveTo(cam.sx(X, y0), cam.sy(X, y0, z0));
    ctx.lineTo(cam.sx(X, y1), cam.sy(X, y1, z0));
    ctx.lineTo(cam.sx(X, y1), cam.sy(X, y1, z1));
    ctx.lineTo(cam.sx(X, y0), cam.sy(X, y0, z1));
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
}
/** Quad on the south-facing plane y = Y. */
function sFace(ctx, cam, Y, x0, x1, z0, z1, fill) {
    ctx.beginPath();
    ctx.moveTo(cam.sx(x0, Y), cam.sy(x0, Y, z0));
    ctx.lineTo(cam.sx(x1, Y), cam.sy(x1, Y, z0));
    ctx.lineTo(cam.sx(x1, Y), cam.sy(x1, Y, z1));
    ctx.lineTo(cam.sx(x0, Y), cam.sy(x0, Y, z1));
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
}
const EAST_K = 0.72;
const SOUTH_K = 0.93;
/** Solid box: east face, south face, top. `base` is graded here. */
function box(ctx, cam, x0, y0, x1, y1, z0, z1, base, top) {
    const b = g(base);
    eFace(ctx, cam, x1, y0, y1, z0, z1, shade(b, EAST_K));
    sFace(ctx, cam, y1, x0, x1, z0, z1, shade(b, SOUTH_K));
    rect(ctx, cam, x0, y0, x1, y1, top ? g(top) : shade(b, 1.04), z1);
}
/** Text painted on a facade (south face: along +x; east face: along −y). */
function faceText(ctx, cam, face, x, y, z, text, size, color) {
    const s = cam.scale;
    ctx.save();
    if (face === 'south')
        ctx.transform(s * 0.01, s * 0.005, 0, 0.95 * s * 0.01, cam.sx(x, y), cam.sy(x, y, z));
    else
        ctx.transform(s * 0.01, -s * 0.005, 0, 0.95 * s * 0.01, cam.sx(x, y), cam.sy(x, y, z));
    ctx.font = `800 ${Math.round(size * 100)}px Roboto, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = color;
    ctx.fillText(text, 0, 0);
    ctx.restore();
}
const LIT = ['#ffd98a', '#ffe7ad', '#ffc766', '#fff1c9'];
function windowColor(env, dayColor) {
    if (env.light > 0 && env.rnd() < env.pLit)
        return LIT[Math.floor(env.rnd() * LIT.length)];
    return g(dayColor);
}
// ---------------------------------------------------------------------------
// Buildings
// ---------------------------------------------------------------------------
function shadowOf(ctx, cam, x0, y0, x1, y1, h, k) {
    if (k <= 0)
        return;
    const a = h * k;
    groundPoly(ctx, cam, [
        [x0, y1],
        [x0, y0],
        [x0 + a, y0 - a],
        [x1 + a, y0 - a],
        [x1 + a, y1 - a],
        [x1, y1],
    ], g('rgba(24,38,22,0.2)'));
}
/** Soviet-era panel block (typical of Tashkent), with balconies and a roof parapet. */
function panelBlock(ctx, cam, b, env) {
    const { x0, y0, x1, y1 } = b;
    const h = b.floors * FLOOR_H + 0.22;
    const base = g(b.color);
    // plinth + walls
    eFace(ctx, cam, x1, y0, y1, 0, h, shade(base, EAST_K));
    sFace(ctx, cam, y1, x0, x1, 0, h, shade(base, SOUTH_K));
    eFace(ctx, cam, x1 + 0.001, y0, y1, 0, 0.16, shade(base, 0.55));
    sFace(ctx, cam, y1 + 0.001, x0, x1, 0, 0.16, shade(base, 0.7));
    // panel seams
    for (let f = 1; f < b.floors; f++) {
        const z = f * FLOOR_H + 0.1;
        eFace(ctx, cam, x1 + 0.002, y0, y1, z, z + 0.018, shade(base, 0.6));
        sFace(ctx, cam, y1 + 0.002, x0, x1, z, z + 0.018, shade(base, 0.8));
    }
    // windows: east face
    const colsE = Math.max(1, Math.floor((y1 - y0) / 0.62));
    const stepE = (y1 - y0) / colsE;
    const colsS = Math.max(1, Math.floor((x1 - x0) / 0.62));
    const stepS = (x1 - x0) / colsS;
    const doorCol = Math.floor(colsS / 2);
    for (let f = 0; f < b.floors; f++) {
        const z0 = 0.26 + f * FLOOR_H;
        const z1 = z0 + 0.3;
        for (let c = 0; c < colsE; c++) {
            const ya = y0 + c * stepE + stepE * 0.3;
            eFace(ctx, cam, x1 + 0.003, ya, ya + stepE * 0.42, z0, z1, windowColor(env, '#4f6784'));
        }
        for (let c = 0; c < colsS; c++) {
            if (f === 0 && c === doorCol)
                continue;
            const xa = x0 + c * stepS + stepS * 0.3;
            sFace(ctx, cam, y1 + 0.003, xa, xa + stepS * 0.42, z0, z1, windowColor(env, '#5a7394'));
        }
    }
    // entrance: door + canopy
    const dx0 = x0 + doorCol * stepS + stepS * 0.22;
    const dx1 = dx0 + stepS * 0.56;
    sFace(ctx, cam, y1 + 0.004, dx0, dx1, 0.02, 0.42, g('#6b4a32'));
    box(ctx, cam, dx0 - 0.06, y1, dx1 + 0.06, y1 + 0.22, 0.46, 0.5, '#9aa3ad');
    if (env.light > 0) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        disc(ctx, cam, (dx0 + dx1) / 2, y1 + 0.35, 0.45, `rgba(255,196,120,${(0.22 * env.light).toFixed(3)})`);
        ctx.restore();
    }
    // balconies on the south face (every other column, from the 2nd floor)
    if (b.balconies) {
        for (let f = 1; f < b.floors; f++) {
            const z0 = 0.2 + f * FLOOR_H;
            for (let c = 1; c < colsS; c += 2) {
                const xa = x0 + c * stepS + stepS * 0.12;
                const xb = xa + stepS * 0.76;
                box(ctx, cam, xa, y1, xb, y1 + 0.16, z0, z0 + 0.04, b.accent);
                sFace(ctx, cam, y1 + 0.16, xa, xb, z0 + 0.04, z0 + 0.2, shade(g(b.accent), 0.95));
                eFace(ctx, cam, xb, y1, y1 + 0.16, z0 + 0.04, z0 + 0.2, shade(g(b.accent), 0.75));
            }
        }
    }
    // roof: slab, parapet, machine room
    rect(ctx, cam, x0, y0, x1, y1, shade(base, 0.86), h);
    rect(ctx, cam, x0 + 0.12, y0 + 0.12, x1 - 0.12, y1 - 0.12, shade(base, 0.72), h);
    const mx = x0 + (x1 - x0) * 0.35;
    const my = y0 + (y1 - y0) * 0.3;
    box(ctx, cam, mx, my, mx + 0.7, my + 0.55, h, h + 0.34, b.color);
    box(ctx, cam, x1 - 0.7, y0 + 0.3, x1 - 0.35, y0 + 0.65, h, h + 0.2, '#9aa3ad');
    if (b.sign) {
        faceText(ctx, cam, 'south', (x0 + x1) / 2, y1 + 0.005, h - 0.12, b.sign, 0.16, env.light > 0 ? '#ffe7ad' : g('#ffffff'));
    }
}
/** Row of small shops with striped awnings and signboards (facade faces south, toward the road). */
function shopRow(ctx, cam, x0, y0, x1, y1, env) {
    const h = 1.0;
    const shops = [
        { name: 'NON', wall: '#f1e3c6', awn: ['#d62828', '#fff4e6'] },
        { name: 'DORIXONA', wall: '#e6f0ef', awn: ['#16a34a', '#effbf3'] },
        { name: "DO'KON", wall: '#f3dfd0', awn: ['#2563eb', '#eef4ff'] },
    ];
    const w = (x1 - x0) / shops.length;
    // shared roof + side walls
    eFace(ctx, cam, x1, y0, y1, 0, h, shade(g(shops[2].wall), EAST_K));
    shops.forEach((s, i) => {
        const a = x0 + i * w;
        const b = a + w;
        sFace(ctx, cam, y1, a, b, 0, h, shade(g(s.wall), SOUTH_K));
        // glass shop front
        const glass = env.light > 0 ? '#ffe2a6' : g('#7fa6c2');
        sFace(ctx, cam, y1 + 0.003, a + 0.18, b - 0.55, 0.08, 0.62, glass);
        sFace(ctx, cam, y1 + 0.003, b - 0.45, b - 0.15, 0.02, 0.66, g('#5b3b27'));
        // signboard
        sFace(ctx, cam, y1 + 0.004, a + 0.12, b - 0.12, 0.72, 0.94, g('#20324a'));
        faceText(ctx, cam, 'south', (a + b) / 2, y1 + 0.006, 0.83, s.name, 0.15, env.light > 0 ? '#fff1c9' : g('#ffffff'));
        // striped awning (slanted)
        const stripes = 6;
        for (let k = 0; k < stripes; k++) {
            const sa = a + 0.1 + ((w - 0.2) * k) / stripes;
            const sb = a + 0.1 + ((w - 0.2) * (k + 1)) / stripes;
            ctx.beginPath();
            ctx.moveTo(cam.sx(sa, y1), cam.sy(sa, y1, 0.7));
            ctx.lineTo(cam.sx(sb, y1), cam.sy(sb, y1, 0.7));
            ctx.lineTo(cam.sx(sb, y1 + 0.38), cam.sy(sb, y1 + 0.38, 0.56));
            ctx.lineTo(cam.sx(sa, y1 + 0.38), cam.sy(sa, y1 + 0.38, 0.56));
            ctx.closePath();
            ctx.fillStyle = g(s.awn[k % 2]);
            ctx.fill();
        }
        sFace(ctx, cam, y1 + 0.38, a + 0.1, b - 0.1, 0.5, 0.56, shade(g(s.awn[0]), 0.8));
        if (env.light > 0) {
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            disc(ctx, cam, (a + b) / 2, y1 + 0.55, 0.62, `rgba(255,200,130,${(0.2 * env.light).toFixed(3)})`);
            ctx.restore();
        }
    });
    rect(ctx, cam, x0, y0, x1, y1, g('#b9a58c'), h);
    rect(ctx, cam, x0 + 0.08, y0 + 0.08, x1 - 0.08, y1 - 0.08, g('#a8937a'), h);
    box(ctx, cam, x0 + 0.6, y0 + 0.3, x0 + 1.0, y0 + 0.7, h, h + 0.22, '#c9ced6');
}
/** Mosque with a turquoise dome and a minaret (Samarkand blue tiles). */
function mosque(ctx, cam, env) {
    const x0 = -5.3;
    const y0 = -8.9;
    const x1 = -2.7;
    const y1 = -6.3;
    const h = 1.3;
    const wall = '#ede3cc';
    box(ctx, cam, x0, y0, x1, y1, 0, h, wall, '#ddd1b6');
    // tile band + pointed-arch openings
    eFace(ctx, cam, x1 + 0.002, y0, y1, h - 0.22, h - 0.1, g('#1a8fb0'));
    sFace(ctx, cam, y1 + 0.002, x0, x1, h - 0.22, h - 0.1, g('#1a8fb0'));
    const arch = (face, a, b) => {
        const mid = (a + b) / 2;
        const col = env.light > 0 && env.rnd() < 0.8 ? '#ffd98a' : g('#3a4b63');
        ctx.beginPath();
        if (face === 's') {
            ctx.moveTo(cam.sx(a, y1 + 0.004), cam.sy(a, y1 + 0.004, 0.1));
            ctx.lineTo(cam.sx(b, y1 + 0.004), cam.sy(b, y1 + 0.004, 0.1));
            ctx.lineTo(cam.sx(b, y1 + 0.004), cam.sy(b, y1 + 0.004, 0.62));
            ctx.lineTo(cam.sx(mid, y1 + 0.004), cam.sy(mid, y1 + 0.004, 0.86));
            ctx.lineTo(cam.sx(a, y1 + 0.004), cam.sy(a, y1 + 0.004, 0.62));
        }
        else {
            ctx.moveTo(cam.sx(x1 + 0.004, a), cam.sy(x1 + 0.004, a, 0.1));
            ctx.lineTo(cam.sx(x1 + 0.004, b), cam.sy(x1 + 0.004, b, 0.1));
            ctx.lineTo(cam.sx(x1 + 0.004, b), cam.sy(x1 + 0.004, b, 0.62));
            ctx.lineTo(cam.sx(x1 + 0.004, mid), cam.sy(x1 + 0.004, mid, 0.86));
            ctx.lineTo(cam.sx(x1 + 0.004, a), cam.sy(x1 + 0.004, a, 0.62));
        }
        ctx.closePath();
        ctx.fillStyle = col;
        ctx.fill();
    };
    for (let i = 0; i < 4; i++) {
        arch('s', x0 + 0.25 + i * 0.6, x0 + 0.6 + i * 0.6);
        arch('e', y0 + 0.25 + i * 0.6, y0 + 0.6 + i * 0.6);
    }
    // drum + dome
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    const R = 0.95;
    const zD = h + 0.28;
    const s = cam.scale;
    const px = cam.sx(cx, cy);
    const pyBase = cam.sy(cx, cy, zD);
    // drum (cylinder)
    const rr = (R + 0.08) * Math.SQRT2 * s;
    ctx.fillStyle = shade(g('#e6dcc3'), 0.9);
    ctx.beginPath();
    ctx.ellipse(px, cam.sy(cx, cy, h), rr, rr / 2, 0, 0, Math.PI);
    ctx.lineTo(px - rr, pyBase);
    ctx.ellipse(px, pyBase, rr, rr / 2, 0, Math.PI, 0, true);
    ctx.closePath();
    ctx.fill();
    const rx = R * Math.SQRT2 * s;
    const grad = ctx.createLinearGradient(px - rx, pyBase - R * s, px + rx, pyBase);
    grad.addColorStop(0, g('#5fd4d6'));
    grad.addColorStop(0.55, g('#1aa3a8'));
    grad.addColorStop(1, g('#0e6f78'));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(px, pyBase, rx, R * s * 1.184, 0, Math.PI, 0);
    ctx.ellipse(px, pyBase, rx, rx / 2, 0, 0, Math.PI);
    ctx.closePath();
    ctx.fill();
    // rib highlights + golden finial with a crescent
    ctx.strokeStyle = g('rgba(255,255,255,0.22)');
    ctx.lineWidth = Math.max(1, s * 0.03);
    for (const k of [-0.5, 0, 0.5]) {
        ctx.beginPath();
        ctx.ellipse(px, pyBase, rx * Math.abs(k) + 0.001, R * s * 1.184, 0, k < 0 ? Math.PI * 1.5 : Math.PI, k < 0 ? Math.PI * 2 : Math.PI * 1.5);
        ctx.stroke();
    }
    const topY = pyBase - R * s * 1.184;
    ctx.strokeStyle = g('#d4a93a');
    ctx.lineWidth = Math.max(1.2, s * 0.045);
    ctx.beginPath();
    ctx.moveTo(px, topY);
    ctx.lineTo(px, topY - s * 0.35);
    ctx.stroke();
    crescent(ctx, px, topY - s * 0.45, s * 0.1, g('#e8c14c'));
    // minaret
    minaret(ctx, cam, -2.65, -5.95, 0.26, 3.6, env);
}
function crescent(ctx, x, y, r, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r, Math.PI * 0.25, Math.PI * 1.75, false);
    ctx.arc(x + r * 0.45, y - r * 0.1, r * 0.78, Math.PI * 1.62, Math.PI * 0.38, true);
    ctx.closePath();
    ctx.fill();
}
function cylinder(ctx, cam, x, y, r, z0, z1, color) {
    const s = cam.scale;
    const px = cam.sx(x, y);
    const rx = r * Math.SQRT2 * s;
    const y0 = cam.sy(x, y, z0);
    const y1 = cam.sy(x, y, z1);
    const grad = ctx.createLinearGradient(px - rx, 0, px + rx, 0);
    grad.addColorStop(0, shade(color, 0.98));
    grad.addColorStop(0.45, shade(color, 1.05));
    grad.addColorStop(1, shade(color, 0.68));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(px, y0, rx, rx / 2, 0, 0, Math.PI);
    ctx.lineTo(px - rx, y1);
    ctx.ellipse(px, y1, rx, rx / 2, 0, Math.PI, 0, true);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = shade(color, 1.08);
    ctx.beginPath();
    ctx.ellipse(px, y1, rx, rx / 2, 0, 0, Math.PI * 2);
    ctx.fill();
}
function minaret(ctx, cam, x, y, r, h, env) {
    const s = cam.scale;
    cylinder(ctx, cam, x, y, r + 0.06, 0, 0.3, g('#d9ceb4'));
    cylinder(ctx, cam, x, y, r, 0.3, h * 0.78, g('#efe6d2'));
    for (const z of [1.1, 1.9])
        cylinder(ctx, cam, x, y, r + 0.005, z, z + 0.12, g('#1a8fb0'));
    cylinder(ctx, cam, x, y, r + 0.12, h * 0.78, h * 0.78 + 0.1, g('#d9ceb4'));
    cylinder(ctx, cam, x, y, r * 0.85, h * 0.78 + 0.1, h * 0.92, g('#1a8fb0'));
    if (env.light > 0) {
        const px = cam.sx(x, y);
        const py = cam.sy(x, y, h * 0.85);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const gr = ctx.createRadialGradient(px, py, 0, px, py, s * 0.9);
        gr.addColorStop(0, `rgba(120,220,255,${(0.35 * env.light).toFixed(3)})`);
        gr.addColorStop(1, 'rgba(120,220,255,0)');
        ctx.fillStyle = gr;
        ctx.fillRect(px - s, py - s, s * 2, s * 2);
        ctx.restore();
    }
    // conical cap
    const px = cam.sx(x, y);
    const rx = r * 0.9 * Math.SQRT2 * s;
    const yb = cam.sy(x, y, h * 0.92);
    ctx.fillStyle = g('#138a93');
    ctx.beginPath();
    ctx.moveTo(px - rx, yb);
    ctx.quadraticCurveTo(px - rx * 0.2, yb - s * 0.2, px, yb - s * 0.62);
    ctx.quadraticCurveTo(px + rx * 0.2, yb - s * 0.2, px + rx, yb);
    ctx.ellipse(px, yb, rx, rx / 2, 0, 0, Math.PI);
    ctx.closePath();
    ctx.fill();
    crescent(ctx, px, yb - s * 0.76, s * 0.075, g('#e8c14c'));
}
function kiosk(ctx, cam, env) {
    const x0 = -6.4;
    const y0 = 2.4;
    const x1 = -5.2;
    const y1 = 3.4;
    box(ctx, cam, x0, y0, x1, y1, 0, 0.95, '#f0b429', '#d62828');
    eFace(ctx, cam, x1 + 0.003, y0 + 0.12, y1 - 0.12, 0.35, 0.75, env.light > 0 ? '#ffe7ad' : g('#8fb4cf'));
    sFace(ctx, cam, y1 + 0.003, x0 + 0.1, x1 - 0.1, 0.8, 0.93, g('#ffffff'));
    faceText(ctx, cam, 'south', (x0 + x1) / 2, y1 + 0.005, 0.865, 'MUZQAYMOQ', 0.09, g('#d62828'));
    box(ctx, cam, x0 - 0.05, y0 - 0.05, x1 + 0.12, y1 + 0.12, 0.95, 1.02, '#b91c1c');
}
function busStop(ctx, cam, env) {
    const x0 = -4.6;
    const y0 = 2.3;
    const x1 = -2.8;
    const y1 = 2.9;
    // back glass wall (seen from behind) + bench + roof
    box(ctx, cam, x0 + 0.2, y0 + 0.18, x1 - 0.2, y0 + 0.36, 0, 0.26, '#8a6a4a');
    ctx.save();
    ctx.globalAlpha = 0.55;
    sFace(ctx, cam, y1 - 0.08, x0 + 0.05, x1 - 0.05, 0.05, 0.95, g('#a9d4ee'));
    ctx.restore();
    // advertising panel on the east end (backlit at night)
    eFace(ctx, cam, x1, y0 + 0.05, y1 - 0.05, 0.1, 0.95, env.light > 0 ? '#bfe6ff' : g('#3b82c4'));
    eFace(ctx, cam, x1 + 0.004, y0 + 0.15, y1 - 0.15, 0.3, 0.72, env.light > 0 ? '#fff4d6' : g('#f5c518'));
    for (const px of [x0 + 0.05, x1 - 0.1])
        box(ctx, cam, px, y1 - 0.12, px + 0.05, y1 - 0.07, 0, 1.0, '#6b7280');
    box(ctx, cam, x0 - 0.05, y0 - 0.1, x1 + 0.05, y1 + 0.04, 1.0, 1.07, '#e5e7eb');
    // bus-stop sign pole with the "A" plate
    box(ctx, cam, x0 - 0.35, y0 - 0.02, x0 - 0.3, y0 + 0.03, 0, 1.3, '#6b7280');
    sFace(ctx, cam, y0 + 0.031, x0 - 0.52, x0 - 0.13, 1.02, 1.36, g('#1d4ed8'));
    faceText(ctx, cam, 'south', x0 - 0.325, y0 + 0.033, 1.19, 'A', 0.22, g('#ffffff'));
}
/** One-storey house with a pitched roof and a courtyard wall (hovli). */
function house(ctx, cam, x0, y0, x1, y1, wall, roof, env) {
    const h = 0.85;
    const ridge = 0.5;
    box(ctx, cam, x0, y0, x1, y1, 0, h, wall);
    for (const t of [0.22, 0.62]) {
        sFace(ctx, cam, y1 + 0.003, x0 + (x1 - x0) * t, x0 + (x1 - x0) * t + 0.36, 0.3, 0.62, windowColor(env, '#5a7394'));
    }
    eFace(ctx, cam, x1 + 0.003, y0 + 0.4, y0 + 0.76, 0.3, 0.62, windowColor(env, '#4f6784'));
    // gable roof along x: ridge at the middle y
    const ym = (y0 + y1) / 2;
    const R = g(roof);
    const P = (x, y, z) => [cam.sx(x, y), cam.sy(x, y, z)];
    const quad = (pts, fill) => {
        ctx.beginPath();
        pts.forEach(([a, b], i) => (i ? ctx.lineTo(a, b) : ctx.moveTo(a, b)));
        ctx.closePath();
        ctx.fillStyle = fill;
        ctx.fill();
    };
    // south slope (visible, lit)
    quad([P(x0 - 0.08, y1 + 0.12, h - 0.05), P(x1 + 0.08, y1 + 0.12, h - 0.05), P(x1 + 0.08, ym, h + ridge), P(x0 - 0.08, ym, h + ridge)], shade(R, 1.0));
    // east gable triangle
    quad([P(x1, y1, h), P(x1, y0, h), P(x1, ym, h + ridge)], shade(g(wall), EAST_K * 0.95));
    quad([P(x1 + 0.08, y1 + 0.12, h - 0.05), P(x1 + 0.08, ym, h + ridge), P(x1 + 0.08, ym - 0.04, h + ridge + 0.03)], shade(R, 0.7));
    // ridge line
    ctx.strokeStyle = shade(R, 0.6);
    ctx.lineWidth = Math.max(1, cam.scale * 0.03);
    ctx.beginPath();
    ctx.moveTo(...P(x0 - 0.08, ym, h + ridge));
    ctx.lineTo(...P(x1 + 0.08, ym, h + ridge));
    ctx.stroke();
    // courtyard walls (in front of the house → painted after it)
    box(ctx, cam, x1 + 0.3, y0 - 0.4, x1 + 0.4, y1 + 0.35, 0, 0.4, '#d8c9ae');
    box(ctx, cam, x0 - 0.5, y1 + 0.35, x1 + 0.4, y1 + 0.45, 0, 0.4, '#d8c9ae');
}
function teaHouse(ctx, cam, x0, y0, x1, y1, env) {
    // choyxona: low building + covered wooden platform (so'ri) in front
    const h = 0.85;
    box(ctx, cam, x0 + 1.2, y0, x1, y1, 0, h, '#efe2c8', '#2f855a');
    for (let i = 0; i < 3; i++) {
        const ya = y0 + 0.35 + i * ((y1 - y0 - 0.5) / 3);
        eFace(ctx, cam, x1 + 0.003, ya, ya + 0.45, 0.28, 0.64, windowColor(env, '#4f6784'));
    }
    sFace(ctx, cam, y1 + 0.004, x0 + 1.4, x1 - 0.2, 0.66, 0.82, g('#20324a'));
    faceText(ctx, cam, 'south', (x0 + 1.2 + x1) / 2, y1 + 0.006, 0.74, 'CHOYXONA', 0.11, env.light > 0 ? '#fff1c9' : g('#ffffff'));
    // so'ri: platform + 4 posts + canopy
    box(ctx, cam, x0, y0 + 0.4, x0 + 1.05, y1 - 0.4, 0, 0.22, '#9a6b3f');
    box(ctx, cam, x0 + 0.08, y0 + 0.48, x0 + 0.97, y1 - 0.48, 0.22, 0.26, '#b91c1c');
    for (const [px, py] of [
        [x0 + 0.02, y0 + 0.42],
        [x0 + 0.98, y0 + 0.42],
        [x0 + 0.02, y1 - 0.47],
        [x0 + 0.98, y1 - 0.47],
    ]) {
        box(ctx, cam, px, py, px + 0.05, py + 0.05, 0.22, 0.85, '#7a5230');
    }
    box(ctx, cam, x0 - 0.05, y0 + 0.35, x0 + 1.1, y1 - 0.35, 0.85, 0.9, '#2f855a');
}
// ---------------------------------------------------------------------------
// Ground-level city: parking, park, flower beds
// ---------------------------------------------------------------------------
const PARKED_CTX = {
    levelId: 7,
    ownedModels: ['nexia3', 'cobalt', 'spark', 'gentra', 'damas', 'matiz'],
    hero: { model: 'matiz', paint: 'sariq', mods: [] },
};
function parking(ctx, cam, layout) {
    const x0 = 4.6;
    const y0 = 2.4;
    const x1 = 9.0;
    const y1 = 4.4;
    if (layout.armEnabled[1])
        rect(ctx, cam, 5.25, 1.5, 6.05, y0, g('#555a63'));
    rect(ctx, cam, x0 - 0.12, y0 - 0.12, x1 + 0.12, y1 + 0.12, g(PALETTE.curb));
    rect(ctx, cam, x0, y0, x1, y1, g('#555a63'));
    for (let i = 0; i <= 4; i++) {
        const x = x0 + 0.1 + i * 1.1;
        rect(ctx, cam, x - 0.025, y0 + 0.5, x + 0.025, y1 - 0.1, g('rgba(245,245,240,0.8)'));
    }
    // P sign
    box(ctx, cam, x0 + 0.02, y0 + 0.02, x0 + 0.07, y0 + 0.07, 0, 1.2, '#6b7280');
    sFace(ctx, cam, y0 + 0.071, x0 - 0.13, x0 + 0.22, 0.9, 1.25, g('#1d4ed8'));
    faceText(ctx, cam, 'south', x0 + 0.045, y0 + 0.073, 1.075, 'P', 0.26, g('#ffffff'));
    // parked cars (static)
    const spots = [
        [5.2, 3.45],
        [6.3, 3.45],
        [8.5, 3.45],
    ];
    spots.forEach(([x, y], i) => {
        const look = lookFor({ id: `P${i}`, kind: 'car', hero: false }, PARKED_CTX);
        drawVehicleVector(ctx, new Pose(cam).set(x, y, i % 2 ? Math.PI / 2 : -Math.PI / 2), look);
    });
}
function hedge(ctx, cam, x0, y0, x1, y1) {
    box(ctx, cam, x0, y0, x1, y1, 0, 0.28, '#2f7d3a', '#3f9a4a');
}
function flowerBed(ctx, cam, x, y, r, rnd) {
    disc(ctx, cam, x, y, r + 0.08, g(PALETTE.curb));
    disc(ctx, cam, x, y, r, g('#6b4f36'));
    const colors = ['#ff5d8f', '#ffd166', '#f8f9fa', '#ef476f', '#c77dff'];
    for (let i = 0; i < 26; i++) {
        const a = rnd() * Math.PI * 2;
        const rr = Math.sqrt(rnd()) * r * 0.9;
        const fx = x + Math.cos(a) * rr;
        const fy = y + Math.sin(a) * rr;
        ctx.fillStyle = g(colors[i % colors.length]);
        ctx.beginPath();
        ctx.arc(cam.sx(fx, fy), cam.sy(fx, fy, 0.05), Math.max(1.2, cam.scale * 0.055), 0, Math.PI * 2);
        ctx.fill();
    }
}
function bench(ctx, cam, x, y, alongX) {
    if (alongX) {
        box(ctx, cam, x, y, x + 0.7, y + 0.2, 0.16, 0.2, '#8a5a34');
        box(ctx, cam, x, y + 0.17, x + 0.7, y + 0.21, 0.2, 0.38, '#8a5a34');
    }
    else {
        box(ctx, cam, x, y, x + 0.2, y + 0.7, 0.16, 0.2, '#8a5a34');
        box(ctx, cam, x + 0.17, y, x + 0.21, y + 0.7, 0.2, 0.38, '#8a5a34');
    }
}
function pond(ctx, cam, cx, cy, env) {
    const shape = (r) => {
        const pts = [];
        for (let i = 0; i < 18; i++) {
            const a = (i / 18) * Math.PI * 2;
            const k = 1 + 0.12 * Math.sin(a * 3 + 0.7) + 0.07 * Math.cos(a * 5);
            pts.push([cx + Math.cos(a) * r * 1.25 * k, cy + Math.sin(a) * r * k]);
        }
        return pts;
    };
    groundPoly(ctx, cam, shape(1.75), g('#d9cfae'));
    groundPoly(ctx, cam, shape(1.55), env.light > 0 ? g('#2f7fa3') : g('#5fb3d9'));
    groundPoly(ctx, cam, shape(1.1), env.light > 0 ? g('#2a7396') : g('#54a7cf'));
    // lily pads + highlights
    for (const [dx, dy] of [
        [-0.9, 0.3],
        [-0.6, 0.6],
        [0.8, -0.5],
    ])
        disc(ctx, cam, cx + dx, cy + dy, 0.16, g('#3f9a4a'));
    ctx.strokeStyle = g('rgba(255,255,255,0.35)');
    ctx.lineWidth = Math.max(1, cam.scale * 0.03);
    for (let k = 0; k < 3; k++) {
        const x = cx - 0.6 + k * 0.5;
        const y = cy - 0.2 + k * 0.25;
        ctx.beginPath();
        ctx.moveTo(cam.sx(x, y), cam.sy(x, y));
        ctx.lineTo(cam.sx(x + 0.35, y + 0.05), cam.sy(x + 0.35, y + 0.05));
        ctx.stroke();
    }
    // small wooden pier
    box(ctx, cam, cx - 0.35, cy - 1.95, cx + 0.05, cy - 1.0, 0.04, 0.1, '#9a6b3f');
}
function playground(ctx, cam, x, y) {
    rect(ctx, cam, x - 1.3, y - 1.0, x + 1.3, y + 1.0, g('#e9c98d'));
    rect(ctx, cam, x - 1.2, y - 0.9, x + 1.2, y + 0.9, g('#f0d7a4'));
    // slide: ladder tower + slanted chute
    box(ctx, cam, x - 0.9, y - 0.6, x - 0.5, y - 0.2, 0, 0.62, '#2563eb', '#1d4ed8');
    ctx.fillStyle = g('#f97316');
    ctx.beginPath();
    ctx.moveTo(cam.sx(x - 0.5, y - 0.55), cam.sy(x - 0.5, y - 0.55, 0.62));
    ctx.lineTo(cam.sx(x - 0.5, y - 0.25), cam.sy(x - 0.5, y - 0.25, 0.62));
    ctx.lineTo(cam.sx(x + 0.4, y - 0.25), cam.sy(x + 0.4, y - 0.25, 0.04));
    ctx.lineTo(cam.sx(x + 0.4, y - 0.55), cam.sy(x + 0.4, y - 0.55, 0.04));
    ctx.closePath();
    ctx.fill();
    // swing frame
    for (const px of [x + 0.2, x + 1.0])
        box(ctx, cam, px, y + 0.35, px + 0.05, y + 0.4, 0, 0.8, '#6b7280');
    box(ctx, cam, x + 0.2, y + 0.35, x + 1.05, y + 0.4, 0.8, 0.84, '#6b7280');
    for (const px of [x + 0.42, x + 0.78]) {
        ctx.strokeStyle = g('#4b5563');
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cam.sx(px, y + 0.37), cam.sy(px, y + 0.37, 0.8));
        ctx.lineTo(cam.sx(px, y + 0.37), cam.sy(px, y + 0.37, 0.3));
        ctx.stroke();
        box(ctx, cam, px - 0.08, y + 0.3, px + 0.08, y + 0.45, 0.26, 0.3, '#dc2626');
    }
    // sandbox
    rect(ctx, cam, x - 1.0, y + 0.2, x - 0.3, y + 0.8, g('#b38b5d'));
    rect(ctx, cam, x - 0.92, y + 0.28, x - 0.38, y + 0.72, g('#f3dd9f'));
}
function park(ctx, cam, env) {
    const x0 = 2.4;
    const y0 = 5.0;
    const x1 = 13.0;
    const y1 = 13.6;
    rect(ctx, cam, x0, y0, x1, y1, g(PALETTE.grassLight));
    // paths: a cross + a ring around the fountain + a spur to the pond
    const fx = 5.5;
    const fy = 7.2;
    const path = g('#e6dcc8');
    rect(ctx, cam, x0, fy - 0.28, x1, fy + 0.28, path);
    rect(ctx, cam, fx - 0.28, y0, fx + 0.28, y1, path);
    groundPoly(ctx, cam, [[fx + 0.8, fy + 0.6], [fx + 1.3, fy + 0.2], [10.4, 8.9], [9.9, 9.3]], path);
    disc(ctx, cam, fx, fy, 1.55, path);
    pond(ctx, cam, 10.6, 10.6, env);
    playground(ctx, cam, 4.2, 11.4);
    // fountain: rim, water, central bowl, spray
    disc(ctx, cam, fx, fy, 1.05, g('#cfc6b4'));
    const s = cam.scale;
    const px = cam.sx(fx, fy);
    const rim = cam.sy(fx, fy, 0.18);
    ctx.fillStyle = shade(g('#cfc6b4'), 0.8);
    ctx.beginPath();
    ctx.ellipse(px, cam.sy(fx, fy), 1.05 * Math.SQRT2 * s, 1.05 * Math.SQRT2 * s * 0.5, 0, 0, Math.PI);
    ctx.lineTo(px - 1.05 * Math.SQRT2 * s, rim);
    ctx.ellipse(px, rim, 1.05 * Math.SQRT2 * s, 1.05 * Math.SQRT2 * s * 0.5, 0, Math.PI, 0, true);
    ctx.closePath();
    ctx.fill();
    disc(ctx, cam, fx, fy, 1.05, g('#d9d1c0'), 0.18);
    disc(ctx, cam, fx, fy, 0.9, env.light > 0 ? '#3aa6c9' : g(PALETTE.water), 0.18);
    cylinder(ctx, cam, fx, fy, 0.12, 0.18, 0.62, g('#d9d1c0'));
    disc(ctx, cam, fx, fy, 0.34, g('#d9d1c0'), 0.62);
    disc(ctx, cam, fx, fy, 0.26, g('#8fd3ee'), 0.63);
    ctx.strokeStyle = env.light > 0 ? 'rgba(190,235,255,0.85)' : 'rgba(235,248,255,0.9)';
    ctx.lineWidth = Math.max(1, s * 0.035);
    const top = cam.sy(fx, fy, 1.05);
    for (let k = -3; k <= 3; k++) {
        ctx.beginPath();
        ctx.moveTo(px, top);
        ctx.quadraticCurveTo(px + k * s * 0.16, top - s * 0.25, px + k * s * 0.3, cam.sy(fx, fy, 0.66));
        ctx.stroke();
    }
    // flower beds + hedges + benches
    flowerBed(ctx, cam, 3.6, 8.6, 0.5, env.rnd);
    flowerBed(ctx, cam, 7.6, 6.0, 0.45, env.rnd);
    flowerBed(ctx, cam, 7.8, 8.9, 0.5, env.rnd);
    flowerBed(ctx, cam, 11.4, 6.3, 0.45, env.rnd);
    hedge(ctx, cam, x0, y0, x1, y0 + 0.22);
    hedge(ctx, cam, x0, y0 + 0.22, x0 + 0.22, fy - 0.35);
    hedge(ctx, cam, x0, fy + 0.35, x0 + 0.22, y1);
    bench(ctx, cam, 4.25, 6.35, true);
    bench(ctx, cam, 6.2, 7.85, true);
    bench(ctx, cam, 8.6, 10.2, false);
}
// ---------------------------------------------------------------------------
// Roads
// ---------------------------------------------------------------------------
function armRect(d, u0, u1, l0, l1) {
    return [armPt(d, u0, l0), armPt(d, u1, l0), armPt(d, u1, l1), armPt(d, u0, l1)];
}
/** Painted turn arrows on the incoming lane — only for exits that exist. */
function laneArrows(ctx, cam, d, u0, turns) {
    if (!turns.length)
        return;
    // local (f forward toward the centre, r right of the inbound heading) → world
    const W = (f, r) => armPt(d, u0 - f, -0.5 - r);
    const S = (f, r) => {
        const [x, y] = W(f, r);
        return [cam.sx(x, y), cam.sy(x, y)];
    };
    const paint = g('rgba(245,245,240,0.82)');
    ctx.strokeStyle = paint;
    ctx.fillStyle = paint;
    ctx.lineWidth = Math.max(1.2, cam.scale * 0.075);
    ctx.lineCap = 'butt';
    ctx.lineJoin = 'round';
    const tri = (a, b, c) => {
        ctx.beginPath();
        ctx.moveTo(...S(...a));
        ctx.lineTo(...S(...b));
        ctx.lineTo(...S(...c));
        ctx.closePath();
        ctx.fill();
    };
    const hasStraight = turns.includes('straight');
    ctx.beginPath();
    ctx.moveTo(...S(0, 0));
    ctx.lineTo(...S(hasStraight ? 0.66 : 0.34, 0));
    ctx.stroke();
    if (hasStraight)
        tri([0.62, -0.15], [0.62, 0.15], [0.98, 0]);
    for (const t of turns) {
        if (t === 'straight')
            continue;
        const k = t === 'left' ? -1 : 1;
        ctx.beginPath();
        ctx.moveTo(...S(0.3, 0));
        ctx.quadraticCurveTo(...S(0.56, 0), ...S(0.6, 0.2 * k));
        ctx.stroke();
        tri([0.44, 0.2 * k], [0.76, 0.2 * k], [0.6, 0.48 * k]);
    }
}
function roads(ctx, cam, layout, env) {
    const round = layout.type === 'roundabout';
    const inner = round ? RB.outer - 0.35 : CROSS.box;
    const stopU = layout.stopU;
    const on = (d) => layout.armEnabled[d];
    // sidewalks (+ tile seams)
    for (const d of DIRS)
        if (on(d))
            groundPoly(ctx, cam, armRect(d, inner - 0.3, EXTENT, -1 - WALK, 1 + WALK), g(PALETTE.sidewalk));
    if (round)
        disc(ctx, cam, 0, 0, RB.outer + WALK, g(PALETTE.sidewalk));
    else
        groundPoly(ctx, cam, [[-1 - WALK, -1 - WALK], [1 + WALK, -1 - WALK], [1 + WALK, 1 + WALK], [-1 - WALK, 1 + WALK]], g(PALETTE.sidewalk));
    const seam = g('rgba(90,80,60,0.12)');
    for (const d of DIRS) {
        if (!on(d))
            continue;
        for (let u = inner + 0.8; u < EXTENT; u += 0.75) {
            groundPoly(ctx, cam, armRect(d, u, u + 0.025, 1.05, 1 + WALK), seam);
            groundPoly(ctx, cam, armRect(d, u, u + 0.025, -1 - WALK, -1.05), seam);
        }
    }
    // asphalt
    for (const d of DIRS)
        if (on(d))
            groundPoly(ctx, cam, armRect(d, inner - 0.3, EXTENT, -1, 1), g(PALETTE.asphalt));
    if (round)
        disc(ctx, cam, 0, 0, RB.outer, g(PALETTE.asphalt));
    else
        groundPoly(ctx, cam, [[-1, -1], [1, -1], [1, 1], [-1, 1]], g(PALETTE.asphaltLight));
    // asphalt wear: patches, tyre tracks, oil at the stop line, manholes
    for (const d of DIRS) {
        if (!on(d))
            continue;
        for (let i = 0; i < 9; i++) {
            const u = stopU + 1 + env.rnd() * 18;
            const l = -0.8 + env.rnd() * 1.6;
            const len = 0.3 + env.rnd() * 0.8;
            const wid = 0.12 + env.rnd() * 0.3;
            groundPoly(ctx, cam, armRect(d, u, u + len, l, Math.min(0.95, l + wid)), g('rgba(30,33,38,0.22)'));
        }
        const track = g('rgba(28,30,34,0.16)');
        groundPoly(ctx, cam, armRect(d, stopU, stopU + 7, -0.74, -0.6), track);
        groundPoly(ctx, cam, armRect(d, stopU, stopU + 7, -0.4, -0.26), track);
        const [ox, oy] = armPt(d, stopU + 0.75, -0.5);
        ctx.fillStyle = g('rgba(20,22,26,0.2)');
        ctx.beginPath();
        ctx.ellipse(cam.sx(ox, oy), cam.sy(ox, oy), cam.scale * 0.34, cam.scale * 0.14, 0, 0, Math.PI * 2);
        ctx.fill();
        if (d % 2 === 0) {
            const [mx, my] = armPt(d, stopU + 3.6, 0.5);
            disc(ctx, cam, mx, my, 0.24, g('#3a3e45'));
            disc(ctx, cam, mx, my, 0.19, g('#5b6069'));
            ctx.strokeStyle = g('rgba(30,32,36,0.6)');
            ctx.lineWidth = 1;
            for (let k = -1; k <= 1; k++) {
                const [ax, ay] = [mx + k * 0.08, my - 0.14];
                const [bx, by] = [mx + k * 0.08, my + 0.14];
                ctx.beginPath();
                ctx.moveTo(cam.sx(ax, ay), cam.sy(ax, ay));
                ctx.lineTo(cam.sx(bx, by), cam.sy(bx, by));
                ctx.stroke();
            }
        }
        // storm drain at the curb
        groundPoly(ctx, cam, armRect(d, stopU + 2.2, stopU + 2.6, -0.98, -0.86), g('#2d3036'));
    }
    // curbs (start where the arm edge meets the box / the ring's outer circle)
    const curb = g(PALETTE.curb);
    const curbFrom = round ? Math.sqrt(RB.outer ** 2 - 1) : CROSS.box;
    for (const d of DIRS) {
        if (on(d)) {
            groundPoly(ctx, cam, armRect(d, curbFrom, EXTENT, 1.0, 1.07), curb);
            groundPoly(ctx, cam, armRect(d, curbFrom, EXTENT, -1.07, -1.0), curb);
        }
        else if (!round) {
            groundPoly(ctx, cam, armRect(d, 1.0, 1.07, -1, 1), curb);
        }
    }
    if (round) {
        ctx.strokeStyle = curb;
        ctx.lineWidth = Math.max(1, cam.scale * 0.07);
        ctx.beginPath();
        ctx.ellipse(cam.sx(0, 0), cam.sy(0, 0), (RB.outer + 0.03) * Math.SQRT2 * cam.scale, ((RB.outer + 0.03) * Math.SQRT2 * cam.scale) / 2, 0, 0, Math.PI * 2);
        ctx.stroke();
        for (const d of DIRS)
            if (on(d))
                groundPoly(ctx, cam, armRect(d, RB.outer - 0.2, RB.curveU + 0.4, -1, 1), g(PALETTE.asphalt));
    }
    // markings
    const line = g(PALETTE.line);
    const edge = g('rgba(255,255,255,0.55)');
    for (const d of DIRS) {
        if (!on(d))
            continue;
        groundPoly(ctx, cam, armRect(d, stopU, stopU + 3, -0.03, 0.03), line);
        for (let u = stopU + 3.4; u < EXTENT; u += 1.1)
            groundPoly(ctx, cam, armRect(d, u, u + 0.55, -0.03, 0.03), line);
        groundPoly(ctx, cam, armRect(d, stopU, EXTENT, -0.96, -0.92), edge);
        groundPoly(ctx, cam, armRect(d, stopU, EXTENT, 0.92, 0.96), edge);
        if (!round) {
            // stop line + zebra
            groundPoly(ctx, cam, armRect(d, stopU + 0.02, stopU + 0.12, -0.96, -0.03), line);
            for (let l = -0.9; l < 0.9; l += 0.24) {
                groundPoly(ctx, cam, armRect(d, CROSS.crosswalkNear, CROSS.crosswalkFar, l, l + 0.13), g('rgba(255,255,255,0.85)'));
            }
            const turns = ['left', 'straight', 'right'].filter((t) => on(exitOf(d, t)));
            laneArrows(ctx, cam, d, stopU + 2.6, turns);
        }
        else {
            // yield "shark teeth"
            for (let l = -0.92; l < -0.05; l += 0.18) {
                const u = stopU + 0.05;
                groundPoly(ctx, cam, [armPt(d, u, l), armPt(d, u, l + 0.14), armPt(d, u + 0.16, l + 0.07)], line);
            }
            // splitter island
            groundPoly(ctx, cam, armRect(d, RB.outer - 0.05, RB.curveU + 0.35, -0.16, 0.16), g(PALETTE.curb));
            groundPoly(ctx, cam, armRect(d, RB.outer + 0.05, RB.curveU + 0.25, -0.1, 0.1), g(PALETTE.island));
        }
    }
    if (round) {
        disc(ctx, cam, 0, 0, RB.island + 0.12, g(PALETTE.curb));
        disc(ctx, cam, 0, 0, RB.island, g(PALETTE.island));
        disc(ctx, cam, 0, 0, RB.island * 0.62, g('#8fca6c'));
        for (let i = 0; i < 20; i++) {
            const a = (i / 20) * Math.PI * 2;
            const r = RB.island * 0.82;
            const x = r * Math.cos(a);
            const y = r * Math.sin(a);
            ctx.fillStyle = g(i % 3 === 0 ? '#ff5d8f' : i % 3 === 1 ? '#ffd166' : '#f8f9fa');
            ctx.beginPath();
            ctx.arc(cam.sx(x, y), cam.sy(x, y), Math.max(1.5, cam.scale * 0.07), 0, Math.PI * 2);
            ctx.fill();
        }
        // circulation arrows on the ring (counter-clockwise on the map)
        ctx.strokeStyle = g('rgba(255,255,255,0.4)');
        ctx.fillStyle = g('rgba(255,255,255,0.4)');
        ctx.lineWidth = Math.max(1, cam.scale * 0.06);
        for (let k = 0; k < 4; k++) {
            const a0 = (k * Math.PI) / 2 + Math.PI / 4 + 0.25;
            ctx.beginPath();
            for (let i = 0; i <= 10; i++) {
                const a = a0 - (i / 10) * 0.5;
                const x = RB.ring * Math.cos(a);
                const y = RB.ring * Math.sin(a);
                if (i)
                    ctx.lineTo(cam.sx(x, y), cam.sy(x, y));
                else
                    ctx.moveTo(cam.sx(x, y), cam.sy(x, y));
            }
            ctx.stroke();
            const a = a0 - 0.5;
            const tx = RB.ring * Math.cos(a - 0.12);
            const ty = RB.ring * Math.sin(a - 0.12);
            const lx = (RB.ring - 0.16) * Math.cos(a);
            const ly = (RB.ring - 0.16) * Math.sin(a);
            const rx = (RB.ring + 0.16) * Math.cos(a);
            const ry = (RB.ring + 0.16) * Math.sin(a);
            ctx.beginPath();
            ctx.moveTo(cam.sx(tx, ty), cam.sy(tx, ty));
            ctx.lineTo(cam.sx(lx, ly), cam.sy(lx, ly));
            ctx.lineTo(cam.sx(rx, ry), cam.sy(rx, ry));
            ctx.closePath();
            ctx.fill();
        }
    }
}
// ---------------------------------------------------------------------------
// Ambience layers
// ---------------------------------------------------------------------------
function lampPools(ctx, cam, info, env) {
    if (env.light <= 0)
        return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const s = cam.scale;
    for (const l of info.lamps) {
        const px = cam.sx(l.hx, l.hy);
        const py = cam.sy(l.hx, l.hy);
        const r = 1.7 * Math.SQRT2 * s;
        ctx.save();
        ctx.translate(px, py);
        ctx.scale(1, 0.5);
        const gr = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
        gr.addColorStop(0, `rgba(255,206,130,${(0.4 * env.light).toFixed(3)})`);
        gr.addColorStop(0.55, `rgba(255,180,100,${(0.14 * env.light).toFixed(3)})`);
        gr.addColorStop(1, 'rgba(255,170,90,0)');
        ctx.fillStyle = gr;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        if (env.amb === 'rain') {
            // wet-asphalt reflection: a thin broken streak toward the viewer
            for (let k = 0; k < 3; k++) {
                const y0 = py + s * (0.05 + k * 0.42);
                const gr2 = ctx.createLinearGradient(px, y0, px, y0 + s * 0.36);
                gr2.addColorStop(0, `rgba(255,210,150,${(0.2 - k * 0.05).toFixed(3)})`);
                gr2.addColorStop(1, 'rgba(255,210,150,0)');
                ctx.fillStyle = gr2;
                ctx.fillRect(px - s * 0.035 + (k % 2 ? s * 0.02 : 0), y0, s * 0.07, s * 0.36);
            }
        }
    }
    ctx.restore();
}
function puddles(ctx, cam, layout, env) {
    if (env.amb !== 'rain')
        return;
    for (const d of DIRS) {
        if (!layout.armEnabled[d])
            continue;
        for (let i = 0; i < 4; i++) {
            const u = layout.stopU + 1.2 + env.rnd() * 12;
            const l = (env.rnd() < 0.5 ? -1 : 1) * (0.72 + env.rnd() * 0.5);
            const [x, y] = armPt(d, u, l);
            const r = 0.22 + env.rnd() * 0.3;
            ctx.fillStyle = g('rgba(120,150,180,0.35)');
            ctx.beginPath();
            ctx.ellipse(cam.sx(x, y), cam.sy(x, y), r * cam.scale * 1.8, r * cam.scale * 0.6, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = 'rgba(210,225,240,0.12)';
            ctx.lineWidth = 1;
            ctx.stroke();
        }
    }
}
function vignette(ctx, w, h, env) {
    const k = env.amb === 'night' ? 0.42 : env.amb === 'day' ? 0.12 : 0.24;
    const gr = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.hypot(w, h) * 0.62);
    gr.addColorStop(0, 'rgba(0,0,0,0)');
    gr.addColorStop(1, `rgba(8,12,24,${k})`);
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, w, h);
}
// ---------------------------------------------------------------------------
// City layout (single source of truth for drawing, shadows and the occlusion test)
// ---------------------------------------------------------------------------
const PANEL_A = { x0: -9.8, y0: -5.2, x1: -5.4, y1: -2.4, floors: 5, color: '#e7dcc8', accent: '#8fb8c8', balconies: true };
const PANEL_B = { x0: -10.5, y0: -10.5, x1: -6.8, y1: -7.2, floors: 9, color: '#d9d4c7', accent: '#c96f4a', balconies: true };
const PANEL_C = { x0: 4.4, y0: -8.2, x1: 8.6, y1: -5.2, floors: 5, color: '#c9d6df', accent: '#e9edf1', balconies: true };
const PANEL_D = { x0: -9.6, y0: 4.4, x1: -5.6, y1: 7.6, floors: 4, color: '#e9d8c0', accent: '#7fb3a0', balconies: true };
const SHOPS = { x0: 3.0, y0: -3.9, x1: 8.4, y1: -2.4 };
function closures(layout) {
    const round = layout.type === 'roundabout';
    const n = round ? 1.1 : 0; // N/W setback
    const e = round ? 1.6 : 0; // E/S setback (the viewer side needs more room)
    const on = layout.armEnabled;
    return {
        school: on[0] ? null : { x0: -1.8, y0: -6.0 - n, x1: 1.8, y1: -2.4 - n, floors: 3, color: '#f0d9b5', accent: '#e9edf1', sign: 'MAKTAB 110' },
        schoolHedge: on[0] ? null : { x0: -1.8, y0: -2.1 - n, x1: 1.8, y1: -1.85 - n },
        tea: on[1] ? null : { x0: 2.4 + e, y0: -1.7, x1: 6.2 + e, y1: 1.7 },
        south: on[2] ? null : e,
        west: on[3] ? null : { x0: -6.4 - n, y0: -1.8, x1: -2.4 - n, y1: 1.8, floors: 5, color: '#dfe3d6', accent: '#c96f4a', balconies: true },
    };
}
const HOUSE_1 = { x0: -6.2, y0: 9.6, x1: -3.4, y1: 11.8 };
const HOUSE_2 = { x0: -11.6, y0: 9.0, x1: -8.8, y1: 11.2 };
/** Panel height incl. the roof machine room. */
const panelHeight = (p) => p.floors * FLOOR_H + 0.22 + 0.34;
/**
 * Conservative bounding boxes of everything painted into the static layer
 * (buildings incl. balconies/canopies/awnings, parked cars, park furniture,
 * T-junction closures, static trees). Used by tests/scene.test.mjs to prove
 * that no static object can cover a vehicle standing behind it.
 */
export function staticBoxes(layout) {
    const panel = (name, p) => ({ name, x0: p.x0, y0: p.y0, x1: p.x1, y1: p.y1 + 0.24, h: panelHeight(p) });
    const out = [
        panel('panel A', PANEL_A),
        panel('panel B', PANEL_B),
        panel('panel C', PANEL_C),
        panel('panel D', PANEL_D),
        { name: 'mosque', x0: -5.3, y0: -8.9, x1: -2.7, y1: -6.3, h: 3.4 },
        { name: 'minaret', x0: -3.03, y0: -6.33, x1: -2.27, y1: -5.57, h: 4.45 },
        { name: 'shops', x0: SHOPS.x0, y0: SHOPS.y0, x1: SHOPS.x1, y1: SHOPS.y1 + 0.39, h: 1.24 },
        { name: 'kiosk', x0: -6.45, y0: 2.35, x1: -5.08, y1: 3.52, h: 1.03 },
        { name: 'bus stop', x0: -5.13, y0: 2.2, x1: -2.75, y1: 2.95, h: 1.37 },
        { name: 'house 1', x0: HOUSE_1.x0 - 0.5, y0: HOUSE_1.y0 - 0.4, x1: HOUSE_1.x1 + 0.4, y1: HOUSE_1.y1 + 0.45, h: 1.4 },
        { name: 'house 2', x0: HOUSE_2.x0 - 0.5, y0: HOUSE_2.y0 - 0.4, x1: HOUSE_2.x1 + 0.4, y1: HOUSE_2.y1 + 0.45, h: 1.4 },
        { name: 'parked cars', x0: 4.55, y0: 2.75, x1: 9.15, y1: 4.15, h: 0.85 },
        { name: 'P sign', x0: 4.47, y0: 2.4, x1: 4.83, y1: 2.5, h: 1.26 },
        { name: 'park hedge', x0: 2.4, y0: 5.0, x1: 13.0, y1: 5.22, h: 0.28 },
        { name: 'park hedge W', x0: 2.4, y0: 5.0, x1: 2.62, y1: 13.6, h: 0.28 },
        { name: 'fountain', x0: 4.45, y0: 6.15, x1: 6.55, y1: 8.25, h: 1.06 },
        { name: 'playground', x0: 2.9, y0: 10.4, x1: 5.5, y1: 12.4, h: 0.85 },
        { name: 'benches', x0: 4.25, y0: 6.35, x1: 6.9, y1: 8.06, h: 0.38 },
    ];
    const c = closures(layout);
    if (c.school)
        out.push(panel('school', c.school));
    if (c.schoolHedge)
        out.push({ name: 'school hedge', ...c.schoolHedge, h: 0.28 });
    if (c.tea)
        out.push({ name: 'choyxona', x0: c.tea.x0 - 0.05, y0: c.tea.y0, x1: c.tea.x1, y1: c.tea.y1, h: 0.9 });
    if (c.south !== null) {
        const o = c.south;
        out.push({ name: 'south hedge', x0: -1.8, y0: 1.9 + o, x1: 1.8, y1: 2.1 + o, h: 0.28 }, { name: 'south bench', x0: -0.35, y0: 2.3 + o, x1: 0.35, y1: 2.51 + o, h: 0.38 });
    }
    if (c.west)
        out.push(panel('west block', c.west));
    for (const t of sceneInfo(layout).staticTrees) {
        const r = (t.kind === 'poplar' ? 0.34 : 0.55) * t.size;
        out.push({ name: `tree ${t.x},${t.y}`, x0: t.x - r, y0: t.y - r, x1: t.x + r, y1: t.y + r, h: (t.kind === 'poplar' ? 2.65 : 1.62) * t.size });
    }
    return out;
}
export function renderScene(ctx, cam, layout, opts = { ambience: 'day' }) {
    const w = cam.width;
    const h = cam.height;
    const amb = opts.ambience;
    const light = LIGHT_LEVEL[amb];
    const env = {
        amb,
        light,
        rnd: prng(9173 + (opts.seed ?? 0) * 31),
        pLit: amb === 'night' ? 0.6 : amb === 'evening' ? 0.25 : amb === 'rain' ? 0.32 : 0,
    };
    const info = sceneInfo(layout);
    const shadowK = amb === 'day' ? 0.45 : amb === 'evening' ? 0.95 : 0;
    ctx.fillStyle = g(PALETTE.grass);
    ctx.fillRect(0, 0, w, h);
    // grass texture (deterministic)
    const tex = prng(12345);
    for (let i = 0; i < 110; i++) {
        const x = (tex() - 0.5) * 34;
        const y = (tex() - 0.5) * 34;
        const r = 0.4 + tex() * 1.4;
        groundPoly(ctx, cam, [[x - r, y], [x, y - r * 0.6], [x + r, y], [x, y + r * 0.6]], g(tex() < 0.7 ? PALETTE.grassDark : PALETTE.grassLight));
    }
    roads(ctx, cam, layout, env);
    puddles(ctx, cam, layout, env);
    // SE ground-level city (in front of the junction: low objects only)
    park(ctx, cam, env);
    if (layout.type !== 'roundabout')
        flowerBed(ctx, cam, 2.55, 2.55, 0.55, env.rnd);
    parking(ctx, cam, layout);
    // building shadows (ground), then lamp light pools
    for (const p of [PANEL_A, PANEL_B, PANEL_C, PANEL_D])
        shadowOf(ctx, cam, p.x0, p.y0, p.x1, p.y1, p.floors * FLOOR_H + 0.22, shadowK);
    shadowOf(ctx, cam, -5.3, -8.9, -2.7, -6.3, 2.2, shadowK);
    shadowOf(ctx, cam, SHOPS.x0, SHOPS.y0, SHOPS.x1, SHOPS.y1, 1.0, shadowK);
    const cl = closures(layout);
    for (const p of [cl.school, cl.west])
        if (p)
            shadowOf(ctx, cam, p.x0, p.y0, p.x1, p.y1, p.floors * FLOOR_H + 0.22, shadowK);
    lampPools(ctx, cam, info, env);
    // buildings, back to front
    const list = [];
    const add = (x0, y0, x1, y1, draw) => list.push({ depth: (x0 + x1 + y0 + y1) / 2, draw });
    for (const p of [PANEL_A, PANEL_B, PANEL_C, PANEL_D])
        add(p.x0, p.y0, p.x1, p.y1, () => panelBlock(ctx, cam, p, env));
    add(-5.3, -8.9, -2.4, -5.7, () => mosque(ctx, cam, env));
    add(SHOPS.x0, SHOPS.y0, SHOPS.x1, SHOPS.y1, () => shopRow(ctx, cam, SHOPS.x0, SHOPS.y0, SHOPS.x1, SHOPS.y1, env));
    add(-6.4, 2.4, -5.2, 3.4, () => kiosk(ctx, cam, env));
    add(-4.6, 2.3, -2.8, 2.9, () => busStop(ctx, cam, env));
    add(HOUSE_1.x0, HOUSE_1.y0, HOUSE_1.x1, HOUSE_1.y1, () => house(ctx, cam, HOUSE_1.x0, HOUSE_1.y0, HOUSE_1.x1, HOUSE_1.y1, '#efe4cf', '#b4533a', env));
    add(HOUSE_2.x0, HOUSE_2.y0, HOUSE_2.x1, HOUSE_2.y1, () => house(ctx, cam, HOUSE_2.x0, HOUSE_2.y0, HOUSE_2.x1, HOUSE_2.y1, '#e7ddd0', '#7a8ea3', env));
    // closures of missing arms (T junctions)
    if (cl.school) {
        const school = cl.school;
        const hg = cl.schoolHedge;
        add(school.x0, school.y0, school.x1, school.y1, () => {
            panelBlock(ctx, cam, school, env);
            hedge(ctx, cam, hg.x0, hg.y0, hg.x1, hg.y1);
        });
    }
    if (cl.tea) {
        const t = cl.tea;
        add(t.x0, t.y0, t.x1, t.y1, () => teaHouse(ctx, cam, t.x0, t.y0, t.x1, t.y1, env));
    }
    if (cl.south !== null) {
        const o = cl.south;
        add(-1.8, 1.9 + o, 1.8, 2.8 + o, () => {
            hedge(ctx, cam, -1.8, 1.9 + o, 1.8, 2.1 + o);
            flowerBed(ctx, cam, -0.9, 2.6 + o, 0.4, env.rnd);
            flowerBed(ctx, cam, 0.9, 2.6 + o, 0.4, env.rnd);
            bench(ctx, cam, -0.35, 2.3 + o, true);
        });
    }
    if (cl.west) {
        const wb = cl.west;
        add(wb.x0, wb.y0, wb.x1, wb.y1, () => panelBlock(ctx, cam, wb, env));
    }
    for (const t of info.staticTrees)
        list.push({ depth: t.x + t.y, draw: () => drawTree(ctx, cam, t.x, t.y, t.size, t.kind) });
    list.sort((a, b) => a.depth - b.depth);
    for (const b of list)
        b.draw();
    vignette(ctx, w, h, env);
}
//# sourceMappingURL=scene.js.map