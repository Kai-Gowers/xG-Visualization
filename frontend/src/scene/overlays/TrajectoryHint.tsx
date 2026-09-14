import { Line } from '@react-three/drei';
import { useStore } from '../../store';
import { BALL_RADIUS, ballWorld } from '../placement';
import { outcomeColor, shotEndWorld, trajectoryPoints } from './geometry';
import { OverlayLabel } from './OverlayLabel';
import { alpha, useEmphasis } from './useEmphasis';

/** Library shots only: dashed arc from the ball to StatsBomb's end location, coloured by outcome. */
export function TrajectoryHint() {
  const meta = useStore((s) => s.library.loadedShot?.detail.meta);
  const shooter = useStore((s) => s.scenario.shooter);
  const e = useEmphasis('trajectory');
  const end = meta && shotEndWorld(meta);
  if (!meta || !end) return null;
  const color = outcomeColor(meta.outcome);
  return (
    <group>
      <Line
        points={trajectoryPoints(ballWorld(shooter), end)}
        color={color}
        lineWidth={2}
        dashed
        dashSize={0.25}
        gapSize={0.15}
        transparent
        opacity={alpha(0.9, e)}
      />
      <mesh position={end}>
        <sphereGeometry args={[BALL_RADIUS, 16, 12]} />
        <meshStandardMaterial color="#ffffff" transparent opacity={0.45} />
      </mesh>
      <OverlayLabel position={[end[0], end[1] + 0.35, end[2]]} emphasis={e} color={color}>
        {meta.outcome ?? 'Shot'}
      </OverlayLabel>
    </group>
  );
}
