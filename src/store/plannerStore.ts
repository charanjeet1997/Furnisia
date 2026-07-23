import { create } from 'zustand';
import { defaultRoom, type RoomShape } from '../Data/RoomShape';
import { findPlacement } from './findPlacement';

export interface PlacedItem {
  id: string;
  catalogId: string;
  position: [number, number, number];
  rotationY: number;
}

export type GizmoMode = 'translate' | 'rotate';

interface PlannerState {
  room: RoomShape;
  placedItems: PlacedItem[];
  selectedId: string | null;
  gizmoMode: GizmoMode;
  setRoom: (room: RoomShape) => void;
  loadRoom: (room: RoomShape, placedItems: PlacedItem[]) => void;
  addItem: (catalogId: string) => void;
  duplicateSelected: () => void;
  selectItem: (id: string | null) => void;
  updateItemTransform: (id: string, position: [number, number, number], rotationY: number) => void;
  removeItem: (id: string) => void;
  removeSelected: () => void;
  setGizmoMode: (mode: GizmoMode) => void;
}

export const usePlannerStore = create<PlannerState>((set) => ({
  room: defaultRoom,
  placedItems: [],
  selectedId: null,
  gizmoMode: 'translate',

  setRoom: (room) => set({ room, placedItems: [], selectedId: null }),

  // Restores a saved room (from Firestore) with its furniture intact, unlike setRoom which
  // always clears placedItems — used when a user loads one of their own saved rooms.
  loadRoom: (room, placedItems) => set({ room, placedItems, selectedId: null }),

  addItem: (catalogId) =>
    set((state) => {
      const id = `${catalogId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const { position, rotationY } = findPlacement(state.room, state.placedItems, catalogId);
      return {
        placedItems: [...state.placedItems, { id, catalogId, position, rotationY }],
        selectedId: id,
      };
    }),

  duplicateSelected: () =>
    set((state) => {
      const source = state.placedItems.find((item) => item.id === state.selectedId);
      if (!source) return state;
      const id = `${source.catalogId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const { position } = findPlacement(state.room, state.placedItems, source.catalogId);
      return {
        // Duplicate inherits the original's rotation so it lands in the same orientation.
        placedItems: [...state.placedItems, { id, catalogId: source.catalogId, position, rotationY: source.rotationY }],
        selectedId: id,
      };
    }),

  selectItem: (id) => set({ selectedId: id }),

  updateItemTransform: (id, position, rotationY) =>
    set((state) => ({
      placedItems: state.placedItems.map((item) =>
        item.id === id ? { ...item, position, rotationY } : item,
      ),
    })),

  removeItem: (id) =>
    set((state) => ({
      placedItems: state.placedItems.filter((item) => item.id !== id),
      selectedId: state.selectedId === id ? null : state.selectedId,
    })),

  removeSelected: () =>
    set((state) => ({
      placedItems: state.selectedId
        ? state.placedItems.filter((item) => item.id !== state.selectedId)
        : state.placedItems,
      selectedId: null,
    })),

  setGizmoMode: (mode) => set({ gizmoMode: mode }),
}));
