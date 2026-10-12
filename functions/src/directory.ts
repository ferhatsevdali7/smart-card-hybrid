/**
 * Kullanıcı ve araç dizini (yönetici paneli: Kullanıcılar, Bağlı Araçlar) ve hesap silme.
 *
 *   user_index/{uid}          Kullanıcının yönetici paneli için özeti (yalnızca sunucu okur/yazar)
 *   vehicle_index/{vehicleId} Aracın özeti (yalnızca sunucu okur/yazar)
 *   deleted_accounts/{id}     Silinen hesabın asgari kaydı (gizlenmiş e-posta, tarih, sebep, sayılar)
 *   users/{uid}/devices/{id}  Kullanıcının cihazları: ana ekrana ekleme ve bildirim durumu (sunucu yazar)
 *   admin_access_log/{id}     Hangi yönetici hangi müşteri kaydını ne zaman açtı (yalnızca sunucu)
 *
 * Gizlilik:
 *  - Telefon numarası özetlere ASLA açık yazılmaz; yalnızca son iki hanesi görünen maskeli hali tutulur.
 *    Tam numarayı yöneticiye gösteren bir yol yoktur (bilinçli olarak).
 *  - Silinen hesaptan ad, telefon ve plaka silinir; yalnızca asgari kayıt kalır.
 *  - Silinen hesabın QR'ları kalıcı olarak devre dışı kalır (etiket fiziksel olarak müşteride kalır,
 *    depoya dönemez). Bu QR'lar yeniden açılamaz ve sıfırlanamaz.
 *
 * Güncel tutma:
 *  - Kullanıcı uygulamayı açınca ve aracını değiştirince syncMyAccount kendi özetini yeniler.
 *  - QR bağlama/ayırma/kayıp ve yönetici QR işlemleri ilgili kullanıcının özetini yeniler.
 *  - Her gece tüm dizin baştan kurulur (gözden kaçan değişiklikler ve sistemden silinen hesaplar).
 */

import { FieldValue, Timestamp, Transaction } from 'firebase-admin/firestore';
import { getAuth, UserRecord } from 'firebase-admin/auth';
import { onCall, HttpsError, CallableRequest } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions';
import { ACCOUNT_DELETED, SUPER_ADMIN_EMAILS } from './config';
import { db, maskPlate, rateLimit, requireAuth, sha256 } from './helpers';
import { getQuota, recordCritical, requirePerm, requireReason, requireRecentAuth as requireFreshLogin, reserveQuota, MEMBERS } from './permissions';
import { applyTagCounts, snap, stageOf } from './lifecycle';
import { addDays, dayKey, dayStartMs } from './stats';

const USER_INDEX = 'user_index';
const VEHICLE_INDEX = 'vehicle_index';
const DELETED = 'deleted_accounts';
const ACCESS_LOG = 'admin_access_log';
const META = 'stats_meta';

const PAGE = 25;
const SEARCH_LIMIT = 50;
const MAX_DEVICES = 10;
const REAUTH_SECONDS = 5 * 60;

export { ACCOUNT_DELETED };

// ===========================================================================
// Metin yardımcıları
// ===========================================================================

const TR_MAP: Record<string, string> = { 'ı': 'i', 'ç': 'c', 'ğ': 'g', 'ö': 'o', 'ş': 's', 'ü': 'u' };

/** Aramada Türkçe karakter ve büyük/küçük harf farkını kaldırır: "Ayşe İNCE" -> "ayse ince" */
export function fold(input: unknown): string {
  return String(input ?? '')
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[ıçğöşü]/g, (c) => TR_MAP[c] || c);
}

/** Plakayı karşılaştırılabilir hale getirir: "34 abc 127" -> "34ABC127" */
export function normPlate(input: unknown): string {
  return fold(input).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
}

/**
 * Telefonu maskeler. Yalnızca son iki hane görünür: "05321234547" -> "0••• ••• •• 47".
 * Tam numara hiçbir yanıtta ve hiçbir özet kaydında yer almaz.
 */
export function maskPhone(raw: unknown): string | null {
  let d = String(raw ?? '').replace(/\D/g, '');
  if (!d) return null;
  if (d.length === 12 && d.startsWith('90')) d = '0' + d.slice(2);
  else if (d.length === 10 && d.startsWith('5')) d = '0' + d;
  if (d.length < 7) return '•••';
  if (d.length === 11 && d.startsWith('0')) return `0••• ••• •• ${d.slice(-2)}`;
  return `•••• ${d.slice(-2)}`;
}

/** Silinen hesap kaydı için: "ayse.yilmaz@gmail.com" -> "ay•••@gmail.com" */
export function maskEmail(email: unknown): string {
  const e = String(email ?? '').trim().toLowerCase();
  const at = e.lastIndexOf('@');
  if (at < 1) return e ? '•••' : '';
  return `${e.slice(0, Math.min(2, at))}•••${e.slice(at)}`;
}

function prefixes(token: string, min: number, max: number, out: Set<string>): void {
  for (let k = min; k <= Math.min(token.length, max); k++) out.add(token.slice(0, k));
}

/** Arama anahtarları: ad, e-posta, plaka ve kullanıcı kimliğinin başlangıçları. */
export function userKeywords(name: string, email: string, plates: string[], uid: string): string[] {
  const out = new Set<string>();
  const add = (s: string) => fold(s).split(/[\s@._+\-]+/).filter(Boolean).forEach((t) => prefixes(t, 2, 20, out));
  add(name);
  add(email.split('@')[0] || '');
  const fe = fold(email).replace(/\s/g, '');
  if (fe) prefixes(fe, 2, 40, out);
  plates.forEach((p) => prefixes(normPlate(p).toLowerCase(), 2, 12, out));
  const fu = fold(uid);
  if (fu) { out.add(fu); out.add(fu.slice(0, 8)); }
  return [...out].slice(0, 400);
}

/** Arama metninden sorguda kullanılacak anahtarı ve bellekte süzülecek ek kelimeleri çıkarır. */
export function parseUserQuery(q: unknown): { primary: string; rest: string[] } | null {
  const f = fold(q).trim().replace(/\s+/g, ' ');
  if (f.length < 2) return null;
  const compact = f.replace(/\s/g, '');
  if (/^\d{2}[a-z]/.test(compact) && /^[a-z0-9 ]+$/.test(f)) return { primary: compact.slice(0, 12), rest: [] };
  if (/[@.]/.test(f) && !f.includes(' ')) return { primary: f.slice(0, 40), rest: [] };
  const toks = f.split(/[\s@._+\-]+/).filter(Boolean).sort((a, b) => b.length - a.length);
  if (!toks.length || toks[0].length < 2) return null;
  return { primary: toks[0].slice(0, 20), rest: toks.slice(1).filter((t) => t.length >= 2).map((t) => t.slice(0, 20)) };
}

function toMs(v: unknown): number | null {
  if (!v) return null;
  if (v instanceof Timestamp) return v.toMillis();
  if (typeof (v as { toMillis?: () => number }).toMillis === 'function') return (v as { toMillis: () => number }).toMillis();
  if (typeof v === 'string') { const n = Date.parse(v); return Number.isNaN(n) ? null : n; }
  if (typeof v === 'number') return v;
  return null;
}

function tsFromIso(iso: string | undefined | null): Timestamp | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? null : Timestamp.fromMillis(ms);
}

function str(v: unknown, max = 120): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

