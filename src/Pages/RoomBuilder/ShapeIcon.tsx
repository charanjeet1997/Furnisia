import type { RoomShapeType } from '../../Data/RoomShape';

// Fixed-proportion outline for each shape, purely illustrative (not tied to SHAPE_DEFAULT_PARAMS)
// — a 0..40 viewBox square per icon, drawn as a closed polygon matching that shape's silhouette.
const SHAPE_POINTS: Record<RoomShapeType, string> = {
  rectangular: '4,4 36,4 36,36 4,36',
  'l-shape': '4,4 36,4 36,36 20,36 20,20 4,20',
  cut: '4,4 28,4 36,12 36,36 4,36',
  't-shape': '4,4 36,4 36,16 26,16 26,36 14,36 14,16 4,16',
  'u-shape': '4,4 14,4 14,26 26,26 26,4 36,4 36,36 4,36',
  beveled: '12,4 28,4 36,12 36,28 28,36 12,36 4,28 4,12',
};

interface ShapeIconProps {
  shape: RoomShapeType;
  active?: boolean;
}

export function ShapeIcon({ shape, active = false }: ShapeIconProps) {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" aria-hidden="true">
      <polygon
        points={SHAPE_POINTS[shape]}
        fill={active ? 'var(--color-accent-soft)' : 'var(--color-bg)'}
        stroke={active ? 'var(--color-accent)' : 'var(--color-text-muted)'}
        strokeWidth={2.5}
        strokeLinejoin="round"
      />
    </svg>
  );
}
