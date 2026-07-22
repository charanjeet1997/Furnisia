import { useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Shape } from 'three';
import { usePlannerStore } from '../store/plannerStore';
import { buildWallSegments, type WallOpening } from './wallSegments';
import { createClippedMaterial } from './createClippedMaterial';
import { createGlassMaterial } from './createGlassMaterial';
import { computeEdges, offsetPolygon } from './polygonGeometry';
import { getDoorStyle, getWindowStyle } from '../Data/OpeningStyles';
import type { RoomOpening } from '../Data/RoomShape';

const WALL_THICKNESS = 0.1;
const BASEBOARD_COLOR = '#e8e2d4';
const BASEBOARD_HEIGHT = 0.05;
const BASEBOARD_DEPTH = 0.05;
const BASEBOARD_INSET = 0.02;

const DOOR_HEIGHT = 2.0;
const DOOR_COLOR = '#8b5e3c';

const WINDOW_SILL = 0.9;
const WINDOW_HEIGHT = 1.2;
const WINDOW_COLOR = '#bcd9e8';
const WINDOW_GLASS_OPACITY = 0.55;

const SEAM_OVERLAP = 0.015;
const PANEL_OFFSET = 0.02;
const LEAF_GAP = 0.02; // small visible gap between two door/window leaves

function toWallOpening(o: RoomOpening, edgeLength: number): WallOpening {
  const bottom = o.kind === 'door' ? 0 : WINDOW_SILL;
  const top = o.kind === 'door' ? DOOR_HEIGHT : WINDOW_SILL + WINDOW_HEIGHT;
  const centerX = o.offset + o.width / 2 - edgeLength / 2;
  return { centerX, width: o.width, bottom, top };
}

