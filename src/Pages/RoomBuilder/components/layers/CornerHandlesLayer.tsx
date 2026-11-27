import React from 'react';
import type { RoomVertex } from '../../../../Data/RoomShape';
import type { DragState } from '../../types/floorPlanTypes';

interface CornerHandlesLayerProps {
  vertices: RoomVertex[];
  onVertexDrag?: (vertexIndex: number, dx: number, dz: number) => void;
  onVertexDragStart?: (vertexIndex: number) => void;
  beginDrag: (e: React.PointerEvent<SVGElement>, state: DragState) => void;
  handlePointerMove: (e: React.PointerEvent<SVGElement>) => void;
  handlePointerUp: (e: React.PointerEvent<SVGElement>) => void;
  pxScale: () => number;
}

export function CornerHandlesLayer({
  vertices,
  onVertexDrag,
  onVertexDragStart,
  beginDrag,
  handlePointerMove,
  handlePointerUp,
  pxScale,
}: CornerHandlesLayerProps) {
  if (!onVertexDrag) return null;

  return (
    <>
      {vertices.map((v, i) => {
        return (
          <g key={i}>
            <circle cx={v.x} cy={v.z} r={0.11} fill="var(--color-surface)" stroke="var(--color-text)" strokeWidth={0.035} />
            <circle
              cx={v.x}
              cy={v.z}
              r={0.42}
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
        );
      })}
    </>
  );
}
