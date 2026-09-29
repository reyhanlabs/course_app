import { collection, deleteDoc, doc, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Material, MaterialType, UserProfile } from '../types';
import { listDocs, required } from './db';
import { deleteFile, uploadFile } from './storage';

const COL = 'materials';
export const MAX_MATERIAL_BYTES = 100 * 1024 * 1024;

export async function listMaterials(): Promise<Material[]> {
  const rows = await listDocs<Material>(COL);
  return rows.sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0));
}

export function guessMaterialType(file: File): MaterialType {
  if (file.type === 'application/pdf') return 'pdf';
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('audio/')) return 'audio';
  if (file.type.startsWith('video/')) return 'video';
  return 'document';
}

export async function createMaterial(
  input: { title: string; description: string; type: MaterialType; levelId: string | null; lessonId: string | null; topic: string; skill: string; externalUrl: string; visibleToParents: boolean },
  file: File | null,
  profile: UserProfile,
) {
  const title = required(input.title, 'Judul materi');
  const ref = doc(collection(db, COL));
  let storageUrl = '';
  let storagePath: string | null = null;
  let fileName: string | null = null;

  if (input.type === 'url') {
    const url = input.externalUrl.trim();
    if (!/^https?:\/\//i.test(url)) throw new Error('Tautan harus diawali http:// atau https://');
    storageUrl = url;
  } else {
    if (!file) throw new Error('Pilih file yang akan diunggah.');
    const uploaded = await uploadFile('materials', ref.id, file, MAX_MATERIAL_BYTES);
    storageUrl = uploaded.url;
    storagePath = uploaded.path;
    fileName = uploaded.name;
  }

  try {
    await setDoc(ref, {
      title,
      description: input.description.trim(),
      type: input.type,
      storageUrl,
      storagePath,
      fileName,
      levelId: input.levelId || null,
      lessonId: input.lessonId || null,
      topic: input.topic.trim(),
      skill: input.skill,
      visibleToParents: input.visibleToParents,
      createdBy: profile.id,
      createdByName: profile.displayName,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (e) {
    await deleteFile(storagePath); // jangan tinggalkan file yatim
    throw e;
  }
}

export async function deleteMaterial(material: Material) {
  await deleteFile(material.storagePath);
  await deleteDoc(doc(db, COL, material.id));
}

export async function setMaterialVisibility(material: Material, visibleToParents: boolean) {
  await updateDoc(doc(db, COL, material.id), { visibleToParents, updatedAt: serverTimestamp() });
}

/** Portal orang tua: rules hanya mengizinkan materi yang ditandai visibleToParents. */
export async function listParentMaterials(): Promise<Material[]> {
  const rows = await listDocs<Material>(COL, where('visibleToParents', '==', true));
  return rows.sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0));
}