// ===========================================================================
// Özetlerin kurulması (tek kullanıcı ve toplu yenileme aynı kuralları kullanır)
// ===========================================================================

type Data = FirebaseFirestore.DocumentData;
interface VehicleRow { id: string; data: Data }
interface TagRow { code: string; data: Data }
interface DeviceRow { id: string; data: Data }

export type TagState = 'linked' | 'disabled' | 'none';

export function tagStateOf(vehicle: Data, tag: Data | undefined): TagState {
  if (!vehicle.tagCode || !tag) return 'none';
  const st = stageOf(tag.status);
  if (st === 'active') return 'linked';
  if (st === 'disabled' || st === 'expired') return 'disabled';
  return 'none';
}

function providerOf(u: UserRecord | null): string {
  const ids = (u?.providerData || []).map((p) => p.providerId);
  if (ids.includes('google.com')) return 'google';
  if (ids.includes('apple.com')) return 'apple';
  if (ids.includes('password')) return 'email';
  return ids[0] || 'unknown';
}

function sortVehicles(list: VehicleRow[]): VehicleRow[] {
  return [...list].sort((a, b) => (toMs(a.data.createdAt) || 0) - (toMs(b.data.createdAt) || 0) || a.id.localeCompare(b.id));
}

export function buildUserIndex(
  uid: string,
  user: UserRecord,
  vehicles: VehicleRow[],
  ownedTags: TagRow[],
  devices: DeviceRow[],
  pushTokens: number,
  isStaff: boolean,
): Data {
  const sorted = sortVehicles(vehicles);
  const email = (user.email || '').toLowerCase();
  const name = (user.displayName || '').trim() || sorted.map((v) => str(v.data.ownerName, 60)).find(Boolean) || '';
  const plates = sorted.map((v) => str(v.data.plateNumber, 16)).filter(Boolean);
  const phoneMasked = sorted.map((v) => maskPhone(v.data.contactPhone)).find(Boolean) || null;
  const activeTags = ownedTags.filter((t) => stageOf(t.data.status) === 'active').length;
  const closedTags = ownedTags.filter((t) => ['disabled', 'expired'].includes(stageOf(t.data.status) || '')).length;
  const homeScreen = devices.length ? devices.some((d) => d.data.standalone === true) : null;
  const seen = Math.max(0, ...devices.map((d) => toMs(d.data.lastSeenAt) || 0));
  return {
    uid,
    email,
    name: name.slice(0, 80),
    provider: providerOf(user),
    emailVerified: user.emailVerified === true,
    disabled: user.disabled === true,
    isStaff,
    createdAt: tsFromIso(user.metadata?.creationTime) || Timestamp.now(),
    lastSignInAt: tsFromIso(user.metadata?.lastSignInTime),
    lastSeenAt: seen ? Timestamp.fromMillis(seen) : tsFromIso(user.metadata?.lastSignInTime),
    vehicleCount: vehicles.length,
    tagCount: activeTags,
    closedTagCount: closedTags,
    plates: plates.slice(0, 20),
    phoneMasked,
    pushTokens,
    pushEnabled: pushTokens > 0,
    deviceCount: devices.length,
    homeScreen,
    kw: userKeywords(name, email, plates, uid),
    updatedAt: FieldValue.serverTimestamp(),
  };
}

export function buildVehicleIndex(v: VehicleRow, owner: { name: string; email: string } | null, tag: Data | undefined): Data {
  const plate = str(v.data.plateNumber, 16).toUpperCase();
  const plateNorm = normPlate(plate);
  const state = tagStateOf(v.data, tag);
  const serial = tag && v.data.tagCode ? (str(tag.tagId, 40) || null) : null;
  const province = /^\d{2}/.test(plateNorm) ? plateNorm.slice(0, 2) : '';
  const kw = new Set<string>();
  prefixes(plateNorm.toLowerCase(), 2, 12, kw);
  return {
    vehicleId: v.id,
    ownerUid: str(v.data.ownerUid, 128),
    ownerName: (owner?.name || str(v.data.ownerName, 60)).slice(0, 80),
    ownerEmail: owner?.email || '',
    plate,
    plateNorm,
    province,
    brandModel: str(v.data.brandModel, 60),
    tagCode: v.data.tagCode && tag ? String(v.data.tagCode) : null,
    tagSerial: serial,
    tagState: state,
    tagStatus: tag && v.data.tagCode ? (stageOf(tag.status) || null) : null,
    tagReason: tag && v.data.tagCode ? (tag.disabledReason || null) : null,
    allowMessages: v.data.allowMessages !== false,
    phoneMasked: maskPhone(v.data.contactPhone),
    createdAt: v.data.createdAt instanceof Timestamp ? v.data.createdAt : Timestamp.now(),
    kw: [...kw],
    updatedAt: FieldValue.serverTimestamp(),
  };
}

async function isStaffEmail(email: string): Promise<boolean> {
  if (!email) return false;
  if (SUPER_ADMIN_EMAILS.includes(email)) return true;
  const s = await db().collection('staff_members').doc(email).get();
  return s.exists && s.get('isActive') !== false;
}

async function authUser(uid: string): Promise<UserRecord | null> {
  try {
    return await getAuth().getUser(uid);
  } catch (e) {
    if ((e as { code?: string })?.code === 'auth/user-not-found') return null;
    throw e;
  }
}

/** Tek kullanıcının özetini ve araçlarının özetlerini kaynaktan yeniden kurar. */
export async function refreshUserIndex(uid: string): Promise<boolean> {
  const user = await authUser(uid);
  if (!user) return false;
  const [vehiclesSnap, tagsSnap, devicesSnap, tokensSnap, oldVehIdx] = await Promise.all([
    db().collection('vehicles').where('ownerUid', '==', uid).get(),
    db().collection('tags').where('assignedUserId', '==', uid).get(),
    db().collection('users').doc(uid).collection('devices').get(),
    db().collection('users').doc(uid).collection('push_tokens').count().get(),
    db().collection(VEHICLE_INDEX).where('ownerUid', '==', uid).select().get(),
  ]);
  const vehicles: VehicleRow[] = vehiclesSnap.docs.map((d) => ({ id: d.id, data: d.data() }));
  const owned: TagRow[] = tagsSnap.docs.map((d) => ({ code: d.id, data: d.data() }));
  const devices: DeviceRow[] = devicesSnap.docs.map((d) => ({ id: d.id, data: d.data() }));

  // Araçlardaki QR'lar (müşteriye ait olmasa da araçta görünen, örn. devre dışı bırakılmış)
  const tagByCode = new Map(owned.map((t) => [t.code, t.data]));
  const missing = [...new Set(vehicles.map((v) => v.data.tagCode).filter((c) => typeof c === 'string' && !tagByCode.has(c)))] as string[];
  if (missing.length) {
    const snaps = await db().getAll(...missing.map((c) => db().collection('tags').doc(c)));
    snaps.forEach((s) => { if (s.exists) tagByCode.set(s.id, s.data()!); });
  }
  const staff = await isStaffEmail((user.email || '').toLowerCase());
  const idx = buildUserIndex(uid, user, vehicles, owned, devices, tokensSnap.data().count, staff);

  const batch = db().batch();
  batch.set(db().collection(USER_INDEX).doc(uid), idx);
  const live = new Set<string>();
  for (const v of vehicles) {
    live.add(v.id);
    batch.set(db().collection(VEHICLE_INDEX).doc(v.id), buildVehicleIndex(v, { name: idx.name, email: idx.email }, v.data.tagCode ? tagByCode.get(v.data.tagCode) : undefined));
  }
  oldVehIdx.docs.forEach((d) => { if (!live.has(d.id)) batch.delete(d.ref); });
  await batch.commit();
  return true;
}

