// Web push bildirimleri (Firebase Cloud Messaging) - ücretsiz.
// Bu cihazın bildirim jetonu users/{uid}/push_tokens/{özet} altında saklanır;
// ziyaretçi bildirim gönderdiğinde sunucu bu jetonlara bildirim yollar.

import { getMessaging, getToken, isSupported } from 'firebase/messaging';
import { deleteDoc, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { app } from './firebaseApp';
import { db } from './firebase';

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined;

export type PushState =
  | 'unsupported'      // Tarayıcı desteklemiyor
  | 'ios-install'      // iPhone/iPad: önce ana ekrana eklenmeli
  | 'not-configured'   // VAPID anahtarı tanımlı değil
  | 'denied'           // Kullanıcı izin vermedi
  | 'off'              // Desteklenir, henüz açılmadı
  | 'on';              // Bu cihazda açık

export function isIos(): boolean {
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1);
}

export function isStandalone(): boolean {
  return window.matchMedia?.('(display-mode: standalone)').matches
    || (navigator as unknown as { standalone?: boolean }).standalone === true;
}

async function hashToken(token: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(buf)).slice(0, 20).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function swRegistration(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration('/');
  if (existing) return existing;
  return navigator.serviceWorker.register('/sw.js');
}

async function currentToken(): Promise<string | null> {
  if (!VAPID_KEY) return null;
  const registration = await swRegistration();
  await navigator.serviceWorker.ready;
  const token = await getToken(getMessaging(app), { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration });
  return token || null;
}

async function saveToken(uid: string, token: string): Promise<void> {
  const id = await hashToken(token);
  await setDoc(doc(db, 'users', uid, 'push_tokens', id), {
    token,
    platform: isIos() ? 'ios' : /Android/i.test(navigator.userAgent) ? 'android' : 'web',
    userAgent: navigator.userAgent.slice(0, 200),
    updatedAt: serverTimestamp(),
  });
}

/** Bu cihazdaki durumu döndürür; izin zaten verilmişse jetonu sessizce tazeler. */
export async function getPushState(uid: string | null): Promise<PushState> {
  const supported = 'serviceWorker' in navigator && 'Notification' in window && (await isSupported().catch(() => false));
  if (!supported) return isIos() && !isStandalone() ? 'ios-install' : 'unsupported';
  if (!VAPID_KEY) return 'not-configured';
  if (Notification.permission === 'denied') return 'denied';
  if (Notification.permission !== 'granted') return 'off';
  if (!uid) return 'off';
  try {
    const token = await currentToken();
    if (!token) return 'off';
    await saveToken(uid, token);
    return 'on';
  } catch {
    return 'off';
  }
}

/** İzin ister ve bu cihazı bildirim almak üzere kaydeder. */
export async function enablePush(uid: string): Promise<PushState> {
  const state = await getPushState(null);
  if (state === 'unsupported' || state === 'ios-install' || state === 'not-configured' || state === 'denied') return state;
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return permission === 'denied' ? 'denied' : 'off';
  const token = await currentToken();
  if (!token) throw new Error('Bildirim jetonu alınamadı.');
  await saveToken(uid, token);
  return 'on';
}

/**
 * Bu cihazı kullanıcının bildirim listesinden çıkarır.
 * Çıkış yaparken de çağrılır; böylece aynı telefonda başka hesap açılırsa eski hesabın bildirimleri gelmez.
 */
export async function disablePushOnThisDevice(uid: string): Promise<void> {
  if (!('Notification' in window) || Notification.permission !== 'granted' || !VAPID_KEY) return;
  const token = await currentToken().catch(() => null);
  if (!token) return;
  await deleteDoc(doc(db, 'users', uid, 'push_tokens', await hashToken(token)));
}
