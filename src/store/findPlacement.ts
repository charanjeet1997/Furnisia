import type { RoomPreset } from '../Data/RoomPresets';
import { furnitureCatalog, type ModelForward } from '../Data/FurnitureCatalog';
import type { PlacedItem } from './plannerStore';

const WALL_MARGIN = 0.15;    // matches FurnitureModel clamp margin
const ITEM_GAP   = 0.10;    // breathing room between pieces
const GRID_STEP  = 0.25;    // interior fallback grid resolution

// WALL_ROTATION is calibrated so that a model whose front faces 'north' (-Z)
// ends up facing INTO the room after placement. forwardToOffset maps any other
// native forward direction to the extra rotation needed to reach that baseline.
const forwardToOffset: Record<ModelForward, number> = {
  north: 0,              // already faces -Z — no correction needed
  south: Math.PI,        // faces +Z → flip 180° to face -Z
  east:  Math.PI / 2,   // faces +X → rotate 90° CW  to face -Z
  west: -Math.PI / 2,   // faces -X → rotate 90° CCW to face -Z
};

const DOOR_WIDTH    = 0.9;   // must match Room.tsx
const DOOR_CLEAR_Z  = 1.0;   // metres of clearance in front of the door

interface Box {
  minX: number; maxX: number;
  minZ: number; maxZ: number;
}

function footprintOf(catalogId: string) {
  return (
    furnitureCatalog.find((e) => e.id === catalogId)?.footprint ??
    { width: 0.6, depth: 0.6 }
  );
}

function boxAt(cx: number, cz: number, w: number, d: number): Box {
  return { minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2 };
}

function overlaps(a: Box, b: Box, gap: number) {
  return (
    a.minX < b.maxX + gap && a.maxX > b.minX - gap &&
    a.minZ < b.maxZ + gap && a.maxZ > b.minZ - gap
  );
}

// Approximate rotated footprint: swap width/depth for 90° / 270° rotations.
function rotatedFootprint(w: number, d: number, rotationY: number) {
  const angle = Math.abs(rotationY % Math.PI);
  if (angle > Math.PI / 4 && angle < (3 * Math.PI) / 4) return { w: d, d: w };
  return { w, d };
}

// Returns true when the candidate box would block the door opening on the south wall.
// The door is 0.9 m wide at x=0, and we want DOOR_CLEAR_Z metres of clearance in front.
function blocksDoor(candidate: Box, maxZ: number) {
  const doorMinX = -DOOR_WIDTH / 2;
  const doorMaxX =  DOOR_WIDTH / 2;
  const doorClearMinZ = maxZ - DOOR_CLEAR_Z; // start of the clearance zone in world space

  // Overlap in X with the door AND within the clearance zone in Z
  return (
    candidate.minX < doorMaxX &&
    candidate.maxX > doorMinX &&
    candidate.maxZ > doorClearMinZ
  );
}

// Build evenly-spread sample positions along an axis: centre first, then alternating out.
// `count` total samples, `halfRange` is the ± limit.
function wallSamples(halfRange: number, count: number): number[] {
  if (halfRange <= 0) return [0];
  const step = (halfRange * 1.6) / Math.max(count - 1, 1);
  const result = [0];
  for (let i = 1; result.length < count; i++) {
    result.push( i * step);
    if (result.length < count) result.push(-i * step);
  }
  return result.filter((v) => Math.abs(v) <= halfRange);
}

export interface Placement {
  position: [number, number, number];
  rotationY: number;
}

// Rotation that makes a model face into the room when placed against each wall.
// Three.js models whose "front" points toward +Z at rotationY=0:
//   North wall (z = -maxZ) → face south (+Z) → 0
//   South wall (z = +maxZ) → face north (-Z) → π
//   West  wall (x = -maxX) → face east  (+X) → -π/2
//   East  wall (x = +maxX) → face west  (-X) → +π/2
const WALL_ROTATION = {
  north: Math.PI,   // model front faces -Z; rotate π so it faces into room (+Z)
  south: 0,         // model front already faces into room (-Z toward north)
  west: -Math.PI / 2,  // front rotated to face +X (east, into room)
  east:  Math.PI / 2,  // front rotated to face -X (west, into room)
} as const;

export function findPlacement(
  room: RoomPreset,
  existing: PlacedItem[],
  newCatalogId: string,
): Placement {
  const entry = furnitureCatalog.find((e) => e.id === newCatalogId);
  const { width: iW, depth: iD } = entry?.footprint ?? { width: 0.6, depth: 0.6 };
  const rotOff = forwardToOffset[entry?.forward ?? 'north'];

  // Maximum centres so the item stays inside the room.
  const maxX = Math.max(0, room.width  / 2 - iW / 2 - WALL_MARGIN);
  const maxZ = Math.max(0, room.length / 2 - iD / 2 - WALL_MARGIN);

  // Build collision boxes for already-placed items, respecting their rotation.
  const existingBoxes = existing.map((item) => {
    const fp = footprintOf(item.catalogId);
    const { w, d } = rotatedFootprint(fp.width, fp.depth, item.rotationY);
    return boxAt(item.position[0], item.position[2], w, d);
  });

  function isFree(x: number, z: number): boolean {
    const candidate = boxAt(x, z, iW, iD);
    if (blocksDoor(candidate, room.length / 2)) return false;
    return existingBoxes.every((box) => !overlaps(candidate, box, ITEM_GAP));
  }

  // --- Wall-adjacent candidate generation ---
  // Interleave slots from all four walls so the room fills evenly,
  // rather than exhausting one wall completely before trying the next.
  // Each entry: [x, z, rotationY]
  const SAMPLES = 7;
  const northZ = -maxZ; // north wall (window side)
  const southZ =  maxZ; // south wall (door side)
  const westX  = -maxX;
  const eastX  =  maxX;

  const xSamples = wallSamples(maxX, SAMPLES);
  const zSamples = wallSamples(maxZ, SAMPLES);

  const northSlots: [number, number, number][] = xSamples.map((x) => [x, northZ, WALL_ROTATION.north + rotOff]);
  const southSlots: [number, number, number][] = xSamples.map((x) => [x, southZ, WALL_ROTATION.south + rotOff]);
  const westSlots:  [number, number, number][] = zSamples.map((z) => [westX, z,  WALL_ROTATION.west  + rotOff]);
  const eastSlots:  [number, number, number][] = zSamples.map((z) => [eastX, z,  WALL_ROTATION.east  + rotOff]);

  // Interleave: pick one slot from each wall in turn so placement spreads around the room.
  const wallCandidates: [number, number, number][] = [];
  const maxLen = Math.max(northSlots.length, southSlots.length, westSlots.length, eastSlots.length);
  for (let i = 0; i < maxLen; i++) {
    if (i < northSlots.length) wallCandidates.push(northSlots[i]);
    if (i < southSlots.length) wallCandidates.push(southSlots[i]);
    if (i < westSlots.length)  wallCandidates.push(westSlots[i]);
    if (i < eastSlots.length)  wallCandidates.push(eastSlots[i]);
  }

  for (const [x, z, rot] of wallCandidates) {
    if (isFree(x, z)) return { position: [x, 0, z], rotationY: rot };
  }

  // --- Interior grid fallback ---
  for (let x = -maxX; x <= maxX; x += GRID_STEP) {
    for (let z = -maxZ; z <= maxZ; z += GRID_STEP) {
      if (isFree(x, z)) return { position: [x, 0, z], rotationY: rotOff };
    }
  }

  // Last resort: room centre
  return { position: [0, 0, 0], rotationY: rotOff };
}
