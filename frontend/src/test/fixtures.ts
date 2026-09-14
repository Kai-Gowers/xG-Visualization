import type { PredictRequest, PredictResponse, ShotDetail, ShotMeta } from '../api/types';

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
      gk_depth: 2,
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
      shooter_used: { x: 108, y: 40, clamped: false },
      goalkeeper_used: { x: 118, y: 40, imputed: false },
      players: [
        { kind: 'defender', index: 0, in_cone: true, distance: 6.7, goal_interval: [36, 38] },
        { kind: 'defender', index: 1, in_cone: false, distance: 7.6, goal_interval: null },
        { kind: 'goalkeeper', index: 0, in_cone: true, distance: 10, goal_interval: [38, 42] },
      ],
      goal_covered_intervals: [[36, 42]],
      goal_free_intervals: [[42, 44]],
    },
    ...overrides,
  };
}

export const SHOT_META: ShotMeta = {
  shot_id: 'shot-1',
  match_id: 4020846,
  competition_id: 53,
  season_id: 315,
  competition_name: "UEFA Women's Euro",
  season_name: '2025',
  match_date: '2025-07-27',
  home_team: 'England',
  away_team: 'Spain',
  period: 1,
  minute: 24,
  second: 11,
  team_name: 'Spain',
  player_id: 10161,
  player_name: 'Mariona Caldentey',
  x: 113.5,
  y: 38.7,
  body_part: 'Head',
  technique: 'Normal',
  shot_type: 'Open Play',
  outcome: 'Goal',
  is_goal: true,
  statsbomb_xg: 0.3957,
  xg_model: 0.232,
  xg_diff: -0.1636,
  weak_foot: false,
  play_pattern: 'Regular Play',
  end_x: 120,
  end_y: 43.7,
  end_z: 1.7,
  first_time: false,
  one_on_one: false,
  open_goal: false,
  under_pressure: false,
  aerial_won: false,
  deflected: false,
  follows_dribble: false,
  redirect: false,
  dominant_foot: 'Right',
  gk_present: true,
  has_freeze_frame: true,
  model_version: '3.0.0',
  freeze_frame: [],
};

export function shotDetail(
  scenario: PredictRequest,
  overrides: Partial<ShotDetail> = {},
): ShotDetail {
  return {
    meta: SHOT_META,
    scenario,
    prediction: predictResponse(0.232, { xg_raw: 0.232, logit: -1.197, base_value_logit: -2.17 }),
    ...overrides,
  };
}
