import { OrbitControls } from '@react-three/drei';
import { usePlannerStore } from '../store/plannerStore';

const MIN_DISTANCE = 1.5;

export function OrbitControlsHandler() {
  const room = usePlannerStore((state) => state.room);
  // Room.tsx now hides walls via real face culling (normal facing into the room), so the
  // camera no longer needs to be capped near the room to avoid a "broken exterior" —
  // it renders correctly from any distance. This just keeps zoom-out proportional to size.
  const maxDistance = MIN_DISTANCE + Math.max(room.width, room.length, 3) * 2;

  return (
    <OrbitControls
      makeDefault
      minDistance={MIN_DISTANCE}
      maxDistance={maxDistance}
      minPolarAngle={0.15}
      maxPolarAngle={Math.PI / 2 - 0.05}
      enableDamping
    />
  );
}
