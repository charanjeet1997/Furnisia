import { useRef, useState } from 'react';
import { computeEdges, type WallEdge } from '../../Components/polygonGeometry';
import { FloorPlanPreview, type PlanUnits } from './FloorPlanPreview';
import type { RoomVertex } from '../../Data/RoomShape';
import styles from './RoomBuilder.module.css';

interface StepDimensionsProps {
  vertices: RoomVertex[];
  onVerticesChange: (vertices: RoomVertex[]) => void;
}

const MIN_EDGE = 0.3; // reject edits/drags that would collapse a wall

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

export function StepDimensions({ vertices, onVerticesChange }: StepDimensionsProps) {
  const [units, setUnits] = useState<PlanUnits>('m');

  // Snapshot at drag start: drags apply (snapshot + total delta), so clamped/rejected moves
  // never accumulate drift; edge normals are frozen too since the polygon changes mid-drag.
  const dragStart = useRef<{ vertices: RoomVertex[]; edges: WallEdge[] } | null>(null);

  function beginDrag() {
    dragStart.current = { vertices, edges: computeEdges(vertices) };
  }

  function endDrag() {
    dragStart.current = null;
  }

  return (
    <div className={styles.dimensionsLayout}>
      <div>
        <h2 className={styles.stepTitle}>Adjust your dimensions</h2>
        <p className={styles.stepSubtitle}>
          Drag a wall or corner in the plan, or click a dimension to type an exact length.
        </p>
        <p className={styles.stepSubtitle}>Units shown on the plan</p>
        <div className={styles.kindToggle}>
          <button type="button" className={units === 'm' ? styles.pillActive : styles.pill} onClick={() => setUnits('m')}>
            Metres
          </button>
          <button type="button" className={units === 'ft' ? styles.pillActive : styles.pill} onClick={() => setUnits('ft')}>
            Feet
          </button>
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
            if (edgesValid(next)) onVerticesChange(next);
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
            if (edgesValid(next)) onVerticesChange(next);
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
            if (edgesValid(next)) onVerticesChange(next);
          }}
        />
      </div>
    </div>
  );
}
