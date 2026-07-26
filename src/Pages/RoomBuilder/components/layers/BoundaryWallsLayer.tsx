import React, { useRef } from 'react';
import type { WallEdge } from '../../../../Components/polygonGeometry';
import { edgeCursor, type DragState } from '../../types/floorPlanTypes';

interface BoundaryWallsLayerProps {
  edges: WallEdge[];
  highlightedEdgeIndex: number | null;
  selectedEdgeIndex: number | null;
  edgeThicknesses?: number[];
  drawStart: unknown;
  onEdgeClick?: (edgeIndex: number) => string | void;
  onEdgeDrag?: (edgeIndex: number, delta: number) => void;
  onEdgeDragStart?: (edgeIndex: number) => void;
  onVertexDrag?: unknown;
  onWallAdd?: (edgeIndex: number) => void;
  onWallClickStartDraw?: (clientX: number, clientY: number) => void;
  beginDrag: (e: React.PointerEvent<SVGElement>, state: DragState) => void;
  handlePointerMove: (e: React.PointerEvent<SVGElement>) => void;
  handlePointerUp: (e: React.PointerEvent<SVGElement>) => void;
  movedRef: React.RefObject<boolean>;
  pxScale: () => number;
  flashRejection: (edgeIndex: number | undefined, message: string) => void;
}

const DOUBLE_CLICK_WINDOW = 280;

export function BoundaryWallsLayer({
  edges,
  highlightedEdgeIndex,
  selectedEdgeIndex,
  edgeThicknesses,
  drawStart,
  onEdgeClick,
  onEdgeDrag,
  onEdgeDragStart,
  onVertexDrag,
  onWallAdd,
  onWallClickStartDraw,
  beginDrag,
  handlePointerMove,
  handlePointerUp,
  movedRef,
  pxScale,
  flashRejection,
}: BoundaryWallsLayerProps) {
  const WALL_STROKE = 0.18;
  const lastPointerTypeRef = useRef<string>('mouse');
  const clickTimers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

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
                style={{ cursor: drawStart ? 'crosshair' : onEdgeDrag ? edgeCursor(edge.normal) : 'pointer', touchAction: 'none' }}
                onPointerDown={(e) => {
                  lastPointerTypeRef.current = e.pointerType;
                  if (drawStart || !onEdgeDrag) return;
                  beginDrag(e, { kind: 'edge', index: i, startX: e.clientX, startY: e.clientY, scale: pxScale(), normal: edge.normal });
                  onEdgeDragStart?.(i);
                }}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                onClick={(e) => {
                  if (movedRef.current || drawStart) return;
                  e.stopPropagation();

                  if (!onWallClickStartDraw) {
                    if (onEdgeClick) {
                      const reason = onEdgeClick(i);
                      if (reason) flashRejection(i, reason);
                    }
                    return;
                  }

                  const pending = clickTimers.current.get(i);
                  if (pending) {
                    clearTimeout(pending);
                    clickTimers.current.delete(i);
                    if (onEdgeClick) {
                      const reason = onEdgeClick(i);
                      if (reason) flashRejection(i, reason);
                    }
                    return;
                  }

                  const clientX = e.clientX;
                  const clientY = e.clientY;
                  const isTouch = lastPointerTypeRef.current !== 'mouse';

                  if (isTouch) {
                    // Touch/tablet: single tap triggers wall drawing start
                    onWallClickStartDraw(clientX, clientY);
                  } else {
                    // Desktop mouse: single click immediately starts wall drawing
                    onWallClickStartDraw(clientX, clientY);
                  }
                }}
              />
            )}
            {onWallAdd && !drawStart && (
              <g
                transform={`translate(${edge.midpoint.x - edge.normal.x * 0.3} ${edge.midpoint.z - edge.normal.z * 0.3})`}
                style={{ cursor: 'pointer' }}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
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
    </>
  );
}
