import { describe, expect, it } from 'vitest';
import { featureGroup, featureLabel, formatFeatureValue } from './features';

describe('feature labels', () => {
  it('maps backend keys to friendly names and falls back to the key', () => {
    expect(featureLabel('goal_open_fraction')).toBe('Goal mouth open');
    expect(featureLabel('gk_lateral_offset_toward_shooter')).toBe('Keeper shading');
    expect(featureLabel('some_new_feature')).toBe('some new feature');
  });

  it('formats values with units', () => {
    expect(formatFeatureValue('distance_to_goal', 12)).toBe('10.4 m');
    expect(formatFeatureValue('angle_to_goal', Math.PI / 4)).toBe('45.0°');
    expect(formatFeatureValue('goal_open_fraction', 0.514)).toBe('51%');
    expect(formatFeatureValue('gk_depth', 2)).toBe('1.8 m');
    expect(formatFeatureValue('gk_lateral_offset_toward_shooter', -2)).toBe('1.7 m away');
    expect(formatFeatureValue('gk_lateral_offset_toward_shooter', 2)).toBe('1.7 m toward');
    expect(formatFeatureValue('weak_foot', 1)).toBe('Yes');
    expect(formatFeatureValue('first_time', 0)).toBe('No');
    expect(formatFeatureValue('n_defenders_in_cone', 2)).toBe('2');
    expect(formatFeatureValue('closest_defender_in_cone_distance', 30)).toBe('none');
    expect(formatFeatureValue('body_part', 'Left Foot')).toBe('Left Foot');
    expect(formatFeatureValue('unknown_thing', 0.12345)).toBe('0.12');
  });

  it('groups features by the overlay that explains them', () => {
    expect(featureGroup('angle_to_goal')).toBe('cone');
    expect(featureGroup('n_defenders_in_cone')).toBe('cone');
    expect(featureGroup('goal_open_fraction')).toBe('coverage');
    expect(featureGroup('gk_covered_fraction')).toBe('coverage');
    expect(featureGroup('closest_defender_distance')).toBe('closestDefender');
    expect(featureGroup('n_defenders_within_3')).toBe('closestDefender');
    expect(featureGroup('gk_depth')).toBe('gkOffset');
    expect(featureGroup('body_part')).toBeNull();
    expect(featureGroup(null)).toBeNull();
  });
});
