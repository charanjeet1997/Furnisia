import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import { auth } from '../firebase';
import { setAnalyticsUser, trackLogin, trackSignUp } from '../utils/analytics';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  signInGoogle: () => Promise<void>;
  signInEmail: (email: string, password: string) => Promise<void>;
  registerEmail: (email: string, password: string) => Promise<void>;
  signOutUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => onAuthStateChanged(auth, (u) => {
    setUser(u);
    setLoading(false);
    if (u) {
      setAnalyticsUser({ uid: u.uid, email: u.email, displayName: u.displayName });
    } else {
      setAnalyticsUser(null);
    }
  }), []);

  const value: AuthContextValue = {
    user,
    loading,
    signInGoogle: async () => {
      const res = await signInWithPopup(auth, new GoogleAuthProvider());
      if (res.user) {
        trackLogin('google', { uid: res.user.uid, email: res.user.email, displayName: res.user.displayName });
      }
    },
    signInEmail: async (email, password) => {
      const res = await signInWithEmailAndPassword(auth, email, password);
      if (res.user) {
        trackLogin('email', { uid: res.user.uid, email: res.user.email, displayName: res.user.displayName });
      }
    },
    registerEmail: async (email, password) => {
      const res = await createUserWithEmailAndPassword(auth, email, password);
      if (res.user) {
        trackSignUp('email', { uid: res.user.uid, email: res.user.email, displayName: res.user.displayName });
      }
    },
    signOutUser: async () => {
      await signOut(auth);
      setAnalyticsUser(null);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
