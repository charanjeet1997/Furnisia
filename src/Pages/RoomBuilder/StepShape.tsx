import { SHAPE_LABELS, type RoomShapeType } from '../../Data/RoomShape';
import { ShapeIcon } from './ShapeIcon';
import styles from './RoomBuilder.module.css';

const SHAPE_ORDER: RoomShapeType[] = ['rectangular', 'l-shape', 'cut', 't-shape', 'u-shape', 'beveled'];

interface StepShapeProps {
  shapeType: RoomShapeType;
  onSelect: (type: RoomShapeType) => void;
}

export function StepShape({ shapeType, onSelect }: StepShapeProps) {
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
      </div>
    </div>
  );
}
