import { distanceM, GOAL_CENTRE, UNIT_M, Z_SCALE } from '../../domain/pitch';
import { useStore } from '../../store';
import { selectIsWeakFoot } from '../../store/selectors';

const deg = (rad: number) => (rad * 180) / Math.PI;

export function FeatureChips() {
  const result = useStore((s) => s.prediction.result);
  const weakFoot = useStore(selectIsWeakFoot);
  if (!result) return null;
  const { features: f, geometry: g } = result;
  const chips: [string, string][] = [
    ['Distance', `${distanceM(g.shooter_used, GOAL_CENTRE).toFixed(1)} m`],
    ['Angle', `${deg(f.angle_to_goal).toFixed(0)}°`],
    ['In cone', `${f.n_defenders_in_cone}`],
    ['Goal open', `${(f.goal_open_fraction * 100).toFixed(0)}%`],
    ['Closest def.', `≈${(f.closest_defender_distance * UNIT_M).toFixed(1)} m`],
    [
      'GK offset',
      g.goalkeeper_used ? `${(f.gk_lateral_offset_toward_shooter * Z_SCALE).toFixed(1)} m` : '—',
    ],
  ];
  return (
    <div className="chips" aria-label="Features">
      {chips.map(([label, value]) => (
        <span key={label} className="chip">
          {label} <b>{value}</b>
        </span>
      ))}
      {weakFoot && <span className="chip chip-warn">Weak foot</span>}
    </div>
  );
}
