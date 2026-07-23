import { useEffect, useRef, useState } from 'react';
import { computeEdges, boundingBox } from '../../Components/polygonGeometry';
import type { InteriorWall, RoomOpening, RoomVertex } from '../../Data/RoomShape';
import styles from './FloorPlanPreview.module.css';

export type PlanUnits = 'm' | 'ft';

// Where an interior-wall endpoint snapped to — either a boundary wall (the existing
// edgeIndex/t addressing) or ANOTHER interior wall (addressed by its own id/t instead). Both
// carry the resolved snap `point` so every consumer that only cares about "where" can ignore
// which kind of host it is.
export type SnapTarget =
  | { host: 'boundary'; edgeIndex: number; t: number; point: RoomVertex }
  | { host: 'interior'; wallId: string; t: number; point: RoomVertex };

interface FloorPlanPreviewProps {
  vertices: RoomVertex[];
  openings?: RoomOpening[];
  // Return a short rejection message (e.g. "Wall too small for this door") to reject the
  // click — the wall flashes red and the message toasts briefly instead of placing anything.
  // Return nothing/undefined to accept.
  onEdgeClick?: (edgeIndex: number) => string | void;
  highlightedEdgeIndex?: number | null;
  units?: PlanUnits;
  // Wall-dragging (IKEA-style). `delta` is the TOTAL displacement since drag start, in
  // meters along the edge's outward normal — pair with a params snapshot taken in
  // onEdgeDragStart (see edgeDrag.applyEdgeDrag).
  onEdgeDragStart?: (edgeIndex: number) => void;
  onEdgeDrag?: (edgeIndex: number, delta: number) => void;
  onEdgeDragEnd?: () => void;
  // Corner-dragging: raw displacement in meters (dz is plan-down = world +z); the caller
  // resolves it against the two adjacent walls' params.
  onVertexDragStart?: (vertexIndex: number) => void;
  onVertexDrag?: (vertexIndex: number, dx: number, dz: number) => void;
  onVertexDragEnd?: () => void;
  // Revit-style inline dimension editing: clicking a wall's length label turns it into a
  // text box; committing calls this with the wall's new length in METERS (always meters,
  // regardless of the `units` display toggle, to keep parsing unambiguous).
  onEdgeLengthChange?: (edgeIndex: number, newLength: number) => void;
  // Workspace-style opening editing: hover a placed door/window to reveal a × handle over it
  // (removes it in place — no sidebar list); drag its body to slide it along its wall.
  // `openingIndex` is the index into the `openings` array. Drag delta is the TOTAL
  // displacement since drag start, in meters along the wall's own direction.
  onOpeningRemove?: (openingIndex: number) => void;
  onOpeningDragStart?: (openingIndex: number) => void;
  onOpeningDrag?: (openingIndex: number, delta: number) => void;
  onOpeningDragEnd?: () => void;
  // Splits the wall at `edgeIndex` into two by inserting a new corner at its midpoint.
  onWallAdd?: (edgeIndex: number) => void;
  // Deletes the corner at `vertexIndex`, merging its two walls into one straight wall.
  onVertexRemove?: (vertexIndex: number) => void;
  // Free-standing interior walls (partitions) — independent of the boundary polygon, drawn
  // anywhere on the plan.
  interiorWalls?: InteriorWall[];
  onInteriorWallRemove?: (id: string) => void;
  // Splits an interior wall into two at its midpoint — same idea as onWallAdd above, for
  // interior walls instead of boundary ones.
  onInteriorWallSplit?: (id: string) => void;
  // Click-to-place a door/window on an interior wall (Step 3) — same rejection-message
  // contract as onEdgeClick above.
  onInteriorWallClick?: (id: string) => string | void;
  // Dragging an interior wall's endpoint. Snaps magnetically onto a boundary wall within
  // SNAP_DISTANCE — `attach` reports where (so the caller can keep it pinned to that wall as
  // it moves); `attach: null` means it ended up free-floating in open space.
  onInteriorWallEndpointDragStart?: (wallId: string, end: 'start' | 'end') => void;
  onInteriorWallEndpointChange?: (
    wallId: string,
    end: 'start' | 'end',
    point: RoomVertex,
    attach: SnapTarget | null,
  ) => void;
  // Whether a given endpoint is currently attached to a boundary wall — drives the black
  // (attached, behaves like a real corner) vs. gray (free-floating) coloring.
  isEndpointAttached?: (wallId: string, end: 'start' | 'end') => boolean;
  // Explicit "Separate" control shown on an attached (black) endpoint — detaches it back to a
  // free point without moving it, as an alternative to dragging it away.
  onInteriorWallEndpointDetach?: (wallId: string, end: 'start' | 'end') => void;
  // A free (unattached) endpoint was clicked (not dragged) — continuous-drawing: lets the user
  // start a brand-new wall segment picking up exactly where a free end left off, without going
  // back to the "Draw a wall" toggle. Reports which wall/end it came from so the caller can
  // join the new segment to it as a real shared point.
  onFreeEndpointClick?: (wallId: string, end: 'start' | 'end', point: RoomVertex) => void;
  // Other wall endpoints that are the SAME physical point as this one (a continuous-drawing
  // elbow) — used to make them visually follow together during a live drag, not just after
  // the drag commits.
  jointedEndpoints?: (wallId: string, end: 'start' | 'end') => { wallId: string; end: 'start' | 'end' }[];
  // Click-move-click draw: click anywhere to start, move freely (live dashed preview + length
  // follow the cursor), click again to place the end. Purely additive — never touches the
  // room's boundary (`vertices`). `drawMode` arms it; it disarms itself after one placement or
  // Escape.
  drawMode?: boolean;
  onWallDrawComplete?: (
    start: RoomVertex,
    end: RoomVertex,
    startSnap: SnapTarget | null,
    endSnap: SnapTarget | null,
  ) => void;
  onWallDrawCancel?: () => void;
}

