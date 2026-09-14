import { describe, expect, it } from 'vitest';
import { PITCH } from '../../domain/pitch';
import {
  closestDefender,
  goalPlaneZ,
  outcomeColor,
  POST_Z,
  shotEndWorld,
  trajectoryPoints,
} from './geometry';

describe('goal-plane mapping', () => {
  it('maps the SB posts onto the metric goal frame', () => {
    expect(goalPlaneZ(36)).toBeCloseTo(-PITCH.goalWidthM / 2);
    expect(goalPlaneZ(44)).toBeCloseTo(PITCH.goalWidthM / 2);
    expect(goalPlaneZ(40)).toBe(0);
    expect(POST_Z[0]).toBeLessThan(POST_Z[1]);
  });
});

describe('closestDefender', () => {
  it('ignores the keeper and teammates', () => {
    expect(
      closestDefender([
        { kind: 'goalkeeper', index: 0, in_cone: true, distance: 1, goal_interval: null },
        { kind: 'defender', index: 0, in_cone: false, distance: 7, goal_interval: null },
        { kind: 'defender', index: 1, in_cone: true, distance: 3, goal_interval: null },
        { kind: 'teammate', index: 0, in_cone: false, distance: 2, goal_interval: null },
      ]),
    ).toEqual({ index: 1, distance: 3 });
    expect(closestDefender([])).toBeNull();
  });
});

describe('trajectory', () => {
  it('converts the end location to metres and clamps the height', () => {
    expect(shotEndWorld({ end_x: 120, end_y: 44, end_z: 1 })).toEqual([0, 0.9144, 3.4]);
    expect(shotEndWorld({ end_x: 120, end_y: 40, end_z: 9 })?.[1]).toBe(4);
    expect(shotEndWorld({ end_x: 120, end_y: 40, end_z: null })?.[1]).toBe(0.11);
    expect(shotEndWorld({ end_x: null, end_y: 40, end_z: 1 })).toBeNull();
  });

  it('samples a bezier that starts and ends on the given points and rises in between', () => {
    const pts = trajectoryPoints([-10, 0.11, 0], [0, 1, 2], 10);
    expect(pts).toHaveLength(11);
    expect(pts[0]).toEqual([-10, 0.11, 0]);
    expect(pts[10]).toEqual([0, 1, 2]);
    expect(pts[5][1]).toBeGreaterThan(1);
    expect(pts[5][0]).toBeCloseTo(-5);
  });

  it('colours by outcome with a neutral fallback', () => {
    expect(outcomeColor('Goal')).toBe('#199e70');
    expect(outcomeColor('Off T')).toBe('#9aa3ad');
    expect(outcomeColor(null)).toBe('#9aa3ad');
  });
});
