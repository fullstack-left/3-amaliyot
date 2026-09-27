/**
 * Shared helpers for the browser checks (e2e.mjs, perf.mjs).
 *
 *   npm i -D playwright-core && npx playwright install chromium   (once)
 *   npm run e2e      /  npm run perf
 *
 * Env: PLAYWRIGHT_CORE (module path, default "playwright-core"),
 *      CHROME_PATH (browser binary, optional), PORT (default 5173).
 */
import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const PORT = Number(process.env.PORT ?? 5173);
export const BASE = `http://localhost:${PORT}/`;

export async function startServer() {
  const child = spawn(process.execPath, [resolve(ROOT, 'scripts/serve.mjs')], {
    env: { ...process.env, PORT: String(PORT) },
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  await new Promise((ok, fail) => {
    child.stdout.on('data', (d) => String(d).includes('http://') && ok());
    child.on('exit', (code) => fail(new Error(`server exited (${code}) — is port ${PORT} free?`)));
  });
  return () => child.kill();
}

export async function launch() {
  const mod = await import(process.env.PLAYWRIGHT_CORE ?? 'playwright-core');
  const { chromium } = mod.default ?? mod;
  return chromium.launch({
    executablePath: process.env.CHROME_PATH || undefined,
    args: ['--no-sandbox', '--disable-gpu', '--autoplay-policy=no-user-gesture-required'],
  });
}

/** Screen position of a vehicle, computed by the game's own renderer (tests real hit-testing). */
export async function vehiclePoint(page, id) {
  return page.evaluate((vid) => {
    const { engine, renderer } = window.__chorraha;
    const v = engine().byId.get(vid);
    if (!v) return null;
    const p = renderer.vehiclePose(v, 0, { x: 0, y: 0, h: 0 });
    const rect = renderer.canvas.getBoundingClientRect();
    return { x: rect.left + renderer.cam.sx(p.x, p.y), y: rect.top + renderer.cam.sy(p.x, p.y, 0.3) };
  }, id);
}

export const engineState = (page) =>
  page.evaluate(() => {
    const e = window.__chorraha.engine();
    return { tick: e.tick, lives: e.lives, mistakes: e.mistakes, cleared: e.cleared, total: e.total, status: e.status };
  });
