import { useRef } from 'react';
import { computeEdges } from '../../../Components/polygonGeometry';
import type { InteriorWall, RoomOpening, RoomVertex } from '../../../Data/RoomShape';
import type { SnapTarget } from '../types/floorPlanTypes';
import type { Attachments } from '../utils/interiorWallGeometry';
import {
  insertEdgeThickness,
  remapOpeningsForEdgeSplit,
  snap,
  splitInteriorWallAt,
} from '../utils/interiorWallGeometry';

interface UseInteriorWallActionsProps {
  vertices: RoomVertex[];
  onVerticesChange: (vertices: RoomVertex[]) => void;
  interiorWalls: InteriorWall[];
  onInteriorWallsChange: (walls: InteriorWall[]) => void;
  openings: RoomOpening[];
  onOpeningsChange: (openings: RoomOpening[]) => void;
  edgeThicknesses: number[];
  onEdgeThicknessesChange: (thicknesses: number[]) => void;
  attachments: Attachments;
  setAttachments: React.Dispatch<React.SetStateAction<Attachments>>;
  shiftAttachmentsForInsert: (insertedAt: number, count?: number) => void;
  jointMembers: (wallId: string, end: 'start' | 'end') => { wallId: string; end: 'start' | 'end' }[];
  joinEndpoints: (a: { wallId: string; end: 'start' | 'end' }, b: { wallId: string; end: 'start' | 'end' }) => void;
  leaveJoint: (wallId: string, end: 'start' | 'end') => void;
  remapJointMember: (oldId: string, startOwnerId: string, endOwnerId: string) => void;
  pushHistory: () => void;
  normalizedThicknesses: () => number[];
}

