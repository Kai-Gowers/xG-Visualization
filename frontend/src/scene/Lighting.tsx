export function Lighting() {
  return (
    <>
      <hemisphereLight args={['#dbe9ff', '#2b4a2f', 0.8]} />
      <directionalLight
        position={[-25, 35, 20]}
        intensity={2.2}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-30}
        shadow-camera-right={30}
        shadow-camera-top={30}
        shadow-camera-bottom={-30}
        shadow-camera-near={5}
        shadow-camera-far={120}
        shadow-bias={-0.0004}
      />
    </>
  );
}
