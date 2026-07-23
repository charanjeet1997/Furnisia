import { Scene } from '../Components/Scene';
import { Room } from '../Components/Room';
import { FurnitureModel } from '../Components/FurnitureModel';
import { CatalogPanel } from '../Components/UI/CatalogPanel';
import { Toolbar } from '../Components/UI/Toolbar';
import { usePlannerStore } from '../store/plannerStore';
import styles from './Planner.module.css';

// Unlike every other screen, the Planner has no Header/Footer chrome — the 3D canvas gets
// the full viewport, with just floating back/save/theme controls over it (see Toolbar).
export function Planner() {
  const placedItems = usePlannerStore((state) => state.placedItems);

  return (
    <div className={styles.layout}>
      <div className={styles.canvasArea}>
        <Toolbar />
        <Scene>
          <Room />
          {placedItems.map((item) => (
            <FurnitureModel key={item.id} item={item} />
          ))}
        </Scene>
      </div>
      <CatalogPanel />
    </div>
  );
}
