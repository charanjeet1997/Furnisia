import styles from './Footer.module.css';

export function Footer() {
  return (
    <footer className={styles.footer}>
      <p className={styles.text}>
        <span>&copy; {new Date().getFullYear()} Furnisia™</span>
        <span className={styles.sep}>&middot;</span>
        <span>Developed by <strong className={styles.author}>Charanjeet Singh Jaswani</strong></span>
      </p>
    </footer>
  );
}
