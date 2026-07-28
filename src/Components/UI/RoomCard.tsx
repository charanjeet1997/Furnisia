import { footprintFt, type RoomShape } from '../../Data/RoomShape';
import { MiniRoomIcon } from './MiniRoomIcon';
import styles from './RoomCard.module.css';

interface RoomCardProps {
  preset: RoomShape;
  onSelect: () => void;
}

export function RoomCard({ preset, onSelect }: RoomCardProps) {
  return (
    <button type="button" className={styles.card} onClick={onSelect}>
      <div className={styles.thumbnail}>
        <MiniRoomIcon vertices={preset.vertices} />
      </div>
      <div className={styles.content}>
        <div className={styles.metaRow}>
          <span className={styles.badge}>Preset</span>
          <span className={styles.size}>{footprintFt(preset.vertices)}</span>
        </div>
        <h3 className={styles.name}>{preset.name}</h3>
        <div className={styles.footer}>
          <span className={styles.cta}>Design room <span className={styles.ctaArrow}>➔</span></span>
        </div>
      </div>
    </button>
  );
}
