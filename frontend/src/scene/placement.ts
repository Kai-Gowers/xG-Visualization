import { GOAL_CENTRE, sbToWorld, type SB, type Vec3 } from '../domain/pitch';

export const BALL_RADIUS = 0.11;
/** Metres in front of the shooter's feet, toward goal, where the ball sits (fixed until poses land in M2). */
const BALL_AHEAD_M = 0.35;

const GOAL_WORLD = sbToWorld(GOAL_CENTRE);

/** Unit xz direction from `from` to `to`; +x (toward goal) when they coincide. */
export function directionXZ(from: Vec3, to: Vec3): Vec3 {
  const dx = to[0] - from[0];
  const dz = to[2] - from[2];
  const len = Math.hypot(dx, dz);
  return len < 1e-6 ? [1, 0, 0] : [dx / len, 0, dz / len];
}

export function ballWorld(shooter: SB): Vec3 {
  const s = sbToWorld(shooter);
  const [dx, , dz] = directionXZ(s, GOAL_WORLD);
  return [s[0] + dx * BALL_AHEAD_M, BALL_RADIUS, s[2] + dz * BALL_AHEAD_M];
}

/** Y rotation that points an object's local +z from `from` toward `to`. */
export function yawToward(from: Vec3, to: Vec3): number {
  return Math.atan2(to[0] - from[0], to[2] - from[2]);
}
