import { GOAL_CENTRE, sbToWorld, type SB, type Vec3 } from '../../domain/pitch';
import type { BodyPart } from '../../api/types';
import type { CameraPreset } from '../../store/uiSlice';
import { directionXZ } from '../placement';

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

export function cameraPose(preset: CameraPreset, shooter: SB, bodyPart: BodyPart): CameraPose {
  const s = sbToWorld(shooter);
  const midX = (s[0] + GOAL_WORLD[0]) / 2;
  switch (preset) {
    case 'behindShooter':
      return behindShooter(shooter, bodyPart);
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
