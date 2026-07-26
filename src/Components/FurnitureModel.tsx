import { useGLTF } from '@react-three/drei';
import { useMemo, useState } from 'react';
import { Box3, Vector3, type Group, type Mesh } from 'three';
import { usePlannerStore, type PlacedItem } from '../store/plannerStore';
import { furnitureCatalog } from '../Data/FurnitureCatalog';
import { GizmoAnchor } from './GizmoAnchor';
import { boundingBox } from './polygonGeometry';


interface FurnitureModelProps {
  item: PlacedItem;
}

export function FurnitureModel({ item }: FurnitureModelProps) {
  const catalogEntry = furnitureCatalog.find((entry) => entry.id === item.catalogId);
  const { scene } = useGLTF(catalogEntry?.modelPath ?? '');

  // State-backed ref: mounting groupNode triggers a re-render so GizmoAnchor
  // receives a non-null groupNode on the same pass it mounts.
  const [groupNode, setGroupNode] = useState<Group | null>(null);

  const selectItem = usePlannerStore((s) => s.selectItem);
  const isSelected = usePlannerStore((s) => s.selectedId === item.id);
  const gizmoMode  = usePlannerStore((s) => s.gizmoMode);
  const room       = usePlannerStore((s) => s.room);

  // Kenney models don't pivot at their geometric centre. Offset the mesh inside
  // a pivot group so the group origin is at the model's true XZ centre, floor level.
  const { pivoted, halfWidth, halfDepth, halfHeight } = useMemo(() => {
    const clone = scene.clone();
    clone.traverse((child) => {
      if ((child as Mesh).isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    const box = new Box3().setFromObject(clone);
    const center = new Vector3();
    box.getCenter(center);
    clone.position.set(-center.x, -box.min.y, -center.z);
    return {
      pivoted:    clone,
      halfWidth:  (box.max.x - box.min.x) / 2,
      halfDepth:  (box.max.z - box.min.z) / 2,
      halfHeight: (box.max.y - box.min.y) / 2,
    };
  }, [scene]);

  if (!catalogEntry) return null;

  // Room shapes can be non-rectangular; furniture clamps to the shape's axis-aligned
  // bounding box using the wall's inner face inset (half thickness + 5cm buffer).
  const wallThickness = room.wallThickness ?? 0.1;
  const wallMargin = wallThickness / 2 + 0.05;
  const bbox = boundingBox(room.vertices);
  const roomWidth = bbox.maxX - bbox.minX;
  const roomDepth = bbox.maxZ - bbox.minZ;
  const maxX = Math.max(0, roomWidth / 2 - halfWidth - wallMargin);
  const maxZ = Math.max(0, roomDepth / 2 - halfDepth - wallMargin);

  return (
    <>
      <group
        ref={setGroupNode}
        position={item.position}
        rotation={[0, item.rotationY, 0]}
        onClick={(e) => { e.stopPropagation(); selectItem(item.id); }}
      >
        <primitive object={pivoted} />
      </group>

      {isSelected && groupNode && gizmoMode === 'translate' && (
        <GizmoAnchor
          item={item}
          groupNode={groupNode}
          halfHeight={halfHeight}
          maxX={maxX}
          maxZ={maxZ}
        />
      )}
    </>
  );
}

furnitureCatalog.forEach((entry) => useGLTF.preload(entry.modelPath));
