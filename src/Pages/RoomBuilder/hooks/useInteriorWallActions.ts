import { computeEdges } from '../../../Components/polygonGeometry';
import type { InteriorWall, RoomOpening, RoomVertex } from '../../../Data/RoomShape';
import type { SnapTarget } from '../types/floorPlanTypes';
import type { Attachments } from '../utils/interiorWallGeometry';
import {
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
  attachments: Attachments;
  setAttachments: React.Dispatch<React.SetStateAction<Attachments>>;
  shiftAttachmentsForInsert: (insertedAt: number, count?: number) => void;
  jointMembers: (wallId: string, end: 'start' | 'end') => { wallId: string; end: 'start' | 'end' }[];
  joinEndpoints: (a: { wallId: string; end: 'start' | 'end' }, b: { wallId: string; end: 'start' | 'end' }) => void;
  leaveJoint: (wallId: string, end: 'start' | 'end') => void;
  remapJointMember: (oldId: string, startOwnerId: string, endOwnerId: string) => void;
  pushHistory?: () => void;
}

export function useInteriorWallActions({
  vertices,
  onVerticesChange,
  interiorWalls,
  onInteriorWallsChange,
  openings,
  onOpeningsChange,
  edgeThicknesses: _edgeThicknesses,
  attachments,
  setAttachments,
  shiftAttachmentsForInsert,
  jointMembers,
  joinEndpoints,
  leaveJoint,
  remapJointMember,
  pushHistory,
}: UseInteriorWallActionsProps) {
  function removeInteriorWall(id: string) {
    pushHistory?.();
    leaveJoint(id, 'start');
    leaveJoint(id, 'end');
    onInteriorWallsChange(interiorWalls.filter((w) => w.id !== id));
    onOpeningsChange(openings.filter((o) => o.interiorWallId !== id));
    setAttachments((prev) => {
      const { [id]: _removed, ...rest } = prev;
      return rest;
    });
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
    pushHistory?.();
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

  return {
    removeInteriorWall,
    handleEndpointChange,
    handleEndpointDetach,
  };
}
