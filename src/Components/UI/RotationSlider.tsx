import styles from './RotationSlider.module.css';

interface RotationSliderProps {
  degrees: number;
  onChange: (degrees: number) => void;
}

const TICKS = [-180, -90, 0, 90, 180];

export function RotationSlider({ degrees, onChange }: RotationSliderProps) {
  return (
    <div className={styles.wrapper}>
      <div className={styles.valueChip}>{Math.round(degrees)}</div>
      <div className={styles.sliderTrack}>
        {TICKS.map((tick) => (
          <span
            key={tick}
            className={styles.tick}
            style={{ left: `calc(1.25rem + ${(tick + 180) / 360} * (100% - 2.5rem))` }}
          />
        ))}
        <input
          type="range"
          min={-180}
          max={180}
          step={1}
          value={degrees}
          onChange={(event) => onChange(Number(event.target.value))}
          className={styles.slider}
          aria-label="Rotation in degrees"
        />
      </div>
    </div>
  );
}
