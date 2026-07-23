import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { defaultRoom, roomPresets, type RoomShape } from '../Data/RoomShape';
import { usePlannerStore } from '../store/plannerStore';
import { useAuth } from '../store/AuthContext';
import { deleteRoom, listRooms, type SavedRoom } from '../store/rooms';
import { RoomCard } from '../Components/UI/RoomCard';
import { SavedRoomCard } from '../Components/UI/SavedRoomCard';
import { Header } from '../Components/UI/Header';
import { Footer } from '../Components/UI/Footer';
import styles from './Dashboard.module.css';

export function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const setRoom = usePlannerStore((state) => state.setRoom);
  const loadRoom = usePlannerStore((state) => state.loadRoom);
  const [savedRooms, setSavedRooms] = useState<SavedRoom[]>([]);
  const [loadingSaved, setLoadingSaved] = useState(false);

  useEffect(() => {
    if (!user) {
      setSavedRooms([]);
      return;
    }
    setLoadingSaved(true);
    listRooms(user.uid)
      .then(setSavedRooms)
      .finally(() => setLoadingSaved(false));
  }, [user]);

  function goToRoom(room: RoomShape) {
    setRoom(room);
    navigate('/planner');
  }

  function openSavedRoom(saved: SavedRoom) {
    loadRoom(saved.room, saved.placedItems);
    navigate('/planner');
  }

  async function removeSavedRoom(saved: SavedRoom) {
    if (!user) return;
    if (!window.confirm(`Delete "${saved.name}"? This can't be undone.`)) return;
    await deleteRoom(user.uid, saved.id);
    setSavedRooms((rooms) => rooms.filter((r) => r.id !== saved.id));
  }

  return (
    <div className={styles.appShell}>
      <Header />
      <div className={styles.page}>
      <div className={styles.hero}>
        <h1 className={styles.heroTitle}>Design your space with Furnisia</h1>
        <p className={styles.heroSubtitle}>
          Visualise, plan, and arrange furniture in a room built to your dimensions.
        </p>
      </div>

      <section className={styles.startCards}>
        <button type="button" className={styles.startCard} onClick={() => goToRoom(defaultRoom)}>
          <svg className={styles.startCardIcon} width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" stroke="var(--color-accent)" strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round" />
          </svg>
          <h2>Quick start</h2>
          <p>Jump into a default room and start placing furniture.</p>
        </button>

        <button type="button" className={styles.startCard} onClick={() => navigate('/room-builder')}>
          <svg className={styles.startCardIcon} width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <rect x="3" y="3" width="18" height="18" rx="2" stroke="var(--color-accent)" strokeWidth={1.6} />
            <path d="M8 3v18M3 8h5" stroke="var(--color-accent)" strokeWidth={1.6} strokeLinecap="round" />
            <path d="M15 12h4M17 10v4" stroke="var(--color-accent)" strokeWidth={1.6} strokeLinecap="round" />
          </svg>
          <h2>Build a room</h2>
          <p>Choose a shape, set dimensions, add doors and windows, and pick a style.</p>
        </button>
      </section>

      <section>
        <h2 className={styles.sectionTitle}>My rooms</h2>
        {!user && (
          <p className={styles.savedRoomsHint}>
            <Link to="/login">Sign in</Link> to save your rooms and pick up where you left off, on any device.
          </p>
        )}
        {user && loadingSaved && <p className={styles.savedRoomsHint}>Loading your rooms…</p>}
        {user && !loadingSaved && savedRooms.length === 0 && (
          <p className={styles.savedRoomsHint}>You haven't saved any rooms yet — open the Planner and hit "Save room".</p>
        )}
        {user && savedRooms.length > 0 && (
          <div className={styles.roomGrid}>
            {savedRooms.map((saved) => (
              <SavedRoomCard
                key={saved.id}
                saved={saved}
                onSelect={() => openSavedRoom(saved)}
                onDelete={() => removeSavedRoom(saved)}
              />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className={styles.sectionTitle}>Empty rooms</h2>
        <div className={styles.roomGrid}>
          {roomPresets.map((preset) => (
            <RoomCard key={preset.id} preset={preset} onSelect={() => goToRoom(preset)} />
          ))}
        </div>
      </section>
      </div>
      <Footer />
    </div>
  );
}
