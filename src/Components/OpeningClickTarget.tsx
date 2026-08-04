import { useMemo, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import type { ThreeEvent } from '@react-three/fiber';
import { Vector3 } from 'three';
import type { RoomOpening, RoomVertex } from '../Data/RoomShape';
import { computeEdges } from './polygonGeometry';

const DOOR_BOTTOM  = 0;
const DOOR_TOP     = 2.0;
const WINDOW_SILL  = 0.9;
const WINDOW_TOP   = 2.1;
const PANEL_OFFSET = 0.02;
const SEAM         = 0.015;

interface Props {
  opening: RoomOpening;
  openingIndex: number;
  vertices: RoomVertex[];
  wallThickness: number;
  isSelected: boolean;
  onSelect: () => void;
  onSlide?: (newOffset: number) => void;
}

export function OpeningClickTarget({
  opening, openingIndex, vertices, wallThickness, isSelected, onSelect, onSlide,
}: Props) {
  // All hooks before any early return
  const edges        = useMemo(() => computeEdges(vertices), [vertices]);
  const { controls, camera, gl } = useThree();
  const dragRef      = useRef<{
    startOffset: number;
    startNdcAlong: number;   // cursor's NDC projection onto wall direction at drag start
    ndcDirX: number;         // screen-space wall unit direction X (NDC)
    ndcDirY: number;         // screen-space wall unit direction Y (NDC)
    ndcPerMetre: number;     // how many NDC units = 1 metre along wall
  } | null>(null);

  const edge = edges[opening.edgeIndex];

  const isDoor  = opening.kind === 'door';
  const bottom  = isDoor ? DOOR_BOTTOM : WINDOW_SILL;
  const top     = isDoor ? DOOR_TOP    : WINDOW_TOP;
  const centerY = (bottom + top) / 2;

  // Guard — after all hooks
  if (!edge || opening.interiorWallId) return null;

  const { midpoint, angle, length, start, end } = edge;

  // Opening local position inside wall group — matches Room.tsx toWallOpening
  const centerX  = opening.offset + opening.width / 2 - length / 2;
  const openingW = opening.width + SEAM * 2;
  const openingH = (top - bottom) + SEAM * 2;
  const depth    = wallThickness * 0.5 + 0.06;

  /** Project world point → NDC {x,y} in [-1,1] */
  function toNdc(wx: number, wy: number, wz: number) {
    const v = new Vector3(wx, wy, wz).project(camera);
    return { x: v.x, y: v.y };
  }

  /** Convert clientX/Y → NDC using the actual canvas bounds */
  function clientToNdc(cx: number, cy: number) {
    const rect = gl.domElement.getBoundingClientRect();
    return {
      x:  (cx - rect.left) / rect.width  * 2 - 1,
      y: -((cy - rect.top)  / rect.height * 2 - 1),
    };
  }

  function onPointerDown(e: ThreeEvent<PointerEvent>) {
    e.stopPropagation();
    onSelect();

    // Project wall start/end onto screen to get the screen-space wall direction
    const s0 = toNdc(start.x, centerY, start.z);
    const s1 = toNdc(end.x,   centerY, end.z);
    const ddx = s1.x - s0.x;
    const ddy = s1.y - s0.y;
    const screenLen = Math.sqrt(ddx * ddx + ddy * ddy);
    if (screenLen < 1e-4) return; // wall is edge-on to camera

    const ndcDirX    = ddx / screenLen;          // screen-space unit direction (NDC)
    const ndcDirY    = ddy / screenLen;
    const ndcPerMetre = screenLen / length;       // NDC per world metre

    // Where is the cursor now in NDC?
    const mouse = clientToNdc(e.clientX, e.clientY);
    const startNdcAlong = mouse.x * ndcDirX + mouse.y * ndcDirY;

    dragRef.current = { startOffset: opening.offset, startNdcAlong, ndcDirX, ndcDirY, ndcPerMetre };

    if (controls && 'enabled' in controls) (controls as { enabled: boolean }).enabled = false;
    (e.target as Element).setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: ThreeEvent<PointerEvent>) {
    const d = dragRef.current;
    if (!d || !onSlide) return;
    e.stopPropagation();

    // Current cursor in NDC
    const mouse = clientToNdc(e.clientX, e.clientY);
    const curNdcAlong = mouse.x * d.ndcDirX + mouse.y * d.ndcDirY;

    // NDC delta along wall → world metres → offset change
    const ndcDelta  = curNdcAlong - d.startNdcAlong;
    const worldDelta = ndcDelta / d.ndcPerMetre;

    onSlide(d.startOffset + worldDelta);
  }

  function onPointerUp() {
    dragRef.current = null;
    if (controls && 'enabled' in controls) (controls as { enabled: boolean }).enabled = true;
  }

  return (
    <group position={[midpoint.x, 0, midpoint.z]} rotation={[0, angle, 0]}>
      <group position={[centerX, centerY, -PANEL_OFFSET]}>

        {/* Invisible drag + click catcher */}
        <mesh
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onClick={(e) => { e.stopPropagation(); onSelect(); }}
        >
          <boxGeometry args={[openingW + 0.04, openingH + 0.04, depth]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>

        {/* Selection highlight */}
        {isSelected && (
          <mesh>
            <boxGeometry args={[openingW + 0.02, openingH + 0.02, depth + 0.02]} />
            <meshBasicMaterial color="#6366f1" transparent opacity={0.28} depthWrite={false} />
          </mesh>
        )}

        {/* Gizmo: rail + arrows */}
        {isSelected && <>
          <mesh>
            <boxGeometry args={[openingW + 0.8, 0.025, 0.025]} />
            <meshBasicMaterial color="#818cf8" />
          </mesh>
          <mesh position={[-openingW / 2 - 0.25, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <coneGeometry args={[0.07, 0.22, 8]} />
            <meshBasicMaterial color="#818cf8" />
          </mesh>
          <mesh position={[openingW / 2 + 0.25, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
            <coneGeometry args={[0.07, 0.22, 8]} />
            <meshBasicMaterial color="#818cf8" />
          </mesh>
        </>}

      </group>
    </group>
  );
}
