/** Small DOM-side celebration effects (result card). */
const CONFETTI_COLORS = ['#fbbf24', '#22c55e', '#3b82f6', '#ef4444', '#f472b6', '#ffffff', '#0099b5'];
/** Falling confetti over `host` for ~`durationMs`; cleans itself up. Returns a cancel function. */
export function launchConfetti(host, durationMs = 2600) {
    const canvas = document.createElement('canvas');
    canvas.className = 'confetti';
    host.appendChild(canvas);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(1, host.clientWidth);
    const h = Math.max(1, host.clientHeight);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    const n = Math.min(170, Math.max(60, Math.round((w * h) / 5200)));
    const pieces = [];
    for (let i = 0; i < n; i++) {
        pieces.push({
            x: Math.random() * w,
            y: -Math.random() * h * 0.6 - 10,
            vx: (Math.random() - 0.5) * 80,
            vy: 90 + Math.random() * 140,
            rot: Math.random() * Math.PI,
            vr: (Math.random() - 0.5) * 9,
            w: 5 + Math.random() * 5,
            h: 8 + Math.random() * 6,
            color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
            phase: Math.random() * Math.PI * 2,
        });
    }
    let raf = 0;
    const t0 = performance.now();
    let last = t0;
    const frame = (now) => {
        const dt = Math.min(50, now - last) / 1000;
        last = now;
        const age = now - t0;
        ctx.clearRect(0, 0, w, h);
        ctx.globalAlpha = age > durationMs ? Math.max(0, 1 - (age - durationMs) / 500) : 1;
        for (const p of pieces) {
            p.x += (p.vx + Math.sin(now / 300 + p.phase) * 30) * dt;
            p.y += p.vy * dt;
            p.rot += p.vr * dt;
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rot);
            ctx.scale(1, Math.abs(Math.cos(now / 180 + p.phase)) * 0.8 + 0.2);
            ctx.fillStyle = p.color;
            ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
            ctx.restore();
        }
        if (age < durationMs + 500)
            raf = requestAnimationFrame(frame);
        else
            canvas.remove();
    };
    raf = requestAnimationFrame(frame);
    return () => {
        cancelAnimationFrame(raf);
        canvas.remove();
    };
}
/** Animate an element's text from 0 to `to` (ease-out). */
export function countUp(el, to, ms = 900, prefix = '') {
    if (to <= 0 || ms <= 0) {
        el.textContent = `${prefix}${to}`;
        return;
    }
    const t0 = performance.now();
    const step = (now) => {
        const k = Math.min(1, (now - t0) / ms);
        const v = Math.round(to * (1 - (1 - k) ** 3));
        el.textContent = `${prefix}${v}`;
        if (k < 1 && el.isConnected)
            requestAnimationFrame(step);
    };
    el.textContent = `${prefix}0`;
    requestAnimationFrame(step);
}
/** Copy text to the clipboard (with a fallback for insecure contexts). */
export async function copyText(text) {
    try {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(text);
            return true;
        }
    }
    catch {
        /* fall through */
    }
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try {
        ok = document.execCommand('copy');
    }
    catch {
        ok = false;
    }
    ta.remove();
    return ok;
}
export function prefersReducedMotion() {
    return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}
//# sourceMappingURL=fx.js.map