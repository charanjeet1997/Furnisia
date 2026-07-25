import type { IWallTool } from './WallTool';

// Click to start a brand-new wall branching off this exact point on the hovered wall — same
// draw gesture as the open-space "+" marker, just anchored here instead of wherever the
// cursor happens to be.
export const DrawWallTool: IWallTool = {
  id: 'draw',
  cursor: 'crosshair',
  isAvailable: () => true,
  icon: (
    <g>
      <circle r={0.18} fill="var(--color-accent)" stroke="var(--color-surface)" strokeWidth={0.02} />
      <path d="M-0.06,0 H0.06 M0,-0.06 V0.06" stroke="var(--color-surface)" strokeWidth={0.028} strokeLinecap="round" />
    </g>
  ),
  activate: (ctx) => {
    ctx.onDraw();
  },
};
