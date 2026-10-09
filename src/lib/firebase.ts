import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  getFirestore
} from 'firebase/firestore';
import { app, auth } from './firebaseApp';

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

export { app, db, auth };
