import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiCopy, FiEdit2, FiGrid, FiHelpCircle, FiMove, FiRotateCw, FiSave, FiTrash2 } from 'react-icons/fi';
import { usePlannerStore } from '../../store/plannerStore';
import { useAuth } from '../../store/AuthContext';
import { newRoomId, saveRoom } from '../../store/rooms';
import { RotationSlider } from './RotationSlider';
import { ThemeToggle } from './ThemeToggle';
import { OnboardingModal } from './OnboardingModal';
import styles from './Toolbar.module.css';

function normalizeDegrees(deg: number) {
  return (((deg % 360) + 540) % 360) - 180;
}

const LightbulbIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1.3.5 2.6 1.5 3.5.8.8 1.3 1.5 1.5 2.5" />
    <path d="M9 18h6" />
    <path d="M10 22h4" />
  </svg>
);

export function Toolbar() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const room = usePlannerStore((state) => state.room);
  const updateLightIntensity = usePlannerStore((state) => state.updateLightIntensity);
  const placedItems = usePlannerStore((state) => state.placedItems);
  const isCatalogOpen = usePlannerStore((state) => state.isCatalogOpen);
  const showGrid = usePlannerStore((state) => state.showGrid);
  const toggleGrid = usePlannerStore((state) => state.toggleGrid);
  const gridSize = usePlannerStore((state) => state.gridSize);
  const setGridSize = usePlannerStore((state) => state.setGridSize);
  const snapToGrid = usePlannerStore((state) => state.snapToGrid);
  const setSnapToGrid = usePlannerStore((state) => state.setSnapToGrid);
  const selectedId = usePlannerStore((state) => state.selectedId);
  const selectedItem = usePlannerStore((state) => state.placedItems.find((item) => item.id === state.selectedId));
  const gizmoMode = usePlannerStore((state) => state.gizmoMode);
  const setGizmoMode = usePlannerStore((state) => state.setGizmoMode);
  const removeSelected = usePlannerStore((state) => state.removeSelected);
  const duplicateSelected = usePlannerStore((state) => state.duplicateSelected);
  const selectItem = usePlannerStore((state) => state.selectItem);
  const updateItemTransform = usePlannerStore((state) => state.updateItemTransform);
  const updateItemScale = usePlannerStore((state) => state.updateItemScale);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [lastSavedTime, setLastSavedTime] = useState<Date | null>(null);
  const [showLightPopover, setShowLightPopover] = useState(false);
  const [showGridPopover, setShowGridPopover] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const lightRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const savedRoomId = usePlannerStore((state) => state.savedRoomId);
  const savedRoomName = usePlannerStore((state) => state.savedRoomName);
  const setSavedRoomInfo = usePlannerStore((state) => state.setSavedRoomInfo);

  const lightIntensity = room.lightIntensity ?? 1.8;

  function handleEditRoom() {
    navigate('/room-builder', { state: { initialRoom: room, initialStep: 1, returnTo: '/planner' } });
  }

  async function handleSave() {
    if (!user) {
      navigate('/login');
      return;
    }
    setSaveStatus('saving');
    try {
      if (savedRoomId) {
        const roomName = savedRoomName || room.name || 'My Room';
        await saveRoom(user.uid, savedRoomId, { name: roomName, room, placedItems });
        setSavedRoomInfo(savedRoomId, roomName);
      } else {
        const name = window.prompt('Name this room', room.name || 'My Room');
        if (!name) {
          setSaveStatus('idle');
          return;
        }
        const roomId = newRoomId(user.uid);
        await saveRoom(user.uid, roomId, { name, room, placedItems });
        setSavedRoomInfo(roomId, name);
      }
      setSaveStatus('saved');
      setLastSavedTime(new Date());
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
        setShowLightPopover(false);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [removeSelected, selectItem]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (lightRef.current && !lightRef.current.contains(e.target as Node)) {
        setShowLightPopover(false);
      }
      if (gridRef.current && !gridRef.current.contains(e.target as Node)) {
        setShowGridPopover(false);
      }
    }
    if (showLightPopover || showGridPopover) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showLightPopover, showGridPopover]);

  return (
    <>
      <div className={styles.topLeftStack}>
        <button type="button" className={styles.backButton} onClick={() => navigate('/')} aria-label="Back to dashboard" title="Back">
          <FiArrowLeft />
        </button>

        <button
          id="tour-plan-save"
          type="button"
          className={styles.saveButton}
          onClick={handleSave}
          title={lastSavedTime ? `Last saved at ${lastSavedTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Save room'}
        >
          <FiSave />
          <span className={styles.buttonLabel}>
            {saveStatus === 'saving'
              ? 'Saving…'
              : saveStatus === 'saved'
              ? 'Saved!'
              : saveStatus === 'error'
              ? 'Failed'
              : lastSavedTime
              ? `Saved ${lastSavedTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
              : 'Save'}
          </span>
        </button>

        <button id="tour-plan-edit" type="button" className={styles.editButton} onClick={handleEditRoom} title="Edit room">
          <FiEdit2 />
          <span className={styles.buttonLabel}>Edit</span>
        </button>

        <button id="tour-plan-vr" type="button" className={styles.vrButton} onClick={() => navigate('/vr-room')} title="VR Room">
          <span style={{ fontSize: '1rem', lineHeight: 1 }}>🥽</span>
          <span className={styles.buttonLabel}>VR Room</span>
        </button>

        <button
          type="button"
          className={styles.editButton}
          onClick={() => window.dispatchEvent(new CustomEvent('furnisia-start-tour'))}
          title="App Tour & Feature Guide"
        >
          <FiHelpCircle />
          <span className={styles.buttonLabel}>Guide</span>
        </button>

        <div id="tour-plan-grid" className={styles.gridControlWrapper} ref={gridRef}>
          <button
            type="button"
            className={showGridPopover || showGrid ? styles.gridButtonActive : styles.gridButton}
            onClick={() => setShowGridPopover((prev) => !prev)}
            title="Floor Grid Settings"
            aria-label="Floor Grid Settings"
          >
            <FiGrid size={18} />
          </button>
          {showGridPopover && (
            <div className={styles.gridPopover}>
              <div className={styles.gridToggleRow}>
                <span>Show Grid</span>
                <label className={styles.switchToggle}>
                  <input type="checkbox" checked={showGrid} onChange={() => toggleGrid()} />
                  <span className={styles.sliderSwitch} />
                </label>
              </div>

              <div className={styles.gridToggleRow}>
                <span>Grid Size</span>
                <span className={styles.popoverVal}>{gridSize < 1 ? `${Math.round(gridSize * 100)} cm` : `${gridSize} m`}</span>
              </div>

              <div className={styles.gridPresetRow}>
                {[0.25, 0.5, 1.0, 2.0].map((size) => (
                  <button
                    key={size}
                    type="button"
                    className={gridSize === size ? styles.gridPresetBtnActive : styles.gridPresetBtn}
                    onClick={() => setGridSize(size)}
                  >
                    {size < 1 ? `${size * 100}cm` : `${size}m`}
                  </button>
                ))}
              </div>

              <input
                type="range"
                min="0.1"
                max="2.0"
                step="0.05"
                value={gridSize}
                onChange={(e) => setGridSize(parseFloat(e.target.value))}
                className={styles.popoverRange}
              />

              <div className={styles.gridToggleRow}>
                <span>Snap to Grid</span>
                <label className={styles.switchToggle}>
                  <input type="checkbox" checked={snapToGrid} onChange={(e) => setSnapToGrid(e.target.checked)} />
                  <span className={styles.sliderSwitch} />
                </label>
              </div>
            </div>
          )}
        </div>

        <div id="tour-plan-light" className={styles.lightControlWrapper} ref={lightRef}>
          <button
            type="button"
            className={showLightPopover ? styles.lightButtonActive : styles.lightButton}
            onClick={() => setShowLightPopover((prev) => !prev)}
            title="Adjust Ceiling Light Intensity"
            aria-label="Light Intensity"
          >
            <LightbulbIcon />
          </button>
          {showLightPopover && (
            <div className={styles.lightPopover}>
              <div className={styles.popoverHeader}>
                <span>Light Intensity</span>
                <span className={styles.popoverVal}>{Math.round((lightIntensity / 4) * 100)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="4"
                step="0.1"
                value={lightIntensity}
                onChange={(e) => updateLightIntensity(parseFloat(e.target.value))}
                className={styles.popoverRange}
              />
            </div>
          )}
        </div>

        <div id="tour-theme-toggle">
          <ThemeToggle />
        </div>
      </div>

      {selectedId && selectedItem && (
        <div id="tour-furn-stack" className={isCatalogOpen ? `${styles.floatingStack} ${styles.floatingStackCatalogOpen}` : styles.floatingStack}>
          {gizmoMode === 'rotate' && (
            <RotationSlider
              degrees={normalizeDegrees((selectedItem.rotationY * 180) / Math.PI)}
              onChange={(deg) => updateItemTransform(selectedItem.id, selectedItem.position, (deg * Math.PI) / 180)}
            />
          )}

          <div className={styles.itemToolbar}>
            <button
              id="tour-furn-move"
              type="button"
              className={gizmoMode === 'translate' ? styles.itemButtonActive : styles.itemButton}
              onClick={() => setGizmoMode('translate')}
              aria-label="Move"
              title="Move"
            >
              <FiMove />
            </button>
            <button
              id="tour-furn-rotate"
              type="button"
              className={gizmoMode === 'rotate' ? styles.itemButtonActive : styles.itemButton}
              onClick={() => setGizmoMode('rotate')}
              aria-label="Rotate"
              title="Rotate"
            >
              <FiRotateCw />
            </button>

            <button
              type="button"
              className={styles.itemButton}
              onClick={() => updateItemScale(selectedItem.id, (selectedItem.scale || 1) * 0.8)}
              title="Scale Down (Make smaller)"
              aria-label="Scale Down"
            >
              🔍−
            </button>
            <button
              type="button"
              className={styles.itemButton}
              onClick={() => updateItemScale(selectedItem.id, (selectedItem.scale || 1) * 1.25)}
              title="Scale Up (Make bigger)"
              aria-label="Scale Up"
            >
              🔍+
            </button>

            <span className={styles.itemDivider} />

            <button id="tour-furn-copy" type="button" className={styles.itemButton} onClick={() => duplicateSelected()} aria-label="Make copy" title="Make copy">
              <FiCopy />
            </button>

            <span className={styles.itemDivider} />

            <button id="tour-furn-delete" type="button" className={styles.itemButtonDanger} onClick={() => removeSelected()} aria-label="Remove" title="Remove">
              <FiTrash2 />
            </button>
          </div>
        </div>
      )}

      <OnboardingModal isOpen={showOnboarding} onClose={() => setShowOnboarding(false)} />
    </>
  );
}
