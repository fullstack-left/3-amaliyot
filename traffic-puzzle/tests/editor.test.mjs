/** Level editor model: lossless round-trip of every campaign level, v1 draft migration, import parsing. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { CAMPAIGN } from '../dist/content/campaign.js';
import { autoplay } from '../dist/core/bot.js';
import { loadLevel, validateLevel } from '../dist/core/level.js';
import { defaultState, fromDef, migrateDraft, parseImport, toDef } from '../dist/web/editor-model.js';
import { canonicalLevel, encodeLevel } from '../dist/web/share.js';

const canon = (def) => JSON.stringify(canonicalLevel({ ...def, id: 999 }));

test('editor: every campaign level round-trips fromDef → toDef without changes', () => {
  const modes = {};
  for (const def of CAMPAIGN) {
    const state = fromDef(def);
    const back = toDef(state);
    assert.equal(canon(back), canon(def), `level ${def.id} changed in the editor round-trip`);
    assert.ok(validateLevel(back).ok, `level ${def.id} invalid after round-trip`);
    const key = def.controller ? `controller:${state.controller}` : def.signals ? `signals:${state.signals}` : 'plain';
    modes[key] = (modes[key] ?? 0) + 1;
  }
  // the campaign exercises presets, standard and imported signal plans
  assert.ok(Object.keys(modes).some((k) => k.startsWith('controller:boss')), JSON.stringify(modes));
  assert.ok(Object.keys(modes).some((k) => k.startsWith('signals:')), JSON.stringify(modes));
});

test('editor: default level is valid and solvable; custom controller poses are validated', () => {
  const s = defaultState();
  const def = toDef(s);
  assert.ok(validateLevel(def).ok);
  assert.ok(autoplay(loadLevel(def)).completed);

  // a hand-made controller script that never lets the N→left car go is rejected by the validator
  const c = defaultState();
  c.controller = 'custom';
  c.poses = [{ gesture: 'arm_up', facing: 'N', ms: 2000 }];
  const v = validateLevel(toDef(c));
  assert.equal(v.ok, false);
  assert.ok(v.errors.some((e) => e.includes('boshqaruvchi hech qachon')), v.errors.join('\n'));

  // arrivals + signal timing + ambience + lives survive toDef/fromDef
  const t = defaultState();
  t.arms.W.arrivals.push({ kind: 'ambulance', turn: 'straight', atMs: 4000 });
  t.signals = 'two';
  t.amberMs = 1500;
  t.flashing = [{ fromMs: 12000, toMs: 18000 }];
  t.ambience = 'night';
  t.lives = 5;
  const d2 = toDef(t);
  assert.ok(validateLevel(d2).ok, validateLevel(d2).errors.join('; '));
  assert.equal(d2.signals.amberMs, 1500);
  assert.deepEqual(d2.signals.flashing, [{ fromMs: 12000, toMs: 18000 }]);
  assert.equal(d2.ambience, 'night');
  assert.equal(d2.lives, 5);
  assert.equal(canon(toDef(fromDef(d2))), canon(d2));
});

test('editor: drafts saved by the v1 editor migrate to v2', () => {
  const v1 = {
    junction: 't',
    missing: 'W',
    arms: { N: { sign: 'main', queue: [{ kind: 'car', turn: 'straight' }] }, E: { sign: 'yield', queue: [{ kind: 'bus', turn: 'right' }] }, S: { sign: 'main', queue: [] }, W: { sign: 'none', queue: [] } },
    signals: 'flash',
    controller: 'none',
    name: 'Eski qoralama',
  };
  const s = migrateDraft(v1);
  assert.equal(s.v, 2);
  assert.deepEqual(s.arms.E.arrivals, []);
  const def = toDef(s);
  assert.ok(validateLevel(def).ok, validateLevel(def).errors.join('; '));
  assert.equal(def.signals.flashing[0].toMs, 600000);
  // garbage never throws
  for (const bad of [null, 42, 'x', {}, { arms: 1, junction: 'cross' }]) assert.equal(migrateDraft(bad).v, 2);
});

test('editor: import accepts JSON, an L1 code and a full share link', () => {
  const def = CAMPAIGN.find((l) => l.id === 21);
  const code = encodeLevel(def);
  for (const text of [JSON.stringify(def), code, `https://example.org/game/#/custom/${code}`, `  ${code}\n`]) {
    const r = parseImport(text);
    assert.ok(r.ok, `${text.slice(0, 30)}: ${r.error}`);
    assert.equal(canon(r.def), canon(def));
  }
  for (const text of ['', '{', '{"id":1}', 'L1.!!!', 'hello']) assert.equal(parseImport(text).ok, false, text);
});
