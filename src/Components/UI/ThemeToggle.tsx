import { useLocation } from 'react-router-dom';
import { useTheme } from '../../store/useTheme';
import styles from './ThemeToggle.module.css';

// Mounted once at the app root (see App.tsx) so it's reachable from every page.
export function ThemeToggle() {
  const [theme, toggle] = useTheme();
  const isDark = theme === 'dark';
  const { pathname } = useLocation();
  const isPlanner = pathname === '/planner';

  return (
    <button
      type="button"
      className={isPlanner ? `${styles.toggle} ${styles.toggleOnPlanner}` : styles.toggle}
      onClick={toggle}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {isDark ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="4.5" stroke="currentColor" strokeWidth={1.7} />
          <path
            d="M12 2.5v2.2M12 19.3v2.2M21.5 12h-2.2M4.7 12H2.5M18.5 5.5l-1.6 1.6M7.1 16.9l-1.6 1.6M18.5 18.5l-1.6-1.6M7.1 7.1 5.5 5.5"
            stroke="currentColor"
            strokeWidth={1.7}
            strokeLinecap="round"
          />
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M20 14.3A8.4 8.4 0 0 1 9.7 4a8.4 8.4 0 1 0 10.3 10.3Z"
            stroke="currentColor"
            strokeWidth={1.7}
            strokeLinejoin="round"
          />
        </svg>
      )}
    </button>
  );
}
