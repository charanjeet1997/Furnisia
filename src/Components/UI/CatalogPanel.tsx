import { useState } from 'react';
import { FiChevronDown, FiChevronUp, FiPlus, FiX } from 'react-icons/fi';
import { furnitureCatalog, furnitureCategories, type FurnitureCategory } from '../../Data/FurnitureCatalog';
import { usePlannerStore } from '../../store/plannerStore';
import { useDeviceType } from '../../hooks/useDeviceType';
import { CategoryIcon } from './CategoryIcon';
import styles from './CatalogPanel.module.css';

const ALL = 'All' as const;
type ChipFilter = FurnitureCategory | typeof ALL;
const chipFilters: ChipFilter[] = [ALL, ...furnitureCategories];

type CellSize = 'sm' | 'md' | 'lg';
const CELL_SIZES: { key: CellSize; label: string; cols: number }[] = [
  { key: 'sm', label: 'Compact', cols: 3 },
  { key: 'md', label: 'Comfortable', cols: 2 },
  { key: 'lg', label: 'Large', cols: 1 },
];
const gridClassBySize: Record<CellSize, string | undefined> = { sm: 'itemGridSm', md: undefined, lg: 'itemGridLg' };

export function CatalogPanel() {
  const addItem = usePlannerStore((state) => state.addItem);
  const { isPhone, isTablet } = useDeviceType();
  const isMobileDevice = isPhone || isTablet;
  // Only affects layout below the mobile breakpoint (see .panel media query) — on desktop
  // the panel is always the docked sidebar regardless of this state.
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<ChipFilter>(ALL);
  const [cellSize, setCellSize] = useState<CellSize>('md');
  const items = filter === ALL ? furnitureCatalog : furnitureCatalog.filter((item) => item.category === filter);
  const gridSizeClass = gridClassBySize[cellSize];
  const itemGridClassName = gridSizeClass ? `${styles.itemGrid} ${styles[gridSizeClass]}` : styles.itemGrid;

  return (
    <>
      {isMobileDevice && !open && (
        <button
          type="button"
          className={styles.mobileFabButton}
          onClick={() => setOpen(true)}
          title="Add Furniture"
          aria-label="Add Furniture"
        >
          <FiPlus size={28} />
        </button>
      )}

      <aside className={open ? `${styles.panel} ${styles.panelOpen}` : styles.panel}>
        <button type="button" className={styles.sheetHandle} onClick={() => setOpen((o) => !o)}>
          <span className={styles.title}>
            Furniture <span className={styles.titleCategory}>· {filter}</span>
          </span>
          {open ? <FiX size={20} /> : <FiChevronUp />}
        </button>

      <div className={styles.categoryChips}>
        {chipFilters.map((cat) => (
          <button
            key={cat}
            type="button"
            className={cat === filter ? styles.chipActive : styles.chip}
            onClick={() => setFilter(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className={styles.sizeToggle}>
        {CELL_SIZES.map((s) => (
          <button
            key={s.key}
            type="button"
            className={cellSize === s.key ? styles.sizeButtonActive : styles.sizeButton}
            onClick={() => setCellSize(s.key)}
            aria-label={`${s.label} cell size`}
            title={s.label}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4} aria-hidden="true">
              {Array.from({ length: s.cols }, (_, i) => {
                const w = 14 / s.cols - 1;
                return <rect key={i} x={1 + i * (w + 1)} y={4} width={w} height={8} rx={1} />;
              })}
            </svg>
          </button>
        ))}
      </div>

      <div className={itemGridClassName}>
        {items.map((item) => (
          <button key={item.id} type="button" className={styles.itemButton} onClick={() => addItem(item.id)}>
            {/* Full-width thumbnail slot, sized so a real product image can drop in later
                without any layout change — icon is just a placeholder until then. */}
            <span className={styles.itemThumb}>
              <CategoryIcon category={item.category} size={32} />
            </span>
            <span className={styles.itemLabel}>{item.name}</span>
          </button>
        ))}
      </div>
    </aside>
  </>
);
}
