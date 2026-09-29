import { initializeApp } from 'firebase/app';
import {
  connectAuthEmulator,
  getAuth,
  inMemoryPersistence,
  initializeAuth,
  type Auth,
} from 'firebase/auth';
import { connectFirestoreEmulator, initializeFirestore } from 'firebase/firestore';
import { connectStorageEmulator, getStorage } from 'firebase/storage';
import { firebaseConfig, useEmulators } from './env';

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = initializeFirestore(app, { ignoreUndefinedProperties: true });
export const storage = getStorage(app);

if (useEmulators) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  connectStorageEmulator(storage, '127.0.0.1', 9199);
}

let secondaryAuth: Auth | null = null;

/**
 * Instance Auth kedua (tanpa persistence) khusus untuk membuat akun
 * pengguna lain. Dengan begitu admin yang sedang login tidak ikut ter-logout.
 * Tidak perlu server/Cloud Functions.
 */
export function getSecondaryAuth(): Auth {
  if (!secondaryAuth) {
    const secondaryApp = initializeApp(firebaseConfig, 'account-creator');
    secondaryAuth = initializeAuth(secondaryApp, { persistence: inMemoryPersistence });
    if (useEmulators) {
      connectAuthEmulator(secondaryAuth, 'http://127.0.0.1:9099', { disableWarnings: true });
    }
  }
  return secondaryAuth;
}