/** Hata olsa bile çağıranı düşürmez (QR işlemleri dizin yüzünden başarısız olmasın). */
export async function refreshQuietly(uids: Iterable<string | null | undefined>): Promise<void> {
  const list = [...new Set([...uids].filter((u): u is string => typeof u === 'string' && !!u))].slice(0, 50);
  await Promise.all(list.map((u) => refreshUserIndex(u).catch((e) => logger.warn('[directory] özet yenilenemedi', { uid: u, err: String(e) }))));
}

// ===========================================================================
// Hesap silme (kullanıcının kendisi, yönetici ya da sistemden silinmiş hesap)
// ===========================================================================

export interface DeleteInput {
  by: 'self' | 'admin' | 'system';
  byEmail?: string | null;
  reason?: string | null;
  /** Firebase Authentication kaydı da silinsin mi (sistemden silinmişse zaten yoktur). */
  deleteAuth: boolean;
}

const TAG_CHUNK = 100;

async function deleteCollection(ref: FirebaseFirestore.CollectionReference): Promise<void> {
  for (;;) {
    const s = await ref.limit(300).get();
    if (s.empty) return;
    const b = db().batch();
    s.docs.forEach((d) => b.delete(d.ref));
    await b.commit();
    if (s.size < 300) return;
  }
}

/**
 * Hesabın tüm kişisel verisini siler, QR'larını kalıcı olarak kapatır ve asgari kaydı bırakır.
 * Tekrar çalıştırılabilir: aynı hesap için ikinci kez kayıt oluşturmaz.
 */
export async function deleteAccountData(uid: string, input: DeleteInput): Promise<{ vehicles: number; tags: number }> {
  const user = await authUser(uid);
  const idxSnap = await db().collection(USER_INDEX).doc(uid).get();
  const email = (user?.email || idxSnap.get('email') || '').toLowerCase();

  const [vehiclesSnap, tagsSnap, cardsSnap] = await Promise.all([
    db().collection('vehicles').where('ownerUid', '==', uid).get(),
    db().collection('tags').where('assignedUserId', '==', uid).get(),
    db().collection('cards').where('ownerUid', '==', uid).select().get(),
  ]);

  // 1) QR'lar: kalıcı devre dışı, kişisel bağlar silinir (parti sayaçları aynı işlemde)
  const codes = tagsSnap.docs.map((d) => d.id);
  let closed = 0;
  for (let i = 0; i < codes.length; i += TAG_CHUNK) {
    const part = codes.slice(i, i + TAG_CHUNK);
    closed += await db().runTransaction(async (tx: Transaction) => {
      const refs = part.map((c) => db().collection('tags').doc(c));
      const snaps = await Promise.all(refs.map((r) => tx.get(r)));
      let n = 0;
      const done: string[] = [];
      const batchIds = new Set<string>();
      snaps.forEach((s, k) => {
        if (!s.exists) return;
        const tag = s.data()!;
        if (tag.assignedUserId !== uid) return; // arada başka işlem görmüş
        const stage = stageOf(tag.status);
        const update: Data = {
          assignedUserId: null,
          assignedUserEmail: null,
          assignedVehicleId: null,
          assignedPlate: null,
          ownerDeleted: true,
          permanentlyDisabled: true,
          lastAction: ACCOUNT_DELETED,
          lastActionBy: input.by === 'admin' ? (input.byEmail || null) : null,
          updatedAtTs: FieldValue.serverTimestamp(),
        };
        if (stage !== 'trashed') {
          Object.assign(update, {
            status: 'disabled',
            disabledReason: ACCOUNT_DELETED,
            disabledFrom: stage === 'disabled' ? (tag.disabledFrom || 'active') : (stage || 'active'),
            disabledAt: FieldValue.serverTimestamp(),
            disabledBy: input.by === 'admin' ? (input.byEmail || null) : null,
            stageChangedAt: FieldValue.serverTimestamp(),
          });
          applyTagCounts(tx, tag.batchId, snap(tag), { stage: 'disabled', printed: tag.printed === true });
        }
        tx.update(refs[k], update);
        if (tag.batchId) batchIds.add(tag.batchId);
        done.push(part[k]);
        n += 1;
      });
      if (n) {
        tx.set(db().collection('tag_events').doc(), {
          action: ACCOUNT_DELETED,
          by: input.by === 'system' ? null : uid,
          byEmail: input.by === 'admin' ? (input.byEmail || null) : null,
          count: n,
          code: n === 1 ? done[0] : null,
          codes: done.slice(0, 50),
          batchIds: [...batchIds],
          at: FieldValue.serverTimestamp(),
        });
      }
      return n;
    });
  }

  // 2) Araçlar ve gelen bildirimleri
  for (const v of vehiclesSnap.docs) {
    await deleteCollection(v.ref.collection('notices'));
    await v.ref.delete();
    await db().collection(VEHICLE_INDEX).doc(v.id).delete();
  }
  const strayIdx = await db().collection(VEHICLE_INDEX).where('ownerUid', '==', uid).select().get();
  for (const d of strayIdx.docs) await d.ref.delete();

  // 3) Profil, cihazlar, bildirim jetonları, kasa ve eski kartlar
  const userRef = db().collection('users').doc(uid);
  await deleteCollection(userRef.collection('push_tokens'));
  await deleteCollection(userRef.collection('devices'));
  await userRef.delete();
  await db().collection('vaults').doc(uid).delete();
  for (const c of cardsSnap.docs) await c.ref.delete();

  // 4) Asgari kayıt (aynı hesap için tek kayıt: kimliğin özeti belge adı olur)
  const recId = sha256(`deleted:${uid}`).slice(0, 28);
  const recRef = db().collection(DELETED).doc(recId);
  const existing = await recRef.get();
  if (!existing.exists) {
    await recRef.set({
      emailMasked: maskEmail(email),
      deletedAt: FieldValue.serverTimestamp(),
      by: input.by,
      byEmail: input.by === 'admin' ? (input.byEmail || null) : null,
      reason: str(input.reason, 160) || null,
      vehicleCount: vehiclesSnap.size,
      tagCount: codes.length,
      closedTagCount: closed,
    });
  }
  await db().collection(USER_INDEX).doc(uid).delete();

  // 5) Giriş hesabı en son silinir (önceki adımlardan biri yarıda kalırsa tekrar denenebilsin)
  if (input.deleteAuth && user) await getAuth().deleteUser(uid);
  return { vehicles: vehiclesSnap.size, tags: codes.length };
}

function requireRecentAuth(req: CallableRequest): void {
  const authTime = Number(req.auth?.token?.auth_time || 0);
  if (!authTime || Date.now() / 1000 - authTime > REAUTH_SECONDS) {
    throw new HttpsError('unauthenticated', 'REAUTH_REQUIRED');
  }
}

/**
 * Kullanıcı kendi hesabını kalıcı olarak siler (arayüzü müşteri tarafında yapılacak).
 * Son 5 dakika içinde yeniden giriş yapmış olmalıdır.
 */
