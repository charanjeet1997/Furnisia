import { useEffect, useRef, useState } from 'react';
import { FiRotateCcw } from 'react-icons/fi';
import { computeEdges, type WallEdge } from '../../Components/polygonGeometry';
import { FloorPlanPreview, type PlanUnits, type SnapTarget } from './FloorPlanPreview';
import { DEFAULT_WALL_THICKNESS, type InteriorWall, type RoomOpening, type RoomVertex } from '../../Data/RoomShape';
import styles from './RoomBuilder.module.css';

interface StepDimensionsProps {
  vertices: RoomVertex[];
  onVerticesChange: (vertices: RoomVertex[]) => void;
  height: number;
  onHeightChange: (height: number) => void;
  // Per-boundary-edge thickness, parallel to the edge list. Edited per wall via the
  // click-a-wall property panel (there's no room-wide thickness input anymore).
  edgeThicknesses: number[];
  onEdgeThicknessesChange: (thicknesses: number[]) => void;
  interiorWalls: InteriorWall[];
  onInteriorWallsChange: (walls: InteriorWall[]) => void;
  // Doors/windows already placed (editing a saved room revisits this step AFTER Step 3 has
  // run at some point) — every edit here that renumbers boundary edges or splits/removes an
  // interior wall must keep them pointing at the same physical wall, or they silently vanish.
  openings: RoomOpening[];
  onOpeningsChange: (openings: RoomOpening[]) => void;
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

// Like segmentsIntersect, but returns WHERE: the intersection's position and its parameter
// `t` along a1→a2. Used by the draw tool to junction a new wall with every wall it crosses.
// The host side (b) is inclusive of its endpoints (a wall TIP lying on the drawn line is a
// junction too — splitInteriorWallAt resolves it to that tip instead of splitting); the drawn
// side (a) excludes points near its own ends, which are the endpoint-snap machinery's job.
function segmentIntersectionPoint(
  a1: RoomVertex,
  a2: RoomVertex,
  b1: RoomVertex,
  b2: RoomVertex,
): { t: number; point: RoomVertex } | null {
  const d1x = a2.x - a1.x;
  const d1z = a2.z - a1.z;
  const d2x = b2.x - b1.x;
  const d2z = b2.z - b1.z;
  const denom = d1x * d2z - d1z * d2x;
  if (Math.abs(denom) < 1e-9) return null; // parallel/collinear — no single crossing point
  const t = ((b1.x - a1.x) * d2z - (b1.z - a1.z) * d2x) / denom;
  const u = ((b1.x - a1.x) * d1z - (b1.z - a1.z) * d1x) / denom;
  if (t < 0 || t > 1 || u < -1e-9 || u > 1 + 1e-9) return null;
  const point = { x: a1.x + d1x * t, z: a1.z + d1z * t };
  if (Math.hypot(point.x - a1.x, point.z - a1.z) < 0.08) return null;
  if (Math.hypot(point.x - a2.x, point.z - a2.z) < 0.08) return null;
  return { t, point };
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
  openings: RoomOpening[],
  hostId: string,
  point: RoomVertex,
): {
  walls: InteriorWall[];
  attachments: Attachments;
  openings: RoomOpening[];
  member: { wallId: string; end: 'start' | 'end' };
  newJoin?: [{ wallId: string; end: 'start' | 'end' }, { wallId: string; end: 'start' | 'end' }];
} | null {
  const host = walls.find((w) => w.id === hostId);
  if (!host) return null;
  const p = { x: snap(point.x), z: snap(point.z) };
  const distStart = Math.hypot(p.x - host.start.x, p.z - host.start.z);
  const distEnd = Math.hypot(p.x - host.end.x, p.z - host.end.z);
  if (distStart < MIN_EDGE) return { walls, attachments: atts, openings, member: { wallId: hostId, end: 'start' } };
  if (distEnd < MIN_EDGE) return { walls, attachments: atts, openings, member: { wallId: hostId, end: 'end' } };

  const id1 = crypto.randomUUID();
  const id2 = crypto.randomUUID();
  const inherited = host.thickness !== undefined ? { thickness: host.thickness } : {};
  const nextWalls = [
    ...walls.filter((w) => w.id !== hostId),
    { id: id1, start: host.start, end: p, ...inherited },
    { id: id2, start: p, end: host.end, ...inherited },
  ];

  const origAtt = atts[hostId];
  const nextAtts = { ...atts };
  delete nextAtts[hostId];
  if (origAtt?.start) nextAtts[id1] = { ...nextAtts[id1], start: origAtt.start };
  if (origAtt?.end) nextAtts[id2] = { ...nextAtts[id2], end: origAtt.end };

  // A door/window on the host stays at its physical position: it moves to whichever half
  // now covers it (by its center), with the second half's offsets rebased past the cut.
  const len1 = Math.hypot(p.x - host.start.x, p.z - host.start.z);
  const nextOpenings = openings.map((o) => {
    if (o.interiorWallId !== hostId) return o;
    const center = o.offset + o.width / 2;
    return center <= len1 ? { ...o, interiorWallId: id1 } : { ...o, interiorWallId: id2, offset: o.offset - len1 };
  });

  return {
    walls: nextWalls,
    attachments: nextAtts,
    openings: nextOpenings,
    member: { wallId: id1, end: 'end' },
    newJoin: [{ wallId: id1, end: 'end' }, { wallId: id2, end: 'start' }],
  };
}

// Boundary edge `edgeIndex` was split by inserting `insertedPoints` (given in order of
// insertion into the vertex list, i.e. in order along the edge) — remap every boundary
// opening so it keeps its physical position: edges past the split renumber, and openings ON
// the split edge move to whichever new sub-edge covers their center, offsets rebased.
function remapOpeningsForEdgeSplit(
  openings: RoomOpening[],
  edge: WallEdge,
  edgeIndex: number,
  insertedPoints: RoomVertex[],
): RoomOpening[] {
  const cuts = insertedPoints
    .map((p) => Math.hypot(p.x - edge.start.x, p.z - edge.start.z))
    .sort((a, b) => a - b);
  return openings.map((o) => {
    if (o.interiorWallId) return o;
    if (o.edgeIndex > edgeIndex) return { ...o, edgeIndex: o.edgeIndex + insertedPoints.length };
    if (o.edgeIndex < edgeIndex) return o;
    const center = o.offset + o.width / 2;
    let seg = 0;
    let base = 0;
    for (const c of cuts) {
      if (center > c) {
        seg += 1;
        base = c;
      }
    }
    return { ...o, edgeIndex: edgeIndex + seg, offset: o.offset - base };
  });
}

// Boundary vertex inserted at `insertedAt` splits edge insertedAt-1 — the new sub-edge(s)
// inherit the split edge's thickness; entries after it just shift along.
function insertEdgeThickness(t: number[], insertedAt: number, count = 1): number[] {
  const inherited = t[insertedAt - 1] ?? DEFAULT_WALL_THICKNESS;
  return [...t.slice(0, insertedAt), ...Array(count).fill(inherited), ...t.slice(insertedAt)];
}

// Corner `vertexIndex` removed — its two edges merge, keeping the FIRST one's thickness
// (matching how the merged edge keeps that edge's openings offsets too).
function removeEdgeThickness(t: number[], vertexIndex: number): number[] {
  if (vertexIndex === 0) return t.slice(1);
  return [...t.slice(0, vertexIndex), ...t.slice(vertexIndex + 1)];
}

// Corner `vertexIndex` was removed, merging its two edges into one — remap boundary openings
// accordingly: the second edge's openings join the merged edge with offsets rebased past the
// first edge's length, and everything after renumbers down.
function remapOpeningsForVertexRemove(openings: RoomOpening[], edges: WallEdge[], vertexIndex: number): RoomOpening[] {
  const n = edges.length;
  const prevEdge = (vertexIndex - 1 + n) % n;
  const nextEdge = vertexIndex;
  const prevLen = edges[prevEdge].length;
  return openings.map((o) => {
    if (o.interiorWallId) return o;
    if (o.edgeIndex === nextEdge) return { ...o, edgeIndex: prevEdge > nextEdge ? prevEdge - 1 : prevEdge, offset: o.offset + prevLen };
    if (o.edgeIndex === prevEdge) return { ...o, edgeIndex: prevEdge > nextEdge ? prevEdge - 1 : prevEdge };
    if (o.edgeIndex > vertexIndex) return { ...o, edgeIndex: o.edgeIndex - 1 };
    return o;
  });
}

export function StepDimensions({
  vertices,
  onVerticesChange,
  height,
  onHeightChange,
  edgeThicknesses,
  onEdgeThicknessesChange,
  interiorWalls,
  onInteriorWallsChange,
  openings,
  onOpeningsChange,
}: StepDimensionsProps) {
  const [units, setUnits] = useState<PlanUnits>('m');

  // Snapshot at drag start: drags apply (snapshot + total delta), so clamped/rejected moves
  // never accumulate drift; edge normals are frozen too since the polygon changes mid-drag.
  const dragStart = useRef<{ vertices: RoomVertex[]; edges: WallEdge[] } | null>(null);
  // Snapshot of the interior wall being whole-wall-dragged — translate is (snapshot + total
  // normal delta), same pattern as the boundary edge drag above. A plain translate (not
  // re-resolved against attachments/joints mid-drag): dragging a wall that's pinned to the
  // boundary or jointed elsewhere is an edge case users rarely hit, and re-deriving the whole
  // chain's positions live would be a lot of machinery for it — dragging it detaches it
  // visually, same as dragging its endpoint away already does.
  const interiorDragStart = useRef<InteriorWall | null>(null);
  // Every wall id ever created BY extrudeChainIntoBoundary (the "original edge, reborn as an
  // interior wall" pieces). A preserved wall is ALSO attached to the boundary at both its
  // outer ends by construction — which makes it look exactly like a fresh candidate for
  // extrusion too. Without excluding these, the very next render would try to extrude the
  // preserved chain right back into the boundary, producing a new preserved chain that's
  // ALSO attached at both ends, forever — a real infinite loop (the "floor flickering, can't
  // draw" bug). A ref, not state: it's only ever read/written inside the effect below, never
  // needs to trigger a render itself.
  const preservedWallIdsRef = useRef<Set<string>>(new Set());

  // Undo history: one entry per completed EDIT (drag gesture, add/remove wall, typed length,
  // drawing/removing an interior wall) — not per intermediate pointer-move, otherwise undo
  // would only step back a pixel at a time instead of undoing the whole thing you just did.
  // Snapshots carry the WHOLE editing state — openings, attachments and joints included —
  // because splits/merges rewrite wall ids: restoring walls without the matching
  // attachment/joint/opening maps would leave them pointing at ids that no longer exist.
  interface HistoryEntry {
    vertices: RoomVertex[];
    interiorWalls: InteriorWall[];
    openings: RoomOpening[];
    edgeThicknesses: number[];
    attachments: Attachments;
    joints: Record<string, string[]>;
  }
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const HISTORY_LIMIT = 25;

  function pushHistory() {
    setHistory((h) => [...h.slice(-(HISTORY_LIMIT - 1)), { vertices, interiorWalls, openings, edgeThicknesses, attachments, joints }]);
  }

  function undo() {
    setHistory((h) => {
      if (h.length === 0) return h;
      const prev = h[h.length - 1];
      onVerticesChange(prev.vertices);
      onInteriorWallsChange(prev.interiorWalls);
      onOpeningsChange(prev.openings);
      onEdgeThicknessesChange(prev.edgeThicknesses);
      setAttachments(prev.attachments);
      setJoints(prev.joints);
      setSelected(null);
      return h.slice(0, -1);
    });
  }

  // Which wall's property panel is open — click a wall (boundary or interior) to select it.
  const [selected, setSelected] = useState<{ kind: 'edge'; index: number } | { kind: 'interior'; id: string } | null>(null);

  // Full-length thickness list, resilient to any length drift (older rooms have no entries).
  const normalizedThicknesses = () => vertices.map((_, i) => edgeThicknesses[i] ?? DEFAULT_WALL_THICKNESS);

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
    onOpeningsChange(remapOpeningsForEdgeSplit(openings, edge, edgeIndex, [mid]));
    onEdgeThicknessesChange(insertEdgeThickness(normalizedThicknesses(), insertedAt));
    setSelected(null); // boundary edge indices just shifted — stale selection would point elsewhere
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
      onOpeningsChange(remapOpeningsForVertexRemove(openings, computeEdges(vertices), vertexIndex));
      onEdgeThicknessesChange(removeEdgeThickness(normalizedThicknesses(), vertexIndex));
      setSelected(null);
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
    // Vertex-host snaps keep the corner's exact position — grid-rounding could pull the
    // point off the very corner it's attaching to (corners can sit off-grid after merges).
    const startPoint = startSnap?.host === 'vertex' ? startSnap.point : { x: snap(start.x), z: snap(start.z) };
    const endPoint = endSnap?.host === 'vertex' ? endSnap.point : { x: snap(end.x), z: snap(end.z) };
    let nextVertices = vertices;
    let workingWalls = interiorWalls;
    let workingAtts: Attachments = attachments;
    let workingOpenings = openings;
    let startVertexIndex: number | null = null;
    let endVertexIndex: number | null = null;
    let startMember: { wallId: string; end: 'start' | 'end' } | null = null;
    let endMember: { wallId: string; end: 'start' | 'end' } | null = null;
    const remaps: [string, string, string][] = [];
    const joinsToApply: [{ wallId: string; end: 'start' | 'end' }, { wallId: string; end: 'start' | 'end' }][] = [];

    function applyInteriorSnap(hostWallId: string, point: RoomVertex): { wallId: string; end: 'start' | 'end' } | null {
      const result = splitInteriorWallAt(workingWalls, workingAtts, workingOpenings, hostWallId, point);
      if (!result) return null;
      workingWalls = result.walls;
      workingAtts = result.attachments;
      workingOpenings = result.openings;
      if (result.newJoin) {
        joinsToApply.push(result.newJoin);
        remaps.push([hostWallId, result.newJoin[0].wallId, result.newJoin[1].wallId]);
      }
      return result.member;
    }

    let workingThicknesses = normalizedThicknesses();

    if (startSnap?.host === 'boundary' && endSnap?.host === 'boundary' && startSnap.edgeIndex === endSnap.edgeIndex) {
      // Both land on the SAME boundary wall — insert both at once, in the correct geometric
      // order along it (whichever is closer to that wall's own start vertex goes first).
      const insertAt = startSnap.edgeIndex + 1;
      const startFirst = startSnap.t <= endSnap.t;
      const [a, b] = startFirst ? [startPoint, endPoint] : [endPoint, startPoint];
      nextVertices = [...vertices.slice(0, insertAt), a, b, ...vertices.slice(insertAt)];
      shiftAttachmentsForInsert(insertAt, 2);
      workingOpenings = remapOpeningsForEdgeSplit(workingOpenings, computeEdges(vertices)[startSnap.edgeIndex], startSnap.edgeIndex, [a, b]);
      workingThicknesses = insertEdgeThickness(workingThicknesses, insertAt, 2);
      startVertexIndex = startFirst ? insertAt : insertAt + 1;
      endVertexIndex = startFirst ? insertAt + 1 : insertAt;
    } else {
      // Tracks where (if anywhere) the start's boundary insertion landed — vertex-host
      // attachments set startVertexIndex WITHOUT inserting, so "did the start insert"
      // and "does the start have a vertex index" are no longer the same question.
      let startInsertedAt: number | null = null;
      if (startSnap?.host === 'vertex') {
        // Landed on an EXISTING corner — reuse it, insert nothing.
        startVertexIndex = startSnap.vertexIndex;
      } else if (startSnap?.host === 'boundary') {
        startInsertedAt = startSnap.edgeIndex + 1;
        nextVertices = [...nextVertices.slice(0, startInsertedAt), startPoint, ...nextVertices.slice(startInsertedAt)];
        startVertexIndex = startInsertedAt;
        shiftAttachmentsForInsert(startInsertedAt);
        workingOpenings = remapOpeningsForEdgeSplit(workingOpenings, computeEdges(vertices)[startSnap.edgeIndex], startSnap.edgeIndex, [startPoint]);
      } else if (startSnap?.host === 'interior') {
        startMember = applyInteriorSnap(startSnap.wallId, startSnap.point);
      }
      if (endSnap?.host === 'vertex') {
        endVertexIndex = endSnap.vertexIndex;
        // The vertex index was captured before the start's insertion (if any) shifted it.
        if (startInsertedAt !== null && startInsertedAt <= endVertexIndex) endVertexIndex += 1;
      } else if (endSnap?.host === 'boundary') {
        // If the start's insertion landed at/before where the end needs to go, the end's
        // edgeIndex has shifted up by one to account for it.
        const endEdgeIndex = startInsertedAt !== null && endSnap.edgeIndex + 1 >= startInsertedAt ? endSnap.edgeIndex + 1 : endSnap.edgeIndex;
        const insertedAt = endEdgeIndex + 1;
        // Edge geometry for the opening remap comes from the INTERMEDIATE vertex list (the
        // start's insertion, if any, already renumbered/reshaped the edges — and
        // workingOpenings' indices were remapped to match it above).
        const intermediateEdges = computeEdges(nextVertices);
        nextVertices = [...nextVertices.slice(0, insertedAt), endPoint, ...nextVertices.slice(insertedAt)];
        endVertexIndex = insertedAt;
        shiftAttachmentsForInsert(insertedAt);
        workingOpenings = remapOpeningsForEdgeSplit(workingOpenings, intermediateEdges[endEdgeIndex], endEdgeIndex, [endPoint]);
        if (startVertexIndex !== null && startVertexIndex >= insertedAt) startVertexIndex += 1;
      } else if (endSnap?.host === 'interior') {
        endMember = applyInteriorSnap(endSnap.wallId, endSnap.point);
      }
    }

    // A drawn wall that passes straight THROUGH other walls must junction with every one it
    // crosses — split at each crossing into chained segments, splitting each crossed wall
    // too, with a real shared joint at every crossing — not float over them connected only
    // at its two ends. Crossings are collected against the post-endpoint-snap wall list,
    // ordered along the drawn direction, and grouped when several hosts meet the line at the
    // same physical point (crossing an existing junction).
    const rawCrossings: { hostId: string; point: RoomVertex; tNew: number }[] = [];
    for (const w of workingWalls) {
      const hit = segmentIntersectionPoint(startPoint, endPoint, w.start, w.end);
      if (hit) rawCrossings.push({ hostId: w.id, point: { x: snap(hit.point.x), z: snap(hit.point.z) }, tNew: hit.t });
    }
    rawCrossings.sort((a, b) => a.tNew - b.tNew);
    const crossGroups: { point: RoomVertex; hostIds: string[] }[] = [];
    for (const c of rawCrossings) {
      if (Math.hypot(c.point.x - startPoint.x, c.point.z - startPoint.z) < 0.08) continue;
      if (Math.hypot(c.point.x - endPoint.x, c.point.z - endPoint.z) < 0.08) continue;
      const last = crossGroups[crossGroups.length - 1];
      if (last && Math.hypot(last.point.x - c.point.x, last.point.z - c.point.z) < 0.05) last.hostIds.push(c.hostId);
      else crossGroups.push({ point: c.point, hostIds: [c.hostId] });
    }

    const chainPoints = [startPoint, ...crossGroups.map((g) => g.point), endPoint];
    const segmentIds = chainPoints.slice(0, -1).map(() => crypto.randomUUID());
    const newWalls = segmentIds.map((id, i) => ({ id, start: chainPoints[i], end: chainPoints[i + 1] }));
    const firstId = segmentIds[0];
    const lastId = segmentIds[segmentIds.length - 1];

    crossGroups.forEach((g, i) => {
      // The two chain segments meeting at this crossing…
      joinsToApply.push([{ wallId: segmentIds[i], end: 'end' }, { wallId: segmentIds[i + 1], end: 'start' }]);
      // …plus each crossed wall, split right here (or its own tip, when the crossing IS its
      // tip), all fused into one joint.
      for (const hostId of g.hostIds) {
        const member = applyInteriorSnap(hostId, g.point);
        if (member) joinsToApply.push([member, { wallId: segmentIds[i], end: 'end' }]);
      }
    });

    if (nextVertices !== vertices) onVerticesChange(nextVertices);
    onInteriorWallsChange([...workingWalls, ...newWalls]);
    if (workingOpenings !== openings) onOpeningsChange(workingOpenings);

    let finalAtts = workingAtts;
    if (startVertexIndex !== null || endVertexIndex !== null) {
      finalAtts = {
        ...finalAtts,
        ...(startVertexIndex !== null ? { [firstId]: { ...finalAtts[firstId], start: { vertexIndex: startVertexIndex } } } : {}),
      };
      if (endVertexIndex !== null) finalAtts = { ...finalAtts, [lastId]: { ...finalAtts[lastId], end: { vertexIndex: endVertexIndex } } };
    }
    if (finalAtts !== attachments) setAttachments(finalAtts);

    for (const [oldId, startOwnerId, endOwnerId] of remaps) remapJointMember(oldId, startOwnerId, endOwnerId);
    for (const pair of joinsToApply) joinEndpoints(pair[0], pair[1]);
    if (startMember) joinEndpoints(startMember, { wallId: firstId, end: 'start' });
    if (endMember) joinEndpoints(endMember, { wallId: lastId, end: 'end' });
    if (continuousFrom.current) joinEndpoints(continuousFrom.current, { wallId: firstId, end: 'start' });
    // The draw tool chains on from this wall's end (Revit-style polyline) — the NEXT
    // committed segment's start must fuse to it as one shared joint. Cleared by the tool's
    // finish gestures (Esc / same-point click) via onWallDrawCancel.
    continuousFrom.current = { wallId: lastId, end: 'end' };
  }

