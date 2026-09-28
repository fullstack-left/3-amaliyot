/**
 * Render geometry checks (pure — no DOM): the static city never covers a
 * vehicle standing behind it, trees near traffic are depth-sorted props,
 * the content-fit camera, and the ambience colour grade.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { CAMPAIGN, getLevel } from '../dist/content/campaign.js';
import { ENDLESS_VARIANTS, endlessLevel, ENDLESS_LIMITS } from '../dist/content/endless.js';
import { DIRS, DIR_LETTERS, DIR_VEC, dirFromLetter, exitOf } from '../dist/core/dir.js';
import { getJunction } from '../dist/core/junction.js';
import { loadLevel } from '../dist/core/level.js';
import { VEHICLE_SPECS } from '../dist/core/vehicles.js';
import { Camera } from '../dist/web/render/camera.js';
import { g, setGrade, shade, withGrade } from '../dist/web/render/color.js';
import { sceneInfo, staticBoxes } from '../dist/web/render/scene.js';
import { isIconName } from '../dist/web/icons.js';
import { ACHIEVEMENTS } from '../dist/content/achievements.js';
import { DAILY_THEMES } from '../dist/content/daily.js';
import { ENDLESS_INFO } from '../dist/content/endless.js';

const MAX_L = Math.max(...Object.values(VEHICLE_SPECS).map((s) => s.length));
const MAX_W = Math.max(...Object.values(VEHICLE_SPECS).map((s) => s.width));

/** Every ground point a vehicle body can cover on this layout (lanes + junction paths). */
function vehiclePoints(layout) {
  const pts = [];
  const armPt = (d, u, l) => {
    const [dx, dy] = DIR_VEC[d];
    return [dx * u - dy * l, dy * u + dx * l];
  };
  for (const d of DIRS) {
    if (!layout.armEnabled[d]) continue;
    for (let u = layout.stopU - 0.3; u <= 20; u += 0.2) {
      for (let l = -0.5 - MAX_W / 2; l <= 0.5 + MAX_W / 2 + 1e-9; l += 0.1) pts.push(armPt(d, u, l));
    }
  }
  const junction = getJunction(layout.geometry);
  junction.paths.forEach((path, m) => {
    const from = Math.floor(m / 3);
    if (!layout.armEnabled[from]) return;
    const end = path.sample(path.length);
    const to = DIRS.find((d) => {
      const [dx, dy] = DIR_VEC[d];
      return dx * end.x + dy * end.y > 3;
    });
    if (to !== undefined && !layout.armEnabled[to]) return;
    for (let s = 0; s <= path.length; s += 0.15) {
      const p = path.sample(s);
      const q = path.sample(Math.min(path.length, s + 0.05));
      let tx = q.x - p.x;
      let ty = q.y - p.y;
      const n = Math.hypot(tx, ty) || 1;
      tx /= n;
      ty /= n;
      for (const a of [-MAX_L / 2, 0, MAX_L / 2]) {
        for (const b of [-MAX_W / 2, 0, MAX_W / 2]) pts.push([p.x + tx * a - ty * b, p.y + ty * a + tx * b]);
      }
    }
  });
  return pts;
}

/**
 * With the 2:1 camera a box (footprint, height h) covers a vehicle ground point
 * V from the front iff the ray V + (k, k), 0 < k ≤ 0.95·h, enters the footprint.
 */
function covers(box, [xv, yv]) {
  const lo = Math.max(box.x0 - xv, box.y0 - yv, 1e-6);
  const hi = Math.min(box.x1 - xv, box.y1 - yv, 0.95 * box.h);
  return lo < hi - 1e-6;
}

function layouts() {
  const seen = new Map();
  for (const def of CAMPAIGN) {
    const l = getLevel(def.id).layout;
    const key = `${l.geometry}|${l.armEnabled.join('')}`;
    if (!seen.has(key)) seen.set(key, { key, layout: l, id: def.id });
  }
  for (const v of ENDLESS_VARIANTS) {
    const l = loadLevel(endlessLevel(v), ENDLESS_LIMITS).layout;
    const key = `${l.geometry}|${l.armEnabled.join('')}`;
    if (!seen.has(key)) seen.set(key, { key, layout: l, id: v });
  }
  // everything the level editor can produce: T junctions and 3-arm roundabouts with any arm missing
  for (const junction of ['t', 'roundabout']) {
    for (const missing of ['N', 'E', 'S', 'W']) {
      const present = ['N', 'E', 'S', 'W'].filter((d) => d !== missing);
      const arms = present.map((dir) => {
        const turn = ['straight', 'left', 'right'].find((t) => present.includes(DIR_LETTERS[exitOf(dirFromLetter(dir), t)]));
        return { dir, queue: [{ kind: 'car', turn }] };
      });
      const l = loadLevel({ id: 900, name: 'synthetic', band: 'base', junction, arms }).layout;
      const key = `${l.geometry}|${l.armEnabled.join('')}`;
      if (!seen.has(key)) seen.set(key, { key, layout: l, id: `${junction}-${missing}` });
    }
  }
  return [...seen.values()];
}

