import { DoubleSide } from 'three';
import type { Geometry } from '../../api/types';
import { PITCH } from '../../domain/pitch';
import { goalPlaneZ } from './geometry';
import { OverlayLabel } from './OverlayLabel';
import { alpha, useEmphasis } from './useEmphasis';

const H = PITCH.goalHeightM;
/** Strips sit just in front of the goal line so they are not z-fighting the posts. */
const X = -0.03;
const BAR_W = 0.15;
const COVERED = '#e5484d';
const FREE = '#199e70';

type Props = { geometry: Geometry; openFraction: number };

/** Vertical strips in the goal plane (red covered / green free) plus a matching bar on the goal line. */
export function GoalMouthCoverage({ geometry, openFraction }: Props) {
  const e = useEmphasis('coverage');
  const segments = [
    ...geometry.goal_covered_intervals.map((iv) => ({ iv, color: COVERED, base: 0.3 })),
    ...geometry.goal_free_intervals.map((iv) => ({ iv, color: FREE, base: 0.18 })),
  ];
  return (
    <group>
      {segments.map(({ iv, color, base }, i) => {
        const z0 = goalPlaneZ(iv[0]);
        const z1 = goalPlaneZ(iv[1]);
        const w = Math.abs(z1 - z0);
        if (w < 1e-3) return null;
        const zc = (z0 + z1) / 2;
        return (
          <group key={i}>
            <mesh position={[X, H / 2, zc]} rotation-y={-Math.PI / 2}>
              <planeGeometry args={[w, H]} />
              <meshBasicMaterial
                color={color}
                transparent
                opacity={alpha(base, e)}
                depthWrite={false}
                side={DoubleSide}
              />
            </mesh>
            <mesh position={[-BAR_W / 2, 0.015, zc]}>
              <boxGeometry args={[BAR_W, 0.02, w]} />
              <meshBasicMaterial
                color={color}
                transparent
                opacity={alpha(0.9, e)}
                depthWrite={false}
              />
            </mesh>
          </group>
        );
      })}
      <OverlayLabel position={[0, H + 0.4, 0]} emphasis={e} color={FREE}>
        {Math.round(openFraction * 100)}% of goal open
      </OverlayLabel>
    </group>
  );
}
