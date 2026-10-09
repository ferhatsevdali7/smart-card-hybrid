// Yönetici hesabı: profil, oturum kayıtları, şifre değiştirme ve etkinlik geçmişi.
//
// Koleksiyonlar:
//   admin_profiles/{uid}         Ad, telefon, profil fotoğrafı (küçültülmüş JPEG)
//   admin_sessions/{sessionId}   Panelin açık olduğu her tarayıcı için bir kayıt
//
// Not: Firebase, "hangi cihazlarda oturum açık" listesini kendisi tutmaz.
// Bu yüzden her girişi burada kayda geçiriyoruz. "Oturumu kapat" o cihazdaki
// paneli kapatır; hesabın ele geçirildiğinden şüpheleniliyorsa şifre
// değiştirilmelidir (Firebase bu durumda tüm cihazlardaki oturumları geçersiz kılar).

import {
  collection, doc, getDoc, getDocs, limit, onSnapshot, query, serverTimestamp,
  setDoc, Timestamp, updateDoc, where, writeBatch,
} from 'firebase/firestore';
import {
  EmailAuthProvider, GoogleAuthProvider, linkWithCredential, reauthenticateWithCredential, reauthenticateWithPopup,
  updatePassword, updateProfile, User,
} from 'firebase/auth';
import { auth, db } from './firebase';

export const ADMIN_SESSION_HOURS = 8;

// ---------------------------------------------------------------------------
// Profil
// ---------------------------------------------------------------------------

export interface AdminProfile {
  displayName: string;
  phone: string;
  photoDataUrl: string | null;
}

export function listenAdminProfile(uid: string, onData: (p: AdminProfile | null) => void): () => void {
  return onSnapshot(
    doc(db, 'admin_profiles', uid),
    (snap) => {
      if (!snap.exists()) return onData(null);
      const d = snap.data();
      onData({
        displayName: typeof d.displayName === 'string' ? d.displayName : '',
        phone: typeof d.phone === 'string' ? d.phone : '',
        photoDataUrl: typeof d.photoDataUrl === 'string' ? d.photoDataUrl : null,
      });
    },
    () => onData(null),
  );
}

export async function saveAdminProfile(uid: string, profile: AdminProfile): Promise<void> {
  const clean: AdminProfile = {
    displayName: profile.displayName.trim().slice(0, 60),
    phone: profile.phone.replace(/[^\d+ ]/g, '').trim().slice(0, 20),
    photoDataUrl: profile.photoDataUrl,
  };
  await setDoc(doc(db, 'admin_profiles', uid), { ...clean, updatedAt: serverTimestamp() });
  const user = auth.currentUser;
  if (user && user.uid === uid && clean.displayName && user.displayName !== clean.displayName) {
    await updateProfile(user, { displayName: clean.displayName }).catch(() => undefined);
  }
}

/** Seçilen fotoğrafı ortadan kare kırpar, 160 px JPEG'e küçültür (Firestore'a sığacak boyut). */
export async function imageFileToAvatar(file: File): Promise<string> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error('type');
  if (file.size > 8 * 1024 * 1024) throw new Error('size');
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });
    const size = 160;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const sx = (img.naturalWidth - side) / 2;
    const sy = (img.naturalHeight - side) / 2;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);
    ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
    for (const q of [0.85, 0.7, 0.55]) {
      const data = canvas.toDataURL('image/jpeg', q);
      if (data.length < 60000) return data;
    }
    throw new Error('size');
  } finally {
    URL.revokeObjectURL(url);
  }
}

// ---------------------------------------------------------------------------
// Oturumlar
// ---------------------------------------------------------------------------

export interface AdminSessionRecord {
  id: string;
  device: string;
  createdAt: Date | null;
  lastActiveAt: Date | null;
  expiresAt: Date | null;
  revoked: boolean;
}

/** "Windows · Chrome" gibi okunaklı cihaz adı */
export function deviceLabel(ua: string = navigator.userAgent): string {
  const os = /Android/i.test(ua) ? 'Android'
    : /iPhone/i.test(ua) ? 'iPhone'
    : /iPad/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1) ? 'iPad'
    : /Windows/i.test(ua) ? 'Windows'
    : /Mac OS X|Macintosh/i.test(ua) ? 'macOS'
    : /Linux/i.test(ua) ? 'Linux'
    : 'Bilinmeyen cihaz';
  const browser = /Edg\//.test(ua) ? 'Edge'
    : /OPR\//.test(ua) ? 'Opera'
    : /SamsungBrowser/.test(ua) ? 'Samsung Internet'
    : /Firefox\//.test(ua) ? 'Firefox'
    : /Chrome\//.test(ua) ? 'Chrome'
    : /Safari\//.test(ua) ? 'Safari'
    : 'Tarayıcı';
  return `${os} · ${browser}`;
}

