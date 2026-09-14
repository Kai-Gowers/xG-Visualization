import { Euler, MathUtils, Quaternion, type Bone, type Object3D } from 'three';
import type { PoseSpec } from '../../domain/poses/manifest';

export type RiggedBone = { bone: Bone; rest: Quaternion };
/** Bones keyed by their `mixamorig`-less name, with the rest rotation captured at collect time. */
export type BoneMap = Map<string, RiggedBone>;

const PREFIX = /^mixamorig:?/;

export function collectBones(root: Object3D): BoneMap {
  const map: BoneMap = new Map();
  root.traverse((o) => {
    if ((o as Bone).isBone) {
      map.set(o.name.replace(PREFIX, ''), { bone: o as Bone, rest: o.quaternion.clone() });
    }
  });
  return map;
}

const euler = new Euler();
const delta = new Quaternion();

/** Reset every bone to rest, then apply the spec's local deltas. Returns bone names not found. */
export function applyPose(bones: BoneMap, spec: PoseSpec): string[] {
  const missing: string[] = [];
  for (const { bone, rest } of bones.values()) bone.quaternion.copy(rest);
  for (const [name, [x, y, z]] of Object.entries(spec.bones)) {
    const rigged = bones.get(name);
    if (!rigged) {
      missing.push(name);
      continue;
    }
    euler.set(MathUtils.degToRad(x), MathUtils.degToRad(y), MathUtils.degToRad(z), 'XYZ');
    rigged.bone.quaternion.copy(rigged.rest).multiply(delta.setFromEuler(euler));
  }
  return missing;
}
