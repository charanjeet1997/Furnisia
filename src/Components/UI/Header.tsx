import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../store/AuthContext';
import { ThemeToggle } from './ThemeToggle';
import styles from './Header.module.css';

export function Header() {
  const { user, loading, signOutUser } = useAuth();
  const navigate = useNavigate();

  async function handleSignOut() {
    await signOutUser();
    navigate('/');
  }

  return (
    <header className={styles.header}>
      <Link to="/" className={styles.brand}>
        <span className={styles.logo} aria-hidden="true" />
        Furnisia
      </Link>
      <div className={styles.actions}>
        {!loading && (user ? (
          <div className={styles.account}>
            <Link to="/profile" className={styles.accountLink} title={user.email ?? undefined}>
              {user.photoURL ? (
                <img className={styles.accountAvatar} src={user.photoURL} alt={user.email ?? 'Profile'} />
              ) : (
                <span className={styles.accountAvatarFallback}>
                  {(user.displayName?.trim() || user.email || '?').slice(0, 1).toUpperCase()}
                </span>
              )}
            </Link>
            <button type="button" className={styles.signOutButton} onClick={handleSignOut}>
              Sign out
            </button>
          </div>
        ) : (
          <Link to="/login" className={styles.signInLink}>
            Sign in
          </Link>
        ))}
        <ThemeToggle />
      </div>
    </header>
  );
}
