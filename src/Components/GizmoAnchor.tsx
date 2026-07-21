import { TransformControls } from '@react-three/drei';
import { useEffect, useState } from 'react';
import { MathUtils, type Group } from 'three';
import { useThree } from '@react-three/fiber';
import { usePlannerStore, type PlacedItem } from '../store/plannerStore';

export const GIZMO_SIZE = 0.75;

interface GizmoAnchorProps {
  item: PlacedItem;
  /** The furniture mesh group — its XZ position is kept in sync while dragging. */
  groupNode: Group;
  /** Half the model's bounding-box height, so the gizmo sits at furniture mid-height. */
  halfHeight: number;
  /** XZ clamp limits derived from room size and model footprint. */
  maxX: number;
  maxZ: number;
}

/**
 * Renders a TransformControls gizmo elevated to mid-furniture height so
 * the X/Z arrows are clearly visible from the top-down camera angle.
 *
 * How it works:
 *  - An internal `anchorNode` Group sits at [itemX, halfHeight, itemZ].
 *  - TransformControls moves the anchorNode; onObjectChange clamps the
 *    anchor and copies its XZ back to the floor-level groupNode.
 *  - A useEffect syncs the anchor's initial position whenever the item
 *    moves externally (e.g. duplicate, room change).
 *  - A second useEffect attaches Three.js's native 'dragging-changed' event
 *    to freeze OrbitControls during drags (drei's JSX props don't expose this
 *    event reliably across versions).
 */
export function GizmoAnchor({ item, groupNode, halfHeight, maxX, maxZ }: GizmoAnchorProps) {
  // State-backed ref: mounting anchorNode triggers a re-render so
  // TransformControls can attach to it on the very same pass.
  const [anchorNode, setAnchorNode] = useState<Group | null>(null);
  const [tcNode, setTcNode] = useState<{
    addEventListener: Function;
    removeEventListener: Function;
  } | null>(null);

  const updateItemTransform = usePlannerStore((s) => s.updateItemTransform);
  const { controls } = useThree();

  // Keep anchor position in sync when the item moves from outside this component
  // (e.g. initial placement, duplication). During active drags, onObjectChange
  // handles the sync directly so this effect is intentionally skipped mid-drag.
  const [px, , pz] = item.position;
  useEffect(() => {
    if (!anchorNode) return;
    anchorNode.position.set(px, halfHeight, pz);
  }, [anchorNode, px, pz, halfHeight]);

  // Freeze OrbitControls while the gizmo is being dragged so the two
  // don't compete for the same pointer events.
  useEffect(() => {
    if (!tcNode || !controls) return;
    const orbit = controls as unknown as { enabled: boolean };
    const onDrag = (e: { value: boolean }) => { orbit.enabled = !e.value; };
    tcNode.addEventListener('dragging-changed', onDrag);
    return () => {
      tcNode.removeEventListener('dragging-changed', onDrag);
      orbit.enabled = true; // always re-enable if this unmounts mid-drag
    };
  }, [tcNode, controls]);

  return (
    <>
      {/* Invisible anchor group — this is what TransformControls actually moves. */}
      <group ref={setAnchorNode} />

      {anchorNode && (
        <TransformControls
          ref={setTcNode as any}
          object={anchorNode}
          mode="translate"
          size={GIZMO_SIZE}
          onObjectChange={() => {
            // Clamp XZ; lock Y to halfHeight so the anchor stays at furniture mid-height.
            anchorNode.position.x = MathUtils.clamp(anchorNode.position.x, -maxX, maxX);
            anchorNode.position.y = halfHeight;
            anchorNode.position.z = MathUtils.clamp(anchorNode.position.z, -maxZ, maxZ);

            // Mirror XZ back onto the floor-level furniture group.
            groupNode.position.x = anchorNode.position.x;
            groupNode.position.z = anchorNode.position.z;

            updateItemTransform(
              item.id,
              [anchorNode.position.x, 0, anchorNode.position.z],
              groupNode.rotation.y,
            );
          }}
        />
      )}
    </>
  );
}
