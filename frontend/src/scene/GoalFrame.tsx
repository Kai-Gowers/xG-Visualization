import { useEffect, useMemo } from 'react';
import { CanvasTexture, DoubleSide, RepeatWrapping } from 'three';
import { PITCH } from '../domain/pitch';

const { goalWidthM: W, goalHeightM: H, goalDepthM: D } = PITCH;
const POST_R = 0.06;
const MESH_PER_M = 8;

function createNetTexture(): CanvasTexture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 3;
  ctx.strokeRect(1.5, 1.5, size - 3, size - 3);
  const texture = new CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = RepeatWrapping;
  return texture;
}

type PanelProps = {
  net: CanvasTexture;
  size: [number, number];
  position: [number, number, number];
  rotation?: [number, number, number];
};

function NetPanel({ net, size, position, rotation }: PanelProps) {
  const map = useMemo(() => {
    const t = net.clone();
    t.repeat.set(size[0] * MESH_PER_M, size[1] * MESH_PER_M);
    return t;
  }, [net, size]);
  useEffect(() => () => map.dispose(), [map]);
  return (
    <mesh position={position} rotation={rotation}>
      <planeGeometry args={size} />
      <meshBasicMaterial map={map} transparent opacity={0.6} side={DoubleSide} depthWrite={false} />
    </mesh>
  );
}

function Post({
  position,
  rotation,
  length,
}: {
  position: [number, number, number];
  rotation?: [number, number, number];
  length: number;
}) {
  return (
    <mesh position={position} rotation={rotation} castShadow>
      <cylinderGeometry args={[POST_R, POST_R, length, 12]} />
      <meshStandardMaterial color="#ffffff" roughness={0.4} />
    </mesh>
  );
}

/** Goal at the world origin; `mirrored` puts the far goal at the other end. */
export function GoalFrame({ mirrored = false }: { mirrored?: boolean }) {
  const net = useMemo(() => createNetTexture(), []);
  useEffect(() => () => net.dispose(), [net]);
  const half = W / 2;
  return (
    <group position={[mirrored ? -PITCH.lengthM : 0, 0, 0]} rotation-y={mirrored ? Math.PI : 0}>
      <Post position={[0, H / 2, -half]} length={H} />
      <Post position={[0, H / 2, half]} length={H} />
      <Post position={[0, H, 0]} rotation={[Math.PI / 2, 0, 0]} length={W + 2 * POST_R} />
      <Post position={[D, H / 2, -half]} length={H} />
      <Post position={[D, H / 2, half]} length={H} />
      <Post position={[D, H, 0]} rotation={[Math.PI / 2, 0, 0]} length={W} />
      <NetPanel net={net} size={[W, H]} position={[D, H / 2, 0]} rotation={[0, Math.PI / 2, 0]} />
      <NetPanel net={net} size={[D, H]} position={[D / 2, H / 2, -half]} />
      <NetPanel net={net} size={[D, H]} position={[D / 2, H / 2, half]} />
      <NetPanel net={net} size={[D, W]} position={[D / 2, H, 0]} rotation={[-Math.PI / 2, 0, 0]} />
    </group>
  );
}
