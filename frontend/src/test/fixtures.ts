import type { PredictResponse } from '../api/types';

export function predictResponse(
  xg: number,
  overrides: Partial<PredictResponse> = {},
): PredictResponse {
  return {
    xg,
    xg_raw: xg,
    logit: 0,
    base_value_logit: -2,
    model_version: 'test',
    rule: null,
    features: {
      distance_to_goal: 12,
      angle_to_goal: 0.6,
      n_defenders_in_cone: 1,
      goal_open_fraction: 0.7,
      closest_defender_distance: 4,
      gk_distance_to_shooter: 10,
      gk_lateral_offset_toward_shooter: 0,
      weak_foot: 0,
    },
    explanation: [],
    geometry: {
      cone: [
        [108, 40],
        [120, 36],
        [120, 44],
      ],
      shooter_used: { x: 108, y: 40 },
      goalkeeper_used: { x: 118, y: 40, imputed: false },
      players: [
        { kind: 'defender', index: 0, in_cone: true, goal_interval: [36, 38] },
        { kind: 'defender', index: 1, in_cone: false, goal_interval: null },
        { kind: 'goalkeeper', index: 0, in_cone: true, goal_interval: [38, 42] },
      ],
      goal_covered_intervals: [[36, 42]],
      goal_free_intervals: [[42, 44]],
    },
    ...overrides,
  };
}
