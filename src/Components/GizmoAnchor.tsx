import { useEffect, useRef, type RefObject } from 'react';
import { PivotControls } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { MathUtils, type Group } from 'three';
import { usePlannerStore, type PlacedItem } from '../store/plannerStore';

export const GIZMO_SIZE = 0.75;

interface GizmoAnchorProps {
  item: PlacedItem;
  /** The furniture mesh group — its XZ position is kept in sync while dragging. */
  groupNode: Group;
  /** Optional ref to sync anchor group position directly during direct dragging */
  gizmoGroupRef?: RefObject<Group | null>;
  /** Half the model's bounding-box height. */
  halfHeight: number;
  /** XZ clamp limits derived from room size and model footprint. */
  maxX: number;
  maxZ: number;
}

export function GizmoAnchor({ item, groupNode, gizmoGroupRef, maxX, maxZ }: GizmoAnchorProps) {
  const updateItemTransform = usePlannerStore((s) => s.updateItemTransform);
  const showGrid = usePlannerStore((s) => s.showGrid);
  const gridSize = usePlannerStore((s) => s.gridSize);
  const snapToGrid = usePlannerStore((s) => s.snapToGrid);
  const { controls } = useThree();

  const internalGroupRef = useRef<Group>(null);
  const anchorGroupRef = gizmoGroupRef || internalGroupRef;
  const lastPosRef = useRef<[number, number]>([item.position[0], item.position[2]]);

  useEffect(() => {
    if (anchorGroupRef.current) {
      anchorGroupRef.current.position.x = item.position[0];
      anchorGroupRef.current.position.z = item.position[2];
    }
  }, [item.position, anchorGroupRef]);

  return (
    <group ref={anchorGroupRef as RefObject<Group>} position={[item.position[0], 0.02, item.position[2]]} rotation={[0, item.rotationY, 0]}>
      <PivotControls
        scale={0.75}
        depthTest={false}
        lineWidth={3.5}
        axisColors={['#ef4444', '#10b981', '#3b82f6']}
        activeAxes={[true, false, true]}
        disableRotations
        disableSliders={false}
        annotations={false}
        autoTransform={false}
        onDragStart={() => {
          if (controls) (controls as any).enabled = false;
          lastPosRef.current = [item.position[0], item.position[2]];
        }}
        onDragEnd={() => {
          if (controls) (controls as any).enabled = true;
          const [finalX, finalZ] = lastPosRef.current;
          updateItemTransform(item.id, [finalX, 0, finalZ], item.rotationY);
        }}
        onDrag={(_l, _deltaL, w) => {
          if (!w || !w.elements) return;
          let x = w.elements[12];
          let z = w.elements[14];

          if (showGrid && snapToGrid && gridSize > 0) {
            x = Math.round(x / gridSize) * gridSize;
            z = Math.round(z / gridSize) * gridSize;
          }

          x = MathUtils.clamp(x, -maxX, maxX);
          z = MathUtils.clamp(z, -maxZ, maxZ);

          groupNode.position.x = x;
          groupNode.position.z = z;
          if (anchorGroupRef.current) {
            anchorGroupRef.current.position.x = x;
            anchorGroupRef.current.position.z = z;
          }
          lastPosRef.current = [x, z];
        }}
      />
    </group>
  );
}
