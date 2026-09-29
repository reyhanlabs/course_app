import { addDoc, collection, doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { sortByText } from '../lib/format';
import type { Room, RoomInput } from '../types';
import { listDocs, required } from './db';

const COL = 'rooms';

export async function listRooms(): Promise<Room[]> {
  return sortByText(await listDocs<Room>(COL), (r) => r.name);
}

export async function saveRoom(id: string | null, input: RoomInput, existing: Room[]) {
  const name = required(input.name, 'Nama ruangan');
  if (existing.some((r) => r.id !== id && r.name.toLowerCase() === name.toLowerCase())) {
    throw new Error('Nama ruangan sudah dipakai.');
  }
  const data = {
    name,
    capacity: Math.max(0, Math.floor(Number(input.capacity) || 0)),
    status: input.status,
    updatedAt: serverTimestamp(),
  };
  if (id) await updateDoc(doc(db, COL, id), data);
  else await addDoc(collection(db, COL), { ...data, createdAt: serverTimestamp() });
}
