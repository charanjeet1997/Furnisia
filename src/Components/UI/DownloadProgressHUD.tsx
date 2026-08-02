import { useProgress } from '@react-three/drei';
import styles from './DownloadProgressHUD.module.css';

export function DownloadProgressHUD() {
  const { active, progress } = useProgress();

  if (!active || progress >= 100) return null;

  const pct = Math.round(progress);

  return (
    <div className={styles.hudContainer}>
      <div className={styles.hudBadge}>
        <span className={styles.spinner} />
        <span className={styles.hudTitle}>Downloading 3D Model…</span>
        <span className={styles.hudPercent}>{pct}%</span>
      </div>
      <div className={styles.progressTrack}>
        <div className={styles.progressFill} style={{ width: `${Math.max(5, pct)}%` }} />
      </div>
    </div>
  );
}
