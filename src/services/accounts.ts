import { createUserWithEmailAndPassword, sendPasswordResetEmail, signOut } from 'firebase/auth';
import { auth, getSecondaryAuth } from '../lib/firebase';

function randomPassword(): string {
  const values = new Uint32Array(4);
  crypto.getRandomValues(values);
  return `${Array.from(values, (n) => n.toString(36)).join('')}Aa1!`;
}

/**
 * Membuat akun Firebase Auth dengan kata sandi acak yang tidak pernah
 * ditampilkan. Setelah profil Firestore tersimpan, panggil sendSetupEmail()
 * agar pengguna membuat kata sandinya sendiri lewat email reset.
 */
export async function createAuthAccount(email: string): Promise<string> {
  const secondary = getSecondaryAuth();
  const cred = await createUserWithEmailAndPassword(secondary, email.trim(), randomPassword());
  await signOut(secondary);
  return cred.user.uid;
}

export function sendSetupEmail(email: string) {
  return sendPasswordResetEmail(auth, email.trim());
}

export function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}
