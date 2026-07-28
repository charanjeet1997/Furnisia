import { boundingBox } from '../../Components/polygonGeometry';
import type { RoomVertex } from '../../Data/RoomShape';

interface MiniRoomIconProps {
  vertices: RoomVertex[];
}

const PAD = 0.5;
const PX_PER_METER = 11;
const MIN_PX = 36;
const MAX_PX = 90;

export function MiniRoomIcon({ vertices }: MiniRoomIconProps) {
  const bbox = boundingBox(vertices);
  const roomW = bbox.maxX - bbox.minX;
  const roomH = bbox.maxZ - bbox.minZ;
  const w = roomW + PAD * 2;
  const h = roomH + PAD * 2;
  const points = vertices.map((v) => `${v.x},${v.z}`).join(' ');

  const pxW = Math.min(MAX_PX, Math.max(MIN_PX, roomW * PX_PER_METER));
  const pxH = Math.min(MAX_PX, Math.max(MIN_PX, roomH * PX_PER_METER));

  return (
    <svg
      viewBox={`${bbox.minX - PAD} ${bbox.minZ - PAD} ${w} ${h}`}
      width={pxW}
      height={pxH}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
      style={{ filter: 'drop-shadow(0 4px 12px rgba(16, 185, 129, 0.25))' }}
    >
      <defs>
        <pattern id="miniGrid" width="0.8" height="0.8" patternUnits="userSpaceOnUse">
          <path d="M 0.8 0 L 0 0 0 0.8" fill="none" stroke="var(--color-border)" strokeWidth="0.04" opacity="0.4" />
        </pattern>
      </defs>
      <polygon points={points} fill="url(#miniGrid)" opacity="0.3" />
      <polygon
        points={points}
        fill="var(--color-accent-soft)"
        stroke="var(--color-accent)"
        strokeWidth={0.16}
        strokeLinejoin="round"
      />
    </svg>
  );
}
