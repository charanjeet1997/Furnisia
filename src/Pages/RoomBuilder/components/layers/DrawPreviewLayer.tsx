import React from 'react';
import type { RoomVertex } from '../../../../Data/RoomShape';
import type { WallEdge } from '../../../../Components/polygonGeometry';
import type { InteriorWall } from '../../../../Data/RoomShape';
import { formatLength, type PlanUnits, type SnapTarget } from '../../types/floorPlanTypes';
import { WallToolMenu } from '../../tools/WallToolMenu';

interface DrawPreviewLayerProps {
  drawStart: RoomVertex | null;
  drawEnd: RoomVertex | null;
  drawStartSnap: SnapTarget | null;
  drawEndSnap: SnapTarget | null;
  units: PlanUnits;
  onWallDrawComplete?: unknown;
  hoverPoint: RoomVertex | null;
  hoverSnap: SnapTarget | null;
  hoverOnWall: boolean;
  edges: WallEdge[];
  interiorWalls: InteriorWall[];
  setDrawStart: (pt: RoomVertex | null) => void;
  setDrawEnd: (pt: RoomVertex | null) => void;
  setDrawStartSnap: (snap: SnapTarget | null) => void;
  menuAnchorRef: React.MutableRefObject<RoomVertex | null>;
  setHoverPoint: (pt: RoomVertex | null) => void;
  setHoverSnap: (snap: SnapTarget | null) => void;
  setHoverOnWall: (onWall: boolean) => void;
  onInteriorWallRemove?: (id: string) => void;
}

export function DrawPreviewLayer({
  drawStart,
  drawEnd,
  drawStartSnap,
  drawEndSnap,
  units,
  onWallDrawComplete,
  hoverPoint,
  hoverSnap,
  hoverOnWall,
  edges,
  interiorWalls,
  setDrawStart,
  setDrawEnd,
  setDrawStartSnap,
  menuAnchorRef,
  setHoverPoint,
  setHoverSnap,
  setHoverOnWall,
  onInteriorWallRemove,
}: DrawPreviewLayerProps) {
  function clearHover() {
    setHoverPoint(null);
    setHoverSnap(null);
    setHoverOnWall(false);
  }

  return (
    <>
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
    </>
  );
}
