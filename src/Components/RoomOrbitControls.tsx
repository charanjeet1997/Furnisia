import { OrbitControls } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import type { PerspectiveCamera } from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import type { RoomVertex } from '../Data/RoomShape';
import { roomFraming } from './roomFraming';

const MIN_DISTANCE = 1.5;
const MAX_ZOOM_OUT = 2; // how far beyond the framed view the user may zoom out
const VIEW_DIRECTION = { x: 1, y: 0.9, z: 1 }; // 3/4 view from above, same feel as before

interface RoomOrbitControlsProps {
  vertices: RoomVertex[];
  height: number;
}

// Orbit controls that frame the room whenever its size changes, so a 4 m bedroom and a
// 20 m apartment both open fully in view, and zoom limits scale with the room.
export function RoomOrbitControls({ vertices, height }: RoomOrbitControlsProps) {
  const camera = useThree((state) => state.camera) as PerspectiveCamera;
  const orbitRef = useRef<OrbitControlsImpl>(null);
  const { width, depth, center, fitDistance } = roomFraming(vertices, height, camera.fov);

  // Re-frame only when the room's size or position changes — not on every render, or the
  // camera would snap back while the user is orbiting.
  const frameKey = `${width.toFixed(2)}|${depth.toFixed(2)}|${height.toFixed(2)}|${center.x.toFixed(2)}|${center.z.toFixed(2)}`;
  useEffect(() => {
    const controls = orbitRef.current;
    if (!controls) return;
    const len = Math.hypot(VIEW_DIRECTION.x, VIEW_DIRECTION.y, VIEW_DIRECTION.z);
    controls.target.set(center.x, height / 2, center.z);
    camera.position.set(
      center.x + (VIEW_DIRECTION.x / len) * fitDistance,
      height / 2 + (VIEW_DIRECTION.y / len) * fitDistance,
      center.z + (VIEW_DIRECTION.z / len) * fitDistance,
    );
    camera.far = Math.max(1000, fitDistance * MAX_ZOOM_OUT * 4);
    camera.updateProjectionMatrix();
    controls.update();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frameKey]);

  return (
    <OrbitControls
      ref={orbitRef}
      makeDefault
      minDistance={MIN_DISTANCE}
      maxDistance={Math.max(fitDistance * MAX_ZOOM_OUT, 10)}
      minPolarAngle={0.15}
      maxPolarAngle={Math.PI / 2 - 0.05}
      enableDamping
    />
  );
}