export function useInteriorWallActions({
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
}: UseInteriorWallActionsProps) {
  const continuousFrom = useRef<{ wallId: string; end: 'start' | 'end' } | null>(null);

  function addInteriorWall(
    start: RoomVertex,
    end: RoomVertex,
    startSnap: SnapTarget | null,
    endSnap: SnapTarget | null,
  ) {
    const p1 = startSnap?.host === 'vertex' ? startSnap.point : { x: snap(start.x), z: snap(start.z) };
    const p2 = endSnap?.host === 'vertex' ? endSnap.point : { x: snap(end.x), z: snap(end.z) };
    if (Math.hypot(p2.x - p1.x, p2.z - p1.z) < 0.2) return;

    let currentVertices = vertices;
    let currentThicknesses = normalizedThicknesses();
    let currentOpenings = openings;
    let currentWalls = interiorWalls;
    const pendingAtts: { end: 'start' | 'end'; vertexIndex: number }[] = [];

    function processSnap(snap_: SnapTarget | null, endName: 'start' | 'end', pt: RoomVertex): RoomVertex {
      if (snap_?.host === 'vertex') {
        pendingAtts.push({ end: endName, vertexIndex: snap_.vertexIndex });
        return snap_.point;
      }
      if (snap_?.host === 'boundary') {
        const insertedAt = snap_.edgeIndex + 1;
        // Shift any previously registered pendingAtts if this insertion occurs before or at them
        for (const att of pendingAtts) {
          if (att.vertexIndex >= insertedAt) {
            att.vertexIndex += 1;
          }
        }
        currentVertices = [...currentVertices.slice(0, insertedAt), pt, ...currentVertices.slice(insertedAt)];
        shiftAttachmentsForInsert(insertedAt);
        currentOpenings = remapOpeningsForEdgeSplit(currentOpenings, computeEdges(currentVertices)[snap_.edgeIndex], snap_.edgeIndex, [pt]);
        currentThicknesses = insertEdgeThickness(currentThicknesses, insertedAt);
        pendingAtts.push({ end: endName, vertexIndex: insertedAt });
        return pt;
      }
      return pt;
    }

    console.log('[WallActions] Adding interior wall:', { p1, p2, startSnap, endSnap });

    let effectiveEndSnap = endSnap;
    if (startSnap?.host === 'boundary' && endSnap?.host === 'boundary') {
      if (endSnap.edgeIndex >= startSnap.edgeIndex) {
        effectiveEndSnap = { ...endSnap, edgeIndex: endSnap.edgeIndex + 1 };
      }
    }

    const finalStart = processSnap(startSnap, 'start', p1);
    const finalEnd = processSnap(effectiveEndSnap, 'end', p2);
    console.log('[WallActions] Processed wall endpoints:', { finalStart, finalEnd, pendingAtts });

    if (currentVertices !== vertices) {
      console.log('[WallActions] Boundary vertices updated on snap insert:', { prevCount: vertices.length, newCount: currentVertices.length });
      onVerticesChange(currentVertices);
      onEdgeThicknessesChange(currentThicknesses);
    }
    if (currentOpenings !== openings) onOpeningsChange(currentOpenings);

    const newWallId = crypto.randomUUID();
    const newWall: InteriorWall = { id: newWallId, start: finalStart, end: finalEnd };

    pushHistory();
    onInteriorWallsChange([...currentWalls, newWall]);

    if (pendingAtts.length > 0) {
      setAttachments((prev) => {
        const entry: { start?: { vertexIndex: number }; end?: { vertexIndex: number } } = { ...prev[newWallId] };
        for (const p of pendingAtts) entry[p.end] = { vertexIndex: p.vertexIndex };
        console.log('[WallActions] Wall attachments registered:', { newWallId, entry });
        return { ...prev, [newWallId]: entry };
      });
    }

    if (continuousFrom.current) {
      joinEndpoints(continuousFrom.current, { wallId: newWallId, end: 'start' });
      continuousFrom.current = null;
    }
  }

  function removeInteriorWall(id: string) {
    pushHistory();
    leaveJoint(id, 'start');
    leaveJoint(id, 'end');
    onInteriorWallsChange(interiorWalls.filter((w) => w.id !== id));
    onOpeningsChange(openings.filter((o) => o.interiorWallId !== id));
    setAttachments((prev) => {
      const { [id]: _removed, ...rest } = prev;
      return rest;
    });
  }

  function splitInteriorWall(id: string) {
    const wall = interiorWalls.find((w) => w.id === id);
    if (!wall) return;
    const mid = { x: snap((wall.start.x + wall.end.x) / 2), z: snap((wall.start.z + wall.end.z) / 2) };
    const result = splitInteriorWallAt(interiorWalls, attachments, openings, id, mid);
    if (!result) return;
    pushHistory();
    onInteriorWallsChange(result.walls);
    setAttachments(result.attachments);
    if (result.openings !== openings) onOpeningsChange(result.openings);
    if (result.newJoin) {
      remapJointMember(id, result.newJoin[0].wallId, result.newJoin[1].wallId);
      joinEndpoints(result.newJoin[0], result.newJoin[1]);
    }
  }

  function handleEndpointChange(wallId: string, end: 'start' | 'end', point: RoomVertex, snap_: SnapTarget | null) {
    const p = snap_?.host === 'vertex' ? snap_.point : { x: snap(point.x), z: snap(point.z) };
    const group = [{ wallId, end }, ...jointMembers(wallId, end)];

    function applyPointToGroup(walls: InteriorWall[]): InteriorWall[] {
      return walls.map((w) => {
        const m = group.find((g) => g.wallId === w.id);
        return m ? { ...w, [m.end]: p } : w;
      });
    }

    function clearGroupAttachments(atts: Attachments): Attachments {
      const next = { ...atts };
      for (const m of group) {
        const current = next[m.wallId];
        if (!current?.[m.end]) continue;
        const entry = { ...current, [m.end]: undefined };
        if (!entry.start && !entry.end) delete next[m.wallId];
        else next[m.wallId] = entry;
      }
      return next;
    }

    if (snap_?.host === 'vertex') {
      onInteriorWallsChange(applyPointToGroup(interiorWalls));
      setAttachments((prev) => {
        const next = { ...prev };
        for (const m of group) next[m.wallId] = { ...next[m.wallId], [m.end]: { vertexIndex: snap_.vertexIndex } };
        return next;
      });
    } else if (snap_?.host === 'boundary') {
      const insertedAt = snap_.edgeIndex + 1;
      const nextVertices = [...vertices.slice(0, insertedAt), p, ...vertices.slice(insertedAt)];
      onVerticesChange(nextVertices);
      shiftAttachmentsForInsert(insertedAt);
      onOpeningsChange(remapOpeningsForEdgeSplit(openings, computeEdges(vertices)[snap_.edgeIndex], snap_.edgeIndex, [p]));
      onInteriorWallsChange(applyPointToGroup(interiorWalls));
      setAttachments((prev) => {
        const next = { ...prev };
        for (const m of group) next[m.wallId] = { ...next[m.wallId], [m.end]: { vertexIndex: insertedAt } };
        return next;
      });
    } else if (snap_?.host === 'interior' && !group.some((m) => m.wallId === snap_.wallId)) {
      const result = splitInteriorWallAt(interiorWalls, attachments, openings, snap_.wallId, snap_.point);
      if (!result) return;
      onInteriorWallsChange(applyPointToGroup(result.walls));
      setAttachments(() => clearGroupAttachments(result.attachments));
      if (result.openings !== openings) onOpeningsChange(result.openings);
      if (result.newJoin) {
        remapJointMember(snap_.wallId, result.newJoin[0].wallId, result.newJoin[1].wallId);
        joinEndpoints(result.newJoin[0], result.newJoin[1]);
      }
      for (const m of group) joinEndpoints(result.member, m);
    } else {
      onInteriorWallsChange(applyPointToGroup(interiorWalls));
      setAttachments((prev) => clearGroupAttachments(prev));
    }
  }

  function handleEndpointDetach(wallId: string, end: 'start' | 'end') {
    pushHistory();
    leaveJoint(wallId, end);
    setAttachments((prev) => {
      const current = prev[wallId];
      if (!current) return prev;
      const nextEntry = { ...current, [end]: undefined };
      if (!nextEntry.start && !nextEntry.end) {
        const { [wallId]: _removed, ...rest } = prev;
        return rest;
      }
      return { ...prev, [wallId]: nextEntry };
    });
  }

  function handleFreeEndpointClick(wallId: string, end: 'start' | 'end') {
    pushHistory();
    continuousFrom.current = { wallId, end };
  }

  return {
    continuousFrom,
    addInteriorWall,
    removeInteriorWall,
    splitInteriorWall,
    handleEndpointChange,
    handleEndpointDetach,
    handleFreeEndpointClick,
  };
}
