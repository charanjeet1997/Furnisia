import { useState } from 'react';
import { FiUpload } from 'react-icons/fi';
import { SHAPE_LABELS, type RoomShapeType } from '../../Data/RoomShape';
import { ShapeIcon } from './ShapeIcon';
import { ImportFloorPlanDialog } from './floorPlanImport/ImportFloorPlanDialog';
import type { ImportedRoom } from './floorPlanImport/planToRoom';
import styles from './RoomBuilder.module.css';

const SHAPE_ORDER: RoomShapeType[] = ['rectangular', 'l-shape', 'cut', 't-shape', 'u-shape', 'beveled'];

interface StepShapeProps {
  shapeType: RoomShapeType;
  onSelect: (type: RoomShapeType) => void;
  onImportPlan: (room: ImportedRoom) => void;
}

export function StepShape({ shapeType, onSelect, onImportPlan }: StepShapeProps) {
  const [importing, setImporting] = useState(false);

  return (
    <div>
      <h2 className={styles.stepTitle}>Set the shape and size</h2>
      <div className={styles.shapeGrid}>
        {SHAPE_ORDER.map((type) => (
          <button
            key={type}
            type="button"
            className={type === shapeType ? styles.shapeCardActive : styles.shapeCard}
            onClick={() => onSelect(type)}
          >
            <ShapeIcon shape={type} active={type === shapeType} />
            {SHAPE_LABELS[type]}
          </button>
        ))}
        <button type="button" className={styles.shapeCard} onClick={() => setImporting(true)}>
          <FiUpload size={36} />
          Import floor plan
        </button>
      </div>
      {importing && (
        <ImportFloorPlanDialog
          onClose={() => setImporting(false)}
          onImport={(room) => {
            setImporting(false);
            onImportPlan(room);
          }}
        />
      )}
    </div>
  );
}
