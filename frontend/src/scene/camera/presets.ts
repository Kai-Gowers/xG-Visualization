import type { BodyPart } from '../../api/types';
import { GOAL_CENTRE, PITCH, sbToWorld, type SB, type Vec3 } from '../../domain/pitch';
import { DEFAULT_GK } from '../../domain/scenario';
import type { CameraPreset } from '../../store/uiSlice';
import { ballWorld, directionXZ } from '../placement';

export type CameraLimits = {
  minAzimuthAngle: number;
  maxAzimuthAngle: number;
  minPolarAngle: number;
  maxPolarAngle: number;
  minDistance: number;
  maxDistance: number;
};

export type CameraPose = { position: Vec3; target: Vec3; limits: CameraLimits };

const deg = (d: number) => (d * Math.PI) / 180;
const GOAL_WORLD = sbToWorld(GOAL_CENTRE);

const FREE: CameraLimits = {
  minAzimuthAngle: -Infinity,
  maxAzimuthAngle: Infinity,
  minPolarAngle: 0,
  maxPolarAngle: deg(89),
  minDistance: 5,
  maxDistance: 150,
};

const BEHIND = { back: 3.8, side: 1, height: 1.9, targetHeight: 1, targetLerp: 0.6 };

function behindShooter(shooter: SB, bodyPart: BodyPart): CameraPose {
  const s = sbToWorld(shooter);
  const [dx, , dz] = directionXZ(s, GOAL_WORLD);
  // Right-hand vector of a player facing (dx, dz); camera sits opposite the striking foot.
  const side = bodyPart === 'Left Foot' ? 1 : -1;
  const [rx, rz] = [-dz * side, dx * side];
  const position: Vec3 = [
    s[0] - dx * BEHIND.back + rx * BEHIND.side,
    BEHIND.height,
    s[2] - dz * BEHIND.back + rz * BEHIND.side,
  ];
  const target: Vec3 = [
    s[0] + (GOAL_WORLD[0] - s[0]) * BEHIND.targetLerp,
    BEHIND.targetHeight,
    s[2] + (GOAL_WORLD[2] - s[2]) * BEHIND.targetLerp,
  ];
  const azimuth = Math.atan2(position[0] - target[0], position[2] - target[2]);
  return {
    position,
    target,
    limits: {
      minAzimuthAngle: azimuth - deg(30),
      maxAzimuthAngle: azimuth + deg(30),
      minPolarAngle: deg(55),
      maxPolarAngle: deg(95),
      minDistance: 2.5,
      maxDistance: 8,
    },
  };
}

const GK_VIEW = { back: 2.2, side: 1.1, height: 2.5, targetHeight: 0.6 };
/** A spot inside the goal frame is moved behind and above the net instead of sitting in it. */
const BEHIND_NET = { x: PITCH.goalDepthM + 0.8, height: PITCH.goalHeightM + 0.8 };

/** Over the keeper's shoulder: ~2 m behind and above the GK's spot, looking past them at the ball. */
function gkView(shooter: SB, goalkeeper: SB | null): CameraPose {
  const gk = sbToWorld(goalkeeper ?? DEFAULT_GK);
  const ball = ballWorld(shooter);
  const [dx, , dz] = directionXZ(ball, gk);
  // Step to whichever side of the keeper the ball is on so the keeper does not block the view.
  const side = Math.sign(ball[2] - gk[2]) || 1;
  const [rx, rz] = [-dz * side, dx * side];
  const position: Vec3 = [
    gk[0] + dx * GK_VIEW.back + rx * GK_VIEW.side,
    GK_VIEW.height,
    gk[2] + dz * GK_VIEW.back + rz * GK_VIEW.side,
  ];
  if (position[0] > -0.3) {
    position[0] = Math.max(position[0], BEHIND_NET.x);
    position[1] = BEHIND_NET.height;
  }
  return {
    position,
    target: [ball[0], GK_VIEW.targetHeight, ball[2]],
    limits: { ...FREE, minDistance: 2, maxDistance: 40, minPolarAngle: deg(40) },
  };
}

export type CameraSubject = { shooter: SB; goalkeeper: SB | null; bodyPart: BodyPart };

export function cameraPose(
  preset: CameraPreset,
  { shooter, goalkeeper, bodyPart }: CameraSubject,
): CameraPose {
  const s = sbToWorld(shooter);
  const midX = (s[0] + GOAL_WORLD[0]) / 2;
  switch (preset) {
    case 'behindShooter':
      return behindShooter(shooter, bodyPart);
    case 'gk':
      return gkView(shooter, goalkeeper);
    case 'broadcast':
      return {
        position: [midX - 4, 24, 55],
        target: [midX, 0, 3],
        limits: { ...FREE, minPolarAngle: deg(10) },
      };
    case 'topDown':
      return { position: [midX, 42, 0.01], target: [midX, 0, 0], limits: FREE };
  }
}
