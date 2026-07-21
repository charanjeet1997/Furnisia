import { sqFt, type RoomPreset } from '../../Data/RoomPresets';
import styles from './RoomCard.module.css';

interface RoomCardProps {
  preset: RoomPreset;
  onSelect: () => void;
}

export function RoomCard({ preset, onSelect }: RoomCardProps) {
  return (
    <button type="button" className={styles.card} onClick={onSelect}>
      <div className={styles.thumbnail} />
      <h3 className={styles.name}>{preset.name}</h3>
      <p className={styles.size}>{sqFt(preset.width, preset.length)} sq.ft</p>
      <span className={styles.cta}>Design this room</span>
    </button>
  );
}
