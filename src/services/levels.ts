import { addDoc, collection, doc, serverTimestamp, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Level, LevelInput } from '../types';
import { listDocs, required } from './db';

const COL = 'levels';

export const DEFAULT_LEVELS = ['Kindergarten', 'Grade 1 SD', 'Grade 2 SD', 'Grade 3–4 SD'];

export async function listLevels(): Promise<Level[]> {
  const levels = await listDocs<Level>(COL);
  return levels.sort((a, b) => a.order - b.order);
}

export async function createLevel(input: LevelInput, existing: Level[]) {
  const name = required(input.name, 'Nama level');
  if (existing.some((l) => l.name.toLowerCase() === name.toLowerCase())) {
    throw new Error('Nama level sudah ada.');
  }
  const order = existing.reduce((max, l) => Math.max(max, l.order), 0) + 1;
  await addDoc(collection(db, COL), {
    name,
    description: input.description.trim(),
    order,
    active: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function updateLevel(id: string, input: LevelInput, existing: Level[]) {
  const name = required(input.name, 'Nama level');
  if (existing.some((l) => l.id !== id && l.name.toLowerCase() === name.toLowerCase())) {
    throw new Error('Nama level sudah ada.');
  }
  await updateDoc(doc(db, COL, id), {
    name,
    description: input.description.trim(),
    updatedAt: serverTimestamp(),
  });
}

export async function setLevelActive(id: string, active: boolean) {
  await updateDoc(doc(db, COL, id), { active, updatedAt: serverTimestamp() });
}

export async function swapLevelOrder(a: Level, b: Level) {
  const batch = writeBatch(db);
  batch.update(doc(db, COL, a.id), { order: b.order, updatedAt: serverTimestamp() });
  batch.update(doc(db, COL, b.id), { order: a.order, updatedAt: serverTimestamp() });
  await batch.commit();
}

export async function seedDefaultLevels() {
  const batch = writeBatch(db);
  DEFAULT_LEVELS.forEach((name, index) => {
    batch.set(doc(collection(db, COL)), {
      name,
      description: '',
      order: index + 1,
      active: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });
  await batch.commit();
}
