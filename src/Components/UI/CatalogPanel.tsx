import { useState } from 'react';
import { FiChevronUp, FiLink, FiPlus } from 'react-icons/fi';
import { furnitureCatalog, furnitureCategories, type FurnitureCategory } from '../../Data/FurnitureCatalog';
import textureCatalog from '../../Data/textureCatalog.json';
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

const WALL_PRESETS = [
  { name: 'Warm Off-White', color: '#f5f0e6' },
  { name: 'Pure White', color: '#ffffff' },
  { name: 'Modern Slate', color: '#475569' },
  { name: 'Sage Green', color: '#84a98c' },
  { name: 'Dusty Navy', color: '#2b3a4a' },
  { name: 'Warm Terracotta', color: '#c87d55' },
  { name: 'Cool Gray', color: '#94a3b8' },
  { name: 'Cream Vanilla', color: '#fff8e7' },
  { name: 'Charcoal Dark', color: '#1e293b' },
  { name: 'Blush Pink', color: '#e8b4b8' },
];

const FLOOR_PRESETS = [
  { name: 'Warm Oak', color: '#c9a978' },
  { name: 'Dark Walnut', color: '#4a3525' },
  { name: 'Honey Maple', color: '#d4a359' },
  { name: 'Nordic Light Pine', color: '#e5d5c0' },
  { name: 'Slate Gray', color: '#64748b' },
  { name: 'Midnight Ebony', color: '#211a1d' },
  { name: 'Terracotta Tile', color: '#b85b35' },
  { name: 'Pure White', color: '#f8fafc' },
  { name: 'Golden Teak', color: '#a67c52' },
];