function toDate(v: unknown): Date | null {
  return v instanceof Timestamp ? v.toDate() : null;
}

function mapSession(id: string, d: Record<string, unknown>): AdminSessionRecord {
  return {
    id,
    device: typeof d.device === 'string' ? d.device : 'Bilinmeyen cihaz',
    createdAt: toDate(d.createdAt),
    lastActiveAt: toDate(d.lastActiveAt),
    expiresAt: toDate(d.expiresAt),
    revoked: d.revoked === true,
  };
}

/** Bu tarayıcının oturum kaydını oluşturur (yoksa) veya son etkinlik zamanını günceller. */
export async function registerAdminSession(uid: string, email: string, sessionId: string, loginTime: number): Promise<void> {
  const ref = doc(db, 'admin_sessions', sessionId);
  const snap = await getDoc(ref).catch((err) => {
    console.error('[admin_sessions] kayıt okunamadı:', err);
    throw err;
  });
  if (snap.exists()) {
    await updateDoc(ref, { lastActiveAt: serverTimestamp() });
    return;
  }
  await setDoc(ref, {
    uid,
    email,
    device: deviceLabel(),
    userAgent: navigator.userAgent.slice(0, 200),
    createdAt: Timestamp.fromMillis(loginTime),
    lastActiveAt: serverTimestamp(),
    expiresAt: Timestamp.fromMillis(loginTime + ADMIN_SESSION_HOURS * 3600 * 1000),
    revoked: false,
  });
}

export async function touchAdminSession(sessionId: string): Promise<void> {
  await updateDoc(doc(db, 'admin_sessions', sessionId), { lastActiveAt: serverTimestamp() });
}

/** Kullanıcının süresi dolmamış ve kapatılmamış oturumları (yeniden eskiye). */
export function listenMyActiveSessions(uid: string, onData: (list: AdminSessionRecord[]) => void, onError?: (e: Error) => void): () => void {
  const q = query(collection(db, 'admin_sessions'), where('uid', '==', uid), limit(50));
  return onSnapshot(
    q,
    (snap) => {
      const now = Date.now();
      const list = snap.docs
        .map((d) => mapSession(d.id, d.data()))
        .filter((s) => !s.revoked && (!s.expiresAt || s.expiresAt.getTime() > now));
      list.sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
      onData(list);
    },
    (err) => {
      console.error('[admin_sessions] liste okunamadı:', err);
      onError?.(err);
    },
  );
}

/** Bu tarayıcının oturumu başka bir cihazdan kapatılırsa haber verir. */
export function watchSessionRevoked(sessionId: string, onRevoked: () => void): () => void {
  return onSnapshot(
    doc(db, 'admin_sessions', sessionId),
    (snap) => {
      if (snap.exists() && snap.data().revoked === true) onRevoked();
    },
    () => undefined,
  );
}

export async function revokeAdminSession(sessionId: string): Promise<void> {
  await updateDoc(doc(db, 'admin_sessions', sessionId), { revoked: true, revokedAt: serverTimestamp() });
}

export async function revokeOtherAdminSessions(currentId: string, sessions: AdminSessionRecord[]): Promise<number> {
  const others = sessions.filter((s) => s.id !== currentId && !s.revoked);
  if (others.length === 0) return 0;
  const batch = writeBatch(db);
  others.forEach((s) => batch.update(doc(db, 'admin_sessions', s.id), { revoked: true, revokedAt: serverTimestamp() }));
  await batch.commit();
  return others.length;
}

// ---------------------------------------------------------------------------
// Şifre
// ---------------------------------------------------------------------------

export function hasPasswordLogin(user: User | null): boolean {
  return !!user?.providerData.some((p) => p.providerId === 'password');
}

export type PasswordChangeError = 'no-user' | 'no-password-provider' | 'wrong-password' | 'too-many-requests' | 'weak-password' | 'unknown';

