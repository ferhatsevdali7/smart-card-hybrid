/**
 * Yönetici yetkileri, pozisyonlar ve kritik işlem sınırları.
 *
 *   staff_positions/{id}    Pozisyon = yetki paketi { name, description, perms[], builtin }
 *   staff_members/{email}   Ekip üyesi { positionId, perms[] (pozisyondan kopya), status, ... }
 *   critical_usage/{id}     Kişinin o günkü kritik işlem sayısı (yalnızca sunucu)
 *   critical_overrides/{id} Süper yöneticinin o gün için kaldırdığı kısıtlar (yalnızca sunucu)
 *   admin_notifications/{id} Süper yöneticilere bildirimler (bildirim düğmesi)
 *   admin_audit/{id}        Ekip ve yetki değişiklikleri, kritik işlemler (Denetim Kayıtları)
 *
 * Kurallar:
 *  - Süper yöneticiler yalnızca config.ts'deki iki e-postadır; bu yetki kimseye verilemez.
 *  - Ekip ve yetki yönetimi devredilemez (yalnızca süper yönetici).
 *  - Her istekte yetki SUNUCUDA, kişinin güncel kaydından okunur (ekrandaki düğme gizliliğine güvenilmez).
 *  - Üyenin perms listesi pozisyondan kopyalanır (Firestore kuralları tek okuma ile kontrol edebilsin diye);
 *    pozisyon değişince o pozisyondaki herkesinki aynı anda güncellenir.
 */

import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { CallableRequest, HttpsError } from 'firebase-functions/v2/https';
import { SUPER_ADMIN_EMAILS } from './config';
import { db, requireAuth, sha256 } from './helpers';
import { dayKey } from './stats';

// ---------------------------------------------------------------------------
// Yetki listesi (arayüzdeki gruplu tablo ile aynı sıra)
// ---------------------------------------------------------------------------

export const PERM_GROUPS: { page: string; view: string; actions: string[] }[] = [
  { page: 'overview', view: 'view.overview', actions: ['act.campaigns'] },
  { page: 'depot', view: 'view.depot', actions: ['act.batch_create', 'act.release', 'act.unrelease', 'act.print', 'act.zip', 'act.trash'] },
  { page: 'stand', view: 'view.stand', actions: [] },
  { page: 'bank', view: 'view.bank', actions: ['act.disable', 'act.expire'] },
  { page: 'disabled', view: 'view.disabled', actions: ['act.enable', 'act.reset'] },
  { page: 'trash', view: 'view.trash', actions: ['act.restore', 'act.purge'] },
  { page: 'vehicles', view: 'view.vehicles', actions: [] },
  { page: 'users', view: 'view.users', actions: ['act.user_delete'] },
  { page: 'audit', view: 'view.audit', actions: [] },
];

/** Bir işlemin hangi sayfaların görme yetkisinden biriyle birlikte verilebileceği */
const ACTION_PAGES: Record<string, string[]> = {
  'act.campaigns': ['view.overview'],
  'act.batch_create': ['view.depot'],
  'act.release': ['view.depot'],
  'act.unrelease': ['view.depot', 'view.stand'],
  'act.print': ['view.depot'],
  'act.zip': ['view.depot'],
  'act.trash': ['view.depot'],
  'act.disable': ['view.bank'],
  'act.expire': ['view.bank'],
  'act.enable': ['view.disabled'],
  'act.reset': ['view.disabled', 'view.bank'],
  'act.restore': ['view.trash'],
  'act.purge': ['view.trash'],
  'act.user_delete': ['view.users'],
};

export const VIEW_PERMS = PERM_GROUPS.map((g) => g.view);
export const ACTION_PERMS = Object.keys(ACTION_PAGES);
/** Pozisyonlara verilebilen tüm yetkiler (ekip yönetimi bu listede YOKTUR: devredilemez). */
export const DELEGABLE = new Set<string>([...VIEW_PERMS, ...ACTION_PERMS]);
export const CRITICAL = new Set<string>(['act.purge', 'act.user_delete']);

/** Günlük sınırlar (süper yöneticiler muaf; kısıtı bildirimden kaldırabilirler) */
export const DAILY_LIMITS: Record<'user_delete' | 'purge', number> = { user_delete: 10, purge: 200 };

