import { useEffect, useState } from 'react';
import { computeEdges } from '../../Components/polygonGeometry';
import { DOOR_STYLES, WINDOW_STYLES, type DoorStyleKey, type WindowStyleKey } from '../../Data/OpeningStyles';
import type { InteriorWall, RoomOpening, RoomVertex } from '../../Data/RoomShape';
import { Scene } from '../../Components/Scene';
import { Room } from '../../Components/Room';
import { OpeningClickTarget } from '../../Components/OpeningClickTarget';
import { usePlannerStore } from '../../store/plannerStore';
import styles from './RoomBuilder.module.css';

interface StepOpeningsProps {
  vertices: RoomVertex[];
  openings: RoomOpening[];
  onOpeningsChange: (openings: RoomOpening[]) => void;
  interiorWalls: InteriorWall[];
}

const OPENING_END_MARGIN = 0.2;
const OPENING_GAP = 0.15;

export function StepOpenings({ vertices, openings, onOpeningsChange, interiorWalls }: StepOpeningsProps) {
  const [kind, setKind] = useState<'door' | 'window'>('door');
  const [doorStyle, setDoorStyle] = useState<DoorStyleKey>('single-panel');
  const [windowStyle, setWindowStyle] = useState<WindowStyleKey>('glass-single');
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  // Sync openings into the store in real-time so Room renders them live
  const storeRoom = usePlannerStore((s) => s.room);
  const setRoom = usePlannerStore((s) => s.setRoom);
  const storePlacedItems = usePlannerStore((s) => s.placedItems);

  useEffect(() => {
    // Patch just the openings into the store without touching placedItems
    usePlannerStore.setState((s) => ({
      room: { ...s.room, vertices, openings },
    }));
  }, [openings, vertices]);

  const edges = computeEdges(vertices);

  function changeOpenings(next: RoomOpening[]) {
    onOpeningsChange(next);
  }

  function placeOnEdge(edgeIndex: number) {
    const edge = edges[edgeIndex];
    if (!edge) return;
    const width = kind === 'door' ? 0.9 : 1.0;
    const existing = openings.filter((o) => !o.interiorWallId && o.edgeIndex === edgeIndex);
    if (existing.some((o) => o.kind === kind)) return;
    const other = existing[0];
    let offset: number;
    if (!other) {
      if (edge.length < width + OPENING_END_MARGIN * 2) return;
      offset = edge.length / 2 - width / 2;
    } else {
      const right = other.offset + other.width + OPENING_GAP;
      const left = other.offset - OPENING_GAP - width;
      if (right + width + OPENING_END_MARGIN <= edge.length) offset = right;
      else if (left >= OPENING_END_MARGIN) offset = left;
      else return;
    }
    const style = kind === 'door' ? doorStyle : windowStyle;
    const newList = [...openings, { edgeIndex, offset, width, kind, style }];
    changeOpenings(newList);
    setSelectedIdx(newList.length - 1);
  }

  function removeOpening(index: number) {
    changeOpenings(openings.filter((_, i) => i !== index));
    setSelectedIdx(null);
  }

  function handleSlide(newOffset: number, overrideIdx?: number) {
    const idx = overrideIdx ?? selectedIdx;
    if (idx === null || idx === undefined) return;
    const opening = openings[idx];
    if (!opening || opening.interiorWallId) return;
    // Update selectedIdx to match so panel stays in sync
    if (overrideIdx !== undefined) setSelectedIdx(overrideIdx);

    const edgeLen = edges[opening.edgeIndex]?.length ?? 0;
    const minOffset = OPENING_END_MARGIN;
    const maxOffset = edgeLen - opening.width - OPENING_END_MARGIN;

    if (newOffset >= minOffset && newOffset <= maxOffset) {
      changeOpenings(openings.map((o, i) => (i === idx ? { ...o, offset: newOffset } : o)));
      return;
    }

    const totalEdges = edges.length;
    let nextEdgeIndex: number;
    let nextOffset: number;

    if (newOffset < minOffset) {
      nextEdgeIndex = (opening.edgeIndex - 1 + totalEdges) % totalEdges;
      const nextEdge = edges[nextEdgeIndex];
      if (!nextEdge) return;
      nextOffset = nextEdge.length - opening.width - OPENING_END_MARGIN;
    } else {
      nextEdgeIndex = (opening.edgeIndex + 1) % totalEdges;
      nextOffset = OPENING_END_MARGIN;
    }

    const blocked = openings.some(
      (o, i) => i !== idx && !o.interiorWallId && o.edgeIndex === nextEdgeIndex && o.kind === opening.kind
    );
    if (blocked) return;

    changeOpenings(
      openings.map((o, i) => (i === idx ? { ...o, edgeIndex: nextEdgeIndex, offset: nextOffset } : o))
    );
  }

  const selected = selectedIdx !== null ? openings[selectedIdx] : null;
  const selectedEdgeLen =
    selected && !selected.interiorWallId ? (edges[selected.edgeIndex]?.length ?? 4) : 4;

  return (
    <div className={styles.dimensionsLayout}>
      {/* ── Left controls ── */}
      <div className={styles.controlsSection}>
        <h2 className={styles.stepTitle}>3D Doors &amp; Windows</h2>

        {/* Kind toggle */}
        <div className={styles.kindToggle}>
          <button
            type="button"
            className={kind === 'door' ? styles.pillActive : styles.pill}
            onClick={() => setKind('door')}
          >
            🚪 Door
          </button>
          <button
            type="button"
            className={kind === 'window' ? styles.pillActive : styles.pill}
            onClick={() => setKind('window')}
          >
            🪟 Window
          </button>
        </div>

        {/* Style picker */}
        <p className={styles.stepSubtitle}>{kind === 'door' ? 'Door style' : 'Window style'}</p>
        <div className={styles.styleGrid}>
          {kind === 'door'
            ? DOOR_STYLES.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  className={s.key === doorStyle ? styles.swatchActive : styles.swatch}
                  onClick={() => setDoorStyle(s.key)}
                >
                  {s.label}
                </button>
              ))
            : WINDOW_STYLES.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  className={s.key === windowStyle ? styles.swatchActive : styles.swatch}
                  onClick={() => setWindowStyle(s.key)}
                >
                  {s.label}
                </button>
              ))}
        </div>

        {/* Wall placement buttons */}
        <p className={styles.stepSubtitle}>Place on wall</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
          {edges.map((edge, idx) => (
            <button
              key={idx}
              type="button"
              className={styles.swatch}
              onClick={() => placeOnEdge(idx)}
              style={{ fontSize: '0.8rem', padding: '0.5rem', fontWeight: 600 }}
            >
              ➕ Wall {idx + 1}&nbsp;
              <span style={{ opacity: 0.6 }}>({edge.length.toFixed(1)}m)</span>
            </button>
          ))}
        </div>

        {/* Slide & remove controls for selected opening */}
        {selected && !selected.interiorWallId && (
          <div
            style={{
              marginTop: '1rem',
              padding: '0.85rem',
              background: 'rgba(99,102,241,0.1)',
              border: '1px solid var(--color-accent)',
              borderRadius: '8px',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.6rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--color-accent)' }}>
                {selected.kind === 'door' ? '🚪 Door' : '🪟 Window'} — Wall {selected.edgeIndex + 1}
              </span>
              <button
                type="button"
                onClick={() => setSelectedIdx(null)}
                style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: '1rem' }}
              >
                ✕
              </button>
            </div>

            <label style={{ fontSize: '0.78rem' }}>
              Slide along wall&nbsp;
              <span style={{ opacity: 0.6, fontStyle: 'italic' }}>(hits end → jumps to next wall)</span>
            </label>
            <input
              type="range"
              min={0}
              max={selectedEdgeLen}
              step={0.05}
              value={selected.offset}
              style={{ width: '100%' }}
              onChange={(e) => handleSlide(parseFloat(e.target.value))}
            />
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              <button
                type="button"
                onClick={() => handleSlide(selected.offset - 0.2)}
                style={{ flex: 1, padding: '0.4rem', background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)', borderRadius: '6px', cursor: 'pointer', fontSize: '1.1rem' }}
              >
                ◀
              </button>
              <button
                type="button"
                onClick={() => handleSlide(selected.offset + 0.2)}
                style={{ flex: 1, padding: '0.4rem', background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)', borderRadius: '6px', cursor: 'pointer', fontSize: '1.1rem' }}
              >
                ▶
              </button>
            </div>

            <button
              type="button"
              onClick={() => removeOpening(selectedIdx!)}
              style={{ padding: '0.4rem', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
            >
              🗑️ Remove
            </button>
          </div>
        )}

        {/* Placed list */}
        {openings.length > 0 && (
          <div style={{ marginTop: '0.75rem' }}>
            <p className={styles.stepSubtitle}>
              Placed —{' '}
              <span style={{ fontWeight: 400, opacity: 0.7 }}>click to select &amp; slide</span>
            </p>
            {openings.map((o, idx) => (
              <div
                key={idx}
                onClick={() => setSelectedIdx(selectedIdx === idx ? null : idx)}
                style={{
                  padding: '0.45rem 0.7rem',
                  marginBottom: '0.3rem',
                  borderRadius: '6px',
                  background: selectedIdx === idx ? 'rgba(99,102,241,0.18)' : 'var(--color-surface-raised)',
                  border: `1px solid ${selectedIdx === idx ? 'var(--color-accent)' : 'var(--color-border)'}`,
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  userSelect: 'none',
                }}
              >
                <span>{o.kind === 'door' ? '🚪' : '🪟'} Wall {o.edgeIndex + 1} — {o.style}</span>
                <span style={{ opacity: 0.55 }}>{o.offset.toFixed(1)}m</span>
              </div>
            ))}
          </div>
        )}

        <p className={styles.hint} style={{ marginTop: '0.75rem' }}>
          💡 Click a wall button to place. Select a placed item to slide it — it wraps to the next wall at the end.
        </p>
      </div>

      {/* ── 3D Room Canvas ── */}
      <div className={styles.previewPane} style={{ minHeight: '480px' }}>
        <Scene>
          <Room />
          {openings.map((o, idx) => (
            <OpeningClickTarget
              key={idx}
              opening={o}
              openingIndex={idx}
              vertices={vertices}
              wallThickness={storeRoom.wallThickness ?? 0.1}
              isSelected={selectedIdx === idx}
              onSelect={() => setSelectedIdx(selectedIdx === idx ? null : idx)}
              onSlide={(newOffset) => handleSlide(newOffset, idx)}
            />
          ))}
        </Scene>
      </div>
    </div>
  );
}
