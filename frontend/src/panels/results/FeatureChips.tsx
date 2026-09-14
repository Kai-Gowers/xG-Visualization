import { featureLabel, formatFeatureValue } from '../../domain/features';
import { useStore } from '../../store';
import { selectIsWeakFoot } from '../../store/selectors';

const CHIPS = [
  'distance_to_goal',
  'angle_to_goal',
  'n_defenders_in_cone',
  'goal_open_fraction',
  'closest_defender_distance',
  'gk_lateral_offset_toward_shooter',
];

/** Headline features; hovering one highlights the matching overlay in the scene. */
export function FeatureChips() {
  const result = useStore((s) => s.prediction.result);
  const hovered = useStore((s) => s.ui.hoveredFeature);
  const setHoveredFeature = useStore((s) => s.setHoveredFeature);
  const weakFoot = useStore(selectIsWeakFoot);
  if (!result) return null;
  const { features: f, geometry: g } = result;
  const chip = (key: string, value: string, className = 'chip') => (
    <span
      key={key}
      className={`${className}${hovered === key ? ' is-active' : ''}`}
      onMouseEnter={() => setHoveredFeature(key)}
      onMouseLeave={() => setHoveredFeature(null)}
    >
      {featureLabel(key)} <b>{value}</b>
    </span>
  );
  return (
    <div className="chips" aria-label="Features">
      {CHIPS.map((key) =>
        chip(
          key,
          key === 'gk_lateral_offset_toward_shooter' && !g.goalkeeper_used
            ? '—'
            : formatFeatureValue(key, f[key]),
        ),
      )}
      {weakFoot && chip('weak_foot', 'Yes', 'chip chip-warn')}
    </div>
  );
}
