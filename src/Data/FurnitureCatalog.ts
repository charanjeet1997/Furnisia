export type FurnitureCategory = 'Seating' | 'Tables' | 'Storage' | 'Bedroom' | 'Lighting' | 'Decor' | 'Doors & Windows';

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
  // Measured from each glb's own bounding box; used for smart initial placement before
  // the model has actually loaded. FurnitureModel re-measures precisely at render time.
  footprint: Footprint;
  // Which direction the model's visual front faces at rotationY = 0 (as exported).
  // 'north' = -Z, 'south' = +Z, 'east' = +X, 'west' = -X
  forward: ModelForward;
}

export const furnitureCatalog: FurnitureCatalogItem[] = [
  //                                                                                                           forward: which way the model's front faces at default rotation
  { id: 'sofa',         name: 'Sofa',         category: 'Seating',  modelPath: '/assets/GLB/loungeDesignSofa.glb', footprint: { width: 1.12, depth: 0.41 }, forward: 'south' },
  { id: 'coffee-table', name: 'Coffee Table', category: 'Tables',   modelPath: '/assets/GLB/tableCoffee.glb',      footprint: { width: 0.66, depth: 0.4  }, forward: 'north' },
  { id: 'shelf',        name: 'Shelf',        category: 'Storage',  modelPath: '/assets/GLB/bookcaseOpen.glb',     footprint: { width: 0.4,  depth: 0.25 }, forward: 'north' },
  { id: 'bed',          name: 'Bed',          category: 'Bedroom',  modelPath: '/assets/GLB/bedDouble.glb',        footprint: { width: 1.62, depth: 1.91 }, forward: 'south' },
  { id: 'floor-lamp',   name: 'Floor Lamp',   category: 'Lighting', modelPath: '/assets/GLB/lampSquareFloor.glb',  footprint: { width: 0.12, depth: 0.12 }, forward: 'north' },
  { id: 'plant',        name: 'Plant',        category: 'Decor',    modelPath: '/assets/GLB/pottedPlant.glb',      footprint: { width: 0.26, depth: 0.29 }, forward: 'north' },
  { id: 'door-single',  name: 'Single Door',  category: 'Doors & Windows', modelPath: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/SheenChair/glTF-Binary/SheenChair.glb', footprint: { width: 0.9, depth: 0.15 }, forward: 'south' },
  { id: 'window-single', name: 'Glass Window', category: 'Doors & Windows', modelPath: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/Avocado/glTF-Binary/Avocado.glb', footprint: { width: 1.0, depth: 0.15 }, forward: 'south' },
];

export const furnitureCategories: FurnitureCategory[] = [
  'Seating',
  'Tables',
  'Storage',
  'Bedroom',
  'Lighting',
  'Decor',
  'Doors & Windows',
];
