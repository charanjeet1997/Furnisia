import type { InteriorWall, RoomVertex } from '../../../Data/RoomShape';
import type { WallEdge } from '../../../Components/polygonGeometry';
import { type SnapTarget, SNAP_DISTANCE, ENDPOINT_SNAP_DISTANCE } from '../types/floorPlanTypes';

export function findSnapTarget(
  p: RoomVertex,
  vertices: RoomVertex[],
  edges: WallEdge[],
  interiorWalls: InteriorWall[],
  excludeWallId?: string,
  excludeTips?: { wallId: string; end: 'start' | 'end' }[],
): SnapTarget | null {
  let best: (SnapTarget & { dist: number }) | null = null;
  vertices.forEach((v, vertexIndex) => {
    const dist = Math.hypot(p.x - v.x, p.z - v.z);
    if (dist <= ENDPOINT_SNAP_DISTANCE && (!best || dist < best.dist)) best = { host: 'vertex', vertexIndex, point: v, dist };
  });
  edges.forEach((edge, edgeIndex) => {
    const abx = edge.end.x - edge.start.x;
    const abz = edge.end.z - edge.start.z;
    const lenSq = abx * abx + abz * abz || 1;
    const t = Math.max(0, Math.min(1, ((p.x - edge.start.x) * abx + (p.z - edge.start.z) * abz) / lenSq));
    const point = { x: edge.start.x + abx * t, z: edge.start.z + abz * t };
    const dist = Math.hypot(p.x - point.x, p.z - point.z);
    if (dist <= SNAP_DISTANCE && (!best || dist < best.dist)) best = { host: 'boundary', edgeIndex, t, point, dist };
  });
  interiorWalls.forEach((wall) => {
    if (wall.id === excludeWallId) return;
    for (const [t, point, tipEnd] of [[0, wall.start, 'start'] as const, [1, wall.end, 'end'] as const]) {
      if (excludeTips?.some((tip) => tip.wallId === wall.id && tip.end === tipEnd)) continue;
      const dist = Math.hypot(p.x - point.x, p.z - point.z);
      if (dist <= ENDPOINT_SNAP_DISTANCE && (!best || dist < best.dist)) best = { host: 'interior', wallId: wall.id, t, point, dist };
    }
    const abx = wall.end.x - wall.start.x;
    const abz = wall.end.z - wall.start.z;
    const lenSq = abx * abx + abz * abz || 1;
    const t = Math.max(0, Math.min(1, ((p.x - wall.start.x) * abx + (p.z - wall.start.z) * abz) / lenSq));
    const point = { x: wall.start.x + abx * t, z: wall.start.z + abz * t };
    const dist = Math.hypot(p.x - point.x, p.z - point.z);
    if (dist <= SNAP_DISTANCE && (!best || dist < best.dist)) best = { host: 'interior', wallId: wall.id, t, point, dist };
  });
  return best;
}
