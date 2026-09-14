import { Canvas } from '@react-three/fiber';
import { useInvalidateOnStore } from '../hooks/useInvalidateOnStore';
import { Ball } from './Ball';
import { CameraRig } from './camera/CameraRig';
import { Characters } from './Characters';
import { GoalFrame } from './GoalFrame';
import { Lighting } from './Lighting';
import { Pitch } from './Pitch';
import './scene.css';

function InvalidateOnStore() {
  useInvalidateOnStore();
  return null;
}

export function Scene() {
  return (
    <Canvas
      frameloop="demand"
      shadows
      dpr={[1, 1.5]}
      camera={{ fov: 55, near: 0.1, far: 500, position: [-14, 2, 0] }}
      data-testid="scene"
    >
      <color attach="background" args={['#0b0e12']} />
      <InvalidateOnStore />
      <Lighting />
      <Pitch />
      <GoalFrame />
      <GoalFrame mirrored />
      <Ball />
      <Characters />
      <CameraRig />
    </Canvas>
  );
}
