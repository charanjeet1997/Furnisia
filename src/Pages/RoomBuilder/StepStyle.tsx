import styles from './RoomBuilder.module.css';

const WALL_COLORS = ['#f5f0e6', '#e8e2d4', '#d9d2c2', '#c9c2b4', '#b8c4bd', '#c4b8a8'];
const FLOOR_COLORS = ['#c9a978', '#a8875c', '#8c6d4a', '#d4c3a5', '#8a8580', '#5c5550'];

interface StepStyleProps {
  wallColor: string;
  floorColor: string;
  onWallColorChange: (color: string) => void;
  onFloorColorChange: (color: string) => void;
}

export function StepStyle({ wallColor, floorColor, onWallColorChange, onFloorColorChange }: StepStyleProps) {
  return (
    <div className={styles.controlsSection} style={{ maxWidth: '480px', margin: '0 auto' }}>
      <h2 className={styles.stepTitle}>Choose your room style</h2>

      <p className={styles.stepSubtitle}>Wall color</p>
      <div className={styles.colorGrid}>
        {WALL_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            className={color === wallColor ? styles.colorSwatchActive : styles.colorSwatch}
            style={{ background: color }}
            onClick={() => onWallColorChange(color)}
            aria-label={`Wall color ${color}`}
          />
        ))}
      </div>

      <p className={styles.stepSubtitle}>Floor style</p>
      <div className={styles.colorGrid}>
        {FLOOR_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            className={color === floorColor ? styles.colorSwatchActive : styles.colorSwatch}
            style={{ background: color }}
            onClick={() => onFloorColorChange(color)}
            aria-label={`Floor color ${color}`}
          />
        ))}
      </div>
    </div>
  );
}
