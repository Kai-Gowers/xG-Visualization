import type { Geometry, ShotMeta } from '../../api/types';
import { PITCH, sbToWorld, type Vec3 } from '../../domain/pitch';
import { BALL_RADIUS } from '../placement';

/** Metres of goal-plane z per SB unit across the goal mouth (posts 36/44 → ±3.66 m). */
const GOAL_Z_PER_UNIT = PITCH.goalWidthM / (PITCH.posts[1] - PITCH.posts[0]);
/** StatsBomb end_z is in yards. */
const YARD_M = 0.9144;
const MAX_END_HEIGHT_M = 4;

/** Map an SB y across the goal mouth onto the metric goal frame so intervals line up with the posts. */
export function goalPlaneZ(sbY: number): number {
  return (sbY - PITCH.goalY) * GOAL_Z_PER_UNIT;
}

export const POST_Z = PITCH.posts.map(goalPlaneZ) as [number, number];

/** Closest defender to the shooter according to the backend geometry; null without defenders. */
export function closestDefender(
  players: Geometry['players'],
): { index: number; distance: number } | null {
  let best: { index: number; distance: number } | null = null;
  for (const p of players) {
    if (p.kind === 'defender' && (!best || p.distance < best.distance))
      best = { index: p.index, distance: p.distance };
  }
  return best;
}

/** World end point of a library shot, or null when StatsBomb has no end location. */
export function shotEndWorld(meta: Pick<ShotMeta, 'end_x' | 'end_y' | 'end_z'>): Vec3 | null {
  if (meta.end_x == null || meta.end_y == null) return null;
  const h =
    meta.end_z == null
      ? BALL_RADIUS
      : Math.min(MAX_END_HEIGHT_M, Math.max(BALL_RADIUS, meta.end_z * YARD_M));
  return sbToWorld({ x: meta.end_x, y: meta.end_y }, h);
}

/** Quadratic bezier from `start` to `end`, lifted at the middle in proportion to its length. */
export function trajectoryPoints(start: Vec3, end: Vec3, segments = 24): Vec3[] {
  const len = Math.hypot(end[0] - start[0], end[2] - start[2]);
  const lift = Math.min(1.5, Math.max(0.2, 0.12 * len));
  const ctrl: Vec3 = [
    (start[0] + end[0]) / 2,
    Math.max(start[1], end[1]) + lift,
    (start[2] + end[2]) / 2,
  ];
  const pts: Vec3[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const a = (1 - t) * (1 - t);
    const b = 2 * (1 - t) * t;
    const c = t * t;
    pts.push([
      a * start[0] + b * ctrl[0] + c * end[0],
      a * start[1] + b * ctrl[1] + c * end[1],
      a * start[2] + b * ctrl[2] + c * end[2],
    ]);
  }
  return pts;
}

const OUTCOME_COLORS: Record<string, string> = {
  Goal: '#199e70',
  Saved: '#3987e5',
  'Saved to Post': '#3987e5',
  'Saved Off T': '#3987e5',
  Blocked: '#e5484d',
  Post: '#eb6834',
};

export function outcomeColor(outcome: string | null | undefined): string {
  return (outcome && OUTCOME_COLORS[outcome]) || '#9aa3ad';
}