// Walls follow an arbitrary polygon (room.vertices) instead of a fixed rectangle. Each edge
// gets its own <group> positioned/rotated so local +Z aligns with that edge's outward normal
// (see polygonGeometry.computeEdges) — everything inside a wall's group (segments, door,
// window) just uses simple local 1D coordinates along the edge, same as the old rectangle
// code did, so buildWallSegments and the clip-material approach carry over unchanged.
export function Room() {
  const room = usePlannerStore((state) => state.room);
  const { vertices, height, wallColor, floorColor, openings } = room;
  const { camera, controls } = useThree();

  const edges = useMemo(() => computeEdges(vertices), [vertices]);

  const floorShape = useMemo(() => {
    const shape = new Shape();
    vertices.forEach((v, i) => {
      // z is negated here to counter the -90° X rotation used to lay the shape flat facing
      // up — without this the floor would come out mirrored relative to the walls.
      if (i === 0) shape.moveTo(v.x, -v.z);
      else shape.lineTo(v.x, -v.z);
    });
    shape.closePath();
    return shape;
  }, [vertices]);

  // Ceiling outline = room polygon grown to the walls' OUTER faces (walls are boxes centered
  // on the polygon line), so the slab sits flush with them — no gap/step seen from outside.
  const ceilingShape = useMemo(() => {
    const grown = offsetPolygon(vertices, WALL_THICKNESS / 2);
    const shape = new Shape();
    grown.forEach((v, i) => {
      if (i === 0) shape.moveTo(v.x, -v.z);
      else shape.lineTo(v.x, -v.z);
    });
    shape.closePath();
    return shape;
  }, [vertices]);

  const wallMats = useMemo(
    () => edges.map(() => createClippedMaterial({ color: wallColor }, 0)),
    [edges.length, wallColor],
  );
  const ceilingMat = useMemo(() => createClippedMaterial({ color: wallColor }, 0), [wallColor]);
  const openingMats = useMemo(
    () =>
      openings.map((o) => {
        if (o.kind === 'door') {
          const style = getDoorStyle(o.style);
          return style.material === 'glass'
            ? createGlassMaterial({ color: WINDOW_COLOR, opacity: WINDOW_GLASS_OPACITY }, 0)
            : createClippedMaterial({ color: DOOR_COLOR }, 0);
        }
        return createGlassMaterial({ color: WINDOW_COLOR, opacity: WINDOW_GLASS_OPACITY }, 0);
      }),
    [openings],
  );

  useFrame(() => {
    // Orbit pivot (what the camera looks at). Each wall hides only when its plane separates
    // the camera from this point — see createClippedMaterial for why the camera side alone
    // is not enough for concave (L/T/U) rooms. Falls back to the room centre before
    // OrbitControls mounts (makeDefault populates `controls` a frame late).
    const target = (controls as unknown as { target?: { x: number; y: number; z: number } } | null)?.target ?? {
      x: 0,
      y: height / 2,
      z: 0,
    };
    edges.forEach((edge, i) => {
      const mat = wallMats[i];
      if (!mat) return;
      mat.uniforms.cameraAxisValue.value = camera.position.x * edge.normal.x + camera.position.z * edge.normal.z;
      mat.uniforms.targetAxisValue.value = target.x * edge.normal.x + target.z * edge.normal.z;
      mat.uniforms.threshold.value = edge.midpoint.x * edge.normal.x + edge.midpoint.z * edge.normal.z;
    });
    ceilingMat.uniforms.cameraAxisValue.value = camera.position.y;
    ceilingMat.uniforms.targetAxisValue.value = target.y;
    ceilingMat.uniforms.threshold.value = height;
    openings.forEach((o, i) => {
      const mat = openingMats[i];
      const edge = edges[o.edgeIndex];
      if (!mat || !edge) return;
      mat.uniforms.cameraAxisValue.value = camera.position.x * edge.normal.x + camera.position.z * edge.normal.z;
      mat.uniforms.targetAxisValue.value = target.x * edge.normal.x + target.z * edge.normal.z;
      mat.uniforms.threshold.value = edge.midpoint.x * edge.normal.x + edge.midpoint.z * edge.normal.z;
    });
  });

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <shapeGeometry args={[floorShape]} />
        <meshStandardMaterial color={floorColor} roughness={0.8} />
      </mesh>

      {/* Ceiling is the exact room polygon (same Shape as the floor), extruded to wall
          thickness. The -90° X rotation maps the extrude direction onto world +Y, so the
          slab spans height..height+WALL_THICKNESS sitting on top of the walls. */}
      <mesh position={[0, height, 0]} rotation={[-Math.PI / 2, 0, 0]} material={ceilingMat.material}>
        <extrudeGeometry args={[ceilingShape, { depth: WALL_THICKNESS, bevelEnabled: false }]} />
      </mesh>

      {edges.map((edge, edgeIndex) => {
        const edgeOpenings = openings.filter((o) => o.edgeIndex === edgeIndex);
        const wallOpenings = edgeOpenings.map((o) => toWallOpening(o, edge.length));
        const segments = buildWallSegments(edge.length, height, wallOpenings);

        return (
          <group key={`edge-${edgeIndex}`} position={[edge.midpoint.x, 0, edge.midpoint.z]} rotation={[0, edge.angle, 0]}>
            {segments.map((seg, si) => (
              <mesh key={si} position={[seg.centerX, seg.centerY, 0]} material={wallMats[edgeIndex]?.material} receiveShadow castShadow>
                <boxGeometry args={[seg.width, seg.height, WALL_THICKNESS]} />
              </mesh>
            ))}

            {edgeOpenings.map((opening) => {
              const globalIndex = openings.indexOf(opening);
              const mat = openingMats[globalIndex];
              const wo = toWallOpening(opening, edge.length);
              const openingHeight = wo.top - wo.bottom + SEAM_OVERLAP * 2;
              const openingWidth = wo.width + SEAM_OVERLAP * 2;
              const centerY = wo.bottom + (wo.top - wo.bottom) / 2;
              const leafCount = opening.kind === 'door' ? getDoorStyle(opening.style).leafCount : getWindowStyle(opening.style).paneCount;

              if (leafCount === 1) {
                return (
                  <mesh key={opening.edgeIndex + '-' + opening.offset} position={[wo.centerX, centerY, -PANEL_OFFSET]} material={mat?.material}>
                    <boxGeometry args={[openingWidth, openingHeight, WALL_THICKNESS * 0.5]} />
                  </mesh>
                );
              }

              const leafWidth = openingWidth / 2 - LEAF_GAP / 2;
              return (
                <group key={opening.edgeIndex + '-' + opening.offset}>
                  <mesh position={[wo.centerX - openingWidth / 4 - LEAF_GAP / 4, centerY, -PANEL_OFFSET]} material={mat?.material}>
                    <boxGeometry args={[leafWidth, openingHeight, WALL_THICKNESS * 0.5]} />
                  </mesh>
                  <mesh position={[wo.centerX + openingWidth / 4 + LEAF_GAP / 4, centerY, -PANEL_OFFSET]} material={mat?.material}>
                    <boxGeometry args={[leafWidth, openingHeight, WALL_THICKNESS * 0.5]} />
                  </mesh>
                </group>
              );
            })}

            {/* Baseboard for this edge — always visible, cut only around door openings
                (windows sit well above floor level so they never need a cutout). */}
            {buildWallSegments(
              edge.length,
              BASEBOARD_HEIGHT,
              edgeOpenings.filter((o) => o.kind === 'door').map((o) => ({ ...toWallOpening(o, edge.length), top: BASEBOARD_HEIGHT })),
            ).map((seg, si) => (
              <mesh key={`base-${si}`} position={[seg.centerX, seg.centerY, -BASEBOARD_INSET]}>
                <boxGeometry args={[seg.width, seg.height, BASEBOARD_DEPTH]} />
                <meshStandardMaterial color={BASEBOARD_COLOR} />
              </mesh>
            ))}
          </group>
        );
      })}
    </group>
  );
}
