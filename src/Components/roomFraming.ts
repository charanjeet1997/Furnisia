import type { RoomVertex } from '../Data/RoomShape';
import { boundingBox } from './polygonGeometry';

const FIT_MARGIN = 1.1; // a little breathing room around the room when framed

// Room footprint size and the camera distance that fits the whole room on screen.
export function roomFraming(vertices: RoomVertex[], height: number, fovDeg: number) {
  const bbox = boundingBox(vertices);
  const width = bbox.maxX - bbox.minX;
  const depth = bbox.maxZ - bbox.minZ;
  const center = { x: (bbox.minX + bbox.maxX) / 2, z: (bbox.minZ + bbox.maxZ) / 2 };
  const radius = Math.hypot(width, depth, height) / 2; // bounding sphere of the room
  const fitDistance = (radius / Math.sin((fovDeg * Math.PI) / 360)) * FIT_MARGIN;
  return { width, depth, center, fitDistance };
}
