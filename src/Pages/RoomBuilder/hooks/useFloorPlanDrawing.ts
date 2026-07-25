import { useEffect, useRef, useState } from 'react';
import type { RoomVertex } from '../../../Data/RoomShape';
import type { SnapTarget } from '../types/floorPlanTypes';

interface UseFloorPlanDrawingProps {
  onFreeEndpointClick?: (wallId: string, end: 'start' | 'end', point: RoomVertex) => void;
  onWallDrawCancel?: () => void;
}

export function useFloorPlanDrawing({ onFreeEndpointClick, onWallDrawCancel }: UseFloorPlanDrawingProps) {
  const [drawStart, setDrawStart] = useState<RoomVertex | null>(null);
  const [drawEnd, setDrawEnd] = useState<RoomVertex | null>(null);
  const [drawStartSnap, setDrawStartSnap] = useState<SnapTarget | null>(null);
  const [drawEndSnap, setDrawEndSnap] = useState<SnapTarget | null>(null);
  const [hoverPoint, setHoverPoint] = useState<RoomVertex | null>(null);
  const [hoverSnap, setHoverSnap] = useState<SnapTarget | null>(null);
  const menuAnchorRef = useRef<RoomVertex | null>(null);
  const [hoverOnWall, setHoverOnWall] = useState(false);

  function cancelDraw() {
    setDrawStart(null);
    setDrawEnd(null);
    setDrawStartSnap(null);
    setDrawEndSnap(null);
    onWallDrawCancel?.();
  }

  function confirmDraw() {
    setDrawStart(null);
    setDrawEnd(null);
    setDrawStartSnap(null);
    setDrawEndSnap(null);
  }

  function startContinuousDraw(wallId: string, end: 'start' | 'end', point: RoomVertex) {
    setDrawStart(point);
    setDrawEnd(point);
    setDrawStartSnap(null);
    onFreeEndpointClick?.(wallId, end, point);
  }

  useEffect(() => {
    if (!drawStart) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') cancelDraw();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawStart]);

  return {
    drawStart,
    setDrawStart,
    drawEnd,
    setDrawEnd,
    drawStartSnap,
    setDrawStartSnap,
    drawEndSnap,
    setDrawEndSnap,
    hoverPoint,
    setHoverPoint,
    hoverSnap,
    setHoverSnap,
    hoverOnWall,
    setHoverOnWall,
    menuAnchorRef,
    cancelDraw,
    confirmDraw,
    startContinuousDraw,
  };
}
