import { useEffect, useRef, useState } from 'react';
import { FiRotateCcw } from 'react-icons/fi';
import { computeEdges, type WallEdge } from '../../Components/polygonGeometry';
import { FloorPlanPreview, type PlanUnits, type SnapTarget } from './FloorPlanPreview';
import type { InteriorWall, RoomVertex } from '../../Data/RoomShape';
import styles from './RoomBuilder.module.css';

interface StepDimensionsProps {
  vertices: RoomVertex[];
  onVerticesChange: (vertices: RoomVertex[]) => void;
  height: number;
  onHeightChange: (height: number) => void;
  wallThickness: number;
  onWallThicknessChange: (thickness: number) => void;
  interiorWalls: InteriorWall[];
  onInteriorWallsChange: (walls: InteriorWall[]) => void;
}

const MIN_EDGE = 0.3; // reject edits/drags that would collapse a wall
const MIN_HEIGHT = 2;
const MAX_HEIGHT = 6;
const MIN_THICKNESS_CM = 5;
const MAX_THICKNESS_CM = 40;

// Proper segment intersection (excluding shared endpoints) — used below to reject edits
// that push a wall through a non-adjacent wall, e.g. a notch wall dragged past the outer
// wall it's parallel to. Without this, only the edited wall's own length was checked, so
// the polygon could self-intersect into a degenerate bowtie (a thin sliver).
function segmentsIntersect(a1: RoomVertex, a2: RoomVertex, b1: RoomVertex, b2: RoomVertex): boolean {
  const d1x = a2.x - a1.x;
  const d1z = a2.z - a1.z;
  const d2x = b2.x - b1.x;
  const d2z = b2.z - b1.z;
  const denom = d1x * d2z - d1z * d2x;
  if (Math.abs(denom) < 1e-9) return false; // parallel (or collinear) — treat as non-crossing
  const t = ((b1.x - a1.x) * d2z - (b1.z - a1.z) * d2x) / denom;
  const u = ((b1.x - a1.x) * d1z - (b1.z - a1.z) * d1x) / denom;
  return t > 1e-6 && t < 1 - 1e-6 && u > 1e-6 && u < 1 - 1e-6;
}

function edgesValid(vertices: RoomVertex[]): boolean {
  const n = vertices.length;
  for (let i = 0; i < n; i++) {
    const a1 = vertices[i];
    const a2 = vertices[(i + 1) % n];
    if (Math.hypot(a2.x - a1.x, a2.z - a1.z) < MIN_EDGE) return false;
    // Only test each pair once, and skip edges adjacent to i (they share a vertex, which
    // is a valid touch, not a crossing).
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue; // wraps around to be adjacent to edge 0
      const b1 = vertices[j];
      const b2 = vertices[(j + 1) % n];
      if (segmentsIntersect(a1, a2, b1, b2)) return false;
    }
  }
  return true;
}

const snap = (v: number) => Math.round(v * 10) / 10; // 0.1m grid, keeps dimensions clean

// Once an interior wall's endpoint snaps onto a boundary wall, that point becomes a REAL
// shared corner (a new vertex actually gets inserted into `vertices`) — so it's tracked by
// vertexIndex, exactly like any other corner, and moves whenever that corner is dragged via
// the normal boundary-editing flow. This is what makes an attached endpoint behave identically
// to a black corner dot instead of floating independently.
interface WallAttachment {
  vertexIndex: number;
}

type Attachments = Record<string, { start?: WallAttachment; end?: WallAttachment }>;