export const deleteMyAccount = onCall({ timeoutSeconds: 300 }, async (req) => {
  const { uid, email } = requireAuth(req);
  requireRecentAuth(req);
  if (email && SUPER_ADMIN_EMAILS.includes(email)) {
    throw new HttpsError('failed-precondition', 'Süper yönetici hesabı buradan silinemez.');
  }
  await rateLimit(`delete:uid:${uid}`, 3, 3600);
  const reason = str(req.data?.reason, 160) || null;
  const r = await deleteAccountData(uid, { by: 'self', reason, deleteAuth: true });
  return { ok: true, ...r };
});

// ===========================================================================
// Kullanıcının kendi cihaz kaydı ve özetinin yenilenmesi
// ===========================================================================

const PLATFORMS = ['ios', 'android', 'web', 'desktop'];

/**
 * Uygulama açılınca ve araç bilgisi değişince istemci çağırır:
 *  - Bu cihazın ana ekrana eklenip eklenmediğini ve bildirim iznini kaydeder,
 *  - Kullanıcının yönetici paneli özetini kaynaktan yeniden kurar.
 * Özet istemcinin gönderdiği sayılara değil, sunucudaki gerçek kayıtlara dayanır.
 */
export const syncMyAccount = onCall(async (req) => {
  const { uid } = requireAuth(req);
  await rateLimit(`sync:uid:${uid}`, 60, 3600);
  const dev = req.data?.device;
  if (dev && typeof dev === 'object') {
    const id = typeof dev.id === 'string' && /^[a-z0-9]{16,40}$/.test(dev.id) ? dev.id : null;
    if (id) {
      const platform = PLATFORMS.includes(dev.platform) ? dev.platform : 'web';
      const ref = db().collection('users').doc(uid).collection('devices').doc(id);
      const prev = await ref.get();
      await ref.set({
        platform,
        label: str(dev.label, 60) || 'Bilinmeyen cihaz',
        standalone: dev.standalone === true,
        push: dev.push === true,
        lastSeenAt: FieldValue.serverTimestamp(),
        ...(prev.exists ? {} : { firstSeenAt: FieldValue.serverTimestamp() }),
      }, { merge: true });
      // En fazla 10 cihaz tutulur; en eski görülenler silinir.
      const all = await db().collection('users').doc(uid).collection('devices').orderBy('lastSeenAt', 'desc').get();
      const extra = all.docs.slice(MAX_DEVICES);
      if (extra.length) {
        const b = db().batch();
        extra.forEach((d) => b.delete(d.ref));
        await b.commit();
      }
    }
  }
  await refreshUserIndex(uid);
  return { ok: true };
});

// ===========================================================================
// Dizini baştan kurma (ilk açılış ve her gece)
// ===========================================================================

async function listAllAuthUsers(): Promise<UserRecord[]> {
  const out: UserRecord[] = [];
  let token: string | undefined;
  do {
    const page = await getAuth().listUsers(1000, token);
    out.push(...page.users);
    token = page.pageToken;
  } while (token);
  return out;
}

async function commitInChunks(ops: ((b: FirebaseFirestore.WriteBatch) => void)[]): Promise<void> {
  for (let i = 0; i < ops.length; i += 400) {
    const b = db().batch();
    ops.slice(i, i + 400).forEach((op) => op(b));
    await b.commit();
  }
}

export async function rebuildDirectory(): Promise<{ users: number; vehicles: number; removed: number; skippedRemoval: boolean }> {
  const [users, vehiclesSnap, tagsSnap, devicesSnap, tokensSnap, staffSnap, userIdxSnap, vehIdxSnap] = await Promise.all([
    listAllAuthUsers(),
    db().collection('vehicles').get(),
    db().collection('tags').where('status', 'in', ['active', 'disabled', 'expired']).get(),
    db().collectionGroup('devices').get(),
    db().collectionGroup('push_tokens').select().get(),
    db().collection('staff_members').get(),
    db().collection(USER_INDEX).select().get(),
    db().collection(VEHICLE_INDEX).select('ownerUid').get(),
  ]);

  const staffEmails = new Set([
    ...SUPER_ADMIN_EMAILS,
    ...staffSnap.docs.filter((d) => d.get('isActive') !== false).map((d) => d.id.toLowerCase()),
  ]);
  const byOwner = new Map<string, VehicleRow[]>();
  vehiclesSnap.docs.forEach((d) => {
    const o = d.get('ownerUid');
    if (typeof o !== 'string') return;
    const l = byOwner.get(o) || [];
    l.push({ id: d.id, data: d.data() });
    byOwner.set(o, l);
  });
  const tagByCode = new Map<string, Data>();
  const tagsByOwner = new Map<string, TagRow[]>();
  tagsSnap.docs.forEach((d) => {
    tagByCode.set(d.id, d.data());
    const o = d.get('assignedUserId');
    if (typeof o === 'string' && o) {
      const l = tagsByOwner.get(o) || [];
      l.push({ code: d.id, data: d.data() });
      tagsByOwner.set(o, l);
    }
  });
  // Araçta görünen ama yukarıdaki sorguya girmeyen QR'lar (ör. çöpte) da okunur.
  const extraCodes = vehiclesSnap.docs.map((d) => d.get('tagCode')).filter((c) => typeof c === 'string' && !tagByCode.has(c)) as string[];
  for (let i = 0; i < extraCodes.length; i += 300) {
    const snaps = await db().getAll(...extraCodes.slice(i, i + 300).map((c) => db().collection('tags').doc(c)));
    snaps.forEach((s) => { if (s.exists) tagByCode.set(s.id, s.data()!); });
  }
  const devByUser = new Map<string, DeviceRow[]>();
  devicesSnap.docs.forEach((d) => {
    const owner = d.ref.parent.parent;
    if (!owner || owner.parent.id !== 'users') return;
    const l = devByUser.get(owner.id) || [];
    l.push({ id: d.id, data: d.data() });
    devByUser.set(owner.id, l);
  });
  const tokensByUser = new Map<string, number>();
  tokensSnap.docs.forEach((d) => {
    const owner = d.ref.parent.parent;
    if (owner) tokensByUser.set(owner.id, (tokensByUser.get(owner.id) || 0) + 1);
  });

  const ops: ((b: FirebaseFirestore.WriteBatch) => void)[] = [];
  const authIds = new Set<string>();
  const liveVehicles = new Set<string>();
  let vehicleCount = 0;
  for (const u of users) {
    authIds.add(u.uid);
    const vehicles = byOwner.get(u.uid) || [];
    const idx = buildUserIndex(u.uid, u, vehicles, tagsByOwner.get(u.uid) || [], devByUser.get(u.uid) || [],
      tokensByUser.get(u.uid) || 0, staffEmails.has((u.email || '').toLowerCase()));
    ops.push((b) => b.set(db().collection(USER_INDEX).doc(u.uid), idx));
    for (const v of vehicles) {
      liveVehicles.add(v.id);
      vehicleCount += 1;
      const vi = buildVehicleIndex(v, { name: idx.name, email: idx.email }, v.data.tagCode ? tagByCode.get(v.data.tagCode) : undefined);
      ops.push((b) => b.set(db().collection(VEHICLE_INDEX).doc(v.id), vi));
    }
  }
  // Var olmayan araçların özetleri silinir.
  vehIdxSnap.docs.forEach((d) => { if (!liveVehicles.has(d.id) && authIds.has(String(d.get('ownerUid')))) ops.push((b) => b.delete(d.ref)); });
  await commitInChunks(ops);

  // Giriş hesabı artık olmayan (ör. Firebase konsolundan silinmiş) kullanıcılar: hesap silme kuralları uygulanır.
  // Güvenlik: listede beklenmedik kadar çok eksik varsa (yanlış/eksik liste şüphesi) hiçbir şey silinmez.
  const gone = new Set<string>();
  userIdxSnap.docs.forEach((d) => { if (!authIds.has(d.id)) gone.add(d.id); });
  byOwner.forEach((_, owner) => { if (!authIds.has(owner)) gone.add(owner); });
  tagsByOwner.forEach((_, owner) => { if (!authIds.has(owner)) gone.add(owner); });
  const limit = Math.max(5, Math.floor(users.length * 0.1));
  let removed = 0;
  let skippedRemoval = false;
  if (gone.size && (users.length === 0 || gone.size > limit)) {
    skippedRemoval = true;
    logger.error('[directory] silinmiş hesap sayısı beklenenden fazla; otomatik silme atlandı', { gone: gone.size, users: users.length });
  } else {
    for (const uid of gone) {
      try {
        await deleteAccountData(uid, { by: 'system', reason: 'Giriş hesabı sistemden silinmiş', deleteAuth: false });
        removed += 1;
      } catch (e) {
        logger.error('[directory] silinmiş hesap temizlenemedi', { uid, err: String(e) });
      }
    }
  }
  return { users: users.length, vehicles: vehicleCount, removed, skippedRemoval };
}

