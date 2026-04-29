import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { env } from './config/env';

const firebaseConfig = {
  apiKey: env.firebase.apiKey,
  authDomain: env.firebase.authDomain,
  projectId: env.firebase.projectId,
  appId: env.firebase.appId,
  ...(env.firebase.storageBucket ? { storageBucket: env.firebase.storageBucket } : {}),
  ...(env.firebase.messagingSenderId ? { messagingSenderId: env.firebase.messagingSenderId } : {}),
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
