import type { RoomVertex } from '../Data/RoomShape';

export interface WallEdge {
  start: RoomVertex;
  end: RoomVertex;
  length: number;
  midpoint: RoomVertex;
  normal: RoomVertex; // unit vector, points outward from the room
  angle: number; // Y rotation so a wall group's local +Z axis aligns with `normal`
}

// Shoelace formula: positive for one winding direction, negative for the other. Used to
// derive outward normals below — NOT an "is this point inside the shape" test, which is why
// this approach (unlike an earlier centroid-based one) stays correct for concave polygons
// like L/T/U shapes. A simple vertex-average centroid can land inside the shape's own notch
// (i.e. outside the actual room) for those, silently flipping the normal on nearby edges.
function signedArea(vertices: RoomVertex[]): number {
  let area = 0;
  for (let i = 0; i < vertices.length; i++) {
    const a = vertices[i];
    const b = vertices[(i + 1) % vertices.length];
    area += a.x * b.z - b.x * a.z;
  }
  return area;
}

// Per-edge data for a closed room polygon.
//
// `angle` is chosen so that RotateY(angle) maps a wall group's local +Z axis onto `normal`
// (and, as a consequence, local +X onto the edge direction) — so a wall can be built as
// `<group position={[midpoint.x, 0, midpoint.z]} rotation={[0, angle, 0]}>` and everything
// inside it (segments, door/window openings from buildWallSegments) just uses local 1D
// coordinates along the edge, no manual world-position math needed.
export function computeEdges(vertices: RoomVertex[]): WallEdge[] {
  const flip = signedArea(vertices) < 0;

  return vertices.map((start, i) => {
    const end = vertices[(i + 1) % vertices.length];
    const dx = end.x - start.x;
    const dz = end.z - start.z;
    const length = Math.hypot(dx, dz);

    const midpoint = { x: (start.x + end.x) / 2, z: (start.z + end.z) / 2 };

    let nx = dz / length;
    let nz = -dx / length;
    if (flip) {
      nx = -nx;
      nz = -nz;
    }

    const angle = Math.atan2(nx, nz);

    return { start, end, length, midpoint, normal: { x: nx, z: nz }, angle };
  });
}

// Grows (positive distance) or shrinks (negative) the polygon by offsetting every edge
// along its outward normal and re-intersecting adjacent edge lines (miter join). Used so
// the ceiling slab covers wall tops flush to their OUTER faces — walls are boxes centered
// on the polygon line, so their outer faces sit half a wall-thickness outside it.
export function offsetPolygon(vertices: RoomVertex[], distance: number): RoomVertex[] {
  const edges = computeEdges(vertices);
  const n = vertices.length;

  return vertices.map((v, i) => {
    const prev = edges[(i - 1 + n) % n]; // edge ending at v
    const next = edges[i]; // edge starting at v

    const p1x = prev.start.x + prev.normal.x * distance;
    const p1z = prev.start.z + prev.normal.z * distance;
    const d1x = prev.end.x - prev.start.x;
    const d1z = prev.end.z - prev.start.z;

    const p2x = next.start.x + next.normal.x * distance;
    const p2z = next.start.z + next.normal.z * distance;
    const d2x = next.end.x - next.start.x;
    const d2z = next.end.z - next.start.z;

    const cross = d1x * d2z - d1z * d2x;
    if (Math.abs(cross) < 1e-9) {
      // Adjacent edges are collinear — no unique intersection, push straight out.
      return { x: v.x + next.normal.x * distance, z: v.z + next.normal.z * distance };
    }

    const t = ((p2x - p1x) * d2z - (p2z - p1z) * d2x) / cross;
    return { x: p1x + d1x * t, z: p1z + d1z * t };
  });
}

// Even-odd ray-cast containment test — correct for concave polygons (L/T/U/notches).
export function pointInPolygon(vertices: RoomVertex[], x: number, z: number): boolean {
  let inside = false;
  for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
    const a = vertices[i];
    const b = vertices[j];
    if (a.z > z !== b.z > z && x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z) + a.x) {
      inside = !inside;
    }
  }
  return inside;
}

export interface BoundingBox {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export function boundingBox(vertices: RoomVertex[]): BoundingBox {
  const xs = vertices.map((v) => v.x);
  const zs = vertices.map((v) => v.z);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minZ: Math.min(...zs),
    maxZ: Math.max(...zs),
  };
}
