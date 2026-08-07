import { useEffect, useRef, useState } from 'react';

/**
 * Loads a list of image URLs strictly one at a time.
 *
 * The texture grid otherwise fires ~23 requests at once, which competes with everything else
 * the page is fetching and leaves every thumbnail blank until the whole batch lands. Fetching
 * in sequence means each image appears as soon as it is ready, so the grid fills in visibly
 * from the top instead of staying empty and then popping in all at once.
 *
 * Decoded images are cached across mounts, so switching between the Walls and Floor tabs does
 * not re-download anything already fetched.
 */
const loaded = new Set<string>();

export function useSequentialImages(urls: string[]) {
  const [ready, setReady] = useState<Set<string>>(() => new Set(urls.filter((u) => loaded.has(u))));
  const [done, setDone] = useState(0);

  // `urls` gets a fresh array identity every render, so the effect keys off the joined string
  // and reads the current array through a ref. Using the array directly as a dependency would
  // restart the queue on every render.
  const urlsRef = useRef(urls);
  urlsRef.current = urls;
  const key = urls.join('|');

  useEffect(() => {
    let cancelled = false;
    const current = urlsRef.current;
    const pending = current.filter((u) => !loaded.has(u));

    setReady(new Set(current.filter((u) => loaded.has(u))));
    setDone(current.length - pending.length);

    async function run() {
      for (const url of pending) {
        if (cancelled) return;
        await new Promise<void>((resolve) => {
          const img = new Image();
          // Resolve on error too — one missing file must not stall the rest of the queue.
          img.onload = img.onerror = () => resolve();
          img.src = url;
        });
        if (cancelled) return;
        loaded.add(url);
        setReady((prev) => new Set(prev).add(url));
        setDone((n) => n + 1);
      }
    }
    run();

    return () => {
      cancelled = true;
    };
  }, [key]);

  return { ready, done, total: urls.length };
}
