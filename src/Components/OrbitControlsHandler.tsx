import { usePlannerStore } from '../store/plannerStore';
import { RoomOrbitControls } from './RoomOrbitControls';

export function OrbitControlsHandler() {
  const room = usePlannerStore((state) => state.room);
  return <RoomOrbitControls vertices={room.vertices} height={room.height} />;
}
