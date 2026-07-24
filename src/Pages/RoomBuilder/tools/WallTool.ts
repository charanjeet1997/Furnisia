import type { ReactNode } from 'react';
import type { RoomVertex } from '../../../Data/RoomShape';
import type { SnapTarget } from '../FloorPlanPreview';

// Everything a tool needs to know about where it's anchored on the plan, and the actions it
// can trigger there — handed down by WallToolMenu (the tool runner), which owns layout and
// hover-lock bookkeeping so individual tools stay dumb: given a context, offer an icon and an
// activation handler, nothing more.
export interface WallToolContext {
  point: RoomVertex;
  snap: SnapTarget; // 'boundary' | 'interior' — the menu never renders on a 'vertex' snap
  normal: RoomVertex;
  canDelete: boolean;
  onDraw: () => void;
  onDelete: () => void;
}

// A single entry in the wall hover tool menu. Implemented by DrawWallTool / DeleteWallTool
// (one file each) — WallToolMenu is the runner: it filters `isAvailable`, lays the survivors
// out along the wall, and wires each one's click to `activate`. Add a new tool by
// implementing this interface and registering it in WallToolMenu's list — no other file needs
// to change. (Moving the wall itself isn't a menu tool — it's a direct press-and-hold on the
// wall body, wired in FloorPlanPreview alongside the boundary edge's own drag handling.)
export interface IWallTool {
  id: string;
  cursor: string;
  isAvailable(ctx: WallToolContext): boolean;
  icon: ReactNode;
  activate(ctx: WallToolContext, e: React.MouseEvent<SVGElement>): void;
}
