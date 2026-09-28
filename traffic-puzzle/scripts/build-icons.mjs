#!/usr/bin/env node
/**
 * Rasterise assets/icons/icon.svg into the PWA icon set with headless Chromium:
 *   icon-192.png, icon-512.png           (rounded, transparent corners)
 *   icon-maskable-512.png                (full-bleed, content inside the 80 % safe zone)
 *   apple-touch-icon.png (180×180)       (full-bleed; iOS rounds it itself)
 *
 *   node scripts/build-icons.mjs        (needs playwright-core, see _browser.mjs)
 *
 * The PNGs are committed; run this only when icon.svg changes.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { launch, ROOT } from './_browser.mjs';

const dir = resolve(ROOT, 'assets/icons');
const svg = readFileSync(resolve(dir, 'icon.svg'), 'utf8');
// full-bleed variant: drop the rounded clip, scale the artwork into the safe zone
const bleed = svg
  .replace('<g clip-path="url(#round)">', '<rect width="512" height="512" fill="#0b1324"/><g transform="translate(256 256) scale(0.8) translate(-256 -256)">')
  .replace('<rect width="512" height="512" fill="url(#bg)"/>', '<rect x="-64" y="-64" width="640" height="640" fill="url(#bg)"/>');

const browser = await launch();
const page = await browser.newPage();
async function render(markup, size, name) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<!doctype html><html><body style="margin:0;background:transparent">${markup.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`,
  );
  const png = await page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
  writeFileSync(resolve(dir, name), png);
  console.log(`${name}  ${size}×${size}  ${png.length} B`);
}
await render(svg, 192, 'icon-192.png');
await render(svg, 512, 'icon-512.png');
await render(bleed, 512, 'icon-maskable-512.png');
await render(bleed, 180, 'apple-touch-icon.png');
await browser.close();
