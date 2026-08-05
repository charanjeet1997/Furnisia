import { useState } from 'react';
import { FiChevronUp, FiLink, FiPlus, FiX } from 'react-icons/fi';
import { furnitureCatalog, furnitureCategories, type FurnitureCategory } from '../../Data/FurnitureCatalog';
import { usePlannerStore } from '../../store/plannerStore';
import { useDeviceType } from '../../hooks/useDeviceType';
import { CategoryIcon } from './CategoryIcon';
import { trackCatalogSearch } from '../../utils/analytics';
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

    // Scan for embedded .glb or .gltf file links inside webpage HTML (Pixabay, Poly Pizza, GitHub, etc.)
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

    // Direct link to .glb / .gltf or CDN asset link
    if (/\.(glb|gltf)(\?.*)?$/i.test(trimmedUrl) || trimmedUrl.includes('cdn') || trimmedUrl.includes('/download/')) {
      addCustomItem(trimmedUrl, customName);
      setCustomUrl('');
      setCustomName('');
      setShowCustomImport(false);
      return;
    }

    // Pixabay webpage link handler: extract model ID and resolve direct 3D asset link
    const pixabayId = extractPixabayId(trimmedUrl);
    if (pixabayId) {
      setLoadingSketchfab(true);
      try {
        const slugMatch = trimmedUrl.match(/pixabay\.com\/3d-models\/([^\/]+)-\d+/i);
        const nameFromSlug = slugMatch
          ? slugMatch[1].replace(/^(glb-robot-|glb-)/i, '').replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
          : 'Pixabay 3D Model';

        const rawCdnUrl = `https://cdn.pixabay.com/download/3d-models/${pixabayId}/model.glb`;
        const directCdnUrl = `https://corsproxy.io/?${encodeURIComponent(rawCdnUrl)}`;
        addCustomItem(directCdnUrl, customName || nameFromSlug);
        setCustomUrl('');
        setCustomName('');
        setShowCustomImport(false);
        return;
      } catch (err) {
        console.warn('Pixabay auto-fetch notice:', err);
      } finally {
        setLoadingSketchfab(false);
      }
    }

    // Webpage link (Pixabay, Poly Pizza, GitHub, etc.) — attempt to extract underlying .glb link
    setLoadingSketchfab(true);
    try {
      const extracted = await fetchDirectGlbUrlFromWebpage(trimmedUrl);
      if (extracted) {
        addCustomItem(extracted.glbUrl, customName || extracted.name);
        setCustomUrl('');
        setCustomName('');
        setShowCustomImport(false);
        return;
      }

      setImportError(
        "💡 '" + trimmedUrl.replace(/^https?:\/\//, '').slice(0, 35) + "...' is a webpage link. Right-click the 'Download' button on Pixabay/PolyPizza and click 'Copy link address' to paste the direct .glb file link!"
      );
    } catch {
      setImportError("💡 Right-click the Download button on your 3D model website and select 'Copy link address' to paste the direct .glb file link!");
    } finally {
      setLoadingSketchfab(false);
    }
  }

  async function handleImportSketchfabModel(e: React.FormEvent) {
    e.preventDefault();
    setImportError('');
    const modelId = extractSketchfabId(sketchfabUrl);

    if (!modelId) {
      setImportError('Invalid Sketchfab URL or Model ID. Example: https://sketchfab.com/3d-models/table-1132fa2850a24917892733566bd68e74');
      return;
    }

    setLoadingSketchfab(true);
    try {
      let modelName = 'Sketchfab Model';

      // 1. Fetch metadata from Sketchfab API
      try {
        const metaRes = await fetch(`https://api.sketchfab.com/v3/models/${modelId}`);
        if (metaRes.ok) {
          const metaData = await metaRes.json();
          modelName = metaData.name || 'Sketchfab Model';
        }
      } catch {
        // Continue with default name if metadata request is blocked
      }

      // 2. If user entered a token, attempt authenticated download endpoint
      if (sketchfabToken) {
        try {
          const dlRes = await fetch(`https://api.sketchfab.com/v3/models/${modelId}/download`, {
            headers: { Authorization: `Token ${sketchfabToken}` },
          });
          if (dlRes.ok) {
            const dlData = await dlRes.json();
            const glbUrl = dlData.glb?.url || dlData.gltf?.url;
            if (glbUrl) {
              addCustomItem(glbUrl, modelName, sketchfabToken);
              setSketchfabUrl('');
              setShowCustomImport(false);
              return;
            }
          }
        } catch {
          // Fall through to public proxy resolver
        }
      }

      // 3. Token-free resolver: Fetch public binary model via CORS proxy wrapper
      const directGlbUrl = `https://corsproxy.io/?${encodeURIComponent(`https://media.sketchfab.com/models/${modelId}/model.glb`)}`;
      addCustomItem(directGlbUrl, modelName, sketchfabToken);
      setSketchfabUrl('');
      setShowCustomImport(false);
    } catch (err: any) {
      console.warn('Sketchfab import notice:', err);
      // Fallback: Place item with CORS proxy wrapper so canvas never errors out
      addCustomItem(`https://corsproxy.io/?${encodeURIComponent(sketchfabUrl)}`, 'Sketchfab Model', sketchfabToken);
      setSketchfabUrl('');
      setShowCustomImport(false);
    } finally {
      setLoadingSketchfab(false);
    }
  }

  function handleUseSample(sample: typeof SAMPLE_MODELS[0]) {
    addCustomItem(sample.url, sample.name);
    setShowCustomImport(false);
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

      <aside id="tour-plan-catalog" className={open ? `${styles.panel} ${styles.panelOpen}` : styles.panel}>
        <button type="button" className={styles.sheetHandle} onClick={() => setOpen((o) => !o)}>
          <span className={styles.title}>
            Furniture <span className={styles.titleCategory}>· {filter}</span>
          </span>
          {open ? <FiX size={20} /> : <FiChevronUp />}
        </button>

        {/* Custom 3D GLB/GLTF & Sketchfab Model URL Importer Accordion */}
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
              {/* Tab selector: Direct GLB vs Sketchfab */}
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
                  🎨 Sketchfab Model
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
                      💡 Must be a direct <strong>.glb</strong> or <strong>.gltf</strong> file link (e.g. GitHub raw, CDN, or file host).
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
                        onClick={() => handleUseSample(sample)}
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
                <form className={styles.customImportForm} onSubmit={handleImportSketchfabModel}>
                  <div className={styles.inputGroup}>
                    <label htmlFor="sketchfab-url">Sketchfab Page URL or Model ID:</label>
                    <input
                      id="sketchfab-url"
                      type="text"
                      placeholder="e.g. https://sketchfab.com/3d-models/table-1132fa2850a24917892733566bd68e74"
                      value={sketchfabUrl}
                      onChange={(e) => setSketchfabUrl(e.target.value)}
                      className={styles.urlInput}
                      required
                    />
                    <div className={styles.urlTipNote}>
                      🎨 Paste any Sketchfab model link or 32-char Model ID (e.g. <code>1132fa2850a24917892733566bd68e74</code>).
                    </div>
                  </div>

                  <div className={styles.inputGroup}>
                    <label htmlFor="sketchfab-token">Sketchfab API Token (optional for private/api downloads):</label>
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
                    <FiPlus size={16} /> {loadingSketchfab ? 'Fetching Sketchfab Model…' : 'Import Sketchfab Model'}
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
          <button key={item.id} type="button" className={styles.itemButton} onClick={() => addItem(item.id)}>
            {/* Full-width thumbnail slot, sized so a real product image can drop in later
                without any layout change — icon is just a placeholder until then. */}
            <span className={styles.itemThumb}>
              <CategoryIcon category={item.category} size={32} />
            </span>
            <span className={styles.itemLabel}>{item.name}</span>
          </button>
        ))}
      </div>
    </aside>
  </>
);
}
