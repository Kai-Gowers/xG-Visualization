import { describe, expect, it } from 'vitest';
import {
  clampToPitch,
  distanceM,
  GOAL_CENTRE,
  MINIMAP_FINAL_THIRD,
  MINIMAP_FULL,
  PITCH,
  pitchLinePaths,
  sbToWorld,
  worldToSb,
  type LinePrimitive,
} from './pitch';

describe('pitch coordinates', () => {
  it('puts the goal centre at the world origin and the far touchline at -105', () => {
    expect(sbToWorld(GOAL_CENTRE)).toEqual([0, 0, 0]);
    expect(sbToWorld({ x: 0, y: 40 })).toEqual([-105, 0, 0]);
    expect(sbToWorld({ x: 120, y: 0 })[2]).toBeCloseTo(-34);
  });

  it('round-trips SB → world → SB', () => {
    for (const p of [
      { x: 108, y: 36 },
      { x: 0, y: 0 },
      { x: 60, y: 80 },
      { x: 117.3, y: 41.9 },
    ]) {
      const back = worldToSb(sbToWorld(p, 1.5));
      expect(back.x).toBeCloseTo(p.x, 9);
      expect(back.y).toBeCloseTo(p.y, 9);
    }
  });

  it('clamps to the pitch', () => {
    expect(clampToPitch({ x: -3, y: 90 })).toEqual({ x: 0, y: 80 });
    expect(clampToPitch({ x: 130, y: -1 })).toEqual({ x: 120, y: 0 });
    expect(clampToPitch({ x: 50, y: 50 })).toEqual({ x: 50, y: 50 });
  });

  it('measures metric distance with per-axis scales', () => {
    expect(distanceM({ x: 108, y: 40 }, GOAL_CENTRE)).toBeCloseTo(12 * 0.875);
    expect(distanceM({ x: 120, y: 30 }, GOAL_CENTRE)).toBeCloseTo(10 * 0.85);
  });

  it('describes all markings once, in SB units', () => {
    const lines = pitchLinePaths();
    expect(lines).toHaveLength(18);
    expect(lines.filter((l) => l.kind === 'goal')).toHaveLength(2);
    expect(lines.filter((l) => l.kind === 'arc')).toHaveLength(6);
    expect(lines).toContainEqual({ kind: 'rect', x: 102, y: 18, w: 18, h: 44 });
    expect(lines).toContainEqual({ kind: 'spot', cx: 108, cy: 40 });
    const arcs = lines.filter(
      (l): l is Extract<LinePrimitive, { kind: 'arc' }> => l.kind === 'arc',
    );
    const dLeft = arcs.find((a) => a.r === 10)!;
    // The D starts on the front edge of the box.
    expect(dLeft.cx + dLeft.r * Math.cos(dLeft.start)).toBeCloseTo(18);
  });

  it('exposes viewBoxes that contain the whole pitch and the final third', () => {
    expect(MINIMAP_FULL.x).toBeLessThanOrEqual(0);
    expect(MINIMAP_FULL.x + MINIMAP_FULL.w).toBeGreaterThanOrEqual(PITCH.length);
    expect(MINIMAP_FINAL_THIRD.x).toBeLessThanOrEqual(60);
    expect(MINIMAP_FINAL_THIRD.x + MINIMAP_FINAL_THIRD.w).toBeGreaterThanOrEqual(PITCH.length);
  });
});