// Splits interior wall `hostId` at `point`, turning that point into a real shared joint —
// same idea as snapping onto a BOUNDARY wall (which inserts a real vertex), generalized to an
// interior wall as the host. If `point` lands within MIN_EDGE of one of the host's own
// existing endpoints, no split happens — that endpoint is reported directly as the member to
// join to, instead of creating a near-zero-length sliver wall.
//
// Pure (works on plain snapshots, not React state) so callers — a fresh draw, or dragging an
// existing endpoint onto another wall — can fold the result into their own single batch of
// setState calls instead of this function reaching into state itself.
function splitInteriorWallAt(
  walls: InteriorWall[],
  atts: Attachments,
  hostId: string,
  point: RoomVertex,
): {
  walls: InteriorWall[];
  attachments: Attachments;
  member: { wallId: string; end: 'start' | 'end' };
  newJoin?: [{ wallId: string; end: 'start' | 'end' }, { wallId: string; end: 'start' | 'end' }];
} | null {
  const host = walls.find((w) => w.id === hostId);
  if (!host) return null;
  const p = { x: snap(point.x), z: snap(point.z) };
  const distStart = Math.hypot(p.x - host.start.x, p.z - host.start.z);
  const distEnd = Math.hypot(p.x - host.end.x, p.z - host.end.z);
  if (distStart < MIN_EDGE) return { walls, attachments: atts, member: { wallId: hostId, end: 'start' } };
  if (distEnd < MIN_EDGE) return { walls, attachments: atts, member: { wallId: hostId, end: 'end' } };

  const id1 = crypto.randomUUID();
  const id2 = crypto.randomUUID();
  const nextWalls = [...walls.filter((w) => w.id !== hostId), { id: id1, start: host.start, end: p }, { id: id2, start: p, end: host.end }];

  const origAtt = atts[hostId];
  const nextAtts = { ...atts };
  delete nextAtts[hostId];
  if (origAtt?.start) nextAtts[id1] = { ...nextAtts[id1], start: origAtt.start };
  if (origAtt?.end) nextAtts[id2] = { ...nextAtts[id2], end: origAtt.end };

  return {
    walls: nextWalls,
    attachments: nextAtts,
    member: { wallId: id1, end: 'end' },
    newJoin: [{ wallId: id1, end: 'end' }, { wallId: id2, end: 'start' }],
  };
}

