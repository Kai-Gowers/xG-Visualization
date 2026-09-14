import { CameraControls } from '@react-three/drei';
import { useEffect, useRef, type ComponentRef } from 'react';
import { useStore } from '../../store';
import { cameraPose } from './presets';

const SMOOTH_TIME = 0.35;

/** drei CameraControls driven by the active preset; re-targets with damping when the shooter moves. */
export function CameraRig() {
  const controls = useRef<ComponentRef<typeof CameraControls>>(null);
  const preset = useStore((s) => s.ui.cameraPreset);
  const shooter = useStore((s) => s.scenario.shooter);
  const bodyPart = useStore((s) => s.scenario.attrs.body_part);
  const initialised = useRef(false);

  useEffect(() => {
    const c = controls.current;
    if (!c) return;
    const { position, target, limits } = cameraPose(preset, shooter, bodyPart);
    c.normalizeRotations();
    Object.assign(c, limits);
    void c.setLookAt(...position, ...target, initialised.current);
    initialised.current = true;
  }, [preset, shooter, bodyPart]);

  return <CameraControls ref={controls} makeDefault smoothTime={SMOOTH_TIME} />;
}
