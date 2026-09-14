import { Bone, Euler, MathUtils, Object3D, Quaternion } from 'three';
import { describe, expect, it } from 'vitest';
import { ROLE_POSES, resolveShooterPose } from '../../domain/poses/manifest';
import { applyPose, collectBones } from './pose';

function fakeRig(): Object3D {
  const root = new Object3D();
  const names = [
    'Hips',
    'Neck',
    'Spine',
    'Spine1',
    'Head',
    'LeftUpLeg',
    'LeftLeg',
    'LeftFoot',
    'RightUpLeg',
    'RightLeg',
    'RightFoot',
    'LeftArm',
    'LeftForeArm',
    'RightArm',
    'RightForeArm',
  ];
  let parent: Object3D = root;
  for (const n of names) {
    const b = new Bone();
    b.name = `mixamorig:${n}`;
    // a non-identity rest rotation so the test can tell "rest" from "identity"
    b.quaternion.setFromEuler(new Euler(0.1, 0.2, 0.3));
    parent.add(b);
    parent = b;
  }
  return root;
}

describe('collectBones / applyPose', () => {
  it('strips the mixamorig prefix and captures rest rotations', () => {
    const bones = collectBones(fakeRig());
    expect(bones.has('RightLeg')).toBe(true);
    expect(
      bones.get('Spine')!.rest.equals(new Quaternion().setFromEuler(new Euler(0.1, 0.2, 0.3))),
    ).toBe(true);
  });

  it('applies deltas on top of rest and reports missing bones', () => {
    const bones = collectBones(fakeRig());
    const spec = resolveShooterPose('Right Foot', 'Normal').spec;
    const missing = applyPose(bones, spec);
    expect(missing).toEqual([]);
    const shin = bones.get('RightLeg')!;
    const expected = shin.rest
      .clone()
      .multiply(
        new Quaternion().setFromEuler(new Euler(MathUtils.degToRad(spec.bones.RightLeg[0]), 0, 0)),
      );
    expect(shin.bone.quaternion.angleTo(expected)).toBeLessThan(1e-6);
    // a bone the pose does not mention stays at rest
    expect(bones.get('Neck')!.bone.quaternion.angleTo(bones.get('Neck')!.rest)).toBeLessThan(1e-6);
  });

  it('resets bones when switching poses', () => {
    const bones = collectBones(fakeRig());
    applyPose(bones, resolveShooterPose('Right Foot', 'Volley').spec);
    applyPose(bones, ROLE_POSES.teammate);
    const thigh = bones.get('RightUpLeg')!;
    const expected = thigh.rest
      .clone()
      .multiply(
        new Quaternion().setFromEuler(
          new Euler(
            MathUtils.degToRad(ROLE_POSES.teammate.bones.RightUpLeg[0]),
            0,
            MathUtils.degToRad(ROLE_POSES.teammate.bones.RightUpLeg[2]),
          ),
        ),
      );
    expect(thigh.bone.quaternion.angleTo(expected)).toBeLessThan(1e-6);
  });

  it('flags bones the rig lacks instead of throwing', () => {
    const bones = collectBones(fakeRig());
    expect(applyPose(bones, { label: 'x', ball: [0, 0, 0], bones: { Tail: [1, 2, 3] } })).toEqual([
      'Tail',
    ]);
  });
});
