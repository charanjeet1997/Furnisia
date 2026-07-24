import type { IWallTool } from './WallTool';

// Click to remove the hovered wall outright. Interior walls only — a boundary wall has no
// standalone "delete": removing one IS removing a corner, which is already the corner
// handle's own × button (deleting a boundary edge without touching its neighbors would leave
// the room polygon with a gap, which isn't a valid room shape).
export const DeleteWallTool: IWallTool = {
  id: 'delete',
  cursor: 'pointer',
  isAvailable: (ctx) => ctx.canDelete,
  icon: (
    <>
      <circle r={0.13} fill="var(--color-danger)" stroke="var(--color-surface)" strokeWidth={0.015} />
      <path d="M-0.042,-0.042 L0.042,0.042 M0.042,-0.042 L-0.042,0.042" stroke="var(--color-surface)" strokeWidth={0.022} strokeLinecap="round" />
    </>
  ),
  activate: (ctx) => {
    ctx.onDelete();
  },
};
