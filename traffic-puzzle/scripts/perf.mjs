#!/usr/bin/env node
/**
 * Rendering stress test: 24 vehicles (6 per arm) built through the level
 * editor, measured for 6 s with the sprite cache on and off, at DPR 1 and 2.
 */
import { BASE, launch, startServer } from './_browser.mjs';

const kinds = ['car', 'bus', 'taxi', 'truck', 'car', 'car'];
const editor = {
  junction: 'cross',
  missing: 'none',
  signals: 'none',
  controller: 'none',
  name: 'Stress 24',
  arms: Object.fromEntries(['N', 'E', 'S', 'W'].map((d) => [d, { sign: 'none', queue: kinds.map((kind, i) => ({ kind, turn: i % 3 === 1 ? 'right' : 'straight' })) }])),
};

const stop = await startServer();
const browser = await launch();
try {
  for (const [spriteCache, dpr] of [[true, 1], [false, 1], [true, 2], [false, 2]]) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 760 }, deviceScaleFactor: dpr });
    await ctx.addInitScript(([ed, sc]) => {
      localStorage.setItem('chorraha.editor.v1', ed);
      localStorage.setItem('chorraha.save.v1', JSON.stringify({ version: 1, settings: { sound: false, perf: true, spriteCache: sc } }));
    }, [JSON.stringify(editor), spriteCache]);
    const page = await ctx.newPage();
    await page.goto(BASE);
    await page.click('button:has-text("Level muharriri")');
    await page.click('button:has-text("Sinab ko\'rish")');
    await page.waitForFunction(() => !!window.__chorraha);
    const r = await page.evaluate(
      () =>
        new Promise((done) => {
          const { engine, renderer } = window.__chorraha;
          const frames = [];
          let last = performance.now();
          let visible = 0;
          const t0 = last;
          const tick = (now) => {
            frames.push(now - last);
            last = now;
            visible = Math.max(visible, renderer.stats.drawn);
            const e = engine();
            for (const q of e.queues) {
              const f = q[0];
              if (f && f.state === 'waiting' && e.preview(f.id).allowed) {
                e.tap(f.id);
                break;
              }
            }
            if (now - t0 < 6000) requestAnimationFrame(tick);
            else {
              frames.sort((a, b) => a - b);
              const q = (x) => frames[Math.floor(x * (frames.length - 1))];
              done({ fps: 1000 / (frames.reduce((s, x) => s + x, 0) / frames.length), p50: q(0.5), p99: q(0.99), draw: renderer.stats.drawMs, visible, sprites: renderer.sprites.size });
            }
          };
          requestAnimationFrame(tick);
        }),
    );
    console.log(
      `cache ${spriteCache ? 'ON ' : 'OFF'} dpr ${dpr} | vehicles ${r.visible} | ${r.fps.toFixed(1)} fps | p50 ${r.p50.toFixed(1)} ms p99 ${r.p99.toFixed(1)} ms | render ${r.draw.toFixed(2)} ms | sprites ${r.sprites}`,
    );
    await ctx.close();
  }
} finally {
  await browser.close();
  stop();
}
