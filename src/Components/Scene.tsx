import { Canvas } from '@react-three/fiber';
import type { ReactNode } from 'react';
import { OrbitControlsHandler } from './OrbitControlsHandler';
import { usePlannerStore } from '../store/plannerStore';

interface SceneProps {
  children: ReactNode;
}

export function Scene({ children }: SceneProps) {
  const selectItem = usePlannerStore((state) => state.selectItem);

  return (
    <Canvas shadows="variance" camera={{ position: [6, 6, 6], fov: 50 }} onPointerMissed={() => selectItem(null)}>
      <ambientLight intensity={0.55} />
      <directionalLight
        position={[5, 8, 5]}
        intensity={0.9}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-radius={12}
        shadow-blurSamples={16}
        shadow-bias={-0.0001}
        shadow-normalBias={0.03}
        shadow-camera-left={-10}
        shadow-camera-right={10}
        shadow-camera-top={10}
        shadow-camera-bottom={-10}
        shadow-camera-near={1}
        shadow-camera-far={25}
      />
      <OrbitControlsHandler />
      {children}
    </Canvas>
  );
}
