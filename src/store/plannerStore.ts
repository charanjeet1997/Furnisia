import { create } from 'zustand';
import { defaultRoom, type RoomShape } from '../Data/RoomShape';
import { findPlacement } from './findPlacement';

export interface PlacedItem {
  id: string;
  catalogId: string;
  position: [number, number, number];
  rotationY: number;
  scale?: number;
  customModelUrl?: string;
  customName?: string;
  sketchfabToken?: string;
}

export type GizmoMode = 'translate' | 'rotate';

interface PlannerState {
  room: RoomShape;
  placedItems: PlacedItem[];
  selectedId: string | null;
  gizmoMode: GizmoMode;
  isCatalogOpen: boolean;
  showGrid: boolean;
  gridSize: number;
  snapToGrid: boolean;
  savedRoomId: string | null;
  savedRoomName: string | null;
  setRoom: (room: RoomShape) => void;
  loadRoom: (room: RoomShape, placedItems: PlacedItem[], savedRoomId?: string | null, savedRoomName?: string | null) => void;
  setSavedRoomInfo: (id: string | null, name: string | null) => void;
  addItem: (catalogId: string) => void;
  addCustomItem: (url: string, name?: string, token?: string) => void;
  duplicateSelected: () => void;
  selectItem: (id: string | null) => void;
  updateItemTransform: (id: string, position: [number, number, number], rotationY: number) => void;
  updateItemScale: (id: string, scale: number) => void;
  removeItem: (id: string) => void;
  setRoom: (room: RoomShape) => void;
  updateRoom: (room: RoomShape) => void;
  setGizmoMode: (mode: GizmoMode) => void;
  updateLightIntensity: (val: number) => void;
  setWallTexture: (texturePath?: string) => void;
  setFloorTexture: (texturePath?: string) => void;
  setWallTextureScaleX: (scale: number) => void;
  setWallTextureScaleY: (scale: number) => void;
  setFloorTextureScaleX: (scale: number) => void;
  setFloorTextureScaleY: (scale: number) => void;
  setWallColor: (color: string) => void;
  setFloorColor: (color: string) => void;
  setCeilingColor: (color: string) => void;
  setCatalogOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  setShowGrid: (show: boolean) => void;
  toggleGrid: () => void;
  setGridSize: (size: number) => void;
  setSnapToGrid: (snap: boolean) => void;
}

export const usePlannerStore = create<PlannerState>((set) => ({
  room: defaultRoom,
  placedItems: [],
  selectedId: null,
  gizmoMode: 'translate',
  isCatalogOpen: false,
  showGrid: true,
  gridSize: 0.5,
  snapToGrid: true,
  savedRoomId: null,
  savedRoomName: null,

  setRoom: (room) => set((state) => ({ room, placedItems: [], selectedId: null, savedRoomId: state.savedRoomId, savedRoomName: state.savedRoomName })),
  updateRoom: (room) => set((state) => ({ room })),
  updateLightIntensity: (val) =>
    set((state) => ({
      room: { ...state.room, lightIntensity: val },
    })),
  setWallTexture: (wallTexture) =>
    set((state) => ({
      room: { ...state.room, wallTexture },
    })),
  setFloorTexture: (floorTexture) =>
    set((state) => ({
      room: { ...state.room, floorTexture },
    })),
  setWallTextureScaleX: (wallTextureScaleX) =>
    set((state) => ({
      room: { ...state.room, wallTextureScaleX },
    })),
  setWallTextureScaleY: (wallTextureScaleY) =>
    set((state) => ({
      room: { ...state.room, wallTextureScaleY },
    })),
  setFloorTextureScaleX: (floorTextureScaleX) =>
    set((state) => ({
      room: { ...state.room, floorTextureScaleX },
    })),
  setFloorTextureScaleY: (floorTextureScaleY) =>
    set((state) => ({
      room: { ...state.room, floorTextureScaleY },
    })),
  setWallColor: (wallColor) =>
    set((state) => ({
      room: { ...state.room, wallColor },
    })),
  setFloorColor: (floorColor) =>
    set((state) => ({
      room: { ...state.room, floorColor },
    })),
  setCeilingColor: (ceilingColor) =>
    set((state) => ({
      room: { ...state.room, ceilingColor },
    })),

  // Restores a saved room (from Firestore) with its furniture intact, unlike setRoom which
  // always clears placedItems — used when a user loads one of their own saved rooms.
  loadRoom: (room, placedItems, savedRoomId = null, savedRoomName = null) =>
    set({ room, placedItems, selectedId: null, savedRoomId, savedRoomName }),

  setSavedRoomInfo: (savedRoomId, savedRoomName) => set({ savedRoomId, savedRoomName }),

  addItem: (catalogId) =>
    set((state) => {
      const id = `${catalogId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const { position, rotationY } = findPlacement(state.room, state.placedItems, catalogId);
      return {
        placedItems: [...state.placedItems, { id, catalogId, position, rotationY }],
        selectedId: id,
        isCatalogOpen: false,
      };
    }),

  addCustomItem: (url, name, token) =>
    set((state) => {
      const catalogId = 'custom';
      const id = `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const { position, rotationY } = findPlacement(state.room, state.placedItems, catalogId);
      return {
        placedItems: [
          ...state.placedItems,
          {
            id,
            catalogId: 'custom',
            customModelUrl: url,
            customName: name?.trim() || 'Custom 3D Model',
            sketchfabToken: token?.trim() || undefined,
            position,
            rotationY,
          },
        ],
        selectedId: id,
        isCatalogOpen: false,
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

  updateItemScale: (id, scale) =>
    set((state) => ({
      placedItems: state.placedItems.map((item) =>
        item.id === id ? { ...item, scale: Math.max(0.05, Math.min(20, scale)) } : item,
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

  setCatalogOpen: (open) =>
    set((state) => ({
      isCatalogOpen: typeof open === 'function' ? open(state.isCatalogOpen) : open,
    })),

  setShowGrid: (show) => set({ showGrid: show }),
  toggleGrid: () => set((state) => ({ showGrid: !state.showGrid })),
  setGridSize: (size) => set({ gridSize: Math.max(0.1, size) }),
  setSnapToGrid: (snap) => set({ snapToGrid: snap }),
}));
