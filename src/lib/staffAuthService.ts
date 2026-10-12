import { auth } from './firebase';
import { sendEmailVerification, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { staffSignInFn } from './functionsClient';

// Client-side rate limiting store
const RATE_LIMIT_KEY = 'hyb_adm_rate_limits';
interface RateLimitData {
  attempts: number;
  lockedUntil: number | null;
}

export function checkRateLimit(email: string): { locked: boolean; remainingMinutes?: number } {
  try {
    const raw = localStorage.getItem(`${RATE_LIMIT_KEY}_${email.toLowerCase()}`);
    if (!raw) return { locked: false };
    const data: RateLimitData = JSON.parse(raw);
    if (data.lockedUntil && Date.now() < data.lockedUntil) {
      const remainingMs = data.lockedUntil - Date.now();
      return { locked: true, remainingMinutes: Math.ceil(remainingMs / (60 * 1000)) };
    }
    return { locked: false };
  } catch {
    return { locked: false };
  }
}

export function recordFailedAttempt(email: string): void {
  try {
    const key = `${RATE_LIMIT_KEY}_${email.toLowerCase()}`;
    const raw = localStorage.getItem(key);
    let data: RateLimitData = raw ? JSON.parse(raw) : { attempts: 0, lockedUntil: null };
    data.attempts += 1;
    if (data.attempts >= 5) {
      data.lockedUntil = Date.now() + 15 * 60 * 1000; // 15 dakika kilitle
    }
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.warn('Rate limit save error:', e);
  }
}

export function resetRateLimit(email: string): void {
  try {
    localStorage.removeItem(`${RATE_LIMIT_KEY}_${email.toLowerCase()}`);
  } catch (e) {
    console.warn('Rate limit reset error:', e);
  }
}

export interface StaffSignIn { email: string; superAdmin: boolean; positionName: string | null; perms: string[] }

/**
 * Giriş yapmış kişinin ekip üyeliğini ve yetkilerini SUNUCUDAN alır (istemci tarafında liste tutulmaz).
 * Davetli kişi ilk girişte etkinleşir. Ekipte değilse, askıdaysa ya da e-postası doğrulanmamışsa hata verir.
 */
export async function fetchStaffAccess(): Promise<StaffSignIn> {
  const email = auth.currentUser?.email?.toLowerCase() || '';
  try {
    const r = await staffSignInFn({});
    return { email, superAdmin: r.superAdmin, positionName: r.positionName, perms: r.perms };
  } catch (e) {
    const msg = String((e as { message?: string }).message || '');
    if (msg.includes('SUSPENDED')) throw new Error('Hesabınız askıya alınmış. Süper yöneticiyle görüşün.');
    if (msg.includes('EMAIL_NOT_VERIFIED')) {
      if (auth.currentUser) await sendEmailVerification(auth.currentUser).catch(() => undefined);
      throw new Error('E-posta adresiniz doğrulanmamış. Gelen kutunuza doğrulama bağlantısı gönderildi; onayladıktan sonra tekrar giriş yapın.');
    }
    if (msg.includes('NOT_STAFF')) throw new Error(`"${email}" adresi yetkili ekip listesinde değil.`);
    throw new Error('Yetkiler alınamadı. İnternet bağlantınızı kontrol edip tekrar deneyin.');
  }
}

/** E-posta/şifre ile giriş + ekip üyeliği kontrolü. Ekipte değilse oturum kapatılır. */
export async function verifyStaffCredentials(email: string, password: string): Promise<StaffSignIn> {
  const cleanEmail = email.trim().toLowerCase();
  try {
    await signInWithEmailAndPassword(auth, cleanEmail, password);
  } catch (authError: any) {
    if (authError.code === 'auth/wrong-password' || authError.code === 'auth/invalid-credential' || authError.code === 'auth/user-not-found') {
      throw new Error('E-posta ya da şifre hatalı.');
    }
    if (authError.code === 'auth/too-many-requests') throw new Error('Çok fazla deneme yapıldı. Biraz sonra tekrar deneyin.');
    throw new Error('Giriş yapılamadı. Lütfen tekrar deneyin.');
  }
  try {
    return await fetchStaffAccess();
  } catch (e) {
    await signOut(auth).catch(() => undefined);
    throw e;
  }
}
