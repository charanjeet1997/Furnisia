import { useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { usePlannerStore } from '../store/plannerStore';
import { buildWallSegments, type WallOpening } from './wallSegments';
import { createClippedMaterial } from './createClippedMaterial';
import { createGlassMaterial } from './createGlassMaterial';

const WALL_THICKNESS = 0.1;
const WALL_COLOR = '#f5f0e6';
const FLOOR_COLOR = '#c9a978';
const BASEBOARD_COLOR = '#e8e2d4';
const BASEBOARD_HEIGHT = 0.05;
const BASEBOARD_DEPTH = 0.05;
const BASEBOARD_INSET = 0.02; // pulls the baseboard slightly in front of its wall plane to avoid z-fighting

const DOOR_WIDTH = 0.9;
const DOOR_HEIGHT = 2.0;
const DOOR_COLOR = '#8b5e3c';

const WINDOW_WIDTH = 1.0;
const WINDOW_HEIGHT = 1.2;
const WINDOW_SILL = 0.9;
const WINDOW_COLOR = '#bcd9e8';
const WINDOW_GLASS_OPACITY = 0.55;

const SEAM_OVERLAP = 0.015; // keeps abutting box segments from showing a hairline seam at glancing angles

// Walls/door/window/ceiling all use a real MeshStandardMaterial with a per-fragment clip
// shader injected via onBeforeCompile (see createClippedMaterial) instead of toggling a
// whole mesh's .visible in JS. Each material's own uniforms are updated once per frame from
// the camera position — the same side-of-room-center logic as before, just running on the
// GPU per-pixel with a smooth fade instead of a hard on/off per mesh.
export function Room() {
  const room = usePlannerStore((state) => state.room);
  const { width, length, height } = room;
  const { camera } = useThree();

  const north = useMemo(() => createClippedMaterial({ color: WALL_COLOR }, 0, 1), []);
  const south = useMemo(() => createClippedMaterial({ color: WALL_COLOR }, 0, -1), []);
  const west = useMemo(() => createClippedMaterial({ color: WALL_COLOR }, 0, 1), []);
  const east = useMemo(() => createClippedMaterial({ color: WALL_COLOR }, 0, -1), []);
  const ceiling = useMemo(() => createClippedMaterial({ color: WALL_COLOR }, 0, -1), []);
  const door = useMemo(() => createClippedMaterial({ color: DOOR_COLOR }, 0, -1), []);
  const windowMat = useMemo(
    () => createGlassMaterial({ color: WINDOW_COLOR, opacity: WINDOW_GLASS_OPACITY }, 0, 1),
    [],
  );

  useFrame(() => {
    north.uniforms.cameraAxisValue.value = camera.position.z;
    north.uniforms.threshold.value = -length / 2;
    south.uniforms.cameraAxisValue.value = camera.position.z;
    south.uniforms.threshold.value = length / 2;
    west.uniforms.cameraAxisValue.value = camera.position.x;
    west.uniforms.threshold.value = -width / 2;
    east.uniforms.cameraAxisValue.value = camera.position.x;
    east.uniforms.threshold.value = width / 2;
    ceiling.uniforms.cameraAxisValue.value = camera.position.y;
    ceiling.uniforms.threshold.value = height;
    door.uniforms.cameraAxisValue.value = camera.position.z;
    door.uniforms.threshold.value = length / 2;
    windowMat.uniforms.cameraAxisValue.value = camera.position.z;
    windowMat.uniforms.threshold.value = -length / 2;
  });

  const canFitDoor = width >= DOOR_WIDTH + 0.6;
  const doorOpenings: WallOpening[] = canFitDoor
    ? [{ centerX: 0, width: DOOR_WIDTH, bottom: 0, top: Math.min(DOOR_HEIGHT, height) }]
    : [];

  const windowTop = Math.min(WINDOW_SILL + WINDOW_HEIGHT, height - 0.2);
  const canFitOneWindow = width >= WINDOW_WIDTH + 0.6 && windowTop > WINDOW_SILL + 0.2;
  const canFitTwoWindows = width >= 3.2;
  const windowOpenings: WallOpening[] = !canFitOneWindow
    ? []
    : canFitTwoWindows
      ? [
          { centerX: -width / 4, width: WINDOW_WIDTH, bottom: WINDOW_SILL, top: windowTop },
          { centerX: width / 4, width: WINDOW_WIDTH, bottom: WINDOW_SILL, top: windowTop },
        ]
      : [{ centerX: 0, width: WINDOW_WIDTH, bottom: WINDOW_SILL, top: windowTop }];

  const southSegments = buildWallSegments(width, height, doorOpenings);
  const northSegments = buildWallSegments(width, height, windowOpenings);
  const southBaseboardSegments = buildWallSegments(
    width,
    BASEBOARD_HEIGHT,
    doorOpenings.map((o) => ({ ...o, top: BASEBOARD_HEIGHT })),
  );

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[width, length]} />
        <meshStandardMaterial color={FLOOR_COLOR} roughness={0.8} />
      </mesh>

      <mesh position={[0, height + WALL_THICKNESS / 2, 0]} material={ceiling.material}>
        <boxGeometry args={[width + WALL_THICKNESS + SEAM_OVERLAP * 2, WALL_THICKNESS, length + WALL_THICKNESS + SEAM_OVERLAP * 2]} />
      </mesh>

      {northSegments.map((seg, i) => (
        <mesh key={`n-${i}`} position={[seg.centerX, seg.centerY, -length / 2]} material={north.material} receiveShadow castShadow>
          <boxGeometry args={[seg.width, seg.height, WALL_THICKNESS]} />
        </mesh>
      ))}
      {windowOpenings.map((w, i) => (
        <mesh key={`w-${i}`} position={[w.centerX, (w.bottom + w.top) / 2, -length / 2]} material={windowMat.material}>
          <boxGeometry args={[w.width + SEAM_OVERLAP * 2, w.top - w.bottom + SEAM_OVERLAP * 2, WALL_THICKNESS * 0.5]} />
        </mesh>
      ))}

      {southSegments.map((seg, i) => (
        <mesh key={`s-${i}`} position={[seg.centerX, seg.centerY, length / 2]} material={south.material} receiveShadow castShadow>
          <boxGeometry args={[seg.width, seg.height, WALL_THICKNESS]} />
        </mesh>
      ))}
      {canFitDoor && (
        <mesh position={[0, DOOR_HEIGHT / 2, length / 2]} material={door.material}>
          <boxGeometry args={[DOOR_WIDTH + SEAM_OVERLAP * 2, DOOR_HEIGHT + SEAM_OVERLAP * 2, WALL_THICKNESS * 0.5]} />
        </mesh>
      )}

      <mesh position={[-width / 2, height / 2, 0]} rotation={[0, Math.PI / 2, 0]} material={west.material} receiveShadow castShadow>
        <boxGeometry args={[length + SEAM_OVERLAP * 2, height + SEAM_OVERLAP * 2, WALL_THICKNESS]} />
      </mesh>
      <mesh position={[width / 2, height / 2, 0]} rotation={[0, Math.PI / 2, 0]} material={east.material} receiveShadow castShadow>
        <boxGeometry args={[length + SEAM_OVERLAP * 2, height + SEAM_OVERLAP * 2, WALL_THICKNESS]} />
      </mesh>

      {/* Baseboards stay always-visible — an always-present floor-level outline of the room
          is useful even when a wall itself is culled away. Windows sit well above the floor
          (sill at WINDOW_SILL) so the north baseboard never needs a cutout, unlike the door. */}
      <mesh position={[0, BASEBOARD_HEIGHT / 2, -length / 2 + BASEBOARD_INSET]}>
        <boxGeometry args={[width + SEAM_OVERLAP * 2, BASEBOARD_HEIGHT + SEAM_OVERLAP * 2, BASEBOARD_DEPTH]} />
        <meshStandardMaterial color={BASEBOARD_COLOR} />
      </mesh>
      {southBaseboardSegments.map((seg, i) => (
        <mesh key={`sb-${i}`} position={[seg.centerX, seg.centerY, length / 2 - BASEBOARD_INSET]}>
          <boxGeometry args={[seg.width, seg.height, BASEBOARD_DEPTH]} />
          <meshStandardMaterial color={BASEBOARD_COLOR} />
        </mesh>
      ))}
      <mesh position={[-width / 2 + BASEBOARD_INSET, BASEBOARD_HEIGHT / 2, 0]} rotation={[0, Math.PI / 2, 0]}>
        <boxGeometry args={[length + SEAM_OVERLAP * 2, BASEBOARD_HEIGHT + SEAM_OVERLAP * 2, BASEBOARD_DEPTH]} />
        <meshStandardMaterial color={BASEBOARD_COLOR} />
      </mesh>
      <mesh position={[width / 2 - BASEBOARD_INSET, BASEBOARD_HEIGHT / 2, 0]} rotation={[0, Math.PI / 2, 0]}>
        <boxGeometry args={[length + SEAM_OVERLAP * 2, BASEBOARD_HEIGHT + SEAM_OVERLAP * 2, BASEBOARD_DEPTH]} />
        <meshStandardMaterial color={BASEBOARD_COLOR} />
      </mesh>
    </group>
  );
}
