import type { IWallTool } from './WallTool';

// Click to start a brand-new wall branching off this exact point on the hovered wall — same
// draw gesture as the open-space "+" marker, just anchored here instead of wherever the
// cursor happens to be.
export const DrawWallTool: IWallTool = {
  id: 'draw',
  cursor: 'crosshair',
  isAvailable: () => true,
  icon: (
    <>
      <circle r={0.13} fill="var(--color-accent)" stroke="var(--color-surface)" strokeWidth={0.015} />
      <path d="M-0.042,0 H0.042 M0,-0.042 V0.042" stroke="var(--color-surface)" strokeWidth={0.022} strokeLinecap="round" />
    </>
  ),
  activate: (ctx) => {
    ctx.onDraw();
  },
};
