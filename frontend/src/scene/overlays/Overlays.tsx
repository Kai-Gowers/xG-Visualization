import { useStore } from '../../store';
import { ClosestDefenderLine } from './ClosestDefenderLine';
import { FootRings } from './FootRing';
import { GkOffsetMarker } from './GkOffsetMarker';
import { GoalMouthCoverage } from './GoalMouthCoverage';
import { ShotCone } from './ShotCone';
import { TrajectoryHint } from './TrajectoryHint';

/** Everything drawn from the backend's `geometry` / `features`; nothing here recomputes them. */
export function Overlays() {
  const result = useStore((s) => s.prediction.result);
  const overlays = useStore((s) => s.ui.overlays);
  if (!result) return null;
  const { geometry: g, features: f } = result;
  return (
    <>
      {overlays.cone && <ShotCone cone={g.cone} angle={f.angle_to_goal} />}
      {overlays.cone && <FootRings players={g.players} />}
      {overlays.coverage && <GoalMouthCoverage geometry={g} openFraction={f.goal_open_fraction} />}
      {overlays.closestDefender && <ClosestDefenderLine players={g.players} />}
      {overlays.gkOffset && g.goalkeeper_used && (
        <GkOffsetMarker
          goalkeeper={g.goalkeeper_used}
          lateralOffset={f.gk_lateral_offset_toward_shooter}
          depth={f.gk_depth}
        />
      )}
      {overlays.trajectory && <TrajectoryHint />}
    </>
  );
}
