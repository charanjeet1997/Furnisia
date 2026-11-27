import { useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { ContactShadows } from '@react-three/drei';
import { Room } from '../../Components/Room';
import { RoomOrbitControls } from '../../Components/RoomOrbitControls';
import { roomFraming } from '../../Components/roomFraming';
import { TextureLoadingBar } from '../../Components/TextureLoadingBar';
import type { RoomOpening, RoomVertex, InteriorWall, RoomShape } from '../../Data/RoomShape';
import textureCatalog from '../../Data/textureCatalog.json';
import { useSequentialImages } from './hooks/useSequentialImages';
import styles from './RoomBuilder.module.css';

interface StepStyleProps {
  wallColor: string;
  floorColor: string;
  ceilingColor?: string;
  wallTexture?: string;
  floorTexture?: string;
  onWallColorChange: (color: string) => void;
  onFloorColorChange: (color: string) => void;
  onCeilingColorChange?: (color: string) => void;
  onWallTextureChange: (texture?: string) => void;
  onFloorTextureChange: (texture?: string) => void;
  vertices: RoomVertex[];
  height: number;
  wallThickness: number;
  edgeThicknesses: number[];
  openings: RoomOpening[];
  interiorWalls: InteriorWall[];
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

export function StepStyle({
  wallColor,
  floorColor,
  ceilingColor = '#f8fafc',
  wallTexture,
  floorTexture,
  onWallColorChange,
  onFloorColorChange,
  onCeilingColorChange,
  onWallTextureChange,
  onFloorTextureChange,
  vertices,
  height,
  wallThickness,
  edgeThicknesses,
  openings,
  interiorWalls,
}: StepStyleProps) {
  const [surface, setSurface] = useState<'floors' | 'walls' | 'ceiling'>('walls');
  const [finishType, setFinishType] = useState<'color' | 'texture'>('color');
  const [wallScaleX, setWallScaleX] = useState<number>(1);
  const [wallScaleY, setWallScaleY] = useState<number>(1);
  const [floorScaleX, setFloorScaleX] = useState<number>(1);
  const [floorScaleY, setFloorScaleY] = useState<number>(1);

  // Thumbnails for the visible tab only, fetched one at a time so the grid fills in gradually
  // rather than every tile staying blank until the whole batch arrives.
  const previewUrls = useMemo(
    () => (surface === 'walls' ? textureCatalog.walls : textureCatalog.floors).map((t) => t.previewPath),
    [surface],
  );
  const thumbs = useSequentialImages(previewUrls);

  // Contact shadows were a fixed 20 m square; cover the whole footprint for big rooms.
  const { width: roomWidth, depth: roomDepth } = roomFraming(vertices, height, 48);
  const shadowScale = Math.max(20, Math.max(roomWidth, roomDepth) + 4);

  // Transient Room Object for Realtime 3D Rendering in the Preview Canvas
  const roomOverride: RoomShape = useMemo(
    () => ({
      id: 'preview',
      name: 'Preview Room',
      vertices,
      height,
      wallThickness,
      edgeThicknesses,
      wallColor,
      floorColor,
      ceilingColor,
      wallTexture,
      floorTexture,
      wallTextureScaleX: wallScaleX,
      wallTextureScaleY: wallScaleY,
      floorTextureScaleX: floorScaleX,
      floorTextureScaleY: floorScaleY,
      openings,
      interiorWalls,
    }),
    [
      vertices,
      height,
      wallThickness,
      edgeThicknesses,
      wallColor,
      floorColor,
      ceilingColor,
      wallTexture,
      floorTexture,
      wallScaleX,
      wallScaleY,
      floorScaleX,
      floorScaleY,
      openings,
      interiorWalls,
    ],
  );

  return (
    <div className={styles.dimensionsLayout}>
      {/* Left Control Column: Color & Texture Selection */}
      <div className={styles.controlsSection} style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, boxSizing: 'border-box' }}>
        <div style={{ flexShrink: 0 }}>
          <h2 className={styles.stepTitle} style={{ marginBottom: '0.2rem' }}>
            Room Finishes
          </h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', margin: '0 0 0.75rem 0' }}>
            Select custom colors or textures for your room.
          </p>

          {/* Top Surface Switcher: Walls vs Floor vs Ceiling */}
          <div style={{ display: 'flex', gap: '0.3rem', marginBottom: '0.6rem' }}>
            <button
              type="button"
              className={surface === 'walls' ? styles.pillActive : styles.pill}
              style={{ flex: 1, justifyContent: 'center', fontSize: '0.78rem' }}
              onClick={() => setSurface('walls')}
            >
              🧱 Walls
            </button>
            <button
              type="button"
              className={surface === 'floors' ? styles.pillActive : styles.pill}
              style={{ flex: 1, justifyContent: 'center', fontSize: '0.78rem' }}
              onClick={() => setSurface('floors')}
            >
              🪵 Floor
            </button>
            <button
              type="button"
              className={surface === 'ceiling' ? styles.pillActive : styles.pill}
              style={{ flex: 1, justifyContent: 'center', fontSize: '0.78rem' }}
              onClick={() => {
                setSurface('ceiling');
                setFinishType('color'); // Force color mode for ceiling
              }}
            >
              🏠 Ceiling
            </button>
          </div>

          {/* Sub-Finish Type Switcher: 🎨 Colors vs 🖼️ Textures (Hidden for Ceiling) */}
          {surface !== 'ceiling' && (
            <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.85rem' }}>
              <button
                type="button"
                className={finishType === 'color' ? styles.swatchActive : styles.swatch}
                style={{ flex: 1, textAlign: 'center', padding: '0.4rem' }}
                onClick={() => setFinishType('color')}
              >
                🎨 Colors
              </button>
              <button
                type="button"
                className={finishType === 'texture' ? styles.swatchActive : styles.swatch}
                style={{ flex: 1, textAlign: 'center', padding: '0.4rem' }}
                onClick={() => setFinishType('texture')}
              >
                🖼️ Textures
              </button>
            </div>
          )}
        </div>

        {/* Scrollable Content Area: ONLY this part scrolls */}
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', paddingRight: '4px' }}>
          {finishType === 'color' || surface === 'ceiling' ? (
            <div>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                Custom {surface === 'walls' ? 'Wall' : surface === 'floors' ? 'Floor' : 'Ceiling'} Color Selector:
              </div>

              {/* Native HTML5 Color Picker + HEX Code Input */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
                <input
                  type="color"
                  value={surface === 'walls' ? wallColor : surface === 'floors' ? floorColor : ceilingColor}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (surface === 'walls') {
                      onWallColorChange(val);
                      onWallTextureChange(undefined);
                    } else if (surface === 'floors') {
                      onFloorColorChange(val);
                      onFloorTextureChange(undefined);
                    } else {
                      onCeilingColorChange?.(val);
                    }
                  }}
                  style={{
                    width: 48,
                    height: 48,
                    border: 'none',
                    borderRadius: '50%',
                    cursor: 'pointer',
                    background: 'none',
                  }}
                />
                <input
                  type="text"
                  value={surface === 'walls' ? wallColor : surface === 'floors' ? floorColor : ceilingColor}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (surface === 'walls') onWallColorChange(val);
                    else if (surface === 'floors') onFloorColorChange(val);
                    else onCeilingColorChange?.(val);
                  }}
                  placeholder="#ffffff"
                  style={{
                    flex: 1,
                    padding: '0.5rem 0.75rem',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--color-border)',
                    background: 'var(--color-bg)',
                    color: 'var(--color-text)',
                    fontFamily: 'monospace',
                    fontWeight: 600,
                    fontSize: '0.9rem',
                  }}
                />
              </div>

              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: '0.6rem' }}>
                Curated Color Palettes:
              </div>

              {/* Preset Color Swatches */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
                {(surface === 'walls' ? WALL_PRESETS : surface === 'floors' ? FLOOR_PRESETS : CEILING_PRESETS).map((preset) => {
                  const activeColor = surface === 'walls' ? wallColor : surface === 'floors' ? floorColor : ceilingColor;
                  const isSelected = activeColor.toLowerCase() === preset.color.toLowerCase();
                  return (
                    <button
                      key={preset.name}
                      type="button"
                      onClick={() => {
                        if (surface === 'walls') {
                          onWallColorChange(preset.color);
                          onWallTextureChange(undefined);
                        } else if (surface === 'floors') {
                          onFloorColorChange(preset.color);
                          onFloorTextureChange(undefined);
                        } else {
                          onCeilingColorChange?.(preset.color);
                        }
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.45rem 0.6rem',
                        borderRadius: 'var(--radius-sm)',
                        border: isSelected ? '2px solid var(--color-accent)' : '1px solid var(--color-border)',
                        background: 'var(--color-bg)',
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      <span
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: '50%',
                          background: preset.color,
                          border: '1px solid rgba(0,0,0,0.25)',
                          flexShrink: 0,
                        }}
                      />
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {preset.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            /* HD Textures Grid */
            <div>
              {/* Tiling X & Tiling Y Sliders */}
              <div style={{ background: 'var(--color-bg)', padding: '0.65rem 0.85rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', marginBottom: '0.85rem' }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-text)', marginBottom: '0.5rem' }}>
                  📏 Texture Tiling (Repeat Density):
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>
                      <span>↔️ Tiling X (Horizontal):</span>
                      <span style={{ fontFamily: 'monospace', color: 'var(--color-accent)', fontWeight: 700 }}>
                        {surface === 'floors' ? `${floorScaleX}x` : `${wallScaleX}x`}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={10}
                      step={1}
                      value={surface === 'floors' ? floorScaleX : wallScaleX}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        if (surface === 'floors') setFloorScaleX(val);
                        else setWallScaleX(val);
                      }}
                      style={{ width: '100%', cursor: 'pointer', accentColor: 'var(--color-accent)' }}
                    />
                  </div>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>
                      <span>↕️ Tiling Y (Vertical):</span>
                      <span style={{ fontFamily: 'monospace', color: 'var(--color-accent)', fontWeight: 700 }}>
                        {surface === 'floors' ? `${floorScaleY}x` : `${wallScaleY}x`}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={10}
                      step={1}
                      value={surface === 'floors' ? floorScaleY : wallScaleY}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        if (surface === 'floors') setFloorScaleY(val);
                        else setWallScaleY(val);
                      }}
                      style={{ width: '100%', cursor: 'pointer', accentColor: 'var(--color-accent)' }}
                    />
                  </div>
                </div>
              </div>

              <div style={{ marginBottom: '0.85rem' }}>
                <button
                  type="button"
                  className={styles.pill}
                  style={{ width: '100%', justifyContent: 'center' }}
                  onClick={() => {
                    if (surface === 'walls') onWallTextureChange(undefined);
                    else onFloorTextureChange(undefined);
                  }}
                >
                  🚫 Remove {surface === 'walls' ? 'Wall' : 'Floor'} Texture (Solid Color Only)
                </button>
              </div>

              {thumbs.done < thumbs.total && (
                <div style={{ marginBottom: '0.6rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--color-text-muted)', marginBottom: '0.3rem' }}>
                    <span>Loading previews…</span>
                    <span>
                      {thumbs.done} / {thumbs.total}
                    </span>
                  </div>
                  <div style={{ height: 4, borderRadius: 2, background: 'rgba(148,163,184,0.25)', overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${(thumbs.done / thumbs.total) * 100}%`,
                        height: '100%',
                        background: 'var(--color-accent)',
                        transition: 'width 150ms linear',
                      }}
                    />
                  </div>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.6rem' }}>
                {(surface === 'walls' ? textureCatalog.walls : textureCatalog.floors).map((tex) => {
                  const activeTexture = surface === 'walls' ? wallTexture : floorTexture;
                  const isSelected = activeTexture === tex.texturePath;
                  return (
                    <button
                      key={tex.id}
                      type="button"
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '0.4rem',
                        padding: '0.5rem',
                        borderRadius: 'var(--radius-sm)',
                        border: isSelected ? '2px solid var(--color-accent)' : '1px solid var(--color-border)',
                        background: 'var(--color-bg)',
                        cursor: 'pointer',
                        position: 'relative',
                      }}
                      onClick={() => {
                        // Colour and texture are kept independent: a textured surface is tinted
                        // white at render time (see `effectiveWallColor` in Room.tsx), so the
                        // chosen colour is preserved and comes back when the texture is removed.
                        if (surface === 'walls') {
                          onWallTextureChange(isSelected ? undefined : tex.texturePath);
                        } else {
                          onFloorTextureChange(isSelected ? undefined : tex.texturePath);
                        }
                      }}
                    >
                      {/* Only rendered once the queue has fetched it, so the browser serves it
                          straight from cache instead of opening a competing request here. */}
                      {thumbs.ready.has(tex.previewPath) ? (
                        <img
                          src={tex.previewPath}
                          alt={tex.name}
                          style={{ width: '100%', height: 75, objectFit: 'cover', borderRadius: '4px' }}
                        />
                      ) : (
                        <div
                          aria-label={`${tex.name} loading`}
                          style={{
                            width: '100%',
                            height: 75,
                            borderRadius: '4px',
                            background: 'linear-gradient(90deg, rgba(148,163,184,0.10) 25%, rgba(148,163,184,0.20) 50%, rgba(148,163,184,0.10) 75%)',
                            backgroundSize: '200% 100%',
                            animation: 'furnisiaShimmer 1.2s ease-in-out infinite',
                          }}
                        />
                      )}
                      <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--color-text)', textAlign: 'center' }}>
                        {tex.name}
                      </span>
                      {isSelected && (
                        <span
                          style={{
                            position: 'absolute',
                            top: 6,
                            right: 6,
                            background: 'var(--color-accent)',
                            color: '#fff',
                            fontSize: '0.6rem',
                            padding: '2px 6px',
                            borderRadius: '8px',
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
            </div>
          )}
        </div>
      </div>

      {/* Right Column: Realtime Interactive 3D Room Preview Canvas */}
      <div className={styles.previewPane} style={{ position: 'relative', height: '100%', minHeight: 400 }}>
        <Canvas camera={{ position: [4, 4.5, 5], fov: 48 }}>
          <ambientLight intensity={0.65} />
          <directionalLight position={[6, 9, 6]} intensity={0.95} castShadow />
          <directionalLight position={[-6, 4, -6]} intensity={0.35} />
          {/* Ambient Occlusion (Contact Shadows under room boundaries) */}
          <ContactShadows position={[0, -0.005, 0]} opacity={0.7} scale={shadowScale} blur={2.5} far={4} color="#000000" />
          <RoomOrbitControls vertices={roomOverride.vertices} height={roomOverride.height} />
          <Room roomOverride={roomOverride} />
        </Canvas>
        <TextureLoadingBar />
        <div
          style={{
            position: 'absolute',
            bottom: 12,
            left: 12,
            background: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(8px)',
            color: '#fff',
            fontSize: '0.75rem',
            padding: '4px 10px',
            borderRadius: '12px',
            fontWeight: 600,
            pointerEvents: 'none',
          }}
        >
          📷 Live 3D Preview (Drag to Rotate)
        </div>
      </div>
    </div>
  );
}

