import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  type Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { RoomShape } from '../Data/RoomShape';
import type { PlacedItem } from './plannerStore';

export interface SavedRoom {
  id: string;
  name: string;
  room: RoomShape;
  placedItems: PlacedItem[];
  updatedAt: Timestamp | null;
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
  await setDoc(doc(roomsCollection(uid), roomId), {
    name: data.name,
    room: data.room,
    placedItems: data.placedItems,
    updatedAt: serverTimestamp(),
  });
}

export async function listRooms(uid: string): Promise<SavedRoom[]> {
  const q = query(roomsCollection(uid), orderBy('updatedAt', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SavedRoom, 'id'>) }));
}

export async function deleteRoom(uid: string, roomId: string): Promise<void> {
  await deleteDoc(doc(roomsCollection(uid), roomId));
}

export function newRoomId(uid: string): string {
  return doc(roomsCollection(uid)).id; // Firestore auto-id, generated client-side without a write
}