const CEILING_PRESETS = [
  { name: 'Chantilly Lace', color: '#fbfcfb' },
  { name: 'Swiss Coffee', color: '#f3eee4' },
  { name: 'Decorators White', color: '#f4f5f3' },
  { name: 'Simply White', color: '#f7f5ed' },
  { name: 'Parisian Greige', color: '#e4dfd5' },
  { name: 'Atmospheric Sky', color: '#e6ecf2' },
  { name: 'Eucalyptus Whisper', color: '#d9e2dc' },
  { name: 'Warm Sandstone', color: '#e8decb' },
  { name: 'Architectural Charcoal', color: '#36393e' },
];

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

  const [mainTab, setMainTab] = useState<'furniture' | 'walls' | 'floors' | 'ceiling'>('furniture');
  const [finishTab, setFinishTab] = useState<'color' | 'texture'>('color');

  const setWallColor = usePlannerStore((state) => state.setWallColor);
  const setFloorColor = usePlannerStore((state) => state.setFloorColor);
  const setCeilingColor = usePlannerStore((state) => state.setCeilingColor);
  const setWallTexture = usePlannerStore((state) => state.setWallTexture);
  const setFloorTexture = usePlannerStore((state) => state.setFloorTexture);
  const setWallTextureScaleX = usePlannerStore((state) => state.setWallTextureScaleX);
  const setWallTextureScaleY = usePlannerStore((state) => state.setWallTextureScaleY);
  const setFloorTextureScaleX = usePlannerStore((state) => state.setFloorTextureScaleX);
  const setFloorTextureScaleY = usePlannerStore((state) => state.setFloorTextureScaleY);

  const wallColor = usePlannerStore((state) => state.room.wallColor);
  const floorColor = usePlannerStore((state) => state.room.floorColor);
  const ceilingColor = usePlannerStore((state) => state.room.ceilingColor) ?? '#f8fafc';
  const currentWallTexture = usePlannerStore((state) => state.room.wallTexture);
  const currentFloorTexture = usePlannerStore((state) => state.room.floorTexture);
  const currentWallScaleX = usePlannerStore((state) => state.room.wallTextureScaleX) ?? 2;
  const currentWallScaleY = usePlannerStore((state) => state.room.wallTextureScaleY) ?? 2;
  const currentFloorScaleX = usePlannerStore((state) => state.room.floorTextureScaleX) ?? 3;
  const currentFloorScaleY = usePlannerStore((state) => state.room.floorTextureScaleY) ?? 3;

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
            Catalog <span className={styles.titleCategory}>{mainTab === 'furniture' ? filter : mainTab}</span>
          </span>
          <FiChevronUp
            size={18}
            style={{
              transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s ease',
            }}
          />
        </button>

        {/* Top Tab Switcher: Furniture | Walls | Floor | Ceiling */}
        <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '0.85rem' }}>
          <button
            type="button"
            className={mainTab === 'furniture' ? styles.chipActive : styles.chip}
            style={{ flex: 1, justifyContent: 'center', fontSize: '0.7rem', padding: '0.35rem 0.15rem' }}
            onClick={() => setMainTab('furniture')}
          >
            🪑 Items
          </button>
          <button
            type="button"
            className={mainTab === 'walls' ? styles.chipActive : styles.chip}
            style={{ flex: 1, justifyContent: 'center', fontSize: '0.7rem', padding: '0.35rem 0.15rem' }}
            onClick={() => setMainTab('walls')}
          >
            🧱 Walls
          </button>
          <button
            type="button"
            className={mainTab === 'floors' ? styles.chipActive : styles.chip}
            style={{ flex: 1, justifyContent: 'center', fontSize: '0.7rem', padding: '0.35rem 0.15rem' }}
            onClick={() => setMainTab('floors')}
          >
            🪵 Floor
          </button>
          <button
            type="button"
            className={mainTab === 'ceiling' ? styles.chipActive : styles.chip}
            style={{ flex: 1, justifyContent: 'center', fontSize: '0.7rem', padding: '0.35rem 0.15rem' }}
            onClick={() => {
              setMainTab('ceiling');
              setFinishTab('color');
            }}
          >
            🏠 Ceiling
          </button>
        </div>

        {mainTab === 'furniture' ? (
          <>
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
                <button key={item.id} type="button" className={styles.itemButton} onClick={() => addItem(item.id)}>
                  <span className={styles.itemThumb}>
                    <CategoryIcon category={item.category} size={32} />
                    {item.thumbnailPath && (
                      <img
                        src={item.thumbnailPath}
                        alt={item.name}
                        className={styles.thumbImage}
                        loading="lazy"
                        onError={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; }}
                      />
                    )}
                  </span>
                  <span className={styles.itemLabel}>{item.name}</span>
                </button>
              ))}
            </div>
          </>
        ) : (
          /* Surface Finish Content (Walls, Floors, Ceiling) */
          <>
            {/* Sub-finish Switcher: Colors vs Textures (Hidden for Ceiling) */}
            {mainTab !== 'ceiling' && (
              <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1rem' }}>
                <button
                  type="button"
                  className={finishTab === 'color' ? styles.chipActive : styles.chip}
                  style={{ flex: 1, justifyContent: 'center' }}
                  onClick={() => setFinishTab('color')}
                >
                  🎨 Solid Color
                </button>
                <button
                  type="button"
                  className={finishTab === 'texture' ? styles.chipActive : styles.chip}
                  style={{ flex: 1, justifyContent: 'center' }}
                  onClick={() => setFinishTab('texture')}
                >
                  🖼️ Textures ({mainTab === 'floors' ? textureCatalog.floors.length : textureCatalog.walls.length})
                </button>
              </div>
            )}

            {finishTab === 'color' || mainTab === 'ceiling' ? (
              /* Color Picker & Palettes */
              <div style={{ background: 'var(--color-surface-2)', padding: '0.85rem', borderRadius: 'var(--radius-md)', marginBottom: '1rem' }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 700, marginBottom: '0.6rem', color: 'var(--color-text)' }}>
                  Custom {mainTab === 'floors' ? 'Floor' : mainTab === 'walls' ? 'Wall' : 'Ceiling'} Color Selector:
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1rem' }}>
                  <input
                    type="color"
                    value={mainTab === 'floors' ? floorColor : mainTab === 'walls' ? wallColor : ceilingColor}
                    onChange={(e) => {
                      const colorVal = e.target.value;
                      if (mainTab === 'floors') {
                        setFloorColor(colorVal);
                        setFloorTexture(undefined);
                      } else if (mainTab === 'walls') {
                        setWallColor(colorVal);
                        setWallTexture(undefined);
                      } else {
                        setCeilingColor(colorVal);
                      }
                    }}
                    style={{
                      width: 44,
                      height: 44,
                      border: 'none',
                      borderRadius: '50%',
                      cursor: 'pointer',
                      background: 'none',
                    }}
                  />
                  <input
                    type="text"
                    value={mainTab === 'floors' ? floorColor : mainTab === 'walls' ? wallColor : ceilingColor}
                    onChange={(e) => {
                      const colorVal = e.target.value;
                      if (mainTab === 'floors') setFloorColor(colorVal);
                      else if (mainTab === 'walls') setWallColor(colorVal);
                      else setCeilingColor(colorVal);
                    }}
                    placeholder="#ffffff"
                    style={{
                      flex: 1,
                      padding: '0.45rem 0.6rem',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--color-border)',
                      background: 'var(--color-surface)',
                      color: 'var(--color-text)',
                      fontFamily: 'monospace',
                      fontWeight: 600,
                      fontSize: '0.85rem',
                    }}
                  />
                </div>

                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '0.5rem' }}>
                  Recommended Color Palettes:
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.45rem' }}>
                  {(mainTab === 'floors' ? FLOOR_PRESETS : mainTab === 'walls' ? WALL_PRESETS : CEILING_PRESETS).map((p) => {
                    const activeColor = mainTab === 'floors' ? floorColor : mainTab === 'walls' ? wallColor : ceilingColor;
                    const isSelected = activeColor.toLowerCase() === p.color.toLowerCase();
                    return (
                      <button
                        key={p.name}
                        type="button"
                        onClick={() => {
                          if (mainTab === 'floors') {
                            setFloorColor(p.color);
                            setFloorTexture(undefined);
                          } else if (mainTab === 'walls') {
                            setWallColor(p.color);
                            setWallTexture(undefined);
                          } else {
                            setCeilingColor(p.color);
                          }
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.45rem',
                          padding: '0.35rem 0.5rem',
                          borderRadius: 'var(--radius-sm)',
                          border: isSelected ? '2px solid var(--color-accent)' : '1px solid var(--color-border)',
                          background: 'var(--color-surface)',
                          cursor: 'pointer',
                          textAlign: 'left',
                        }}
                      >
                        <span
                          style={{
                            width: 18,
                            height: 18,
                            borderRadius: '50%',
                            background: p.color,
                            border: '1px solid rgba(0,0,0,0.2)',
                            flexShrink: 0,
                          }}
                        />
                        <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {p.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* Textures Grid & Tiling Controls */
              <>
                <div style={{ marginBottom: '0.85rem' }}>
                  <button
                    type="button"
                    className={styles.chip}
                    style={{ width: '100%', justifyContent: 'center', background: 'var(--color-surface-2)' }}
                    onClick={() => {
                      if (mainTab === 'floors') setFloorTexture(undefined);
                      else setWallTexture(undefined);
                    }}
                  >
                    🚫 Remove {mainTab === 'floors' ? 'Floor' : 'Wall'} Texture
                  </button>
                </div>

                {/* Tiling X & Y Sliders */}
                <div style={{ background: 'var(--color-surface-2)', padding: '0.6rem 0.8rem', borderRadius: 'var(--radius-sm)', marginBottom: '0.85rem' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text)', marginBottom: '0.4rem' }}>
                    📏 Texture Tiling (Repeat Density):
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>
                        <span>↔️ Tiling X (Horizontal):</span>
                        <span style={{ fontFamily: 'monospace', color: 'var(--color-accent)', fontWeight: 700 }}>
                          {mainTab === 'floors' ? `${currentFloorScaleX}x` : `${currentWallScaleX}x`}
                        </span>
                      </div>
                      <input
                        type="range"
                        min={1}
                        max={10}
                        step={1}
                        value={mainTab === 'floors' ? currentFloorScaleX : currentWallScaleX}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          if (mainTab === 'floors') setFloorTextureScaleX(val);
                          else setWallTextureScaleX(val);
                        }}
                        style={{ width: '100%', cursor: 'pointer', accentColor: 'var(--color-accent)' }}
                      />
                    </div>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>
                        <span>↕️ Tiling Y (Vertical):</span>
                        <span style={{ fontFamily: 'monospace', color: 'var(--color-accent)', fontWeight: 700 }}>
                          {mainTab === 'floors' ? `${currentFloorScaleY}x` : `${currentWallScaleY}x`}
                        </span>
                      </div>
                      <input
                        type="range"
                        min={1}
                        max={10}
                        step={1}
                        value={mainTab === 'floors' ? currentFloorScaleY : currentWallScaleY}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          if (mainTab === 'floors') setFloorTextureScaleY(val);
                          else setWallTextureScaleY(val);
                        }}
                        style={{ width: '100%', cursor: 'pointer', accentColor: 'var(--color-accent)' }}
                      />
                    </div>
                  </div>
                </div>

                <div className={styles.itemGrid}>
                  {(mainTab === 'floors' ? textureCatalog.floors : textureCatalog.walls).map((tex) => {
                    const activeTexture = mainTab === 'floors' ? currentFloorTexture : currentWallTexture;
                    const isSelected = activeTexture === tex.texturePath;
                    return (
                      <button
                        key={tex.id}
                        type="button"
                        className={styles.itemButton}
                        style={{ border: isSelected ? '2px solid var(--color-accent)' : '1px solid var(--color-border)', position: 'relative' }}
                        onClick={() => {
                          if (mainTab === 'floors') {
                            setFloorTexture(isSelected ? undefined : tex.texturePath);
                            if (!isSelected) setFloorColor('#ffffff');
                          } else {
                            setWallTexture(isSelected ? undefined : tex.texturePath);
                            if (!isSelected) setWallColor('#ffffff');
                          }
                        }}
                      >
                        <span className={styles.itemThumb}>
                          <img src={tex.previewPath} alt={tex.name} className={styles.thumbImage} loading="lazy" style={{ objectFit: 'cover' }} />
                        </span>
                        <span className={styles.itemLabel}>{tex.name}</span>
                        {isSelected && (
                          <span
                            style={{
                              position: 'absolute',
                              top: 4,
                              right: 4,
                              background: 'var(--color-accent)',
                              color: '#fff',
                              fontSize: '0.65rem',
                              padding: '2px 6px',
                              borderRadius: '10px',
                              fontWeight: 700,
                            }}
                          >
                            Active
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </>
        )}
      </aside>
    </>
  );
}
