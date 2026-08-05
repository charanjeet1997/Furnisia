import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  type Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { detectShapeType, type RoomShape } from '../Data/RoomShape';
import { boundingBox } from '../Components/polygonGeometry';
import type { PlacedItem } from './plannerStore';
import { trackRoomCreated } from '../utils/analytics';

export interface SavedRoom {
  id: string;
  name: string;
  room: RoomShape;
  placedItems: PlacedItem[];
  updatedAt: Timestamp | null;
}

// Utility to recursively remove undefined keys before passing payload to Firestore setDoc
function sanitizePayload<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sanitizePayload) as unknown as T;
  const clean: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      clean[key] = sanitizePayload(value);
    }
  }
  return clean;
}

// Rooms live at users/{uid}/rooms/{roomId} — a subcollection scoped to the owning user's uid,
// matching the Firestore security rules (request.auth.uid == userId), so one user's saved
// rooms are never readable or writable by anyone else.
function roomsCollection(uid: string) {
  return collection(db, 'users', uid, 'rooms');
}

export async function saveRoom(
  uid: string,
  roomId: string,
  data: { name: string; room: RoomShape; placedItems: PlacedItem[] },
): Promise<void> {
  const cleanData = sanitizePayload(data);
  await setDoc(doc(roomsCollection(uid), roomId), {
    name: cleanData.name || 'My Room',
    room: cleanData.room,
    placedItems: cleanData.placedItems || [],
    updatedAt: serverTimestamp(),
  });

  try {
    const bbox = data.room?.vertices ? boundingBox(data.room.vertices) : { minX: 0, maxX: 4, minZ: 0, maxZ: 4 };
    trackRoomCreated({
      roomId,
      roomName: data.name,
      shapeType: data.room?.vertices ? detectShapeType(data.room.vertices) : 'rectangular',
      width: Math.round((bbox.maxX - bbox.minX) * 100) / 100,
      length: Math.round((bbox.maxZ - bbox.minZ) * 100) / 100,
      height: data.room?.height || 0,
      itemsCount: data.placedItems?.length || 0,
    });
  } catch (err) {
    console.warn('Analytics trackRoomCreated skipped:', err);
  }
}

export async function getSavedRoom(uid: string, roomId: string): Promise<SavedRoom | null> {
  const docRef = doc(roomsCollection(uid), roomId);
  const snapshot = await getDoc(docRef);
  if (!snapshot.exists()) return null;
  return { id: snapshot.id, ...(snapshot.data() as Omit<SavedRoom, 'id'>) };
}

export async function listRooms(uid: string): Promise<SavedRoom[]> {
  const q = query(roomsCollection(uid), orderBy('updatedAt', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SavedRoom, 'id'>) }));
}

export async function deleteRoom(uid: string, roomId: string): Promise<void> {
  await deleteDoc(doc(roomsCollection(uid), roomId));
}

export async function saveSharedRoom(
  roomId: string,
  data: { name: string; room: RoomShape; placedItems: PlacedItem[] }
): Promise<void> {
  try {
    const cleanData = sanitizePayload(data);
    await setDoc(doc(db, 'sharedRooms', roomId), {
      name: cleanData.name || 'My Room',
      room: cleanData.room,
      placedItems: cleanData.placedItems || [],
      updatedAt: serverTimestamp(),
    });
  } catch {
    // Silently skip sharedRooms write if Cloud Firestore rules restrict top-level collection writes
  }
}

export async function getSharedRoom(roomId: string): Promise<SavedRoom | null> {
  try {
    const docRef = doc(db, 'sharedRooms', roomId);
    const snapshot = await getDoc(docRef);
    if (!snapshot.exists()) return null;
    return { id: snapshot.id, ...(snapshot.data() as Omit<SavedRoom, 'id'>) };
  } catch {
    return null;
  }
}

export function newRoomId(uid: string): string {
  return doc(roomsCollection(uid)).id; // Firestore auto-id, generated client-side without a write
}
