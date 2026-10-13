/**
 * Müşteri profili: cep telefonu numarası.
 *
 * - Numara yalnızca şifrelenmiş olarak saklanır (AES-256-GCM): user_secrets/{uid}.phone
 * - Anahtar, istemcilere tamamen kapalı server_config/crypto belgesinde tutulur (ilk kullanımda üretilir).
 * - Yöneticiler ve özetler yalnızca maskeli halini görür (son iki hane).
 * - Eskiden her araçta düz metin tutulan contactPhone ilk okumada buraya taşınır ve araçlardan silinir.
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import { db, rateLimit, requireAuth } from './helpers';
import { maskPhone, refreshQuietly } from './directory';

const SECRETS = 'user_secrets';
const KEY_DOC = () => db().collection('server_config').doc('crypto');

let cachedKey: Buffer | null = null;

/** Şifreleme anahtarı (32 bayt). Yoksa tek seferlik üretilir; aynı anda iki istek gelse de tek anahtar oluşur. */
export async function phoneKey(): Promise<Buffer> {
  if (cachedKey) return cachedKey;
  const b64 = await db().runTransaction(async (tx) => {
    const s = await tx.get(KEY_DOC());
    const cur = s.exists ? s.get('phoneKey') : null;
    if (typeof cur === 'string' && cur.length >= 40) return cur;
    const fresh = randomBytes(32).toString('base64');
    tx.set(KEY_DOC(), { phoneKey: fresh, createdAt: FieldValue.serverTimestamp() }, { merge: true });
    return fresh;
  });
  const key = Buffer.from(b64, 'base64');
  if (key.length !== 32) throw new HttpsError('internal', 'Şifreleme anahtarı geçersiz.');
  cachedKey = key;
  return key;
}

export interface Sealed { v: 1; iv: string; ct: string; tag: string }

export async function seal(text: string): Promise<Sealed> {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', await phoneKey(), iv);
  const ct = Buffer.concat([c.update(text, 'utf8'), c.final()]);
  return { v: 1, iv: iv.toString('base64'), ct: ct.toString('base64'), tag: c.getAuthTag().toString('base64') };
}

export async function unseal(s: unknown): Promise<string | null> {
  const x = s as Partial<Sealed> | null;
  if (!x || x.v !== 1 || !x.iv || !x.ct || !x.tag) return null;
  try {
    const d = createDecipheriv('aes-256-gcm', await phoneKey(), Buffer.from(x.iv, 'base64'));
    d.setAuthTag(Buffer.from(x.tag, 'base64'));
    return Buffer.concat([d.update(Buffer.from(x.ct, 'base64')), d.final()]).toString('utf8');
  } catch (e) {
    logger.error('[profile] telefon çözülemedi', e);
    return null;
  }
}

/** Türkiye cep telefonu: "+90 532 123 45 67", "0532…", "532…" → "+905321234567". Geçersizse null. */
export function normalizeTrMobile(raw: unknown): string | null {
  let d = String(raw ?? '').replace(/\D/g, '');
  if (d.length === 12 && d.startsWith('90')) d = d.slice(2);
  else if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  if (!/^5\d{9}$/.test(d)) return null;
  return `+90${d}`;
}

async function storePhone(uid: string, phone: string | null): Promise<string | null> {
  const ref = db().collection(SECRETS).doc(uid);
  if (!phone) {
    await ref.set({ phone: FieldValue.delete(), phoneMasked: null, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return null;
  }
  const masked = maskPhone(phone);
  await ref.set({ phone: await seal(phone), phoneMasked: masked, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  return masked;
}

/** Araçlardaki eski düz metin numarayı taşır; geçerli bir numara bulunduysa araçlardan siler. */
async function migrateFromVehicles(uid: string): Promise<string | null> {
  const vs = await db().collection('vehicles').where('ownerUid', '==', uid).get();
  const withPhone = vs.docs.filter((d) => typeof d.get('contactPhone') === 'string' && d.get('contactPhone'));
  if (!withPhone.length) return null;
  const sorted = [...withPhone].sort((a, b) => (a.get('createdAt')?.toMillis?.() || 0) - (b.get('createdAt')?.toMillis?.() || 0));
  const phone = sorted.map((d) => normalizeTrMobile(d.get('contactPhone'))).find(Boolean) || null;
  if (!phone) return null;
  await storePhone(uid, phone);
  const b = db().batch();
  withPhone.forEach((d) => b.update(d.ref, { contactPhone: FieldValue.delete() }));
  await b.commit();
  return phone;
}

/** Kişinin kendi profili (tam numarayı yalnızca sahibi görür). */
export const getMyProfile = onCall(async (req) => {
  const { uid } = requireAuth(req);
  const snap = await db().collection(SECRETS).doc(uid).get();
  let phone = snap.exists ? await unseal(snap.get('phone')) : null;
  if (!phone && !(snap.exists && snap.get('phoneSetAt'))) {
    phone = await migrateFromVehicles(uid);
    if (phone) await refreshQuietly([uid]);
  }
  return { phone, phoneMasked: phone ? maskPhone(phone) : null };
});

/** Telefonu kaydeder ya da (boş gönderilirse) kaldırır. */
export const setMyPhone = onCall(async (req) => {
  const { uid } = requireAuth(req);
  await rateLimit(`phone:${uid}`, 20, 3600, 'Kısa sürede çok fazla değişiklik yapıldı. Lütfen daha sonra tekrar deneyiniz.');
  const raw = req.data?.phone;
  const empty = raw === null || raw === undefined || String(raw).trim() === '';
  const phone = empty ? null : normalizeTrMobile(raw);
  if (!empty && !phone) throw new HttpsError('invalid-argument', 'Geçerli bir cep telefonu numarası giriniz (5XX XXX XX XX).');
  const masked = await storePhone(uid, phone);
  await db().collection(SECRETS).doc(uid).set({ phoneSetAt: FieldValue.serverTimestamp() }, { merge: true });
  // Araçlarda kalmış eski numaralar da temizlenir (tek kaynak profil olsun).
  const vs = await db().collection('vehicles').where('ownerUid', '==', uid).get();
  const stale = vs.docs.filter((d) => d.get('contactPhone') !== undefined);
  if (stale.length) {
    const b = db().batch();
    stale.forEach((d) => b.update(d.ref, { contactPhone: FieldValue.delete() }));
    await b.commit();
  }
  await refreshQuietly([uid]);
  return { ok: true, phone, phoneMasked: masked };
});

/** Hesap silinirken çağrılır. */
export async function deleteProfileSecrets(uid: string): Promise<void> {
  await db().collection(SECRETS).doc(uid).delete();
}