/** Dizin ilk kez kurulur (panel açılınca). Yarıda kalmışsa 10 dakika sonra yeniden denenebilir. */
export const adminEnsureDirectory = onCall({ timeoutSeconds: 540, memory: '512MiB' }, async (req) => {
  await requirePerm(req, 'view.users', 'view.vehicles');
  const meta = db().collection(META).doc('directory_v1');
  const claimed = await db().runTransaction(async (tx) => {
    const m = await tx.get(meta);
    if (m.exists && m.get('doneAt')) return false;
    const startedMs = toMs(m.get('startedAt')) || 0;
    if (m.exists && Date.now() - startedMs < 10 * 60 * 1000) return false;
    tx.set(meta, { startedAt: FieldValue.serverTimestamp(), doneAt: null });
    return true;
  });
  if (!claimed) return { built: false };
  try {
    const r = await rebuildDirectory();
    await meta.set({ doneAt: FieldValue.serverTimestamp(), ...r }, { merge: true });
    return { built: true, ...r };
  } catch (e) {
    await meta.delete().catch(() => undefined);
    throw e;
  }
});

/** Her gece 03:40 (İstanbul) dizin baştan kurulur. */
export const nightlyDirectory = onSchedule(
  { schedule: '40 3 * * *', timeZone: 'Europe/Istanbul', timeoutSeconds: 540, memory: '512MiB' },
  async () => {
    const r = await rebuildDirectory();
    await db().collection(META).doc('directory_v1').set({ lastNightlyAt: FieldValue.serverTimestamp(), lastNightly: r }, { merge: true });
    logger.info('[directory] gece yenilemesi', r);
  },
);

// ===========================================================================
// Yönetici: okuma uçları (telefon her zaman maskeli)
// ===========================================================================

/** Kullanıcılar sayfası: view.users · Bağlı Araçlar sayfası: view.vehicles */
async function viewer(req: CallableRequest, perm: 'view.users' | 'view.vehicles') {
  return requirePerm(req, perm);
}

async function logAccess(staff: { uid: string; email: string }, kind: string, target: string): Promise<void> {
  await db().collection(ACCESS_LOG).add({ by: staff.uid, byEmail: staff.email, kind, target, at: FieldValue.serverTimestamp() })
    .catch(() => undefined);
}

function istanbulMonthStart(offsetMonths = 0): number {
  const today = dayKey();
  const [y, m] = today.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + offsetMonths, 1, 12));
  return dayStartMs(d.toISOString().slice(0, 10));
}

const countOf = async (q: FirebaseFirestore.Query) => (await q.count().get()).data().count;

/**
 * İsteğe bağlı sorgular (son işlemler, geçmiş): yeni dizinler henüz hazırlanırken ya da geçici
 * bir hata olduğunda sayfanın tamamı düşmesin, yalnızca o bölüm boş gelsin.
 */
async function optionalDocs(q: FirebaseFirestore.Query, label: string): Promise<FirebaseFirestore.QueryDocumentSnapshot[]> {
  try {
    return (await q.get()).docs;
  } catch (e) {
    logger.warn(`[directory] ${label} okunamadı`, { err: String(e) });
    return [];
  }
}

function userRow(d: FirebaseFirestore.DocumentSnapshot) {
  const x = d.data() || {};
  return {
    uid: d.id,
    name: x.name || '',
    email: x.email || '',
    phoneMasked: x.phoneMasked || null,
    provider: x.provider || 'unknown',
    vehicleCount: Number(x.vehicleCount) || 0,
    tagCount: Number(x.tagCount) || 0,
    pushEnabled: x.pushEnabled === true,
    homeScreen: typeof x.homeScreen === 'boolean' ? x.homeScreen : null,
    isStaff: x.isStaff === true,
    disabled: x.disabled === true,
    createdAt: toMs(x.createdAt),
    lastSeenAt: toMs(x.lastSeenAt),
  };
}

type UserFilter = 'all' | 'no_qr' | 'push_off' | 'recent';
const USER_FILTERS: UserFilter[] = ['all', 'no_qr', 'push_off', 'recent'];

export const adminListUsers = onCall({ timeoutSeconds: 60 }, async (req) => {
  await viewer(req, 'view.users');
  const filter: UserFilter = USER_FILTERS.includes(req.data?.filter) ? req.data.filter : 'all';
  const after = typeof req.data?.after === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(req.data.after) ? req.data.after : null;
  const col = db().collection(USER_INDEX);
  const recentCut = Timestamp.fromMillis(Date.now() - 7 * 86400000);
  const match = (r: ReturnType<typeof userRow>) =>
    filter === 'no_qr' ? r.tagCount === 0
      : filter === 'push_off' ? !r.pushEnabled
        : filter === 'recent' ? (r.createdAt || 0) >= recentCut.toMillis() : true;

  // Kullanıcı kimliği yapıştırıldıysa doğrudan bulunur.
  const rawQ = typeof req.data?.q === 'string' ? req.data.q.trim() : '';
  if (/^[A-Za-z0-9]{20,40}$/.test(rawQ)) {
    const d = await col.doc(rawQ).get();
    if (d.exists) return { rows: [userRow(d)], next: null, searched: true, truncated: false };
  }
  const parsed = parseUserQuery(req.data?.q);
  if (typeof req.data?.q === 'string' && req.data.q.trim() && !parsed) return { rows: [], next: null, searched: true, truncated: false };
  if (parsed) {
    const s = await col.where('kw', 'array-contains', parsed.primary).limit(200).get();
    const rows = s.docs
      .filter((d) => { const kw: string[] = d.get('kw') || []; return parsed.rest.every((t) => kw.includes(t)); })
      .map(userRow)
      .filter(match)
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    return { rows: rows.slice(0, SEARCH_LIMIT), next: null, searched: true, truncated: rows.length > SEARCH_LIMIT };
  }

  let q: FirebaseFirestore.Query = col;
  if (filter === 'no_qr') q = q.where('tagCount', '==', 0);
  if (filter === 'push_off') q = q.where('pushEnabled', '==', false);
  if (filter === 'recent') q = q.where('createdAt', '>=', recentCut);
  q = q.orderBy('createdAt', 'desc');
  if (after) {
    const cur = await col.doc(after).get();
    if (cur.exists) q = q.startAfter(cur);
  }
  const s = await q.limit(PAGE + 1).get();
  const docs = s.docs.slice(0, PAGE);
  return { rows: docs.map(userRow), next: s.docs.length > PAGE ? docs[docs.length - 1].id : null, searched: false, truncated: false };
});

