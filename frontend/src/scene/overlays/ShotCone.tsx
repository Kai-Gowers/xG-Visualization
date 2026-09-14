import { Line } from '@react-three/drei';
import { useEffect, useMemo } from 'react';
import { BufferGeometry, DoubleSide, Vector3 } from 'three';
import type { Geometry } from '../../api/types';
import { sbToWorld, type Vec3 } from '../../domain/pitch';
import { POST_Z } from './geometry';
import { OverlayLabel } from './OverlayLabel';
import { alpha, useEmphasis } from './useEmphasis';

const Y = 0.01;
const AMBER = '#f5b400';

/** Translucent triangle on the grass from the ball's ground point to both posts. */
export function ShotCone({ cone, angle }: { cone: Geometry['cone']; angle: number }) {
  const e = useEmphasis('cone');
  const apex = sbToWorld({ x: cone[0][0], y: cone[0][1] }, Y);
  const points: Vec3[] = [apex, [0, Y, POST_Z[0]], [0, Y, POST_Z[1]]];
  const geometry = useMemo(
    () => new BufferGeometry().setFromPoints(points.map((p) => new Vector3(...p))),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- rebuilt when the apex moves
    [apex[0], apex[2]],
  );
  useEffect(() => () => geometry.dispose(), [geometry]);
  // Halfway to the goal, pushed toward the nearer post: the centreline is hidden behind the shooter.
  const side = apex[2] <= 0 ? -1 : 1;
  const labelAt: Vec3 = [
    apex[0] / 2,
    0.15,
    apex[2] / 2 + side * Math.min(1.5, Math.abs(apex[0]) * 0.15),
  ];
  return (
    <group>
      <mesh geometry={geometry}>
        <meshBasicMaterial
          color={AMBER}
          transparent
          opacity={alpha(0.22, e)}
          depthWrite={false}
          side={DoubleSide}
          polygonOffset
          polygonOffsetFactor={-2}
        />
      </mesh>
      <Line
        points={[...points, apex]}
        color={AMBER}
        lineWidth={1.5}
        transparent
        opacity={alpha(0.7, e)}
      />
      <OverlayLabel position={labelAt} emphasis={e} color={AMBER}>
        {((angle * 180) / Math.PI).toFixed(1)}° to goal
      </OverlayLabel>
    </group>
  );
}
