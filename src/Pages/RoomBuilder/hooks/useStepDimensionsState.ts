import { useRef, useState } from 'react';
import { computeEdges, pointInPolygon, type WallEdge } from '../../../Components/polygonGeometry';
import { DEFAULT_WALL_THICKNESS, type InteriorWall, type RoomOpening, type RoomVertex } from '../../../Data/RoomShape';
import type { PlanUnits } from '../types/floorPlanTypes';
import {
  MIN_EDGE,
  snap,
  edgesValid,
  insertEdgeThickness,
  removeEdgeThickness,
  remapOpeningsForEdgeSplit,
  remapOpeningsForVertexRemove,
  type Attachments,
} from '../utils/interiorWallGeometry';
import { useWallJoints } from './useWallJoints';
import { useWallHistory } from './useWallHistory';
import { useWallAttachments } from './useWallAttachments';
import { useWallExtrusion } from './useWallExtrusion';
import { useInteriorWallActions } from './useInteriorWallActions';

export interface StepDimensionsStateProps {
  vertices: RoomVertex[];
  onVerticesChange: (vertices: RoomVertex[]) => void;
  height: number;
  onHeightChange: (height: number) => void;
  edgeThicknesses: number[];
  onEdgeThicknessesChange: (thicknesses: number[]) => void;
  interiorWalls: InteriorWall[];
  onInteriorWallsChange: (walls: InteriorWall[]) => void;
  openings: RoomOpening[];
  onOpeningsChange: (openings: RoomOpening[]) => void;
}

