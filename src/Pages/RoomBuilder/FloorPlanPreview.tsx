import { useEffect, useRef, useState } from 'react';
import { computeEdges, boundingBox } from '../../Components/polygonGeometry';
import type { InteriorWall, RoomOpening, RoomVertex } from '../../Data/RoomShape';
import { WallToolMenu } from './tools/WallToolMenu';
import styles from './FloorPlanPreview.module.css';

export type PlanUnits = 'm' | 'ft';

// Where an interior-wall endpoint snapped to — a boundary wall (the existing edgeIndex/t
// addressing), ANOTHER interior wall (addressed by its own id/t), or an EXISTING boundary
// corner (`vertex`) — its own kind because attaching there must reuse that vertex, never
// insert a near-duplicate onto one of its edges at t≈0/1. All carry the resolved snap `point`
// so consumers that only care about "where" can ignore which kind of host it is.
export type SnapTarget =
  | { host: 'boundary'; edgeIndex: number; t: number; point: RoomVertex }
  | { host: 'interior'; wallId: string; t: number; point: RoomVertex }
  | { host: 'vertex'; vertexIndex: number; point: RoomVertex };

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
  // Click on an interior wall: places a door/window in Step 3, selects the wall for the
  // property panel in Step 2 — same rejection-message contract as onEdgeClick above.
  onInteriorWallClick?: (id: string) => string | void;
  // Per-boundary-edge thickness (meters), parallel to the edge list — drives each wall's
  // drawn stroke so thickness edits show up live in the plan. Falls back to 0.1.
  edgeThicknesses?: number[];
  // Highlight for the wall currently selected in the property panel.
  selectedEdgeIndex?: number | null;
  selectedInteriorWallId?: string | null;
  // Whole-wall drag for interior walls — free 2D translation following the cursor.
  // `dx` / `dz` are the TOTAL displacement since drag start, in meters.
  onInteriorWallDragStart?: (id: string) => void;
  onInteriorWallDrag?: (id: string, dx: number, dz: number) => void;
  onInteriorWallDragEnd?: () => void;
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
  // back to hovering for the "+" affordance. Reports which wall/end it came from so the caller
  // can join the new segment to it as a real shared point.
  onFreeEndpointClick?: (wallId: string, end: 'start' | 'end', point: RoomVertex) => void;
  // Other wall endpoints that are the SAME physical point as this one (a continuous-drawing
  // elbow) — used to make them visually follow together during a live drag, not just after
  // the drag commits.
  jointedEndpoints?: (wallId: string, end: 'start' | 'end') => { wallId: string; end: 'start' | 'end' }[];
  // Click-move-click draw: whenever this is provided, hovering anywhere on the plan — empty
  // space or over an existing wall — shows a "+" at the (possibly snapped) hover point; clicking
  // it places the start, moving the mouse previews the wall (live dashed preview + length
  // follow the cursor), and a second click places the end. Purely additive — never touches the
  // room's boundary (`vertices`) itself (though StepDimensions may fold a closed chain into it
  // afterward). No separate "draw mode" toggle — starting a wall is just a plain click.
  onWallDrawComplete?: (
    start: RoomVertex,
    end: RoomVertex,
    startSnap: SnapTarget | null,
    endSnap: SnapTarget | null,
  ) => void;
  // An in-progress draw was abandoned (Escape) — lets the parent clear any chaining state
  // (e.g. continuousFrom) tied to the draw that never completed.
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
// How close the cursor must be to a wall's LINE for the hover tool menu to appear at all.
const WALL_HOVER_DISTANCE = 0.26;
// Once the menu is anchored, how far the cursor can roam from that anchor point (including
// out toward the offset icons) before the menu actually closes. Must clear the farthest
// possible icon — see WallToolMenu's own sizing comment for that geometry.
const HOVER_MENU_RADIUS = 0.6;

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
  | { kind: 'opening'; index: number; startX: number; startY: number; scale: number; dir: RoomVertex }
  | { kind: 'interiorWall'; id: string; startX: number; startY: number; scale: number; normal: RoomVertex };

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
  edgeThicknesses,
  selectedEdgeIndex = null,
  selectedInteriorWallId = null,
  onInteriorWallDragStart,
  onInteriorWallDrag,
  onInteriorWallDragEnd,
  onInteriorWallEndpointDragStart,
  onInteriorWallEndpointChange,
  isEndpointAttached,
  onInteriorWallEndpointDetach,
  onFreeEndpointClick,
  jointedEndpoints,
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
  // True while a pointer press is being handled by an endpoint's own drag/click machinery —
  // the compatibility `click` that follows must then never reach the canvas. A ref, not
  // state or a `drawStart` check: React flushes the state updates from pointerup (e.g.
  // startContinuousDraw setting drawStart) BEFORE the click event dispatches, so any
  // state-based check reads the post-update world and lets the click through — where the
  // canvas reads it as the draw's second click at ~0 distance and instantly cancels it.
  const endpointPressRef = useRef(false);

  // Resolves an opening's host wall geometry — either a boundary edge, or (when
  // `interiorWallId` is set) a free-standing interior wall, computed with the same
  // start/end/length/normal shape as a boundary WallEdge so every opening-rendering/dragging
  // calculation below works identically regardless of which kind of wall it's on.
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

  // Closest point to `p` on any boundary wall OR interior wall, if within SNAP_DISTANCE — the
  // "magnetism" that lets an interior wall's endpoint attach to whichever wall it's dragged
  // near, boundary or interior alike. `excludeWallId` keeps a wall's own endpoint from
  // snapping onto itself (or, via its jointed partners — see callers) while being dragged.
  function findSnap(
    p: RoomVertex,
    excludeWallId?: string,
    excludeTips?: { wallId: string; end: 'start' | 'end' }[],
  ): SnapTarget | null {
    let best: (SnapTarget & { dist: number }) | null = null;
    // Existing boundary corners first — landing on one must attach to THAT vertex, not
    // insert a near-duplicate onto an adjacent edge at t≈0/1.
    vertices.forEach((v, vertexIndex) => {
      const dist = Math.hypot(p.x - v.x, p.z - v.z);
      if (dist <= ENDPOINT_SNAP_DISTANCE && (!best || dist < best.dist)) best = { host: 'vertex', vertexIndex, point: v, dist };
    });
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
      for (const [t, point, tipEnd] of [[0, wall.start, 'start'] as const, [1, wall.end, 'end'] as const]) {
        if (excludeTips?.some((tip) => tip.wallId === wall.id && tip.end === tipEnd)) continue;
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
  // "Create a wall from here" affordance: whenever drawing is available and not already in
  // progress, a "+" marker follows the cursor (snapped onto whatever wall it's near), so
  // starting a wall is a plain click on the plan — no separate draw-mode toggle to arm first.
  const [hoverPoint, setHoverPoint] = useState<RoomVertex | null>(null);
  const [hoverSnap, setHoverSnap] = useState<SnapTarget | null>(null);
  // The wall point the tool menu is currently anchored to, if any — as long as the cursor
  // stays within HOVER_MENU_RADIUS of it, the menu keeps showing exactly as-is, regardless
  // of the cursor's distance from the wall's actual LINE. This is what lets you move the
  // mouse FROM the wall OUT TO the offset menu icons without it reading as "left the wall"
  // partway there. Recomputed from scratch on every single mousemove (pure distance math,
  // no native onMouseEnter/onMouseLeave) — deliberately NOT a "locked" boolean toggled by
  // DOM enter/leave events: if the element holding such a flag ever unmounts while the
  // cursor sits still over it (routine in a React-driven SVG — e.g. right after a re-render
  // triggered by something else entirely, like closing a side panel), the matching "leave"
  // never fires and the flag gets stuck forever, silently disabling all future hovering. A
  // plain ref (not state) since it only needs to gate logic inside the mousemove handler.
  const menuAnchorRef = useRef<RoomVertex | null>(null);
  // True when the hover point landed ON a wall's line (not just near a corner, and not out
  // in open space) — drives which tool the hover affordance offers: a plain "+" in open
  // space, or the move/draw TOOL MENU when you're actually over a wall.
  const [hoverOnWall, setHoverOnWall] = useState(false);
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
  // from exactly that point. Sets the local click-move-click state directly so the live
  // preview starts immediately on this same click; the parent's callback records which
  // wall/end the chain came from (continuousFrom) so the committed segment joins to it.
  // Its start is never boundary-snapped — it originates from a free interior-wall endpoint,
  // joined to that origin separately (see continuousFrom in StepDimensions), not attached.
  function startContinuousDraw(wallId: string, end: 'start' | 'end', point: RoomVertex) {
    setDrawStart(point);
    setDrawEnd(point);
    setDrawStartSnap(null);
    onFreeEndpointClick?.(wallId, end, point);
  }

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
    } else if (drag.kind === 'interiorWall') {
      // Free 2D translation — pass raw cursor displacement so the wall follows the pointer
      // directly. Normal-projection (old behaviour) forced diagonal walls to crab-walk at
      // an angle even when the user dragged straight left/right.
      onInteriorWallDrag?.(drag.id, dx, dz);
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
    else if (drag.kind === 'interiorWall') onInteriorWallDragEnd?.();
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
        style={{ width: '100%', height: '100%', cursor: onWallDrawComplete ? 'crosshair' : undefined }}
        preserveAspectRatio="xMidYMid meet"
        onMouseMove={(e) => {
          if (drawStart) {
            const p = clientToSvgPoint(e.clientX, e.clientY);
            const snapped = findSnap(p);
            setDrawEnd(snapped?.point ?? p);
            setDrawEndSnap(snapped);
            return;
          }
          if (!onWallDrawComplete) return;
          // A drag (e.g. the Move icon below) is in progress — leave the hover state alone.
          // Recomputing it here could flip `hoverOnWall` mid-drag and unmount the very
          // element holding pointer capture (plain "mousemove" isn't blocked by capture the
          // way pointer events are, so this handler keeps firing throughout the drag).
          if (dragRef.current) return;
          const p = clientToSvgPoint(e.clientX, e.clientY);

          // The menu is already anchored somewhere and the cursor hasn't wandered far enough
          // to leave it — keep it exactly as-is (see menuAnchorRef's own comment for why this
          // is checked here, every move, rather than via a DOM enter/leave-driven flag).
          const anchor = menuAnchorRef.current;
          if (anchor && Math.hypot(p.x - anchor.x, p.z - anchor.z) < HOVER_MENU_RADIUS) return;
          menuAnchorRef.current = null;

          // Not drawing yet — track the cursor for the hover affordance, magnetized onto
          // whatever wall it's near. In open space that's the plain "+" (click to start a
          // wall right there); directly over a wall's line it's the move/draw tool menu
          // instead, since a plain click there selects the wall (property panel) rather than
          // starting a draw.
          const snapped = findSnap(p);
          const onWall = Boolean(snapped) && snapped!.host !== 'vertex' && Math.hypot(p.x - snapped!.point.x, p.z - snapped!.point.z) < WALL_HOVER_DISTANCE;
          if (onWall) menuAnchorRef.current = snapped!.point;
          setHoverPoint(snapped?.point ?? p);
          setHoverSnap(snapped);
          setHoverOnWall(onWall);
        }}
        onMouseLeave={() => {
          menuAnchorRef.current = null;
          setHoverPoint(null);
          setHoverSnap(null);
          setHoverOnWall(false);
        }}
        // Canvas-wide fallback for "press-and-hold a wall to move it": reuses the SAME
        // findSnap proximity math that already reliably detects wall hover (proven by the
        // Draw/Delete menu, which never fails to appear) instead of depending on each wall's
        // own thin hit-line to catch the press — a per-element hit target is one more thing
        // that can silently lose the race to whatever else is layered on top of it at that
        // exact pixel; this can't, since it's plain distance math, not DOM hit-testing. Fires
        // on bubbling AFTER any more specific child handler (corner/endpoint/opening), so if
        // one of those already started a drag (dragRef.current set), this steps aside.
        onPointerDown={(e) => {
          if (drawStart || dragRef.current) {
            console.log('[move] canvas pointerdown IGNORED — drawStart?', Boolean(drawStart), 'dragRef?', Boolean(dragRef.current));
            return;
          }
          const p = clientToSvgPoint(e.clientX, e.clientY);
          const snapped = findSnap(p);
          const snapDist = snapped ? Math.hypot(p.x - snapped.point.x, p.z - snapped.point.z) : Infinity;
          console.log(
            '[move] canvas pointerdown. snapped=',
            snapped ? `${snapped.host}${snapped.host === 'interior' ? ' ' + snapped.wallId.slice(0, 4) : ''}` : 'null',
            'dist=', snapDist.toFixed(3),
            'threshold=', WALL_HOVER_DISTANCE,
            'passes?', snapped ? snapDist < WALL_HOVER_DISTANCE : false,
          );
          if (!snapped || snapped.host === 'vertex') return;
          if (snapDist >= WALL_HOVER_DISTANCE) {
            console.log('[move] BLOCKED by distance:', snapDist.toFixed(3), '>=', WALL_HOVER_DISTANCE);
            return;
          }
          if (snapped.host === 'boundary') {
            if (!onEdgeDrag) return;
            const normal = edges[snapped.edgeIndex]?.normal;
            if (!normal) return;
            beginDrag(e, { kind: 'edge', index: snapped.edgeIndex, startX: e.clientX, startY: e.clientY, scale: pxScale(), normal });
            onEdgeDragStart?.(snapped.edgeIndex);
            console.log('[move] canvas -> started BOUNDARY drag edge', snapped.edgeIndex);
          } else {
            if (!onInteriorWallDrag) {
              console.log('[move] interior BLOCKED: no onInteriorWallDrag prop');
              return;
            }
            const startAttached = isEndpointAttached?.(snapped.wallId, 'start') ?? false;
            const endAttached   = isEndpointAttached?.(snapped.wallId, 'end')   ?? false;
            console.log(
              '[move] interior wall', snapped.wallId.slice(0, 8),
              '| startAttached=', startAttached,
              '| endAttached=', endAttached,
              '| proceeding with drag',
            );
            const wall = interiorWalls.find((w) => w.id === snapped.wallId);
            if (!wall) {
              console.log('[move] interior BLOCKED: wall not found', snapped.wallId.slice(0, 8));
              return;
            }
            const wdx = wall.end.x - wall.start.x;
            const wdz = wall.end.z - wall.start.z;
            const wlen = Math.hypot(wdx, wdz) || 1;
            beginDrag(e, {
              kind: 'interiorWall',
              id: snapped.wallId,
              startX: e.clientX,
              startY: e.clientY,
              scale: pxScale(),
              normal: { x: wdz / wlen, z: -wdx / wlen },
            });
            onInteriorWallDragStart?.(snapped.wallId);
            console.log('[move] canvas -> started INTERIOR drag', snapped.wallId.slice(0, 8));
          }
        }}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onClick={(e) => {
          if (!onWallDrawComplete) return;
          // A click that ends a drag gesture (movedRef) must never double as a draw click —
          // releasing a wall/corner drag would otherwise instantly start an unwanted wall.
          if (movedRef.current) return;
          if (!drawStart) {
            const p = clientToSvgPoint(e.clientX, e.clientY);
            const snapped = findSnap(p);
            setDrawStart(snapped?.point ?? p);
            setDrawStartSnap(snapped);
            setHoverPoint(null);
            setHoverSnap(null);
            return;
          }
          const p = clientToSvgPoint(e.clientX, e.clientY);
          const snapped = findSnap(p);
          const end = snapped?.point ?? p;
          if (Math.hypot(end.x - drawStart.x, end.z - drawStart.z) >= 0.2) {
            onWallDrawComplete?.(drawStart, end, drawStartSnap, snapped);
            // Revit-style polyline: the chain continues from the end just placed — the next
            // click adds the next wall. The parent tracks the committed segment
            // (continuousFrom) so the next commit joins to its end as a real shared point;
            // startSnap stays null here so that start is never ALSO re-attached by snap.
            setDrawStart(end);
            setDrawEnd(end);
            setDrawStartSnap(null);
            setDrawEndSnap(null);
          } else {
            // Clicking (nearly) the same point again is the "I'm done" gesture — like
            // double-click-to-finish in CAD tools. Esc works too.
            cancelDraw();
          }
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
              stroke={selectedEdgeIndex === i || isHighlighted ? 'var(--color-accent)' : 'var(--color-text)'}
              strokeWidth={Math.max(edgeThicknesses?.[i] ?? WALL_STROKE, 0.07)}
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
                // Press-and-hold directly on the wall moves it (the "tool" you get without
                // hunting for an icon); a plain click (no real movement) instead selects it.
                // movedRef is what tells the two apart — set the instant a real drag happens,
                // it makes onClick below a no-op for that same gesture's release.
                style={{ cursor: drawStart ? 'crosshair' : onEdgeDrag ? edgeCursor(edge.normal) : 'pointer', touchAction: 'none' }}
                onPointerDown={(e) => {
                  if (drawStart || !onEdgeDrag) return;
                  beginDrag(e, { kind: 'edge', index: i, startX: e.clientX, startY: e.clientY, scale: pxScale(), normal: edge.normal });
                  onEdgeDragStart?.(i);
                }}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                onClick={(e) => {
                  // While drawing, this click is the draw gesture's — let it bubble to the
                  // canvas handler (which snaps it onto this wall) instead of acting here.
                  if (movedRef.current || drawStart) return;
                  if (onEdgeClick) {
                    // Handled here (select / place opening) — never ALSO a draw-start click.
                    e.stopPropagation();
                    const reason = onEdgeClick(i);
                    if (reason) flashRejection(i, reason);
                  }
                }}
              />
            )}
            {onWallAdd && !drawStart && (
              <g
                transform={`translate(${edge.midpoint.x - edge.normal.x * 0.3} ${edge.midpoint.z - edge.normal.z * 0.3})`}
                style={{ cursor: 'pointer' }}
                // Buttons this close to a wall sit well within the canvas-level drag
                // fallback's catch radius — without stopping it here, PRESSING this button
                // (before the click even fires) would bubble straight into "start dragging
                // the wall" instead.
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  // Control buttons act on THIS element only — never fall through to the
                  // canvas click, which would read the same click as "start drawing a wall".
                  e.stopPropagation();
                  onWallAdd(i);
                }}
              >
                <circle r={0.09} fill="var(--color-accent)" stroke="var(--color-surface)" strokeWidth={0.015} />
                <path d="M-0.042,0 H0.042 M0,-0.042 V0.042" stroke="var(--color-surface)" strokeWidth={0.022} strokeLinecap="round" />
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

        function beginEndpointDrag(e: React.PointerEvent<SVGElement>, end: 'start' | 'end') {
          // Mid-draw, a press on an endpoint is part of the draw gesture (ending the wall on
          // this point), not the start of an endpoint drag — endpointPressRef stays false so
          // the click bubbles through to the canvas to commit the wall's end here.
          if (drawStart) return;
          // This press is handled HERE (endpoint drag) — must not also bubble into the
          // canvas-level "press-and-hold a wall to move it" fallback, which would otherwise
          // try to start a whole-wall drag from the very same press.
          e.stopPropagation();
          endpointPressRef.current = true;
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
          // Partners jointed to the dragged endpoint sit at its own origin — snapping onto
          // them would glue the point right back where it started, making short drags no-ops.
          setEndpointSnap(findSnap(p, wall.id, jointedEndpoints?.(wall.id, draggingEndpoint?.end ?? 'start')));
        }

        function handleEndpointUp(e: React.PointerEvent<SVGElement>) {
          e.currentTarget.releasePointerCapture(e.pointerId);
          if (draggingEndpoint) {
            const finalPoint = endpointSnap?.point ?? endpointLive;
            const attached = isEndpointAttached?.(wall.id, draggingEndpoint.end) ?? false;
            // Click-vs-drag must be judged by the RAW cursor, never the snapped point — a
            // 1px jitter near another tip would otherwise read as a 0.5m "drag" (the snap
            // teleports the point), swallowing the click that should start continuous drawing.
            const rawPoint = endpointLive ?? draggingEndpoint.origin;
            const moved = Math.hypot(rawPoint.x - draggingEndpoint.origin.x, rawPoint.z - draggingEndpoint.origin.z) > 0.12;
            if (!moved && !attached && onFreeEndpointClick) {
              // A plain click (no real drag) on a FREE endpoint — continuous drawing: pick up
              // a new wall segment exactly where this free end left off.
              startContinuousDraw(wall.id, draggingEndpoint.end, draggingEndpoint.origin);
            } else if (moved && finalPoint) {
              onInteriorWallEndpointChange?.(wall.id, draggingEndpoint.end, finalPoint, endpointSnap);
            }
          }
          setDraggingEndpoint(null);
          setEndpointLive(null);
          setEndpointSnap(null);
        }

        return (
          <g key={wall.id}>
            <line
              x1={start.x}
              y1={start.z}
              x2={end.x}
              y2={end.z}
              stroke={selectedInteriorWallId === wall.id ? 'var(--color-accent)' : 'var(--color-text)'}
              strokeWidth={Math.max(wall.thickness ?? WALL_STROKE, 0.07)}
              strokeLinecap="square"
            />
            {(onInteriorWallRemove || onInteriorWallClick || onInteriorWallDrag) && (
              <line
                x1={start.x}
                y1={start.z}
                x2={end.x}
                y2={end.z}
                stroke="transparent"
                strokeWidth={0.5}
                // Press-and-hold directly on the wall moves it — same "no icon to hunt for"
                // gesture as the boundary edge above. A wall pinned to the boundary on BOTH
                // ends has nothing that could move (its own endpoint handles still do that
                // job individually), so pressing it there is left as a plain select instead.
                style={{
                  cursor: drawStart
                    ? 'crosshair'
                    : onInteriorWallDrag && !(isEndpointAttached?.(wall.id, 'start') && isEndpointAttached?.(wall.id, 'end'))
                      ? 'move'
                      : 'pointer',
                  touchAction: 'none',
                }}
                onPointerDown={(e) => {
                  if (
                    drawStart ||
                    !onInteriorWallDrag ||
                    (isEndpointAttached?.(wall.id, 'start') && isEndpointAttached?.(wall.id, 'end'))
                  ) {
                    return;
                  }
                  const len = Math.hypot(dx, dz) || 1;
                  beginDrag(e, {
                    kind: 'interiorWall',
                    id: wall.id,
                    startX: e.clientX,
                    startY: e.clientY,
                    scale: pxScale(),
                    normal: { x: dz / len, z: -dx / len },
                  });
                  onInteriorWallDragStart?.(wall.id);
                }}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                onClick={(e) => {
                  // Post-drag clicks (movedRef) and mid-draw clicks fall through — the
                  // latter must reach the canvas as the draw gesture's end click.
                  if (movedRef.current || drawStart) return;
                  if (onInteriorWallClick) {
                    e.stopPropagation();
                    const reason = onInteriorWallClick(wall.id);
                    if (reason) flashRejection(undefined, reason);
                  }
                }}
              />
            )}
            {/* Always visible (never hover-gated): a hover-revealed button that sits this
                close to its own hover zone unmounts under the cursor on approach, and the
                click that was meant for it falls through to the canvas — which now starts
                drawing a wall. Hidden mid-draw so the end click can't hit it either. */}
            {onInteriorWallRemove && !drawStart && (
              <g
                transform={`translate(${midX - dz * 0.09} ${midZ + dx * 0.09})`}
                style={{ cursor: 'pointer' }}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  onInteriorWallRemove(wall.id);
                }}
              >
                <circle r={0.09} fill="var(--color-danger)" stroke="var(--color-surface)" strokeWidth={0.015} />
                <path d="M-0.042,-0.042 L0.042,0.042 M0.042,-0.042 L-0.042,0.042" stroke="var(--color-surface)" strokeWidth={0.022} strokeLinecap="round" />
              </g>
            )}
            {onInteriorWallSplit && !drawStart && (
              <g
                transform={`translate(${midX + dz * 0.09} ${midZ - dx * 0.09})`}
                style={{ cursor: 'pointer' }}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  onInteriorWallSplit(wall.id);
                }}
              >
                <circle r={0.09} fill="var(--color-accent)" stroke="var(--color-surface)" strokeWidth={0.015} />
                <path d="M-0.042,0 H0.042 M0,-0.042 V0.042" stroke="var(--color-surface)" strokeWidth={0.022} strokeLinecap="round" />
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
                        // If this press was handled here (drag or continuous-draw start), its
                        // trailing click must never reach the canvas — see endpointPressRef.
                        // A mid-draw press skips beginEndpointDrag entirely (ref stays false),
                        // so THAT click bubbles through as the draw gesture's end click.
                        onClick={(e) => {
                          if (endpointPressRef.current) {
                            endpointPressRef.current = false;
                            e.stopPropagation();
                          }
                        }}
                      />
                    )}
                    {pinned && onInteriorWallEndpointDetach && (
                      <g
                        transform={`translate(${p.x + 0.4} ${p.z - 0.4})`}
                        style={{ cursor: 'pointer' }}
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          onInteriorWallEndpointDetach(wall.id, endKey);
                        }}
                      >
                        <circle r={0.09} fill="var(--color-surface)" stroke="var(--color-border)" strokeWidth={0.018} />
                        {/* Broken-link glyph: two short offset strokes, reads as "unlink". */}
                        <path d="M-0.042,0.025 L0,-0.025" stroke="var(--color-text)" strokeWidth={0.022} strokeLinecap="round" />
                        <path d="M0,0.025 L0.042,-0.025" stroke="var(--color-text)" strokeWidth={0.022} strokeLinecap="round" />
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
                onClick={(e) => {
                  if (!onEdgeLengthChange) return;
                  e.stopPropagation(); // editing a dimension is not a draw click
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
              strokeWidth={edge.thickness + 0.02}
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
                <circle r={0.1} fill="var(--color-danger)" stroke="var(--color-surface)" strokeWidth={0.015} />
                <path d="M-0.045,-0.045 L0.045,0.045 M0.045,-0.045 L-0.045,0.045" stroke="var(--color-surface)" strokeWidth={0.022} strokeLinecap="round" />
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
                style={{ cursor: drawStart ? 'default' : 'move', touchAction: 'none' }}
                onPointerDown={(e) => {
                  if (drawStart) return;
                  beginDrag(e, { kind: 'vertex', index: i, startX: e.clientX, startY: e.clientY, scale: pxScale() });
                  onVertexDragStart?.(i);
                }}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                // Corner clicks bubble to the canvas on purpose: findSnap resolves them to a
                // `vertex` host, so a wall started (or ended) here attaches to THIS existing
                // corner — the draw-from-a-corner gesture — instead of inserting a duplicate.
              />
              {onVertexRemove && !drawStart && (
                <g
                  transform={`translate(${rx} ${rz})`}
                  style={{ cursor: 'pointer' }}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    onVertexRemove(i);
                  }}
                >
                  <circle r={0.09} fill="var(--color-danger)" stroke="var(--color-surface)" strokeWidth={0.015} />
                  <path d="M-0.04,-0.04 L0.04,0.04 M0.04,-0.04 L-0.04,0.04" stroke="var(--color-surface)" strokeWidth={0.022} strokeLinecap="round" />
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
          const halfThick = Math.max(edgeThicknesses?.[rejectedClick.edgeIndex!] ?? WALL_STROKE, 0.07) / 2 + 0.08;
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

        {/* Hover affordance. In open space (or right on a corner): a plain "create a wall
            from here" marker that follows the cursor — click starts a wall right there. Over
            a wall's own line instead: a small tool menu — Draw (start a new branching wall
            from this exact point) and — interior walls only — Delete (boundary walls have no
            "delete" of their own; removing one IS removing a corner, already the corner
            handle's × button). Moving the wall itself isn't here — it's a direct press-and-
            hold on the wall body (see its hit-line above), no icon to find first. */}
        {onWallDrawComplete &&
          !drawStart &&
          hoverPoint &&
          (() => {
            if (!hoverOnWall || !hoverSnap || hoverSnap.host === 'vertex') {
              return (
                <g transform={`translate(${hoverPoint.x} ${hoverPoint.z})`} style={{ pointerEvents: 'none' }}>
                  {hoverSnap && (
                    <circle r={0.13} fill="none" stroke="var(--color-accent)" strokeWidth={0.02} strokeDasharray="0.04 0.035" />
                  )}
                  <circle r={0.09} fill="var(--color-accent)" stroke="var(--color-surface)" strokeWidth={0.015} opacity={0.92} />
                  <path d="M-0.042,0 H0.042 M0,-0.042 V0.042" stroke="var(--color-surface)" strokeWidth={0.022} strokeLinecap="round" />
                </g>
              );
            }
            const normal =
              hoverSnap.host === 'boundary'
                ? (edges[hoverSnap.edgeIndex]?.normal ?? { x: 0, z: 0 })
                : (() => {
                    const wall = interiorWalls.find((w) => w.id === hoverSnap.wallId);
                    const wdx = (wall?.end.x ?? 0) - (wall?.start.x ?? 0);
                    const wdz = (wall?.end.z ?? 0) - (wall?.start.z ?? 0);
                    const wlen = Math.hypot(wdx, wdz) || 1;
                    return { x: wdz / wlen, z: -wdx / wlen };
                  })();
            const snap_ = hoverSnap;
            const point = snap_.point;
            const canDelete = snap_.host === 'interior' && Boolean(onInteriorWallRemove);

            function clearHover() {
              setHoverPoint(null);
              setHoverSnap(null);
              setHoverOnWall(false);
            }

            return (
              <WallToolMenu
                point={point}
                snap={snap_}
                normal={normal}
                canDelete={canDelete}
                onDraw={() => {
                  setDrawStart(point);
                  setDrawEnd(point);
                  setDrawStartSnap(snap_);
                  menuAnchorRef.current = null;
                  clearHover();
                }}
                onDelete={() => {
                  if (snap_.host === 'interior') onInteriorWallRemove?.(snap_.wallId);
                  menuAnchorRef.current = null;
                  clearHover();
                }}
              />
            );
          })()}
      </svg>
      {drawStart && (
        <div className={styles.drawHint}>Click to place the wall’s end — keep clicking to chain walls. Click the last point again (or Esc) to finish.</div>
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
