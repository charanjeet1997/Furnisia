import React from 'react';
import type { RoomOpening, RoomVertex } from '../../../../Data/RoomShape';
import type { WallEdge } from '../../../../Components/polygonGeometry';
import { edgeCursor, type DragState } from '../../types/floorPlanTypes';

interface OpeningsLayerProps {
  openings: RoomOpening[];
  edges: WallEdge[];
  openingHost: (opening: RoomOpening) => { start: RoomVertex; end: RoomVertex; length: number; normal: RoomVertex; thickness: number } | null;
  hoveredOpening: number | null;
  setHoveredOpening: React.Dispatch<React.SetStateAction<number | null>>;
  onOpeningDrag?: (openingIndex: number, delta: number) => void;
  onOpeningDragStart?: (openingIndex: number) => void;
  onOpeningRemove?: (openingIndex: number) => void;
  beginDrag: (e: React.PointerEvent<SVGElement>, state: DragState) => void;
  handlePointerMove: (e: React.PointerEvent<SVGElement>) => void;
  handlePointerUp: (e: React.PointerEvent<SVGElement>) => void;
  pxScale: () => number;
}

export function OpeningsLayer({
  openings,
  openingHost,
  hoveredOpening,
  setHoveredOpening,
  onOpeningDrag,
  onOpeningDragStart,
  onOpeningRemove,
  beginDrag,
  handlePointerMove,
  handlePointerUp,
  pxScale,
}: OpeningsLayerProps) {
  return (
    <>
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
    </>
  );
}
