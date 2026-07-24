import type { RoomVertex } from '../../../Data/RoomShape';
import type { SnapTarget } from '../FloorPlanPreview';
import type { IWallTool, WallToolContext } from './WallTool';
import { DrawWallTool } from './DrawWallTool';
import { DeleteWallTool } from './DeleteWallTool';

// The full registry of tools offered when hovering a wall. Add a new tool by implementing
// IWallTool (see WallTool.ts) in its own file and listing it here — WallToolMenu handles
// availability filtering, layout, and event wiring generically; no per-tool menu code needed.
// (Moving the wall is deliberately NOT here — it's a direct press-and-hold on the wall body
// itself, wired in FloorPlanPreview, so there's no icon to find for the most common action.)
const TOOLS: IWallTool[] = [DrawWallTool, DeleteWallTool];

const ICON_SPACING = 0.24;
const MENU_OFFSET = 0.32;

interface WallToolMenuProps {
  point: RoomVertex;
  snap: SnapTarget; // must not be 'vertex' — caller decides that, not this component
  normal: RoomVertex;
  canDelete: boolean;
  onDraw: () => void;
  onDelete: () => void;
}

// The tool runner: given where the cursor landed on a wall, resolves which tools apply (via
// each tool's own isAvailable) and lays the survivors out evenly along the wall's own
// direction. Whether the menu should still be showing at all — including staying open while
// the cursor travels from the wall out to an offset icon — is FloorPlanPreview's call (see
// its menuAnchorRef), not this component's; this just renders whatever it's told to.
export function WallToolMenu({ point, snap, normal, canDelete, onDraw, onDelete }: WallToolMenuProps) {
  const ctx: WallToolContext = { point, snap, normal, canDelete, onDraw, onDelete };
  const active = TOOLS.filter((tool) => tool.isAvailable(ctx));

  const tangent = { x: -normal.z, z: normal.x };
  const centerX = point.x + normal.x * MENU_OFFSET;
  const centerZ = point.z + normal.z * MENU_OFFSET;
  const startOffset = -((active.length - 1) / 2) * ICON_SPACING;

  return (
    <g>
      <circle cx={point.x} cy={point.z} r={0.06} fill="var(--color-accent)" style={{ pointerEvents: 'none' }} />
      {active.map((tool, i) => {
        const off = startOffset + i * ICON_SPACING;
        const ix = centerX + tangent.x * off;
        const iz = centerZ + tangent.z * off;
        return (
          <g
            key={tool.id}
            transform={`translate(${ix} ${iz})`}
            style={{ cursor: tool.cursor }}
            onClick={(e) => {
              e.stopPropagation();
              tool.activate(ctx, e);
            }}
          >
            {tool.icon}
          </g>
        );
      })}
    </g>
  );
}
