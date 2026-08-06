import rawCatalog from './furnitureCatalog.json';

export type FurnitureCategory = 'Seating' | 'Tables' | 'Storage' | 'Bedroom' | 'Lighting' | 'Decor';

export interface Footprint {
  width: number; // meters, along local X
  depth: number; // meters, along local Z
}

// The axis the model's visual front faces at rotationY = 0 (i.e. as exported).
// Used by findPlacement to compute the rotation needed to make the item face into the room.
export type ModelForward = 'north' | 'south' | 'east' | 'west';

export interface FurnitureCatalogItem {
  id: string;
  name: string;
  category: FurnitureCategory;
  modelPath: string;
  thumbnailPath?: string;
  footprint: Footprint;
  forward: ModelForward;
}

export const furnitureCatalog: FurnitureCatalogItem[] = rawCatalog as FurnitureCatalogItem[];

export const furnitureCategories: FurnitureCategory[] = [
  'Seating',
  'Tables',
  'Storage',
  'Bedroom',
  'Lighting',
  'Decor',
];



