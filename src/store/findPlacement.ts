import type { RoomShape } from '../Data/RoomShape';
import { furnitureCatalog, type ModelForward } from '../Data/FurnitureCatalog';
import { computeEdges, boundingBox, type WallEdge } from '../Components/polygonGeometry';
import type { PlacedItem } from './plannerStore';

const WALL_MARGIN = 0.15; // matches FurnitureModel clamp margin
const ITEM_GAP = 0.10; // breathing room between pieces
const GRID_STEP = 0.25; // interior fallback grid resolution
const DOOR_CLEAR_Z = 1.0; // metres of clearance kept in front of every door

// forwardToOffset maps a model's own native "forward" direction to the extra rotation
// needed so that, after adding a wall's own facing rotation, the model ends up facing
// into the room. Baseline: a model whose front already faces -Z needs no correction.
const forwardToOffset: Record<ModelForward, number> = {
  north: 0,
  south: Math.PI,
  east: Math.PI / 2,
  west: -Math.PI / 2,
};

interface Box {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

function footprintOf(catalogId: string) {
  return furnitureCatalog.find((e) => e.id === catalogId)?.footprint ?? { width: 0.6, depth: 0.6 };
}

function boxAt(cx: number, cz: number, w: number, d: number): Box {
  return { minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2 };
}

function overlaps(a: Box, b: Box, gap: number) {
  return a.minX < b.maxX + gap && a.maxX > b.minX - gap && a.minZ < b.maxZ + gap && a.maxZ > b.minZ - gap;
}

// Approximate rotated footprint: swap width/depth for 90°/270° rotations.
function rotatedFootprint(w: number, d: number, rotationY: number) {
  const angle = Math.abs(rotationY % Math.PI);
  if (angle > Math.PI / 4 && angle < (3 * Math.PI) / 4) return { w: d, d: w };
  return { w, d };
}

// Keeps candidates out of the clearance zone in front of every door, on any wall/angle —
// approximated as an axis-aligned box centered a little way inward from the door along that
// wall's own normal (good enough for a "don't block the door" heuristic, not exact geometry).
function blocksAnyDoor(candidate: Box, room: RoomShape, edges: WallEdge[]): boolean {
  for (const opening of room.openings) {
    if (opening.kind !== 'door') continue;
    const edge = edges[opening.edgeIndex];
    if (!edge) continue;
    const t = (opening.offset + opening.width / 2) / edge.length;
    const doorX = edge.start.x + (edge.end.x - edge.start.x) * t;
    const doorZ = edge.start.z + (edge.end.z - edge.start.z) * t;
    const clearX = doorX - edge.normal.x * (DOOR_CLEAR_Z / 2);
    const clearZ = doorZ - edge.normal.z * (DOOR_CLEAR_Z / 2);
    const doorBox = boxAt(clearX, clearZ, Math.max(opening.width, DOOR_CLEAR_Z), DOOR_CLEAR_Z);
    if (overlaps(candidate, doorBox, 0)) return true;
  }
  return false;
}

// Centre first, then alternating outward — same sampling shape as the old fixed-wall version.
function wallSamples(halfRange: number, count: number): number[] {
  if (halfRange <= 0) return [0];
  const step = (halfRange * 1.6) / Math.max(count - 1, 1);
  const result = [0];
  for (let i = 1; result.length < count; i++) {
    result.push(i * step);
    if (result.length < count) result.push(-i * step);
  }
  return result.filter((v) => Math.abs(v) <= halfRange);
}

export interface Placement {
  position: [number, number, number];
  rotationY: number;
}

export function findPlacement(room: RoomShape, existing: PlacedItem[], newCatalogId: string): Placement {
  const entry = furnitureCatalog.find((e) => e.id === newCatalogId);
  const { width: iW, depth: iD } = entry?.footprint ?? { width: 0.6, depth: 0.6 };
  const rotOff = forwardToOffset[entry?.forward ?? 'north'];

  const edges = computeEdges(room.vertices);
  const bbox = boundingBox(room.vertices);
  const maxX = Math.max(0, (bbox.maxX - bbox.minX) / 2 - iW / 2 - WALL_MARGIN);
  const maxZ = Math.max(0, (bbox.maxZ - bbox.minZ) / 2 - iD / 2 - WALL_MARGIN);

  const existingBoxes = existing.map((item) => {
    const fp = footprintOf(item.catalogId);
    const { w, d } = rotatedFootprint(fp.width, fp.depth, item.rotationY);
    return boxAt(item.position[0], item.position[2], w, d);
  });

  function isFree(x: number, z: number): boolean {
    const candidate = boxAt(x, z, iW, iD);
    if (blocksAnyDoor(candidate, room, edges)) return false;
    return existingBoxes.every((box) => !overlaps(candidate, box, ITEM_GAP));
  }

  // --- Wall-hugging candidates, one wall at a time so the room fills evenly ---
  // Diagonal edges (from Cut/Beveled corners) are skipped — hugging a chamfered wall would
  // need the item rotated to match an arbitrary angle, out of scope for this heuristic; the
  // interior grid fallback below still covers that floor area.
  const SAMPLES = 7;
  const wallCandidateLists: [number, number, number][][] = edges.map((edge) => {
    const dirX = (edge.end.x - edge.start.x) / edge.length;
    const dirZ = (edge.end.z - edge.start.z) / edge.length;
    const isAxisAligned = Math.abs(dirX) < 0.01 || Math.abs(dirZ) < 0.01;
    if (!isAxisAligned) return [];

    const inset = iW / 2 + WALL_MARGIN;
    const halfRange = edge.length / 2 - inset;
    if (halfRange <= 0) return [];

    const pushIn = iD / 2 + WALL_MARGIN;
    const rotation = edge.angle + rotOff;

    return wallSamples(halfRange, SAMPLES).map((s): [number, number, number] => {
      const x = edge.midpoint.x + dirX * s - edge.normal.x * pushIn;
      const z = edge.midpoint.z + dirZ * s - edge.normal.z * pushIn;
      return [x, z, rotation];
    });
  });

  const wallCandidates: [number, number, number][] = [];
  const maxLen = Math.max(0, ...wallCandidateLists.map((list) => list.length));
  for (let i = 0; i < maxLen; i++) {
    for (const list of wallCandidateLists) {
      if (i < list.length) wallCandidates.push(list[i]);
    }
  }

  for (const [x, z, rot] of wallCandidates) {
    if (isFree(x, z)) return { position: [x, 0, z], rotationY: rot };
  }

  // --- Interior grid fallback (bounding box, not the exact polygon) ---
  for (let x = -maxX; x <= maxX; x += GRID_STEP) {
    for (let z = -maxZ; z <= maxZ; z += GRID_STEP) {
      if (isFree(x, z)) return { position: [x, 0, z], rotationY: rotOff };
    }
  }

  return { position: [0, 0, 0], rotationY: rotOff };
}