export const adminUserStats = onCall({ timeoutSeconds: 60 }, async (req) => {
  await viewer(req, 'view.users');
  const col = db().collection(USER_INDEX);
  const del = db().collection(DELETED);
  const month = Timestamp.fromMillis(istanbulMonthStart());
  const prevMonth = Timestamp.fromMillis(istanbulMonthStart(-1));
  const recent = Timestamp.fromMillis(Date.now() - 7 * 86400000);
  const [total, withQr, pushOn, home, homeUnknown, newMonth, noQr, pushOff, recentN, delTotal, delMonth, delPrev, delSelf] = await Promise.all([
    countOf(col), countOf(col.where('tagCount', '>', 0)), countOf(col.where('pushEnabled', '==', true)),
    countOf(col.where('homeScreen', '==', true)), countOf(col.where('homeScreen', '==', null)),
    countOf(col.where('createdAt', '>=', month)), countOf(col.where('tagCount', '==', 0)),
    countOf(col.where('pushEnabled', '==', false)), countOf(col.where('createdAt', '>=', recent)),
    countOf(del), countOf(del.where('deletedAt', '>=', month)),
    countOf(del.where('deletedAt', '>=', prevMonth).where('deletedAt', '<', month)), countOf(del.where('by', '==', 'self')),
  ]);
  const meta = await db().collection(META).doc('directory_v1').get();
  return {
    total, withQr, pushOn, home, homeUnknown, newMonth,
    chips: { all: total, no_qr: noQr, push_off: pushOff, recent: recentN },
    deleted: { total: delTotal, month: delMonth, prevMonth: delPrev, self: delSelf },
    ready: !!meta.get('doneAt'),
  };
});

export const adminListDeletedAccounts = onCall({ timeoutSeconds: 60 }, async (req) => {
  await viewer(req, 'view.users');
  const after = typeof req.data?.after === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(req.data.after) ? req.data.after : null;
  let q: FirebaseFirestore.Query = db().collection(DELETED).orderBy('deletedAt', 'desc');
  if (after) {
    const cur = await db().collection(DELETED).doc(after).get();
    if (cur.exists) q = q.startAfter(cur);
  }
  const s = await q.limit(PAGE + 1).get();
  const docs = s.docs.slice(0, PAGE);
  return {
    rows: docs.map((d) => {
      const x = d.data();
      return {
        id: d.id, emailMasked: x.emailMasked || '•••', deletedAt: toMs(x.deletedAt), by: x.by || 'self',
        byEmail: x.byEmail || null, reason: x.reason || null,
        vehicleCount: Number(x.vehicleCount) || 0, tagCount: Number(x.tagCount) || 0,
      };
    }),
    next: s.docs.length > PAGE ? docs[docs.length - 1].id : null,
  };
});

// ------------------------------------------------------------------ ortak: QR ve araç ayrıntısı

function scansLast30(tag: Data | undefined): { days: number[]; total: number } {
  const map = (tag?.scanDays || {}) as Record<string, number>;
  const today = dayKey();
  const days: number[] = [];
  for (let i = 29; i >= 0; i--) days.push(Number(map[addDays(today, -i)]) || 0);
  return { days, total: days.reduce((a, b) => a + b, 0) };
}

function tagSummary(code: string, tag: Data | undefined) {
  if (!tag) return null;
  return {
    code,
    serial: tag.tagId || code,
    batchId: tag.batchId || null,
    stage: stageOf(tag.status),
    reason: tag.disabledReason || null,
    permanent: tag.permanentlyDisabled === true,
    activatedAt: toMs(tag.activatedAt),
    scanCount: Number(tag.scanCount) || 0,
    lastScanAt: toMs(tag.lastScanAt),
    scans30: scansLast30(tag).total,
    printed: tag.printed === true,
    lastAction: tag.lastAction || null,
    stageChangedAt: toMs(tag.stageChangedAt) || toMs(tag.updatedAtTs),
  };
}

const NOTICE_LABEL: Record<string, string> = {
  blocking: 'Aracınız yolu / çıkışı kapatıyor', lights: 'Farlarınız açık kalmış', window: 'Camınız veya kapınız açık',
  alarm: 'Alarm çalıyor / araca temas oldu', other: 'Diğer mesaj',
};

