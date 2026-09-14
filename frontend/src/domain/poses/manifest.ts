/**
 * Frozen poses for the rigged character, authored as local bone rotations on top of the
 * Mixamo rest pose (degrees, XYZ Euler, `mixamorig` bone names without the prefix).
 *
 * Axis facts for this rig (see tools/assets/README.md): +X on a thigh swings the leg back,
 * +X on a shin bends the knee, +X on the spine leans forward, +X on an arm swings it forward,
 * +Z lowers the right arm from the T-pose (−Z lowers the left). Right-footed poses are
 * authored; left-footed ones are mirrored at runtime with {@link mirrorPose}.
 */
import type { BodyPart, Technique } from '../../api/types';

export type Deg3 = readonly [number, number, number];

export type PoseSpec = {
  /** Local rotation deltas per bone, degrees XYZ. */
  bones: Readonly<Record<string, Deg3>>;
  /** Ball offset from the shooter's feet in metres: [toward goal, up, to the shooter's right]. */
  ball: readonly [number, number, number];
  /** World offset of the whole body (airborne poses). */
  root?: readonly [number, number, number];
  /** Extra yaw in degrees (180 = facing away from goal, e.g. a backheel). */
  rootRotate?: number;
  /** Pitch about the left–right axis in degrees; positive tips the head back (overhead kick). */
  rootTilt?: number;
  label: string;
};

export type PoseKey = `${BodyPart}:${Technique}`;

const STRIKE: PoseSpec = {
  label: 'Right-footed strike',
  ball: [0.32, 0.11, 0.16],
  bones: {
    Hips: [0, -15, 0],
    Spine: [12, 10, 0],
    Spine1: [6, 5, 0],
    Head: [18, 10, 0],
    LeftUpLeg: [-18, 0, 4],
    LeftLeg: [22, 0, 0],
    LeftFoot: [-8, 0, 0],
    RightUpLeg: [22, 0, -6],
    RightLeg: [72, 0, 0],
    RightFoot: [25, 0, 0],
    LeftArm: [35, 0, -45],
    LeftForeArm: [0, 0, -25],
    RightArm: [-40, 0, 55],
    RightForeArm: [0, 0, 20],
  },
};

const VOLLEY: PoseSpec = {
  label: 'Right-footed volley',
  ball: [0.45, 0.75, 0.18],
  bones: {
    Hips: [0, -10, 0],
    Spine: [-14, 8, 0],
    Spine1: [-6, 0, 0],
    Head: [22, 8, 0],
    LeftUpLeg: [5, 0, 4],
    LeftLeg: [18, 0, 0],
    RightUpLeg: [-70, 0, -8],
    RightLeg: [45, 0, 0],
    RightFoot: [15, 0, 0],
    LeftArm: [10, 0, -20],
    LeftForeArm: [0, 0, -30],
    RightArm: [-25, 0, 20],
    RightForeArm: [0, 0, 30],
  },
};

const HALF_VOLLEY: PoseSpec = {
  label: 'Right-footed half volley',
  ball: [0.4, 0.28, 0.16],
  bones: {
    Hips: [0, -12, 0],
    Spine: [2, 8, 0],
    Head: [22, 8, 0],
    LeftUpLeg: [-10, 0, 4],
    LeftLeg: [24, 0, 0],
    RightUpLeg: [-30, 0, -6],
    RightLeg: [70, 0, 0],
    RightFoot: [20, 0, 0],
    LeftArm: [25, 0, -40],
    LeftForeArm: [0, 0, -25],
    RightArm: [-35, 0, 50],
    RightForeArm: [0, 0, 20],
  },
};

const LOB: PoseSpec = {
  label: 'Right-footed lob',
  ball: [0.3, 0.11, 0.14],
  bones: {
    Hips: [0, -10, 0],
    Spine: [-8, 6, 0],
    Head: [24, 6, 0],
    LeftUpLeg: [-14, 0, 4],
    LeftLeg: [28, 0, 0],
    RightUpLeg: [12, 0, -6],
    RightLeg: [95, 0, 0],
    RightFoot: [-30, 0, 0],
    LeftArm: [30, 0, -45],
    LeftForeArm: [0, 0, -25],
    RightArm: [-30, 0, 55],
    RightForeArm: [0, 0, 20],
  },
};

const BACKHEEL: PoseSpec = {
  label: 'Right-footed backheel',
  rootRotate: 180,
  ball: [0.3, 0.11, 0.1],
  bones: {
    Spine: [10, 0, 0],
    Head: [10, -60, 0],
    LeftUpLeg: [-8, 0, 4],
    LeftLeg: [20, 0, 0],
    RightUpLeg: [22, 0, -4],
    RightLeg: [18, 0, 0],
    RightFoot: [-20, 0, 0],
    LeftArm: [20, 0, -60],
    RightArm: [20, 0, 60],
  },
};

const OVERHEAD: PoseSpec = {
  label: 'Right-footed overhead kick',
  root: [0.95, 1.2, 0],
  rootTilt: 100,
  ball: [-0.1, 1.85, 0.15],
  bones: {
    Spine: [-10, 0, 0],
    Head: [-25, 0, 0],
    LeftUpLeg: [-20, 0, 6],
    LeftLeg: [50, 0, 0],
    RightUpLeg: [-95, 0, -6],
    RightLeg: [15, 0, 0],
    RightFoot: [20, 0, 0],
    LeftArm: [-40, 0, -30],
    RightArm: [-40, 0, 30],
  },
};