export type Perm = string;

/** Gelen yetki listesini temizler: bilinmeyenleri atar, görme yetkisi olmayan işlemleri düşürür. */
export function normalizePerms(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const set = new Set(input.filter((p): p is string => typeof p === 'string' && DELEGABLE.has(p)));
  for (const a of ACTION_PERMS) {
    if (set.has(a) && !ACTION_PAGES[a].some((v) => set.has(v))) set.delete(a);
  }
  return [...DELEGABLE].filter((p) => set.has(p));
}

// ---------------------------------------------------------------------------
// Hazır pozisyonlar (eski rollerin karşılığı)
// ---------------------------------------------------------------------------

export const BUILTIN_POSITIONS: Record<string, { name: string; description: string; perms: string[] }> = {
  warehouse: {
    name: 'Depo sorumlusu',
    description: 'QR Deposu ve Satış Standı: satışa çıkarma, basıldı işareti, ZIP',
    perms: ['view.depot', 'view.stand', 'act.release', 'act.unrelease', 'act.print', 'act.zip'],
  },
  production: {
    name: 'Üretim',
    description: 'Depo sorumlusunun yaptıkları + parti üretme, çöpe atma ve geri yükleme',
    perms: ['view.overview', 'view.depot', 'view.stand', 'view.trash', 'act.batch_create', 'act.release', 'act.unrelease', 'act.print', 'act.zip', 'act.trash', 'act.restore'],
  },
  support: {
    name: 'Müşteri destek',
    description: 'Kullanıcılar, Bağlı Araçlar, QR Bankası ve Devre Dışı: QR kapatma ve açma',
    perms: ['view.overview', 'view.users', 'view.vehicles', 'view.bank', 'view.disabled', 'act.disable', 'act.expire', 'act.enable', 'act.reset'],
  },
  sales: {
    name: 'Satış',
    description: 'Genel Bakış, Satış Standı ve QR Bankası: yalnızca görüntüleme',
    perms: ['view.overview', 'view.stand', 'view.bank'],
  },
};

const META = () => db().collection('stats_meta').doc('team_v1');
export const POSITIONS = () => db().collection('staff_positions');
export const MEMBERS = () => db().collection('staff_members');

let seeded = false;
/**
 * Hazır pozisyonları bir kez oluşturur ve eski rol kayıtlarını pozisyonlara taşır.
 * Tekrar çağrılması güvenlidir (var olanlara dokunmaz).
 */
