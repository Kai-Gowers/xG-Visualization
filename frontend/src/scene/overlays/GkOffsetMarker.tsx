import { Line } from '@react-three/drei';
import type { Geometry } from '../../api/types';
import { sbToWorld, X_SCALE, Z_SCALE, type Vec3 } from '../../domain/pitch';
import { OverlayLabel } from './OverlayLabel';
import { alpha, useEmphasis } from './useEmphasis';

const Y = 0.05;
const GREEN = '#22c55e';
const HEAD = 0.18;

type Props = {
  goalkeeper: NonNullable<Geometry['goalkeeper_used']>;
  lateralOffset: number;
  depth: number;
};

/** Marker at the goal centre, arrow along the line to the keeper's z, faint line for the keeper's depth. */
export function GkOffsetMarker({ goalkeeper, lateralOffset, depth }: Props) {
  const e = useEmphasis('gkOffset');
  const gk = sbToWorld(goalkeeper, Y);
  const onLine: Vec3 = [0, Y, gk[2]];
  const shaded = Math.abs(gk[2]) > HEAD;
  const dir = Math.sign(gk[2]);
  return (
    <group>
      <mesh position={[0, 0.02, 0]} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[0.1, 0.16, 24]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={alpha(0.9, e)} depthWrite={false} />
      </mesh>
      {shaded && (
        <>
          <Line
            points={[
              [0, Y, 0],
              [0, Y, gk[2] - dir * HEAD],
            ]}
            color={GREEN}
            lineWidth={2}
            transparent
            opacity={alpha(0.9, e)}
          />
          <mesh position={[0, Y, gk[2] - dir * HEAD * 0.5]} rotation-x={(dir * Math.PI) / 2}>
            <coneGeometry args={[0.08, HEAD, 12]} />
            <meshBasicMaterial
              color={GREEN}
              transparent
              opacity={alpha(0.9, e)}
              depthWrite={false}
            />
          </mesh>
        </>
      )}
      <Line
        points={[onLine, gk]}
        color={GREEN}
        lineWidth={1}
        dashed
        dashSize={0.15}
        gapSize={0.1}
        transparent
        opacity={alpha(0.45, e)}
      />
      <OverlayLabel position={[0, 0.3, gk[2] + (dir || 1) * 1.1]} emphasis={e} color={GREEN}>
        Keeper {(Math.abs(lateralOffset) * Z_SCALE).toFixed(1)} m{' '}
        {lateralOffset >= 0 ? 'toward shooter' : 'away'} · {(depth * X_SCALE).toFixed(1)} m off line
      </OverlayLabel>
    </group>
  );
}
