import { Html } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { MathUtils, MeshStandardMaterial, type Group, type Material, type Mesh } from 'three';
import { SkeletonUtils } from 'three/examples/jsm/Addons.js';
import { useShallow } from 'zustand/react/shallow';
import { GOAL_CENTRE, sbToWorld } from '../../domain/pitch';
import { ROLE_POSES, resolveShooterPose, type PoseSpec } from '../../domain/poses/manifest';
import { ROLE_COLORS, ROLE_LABELS } from '../../domain/roles';
import { entityPosition, type EntityKind, type EntityRef } from '../../domain/scenario';
import { useStore } from '../../store';
import { ballWorld, fromShooterFrame, shooterFrame, yawToward } from '../placement';
import { applyPose, collectBones } from './pose';
import { usePlayerModel } from './playerModel';

const GOAL_WORLD = sbToWorld(GOAL_CENTRE);
const LABEL_HEIGHT = 1.95;
/** Airborne poses move the root to body height, so the label sits just above it. */
const AIRBORNE_LABEL_HEIGHT = 0.9;
const kits = new Map<string, Material>();

/** One tinted material per role; the dark joint material of the mannequin is kept as is. */
function kitMaterial(kind: EntityKind, original: Material | Material[]): Material | Material[] {
  if (Array.isArray(original)) return original.map((m) => kitMaterial(kind, m) as Material);
  if (/joints/i.test(original.name)) return original;
  const key = `${kind}:${original.uuid}`;
  let kit = kits.get(key);
  if (!kit) {
    kit = new MeshStandardMaterial({ color: ROLE_COLORS[kind], roughness: 0.65, metalness: 0 });
    kit.name = `${original.name}-${kind}`;
    kits.set(key, kit);
  }
  return kit;
}

function poseFor(kind: EntityKind, attrs: { body_part: string; technique: string }): PoseSpec {
  if (kind === 'shooter') {
    return resolveShooterPose(
      attrs.body_part as Parameters<typeof resolveShooterPose>[0],
      attrs.technique as Parameters<typeof resolveShooterPose>[1],
    ).spec;
  }
  return ROLE_POSES[kind];
}

/** The rigged mannequin frozen in the pose for its role (and, for the shooter, the shot attributes). */
export function PosedCharacter({ entity }: { entity: EntityRef }) {
  const { scene } = usePlayerModel();
  const invalidate = useThree((s) => s.invalidate);
  const labels = useStore((s) => s.ui.overlays.labels);
  const attrs = useStore(
    useShallow((s) => ({
      body_part: s.scenario.attrs.body_part,
      technique: s.scenario.attrs.technique,
    })),
  );
  const spec = useMemo(() => poseFor(entity.kind, attrs), [entity.kind, attrs]);

  const { model, bones } = useMemo(() => {
    const clone = SkeletonUtils.clone(scene);
    clone.traverse((o) => {
      const mesh = o as Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.frustumCulled = false;
        mesh.material = kitMaterial(entity.kind, mesh.material);
      }
    });
    return { model: clone, bones: collectBones(clone) };
  }, [scene, entity.kind]);

  const outer = useRef<Group>(null);
  const tilt = useRef<Group>(null);

  useLayoutEffect(() => {
    applyPose(bones, spec);
    if (tilt.current) tilt.current.rotation.x = -MathUtils.degToRad(spec.rootTilt ?? 0);
    invalidate();
  }, [bones, spec, invalidate]);

  useEffect(
    () =>
      useStore.subscribe(
        (s) => s.scenario,
        (scenario) => {
          const pos = entityPosition(scenario, entity);
          const g = outer.current;
          if (!pos || !g) return;
          const world = sbToWorld(pos);
          if (entity.kind === 'shooter') {
            const frame = shooterFrame(pos);
            g.position.set(...(spec.root ? fromShooterFrame(frame, spec.root) : world));
            g.rotation.y = yawToward(world, GOAL_WORLD) + MathUtils.degToRad(spec.rootRotate ?? 0);
          } else {
            g.position.set(...world);
            g.rotation.y = yawToward(world, ballWorld(scenario.shooter));
          }
          invalidate();
        },
        { fireImmediately: true },
      ),
    [entity, spec, invalidate],
  );

  return (
    <group ref={outer}>
      <group ref={tilt}>
        <primitive object={model} />
      </group>
      {labels && (
        <Html
          position-y={spec.root ? AIRBORNE_LABEL_HEIGHT : LABEL_HEIGHT}
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
