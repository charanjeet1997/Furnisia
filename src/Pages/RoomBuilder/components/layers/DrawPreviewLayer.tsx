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
  hoverOnWall?: boolean;
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
  hoverOnWall: _hoverOnWall,
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
      {drawStart && (
        <g>
          {drawEnd && (drawEnd.x !== drawStart.x || drawEnd.z !== drawStart.z) && (
            <>
              <line
                x1={drawStart.x}
                y1={drawStart.z}
                x2={drawEnd.x}
                y2={drawEnd.z}
                stroke="var(--color-accent)"
                strokeWidth={0.05}
                strokeDasharray="0.1 0.07"
              />
              <circle cx={drawEnd.x} cy={drawEnd.z} r={0.12} fill="var(--color-surface)" stroke="var(--color-accent)" strokeWidth={0.035} />
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
            </>
          )}

          {/* Prominent start circle dot for touch visibility */}
          <circle cx={drawStart.x} cy={drawStart.z} r={0.2} fill="var(--color-accent)" opacity={0.35} />
          <circle cx={drawStart.x} cy={drawStart.z} r={0.12} fill="var(--color-accent)" stroke="var(--color-surface)" strokeWidth={0.03} />

          {drawStartSnap && (
            <circle cx={drawStart.x} cy={drawStart.z} r={0.24} fill="none" stroke="var(--color-accent)" strokeWidth={0.03} strokeDasharray="0.05 0.04" />
          )}
          {drawEndSnap && drawEnd && (
            <circle cx={drawEnd.x} cy={drawEnd.z} r={0.24} fill="none" stroke="var(--color-accent)" strokeWidth={0.03} strokeDasharray="0.05 0.04" />
          )}
        </g>
      )}

      {onWallDrawComplete &&
        !drawStart &&
        hoverPoint &&
        (() => {
          const snap_ = hoverSnap ?? ({ host: 'free', point: hoverPoint } as unknown as SnapTarget);
          const normal =
            hoverSnap?.host === 'boundary'
              ? (edges[hoverSnap.edgeIndex]?.normal ?? { x: 0, z: -1 })
              : hoverSnap?.host === 'interior'
              ? (() => {
                  const wall = interiorWalls.find((w) => w.id === hoverSnap.wallId);
                  const wdx = (wall?.end.x ?? 0) - (wall?.start.x ?? 0);
                  const wdz = (wall?.end.z ?? 0) - (wall?.start.z ?? 0);
                  const wlen = Math.hypot(wdx, wdz) || 1;
                  return { x: wdz / wlen, z: -wdx / wlen };
                })()
              : { x: 0, z: -1 };
          const point = hoverPoint;
          const canDelete = hoverSnap?.host === 'interior' && Boolean(onInteriorWallRemove);

          return (
            <WallToolMenu
              point={point}
              snap={snap_}
              normal={normal}
              canDelete={canDelete}
              onDraw={() => {
                setDrawStart(point);
                setDrawEnd(point);
                setDrawStartSnap(hoverSnap);
                menuAnchorRef.current = null;
                clearHover();
              }}
              onDelete={() => {
                if (hoverSnap?.host === 'interior') onInteriorWallRemove?.(hoverSnap.wallId);
                menuAnchorRef.current = null;
                clearHover();
              }}
            />
          );
        })()}
    </>
  );
}
