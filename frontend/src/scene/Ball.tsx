import { useEffect, useRef } from 'react';
import type { Mesh } from 'three';
import { useStore } from '../store';
import { BALL_RADIUS, ballWorld } from './placement';

/** The ball follows the shooter and the pose: on the turf for a strike, in the air for a volley or header. */
export function Ball() {
  const mesh = useRef<Mesh>(null);
  useEffect(
    () =>
      useStore.subscribe(
        (s) => s.scenario,
        ({ shooter, attrs }) => mesh.current?.position.set(...ballWorld(shooter, attrs)),
        { fireImmediately: true },
      ),
    [],
  );
  return (
    <mesh ref={mesh} castShadow>
      <sphereGeometry args={[BALL_RADIUS, 24, 16]} />
      <meshStandardMaterial color="#ffffff" roughness={0.5} />
    </mesh>
  );
}
