import { useRef, useState } from 'react';
import type { DragState } from '../types/floorPlanTypes';

interface UseFloorPlanPointerProps {
  fitViewBox: string;
  onEdgeDrag?: (edgeIndex: number, delta: number) => void;
  onEdgeDragEnd?: () => void;
  onVertexDrag?: (vertexIndex: number, dx: number, dz: number) => void;
  onVertexDragEnd?: () => void;
  onInteriorWallDrag?: (id: string, dx: number, dz: number) => void;
  onInteriorWallDragEnd?: () => void;
  onOpeningDrag?: (openingIndex: number, delta: number) => void;
  onOpeningDragEnd?: () => void;
  onEdgeLengthChange?: (edgeIndex: number, newLength: number) => void;
}

export function useFloorPlanPointer({
  fitViewBox,
  onEdgeDrag,
  onEdgeDragEnd,
  onVertexDrag,
  onVertexDragEnd,
  onInteriorWallDrag,
  onInteriorWallDragEnd,
  onOpeningDrag,
  onOpeningDragEnd,
  onEdgeLengthChange,
}: UseFloorPlanPointerProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const movedRef = useRef(false);
  const [frozenViewBox, setFrozenViewBox] = useState<string | null>(null);
  const viewBox = frozenViewBox ?? fitViewBox;

  const [editingEdge, setEditingEdge] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');
  const [hoveredOpening, setHoveredOpening] = useState<number | null>(null);

  const [rejectedClick, setRejectedClick] = useState<{ edgeIndex?: number; message: string; token: number } | null>(null);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function flashRejection(edgeIndex: number | undefined, message: string) {
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    setRejectedClick({ edgeIndex, message, token: Date.now() });
    errorTimerRef.current = setTimeout(() => setRejectedClick(null), 1300);
  }

  function commitEdit(edgeIndex: number, raw: string) {
    const value = parseFloat(raw);
    if (Number.isFinite(value) && value > 0) onEdgeLengthChange?.(edgeIndex, value);
    setEditingEdge(null);
  }

  function pxScale(): number {
    const svg = svgRef.current;
    if (!svg) return 1;
    const rect = svg.getBoundingClientRect();
    const [, , vbW, vbH] = viewBox.split(' ').map(Number);
    return Math.min(rect.width / vbW, rect.height / vbH);
  }

  function svgToLocalPx(x: number, z: number): { left: number; top: number } {
    const svg = svgRef.current;
    if (!svg) return { left: 0, top: 0 };
    const rect = svg.getBoundingClientRect();
    const [vbX, vbY, vbW, vbH] = viewBox.split(' ').map(Number);
    const scale = Math.min(rect.width / vbW, rect.height / vbH);
    const offsetX = (rect.width - vbW * scale) / 2;
    const offsetY = (rect.height - vbH * scale) / 2;
    return { left: offsetX + (x - vbX) * scale, top: offsetY + (z - vbY) * scale };
  }

  function beginDrag(e: React.PointerEvent<SVGElement>, state: DragState) {
    setFrozenViewBox(fitViewBox);
    dragRef.current = state;
    movedRef.current = false;
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: React.PointerEvent<SVGElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = (e.clientX - drag.startX) / drag.scale;
    const dz = (e.clientY - drag.startY) / drag.scale;
    if (Math.abs(dx) + Math.abs(dz) > 0.02) movedRef.current = true;
    if (drag.kind === 'edge') {
      onEdgeDrag?.(drag.index, dx * drag.normal.x + dz * drag.normal.z);
    } else if (drag.kind === 'vertex') {
      onVertexDrag?.(drag.index, dx, dz);
    } else if (drag.kind === 'interiorWall') {
      onInteriorWallDrag?.(drag.id, dx, dz);
    } else {
      onOpeningDrag?.(drag.index, dx * drag.dir.x + dz * drag.dir.z);
    }
  }

  function handlePointerUp(e: React.PointerEvent<SVGElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    e.currentTarget.releasePointerCapture(e.pointerId);
    dragRef.current = null;
    setFrozenViewBox(null);
    if (drag.kind === 'edge') onEdgeDragEnd?.();
    else if (drag.kind === 'vertex') onVertexDragEnd?.();
    else if (drag.kind === 'interiorWall') onInteriorWallDragEnd?.();
    else onOpeningDragEnd?.();

    setTimeout(() => {
      movedRef.current = false;
    }, 0);
  }

  return {
    svgRef,
    dragRef,
    movedRef,
    viewBox,
    editingEdge,
    setEditingEdge,
    editValue,
    setEditValue,
    hoveredOpening,
    setHoveredOpening,
    rejectedClick,
    flashRejection,
    commitEdit,
    pxScale,
    svgToLocalPx,
    beginDrag,
    handlePointerMove,
    handlePointerUp,
  };
}
