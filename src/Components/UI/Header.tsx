import { Link } from 'react-router-dom';
import { ThemeToggle } from './ThemeToggle';
import styles from './Header.module.css';

export function Header() {
  return (
    <header className={styles.header}>
      <Link to="/" className={styles.brand}>
        <span className={styles.logo} aria-hidden="true" />
        Furnisia
      </Link>
      <ThemeToggle />
    </header>
  );
}
