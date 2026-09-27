/**
 * Level → runtime IntersectionState hydration.
 *
 * Turns a static, human-authored LevelDefinition into the live mutable-ish
 * IntersectionState the engine ticks. Also resolves each approach's
 * RoadPriority from its sign, and derives every vehicle's exit direction.
 */

import {
  ALL_DIRECTIONS,
  Approach,
  Direction,
  IntersectionState,
  LevelDefinition,
  RoadPriority,
  SignType,
  Vehicle,
  VehicleState,
} from './types.js';
import { exitDirection } from './geometry.js';

export function priorityFromSign(sign: SignType): RoadPriority {
  switch (sign) {
    case SignType.MAIN_ROAD:
      return RoadPriority.MAIN;
    case SignType.YIELD:
    case SignType.STOP:
      return RoadPriority.SECONDARY;
    default:
      return RoadPriority.EQUAL;
  }
}

let __vid = 0;
export function resetVehicleIds(): void {
  __vid = 0;
}

export function hydrateLevel(def: LevelDefinition): IntersectionState {
  const approaches = {} as Record<Direction, Approach>;

  // Default every arm to a disabled EQUAL approach, then overlay the design.
  for (const dir of ALL_DIRECTIONS) {
    approaches[dir] = {
      direction: dir,
      sign: SignType.NONE,
      priority: RoadPriority.EQUAL,
      enabled: false,
    };
  }

  const vehicles: Record<string, Vehicle> = {};

  for (const arm of def.approaches) {
    approaches[arm.direction] = {
      direction: arm.direction,
      sign: arm.sign,
      priority: priorityFromSign(arm.sign),
      enabled: arm.enabled ?? true,
      trafficLight: arm.trafficLight,
    };

    arm.queue.forEach((spec, idx) => {
      const id = `v${__vid++}`;
      vehicles[id] = {
        id,
        kind: spec.kind,
        from: arm.direction,
        intent: spec.intent,
        to: exitDirection(arm.direction, spec.intent),
        queueIndex: idx,
        state: idx === 0 ? VehicleState.WAITING : VehicleState.QUEUED,
        skinId: spec.skinId,
        progress: 0,
      };
    });
  }

  return {
    type: def.type,
    approaches,
    vehicles,
    clockMs: 0,
    controller: def.controller,
  };
}

/** All vehicles that still need to clear the intersection. */
export function remainingVehicles(state: IntersectionState): Vehicle[] {
  return Object.values(state.vehicles).filter(
    (v) => v.state !== VehicleState.CLEARED,
  );
}

export function isLevelComplete(state: IntersectionState): boolean {
  return remainingVehicles(state).length === 0;
}
