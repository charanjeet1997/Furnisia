import { useRef, useState } from 'react';
import { computeEdges, boundingBox } from '../../Components/polygonGeometry';
import type { RoomOpening, RoomVertex } from '../../Data/RoomShape';

export type PlanUnits = 'm' | 'ft';

interface FloorPlanPreviewProps {
  vertices: RoomVertex[];
  openings?: RoomOpening[];
  onEdgeClick?: (edgeIndex: number) => void;
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
}

const PAD = 1.1; // room for the outside dimension lines
const WALL_STROKE = 0.18;
const DIM_OFFSET = 0.45; // dimension line distance from the wall
const DIM_TICK = 0.12; // half-length of the tick marks at dimension line ends
const FLOOR_FILL = '#dcc49c'; // light wood tone

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
  | { kind: 'vertex'; index: number; startX: number; startY: number; scale: number };

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
}: FloorPlanPreviewProps) {
  const edges = computeEdges(vertices);
  const bbox = boundingBox(vertices);
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
    } else {
      onVertexDrag?.(drag.index, dx, dz);
    }
  }

  function handlePointerUp(e: React.PointerEvent<SVGElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    e.currentTarget.releasePointerCapture(e.pointerId);
    dragRef.current = null;
    setFrozenViewBox(null); // release → one re-fit to the final shape
    if (drag.kind === 'edge') onEdgeDragEnd?.();
    else onVertexDragEnd?.();
  }

  return (
    <svg ref={svgRef} viewBox={viewBox} style={{ width: '100%', height: '100%' }} preserveAspectRatio="xMidYMid meet">
      <polygon points={points} fill={FLOOR_FILL} stroke="none" />

      {/* Walls */}
      {edges.map((edge, i) => {
        const isHighlighted = highlightedEdgeIndex === i;
        return (
          <g key={i}>
            <line
              x1={edge.start.x}
              y1={edge.start.z}
              x2={edge.end.x}
              y2={edge.end.z}
              stroke={isHighlighted ? 'var(--color-accent)' : '#1f1f1f'}
              strokeWidth={WALL_STROKE}
              strokeLinecap="square"
            />
            {(onEdgeClick || onEdgeDrag) && (
              <line
                x1={edge.start.x}
                y1={edge.start.z}
                x2={edge.end.x}
                y2={edge.end.z}
                stroke="transparent"
                strokeWidth={0.45}
                style={{ cursor: onEdgeDrag ? edgeCursor(edge.normal) : 'pointer', touchAction: 'none' }}
                onClick={() => {
                  if (!movedRef.current) onEdgeClick?.(i);
                }}
                onPointerDown={(e) => {
                  if (!onEdgeDrag) return;
                  beginDrag(e, { kind: 'edge', index: i, startX: e.clientX, startY: e.clientY, scale: pxScale(), normal: edge.normal });
                  onEdgeDragStart?.(i);
                }}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
              />
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
            <text
              x={lx}
              y={ly}
              transform={`rotate(${angle} ${lx} ${ly})`}
              fontSize={0.24}
              fill="var(--color-text)"
              stroke="none"
              textAnchor="middle"
              dominantBaseline="middle"
            >
              {formatLength(edge.length, units)}
            </text>
          </g>
        );
      })}

      {openings.map((opening, i) => {
        const edge = edges[opening.edgeIndex];
        if (!edge) return null;
        const dirX = (edge.end.x - edge.start.x) / edge.length;
        const dirZ = (edge.end.z - edge.start.z) / edge.length;
        const cx = edge.start.x + dirX * (opening.offset + opening.width / 2);
        const cz = edge.start.z + dirZ * (opening.offset + opening.width / 2);
        const halfW = opening.width / 2;
        return (
          <line
            key={i}
            x1={cx - dirX * halfW}
            y1={cz - dirZ * halfW}
            x2={cx + dirX * halfW}
            y2={cz + dirZ * halfW}
            stroke={opening.kind === 'door' ? '#8b5e3c' : '#5b8fa8'}
            strokeWidth={WALL_STROKE + 0.02}
            strokeLinecap="butt"
          />
        );
      })}

      {/* Corner handles, drawn last so they sit on top of the walls */}
      {onVertexDrag &&
        vertices.map((v, i) => (
          <g key={i}>
            <circle cx={v.x} cy={v.z} r={0.11} fill="#ffffff" stroke="#1f1f1f" strokeWidth={0.035} />
            <circle
              cx={v.x}
              cy={v.z}
              r={0.24}
              fill="transparent"
              style={{ cursor: 'move', touchAction: 'none' }}
              onPointerDown={(e) => {
                beginDrag(e, { kind: 'vertex', index: i, startX: e.clientX, startY: e.clientY, scale: pxScale() });
                onVertexDragStart?.(i);
              }}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
            />
          </g>
        ))}
    </svg>
  );
}
