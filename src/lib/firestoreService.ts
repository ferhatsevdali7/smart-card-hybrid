import { doc, getDoc, setDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { SmartCard } from '../types/card';
import { getStoredCardData, saveStoredCardData } from './storage';

const COLLECTION_NAME = 'cards';
const USERS_COLLECTION = 'users';

/**
 * Saves or updates a card record in Cloud Firestore, linking to user if logged in
 */
export async function saveCardToFirestore(card: SmartCard, ownerUid?: string): Promise<void> {
  try {
    const cardRef = doc(db, COLLECTION_NAME, card.cardId);
    const payload: any = {
      ...card,
      updatedAtFirestore: serverTimestamp()
    };
    if (ownerUid) {
      payload.ownerUid = ownerUid;
    }
    await setDoc(cardRef, payload, { merge: true });

    if (ownerUid) {
      const userRef = doc(db, USERS_COLLECTION, ownerUid);
      await setDoc(userRef, {
        lastCardId: card.cardId,
        updatedAt: serverTimestamp()
      }, { merge: true });
    }

    // Also keep local storage in sync
    saveStoredCardData(card);
  } catch (error) {
    console.warn('Firestore write warning (falling back to localStorage):', error);
    saveStoredCardData(card);
  }
}

/**
 * Fetches a single card by its ID from Firestore, falling back to LocalStorage
 */
export async function fetchCardFromFirestore(cardId: string): Promise<SmartCard> {
  try {
    const cardRef = doc(db, COLLECTION_NAME, cardId);
    const snap = await getDoc(cardRef);
    if (snap.exists()) {
      return snap.data() as SmartCard;
    }
  } catch (error) {
    console.warn('Firestore read error, using local data:', error);
  }

  // Fallback to local
  return getStoredCardData();
}

/**
 * Fetches the card belonging to a specific logged-in user
 */
export async function fetchUserCard(userId: string): Promise<SmartCard | null> {
  try {
    const userRef = doc(db, USERS_COLLECTION, userId);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      const userData = userSnap.data();
      if (userData?.lastCardId) {
        return await fetchCardFromFirestore(userData.lastCardId);
      }
    }
  } catch (error) {
    console.warn('User card fetch error:', error);
  }
  return null;
}

/**
 * Subscribes to real-time updates of a card from Cloud Firestore
 */
export function listenToCardUpdates(cardId: string, onUpdate: (card: SmartCard) => void): () => void {
  try {
    const cardRef = doc(db, COLLECTION_NAME, cardId);
    return onSnapshot(cardRef, (snap) => {
      if (snap.exists()) {
        const remoteData = snap.data() as SmartCard;
        onUpdate(remoteData);
      }
    }, (err) => {
      console.warn('Firestore real-time sync warning:', err);
    });
  } catch (error) {
    console.warn('Could not establish real-time listener:', error);
    return () => {};
  }
}

