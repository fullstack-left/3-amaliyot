/**
 * Engine + Rule Validation smoke tests (no DOM, pure Node).
 * Run after building:  npm run build && node tests/engine.test.mjs
 *
 * These assert the *behaviour* the game design depends on: right-hand rule,
 * main-road priority, emergency priority, queue management, fairness, and
 * deterministic level generation. Exit code is non-zero on any failure so it
 * can gate CI.
 */
import { canVehicleMove } from '../dist/core/rules.js';
import { hydrateLevel } from '../dist/core/level.js';
import { GameEngine } from '../dist/core/engine.js';
import { generateLevel, CAMPAIGN } from '../dist/levels/levels.js';
import {
  Direction,
  SignType,
  TurnIntent,
  VehicleKind,
  IntersectionType,
} from '../dist/core/types.js';

let pass = 0,
  fail = 0;
function check(name, cond) {
  if (cond) pass++;
  else {
    fail++;
    console.log('  FAIL:', name);
  }
}

// 1) Right-hand rule: two equal, conflicting straights → exactly one yields.
{
  const st = hydrateLevel({
    id: 1, name: 't', type: IntersectionType.CROSS, lives: 3,
    approaches: [
      { direction: Direction.SOUTH, sign: SignType.NONE, queue: [{ kind: VehicleKind.CAR, intent: TurnIntent.STRAIGHT }] },
      { direction: Direction.EAST, sign: SignType.NONE, queue: [{ kind: VehicleKind.CAR, intent: TurnIntent.STRAIGHT }] },
    ],
  });
  const ids = Object.keys(st.vehicles);
  const south = ids.find((i) => st.vehicles[i].from === Direction.SOUTH);
  const east = ids.find((i) => st.vehicles[i].from === Direction.EAST);
  check('right-hand: exactly one yields', canVehicleMove(south, st).allowed !== canVehicleMove(east, st).allowed);
}

// 2) Main road beats yield.
{
  const st = hydrateLevel({
    id: 2, name: 't', type: IntersectionType.CROSS, lives: 3,
    approaches: [
      { direction: Direction.SOUTH, sign: SignType.MAIN_ROAD, queue: [{ kind: VehicleKind.CAR, intent: TurnIntent.STRAIGHT }] },
      { direction: Direction.WEST, sign: SignType.YIELD, queue: [{ kind: VehicleKind.CAR, intent: TurnIntent.STRAIGHT }] },
    ],
  });
  const ids = Object.keys(st.vehicles);
  const main = ids.find((i) => st.vehicles[i].from === Direction.SOUTH);
  const yieldV = ids.find((i) => st.vehicles[i].from === Direction.WEST);
  check('main road may go', canVehicleMove(main, st).allowed === true);
  check('yield must stop', canVehicleMove(yieldV, st).allowed === false);
}

// 3) Emergency priority.
{
  const st = hydrateLevel({
    id: 3, name: 't', type: IntersectionType.CROSS, lives: 3,
    approaches: [
      { direction: Direction.SOUTH, sign: SignType.NONE, queue: [{ kind: VehicleKind.CAR, intent: TurnIntent.STRAIGHT }] },
      { direction: Direction.WEST, sign: SignType.NONE, queue: [{ kind: VehicleKind.AMBULANCE, intent: TurnIntent.STRAIGHT }] },
    ],
  });
  const ids = Object.keys(st.vehicles);
  const car = ids.find((i) => st.vehicles[i].kind === VehicleKind.CAR);
  const amb = ids.find((i) => st.vehicles[i].kind === VehicleKind.AMBULANCE);
  check('ambulance goes', canVehicleMove(amb, st).allowed === true);
  check('car yields to ambulance', canVehicleMove(car, st).allowed === false);
}

// 4) Queue management: 2nd car blocked, promoted after 1st clears, level completes.
{
  const eng = new GameEngine({
    id: 4, name: 't', type: IntersectionType.CROSS, lives: 3,
    approaches: [
      { direction: Direction.WEST, sign: SignType.NONE, queue: [
        { kind: VehicleKind.CAR, intent: TurnIntent.RIGHT },
        { kind: VehicleKind.CAR, intent: TurnIntent.RIGHT },
      ] },
    ],
  });
  const [first, second] = eng.getVehicles();
  check('second car blocked initially', eng.preview(second.id).allowed === false);
  eng.tap(first.id);
  for (let i = 0; i < 40; i++) eng.update(50);
  check('second car promoted after first clears', eng.preview(second.id).allowed === true);
  eng.tap(second.id);
  for (let i = 0; i < 40; i++) eng.update(50);
  check('level completes after both clear', eng.status().isComplete);
}

// 5) Fairness: non-conflicting moves are both legal (two right turns).
{
  const st = hydrateLevel({
    id: 5, name: 't', type: IntersectionType.CROSS, lives: 3,
    approaches: [
      { direction: Direction.SOUTH, sign: SignType.NONE, queue: [{ kind: VehicleKind.CAR, intent: TurnIntent.RIGHT }] },
      { direction: Direction.NORTH, sign: SignType.NONE, queue: [{ kind: VehicleKind.CAR, intent: TurnIntent.RIGHT }] },
    ],
  });
  check('both right-turns allowed (no conflict)', Object.keys(st.vehicles).every((i) => canVehicleMove(i, st).allowed));
}

// 6) Campaign generation sanity + determinism.
check('campaign has 50 levels', CAMPAIGN.length === 50);
check('level 10 is boss', (CAMPAIGN[9].tags || []).includes('boss'));
check('level 40 is roundabout boss', CAMPAIGN[39].type === IntersectionType.ROUNDABOUT);
check('deterministic generation', JSON.stringify(generateLevel(15)) === JSON.stringify(generateLevel(15)));

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
