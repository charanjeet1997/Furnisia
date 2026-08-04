import { Component, type ReactNode, Suspense, useMemo, useState } from 'react';
import { useGLTF, Html, useProgress } from '@react-three/drei';
import { Box3, Vector3, type Group, type Mesh } from 'three';
import { usePlannerStore, type PlacedItem } from '../store/plannerStore';
import { furnitureCatalog } from '../Data/FurnitureCatalog';
import { GizmoAnchor } from './GizmoAnchor';
import { boundingBox } from './polygonGeometry';

interface FurnitureModelProps {
  item: PlacedItem;
}

interface ModelErrorBoundaryProps {
  fallback: ReactNode;
  children: ReactNode;
}

interface ModelErrorBoundaryState {
  hasError: boolean;
}

class ModelErrorBoundary extends Component<ModelErrorBoundaryProps, ModelErrorBoundaryState> {
  public state: ModelErrorBoundaryState = { hasError: false };

  public static getDerivedStateFromError(): ModelErrorBoundaryState {
    return { hasError: true };
  }

  public componentDidCatch(error: Error) {
    console.warn('3D model load failed:', error);
  }

  public render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

function FallbackFurnitureBox({ item }: { item: PlacedItem }) {
  const selectItem = usePlannerStore((s) => s.selectItem);
  const isSelected = usePlannerStore((s) => s.selectedId === item.id);
  const gizmoMode = usePlannerStore((s) => s.gizmoMode);
  const room = usePlannerStore((s) => s.room);
  const [groupNode, setGroupNode] = useState<Group | null>(null);

  const halfWidth = 0.4;
  const halfDepth = 0.4;
  const halfHeight = 0.4;

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
        onPointerDown={(e) => {
          e.stopPropagation();
          selectItem(item.id);
        }}
        onClick={(e) => {
          e.stopPropagation();
          selectItem(item.id);
        }}
      >
        <mesh position={[0, 0.4, 0]}>
          <boxGeometry args={[0.8, 0.8, 0.8]} />
          <meshStandardMaterial color="#f87171" wireframe transparent opacity={0.65} />
        </mesh>
        <Html position={[0, 0.9, 0]} center distanceFactor={10}>
          <div
            style={{
              background: 'rgba(239, 68, 68, 0.95)',
              color: '#ffffff',
              padding: '4px 8px',
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: 600,
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
              boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
            }}
          >
            ⚠️ GLB Load Failed (CORS / Invalid Direct URL)
          </div>
        </Html>
      </group>

      {isSelected && groupNode && gizmoMode === 'translate' && (
        <GizmoAnchor item={item} groupNode={groupNode} halfHeight={halfHeight} maxX={maxX} maxZ={maxZ} />
      )}
    </>
  );
}

