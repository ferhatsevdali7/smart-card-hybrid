import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager, 
  getFirestore 
} from 'firebase/firestore';
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

// Initialize Cloud Firestore with Offline Persistent Local Cache (IndexedDB)
let db: ReturnType<typeof getFirestore>;
try {
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager()
    })
  });
} catch (e) {
  // If already initialized, get standard instance
  db = getFirestore(app);
}

const auth = getAuth(app);

export { app, db, auth };
