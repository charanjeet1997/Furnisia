
import type { WallEdge } from '../../../../Components/polygonGeometry';
import { formatLength, type PlanUnits, DIM_OFFSET, DIM_TICK } from '../../types/floorPlanTypes';

interface DimensionLinesLayerProps {
  edges: WallEdge[];
  editingEdge: number | null;
  units: PlanUnits;
  onEdgeLengthChange?: (edgeIndex: number, newLength: number) => void;
  setEditValue: (val: string) => void;
  setEditingEdge: (idx: number | null) => void;
}

export function DimensionLinesLayer({
  edges,
  editingEdge,
  units,
  onEdgeLengthChange,
  setEditValue,
  setEditingEdge,
}: DimensionLinesLayerProps) {
  return (
    <>
      {edges.map((edge, i) => {
        const ox = edge.normal.x * DIM_OFFSET;
        const oz = edge.normal.z * DIM_OFFSET;
        const x1 = edge.start.x + ox;
        const y1 = edge.start.z + oz;
        const x2 = edge.end.x + ox;
        const y2 = edge.end.z + oz;
        const tx = edge.normal.x * DIM_TICK;
        const tz = edge.normal.z * DIM_TICK;
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
                  e.stopPropagation();
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
    </>
  );
}
