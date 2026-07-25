import type { ReactNode } from 'react';
import type { RoomVertex } from '../../../Data/RoomShape';
import type { SnapTarget } from '../types/floorPlanTypes';

export interface WallToolContext {
  point: RoomVertex;
  snap: SnapTarget;
  normal: RoomVertex;
  canDelete: boolean;
  onDraw: () => void;
  onDelete: () => void;
  onMove?: () => void;
}

export interface IWallTool {
  id: string;
  name?: string;
  cursor: string;
  isAvailable(ctx: WallToolContext): boolean;
  icon: ReactNode;
  activate(ctx: WallToolContext, e: React.MouseEvent<SVGElement>): void;
}
