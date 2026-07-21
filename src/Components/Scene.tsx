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
    <Canvas shadows camera={{ position: [6, 6, 6], fov: 50 }} onPointerMissed={() => selectItem(null)}>
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 8, 5]} intensity={1} castShadow />
      <OrbitControlsHandler />
      {children}
    </Canvas>
  );
}
