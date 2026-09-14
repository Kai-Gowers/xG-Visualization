/**
 * Coordinate conventions. App state is ALWAYS in StatsBomb units:
 * pitch 120 long x 80 wide, attacking toward x=120, goal centre (120,40), posts at y=36 and 44.
 * The 3D world is metric with its origin at the goal centre on the goal line, y up:
 * the shooter side is negative x, and SB y maps to world z.
 */
export type SB = { x: number; y: number };
export type Vec3 = [number, number, number];

export const PITCH = {
  length: 120,
  width: 80,
  goalX: 120,
  goalY: 40,
  posts: [36, 44] as const,
  lengthM: 105,
  widthM: 68,
  goalWidthM: 7.32,
  goalHeightM: 2.44,
  goalDepthM: 2,
} as const;

/** Metres per SB unit along the length (x) and width (y) of the pitch. */
export const X_SCALE = PITCH.lengthM / PITCH.length;
export const Z_SCALE = PITCH.widthM / PITCH.width;
/** Isotropic approximation for scalar backend features that mix both axes. */
export const UNIT_M = (X_SCALE + Z_SCALE) / 2;

export const GOAL_CENTRE: SB = { x: PITCH.goalX, y: PITCH.goalY };

export function sbToWorld(p: SB, y = 0): Vec3 {
  return [(p.x - PITCH.goalX) * X_SCALE, y, (p.y - PITCH.goalY) * Z_SCALE];
}

export function worldToSb([x, , z]: Vec3): SB {
  return { x: x / X_SCALE + PITCH.goalX, y: z / Z_SCALE + PITCH.goalY };
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function clampToPitch(p: SB): SB {
  return { x: clamp(p.x, 0, PITCH.length), y: clamp(p.y, 0, PITCH.width) };
}

/** Metric distance between two SB points. */
export function distanceM(a: SB, b: SB): number {
  return Math.hypot((a.x - b.x) * X_SCALE, (a.y - b.y) * Z_SCALE);
}

export type LinePrimitive =
  | { kind: 'rect' | 'goal'; x: number; y: number; w: number; h: number }
  | { kind: 'line'; x1: number; y1: number; x2: number; y2: number }
  | { kind: 'circle'; cx: number; cy: number; r: number }
  | { kind: 'spot'; cx: number; cy: number }
  /** Arc angles in radians, measured with y pointing down (SVG / canvas convention). */
  | { kind: 'arc'; cx: number; cy: number; r: number; start: number; end: number };

const BOX_DEPTH = 18;
const BOX_HALF_WIDTH = 22;
const SIX_DEPTH = 6;
const SIX_HALF_WIDTH = 10;
const SPOT_X = 12;
const D_RADIUS = 10;
const CENTRE_RADIUS = 10;
const CORNER_RADIUS = 1;
const GOAL_DEPTH = 2;

/** All pitch markings in SB units. Shared by the SVG minimap and the 3D pitch texture. */
export function pitchLinePaths(): LinePrimitive[] {
  const { length: L, width: W, goalY: cy } = PITCH;
  const halfGoal = (PITCH.posts[1] - PITCH.posts[0]) / 2;
  // The D is the part of the r=10 circle around the spot that lies outside the box.
  const dHalfAngle = Math.acos((BOX_DEPTH - SPOT_X) / D_RADIUS);
  return [
    { kind: 'rect', x: 0, y: 0, w: L, h: W },
    { kind: 'line', x1: L / 2, y1: 0, x2: L / 2, y2: W },
    { kind: 'circle', cx: L / 2, cy, r: CENTRE_RADIUS },
    { kind: 'spot', cx: L / 2, cy },
    { kind: 'rect', x: 0, y: cy - BOX_HALF_WIDTH, w: BOX_DEPTH, h: 2 * BOX_HALF_WIDTH },
    { kind: 'rect', x: L - BOX_DEPTH, y: cy - BOX_HALF_WIDTH, w: BOX_DEPTH, h: 2 * BOX_HALF_WIDTH },
    { kind: 'rect', x: 0, y: cy - SIX_HALF_WIDTH, w: SIX_DEPTH, h: 2 * SIX_HALF_WIDTH },
    { kind: 'rect', x: L - SIX_DEPTH, y: cy - SIX_HALF_WIDTH, w: SIX_DEPTH, h: 2 * SIX_HALF_WIDTH },
    { kind: 'spot', cx: SPOT_X, cy },
    { kind: 'spot', cx: L - SPOT_X, cy },
    { kind: 'arc', cx: SPOT_X, cy, r: D_RADIUS, start: -dHalfAngle, end: dHalfAngle },
    {
      kind: 'arc',
      cx: L - SPOT_X,
      cy,
      r: D_RADIUS,
      start: Math.PI - dHalfAngle,
      end: Math.PI + dHalfAngle,
    },
    { kind: 'arc', cx: 0, cy: 0, r: CORNER_RADIUS, start: 0, end: Math.PI / 2 },
    { kind: 'arc', cx: L, cy: 0, r: CORNER_RADIUS, start: Math.PI / 2, end: Math.PI },
    { kind: 'arc', cx: L, cy: W, r: CORNER_RADIUS, start: Math.PI, end: 1.5 * Math.PI },
    { kind: 'arc', cx: 0, cy: W, r: CORNER_RADIUS, start: 1.5 * Math.PI, end: 2 * Math.PI },
    { kind: 'goal', x: -GOAL_DEPTH, y: cy - halfGoal, w: GOAL_DEPTH, h: 2 * halfGoal },
    { kind: 'goal', x: L, y: cy - halfGoal, w: GOAL_DEPTH, h: 2 * halfGoal },
  ];
}

export type ViewBox = { x: number; y: number; w: number; h: number };
/** Minimap viewBoxes, padded so goals and edge tokens are not clipped. */
const PAD = 3;
export const MINIMAP_FULL: ViewBox = {
  x: -PAD,
  y: -PAD,
  w: PITCH.length + 2 * PAD,
  h: PITCH.width + 2 * PAD,
};
export const MINIMAP_FINAL_THIRD: ViewBox = {
  x: 60 - PAD,
  y: -PAD,
  w: 60 + 2 * PAD,
  h: PITCH.width + 2 * PAD,
};
