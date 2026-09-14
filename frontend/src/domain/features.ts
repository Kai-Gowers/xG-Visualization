import { UNIT_M, X_SCALE, Z_SCALE } from './pitch';

/** Which overlay a feature explains; drives the hover ↔ overlay link. */
export type OverlayGroup = 'cone' | 'coverage' | 'closestDefender' | 'gkOffset' | 'trajectory';

type Format = (v: number) => string;

type FeatureSpec = { label: string; format?: Format; group?: OverlayGroup };

const m =
  (scale: number): Format =>
  (v) =>
    `${(v * scale).toFixed(1)} m`;
const pct: Format = (v) => `${Math.round(v * 100)}%`;
const deg: Format = (v) => `${((v * 180) / Math.PI).toFixed(1)}°`;
const int: Format = (v) => `${Math.round(v)}`;
const yesNo: Format = (v) => (v >= 0.5 ? 'Yes' : 'No');

const SPECS: Record<string, FeatureSpec> = {
  distance_to_goal: { label: 'Distance to goal', format: m(UNIT_M) },
  angle_to_goal: { label: 'Angle to goal', format: deg, group: 'cone' },
  abs_lateral_offset: { label: 'Off-centre', format: m(Z_SCALE) },
  shooter_x: {
    label: 'Depth from goal line',
    format: (v) => `${((120 - v) * X_SCALE).toFixed(1)} m`,
  },
  n_defenders_in_cone: { label: 'Defenders in cone', format: int, group: 'cone' },
  n_defenders_within_3: { label: 'Defenders within 3 m', format: int, group: 'closestDefender' },
  closest_defender_distance: {
    label: 'Closest defender',
    format: m(UNIT_M),
    group: 'closestDefender',
  },
  closest_defender_in_cone_distance: {
    label: 'Closest in cone',
    format: (v) => (v >= 30 ? 'none' : m(UNIT_M)(v)),
    group: 'closestDefender',
  },
  defenders_covered_fraction: { label: 'Blocked by defenders', format: pct, group: 'cone' },
  n_teammates_in_cone: { label: 'Teammates in cone', format: int },
  gk_present: { label: 'Keeper present', format: yesNo, group: 'gkOffset' },
  gk_distance_to_shooter: { label: 'Keeper distance', format: m(UNIT_M), group: 'gkOffset' },
  gk_depth: { label: 'Keeper off line', format: m(X_SCALE), group: 'gkOffset' },
  gk_lateral_offset_toward_shooter: {
    label: 'Keeper shading',
    format: (v) => `${(Math.abs(v) * Z_SCALE).toFixed(1)} m ${v >= 0 ? 'toward' : 'away'}`,
    group: 'gkOffset',
  },
  gk_in_cone: { label: 'Keeper in cone', format: yesNo, group: 'gkOffset' },
  gk_covered_fraction: { label: 'Blocked by keeper', format: pct, group: 'coverage' },
  goal_open_fraction: { label: 'Goal mouth open', format: pct, group: 'coverage' },
  body_part: { label: 'Body part' },
  technique: { label: 'Technique' },
  shot_type: { label: 'Shot type' },
  play_pattern: { label: 'Phase of play' },
  first_time: { label: 'First time', format: yesNo },
  under_pressure: { label: 'Under pressure', format: yesNo },
  one_on_one: { label: 'One on one', format: yesNo },
  open_goal: { label: 'Open goal', format: yesNo },
  weak_foot: { label: 'Weak foot', format: yesNo },
  preferred_foot_known: { label: 'Foot known', format: yesNo },
};

/** Friendly name for a backend feature key (falls back to a de-snaked key). */
export function featureLabel(feature: string): string {
  return SPECS[feature]?.label ?? feature.replace(/_/g, ' ');
}

/** Human-readable value with units; category strings pass through. */
export function formatFeatureValue(feature: string, value: number | string): string {
  if (typeof value === 'string') return value;
  const format = SPECS[feature]?.format;
  return format ? format(value) : Number.isInteger(value) ? String(value) : value.toFixed(2);
}

export function featureGroup(feature: string | null): OverlayGroup | null {
  return (feature && SPECS[feature]?.group) || null;
}
