import {
  collection,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  query,
  type QueryConstraint,
} from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

export async function listDocs<T extends { id: string }>(
  collectionName: string,
  ...constraints: QueryConstraint[]
): Promise<T[]> {
  const snap = await getDocs(query(collection(db, collectionName), ...constraints));
  return snap.docs.map((d) => ({ ...d.data(), id: d.id }) as T);
}

export async function getDocById<T extends { id: string }>(
  collectionName: string,
  id: string,
): Promise<T | null> {
  const snap = await getDoc(doc(db, collectionName, id));
  return snap.exists() ? ({ ...snap.data(), id: snap.id } as T) : null;
}

export async function countDocs(collectionName: string, ...constraints: QueryConstraint[]) {
  const snap = await getCountFromServer(query(collection(db, collectionName), ...constraints));
  return snap.data().count;
}

export function currentUid(): string {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Sesi login berakhir. Silakan login ulang.');
  return uid;
}

export function required(value: string, label: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`${label} wajib diisi.`);
  return trimmed;
}
