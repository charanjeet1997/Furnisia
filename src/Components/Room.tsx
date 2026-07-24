import { useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Shape } from 'three';
import { usePlannerStore } from '../store/plannerStore';
import { buildWallSegments, type WallOpening } from './wallSegments';
import { createClippedMaterial } from './createClippedMaterial';
import { createGlassMaterial } from './createGlassMaterial';
import { computeEdges, offsetPolygon, boundingBox } from './polygonGeometry';
import { getDoorStyle, getWindowStyle } from '../Data/OpeningStyles';
import type { RoomOpening } from '../Data/RoomShape';

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
  // Older saved rooms (Firestore documents from before these fields existed) fall back to the
  // app's original fixed thickness / no interior walls.
  const wallThickness = room.wallThickness ?? 0.1;
  const interiorWalls = room.interiorWalls ?? [];
  // Per-edge thickness (parallel to the edge list), falling back to the room default for
  // edges without an entry and for rooms saved before per-wall thickness existed.
  const edgeThicknesses = room.edgeThicknesses ?? [];
  const { camera, controls } = useThree();

  const edges = useMemo(() => computeEdges(vertices), [vertices]);
  const edgeTh = (i: number) => edgeThicknesses[i] ?? wallThickness;

  // Ceiling-mounted fixture: a flush disc glowing via emissive material (visible regardless
  // of scene lighting) paired with a real point light just beneath it, so the room reads as
  // lit from within instead of only by the outdoor-style directional "sun".
  const center = useMemo(() => {
    const bbox = boundingBox(vertices);
    return { x: (bbox.minX + bbox.maxX) / 2, z: (bbox.minZ + bbox.maxZ) / 2 };
  }, [vertices]);

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
  // With per-edge thickness the slab grows to the THICKEST wall's outer face (a slight
  // overhang on thinner walls beats a visible gap on thicker ones).
  const ceilingShape = useMemo(() => {
    const maxTh = Math.max(wallThickness, ...edgeThicknesses);
    const grown = offsetPolygon(vertices, maxTh / 2);
    const shape = new Shape();
    grown.forEach((v, i) => {
      if (i === 0) shape.moveTo(v.x, -v.z);
      else shape.lineTo(v.x, -v.z);
    });
    shape.closePath();
    return shape;
  }, [vertices, wallThickness, edgeThicknesses]);

  const wallMats = useMemo(
    () => edges.map(() => createClippedMaterial({ color: wallColor }, 0)),
    [edges.length, wallColor],
  );
  // Interior walls get the same camera/target cull test as boundary walls — without it,
  // orbiting the room would fade every boundary wall in your way except a partition, which
  // would just stay put and block the view inconsistently.
  const interiorWallMats = useMemo(
    () => interiorWalls.map(() => createClippedMaterial({ color: wallColor }, 0)),
    [interiorWalls.length, wallColor],
  );
  const ceilingMat = useMemo(() => createClippedMaterial({ color: wallColor }, 0), [wallColor]);
  // Fixture materials share the ceiling's cull test (same uniforms set in useFrame below) so
  // the light fixture fades away with the ceiling instead of floating with nothing above it.
  const fixtureTrimMat = useMemo(() => createClippedMaterial({ color: '#c9c2b2', roughness: 0.6 }, 0), []);
  const fixtureLensMat = useMemo(
    () => createClippedMaterial({ color: '#fff6e0', emissive: '#fff6e0', emissiveIntensity: 0.6 }, 0),
    [],
  );
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
    interiorWalls.forEach((wall, i) => {
      const mat = interiorWallMats[i];
      if (!mat) return;
      const dx = wall.end.x - wall.start.x;
      const dz = wall.end.z - wall.start.z;
      const length = Math.hypot(dx, dz);
      if (length < 1e-6) return;
      const nx = dz / length;
      const nz = -dx / length;
      const midX = (wall.start.x + wall.end.x) / 2;
      const midZ = (wall.start.z + wall.end.z) / 2;
      mat.uniforms.cameraAxisValue.value = camera.position.x * nx + camera.position.z * nz;
      mat.uniforms.targetAxisValue.value = target.x * nx + target.z * nz;
      mat.uniforms.threshold.value = midX * nx + midZ * nz;
    });
    ceilingMat.uniforms.cameraAxisValue.value = camera.position.y;
    ceilingMat.uniforms.targetAxisValue.value = target.y;
    ceilingMat.uniforms.threshold.value = height;
    for (const fixtureMat of [fixtureTrimMat, fixtureLensMat]) {
      fixtureMat.uniforms.cameraAxisValue.value = camera.position.y;
      fixtureMat.uniforms.targetAxisValue.value = target.y;
      fixtureMat.uniforms.threshold.value = height;
    }
    openings.forEach((o, i) => {
      const mat = openingMats[i];
      if (!mat) return;
      let normal: { x: number; z: number };
      let midpoint: { x: number; z: number };
      if (o.interiorWallId) {
        const wall = interiorWalls.find((w) => w.id === o.interiorWallId);
        if (!wall) return;
        const dx = wall.end.x - wall.start.x;
        const dz = wall.end.z - wall.start.z;
        const length = Math.hypot(dx, dz);
        if (length < 1e-6) return;
        normal = { x: dz / length, z: -dx / length };
        midpoint = { x: (wall.start.x + wall.end.x) / 2, z: (wall.start.z + wall.end.z) / 2 };
      } else {
        const edge = edges[o.edgeIndex];
        if (!edge) return;
        normal = edge.normal;
        midpoint = edge.midpoint;
      }
      mat.uniforms.cameraAxisValue.value = camera.position.x * normal.x + camera.position.z * normal.z;
      mat.uniforms.targetAxisValue.value = target.x * normal.x + target.z * normal.z;
      mat.uniforms.threshold.value = midpoint.x * normal.x + midpoint.z * normal.z;
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
          slab spans height..height+wallThickness sitting on top of the walls. */}
      <mesh position={[0, height, 0]} rotation={[-Math.PI / 2, 0, 0]} material={ceilingMat.material}>
        <extrudeGeometry args={[ceilingShape, { depth: wallThickness, bevelEnabled: false }]} />
      </mesh>

      {/* Ceiling light fixture: a flush-mount disc — dark trim ring flush against the
          ceiling, with a smaller, dimmer lens recessed just below it — plus a real point
          light for actual illumination. No rotation needed — cylinderGeometry's flat caps
          already face up/down along Y by default. */}
      <mesh position={[center.x, height - 0.012, center.z]} material={fixtureTrimMat.material}>
        <cylinderGeometry args={[0.24, 0.24, 0.02, 32]} />
      </mesh>
      <mesh position={[center.x, height - 0.03, center.z]} material={fixtureLensMat.material}>
        <cylinderGeometry args={[0.17, 0.17, 0.015, 32]} />
      </mesh>
      <pointLight
        position={[center.x, height - 0.15, center.z]}
        intensity={4}
        distance={Math.max(height * 3, 8)}
        decay={2}
        color="#fff1d6"
      />

      {edges.map((edge, edgeIndex) => {
        const th = edgeTh(edgeIndex);
        const edgeOpenings = openings.filter((o) => !o.interiorWallId && o.edgeIndex === edgeIndex);
        const wallOpenings = edgeOpenings.map((o) => toWallOpening(o, edge.length));
        const segments = buildWallSegments(edge.length, height, wallOpenings);
        // Corner fill: each wall box stops exactly at the polygon corner, so two thick walls
        // meeting there leave an L-shaped notch on the outside. Extending this wall past each
        // corner by the NEIGHBORING wall's half-thickness fills the notch (the overlap with
        // the neighbor is invisible — same color, solid boxes).
        const n = edges.length;
        const extStart = edgeTh((edgeIndex - 1 + n) % n) / 2;
        const extEnd = edgeTh((edgeIndex + 1) % n) / 2;

        return (
          <group key={`edge-${edgeIndex}`} position={[edge.midpoint.x, 0, edge.midpoint.z]} rotation={[0, edge.angle, 0]}>
            {segments.map((seg, si) => (
              <mesh key={si} position={[seg.centerX, seg.centerY, 0]} material={wallMats[edgeIndex]?.material} receiveShadow castShadow>
                <boxGeometry args={[seg.width, seg.height, th]} />
              </mesh>
            ))}
            <mesh position={[-(edge.length + extStart) / 2, height / 2, 0]} material={wallMats[edgeIndex]?.material} receiveShadow castShadow>
              <boxGeometry args={[extStart, height, th]} />
            </mesh>
            <mesh position={[(edge.length + extEnd) / 2, height / 2, 0]} material={wallMats[edgeIndex]?.material} receiveShadow castShadow>
              <boxGeometry args={[extEnd, height, th]} />
            </mesh>

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
                    <boxGeometry args={[openingWidth, openingHeight, th * 0.5]} />
                  </mesh>
                );
              }

              const leafWidth = openingWidth / 2 - LEAF_GAP / 2;
              return (
                <group key={opening.edgeIndex + '-' + opening.offset}>
                  <mesh position={[wo.centerX - openingWidth / 4 - LEAF_GAP / 4, centerY, -PANEL_OFFSET]} material={mat?.material}>
                    <boxGeometry args={[leafWidth, openingHeight, th * 0.5]} />
                  </mesh>
                  <mesh position={[wo.centerX + openingWidth / 4 + LEAF_GAP / 4, centerY, -PANEL_OFFSET]} material={mat?.material}>
                    <boxGeometry args={[leafWidth, openingHeight, th * 0.5]} />
                  </mesh>
                </group>
              );
            })}

            {/* Baseboard for this edge — always visible, cut only around door openings
                (windows sit well above floor level so they never need a cutout). Sits proud
                of the wall's INNER face whatever this edge's thickness is — a fixed inset
                would bury it inside anything thicker than the old default. */}
            {buildWallSegments(
              edge.length,
              BASEBOARD_HEIGHT,
              edgeOpenings.filter((o) => o.kind === 'door').map((o) => ({ ...toWallOpening(o, edge.length), top: BASEBOARD_HEIGHT })),
            ).map((seg, si) => (
              <mesh key={`base-${si}`} position={[seg.centerX, seg.centerY, -(th / 2 + BASEBOARD_DEPTH / 2 - BASEBOARD_INSET)]}>
                <boxGeometry args={[seg.width, seg.height, BASEBOARD_DEPTH]} />
                <meshStandardMaterial color={BASEBOARD_COLOR} />
              </mesh>
            ))}
          </group>
        );
      })}

      {/* Free-standing interior walls (partitions) — independent of the boundary polygon, so
          rendered directly from their own start/end points rather than via `edges`. The
          normal/angle math here is deliberately identical to computeEdges' per-edge formula
          (unflipped — these aren't part of any polygon winding) so the rotation lines the box
          up with the wall direction exactly the same way boundary walls already do. */}
      {interiorWalls.map((wall, wallIndex) => {
        const th = wall.thickness ?? wallThickness;
        const dx = wall.end.x - wall.start.x;
        const dz = wall.end.z - wall.start.z;
        const length = Math.hypot(dx, dz);
        if (length < 1e-6) return null;
        const nx = dz / length;
        const nz = -dx / length;
        const angle = Math.atan2(nx, nz);
        const midX = (wall.start.x + wall.end.x) / 2;
        const midZ = (wall.start.z + wall.end.z) / 2;

        const wallOpeningsRaw = openings.filter((o) => o.interiorWallId === wall.id);
        const wallOpenings = wallOpeningsRaw.map((o) => toWallOpening(o, length));
        const segments = buildWallSegments(length, height, wallOpenings);

        return (
          <group key={wall.id} position={[midX, 0, midZ]} rotation={[0, angle, 0]}>
            {segments.map((seg, si) => (
              <mesh
                key={si}
                position={[seg.centerX, seg.centerY, 0]}
                material={interiorWallMats[wallIndex]?.material}
                receiveShadow
                castShadow
              >
                <boxGeometry args={[seg.width, seg.height, th]} />
              </mesh>
            ))}

            {wallOpeningsRaw.map((opening) => {
              const globalIndex = openings.indexOf(opening);
              const mat = openingMats[globalIndex];
              const wo = toWallOpening(opening, length);
              const openingHeight = wo.top - wo.bottom + SEAM_OVERLAP * 2;
              const openingWidth = wo.width + SEAM_OVERLAP * 2;
              const centerY = wo.bottom + (wo.top - wo.bottom) / 2;
              const leafCount = opening.kind === 'door' ? getDoorStyle(opening.style).leafCount : getWindowStyle(opening.style).paneCount;

              if (leafCount === 1) {
                return (
                  <mesh key={opening.interiorWallId + '-' + opening.offset} position={[wo.centerX, centerY, -PANEL_OFFSET]} material={mat?.material}>
                    <boxGeometry args={[openingWidth, openingHeight, th * 0.5]} />
                  </mesh>
                );
              }

              const leafWidth = openingWidth / 2 - LEAF_GAP / 2;
              return (
                <group key={opening.interiorWallId + '-' + opening.offset}>
                  <mesh position={[wo.centerX - openingWidth / 4 - LEAF_GAP / 4, centerY, -PANEL_OFFSET]} material={mat?.material}>
                    <boxGeometry args={[leafWidth, openingHeight, th * 0.5]} />
                  </mesh>
                  <mesh position={[wo.centerX + openingWidth / 4 + LEAF_GAP / 4, centerY, -PANEL_OFFSET]} material={mat?.material}>
                    <boxGeometry args={[leafWidth, openingHeight, th * 0.5]} />
                  </mesh>
                </group>
              );
            })}

            {/* Baseboard, same cut-around-doors treatment as boundary walls. */}
            {buildWallSegments(
              length,
              BASEBOARD_HEIGHT,
              wallOpeningsRaw.filter((o) => o.kind === 'door').map((o) => ({ ...toWallOpening(o, length), top: BASEBOARD_HEIGHT })),
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
