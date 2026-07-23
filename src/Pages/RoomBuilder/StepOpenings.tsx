import { useRef, useState } from 'react';
import { computeEdges } from '../../Components/polygonGeometry';
import { DOOR_STYLES, WINDOW_STYLES, type DoorStyleKey, type WindowStyleKey } from '../../Data/OpeningStyles';
import type { RoomOpening, RoomVertex } from '../../Data/RoomShape';
import { FloorPlanPreview } from './FloorPlanPreview';
import styles from './RoomBuilder.module.css';

interface StepOpeningsProps {
  vertices: RoomVertex[];
  openings: RoomOpening[];
  onOpeningsChange: (openings: RoomOpening[]) => void;
}

const OPENING_MARGIN = 0.05; // keep an opening fully inside its wall, clear of the corners
const OPENING_END_MARGIN = 0.2; // clear space between an opening and the wall's corners, when placing
const OPENING_GAP = 0.15; // clear space required between two openings sharing a wall

export function StepOpenings({ vertices, openings, onOpeningsChange }: StepOpeningsProps) {
  const [kind, setKind] = useState<'door' | 'window'>('door');
  const [doorStyle, setDoorStyle] = useState<DoorStyleKey>('single-panel');
  const [windowStyle, setWindowStyle] = useState<WindowStyleKey>('glass-single');

  const edges = computeEdges(vertices);

  // Snapshot at drag start so a dragged opening's offset is (start offset + total delta),
  // same pattern as StepDimensions — clamping never accumulates drift mid-drag.
  const dragStart = useRef<RoomOpening[] | null>(null);

  // Returns a rejection message on failure (FloorPlanPreview flashes the wall red and toasts
  // it), or nothing on success. A wall can hold one door AND one window, but not two of the
  // same kind — remove the existing one first (hover it on the plan for the × handle) to
  // swap it. When a wall already has the other kind, the new opening is placed right next to
  // it (whichever side fits), and can be dragged afterward to reposition.
  function placeOnEdge(edgeIndex: number): string | void {
    const edge = edges[edgeIndex];
    if (!edge) return;
    const width = kind === 'door' ? 0.9 : 1.0;

    if (openings.some((o) => o.edgeIndex === edgeIndex && o.kind === kind)) {
      return `This wall already has a ${kind} — remove it first.`;
    }

    const other = openings.find((o) => o.edgeIndex === edgeIndex);
    let offset: number;
    if (!other) {
      if (edge.length < width + OPENING_END_MARGIN * 2) {
        return `Wall too small for this ${kind}.`;
      }
      offset = edge.length / 2 - width / 2; // centered on the wall
    } else {
      const rightOffset = other.offset + other.width + OPENING_GAP;
      const leftOffset = other.offset - OPENING_GAP - width;
      if (rightOffset + width + OPENING_END_MARGIN <= edge.length) {
        offset = rightOffset;
      } else if (leftOffset >= OPENING_END_MARGIN) {
        offset = leftOffset;
      } else {
        return `Wall too small to fit a ${kind} alongside the existing ${other.kind}.`;
      }
    }

    const style = kind === 'door' ? doorStyle : windowStyle;
    onOpeningsChange([...openings, { edgeIndex, offset, width, kind, style }]);
  }

  function removeOpening(index: number) {
    onOpeningsChange(openings.filter((_, i) => i !== index));
  }

  return (
    <div className={styles.dimensionsLayout}>
      <div>
        <h2 className={styles.stepTitle}>Add doors and windows</h2>

        <div className={styles.kindToggle}>
          <button type="button" className={kind === 'door' ? styles.pillActive : styles.pill} onClick={() => setKind('door')}>
            Door
          </button>
          <button type="button" className={kind === 'window' ? styles.pillActive : styles.pill} onClick={() => setKind('window')}>
            Window
          </button>
        </div>

        <p className={styles.stepSubtitle}>{kind === 'door' ? 'Door styles' : 'Window styles'}</p>
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

        <p className={styles.hint}>
          Click a wall to place — a wall can hold one door and one window if it's big enough. Hover a door or window on the
          plan to remove it, or drag it to slide along the wall.
        </p>
      </div>
      <div className={styles.previewPane}>
        <FloorPlanPreview
          vertices={vertices}
          openings={openings}
          onEdgeClick={placeOnEdge}
          onOpeningRemove={removeOpening}
          onOpeningDragStart={() => {
            dragStart.current = openings;
          }}
          onOpeningDrag={(openingIndex, delta) => {
            const start = dragStart.current;
            if (!start) return;
            const opening = start[openingIndex];
            const edge = edges[opening.edgeIndex];
            if (!opening || !edge) return;
            let minOffset = OPENING_MARGIN;
            let maxOffset = Math.max(OPENING_MARGIN, edge.length - opening.width - OPENING_MARGIN);
            // If this wall also has the other kind, clamp so the two can't be dragged into
            // overlap — which side to cap is decided once at drag start (from the snapshot),
            // not re-evaluated live, so the clamp doesn't jump around mid-drag.
            const other = start.find((o, i) => i !== openingIndex && o.edgeIndex === opening.edgeIndex);
            if (other) {
              if (other.offset > opening.offset) {
                maxOffset = Math.min(maxOffset, other.offset - OPENING_GAP - opening.width);
              } else {
                minOffset = Math.max(minOffset, other.offset + other.width + OPENING_GAP);
              }
              maxOffset = Math.max(minOffset, maxOffset); // guard a too-tight wall
            }
            const newOffset = Math.max(minOffset, Math.min(maxOffset, opening.offset + delta));
            onOpeningsChange(start.map((o, i) => (i === openingIndex ? { ...o, offset: newOffset } : o)));
          }}
          onOpeningDragEnd={() => {
            dragStart.current = null;
          }}
        />
      </div>
    </div>
  );
}
