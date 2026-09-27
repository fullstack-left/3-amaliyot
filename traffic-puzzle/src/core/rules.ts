/**
 * The Rule Validation Engine — the brain of "Chorraha Boshqaruvi".
 * ===============================================================
 *
 * `canVehicleMove(vehicleId, state)` returns a `MoveDecision` that answers:
 * "If the player taps this vehicle right now, is it legal, and if not, which
 * vehicles would it crash into and why?"
 *
 * The evaluation is a strict PRIORITY LADDER, checked in order. The first rung
 * that denies movement wins. This ordering mirrors real Uzbek/PDD traffic law:
 *
 *   0. Movability     — the vehicle must be at the front of its queue & waiting.
 *   1. Traffic light  — a red/yellow light is absolute (unless controller present).
 *   2. Controller     — a regulirovshik (boss level) overrides signs & lights.
 *   3. Emergency       — ambulances / fire trucks with a conflicting path win.
 *   4. Roundabout      — traffic already in the circle has priority.
 *   5. Main road       — MAIN beats SECONDARY on conflicting paths.
 *   6. Right-hand rule — equal roads: yield to conflicting traffic on your right.
 *
 * Crucially, a vehicle only has to yield to another vehicle whose path it would
 * actually CONFLICT with (see geometry.pathsConflict). This keeps puzzles fair
 * and solvable: clearing non-conflicting arms in any order is always legal.
 *
 * Every function here is PURE. No mutation, no I/O, no randomness. That is what
 * lets us run the identical check on a Supabase Edge Function for anti-cheat.
 */

import {
  DenyReason,
  Direction,
  EMERGENCY_KINDS,
  IntersectionState,
  IntersectionType,
  MoveDecision,
  RoadPriority,
  TrafficLightPhase,
  Vehicle,
  VehicleKind,
  VehicleState,
} from './types.js';
import { approachOnRight, pathsConflict } from './geometry.js';
import { phaseAt } from './lights.js';
import { controllerPoseAt } from './controller.js';

const ok = (): MoveDecision => ({
  allowed: true,
  conflictsWith: [],
  explanation: "Yo'l ochiq — harakatlaning.",
});

const deny = (
  reason: DenyReason,
  conflictsWith: string[],
  explanation: string,
): MoveDecision => ({ allowed: false, reason, conflictsWith, explanation });

function isEmergency(v: Vehicle): boolean {
  return EMERGENCY_KINDS.includes(v.kind);
}

/** Vehicles that are physically contesting the intersection right now. */
function contenders(state: IntersectionState, exclude: Vehicle): Vehicle[] {
  return Object.values(state.vehicles).filter(
    (v) =>
      v.id !== exclude.id &&
      (v.state === VehicleState.WAITING || v.state === VehicleState.CROSSING),
  );
}

/** Only the front-of-queue waiter on each approach can contest. */
function frontContenders(state: IntersectionState, exclude: Vehicle): Vehicle[] {
  return contenders(state, exclude).filter(
    (v) => v.state === VehicleState.CROSSING || v.queueIndex === 0,
  );
}

/**
 * MAIN entry point.
 */
export function canVehicleMove(
  vehicleId: string,
  state: IntersectionState,
): MoveDecision {
  const v = state.vehicles[vehicleId];
  if (!v) {
    return deny(DenyReason.NOT_MOVABLE, [], 'Avtomobil topilmadi.');
  }

  // --- Rung 0: movability ------------------------------------------------
  if (v.state !== VehicleState.WAITING) {
    return deny(
      DenyReason.NOT_MOVABLE,
      [],
      v.state === VehicleState.QUEUED
        ? "Bu mashina navbatda — avval oldingi mashina o'tishi kerak."
        : "Bu mashinani hozir harakatlantirib bo'lmaydi.",
    );
  }
  if (v.queueIndex !== 0) {
    return deny(
      DenyReason.NOT_AT_FRONT,
      [],
      "Navbat: avval oldindagi mashina chorrahani bo'shatsin.",
    );
  }

  const approach = state.approaches[v.from];

  // --- Rung 1: traffic light --------------------------------------------
  // A controller (rung 2) overrides lights, so only enforce lights when no
  // active controller pose governs this tick.
  const activePose = controllerPoseAt(state);
  if (!activePose && approach?.trafficLight) {
    const phase = phaseAt(approach.trafficLight, state.clockMs);
    if (phase !== TrafficLightPhase.GREEN) {
      return deny(
        DenyReason.RED_LIGHT,
        [],
        phase === TrafficLightPhase.RED
          ? 'Qizil chiroq — to‘xtang.'
          : 'Sariq chiroq — kuting.',
      );
    }
  }

  // --- Rung 2: controller (regulirovshik / boss) ------------------------
  if (activePose) {
    if (!activePose.allow.includes(v.from)) {
      return deny(
        DenyReason.CONTROLLER_FORBIDS,
        [],
        `Yo‘l harakati boshqaruvchisi bu yo‘nalishga ruxsat bermayapti (${activePose.name}).`,
      );
    }
    // Controller allows this arm; skip sign-based rungs but STILL respect
    // emergency vehicles and physical path conflicts among allowed arms.
    return resolveConflicts(state, v, /*ignoreSigns*/ true);
  }

  // --- Rungs 3-6: emergency, roundabout, main road, right-hand ----------
  return resolveConflicts(state, v, /*ignoreSigns*/ false);
}

