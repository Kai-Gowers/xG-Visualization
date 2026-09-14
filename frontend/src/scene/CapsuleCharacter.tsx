import { Html } from '@react-three/drei';
import { useEffect, useRef } from 'react';
import type { Group } from 'three';
import { GOAL_CENTRE, sbToWorld } from '../domain/pitch';
import { ROLE_COLORS, ROLE_LABELS } from '../domain/roles';
import { entityPosition, type EntityRef } from '../domain/scenario';
import { useStore } from '../store';
import { ballWorld, yawToward } from './placement';

const RADIUS = 0.3;
const LENGTH = 1.2;
const HEIGHT = LENGTH + 2 * RADIUS;
const GOAL_WORLD = sbToWorld(GOAL_CENTRE);

/** Placeholder body: capsule in the role colour. Position and facing are set imperatively from the store. */
export function CapsuleCharacter({ entity }: { entity: EntityRef }) {
  const group = useRef<Group>(null);
  const labels = useStore((s) => s.ui.overlays.labels);

  useEffect(
    () =>
      useStore.subscribe(
        (s) => s.scenario,
        (scenario) => {
          const pos = entityPosition(scenario, entity);
          const g = group.current;
          if (!pos || !g) return;
          const world = sbToWorld(pos);
          const target = entity.kind === 'shooter' ? GOAL_WORLD : ballWorld(scenario.shooter);
          g.position.set(...world);
          g.rotation.y = yawToward(world, target);
        },
        { fireImmediately: true },
      ),
    [entity],
  );

  return (
    <group ref={group}>
      <mesh position-y={HEIGHT / 2} castShadow>
        <capsuleGeometry args={[RADIUS, LENGTH, 4, 16]} />
        <meshStandardMaterial color={ROLE_COLORS[entity.kind]} roughness={0.7} />
      </mesh>
      {labels && (
        <Html
          position-y={HEIGHT + 0.3}
          center
          distanceFactor={10}
          style={{ pointerEvents: 'none' }}
        >
          <span className="char-label">{ROLE_LABELS[entity.kind]}</span>
        </Html>
      )}
    </group>
  );
}
