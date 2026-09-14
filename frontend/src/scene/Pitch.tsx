import { useThree } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import { createPitchTexture, PLANE_CENTRE, PLANE_H, PLANE_W } from './pitchTexture';

export function Pitch() {
  const gl = useThree((s) => s.gl);
  const texture = useMemo(() => {
    const t = createPitchTexture();
    t.anisotropy = gl.capabilities.getMaxAnisotropy();
    return t;
  }, [gl]);
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <mesh rotation-x={-Math.PI / 2} position={PLANE_CENTRE} receiveShadow>
      <planeGeometry args={[PLANE_W, PLANE_H]} />
      <meshStandardMaterial map={texture} roughness={0.95} />
    </mesh>
  );
}