/**
 * Given that gross gating (lights / controller gating) passed, decide whether
 * `v` must yield to any conflicting contender based on the priority ladder.
 */
function resolveConflicts(
  state: IntersectionState,
  v: Vehicle,
  ignoreSigns: boolean,
): MoveDecision {
  const others = frontContenders(state, v);

  // Keep only those whose path physically conflicts with ours.
  const conflicting = others.filter((o) =>
    pathsConflict(v.from, v.intent, o.from, o.intent),
  );
  if (conflicting.length === 0) return ok();

  const vEmergency = isEmergency(v);

  // Rung 3: EMERGENCY. If any conflicting contender is an emergency vehicle
  // and we are not, we must yield. If WE are the emergency vehicle, we win.
  if (!vEmergency) {
    const emergencies = conflicting.filter(isEmergency);
    if (emergencies.length > 0) {
      return deny(
        DenyReason.MUST_YIELD_EMERGENCY,
        emergencies.map((e) => e.id),
        'Maxsus transport (tez yordam / o‘t o‘chirish) o‘tsin — ustunlik bering.',
      );
    }
    // else: fall through — emergency contenders handled, remaining are normal.
  } else {
    // We are emergency: we only yield to *another* emergency vehicle that is
    // to our right (two ambulances still resolve by right-hand rule).
    const otherEmergencies = conflicting.filter(isEmergency);
    if (otherEmergencies.length === 0) return ok();
    return rightHandAmong(state, v, otherEmergencies);
  }

  // At this point neither `v` nor the remaining decisive contenders below are
  // emergencies (emergencies among `conflicting` already forced a yield above).
  const normalConflicting = conflicting.filter((o) => !isEmergency(o));
  if (normalConflicting.length === 0) return ok();

  // Rung 4: ROUNDABOUT. Traffic already circulating (CROSSING inside the
  // circle) has priority over anyone entering.
  if (state.type === IntersectionType.ROUNDABOUT) {
    const circulating = normalConflicting.filter(
      (o) => o.state === VehicleState.CROSSING,
    );
    if (v.state === VehicleState.WAITING && circulating.length > 0) {
      return deny(
        DenyReason.MUST_YIELD_ROUNDABOUT,
        circulating.map((o) => o.id),
        'Aylanma harakatda — halqadagi transport ustun, yo‘l bering.',
      );
    }
    // Among vehicles entering simultaneously, right-hand rule applies.
    return rightHandAmong(state, v, normalConflicting);
  }

  // Rung 5: MAIN ROAD vs SECONDARY (only meaningful when signs are active).
  if (!ignoreSigns) {
    const myPriority = state.approaches[v.from]?.priority ?? RoadPriority.EQUAL;
    if (myPriority === RoadPriority.SECONDARY) {
      const superiors = normalConflicting.filter(
        (o) =>
          (state.approaches[o.from]?.priority ?? RoadPriority.EQUAL) ===
          RoadPriority.MAIN,
      );
      if (superiors.length > 0) {
        return deny(
          DenyReason.MUST_YIELD_MAIN_ROAD,
          superiors.map((o) => o.id),
          'Asosiy yo‘ldagi transportga yo‘l bering (yo‘l bering belgisi).',
        );
      }
    }
    if (myPriority === RoadPriority.MAIN) {
      // We're on the main road; ignore SECONDARY contenders, but still resolve
      // right-hand among other MAIN-road contenders.
      const peers = normalConflicting.filter(
        (o) =>
          (state.approaches[o.from]?.priority ?? RoadPriority.EQUAL) ===
          RoadPriority.MAIN,
      );
      if (peers.length === 0) return ok();
      return rightHandAmong(state, v, peers);
    }
    // EQUAL priority → right-hand rule against all equal contenders.
    const equals = normalConflicting.filter(
      (o) =>
        (state.approaches[o.from]?.priority ?? RoadPriority.EQUAL) ===
        RoadPriority.EQUAL,
    );
    // If a conflicting car is on a MAIN road while we're EQUAL, that shouldn't
    // happen in a well-formed level, but defensively treat MAIN as superior.
    const mains = normalConflicting.filter(
      (o) =>
        (state.approaches[o.from]?.priority ?? RoadPriority.EQUAL) ===
        RoadPriority.MAIN,
    );
    if (mains.length > 0) {
      return deny(
        DenyReason.MUST_YIELD_MAIN_ROAD,
        mains.map((o) => o.id),
        'Asosiy yo‘ldagi transportga yo‘l bering.',
      );
    }
    return rightHandAmong(state, v, equals);
  }

  // Signs ignored (controller-allowed arms): resolve by right-hand rule.
  return rightHandAmong(state, v, normalConflicting);
}

/**
 * Rung 6: the right-hand rule.
 * `v` must yield to any conflicting contender that is approaching from the arm
 * immediately to v's right. If such a contender is WAITING (present), deny.
 */
function rightHandAmong(
  state: IntersectionState,
  v: Vehicle,
  conflicting: Vehicle[],
): MoveDecision {
  const rightArm: Direction = approachOnRight(v.from);
  const onMyRight = conflicting.filter((o) => o.from === rightArm);
  if (onMyRight.length > 0) {
    return deny(
      DenyReason.MUST_YIELD_RIGHT,
      onMyRight.map((o) => o.id),
      'O‘ng qo‘l qoidasi: o‘ngingizdagi transportga yo‘l bering.',
    );
  }
  return ok();
}
