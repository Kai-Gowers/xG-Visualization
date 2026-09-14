import { describe, expect, it } from 'vitest';
import { BODY_PARTS, TECHNIQUES } from '../../api/types';
import { mirrorPose, ROLE_POSES, resolveShooterPose } from './manifest';

const flip = (v: number) => (v === 0 ? 0 : -v);

describe('resolveShooterPose', () => {
  it('returns an exact right-footed strike and a mirrored left-footed one', () => {
    const right = resolveShooterPose('Right Foot', 'Normal');
    const left = resolveShooterPose('Left Foot', 'Normal');
    expect(right.exact && !right.mirrored).toBe(true);
    expect(left.exact && left.mirrored).toBe(true);
    expect(left.spec.bones.LeftLeg).toEqual(right.spec.bones.RightLeg);
    expect(left.spec.ball[2]).toBe(-right.spec.ball[2]);
    expect(left.spec.label).toMatch(/Left-footed/);
  });

  it('gives every body part × technique some pose, flagging fallbacks', () => {
    for (const bodyPart of BODY_PARTS) {
      for (const technique of TECHNIQUES) {
        const { spec } = resolveShooterPose(bodyPart, technique);
        expect(Object.keys(spec.bones).length).toBeGreaterThan(3);
        expect(spec.ball).toHaveLength(3);
      }
    }
    expect(resolveShooterPose('Head', 'Volley').exact).toBe(false);
    expect(resolveShooterPose('Other', 'Normal').exact).toBe(false);
    expect(resolveShooterPose('Right Foot', 'Diving Header').exact).toBe(false);
  });

  it('encodes technique in ball height and body orientation', () => {
    const ground = resolveShooterPose('Right Foot', 'Normal').spec.ball[1];
    const half = resolveShooterPose('Right Foot', 'Half Volley').spec.ball[1];
    const volley = resolveShooterPose('Right Foot', 'Volley').spec.ball[1];
    const header = resolveShooterPose('Head', 'Normal').spec.ball[1];
    expect(ground).toBeLessThan(half);
    expect(half).toBeLessThan(volley);
    expect(volley).toBeLessThan(header);
    expect(resolveShooterPose('Right Foot', 'Backheel').spec.rootRotate).toBe(180);
    expect(resolveShooterPose('Right Foot', 'Overhead Kick').spec.rootTilt).toBeGreaterThan(0);
    expect(resolveShooterPose('Head', 'Diving Header').spec.rootTilt).toBeLessThan(0);
  });
});

describe('mirrorPose', () => {
  it('is an involution', () => {
    const spec = resolveShooterPose('Right Foot', 'Overhead Kick').spec;
    const twice = mirrorPose(mirrorPose(spec));
    expect(twice.bones).toEqual(spec.bones);
    expect(twice.ball).toEqual(spec.ball);
    expect(twice.root).toEqual(spec.root);
  });

  it('keeps centre bones in place and negates their sideways components', () => {
    const spec = resolveShooterPose('Right Foot', 'Normal').spec;
    const m = mirrorPose(spec);
    expect(m.bones.Spine).toEqual([
      spec.bones.Spine[0],
      flip(spec.bones.Spine[1]),
      flip(spec.bones.Spine[2]),
    ]);
    expect(m.bones.RightArm).toEqual([
      spec.bones.LeftArm[0],
      flip(spec.bones.LeftArm[1]),
      flip(spec.bones.LeftArm[2]),
    ]);
  });
});

describe('ROLE_POSES', () => {
  it('has symmetric stances for every non-shooter role', () => {
    for (const spec of Object.values(ROLE_POSES)) {
      expect(spec.bones.LeftLeg).toEqual(spec.bones.RightLeg);
      expect(spec.bones.LeftArm[2]).toBe(flip(spec.bones.RightArm[2]));
    }
  });
});
