import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';
import { deleteRoom, listRooms, type SavedRoom } from '../store/rooms';
import { usePlannerStore } from '../store/plannerStore';
import { Header } from '../Components/UI/Header';
import { Footer } from '../Components/UI/Footer';
import { SavedRoomCard } from '../Components/UI/SavedRoomCard';
import styles from './Profile.module.css';

function initials(name: string | null, email: string | null): string {
  const source = name?.trim() || email || '?';
  return source.slice(0, 1).toUpperCase();
}

export function Profile() {
  const { user, loading, signOutUser } = useAuth();
  const navigate = useNavigate();
  const loadRoom = usePlannerStore((state) => state.loadRoom);
  const [savedRooms, setSavedRooms] = useState<SavedRoom[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate('/login');
  }, [loading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    setLoadingRooms(true);
    listRooms(user.uid)
      .then(setSavedRooms)
      .finally(() => setLoadingRooms(false));
  }, [user]);

  if (!user) return null;

  const provider = user.providerData[0]?.providerId === 'google.com' ? 'Google' : 'Email & password';

  async function handleSignOut() {
    await signOutUser();
    navigate('/');
  }

  function openSavedRoom(saved: SavedRoom) {
    loadRoom(saved.room, saved.placedItems, saved.id, saved.name);
    navigate(`/planner?roomId=${saved.id}`);
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
        <div className={styles.layout}>
          <div className={styles.sidebarCard}>
            {user.photoURL ? (
              <img className={styles.avatar} src={user.photoURL} alt="" />
            ) : (
              <div className={styles.avatarFallback}>{initials(user.displayName, user.email)}</div>
            )}
            <h1 className={styles.name}>{user.displayName || 'Your account'}</h1>
            <p className={styles.email}>{user.email}</p>
            <span className={styles.badge}>Signed in with {provider}</span>
            <p className={styles.roomCount}>
              {loadingRooms ? 'Loading…' : `${savedRooms.length} saved room${savedRooms.length === 1 ? '' : 's'}`}
            </p>
            <button type="button" className={styles.signOutButton} onClick={handleSignOut}>
              Sign out
            </button>
          </div>

          <div className={styles.rooms}>
            <h2 className={styles.roomsTitle}>My rooms</h2>
            {!loadingRooms && savedRooms.length === 0 && (
              <p className={styles.emptyHint}>You haven't saved any rooms yet — open the Planner and hit "Save room".</p>
            )}
            {savedRooms.length > 0 && (
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
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
