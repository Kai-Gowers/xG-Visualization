/**
 * Hand-written mirror of the backend contract (backend owns it).
 * `npm run api:types` regenerates src/api/schema.d.ts from /openapi.json; swap `paths` to that when committed.
 */
export const BODY_PARTS = ['Right Foot', 'Left Foot', 'Head', 'Other'] as const;
export const TECHNIQUES = [
  'Normal',
  'Volley',
  'Half Volley',
  'Lob',
  'Backheel',
  'Overhead Kick',
  'Diving Header',
] as const;
export const SHOT_TYPES = ['Open Play', 'Free Kick', 'Corner', 'Penalty'] as const;
export const PLAY_PATTERNS = [
  'Regular Play',
  'From Corner',
  'From Free Kick',
  'From Throw In',
  'From Counter',
  'Other',
] as const;
export const PREFERRED_FEET = ['Right', 'Left', 'Unknown'] as const;

export type BodyPart = (typeof BODY_PARTS)[number];
export type Technique = (typeof TECHNIQUES)[number];
export type ShotType = (typeof SHOT_TYPES)[number];
export type PlayPattern = (typeof PLAY_PATTERNS)[number];
export type PreferredFoot = (typeof PREFERRED_FEET)[number];

export type Point = { x: number; y: number };

export type PredictRequest = {
  shooter: Point;
  goalkeeper: Point | null;
  defenders: Point[];
  teammates: Point[];
  body_part: BodyPart;
  technique: Technique;
  shot_type: ShotType;
  play_pattern: PlayPattern;
  first_time: boolean;
  under_pressure: boolean;
  one_on_one: boolean;
  open_goal: boolean;
  preferred_foot: PreferredFoot;
};

export type GeometryPlayer = {
  kind: 'defender' | 'goalkeeper' | 'teammate';
  index: number;
  in_cone: boolean;
  goal_interval: number[] | null;
};

export type Geometry = {
  cone: number[][];
  shooter_used: Point;
  goalkeeper_used: (Point & { imputed: boolean }) | null;
  players: GeometryPlayer[];
  goal_covered_intervals: number[][];
  goal_free_intervals: number[][];
};

export type ExplanationItem = { feature: string; value: number | string; contribution: number };

export type PredictResponse = {
  xg: number;
  xg_raw: number;
  logit: number;
  base_value_logit: number;
  model_version: string;
  rule: 'penalty' | string | null;
  features: Record<string, number> & {
    distance_to_goal: number;
    angle_to_goal: number;
    n_defenders_in_cone: number;
    goal_open_fraction: number;
    closest_defender_distance: number;
    gk_distance_to_shooter: number;
    gk_lateral_offset_toward_shooter: number;
    weak_foot: number;
  };
  explanation: ExplanationItem[];
  geometry: Geometry;
};

export type HealthResponse = { status: string; model_version: string; library_loaded: boolean };

export type ModelInfo = { model_version: string; metrics?: Record<string, number> } & Record<
  string,
  unknown
>;

/** Minimal library shot detail, enough for `fromShotDetail`; filled out in M4. */
export type LibraryShotDetail = {
  id: string;
  scenario: PredictRequest;
  prediction: PredictResponse;
  statsbomb_xg: number | null;
  outcome: string;
  player: string;
  team: string;
  minute: number;
  end_location: number[] | null;
};

type Json<T> = { content: { 'application/json': T } };

/** openapi-fetch path map; replaced by the generated schema.d.ts once committed. */
export interface paths {
  '/predict': {
    post: {
      parameters: { query?: { explain?: boolean } };
      requestBody: Json<PredictRequest>;
      responses: { 200: Json<PredictResponse>; 422: Json<{ detail: unknown }> };
    };
  };
  '/health': { get: { responses: { 200: Json<HealthResponse> } } };
  '/model/info': { get: { responses: { 200: Json<ModelInfo> } } };
}
