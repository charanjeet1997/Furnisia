import { useState } from 'react';
import { computeEdges } from '../../Components/polygonGeometry';
import { DOOR_STYLES, WINDOW_STYLES, getDoorStyle, getWindowStyle, type DoorStyleKey, type WindowStyleKey } from '../../Data/OpeningStyles';
import type { RoomOpening, RoomVertex } from '../../Data/RoomShape';
import { FloorPlanPreview } from './FloorPlanPreview';
import styles from './RoomBuilder.module.css';

interface StepOpeningsProps {
  vertices: RoomVertex[];
  openings: RoomOpening[];
  onOpeningsChange: (openings: RoomOpening[]) => void;
}

export function StepOpenings({ vertices, openings, onOpeningsChange }: StepOpeningsProps) {
  const [kind, setKind] = useState<'door' | 'window'>('door');
  const [doorStyle, setDoorStyle] = useState<DoorStyleKey>('single-panel');
  const [windowStyle, setWindowStyle] = useState<WindowStyleKey>('glass-single');

  const edges = computeEdges(vertices);

  function placeOnEdge(edgeIndex: number) {
    const edge = edges[edgeIndex];
    if (!edge) return;
    const width = kind === 'door' ? 0.9 : 1.0;
    if (edge.length < width + 0.4) return; // wall too short for this opening
    const offset = edge.length / 2 - width / 2; // centered on the wall
    const style = kind === 'door' ? doorStyle : windowStyle;
    const withoutSameKindOnEdge = openings.filter((o) => !(o.edgeIndex === edgeIndex && o.kind === kind));
    onOpeningsChange([...withoutSameKindOnEdge, { edgeIndex, offset, width, kind, style }]);
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

        <p className={styles.hint}>Click a wall in the preview to place it there.</p>

        {openings.length > 0 && (
          <ul className={styles.openingList}>
            {openings.map((o, i) => (
              <li key={i} className={styles.openingItem}>
                <span>{o.kind === 'door' ? getDoorStyle(o.style).label : getWindowStyle(o.style).label}</span>
                <button type="button" onClick={() => removeOpening(i)}>
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className={styles.previewPane}>
        <FloorPlanPreview vertices={vertices} openings={openings} onEdgeClick={placeOnEdge} />
      </div>
    </div>
  );
}
