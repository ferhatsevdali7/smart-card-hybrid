// Firebase uygulaması + kimlik doğrulama (hafif çekirdek).
// QR tarama sayfası yalnızca bunu yükler; Firestore SDK'sı ana uygulamayla gelir.
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

// Official Firebase configuration for smart-card-hybrid project
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDqbGUrV_DqJqPLlq6hfi7cVRAscJ84iK8",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "smart-card-hybrid.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "smart-card-hybrid",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "smart-card-hybrid.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "742440634818",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:742440634818:web:9ef8b40f268ad53bccee5b",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-21ZFS0TQ6P"
};

// Initialize Firebase App singleton
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

const auth = getAuth(app);

export { app, auth };
