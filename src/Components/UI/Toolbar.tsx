import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiCopy, FiMove, FiRotateCw, FiTrash2 } from 'react-icons/fi';
import { usePlannerStore } from '../../store/plannerStore';
import { RotationSlider } from './RotationSlider';
import styles from './Toolbar.module.css';

function normalizeDegrees(deg: number) {
  return (((deg % 360) + 540) % 360) - 180;
}

export function Toolbar() {
  const navigate = useNavigate();
  const selectedId = usePlannerStore((state) => state.selectedId);
  const selectedItem = usePlannerStore((state) => state.placedItems.find((item) => item.id === state.selectedId));
  const gizmoMode = usePlannerStore((state) => state.gizmoMode);
  const setGizmoMode = usePlannerStore((state) => state.setGizmoMode);
  const removeSelected = usePlannerStore((state) => state.removeSelected);
  const duplicateSelected = usePlannerStore((state) => state.duplicateSelected);
  const selectItem = usePlannerStore((state) => state.selectItem);
  const updateItemTransform = usePlannerStore((state) => state.updateItemTransform);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Delete' || event.key === 'Backspace') {
        removeSelected();
      } else if (event.key === 'Escape') {
        selectItem(null);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [removeSelected, selectItem]);

  return (
    <>
      <button type="button" className={styles.backButton} onClick={() => navigate('/')}>
        <FiArrowLeft />
        Back
      </button>

      {selectedId && selectedItem && (
        <div className={styles.floatingStack}>
          {gizmoMode === 'rotate' && (
            <RotationSlider
              degrees={normalizeDegrees((selectedItem.rotationY * 180) / Math.PI)}
              onChange={(deg) => updateItemTransform(selectedItem.id, selectedItem.position, (deg * Math.PI) / 180)}
            />
          )}

          <div className={styles.itemToolbar}>
            <button
              type="button"
              className={gizmoMode === 'translate' ? styles.itemButtonActive : styles.itemButton}
              onClick={() => setGizmoMode('translate')}
            >
              <FiMove />
              <span>Move</span>
            </button>
            <button
              type="button"
              className={gizmoMode === 'rotate' ? styles.itemButtonActive : styles.itemButton}
              onClick={() => setGizmoMode('rotate')}
            >
              <FiRotateCw />
              <span>Rotate</span>
            </button>

            <span className={styles.itemDivider} />

            <button type="button" className={styles.itemButton} onClick={() => duplicateSelected()}>
              <FiCopy />
              <span>Make copy</span>
            </button>

            <span className={styles.itemDivider} />

            <button type="button" className={styles.itemButtonDanger} onClick={() => removeSelected()}>
              <FiTrash2 />
              <span>Remove</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