export const adminGetUser = onCall({ timeoutSeconds: 60 }, async (req) => {
  const staff = await viewer(req, 'view.users');
  const uid = typeof req.data?.uid === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(req.data.uid) ? req.data.uid : null;
  if (!uid) throw new HttpsError('invalid-argument', 'Geçersiz kullanıcı.');
  const user = await authUser(uid);
  if (!user) throw new HttpsError('not-found', 'Kullanıcı bulunamadı. Hesap silinmiş olabilir.');
  await refreshUserIndex(uid).catch(() => undefined);

  const since = Timestamp.fromMillis(Date.now() - 30 * 86400000);
  const [idxSnap, vehiclesSnap, ownedSnap, devicesSnap, eventsSnap] = await Promise.all([
    db().collection(USER_INDEX).doc(uid).get(),
    db().collection('vehicles').where('ownerUid', '==', uid).get(),
    db().collection('tags').where('assignedUserId', '==', uid).get(),
    db().collection('users').doc(uid).collection('devices').orderBy('lastSeenAt', 'desc').get(),
    optionalDocs(db().collection('tag_events').where('by', '==', uid).orderBy('at', 'desc').limit(15), 'kullanıcı işlemleri'),
  ]);
  const tagByCode = new Map(ownedSnap.docs.map((d) => [d.id, d.data()]));
  const missing = vehiclesSnap.docs.map((d) => d.get('tagCode')).filter((c) => typeof c === 'string' && !tagByCode.has(c)) as string[];
  if (missing.length) (await db().getAll(...missing.map((c) => db().collection('tags').doc(c)))).forEach((s) => { if (s.exists) tagByCode.set(s.id, s.data()!); });

  const vehicles = await Promise.all(sortVehicles(vehiclesSnap.docs.map((d) => ({ id: d.id, data: d.data() }))).map(async (v) => {
    const notices30 = await countOf(db().collection('vehicles').doc(v.id).collection('notices').where('createdAt', '>=', since));
    const tag = v.data.tagCode ? tagByCode.get(v.data.tagCode) : undefined;
    return {
      id: v.id,
      plate: str(v.data.plateNumber, 16).toUpperCase(),
      brandModel: str(v.data.brandModel, 60),
      createdAt: toMs(v.data.createdAt),
      tag: v.data.tagCode ? tagSummary(v.data.tagCode, tag) : null,
      notices30,
    };
  }));
  const linkedCodes = new Set(vehicles.map((v) => v.tag?.code).filter(Boolean));
  const looseTags = ownedSnap.docs.filter((d) => !linkedCodes.has(d.id)).map((d) => tagSummary(d.id, d.data()));

  const recentNotices = (await Promise.all(vehiclesSnap.docs.map((v) =>
    optionalDocs(v.ref.collection('notices').orderBy('createdAt', 'desc').limit(5), 'bildirimler')
      .then((docs) => docs.map((n) => ({ at: toMs(n.get('createdAt')), type: String(n.get('type') || 'other'), plate: str(v.get('plateNumber'), 16).toUpperCase() })))))).flat();

  const activity: { at: number | null; kind: string; detail: string }[] = [];
  activity.push({ at: tsFromIso(user.metadata.creationTime)?.toMillis() || null, kind: 'account_created', detail: providerOf(user) });
  vehicles.forEach((v) => activity.push({ at: v.createdAt, kind: 'vehicle_added', detail: [v.plate, v.brandModel].filter(Boolean).join(' · ') }));
  recentNotices.forEach((n) => activity.push({ at: n.at, kind: 'notice_received', detail: `${n.plate} · ${NOTICE_LABEL[n.type] || NOTICE_LABEL.other}` }));
  devicesSnap.docs.forEach((d) => { if (d.get('firstSeenAt')) activity.push({ at: toMs(d.get('firstSeenAt')), kind: 'device_added', detail: str(d.get('label'), 60) }); });
  const serials = new Map([...tagByCode.entries()].map(([c, t]) => [c, (t.tagId as string) || c]));
  eventsSnap.forEach((e) => {
    const a = String(e.get('action') || '');
    if (!['claimed', 'moved', 'unlinked', 'reported_lost'].includes(a)) return;
    const code = e.get('code');
    activity.push({ at: toMs(e.get('at')), kind: a, detail: (typeof code === 'string' && serials.get(code)) || '' });
  });
  activity.sort((a, b) => (b.at || 0) - (a.at || 0));

  await logAccess(staff, 'user', uid);
  const x = idxSnap.data() || {};
  const canDelete = staff.superAdmin || staff.perms.has('act.user_delete');
  return {
    canDelete,
    deleteQuota: canDelete ? await getQuota(staff, 'user_delete') : null,
    uid,
    name: x.name || user.displayName || '',
    email: (user.email || '').toLowerCase(),
    provider: providerOf(user),
    emailVerified: user.emailVerified === true,
    disabled: user.disabled === true,
    isStaff: x.isStaff === true,
    createdAt: tsFromIso(user.metadata.creationTime)?.toMillis() || null,
    lastSignInAt: tsFromIso(user.metadata.lastSignInTime)?.toMillis() || null,
    phoneMasked: x.phoneMasked || null,
    pushEnabled: x.pushEnabled === true,
    homeScreen: typeof x.homeScreen === 'boolean' ? x.homeScreen : null,
    summary: {
      vehicles: vehicles.length,
      tags: Number(x.tagCount) || 0,
      scans30: vehicles.reduce((a, v) => a + (v.tag?.scans30 || 0), 0),
      notices30: vehicles.reduce((a, v) => a + v.notices30, 0),
    },
    vehicles,
    looseTags,
    devices: devicesSnap.docs.map((d) => ({
      id: d.id, platform: d.get('platform') || 'web', label: d.get('label') || '', standalone: d.get('standalone') === true,
      push: d.get('push') === true, lastSeenAt: toMs(d.get('lastSeenAt')),
    })),
    activity: activity.slice(0, 12),
  };
});

// ------------------------------------------------------------------ araçlar

function vehicleRow(d: FirebaseFirestore.DocumentSnapshot) {
  const x = d.data() || {};
  return {
    id: d.id,
    plate: x.plate || '',
    brandModel: x.brandModel || '',
    ownerUid: x.ownerUid || '',
    ownerName: x.ownerName || '',
    ownerEmail: x.ownerEmail || '',
    province: x.province || '',
    tagState: (x.tagState || 'none') as TagState,
    tagSerial: x.tagSerial || null,
    tagReason: x.tagReason || null,
    createdAt: toMs(x.createdAt),
  };
}

type VehicleFilter = 'all' | 'linked' | 'none' | 'disabled';
const VEHICLE_FILTERS: VehicleFilter[] = ['all', 'linked', 'none', 'disabled'];

/** Arama metni QR kodu ya da seri no ise ilgili aracı bulur. */
async function vehicleByTagQuery(q: string): Promise<string | null> {
  const raw = q.trim().toUpperCase();
  const code = raw.replace(/[^A-Z0-9]/g, '');
  if (/^HF-/.test(raw)) {
    const s = await db().collection('tags').where('tagId', '==', raw.replace(/\s/g, '')).limit(1).get();
    if (!s.empty) return s.docs[0].id;
  }
  if (/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{12}$/.test(code)) return code;
  return null;
}

export const adminListVehicles = onCall({ timeoutSeconds: 60 }, async (req) => {
  await viewer(req, 'view.vehicles');
  const filter: VehicleFilter = VEHICLE_FILTERS.includes(req.data?.filter) ? req.data.filter : 'all';
  const province = typeof req.data?.province === 'string' && /^\d{2}$/.test(req.data.province) ? req.data.province : null;
  const after = typeof req.data?.after === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(req.data.after) ? req.data.after : null;
  const col = db().collection(VEHICLE_INDEX);
  const match = (r: ReturnType<typeof vehicleRow>) => (filter === 'all' || r.tagState === filter) && (!province || r.province === province);
  const qText = typeof req.data?.q === 'string' ? req.data.q.slice(0, 40) : '';

  if (qText.trim()) {
    const code = await vehicleByTagQuery(qText);
    if (code) {
      const s = await col.where('tagCode', '==', code).limit(5).get();
      if (!s.empty) return { rows: s.docs.map(vehicleRow), next: null, searched: true, truncated: false, normalized: code, byTag: true };
    }
    const norm = normPlate(qText);
    if (norm.length < 2) return { rows: [], next: null, searched: true, truncated: false, normalized: norm, byTag: false };
    const s = await col.orderBy('plateNorm').startAt(norm).endAt(norm + '').limit(200).get();
    const rows = s.docs.map(vehicleRow).filter(match);
    return { rows: rows.slice(0, SEARCH_LIMIT), next: null, searched: true, truncated: rows.length > SEARCH_LIMIT, normalized: norm, byTag: false };
  }

  let q: FirebaseFirestore.Query = col;
  if (filter !== 'all') q = q.where('tagState', '==', filter);
  if (province) q = q.where('province', '==', province);
  q = q.orderBy('createdAt', 'desc');
  if (after) {
    const cur = await col.doc(after).get();
    if (cur.exists) q = q.startAfter(cur);
  }
  const s = await q.limit(PAGE + 1).get();
  const docs = s.docs.slice(0, PAGE);
  return { rows: docs.map(vehicleRow), next: s.docs.length > PAGE ? docs[docs.length - 1].id : null, searched: false, truncated: false, normalized: '', byTag: false };
});

