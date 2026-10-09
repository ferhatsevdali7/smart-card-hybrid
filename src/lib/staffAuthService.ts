import { 
  collection, doc, getDoc, getDocs, setDoc, updateDoc, 
  deleteDoc, query, where, serverTimestamp, onSnapshot 
} from 'firebase/firestore';
import { db, auth } from './firebase';
import { StaffMember, StaffRole } from '../types/card';
import { signInWithEmailAndPassword } from 'firebase/auth';

const STAFF_COLLECTION = 'staff_members';

// Support comma-separated Super Admin Emails from Environment variable
const ENV_SUPER_ADMINS = (import.meta.env.VITE_SUPER_ADMIN_EMAIL || '')
  .split(',')
  .map((e: string) => e.trim().toLowerCase())
  .filter(Boolean);

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

/**
 * Check if a given email has Super Admin / Staff privileges
 */
export async function checkUserStaffRole(email: string | null | undefined): Promise<StaffMember | null> {
  if (!email) return null;
  const cleanEmail = email.trim().toLowerCase();

  // 1. Dynamic Environment Whitelist Check (Full Access Super Admin)
  if (ENV_SUPER_ADMINS.includes(cleanEmail)) {
    return {
      email: cleanEmail,
      name: 'Super Admin (Yönetici)',
      role: 'super_admin',
      isActive: true,
      invitedBy: 'system',
      createdAt: new Date().toISOString()
    };
  }

  // 2. Database Whitelist Check
  try {
    const docRef = doc(db, STAFF_COLLECTION, cleanEmail);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data() as StaffMember;
      if (data.isActive) {
        return data;
      }
    }
  } catch (error) {
    console.warn('Staff role check error:', error);
  }

  return null;
}

/**
 * Verify Staff credentials using Firebase Auth + RBAC whitelist check
 */
export async function verifyStaffCredentials(email: string, password: string): Promise<StaffMember> {
  const cleanEmail = email.trim().toLowerCase();

  // 1. Check if email is in the admin whitelist first
  const staff = await checkUserStaffRole(cleanEmail);
  if (!staff || !staff.isActive) {
    throw new Error('403: Bu e-posta adresi yetkili yönetici listesinde bulunmuyor.');
  }

  // 2. Sign in via Firebase Auth to verify credentials
  try {
    await signInWithEmailAndPassword(auth, cleanEmail, password);
  } catch (authError: any) {
    if (authError.code === 'auth/wrong-password' || authError.code === 'auth/invalid-credential') {
      throw new Error('Yönetici şifresi hatalı.');
    }
    if (authError.code === 'auth/user-not-found') {
      throw new Error('Bu yönetici e-posta hesabı Firebase kimlik doğrulama sisteminde henüz oluşturulmamış.');
    }
    throw new Error(`Kimlik doğrulama hatası: ${authError.message}`);
  }

  return staff;
}

/**
 * Enforce Super Admin permissions before performing sensitive admin operations
 */
export async function assertSuperAdmin(): Promise<StaffMember> {
  const currentEmail = auth.currentUser?.email;
  if (!currentEmail) {
    throw new Error('401: Oturum açılmamış.');
  }

  const profile = await checkUserStaffRole(currentEmail);
  if (!profile || !profile.isActive) {
    throw new Error('403: Bu işlem için yönetim yetkisine sahip değilsiniz.');
  }

  return profile;
}
