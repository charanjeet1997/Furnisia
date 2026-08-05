import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore } from 'firebase/firestore';

// Values come from Vite env vars (see .env.example) — never hard-code Firebase config,
// even though it's not secret, so each environment (dev/staging/prod project) can differ.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'demo-api-key-placeholder',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'demo-app.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'demo-app',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'demo-app.appspot.com',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '1234567890',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:1234567890:web:demo',
  measurementId: import.meta.env.VITE_GA_MEASUREMENT_ID,
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = initializeFirestore(app, {
  ignoreUndefinedProperties: true,
});
