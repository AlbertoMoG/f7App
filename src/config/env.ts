type RequiredEnvKey =
  | 'VITE_FIREBASE_API_KEY'
  | 'VITE_FIREBASE_AUTH_DOMAIN'
  | 'VITE_FIREBASE_PROJECT_ID'
  | 'VITE_FIREBASE_APP_ID';

function getRequiredEnv(key: RequiredEnvKey): string {
  const value = import.meta.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export const env = {
  /**
   * Optional Gemini key for client-side calls. **Exposed in the built JS** (Vite `VITE_` prefix).
   * For production, prefer Firebase Callable / backend proxy so the key never ships to browsers.
   */
  geminiApiKey: (import.meta.env.VITE_GEMINI_API_KEY as string | undefined) ?? '',
  firebase: {
    apiKey: getRequiredEnv('VITE_FIREBASE_API_KEY'),
    authDomain: getRequiredEnv('VITE_FIREBASE_AUTH_DOMAIN'),
    projectId: getRequiredEnv('VITE_FIREBASE_PROJECT_ID'),
    appId: getRequiredEnv('VITE_FIREBASE_APP_ID'),
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? '',
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? '',
    firestoreDatabaseId: import.meta.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID ?? '',
  },
};
