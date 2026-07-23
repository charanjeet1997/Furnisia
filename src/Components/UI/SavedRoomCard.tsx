import { FiTrash2 } from 'react-icons/fi';
import { footprintFt } from '../../Data/RoomShape';
import type { SavedRoom } from '../../store/rooms';
import { MiniRoomIcon } from './MiniRoomIcon';
import cardStyles from './RoomCard.module.css';
import styles from './SavedRoomCard.module.css';

interface SavedRoomCardProps {
  saved: SavedRoom;
  onSelect: () => void;
  onDelete: () => void;
}

export function SavedRoomCard({ saved, onSelect, onDelete }: SavedRoomCardProps) {
  return (
    <div className={styles.wrapper}>
      <button type="button" className={cardStyles.card} onClick={onSelect}>
        <div className={cardStyles.thumbnail}>
          <MiniRoomIcon vertices={saved.room.vertices} />
        </div>
        <h3 className={cardStyles.name}>{saved.name}</h3>
        <p className={cardStyles.size}>{footprintFt(saved.room.vertices)} &middot; {saved.placedItems.length} items</p>
        <span className={cardStyles.cta}>Open room</span>
      </button>
      <button
        type="button"
        className={styles.deleteButton}
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        aria-label={`Delete ${saved.name}`}
        title="Delete room"
      >
        <FiTrash2 />
      </button>
    </div>
  );
}
