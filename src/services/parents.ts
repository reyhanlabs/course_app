import {
  addDoc,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { sortByText } from '../lib/format';
import type { Parent, ParentInput } from '../types';
import { createAuthAccount, isValidEmail, sendSetupEmail } from './accounts';
import { addAuditLog } from './audit';
import { countDocs, getDocById, listDocs, required } from './db';
import { listStudentsOfParent } from './students';
import { syncParentUsers, syncStudentFinanceParents } from './parentAccess';

const COL = 'parents';

export async function listParents(): Promise<Parent[]> {
  return sortByText(await listDocs<Parent>(COL), (p) => p.fullName);
}

export const getParent = (id: string) => getDocById<Parent>(COL, id);

/** Dipakai portal orang tua untuk membaca profilnya sendiri. */
export async function getParentByUserId(uid: string): Promise<Parent | null> {
  const rows = await listDocs<Parent>(COL, where('userId', '==', uid));
  return rows[0] ?? null;
}

function cleanInput(input: ParentInput) {
  const email = input.email.trim().toLowerCase();
  if (email && !isValidEmail(email)) throw new Error('Format email tidak valid.');
  return {
    fullName: required(input.fullName, 'Nama lengkap'),
    phone: input.phone.trim(),
    whatsapp: input.whatsapp.trim(),
    email,
    address: input.address.trim(),
    relationship: input.relationship,
  };
}

export async function createParent(input: ParentInput): Promise<string> {
  const ref = await addDoc(collection(db, COL), {
    ...cleanInput(input),
    userId: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateParent(parent: Parent, input: ParentInput) {
  const data = cleanInput(input);
  if (parent.userId && data.email !== parent.email) {
    // Email login Firebase Auth tidak bisa diubah dari aplikasi admin tanpa backend.
    throw new Error('Orang tua ini sudah punya akun login, jadi emailnya tidak bisa diubah di sini.');
  }
  await updateDoc(doc(db, COL, parent.id), { ...data, updatedAt: serverTimestamp() });
}

export async function deleteParent(parent: Parent) {
  if (parent.userId) {
    throw new Error('Orang tua yang sudah punya akun tidak bisa dihapus. Nonaktifkan akunnya di menu Pengguna.');
  }
  const children = await countDocs('students', where('parentIds', 'array-contains', parent.id));
  if (children > 0) throw new Error('Lepaskan dulu hubungan dengan semua anak sebelum menghapus orang tua ini.');
  await deleteDoc(doc(db, COL, parent.id));
}

/**
 * Membuat akun login orang tua, lalu menambahkan uid-nya ke semua anak
 * (students.parentUids) agar Security Rules mengizinkan akses.
 */
export async function createParentAccount(parent: Parent) {
  if (parent.userId) throw new Error('Orang tua ini sudah punya akun.');
  if (!parent.email || !isValidEmail(parent.email)) {
    throw new Error('Isi email orang tua yang valid terlebih dahulu.');
  }
  const children = await listStudentsOfParent(parent.id);
  const uid = await createAuthAccount(parent.email);

  const batch = writeBatch(db);
  batch.set(doc(db, 'users', uid), {
    email: parent.email,
    displayName: parent.fullName,
    role: 'parent',
    active: true,
    parentId: parent.id,
    teacherId: null,
    classIds: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  batch.update(doc(db, COL, parent.id), { userId: uid, updatedAt: serverTimestamp() });
  for (const child of children) {
    batch.update(doc(db, 'students', child.id), { parentUids: arrayUnion(uid), updatedAt: serverTimestamp() });
  }
  addAuditLog(batch, {
    action: 'user_account_created',
    module: 'users',
    recordId: uid,
    newData: { role: 'parent', parentId: parent.id, email: parent.email },
  });
  await batch.commit();
  await syncParentUsers([uid]);
  for (const child of children) await syncStudentFinanceParents(child.id);
  await sendSetupEmail(parent.email);
}
