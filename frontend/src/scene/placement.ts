import { GOAL_CENTRE, sbToWorld, type SB, type Vec3 } from '../domain/pitch';
import { resolveShooterPose } from '../domain/poses/manifest';
import type { ShotAttrs } from '../domain/scenario';

export const BALL_RADIUS = 0.11;
/** Where the ball sits when no pose is known: on the ground just ahead of the feet. */
const DEFAULT_BALL: readonly [number, number, number] = [0.35, BALL_RADIUS, 0];

const GOAL_WORLD = sbToWorld(GOAL_CENTRE);

/** Unit xz direction from `from` to `to`; +x (toward goal) when they coincide. */
export function directionXZ(from: Vec3, to: Vec3): Vec3 {
  const dx = to[0] - from[0];
  const dz = to[2] - from[2];
  const len = Math.hypot(dx, dz);
  return len < 1e-6 ? [1, 0, 0] : [dx / len, 0, dz / len];
}

export type ShooterFrame = { origin: Vec3; forward: Vec3; right: Vec3 };

/** The shooter's local frame: feet on the ground, facing the goal centre, right-hand side. */
export function shooterFrame(shooter: SB): ShooterFrame {
  const origin = sbToWorld(shooter);
  const forward = directionXZ(origin, GOAL_WORLD);
  return { origin, forward, right: [-forward[2], 0, forward[0]] };
}

/** World point for an offset given as [toward goal, up, to the shooter's right] metres. */
export function fromShooterFrame(
  { origin, forward, right }: ShooterFrame,
  [fwd, up, side]: readonly [number, number, number],
): Vec3 {
  return [
    origin[0] + forward[0] * fwd + right[0] * side,
    origin[1] + up,
    origin[2] + forward[2] * fwd + right[2] * side,
  ];
}

export type PoseAttrs = Pick<ShotAttrs, 'body_part' | 'technique'>;

/** Ball position; with `attrs` it follows the shooter's pose (volleys and headers lift it). */
export function ballWorld(shooter: SB, attrs?: PoseAttrs): Vec3 {
  const offset = attrs
    ? resolveShooterPose(attrs.body_part, attrs.technique).spec.ball
    : DEFAULT_BALL;
  const p = fromShooterFrame(shooterFrame(shooter), offset);
  p[1] = Math.max(p[1], BALL_RADIUS);
  return p;
}

/** Y rotation that points an object's local +z from `from` toward `to`. */
export function yawToward(from: Vec3, to: Vec3): number {
  return Math.atan2(to[0] - from[0], to[2] - from[2]);
}
