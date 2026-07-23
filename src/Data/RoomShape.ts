export interface RoomVertex {
  x: number;
  z: number;
}

export type OpeningKind = 'door' | 'window';

export interface RoomOpening {
  // `edgeIndex` is the BOUNDARY wall this opening sits on — used only when `interiorWallId`
  // is unset. Kept as a plain required number (rather than folding both into one union) so
  // existing saved rooms, which only ever had boundary openings, still parse unchanged.
  edgeIndex: number;
  // When set, this opening belongs to a free-standing interior wall instead of the boundary;
  // `edgeIndex` is ignored in that case.
  interiorWallId?: string;
  offset: number; // distance from the wall's start vertex, meters, along the wall
  width: number;
  kind: OpeningKind;
  style: string; // key into DOOR_STYLES / WINDOW_STYLES (src/Data/OpeningStyles.ts)
}

// A free-standing interior wall (partition) — independent of the room's boundary polygon.
// Drawing one never touches `vertices`; it's purely additive.
export interface InteriorWall {
  id: string;
  start: RoomVertex;
  end: RoomVertex;
}

export interface RoomShape {
  id: string;
  name: string;
  vertices: RoomVertex[]; // ordered, closed polygon footprint
  height: number;
  wallThickness: number;
  wallColor: string;
  floorColor: string;
  openings: RoomOpening[];
  interiorWalls: InteriorWall[];
}

export type RoomShapeType = 'rectangular' | 'l-shape' | 't-shape' | 'u-shape' | 'cut' | 'beveled';

export const DEFAULT_HEIGHT = 2.5;
export const DEFAULT_WALL_THICKNESS = 0.1;
export const DEFAULT_WALL_COLOR = '#f5f0e6';
export const DEFAULT_FLOOR_COLOR = '#c9a978';

// Shifts a vertex list so its bounding box is centered at the origin — every generator below
// builds in whatever local frame is convenient (usually top-left origin, x right, z down) and
// centers at the end, so the room is always positioned the same way relative to the camera.
// Exported because the wizard re-centers after free-form wall/corner dragging too.
export function centerVertices(vertices: RoomVertex[]): RoomVertex[] {
  const xs = vertices.map((v) => v.x);
  const zs = vertices.map((v) => v.z);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cz = (Math.min(...zs) + Math.max(...zs)) / 2;
  return vertices.map((v) => ({ x: v.x - cx, z: v.z - cz }));
}

export interface RectangleParams {
  width: number;
  depth: number;
}
export function makeRectangle({ width, depth }: RectangleParams): RoomVertex[] {
  return centerVertices([
    { x: 0, z: 0 },
    { x: width, z: 0 },
    { x: width, z: depth },
    { x: 0, z: depth },
  ]);
}

export interface LShapeParams {
  width: number;
  depth: number;
  notchWidth: number;
  notchDepth: number;
}
export function makeLShape({ width, depth, notchWidth, notchDepth }: LShapeParams): RoomVertex[] {
  return centerVertices([
    { x: 0, z: 0 },
    { x: width, z: 0 },
    { x: width, z: depth - notchDepth },
    { x: width - notchWidth, z: depth - notchDepth },
    { x: width - notchWidth, z: depth },
    { x: 0, z: depth },
  ]);
}

export interface TShapeParams {
  width: number;
  barDepth: number;
  stemWidth: number;
  stemDepth: number;
}
export function makeTShape({ width, barDepth, stemWidth, stemDepth }: TShapeParams): RoomVertex[] {
  const stemLeft = (width - stemWidth) / 2;
  const stemRight = stemLeft + stemWidth;
  return centerVertices([
    { x: 0, z: 0 },
    { x: width, z: 0 },
    { x: width, z: barDepth },
    { x: stemRight, z: barDepth },
    { x: stemRight, z: barDepth + stemDepth },
    { x: stemLeft, z: barDepth + stemDepth },
    { x: stemLeft, z: barDepth },
    { x: 0, z: barDepth },
  ]);
}

