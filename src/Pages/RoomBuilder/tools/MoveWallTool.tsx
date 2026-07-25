import type { IWallTool } from './WallTool';

// Click/drag to translate the hovered wall
export const MoveWallTool: IWallTool = {
  id: 'move',
  cursor: 'move',
  isAvailable: (ctx) => Boolean(ctx.onMove),
  icon: (
    <>
      <circle r={0.13} fill="var(--color-accent)" stroke="var(--color-surface)" strokeWidth={0.015} />
      <path d="M-0.04,0 H0.04 M0,-0.04 V0.04" stroke="var(--color-surface)" strokeWidth={0.02} strokeLinecap="round" />
    </>
  ),
  activate: (ctx) => {
    ctx.onMove?.();
  },
};