  function removeInteriorWall(id: string) {
    pushHistory();
    onInteriorWallsChange(interiorWalls.filter((w) => w.id !== id));
    leaveJoint(id, 'start');
    leaveJoint(id, 'end');

    let atts = { ...attachments };
    const removedAtt = atts[id];
    delete atts[id];
    let verts = vertices;
    // A removed wall takes its doors/windows with it — leaving them keyed to a dead wall id
    // would strand them invisibly in the saved room forever.
    let openingsNow = openings.filter((o) => o.interiorWallId !== id);
    let thicknesses = normalizedThicknesses();

    // A boundary corner that exists ONLY because this wall attached there — and doesn't
    // bend the boundary at all (collinear with its neighbors, i.e. the attachment landed
    // mid-edge rather than at a real shape corner) — is now dead weight left behind by the
    // wall that's gone. Clean it up the same way the corner's own × button would. Process
    // descending so removing the higher index first never invalidates the lower one.
    const candidates = [removedAtt?.start?.vertexIndex, removedAtt?.end?.vertexIndex]
      .filter((v): v is number => v !== undefined)
      .sort((a, b) => b - a);
    for (const vi of candidates) {
      if (verts.length <= 3) break;
      const n = verts.length;
      const prev = verts[(vi - 1 + n) % n];
      const cur = verts[vi];
      const next = verts[(vi + 1) % n];
      const cross = (cur.x - prev.x) * (next.z - prev.z) - (cur.z - prev.z) * (next.x - prev.x);
      if (Math.abs(cross) > 0.01) continue; // a real corner — some OTHER wall bowed the boundary here
      const stillUsed = Object.values(atts).some((a) => a.start?.vertexIndex === vi || a.end?.vertexIndex === vi);
      if (stillUsed) continue;

      openingsNow = remapOpeningsForVertexRemove(openingsNow, computeEdges(verts), vi);
      thicknesses = removeEdgeThickness(thicknesses, vi);
      verts = verts.filter((_, i) => i !== vi);
      const shift = (a?: WallAttachment) => (!a ? undefined : { vertexIndex: a.vertexIndex > vi ? a.vertexIndex - 1 : a.vertexIndex });
      const next_: Attachments = {};
      for (const [wid, a] of Object.entries(atts)) {
        const s = { start: shift(a.start), end: shift(a.end) };
        if (s.start || s.end) next_[wid] = s;
      }
      atts = next_;
    }

    if (verts !== vertices) onVerticesChange(verts);
    if (openingsNow !== openings) onOpeningsChange(openingsNow);
    onEdgeThicknessesChange(thicknesses);
    setAttachments(atts);
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
    const result = splitInteriorWallAt(interiorWalls, attachments, openings, id, mid);
    if (!result?.newJoin) return; // length guard above means mid is never within MIN_EDGE of an end
    onInteriorWallsChange(result.walls);
    setAttachments(result.attachments);
    if (result.openings !== openings) onOpeningsChange(result.openings);
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
      // Every group already containing either key merges into ONE — a and b may each belong
      // to a different existing joint (e.g. closing a loop between two elbows), and leaving
      // both groups alive with overlapping members makes jointMembers answer differently
      // depending on which group it happens to find first.
      const touching = Object.entries(prev).filter(([, members]) => members.includes(aKey) || members.includes(bKey));
      const untouched = Object.fromEntries(Object.entries(prev).filter(([id]) => !touching.some(([tid]) => tid === id)));
      const merged = new Set(touching.flatMap(([, members]) => members));
      merged.add(aKey);
      merged.add(bKey);
      return { ...untouched, [touching[0]?.[0] ?? crypto.randomUUID()]: [...merged] };
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

  // EXTRUDE, not merge: a chain of interior walls that bridges TWO BOUNDARY CORNERS (not
  // necessarily adjacent — after one extrusion, the next one's endpoints often land on
  // corners with others in between) becomes the room's new outer edge across that whole
  // span (the enclosed area — old room + the new bulge — becomes one continuous floor). The
  // ORIGINAL edges being replaced are kept too — each reborn as its own interior wall at
  // its exact original position, chained together at their old shared corners — an internal
  // partition run inside the bigger footprint instead of being deleted. Both the old walls'
  // points and the new wall's floor survive.
  //
  // Only ever replaces the SHORTER of the two arcs between the two corners — and that arc
  // can WRAP past the end of the vertex list back to index 0 (e.g. bottom-left back to
  // top-left, in a typical clockwise room, is index n-1 back to 0 — the short way — not the
  // "long way" through every other corner). All the index arithmetic below is modulo n for
  // exactly that reason.
  //
  // Returns whether it actually extruded — a self-intersecting path, or a span with a
  // corner some OTHER wall still depends on, is left alone; the caller needs to know which
  // happened so it can keep scanning the rest instead of stopping after one non-extrudable
  // candidate.
  function extrudeChainIntoBoundary(startIdx: number, endIdx: number, steps: { wallId: string; entryEnd: 'start' | 'end' }[]): boolean {
    if (startIdx === endIdx) return false;
    const n = vertices.length;
    const mergedIds = new Set(steps.map((s) => s.wallId));

    // Two possible arcs between the corners going around the polygon; take the shorter one
    // (fewer edges) — the new path is assumed to bulge out from the near side, not loop all
    // the way around the far side of the room.
    const forwardLen = (endIdx - startIdx + n) % n; // edges walking forward (wrapping) startIdx -> endIdx
    const goForward = forwardLen * 2 <= n;
    const runFrom = goForward ? startIdx : endIdx;
    const runTo = goForward ? endIdx : startIdx;
    const runLength = goForward ? forwardLen : n - forwardLen;
    // Whether the chain (as originally walked, startIdx -> endIdx) begins at runFrom — if
    // not, `newPoints` below needs reversing to read runFrom-side -> runTo-side instead.
    const bulgeStartsAtRunFrom = startIdx === runFrom;

    // The ORIGINAL vertex indices in the run, walking forward with wraparound from runFrom
    // to runTo — e.g. [5, 0] for the wraparound bottom-left(5) -> top-left(0) edge in a
    // 6-vertex room.
    const runIndices: number[] = [];
    for (let k = 0; k <= runLength; k++) runIndices.push((runFrom + k) % n);
    const runEdgeIndices = runIndices.slice(0, -1); // edge i = vertices[i] -> vertices[(i+1)%n]
    const interiorIndices = runIndices.slice(1, -1); // run's own corners, strictly between the two ends
    const interiorSet = new Set(interiorIndices);

    // A corner strictly inside the run is about to stop existing on the boundary (the run
    // gets chamfered/replaced). Any OTHER wall (e.g. a partition, or a wall preserved by an
    // earlier extrude) attached at that corner must be DETACHED from it — it keeps its own
    // stored coordinates and just becomes a free interior point there, so cutting across a
    // corner is allowed (extrude-from-anywhere) instead of refused.
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
    newPoints.pop(); // last point is the terminal boundary vertex — already in `vertices`
    const orderedNewPoints = bulgeStartsAtRunFrom ? newPoints : [...newPoints].reverse();

    // Build the new vertex list by keeping every vertex NOT strictly inside the run (in
    // original circular order — this alone correctly handles the wraparound case, since a
    // plain index filter doesn't care where the array "starts"), then inserting the bulge
    // right after runFrom's new position.
    const keptVertices: RoomVertex[] = [];
    const oldToKeptIndex = new Map<number, number>();
    for (let i = 0; i < n; i++) {
      if (interiorSet.has(i)) continue;
      oldToKeptIndex.set(i, keptVertices.length);
      keptVertices.push(vertices[i]);
    }
    const insertAt = oldToKeptIndex.get(runFrom)! + 1;
    const nextVertices = [...keptVertices.slice(0, insertAt), ...orderedNewPoints, ...keptVertices.slice(insertAt)];
    if (!edgesValid(nextVertices)) return false; // would self-intersect — leave it as an unmerged partition

    // Where an old (kept, non-run) vertex/edge index ends up in the new numbering.
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

    // Each ORIGINAL edge in the replaced run is reborn as its own interior wall at its exact
    // original position, chained to its neighbors at their old shared corners.
    const preservedIds = runEdgeIndices.map(() => crypto.randomUUID());
    for (const id of preservedIds) preservedWallIdsRef.current.add(id);
    const preservedWalls: InteriorWall[] = preservedIds.map((id, k) => ({
      id,
      start: vertices[runIndices[k]],
      end: vertices[runIndices[k + 1]],
      thickness: preservedThicknesses[k],
    }));
    onInteriorWallsChange([...interiorWalls.filter((w) => !mergedIds.has(w.id)), ...preservedWalls]);

    // Openings: the chain walls' own openings are dropped (that geometry is gone). One that
    // was on an original edge inside the run moves onto that edge's preserved wall instead —
    // same start/end, so its offset needs no rebasing. Everything else just renumbers.
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
        // Detach ends that were pinned to an interior corner leaving the boundary (see
        // toDetach above) — the shift() function has no mapping for a removed vertex anyway.
        const dropStart = toDetach.some((d) => d.wallId === wallId && d.end === 'start');
        const dropEnd = toDetach.some((d) => d.wallId === wallId && d.end === 'end');
        const shiftAtt = (a: WallAttachment | undefined, drop: boolean) => (a && !drop ? { vertexIndex: shift(a.vertexIndex) } : undefined);
        const shifted = { start: shiftAtt(att.start, dropStart), end: shiftAtt(att.end, dropEnd) };
        if (shifted.start || shifted.end) next[wallId] = shifted;
      }
      // The two OUTER ends of the preserved chain attach to the same corners the run's own
      // ends always had; nothing marks the INNER joints between preserved walls as boundary
      // attachments (setJoints below links them to each other instead).
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
      // Chain the preserved walls together at their old shared corners.
      for (let k = 1; k < preservedIds.length; k++) {
        const a = `${preservedIds[k - 1]}:end`;
        const b = `${preservedIds[k]}:start`;
        next[crypto.randomUUID()] = [a, b];
      }
      return next;
    });

    return true;
  }

  // After every commit, check whether any boundary-attached endpoint now has a path — direct
  // or through a chain of joints — back to ANOTHER boundary corner, and extrude the footprint
  // if so (keeping the original edge as a new interior wall — see extrudeChainIntoBoundary).
  // Runs as an effect (not inline in the commit handlers) so it always sees the fully-settled
  // attachments/joints/walls state, not a snapshot mid-update.
  useEffect(() => {
    for (const [wallId, att] of Object.entries(attachments)) {
      // A wall PRESERVED by a previous extrude is attached at both ends by construction —
      // it must never itself seed another extrude (see preservedWallIdsRef's own comment).
      if (preservedWallIdsRef.current.has(wallId)) continue;
      for (const end of ['start', 'end'] as const) {
        const a = att[end];
        if (!a) continue;
        const result = walkChainToBoundary(wallId, end);
        if (!result || result.endBoundaryVertexIndex === a.vertexIndex) continue;
        // Only stop once something ACTUALLY extruded — state really changed, so this effect
        // re-runs on the new state anyway. A non-adjacent (or self-intersecting) candidate is
        // a legitimate ordinary partition, not "handled" — keep scanning the rest instead of
        // abandoning every other wall's chance this render.
        if (extrudeChainIntoBoundary(a.vertexIndex, result.endBoundaryVertexIndex, result.steps)) return;
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
    // A vertex-host snap keeps the corner's EXACT position (it may sit off the 0.1m grid
    // after a boundary merge) — rounding it would detach the point from the very corner
    // it's attaching to.
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
      // Landed on an EXISTING corner — attach straight to it, no insertion at all.
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
      // Snapped onto ANOTHER interior wall — split it at that point (same treatment as
      // snapping onto the boundary) and join this endpoint (and anything jointed to it) to
      // the split point as a real shared joint.
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

  // Continuous drawing: clicking a free endpoint starts a new segment from that exact point
  // and remembers which wall/end it came from, so once the segment is placed (addInteriorWall
  // above) it can be joined to that origin as a real shared point instead of a merely
  // coincidental one.
  function handleFreeEndpointClick(wallId: string, end: 'start' | 'end') {
    pushHistory();
    continuousFrom.current = { wallId, end };
  }

  // Applies a thickness (cm, NOT yet clamped to the min — see the input's own comment) to
  // whichever wall is currently selected.
  function applyThicknessCm(sel: NonNullable<typeof selected>, cm: number) {
    const meters = cm / 100;
    if (sel.kind === 'edge') {
      const next = normalizedThicknesses();
      next[sel.index] = meters;
      onEdgeThicknessesChange(next);
    } else {
      onInteriorWallsChange(interiorWalls.map((w) => (w.id === sel.id ? { ...w, thickness: meters } : w)));
    }
  }

  return (
    <div className={styles.dimensionsLayout}>
      <div>
        <h2 className={styles.stepTitle}>Adjust your dimensions</h2>
        <p className={styles.stepSubtitle}>
          Drag a wall or corner in the plan, or click a dimension to type an exact length. To draw a new wall, just
          click anywhere on the plan — the + marker under your cursor shows where it'll start — then click again to
          place its end. Click the + on a wall to split it into two, or the × on a corner to remove it. Drag a drawn
          wall's endpoint to reposition it — it snaps onto a wall it gets close to.
        </p>

        <div className={styles.kindToggle}>
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
            // Only the MAX clamps live — clamping the min on every keystroke makes a value
            // below it unreachable (typing "1" of "15" gets snapped straight to the min
            // before the second digit ever lands). The min is enforced on blur instead, once
            // the user's actually done typing.
            onChange={(e) => {
              const value = parseFloat(e.target.value);
              if (Number.isFinite(value)) onHeightChange(Math.min(MAX_HEIGHT, value));
            }}
            onBlur={() => onHeightChange(Math.max(MIN_HEIGHT, height))}
          />
          <span>m</span>
        </div>

        {/* Per-wall property panel — click any wall (boundary or interior) in the plan to
            select it and edit ITS thickness here; there's no room-wide thickness anymore. */}
        {selected && (
          <>
            <p className={styles.stepSubtitle}>{selected.kind === 'edge' ? `Wall ${selected.index + 1}` : 'Selected wall'} thickness</p>
            <div className={styles.numberField}>
              <input
                type="number"
                step="1"
                min={MIN_THICKNESS_CM}
                max={MAX_THICKNESS_CM}
                value={Math.round(
                  (selected.kind === 'edge'
                    ? (edgeThicknesses[selected.index] ?? DEFAULT_WALL_THICKNESS)
                    : (interiorWalls.find((w) => w.id === selected.id)?.thickness ?? DEFAULT_WALL_THICKNESS)) * 100,
                )}
                onChange={(e) => {
                  const cm = parseFloat(e.target.value);
                  if (!Number.isFinite(cm)) return;
                  // Same reasoning as the room-height field above: only MAX clamps live, MIN
                  // is enforced on blur, or "15" can never be typed past the "1".
                  applyThicknessCm(selected, Math.min(MAX_THICKNESS_CM, cm));
                }}
                onBlur={(e) => {
                  const cm = parseFloat(e.target.value);
                  if (Number.isFinite(cm)) applyThicknessCm(selected, Math.max(MIN_THICKNESS_CM, cm));
                }}
              />
              <span>cm</span>
            </div>
            <button type="button" className={styles.pill} onClick={() => setSelected(null)}>
              Done
            </button>
          </>
        )}
      </div>
      <div className={styles.previewPane}>
        <FloorPlanPreview
          vertices={vertices}
          units={units}
          edgeThicknesses={normalizedThicknesses()}
          selectedEdgeIndex={selected?.kind === 'edge' ? selected.index : null}
          selectedInteriorWallId={selected?.kind === 'interior' ? selected.id : null}
          onEdgeClick={(edgeIndex) => {
            setSelected({ kind: 'edge', index: edgeIndex });
          }}
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
          onInteriorWallClick={(id) => {
            setSelected({ kind: 'interior', id });
          }}
          onInteriorWallDragStart={(id) => {
            pushHistory();
            interiorDragStart.current = interiorWalls.find((w) => w.id === id) ?? null;
          }}
          onInteriorWallDrag={(id, delta) => {
            const orig = interiorDragStart.current;
            if (!orig || orig.id !== id) return;
            const dx = orig.end.x - orig.start.x;
            const dz = orig.end.z - orig.start.z;
            const len = Math.hypot(dx, dz) || 1;
            const nx = dz / len;
            const nz = -dx / len;
            const d = snap(delta);
            // A boundary-attached end stays exactly where it is (pinned to a fixed point on
            // the room's outline). A FREE end moves — and takes anything jointed to it along
            // for the ride, same as dragging that one endpoint's own handle already does, so
            // a whole-wall Move never silently breaks a joint to another free wall.
            const startFree = !isEndpointAttached(id, 'start');
            const endFree = !isEndpointAttached(id, 'end');
            const newStart = { x: snap(orig.start.x + nx * d), z: snap(orig.start.z + nz * d) };
            const newEnd = { x: snap(orig.end.x + nx * d), z: snap(orig.end.z + nz * d) };

            const updates = new Map<string, Partial<InteriorWall>>();
            function applyPoint(wallId: string, end: 'start' | 'end', point: RoomVertex) {
              updates.set(wallId, { ...updates.get(wallId), [end]: point });
            }
            if (startFree) {
              applyPoint(id, 'start', newStart);
              for (const m of jointMembers(id, 'start')) applyPoint(m.wallId, m.end, newStart);
            }
            if (endFree) {
              applyPoint(id, 'end', newEnd);
              for (const m of jointMembers(id, 'end')) applyPoint(m.wallId, m.end, newEnd);
            }
            onInteriorWallsChange(interiorWalls.map((w) => (updates.has(w.id) ? { ...w, ...updates.get(w.id) } : w)));
          }}
          onInteriorWallEndpointDragStart={handleEndpointDragStart}
          onInteriorWallEndpointChange={handleEndpointChange}
          isEndpointAttached={isEndpointAttached}
          onInteriorWallEndpointDetach={handleEndpointDetach}
          onFreeEndpointClick={handleFreeEndpointClick}
          jointedEndpoints={jointMembers}
          onWallDrawComplete={addInteriorWall}
          onWallDrawCancel={() => {
            // An abandoned (Escaped) draw must also abandon its chain origin, or the NEXT
            // wall drawn from anywhere would wrongly joint itself to this stale point.
            continuousFrom.current = null;
          }}
        />
      </div>
    </div>
  );
}
