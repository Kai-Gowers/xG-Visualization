import { useEffect, useRef } from 'react';
import type { Mesh } from 'three';
import { useStore } from '../store';
import { BALL_RADIUS, ballWorld } from './placement';

export function Ball() {
  const mesh = useRef<Mesh>(null);
  useEffect(
    () =>
      useStore.subscribe(
        (s) => s.scenario.shooter,
        (shooter) => mesh.current?.position.set(...ballWorld(shooter)),
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
