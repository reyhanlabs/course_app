import { GoogleAuthProvider, signInWithPopup, type User } from 'firebase/auth';
import { FirebaseError } from 'firebase/app';
import { auth } from '../lib/firebase';

/**
 * Login Google memakai popup. (Redirect sering gagal di Chrome/Safari terbaru
 * karena authDomain firebaseapp.com berbeda dengan domain Vercel.)
 * Mengembalikan null bila pengguna menutup popup.
 */
export async function signInWithGoogle(): Promise<User | null> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  try {
    return (await signInWithPopup(auth, provider)).user;
  } catch (e) {
    if (e instanceof FirebaseError && (e.code === 'auth/popup-closed-by-user' || e.code === 'auth/cancelled-popup-request')) {
      return null;
    }
    throw e;
  }
}
