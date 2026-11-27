
import { FiRotateCcw } from 'react-icons/fi';
import type { PlanUnits } from '../types/floorPlanTypes';
import type { InteriorWall } from '../../../Data/RoomShape';
import styles from '../RoomBuilder.module.css';

interface DimensionsSidebarProps {
  undo: () => void;
  canUndo: boolean;
  units: PlanUnits;
  onUnitsChange: (units: PlanUnits) => void;
  height: number;
  onHeightChange: (h: number) => void;
  minHeight: number;
  maxHeight: number;
  selected: { kind: 'edge'; index: number } | { kind: 'interior'; id: string } | null;
  onSelectClose: () => void;
  edgeThicknesses: number[];
  interiorWalls: InteriorWall[];
  onEdgeThicknessesChange: (thicknesses: number[]) => void;
  onInteriorWallsChange: (walls: InteriorWall[]) => void;
}

export function DimensionsSidebar({
  undo,
  canUndo,
  units,
  onUnitsChange,
  height,
  onHeightChange,
  minHeight,
  maxHeight,
  selected,
  onSelectClose,
  edgeThicknesses,
  interiorWalls,
  onEdgeThicknessesChange,
  onInteriorWallsChange,
}: DimensionsSidebarProps) {
  function applyThicknessCm(sel: NonNullable<typeof selected>, cm: number) {
    const meters = cm / 100;
    if (sel.kind === 'edge') {
      const next = [...edgeThicknesses];
      next[sel.index] = meters;
      onEdgeThicknessesChange(next);
    } else {
      onInteriorWallsChange(interiorWalls.map((w) => (w.id === sel.id ? { ...w, thickness: meters } : w)));
    }
  }

  const selectedThicknessMeters = selected
    ? selected.kind === 'edge'
      ? edgeThicknesses[selected.index] ?? 0.18
      : interiorWalls.find((w) => w.id === selected.id)?.thickness ?? 0.18
    : 0.18;

  const selectedThicknessCm = Math.round(selectedThicknessMeters * 100);

  return (
    <div className={styles.controlsSection}>
      <div className={styles.sidebarHeader}>
        <button
          type="button"
          onClick={undo}
          disabled={!canUndo}
          className={styles.undoBtn}
          title="Undo last edit"
        >
          <FiRotateCcw size={14} />
          <span>Undo</span>
        </button>

        <div className={styles.unitToggle}>
          <button
            type="button"
            className={`${styles.unitBtn} ${units === 'm' ? styles.unitBtnActive : ''}`}
            onClick={() => onUnitsChange('m')}
          >
            Metric (m)
          </button>
          <button
            type="button"
            className={`${styles.unitBtn} ${units === 'ft' ? styles.unitBtnActive : ''}`}
            onClick={() => onUnitsChange('ft')}
          >
            Imperial (ft)
          </button>
        </div>
      </div>

      <div className={styles.controlGroup}>
        <label htmlFor="room-height">Ceiling Height</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <input
            id="room-height"
            type="range"
            min={minHeight}
            max={maxHeight}
            step={0.1}
            value={height}
            onChange={(e) => onHeightChange(parseFloat(e.target.value))}
            className={styles.slider}
          />
          <span className={styles.valueDisplay}>
            {units === 'm' ? `${height.toFixed(1)}m` : `${(height * 3.28084).toFixed(1)}ft`}
          </span>
        </div>
      </div>

      {selected ? (
        <div
          className={styles.controlGroup}
          style={{
            background: 'var(--color-surface-hover, rgba(255,255,255,0.03))',
            padding: '0.75rem',
            borderRadius: '8px',
            border: '1px solid var(--color-border, rgba(255,255,255,0.1))',
            marginTop: '0.5rem',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>
              {selected.kind === 'edge' ? `Outer Wall #${selected.index + 1}` : 'Interior Wall'}
            </span>
            <button
              type="button"
              onClick={onSelectClose}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--color-text-muted)',
                cursor: 'pointer',
                fontSize: '1rem',
                lineHeight: 1,
              }}
            >
              ✕
            </button>
          </div>

          <label htmlFor="wall-thickness-cm" style={{ display: 'block', fontSize: '0.8rem', marginBottom: '0.25rem' }}>
            Wall Thickness (cm)
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input
              id="wall-thickness-cm"
              type="number"
              min={7}
              max={100}
              step={1}
              value={selectedThicknessCm}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                if (Number.isFinite(val)) applyThicknessCm(selected, val);
              }}
              style={{
                width: '70px',
                padding: '0.3rem 0.5rem',
                borderRadius: '4px',
                border: '1px solid var(--color-border)',
                background: 'var(--color-bg)',
                color: 'var(--color-text)',
              }}
            />
            <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>cm</span>
          </div>
        </div>
      ) : (
        <p style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginTop: '0.5rem', fontStyle: 'italic' }}>
          Click any wall in the plan to edit its thickness.
        </p>
      )}

    </div>
  );
}