/** Mevcut şifreyle yeniden doğrular, ardından şifreyi değiştirir. */
export async function changeAdminPassword(current: string, next: string): Promise<void> {
  const user = auth.currentUser;
  if (!user || !user.email) throw new Error('no-user');
  if (!hasPasswordLogin(user)) throw new Error('no-password-provider');
  try {
    await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, current));
  } catch (e) {
    const code = (e as { code?: string }).code || '';
    if (code === 'auth/wrong-password' || code === 'auth/invalid-credential' || code === 'auth/invalid-login-credentials') throw new Error('wrong-password');
    if (code === 'auth/too-many-requests') throw new Error('too-many-requests');
    throw new Error('unknown');
  }
  try {
    await updatePassword(user, next);
  } catch (e) {
    const code = (e as { code?: string }).code || '';
    if (code === 'auth/weak-password' || code === 'auth/password-does-not-meet-requirements') throw new Error('weak-password');
    throw new Error('unknown');
  }
}

/**
 * Yalnızca Google ile giriş yapan hesaba e-posta + şifre girişi ekler.
 * Firebase yakın zamanda giriş yapılmasını isterse Google penceresiyle kimlik yeniden doğrulanır.
 */
export async function setAdminPassword(next: string): Promise<void> {
  const user = auth.currentUser;
  if (!user || !user.email) throw new Error('no-user');
  if (hasPasswordLogin(user)) throw new Error('already');
  const credential = EmailAuthProvider.credential(user.email, next);
  const link = async () => {
    await linkWithCredential(user, credential);
    await user.reload().catch(() => undefined);
  };
  try {
    await link();
  } catch (e) {
    const code = (e as { code?: string }).code || '';
    if (code === 'auth/requires-recent-login') {
      try {
        await reauthenticateWithPopup(user, new GoogleAuthProvider());
      } catch (re) {
        const rc = (re as { code?: string }).code || '';
        if (rc === 'auth/popup-blocked') throw new Error('popup-blocked');
        if (rc === 'auth/popup-closed-by-user' || rc === 'auth/cancelled-popup-request') throw new Error('cancelled');
        throw new Error('unknown');
      }
      try { await link(); } catch (e2) { throw new Error(mapLinkError((e2 as { code?: string }).code || '')); }
      return;
    }
    throw new Error(mapLinkError(code));
  }
}

function mapLinkError(code: string): string {
  if (code === 'auth/provider-already-linked') return 'already';
  if (code === 'auth/weak-password' || code === 'auth/password-does-not-meet-requirements') return 'weak-password';
  if (code === 'auth/email-already-in-use' || code === 'auth/credential-already-in-use') return 'in-use';
  if (code === 'auth/operation-not-allowed') return 'not-allowed';
  return 'unknown';
}

export interface PasswordChecks {
  length: boolean;
  cases: boolean;
  digit: boolean;
  different: boolean;
}

export function checkPassword(next: string, current: string): PasswordChecks {
  return {
    length: next.length >= 10,
    cases: /[a-zçğıöşü]/.test(next) && /[A-ZÇĞİÖŞÜ]/.test(next),
    digit: /\d/.test(next),
    different: next.length > 0 && next !== current,
  };
}

// ---------------------------------------------------------------------------
// Hesap etkinliği
// ---------------------------------------------------------------------------

export type ActivityKind = 'session' | 'batch' | 'tag';

export interface ActivityItem {
  id: string;
  at: Date;
  kind: ActivityKind;
  action: string;
  target: string;
  count?: number;
}

/**
 * Bu hesabın yaptığı işlemler: etiket/parti olayları (tag_events) ve oturum açılışları (admin_sessions).
 * Bileşik dizin gerektirmesin diye sıralama tarayıcıda yapılır.
 */
export async function fetchMyActivity(uid: string): Promise<ActivityItem[]> {
  const [eventsSnap, sessionsSnap] = await Promise.all([
    getDocs(query(collection(db, 'tag_events'), where('by', '==', uid), limit(300))),
    getDocs(query(collection(db, 'admin_sessions'), where('uid', '==', uid), limit(100))),
  ]);

  const items: ActivityItem[] = [];
  eventsSnap.forEach((d) => {
    const e = d.data();
    const at = toDate(e.at);
    if (!at) return;
    const action = String(e.action || '');
    items.push({
      id: d.id,
      at,
      kind: action === 'batch_created' ? 'batch' : 'tag',
      action,
      target: action === 'batch_created' ? String(e.batchId || '') : String(e.code || ''),
      count: typeof e.count === 'number' ? e.count : undefined,
    });
  });
  sessionsSnap.forEach((d) => {
    const s = mapSession(d.id, d.data());
    if (!s.createdAt) return;
    items.push({ id: `s-${d.id}`, at: s.createdAt, kind: 'session', action: 'login', target: s.device });
  });

  items.sort((a, b) => b.at.getTime() - a.at.getTime());
  return items;
}
