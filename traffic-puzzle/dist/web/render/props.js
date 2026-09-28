/**
 * Depth-sorted props: sign poles, traffic lights, the traffic controller
 * (regulirovshik), trees. Plates/heads are screen-aligned billboards so they
 * stay readable at any zoom.
 */
import { bodySide, gesturePermits } from '../../core/controller.js';
import { DIR_VEC, inLane, rot } from '../../core/dir.js';
import { g } from './color.js';
import { drawLight } from './effects.js';
const S = { x: 0, y: 0 };
const S2 = { x: 0, y: 0 };
/** Roadside position to the right of the incoming lane of arm d, at distance u. */
export function roadside(d, u, extra = 1.12) {
    const [x, y] = inLane(d, u);
    const [dx, dy] = DIR_VEC[d];
    // right of the inbound heading (−dx, −dy) is (dy, −dx)
    return [x + dy * extra, y - dx * extra];
}
function pole(ctx, cam, x, y, h) {
    cam.project(x, y, 0, S);
    cam.project(x, y, h, S2);
    ctx.strokeStyle = g('#6b7280');
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
export function drawSign(ctx, cam, d, sign, stopU, roundabout) {
    if (sign === 'none' && !roundabout)
        return;
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
    }
    else if (sign === 'yield') {
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
    }
    else if (sign === 'stop') {
        ctx.fillStyle = '#d62828';
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
            const a = Math.PI / 8 + (i * Math.PI) / 4;
            const px = cx + r * Math.cos(a);
            const py = cy + r * Math.sin(a);
            if (i)
                ctx.lineTo(px, py);
            else
                ctx.moveTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = `bold ${Math.round(r * 0.62)}px Roboto, system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('STOP', cx, cy + 1);
    }
}
export function drawTrafficLight(ctx, cam, d, stopU, aspect, countdown, nowMs) {
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
    const lamps = [
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
export function drawTree(ctx, cam, x, y, size, kind = 'round', fade = 1) {
    cam.project(x, y, 0, S);
    const s = cam.scale * size;
    if (fade < 1)
        ctx.globalAlpha = fade;
    ctx.fillStyle = g('rgba(0,0,0,0.18)');
    ctx.beginPath();
    ctx.ellipse(S.x + s * 0.15, S.y, s * (kind === 'poplar' ? 0.34 : 0.55), s * (kind === 'poplar' ? 0.17 : 0.28), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = g('#7a5230');
    if (kind === 'poplar') {
        // terak: tall, narrow Uzbek poplar
        ctx.fillRect(S.x - s * 0.05, S.y - s * 0.5, s * 0.1, s * 0.5);
        ctx.fillStyle = g('#3b7d34');
        ctx.beginPath();
        ctx.ellipse(S.x, S.y - s * 1.45, s * 0.3, s * 1.05, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = g('#4f9a45');
        ctx.beginPath();
        ctx.ellipse(S.x - s * 0.08, S.y - s * 1.62, s * 0.17, s * 0.78, 0, 0, Math.PI * 2);
        ctx.fill();
    }
    else {
        ctx.fillRect(S.x - s * 0.07, S.y - s * 0.7, s * 0.14, s * 0.7);
        ctx.fillStyle = g('#3f8f3a');
        ctx.beginPath();
        ctx.arc(S.x, S.y - s * 1.05, s * 0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = g('#56a84c');
        ctx.beginPath();
        ctx.arc(S.x - s * 0.15, S.y - s * 1.2, s * 0.33, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = g('rgba(255,255,255,0.12)');
        ctx.beginPath();
        ctx.arc(S.x - s * 0.22, S.y - s * 1.3, s * 0.14, 0, Math.PI * 2);
        ctx.fill();
    }
    if (fade < 1)
        ctx.globalAlpha = 1;
}
/** Screen-space canopy circle of a tree (for the "fade when a car is behind it" check). */
export function treeCanopy(cam, x, y, size, kind) {
    const s = cam.scale * size;
    return kind === 'poplar'
        ? { x: cam.sx(x, y), y: cam.sy(x, y) - s * 1.45, r: s * 0.95 }
        : { x: cam.sx(x, y), y: cam.sy(x, y) - s * 1.05, r: s * 0.55 };
}
// ---------------------------------------------------------------------------
// Traffic controller (regulirovshik)
// ---------------------------------------------------------------------------
const UNIFORM = '#2b3a55';
const SKIN = '#e0ac7e';
/** Draw the controller at the centre, chest facing arm `facing`, in the given gesture. */
export function drawController(ctx, cam, gesture, facing, lit = false) {
    const s = cam.scale;
    const uniform = g(UNIFORM);
    const skin = g(SKIN);
    const dark = g('#1f2a3d');
    // forward (chest) and right-hand vectors in world space
    const [fx, fy] = DIR_VEC[facing];
    const [rx, ry] = DIR_VEC[rot(facing, 1)];
    const W = (f, r, z, out) => cam.project(fx * f + rx * r, fy * f + ry * r, z, out);
    const line = (a, b, color, width) => {
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
    const wedge = [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }];
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
    line([0, 0.06, 0], [0, 0.06, 0.34], dark, lw);
    line([0, -0.06, 0], [0, -0.06, 0.34], dark, lw);
    // torso (thick vertical stroke) + belt
    line([0, 0, 0.36], [0, 0, 0.66], uniform, Math.max(4, s * 0.24));
    line([0.01, -0.1, 0.4], [0.01, 0.1, 0.4], '#f4f4f4', Math.max(1.5, s * 0.05));
    if (lit) {
        // reflective vest stripes at night
        line([0.02, -0.11, 0.5], [0.02, 0.11, 0.5], '#d9ff66', Math.max(1.5, s * 0.04));
        line([0.02, -0.11, 0.6], [0.02, 0.11, 0.6], '#d9ff66', Math.max(1.5, s * 0.04));
    }
    // chest badge (only meaningful when visible)
    const chestVisible = fx + fy > -0.01;
    if (chestVisible)
        line([0.08, 0.03, 0.56], [0.08, 0.05, 0.58], '#f5c518', Math.max(2, s * 0.06));
    // arms
    const shoulderR = [0, 0.13, 0.64];
    const shoulderL = [0, -0.13, 0.64];
    let handR;
    let handL;
    if (gesture === 'arms_side') {
        handR = [0, 0.5, 0.66];
        handL = [0, -0.5, 0.66];
    }
    else if (gesture === 'right_forward') {
        handR = [0.42, 0.14, 0.64];
        handL = [0, -0.17, 0.36];
    }
    else {
        handR = [0, 0.16, 1.08];
        handL = [0, -0.17, 0.36];
    }
    line(shoulderL, handL, uniform, Math.max(2, s * 0.08));
    line(shoulderR, handR, uniform, Math.max(2, s * 0.08));
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
        const a = [handR[0] + dir[0] * k * (i / 4), handR[1] + dir[1] * k * (i / 4), handR[2] + dir[2] * k * (i / 4)];
        const b = [handR[0] + dir[0] * k * ((i + 1) / 4), handR[1] + dir[1] * k * ((i + 1) / 4), handR[2] + dir[2] * k * ((i + 1) / 4)];
        line(a, b, i % 2 ? '#111' : '#fff', Math.max(1.8, s * 0.05));
    }
    // head + cap
    W(0, 0, 0.78, S);
    ctx.fillStyle = skin;
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
    ctx.fillStyle = dark;
    ctx.fillRect(S.x - s * 0.1, S.y + s * 0.02, s * 0.2, s * 0.03);
}
/** Assist overlay: green/red turn arrows at each stop line for the current pose. */
export function drawControllerAssist(ctx, cam, pose, armEnabled, stopU) {
    for (let d = 0; d < 4; d++) {
        if (!armEnabled[d])
            continue;
        const from = d;
        const side = bodySide(pose.pose.facing, from);
        const turns = ['left', 'straight', 'right'];
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
export function drawTurnGlyph(ctx, x, y, s, turn, color = '#ffffff') {
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
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
    }
    else {
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
// ---------------------------------------------------------------------------
// City props (v3)
// ---------------------------------------------------------------------------
const LAMP_Z = 2.25;
/** Street lamp: post + arm over the road + head; the bulb glows when `light` > 0. */
export function drawStreetLamp(ctx, cam, l, light, glow) {
    const s = cam.scale;
    const base = cam.project(l.x, l.y, 0, S);
    const bx = base.x;
    const by = base.y;
    ctx.fillStyle = g('rgba(0,0,0,0.18)');
    ctx.beginPath();
    ctx.ellipse(bx, by, s * 0.1, s * 0.05, 0, 0, Math.PI * 2);
    ctx.fill();
    cam.project(l.x, l.y, LAMP_Z, S2);
    ctx.strokeStyle = g('#5b636e');
    ctx.lineWidth = Math.max(1.4, s * 0.055);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(S2.x, S2.y);
    const tx = S2.x;
    const ty = S2.y;
    cam.project(l.hx, l.hy, LAMP_Z + 0.06, S2);
    ctx.quadraticCurveTo(tx, ty - s * 0.12, S2.x, S2.y);
    ctx.stroke();
    // head
    ctx.fillStyle = g('#3b4250');
    ctx.beginPath();
    ctx.ellipse(S2.x, S2.y + s * 0.03, s * 0.16, s * 0.07, 0, 0, Math.PI * 2);
    ctx.fill();
    if (light > 0) {
        ctx.fillStyle = '#fff4d6';
        ctx.beginPath();
        ctx.ellipse(S2.x, S2.y + s * 0.07, s * 0.1, s * 0.035, 0, 0, Math.PI * 2);
        ctx.fill();
        drawLight(ctx, glow.get('255,214,150', s * 0.75), S2.x, S2.y + s * 0.1, 0.55 * light);
    }
}
/** Roundabout island monument: stepped pedestal, column and a golden globe. */
export function drawMonument(ctx, cam, light) {
    const s = cam.scale;
    const step = (r, z0, z1, color) => {
        const px = cam.sx(0, 0);
        const y0 = cam.sy(0, 0, z0);
        const y1 = cam.sy(0, 0, z1);
        const w = r * s;
        // square pedestal in iso: a diamond prism
        ctx.fillStyle = g(color);
        ctx.beginPath();
        ctx.moveTo(px - w, y0);
        ctx.lineTo(px, y0 + w / 2);
        ctx.lineTo(px + w, y0);
        ctx.lineTo(px + w, y1);
        ctx.lineTo(px, y1 + w / 2);
        ctx.lineTo(px - w, y1);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = g('rgba(0,0,0,0.16)');
        ctx.beginPath();
        ctx.moveTo(px, y0 + w / 2);
        ctx.lineTo(px + w, y0);
        ctx.lineTo(px + w, y1);
        ctx.lineTo(px, y1 + w / 2);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = g('#f3efe6');
        ctx.beginPath();
        ctx.moveTo(px - w, y1);
        ctx.lineTo(px, y1 - w / 2);
        ctx.lineTo(px + w, y1);
        ctx.lineTo(px, y1 + w / 2);
        ctx.closePath();
        ctx.fill();
    };
    cam.project(0, 0, 0, S);
    ctx.fillStyle = g('rgba(0,0,0,0.18)');
    ctx.beginPath();
    ctx.ellipse(S.x + s * 0.2, S.y + s * 0.05, s * 0.9, s * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();
    step(0.62, 0, 0.18, '#d8d2c4');
    step(0.44, 0.18, 0.36, '#cfc8b8');
    // column
    const px = cam.sx(0, 0);
    const c0 = cam.sy(0, 0, 0.36);
    const c1 = cam.sy(0, 0, 1.6);
    const cw = s * 0.13;
    const grad = ctx.createLinearGradient(px - cw, 0, px + cw, 0);
    grad.addColorStop(0, g('#f4efe4'));
    grad.addColorStop(1, g('#b9b1a0'));
    ctx.fillStyle = grad;
    ctx.fillRect(px - cw, c1, cw * 2, c0 - c1);
    // golden globe
    const gy = cam.sy(0, 0, 1.85);
    const gr = s * 0.28;
    const gg = ctx.createRadialGradient(px - gr * 0.35, gy - gr * 0.35, gr * 0.1, px, gy, gr);
    gg.addColorStop(0, g('#fff2b0'));
    gg.addColorStop(0.5, g('#e3b341'));
    gg.addColorStop(1, g('#a9781c'));
    ctx.fillStyle = gg;
    ctx.beginPath();
    ctx.arc(px, gy, gr, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = g('rgba(120,80,10,0.55)');
    ctx.lineWidth = Math.max(0.8, s * 0.02);
    ctx.beginPath();
    ctx.ellipse(px, gy, gr, gr * 0.35, 0, 0, Math.PI * 2);
    ctx.moveTo(px, gy - gr);
    ctx.ellipse(px, gy, gr * 0.4, gr, 0, -Math.PI / 2, Math.PI * 1.5);
    ctx.stroke();
    if (light > 0) {
        // floodlight from below
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const fl = ctx.createRadialGradient(px, gy, 0, px, gy, s * 0.9);
        fl.addColorStop(0, `rgba(255,220,140,${(0.35 * light).toFixed(3)})`);
        fl.addColorStop(1, 'rgba(255,220,140,0)');
        ctx.fillStyle = fl;
        ctx.fillRect(px - s, gy - s, s * 2, s * 2);
        ctx.restore();
    }
}
// ---------------------------------------------------------------------------
// Screen-space UI glyphs (never graded — they must stay readable)
// ---------------------------------------------------------------------------
/** Tutorial hand pointing DOWN at (x, y); `t` in ms animates a bob. */
export function drawHand(ctx, x, y, size, t) {
    const bob = Math.sin(t / 180) * size * 0.12;
    const k = size / 40;
    ctx.save();
    ctx.translate(x, y - size * 0.15 + bob);
    ctx.scale(k, k);
    ctx.lineJoin = 'round';
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#1b2a41';
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetY = 2;
    // index finger (pointing down: tip at the origin)
    ctx.beginPath();
    ctx.roundRect(-5, -26, 10, 26, 5);
    // fist
    ctx.roundRect(-9, -46, 26, 24, 7);
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.stroke();
    // knuckle lines + thumb
    ctx.beginPath();
    ctx.moveTo(4, -40);
    ctx.lineTo(4, -30);
    ctx.moveTo(10, -40);
    ctx.lineTo(10, -30);
    ctx.stroke();
    ctx.beginPath();
    ctx.roundRect(-14, -40, 9, 14, 4);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    // tap ripple
    const r = ((t % 1100) / 1100) * size * 0.6;
    ctx.strokeStyle = `rgba(255,255,255,${(0.8 * (1 - r / (size * 0.6))).toFixed(3)})`;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.ellipse(x, y + size * 0.1, r, r * 0.5, 0, 0, Math.PI * 2);
    ctx.stroke();
}
/** Impatience bubble: three dots (waiting) or "!" (waiting too long). */
export function drawBubble(ctx, x, y, size, bang, t) {
    const w = size * 1.5;
    const h = size;
    ctx.fillStyle = bang ? '#ffedd5' : '#ffffff';
    ctx.strokeStyle = bang ? '#ea580c' : '#1b2a41';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(x - w / 2, y - h, w, h, h * 0.45);
    ctx.moveTo(x - w * 0.12, y);
    ctx.lineTo(x - w * 0.28, y + h * 0.35);
    ctx.lineTo(x + w * 0.06, y);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = bang ? '#ea580c' : '#1b2a41';
    if (bang) {
        const k = 1 + 0.12 * Math.sin(t / 90);
        ctx.fillRect(x - size * 0.07 * k, y - h * 0.82, size * 0.14 * k, h * 0.42);
        ctx.beginPath();
        ctx.arc(x, y - h * 0.24, size * 0.08 * k, 0, Math.PI * 2);
        ctx.fill();
    }
    else {
        for (let i = -1; i <= 1; i++) {
            const lift = Math.max(0, Math.sin(t / 160 - i * 0.9)) * h * 0.1;
            ctx.beginPath();
            ctx.arc(x + i * w * 0.24, y - h * 0.5 - lift, size * 0.09, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}
const BADGE_BG = {
    neutral: 'rgba(17,27,46,0.88)',
    ok: 'rgba(22,163,74,0.95)',
    bad: 'rgba(220,38,38,0.95)',
    hint: 'rgba(250,204,21,0.98)',
};
/** Intent badge above a front vehicle: its turn arrow + (optionally) the keyboard key. */
export function drawBadge(ctx, x, y, r, turn, key, tone) {
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.arc(x, y + r * 0.18, r * 1.02, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = BADGE_BG[tone];
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = Math.max(1.2, r * 0.14);
    ctx.stroke();
    drawTurnGlyph(ctx, x, y, r * 0.55, turn, tone === 'hint' ? '#1b2a41' : '#ffffff');
    if (key !== null) {
        const kx = x + r * 0.95;
        const ky = y - r * 0.8;
        const kr = Math.max(6, r * 0.52);
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.roundRect(kx - kr, ky - kr, kr * 2, kr * 2, kr * 0.45);
        ctx.fill();
        ctx.strokeStyle = '#1b2a41';
        ctx.lineWidth = 1.2;
        ctx.stroke();
        ctx.fillStyle = '#1b2a41';
        ctx.font = `800 ${Math.round(kr * 1.35)}px Roboto, system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(key), kx, ky + 0.5);
    }
}
/** Rounded label (off-screen queue counts, endless lane fill). */
export function drawChip(ctx, x, y, text, bg, fg = '#ffffff', size = 12) {
    ctx.font = `800 ${size}px Roboto, system-ui, sans-serif`;
    const w = Math.max(size * 1.9, ctx.measureText(text).width + size * 1.1);
    const h = size * 1.75;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.roundRect(x - w / 2, y - h / 2 + 2, w, h, h / 2);
    ctx.fill();
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.roundRect(x - w / 2, y - h / 2, w, h, h / 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = fg;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y + 0.5);
}
//# sourceMappingURL=props.js.map