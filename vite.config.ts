import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), basicSsl()],
  server: {
    // Without this, Chrome's default COOP policy blocks the Firebase Auth popup flow
    // (signInWithPopup) from checking window.closed, logging noisy warnings and sometimes
    // stalling the sign-in. "same-origin-allow-popups" keeps isolation for our own origin
    // while still letting the auth popup be tracked.
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
    },
  },
  preview: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
    },
  },
})
// Cache Bust: 1784991000