function FurnitureModelContent({ item }: FurnitureModelProps) {
  const catalogEntry = furnitureCatalog.find((entry) => entry.id === item.catalogId);
  const modelPath = item.customModelUrl || catalogEntry?.modelPath || '';
  const { scene } = useGLTF(modelPath);

  const [groupNode, setGroupNode] = useState<Group | null>(null);

  const selectItem = usePlannerStore((s) => s.selectItem);
  const isSelected = usePlannerStore((s) => s.selectedId === item.id);
  const gizmoMode = usePlannerStore((s) => s.gizmoMode);
  const room = usePlannerStore((s) => s.room);

  const userScale = item.scale ?? 1;

  const { pivoted, halfWidth, halfDepth, halfHeight } = useMemo(() => {
    const clone = scene.clone();
    clone.traverse((child) => {
      if ((child as Mesh).isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    // 1. Measure raw bounding box before scale normalization
    let rawBox = new Box3().setFromObject(clone);
    const size = new Vector3();
    rawBox.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);

    // 2. Auto-scale oversized (e.g. Sketchfab cm exports 100m wide) or tiny models to ~1.2m realistic furniture scale
    if (maxDim > 2.5 || maxDim < 0.2) {
      const autoScale = 1.2 / Math.max(0.001, maxDim);
      clone.scale.setScalar(autoScale);
    }

    // 3. Apply user custom scale multiplier
    if (userScale !== 1) {
      clone.scale.multiplyScalar(userScale);
    }

    // 4. Recompute box & center to pivot correctly at geometric center floor level
    let box = new Box3().setFromObject(clone);
    const center = new Vector3();
    box.getCenter(center);
    clone.position.set(-center.x, -box.min.y, -center.z);

    return {
      pivoted: clone,
      halfWidth: Math.max(0.15, (box.max.x - box.min.x) / 2),
      halfDepth: Math.max(0.15, (box.max.z - box.min.z) / 2),
      halfHeight: Math.max(0.15, (box.max.y - box.min.y) / 2),
    };
  }, [scene, userScale]);

  if (!catalogEntry && !item.customModelUrl) return null;

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
        onPointerDown={(e) => {
          e.stopPropagation();
          selectItem(item.id);
        }}
        onClick={(e) => {
          e.stopPropagation();
          selectItem(item.id);
        }}
      >
        {/* Invisible raycast hit-mesh ensuring 100% reliable click/pointer selection for 3D GLTF models */}
        <mesh
          position={[0, halfHeight, 0]}
          onPointerDown={(e) => {
            e.stopPropagation();
            selectItem(item.id);
          }}
          onClick={(e) => {
            e.stopPropagation();
            selectItem(item.id);
          }}
        >
          <boxGeometry args={[Math.max(0.4, halfWidth * 2.1), Math.max(0.4, halfHeight * 2.1), Math.max(0.4, halfDepth * 2.1)]} />
          <meshBasicMaterial visible={false} />
        </mesh>

        <primitive object={pivoted} />

        {/* Selected Item Bounding Box Highlight */}
        {isSelected && (
          <group position={[0, halfHeight, 0]}>
            <mesh>
              <boxGeometry args={[halfWidth * 2 + 0.08, halfHeight * 2 + 0.08, halfDepth * 2 + 0.08]} />
              <meshBasicMaterial color="#10b981" wireframe transparent opacity={0.65} />
            </mesh>
          </group>
        )}
      </group>

      {isSelected && groupNode && gizmoMode === 'translate' && (
        <GizmoAnchor item={item} groupNode={groupNode} halfHeight={halfHeight} maxX={maxX} maxZ={maxZ} />
      )}
    </>
  );
}

function FallbackLoadingBox({ item }: { item: PlacedItem }) {
  const { progress } = useProgress();
  const displayName = item.customName || '3D Model';
  const pct = Math.round(progress);

  return (
    <group position={item.position} rotation={[0, item.rotationY, 0]}>
      <mesh position={[0, 0.4, 0]}>
        <boxGeometry args={[0.7, 0.7, 0.7]} />
        <meshStandardMaterial color="#6366f1" wireframe transparent opacity={0.5} />
      </mesh>
      <Html position={[0, 0.9, 0]} center distanceFactor={10}>
        <div
          style={{
            background: 'rgba(15, 23, 42, 0.92)',
            border: '1px solid rgba(99, 102, 241, 0.5)',
            color: '#ffffff',
            padding: '6px 10px',
            borderRadius: '8px',
            fontSize: '11px',
            fontWeight: 600,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '4px',
            whiteSpace: 'nowrap',
            boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
            backdropFilter: 'blur(8px)',
            pointerEvents: 'none',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '12px' }}>⏳</span>
            <span>Downloading {displayName}…</span>
            <span style={{ color: '#818cf8', fontWeight: 700, fontFamily: 'monospace' }}>{pct}%</span>
          </div>
          <div
            style={{
              width: '120px',
              height: '4px',
              background: 'rgba(255, 255, 255, 0.2)',
              borderRadius: '2px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${Math.max(5, pct)}%`,
                height: '100%',
                background: 'linear-gradient(90deg, #6366f1, #818cf8)',
                transition: 'width 0.15s ease',
              }}
            />
          </div>
        </div>
      </Html>
    </group>
  );
}

export function FurnitureModel({ item }: FurnitureModelProps) {
  return (
    <ModelErrorBoundary fallback={<FallbackFurnitureBox item={item} />}>
      <Suspense fallback={<FallbackLoadingBox item={item} />}>
        <FurnitureModelContent item={item} />
      </Suspense>
    </ModelErrorBoundary>
  );
}

furnitureCatalog.forEach((entry) => useGLTF.preload(entry.modelPath));
