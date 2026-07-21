import { furnitureCatalog, furnitureCategories } from '../../Data/FurnitureCatalog';
import { usePlannerStore } from '../../store/plannerStore';
import styles from './CatalogPanel.module.css';

export function CatalogPanel() {
  const addItem = usePlannerStore((state) => state.addItem);

  return (
    <aside className={styles.panel}>
      <h2 className={styles.title}>Furniture</h2>
      {furnitureCategories.map((category) => (
        <div key={category} className={styles.categoryGroup}>
          <h3 className={styles.categoryTitle}>{category}</h3>
          <div className={styles.itemGrid}>
            {furnitureCatalog
              .filter((item) => item.category === category)
              .map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={styles.itemButton}
                  onClick={() => addItem(item.id)}
                >
                  {item.name}
                </button>
              ))}
          </div>
        </div>
      ))}
    </aside>
  );
}
