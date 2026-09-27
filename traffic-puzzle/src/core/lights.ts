/**
 * Deterministic traffic-light phase resolver.
 *
 * Given a light's cycle definition and the current clock, returns the active
 * phase. Pure & deterministic so client and server agree bit-for-bit.
 */

import { TrafficLight, TrafficLightPhase } from './types.js';

export function phaseAt(light: TrafficLight, clockMs: number): TrafficLightPhase {
  const total = light.cycle.reduce((s, p) => s + p.durationMs, 0);
  if (total <= 0) return TrafficLightPhase.GREEN;

  let t = (clockMs + light.offsetMs) % total;
  for (const step of light.cycle) {
    if (t < step.durationMs) return step.phase;
    t -= step.durationMs;
  }
  // Numerical edge — fall back to last phase.
  return light.cycle[light.cycle.length - 1].phase;
}
