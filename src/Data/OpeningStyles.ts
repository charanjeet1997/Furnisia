// Simplified, not pixel-matched to IKEA's real door/window assets — each style is built from
// the same box + glass-material primitives Room.tsx already uses, varied by leaf/pane count
// and solid-vs-glass material so they're visually distinct rather than identical placeholders.

export type DoorStyleKey = 'single-panel' | 'glass' | 'french-double' | 'double-panel' | 'bifold-double' | 'glass-double';
export type WindowStyleKey = 'glass-single' | 'glass-double';

export interface DoorStyleDef {
  key: DoorStyleKey;
  label: string;
  leafCount: 1 | 2;
  material: 'solid' | 'glass';
}

export interface WindowStyleDef {
  key: WindowStyleKey;
  label: string;
  paneCount: 1 | 2;
}

export const DOOR_STYLES: DoorStyleDef[] = [
  { key: 'single-panel', label: 'Single Panel Door', leafCount: 1, material: 'solid' },
  { key: 'glass', label: 'Glass Door', leafCount: 1, material: 'glass' },
  { key: 'french-double', label: 'French Double Door', leafCount: 2, material: 'glass' },
  { key: 'double-panel', label: 'Double Panel Door', leafCount: 2, material: 'solid' },
  { key: 'bifold-double', label: 'Bifold Panel Double Door', leafCount: 2, material: 'solid' },
  { key: 'glass-double', label: 'Glass Double Door', leafCount: 2, material: 'glass' },
];

export const WINDOW_STYLES: WindowStyleDef[] = [
  { key: 'glass-single', label: 'Glass Window Single', paneCount: 1 },
  { key: 'glass-double', label: 'Glass Window Double', paneCount: 2 },
];

export function getDoorStyle(key: string): DoorStyleDef {
  return DOOR_STYLES.find((s) => s.key === key) ?? DOOR_STYLES[0];
}

export function getWindowStyle(key: string): WindowStyleDef {
  return WINDOW_STYLES.find((s) => s.key === key) ?? WINDOW_STYLES[0];
}
