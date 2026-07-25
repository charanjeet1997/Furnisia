import { useState } from 'react';
import type { RoomVertex, InteriorWall } from '../../../Data/RoomShape';
import type { Attachments, WallAttachment } from '../utils/interiorWallGeometry';

export function useWallAttachments() {
  const [attachments, setAttachments] = useState<Attachments>({});

  function isEndpointAttached(wallId: string, end: 'start' | 'end'): boolean {
    return Boolean(attachments[wallId]?.[end]);
  }

  function shiftAttachmentsForInsert(insertedAt: number, count = 1) {
    setAttachments((prev) => {
      const next: typeof prev = {};
      for (const [wallId, att] of Object.entries(prev)) {
        next[wallId] = {
          start: att.start ? { vertexIndex: att.start.vertexIndex >= insertedAt ? att.start.vertexIndex + count : att.start.vertexIndex } : undefined,
          end: att.end ? { vertexIndex: att.end.vertexIndex >= insertedAt ? att.end.vertexIndex + count : att.end.vertexIndex } : undefined,
        };
      }
      return next;
    });
  }

  function shiftAttachmentsForRemove(removedIndex: number) {
    setAttachments((prev) => {
      const next: typeof prev = {};
      for (const [wallId, att] of Object.entries(prev)) {
        const shift = (a?: WallAttachment) =>
          !a || a.vertexIndex === removedIndex ? undefined : { vertexIndex: a.vertexIndex > removedIndex ? a.vertexIndex - 1 : a.vertexIndex };
        const shifted = { start: shift(att.start), end: shift(att.end) };
        if (shifted.start || shifted.end) next[wallId] = shifted;
      }
      return next;
    });
  }

  function syncAttachedWalls(nextVertices: RoomVertex[], interiorWalls: InteriorWall[], onInteriorWallsChange: (walls: InteriorWall[]) => void) {
    if (Object.keys(attachments).length === 0) return;
    const updated = interiorWalls.map((wall) => {
      const att = attachments[wall.id];
      if (!att) return wall;
      const start = att.start ? nextVertices[att.start.vertexIndex] : undefined;
      const end = att.end ? nextVertices[att.end.vertexIndex] : undefined;
      if (!start && !end) return wall;
      return { ...wall, ...(start ? { start } : {}), ...(end ? { end } : {}) };
    });
    onInteriorWallsChange(updated);
  }

  return {
    attachments,
    setAttachments,
    isEndpointAttached,
    shiftAttachmentsForInsert,
    shiftAttachmentsForRemove,
    syncAttachedWalls,
  };
}
