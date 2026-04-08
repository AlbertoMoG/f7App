import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyD2SvViOAx3YRiaW6Qb0TUbWwz_KzTcLgs",
  authDomain: "ai-studio-applet-webapp-72375.firebaseapp.com",
  projectId: "ai-studio-applet-webapp-72375",
  storageBucket: "ai-studio-applet-webapp-72375.firebasestorage.app",
  messagingSenderId: "668297426248",
  appId: "1:668297426248:web:bef26dcbf7eb5b7f8caf7d"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