const HEADER: PoseSpec = {
  label: 'Header',
  root: [0, 0.2, 0],
  ball: [0.28, 1.72, 0],
  bones: {
    Spine: [14, 0, 0],
    Spine1: [8, 0, 0],
    Head: [6, 0, 0],
    LeftUpLeg: [20, 0, 4],
    LeftLeg: [45, 0, 0],
    LeftFoot: [20, 0, 0],
    RightUpLeg: [22, 0, -4],
    RightLeg: [50, 0, 0],
    RightFoot: [20, 0, 0],
    LeftArm: [-25, 0, -35],
    LeftForeArm: [0, 0, -50],
    RightArm: [-25, 0, 35],
    RightForeArm: [0, 0, 50],
  },
};

const DIVING_HEADER: PoseSpec = {
  label: 'Diving header',
  root: [-0.7, 0.75, 0],
  rootTilt: -75,
  ball: [1.05, 1.15, 0],
  bones: {
    Spine: [4, 0, 0],
    Head: [-10, 0, 0],
    LeftUpLeg: [15, 0, 4],
    LeftLeg: [10, 0, 0],
    RightUpLeg: [30, 0, -4],
    RightLeg: [25, 0, 0],
    LeftArm: [60, 0, -50],
    LeftForeArm: [0, 0, -20],
    RightArm: [60, 0, 50],
    RightForeArm: [0, 0, 20],
  },
};

/** Right-footed base poses; left-footed variants are mirrored, other combos fall back. */
const RIGHT_FOOT_POSES: Partial<Record<Technique, PoseSpec>> = {
  Normal: STRIKE,
  Volley: VOLLEY,
  'Half Volley': HALF_VOLLEY,
  Lob: LOB,
  Backheel: BACKHEEL,
  'Overhead Kick': OVERHEAD,
};

const HEAD_POSES: Partial<Record<Technique, PoseSpec>> = {
  Normal: HEADER,
  'Diving Header': DIVING_HEADER,
};

export const ROLE_POSES = {
  defender: {
    label: 'Closing down',
    ball: [0, 0, 0],
    bones: {
      Spine: [16, 0, 0],
      Head: [-6, 0, 0],
      LeftUpLeg: [-28, 0, 10],
      LeftLeg: [38, 0, 0],
      LeftFoot: [-10, 0, 0],
      RightUpLeg: [-28, 0, -10],
      RightLeg: [38, 0, 0],
      RightFoot: [-10, 0, 0],
      LeftArm: [10, 0, -55],
      LeftForeArm: [0, 0, -35],
      RightArm: [10, 0, 55],
      RightForeArm: [0, 0, 35],
    },
  },
  goalkeeper: {
    label: 'Set position',
    ball: [0, 0, 0],
    bones: {
      Spine: [22, 0, 0],
      Head: [-14, 0, 0],
      LeftUpLeg: [-38, 0, 18],
      LeftLeg: [52, 0, 0],
      LeftFoot: [-14, 0, 0],
      RightUpLeg: [-38, 0, -18],
      RightLeg: [52, 0, 0],
      RightFoot: [-14, 0, 0],
      LeftArm: [30, 0, -35],
      LeftForeArm: [0, 0, -50],
      RightArm: [30, 0, 35],
      RightForeArm: [0, 0, 50],
    },
  },
  teammate: {
    label: 'Standing',
    ball: [0, 0, 0],
    bones: {
      Spine: [4, 0, 0],
      LeftUpLeg: [-6, 0, 4],
      LeftLeg: [10, 0, 0],
      RightUpLeg: [-6, 0, -4],
      RightLeg: [10, 0, 0],
      LeftArm: [5, 0, -72],
      LeftForeArm: [0, 0, -15],
      RightArm: [5, 0, 72],
      RightForeArm: [0, 0, 15],
    },
  },
} satisfies Record<'defender' | 'goalkeeper' | 'teammate', PoseSpec>;

/** Negate without producing -0, so mirrored poses compare equal in tests and memo keys. */
const neg = (v: number): number => (v === 0 ? 0 : -v);

function swapSide(bone: string): string {
  if (bone.startsWith('Left')) return `Right${bone.slice(4)}`;
  if (bone.startsWith('Right')) return `Left${bone.slice(5)}`;
  return bone;
}

/** Reflect a pose across the body's sagittal plane: swap sides, negate Y and Z rotations. */
export function mirrorPose(spec: PoseSpec): PoseSpec {
  const bones: Record<string, Deg3> = {};
  for (const [bone, [x, y, z]] of Object.entries(spec.bones))
    bones[swapSide(bone)] = [x, neg(y), neg(z)];
  return {
    ...spec,
    bones,
    ball: [spec.ball[0], spec.ball[1], neg(spec.ball[2])],
    root: spec.root ? [spec.root[0], spec.root[1], neg(spec.root[2])] : undefined,
    rootRotate: spec.rootRotate === undefined ? undefined : neg(spec.rootRotate),
    label: spec.label.replace('Right-footed', 'Left-footed'),
  };
}

export type ResolvedPose = { spec: PoseSpec; mirrored: boolean; exact: boolean };

/**
 * Pose for a shooter. Fallback chain: exact → same technique on the other foot (mirrored) →
 * the body part's Normal pose → right-footed strike.
 */
export function resolveShooterPose(bodyPart: BodyPart, technique: Technique): ResolvedPose {
  if (bodyPart === 'Head') {
    const spec = HEAD_POSES[technique];
    return spec
      ? { spec, mirrored: false, exact: true }
      : { spec: HEADER, mirrored: false, exact: false };
  }
  const base = RIGHT_FOOT_POSES[technique];
  const exact = base !== undefined && bodyPart !== 'Other';
  const spec = base ?? STRIKE;
  if (bodyPart === 'Left Foot') return { spec: mirrorPose(spec), mirrored: true, exact };
  return { spec, mirrored: false, exact };
}
