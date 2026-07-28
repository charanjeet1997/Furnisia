import type { RoomShape } from '../Data/RoomShape';
import { furnitureCatalog, type ModelForward } from '../Data/FurnitureCatalog';
import { computeEdges, boundingBox, pointInPolygon, type WallEdge } from '../Components/polygonGeometry';
import type { PlacedItem } from './plannerStore';

const ITEM_GAP = 0.15; // 15cm breathing room between pieces
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

// Keeps candidates out of the clearance zone in front of every door, on any wall/angle.
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

  const wallThickness = room.wallThickness ?? 0.1;
  const WALL_MARGIN = wallThickness / 2 + 0.05; // 5cm buffer in front of wall inner face

  const edges = computeEdges(room.vertices);
  const bbox = boundingBox(room.vertices);
  const maxX = Math.max(0, (bbox.maxX - bbox.minX) / 2 - iW / 2 - WALL_MARGIN);
  const maxZ = Math.max(0, (bbox.maxZ - bbox.minZ) / 2 - iD / 2 - WALL_MARGIN);

  const existingBoxes = existing.map((item) => {
    const fp = footprintOf(item.catalogId);
    const { w, d } = rotatedFootprint(fp.width, fp.depth, item.rotationY);
    return boxAt(item.position[0], item.position[2], w, d);
  });

  function isFree(x: number, z: number, rotationY = 0): boolean {
    const { w, d } = rotatedFootprint(iW, iD, rotationY);
    const candidate = boxAt(x, z, w, d);

    // 1. MUST BE INSIDE THE ROOM POLYGON FOOTPRINT
    if (!pointInPolygon(room.vertices, x, z)) return false;

    // Check all 4 corners of candidate box so furniture never pokes out through outer walls
    const corners = [
      { x: candidate.minX, z: candidate.minZ },
      { x: candidate.maxX, z: candidate.minZ },
      { x: candidate.maxX, z: candidate.maxZ },
      { x: candidate.minX, z: candidate.maxZ },
    ];
    if (corners.some((c) => !pointInPolygon(room.vertices, c.x, c.z))) return false;

    // 2. MUST NOT BLOCK DOORS
    if (blocksAnyDoor(candidate, room, edges)) return false;

    // 3. MUST NOT OVERLAP EXISTING FURNITURE
    return existingBoxes.every((box) => !overlaps(candidate, box, ITEM_GAP));
  }

  const lowerId = newCatalogId.toLowerCase();

  // --- Smart Placement Rule 1: Coffee Table (Placed 0.45m in front of sofa) ---
  if (lowerId.includes('table') || lowerId.includes('coffee')) {
    const sofa = existing.find((item) => item.catalogId.toLowerCase().includes('sofa') || item.catalogId.toLowerCase().includes('seating'));
    if (sofa) {
      const sofaFp = footprintOf(sofa.catalogId);
      const dist = sofaFp.depth / 2 + iD / 2 + 0.45;
      const fwdX = -Math.sin(sofa.rotationY);
      const fwdZ = -Math.cos(sofa.rotationY);
      const targetX = sofa.position[0] + fwdX * dist;
      const targetZ = sofa.position[2] + fwdZ * dist;
      if (isFree(targetX, targetZ, sofa.rotationY)) {
        return { position: [targetX, 0, targetZ], rotationY: sofa.rotationY };
      }
    }
  }

  // --- Smart Placement Rule 2: Nightstand / Shelf (Placed beside bed headboard) ---
  if (lowerId.includes('shelf') || lowerId.includes('nightstand')) {
    const bed = existing.find((item) => item.catalogId.toLowerCase().includes('bed'));
    if (bed) {
      const bedFp = footprintOf(bed.catalogId);
      const offsetDist = bedFp.width / 2 + iW / 2 + 0.12;
      const rightX = Math.cos(bed.rotationY);
      const rightZ = -Math.sin(bed.rotationY);
      for (const sideMult of [1, -1]) {
        const targetX = bed.position[0] + rightX * offsetDist * sideMult;
        const targetZ = bed.position[2] + rightZ * offsetDist * sideMult;
        if (isFree(targetX, targetZ, bed.rotationY)) {
          return { position: [targetX, 0, targetZ], rotationY: bed.rotationY };
        }
      }
    }
  }

  // --- Smart Placement Rule 3: Bed (Prefers longest empty wall, headboard against wall) ---
  if (lowerId.includes('bed')) {
    const sortedEdges = [...edges].sort((a, b) => b.length - a.length);
    for (const edge of sortedEdges) {
      const rotation = edge.angle + rotOff;
      const pushIn = iD / 2 + 0.05;
      const x = edge.midpoint.x - edge.normal.x * pushIn;
      const z = edge.midpoint.z - edge.normal.z * pushIn;
      if (isFree(x, z, rotation)) {
        return { position: [x, 0, z], rotationY: rotation };
      }
    }
  }

  // --- Smart Placement Rule 4: General Wall-Hugging candidates (Sofa, Lamp, Plant, etc.) ---
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
    if (isFree(x, z, rot)) return { position: [x, 0, z], rotationY: rot };
  }

  // --- Interior grid fallback ---
  for (let x = -maxX; x <= maxX; x += GRID_STEP) {
    for (let z = -maxZ; z <= maxZ; z += GRID_STEP) {
      if (isFree(x, z, rotOff)) return { position: [x, 0, z], rotationY: rotOff };
    }
  }

  return { position: [0, 0, 0], rotationY: rotOff };
}
