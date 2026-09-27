import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { autoplay, validateLevel, loadLevel, verifyReplay } from '../dist/core/index.js';
import { CAMPAIGN, getLevel } from '../dist/content/campaign.js';
import { MODELS, MODS, PAINTS, ALL_ITEMS, STARTER_ITEMS } from '../dist/content/garage.js';
import { REASON_TEXT } from '../dist/content/rulesText.js';

test('campaign has exactly 50 levels with ids 1..50', () => {
  assert.equal(CAMPAIGN.length, 50);
  CAMPAIGN.forEach((l, i) => assert.equal(l.id, i + 1));
});

test('every level validates, has a par time and a name', () => {
  for (const def of CAMPAIGN) {
    const v = validateLevel(def);
    assert.equal(v.ok, true, `level ${def.id}: ${v.errors.join('; ')}`);
    assert.ok(def.parMs > 0, `level ${def.id} parMs`);
    assert.ok(def.name.length > 2);
  }
});

test('every level is solvable by the bot with zero penalties, and its replay verifies', () => {
  for (const def of CAMPAIGN) {
    const level = loadLevel(def);
    const r = autoplay(level);
    assert.equal(r.completed, true, `level ${def.id} not solved`);
    assert.equal(r.penalties, 0, `level ${def.id} penalties`);
    const v = verifyReplay(level, r.replay);
    assert.equal(v.ok, true, `level ${def.id} replay: ${v.error}`);
  }
});

test('design brief: bands and progression', () => {
  for (const def of CAMPAIGN) {
    const boss = def.id % 10 === 0;
    assert.equal(def.band === 'boss', boss, `level ${def.id} boss band`);
    assert.equal(!!def.controller, boss, `level ${def.id} controller only on bosses`);
    if (def.id <= 10) {
      assert.equal(def.junction, 'cross', `level ${def.id}: 1-10 only X junctions`);
      assert.ok(!def.signals, `level ${def.id}: no lights in 1-10`);
      assert.ok(def.arms.every((a) => !a.sign || a.sign === 'none'), `level ${def.id}: equal roads in 1-10`);
    }
    if (def.id >= 11 && def.id <= 19 && !boss) {
      assert.ok(def.arms.some((a) => a.sign === 'main'), `level ${def.id}: main/secondary roads`);
    }
    if (def.id >= 11 && def.id <= 29 && !boss) {
      const regulated = !!def.signals || def.arms.some((a) => a.sign && a.sign !== 'none');
      assert.ok(regulated, `level ${def.id}: 11-30 uses signs or lights`);
    }
    if (def.id >= 31 && def.id <= 39) assert.equal(def.junction, 'roundabout', `level ${def.id}: roundabouts`);
  }
  const lit = CAMPAIGN.filter((l) => l.id >= 21 && l.id <= 29 && l.signals).length;
  assert.ok(lit >= 7, `traffic lights in 21-29: ${lit}`);
  // 11-30 has queues of 2-3 vehicles in one direction
  const queued = CAMPAIGN.filter((l) => l.id > 12 && l.id <= 30).every((l) => l.arms.some((a) => a.queue.length >= 2));
  assert.ok(queued);
  // bosses get heavier
  const bossCounts = [10, 20, 30, 40, 50].map((id) => getLevel(id).spawns.length);
  assert.ok(bossCounts[4] >= bossCounts[0] * 2, `boss traffic ${bossCounts}`);
});

test('emergency vehicles appear throughout the campaign', () => {
  const withEmergency = CAMPAIGN.filter((l) =>
    l.arms.some((a) => [...a.queue, ...(a.arrivals ?? [])].some((s) => s.kind === 'ambulance' || s.kind === 'fire')),
  ).map((l) => l.id);
  assert.ok(withEmergency.includes(5));
  assert.ok(withEmergency.some((id) => id > 30));
  assert.ok(withEmergency.length >= 10, `only ${withEmergency.length}`);
});

