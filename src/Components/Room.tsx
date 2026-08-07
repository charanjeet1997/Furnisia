import { useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Grid } from '@react-three/drei';
import { Shape, MeshStandardMaterial, TextureLoader, RepeatWrapping } from 'three';
import { usePlannerStore } from '../store/plannerStore';
import { buildWallSegments, type WallOpening } from './wallSegments';
import { createClippedMaterial } from './createClippedMaterial';
import { createGlassMaterial } from './createGlassMaterial';
import { computeEdges, offsetPolygon, boundingBox } from './polygonGeometry';
import { getDoorStyle, getWindowStyle } from '../Data/OpeningStyles';
import type { RoomOpening, RoomVertex, RoomShape } from '../Data/RoomShape';

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

function computeRoomLightingGrid(vertices: RoomVertex[]) {
  const bbox = boundingBox(vertices);
  const totalW = bbox.maxX - bbox.minX || 1;
  const totalH = bbox.maxZ - bbox.minZ || 1;

  // Always return 4 balanced recessed lights placed across the room area
  return [
    { id: 'l1', x: bbox.minX + totalW * 0.3, z: bbox.minZ + totalH * 0.3 },
    { id: 'l2', x: bbox.minX + totalW * 0.7, z: bbox.minZ + totalH * 0.3 },
    { id: 'l3', x: bbox.minX + totalW * 0.3, z: bbox.minZ + totalH * 0.7 },
    { id: 'l4', x: bbox.minX + totalW * 0.7, z: bbox.minZ + totalH * 0.7 },
  ];
}

interface RoomProps {
  disableClipping?: boolean;
  roomOverride?: RoomShape;
}

