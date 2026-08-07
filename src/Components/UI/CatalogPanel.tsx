import { useState } from 'react';
import { FiChevronUp, FiLink, FiPlus } from 'react-icons/fi';
import { furnitureCatalog, furnitureCategories, type FurnitureCategory } from '../../Data/FurnitureCatalog';
import { usePlannerStore } from '../../store/plannerStore';
import { useDeviceType } from '../../hooks/useDeviceType';
import { CategoryIcon } from './CategoryIcon';
import { trackCatalogSearch } from '../../utils/analytics';
import { getAssetUrl } from '../../utils/assetUrl';
import styles from './CatalogPanel.module.css';

const ALL = 'All' as const;
type ChipFilter = FurnitureCategory | typeof ALL;
const chipFilters: ChipFilter[] = [ALL, ...furnitureCategories];

type CellSize = 'sm' | 'md' | 'lg';
const CELL_SIZES: { key: CellSize; label: string; cols: number }[] = [
  { key: 'sm', label: 'Compact', cols: 3 },
  { key: 'md', label: 'Comfortable', cols: 2 },
  { key: 'lg', label: 'Large', cols: 1 },
];
const gridClassBySize: Record<CellSize, string | undefined> = { sm: 'itemGridSm', md: undefined, lg: 'itemGridLg' };

const SAMPLE_MODELS = [
  {
    name: 'Sheen Chair',
    icon: '🛋️',
    url: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/SheenChair/glTF-Binary/SheenChair.glb',
  },
  {
    name: 'Avocado',
    icon: '🥑',
    url: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/Avocado/glTF-Binary/Avocado.glb',
  },
  {
    name: 'Rubber Duck',
    icon: '🦆',
    url: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/Duck/glTF-Binary/Duck.glb',
  },
];

export function extractPixabayId(urlOrId: string): string | null {
  const trimmed = urlOrId.trim();
  if (/^\d+$/.test(trimmed)) {
    return trimmed;
  }
  const match = trimmed.match(/pixabay\.com\/3d-models\/.*-(\d+)\/?/i);
  return match ? match[1] : null;
}

export function extractSketchfabId(urlOrId: string): string | null {
  const trimmed = urlOrId.trim();
  if (/^[a-f0-9]{32}$/i.test(trimmed)) {
    return trimmed.toLowerCase();
  }
  const match = trimmed.match(/sketchfab\.com\/(?:3d-models\/[^\/]+-|models\/)([a-f0-9]{32})/i);
  return match ? match[1].toLowerCase() : null;
}

