import { useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'furnisia-theme';

function getInitialTheme(): Theme {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'light' || stored === 'dark') return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

// Applies the theme to the DOM immediately (before React mounts, via the inline script in
// index.html) and again here on change — avoids a flash of the wrong theme on first paint.
export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
}

// Small standalone hook (not part of plannerStore) — theme is an app-wide UI preference that
// persists across rooms/sessions, not planner state.
export function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  function toggle() {
    setTheme((t) => (t === 'light' ? 'dark' : 'light'));
  }

  return [theme, toggle];
}
