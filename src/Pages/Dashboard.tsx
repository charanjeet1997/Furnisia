import { useNavigate } from 'react-router-dom';
import { defaultRoom, roomPresets, type RoomShape } from '../Data/RoomShape';
import { usePlannerStore } from '../store/plannerStore';
import { RoomCard } from '../Components/UI/RoomCard';
import { Header } from '../Components/UI/Header';
import { Footer } from '../Components/UI/Footer';
import styles from './Dashboard.module.css';

export function Dashboard() {
  const navigate = useNavigate();
  const setRoom = usePlannerStore((state) => state.setRoom);

  function goToRoom(room: RoomShape) {
    setRoom(room);
    navigate('/planner');
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
