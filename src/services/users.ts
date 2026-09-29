import { doc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { sortByText } from '../lib/format';
import type { UserProfile } from '../types';
import { createAuthAccount, isValidEmail, sendSetupEmail } from './accounts';
import { addAuditLog } from './audit';
import { listDocs, required } from './db';

export async function listUsers(): Promise<UserProfile[]> {
  return sortByText(await listDocs<UserProfile>('users'), (u) => u.displayName);
}

/** Akun guru & orang tua dibuat dari menu Guru / Orang Tua agar terhubung ke datanya. */
export async function createStaffAccount(input: { email: string; displayName: string; role: 'admin' | 'owner' }) {
  const displayName = required(input.displayName, 'Nama');
  const email = input.email.trim().toLowerCase();
  if (!isValidEmail(email)) throw new Error('Format email tidak valid.');
  const uid = await createAuthAccount(email);
  const batch = writeBatch(db);
  batch.set(doc(db, 'users', uid), {
    email,
    displayName,
    role: input.role,
    active: true,
    parentId: null,
    teacherId: null,
    classIds: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  addAuditLog(batch, {
    action: 'user_account_created',
    module: 'users',
    recordId: uid,
    newData: { role: input.role, email },
  });
  await batch.commit();
  await sendSetupEmail(email);
}

export async function setUserActive(user: UserProfile, active: boolean) {
  const batch = writeBatch(db);
  batch.update(doc(db, 'users', user.id), { active, updatedAt: serverTimestamp() });
  addAuditLog(batch, {
    action: 'user_status_changed',
    module: 'users',
    recordId: user.id,
    oldData: { active: user.active },
    newData: { active },
  });
  await batch.commit();
}
