/**
 * Static scene layer: ground, roads, sidewalks, markings, roundabout island,
 * background buildings. Rendered ONCE per level / resize into an offscreen
 * canvas and blitted every frame (the single most important render optimisation).
 * Tall objects that vehicles can pass behind (trees, poles, the island monument)
 * are NOT here — they are depth-sorted props.
 */
import { DIR_VEC, DIRS, inLane } from '../../core/dir.js';
import { CROSS, RB } from '../../core/junction.js';
import { PALETTE, shade } from './color.js';
const EXTENT = 22;
function worldPoly(ctx, cam, pts, fill) {
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(cam.sx(x, y), cam.sy(x, y)) : ctx.moveTo(cam.sx(x, y), cam.sy(x, y))));
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
}
function worldEllipse(ctx, cam, r, fill) {
    ctx.beginPath();
    ctx.ellipse(cam.sx(0, 0), cam.sy(0, 0), r * cam.scale * Math.SQRT2, (r * cam.scale * Math.SQRT2) / 2, 0, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
}
/** Rectangle along arm d: u ∈ [u0, u1], lateral ∈ [l0, l1] (lateral = right of the outward direction). */
function armRect(d, u0, u1, l0, l1) {
    const [dx, dy] = DIR_VEC[d];
    const rx = -dy;
    const ry = dx;
    const p = (u, l) => [dx * u + rx * l, dy * u + ry * l];
    return [p(u0, l0), p(u1, l0), p(u1, l1), p(u0, l1)];
}
function isoBox(ctx, cam, x0, y0, x1, y1, h, color, roof) {
    // visible faces: +x (east) and +y (south), then roof
    const P = (x, y, z) => [cam.sx(x, y), cam.sy(x, y, z)];
    const face = (pts, fill) => {
        ctx.beginPath();
        pts.forEach(([a, b], i) => (i ? ctx.lineTo(a, b) : ctx.moveTo(a, b)));
        ctx.closePath();
        ctx.fillStyle = fill;
        ctx.fill();
    };
    face([P(x1, y0, 0), P(x1, y1, 0), P(x1, y1, h), P(x1, y0, h)], shade(color, 0.72));
    face([P(x0, y1, 0), P(x1, y1, 0), P(x1, y1, h), P(x0, y1, h)], shade(color, 0.9));
    face([P(x0, y0, h), P(x1, y0, h), P(x1, y1, h), P(x0, y1, h)], roof);
    // windows
    ctx.fillStyle = 'rgba(40,60,90,0.55)';
    const floors = Math.max(1, Math.floor(h / 0.7));
    for (let f = 0; f < floors; f++) {
        const z0 = 0.35 + f * 0.7;
        if (z0 + 0.3 > h)
            break;
        for (let t = 0.15; t < 0.9; t += 0.25) {
            const y = y0 + (y1 - y0) * t;
            face([P(x1, y, z0), P(x1, y + (y1 - y0) * 0.12, z0), P(x1, y + (y1 - y0) * 0.12, z0 + 0.3), P(x1, y, z0 + 0.3)], 'rgba(40,60,90,0.5)');
            const x = x0 + (x1 - x0) * t;
            face([P(x, y1, z0), P(x + (x1 - x0) * 0.12, y1, z0), P(x + (x1 - x0) * 0.12, y1, z0 + 0.3), P(x, y1, z0 + 0.3)], 'rgba(40,60,90,0.45)');
        }
    }
}
export function renderScene(ctx, cam, layout) {
    const w = cam.width;
    const h = cam.height;
    ctx.fillStyle = PALETTE.grass;
    ctx.fillRect(0, 0, w, h);
    // subtle grass texture (deterministic)
    let seed = 12345;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 90; i++) {
        const x = (rnd() - 0.5) * 30;
        const y = (rnd() - 0.5) * 30;
        const r = 0.4 + rnd() * 1.4;
        worldPoly(ctx, cam, [[x - r, y], [x, y - r * 0.6], [x + r, y], [x, y + r * 0.6]], PALETTE.grassDark);
    }
    // background buildings (back quadrant only → never occlude traffic)
    isoBox(ctx, cam, -9.5, -9.5, -5.2, -4.4, 3.2, '#c9b79c', '#b3a386');
    isoBox(ctx, cam, -4.6, -10, -3.4, -6.4, 2.2, '#9fb4c7', '#8aa0b4');
    isoBox(ctx, cam, -10, -3.9, -6.8, -3.3, 1.6, '#d7c3a5', '#c4ae8e');
    isoBox(ctx, cam, 4.2, -9, 7.5, -6.2, 1.8, '#e0d2bd', '#cdbca3');
    isoBox(ctx, cam, -8.8, 4.4, -5.8, 7.6, 1.6, '#c7d3c0', '#b3c2ab');
    const round = layout.type === 'roundabout';
    const inner = round ? RB.outer - 0.35 : CROSS.box;
    const walk = 0.5;
    // sidewalks then asphalt, per arm
    for (const d of DIRS) {
        if (!layout.armEnabled[d])
            continue;
        worldPoly(ctx, cam, armRect(d, inner - 0.3, EXTENT, -1 - walk, 1 + walk), PALETTE.sidewalk);
    }
    if (round) {
        worldEllipse(ctx, cam, RB.outer + walk, PALETTE.sidewalk);
    }
    else {
        worldPoly(ctx, cam, [[-1 - walk, -1 - walk], [1 + walk, -1 - walk], [1 + walk, 1 + walk], [-1 - walk, 1 + walk]], PALETTE.sidewalk);
    }
    for (const d of DIRS) {
        if (!layout.armEnabled[d])
            continue;
        worldPoly(ctx, cam, armRect(d, inner - 0.3, EXTENT, -1, 1), PALETTE.asphalt);
    }
    if (round) {
        worldEllipse(ctx, cam, RB.outer, PALETTE.asphalt);
    }
    else {
        worldPoly(ctx, cam, [[-1, -1], [1, -1], [1, 1], [-1, 1]], PALETTE.asphaltLight);
    }
    // markings
    const line = PALETTE.line;
    for (const d of DIRS) {
        if (!layout.armEnabled[d])
            continue;
        const stopU = layout.stopU;
        // centre line: solid near the junction, dashed further out
        worldPoly(ctx, cam, armRect(d, stopU, stopU + 3, -0.03, 0.03), line);
        for (let u = stopU + 3.4; u < EXTENT; u += 1.1)
            worldPoly(ctx, cam, armRect(d, u, u + 0.55, -0.03, 0.03), line);
        // edge lines
        worldPoly(ctx, cam, armRect(d, stopU, EXTENT, -0.96, -0.92), 'rgba(255,255,255,0.55)');
        worldPoly(ctx, cam, armRect(d, stopU, EXTENT, 0.92, 0.96), 'rgba(255,255,255,0.55)');
        // incoming lane is on the LEFT of the outward direction (right of the inward heading)
        if (!round) {
            worldPoly(ctx, cam, armRect(d, stopU + 0.02, stopU + 0.12, -0.96, -0.03), line);
            for (let l = -0.9; l < 0.9; l += 0.24) {
                worldPoly(ctx, cam, armRect(d, CROSS.crosswalkNear, CROSS.crosswalkFar, l, l + 0.13), 'rgba(255,255,255,0.85)');
            }
        }
        else {
            // yield "shark teeth"
            for (let l = -0.92; l < -0.05; l += 0.18) {
                const [dx, dy] = DIR_VEC[d];
                const rx = -dy;
                const ry = dx;
                const u = stopU + 0.05;
                const P = (uu, ll) => [dx * uu + rx * ll, dy * uu + ry * ll];
                worldPoly(ctx, cam, [P(u, l), P(u, l + 0.14), P(u + 0.16, l + 0.07)], line);
            }
            // splitter island
            worldPoly(ctx, cam, armRect(d, RB.outer - 0.05, RB.curveU + 0.35, -0.16, 0.16), PALETTE.curb);
            worldPoly(ctx, cam, armRect(d, RB.outer + 0.05, RB.curveU + 0.25, -0.1, 0.1), PALETTE.island);
        }
    }
    if (round) {
        worldEllipse(ctx, cam, RB.island + 0.12, PALETTE.curb);
        worldEllipse(ctx, cam, RB.island, PALETTE.island);
        worldEllipse(ctx, cam, RB.island * 0.62, '#8fca6c');
        // flower ring
        for (let i = 0; i < 16; i++) {
            const a = (i / 16) * Math.PI * 2;
            const r = RB.island * 0.8;
            const x = r * Math.cos(a);
            const y = r * Math.sin(a);
            ctx.fillStyle = i % 2 ? '#ff5d8f' : '#ffd166';
            ctx.beginPath();
            ctx.arc(cam.sx(x, y), cam.sy(x, y), Math.max(1.5, cam.scale * 0.07), 0, Math.PI * 2);
            ctx.fill();
        }
        // circulation arrows on the ring (counter-clockwise on the map)
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.lineWidth = Math.max(1, cam.scale * 0.05);
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
        }
    }
    // lane direction hints on incoming lanes
    for (const d of DIRS) {
        if (!layout.armEnabled[d])
            continue;
        const [ax, ay] = inLane(d, layout.stopU + 1.2);
        const [bx, by] = inLane(d, layout.stopU + 0.6);
        ctx.strokeStyle = 'rgba(255,255,255,0.45)';
        ctx.lineWidth = Math.max(1, cam.scale * 0.05);
        ctx.beginPath();
        ctx.moveTo(cam.sx(ax, ay), cam.sy(ax, ay));
        ctx.lineTo(cam.sx(bx, by), cam.sy(bx, by));
        ctx.stroke();
    }
}
//# sourceMappingURL=scene.js.map