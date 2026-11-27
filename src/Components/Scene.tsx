import { Canvas } from '@react-three/fiber';
import type { ReactNode } from 'react';
import { OrbitControlsHandler } from './OrbitControlsHandler';
import { usePlannerStore } from '../store/plannerStore';
import { boundingBox } from './polygonGeometry';

interface SceneProps {
  children: ReactNode;
}

// Shadows were fixed at ±10 m; big rooms lost them past that. Size the light's shadow box to
// the room (plus a margin for walls) and keep the light far enough to cover it.
const SHADOW_MARGIN = 2;

export function Scene({ children }: SceneProps) {
  const selectItem = usePlannerStore((state) => state.selectItem);
  const vertices = usePlannerStore((state) => state.room.vertices);
  const bbox = boundingBox(vertices);
  const half = Math.max(bbox.maxX - bbox.minX, bbox.maxZ - bbox.minZ, 8) / 2 + SHADOW_MARGIN;
  const lightPos: [number, number, number] = [half * 0.5, half * 0.8 + 6, half * 0.5];
  const lightReach = Math.hypot(...lightPos) + half * 2;

  return (
    <Canvas shadows="variance" camera={{ position: [6, 6, 6], fov: 50 }} onPointerMissed={() => selectItem(null)}>
      <ambientLight intensity={0.55} />
      <directionalLight
        position={lightPos}
        intensity={0.9}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-radius={12}
        shadow-blurSamples={16}
        shadow-bias={-0.0001}
        shadow-normalBias={0.03}
        shadow-camera-left={-half}
        shadow-camera-right={half}
        shadow-camera-top={half}
        shadow-camera-bottom={-half}
        shadow-camera-near={1}
        shadow-camera-far={lightReach}
      />
      <OrbitControlsHandler />
      {children}
    </Canvas>
  );
}
