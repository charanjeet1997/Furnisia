import { TransformControls, useGLTF } from '@react-three/drei';
import { useMemo, useState } from 'react';
import { Box3, MathUtils, Vector3, type Group, type Mesh } from 'three';
import { usePlannerStore, type PlacedItem } from '../store/plannerStore';
import { furnitureCatalog } from '../Data/FurnitureCatalog';

const WALL_MARGIN = 0.05;

interface FurnitureModelProps {
  item: PlacedItem;
}

export function FurnitureModel({ item }: FurnitureModelProps) {
  const catalogEntry = furnitureCatalog.find((entry) => entry.id === item.catalogId);
  const { scene } = useGLTF(catalogEntry?.modelPath ?? '');
  // A state-backed ref (not useRef): mounting the group must trigger a re-render so a
  // brand-new, already-selected item attaches its gizmo on the same pass instead of
  // needing a later selection change to pick up the now-populated ref.
  const [groupNode, setGroupNode] = useState<Group | null>(null);
  const selectItem = usePlannerStore((state) => state.selectItem);
  const isSelected = usePlannerStore((state) => state.selectedId === item.id);
  const gizmoMode = usePlannerStore((state) => state.gizmoMode);
  const updateItemTransform = usePlannerStore((state) => state.updateItemTransform);
  const room = usePlannerStore((state) => state.room);

  // Kenney models don't pivot at their own geometric center, which throws off both
  // rotation (spins around a corner) and bounds clamping. Fix it once here: offset the
  // mesh inside a pivot group so the group's own origin sits at the model's true X/Z
  // center and its floor-touching base (Y), then everything downstream (rotation,
  // clamping) can treat that origin as the object's actual center.
  const { pivoted, halfWidth, halfDepth } = useMemo(() => {
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
      pivoted: clone,
      halfWidth: (box.max.x - box.min.x) / 2,
      halfDepth: (box.max.z - box.min.z) / 2,
    };
  }, [scene]);

  if (!catalogEntry) return null;

  const maxX = Math.max(0, room.width / 2 - halfWidth - WALL_MARGIN);
  const maxZ = Math.max(0, room.length / 2 - halfDepth - WALL_MARGIN);

  return (
    <>
      <group
        ref={setGroupNode}
        position={item.position}
        rotation={[0, item.rotationY, 0]}
        onClick={(event) => {
          event.stopPropagation();
          selectItem(item.id);
        }}
      >
        <primitive object={pivoted} />
      </group>
      {isSelected && groupNode && gizmoMode === 'translate' && (
        <TransformControls
          object={groupNode}
          mode="translate"
          showY={false}
          onObjectChange={() => {
            groupNode.position.x = MathUtils.clamp(groupNode.position.x, -maxX, maxX);
            groupNode.position.z = MathUtils.clamp(groupNode.position.z, -maxZ, maxZ);
            updateItemTransform(item.id, [groupNode.position.x, groupNode.position.y, groupNode.position.z], groupNode.rotation.y);
          }}
        />
      )}
    </>
  );
}

furnitureCatalog.forEach((entry) => useGLTF.preload(entry.modelPath));
