import { useRef, useState } from 'react';
import { computeEdges, boundingBox } from '../../../Components/polygonGeometry';
import type { RoomOpening, RoomVertex } from '../../../Data/RoomShape';
import {
  type SnapTarget,
  type FloorPlanPreviewProps,
  PAD,
  WALL_STROKE,
  DIM_OFFSET,
  WALL_HOVER_DISTANCE,
  snapDraw,
} from '../types/floorPlanTypes';
import { findSnapTarget } from './useFloorPlanSnapping';
import { useFloorPlanPointer } from './useFloorPlanPointer';
import { toolRunner } from '../tools/ToolRunner';

export function useFloorPlanState(props: FloorPlanPreviewProps) {
  const {
    vertices,
    interiorWalls = [],
    edgeThicknesses,
    onEdgeDrag,
    onEdgeDragStart,
    onEdgeDragEnd,
    onVertexDrag,
    onVertexDragEnd,
    onInteriorWallDrag,
    onInteriorWallDragStart,
    onInteriorWallDragEnd,
    onOpeningDrag,
    onOpeningDragEnd,
    onEdgeLengthChange,
  } = props;

  const edges = computeEdges(vertices);
  const bbox = boundingBox([...vertices, ...interiorWalls.flatMap((w) => [w.start, w.end])]);

  const [draggingEndpoint, setDraggingEndpoint] = useState<{ wallId: string; end: 'start' | 'end'; origin: RoomVertex } | null>(null);
  const [endpointLive, setEndpointLive] = useState<RoomVertex | null>(null);
  const [endpointSnap, setEndpointSnap] = useState<SnapTarget | null>(null);
  const endpointPressRef = useRef(false);

  const width = bbox.maxX - bbox.minX;
  const depth = bbox.maxZ - bbox.minZ;
  const viewW = width + PAD * 2;
  const viewH = depth + PAD * 2;
  const fitViewBox = `${bbox.minX - PAD} ${bbox.minZ - PAD} ${viewW} ${viewH}`;
  const points = vertices.map((v) => `${v.x},${v.z}`).join(' ');

  const pointer = useFloorPlanPointer({
    fitViewBox,
    onEdgeDrag,
    onEdgeDragEnd,
    onVertexDrag,
    onVertexDragEnd,
    onInteriorWallDrag,
    onInteriorWallDragEnd,
    onOpeningDrag,
    onOpeningDragEnd,
    onEdgeLengthChange,
  });

  const findSnap = (
    p: RoomVertex,
    excludeWallId?: string,
    excludeTips?: { wallId: string; end: 'start' | 'end' }[],
  ) => findSnapTarget(p, vertices, edges, interiorWalls, excludeWallId, excludeTips);

  function openingHost(
    opening: RoomOpening,
  ): { start: RoomVertex; end: RoomVertex; length: number; normal: RoomVertex; thickness: number } | null {
    if (opening.interiorWallId) {
      const wall = interiorWalls.find((w) => w.id === opening.interiorWallId);
      if (!wall) return null;
      const dx = wall.end.x - wall.start.x;
      const dz = wall.end.z - wall.start.z;
      const length = Math.hypot(dx, dz);
      if (length < 1e-6) return null;
      return {
        start: wall.start,
        end: wall.end,
        length,
        normal: { x: dz / length, z: -dx / length },
        thickness: Math.max(wall.thickness ?? WALL_STROKE, 0.07),
      };
    }
    const edge = edges[opening.edgeIndex];
    if (!edge) return null;
    return { ...edge, thickness: Math.max(edgeThicknesses?.[opening.edgeIndex] ?? WALL_STROKE, 0.07) };
  }

  function clientToSvgPoint(clientX: number, clientY: number): { x: number; z: number } {
    const svg = pointer.svgRef.current;
    if (!svg) return { x: 0, z: 0 };
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, z: 0 };
    const p = pt.matrixTransform(ctm.inverse());
    return { x: snapDraw(p.x), z: snapDraw(p.y) };
  }

  let editBox: { left: number; top: number; angleDeg: number } | null = null;
  if (pointer.editingEdge !== null && edges[pointer.editingEdge]) {
    const edge = edges[pointer.editingEdge];
    const lx = edge.midpoint.x + edge.normal.x * (DIM_OFFSET + 0.28);
    const ly = edge.midpoint.z + edge.normal.z * (DIM_OFFSET + 0.28);
    const { left, top } = pointer.svgToLocalPx(lx, ly);
    let angleDeg = (Math.atan2(edge.end.z - edge.start.z, edge.end.x - edge.start.x) * 180) / Math.PI;
    if (angleDeg > 90 || angleDeg <= -90) angleDeg += 180;
    editBox = { left, top, angleDeg };
  }

  function handleCanvasPointerDown(e: React.PointerEvent<SVGSVGElement>) {
    if (pointer.dragRef.current) return;
    const p = clientToSvgPoint(e.clientX, e.clientY);
    const snapped = findSnap(p);
    const snapDist = snapped ? Math.hypot(p.x - snapped.point.x, p.z - snapped.point.z) : Infinity;


    if (!snapped || snapped.host === 'vertex' || snapDist >= WALL_HOVER_DISTANCE) return;
    if (snapped.host === 'boundary') {
      if (!onEdgeDrag) return;
      const normal = edges[snapped.edgeIndex]?.normal;
      if (!normal) return;
      toolRunner.setActiveTool('move', { point: snapped.point, snap: snapped, normal, canDelete: false, onDraw: () => {}, onDelete: () => {} }, e);
      pointer.beginDrag(e, { kind: 'edge', index: snapped.edgeIndex, startX: e.clientX, startY: e.clientY, scale: pointer.pxScale(), normal });
      onEdgeDragStart?.(snapped.edgeIndex);
    } else {
      if (!onInteriorWallDrag) return;
      const wall = interiorWalls.find((w) => w.id === snapped.wallId);
      if (!wall) return;
      const wdx = wall.end.x - wall.start.x;
      const wdz = wall.end.z - wall.start.z;
      const wlen = Math.hypot(wdx, wdz) || 1;
      const normal = { x: wdz / wlen, z: -wdx / wlen };
      toolRunner.setActiveTool('move', { point: snapped.point, snap: snapped, normal, canDelete: true, onDraw: () => {}, onDelete: () => {} }, e);
      pointer.beginDrag(e, {
        kind: 'interiorWall',
        id: snapped.wallId,
        startX: e.clientX,
        startY: e.clientY,
        scale: pointer.pxScale(),
        normal,
      });
      onInteriorWallDragStart?.(snapped.wallId);
    }
  }

  return {
    edges,
    points,
    draggingEndpoint,
    setDraggingEndpoint,
    endpointLive,
    setEndpointLive,
    endpointSnap,
    setEndpointSnap,
    endpointPressRef,
    pointer,
    findSnap,
    openingHost,
    clientToSvgPoint,
    editBox,
    handleCanvasPointerDown,
  };
}
