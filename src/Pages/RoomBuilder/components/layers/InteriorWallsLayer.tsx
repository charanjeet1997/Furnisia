import { useRef } from 'react';
import type { InteriorWall, RoomVertex } from '../../../../Data/RoomShape';
import type { SnapTarget, DragState } from '../../types/floorPlanTypes';

interface InteriorWallsLayerProps {
  interiorWalls: InteriorWall[];
  draggingEndpoint: { wallId: string; end: 'start' | 'end'; origin: RoomVertex } | null;
  endpointSnap: SnapTarget | null;
  endpointLive: RoomVertex | null;
  jointedEndpoints?: (wallId: string, end: 'start' | 'end') => { wallId: string; end: 'start' | 'end' }[];
  drawStart: RoomVertex | null;
  selectedInteriorWallId: string | null;
  onInteriorWallRemove?: (id: string) => void;
  onInteriorWallClick?: (id: string) => string | void;
  onWallClickStartDraw?: (clientX: number, clientY: number) => void;
  onInteriorWallDrag?: (id: string, dx: number, dz: number) => void;
  onInteriorWallDragStart?: (id: string) => void;
  isEndpointAttached?: (wallId: string, end: 'start' | 'end') => boolean;
  onInteriorWallSplit?: (id: string) => void;
  onInteriorWallEndpointChange?: (wallId: string, end: 'start' | 'end', point: RoomVertex, attach: SnapTarget | null) => void;
  onInteriorWallEndpointDragStart?: (wallId: string, end: 'start' | 'end') => void;
  onInteriorWallEndpointDetach?: (wallId: string, end: 'start' | 'end') => void;
  onFreeEndpointClick?: (wallId: string, end: 'start' | 'end', point: RoomVertex) => void;
  endpointPressRef: React.MutableRefObject<boolean>;
  setDraggingEndpoint: React.Dispatch<React.SetStateAction<{ wallId: string; end: 'start' | 'end'; origin: RoomVertex } | null>>;
  setEndpointLive: React.Dispatch<React.SetStateAction<RoomVertex | null>>;
  setEndpointSnap: React.Dispatch<React.SetStateAction<SnapTarget | null>>;
  clientToSvgPoint: (clientX: number, clientY: number) => { x: number; z: number };
  findSnap: (p: RoomVertex, excludeWallId?: string, excludeTips?: { wallId: string; end: 'start' | 'end' }[]) => SnapTarget | null;
  startContinuousDraw: (wallId: string, end: 'start' | 'end', point: RoomVertex) => void;
  beginDrag: (e: React.PointerEvent<SVGElement>, state: DragState) => void;
  handlePointerMove: (e: React.PointerEvent<SVGElement>) => void;
  handlePointerUp: (e: React.PointerEvent<SVGElement>) => void;
  movedRef: React.RefObject<boolean>;
  pxScale: () => number;
  flashRejection: (edgeIndex: number | undefined, message: string) => void;
}

export function InteriorWallsLayer({
  interiorWalls,
  draggingEndpoint,
  endpointSnap,
  endpointLive,
  jointedEndpoints,
  drawStart,
  selectedInteriorWallId,
  onInteriorWallRemove,
  onInteriorWallClick,
  onWallClickStartDraw,
  onInteriorWallDrag,
  onInteriorWallDragStart,
  isEndpointAttached,
  onInteriorWallSplit,
  onInteriorWallEndpointChange,
  onInteriorWallEndpointDragStart,
  onInteriorWallEndpointDetach,
  onFreeEndpointClick,
  endpointPressRef,
  setDraggingEndpoint,
  setEndpointLive,
  setEndpointSnap,
  clientToSvgPoint,
  findSnap,
  startContinuousDraw,
  beginDrag,
  handlePointerMove,
  handlePointerUp,
  movedRef,
  pxScale,
  flashRejection,
}: InteriorWallsLayerProps) {
  const WALL_STROKE = 0.18;
  const lastPointerTypeRef = useRef<string>('mouse');
  const clickTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  return (
    <>
      {interiorWalls.map((wall) => {
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
          if (drawStart) return;
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
          setEndpointSnap(findSnap(p, wall.id, jointedEndpoints?.(wall.id, draggingEndpoint?.end ?? 'start')));
        }

        function handleEndpointUp(e: React.PointerEvent<SVGElement>) {
          e.currentTarget.releasePointerCapture(e.pointerId);
          if (draggingEndpoint) {
            const finalPoint = endpointSnap?.point ?? endpointLive;
            const attached = isEndpointAttached?.(wall.id, draggingEndpoint.end) ?? false;
            const rawPoint = endpointLive ?? draggingEndpoint.origin;
            const moved = Math.hypot(rawPoint.x - draggingEndpoint.origin.x, rawPoint.z - draggingEndpoint.origin.z) > 0.12;
            if (!moved && !attached && onFreeEndpointClick) {
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
                style={{
                  cursor: drawStart
                    ? 'crosshair'
                    : onInteriorWallDrag
                      ? 'move'
                      : 'pointer',
                  touchAction: 'none',
                }}
                onPointerDown={(e) => {
                  lastPointerTypeRef.current = e.pointerType;
                  if (drawStart || !onInteriorWallDrag) {
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
                  if (movedRef.current || drawStart) return;
                  e.stopPropagation();

                  if (!onWallClickStartDraw) {
                    if (onInteriorWallClick) {
                      const reason = onInteriorWallClick(wall.id);
                      if (reason) flashRejection(undefined, reason);
                    }
                    return;
                  }

                  const pending = clickTimers.current.get(wall.id);
                  if (pending) {
                    clearTimeout(pending);
                    clickTimers.current.delete(wall.id);
                    if (onInteriorWallClick) {
                      const reason = onInteriorWallClick(wall.id);
                      if (reason) flashRejection(undefined, reason);
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
    </>
  );
}
