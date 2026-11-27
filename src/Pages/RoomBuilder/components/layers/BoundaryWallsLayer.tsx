import type React from 'react';
import type { WallEdge } from '../../../../Components/polygonGeometry';
import { edgeCursor, type DragState } from '../../types/floorPlanTypes';

interface BoundaryWallsLayerProps {
  edges: WallEdge[];
  highlightedEdgeIndex: number | null;
  selectedEdgeIndex: number | null;
  edgeThicknesses?: number[];
  onEdgeClick?: (edgeIndex: number) => string | void;
  onEdgeDrag?: (edgeIndex: number, delta: number) => void;
  onEdgeDragStart?: (edgeIndex: number) => void;
  onVertexDrag?: unknown;
  beginDrag: (e: React.PointerEvent<SVGElement>, state: DragState) => void;
  handlePointerMove: (e: React.PointerEvent<SVGElement>) => void;
  handlePointerUp: (e: React.PointerEvent<SVGElement>) => void;
  movedRef: React.RefObject<boolean>;
  pxScale: () => number;
  flashRejection: (edgeIndex: number | undefined, message: string) => void;
}


export function BoundaryWallsLayer({
  edges,
  highlightedEdgeIndex,
  selectedEdgeIndex,
  edgeThicknesses,
  onEdgeClick,
  onEdgeDrag,
  onEdgeDragStart,
  onVertexDrag,
  beginDrag,
  handlePointerMove,
  handlePointerUp,
  movedRef,
  pxScale,
  flashRejection,
}: BoundaryWallsLayerProps) {
  const WALL_STROKE = 0.18;
  return (
    <>
      {edges.map((edge, i) => {
        const isHighlighted = highlightedEdgeIndex === i;
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
                style={{ cursor: onEdgeDrag ? edgeCursor(edge.normal) : 'pointer', touchAction: 'none' }}
                onPointerDown={(e) => {
                  if (!onEdgeDrag) return;
                  beginDrag(e, { kind: 'edge', index: i, startX: e.clientX, startY: e.clientY, scale: pxScale(), normal: edge.normal });
                  onEdgeDragStart?.(i);
                }}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                onClick={(e) => {
                  if (movedRef.current) return;
                  e.stopPropagation();
                  if (onEdgeClick) {
                    const reason = onEdgeClick(i);
                    if (reason) flashRejection(i, reason);
                  }
                }}
              />
            )}
          </g>
        );
      })}
    </>
  );
}
