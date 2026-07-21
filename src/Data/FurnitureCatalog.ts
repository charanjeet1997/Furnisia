export type FurnitureCategory = 'Seating' | 'Tables' | 'Storage' | 'Bedroom' | 'Lighting' | 'Decor';

export interface Footprint {
  width: number; // meters, along local X
  depth: number; // meters, along local Z
}

export interface FurnitureCatalogItem {
  id: string;
  name: string;
  category: FurnitureCategory;
  modelPath: string;
  // Measured from each glb's own bounding box; used for smart initial placement before
  // the model has actually loaded. FurnitureModel re-measures precisely at render time.
  footprint: Footprint;
}

export const furnitureCatalog: FurnitureCatalogItem[] = [
  { id: 'sofa', name: 'Sofa', category: 'Seating', modelPath: '/assets/GLB/loungeDesignSofa.glb', footprint: { width: 1.12, depth: 0.41 } },
  { id: 'coffee-table', name: 'Coffee Table', category: 'Tables', modelPath: '/assets/GLB/tableCoffee.glb', footprint: { width: 0.66, depth: 0.4 } },
  { id: 'shelf', name: 'Shelf', category: 'Storage', modelPath: '/assets/GLB/bookcaseOpen.glb', footprint: { width: 0.4, depth: 0.25 } },
  { id: 'bed', name: 'Bed', category: 'Bedroom', modelPath: '/assets/GLB/bedDouble.glb', footprint: { width: 1.62, depth: 1.91 } },
  { id: 'floor-lamp', name: 'Floor Lamp', category: 'Lighting', modelPath: '/assets/GLB/lampSquareFloor.glb', footprint: { width: 0.12, depth: 0.12 } },
  { id: 'plant', name: 'Plant', category: 'Decor', modelPath: '/assets/GLB/pottedPlant.glb', footprint: { width: 0.26, depth: 0.29 } },
];

export const furnitureCategories: FurnitureCategory[] = [
  'Seating',
  'Tables',
  'Storage',
  'Bedroom',
  'Lighting',
  'Decor',
];
