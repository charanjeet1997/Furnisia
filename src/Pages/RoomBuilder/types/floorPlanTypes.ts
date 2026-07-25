import type { InteriorWall, RoomOpening, RoomVertex } from '../../../Data/RoomShape';

export type PlanUnits = 'm' | 'ft';

export type SnapTarget =
  | { host: 'boundary'; edgeIndex: number; t: number; point: RoomVertex }
  | { host: 'interior'; wallId: string; t: number; point: RoomVertex }
  | { host: 'vertex'; vertexIndex: number; point: RoomVertex };

export interface FloorPlanPreviewProps {
  vertices: RoomVertex[];
  openings?: RoomOpening[];
  onEdgeClick?: (edgeIndex: number) => string | void;
  highlightedEdgeIndex?: number | null;
  units?: PlanUnits;
  onEdgeDragStart?: (edgeIndex: number) => void;
  onEdgeDrag?: (edgeIndex: number, delta: number) => void;
  onEdgeDragEnd?: () => void;
  onVertexDragStart?: (vertexIndex: number) => void;
  onVertexDrag?: (vertexIndex: number, dx: number, dz: number) => void;
  onVertexDragEnd?: () => void;
  onEdgeLengthChange?: (edgeIndex: number, newLength: number) => void;
  onOpeningRemove?: (openingIndex: number) => void;
  onOpeningDragStart?: (openingIndex: number) => void;
  onOpeningDrag?: (openingIndex: number, delta: number) => void;
  onOpeningDragEnd?: () => void;
  onWallAdd?: (edgeIndex: number) => void;
  onVertexRemove?: (vertexIndex: number) => void;
  interiorWalls?: InteriorWall[];
  onInteriorWallRemove?: (id: string) => void;
  onInteriorWallSplit?: (id: string) => void;
  onInteriorWallClick?: (id: string) => string | void;
  edgeThicknesses?: number[];
  selectedEdgeIndex?: number | null;
  selectedInteriorWallId?: string | null;
  onInteriorWallDragStart?: (id: string) => void;
  onInteriorWallDrag?: (id: string, dx: number, dz: number) => void;
  onInteriorWallDragEnd?: () => void;
  onInteriorWallEndpointDragStart?: (wallId: string, end: 'start' | 'end') => void;
  onInteriorWallEndpointChange?: (
    wallId: string,
    end: 'start' | 'end',
    point: RoomVertex,
    attach: SnapTarget | null,
  ) => void;
  isEndpointAttached?: (wallId: string, end: 'start' | 'end') => boolean;
  onInteriorWallEndpointDetach?: (wallId: string, end: 'start' | 'end') => void;
  onFreeEndpointClick?: (wallId: string, end: 'start' | 'end', point: RoomVertex) => void;
  jointedEndpoints?: (wallId: string, end: 'start' | 'end') => { wallId: string; end: 'start' | 'end' }[];
  onWallDrawComplete?: (
    start: RoomVertex,
    end: RoomVertex,
    startSnap: SnapTarget | null,
    endSnap: SnapTarget | null,
  ) => void;
  onWallDrawCancel?: () => void;
}

export const PAD = 1.1;
export const WALL_STROKE = 0.18;
export const DIM_OFFSET = 0.45;
export const DIM_TICK = 0.12;
export const FLOOR_FILL = '#dcc49c';
export const SNAP_DISTANCE = 0.3;
export const ENDPOINT_SNAP_DISTANCE = 0.5;
export const WALL_HOVER_DISTANCE = 0.26;
export const HOVER_MENU_RADIUS = 0.6;

export const snapDraw = (v: number) => Math.round(v * 10) / 10;

export function formatLength(meters: number, units: PlanUnits): string {
  if (units === 'm') return `${meters.toFixed(1)}m`;
  const totalInches = meters * 39.3701;
  let feet = Math.floor(totalInches / 12);
  let inches = Math.round(totalInches - feet * 12);
  if (inches === 12) {
    feet += 1;
    inches = 0;
  }
  return `${feet}' ${inches}"`;
}

export function edgeCursor(normal: RoomVertex): string {
  if (Math.abs(normal.x) > 0.92) return 'ew-resize';
  if (Math.abs(normal.z) > 0.92) return 'ns-resize';
  return normal.x * normal.z > 0 ? 'nwse-resize' : 'nesw-resize';
}

export type DragState =
  | { kind: 'edge'; index: number; startX: number; startY: number; scale: number; normal: RoomVertex }
  | { kind: 'vertex'; index: number; startX: number; startY: number; scale: number }
  | { kind: 'opening'; index: number; startX: number; startY: number; scale: number; dir: RoomVertex }
  | { kind: 'interiorWall'; id: string; startX: number; startY: number; scale: number; normal: RoomVertex };
