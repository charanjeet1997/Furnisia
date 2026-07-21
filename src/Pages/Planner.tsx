import { Scene } from '../Components/Scene';
import { Room } from '../Components/Room';
import { FurnitureModel } from '../Components/FurnitureModel';
import { CatalogPanel } from '../Components/UI/CatalogPanel';
import { Toolbar } from '../Components/UI/Toolbar';
import { usePlannerStore } from '../store/plannerStore';
import styles from './Planner.module.css';

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
