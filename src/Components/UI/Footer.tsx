import styles from './Footer.module.css';

export function Footer() {
  return (
    <footer className={styles.footer}>
      <p>&copy; {new Date().getFullYear()} Furnisia™ &middot; Developed by <strong>Charanjeet Singh Jaswani</strong></p>
    </footer>
  );
}
