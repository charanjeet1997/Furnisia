import { type FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { defaultRoom, roomPresets, type RoomPreset } from '../Data/RoomPresets';
import { usePlannerStore } from '../store/plannerStore';
import { RoomCard } from '../Components/UI/RoomCard';
import styles from './Dashboard.module.css';

export function Dashboard() {
  const navigate = useNavigate();
  const setRoom = usePlannerStore((state) => state.setRoom);
  const [customWidth, setCustomWidth] = useState(4);
  const [customLength, setCustomLength] = useState(4);

  function goToRoom(room: RoomPreset) {
    setRoom(room);
    navigate('/planner');
  }

  function handleBuildRoom(event: FormEvent) {
    event.preventDefault();
    goToRoom({ id: 'custom', name: 'Custom Room', width: customWidth, length: customLength, height: 2.5 });
  }

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <h1 className={styles.heroTitle}>Design your space with Furnisia</h1>
        <p className={styles.heroSubtitle}>
          Visualise, plan, and arrange furniture in a room built to your dimensions.
        </p>
      </header>

      <section className={styles.startCards}>
        <button type="button" className={styles.startCard} onClick={() => goToRoom(defaultRoom)}>
          <h2>Quick start</h2>
          <p>Jump into a default room and start placing furniture.</p>
        </button>

        <form className={styles.startCard} onSubmit={handleBuildRoom}>
          <h2>Build a room</h2>
          <p>Set your own dimensions.</p>
          <div className={styles.dimensionInputs}>
            <label className={styles.dimensionLabel}>
              Width (m)
              <input
                type="number"
                min={2}
                max={15}
                step={0.1}
                value={customWidth}
                onChange={(event) => setCustomWidth(Number(event.target.value))}
              />
            </label>
            <label className={styles.dimensionLabel}>
              Length (m)
              <input
                type="number"
                min={2}
                max={15}
                step={0.1}
                value={customLength}
                onChange={(event) => setCustomLength(Number(event.target.value))}
              />
            </label>
          </div>
          <button type="submit" className={styles.submitButton}>
            Build room
          </button>
        </form>
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
  );
}
