import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiCopy, FiEdit2, FiMove, FiRotateCw, FiSave, FiTrash2 } from 'react-icons/fi';
import { usePlannerStore } from '../../store/plannerStore';
import { useAuth } from '../../store/AuthContext';
import { newRoomId, saveRoom } from '../../store/rooms';
import { RotationSlider } from './RotationSlider';
import { ThemeToggle } from './ThemeToggle';
import styles from './Toolbar.module.css';

function normalizeDegrees(deg: number) {
  return (((deg % 360) + 540) % 360) - 180;
}

export function Toolbar() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const room = usePlannerStore((state) => state.room);
  const placedItems = usePlannerStore((state) => state.placedItems);
  const selectedId = usePlannerStore((state) => state.selectedId);
  const selectedItem = usePlannerStore((state) => state.placedItems.find((item) => item.id === state.selectedId));
  const gizmoMode = usePlannerStore((state) => state.gizmoMode);
  const setGizmoMode = usePlannerStore((state) => state.setGizmoMode);
  const removeSelected = usePlannerStore((state) => state.removeSelected);
  const duplicateSelected = usePlannerStore((state) => state.duplicateSelected);
  const selectItem = usePlannerStore((state) => state.selectItem);
  const updateItemTransform = usePlannerStore((state) => state.updateItemTransform);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  function handleEditRoom() {
    // Skips straight to the Dimensions (wall-editing) step — the room's shape already exists
    // (it's the one currently loaded in the scene), so re-picking a shape template isn't the
    // point of this button. "Go back" from there returns to the Planner instead of stepping
    // back to shape-picking.
    navigate('/room-builder', { state: { initialRoom: room, initialStep: 1, returnTo: '/planner' } });
  }

  async function handleSave() {
    if (!user) {
      navigate('/login');
      return;
    }
    const name = window.prompt('Name this room', room.name || 'My Room');
    if (!name) return;
    setSaveStatus('saving');
    try {
      await saveRoom(user.uid, newRoomId(user.uid), { name, room, placedItems });
      setSaveStatus('saved');
    } catch {
      setSaveStatus('error');
    } finally {
      setTimeout(() => setSaveStatus('idle'), 2000);
    }
  }

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
      <div className={styles.topLeftStack}>
        <button type="button" className={styles.backButton} onClick={() => navigate('/')} aria-label="Back to dashboard" title="Back">
          <FiArrowLeft />
        </button>

        <button type="button" className={styles.saveButton} onClick={handleSave}>
          <FiSave />
          {saveStatus === 'saving' ? 'Saving…' : saveStatus === 'saved' ? 'Saved' : saveStatus === 'error' ? 'Failed' : 'Save room'}
        </button>

        <button type="button" className={styles.editButton} onClick={handleEditRoom}>
          <FiEdit2 />
          Edit room
        </button>
      </div>

      <div className={styles.topRightStack}>
        <ThemeToggle />
      </div>

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
              aria-label="Move"
              title="Move"
            >
              <FiMove />
            </button>
            <button
              type="button"
              className={gizmoMode === 'rotate' ? styles.itemButtonActive : styles.itemButton}
              onClick={() => setGizmoMode('rotate')}
              aria-label="Rotate"
              title="Rotate"
            >
              <FiRotateCw />
            </button>

            <span className={styles.itemDivider} />

            <button type="button" className={styles.itemButton} onClick={() => duplicateSelected()} aria-label="Make copy" title="Make copy">
              <FiCopy />
            </button>

            <span className={styles.itemDivider} />

            <button type="button" className={styles.itemButtonDanger} onClick={() => removeSelected()} aria-label="Remove" title="Remove">
              <FiTrash2 />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
