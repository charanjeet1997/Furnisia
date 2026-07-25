import React from 'react';
import type { RoomVertex } from '../../../../Data/RoomShape';
import type { DragState } from '../../types/floorPlanTypes';

interface CornerHandlesLayerProps {
  vertices: RoomVertex[];
  centroid: { x: number; z: number };
  drawStart: unknown;
  onVertexDrag?: (vertexIndex: number, dx: number, dz: number) => void;
  onVertexDragStart?: (vertexIndex: number) => void;
  onVertexRemove?: (vertexIndex: number) => void;
  beginDrag: (e: React.PointerEvent<SVGElement>, state: DragState) => void;
  handlePointerMove: (e: React.PointerEvent<SVGElement>) => void;
  handlePointerUp: (e: React.PointerEvent<SVGElement>) => void;
  pxScale: () => number;
}

export function CornerHandlesLayer({
  vertices,
  centroid,
  drawStart,
  onVertexDrag,
  onVertexDragStart,
  onVertexRemove,
  beginDrag,
  handlePointerMove,
  handlePointerUp,
  pxScale,
}: CornerHandlesLayerProps) {
  if (!onVertexDrag) return null;

  return (
    <>
      {vertices.map((v, i) => {
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
              r={0.42}
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
    </>
  );
}
