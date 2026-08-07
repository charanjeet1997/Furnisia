import { Scene } from '../Components/Scene';
import { TextureLoadingBar } from '../Components/TextureLoadingBar';
import { Room } from '../Components/Room';
import { FurnitureModel } from '../Components/FurnitureModel';
import { CatalogPanel } from '../Components/UI/CatalogPanel';
import { Toolbar } from '../Components/UI/Toolbar';
import { DownloadProgressHUD } from '../Components/UI/DownloadProgressHUD';
import { SpotlightTour, type TourStep } from '../Components/UI/SpotlightTour';
import { usePlannerStore } from '../store/plannerStore';
import styles from './Planner.module.css';

const PLANNER_STEPS: TourStep[] = [
  {
    targetId: 'tour-plan-save',
    icon: '☁️',
    title: 'Cloud Save Room',
    description: 'Save your 3D layout updates directly to the cloud. Overwrites existing saved rooms without creating duplicates, showing live last-saved timestamps.',
  },
  {
    targetId: 'tour-plan-edit',
    icon: '✏️',
    title: 'Edit Room Walls & Shape',
    description: 'Return to the parametric Room Builder to alter wall dimensions, per-wall thickness, ceiling height, doors, windows, and finishes.',
  },
  {
    targetId: 'tour-plan-vr',
    icon: '🥽',
    title: '1:1 Scale VR Mode',
    description: 'Step into your room layout at true 1:1 scale with WebXR VR and 360° FPS walk controls.',
  },
  {
    targetId: 'tour-plan-grid',
    icon: '🌐',
    title: 'Floor Grid & Snap Settings',
    description: 'Toggle the 3D floor grid, choose snap presets (25cm, 50cm, 1m, 2m), and enable/disable snap-to-grid alignment.',
  },
  {
    targetId: 'tour-plan-light',
    icon: '💡',
    title: 'Ceiling Light Intensity',
    description: 'Click the Lightbulb icon to adjust ceiling light brightness (0% to 100%) to preview night vs day ambient lighting.',
  },
  {
    targetId: 'tour-theme-toggle',
    icon: '🌙',
    title: 'Dark / Light Theme Toggle',
    description: 'Switch between sleek Dark Glass mode and clean Light Mode across all screens.',
  },
  {
    targetId: 'tour-plan-catalog',
    icon: '🛋️',
    title: 'Furniture Catalog Drawer',
    description: 'Browse categorised 3D furniture models. Click items to add them into your room, then select placed items to reveal Unity-style gizmos!',
  },
];

const FURNITURE_STEPS: TourStep[] = [
  {
    targetId: 'tour-furn-move',
    icon: '📦',
    title: 'Move & Translate Handle',
    description: 'Use the Move tool to display 3D floor gizmo handles. Drag the Red/Blue arrows for single-axis movement or the corner square for 2D free dragging.',
  },
  {
    targetId: 'tour-furn-rotate',
    icon: '🔄',
    title: 'Precision Rotation Dial',
    description: 'Click Rotate to reveal the rotation slider. Drag to spin furniture seamlessly from 0° to 360°.',
  },
  {
    targetId: 'tour-furn-copy',
    icon: '📋',
    title: 'Duplicate Furniture',
    description: 'Click the Copy button to create an instant duplicate of the selected furniture piece with the same orientation.',
  },
  {
    targetId: 'tour-furn-delete',
    icon: '🗑️',
    title: 'Delete Furniture',
    description: 'Click the Trash button to remove the selected furniture item from your room layout.',
  },
];

// Unlike every other screen, the Planner has no Header/Footer chrome — the 3D canvas gets
// the full viewport, with just floating back/save/theme controls over it (see Toolbar).
export function Planner() {
  const placedItems = usePlannerStore((state) => state.placedItems);
  const selectedId = usePlannerStore((state) => state.selectedId);

  return (
    <div className={styles.layout}>
      <DownloadProgressHUD />
      <div className={styles.canvasArea}>
        <Toolbar />
        <Scene>
          <Room />
          {placedItems.map((item) => (
            <FurnitureModel key={item.id} item={item} />
          ))}
        </Scene>
        <TextureLoadingBar />
      </div>
      <CatalogPanel />

      <SpotlightTour tourKey="planner" steps={PLANNER_STEPS} />
      {selectedId && <SpotlightTour tourKey="furniture_tools" steps={FURNITURE_STEPS} />}
    </div>
  );
}
