import { sqFt, type RoomShape } from '../../Data/RoomShape';
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
      <h3 className={styles.name}>{preset.name}</h3>
      <p className={styles.size}>{sqFt(preset.vertices)} sq.ft</p>
      <span className={styles.cta}>Design this room</span>
    </button>
  );
}