export interface UShapeParams {
  width: number;
  depth: number;
  legWidth: number;
  notchDepth: number;
}
export function makeUShape({ width, depth, legWidth, notchDepth }: UShapeParams): RoomVertex[] {
  return centerVertices([
    { x: 0, z: depth },
    { x: 0, z: 0 },
    { x: legWidth, z: 0 },
    { x: legWidth, z: notchDepth },
    { x: width - legWidth, z: notchDepth },
    { x: width - legWidth, z: 0 },
    { x: width, z: 0 },
    { x: width, z: depth },
  ]);
}

export interface CutParams {
  width: number;
  depth: number;
  cutSize: number;
}
export function makeCut({ width, depth, cutSize }: CutParams): RoomVertex[] {
  return centerVertices([
    { x: 0, z: 0 },
    { x: width - cutSize, z: 0 },
    { x: width, z: cutSize },
    { x: width, z: depth },
    { x: 0, z: depth },
  ]);
}

export interface BeveledParams {
  width: number;
  depth: number;
  bevel: number;
}
export function makeBeveled({ width, depth, bevel }: BeveledParams): RoomVertex[] {
  return centerVertices([
    { x: bevel, z: 0 },
    { x: width - bevel, z: 0 },
    { x: width, z: bevel },
    { x: width, z: depth - bevel },
    { x: width - bevel, z: depth },
    { x: bevel, z: depth },
    { x: 0, z: depth - bevel },
    { x: 0, z: bevel },
  ]);
}

// Shape-specific size params, keyed generically so the wizard's Step 2 can render a plain
// set of number inputs without knowing which shape it's editing.
export type ShapeParams = Record<string, number>;

// Sensible starting params per shape — the source of truth for both the wizard's initial
// state and any instant shortcuts (defaultRoom, roomPresets below all use 'rectangular').
export const SHAPE_DEFAULT_PARAMS: Record<RoomShapeType, ShapeParams> = {
  rectangular: { width: 4, depth: 4 },
  'l-shape': { width: 5, depth: 5, notchWidth: 2, notchDepth: 2 },
  't-shape': { width: 5, barDepth: 2, stemWidth: 2.5, stemDepth: 3 },
  'u-shape': { width: 5, depth: 4, legWidth: 1.5, notchDepth: 2 },
  cut: { width: 4.5, depth: 4.5, cutSize: 1.5 },
  beveled: { width: 4.5, depth: 4.5, bevel: 1 },
};

// Human-readable label per param key, for Step 2's number inputs.
export const SHAPE_PARAM_LABELS: Record<string, string> = {
  width: 'Width (m)',
  depth: 'Depth (m)',
  barDepth: 'Top bar depth (m)',
  stemWidth: 'Stem width (m)',
  stemDepth: 'Stem depth (m)',
  legWidth: 'Leg width (m)',
  notchWidth: 'Notch width (m)',
  notchDepth: 'Notch depth (m)',
  cutSize: 'Cut size (m)',
  bevel: 'Bevel size (m)',
};

// Dispatches to the right generator for a given shape type + params — the single place that
// knows how to turn wizard state into an actual polygon.
export function generateVertices(shapeType: RoomShapeType, params: ShapeParams): RoomVertex[] {
  switch (shapeType) {
    case 'rectangular':
      return makeRectangle({ width: params.width, depth: params.depth });
    case 'l-shape':
      return makeLShape({ width: params.width, depth: params.depth, notchWidth: params.notchWidth, notchDepth: params.notchDepth });
    case 't-shape':
      return makeTShape({ width: params.width, barDepth: params.barDepth, stemWidth: params.stemWidth, stemDepth: params.stemDepth });
    case 'u-shape':
      return makeUShape({ width: params.width, depth: params.depth, legWidth: params.legWidth, notchDepth: params.notchDepth });
    case 'cut':
      return makeCut({ width: params.width, depth: params.depth, cutSize: params.cutSize });
    case 'beveled':
      return makeBeveled({ width: params.width, depth: params.depth, bevel: params.bevel });
    default:
      return makeRectangle({ width: 4, depth: 4 });
  }
}

