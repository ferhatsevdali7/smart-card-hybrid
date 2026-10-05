import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager, 
  getFirestore 
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

// Firebase configuration using Vite environment variables with graceful fallback
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDummyKeyForLocalDemoAndPreviewOnly",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "akilli-kart-sos.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "akilli-kart-sos",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "akilli-kart-sos.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "1234567890",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:1234567890:web:abcdef123456"
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
