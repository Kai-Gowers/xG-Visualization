import type { Geometry } from '../../api/types';
import { sbToWorld } from '../../domain/pitch';
import { useStore } from '../../store';
import { alpha, useEmphasis } from './useEmphasis';

/** Ring under each defender: red when the backend has it inside the cone. */
export function FootRings({ players }: { players: Geometry['players'] }) {
  const defenders = useStore((s) => s.scenario.defenders);
  const e = useEmphasis('cone');
  return players.map((p) => {
    const d = p.kind === 'defender' ? defenders[p.index] : undefined;
    if (!d) return null;
    return (
      <mesh key={d.id} position={sbToWorld(d, 0.02)} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[0.36, 0.48, 32]} />
        <meshBasicMaterial
          color={p.in_cone ? '#e5484d' : '#cbd5e1'}
          transparent
          opacity={alpha(p.in_cone ? 0.9 : 0.3, e)}
          depthWrite={false}
          polygonOffset
          polygonOffsetFactor={-2}
        />
      </mesh>
    );
  });
}
