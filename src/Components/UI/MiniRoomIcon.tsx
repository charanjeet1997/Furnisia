import { boundingBox } from '../../Components/polygonGeometry';
import type { RoomVertex } from '../../Data/RoomShape';

interface MiniRoomIconProps {
  vertices: RoomVertex[];
}

const PAD = 0.4;
const PX_PER_METER = 9;
const MIN_PX = 28;
const MAX_PX = 76;

// Room-card thumbnail: the preset's actual floor polygon, outlined — same shape a user
// would see if they opened this room, not a generic placeholder. Rendered at a size
// proportional to the room's real footprint (not fit-to-box), so a small room and a large
// room read as visibly different, not as identical squares.
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
    >
      <polygon points={points} fill="var(--color-accent-soft)" stroke="var(--color-accent)" strokeWidth={0.12} strokeLinejoin="round" />
    </svg>
  );
}
