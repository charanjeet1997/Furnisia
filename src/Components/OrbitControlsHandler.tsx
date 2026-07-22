import { OrbitControls } from '@react-three/drei';
import { useEffect, useRef } from 'react';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { usePlannerStore } from '../store/plannerStore';
import { boundingBox } from './polygonGeometry';

const MIN_DISTANCE = 1.5;

export function OrbitControlsHandler() {
  const room = usePlannerStore((state) => state.room);
  const bbox = boundingBox(room.vertices);
  const maxDistance = MIN_DISTANCE + Math.max(bbox.maxX - bbox.minX, bbox.maxZ - bbox.minZ, 3) * 2;
  const orbitRef = useRef<OrbitControlsImpl>(null);

  // Set the orbit pivot to the room's geometric centre [0, height/2, 0] imperatively
  // so it only updates when the room actually changes — not on every re-render.
  //
  // Passing target as a JSX prop causes R3F to call target.set() on every render,
  // which snaps the pivot back and breaks user-initiated orbiting.
  useEffect(() => {
    const controls = orbitRef.current;
    if (!controls) return;
    controls.target.set(0, room.height / 2, 0);
    controls.update();
  }, [room.id, room.height]);

  return (
    <OrbitControls
      ref={orbitRef}
      makeDefault
      minDistance={MIN_DISTANCE}
      maxDistance={maxDistance}
      minPolarAngle={0.15}
      maxPolarAngle={Math.PI / 2 - 0.05}
      enableDamping
    />
  );
}
