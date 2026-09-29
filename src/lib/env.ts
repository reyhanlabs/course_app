const env = import.meta.env;

const required = {
  VITE_FIREBASE_API_KEY: env.VITE_FIREBASE_API_KEY,
  VITE_FIREBASE_AUTH_DOMAIN: env.VITE_FIREBASE_AUTH_DOMAIN,
  VITE_FIREBASE_PROJECT_ID: env.VITE_FIREBASE_PROJECT_ID,
  VITE_FIREBASE_STORAGE_BUCKET: env.VITE_FIREBASE_STORAGE_BUCKET,
  VITE_FIREBASE_MESSAGING_SENDER_ID: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  VITE_FIREBASE_APP_ID: env.VITE_FIREBASE_APP_ID,
};

export const missingEnv = Object.entries(required)
  .filter(([, value]) => !value)
  .map(([key]) => key);

export const firebaseConfig = {
  apiKey: required.VITE_FIREBASE_API_KEY,
  authDomain: required.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: required.VITE_FIREBASE_PROJECT_ID,
  storageBucket: required.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: required.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: required.VITE_FIREBASE_APP_ID,
};

export const useEmulators = env.VITE_USE_EMULATORS === 'true';
export const appName = env.VITE_APP_NAME || 'English Course';
