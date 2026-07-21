import { TransformControls, useGLTF } from '@react-three/drei';
import { useEffect, useMemo, useState } from 'react';
import { Box3, MathUtils, Vector3, type Group, type Mesh } from 'three';
import { useThree } from '@react-three/fiber';
import { usePlannerStore, type PlacedItem } from '../store/plannerStore';
import { furnitureCatalog } from '../Data/FurnitureCatalog';

const WALL_MARGIN = 0.05;
const GIZMO_SIZE  = 0.9;

interface FurnitureModelProps {
  item: PlacedItem;
}

export function FurnitureModel({ item }: FurnitureModelProps) {
  const catalogEntry = furnitureCatalog.find((entry) => entry.id === item.catalogId);
  const { scene } = useGLTF(catalogEntry?.modelPath ?? '');

  // State-backed refs: mounting either node triggers a re-render so downstream
  // logic (gizmo attachment, event wiring) picks up the populated ref on the same pass.
  const [groupNode,  setGroupNode]  = useState<Group | null>(null);
  // gizmoAnchor is a separate group elevated to mid-furniture height so the
  // XZ arrows face the camera instead of lying flat on the floor.
  const [gizmoAnchor, setGizmoAnchor] = useState<Group | null>(null);
  const [tcNode, setTcNode] = useState<{ addEventListener: Function; removeEventListener: Function } | null>(null);

  const selectItem         = usePlannerStore((s) => s.selectItem);
  const isSelected         = usePlannerStore((s) => s.selectedId === item.id);
  const gizmoMode          = usePlannerStore((s) => s.gizmoMode);
  const updateItemTransform = usePlannerStore((s) => s.updateItemTransform);
  const room               = usePlannerStore((s) => s.room);
  const { controls }       = useThree();

  // Disable OrbitControls while the gizmo is being dragged using Three.js's
  // native 'dragging-changed' event (drei's JSX props don't expose this in all versions).
  useEffect(() => {
    if (!tcNode || !controls) return;
    const orbit = controls as unknown as { enabled: boolean };
    const onDrag = (e: { value: boolean }) => { orbit.enabled = !e.value; };
    tcNode.addEventListener('dragging-changed', onDrag);
    return () => {
      tcNode.removeEventListener('dragging-changed', onDrag);
      orbit.enabled = true; // re-enable if gizmo unmounts mid-drag
    };
  }, [tcNode, controls]);

  // Kenney models don't pivot at their geometric centre. Offset the mesh inside a
  // pivot group so the group origin is at the model's true XZ centre, floor level.
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

  const maxX = Math.max(0, room.width  / 2 - halfWidth  - WALL_MARGIN);
  const maxZ = Math.max(0, room.length / 2 - halfDepth  - WALL_MARGIN);

  return (
    <>
      {/* Furniture mesh — origin at floor / XZ centre */}
      <group
        ref={setGroupNode}
        position={item.position}
        rotation={[0, item.rotationY, 0]}
        onClick={(e) => { e.stopPropagation(); selectItem(item.id); }}
      >
        <primitive object={pivoted} />
      </group>

      {/* Elevated anchor: same XZ position but raised to mid-furniture height
          so the TransformControls arrows are clearly visible from above. */}
      {isSelected && (
        <group
          ref={setGizmoAnchor}
          position={[item.position[0], halfHeight, item.position[2]]}
        />
      )}

      {isSelected && gizmoAnchor && gizmoMode === 'translate' && (
        <TransformControls
          ref={setTcNode as any}
          object={gizmoAnchor}
          mode="translate"
          size={GIZMO_SIZE}
          showY={false}
          onObjectChange={() => {
            // Clamp the anchor XZ; sync Y=0 position back to the floor-level group.
            gizmoAnchor.position.x = MathUtils.clamp(gizmoAnchor.position.x, -maxX, maxX);
            gizmoAnchor.position.z = MathUtils.clamp(gizmoAnchor.position.z, -maxZ, maxZ);
            // Keep the furniture mesh in sync with the gizmo anchor.
            if (groupNode) {
              groupNode.position.x = gizmoAnchor.position.x;
              groupNode.position.z = gizmoAnchor.position.z;
            }
            updateItemTransform(
              item.id,
              [gizmoAnchor.position.x, 0, gizmoAnchor.position.z],
              item.rotationY,
            );
          }}
        />
      )}
    </>
  );
}

furnitureCatalog.forEach((entry) => useGLTF.preload(entry.modelPath));
