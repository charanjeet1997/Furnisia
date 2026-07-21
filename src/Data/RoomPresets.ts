export interface RoomPreset {
  id: string;
  name: string;
  width: number; // meters
  length: number; // meters
  height: number; // meters
}

export const roomPresets: RoomPreset[] = [
  { id: 'neutral-standard', name: 'Neutral Standard', width: 4.5, length: 5.1, height: 2.5 },
  { id: 'open-spacious', name: 'Open Spacious', width: 6.5, length: 6.8, height: 2.7 },
  { id: 'bright-spacious', name: 'Bright Spacious', width: 4.8, length: 5.4, height: 2.6 },
  { id: 'cozy-contemporary', name: 'Cozy Contemporary', width: 3.8, length: 4.7, height: 2.4 },
];

export const defaultRoom: RoomPreset = {
  id: 'custom',
  name: 'Custom Room',
  width: 4,
  length: 4,
  height: 2.5,
};

export function sqFt(width: number, length: number): number {
  return Math.round(width * length * 10.7639);
}