const PAD = 1.1; // room for the outside dimension lines
const WALL_STROKE = 0.18;
const DIM_OFFSET = 0.45; // dimension line distance from the wall
const DIM_TICK = 0.12; // half-length of the tick marks at dimension line ends
const FLOOR_FILL = '#dcc49c'; // light wood tone
const SNAP_DISTANCE = 0.3; // meters — how close an interior-wall endpoint must get to a
// boundary wall before it magnetically snaps onto it
// Closing a loop (e.g. finishing a room-extension bay) depends on two independent wall TIPS
// actually catching each other — that's a harder click to land than dragging onto the middle
// of a long wall, so tips get a more generous catch radius than SNAP_DISTANCE.
const ENDPOINT_SNAP_DISTANCE = 0.5;

const snapDraw = (v: number) => Math.round(v * 10) / 10; // 0.1m grid, matches every other edit path

function formatLength(meters: number, units: PlanUnits): string {
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

// Resize cursor matching the wall's orientation (normal direction).
function edgeCursor(normal: RoomVertex): string {
  if (Math.abs(normal.x) > 0.92) return 'ew-resize';
  if (Math.abs(normal.z) > 0.92) return 'ns-resize';
  return normal.x * normal.z > 0 ? 'nwse-resize' : 'nesw-resize';
}

type DragState =
  | { kind: 'edge'; index: number; startX: number; startY: number; scale: number; normal: RoomVertex }
  | { kind: 'vertex'; index: number; startX: number; startY: number; scale: number }
  | { kind: 'opening'; index: number; startX: number; startY: number; scale: number; dir: RoomVertex };

export function FloorPlanPreview({
  vertices,
  openings = [],
  onEdgeClick,
  highlightedEdgeIndex = null,
  units = 'm',
  onEdgeDragStart,
  onEdgeDrag,
  onEdgeDragEnd,
  onVertexDragStart,
  onVertexDrag,
  onVertexDragEnd,
  onEdgeLengthChange,
  onOpeningRemove,
  onOpeningDragStart,
  onOpeningDrag,
  onOpeningDragEnd,
  onWallAdd,
  onVertexRemove,
  interiorWalls = [],
  onInteriorWallRemove,
  onInteriorWallSplit,
  onInteriorWallClick,
  onInteriorWallEndpointDragStart,
  onInteriorWallEndpointChange,
  isEndpointAttached,
  onInteriorWallEndpointDetach,
  onFreeEndpointClick,
  jointedEndpoints,
  drawMode = false,
  onWallDrawComplete,
  onWallDrawCancel,
}: FloorPlanPreviewProps) {
  const edges = computeEdges(vertices);
  // The plan must fit whatever's actually drawn, not just the boundary — a wall drawn well
  // outside it (e.g. extending out from a corner) would otherwise get clipped by the viewBox
  // instead of scrolling the view out to show it.
  const bbox = boundingBox([...vertices, ...interiorWalls.flatMap((w) => [w.start, w.end])]);
  const centroid = { x: (bbox.minX + bbox.maxX) / 2, z: (bbox.minZ + bbox.maxZ) / 2 };

  // Dragging an interior wall's own endpoint (separate from the boundary drag machinery below
  // since this one needs absolute cursor tracking + live snap detection, not relative deltas).
  const [draggingEndpoint, setDraggingEndpoint] = useState<{ wallId: string; end: 'start' | 'end'; origin: RoomVertex } | null>(null);
  const [endpointLive, setEndpointLive] = useState<RoomVertex | null>(null);
  const [endpointSnap, setEndpointSnap] = useState<SnapTarget | null>(null);

  // Resolves an opening's host wall geometry — either a boundary edge, or (when
  // `interiorWallId` is set) a free-standing interior wall, computed with the same
  // start/end/length/normal shape as a boundary WallEdge so every opening-rendering/dragging
  // calculation below works identically regardless of which kind of wall it's on.
  function openingHost(opening: RoomOpening): { start: RoomVertex; end: RoomVertex; length: number; normal: RoomVertex } | null {
    if (opening.interiorWallId) {
      const wall = interiorWalls.find((w) => w.id === opening.interiorWallId);
      if (!wall) return null;
      const dx = wall.end.x - wall.start.x;
      const dz = wall.end.z - wall.start.z;
      const length = Math.hypot(dx, dz);
      if (length < 1e-6) return null;
      return { start: wall.start, end: wall.end, length, normal: { x: dz / length, z: -dx / length } };
    }
    return edges[opening.edgeIndex] ?? null;
  }

  // Closest point to `p` on any boundary wall OR interior wall, if within SNAP_DISTANCE — the
  // "magnetism" that lets an interior wall's endpoint attach to whichever wall it's dragged
  // near, boundary or interior alike. `excludeWallId` keeps a wall's own endpoint from
  // snapping onto itself (or, via its jointed partners — see callers) while being dragged.
  function findSnap(p: RoomVertex, excludeWallId?: string): SnapTarget | null {
    let best: (SnapTarget & { dist: number }) | null = null;
    edges.forEach((edge, edgeIndex) => {
      const abx = edge.end.x - edge.start.x;
      const abz = edge.end.z - edge.start.z;
      const lenSq = abx * abx + abz * abz || 1;
      const t = Math.max(0, Math.min(1, ((p.x - edge.start.x) * abx + (p.z - edge.start.z) * abz) / lenSq));
      const point = { x: edge.start.x + abx * t, z: edge.start.z + abz * t };
      const dist = Math.hypot(p.x - point.x, p.z - point.z);
      if (dist <= SNAP_DISTANCE && (!best || dist < best.dist)) best = { host: 'boundary', edgeIndex, t, point, dist };
    });
    interiorWalls.forEach((wall) => {
      if (wall.id === excludeWallId) return;
      // Tip-to-tip first, with the wider radius — checked before the general along-the-wall
      // projection below so a point that's genuinely closer to the LINE than to either tip
      // (the normal T-junction case) still prefers the line, while a point that's only close
      // to a tip specifically gets that tip's more generous catch.
      for (const [t, point] of [[0, wall.start] as const, [1, wall.end] as const]) {
        const dist = Math.hypot(p.x - point.x, p.z - point.z);
        if (dist <= ENDPOINT_SNAP_DISTANCE && (!best || dist < best.dist)) best = { host: 'interior', wallId: wall.id, t, point, dist };
      }
      const abx = wall.end.x - wall.start.x;
      const abz = wall.end.z - wall.start.z;
      const lenSq = abx * abx + abz * abz || 1;
      const t = Math.max(0, Math.min(1, ((p.x - wall.start.x) * abx + (p.z - wall.start.z) * abz) / lenSq));
      const point = { x: wall.start.x + abx * t, z: wall.start.z + abz * t };
      const dist = Math.hypot(p.x - point.x, p.z - point.z);
      if (dist <= SNAP_DISTANCE && (!best || dist < best.dist)) best = { host: 'interior', wallId: wall.id, t, point, dist };
    });
    return best;
  }

  // Click-move-click draw: first click sets the start point (anywhere — not constrained to an
  // existing wall), mouse move previews the end, second click commits. Purely additive: this
  // never reads or writes `vertices`, only reports the two points via onWallDrawComplete.
  const [drawStart, setDrawStart] = useState<RoomVertex | null>(null);
  const [drawEnd, setDrawEnd] = useState<RoomVertex | null>(null);
  // Snap state for each click of the draw gesture — lets a wall drawn directly onto a
  // boundary wall attach immediately, same as dragging an endpoint onto one, instead of
  // requiring a drag-away-and-back afterward to trigger the snap.
  const [drawStartSnap, setDrawStartSnap] = useState<SnapTarget | null>(null);
  const [drawEndSnap, setDrawEndSnap] = useState<SnapTarget | null>(null);
  const [hoveredInteriorWall, setHoveredInteriorWall] = useState<string | null>(null);
  const width = bbox.maxX - bbox.minX;
  const depth = bbox.maxZ - bbox.minZ;
  const viewW = width + PAD * 2;
  const viewH = depth + PAD * 2;
  const fitViewBox = `${bbox.minX - PAD} ${bbox.minZ - PAD} ${viewW} ${viewH}`;
  const points = vertices.map((v) => `${v.x},${v.z}`).join(' ');

  // While a drag is in progress the viewport is FROZEN at its drag-start fit: re-fitting
  // live would re-scale/re-center the whole drawing, making untouched walls appear to move.
  // On release it re-fits once (state, not ref, so releasing triggers the re-render).
  const [frozenViewBox, setFrozenViewBox] = useState<string | null>(null);
  const viewBox = frozenViewBox ?? fitViewBox;

  const svgRef = useRef<SVGSVGElement>(null);
  // Screen-px → svg-meters scale and the dragged edge's normal are frozen at drag start:
  // the polygon re-fits (re-centers/re-scales) as params change mid-drag, and deriving
  // them live would make the mapping feed back on itself.
  const dragRef = useRef<DragState | null>(null);
  // Suppress the click handler after an actual drag so click-to-select (StepOpenings)
  // could coexist with dragging if both are ever enabled at once.
  const movedRef = useRef(false);

  // Which wall's dimension label is currently an editable text box (Revit-style).
  const [editingEdge, setEditingEdge] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');

  // Which placed opening the pointer is currently over — shows its × remove handle.
  const [hoveredOpening, setHoveredOpening] = useState<number | null>(null);

  // A rejected wall click (too small / already occupied): flashes that wall red and toasts
  // the reason. `token` forces the flash to restart even if the same wall is rejected twice
  // in a row (a fresh key remounts the animated element instead of a no-op re-render).
  // `edgeIndex` is only present for a boundary-wall rejection (drives the wall-outline flash
  // below); an interior-wall rejection still shows the toast, just without that outline.
  const [rejectedClick, setRejectedClick] = useState<{ edgeIndex?: number; message: string; token: number } | null>(null);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function flashRejection(edgeIndex: number | undefined, message: string) {
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    setRejectedClick({ edgeIndex, message, token: Date.now() });
    errorTimerRef.current = setTimeout(() => setRejectedClick(null), 1300);
  }

  function commitEdit(edgeIndex: number, raw: string) {
    const value = parseFloat(raw);
    if (Number.isFinite(value) && value > 0) onEdgeLengthChange?.(edgeIndex, value);
    setEditingEdge(null);
  }

  // Absolute screen→SVG-user-space mapping (unlike pxScale/svgToLocalPx above, which only
  // handle relative deltas) — needed for the draw tool's live cursor-follow preview.
  function clientToSvgPoint(clientX: number, clientY: number): { x: number; z: number } {
    const svg = svgRef.current;
    if (!svg) return { x: 0, z: 0 };
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, z: 0 };
    const p = pt.matrixTransform(ctm.inverse());
    return { x: snapDraw(p.x), z: snapDraw(p.y) };
  }

  function cancelDraw() {
    setDrawStart(null);
    setDrawEnd(null);
    setDrawStartSnap(null);
    setDrawEndSnap(null);
    onWallDrawCancel?.();
  }

  // Continuous drawing: a free endpoint was clicked (not dragged) — pick up a new wall segment
  // from exactly that point. Sets the local click-move-click state directly (rather than
  // waiting for the `drawMode` prop to round-trip back from the parent) so the live preview
  // starts immediately on this same click; the parent's callback is what actually arms
  // `drawMode` for next render, so the follow-up click lands in onWallDrawComplete correctly.
  // Its start is never boundary-snapped — it originates from a free interior-wall endpoint,
  // joined to that origin separately (see continuousFrom in StepDimensions), not attached.
  function startContinuousDraw(wallId: string, end: 'start' | 'end', point: RoomVertex) {
    setDrawStart(point);
    setDrawEnd(point);
    setDrawStartSnap(null);
    onFreeEndpointClick?.(wallId, end, point);
  }

  useEffect(() => {
    if (!drawMode) cancelDraw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawMode]);

  useEffect(() => {
    if (!drawStart) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') cancelDraw();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawStart]);

  function pxScale(): number {
    const svg = svgRef.current;
    if (!svg) return 1;
    const rect = svg.getBoundingClientRect();
    // preserveAspectRatio "meet" → uniform scale, letterboxed on the longer side. Uses the
    // CURRENT viewBox (frozen during a drag) so the px→meters mapping stays consistent with
    // what's actually on screen while dragging.
    const [, , vbW, vbH] = viewBox.split(' ').map(Number);
    return Math.min(rect.width / vbW, rect.height / vbH);
  }

  // Maps an SVG user-space point (meters) to CSS px relative to the svg element's own box —
  // used to position the plain-HTML edit input (see below) directly over a dimension label.
  // preserveAspectRatio "xMidYMid meet" letterboxes on the shorter axis, hence the offsetX/Y.
  function svgToLocalPx(x: number, z: number): { left: number; top: number } {
    const svg = svgRef.current;
    if (!svg) return { left: 0, top: 0 };
    const rect = svg.getBoundingClientRect();
    const [vbX, vbY, vbW, vbH] = viewBox.split(' ').map(Number);
    const scale = Math.min(rect.width / vbW, rect.height / vbH);
    const offsetX = (rect.width - vbW * scale) / 2;
    const offsetY = (rect.height - vbH * scale) / 2;
    return { left: offsetX + (x - vbX) * scale, top: offsetY + (z - vbY) * scale };
  }

  function beginDrag(e: React.PointerEvent<SVGElement>, state: DragState) {
    setFrozenViewBox(fitViewBox);
    dragRef.current = state;
    movedRef.current = false;
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: React.PointerEvent<SVGElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = (e.clientX - drag.startX) / drag.scale;
    const dz = (e.clientY - drag.startY) / drag.scale;
    if (Math.abs(dx) + Math.abs(dz) > 0.02) movedRef.current = true;
    if (drag.kind === 'edge') {
      // SVG y is world z directly (viewBox is built from z), so this is the outward-normal
      // projection of the cursor displacement.
      onEdgeDrag?.(drag.index, dx * drag.normal.x + dz * drag.normal.z);
    } else if (drag.kind === 'vertex') {
      onVertexDrag?.(drag.index, dx, dz);
    } else {
      onOpeningDrag?.(drag.index, dx * drag.dir.x + dz * drag.dir.z);
    }
  }

  function handlePointerUp(e: React.PointerEvent<SVGElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    e.currentTarget.releasePointerCapture(e.pointerId);
    dragRef.current = null;
    setFrozenViewBox(null); // release → one re-fit to the final shape
    if (drag.kind === 'edge') onEdgeDragEnd?.();
    else if (drag.kind === 'vertex') onVertexDragEnd?.();
    else onOpeningDragEnd?.();
    // `movedRef` must stay true through the native "click" event that follows this same
    // pointerup (it fires synchronously right after, and the dragged element's own onClick
    // reads the flag to suppress acting as a click) — but clearing it only on the NEXT
    // beginDrag left it permanently true for any element that never starts its own drag
    // (e.g. a wall's plain onClick in Step 3, which has no onEdgeDrag). One stray pointer
    // jitter while clicking a door would then silently swallow every wall click afterward,
    // including new placements — even after removing that door. Deferring the reset past
    // this task (but still before any later user interaction) scopes the flag to just this
    // one pointer session instead of leaking into unrelated future clicks.
    setTimeout(() => {
      movedRef.current = false;
    }, 0);
  }

  // Screen-space anchor + rotation for the active edit box, computed fresh each render from
  // the current edges/viewBox (cheap, and keeps it correct through the frozen-viewBox drag
  // logic above without needing its own effect).
  let editBox: { left: number; top: number; angleDeg: number } | null = null;
  if (editingEdge !== null && edges[editingEdge]) {
    const edge = edges[editingEdge];
    const lx = edge.midpoint.x + edge.normal.x * (DIM_OFFSET + 0.28);
    const ly = edge.midpoint.z + edge.normal.z * (DIM_OFFSET + 0.28);
    const { left, top } = svgToLocalPx(lx, ly);
    let angleDeg = (Math.atan2(edge.end.z - edge.start.z, edge.end.x - edge.start.x) * 180) / Math.PI;
    if (angleDeg > 90 || angleDeg <= -90) angleDeg += 180;
    editBox = { left, top, angleDeg };
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {rejectedClick && (
        <div key={rejectedClick.token} className={styles.toast}>
          {rejectedClick.message}
        </div>
      )}
      <svg
        ref={svgRef}
        viewBox={viewBox}
        style={{ width: '100%', height: '100%', cursor: drawMode ? 'crosshair' : undefined }}
        preserveAspectRatio="xMidYMid meet"
        onMouseMove={(e) => {
          if (!drawStart) return;
          const p = clientToSvgPoint(e.clientX, e.clientY);
          const snapped = findSnap(p);
          setDrawEnd(snapped?.point ?? p);
          setDrawEndSnap(snapped);
        }}
        onClick={(e) => {
          // `drawStart` already being set (continuous drawing from a free endpoint) is treated
          // the same as `drawMode` being armed — covers the moment right after that click,
          // before the parent's `drawMode` prop has round-tripped back down.
          if (!drawMode && !drawStart) return;
          if (!drawStart) {
            const p = clientToSvgPoint(e.clientX, e.clientY);
            const snapped = findSnap(p);
            setDrawStart(snapped?.point ?? p);
            setDrawStartSnap(snapped);
            return;
          }
          const p = clientToSvgPoint(e.clientX, e.clientY);
          const snapped = findSnap(p);
          const end = snapped?.point ?? p;
          if (Math.hypot(end.x - drawStart.x, end.z - drawStart.z) >= 0.2) {
            onWallDrawComplete?.(drawStart, end, drawStartSnap, snapped);
          }
          setDrawStart(null);
          setDrawEnd(null);
          setDrawStartSnap(null);
          setDrawEndSnap(null);
        }}
      >
        <polygon points={points} fill={FLOOR_FILL} stroke="none" />

      {/* Walls */}
      {edges.map((edge, i) => {
        const isHighlighted = highlightedEdgeIndex === i;
        // The wall's drag hit-line is trimmed inward at each end when corner handles are
        // present, so the two hit zones never overlap — without this, a click near a corner
        // meant to slide the wall could be captured by the corner handle instead, moving
        // only ONE endpoint and tilting the wall (looks like the wall "rotated" from a drag
        // that should only ever translate it).
        const dirX = (edge.end.x - edge.start.x) / edge.length;
        const dirZ = (edge.end.z - edge.start.z) / edge.length;
        const trim = onVertexDrag ? Math.min(0.3, edge.length / 2 - 0.05) : 0;
        const hx1 = edge.start.x + dirX * trim;
        const hz1 = edge.start.z + dirZ * trim;
        const hx2 = edge.end.x - dirX * trim;
        const hz2 = edge.end.z - dirZ * trim;
        return (
          <g key={i}>
            <line
              x1={edge.start.x}
              y1={edge.start.z}
              x2={edge.end.x}
              y2={edge.end.z}
              stroke={isHighlighted ? 'var(--color-accent)' : 'var(--color-text)'}
              strokeWidth={WALL_STROKE}
              strokeLinecap="square"
            />
            {(onEdgeClick || onEdgeDrag) && (
              <line
                x1={hx1}
                y1={hz1}
                x2={hx2}
                y2={hz2}
                stroke="transparent"
                strokeWidth={0.65}
                style={{ cursor: drawMode ? 'crosshair' : onEdgeDrag ? edgeCursor(edge.normal) : 'pointer', touchAction: 'none' }}
                onClick={() => {
                  if (movedRef.current || drawMode) return;
                  const reason = onEdgeClick?.(i);
                  if (reason) flashRejection(i, reason);
                }}
                onPointerDown={(e) => {
                  if (drawMode || !onEdgeDrag) return;
                  beginDrag(e, { kind: 'edge', index: i, startX: e.clientX, startY: e.clientY, scale: pxScale(), normal: edge.normal });
                  onEdgeDragStart?.(i);
                }}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
              />
            )}
            {onWallAdd && !drawMode && (
              <g
                transform={`translate(${edge.midpoint.x - edge.normal.x * 0.3} ${edge.midpoint.z - edge.normal.z * 0.3})`}
                style={{ cursor: 'pointer' }}
                onClick={() => onWallAdd(i)}
              >
                <circle r={0.13} fill="var(--color-accent)" stroke="var(--color-surface)" strokeWidth={0.02} />
                <path d="M-0.06,0 H0.06 M0,-0.06 V0.06" stroke="var(--color-surface)" strokeWidth={0.03} strokeLinecap="round" />
              </g>
            )}
          </g>
        );
      })}

      {/* Free-standing interior walls — independent of the boundary polygon. Rendered in the
          same structural layer as the boundary so the +/× control buttons above and the
          corner handles below always paint on top of them, never the other way round. */}
      {interiorWalls.map((wall) => {
        // While an endpoint is being dragged, show it (and anything jointed to it — e.g. a
        // continuous-drawing elbow shared with another wall) following the live/snapped
        // position instead of its last-committed one, so joined segments visibly move
        // together DURING the drag, not just after it commits.
        const liveTarget = draggingEndpoint ? (endpointSnap?.point ?? endpointLive) : null;
        function isLive(thisEnd: 'start' | 'end'): boolean {
          if (!draggingEndpoint) return false;
          if (draggingEndpoint.wallId === wall.id && draggingEndpoint.end === thisEnd) return true;
          const joined = jointedEndpoints?.(draggingEndpoint.wallId, draggingEndpoint.end) ?? [];
          return joined.some((m) => m.wallId === wall.id && m.end === thisEnd);
        }
        const start = isLive('start') && liveTarget ? liveTarget : wall.start;
        const end = isLive('end') && liveTarget ? liveTarget : wall.end;
        const dx = end.x - start.x;
        const dz = end.z - start.z;
        const midX = (start.x + end.x) / 2;
        const midZ = (start.z + end.z) / 2;
        const isHovered = hoveredInteriorWall === wall.id;

        function beginEndpointDrag(e: React.PointerEvent<SVGElement>, end: 'start' | 'end') {
          e.currentTarget.setPointerCapture(e.pointerId);
          const origin = end === 'start' ? wall.start : wall.end;
          setDraggingEndpoint({ wallId: wall.id, end, origin });
          setEndpointLive(origin);
          setEndpointSnap(null);
          onInteriorWallEndpointDragStart?.(wall.id, end);
        }

        function handleEndpointMove(e: React.PointerEvent<SVGElement>) {
          const p = clientToSvgPoint(e.clientX, e.clientY);
          setEndpointLive(p);
          setEndpointSnap(findSnap(p, wall.id));
        }

        function handleEndpointUp(e: React.PointerEvent<SVGElement>) {
          e.currentTarget.releasePointerCapture(e.pointerId);
          if (draggingEndpoint) {
            const finalPoint = endpointSnap?.point ?? endpointLive;
            const attached = isEndpointAttached?.(wall.id, draggingEndpoint.end) ?? false;
            const moved = finalPoint && Math.hypot(finalPoint.x - draggingEndpoint.origin.x, finalPoint.z - draggingEndpoint.origin.z) > 0.12;
            if (!moved && !attached && onFreeEndpointClick) {
              // A plain click (no real drag) on a FREE endpoint — continuous drawing: pick up
              // a new wall segment exactly where this free end left off.
              startContinuousDraw(wall.id, draggingEndpoint.end, draggingEndpoint.origin);
            } else if (finalPoint) {
              onInteriorWallEndpointChange?.(wall.id, draggingEndpoint.end, finalPoint, endpointSnap);
            }
          }
          setDraggingEndpoint(null);
          setEndpointLive(null);
          setEndpointSnap(null);
        }

        return (
          <g key={wall.id}>
            <line x1={start.x} y1={start.z} x2={end.x} y2={end.z} stroke="var(--color-text)" strokeWidth={WALL_STROKE} strokeLinecap="square" />
            {(onInteriorWallRemove || onInteriorWallClick) && (
              <line
                x1={start.x}
                y1={start.z}
                x2={end.x}
                y2={end.z}
                stroke="transparent"
                strokeWidth={0.5}
                style={{ cursor: 'pointer', touchAction: 'none' }}
                onPointerEnter={() => setHoveredInteriorWall(wall.id)}
                onPointerLeave={() => setHoveredInteriorWall((cur) => (cur === wall.id ? null : cur))}
                onClick={() => {
                  if (!onInteriorWallClick) return;
                  const reason = onInteriorWallClick(wall.id);
                  if (reason) flashRejection(undefined, reason);
                }}
              />
            )}
            {isHovered && onInteriorWallRemove && (
              <g
                transform={`translate(${midX - dz * 0.06} ${midZ + dx * 0.06})`}
                style={{ cursor: 'pointer' }}
                onClick={() => onInteriorWallRemove(wall.id)}
              >
                <circle r={0.13} fill="var(--color-danger)" stroke="var(--color-surface)" strokeWidth={0.02} />
                <path d="M-0.06,-0.06 L0.06,0.06 M0.06,-0.06 L-0.06,0.06" stroke="var(--color-surface)" strokeWidth={0.03} strokeLinecap="round" />
              </g>
            )}
            {onInteriorWallSplit && (
              <g
                transform={`translate(${midX + dz * 0.09} ${midZ - dx * 0.09})`}
                style={{ cursor: 'pointer' }}
                onClick={() => onInteriorWallSplit(wall.id)}
              >
                <circle r={0.13} fill="var(--color-accent)" stroke="var(--color-surface)" strokeWidth={0.02} />
                <path d="M-0.06,0 H0.06 M0,-0.06 V0.06" stroke="var(--color-surface)" strokeWidth={0.03} strokeLinecap="round" />
              </g>
            )}
            {onInteriorWallEndpointChange &&
              (['start', 'end'] as const).map((endKey) => {
                const p = endKey === 'start' ? start : end;
                // `attached` (boundary-pinned specifically) gates INTERACTION: a boundary point
                // has the regular corner-handle to move it, so it gets no drag circle of its
                // own, and a plain click on it never starts continuous drawing. A joint-only
                // point (shared with another interior wall, not the boundary) has no such
                // corner-handle — it still needs its own drag circle, and a plain click on it
                // can still spawn a new chained wall — but it's just as "real" a point as a
                // boundary one, so `pinned` (this OR jointed) drives the black/gray COLOR and
                // the Separate control alone.
                const attached = isEndpointAttached?.(wall.id, endKey) ?? false;
                const jointed = (jointedEndpoints?.(wall.id, endKey) ?? []).length > 0;
                const pinned = attached || jointed;
                return (
                  <g key={endKey}>
                    <circle
                      cx={p.x}
                      cy={p.z}
                      r={0.1}
                      fill={pinned ? 'var(--color-surface)' : 'var(--color-text-muted)'}
                      stroke={pinned ? 'var(--color-text)' : 'var(--color-surface)'}
                      strokeWidth={0.035}
                    />
                    {/* Once attached to the boundary, this point IS a real boundary vertex —
                        dragging it is the regular corner-handle's job (rendered separately
                        below, already correctly wired to move it and keep this wall in sync).
                        A second, overlapping drag target here would just fight the corner's
                        for clicks, and — since it doesn't know that vertex already exists —
                        would insert a stray duplicate instead of moving it. A joint-only point
                        has no such handle, so it keeps its own. */}
                    {!attached && (
                      <circle
                        cx={p.x}
                        cy={p.z}
                        r={0.3}
                        fill="transparent"
                        style={{ cursor: 'move', touchAction: 'none' }}
                        onPointerDown={(e) => beginEndpointDrag(e, endKey)}
                        onPointerMove={handleEndpointMove}
                        onPointerUp={handleEndpointUp}
                        onPointerCancel={handleEndpointUp}
                        // A plain click here (continuous-drawing start) must NOT also reach the
                        // canvas's own click handler — left unstopped, that bubbled click gets
                        // read as the draw gesture's SECOND click (at ~0 distance from where it
                        // just started), which silently cancels the just-started draw.
                        onClick={(e) => e.stopPropagation()}
                      />
                    )}
                    {pinned && onInteriorWallEndpointDetach && (
                      <g
                        transform={`translate(${p.x + 0.4} ${p.z - 0.4})`}
                        style={{ cursor: 'pointer' }}
                        onClick={() => onInteriorWallEndpointDetach(wall.id, endKey)}
                      >
                        <circle r={0.13} fill="var(--color-surface)" stroke="var(--color-border)" strokeWidth={0.025} />
                        {/* Broken-link glyph: two short offset strokes, reads as "unlink". */}
                        <path d="M-0.06,0.035 L0,-0.035" stroke="var(--color-text)" strokeWidth={0.03} strokeLinecap="round" />
                        <path d="M0,0.035 L0.06,-0.035" stroke="var(--color-text)" strokeWidth={0.03} strokeLinecap="round" />
                      </g>
                    )}
                  </g>
                );
              })}
            {draggingEndpoint?.wallId === wall.id && endpointSnap && (
              <circle cx={endpointSnap.point.x} cy={endpointSnap.point.z} r={0.16} fill="none" stroke="var(--color-accent)" strokeWidth={0.03} strokeDasharray="0.05 0.04" />
            )}
          </g>
        );
      })}

      {/* Dimension lines, offset outside each wall with end ticks (IKEA-style) */}
      {edges.map((edge, i) => {
        const ox = edge.normal.x * DIM_OFFSET;
        const oz = edge.normal.z * DIM_OFFSET;
        const x1 = edge.start.x + ox;
        const y1 = edge.start.z + oz;
        const x2 = edge.end.x + ox;
        const y2 = edge.end.z + oz;
        const tx = edge.normal.x * DIM_TICK;
        const tz = edge.normal.z * DIM_TICK;
        // Rotate the label along the wall, flipped when it would read upside-down.
        let angle = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
        if (angle > 90 || angle <= -90) angle += 180;
        const lx = edge.midpoint.x + edge.normal.x * (DIM_OFFSET + 0.28);
        const ly = edge.midpoint.z + edge.normal.z * (DIM_OFFSET + 0.28);
        return (
          <g key={i} stroke="var(--color-text-muted)" strokeWidth={0.025}>
            <line x1={x1} y1={y1} x2={x2} y2={y2} />
            <line x1={x1 - tx} y1={y1 - tz} x2={x1 + tx} y2={y1 + tz} />
            <line x1={x2 - tx} y1={y2 - tz} x2={x2 + tx} y2={y2 + tz} />
            {editingEdge !== i && (
              <text
                x={lx}
                y={ly}
                transform={`rotate(${angle} ${lx} ${ly})`}
                fontSize={0.24}
                fill="var(--color-text)"
                stroke="none"
                textAnchor="middle"
                dominantBaseline="middle"
                style={{ cursor: onEdgeLengthChange ? 'text' : undefined }}
                onClick={() => {
                  if (!onEdgeLengthChange) return;
                  setEditValue(edge.length.toFixed(2));
                  setEditingEdge(i);
                }}
              >
                {formatLength(edge.length, units)}
              </text>
            )}
          </g>
        );
      })}

      {openings.map((opening, i) => {
        const edge = openingHost(opening);
        if (!edge) return null;
        const dirX = (edge.end.x - edge.start.x) / edge.length;
        const dirZ = (edge.end.z - edge.start.z) / edge.length;
        const cx = edge.start.x + dirX * (opening.offset + opening.width / 2);
        const cz = edge.start.z + dirZ * (opening.offset + opening.width / 2);
        const halfW = opening.width / 2;
        const draggable = Boolean(onOpeningDrag);
        const isHovered = hoveredOpening === i;
        // × handle sits just outside the wall, between the wall line and the dimension
        // line, so it's always in a clear area regardless of wall orientation.
        const hx = cx + edge.normal.x * 0.24;
        const hz = cz + edge.normal.z * 0.24;
        return (
          <g key={i}>
            <line
              x1={cx - dirX * halfW}
              y1={cz - dirZ * halfW}
              x2={cx + dirX * halfW}
              y2={cz + dirZ * halfW}
              stroke={opening.kind === 'door' ? '#8b5e3c' : '#5b8fa8'}
              strokeWidth={WALL_STROKE + 0.02}
              strokeLinecap="butt"
            />
            {(draggable || onOpeningRemove) && (
              <line
                x1={cx - dirX * halfW + edge.normal.x * 0.11}
                y1={cz - dirZ * halfW + edge.normal.z * 0.11}
                x2={cx + dirX * halfW + edge.normal.x * 0.11}
                y2={cz + dirZ * halfW + edge.normal.z * 0.11}
                stroke="transparent"
                strokeWidth={0.65}
                style={{ cursor: draggable ? edgeCursor({ x: dirX, z: dirZ }) : undefined, touchAction: 'none' }}
                onPointerEnter={() => setHoveredOpening(i)}
                onPointerLeave={() => setHoveredOpening((cur) => (cur === i ? null : cur))}
                onPointerDown={(e) => {
                  if (!draggable) return;
                  beginDrag(e, { kind: 'opening', index: i, startX: e.clientX, startY: e.clientY, scale: pxScale(), dir: { x: dirX, z: dirZ } });
                  onOpeningDragStart?.(i);
                }}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
              />
            )}
            {isHovered && onOpeningRemove && (
              <g
                transform={`translate(${hx} ${hz})`}
                style={{ cursor: 'pointer' }}
                onPointerEnter={() => setHoveredOpening(i)}
                onPointerLeave={() => setHoveredOpening((cur) => (cur === i ? null : cur))}
                onClick={() => onOpeningRemove(i)}
              >
                <circle r={0.14} fill="var(--color-danger)" stroke="var(--color-surface)" strokeWidth={0.02} />
                <path d="M-0.06,-0.06 L0.06,0.06 M0.06,-0.06 L-0.06,0.06" stroke="var(--color-surface)" strokeWidth={0.03} strokeLinecap="round" />
              </g>
            )}
          </g>
        );
      })}

      {/* Corner handles, drawn last so they sit on top of the walls */}
      {onVertexDrag &&
        vertices.map((v, i) => {
          // Outward direction from the room's centroid through this corner — used to place
          // the remove button clear of the corner dot and the walls meeting there, regardless
          // of which way those walls happen to face.
          const ox = v.x - centroid.x;
          const oz = v.z - centroid.z;
          const oLen = Math.hypot(ox, oz) || 1;
          const rx = v.x + (ox / oLen) * 0.32;
          const rz = v.z + (oz / oLen) * 0.32;
          return (
            <g key={i}>
              <circle cx={v.x} cy={v.z} r={0.11} fill="var(--color-surface)" stroke="var(--color-text)" strokeWidth={0.035} />
              <circle
                cx={v.x}
                cy={v.z}
                r={0.34}
                fill="transparent"
                style={{ cursor: drawMode ? 'default' : 'move', touchAction: 'none' }}
                onPointerDown={(e) => {
                  if (drawMode) return;
                  beginDrag(e, { kind: 'vertex', index: i, startX: e.clientX, startY: e.clientY, scale: pxScale() });
                  onVertexDragStart?.(i);
                }}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
              />
              {onVertexRemove && !drawMode && (
                <g transform={`translate(${rx} ${rz})`} style={{ cursor: 'pointer' }} onClick={() => onVertexRemove(i)}>
                  <circle r={0.12} fill="var(--color-danger)" stroke="var(--color-surface)" strokeWidth={0.02} />
                  <path d="M-0.05,-0.05 L0.05,0.05 M0.05,-0.05 L-0.05,0.05" stroke="var(--color-surface)" strokeWidth={0.028} strokeLinecap="round" />
                </g>
              )}
            </g>
          );
        })}

      {/* Rejected-click outline, drawn LAST (own top-level block, not inside the walls loop)
          so a later-drawn adjacent wall can never paint over it at a shared corner. */}
      {rejectedClick &&
        rejectedClick.edgeIndex !== undefined &&
        edges[rejectedClick.edgeIndex] &&
        (() => {
          const edge = edges[rejectedClick.edgeIndex!];
          const dirX = (edge.end.x - edge.start.x) / edge.length;
          const dirZ = (edge.end.z - edge.start.z) / edge.length;
          // An unfilled outline hugging the wall's outer edge — NOT a solid line overlapping
          // the wall itself, which reads as "a door appeared" rather than "this click was
          // rejected". End margin + half-thickness both sit outside the wall's own box.
          const endMargin = 0.08;
          const halfThick = WALL_STROKE / 2 + 0.08;
          const sx = edge.start.x - dirX * endMargin;
          const sz = edge.start.z - dirZ * endMargin;
          const ex = edge.end.x + dirX * endMargin;
          const ez = edge.end.z + dirZ * endMargin;
          const nx = edge.normal.x * halfThick;
          const nz = edge.normal.z * halfThick;
          const outline = [
            `${sx + nx},${sz + nz}`,
            `${ex + nx},${ez + nz}`,
            `${ex - nx},${ez - nz}`,
            `${sx - nx},${sz - nz}`,
          ].join(' ');
          return (
            <polygon
              key={rejectedClick.token}
              className={styles.wallFlash}
              points={outline}
              fill="none"
              stroke="var(--color-danger)"
              strokeWidth={0.06}
              strokeLinejoin="round"
            />
          );
        })()}

        {/* Live click-move-click draw preview: a plain dashed line from the start point to
            the cursor, with a length label — the boundary is never touched by this. */}
        {drawStart && drawEnd && (
          <g>
            <line
              x1={drawStart.x}
              y1={drawStart.z}
              x2={drawEnd.x}
              y2={drawEnd.z}
              stroke="var(--color-accent)"
              strokeWidth={0.05}
              strokeDasharray="0.1 0.07"
            />
            <circle cx={drawStart.x} cy={drawStart.z} r={0.08} fill="var(--color-accent)" />
            <circle cx={drawEnd.x} cy={drawEnd.z} r={0.09} fill="var(--color-surface)" stroke="var(--color-accent)" strokeWidth={0.035} />
            <text
              x={(drawStart.x + drawEnd.x) / 2}
              y={(drawStart.z + drawEnd.z) / 2 - 0.18}
              fontSize={0.22}
              fill="var(--color-accent)"
              stroke="none"
              textAnchor="middle"
            >
              {formatLength(Math.hypot(drawEnd.x - drawStart.x, drawEnd.z - drawStart.z), units)}
            </text>
            {drawStartSnap && (
              <circle cx={drawStart.x} cy={drawStart.z} r={0.16} fill="none" stroke="var(--color-accent)" strokeWidth={0.03} strokeDasharray="0.05 0.04" />
            )}
            {drawEndSnap && (
              <circle cx={drawEnd.x} cy={drawEnd.z} r={0.16} fill="none" stroke="var(--color-accent)" strokeWidth={0.03} strokeDasharray="0.05 0.04" />
            )}
          </g>
        )}
      </svg>
      {drawMode && (
        <div className={styles.drawHint}>
          {drawStart ? 'Click to place the wall’s end point — Esc to cancel' : 'Click to start a new wall'}
        </div>
      )}
      {editBox && editingEdge !== null && (
        <input
          autoFocus
          type="number"
          step="0.1"
          min="0.1"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onFocus={(e) => e.target.select()}
          onBlur={(e) => commitEdit(editingEdge, e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
            if (e.key === 'Escape') setEditingEdge(null);
          }}
          style={{
            position: 'absolute',
            left: editBox.left,
            top: editBox.top,
            transform: `translate(-50%, -50%) rotate(${editBox.angleDeg}deg)`,
            width: 64,
            textAlign: 'center',
            fontSize: 13,
            padding: '3px 4px',
            border: '1px solid var(--color-accent)',
            borderRadius: 4,
            background: 'var(--color-surface)',
            color: 'var(--color-text)',
            boxSizing: 'border-box',
          }}
        />
      )}
    </div>
  );
}
