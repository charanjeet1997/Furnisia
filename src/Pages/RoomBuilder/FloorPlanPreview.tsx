import styles from './FloorPlanPreview.module.css';
import type { PlanUnits, SnapTarget, FloorPlanPreviewProps } from './types/floorPlanTypes';
import { useFloorPlanState } from './hooks/useFloorPlanState';
import { FloorPlanSvgCanvas } from './components/FloorPlanSvgCanvas';

export type { PlanUnits, SnapTarget, FloorPlanPreviewProps };

export function FloorPlanPreview(props: FloorPlanPreviewProps) {
  const state = useFloorPlanState(props);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {state.pointer.rejectedClick && (
        <div key={state.pointer.rejectedClick.token} className={styles.toast}>
          {state.pointer.rejectedClick.message}
        </div>
      )}

      <FloorPlanSvgCanvas props={props} state={state} />

      {state.drawing.drawStart && (
        <div className={styles.mobileStopFloatingBar} onPointerDown={(e) => e.stopPropagation()}>
          <div className={styles.drawHintText}>
            Tap where you want the wall segment to go
          </div>
          <div className={styles.drawActions}>
            <button
              type="button"
              className={styles.mobileStopButton}
              onClick={(e) => {
                e.stopPropagation();
                state.drawing.cancelDraw();
              }}
            >
              <span className={styles.stopIcon}>✓</span>
              <span>Finish Wall</span>
            </button>
            <button
              type="button"
              className={styles.drawCancelButton}
              onClick={(e) => {
                e.stopPropagation();
                state.drawing.cancelDraw();
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {state.editBox && state.pointer.editingEdge !== null && (
        <input
          autoFocus
          type="number"
          step="0.1"
          min="0.1"
          value={state.pointer.editValue}
          onChange={(e) => state.pointer.setEditValue(e.target.value)}
          onFocus={(e) => e.target.select()}
          onBlur={(e) => state.pointer.commitEdit(state.pointer.editingEdge!, e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
            if (e.key === 'Escape') state.pointer.setEditingEdge(null);
          }}
          style={{
            position: 'absolute',
            left: state.editBox.left,
            top: state.editBox.top,
            transform: `translate(-50%, -50%) rotate(${state.editBox.angleDeg}deg)`,
            width: 64,
            textAlign: 'center',
            fontSize: 13,
            padding: '3px 4px',
            border: '1px solid var(--color-accent)',
            borderRadius: 4,
            background: 'var(--color-surface)',
            color: 'var(--color-text)',
            boxSizing: 'border-box',
          }}
        />
      )}
    </div>
  );
}
