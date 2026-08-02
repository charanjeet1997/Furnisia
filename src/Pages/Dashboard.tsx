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
    usePlannerStore.getState().setSavedRoomInfo(null, null);
    navigate('/planner');
  }

  function openSavedRoom(saved: SavedRoom) {
    loadRoom(saved.room, saved.placedItems, saved.id, saved.name);
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
          <div className={styles.heroBadge}>
            <span className={styles.badgeDot} />
            WebXR 3D & VR Spatial Architecture
          </div>
          <h1 className={styles.heroTitle}>
            Design your space with <span className={styles.heroHighlight}>Furnisia™</span>
          </h1>
          <p className={styles.heroSubtitle}>
            Visualise, plan, and arrange 3D furniture in custom rooms built to your exact dimensions — in 3D and 1:1 scale Virtual Reality.
          </p>

          <div className={styles.featurePills}>
            <span className={styles.featurePill}>🥽 WebXR VR Walkthrough</span>
            <span className={styles.featurePill}>📐 Custom Parametric Walls</span>
            <span className={styles.featurePill}>🛋️ Smart 3D Furniture Snap</span>
          </div>
        </div>

        <section className={styles.startCards}>
          <button type="button" className={styles.startCard} onClick={() => goToRoom(defaultRoom)}>
            <div className={styles.cardHeader}>
              <div className={styles.startCardIconWrapper}>
                <svg className={styles.startCardIcon} width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
                </svg>
              </div>
              <span className={styles.cardArrow}>➔</span>
            </div>
            <h2>Quick start</h2>
            <p>Jump directly into a default 3D canvas and start arranging furniture immediately.</p>
          </button>

          <button type="button" className={styles.startCard} onClick={() => navigate('/room-builder')}>
            <div className={styles.cardHeader}>
              <div className={styles.startCardIconWrapper}>
                <svg className={styles.startCardIcon} width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="2" />
                  <path d="M8 3v18M3 8h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <path d="M15 12h4M17 10v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </div>
              <span className={styles.cardArrow}>➔</span>
            </div>
            <h2>Build a room</h2>
            <p>Custom shapes, per-wall thickness, ceiling height, doors, windows, and floor finishes.</p>
          </button>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>My rooms</h2>
            {user && savedRooms.length > 0 && (
              <span className={styles.sectionBadge}>{savedRooms.length} saved</span>
            )}
          </div>
          {!user && (
            <div className={styles.savedRoomsHint}>
              <p>
                <Link to="/login">Sign in</Link> to save your 3D rooms to the cloud and access them anytime across all your devices.
              </p>
            </div>
          )}
          {user && loadingSaved && (
            <div className={styles.loadingSkeleton}>Loading your saved rooms…</div>
          )}
          {user && !loadingSaved && savedRooms.length === 0 && (
            <div className={styles.savedRoomsHint}>
              <p>You haven't saved any rooms yet — open the 3D Planner and click <strong>"Save room"</strong>.</p>
            </div>
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

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Empty room presets</h2>
            <span className={styles.sectionBadge}>{roomPresets.length} templates</span>
          </div>
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