export const SHAPE_DEFAULTS: Record<RoomShapeType, RoomVertex[]> = Object.fromEntries(
  (Object.keys(SHAPE_DEFAULT_PARAMS) as RoomShapeType[]).map((type) => [type, generateVertices(type, SHAPE_DEFAULT_PARAMS[type])]),
) as Record<RoomShapeType, RoomVertex[]>;

export const SHAPE_LABELS: Record<RoomShapeType, string> = {
  rectangular: 'Rectangular',
  'l-shape': 'L-Shape',
  cut: 'Cut',
  't-shape': 'T-Shape',
  'u-shape': 'U-Shape',
  beveled: 'Beveled',
};

// Default openings for a plain rectangle built by makeRectangle: edge 2 (the "far" edge,
// z = +depth/2 after centering) gets a door, edge 0 (z = -depth/2) gets a window — matches
// the fixed south-door/north-window layout the app used before the wizard existed.
export function defaultRectangleOpenings(width: number): RoomOpening[] {
  return [
    { edgeIndex: 2, offset: width / 2 - 0.45, width: 0.9, kind: 'door', style: 'single-panel' },
    { edgeIndex: 0, offset: width / 2 - 0.5, width: 1.0, kind: 'window', style: 'glass-single' },
  ];
}

export function makeDefaultRoomShape(id: string, name: string, width: number, depth: number): RoomShape {
  return {
    id,
    name,
    vertices: makeRectangle({ width, depth }),
    height: DEFAULT_HEIGHT,
    wallThickness: DEFAULT_WALL_THICKNESS,
    wallColor: DEFAULT_WALL_COLOR,
    floorColor: DEFAULT_FLOOR_COLOR,
    openings: defaultRectangleOpenings(width),
    interiorWalls: [],
  };
}

// Named + sized to match the design spec's preset list (dimensions given there in feet,
// converted to meters here since RoomVertex/makeRectangle work in meters throughout).
export const roomPresets: RoomShape[] = [
  makeDefaultRoomShape('studio-apartment', 'Studio Apartment', 6.1, 7.3), // 20 × 24 ft
  makeDefaultRoomShape('living-room', 'Living Room', 5.5, 6.1), // 18 × 20 ft
  makeDefaultRoomShape('master-bedroom', 'Master Bedroom', 4.3, 4.9), // 14 × 16 ft
  makeDefaultRoomShape('home-office', 'Home Office', 3.0, 3.7), // 10 × 12 ft
  makeDefaultRoomShape('open-kitchen', 'Open Kitchen', 4.9, 5.5), // 16 × 18 ft
  makeDefaultRoomShape('kids-bedroom', 'Kids Bedroom', 3.7, 3.7), // 12 × 12 ft
];

export const defaultRoom: RoomShape = makeDefaultRoomShape('custom', 'Custom Room', 4, 4);

export function sqFt(vertices: RoomVertex[]): number {
  // Shoelace formula for polygon area (works for any simple polygon, not just rectangles).
  let area = 0;
  for (let i = 0; i < vertices.length; i++) {
    const a = vertices[i];
    const b = vertices[(i + 1) % vertices.length];
    area += a.x * b.z - b.x * a.z;
  }
  return Math.round((Math.abs(area) / 2) * 10.7639);
}

const METERS_TO_FEET = 3.28084;

// "20 × 24 ft" style label from the room's bounding box — matches how preset cards label
// dimensions in the design spec (width × depth, not total area).
export function footprintFt(vertices: RoomVertex[]): string {
  const xs = vertices.map((v) => v.x);
  const zs = vertices.map((v) => v.z);
  const width = Math.round((Math.max(...xs) - Math.min(...xs)) * METERS_TO_FEET);
  const depth = Math.round((Math.max(...zs) - Math.min(...zs)) * METERS_TO_FEET);
  return `${width} × ${depth} ft`;
}
