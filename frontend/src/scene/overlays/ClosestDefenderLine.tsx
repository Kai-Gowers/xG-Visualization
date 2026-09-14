import { Line } from '@react-three/drei';
import type { Geometry } from '../../api/types';
import { sbToWorld, UNIT_M, type Vec3 } from '../../domain/pitch';
import { useStore } from '../../store';
import { ballWorld } from '../placement';
import { closestDefender } from './geometry';
import { OverlayLabel } from './OverlayLabel';
import { alpha, useEmphasis } from './useEmphasis';

const Y = 0.3;

/** Dashed line from the ball to the nearest defender, labelled in metres. */
export function ClosestDefenderLine({ players }: { players: Geometry['players'] }) {
  const shooter = useStore((s) => s.scenario.shooter);
  const defenders = useStore((s) => s.scenario.defenders);
  const e = useEmphasis('closestDefender');
  const closest = closestDefender(players);
  const d = closest && defenders[closest.index];
  if (!closest || !d) return null;
  const from: Vec3 = [...ballWorld(shooter)];
  from[1] = Y;
  const to = sbToWorld(d, Y);
  // Label floats well above the line so it clears the ground-level cone label.
  const mid: Vec3 = [(from[0] + to[0]) / 2, 1.1, (from[2] + to[2]) / 2];
  return (
    <group>
      <Line
        points={[from, to]}
        color="#f8fafc"
        lineWidth={1.5}
        dashed
        dashSize={0.3}
        gapSize={0.15}
        transparent
        opacity={alpha(0.8, e)}
      />
      <OverlayLabel position={mid} emphasis={e}>
        {(closest.distance * UNIT_M).toFixed(1)} m
      </OverlayLabel>
    </group>
  );
}