export const adminVehicleStats = onCall({ timeoutSeconds: 60 }, async (req) => {
  await viewer(req, 'view.vehicles');
  const col = db().collection(VEHICLE_INDEX);
  const month = Timestamp.fromMillis(istanbulMonthStart());
  const [total, linked, none, disabled, newMonth, provSnap] = await Promise.all([
    countOf(col), countOf(col.where('tagState', '==', 'linked')), countOf(col.where('tagState', '==', 'none')),
    countOf(col.where('tagState', '==', 'disabled')), countOf(col.where('createdAt', '>=', month)),
    col.select('province').get(),
  ]);
  const provinces: Record<string, number> = {};
  provSnap.docs.forEach((d) => { const p = d.get('province'); if (typeof p === 'string' && p) provinces[p] = (provinces[p] || 0) + 1; });
  const meta = await db().collection(META).doc('directory_v1').get();
  return { total, linked, none, disabled, newMonth, provinces, ready: !!meta.get('doneAt') };
});

export const adminGetVehicle = onCall({ timeoutSeconds: 60 }, async (req) => {
  const staff = await viewer(req, 'view.vehicles');
  const id = typeof req.data?.vehicleId === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(req.data.vehicleId) ? req.data.vehicleId : null;
  if (!id) throw new HttpsError('invalid-argument', 'Geçersiz araç.');
  const vSnap = await db().collection('vehicles').doc(id).get();
  if (!vSnap.exists) throw new HttpsError('not-found', 'Araç bulunamadı. Silinmiş olabilir.');
  const v = vSnap.data()!;
  const ownerUid = str(v.ownerUid, 128);
  const since = Timestamp.fromMillis(Date.now() - 30 * 86400000);
  const code = typeof v.tagCode === 'string' ? v.tagCode : null;

  const [ownerIdx, otherSnap, tagSnap, noticesSnap, notices30, byVehicle, byCode, byCodes] = await Promise.all([
    ownerUid ? db().collection(USER_INDEX).doc(ownerUid).get() : Promise.resolve(null),
    ownerUid ? db().collection('vehicles').where('ownerUid', '==', ownerUid).select('plateNumber').get() : Promise.resolve(null),
    code ? db().collection('tags').doc(code).get() : Promise.resolve(null),
    vSnap.ref.collection('notices').orderBy('createdAt', 'desc').limit(8).get(),
    countOf(vSnap.ref.collection('notices').where('createdAt', '>=', since)),
    optionalDocs(db().collection('tag_events').where('vehicleId', '==', id).orderBy('at', 'desc').limit(15), 'araç geçmişi'),
    code ? optionalDocs(db().collection('tag_events').where('code', '==', code).orderBy('at', 'desc').limit(15), 'QR geçmişi') : Promise.resolve([]),
    code ? optionalDocs(db().collection('tag_events').where('codes', 'array-contains', code).orderBy('at', 'desc').limit(15), 'toplu QR geçmişi') : Promise.resolve([]),
  ]);
  const tag = tagSnap?.exists ? tagSnap.data() : undefined;
  const o = ownerIdx?.exists ? ownerIdx.data()! : null;

  const history: { at: number | null; kind: string; detail: string }[] = [];
  const seen = new Set<string>();
  const ACTIONS = new Set(['claimed', 'moved', 'unlinked', 'reported_lost', 'admin_disable', 'admin_enable', 'admin_expire', 'admin_reset', 'tags_released', 'account_deleted', 'batch_created']);
  [byVehicle, byCode, byCodes].forEach((list) => list.forEach((e) => {
    if (seen.has(e.id)) return;
    seen.add(e.id);
    const a = String(e.get('action') || '');
    if (!ACTIONS.has(a)) return;
    history.push({ at: toMs(e.get('at')), kind: a, detail: (e.get('code') === code || (e.get('codes') || []).includes(code)) && tag ? (tag.tagId || '') : '' });
  }));
  history.push({ at: toMs(v.createdAt), kind: 'vehicle_added', detail: [str(v.plateNumber, 16).toUpperCase(), str(v.brandModel, 60)].filter(Boolean).join(' · ') });
  if (tag) history.push({ at: toMs(tag.createdAt), kind: 'tag_created', detail: tag.batchId || '' });
  history.sort((a, b) => (b.at || 0) - (a.at || 0));

  await logAccess(staff, 'vehicle', id);
  const scans = scansLast30(tag);
  return {
    id,
    plate: str(v.plateNumber, 16).toUpperCase(),
    plateMasked: maskPlate(v.plateNumber),
    province: /^\d{2}/.test(normPlate(v.plateNumber)) ? normPlate(v.plateNumber).slice(0, 2) : '',
    brandModel: str(v.brandModel, 60),
    createdAt: toMs(v.createdAt),
    allowMessages: v.allowMessages !== false,
    parkingNote: str(v.parkingNote, 200),
    phoneMasked: maskPhone(v.contactPhone),
    owner: ownerUid ? {
      uid: ownerUid,
      name: o?.name || str(v.ownerName, 60),
      email: o?.email || '',
      pushEnabled: o?.pushEnabled === true,
      otherPlates: (otherSnap?.docs || []).filter((d) => d.id !== id).map((d) => str(d.get('plateNumber'), 16).toUpperCase()).filter(Boolean),
    } : null,
    tag: code ? tagSummary(code, tag) : null,
    scans: code ? scans : { days: Array(30).fill(0), total: 0 },
    notices30,
    notices: noticesSnap.docs.map((n) => ({ at: toMs(n.get('createdAt')), type: String(n.get('type') || 'other'), read: n.get('read') === true })),
    history: history.slice(0, 15),
  };
});


// ===========================================================================
// Yönetici: müşteri hesabını silme (kritik işlem)
// ===========================================================================

/**
 * Yalnızca "Müşteri hesabını silebilir" yetkisi olanlar (süper yönetici her zaman).
 * Her silmede son 5 dakika içinde şifre/Google ile yeniden giriş ve sebep zorunlu; günlük sınır vardır
 * (süper yöneticiler muaf). Her silme süper yöneticilere bildirilir ve denetim kaydına yazılır.
 * Ekip üyelerinin hesapları buradan silinemez.
 */
export const adminDeleteUser = onCall({ timeoutSeconds: 300 }, async (req) => {
  const staff = await requirePerm(req, 'act.user_delete');
  requireFreshLogin(req);
  const reason = requireReason(req.data?.reason);
  const uid = typeof req.data?.uid === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(req.data.uid) ? req.data.uid : null;
  if (!uid) throw new HttpsError('invalid-argument', 'Geçersiz kullanıcı.');
  if (uid === staff.uid) throw new HttpsError('failed-precondition', 'Kendi hesabınızı buradan silemezsiniz.');
  const user = await authUser(uid);
  const idx = await db().collection(USER_INDEX).doc(uid).get();
  if (!user && !idx.exists) throw new HttpsError('not-found', 'Kullanıcı bulunamadı. Hesap zaten silinmiş olabilir.');
  const email = (user?.email || idx.get('email') || '').toLowerCase();
  if (email && (SUPER_ADMIN_EMAILS.includes(email) || (await MEMBERS().doc(email).get()).exists)) {
    throw new HttpsError('failed-precondition', 'Ekip üyelerinin hesabı buradan silinemez. Önce Ekip ve Yetkiler sayfasından ekipten çıkarılmalı.');
  }
  const refund = await reserveQuota(staff, 'user_delete', 1);
  let r: { vehicles: number; tags: number };
  try {
    r = await deleteAccountData(uid, { by: 'admin', byEmail: staff.email, reason, deleteAuth: true });
  } catch (e) {
    await refund();
    throw e;
  }
  await recordCritical(staff, 'user_deleted', { targetMasked: maskEmail(email), reason, vehicles: r.vehicles, tags: r.tags });
  return { ok: true, ...r };
});
