import { createHash, randomInt } from 'crypto';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { CallableRequest, HttpsError } from 'firebase-functions/v2/https';
import { CODE_ALPHABET, CODE_LENGTH, CODE_REGEX } from './config';

export const db = () => getFirestore();

// ---------------------------------------------------------------------------
// Kimlik
// ---------------------------------------------------------------------------

export function requireAuth(req: CallableRequest): { uid: string; email: string | null } {
  if (!req.auth) {
    throw new HttpsError('unauthenticated', 'Bu işlem için giriş yapmalısınız.');
  }
  const email = typeof req.auth.token.email === 'string' ? req.auth.token.email.toLowerCase() : null;
  return { uid: req.auth.uid, email };
}

// Yönetici yetkileri: bkz. permissions.ts (requirePerm, requireSuperAdmin, requireAnyStaff).

// ---------------------------------------------------------------------------
// Kod üretimi ve doğrulama
// ---------------------------------------------------------------------------

/** Kriptografik olarak güvenli, tahmin edilemez QR kodu üretir. */
export function generateCode(): string {
  let out = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    out += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  }
  return out;
}

/** Gelen değeri temizler; geçerli formatta değilse null döner. */
export function parseCode(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  let raw = input.trim();
  const idx = raw.lastIndexOf('/t/');
  if (idx >= 0) raw = raw.slice(idx + 3);
  raw = raw.split(/[?#]/)[0].toUpperCase().replace(/[^A-Z0-9]/g, '');
  return CODE_REGEX.test(raw) ? raw : null;
}

export function requireString(value: unknown, field: string, max = 200): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max) {
    throw new HttpsError('invalid-argument', `Geçersiz alan: ${field}`);
  }
  return value.trim();
}

// ---------------------------------------------------------------------------
// Ağ ve hız sınırı
// ---------------------------------------------------------------------------

export function clientIp(req: CallableRequest): string {
  const fwd = req.rawRequest?.headers?.['x-forwarded-for'];
  const first = Array.isArray(fwd) ? fwd[0] : fwd;
  if (typeof first === 'string' && first.trim()) return first.split(',')[0].trim();
  return req.rawRequest?.ip || 'unknown';
}

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/**
 * Sabit pencereli hız sınırı. Sınır aşılırsa 'resource-exhausted' fırlatır.
 * Anahtarlar özetlenerek saklanır (IP adresi açık yazılmaz).
 */
export async function rateLimit(key: string, limit: number, windowSec: number, message?: string): Promise<void> {
  const ref = db().collection('rate_limits').doc(sha256(key));
  const now = Date.now();
  const allowed = await db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.exists ? snap.data()! : null;
    const windowStart = data?.windowStart instanceof Timestamp ? data.windowStart.toMillis() : 0;
    const expiresAt = Timestamp.fromMillis(now + windowSec * 1000);
    if (!data || now - windowStart > windowSec * 1000) {
      tx.set(ref, { count: 1, windowStart: Timestamp.fromMillis(now), expiresAt });
      return true;
    }
    if ((data.count || 0) >= limit) return false;
    tx.update(ref, { count: FieldValue.increment(1) });
    return true;
  });
  if (!allowed) {
    throw new HttpsError('resource-exhausted', message || 'Çok fazla deneme yapıldı. Lütfen biraz sonra tekrar deneyin.');
  }
}

// ---------------------------------------------------------------------------
// Görüntüleme yardımcıları
// ---------------------------------------------------------------------------

/** "34 ABC 1234" -> "34 ABC ••34" (aracı tanımaya yeter, tam plakayı vermez). */
export function maskPlate(plate: unknown): string {
  if (typeof plate !== 'string' || !plate.trim()) return '';
  const parts = plate.trim().toUpperCase().split(/\s+/);
  if (parts.length >= 3) {
    const last = parts[parts.length - 1];
    const masked = last.length > 2 ? '•'.repeat(last.length - 2) + last.slice(-2) : last;
    return [...parts.slice(0, -1), masked].join(' ');
  }
  const flat = parts.join('');
  if (flat.length <= 4) return flat;
  return flat.slice(0, 2) + '•'.repeat(flat.length - 4) + flat.slice(-2);
}

/** Ziyaretçi notundaki bağlantıları ve kontrol karakterlerini temizler. */
export function sanitizeNote(input: unknown, max: number): string {
  if (typeof input !== 'string') return '';
  return input
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/(https?:\/\/|www\.)\S+/gi, '[bağlantı kaldırıldı]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

/** İstanbul saatine göre YYMM (örn: 2610). */
export function yearMonthIstanbul(date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Istanbul', year: '2-digit', month: '2-digit' })
    .formatToParts(date);
  const yy = parts.find((p) => p.type === 'year')?.value || '00';
  const mm = parts.find((p) => p.type === 'month')?.value || '00';
  return `${yy}${mm}`;
}
