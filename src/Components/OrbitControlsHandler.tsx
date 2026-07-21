import { OrbitControls } from '@react-three/drei';
import { usePlannerStore } from '../store/plannerStore';

const MIN_DISTANCE = 1.5;

export function OrbitControlsHandler() {
  const room = usePlannerStore((state) => state.room);
  const maxDistance = MIN_DISTANCE + Math.max(room.width, room.length, 3) * 2;
  // Orbit around the room's geometric centre [0, height/2, 0], not the floor [0,0,0].
  // Without this, the camera pivots around the floor and the room appears to rotate
  // off-centre when the user orbits.
  const targetY = room.height / 2;

  return (
    <OrbitControls
      makeDefault
      target={[0, targetY, 0]}
      minDistance={MIN_DISTANCE}
      maxDistance={maxDistance}
      minPolarAngle={0.15}
      maxPolarAngle={Math.PI / 2 - 0.05}
      enableDamping
    />
  );
}