export function useStepDimensionsState({
  vertices,
  onVerticesChange,
  edgeThicknesses,
  onEdgeThicknessesChange,
  interiorWalls,
  onInteriorWallsChange,
  openings,
  onOpeningsChange,
}: StepDimensionsStateProps) {
  const [units, setUnits] = useState<PlanUnits>('m');
  const dragStart = useRef<{ vertices: RoomVertex[]; edges: WallEdge[] } | null>(null);
  const interiorDragStart = useRef<InteriorWall | null>(null);
  const [selected, setSelected] = useState<{ kind: 'edge'; index: number } | { kind: 'interior'; id: string } | null>(null);

  const {
    attachments,
    setAttachments,
    isEndpointAttached,
    shiftAttachmentsForInsert,
    shiftAttachmentsForRemove,
    syncAttachedWalls: syncAttachedWallsCore,
  } = useWallAttachments();

  const { joints, setJoints, jointMembers, joinEndpoints, leaveJoint, remapJointMember } = useWallJoints();

  const { history, pushHistory, undo } = useWallHistory({
    vertices,
    interiorWalls,
    openings,
    edgeThicknesses,
    attachments,
    joints,
    onVerticesChange,
    onInteriorWallsChange,
    onOpeningsChange,
    onEdgeThicknessesChange,
    setAttachments,
    setJoints,
    setSelected,
  });

  const normalizedThicknesses = () => vertices.map((_, i) => edgeThicknesses[i] ?? DEFAULT_WALL_THICKNESS);
  const syncAttachedWalls = (nextVertices: RoomVertex[]) => syncAttachedWallsCore(nextVertices, interiorWalls, onInteriorWallsChange);

  useWallExtrusion({
    vertices,
    onVerticesChange,
    interiorWalls,
    onInteriorWallsChange,
    openings,
    onOpeningsChange,
    edgeThicknesses,
    onEdgeThicknessesChange,
    attachments,
    setAttachments,
    joints,
    setJoints,
    jointMembers,
    joinEndpoints,
    pushHistory,
    normalizedThicknesses,
  });

  const interiorActions = useInteriorWallActions({
    vertices,
    onVerticesChange,
    interiorWalls,
    onInteriorWallsChange,
    openings,
    onOpeningsChange,
    edgeThicknesses,
    onEdgeThicknessesChange,
    attachments,
    setAttachments,
    shiftAttachmentsForInsert,
    jointMembers,
    joinEndpoints,
    leaveJoint,
    remapJointMember,
    pushHistory,
    normalizedThicknesses,
  });

  function beginDrag() {
    pushHistory();
    dragStart.current = { vertices, edges: computeEdges(vertices) };
  }

  function endDrag() {
    dragStart.current = null;
  }

  function addWall(edgeIndex: number) {
    const edge = computeEdges(vertices)[edgeIndex];
    if (!edge || edge.length < MIN_EDGE * 2) return;
    const mid = { x: snap(edge.midpoint.x), z: snap(edge.midpoint.z) };
    const insertedAt = edgeIndex + 1;
    const next = [...vertices.slice(0, insertedAt), mid, ...vertices.slice(insertedAt)];
    pushHistory();
    onVerticesChange(next);
    shiftAttachmentsForInsert(insertedAt);
    onOpeningsChange(remapOpeningsForEdgeSplit(openings, edge, edgeIndex, [mid]));
    onEdgeThicknessesChange(insertEdgeThickness(normalizedThicknesses(), insertedAt));
    setSelected(null);
  }

  function removeVertex(vertexIndex: number) {
    if (vertices.length <= 3) return;
    const next = vertices.filter((_, i) => i !== vertexIndex);
    if (edgesValid(next)) {
      pushHistory();
      onVerticesChange(next);
      shiftAttachmentsForRemove(vertexIndex);
      onOpeningsChange(remapOpeningsForVertexRemove(openings, computeEdges(vertices), vertexIndex));
      onEdgeThicknessesChange(removeEdgeThickness(normalizedThicknesses(), vertexIndex));
      setSelected(null);
    }
  }

  function handleEdgeDrag(edgeIndex: number, delta: number) {
    const start = dragStart.current;
    if (!start) return;
    const n = start.vertices.length;
    const { normal } = start.edges[edgeIndex];
    const d = snap(delta);
    const next = start.vertices.map((v, vi) =>
      vi === edgeIndex || vi === (edgeIndex + 1) % n
        ? { x: snap(v.x + normal.x * d), z: snap(v.z + normal.z * d) }
        : v,
    );
    if (edgesValid(next)) {
      onVerticesChange(next);
      syncAttachedWalls(next);
    }
  }

  function handleVertexDrag(vertexIndex: number, dx: number, dz: number) {
    const start = dragStart.current;
    if (!start) return;
    const v = start.vertices[vertexIndex];
    const next = start.vertices.map((sv, vi) =>
      vi === vertexIndex ? { x: snap(v.x + dx), z: snap(v.z + dz) } : sv,
    );
    if (edgesValid(next)) {
      onVerticesChange(next);
      syncAttachedWalls(next);
    }
  }

  function handleEdgeLengthChange(edgeIndex: number, newLength: number) {
    const n = vertices.length;
    const edge = computeEdges(vertices)[edgeIndex];
    const dirX = (edge.end.x - edge.start.x) / edge.length;
    const dirZ = (edge.end.z - edge.start.z) / edge.length;
    const endIdx = (edgeIndex + 1) % n;
    const next = vertices.map((v, vi) =>
      vi === endIdx
        ? { x: snap(edge.start.x + dirX * newLength), z: snap(edge.start.z + dirZ * newLength) }
        : v,
    );
    if (edgesValid(next)) {
      pushHistory();
      onVerticesChange(next);
      syncAttachedWalls(next);
    }
  }

  function handleInteriorWallDragStart(id: string) {
    pushHistory();
    interiorDragStart.current = interiorWalls.find((w) => w.id === id) ?? null;
  }

  function handleInteriorWallDrag(id: string, dx: number, dz: number) {
    const orig = interiorDragStart.current;
    if (!orig || orig.id !== id) return;
    const wallDx = orig.end.x - orig.start.x;
    const wallDz = orig.end.z - orig.start.z;
    const isMoreVertical = Math.abs(wallDz) > Math.abs(wallDx);
    const sdx = isMoreVertical ? snap(dx) : 0;
    const sdz = isMoreVertical ? 0 : snap(dz);
    const newStart = { x: snap(orig.start.x + sdx), z: snap(orig.start.z + sdz) };
    const newEnd   = { x: snap(orig.end.x   + sdx), z: snap(orig.end.z   + sdz) };

    const mid = { x: (newStart.x + newEnd.x) / 2, z: (newStart.z + newEnd.z) / 2 };
    const INSET = 0.02;
    const segLen = Math.hypot(newEnd.x - newStart.x, newEnd.z - newStart.z) || 0;
    const checkPts =
      segLen < INSET * 2
        ? [mid]
        : [
            { x: newStart.x + ((mid.x - newStart.x) / segLen) * INSET, z: newStart.z + ((mid.z - newStart.z) / segLen) * INSET },
            mid,
            { x: newEnd.x   + ((mid.x - newEnd.x)   / segLen) * INSET, z: newEnd.z   + ((mid.z - newEnd.z)   / segLen) * INSET },
          ];
    if (checkPts.some((p) => !pointInPolygon(vertices, p.x, p.z))) return;

    const updates = new Map<string, Partial<InteriorWall>>();
    function applyPoint(wallId: string, end: 'start' | 'end', point: RoomVertex) {
      updates.set(wallId, { ...updates.get(wallId), [end]: point });
    }
    applyPoint(id, 'start', newStart);
    for (const m of jointMembers(id, 'start')) applyPoint(m.wallId, m.end, newStart);
    applyPoint(id, 'end', newEnd);
    for (const m of jointMembers(id, 'end')) applyPoint(m.wallId, m.end, newEnd);
    onInteriorWallsChange(interiorWalls.map((w) => (updates.has(w.id) ? { ...w, ...updates.get(w.id) } : w)));
  }

  function handleInteriorWallDragEnd() {
    const orig = interiorDragStart.current;
    interiorDragStart.current = null;
    if (!orig) return;

    const att = attachments[orig.id];
    let atts: Attachments = { ...attachments };
    delete atts[orig.id];

    let verts = vertices;
    let openingsNow = openings;
    let thicknesses = normalizedThicknesses();

    const candidates = ([att?.start?.vertexIndex, att?.end?.vertexIndex] as (number | undefined)[])
      .filter((v): v is number => v !== undefined)
      .sort((a, b) => b - a);

    for (const vi of candidates) {
      if (verts.length <= 3) break;
      const nv = verts.length;
      const prev = verts[(vi - 1 + nv) % nv];
      const cur  = verts[vi];
      const next = verts[(vi + 1) % nv];
      const cross = (cur.x - prev.x) * (next.z - prev.z) - (cur.z - prev.z) * (next.x - prev.x);
      if (Math.abs(cross) > 0.01) continue;
      const stillUsed = Object.values(atts).some(
        (a) => a.start?.vertexIndex === vi || a.end?.vertexIndex === vi,
      );
      if (stillUsed) continue;

      openingsNow = remapOpeningsForVertexRemove(openingsNow, computeEdges(verts), vi);
      thicknesses = removeEdgeThickness(thicknesses, vi);
      verts = verts.filter((_, i) => i !== vi);

      const shiftAtt = (a?: { vertexIndex: number }) =>
        !a ? undefined : { vertexIndex: a.vertexIndex > vi ? a.vertexIndex - 1 : a.vertexIndex };
      const shifted: Attachments = {};
      for (const [wid, a] of Object.entries(atts)) {
        const s = { start: shiftAtt(a.start), end: shiftAtt(a.end) };
        if (s.start || s.end) shifted[wid] = s;
      }
      atts = shifted;
    }

    const RESNAP_RADIUS = 0.12;
    const movedWall = interiorWalls.find((w) => w.id === orig.id);
    if (movedWall) {
      for (const endName of ['start', 'end'] as const) {
        const pt = endName === 'start' ? movedWall.start : movedWall.end;
        let bestDist = RESNAP_RADIUS;
        type SnapResult =
          | { kind: 'vertex'; vertexIndex: number }
          | { kind: 'insert'; insertAt: number; point: RoomVertex };
        let snapResult: SnapResult | null = null;

        const nv = verts.length;
        for (let ei = 0; ei < nv; ei++) {
          const es = verts[ei];
          const ee = verts[(ei + 1) % nv];
          const abx = ee.x - es.x;
          const abz = ee.z - es.z;
          const lenSq = abx * abx + abz * abz || 1;
          const t = Math.max(0, Math.min(1, ((pt.x - es.x) * abx + (pt.z - es.z) * abz) / lenSq));
          const sx = es.x + abx * t;
          const sz = es.z + abz * t;
          const dist = Math.hypot(pt.x - sx, pt.z - sz);
          if (dist < bestDist) {
            bestDist = dist;
            const EPS = 0.02;
            if (t < EPS) snapResult = { kind: 'vertex', vertexIndex: ei };
            else if (t > 1 - EPS) snapResult = { kind: 'vertex', vertexIndex: (ei + 1) % nv };
            else snapResult = { kind: 'insert', insertAt: ei + 1, point: { x: sx, z: sz } };
          }
        }

        if (!snapResult) continue;

        if (snapResult.kind === 'vertex') {
          atts[orig.id] = { ...atts[orig.id], [endName]: { vertexIndex: snapResult.vertexIndex } };
        } else {
          const { insertAt, point } = snapResult;
          const edgeForRemap = computeEdges(verts)[insertAt - 1];
          verts = [...verts.slice(0, insertAt), point, ...verts.slice(insertAt)];
          thicknesses = insertEdgeThickness(thicknesses, insertAt);
          openingsNow = remapOpeningsForEdgeSplit(openingsNow, edgeForRemap, insertAt - 1, [point]);
          const shiftIns = (a?: { vertexIndex: number }) =>
            !a ? undefined : { vertexIndex: a.vertexIndex >= insertAt ? a.vertexIndex + 1 : a.vertexIndex };
          const shiftedIns: Attachments = {};
          for (const [wid, a] of Object.entries(atts)) {
            shiftedIns[wid] = { start: shiftIns(a.start), end: shiftIns(a.end) };
          }
          atts = shiftedIns;
          atts[orig.id] = { ...atts[orig.id], [endName]: { vertexIndex: insertAt } };
        }
      }
    }

    setAttachments(atts);
    if (verts !== vertices) {
      onVerticesChange(verts);
      onEdgeThicknessesChange(thicknesses);
    }
    if (openingsNow !== openings) onOpeningsChange(openingsNow);
  }

  return {
    units,
    setUnits,
    selected,
    setSelected,
    history,
    pushHistory,
    undo,
    normalizedThicknesses,
    beginDrag,
    endDrag,
    addWall,
    removeVertex,
    handleEdgeDrag,
    handleVertexDrag,
    handleEdgeLengthChange,
    handleInteriorWallDragStart,
    handleInteriorWallDrag,
    handleInteriorWallDragEnd,
    isEndpointAttached,
    jointMembers,
    interiorActions,
  };
}
