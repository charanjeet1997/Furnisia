import { useEffect, useState } from 'react';
import { useProgress } from '@react-three/drei';

/**
 * Overlay progress bar for texture/model loading.
 *
 * Textures are fetched with a plain `TextureLoader`, which reports through three's
 * `DefaultLoadingManager` — the same store `useProgress` reads — so this tracks them without
 * the meshes needing to suspend. Render it as a sibling of a `<Canvas>` inside a
 * `position: relative` wrapper.
 *
 * On a local dev server loads finish in a frame or two and a bar that flashes on every texture
 * swap reads as jank, so appearance is delayed by `SHOW_DELAY_MS`; only genuinely slow loads
 * (the deployed case) ever show it.
 */
const SHOW_DELAY_MS = 250;
const HIDE_DELAY_MS = 300;

export function TextureLoadingBar() {
  const { active, progress } = useProgress();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Leaving the bar up briefly at 100% avoids it vanishing mid-sweep, which looks like a
    // glitch rather than a completed load.
    const delay = active ? SHOW_DELAY_MS : HIDE_DELAY_MS;
    const timer = setTimeout(() => setVisible(active), delay);
    return () => clearTimeout(timer);
  }, [active]);

  if (!visible) return null;

  return (
    <div
      role="progressbar"
      aria-label="Loading textures"
      aria-valuenow={Math.round(progress)}
      aria-valuemin={0}
      aria-valuemax={100}
      style={{
        position: 'absolute',
        left: '50%',
        bottom: '1.25rem',
        transform: 'translateX(-50%)',
        display: 'flex',
        alignItems: 'center',
        gap: '0.6rem',
        padding: '0.5rem 0.85rem',
        borderRadius: 'var(--radius-sm, 6px)',
        background: 'rgba(15, 23, 42, 0.82)',
        border: '1px solid var(--color-border, #334155)',
        backdropFilter: 'blur(4px)',
        pointerEvents: 'none',
        zIndex: 5,
      }}
    >
      <span style={{ fontSize: '0.75rem', color: '#e2e8f0', whiteSpace: 'nowrap' }}>
        Loading textures
      </span>
      <span style={{ width: 120, height: 4, borderRadius: 2, background: 'rgba(148, 163, 184, 0.3)' }}>
        <span
          style={{
            display: 'block',
            width: `${progress}%`,
            height: '100%',
            borderRadius: 2,
            background: 'var(--color-accent, #10b981)',
            transition: 'width 120ms linear',
          }}
        />
      </span>
      <span style={{ fontSize: '0.75rem', color: '#94a3b8', width: '2.5rem', textAlign: 'right' }}>
        {Math.round(progress)}%
      </span>
    </div>
  );
}