export async function fetchDirectGlbUrlFromWebpage(pageUrl: string): Promise<{ glbUrl: string; name: string } | null> {
  try {
    const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(pageUrl)}`;
    const res = await fetch(proxyUrl);
    if (!res.ok) return null;
    const htmlText = await res.text();

    const glbMatch = htmlText.match(/https?:\/\/[^"'\s]+\.(?:glb|gltf)(?:\?[^"'\s]*)?/i) ||
      htmlText.match(/\/[^"'\s]+\.(?:glb|gltf)(?:\?[^"'\s]*)?/i);

    if (glbMatch) {
      let foundUrl = glbMatch[0];
      if (foundUrl.startsWith('/')) {
        const origin = new URL(pageUrl).origin;
        foundUrl = `${origin}${foundUrl}`;
      }

      const titleMatch = htmlText.match(/<title>([^<]+)<\/title>/i);
      const name = titleMatch ? titleMatch[1].split('-')[0].split('|')[0].split(':')[0].trim() : 'Imported 3D Model';

      return { glbUrl: foundUrl, name };
    }
  } catch (err) {
    console.warn('Webpage GLB scraping notice:', err);
  }
  return null;
}



function CatalogItemCard({ item, onAdd }: { item: { id: string; name: string; category: FurnitureCategory; thumbnailPath?: string }; onAdd: () => void }) {
  const [loaded, setLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  return (
    <button type="button" className={styles.itemButton} onClick={onAdd}>
      <span className={styles.itemThumb}>
        <CategoryIcon category={item.category} size={32} />
        {item.thumbnailPath && !hasError && (
          <img
            src={getAssetUrl(item.thumbnailPath)}
            alt={item.name}
            className={styles.thumbImage}
            style={{
              opacity: loaded ? 1 : 0,
              transition: 'opacity 0.25s ease, transform var(--duration-hover) var(--ease-standard)',
            }}
            loading="lazy"
            decoding="async"
            onLoad={() => setLoaded(true)}
            onError={() => setHasError(true)}
          />
        )}
        {item.thumbnailPath && !loaded && !hasError && (
          <div className={styles.loadingProgressBarContainer}>
            <div className={styles.loadingProgressBarTrack}>
              <div className={styles.loadingProgressBarFill} />
            </div>
          </div>
        )}
      </span>
      <span className={styles.itemLabel}>{item.name}</span>
    </button>
  );
}

export function CatalogPanel() {
  const addItem = usePlannerStore((state) => state.addItem);
  const addCustomItem = usePlannerStore((state) => state.addCustomItem);
  const open = usePlannerStore((state) => state.isCatalogOpen);
  const setOpen = usePlannerStore((state) => state.setCatalogOpen);
  const { isPhone, isTablet } = useDeviceType();
  const isMobileDevice = isPhone || isTablet;

  const [filter, setFilter] = useState<ChipFilter>(ALL);
  const [cellSize, setCellSize] = useState<CellSize>('md');
  const [showCustomImport, setShowCustomImport] = useState(false);
  const [importTab, setImportTab] = useState<'glb' | 'sketchfab'>('glb');
  const [customUrl, setCustomUrl] = useState('');
  const [customName, setCustomName] = useState('');
  const [sketchfabUrl, setSketchfabUrl] = useState('');
  const [sketchfabToken, setSketchfabToken] = useState(() => localStorage.getItem('furnisia_sketchfab_token') || '');
  const [loadingSketchfab, setLoadingSketchfab] = useState(false);
  const [importError, setImportError] = useState('');

  const items = filter === ALL ? furnitureCatalog : furnitureCatalog.filter((item) => item.category === filter);
  const gridSizeClass = gridClassBySize[cellSize];
  const itemGridClassName = gridSizeClass ? `${styles.itemGrid} ${styles[gridSizeClass]}` : styles.itemGrid;

  async function handleImportCustomModel(e: React.FormEvent) {
    e.preventDefault();
    setImportError('');
    const trimmedUrl = customUrl.trim();
    if (!trimmedUrl) {
      setImportError('Please enter a 3D model URL or link.');
      return;
    }
    if (!trimmedUrl.startsWith('http://') && !trimmedUrl.startsWith('https://')) {
      setImportError('URL must start with http:// or https://');
      return;
    }

    if (/\.(glb|gltf)(\?.*)?$/i.test(trimmedUrl) || trimmedUrl.includes('cdn') || trimmedUrl.includes('/download/')) {
      addCustomItem(trimmedUrl, customName);
      setCustomUrl('');
      setCustomName('');
      setShowCustomImport(false);
      return;
    }

    const sfId = extractSketchfabId(trimmedUrl);
    if (sfId) {
      handleImportSketchfabById(sfId, customName);
      return;
    }

    const scraped = await fetchDirectGlbUrlFromWebpage(trimmedUrl);
    if (scraped) {
      addCustomItem(scraped.glbUrl, customName || scraped.name);
      setCustomUrl('');
      setCustomName('');
      setShowCustomImport(false);
      return;
    }

    setImportError('Could not locate a valid .glb/.gltf 3D file at this link.');
  }

  async function handleImportSketchfabById(modelId: string, overrideName?: string) {
    setImportError('');
    setLoadingSketchfab(true);
    try {
      const headers: Record<string, string> = {};
      if (sketchfabToken) {
        headers['Authorization'] = `Token ${sketchfabToken}`;
      }
      const res = await fetch(`https://api.sketchfab.com/v3/models/${modelId}/download`, { headers });
      if (!res.ok) {
        if (res.status === 401) {
          throw new Error('Sketchfab API Token required for this model. Add your token below.');
        }
        throw new Error(`Sketchfab API error (${res.status}). Check model ID or token.`);
      }
      const data = await res.json();
      const glbUrl = data.glb?.url || data.gltf?.url;

      if (!glbUrl) {
        throw new Error('No downloadable GLB format found for this Sketchfab model.');
      }

      addCustomItem(glbUrl, overrideName || 'Sketchfab Model', sketchfabToken);
      setSketchfabUrl('');
      setShowCustomImport(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to download Sketchfab model.';
      setImportError(msg);
    } finally {
      setLoadingSketchfab(false);
    }
  }

  return (
    <>
      {isMobileDevice && !open && (
        <button
          type="button"
          className={styles.mobileFabButton}
          onClick={() => setOpen(true)}
          title="Add Furniture"
          aria-label="Add Furniture"
        >
          <FiPlus size={28} />
        </button>
      )}

      <aside className={`${styles.panel} ${open ? styles.panelOpen : ''}`}>
        <button
          type="button"
          className={styles.sheetHandle}
          onClick={() => isMobileDevice && setOpen((prev) => !prev)}
          aria-label={open ? 'Close catalog' : 'Open catalog'}
        >
          <span className={styles.title}>
            Catalog <span className={styles.titleCategory}>{filter}</span>
          </span>
          <FiChevronUp
            size={18}
            style={{
              transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s ease',
            }}
          />
        </button>

        <div className={styles.customImportBox}>
              <button
                type="button"
                className={styles.customImportToggle}
                onClick={() => setShowCustomImport((prev) => !prev)}
              >
                <FiLink size={16} />
                <span>Import Custom 3D / Sketchfab Model</span>
                <span className={styles.toggleArrow}>{showCustomImport ? '▲' : '▼'}</span>
              </button>

              {showCustomImport && (
                <div className={styles.customImportBody}>
                  <div className={styles.importTabRow}>
                    <button
                      type="button"
                      className={importTab === 'glb' ? styles.importTabActive : styles.importTab}
                      onClick={() => { setImportTab('glb'); setImportError(''); }}
                    >
                      Direct GLB URL
                    </button>
                    <button
                      type="button"
                      className={importTab === 'sketchfab' ? styles.importTabActive : styles.importTab}
                      onClick={() => { setImportTab('sketchfab'); setImportError(''); }}
                    >
                      🎨 Sketchfab
                    </button>
                  </div>

                  {importTab === 'glb' ? (
                    <form className={styles.customImportForm} onSubmit={handleImportCustomModel}>
                      <div className={styles.inputGroup}>
                        <label htmlFor="custom-glb-url">Direct GLB / GLTF URL:</label>
                        <input
                          id="custom-glb-url"
                          type="url"
                          placeholder="https://domain.com/model.glb"
                          value={customUrl}
                          onChange={(e) => setCustomUrl(e.target.value)}
                          className={styles.urlInput}
                          required
                        />
                        <div className={styles.urlTipNote}>
                          💡 Must be a direct <strong>.glb</strong> or <strong>.gltf</strong> file link.
                        </div>
                      </div>

                      <div className={styles.inputGroup}>
                        <label htmlFor="custom-glb-name">Model Name (optional):</label>
                        <input
                          id="custom-glb-name"
                          type="text"
                          placeholder="e.g. Designer Velvet Sofa"
                          value={customName}
                          onChange={(e) => setCustomName(e.target.value)}
                          className={styles.urlInput}
                        />
                      </div>

                      {importError && <div className={styles.errorHint}>{importError}</div>}

                      <div className={styles.sampleHeader}>Quick Test Sample Models:</div>
                      <div className={styles.samplePillsRow}>
                        {SAMPLE_MODELS.map((sample) => (
                          <button
                            key={sample.name}
                            type="button"
                            className={styles.samplePill}
                            onClick={() => { addCustomItem(sample.url, sample.name); setShowCustomImport(false); }}
                            title={`Import ${sample.name}`}
                          >
                            {sample.icon} {sample.name}
                          </button>
                        ))}
                      </div>

                      <button type="submit" className={styles.importSubmitBtn}>
                        <FiPlus size={16} /> Place Model in Room
                      </button>
                    </form>
                  ) : (
                    <form className={styles.customImportForm} onSubmit={(e) => {
                      e.preventDefault();
                      const sfId = extractSketchfabId(sketchfabUrl);
                      if (sfId) { handleImportSketchfabById(sfId, customName); }
                      else { setImportError('Invalid Sketchfab URL or Model ID.'); }
                    }}>
                      <div className={styles.inputGroup}>
                        <label htmlFor="sketchfab-url">Sketchfab Page URL or Model ID:</label>
                        <input
                          id="sketchfab-url"
                          type="text"
                          placeholder="e.g. https://sketchfab.com/3d-models/table-..."
                          value={sketchfabUrl}
                          onChange={(e) => setSketchfabUrl(e.target.value)}
                          className={styles.urlInput}
                          required
                        />
                      </div>
                      <div className={styles.inputGroup}>
                        <label htmlFor="sketchfab-token">Sketchfab API Token (optional for private models):</label>
                        <input
                          id="sketchfab-token"
                          type="password"
                          placeholder="Your free Sketchfab API Token"
                          value={sketchfabToken}
                          onChange={(e) => {
                            setSketchfabToken(e.target.value);
                            localStorage.setItem('furnisia_sketchfab_token', e.target.value);
                          }}
                          className={styles.urlInput}
                        />
                      </div>
                      {importError && <div className={styles.errorHint}>{importError}</div>}
                      <button type="submit" className={styles.importSubmitBtn} disabled={loadingSketchfab}>
                        <FiPlus size={16} /> {loadingSketchfab ? 'Fetching...' : 'Import Sketchfab Model'}
                      </button>
                    </form>
                  )}
                </div>
              )}
            </div>

            <div className={styles.categoryChips}>
              {chipFilters.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  className={cat === filter ? styles.chipActive : styles.chip}
                  onClick={() => {
                    setFilter(cat);
                    trackCatalogSearch('', cat);
                  }}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className={styles.sizeToggle}>
              {CELL_SIZES.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  className={cellSize === s.key ? styles.sizeButtonActive : styles.sizeButton}
                  onClick={() => setCellSize(s.key)}
                  aria-label={`${s.label} cell size`}
                  title={s.label}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4} aria-hidden="true">
                    {Array.from({ length: s.cols }, (_, i) => {
                      const w = 14 / s.cols - 1;
                      return <rect key={i} x={1 + i * (w + 1)} y={4} width={w} height={8} rx={1} />;
                    })}
                  </svg>
                </button>
              ))}
            </div>

            <div className={itemGridClassName}>
              {items.map((item) => (
                <CatalogItemCard key={item.id} item={item} onAdd={() => addItem(item.id)} />
              ))}
            </div>
      </aside>
    </>
  );
}