export function Room({ disableClipping = false, roomOverride }: RoomProps) {
  const storeRoom = usePlannerStore((state) => state.room);
  const room = roomOverride ?? storeRoom;
  const showGrid = usePlannerStore((state) => state.showGrid);
  const gridSize = usePlannerStore((state) => state.gridSize);
  const { vertices, height, wallColor, floorColor, wallTexture, floorTexture, openings } = room;
  const wallThickness = room.wallThickness ?? 0.1;
  const interiorWalls = room.interiorWalls ?? [];
  const edgeThicknesses = room.edgeThicknesses ?? [];
  const { camera, controls, invalidate } = useThree();

  const edges = useMemo(() => computeEdges(vertices), [vertices]);
  const edgeTh = (i: number) => edgeThicknesses[i] ?? wallThickness;

  const lightIntensity = room.lightIntensity ?? 1.8;

  const lightFixtures = useMemo(() => {
    return computeRoomLightingGrid(vertices);
  }, [vertices]);

  const floorScaleX = room.floorTextureScaleX ?? 1;
  const floorScaleY = room.floorTextureScaleY ?? 1;
  const wallScaleX = room.wallTextureScaleX ?? 1;
  const wallScaleY = room.wallTextureScaleY ?? 1;

  const floorMap = useMemo(() => {
    if (!floorTexture) return null;
    const tex = new TextureLoader().load(floorTexture, () => {
      tex.needsUpdate = true;
      invalidate();
    });
    tex.wrapS = RepeatWrapping;
    tex.wrapT = RepeatWrapping;
    tex.repeat.set(floorScaleX, floorScaleY);
    return tex;
  }, [floorTexture, floorScaleX, floorScaleY, invalidate]);

  const wallMap = useMemo(() => {
    if (!wallTexture) return null;
    const tex = new TextureLoader().load(wallTexture, () => {
      tex.needsUpdate = true;
      invalidate();
    });
    tex.wrapS = RepeatWrapping;
    tex.wrapT = RepeatWrapping;
    tex.repeat.set(wallScaleX, wallScaleY);
    return tex;
  }, [wallTexture, wallScaleX, wallScaleY, invalidate]);

  const floorShape = useMemo(() => {
    const shape = new Shape();
    vertices.forEach((v, i) => {
      if (i === 0) shape.moveTo(v.x, -v.z);
      else shape.lineTo(v.x, -v.z);
    });
    shape.closePath();
    return shape;
  }, [vertices]);


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

  const effectiveWallColor = wallTexture ? '#ffffff' : wallColor;
  const effectiveFloorColor = floorTexture ? '#ffffff' : floorColor;

  const wallMats = useMemo(
    () =>
      edges.map(() =>
        disableClipping
          ? { material: new MeshStandardMaterial({ color: effectiveWallColor, map: wallMap }) }
          : createClippedMaterial({ color: effectiveWallColor, map: wallMap }, 0),
      ),
    [edges.length, effectiveWallColor, wallMap, disableClipping],
  );

  const interiorWallMats = useMemo(
    () =>
      interiorWalls.map(() =>
        disableClipping
          ? { material: new MeshStandardMaterial({ color: effectiveWallColor, map: wallMap }) }
          : createClippedMaterial({ color: effectiveWallColor, map: wallMap }, 0),
      ),
    [interiorWalls.length, effectiveWallColor, wallMap, disableClipping],
  );

  const effectiveCeilingColor = room.ceilingColor ?? '#f8fafc';
  const ceilingMat = useMemo(
    () => (disableClipping ? { material: new MeshStandardMaterial({ color: effectiveCeilingColor, roughness: 0.85 }) } : createClippedMaterial({ color: effectiveCeilingColor, roughness: 0.85 }, 0)),
    [effectiveCeilingColor, disableClipping],
  );

  const fixtureTrimMat = useMemo(
    () => (disableClipping ? { material: new MeshStandardMaterial({ color: '#88847b', roughness: 0.6 }) } : createClippedMaterial({ color: '#88847b', roughness: 0.6 }, 0)),
    [disableClipping],
  );

  const fixtureLensMat = useMemo(
    () =>
      disableClipping
        ? { material: new MeshStandardMaterial({ color: '#fffdfa', emissive: '#ffeedd', emissiveIntensity: 0.12, roughness: 0.3 }) }
        : createClippedMaterial({ color: '#fffdfa', emissive: '#ffeedd', emissiveIntensity: 0.12, roughness: 0.3 }, 0),
    [disableClipping],
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
    if (disableClipping) return;
    const target = (controls as unknown as { target?: { x: number; y: number; z: number } } | null)?.target ?? {
      x: 0,
      y: height / 2,
      z: 0,
    };
    edges.forEach((edge, i) => {
      const mat = wallMats[i];
      if (!mat || !('uniforms' in mat)) return;
      mat.uniforms.cameraAxisValue.value = camera.position.x * edge.normal.x + camera.position.z * edge.normal.z;
      mat.uniforms.targetAxisValue.value = target.x * edge.normal.x + target.z * edge.normal.z;
      mat.uniforms.threshold.value = edge.midpoint.x * edge.normal.x + edge.midpoint.z * edge.normal.z;
    });
    interiorWalls.forEach((wall, i) => {
      const mat = interiorWallMats[i];
      if (!mat || !('uniforms' in mat)) return;
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
    if ('uniforms' in ceilingMat) {
      ceilingMat.uniforms.cameraAxisValue.value = camera.position.y;
      ceilingMat.uniforms.targetAxisValue.value = target.y;
      ceilingMat.uniforms.threshold.value = height;
    }
    for (const fixtureMat of [fixtureTrimMat, fixtureLensMat]) {
      const matObj = fixtureMat as unknown as { uniforms?: { cameraAxisValue: { value: number }; targetAxisValue: { value: number }; threshold: { value: number } } };
      if (matObj.uniforms) {
        matObj.uniforms.cameraAxisValue.value = camera.position.y;
        matObj.uniforms.targetAxisValue.value = target.y;
        matObj.uniforms.threshold.value = height;
      }
    }
    openings.forEach((o, i) => {
      const mat = openingMats[i];
      if (!mat || !('uniforms' in mat)) return;
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
        {/* `key` forces a fresh material whenever the texture is swapped or cleared. Mutating
            `map` in place would leave the compiled shader without its USE_MAP define, so the
            floor would keep rendering as flat colour until something else forced a recompile. */}
        <meshStandardMaterial key={floorTexture ?? 'no-texture'} color={effectiveFloorColor} map={floorMap} roughness={0.8} />
      </mesh>

      {showGrid && (
        <Grid
          position={[0, 0.002, 0]}
          args={[30, 30]}
          cellSize={gridSize}
          cellThickness={1}
          cellColor="#64748b"
          sectionSize={gridSize * 4}
          sectionThickness={1.5}
          sectionColor="#475569"
          fadeDistance={30}
          fadeStrength={1.2}
        />
      )}

      {/* Ceiling is the exact room polygon (same Shape as the floor), extruded to wall
          thickness. The -90° X rotation maps the extrude direction onto world +Y, so the
          slab spans height..height+wallThickness sitting on top of the walls. */}
      <mesh position={[0, height, 0]} rotation={[-Math.PI / 2, 0, 0]} material={ceilingMat.material}>
        <extrudeGeometry args={[ceilingShape, { depth: wallThickness, bevelEnabled: false }]} />
      </mesh>

      {/* Ceiling light fixtures: 4 small recessed pot lights */}
      {lightFixtures.map((fixture) => (
        <group key={fixture.id}>
          {/* Flush dark trim ring */}
          <mesh position={[fixture.x, height - 0.01, fixture.z]} material={fixtureTrimMat.material}>
            <cylinderGeometry args={[0.09, 0.09, 0.015, 24]} />
          </mesh>
          {/* Glowing lens disc */}
          <mesh position={[fixture.x, height - 0.022, fixture.z]} material={fixtureLensMat.material}>
            <cylinderGeometry args={[0.065, 0.065, 0.01, 24]} />
          </mesh>
          {/* Soft warm recessed pointLight */}
          <pointLight
            position={[fixture.x, height - 0.12, fixture.z]}
            intensity={lightIntensity}
            distance={Math.max(height * 2.5, 6.5)}
            decay={2}
            color="#ffeedd"
          />
        </group>
      ))}

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