test('garage catalog is consistent', () => {
  const ids = ALL_ITEMS.map((i) => i.id);
  assert.equal(new Set(ids).size, ids.length, 'unique item ids');
  assert.ok(MODELS.some((m) => m.name.includes('Cobalt')));
  assert.ok(MODS.some((m) => m.id === 'metan'));
  assert.ok(MODS.some((m) => m.id === 'spoiler'));
  assert.ok(MODS.some((m) => m.id === 'sport_wheels'));
  for (const id of STARTER_ITEMS) assert.ok(ids.includes(id));
  for (const m of MODELS) assert.ok(PAINTS.some((p) => p.id === m.defaultPaint), m.id);
});

/** Minimal JSON-Schema (draft-07 subset used by level.schema.json) validator. */
function schemaErrors(schema, value, root = schema, path = '$') {
  if (schema === true) return [];
  if (schema.$ref) return schemaErrors(root.definitions[schema.$ref.split('/').pop()], value, root, path);
  const errs = [];
  if (schema.enum && !schema.enum.includes(value)) errs.push(`${path}: ${JSON.stringify(value)} not in enum`);
  const t = schema.type;
  const typeOk =
    !t ||
    (t === 'object' && value && typeof value === 'object' && !Array.isArray(value)) ||
    (t === 'array' && Array.isArray(value)) ||
    (t === 'string' && typeof value === 'string') ||
    (t === 'boolean' && typeof value === 'boolean') ||
    (t === 'number' && typeof value === 'number') ||
    (t === 'integer' && Number.isInteger(value));
  if (!typeOk) return [...errs, `${path}: expected ${t}`];
  if (typeof value === 'number') {
    if (schema.minimum !== undefined && value < schema.minimum) errs.push(`${path}: < minimum`);
    if (schema.maximum !== undefined && value > schema.maximum) errs.push(`${path}: > maximum`);
    if (schema.exclusiveMinimum !== undefined && value <= schema.exclusiveMinimum) errs.push(`${path}: <= exclusiveMinimum`);
  }
  if (t === 'string' && schema.minLength && value.length < schema.minLength) errs.push(`${path}: too short`);
  if (t === 'array') {
    if (schema.minItems !== undefined && value.length < schema.minItems) errs.push(`${path}: too few items`);
    if (schema.maxItems !== undefined && value.length > schema.maxItems) errs.push(`${path}: too many items`);
    value.forEach((v, i) => errs.push(...schemaErrors(schema.items, v, root, `${path}[${i}]`)));
  }
  if (t === 'object') {
    for (const k of schema.required ?? []) if (!(k in value)) errs.push(`${path}.${k}: required`);
    for (const [k, v] of Object.entries(value)) {
      if (schema.properties?.[k] !== undefined) errs.push(...schemaErrors(schema.properties[k], v, root, `${path}.${k}`));
      else if (schema.additionalProperties === false) errs.push(`${path}.${k}: not allowed`);
    }
  }
  return errs;
}

test('levels/level.schema.json accepts all 50 shipped levels and rejects bad input', () => {
  const schema = JSON.parse(readFileSync(new URL('../levels/level.schema.json', import.meta.url), 'utf8'));
  const exported = JSON.parse(readFileSync(new URL('../levels/campaign.json', import.meta.url), 'utf8'));
  assert.equal(exported.length, 50);
  assert.deepEqual(exported, JSON.parse(JSON.stringify(CAMPAIGN)), 'campaign.json is in sync with campaign.data.ts');
  for (const l of exported) assert.deepEqual(schemaErrors(schema, l), [], `level ${l.id}`);
  const bad = { id: 0, name: '', band: 'x', junction: 'cross', arms: [{ dir: 'Q', queue: [{ kind: 'ufo', turn: 'up' }] }], extra: 1 };
  assert.ok(schemaErrors(schema, bad).length >= 6);
});

test('every rule-engine reason has a player-facing Uzbek explanation', () => {
  const reasons = [
    'not_found', 'not_front', 'not_ready', 'locked', 'controller', 'red_light',
    'crossing_traffic', 'roundabout_ring', 'emergency', 'main_road', 'right_hand', 'left_turn',
  ];
  for (const r of reasons) assert.ok(REASON_TEXT[r]?.text.length > 10, r);
});
