import type { RoomPreset } from '../Data/RoomPresets';
import { furnitureCatalog } from '../Data/FurnitureCatalog';
import type { PlacedItem } from './plannerStore';

const WALL_MARGIN = 0.05; // matches FurnitureModel's own wall clamp margin
const ITEM_GAP = 0.1; // minimum breathing room between two pieces of furniture
const GRID_STEP = 0.5;
const WALL_SAMPLES = 5;

interface Box {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

function footprintOf(catalogId: string) {
  return furnitureCatalog.find((entry) => entry.id === catalogId)?.footprint ?? { width: 0.6, depth: 0.6 };
}

function boxAt(cx: number, cz: number, width: number, depth: number): Box {
  return { minX: cx - width / 2, maxX: cx + width / 2, minZ: cz - depth / 2, maxZ: cz + depth / 2 };
}

function overlaps(a: Box, b: Box, gap: number) {
  return a.minX < b.maxX + gap && a.maxX > b.minX - gap && a.minZ < b.maxZ + gap && a.maxZ > b.minZ - gap;
}

// Picks a spot for a newly added item that doesn't overlap what's already placed,
// biased toward empty wall-adjacent spots first (closer to how a real room fills up)
// before falling back to an interior grid search.
export function findPlacement(room: RoomPreset, existing: PlacedItem[], newCatalogId: string): [number, number, number] {
  const { width: itemWidth, depth: itemDepth } = footprintOf(newCatalogId);

  const maxX = Math.max(0, room.width / 2 - itemWidth / 2 - WALL_MARGIN);
  const maxZ = Math.max(0, room.length / 2 - itemDepth / 2 - WALL_MARGIN);

  const existingBoxes = existing.map((item) => {
    const fp = footprintOf(item.catalogId);
    return boxAt(item.position[0], item.position[2], fp.width, fp.depth);
  });

  function isFree(x: number, z: number) {
    const candidate = boxAt(x, z, itemWidth, itemDepth);
    return existingBoxes.every((box) => !overlaps(candidate, box, ITEM_GAP));
  }

  // Center of the wall first, then alternating outward, so a single item lands centered
  // and only shifts aside once that spot is taken.
  const spread = (max: number) => {
    if (max <= 0) return [0];
    const step = (max * 0.8) / Math.ceil((WALL_SAMPLES - 1) / 2);
    const offsets = [0];
    for (let i = 1; i <= Math.floor(WALL_SAMPLES / 2); i++) {
      offsets.push(i * step, -i * step);
    }
    return offsets;
  };

  const candidates: [number, number][] = [];
  for (const x of spread(maxX)) candidates.push([x, -maxZ]); // along north wall
  for (const x of spread(maxX)) candidates.push([x, maxZ]); // along south wall
  for (const z of spread(maxZ)) candidates.push([-maxX, z]); // along west wall
  for (const z of spread(maxZ)) candidates.push([maxX, z]); // along east wall

  for (let x = -maxX; x <= maxX; x += GRID_STEP) {
    for (let z = -maxZ; z <= maxZ; z += GRID_STEP) {
      candidates.push([x, z]);
    }
  }

  for (const [x, z] of candidates) {
    if (isFree(x, z)) return [x, 0, z];
  }

  return [0, 0, 0];
}
