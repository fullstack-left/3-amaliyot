/**
 * Frame composer.
 *
 * Per frame:
 *   1. blit the cached static scene (city + ambience, rebuilt only on resize/level)
 *   2. ground overlays: headlight cones (additive), intent paths, rings, why-lines
 *   3. depth-sorted drawables (vehicles + props) — painter's algorithm on x + y
 *   4. particles, rain
 *   5. screen overlays: intent badges, impatience bubbles, coach hand, lane chips,
 *      controller assist, popups, perf
 *
 * Positions are interpolated between simulation ticks (alpha ∈ [0,1)): crossing
 * vehicles analytically from the kinematic profile, lane vehicles by speed.
 * Ambience is a colour grade applied at draw time (see color.ts) — no
 * full-screen compositing pass per frame.
 */
import { DIRS, inLane } from '../../core/dir.js';
import { LOCK_TICKS } from '../../core/engine.js';
import { distAt, TICK_HZ } from '../../core/kinematics.js';
import { Camera } from './camera.js';
import { g, LIGHT_LEVEL, PALETTE, setGrade } from './color.js';
import { drawLight, Effects, GlowCache, HeadlightCache } from './effects.js';
import { LOOK_BODY_Z, lookFor, redLook } from './looks.js';
import { drawBadge, drawBubble, drawChip, drawController, drawControllerAssist, drawHand, drawMonument, drawSign, drawStreetLamp, drawTrafficLight, drawTree, treeCanopy, } from './props.js';
import { renderScene, sceneInfo } from './scene.js';
import { drawFlag, drawIndicators, drawLightBar, drawNeon, drawVehicleVector, pointInPolygon, Pose, SpriteCache, vehicleHull, } from './vehicles.js';
export const DEFAULT_RENDER_SETTINGS = {
    spriteCache: true,
    assist: true,
    controllerArrows: false,
    perf: false,
    effects: true,
    keyHints: false,
};
/** Arm → keyboard key (N=1, E=2, S=3, W=4). */
export const KEY_OF_DIR = [1, 2, 3, 4];
const BADGE_WAIT_DOTS_S = 8;
const BADGE_WAIT_BANG_S = 14;
export class Renderer {
    canvas;
    cam = new Camera();
    sprites = new SpriteCache(360);
    fx = new Effects();
    settings = { ...DEFAULT_RENDER_SETTINGS };
    hoverId = null;
    hintId = null;
    /** Tutorial step target (coach hand). */
    coachId = null;
    why = null;
    focusIds = [];
    focusUntil = 0;
    padTop = 0;
    padBottom = 0;
    stats = { fps: 60, frameMs: 16.7, drawMs: 0, drawn: 0 };
    ctx;
    bg = document.createElement('canvas');
    bgCtx;
    cones = new HeadlightCache();
    glows = new GlowCache();
    engine = null;
    lookCtx = null;
    looks = new Map();
    pool = [];
    list = [];
    popups = [];
    pose;
    hull = Array.from({ length: 8 }, () => ({ x: 0, y: 0 }));
    vp = { x: 0, y: 0, h: 0 };
    q = { x: 0, y: 0 };
    shakeOff = { x: 0, y: 0 };
    laneEdge = [null, null, null, null];
    laneFlash = [0, 0, 0, 0];
    amb = 'day';
    light = 0;
    sceneDirty = true;
    lastFrame = 0;
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d', { alpha: false });
        this.bgCtx = this.bg.getContext('2d', { alpha: false });
        this.pose = new Pose(this.cam);
    }
    get ambience() {
        return this.amb;
    }
    setEngine(engine, lookCtx) {
        this.engine = engine;
        this.lookCtx = lookCtx;
        this.looks.clear();
        this.popups.length = 0;
        this.hoverId = this.hintId = this.coachId = null;
        this.why = null;
        this.focusIds = [];
        this.laneFlash.fill(0);
        this.fx.clear();
        this.amb = engine?.level.ambience ?? 'day';
        this.light = LIGHT_LEVEL[this.amb];
        this.sceneDirty = true;
        this.resize();
    }
    /** How far along the arms the view must reach for this level (world units). */
    contentExtent(w, h) {
        const e = this.engine;
        if (!e)
            return 6;
        const portrait = w < h;
        const round = e.layout.type === 'roundabout';
        const initial = [0, 0, 0, 0];
        const arrivals = [false, false, false, false];
        for (const sp of e.level.spawns) {
            if (sp.initial)
                initial[sp.from]++;
            else
                arrivals[sp.from] = true;
        }
        let slots = 1;
        for (const d of DIRS)
            if (e.layout.armEnabled[d])
                slots = Math.max(slots, initial[d] + (arrivals[d] ? 1 : 0));
        slots = Math.min(slots, portrait ? 2 : 4);
        const E = e.layout.stopU + slots * 1.6 + 1.0;
        const [lo, hi] = portrait ? (round ? [6.6, 7.8] : [5.4, 6.6]) : round ? [8, 10.5] : [6.6, 10];
        return Math.max(lo, Math.min(hi, E));
    }
    resize() {
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const w = Math.max(1, this.canvas.clientWidth);
        const h = Math.max(1, this.canvas.clientHeight);
        if (this.canvas.width !== Math.round(w * dpr) || this.canvas.height !== Math.round(h * dpr)) {
            this.canvas.width = Math.round(w * dpr);
            this.canvas.height = Math.round(h * dpr);
        }
        this.cam.fit(w, h, dpr, this.contentExtent(w, h), this.padTop, this.padBottom);
        this.sprites.configure(this.cam.scale, dpr);
        this.cones.configure(this.cam.scale, dpr);
        this.glows.configure(dpr);
        this.bg.width = this.canvas.width;
        this.bg.height = this.canvas.height;
        this.sceneDirty = true;
        this.computeLaneEdges();
    }
    /** For each arm: the farthest point of the incoming lane that is still on screen. */
    computeLaneEdges() {
        const e = this.engine;
        this.laneEdge.fill(null);
        if (!e)
            return;
        const cam = this.cam;
        const m = 26;
        for (const d of DIRS) {
            if (!e.layout.armEnabled[d])
                continue;
            let last = null;
            for (let u = e.layout.stopU; u < 26; u += 0.2) {
                const [x, y] = inLane(d, u);
                const sx = cam.sx(x, y);
                const sy = cam.sy(x, y, 0.4);
                if (sx < m || sx > cam.width - m || sy < this.padTop + m || sy > cam.height - this.padBottom - m)
                    break;
                last = { u, x: sx, y: sy };
            }
            if (last && last.u < 25.5)
                this.laneEdge[d] = last;
        }
    }
    look(v) {
        let l = this.looks.get(v.id);
        if (!l) {
            l = lookFor(v, this.lookCtx ?? { levelId: 0, ownedModels: [], hero: { model: 'matiz', paint: 'sariq', mods: [] } });
            this.looks.set(v.id, l);
        }
        return l;
    }
    /** Centre + heading of a vehicle at the interpolated time. */
    vehiclePose(v, alpha, out = this.vp) {
        const e = this.engine;
        const L = v.length;
        let fx;
        let fy;
        let rx;
        let ry;
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
            }
            else {
                [rx, ry] = inLane(v.from, e.layout.stopU - rs);
            }
        }
        else {
            let u = Math.max(e.layout.stopU, v.u - (v.speed * alpha) / TICK_HZ);
            // penalty "lurch": the offender jolts forward and back
            if (v.lockUntil > e.tick) {
                const t = (e.tick + alpha - (v.lockUntil - LOCK_TICKS)) / TICK_HZ;
                if (t < 0.4)
                    u -= 0.3 * Math.sin((Math.PI * t) / 0.4);
            }
            [fx, fy] = inLane(v.from, u);
            [rx, ry] = inLane(v.from, u + L);
        }
        out.x = (fx + rx) / 2;
        out.y = (fy + ry) / 2;
        out.h = Math.atan2(fy - ry, fx - rx);
        return out;
    }
    /** Screen point above a vehicle's roof (for badges, the coach hand, tooltips). */
    vehicleScreen(id, lift = 0.55) {
        const e = this.engine;
        const v = e?.byId.get(id);
        if (!e || !v || v.state === 'hidden' || v.state === 'gone')
            return null;
        const p = this.vehiclePose(v, 0, { x: 0, y: 0, h: 0 });
        return { x: this.cam.sx(p.x, p.y), y: this.cam.sy(p.x, p.y, this.look(v).topZ + lift) };
    }
    popupAt(id, text, color) {
        const e = this.engine;
        const v = e?.byId.get(id);
        if (!e || !v)
            return;
        const p = this.vehiclePose(v, 0, { x: 0, y: 0, h: 0 });
        this.popups.push({ x: this.cam.sx(p.x, p.y), y: this.cam.sy(p.x, p.y, 1), text, color, t0: performance.now() });
    }
    popupScreen(x, y, text, color) {
        this.popups.push({ x, y, text, color, t0: performance.now() });
    }
    /** Engine events → cosmetic effects (exhaust, sparks, shake). */
    onEvent(ev, now = performance.now()) {
        const e = this.engine;
        if (!e)
            return;
        this.fx.enabled = this.settings.effects;
        switch (ev.type) {
            case 'depart': {
                const v = e.byId.get(ev.id);
                if (!v)
                    return;
                const p = this.vehiclePose(v, 0, { x: 0, y: 0, h: 0 });
                const L = v.length / 2;
                this.fx.puff(p.x - Math.cos(p.h) * L, p.y - Math.sin(p.h) * L, p.h, now);
                break;
            }
            case 'cleared': {
                const v = e.byId.get(ev.id);
                if (!v)
                    return;
                const p = this.vehiclePose(v, 0, { x: 0, y: 0, h: 0 });
                this.fx.sparks(p.x, p.y, now, v.hero ? 26 : 12);
                break;
            }
            case 'penalty':
                this.fx.shake(7, now);
                break;
            case 'gridlock':
                this.fx.shake(14, now);
                this.laneFlash[ev.dir] = now;
                break;
            case 'won':
                for (let i = 0; i < 4; i++)
                    this.fx.sparks(Math.cos(i * 1.57) * 1.2, Math.sin(i * 1.57) * 1.2, now + i * 120, 16);
                break;
            default:
                break;
        }
    }
    /** Tap → vehicle id (front-most hit, with a finger-friendly fallback radius). */
    pick(px, py) {
        const e = this.engine;
        if (!e)
            return null;
        let best = null;
        let bestDepth = -Infinity;
        let near = null;
        let nearD = Math.max(22, this.cam.scale * 0.7) ** 2;
        for (const v of e.vehicles) {
            if (v.state !== 'waiting' && v.state !== 'approaching' && v.state !== 'queued')
                continue;
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
    drawable(kind, depth) {
        const d = this.pool[this.list.length] ??
            (this.pool[this.list.length] = { depth: 0, kind: 'tree', v: null, d: 0, x: 0, y: 0, size: 1, tree: 'round', lamp: null, sx: 0, sy: 0 });
        d.kind = kind;
        d.depth = depth;
        d.v = null;
        d.lamp = null;
        this.list.push(d);
        return d;
    }
    render(alpha, nowMs) {
        const t0 = performance.now();
        const dt = this.lastFrame ? t0 - this.lastFrame : 16.7;
        this.lastFrame = t0;
        this.stats.frameMs = this.stats.frameMs * 0.9 + dt * 0.1;
        this.stats.fps = 1000 / Math.max(1, this.stats.frameMs);
        const ctx = this.ctx;
        const e = this.engine;
        const cam = this.cam;
        const dpr = cam.dpr;
        setGrade(this.amb);
        this.fx.enabled = this.settings.effects;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        if (!e) {
            ctx.fillStyle = g(PALETTE.grass);
            ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            setGrade('day');
            return;
        }
        if (this.sceneDirty) {
            this.bgCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
            renderScene(this.bgCtx, cam, e.layout, { ambience: this.amb, seed: e.level.id });
            this.sceneDirty = false;
        }
        this.fx.shakeOffset(t0, this.shakeOff);
        const ox = this.shakeOff.x;
        const oy = this.shakeOff.y;
        if (ox || oy) {
            ctx.fillStyle = g(PALETTE.grass);
            ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }
        ctx.drawImage(this.bg, Math.round(ox * dpr), Math.round(oy * dpr));
        ctx.setTransform(dpr, 0, 0, dpr, ox * dpr, oy * dpr);
        this.drawGroundOverlays(ctx, alpha, nowMs);
        // ---- build + sort drawables -------------------------------------------
        this.list.length = 0;
        for (const v of e.vehicles) {
            if (v.state === 'hidden' || v.state === 'gone')
                continue;
            const p = this.vehiclePose(v, alpha);
            const d = this.drawable('vehicle', p.x + p.y);
            d.v = v;
            d.sx = cam.sx(p.x, p.y);
            d.sy = cam.sy(p.x, p.y, 0.35);
        }
        const layout = e.layout;
        for (const dir of DIRS) {
            if (!layout.armEnabled[dir])
                continue;
            if (layout.sign[dir] !== 'none' || layout.type === 'roundabout') {
                const [x, y] = inLane(dir, layout.stopU + 0.45);
                this.drawable('sign', x + y + 1.2).d = dir;
            }
            if (layout.signals) {
                const [x, y] = inLane(dir, layout.stopU);
                this.drawable('light', x + y + 1.3).d = dir;
            }
        }
        const info = sceneInfo(layout);
        for (const t of info.trees) {
            const d = this.drawable('tree', t.x + t.y);
            d.x = t.x;
            d.y = t.y;
            d.size = t.size;
            d.tree = t.kind;
        }
        for (const l of info.lamps)
            this.drawable('lamp', l.x + l.y).lamp = l;
        if (info.monument)
            this.drawable('monument', 0);
        if (layout.controller)
            this.drawable('controller', 0);
        this.list.sort((a, b) => a.depth - b.depth);
        const pose = e.pose();
        let drawn = 0;
        for (const d of this.list) {
            switch (d.kind) {
                case 'vehicle':
                    this.drawVehicle(ctx, d.v, alpha, nowMs);
                    drawn++;
                    break;
                case 'sign':
                    drawSign(ctx, cam, d.d, layout.sign[d.d], layout.stopU, layout.type === 'roundabout');
                    break;
                case 'light': {
                    const a = e.aspect(d.d);
                    if (a)
                        drawTrafficLight(ctx, cam, d.d, layout.stopU, a, e.aspectCountdown(d.d), nowMs);
                    break;
                }
                case 'tree':
                    drawTree(ctx, cam, d.x, d.y, d.size, d.tree, this.treeFade(d));
                    break;
                case 'lamp':
                    drawStreetLamp(ctx, cam, d.lamp, this.light, this.glows);
                    break;
                case 'monument':
                    drawMonument(ctx, cam, this.light);
                    break;
                case 'controller':
                    if (pose)
                        drawController(ctx, cam, pose.pose.gesture, pose.pose.facing, this.light > 0);
                    break;
            }
        }
        this.fx.drawParticles(ctx, cam, nowMs);
        if (this.amb === 'rain')
            this.fx.drawRain(ctx, cam.width, cam.height, nowMs, this.padTop);
        // ---- screen overlays (never graded) --------------------------------------
        setGrade('day');
        if (pose && this.settings.controllerArrows)
            drawControllerAssist(ctx, cam, pose, layout.armEnabled, layout.stopU);
        this.drawWhyLinks(ctx, alpha, nowMs);
        this.drawBadges(ctx, alpha, nowMs);
        this.drawLaneChips(ctx, nowMs);
        this.drawCoach(ctx, nowMs);
        this.drawPopups(ctx);
        this.stats.drawn = drawn;
        this.stats.drawMs = this.stats.drawMs * 0.9 + (performance.now() - t0) * 0.1;
        if (this.settings.perf)
            this.drawPerf(ctx, e);
    }
    /** Trees in front of a waiting/queued car become see-through. */
    treeFade(t) {
        const c = treeCanopy(this.cam, t.x, t.y, t.size, t.tree);
        const r2 = (c.r * 1.1) ** 2;
        for (const d of this.list) {
            if (d.kind !== 'vehicle' || d.depth >= t.depth)
                continue;
            const st = d.v.state;
            if (st !== 'waiting' && st !== 'approaching' && st !== 'queued')
                continue;
            if ((d.sx - c.x) ** 2 + (d.sy - c.y) ** 2 < r2)
                return 0.42;
        }
        return 1;
    }
    drawVehicle(ctx, v, alpha, nowMs) {
        const e = this.engine;
        const cam = this.cam;
        const p = this.vehiclePose(v, alpha);
        this.pose.set(p.x, p.y, p.h);
        const base = this.look(v);
        let look = base;
        const sx = cam.sx(p.x, p.y);
        const sy = cam.sy(p.x, p.y);
        if (v.emergency && (this.light > 0 || v.state === 'crossing')) {
            // siren wash on the ground
            const blue = Math.floor(nowMs / 160) % 2 === 0;
            drawLight(ctx, this.glows.get(blue ? '47,123,255' : '255,45,45', cam.scale * 1.3), sx, sy, 0.22 + 0.25 * this.light);
        }
        if (look.mods.includes('neon'))
            drawNeon(ctx, this.pose, look, nowMs);
        const flashing = v.flashUntil > e.tick && Math.floor(nowMs / 140) % 2 === 0;
        if (flashing)
            look = redLook(look);
        if (this.settings.spriteCache) {
            const sp = this.sprites.get(look, p.h);
            ctx.drawImage(sp.canvas, sx - sp.ax, sy - sp.ay, sp.w, sp.h);
        }
        else {
            drawVehicleVector(ctx, this.pose, look);
        }
        drawLightBar(ctx, this.pose, base, nowMs, v.emergency);
        if (v.turn !== 'straight' && v.state !== 'exiting')
            drawIndicators(ctx, this.pose, base, v.turn, nowMs);
        if (base.mods.includes('bayroq'))
            drawFlag(ctx, this.pose, base, nowMs);
        if (this.light > 0)
            this.drawCarLights(ctx, v, base, p.h);
    }
    /** Tail/brake glow (rear visible) and headlamp glints (front visible). */
    drawCarLights(ctx, v, l, h) {
        const c = Math.cos(h);
        const s = Math.sin(h);
        const hl = l.length / 2;
        const hw = l.width / 2;
        const z = LOOK_BODY_Z + Math.min(l.bodyH, 0.3) - 0.06;
        const q = this.q;
        const scale = this.cam.scale;
        if (-c - s > 0.05) {
            const braking = v.state === 'waiting' || ((v.state === 'queued' || v.state === 'approaching') && v.speed < 1.2);
            const sp = this.glows.get('255,40,40', scale * (braking ? 0.3 : 0.18));
            for (const r of [-hw + 0.1, hw - 0.1]) {
                this.pose.p(-hl - 0.02, r, z, q);
                drawLight(ctx, sp, q.x, q.y, (braking ? 0.95 : 0.6) * this.light);
            }
        }
        if (c + s > 0.05) {
            const sp = this.glows.get('255,244,214', scale * 0.2);
            for (const r of [-hw + 0.1, hw - 0.1]) {
                this.pose.p(hl + 0.02, r, z, q);
                drawLight(ctx, sp, q.x, q.y, 0.8 * this.light);
            }
        }
    }
    ring(ctx, v, alpha, color, width) {
        const p = this.vehiclePose(v, alpha);
        const r = (v.length / 2 + 0.25) * this.cam.scale;
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.beginPath();
        ctx.ellipse(this.cam.sx(p.x, p.y), this.cam.sy(p.x, p.y), r * 1.2, r * 0.6, 0, 0, Math.PI * 2);
        ctx.stroke();
    }
    drawGroundOverlays(ctx, alpha, nowMs) {
        const e = this.engine;
        const cam = this.cam;
        // headlight cones (additive, under the vehicles). A queued car's beam lies
        // under the car ahead of it, so only front cars and moving cars get one —
        // this keeps the additive fill-rate low on software-rasterised canvases.
        if (this.light > 0) {
            for (const v of e.vehicles) {
                if (v.state === 'hidden' || v.state === 'gone' || v.state === 'queued')
                    continue;
                const p = this.vehiclePose(v, alpha);
                const L = v.length / 2;
                const fx = p.x + Math.cos(p.h) * L;
                const fy = p.y + Math.sin(p.h) * L;
                drawLight(ctx, this.cones.get(p.h), cam.sx(fx, fy), cam.sy(fx, fy), 0.9 * this.light);
            }
        }
        // intent paths of the front vehicles
        for (const q of e.queues) {
            const v = q[0];
            if (!v || (v.state !== 'waiting' && v.state !== 'approaching'))
                continue;
            const path = e.junction.paths[v.move];
            const end = path.mark('exit') + 0.5;
            const hovered = v.id === this.hoverId || v.id === this.why?.id;
            const hinted = v.id === this.hintId;
            let color = 'rgba(255,255,255,0.32)';
            let width = Math.max(2, cam.scale * 0.1);
            if (hinted) {
                color = `rgba(34,197,94,${(0.55 + 0.35 * Math.sin(nowMs / 150)).toFixed(3)})`;
                width *= 1.6;
            }
            else if (hovered) {
                color = 'rgba(255,209,102,0.9)';
                if (this.settings.assist)
                    color = e.preview(v.id).allowed ? 'rgba(34,197,94,0.9)' : 'rgba(239,68,68,0.9)';
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
                if (s === 0)
                    ctx.moveTo(x, y);
                else
                    ctx.lineTo(x, y);
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
            if (v && v.state !== 'hidden' && v.state !== 'gone')
                this.ring(ctx, v, alpha, 'rgba(255,255,255,0.8)', 2);
        }
        if (this.hintId) {
            const v = e.byId.get(this.hintId);
            if (v && (v.state === 'waiting' || v.state === 'approaching')) {
                this.ring(ctx, v, alpha, `rgba(34,197,94,${(0.6 + 0.4 * Math.sin(nowMs / 120)).toFixed(3)})`, 3);
            }
        }
        if (this.coachId) {
            const v = e.byId.get(this.coachId);
            if (v && (v.state === 'waiting' || v.state === 'approaching' || v.state === 'queued')) {
                this.ring(ctx, v, alpha, `rgba(255,255,255,${(0.55 + 0.4 * Math.sin(nowMs / 140)).toFixed(3)})`, 3);
            }
        }
        if (this.why) {
            for (const id of this.why.culprits) {
                const v = e.byId.get(id);
                if (v && v.state !== 'hidden' && v.state !== 'gone') {
                    this.ring(ctx, v, alpha, `rgba(250,204,21,${(0.65 + 0.35 * Math.sin(nowMs / 110)).toFixed(3)})`, 3);
                }
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
    /** Dashed links from the "why" vehicle to every vehicle it must yield to. */
    drawWhyLinks(ctx, alpha, nowMs) {
        const e = this.engine;
        const w = this.why;
        if (!w || !w.culprits.length)
            return;
        const v = e.byId.get(w.id);
        if (!v || v.state === 'hidden' || v.state === 'gone')
            return;
        const cam = this.cam;
        const a = this.vehiclePose(v, alpha, { x: 0, y: 0, h: 0 });
        const ax = cam.sx(a.x, a.y);
        const ay = cam.sy(a.x, a.y, 0.45);
        ctx.save();
        ctx.setLineDash([7, 6]);
        ctx.lineDashOffset = -nowMs / 40;
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        for (const id of w.culprits) {
            const o = e.byId.get(id);
            if (!o || o.state === 'hidden' || o.state === 'gone')
                continue;
            const b = this.vehiclePose(o, alpha, { x: 0, y: 0, h: 0 });
            const bx = cam.sx(b.x, b.y);
            const by = cam.sy(b.x, b.y, 0.45);
            ctx.strokeStyle = 'rgba(0,0,0,0.35)';
            ctx.beginPath();
            ctx.moveTo(ax, ay + 1.5);
            ctx.lineTo(bx, by + 1.5);
            ctx.stroke();
            ctx.strokeStyle = '#facc15';
            ctx.beginPath();
            ctx.moveTo(ax, ay);
            ctx.lineTo(bx, by);
            ctx.stroke();
        }
        ctx.restore();
    }
    drawBadges(ctx, alpha, nowMs) {
        const e = this.engine;
        const cam = this.cam;
        const r = Math.max(9, Math.min(15, cam.scale * 0.27));
        for (const q of e.queues) {
            const v = q[0];
            if (!v || (v.state !== 'waiting' && v.state !== 'approaching'))
                continue;
            const p = this.vehiclePose(v, alpha, { x: 0, y: 0, h: 0 });
            const look = this.look(v);
            const x = cam.sx(p.x, p.y);
            const y = cam.sy(p.x, p.y, look.topZ + 0.55);
            let tone = 'neutral';
            if (v.id === this.hintId)
                tone = 'hint';
            else if ((v.id === this.hoverId || v.id === this.why?.id) && this.settings.assist)
                tone = e.preview(v.id).allowed ? 'ok' : 'bad';
            drawBadge(ctx, x, y, r, v.turn, this.settings.keyHints ? KEY_OF_DIR[v.from] : null, tone);
            if (v.state === 'waiting' && v.waitSince >= 0 && e.status === 'playing') {
                const secs = (e.tick - v.waitSince) / TICK_HZ;
                if (secs >= BADGE_WAIT_DOTS_S)
                    drawBubble(ctx, x - r * 1.9, y - r * 0.2, r * 1.15, secs >= BADGE_WAIT_BANG_S, nowMs);
            }
        }
    }
    /** "+N" for queued cars beyond the screen edge; lane fill meter in endless mode. */
    drawLaneChips(ctx, nowMs) {
        const e = this.engine;
        const endless = Number.isFinite(e.overflowAt);
        for (const d of DIRS) {
            const edge = this.laneEdge[d];
            const q = e.queues[d];
            if (endless) {
                const n = q.length;
                const cap = e.overflowAt;
                const at = edge ?? this.stopLinePoint(d);
                if (!at)
                    continue;
                const danger = n >= cap - 1;
                const flash = nowMs - this.laneFlash[d] < 1200;
                const pulse = danger ? 0.75 + 0.25 * Math.sin(nowMs / 120) : 1;
                const bg = flash || n > cap ? '#dc2626' : danger ? `rgba(220,38,38,${pulse.toFixed(3)})` : n >= cap - 3 ? '#d97706' : 'rgba(17,27,46,0.85)';
                drawChip(ctx, at.x, at.y - 18, `${Math.min(n, cap)}/${cap}`, bg, '#ffffff', 12);
                continue;
            }
            if (!edge)
                continue;
            let hidden = 0;
            let siren = false;
            for (const v of q) {
                if (v.u + v.length * 0.5 > edge.u) {
                    hidden++;
                    if (v.emergency)
                        siren = true;
                }
            }
            if (!hidden)
                continue;
            const bg = siren ? (Math.floor(nowMs / 250) % 2 ? '#dc2626' : '#2563eb') : 'rgba(17,27,46,0.85)';
            drawChip(ctx, edge.x, edge.y - 16, `+${hidden}`, bg, '#ffffff', 12);
        }
    }
    stopLinePoint(d) {
        const e = this.engine;
        if (!e.layout.armEnabled[d])
            return null;
        const [x, y] = inLane(d, e.layout.stopU + 2.2);
        return { x: this.cam.sx(x, y), y: this.cam.sy(x, y, 0.4) };
    }
    drawCoach(ctx, nowMs) {
        if (!this.coachId)
            return;
        const pt = this.vehicleScreen(this.coachId, 0.55);
        if (!pt)
            return;
        const size = Math.max(30, Math.min(46, this.cam.scale * 0.9));
        drawHand(ctx, pt.x + 2, pt.y - Math.max(9, Math.min(15, this.cam.scale * 0.27)) - 4, size, nowMs);
    }
    drawPopups(ctx) {
        const now = performance.now();
        for (let i = this.popups.length - 1; i >= 0; i--) {
            const p = this.popups[i];
            const t = (now - p.t0) / 1100;
            if (t >= 1) {
                this.popups.splice(i, 1);
                continue;
            }
            ctx.globalAlpha = 1 - t * t;
            ctx.font = `800 ${Math.round(Math.max(13, this.cam.scale * 0.42))}px Roboto, system-ui, sans-serif`;
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
    drawPerf(ctx, e) {
        const s = this.stats;
        const hitRate = this.sprites.hits + this.sprites.misses > 0 ? (100 * this.sprites.hits) / (this.sprites.hits + this.sprites.misses) : 100;
        const lines = [
            `FPS ${s.fps.toFixed(0)}  kadr ${s.frameMs.toFixed(1)} ms  chizish ${s.drawMs.toFixed(2)} ms`,
            `mashinalar ${s.drawn}/${e.vehicles.length}  spraytlar ${this.sprites.size} (hit ${hitRate.toFixed(1)}%)  kesh ${this.settings.spriteCache ? 'ON' : 'OFF'}`,
            `tick ${e.tick}  rejim ${e.mode()}  muhit ${this.amb}  zarralar ${this.fx.count}  masshtab ${this.cam.scale.toFixed(1)}`,
        ];
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(8, this.padTop + 8, 360, 18 * lines.length + 8);
        ctx.fillStyle = '#b9f6ca';
        ctx.font = '12px ui-monospace, monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        lines.forEach((l, i) => ctx.fillText(l, 14, this.padTop + 13 + i * 18));
    }
}
//# sourceMappingURL=renderer.js.map