test('static city never covers a vehicle standing behind it (every layout in the game)', () => {
  const all = layouts();
  assert.ok(all.length >= 11, `expected cross, controller, 4 T variants and 5 roundabouts, got ${all.map((a) => a.key)}`);
  for (const { key, layout } of all) {
    const pts = vehiclePoints(layout);
    for (const box of staticBoxes(layout)) {
      const bad = pts.find((p) => covers(box, p));
      assert.equal(bad, undefined, `${key}: "${box.name}" covers a vehicle at ${bad?.map((v) => v.toFixed(2))}`);
    }
  }
});

test('trees: every tree is either depth-sorted (near traffic) or provably static', () => {
  for (const { key, layout } of layouts()) {
    const info = sceneInfo(layout);
    assert.ok(info.trees.length + info.staticTrees.length > 15, key);
    const pts = vehiclePoints(layout);
    for (const t of info.staticTrees) {
      const r = (t.kind === 'poplar' ? 0.34 : 0.55) * t.size;
      const box = { x0: t.x - r, y0: t.y - r, x1: t.x + r, y1: t.y + r, h: (t.kind === 'poplar' ? 2.65 : 1.62) * t.size };
      assert.equal(pts.find((p) => covers(box, p)), undefined, `${key}: static tree ${t.x},${t.y} overlaps traffic`);
    }
    assert.equal(info.lamps.length, 2 * layout.armEnabled.filter(Boolean).length, `${key}: two lamps per arm`);
    assert.equal(info.monument, layout.type === 'roundabout');
  }
});

test('camera: content fit uses the arm extent (≥ 30 px/unit on a 390×844 phone)', () => {
  const cam = new Camera();
  // cross: stopU 1.75 + 2 queue slots × 1.6 + 1.0 margin
  cam.fit(390, 844, 2, 1.75 + 2 * 1.6 + 1.0, 140, 16);
  assert.ok(cam.scale >= 30, `scale ${cam.scale}`);
  // the far end of every arm stays inside the viewport
  for (const [x, y] of [[5.95, 0], [-5.95, 0], [0, 5.95], [0, -5.95]]) {
    const sx = cam.sx(x, y);
    assert.ok(sx >= 0 && sx <= 390, `arm end ${x},${y} → ${sx}`);
  }
  // wide desktop: capped by height, never absurdly large
  cam.fit(2560, 700, 1, 6.6, 64, 16);
  assert.ok(cam.scale <= 72 && cam.scale > 30);
  // unproject ∘ project = identity on the ground
  const [wx, wy] = cam.unproject(cam.sx(1.3, -2.2), cam.sy(1.3, -2.2));
  assert.ok(Math.abs(wx - 1.3) < 1e-9 && Math.abs(wy + 2.2) < 1e-9);
});

test('ambience grade: identity by day, hex stays hex, rgba keeps alpha, grades are isolated', () => {
  setGrade('day');
  assert.equal(g('#eef2f6'), '#eef2f6');
  const night = withGrade('night', () => [g('#eef2f6'), g('rgba(255,255,255,0.55)'), g('rgb(10,20,30)')]);
  assert.match(night[0], /^#[0-9a-f]{6}$/);
  assert.notEqual(night[0], '#eef2f6');
  assert.match(night[1], /^rgba\(\d+,\d+,\d+,0\.55\)$/);
  assert.match(night[2], /^rgb\(\d+,\d+,\d+\)$/);
  // night is darker than day for a white car
  const lum = (hex) => parseInt(hex.slice(1, 3), 16) + parseInt(hex.slice(3, 5), 16) + parseInt(hex.slice(5, 7), 16);
  assert.ok(lum(night[0]) < lum('#eef2f6') * 0.6);
  // shade() accepts graded colours; the grade is restored after withGrade
  assert.match(withGrade('rain', () => shade(g('#d62828'), 0.8)), /^rgb\(/);
  assert.equal(g('#123456'), '#123456');
});

test('every icon referenced by content exists in the SVG icon set', () => {
  const names = [...ACHIEVEMENTS.map((a) => a.icon), ...DAILY_THEMES.map((t) => t.icon), ...Object.values(ENDLESS_INFO).map((i) => i.icon)];
  for (const n of names) assert.ok(isIconName(n), `missing icon "${n}"`);
});