export async function ensureTeamSeeded(): Promise<void> {
  if (seeded) return;
  const meta = await META().get();
  if (meta.exists && meta.get('doneAt')) { seeded = true; return; }
  const batch = db().batch();
  for (const [id, p] of Object.entries(BUILTIN_POSITIONS)) {
    const ref = POSITIONS().doc(id);
    const s = await ref.get();
    if (!s.exists) batch.set(ref, { ...p, perms: normalizePerms(p.perms), builtin: true, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
  }
  await batch.commit();
  const members = await MEMBERS().get();
  for (const m of members.docs) {
    const d = m.data();
    if (d.positionId) continue;
    const pid = typeof d.role === 'string' && BUILTIN_POSITIONS[d.role] ? d.role : null;
    const perms = pid ? normalizePerms(BUILTIN_POSITIONS[pid].perms) : [];
    await m.ref.set({
      positionId: pid,
      perms,
      status: d.isActive === false ? 'suspended' : 'active',
      migratedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  }
  await META().set({ doneAt: FieldValue.serverTimestamp() }, { merge: true });
  seeded = true;
}

// ---------------------------------------------------------------------------
// İstekte yetki
// ---------------------------------------------------------------------------

export interface StaffAccess {
  uid: string;
  email: string;
  name: string;
  superAdmin: boolean;
  perms: Set<string>;
  positionId: string | null;
}

export function isSuperAdminEmail(email: string | null | undefined): boolean {
  return !!email && SUPER_ADMIN_EMAILS.includes(email.toLowerCase());
}

/** Kişinin güncel yetkileri; ekipte değilse, askıdaysa ya da e-postası doğrulanmamışsa null. */
export async function getAccess(req: CallableRequest): Promise<StaffAccess | null> {
  if (!req.auth) return null;
  const email = typeof req.auth.token.email === 'string' ? req.auth.token.email.toLowerCase() : null;
  if (!email) return null;
  if (isSuperAdminEmail(email)) {
    // Süper yönetici adresi doğrulanmış olmalı (aynı adresle açılmış doğrulanmamış hesap yetki almaz).
    if (req.auth.token.email_verified !== true) return null;
    return { uid: req.auth.uid, email, name: String(req.auth.token.name || ''), superAdmin: true, perms: new Set(DELEGABLE), positionId: null };
  }
  if (req.auth.token.email_verified !== true) return null;
  const snap = await MEMBERS().doc(email).get();
  if (!snap.exists) return null;
  const d = snap.data()!;
  // Eski kayıt (henüz taşınmamış): rolüne karşılık gelen hazır pozisyon
  let status = typeof d.status === 'string' ? d.status : (d.isActive === false ? 'suspended' : 'active');
  if (status === 'invited') status = 'active'; // ilk girişte etkinleşir (staffSignIn kaydeder)
  if (status !== 'active') return null;
  let perms: string[] = Array.isArray(d.perms) ? d.perms : [];
  if (!d.positionId && !Array.isArray(d.perms) && typeof d.role === 'string' && BUILTIN_POSITIONS[d.role]) perms = BUILTIN_POSITIONS[d.role].perms;
  return { uid: req.auth.uid, email, name: String(d.name || req.auth.token.name || ''), superAdmin: false, perms: new Set(normalizePerms(perms)), positionId: d.positionId || null };
}

/** Herhangi bir yetkisi olan ekip üyesi */
export async function requireAnyStaff(req: CallableRequest): Promise<StaffAccess> {
  requireAuth(req);
  const a = await getAccess(req);
  if (!a) throw new HttpsError('permission-denied', 'Bu işlem için yetkiniz yok.');
  return a;
}

/** Listelenen yetkilerden en az biri gerekli */
export async function requirePerm(req: CallableRequest, ...perms: string[]): Promise<StaffAccess> {
  const a = await requireAnyStaff(req);
  if (!a.superAdmin && !perms.some((p) => a.perms.has(p))) {
    throw new HttpsError('permission-denied', 'Bu işlem için yetkiniz yok.');
  }
  return a;
}

export async function requireSuperAdmin(req: CallableRequest): Promise<StaffAccess> {
  const a = await requireAnyStaff(req);
  if (!a.superAdmin) throw new HttpsError('permission-denied', 'Bu işlem yalnızca süper yöneticilere açıktır.');
  return a;
}

/** Kritik işlemler: son 5 dakika içinde şifreyle (ya da Google ile) yeniden giriş yapılmış olmalı. */
export function requireRecentAuth(req: CallableRequest, seconds = 5 * 60): void {
  const authTime = Number(req.auth?.token?.auth_time || 0);
  if (!authTime || Date.now() / 1000 - authTime > seconds) {
    throw new HttpsError('unauthenticated', 'REAUTH_REQUIRED');
  }
}

/** Kritik işlem sebebi: zorunlu, 5-160 karakter */
export function requireReason(input: unknown): string {
  const r = typeof input === 'string' ? input.replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim() : '';
  if (r.length < 5) throw new HttpsError('invalid-argument', 'Lütfen işlemin sebebini yazın (en az 5 karakter).');
  return r.slice(0, 160);
}

// ---------------------------------------------------------------------------
// Kritik işlem günlük sınırı
// ---------------------------------------------------------------------------

export type CriticalKind = keyof typeof DAILY_LIMITS;

const usageId = (email: string, day = dayKey()) => `${day}_${sha256(email).slice(0, 20)}`;
const overrideId = (email: string, kind: CriticalKind, day = dayKey()) => `${day}_${kind}_${sha256(email).slice(0, 20)}`;

export interface Quota { used: number; limit: number | null; remaining: number | null; lifted: boolean }

export async function getQuota(a: StaffAccess, kind: CriticalKind): Promise<Quota> {
  if (a.superAdmin) return { used: 0, limit: null, remaining: null, lifted: false };
  const [u, o] = await Promise.all([
    db().collection('critical_usage').doc(usageId(a.email)).get(),
    db().collection('critical_overrides').doc(overrideId(a.email, kind)).get(),
  ]);
  const used = Number(u.get(kind)) || 0;
  const lifted = o.exists;
  const limit = DAILY_LIMITS[kind];
  return { used, limit: lifted ? null : limit, remaining: lifted ? null : Math.max(0, limit - used), lifted };
}

/**
 * İşlemden ÖNCE çağrılır: n birimlik hak ayırır (işlem içinde, eşzamanlı isteklerde aşım olmaz).
 * Hak yetmezse işlem durur ve süper yöneticilere (günde bir kez) bildirim gider.
 * @returns geri alma fonksiyonu (işlem başarısız olursa ayrılan hak iade edilir)
 */
export async function reserveQuota(a: StaffAccess, kind: CriticalKind, n: number): Promise<() => Promise<void>> {
  if (a.superAdmin || n <= 0) return async () => undefined;
  const uRef = db().collection('critical_usage').doc(usageId(a.email));
  const oRef = db().collection('critical_overrides').doc(overrideId(a.email, kind));
  const limit = DAILY_LIMITS[kind];
  const res = await db().runTransaction(async (tx) => {
    const [u, o] = await Promise.all([tx.get(uRef), tx.get(oRef)]);
    const used = Number(u.get(kind)) || 0;
    if (!o.exists && used + n > limit) return { ok: false, used };
    tx.set(uRef, { [kind]: FieldValue.increment(n), email: a.email, day: dayKey(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return { ok: true, used: used + n, lifted: o.exists };
  });
  if (!res.ok) {
    await notifyLimit(a, kind, res.used, limit);
    const left = Math.max(0, limit - res.used);
    throw new HttpsError('resource-exhausted', left > 0
      ? `Bugün en fazla ${left} ${kind === 'purge' ? 'QR kalıcı olarak silebilirsiniz' : 'hesap daha silebilirsiniz'}. Süper yöneticiye haber verildi.`
      : 'Bugünkü kritik işlem sınırınız doldu. Süper yöneticiye haber verildi; kısıt kaldırılınca devam edebilirsiniz.');
  }
  if (!res.lifted && res.used >= limit) await notifyLimit(a, kind, res.used, limit);
  return async () => {
    await uRef.set({ [kind]: FieldValue.increment(-n) }, { merge: true }).catch(() => undefined);
  };
}

async function notifyLimit(a: StaffAccess, kind: CriticalKind, used: number, limit: number): Promise<void> {
  // Aynı kişi + işlem için günde tek bildirim
  const id = `limit_${overrideId(a.email, kind)}`;
  const ref = db().collection('admin_notifications').doc(id);
  try {
    await ref.create({
      kind: 'limit_reached',
      action: kind,
      actorEmail: a.email,
      actorName: a.name || a.email.split('@')[0],
      used: Math.min(used, limit),
      limit,
      day: dayKey(),
      resolved: false,
      readBy: [],
      createdAt: FieldValue.serverTimestamp(),
    });
  } catch {
    /* zaten bildirilmiş */
  }
}

/** Süper yöneticiye kritik işlem bildirimi + denetim kaydı */
export async function recordCritical(a: StaffAccess, action: string, data: Record<string, unknown>): Promise<void> {
  const base = { action, actorEmail: a.email, actorUid: a.uid, actorName: a.name || a.email.split('@')[0], superAdmin: a.superAdmin, ...data };
  await Promise.all([
    db().collection('admin_audit').add({ ...base, at: FieldValue.serverTimestamp() }),
    db().collection('admin_notifications').add({ kind: 'critical', ...base, readBy: [], createdAt: FieldValue.serverTimestamp() }),
  ]);
}

export async function audit(a: { uid: string; email: string }, action: string, data: Record<string, unknown>): Promise<void> {
  await db().collection('admin_audit').add({ action, actorEmail: a.email, actorUid: a.uid, ...data, at: FieldValue.serverTimestamp() });
}

export function tsMs(v: unknown): number | null {
  if (v instanceof Timestamp) return v.toMillis();
  if (v && typeof (v as { toMillis?: () => number }).toMillis === 'function') return (v as { toMillis: () => number }).toMillis();
  return null;
}
