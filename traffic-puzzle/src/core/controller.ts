/**
 * Regulirovshik (traffic controller) resolver for boss levels.
 *
 * The controller cycles through a scripted list of poses. Each pose declares
 * which approaches may proceed. We resolve the active pose deterministically
 * from the engine clock so it stays in sync everywhere.
 */

import { ControllerPose, IntersectionState } from './types.js';

export function controllerPoseAt(
  state: IntersectionState,
): ControllerPose | undefined {
  const script = state.controller;
  if (!script || script.poses.length === 0) return undefined;

  const total = script.poses.reduce((s, p) => s + p.durationMs, 0);
  if (total <= 0) return script.poses[0];

  let t = script.loop ? state.clockMs % total : Math.min(state.clockMs, total - 1);
  for (const pose of script.poses) {
    if (t < pose.durationMs) return pose;
    t -= pose.durationMs;
  }
  return script.poses[script.poses.length - 1];
}
