import { useMemo } from 'react';
import type { RoomOpening, RoomVertex } from '../Data/RoomShape';
import { computeEdges } from './polygonGeometry';

interface Opening3DModelProps {
  opening: RoomOpening;
  vertices: RoomVertex[];
  wallHeight: number;
  wallThickness: number;
  isSelected?: boolean;
  onClick?: () => void;
}

export function Opening3DModel({
  opening,
  vertices,
  wallHeight,
  wallThickness,
  isSelected,
  onClick,
}: Opening3DModelProps) {
  const edges = useMemo(() => computeEdges(vertices), [vertices]);

  const edge = edges[opening.edgeIndex];
  if (!edge || opening.interiorWallId) return null;

  const { start, end } = edge;

  // Centre of the opening along the wall (offset is from wall start, centre = offset + width/2)
  const centerFraction = (opening.offset + opening.width / 2) / Math.max(0.01, edge.length);
  const cx = start.x + (end.x - start.x) * centerFraction;
  const cz = start.z + (end.z - start.z) * centerFraction;

  // Push it to the inner face of the wall so it sits flush
  const posX = cx - edge.normal.x * (wallThickness / 2);
  const posZ = cz - edge.normal.z * (wallThickness / 2);

  // Wall direction angle (so the opening faces along the wall)
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  const angle = Math.atan2(dx, dz);

  const isDoor = opening.kind === 'door';
  const width = opening.width;
  const openingHeight = isDoor ? 2.1 : 1.2;
  const posY = isDoor ? openingHeight / 2 : 1.0 + openingHeight / 2;
  const frameDepth = wallThickness + 0.06;

  // Colours
  const frameColor = isSelected ? '#6366f1' : isDoor ? '#92400e' : '#1e3a5f';
  const panelColor = isDoor ? (isSelected ? '#818cf8' : '#b45309') : '#93c5fd';

  return (
    <group
      position={[posX, posY, posZ]}
      rotation={[0, angle, 0]}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
    >
      {/* Large invisible click-catcher so user can always click it */}
      <mesh>
        <boxGeometry args={[width + 0.1, openingHeight + 0.1, frameDepth + 0.1]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {/* Frame */}
      {/* Top bar */}
      <mesh position={[0, openingHeight / 2 - 0.03, 0]} castShadow>
        <boxGeometry args={[width, 0.06, frameDepth]} />
        <meshStandardMaterial color={frameColor} roughness={0.4} metalness={0.1} />
      </mesh>
      {/* Bottom sill / threshold */}
      <mesh position={[0, -openingHeight / 2 + 0.03, 0]} castShadow>
        <boxGeometry args={[width, 0.06, frameDepth]} />
        <meshStandardMaterial color={frameColor} roughness={0.4} metalness={0.1} />
      </mesh>
      {/* Left jamb */}
      <mesh position={[-width / 2 + 0.03, 0, 0]} castShadow>
        <boxGeometry args={[0.06, openingHeight, frameDepth]} />
        <meshStandardMaterial color={frameColor} roughness={0.4} metalness={0.1} />
      </mesh>
      {/* Right jamb */}
      <mesh position={[width / 2 - 0.03, 0, 0]} castShadow>
        <boxGeometry args={[0.06, openingHeight, frameDepth]} />
        <meshStandardMaterial color={frameColor} roughness={0.4} metalness={0.1} />
      </mesh>

      {/* Panel / glass */}
      {isDoor ? (
        <mesh castShadow>
          <boxGeometry args={[width - 0.1, openingHeight - 0.1, 0.04]} />
          <meshStandardMaterial color={panelColor} roughness={0.5} />
        </mesh>
      ) : (
        <mesh>
          <boxGeometry args={[width - 0.1, openingHeight - 0.1, 0.015]} />
          <meshPhysicalMaterial
            color={panelColor}
            transparent
            opacity={0.45}
            roughness={0.05}
            metalness={0}
          />
        </mesh>
      )}

      {/* Selection glow outline */}
      {isSelected && (
        <mesh>
          <boxGeometry args={[width + 0.05, openingHeight + 0.05, frameDepth + 0.05]} />
          <meshBasicMaterial color="#6366f1" transparent opacity={0.22} depthWrite={false} />
        </mesh>
      )}

      {/* Door handle */}
      {isDoor && (
        <mesh position={[width / 2 - 0.12, 0, frameDepth / 2 + 0.015]} castShadow>
          <sphereGeometry args={[0.035, 12, 12]} />
          <meshStandardMaterial color="#f59e0b" metalness={0.9} roughness={0.1} />
        </mesh>
      )}
    </group>
  );
}
