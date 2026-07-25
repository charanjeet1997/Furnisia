import { useEffect, useRef } from 'react';
import { pointInPolygon } from '../../../Components/polygonGeometry';
import { DEFAULT_WALL_THICKNESS, type InteriorWall, type RoomOpening, type RoomVertex } from '../../../Data/RoomShape';
import type { Attachments, WallAttachment } from '../utils/interiorWallGeometry';
import { edgesValid } from '../utils/interiorWallGeometry';

interface UseWallExtrusionProps {
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
  joints: Record<string, string[]>;
  setJoints: React.Dispatch<React.SetStateAction<Record<string, string[]>>>;
  jointMembers: (wallId: string, end: 'start' | 'end') => { wallId: string; end: 'start' | 'end' }[];
  joinEndpoints: (a: { wallId: string; end: 'start' | 'end' }, b: { wallId: string; end: 'start' | 'end' }) => void;
  pushHistory: () => void;
  normalizedThicknesses: () => number[];
}

export function useWallExtrusion({
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
}: UseWallExtrusionProps) {
  const preservedWallIdsRef = useRef<Set<string>>(new Set());

  function walkChainToBoundary(
    fromWallId: string,
    fromEnd: 'start' | 'end',
  ): { steps: { wallId: string; entryEnd: 'start' | 'end' }[]; endBoundaryVertexIndex: number } | null {
    const visited = new Set<string>();
    const steps: { wallId: string; entryEnd: 'start' | 'end' }[] = [];
    let currentWallId = fromWallId;
    let currentEntryEnd = fromEnd;
    while (true) {
      if (visited.has(currentWallId)) return null;
      visited.add(currentWallId);
      steps.push({ wallId: currentWallId, entryEnd: currentEntryEnd });
      const exitEnd: 'start' | 'end' = currentEntryEnd === 'start' ? 'end' : 'start';
      const att = attachments[currentWallId]?.[exitEnd];
      if (att) return { steps, endBoundaryVertexIndex: att.vertexIndex };
      const members = jointMembers(currentWallId, exitEnd);
      if (members.length !== 1) return null;
      currentWallId = members[0].wallId;
      currentEntryEnd = members[0].end;
    }
  }

  function extrudeChainIntoBoundary(startIdx: number, endIdx: number, steps: { wallId: string; entryEnd: 'start' | 'end' }[]): boolean {
    if (startIdx === endIdx) return false;
    const n = vertices.length;
    const mergedIds = new Set(steps.map((s) => s.wallId));

    // Guard: an interior wall partition drawn inside the room must NEVER alter the room's
    // outer boundary polygon. Only extrude if the chain actually extends OUTSIDE the current
    // room polygon (a genuine room-extension bay). We sample points slightly offset perpendicular
    // to the wall segment — if both sides lie inside the room polygon, it's a partition and must
    // be left alone (avoiding raycast precision bugs on collinear boundary vertices).
    console.log('[ExtrusionCheck] Evaluating wall chain:', { startIdx, endIdx, stepsCount: steps.length });

    const isExtension = steps.some((s) => {
      const wall = interiorWalls.find((w) => w.id === s.wallId);
      if (!wall) return false;
      const dx = wall.end.x - wall.start.x;
      const dz = wall.end.z - wall.start.z;
      const len = Math.hypot(dx, dz) || 1;
      const nx = (dz / len) * 0.05;
      const nz = (-dx / len) * 0.05;

      for (const t of [0.5, 0.3, 0.7]) {
        const sx = wall.start.x + dx * t;
        const sz = wall.start.z + dz * t;
        const inMid = pointInPolygon(vertices, sx, sz);
        const inSideA = pointInPolygon(vertices, sx + nx, sz + nz);
        const inSideB = pointInPolygon(vertices, sx - nx, sz - nz);
        console.log(`[ExtrusionCheck] Wall ${wall.id} @ t=${t}: mid(in)=${inMid}, sideA(in)=${inSideA}, sideB(in)=${inSideB}`);

        if (inMid || inSideA || inSideB) {
          console.log(`[ExtrusionCheck] Wall ${wall.id} confirmed as INTERIOR PARTITION.`);
          return false; // Inside room polygon -> interior partition
        }
      }
      console.log(`[ExtrusionCheck] Wall ${wall.id} detected as genuine OUTSIDE polygon extension!`);
      return true;
    });

    if (!isExtension) {
      console.log('[ExtrusionCheck] Chain is an interior partition. Skipping boundary extrusion.');
      return false;
    }

    console.log('[ExtrusionCheck] Executing boundary extrusion on vertices!');

    const forwardLen = (endIdx - startIdx + n) % n;
    const goForward = forwardLen * 2 <= n;
    const runFrom = goForward ? startIdx : endIdx;
    const runTo = goForward ? endIdx : startIdx;
    const runLength = goForward ? forwardLen : n - forwardLen;
    const bulgeStartsAtRunFrom = startIdx === runFrom;

    const runIndices: number[] = [];
    for (let k = 0; k <= runLength; k++) runIndices.push((runFrom + k) % n);
    const runEdgeIndices = runIndices.slice(0, -1);
    const interiorIndices = runIndices.slice(1, -1);
    const interiorSet = new Set(interiorIndices);

    const toDetach: { wallId: string; end: 'start' | 'end' }[] = [];
    for (const [wallId, att] of Object.entries(attachments)) {
      if (mergedIds.has(wallId)) continue;
      if (att.start && interiorSet.has(att.start.vertexIndex)) toDetach.push({ wallId, end: 'start' });
      if (att.end && interiorSet.has(att.end.vertexIndex)) toDetach.push({ wallId, end: 'end' });
    }

    const newPoints = steps
      .map((s) => {
        const wall = interiorWalls.find((w) => w.id === s.wallId);
        if (!wall) return null;
        const exitEnd: 'start' | 'end' = s.entryEnd === 'start' ? 'end' : 'start';
        return exitEnd === 'start' ? wall.start : wall.end;
      })
      .filter((p): p is RoomVertex => p !== null);
    newPoints.pop();
    const orderedNewPoints = bulgeStartsAtRunFrom ? newPoints : [...newPoints].reverse();

    const keptVertices: RoomVertex[] = [];
    const oldToKeptIndex = new Map<number, number>();
    for (let i = 0; i < n; i++) {
      if (interiorSet.has(i)) continue;
      oldToKeptIndex.set(i, keptVertices.length);
      keptVertices.push(vertices[i]);
    }
    const insertAt = oldToKeptIndex.get(runFrom)! + 1;
    const nextVertices = [...keptVertices.slice(0, insertAt), ...orderedNewPoints, ...keptVertices.slice(insertAt)];
    if (!edgesValid(nextVertices)) return false;

    const shift = (oldIdx: number): number => {
      const kept = oldToKeptIndex.get(oldIdx)!;
      return kept >= insertAt ? kept + orderedNewPoints.length : kept;
    };

    const oldThicknesses = normalizedThicknesses();
    const preservedThicknesses = runEdgeIndices.map((i) => oldThicknesses[i]);

    pushHistory();
    onVerticesChange(nextVertices);

    const nextThicknesses = new Array<number>(nextVertices.length).fill(DEFAULT_WALL_THICKNESS);
    for (let i = 0; i < n; i++) {
      if (interiorSet.has(i) || runEdgeIndices.includes(i)) continue;
      nextThicknesses[shift(i)] = oldThicknesses[i];
    }
    for (let k = insertAt; k <= insertAt + orderedNewPoints.length; k++) nextThicknesses[k] = preservedThicknesses[0] ?? DEFAULT_WALL_THICKNESS;
    onEdgeThicknessesChange(nextThicknesses);

    const preservedIds = runEdgeIndices.map(() => crypto.randomUUID());
    for (const id of preservedIds) preservedWallIdsRef.current.add(id);
    const preservedWalls: InteriorWall[] = preservedIds.map((id, k) => ({
      id,
      start: vertices[runIndices[k]],
      end: vertices[runIndices[k + 1]],
      thickness: preservedThicknesses[k],
    }));
    onInteriorWallsChange([...interiorWalls.filter((w) => !mergedIds.has(w.id)), ...preservedWalls]);

    onOpeningsChange(
      openings
        .filter((o) => !(o.interiorWallId && mergedIds.has(o.interiorWallId)))
        .map((o) => {
          if (o.interiorWallId) return o;
          const runPos = runEdgeIndices.indexOf(o.edgeIndex);
          if (runPos !== -1) return { ...o, edgeIndex: -1, interiorWallId: preservedIds[runPos] };
          return { ...o, edgeIndex: shift(o.edgeIndex) };
        }),
    );

    setAttachments((prev) => {
      const next: Attachments = {};
      for (const [wallId, att] of Object.entries(prev)) {
        if (mergedIds.has(wallId)) continue;
        const dropStart = toDetach.some((d) => d.wallId === wallId && d.end === 'start');
        const dropEnd = toDetach.some((d) => d.wallId === wallId && d.end === 'end');
        const shiftAtt = (a: WallAttachment | undefined, drop: boolean) => (a && !drop ? { vertexIndex: shift(a.vertexIndex) } : undefined);
        const shifted = { start: shiftAtt(att.start, dropStart), end: shiftAtt(att.end, dropEnd) };
        if (shifted.start || shifted.end) next[wallId] = shifted;
      }
      next[preservedIds[0]] = { ...next[preservedIds[0]], start: { vertexIndex: shift(runFrom) } };
      next[preservedIds[preservedIds.length - 1]] = { ...next[preservedIds[preservedIds.length - 1]], end: { vertexIndex: shift(runTo) } };
      return next;
    });

    setJoints((prev) => {
      const next: typeof prev = {};
      for (const [jointId, members] of Object.entries(prev)) {
        const filtered = members.filter((m) => !mergedIds.has(m.split(':')[0]));
        if (filtered.length >= 2) next[jointId] = filtered;
      }
      for (let k = 1; k < preservedIds.length; k++) {
        const a = `${preservedIds[k - 1]}:end`;
        const b = `${preservedIds[k]}:start`;
        next[crypto.randomUUID()] = [a, b];
      }
      return next;
    });

    return true;
  }

  useEffect(() => {
    for (const [wallId, att] of Object.entries(attachments)) {
      if (preservedWallIdsRef.current.has(wallId)) continue;
      for (const end of ['start', 'end'] as const) {
        const a = att[end];
        if (!a) continue;
        const result = walkChainToBoundary(wallId, end);
        if (!result || result.endBoundaryVertexIndex === a.vertexIndex) continue;
        if (extrudeChainIntoBoundary(a.vertexIndex, result.endBoundaryVertexIndex, result.steps)) return;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attachments, joints, interiorWalls, vertices]);

  useEffect(() => {
    const AUTO_JOIN_TOLERANCE = 0.15;
    for (let i = 0; i < interiorWalls.length; i++) {
      const wallA = interiorWalls[i];
      for (const endA of ['start', 'end'] as const) {
        if (attachments[wallA.id]?.[endA]) continue;
        const pA = endA === 'start' ? wallA.start : wallA.end;
        for (let j = i + 1; j < interiorWalls.length; j++) {
          const wallB = interiorWalls[j];
          for (const endB of ['start', 'end'] as const) {
            if (attachments[wallB.id]?.[endB]) continue;
            const pB = endB === 'start' ? wallB.start : wallB.end;
            if (Math.hypot(pA.x - pB.x, pA.z - pB.z) > AUTO_JOIN_TOLERANCE) continue;
            if (jointMembers(wallA.id, endA).some((m) => m.wallId === wallB.id && m.end === endB)) continue;
            onInteriorWallsChange(interiorWalls.map((w) => (w.id === wallB.id ? { ...w, [endB]: pA } : w)));
            joinEndpoints({ wallId: wallA.id, end: endA }, { wallId: wallB.id, end: endB });
            return;
          }
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interiorWalls, attachments, joints]);

  return {
    preservedWallIdsRef,
    walkChainToBoundary,
    extrudeChainIntoBoundary,
  };
}
