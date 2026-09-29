import { createUserWithEmailAndPassword, deleteUser, type User } from 'firebase/auth';
import { doc, getDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { FirebaseError } from 'firebase/app';
import { auth, db } from '../lib/firebase';

const SETUP = doc(db, 'system', 'setup');

/** true = admin pertama sudah dibuat. Bisa dicek tanpa login. */
export async function isSetupDone(): Promise<boolean> {
  return (await getDoc(SETUP)).exists();
}

/** Profil admin + penanda setup ditulis dalam satu batch (lihat firestore.rules). */
async function writeFirstAdmin(user: User, displayName: string) {
  const batch = writeBatch(db);
  batch.set(doc(db, 'users', user.uid), {
    email: user.email,
    displayName: displayName.trim() || user.email,
    role: 'admin',
    active: true,
    parentId: null,
    teacherId: null,
    classIds: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  batch.set(SETUP, { adminUid: user.uid, createdAt: serverTimestamp() });
  await batch.commit();
}

function setupError(e: unknown): Error {
  if (e instanceof FirebaseError) {
    if (e.code === 'auth/operation-not-allowed') {
      return new Error('Login Email/Password belum aktif. Buka Firebase Console → Authentication → Sign-in method → Email/Password → Enable.');
    }
    if (e.code === 'permission-denied') {
      return new Error('Setup ditolak. Pastikan Firestore sudah dibuat dan rules sudah di-deploy (npm run deploy:rules), atau admin pertama sudah pernah dibuat.');
    }
    if (e.code === 'auth/email-already-in-use') {
      return new Error('Email ini sudah terdaftar. Masuk dulu dengan email tersebut, lalu pilih "Jadikan akun ini admin".');
    }
    if (e.code === 'auth/weak-password') return new Error('Kata sandi minimal 6 karakter.');
    if (e.code === 'auth/invalid-email') return new Error('Format email tidak valid.');
  }
  return e instanceof Error ? e : new Error('Setup gagal.');
}

/** Membuat akun login baru sekaligus menjadikannya admin pertama. */
export async function createFirstAdmin(input: { name: string; email: string; password: string }) {
  if (!input.name.trim()) throw new Error('Nama wajib diisi.');
  if (await isSetupDone()) throw new Error('Admin pertama sudah ada. Silakan masuk.');
  let user: User;
  try {
    user = (await createUserWithEmailAndPassword(auth, input.email.trim(), input.password)).user;
  } catch (e) {
    throw setupError(e);
  }
  try {
    await writeFirstAdmin(user, input.name);
  } catch (e) {
    // Jangan tinggalkan akun login tanpa profil.
    await deleteUser(user).catch(() => undefined);
    throw setupError(e);
  }
}

/** Admin pertama memakai akun Google. */
export async function createFirstAdminWithGoogle(signIn: () => Promise<User | null>) {
  if (await isSetupDone()) throw new Error('Admin pertama sudah ada. Silakan masuk.');
  let user: User | null;
  try {
    user = await signIn();
  } catch (e) {
    throw setupError(e);
  }
  if (!user) return false; // popup ditutup
  // Akun Google ini mungkin sudah punya profil (mis. sudah admin): tidak perlu apa-apa.
  if ((await getDoc(doc(db, 'users', user.uid)).catch(() => null))?.exists()) return true;
  try {
    await writeFirstAdmin(user, user.displayName ?? '');
  } catch (e) {
    throw setupError(e);
  }
  return true;
}

/** Untuk akun yang sudah login tapi belum punya profil (mis. dibuat di Console). */
export async function promoteCurrentUserToFirstAdmin(displayName: string) {
  const user = auth.currentUser;
  if (!user) throw new Error('Silakan masuk terlebih dahulu.');
  if (await isSetupDone()) throw new Error('Admin pertama sudah ada. Minta admin membuatkan profil untuk akun ini.');
  try {
    await writeFirstAdmin(user, displayName);
  } catch (e) {
    throw setupError(e);
  }
}

/**
 * Admin yang dibuat manual (sebelum fitur ini ada) belum punya penanda setup.
 * Dipanggil saat admin login agar halaman setup tertutup permanen.
 */
export async function ensureSetupMarker(uid: string) {
  try {
    if (!(await isSetupDone())) {
      const batch = writeBatch(db);
      batch.set(SETUP, { adminUid: uid, createdAt: serverTimestamp() });
      await batch.commit();
    }
  } catch {
    // tidak kritis
  }
}
