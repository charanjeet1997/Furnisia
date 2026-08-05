import {
  DEFAULT_HEIGHT,
  DEFAULT_WALL_THICKNESS,
  DEFAULT_WALL_COLOR,
  DEFAULT_FLOOR_COLOR,
  detectShapeType,
  makeRectangle,
  type RoomShape,
} from '../Data/RoomShape';
import { boundingBox } from '../Components/polygonGeometry';
import type { PlacedItem } from '../store/plannerStore';

export interface CompressedRoomPayload {
  r: {
    id?: string;
    name?: string;
    type?: string;
    w?: number;
    l?: number;
    h?: number;
    wt?: number;
    et?: number[];
    wc?: string; // wallColor
    fc?: string; // floorColor
    v?: Array<{ x: number; z: number }>; // vertices
    o?: any[]; // openings
    iw?: any[]; // interiorWalls
    li?: number; // lightIntensity
  };
  i: Array<{
    c: string; // catalogId
    p: [number, number, number]; // position
    r: number; // rotationY
    s?: number; // scale
    u?: string; // customModelUrl
    n?: string; // customName
  }>;
}

/**
 * Encodes room layout and furniture items into a compact, URL-safe base64 string
 */
export function encodeRoomToUrl(room: RoomShape, placedItems: PlacedItem[]): string {
  try {
    const bbox = room.vertices ? boundingBox(room.vertices) : { minX: 0, maxX: 4, minZ: 0, maxZ: 4 };
    const width = Math.round((bbox.maxX - bbox.minX) * 100) / 100;
    const length = Math.round((bbox.maxZ - bbox.minZ) * 100) / 100;
    const shapeType = room.vertices ? detectShapeType(room.vertices) : 'rectangular';

    const payload: CompressedRoomPayload = {
      r: {
        id: room.id,
        name: room.name,
        type: shapeType,
        w: width,
        l: length,
        h: room.height,
        wt: room.wallThickness,
        et: room.edgeThicknesses,
        wc: room.wallColor,
        fc: room.floorColor,
        v: room.vertices,
        o: room.openings,
        iw: room.interiorWalls,
        li: room.lightIntensity,
      },
      i: (placedItems || []).map((item) => ({
        c: item.catalogId,
        p: [
          Math.round(item.position[0] * 100) / 100,
          Math.round(item.position[1] * 100) / 100,
          Math.round(item.position[2] * 100) / 100,
        ],
        r: Math.round(item.rotationY * 100) / 100,
        ...(item.scale !== undefined ? { s: Math.round(item.scale * 100) / 100 } : {}),
        ...(item.customModelUrl ? { u: item.customModelUrl } : {}),
        ...(item.customName ? { n: item.customName } : {}),
      })),
    };

    const jsonStr = JSON.stringify(payload);
    return encodeURIComponent(btoa(jsonStr));
  } catch (err) {
    console.warn('Failed to encode room to URL string:', err);
    return '';
  }
}

/**
 * Decodes room layout and furniture items from a URL-safe base64 string
 */
export function decodeRoomFromUrl(dataStr: string): { room: RoomShape; placedItems: PlacedItem[] } | null {
  try {
    if (!dataStr) return null;
    const jsonStr = atob(decodeURIComponent(dataStr));
    const payload: CompressedRoomPayload = JSON.parse(jsonStr);

    if (!payload || !payload.r || !Array.isArray(payload.i)) {
      return null;
    }

    const width = payload.r.w || 4;
    const length = payload.r.l || 4;
    const vertices =
      payload.r.v && payload.r.v.length >= 3
        ? payload.r.v
        : makeRectangle({ width, depth: length });

    const room: RoomShape = {
      id: payload.r.id || 'url-room',
      name: payload.r.name || 'Shared Room',
      height: payload.r.h || DEFAULT_HEIGHT,
      wallThickness: payload.r.wt || DEFAULT_WALL_THICKNESS,
      ...(payload.r.et ? { edgeThicknesses: payload.r.et } : {}),
      wallColor: payload.r.wc || DEFAULT_WALL_COLOR,
      floorColor: payload.r.fc || DEFAULT_FLOOR_COLOR,
      vertices,
      openings: payload.r.o || [],
      interiorWalls: payload.r.iw || [],
      ...(payload.r.li !== undefined ? { lightIntensity: payload.r.li } : {}),
    };

    const placedItems: PlacedItem[] = payload.i.map((item, index) => {
      const res: PlacedItem = {
        id: `url-item-${index}-${Date.now()}`,
        catalogId: item.c,
        position: item.p,
        rotationY: item.r,
      };
      if (item.s !== undefined) res.scale = item.s;
      if (item.u) res.customModelUrl = item.u;
      if (item.n) res.customName = item.n;
      return res;
    });

    return { room, placedItems };
  } catch (err) {
    console.warn('Failed to decode room from URL string:', err);
    return null;
  }
}