export function StepDimensions({
  vertices,
  onVerticesChange,
  height,
  onHeightChange,
  wallThickness,
  onWallThicknessChange,
  interiorWalls,
  onInteriorWallsChange,
}: StepDimensionsProps) {
  const [units, setUnits] = useState<PlanUnits>('m');
  // Auto-exits after placing one wall (or Escape) — a toggle you have to remember to turn off
  // is exactly the kind of thing that trips people up, so "draw" is a one-shot action, not a
  // sticky mode.
  const [drawMode, setDrawMode] = useState(false);

  // Snapshot at drag start: drags apply (snapshot + total delta), so clamped/rejected moves
  // never accumulate drift; edge normals are frozen too since the polygon changes mid-drag.
  const dragStart = useRef<{ vertices: RoomVertex[]; edges: WallEdge[] } | null>(null);

  // Undo history: one entry per completed EDIT (drag gesture, add/remove wall, typed length,
  // drawing/removing an interior wall) — not per intermediate pointer-move, otherwise undo
  // would only step back a pixel at a time instead of undoing the whole thing you just did.
  const [history, setHistory] = useState<{ vertices: RoomVertex[]; interiorWalls: InteriorWall[] }[]>([]);
  const HISTORY_LIMIT = 25;

  function pushHistory() {
    setHistory((h) => [...h.slice(-(HISTORY_LIMIT - 1)), { vertices, interiorWalls }]);
  }

  function undo() {
    setHistory((h) => {
      if (h.length === 0) return h;
      const prev = h[h.length - 1];
      onVerticesChange(prev.vertices);
      onInteriorWallsChange(prev.interiorWalls);
      return h.slice(0, -1);
    });
  }

  function beginDrag() {
    pushHistory();
    dragStart.current = { vertices, edges: computeEdges(vertices) };
  }

  function endDrag() {
    dragStart.current = null;
  }

  // Splits the wall in two by inserting a new corner at its midpoint — the new corner can
  // then be dragged out (via onVertexDrag above) to bow the wall into an L/notch, or dragged
  // back to the line to leave it as two coplanar walls. Guarded so neither half starts below
  // the minimum wall length.
  function addWall(edgeIndex: number) {
    const edge = computeEdges(vertices)[edgeIndex];
    if (!edge || edge.length < MIN_EDGE * 2) return;
    const mid = { x: snap(edge.midpoint.x), z: snap(edge.midpoint.z) };
    const insertedAt = edgeIndex + 1;
    const next = [...vertices.slice(0, insertedAt), mid, ...vertices.slice(insertedAt)];
    pushHistory();
    onVerticesChange(next);
    shiftAttachmentsForInsert(insertedAt);
  }

  // Removing a corner merges its two walls into one straight wall between its former
  // neighbors — the natural "remove a wall" for a closed room polygon (there's no such thing
  // as an open gap in a watertight room). Guarded so the room can never drop below a triangle,
  // and re-validated the same way drags are so this can't fold the polygon on itself.
  function removeVertex(vertexIndex: number) {
    if (vertices.length <= 3) return;
    const next = vertices.filter((_, i) => i !== vertexIndex);
    if (edgesValid(next)) {
      pushHistory();
      onVerticesChange(next);
      shiftAttachmentsForRemove(vertexIndex);
    }
  }

  // Draw tool: adds a brand-new, free-standing wall — purely additive to the room's boundary
  // by default. But if either end was drawn directly onto a boundary wall, it attaches there
  // immediately (same real-shared-corner treatment as dragging an endpoint onto one), instead
  // of requiring a drag-away-and-back to trigger the snap. If this segment continues a chain
  // from a free endpoint (see handleFreeEndpointClick/continuousFrom below), its start is also
  // joined to that origin point as a real shared joint.
  function addInteriorWall(start: RoomVertex, end: RoomVertex, startSnap: SnapTarget | null, endSnap: SnapTarget | null) {
    pushHistory();
    const newId = crypto.randomUUID();
    const startPoint = { x: snap(start.x), z: snap(start.z) };
    const endPoint = { x: snap(end.x), z: snap(end.z) };
    let nextVertices = vertices;
    let workingWalls = interiorWalls;
    let workingAtts: Attachments = attachments;
    let startVertexIndex: number | null = null;
    let endVertexIndex: number | null = null;
    let startMember: { wallId: string; end: 'start' | 'end' } | null = null;
    let endMember: { wallId: string; end: 'start' | 'end' } | null = null;
    const remaps: [string, string, string][] = [];
    const joinsToApply: [{ wallId: string; end: 'start' | 'end' }, { wallId: string; end: 'start' | 'end' }][] = [];

    function applyInteriorSnap(hostWallId: string, point: RoomVertex): { wallId: string; end: 'start' | 'end' } | null {
      const result = splitInteriorWallAt(workingWalls, workingAtts, hostWallId, point);
      if (!result) return null;
      workingWalls = result.walls;
      workingAtts = result.attachments;
      if (result.newJoin) {
        joinsToApply.push(result.newJoin);
        remaps.push([hostWallId, result.newJoin[0].wallId, result.newJoin[1].wallId]);
      }
      return result.member;
    }

    if (startSnap?.host === 'boundary' && endSnap?.host === 'boundary' && startSnap.edgeIndex === endSnap.edgeIndex) {
      // Both land on the SAME boundary wall — insert both at once, in the correct geometric
      // order along it (whichever is closer to that wall's own start vertex goes first).
      const insertAt = startSnap.edgeIndex + 1;
      const startFirst = startSnap.t <= endSnap.t;
      const [a, b] = startFirst ? [startPoint, endPoint] : [endPoint, startPoint];
      nextVertices = [...vertices.slice(0, insertAt), a, b, ...vertices.slice(insertAt)];
      shiftAttachmentsForInsert(insertAt, 2);
      startVertexIndex = startFirst ? insertAt : insertAt + 1;
      endVertexIndex = startFirst ? insertAt + 1 : insertAt;
    } else {
      if (startSnap?.host === 'boundary') {
        const insertedAt = startSnap.edgeIndex + 1;
        nextVertices = [...nextVertices.slice(0, insertedAt), startPoint, ...nextVertices.slice(insertedAt)];
        startVertexIndex = insertedAt;
        shiftAttachmentsForInsert(insertedAt);
      } else if (startSnap?.host === 'interior') {
        startMember = applyInteriorSnap(startSnap.wallId, startSnap.point);
      }
      if (endSnap?.host === 'boundary') {
        // If the start's insertion landed at/before where the end needs to go, the end's
        // edgeIndex has shifted up by one to account for it.
        const endEdgeIndex = startVertexIndex !== null && endSnap.edgeIndex + 1 >= startVertexIndex ? endSnap.edgeIndex + 1 : endSnap.edgeIndex;
        const insertedAt = endEdgeIndex + 1;
        nextVertices = [...nextVertices.slice(0, insertedAt), endPoint, ...nextVertices.slice(insertedAt)];
        endVertexIndex = insertedAt;
        shiftAttachmentsForInsert(insertedAt);
        if (startVertexIndex !== null && startVertexIndex >= insertedAt) startVertexIndex += 1;
      } else if (endSnap?.host === 'interior') {
        endMember = applyInteriorSnap(endSnap.wallId, endSnap.point);
      }
    }

    if (nextVertices !== vertices) onVerticesChange(nextVertices);
    onInteriorWallsChange([...workingWalls, { id: newId, start: startPoint, end: endPoint }]);

    let finalAtts = workingAtts;
    if (startVertexIndex !== null || endVertexIndex !== null) {
      finalAtts = {
        ...finalAtts,
        [newId]: {
          ...(startVertexIndex !== null ? { start: { vertexIndex: startVertexIndex } } : {}),
          ...(endVertexIndex !== null ? { end: { vertexIndex: endVertexIndex } } : {}),
        },
      };
    }
    if (finalAtts !== attachments) setAttachments(finalAtts);

    for (const [oldId, startOwnerId, endOwnerId] of remaps) remapJointMember(oldId, startOwnerId, endOwnerId);
    for (const pair of joinsToApply) joinEndpoints(pair[0], pair[1]);
    if (startMember) joinEndpoints(startMember, { wallId: newId, end: 'start' });
    if (endMember) joinEndpoints(endMember, { wallId: newId, end: 'end' });
    if (continuousFrom.current) {
      joinEndpoints(continuousFrom.current, { wallId: newId, end: 'start' });
      continuousFrom.current = null;
    }
    setDrawMode(false); // one-shot — back to normal editing after placing it
  }

  function removeInteriorWall(id: string) {
    pushHistory();
    onInteriorWallsChange(interiorWalls.filter((w) => w.id !== id));
    leaveJoint(id, 'start');
    leaveJoint(id, 'end');
  }

  // Splits an interior wall into two at its midpoint — same idea as addWall for boundary
  // walls. The two halves are joined to each other at the new midpoint (so dragging it moves
  // both), and any attachment/joint the ORIGINAL wall's endpoints had transfers to whichever
  // half now owns that endpoint.
  function splitInteriorWall(id: string) {
    const wall = interiorWalls.find((w) => w.id === id);
    if (!wall) return;
    const length = Math.hypot(wall.end.x - wall.start.x, wall.end.z - wall.start.z);
    if (length < MIN_EDGE * 2) return;
    const mid = { x: snap((wall.start.x + wall.end.x) / 2), z: snap((wall.start.z + wall.end.z) / 2) };

    pushHistory();
    const result = splitInteriorWallAt(interiorWalls, attachments, id, mid);
    if (!result?.newJoin) return; // length guard above means mid is never within MIN_EDGE of an end
    onInteriorWallsChange(result.walls);
    setAttachments(result.attachments);
    remapJointMember(id, result.newJoin[0].wallId, result.newJoin[1].wallId);
    joinEndpoints(result.newJoin[0], result.newJoin[1]);
  }

  // Which wall the current continuous-drawing session is chaining off — set on a free-endpoint
  // click, consumed the moment the new segment is committed.
  const continuousFrom = useRef<{ wallId: string; end: 'start' | 'end' } | null>(null);

  // Two (or more) interior wall endpoints that are really the SAME physical point — e.g. a
  // continuous-drawing chain's elbow. Keyed by an arbitrary joint id -> member "wallId:end"
  // strings, so dragging any one member moves every wall meeting at that joint together,
  // instead of each wall's endpoint being independently coincidental.
  const [joints, setJoints] = useState<Record<string, string[]>>({});
  const memberKey = (m: { wallId: string; end: 'start' | 'end' }) => `${m.wallId}:${m.end}`;

  function jointMembers(wallId: string, end: 'start' | 'end'): { wallId: string; end: 'start' | 'end' }[] {
    const key = memberKey({ wallId, end });
    for (const members of Object.values(joints)) {
      if (members.includes(key)) {
        return members
          .filter((m) => m !== key)
          .map((m) => {
            const [id, e] = m.split(':');
            return { wallId: id, end: e as 'start' | 'end' };
          });
      }
    }
    return [];
  }

  function joinEndpoints(a: { wallId: string; end: 'start' | 'end' }, b: { wallId: string; end: 'start' | 'end' }) {
    setJoints((prev) => {
      const aKey = memberKey(a);
      const bKey = memberKey(b);
      const existingId = Object.entries(prev).find(([, members]) => members.includes(aKey) || members.includes(bKey))?.[0];
      if (existingId) {
        const members = new Set(prev[existingId]);
        members.add(aKey);
        members.add(bKey);
        return { ...prev, [existingId]: [...members] };
      }
      return { ...prev, [crypto.randomUUID()]: [aKey, bKey] };
    });
  }

  // Detaching (Separate) or dragging a joined endpoint away removes just that member — the
  // remaining members (if 2+) stay joined to each other.
  function leaveJoint(wallId: string, end: 'start' | 'end') {
    const key = memberKey({ wallId, end });
    setJoints((prev) => {
      const next: typeof prev = {};
      for (const [id, members] of Object.entries(prev)) {
        if (!members.includes(key)) {
          next[id] = members;
          continue;
        }
        const remaining = members.filter((m) => m !== key);
        if (remaining.length >= 2) next[id] = remaining;
      }
      return next;
    });
  }

  // A wall was just split into two (`oldId` -> `startOwnerId`/`endOwnerId`) — any joint that
  // referenced the ORIGINAL wall's start/end needs to point at whichever half now owns that
  // endpoint, or the split would silently sever it from whatever it used to be joined to.
  function remapJointMember(oldId: string, startOwnerId: string, endOwnerId: string) {
    setJoints((prev) => {
      const next: typeof prev = {};
      for (const [jointId, members] of Object.entries(prev)) {
        next[jointId] = members.map((m) => {
          if (m === `${oldId}:start`) return `${startOwnerId}:start`;
          if (m === `${oldId}:end`) return `${endOwnerId}:end`;
          return m;
        });
      }
      return next;
    });
  }

  // Which interior-wall endpoints are pinned to a boundary corner — wizard-only bookkeeping,
  // not part of the saved RoomShape (interiorWalls always stores plain resolved coordinates,
  // so nothing downstream needs to know an attachment ever existed).
  const [attachments, setAttachments] = useState<Attachments>({});

  // Pinned to a real BOUNDARY corner specifically — a joint with another interior wall is a
  // separate kind of "attached" (see FloorPlanPreview's own isPinned, which ORs this with
  // jointedEndpoints for coloring). Kept boundary-only here because this same function also
  // gates interaction: a boundary-attached point has no drag handle of its own (the regular
  // corner-handle already moves it) and a plain click on it never starts continuous drawing —
  // neither of those should apply to a joint-only point, which still needs its own drag
  // handle (nothing else can move it) and can still spawn a new chained wall on a plain click.
  function isEndpointAttached(wallId: string, end: 'start' | 'end'): boolean {
    return Boolean(attachments[wallId]?.[end]);
  }

  // Follows a chain of jointed interior walls starting at (`fromWallId`, `fromEnd` — an end
  // that's ALREADY boundary-attached) out through however many walls are joined end-to-end,
  // stopping the moment it reaches another boundary attachment. Returns null if the chain
  // dead-ends in a free point, branches (a joint with more than one partner), or loops back on
  // itself — none of those describe a wall (or run of walls) that bridges two boundary corners.
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

  // A chain of interior walls that bridges two ADJACENT boundary corners isn't a partition
  // anymore — it's an alternate path between two points already on the room's outline, so it
  // REPLACES the direct edge between them: the room's actual footprint grows (or notches) to
  // follow the drawn path, and that area becomes real floor. (Chains spanning two NON-adjacent
  // corners are left alone — replacing a whole run of unrelated edges is too ambiguous to do
  // automatically.)
  function mergeChainIntoBoundary(startIdx: number, endIdx: number, steps: { wallId: string; entryEnd: 'start' | 'end' }[]) {
    const n = vertices.length;
    const forwardAdjacent = (endIdx - startIdx + n) % n === 1;
    const backwardAdjacent = (startIdx - endIdx + n) % n === 1;
    if (!forwardAdjacent && !backwardAdjacent) return;

    const newPoints = steps
      .map((s) => {
        const wall = interiorWalls.find((w) => w.id === s.wallId);
        if (!wall) return null;
        const exitEnd: 'start' | 'end' = s.entryEnd === 'start' ? 'end' : 'start';
        return exitEnd === 'start' ? wall.start : wall.end;
      })
      .filter((p): p is RoomVertex => p !== null);
    newPoints.pop(); // last point is the terminal boundary vertex — already in `vertices`

    const orderedNewPoints = forwardAdjacent ? newPoints : [...newPoints].reverse();
    const insertAt = forwardAdjacent ? startIdx + 1 : endIdx + 1;
    const nextVertices = [...vertices.slice(0, insertAt), ...orderedNewPoints, ...vertices.slice(insertAt)];
    if (!edgesValid(nextVertices)) return; // would self-intersect — leave it as an unmerged partition

    const mergedIds = new Set(steps.map((s) => s.wallId));
    pushHistory();
    onVerticesChange(nextVertices);
    onInteriorWallsChange(interiorWalls.filter((w) => !mergedIds.has(w.id)));

    setAttachments((prev) => {
      const next: Attachments = {};
      for (const [wallId, att] of Object.entries(prev)) {
        if (mergedIds.has(wallId)) continue;
        const shift = (a?: WallAttachment) =>
          a ? { vertexIndex: a.vertexIndex >= insertAt ? a.vertexIndex + orderedNewPoints.length : a.vertexIndex } : undefined;
        const shifted = { start: shift(att.start), end: shift(att.end) };
        if (shifted.start || shifted.end) next[wallId] = shifted;
      }
      return next;
    });

    setJoints((prev) => {
      const next: typeof prev = {};
      for (const [jointId, members] of Object.entries(prev)) {
        const filtered = members.filter((m) => !mergedIds.has(m.split(':')[0]));
        if (filtered.length >= 2) next[jointId] = filtered;
      }
      return next;
    });
  }

  // After every commit, check whether any boundary-attached endpoint now has a path — direct
  // or through a chain of joints — back to ANOTHER boundary corner, and fold it into the
  // footprint if so. Runs as an effect (not inline in the commit handlers) so it always sees
  // the fully-settled attachments/joints/walls state, not a snapshot mid-update.
  useEffect(() => {
    for (const [wallId, att] of Object.entries(attachments)) {
      for (const end of ['start', 'end'] as const) {
        const a = att[end];
        if (!a) continue;
        const result = walkChainToBoundary(wallId, end);
        if (!result || result.endBoundaryVertexIndex === a.vertexIndex) continue;
        mergeChainIntoBoundary(a.vertexIndex, result.endBoundaryVertexIndex, result.steps);
        return;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attachments, joints, interiorWalls, vertices]);

  // Safety net: two FREE (non-boundary) endpoints on different walls that ended up this close
  // are almost certainly meant to be the same point — e.g. a live drag/draw that landed just
  // outside the snap radius, leaving what looks like a closed loop but is actually two
  // coincidentally-overlapping tips instead of a real joint (the room-extension merge above,
  // and the plain black-dot coloring, both depend on a REAL joint to ever notice them as
  // connected). Nudges the second point onto the first and joins them — 0.15m is tight enough
  // (1.5x the 0.1m placement grid) that unrelated nearby walls essentially never trigger it.
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

  // One or more boundary corners were inserted starting at `insertedAt` (addWall, a fresh
  // snap-attach, or drawing a wall whose endpoint(s) snapped onto the boundary) — every
  // existing attachment pointing at or past that index needs to shift up by `count` so it
  // keeps pointing at the SAME physical corner, not whatever now sits at its old index.
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

  // A boundary corner at `removedIndex` is gone — any attachment pointing exactly there
  // detaches (the wall keeps its last position, just stops following); everything past it
  // shifts down by one.
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

  // Re-resolves every attached endpoint against a new boundary — called alongside every
  // boundary edit that MOVES an existing corner (drag, typed length); those don't change
  // indices, just positions, so a plain vertexIndex lookup is all that's needed.
  function syncAttachedWalls(nextVertices: RoomVertex[]) {
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

  function handleEndpointDragStart() {
    pushHistory();
  }

  // Committing an endpoint drag. If it snapped onto a boundary wall, that point becomes a REAL
  // shared corner — actually inserted into `vertices` — so it's structurally attached (moves
  // with that wall from then on, colored black) rather than just visually coincident. Any
  // OTHER wall endpoints jointed to this one (a continuous-drawing elbow) move right along
  // with it, and inherit the same attachment if it snapped.
  function handleEndpointChange(wallId: string, end: 'start' | 'end', point: RoomVertex, snap_: SnapTarget | null) {
    const p = { x: snap(point.x), z: snap(point.z) };
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

    if (snap_?.host === 'boundary') {
      const insertedAt = snap_.edgeIndex + 1;
      const nextVertices = [...vertices.slice(0, insertedAt), p, ...vertices.slice(insertedAt)];
      onVerticesChange(nextVertices);
      shiftAttachmentsForInsert(insertedAt);
      onInteriorWallsChange(applyPointToGroup(interiorWalls));
      setAttachments((prev) => {
        const next = { ...prev };
        for (const m of group) next[m.wallId] = { ...next[m.wallId], [m.end]: { vertexIndex: insertedAt } };
        return next;
      });
    } else if (snap_?.host === 'interior' && !group.some((m) => m.wallId === snap_.wallId)) {
      // Snapped onto ANOTHER interior wall — split it at that point (same treatment as
      // snapping onto the boundary) and join this endpoint (and anything jointed to it) to
      // the split point as a real shared joint.
      const result = splitInteriorWallAt(interiorWalls, attachments, snap_.wallId, snap_.point);
      if (!result) return;
      onInteriorWallsChange(applyPointToGroup(result.walls));
      setAttachments(() => clearGroupAttachments(result.attachments));
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

  // Explicit "Separate" control on an attached (black) endpoint — detaches it in place,
  // without moving it, as an alternative to dragging it away: clears a boundary attachment
  // AND leaves any interior-wall joint, whichever kind made this endpoint attached.
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

  // Continuous drawing: clicking a free endpoint arms the draw tool and remembers which
  // wall/end it came from, so once the next segment is placed (addInteriorWall above) it can
  // be joined to that origin as a real shared point instead of a merely coincidental one.
  function handleFreeEndpointClick(wallId: string, end: 'start' | 'end') {
    pushHistory();
    continuousFrom.current = { wallId, end };
    setDrawMode(true);
  }

  return (
    <div className={styles.dimensionsLayout}>
      <div>
        <h2 className={styles.stepTitle}>Adjust your dimensions</h2>
        <p className={styles.stepSubtitle}>
          Drag a wall or corner in the plan, or click a dimension to type an exact length. Click the + on a wall to
          split it into two, or the × on a corner to remove it. Drag a drawn wall's endpoint to reposition it — it
          snaps onto a wall it gets close to.
        </p>

        <div className={styles.kindToggle}>
          <button
            type="button"
            className={drawMode ? styles.pillActive : styles.pill}
            onClick={() => setDrawMode((on) => !on)}
          >
            {drawMode ? 'Cancel drawing' : 'Draw a wall'}
          </button>
          <button type="button" className={styles.pill} onClick={undo} disabled={history.length === 0}>
            <FiRotateCcw style={{ verticalAlign: '-2px', marginRight: '0.35rem' }} />
            Undo
          </button>
        </div>

        <p className={styles.stepSubtitle}>Units shown on the plan</p>
        <div className={styles.kindToggle}>
          <button type="button" className={units === 'm' ? styles.pillActive : styles.pill} onClick={() => setUnits('m')}>
            Metres
          </button>
          <button type="button" className={units === 'ft' ? styles.pillActive : styles.pill} onClick={() => setUnits('ft')}>
            Feet
          </button>
        </div>

        <p className={styles.stepSubtitle}>Room height</p>
        <div className={styles.numberField}>
          <input
            type="number"
            step="0.1"
            min={MIN_HEIGHT}
            max={MAX_HEIGHT}
            value={height}
            onChange={(e) => {
              const value = parseFloat(e.target.value);
              if (Number.isFinite(value)) onHeightChange(Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, value)));
            }}
          />
          <span>m</span>
        </div>

        <p className={styles.stepSubtitle}>Wall thickness</p>
        <div className={styles.numberField}>
          <input
            type="number"
            step="1"
            min={MIN_THICKNESS_CM}
            max={MAX_THICKNESS_CM}
            value={Math.round(wallThickness * 100)}
            onChange={(e) => {
              const cm = parseFloat(e.target.value);
              if (Number.isFinite(cm)) onWallThicknessChange(Math.min(MAX_THICKNESS_CM, Math.max(MIN_THICKNESS_CM, cm)) / 100);
            }}
          />
          <span>cm</span>
        </div>
      </div>
      <div className={styles.previewPane}>
        <FloorPlanPreview
          vertices={vertices}
          units={units}
          onEdgeDragStart={beginDrag}
          onEdgeDrag={(edgeIndex, delta) => {
            const start = dragStart.current;
            if (!start) return;
            // Move ONLY this wall: translate its two endpoints along the wall's outward
            // normal. Every other vertex stays put — IKEA-style independent walls.
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
          }}
          onEdgeDragEnd={endDrag}
          onVertexDragStart={beginDrag}
          onVertexDrag={(vertexIndex, dx, dz) => {
            const start = dragStart.current;
            if (!start) return;
            // Move ONLY this corner; its two walls follow, everything else stays put.
            const v = start.vertices[vertexIndex];
            const next = start.vertices.map((sv, vi) =>
              vi === vertexIndex ? { x: snap(v.x + dx), z: snap(v.z + dz) } : sv,
            );
            if (edgesValid(next)) {
              onVerticesChange(next);
              syncAttachedWalls(next);
            }
          }}
          onVertexDragEnd={endDrag}
          onEdgeLengthChange={(edgeIndex, newLength) => {
            // Revit-style typed edit: keep the wall's START vertex fixed and place its END
            // vertex exactly `newLength` away along the wall's existing direction. The
            // neighboring wall that shares that end vertex follows (same as a corner drag).
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
          }}
          onWallAdd={addWall}
          onVertexRemove={vertices.length > 3 ? removeVertex : undefined}
          interiorWalls={interiorWalls}
          onInteriorWallRemove={removeInteriorWall}
          onInteriorWallSplit={splitInteriorWall}
          onInteriorWallEndpointDragStart={handleEndpointDragStart}
          onInteriorWallEndpointChange={handleEndpointChange}
          isEndpointAttached={isEndpointAttached}
          onInteriorWallEndpointDetach={handleEndpointDetach}
          onFreeEndpointClick={handleFreeEndpointClick}
          jointedEndpoints={jointMembers}
          drawMode={drawMode}
          onWallDrawComplete={addInteriorWall}
          onWallDrawCancel={() => setDrawMode(false)}
        />
      </div>
    </div>
  );
}
