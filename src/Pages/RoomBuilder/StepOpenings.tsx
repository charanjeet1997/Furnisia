import { useRef, useState } from 'react';
import { computeEdges } from '../../Components/polygonGeometry';
import { DOOR_STYLES, WINDOW_STYLES, type DoorStyleKey, type WindowStyleKey } from '../../Data/OpeningStyles';
import type { InteriorWall, RoomOpening, RoomVertex } from '../../Data/RoomShape';
import { FloorPlanPreview } from './FloorPlanPreview';
import styles from './RoomBuilder.module.css';

interface StepOpeningsProps {
  vertices: RoomVertex[];
  openings: RoomOpening[];
  onOpeningsChange: (openings: RoomOpening[]) => void;
  interiorWalls: InteriorWall[];
}

const OPENING_MARGIN = 0.05; // keep an opening fully inside its wall, clear of the corners
const OPENING_END_MARGIN = 0.2; // clear space between an opening and the wall's corners, when placing
const OPENING_GAP = 0.15; // clear space required between two openings sharing a wall

// Two openings are on the "same wall" if they're both on the same boundary edge, or both on
// the same interior wall — never a boundary opening matching an interior one, even if their
// raw edgeIndex/interiorWallId happen to collide.
function sameHost(a: RoomOpening, b: RoomOpening): boolean {
  if (a.interiorWallId || b.interiorWallId) return a.interiorWallId === b.interiorWallId;
  return a.edgeIndex === b.edgeIndex;
}

export function StepOpenings({ vertices, openings, onOpeningsChange, interiorWalls }: StepOpeningsProps) {
  const [kind, setKind] = useState<'door' | 'window'>('door');
  const [doorStyle, setDoorStyle] = useState<DoorStyleKey>('single-panel');
  const [windowStyle, setWindowStyle] = useState<WindowStyleKey>('glass-single');

  const edges = computeEdges(vertices);

  // Snapshot at drag start so a dragged opening's offset is (start offset + total delta),
  // same pattern as StepDimensions — clamping never accumulates drift mid-drag.
  const dragStart = useRef<RoomOpening[] | null>(null);

  function hostLengthOf(opening: RoomOpening): number | null {
    if (opening.interiorWallId) {
      const wall = interiorWalls.find((w) => w.id === opening.interiorWallId);
      if (!wall) return null;
      return Math.hypot(wall.end.x - wall.start.x, wall.end.z - wall.start.z);
    }
    return edges[opening.edgeIndex]?.length ?? null;
  }

  // Shared placement math for both a boundary wall and an interior wall — same rules either
  // way: a wall can hold one door AND one window, but not two of the same kind; a second kind
  // slots in right next to the first (whichever side fits).
  function computePlacement(hostLength: number, existingOnHost: RoomOpening[]): { offset: number; width: number } | string {
    const width = kind === 'door' ? 0.9 : 1.0;
    if (existingOnHost.some((o) => o.kind === kind)) {
      return `This wall already has a ${kind} — remove it first.`;
    }
    const other = existingOnHost[0];
    if (!other) {
      if (hostLength < width + OPENING_END_MARGIN * 2) return `Wall too small for this ${kind}.`;
      return { offset: hostLength / 2 - width / 2, width }; // centered on the wall
    }
    const rightOffset = other.offset + other.width + OPENING_GAP;
    const leftOffset = other.offset - OPENING_GAP - width;
    if (rightOffset + width + OPENING_END_MARGIN <= hostLength) return { offset: rightOffset, width };
    if (leftOffset >= OPENING_END_MARGIN) return { offset: leftOffset, width };
    return `Wall too small to fit a ${kind} alongside the existing ${other.kind}.`;
  }

  // Returns a rejection message on failure (FloorPlanPreview flashes the wall red and toasts
  // it), or nothing on success. Hover a door or window on the plan to remove it, or drag it to
  // reposition along its wall.
  function placeOnEdge(edgeIndex: number): string | void {
    const edge = edges[edgeIndex];
    if (!edge) return;
    const existing = openings.filter((o) => !o.interiorWallId && o.edgeIndex === edgeIndex);
    const result = computePlacement(edge.length, existing);
    if (typeof result === 'string') return result;
    const style = kind === 'door' ? doorStyle : windowStyle;
    onOpeningsChange([...openings, { edgeIndex, offset: result.offset, width: result.width, kind, style }]);
  }

  // Same idea, for a free-standing interior wall instead of the boundary.
  function placeOnInteriorWall(wallId: string): string | void {
    const wall = interiorWalls.find((w) => w.id === wallId);
    if (!wall) return;
    const length = Math.hypot(wall.end.x - wall.start.x, wall.end.z - wall.start.z);
    const existing = openings.filter((o) => o.interiorWallId === wallId);
    const result = computePlacement(length, existing);
    if (typeof result === 'string') return result;
    const style = kind === 'door' ? doorStyle : windowStyle;
    // edgeIndex has no meaning here — it's ignored everywhere an opening with
    // interiorWallId set is read, but the field itself stays required for older saved data.
    onOpeningsChange([...openings, { edgeIndex: -1, interiorWallId: wallId, offset: result.offset, width: result.width, kind, style }]);
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
          Click a wall — boundary or interior — to place a door or window; a wall can hold one door and one window if
          it's big enough. Hover one on the plan to remove it, or drag it to slide along its wall.
        </p>
      </div>
      <div className={styles.previewPane}>
        <FloorPlanPreview
          vertices={vertices}
          openings={openings}
          interiorWalls={interiorWalls}
          onEdgeClick={placeOnEdge}
          onInteriorWallClick={placeOnInteriorWall}
          onOpeningRemove={removeOpening}
          onOpeningDragStart={() => {
            dragStart.current = openings;
          }}
          onOpeningDrag={(openingIndex, delta) => {
            const start = dragStart.current;
            if (!start) return;
            const opening = start[openingIndex];
            if (!opening) return;
            const hostLength = hostLengthOf(opening);
            if (hostLength === null) return;
            let minOffset = OPENING_MARGIN;
            let maxOffset = Math.max(OPENING_MARGIN, hostLength - opening.width - OPENING_MARGIN);
            // If this wall also has the other kind, clamp so the two can't be dragged into
            // overlap — which side to cap is decided once at drag start (from the snapshot),
            // not re-evaluated live, so the clamp doesn't jump around mid-drag.
            const other = start.find((o, i) => i !== openingIndex && sameHost(o, opening));
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
