/**
 * Ekip ve Yetkiler (yalnızca süper yönetici) ve yönetici girişi.
 *
 * Ekibe ekleme: yalnızca e-posta + pozisyon. Kişi o e-postayla (Google ya da e-posta/şifre) panele
 * girdiğinde "davet bekliyor" durumundan "etkin"e geçer. Şifre belirlenmez.
 * Askıya alma ve ekipten çıkarma kişinin açık panel oturumlarını anında kapatır.
 * Süper yöneticilere bu sayfadan dokunulamaz.
 */

import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { SUPER_ADMIN_EMAILS } from './config';
import { db, rateLimit, requireAuth } from './helpers';
import {
  BUILTIN_POSITIONS, CRITICAL, DAILY_LIMITS, MEMBERS, POSITIONS, audit, ensureTeamSeeded, getAccess, getQuota,
  isSuperAdminEmail, normalizePerms, requireAnyStaff, requireSuperAdmin, tsMs, CriticalKind,
} from './permissions';
import { dayKey } from './stats';
import { sha256 } from './helpers';

const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,24}$/i;

function cleanEmail(v: unknown): string {
  const e = typeof v === 'string' ? v.trim().toLowerCase() : '';
  if (!EMAIL_RE.test(e) || e.length > 254) throw new HttpsError('invalid-argument', 'Geçerli bir e-posta adresi yazın.');
  return e;
}

function guardNotSuper(email: string): void {
  if (isSuperAdminEmail(email)) throw new HttpsError('failed-precondition', 'Süper yöneticiler bu sayfadan değiştirilemez.');
}

async function uidOfEmail(email: string, docUid?: unknown): Promise<string | null> {
  if (typeof docUid === 'string' && docUid) return docUid;
  try { return (await getAuth().getUserByEmail(email)).uid; } catch { return null; }
}

/** Kişinin panel oturumlarını kapatır (oturumu açık tarayıcı anında çıkış yapar). */
async function revokeSessions(email: string, uid: string | null, onlyId?: string): Promise<number> {
  const docs = new Map<string, FirebaseFirestore.DocumentReference>();
  const byEmail = await db().collection('admin_sessions').where('email', '==', email).get();
  byEmail.docs.forEach((d) => docs.set(d.id, d.ref));
  if (uid) (await db().collection('admin_sessions').where('uid', '==', uid).get()).docs.forEach((d) => docs.set(d.id, d.ref));
  let n = 0;
  const batch = db().batch();
  for (const [id, ref] of docs) {
    if (onlyId && id !== onlyId) continue;
    batch.set(ref, { revoked: true, revokedAt: FieldValue.serverTimestamp(), revokedBy: 'super_admin' }, { merge: true });
    n += 1;
  }
  if (n) await batch.commit();
  return n;
}

async function activeSessions(email: string, uid: string | null) {
  const now = Date.now();
  const seen = new Map<string, FirebaseFirestore.DocumentData & { id: string }>();
  const add = (s: FirebaseFirestore.QuerySnapshot) => s.docs.forEach((d) => seen.set(d.id, { id: d.id, ...d.data() }));
  add(await db().collection('admin_sessions').where('email', '==', email).limit(50).get());
  if (uid) add(await db().collection('admin_sessions').where('uid', '==', uid).limit(50).get());
  return [...seen.values()].filter((s) => s.revoked !== true && (tsMs(s.expiresAt) || 0) > now)
    .sort((a, b) => (tsMs(b.createdAt) || 0) - (tsMs(a.createdAt) || 0));
}

// ===========================================================================
// Giriş: panel açılırken yetki ve durum sunucudan alınır
// ===========================================================================

export const staffSignIn = onCall(async (req) => {
  const { uid, email } = requireAuth(req);
  if (!email) throw new HttpsError('permission-denied', 'NOT_STAFF');
  await rateLimit(`staffsignin:${uid}`, 30, 3600);
  await ensureTeamSeeded();
  if (isSuperAdminEmail(email)) {
    if (req.auth?.token.email_verified !== true) throw new HttpsError('permission-denied', 'EMAIL_NOT_VERIFIED');
    return { superAdmin: true, positionName: null, perms: [], name: String(req.auth?.token.name || '') };
  }
  if (req.auth?.token.email_verified !== true) throw new HttpsError('permission-denied', 'EMAIL_NOT_VERIFIED');
  const ref = MEMBERS().doc(email);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('permission-denied', 'NOT_STAFF');
  const d = snap.data()!;
  if (d.status === 'suspended') throw new HttpsError('permission-denied', 'SUSPENDED');
  const update: Record<string, unknown> = { uid, lastLoginAt: FieldValue.serverTimestamp() };
  if (d.status === 'invited') { update.status = 'active'; update.activatedAt = FieldValue.serverTimestamp(); }
  await ref.set(update, { merge: true });
  const access = await getAccess(req);
  const pos = d.positionId ? await POSITIONS().doc(d.positionId).get() : null;
  return { superAdmin: false, positionName: pos?.get('name') || null, perms: access ? [...access.perms] : [], name: d.name || '' };
});

// ===========================================================================
// Ekip listesi ve pozisyonlar
// ===========================================================================

async function positionsWithCounts() {
  const [pos, mem] = await Promise.all([POSITIONS().get(), MEMBERS().get()]);
  const members = mem.docs.map((d) => ({ email: d.id, ...d.data() })) as ({ email: string } & FirebaseFirestore.DocumentData)[];
  return pos.docs.map((p) => {
    const perms: string[] = Array.isArray(p.get('perms')) ? p.get('perms') : [];
    const ms = members.filter((m) => m.positionId === p.id);
    return {
      id: p.id,
      name: p.get('name') || p.id,
      description: p.get('description') || '',
      perms,
      builtin: p.get('builtin') === true,
      critical: perms.filter((x) => CRITICAL.has(x)),
      members: ms.map((m) => ({ email: m.email, name: m.name || '' })),
      updatedAt: tsMs(p.get('updatedAt')),
    };
  }).sort((a, b) => Number(b.builtin) - Number(a.builtin) || a.name.localeCompare(b.name, 'tr'));
}

export const adminTeamOverview = onCall(async (req) => {
  await requireSuperAdmin(req);
  await ensureTeamSeeded();
  const [positions, mem] = await Promise.all([positionsWithCounts(), MEMBERS().get()]);
  const posName = new Map(positions.map((p) => [p.id, p.name]));
  const rows = await Promise.all([
    ...SUPER_ADMIN_EMAILS.map(async (email) => {
      const uid = await uidOfEmail(email);
      const [user, prof, sessions] = await Promise.all([
        uid ? getAuth().getUser(uid).catch(() => null) : Promise.resolve(null),
        uid ? db().collection('admin_profiles').doc(uid).get() : Promise.resolve(null),
        activeSessions(email, uid),
      ]);
      return {
        email, name: (prof?.get('displayName') as string) || user?.displayName || '', superAdmin: true, positionId: null, positionName: null,
        status: 'active', lastLoginAt: user?.metadata?.lastSignInTime ? Date.parse(user.metadata.lastSignInTime) : null, sessions: sessions.length, invitedAt: null,
      };
    }),
    ...mem.docs.filter((d) => !isSuperAdminEmail(d.id)).map(async (d) => {
      const x = d.data();
      const uid = typeof x.uid === 'string' ? x.uid : null;
      const [prof, sessions] = await Promise.all([
        uid ? db().collection('admin_profiles').doc(uid).get() : Promise.resolve(null),
        activeSessions(d.id, uid),
      ]);
      const status = x.status || (x.isActive === false ? 'suspended' : 'active');
      return {
        email: d.id, name: (prof?.get('displayName') as string) || x.name || '', superAdmin: false, positionId: x.positionId || null,
        positionName: (x.positionId && posName.get(x.positionId)) || null, status,
        lastLoginAt: tsMs(x.lastLoginAt), sessions: sessions.length, invitedAt: tsMs(x.invitedAt) || tsMs(x.createdAt),
      };
    }),
  ]);
  const order = (r: { superAdmin: boolean; status: string }) => (r.superAdmin ? 0 : r.status === 'active' ? 1 : r.status === 'invited' ? 2 : 3);
  rows.sort((a, b) => order(a) - order(b) || (a.name || a.email).localeCompare(b.name || b.email, 'tr'));
  return { members: rows, positions, limits: DAILY_LIMITS };
});

export const adminTeamMember = onCall(async (req) => {
  await requireSuperAdmin(req);
  const email = cleanEmail(req.data?.email);
  const superAdmin = isSuperAdminEmail(email);
  const snap = await MEMBERS().doc(email).get();
  if (!superAdmin && !snap.exists) throw new HttpsError('not-found', 'Bu kişi ekipte değil.');
  const x = snap.data() || {};
  const uid = await uidOfEmail(email, x.uid);
  const [prof, sessions, pos, usage, overrides, events, audits, access] = await Promise.all([
    uid ? db().collection('admin_profiles').doc(uid).get() : Promise.resolve(null),
    activeSessions(email, uid),
    x.positionId ? POSITIONS().doc(x.positionId).get() : Promise.resolve(null),
    db().collection('critical_usage').doc(`${dayKey()}_${sha256(email).slice(0, 20)}`).get(),
    Promise.all((Object.keys(DAILY_LIMITS) as CriticalKind[]).map((k) => db().collection('critical_overrides').doc(`${dayKey()}_${k}_${sha256(email).slice(0, 20)}`).get())),
    uid ? db().collection('tag_events').where('by', '==', uid).orderBy('at', 'desc').limit(12).get().then((s) => s.docs).catch(() => []) : Promise.resolve([]),
    db().collection('admin_audit').where('actorEmail', '==', email).orderBy('at', 'desc').limit(12).get().then((s) => s.docs).catch(() => []),
    uid ? db().collection('admin_access_log').where('by', '==', uid).orderBy('at', 'desc').limit(8).get().then((s) => s.docs).catch(() => []) : Promise.resolve([]),
  ]);
  const perms: string[] = superAdmin ? [] : (Array.isArray(x.perms) ? x.perms : []);
  const quota = (Object.keys(DAILY_LIMITS) as CriticalKind[]).map((k, i) => ({
    kind: k,
    allowed: superAdmin || perms.includes(k === 'purge' ? 'act.purge' : 'act.user_delete'),
    used: Number(usage.get(k)) || 0,
    limit: DAILY_LIMITS[k],
    lifted: overrides[i].exists,
  }));
  const activity = [
    ...events.map((e) => ({ at: tsMs(e.get('at')), kind: String(e.get('action') || ''), detail: e.get('code') || (Array.isArray(e.get('batchIds')) ? `${e.get('count') || ''} QR · ${(e.get('batchIds') as string[]).join(', ')}` : '') })),
    ...audits.map((e) => ({ at: tsMs(e.get('at')), kind: String(e.get('action') || ''), detail: String(e.get('targetMasked') || e.get('targetEmail') || e.get('positionName') || '') })),
    ...access.map((e) => ({ at: tsMs(e.get('at')), kind: `viewed_${e.get('kind')}`, detail: '' })),
  ].sort((a, b) => (b.at || 0) - (a.at || 0)).slice(0, 15);
  return {
    email,
    name: (prof?.get('displayName') as string) || x.name || '',
    superAdmin,
    status: superAdmin ? 'active' : (x.status || 'active'),
    positionId: x.positionId || null,
    positionName: pos?.get('name') || null,
    perms,
    invitedBy: x.invitedBy || null,
    invitedAt: tsMs(x.invitedAt) || tsMs(x.createdAt),
    lastLoginAt: tsMs(x.lastLoginAt),
    sessions: sessions.map((s) => ({ id: s.id, device: s.device || '', createdAt: tsMs(s.createdAt), lastActiveAt: tsMs(s.lastActiveAt) })),
    quota,
    activity,
  };
});

export const adminTeamAddMember = onCall(async (req) => {
  const a = await requireSuperAdmin(req);
  await ensureTeamSeeded();
  const email = cleanEmail(req.data?.email);
  guardNotSuper(email);
  const positionId = typeof req.data?.positionId === 'string' ? req.data.positionId : '';
  const pos = positionId ? await POSITIONS().doc(positionId).get() : null;
  if (!pos?.exists) throw new HttpsError('invalid-argument', 'Bir pozisyon seçin.');
  const ref = MEMBERS().doc(email);
  await db().runTransaction(async (tx) => {
    const s = await tx.get(ref);
    if (s.exists) throw new HttpsError('already-exists', 'Bu e-posta zaten ekipte.');
    tx.set(ref, {
      email, name: '', positionId, perms: normalizePerms(pos.get('perms')), status: 'invited',
      invitedBy: a.email, invitedAt: FieldValue.serverTimestamp(), createdAt: new Date().toISOString(),
      role: null, isActive: true,
    });
  });
  await audit(a, 'team_member_added', { targetEmail: email, positionId, positionName: pos.get('name') });
  return { ok: true };
});

export const adminTeamUpdateMember = onCall(async (req) => {
  const a = await requireSuperAdmin(req);
  const email = cleanEmail(req.data?.email);
  guardNotSuper(email);
  const ref = MEMBERS().doc(email);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', 'Bu kişi ekipte değil.');
  const x = snap.data()!;
  const update: Record<string, unknown> = {};
  const log: Record<string, unknown> = { targetEmail: email };
  if (req.data?.positionId !== undefined) {
    const pos = await POSITIONS().doc(String(req.data.positionId)).get();
    if (!pos.exists) throw new HttpsError('invalid-argument', 'Pozisyon bulunamadı.');
    update.positionId = pos.id;
    update.perms = normalizePerms(pos.get('perms'));
    log.positionId = pos.id; log.positionName = pos.get('name'); log.fromPositionId = x.positionId || null;
  }
  let revoke = false;
  if (req.data?.status !== undefined) {
    const st = req.data.status;
    if (st !== 'active' && st !== 'suspended') throw new HttpsError('invalid-argument', 'Geçersiz durum.');
    if (st === 'active' && x.status === 'invited') { /* henüz giriş yapmadı: davet olarak kalır */ }
    else update.status = st;
    update.isActive = st === 'active';
    revoke = st === 'suspended';
    log.status = st;
  }
  if (!Object.keys(update).length) return { ok: true };
  update.updatedAt = FieldValue.serverTimestamp();
  await ref.set(update, { merge: true });
  let closed = 0;
  if (revoke) closed = await revokeSessions(email, await uidOfEmail(email, x.uid));
  await audit(a, revoke ? 'team_member_suspended' : update.status === 'active' ? 'team_member_reactivated' : 'team_member_updated', { ...log, closedSessions: closed });
  return { ok: true, closedSessions: closed };
});

export const adminTeamRemoveMember = onCall(async (req) => {
  const a = await requireSuperAdmin(req);
  const email = cleanEmail(req.data?.email);
  guardNotSuper(email);
  const ref = MEMBERS().doc(email);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', 'Bu kişi ekipte değil.');
  const x = snap.data()!;
  await ref.delete();
  const closed = await revokeSessions(email, await uidOfEmail(email, x.uid));
  await audit(a, 'team_member_removed', { targetEmail: email, positionId: x.positionId || null, closedSessions: closed });
  return { ok: true, closedSessions: closed };
});

export const adminTeamRevokeSessions = onCall(async (req) => {
  const a = await requireSuperAdmin(req);
  const email = cleanEmail(req.data?.email);
  const sessionId = typeof req.data?.sessionId === 'string' && /^[A-Za-z0-9_-]{1,80}$/.test(req.data.sessionId) ? req.data.sessionId : undefined;
  if (email === a.email && !sessionId) throw new HttpsError('failed-precondition', 'Kendi oturumlarınızı Profil ve Ayarlar › Aktif oturumlar bölümünden yönetin.');
  const snap = await MEMBERS().doc(email).get();
  const closed = await revokeSessions(email, await uidOfEmail(email, snap.get('uid')), sessionId);
  await audit(a, 'team_sessions_revoked', { targetEmail: email, closedSessions: closed, sessionId: sessionId || null });
  return { ok: true, closedSessions: closed };
});

// ------------------------------------------------------------------ pozisyonlar

export const adminTeamSavePosition = onCall(async (req) => {
  const a = await requireSuperAdmin(req);
  await ensureTeamSeeded();
  const id = typeof req.data?.id === 'string' && req.data.id ? req.data.id : null;
  const name = typeof req.data?.name === 'string' ? req.data.name.replace(/\s+/g, ' ').trim() : '';
  if (name.length < 2 || name.length > 40) throw new HttpsError('invalid-argument', 'Pozisyon adı 2-40 karakter olmalı.');
  const description = typeof req.data?.description === 'string' ? req.data.description.replace(/\s+/g, ' ').trim().slice(0, 120) : '';
  const perms = normalizePerms(req.data?.perms);
  const all = await POSITIONS().get();
  if (all.docs.some((d) => d.id !== id && String(d.get('name') || '').toLocaleLowerCase('tr-TR') === name.toLocaleLowerCase('tr-TR'))) {
    throw new HttpsError('already-exists', 'Bu adda bir pozisyon zaten var.');
  }
  const ref = id ? POSITIONS().doc(id) : POSITIONS().doc();
  const before = id ? await ref.get() : null;
  if (id && !before?.exists) throw new HttpsError('not-found', 'Pozisyon bulunamadı.');
  const members = id ? await MEMBERS().where('positionId', '==', id).get() : null;
  const batch = db().batch();
  batch.set(ref, {
    name, description, perms, builtin: before?.get('builtin') === true,
    updatedAt: FieldValue.serverTimestamp(), updatedBy: a.email,
    ...(before ? {} : { createdAt: FieldValue.serverTimestamp(), createdBy: a.email }),
  }, { merge: true });
  // Bu pozisyondaki herkesin yetkisi aynı anda güncellenir.
  members?.docs.forEach((m) => batch.set(m.ref, { perms, updatedAt: FieldValue.serverTimestamp() }, { merge: true }));
  await batch.commit();
  const prev: string[] = before && Array.isArray(before.get('perms')) ? before.get('perms') : [];
  await audit(a, id ? 'team_position_updated' : 'team_position_created', {
    positionId: ref.id, positionName: name,
    added: perms.filter((p) => !prev.includes(p)), removed: prev.filter((p) => !perms.includes(p)),
    affectedMembers: members?.size || 0,
  });
  return { ok: true, id: ref.id, perms, affectedMembers: members?.size || 0 };
});

export const adminTeamDeletePosition = onCall(async (req) => {
  const a = await requireSuperAdmin(req);
  const id = typeof req.data?.id === 'string' ? req.data.id : '';
  const ref = POSITIONS().doc(id || '_');
  const snap = await ref.get();
  if (!id || !snap.exists) throw new HttpsError('not-found', 'Pozisyon bulunamadı.');
  if (snap.get('builtin') === true || BUILTIN_POSITIONS[id]) throw new HttpsError('failed-precondition', 'Hazır pozisyonlar silinemez; yetkilerini değiştirebilirsiniz.');
  const used = await MEMBERS().where('positionId', '==', id).limit(1).get();
  if (!used.empty) throw new HttpsError('failed-precondition', 'Bu pozisyonda ekip üyesi var. Önce onları başka bir pozisyona taşıyın.');
  await ref.delete();
  await audit(a, 'team_position_deleted', { positionId: id, positionName: snap.get('name') });
  return { ok: true };
});

// ------------------------------------------------------------------ kritik işlem kısıtı

/** Süper yönetici bir kişinin bugünkü kritik işlem sınırını kaldırır (bildirimden). */
export const adminLiftLimit = onCall(async (req) => {
  const a = await requireSuperAdmin(req);
  const email = cleanEmail(req.data?.email);
  const kind = req.data?.kind as CriticalKind;
  if (!Object.prototype.hasOwnProperty.call(DAILY_LIMITS, kind)) throw new HttpsError('invalid-argument', 'Geçersiz işlem türü.');
  const day = dayKey();
  const id = `${day}_${kind}_${sha256(email).slice(0, 20)}`;
  await db().collection('critical_overrides').doc(id).set({ email, kind, day, liftedBy: a.email, at: FieldValue.serverTimestamp() });
  await db().collection('admin_notifications').doc(`limit_${id}`).set({ resolved: true, resolvedBy: a.email, resolvedAt: FieldValue.serverTimestamp() }, { merge: true });
  await audit(a, 'critical_limit_lifted', { targetEmail: email, kind, day });
  return { ok: true };
});

/** Kişinin kendi bugünkü kritik işlem hakkı (silme pencerelerinde gösterilir) */
export const adminMyQuota = onCall(async (req) => {
  const a = await requireAnyStaff(req);
  const kind = req.data?.kind as CriticalKind;
  if (!Object.prototype.hasOwnProperty.call(DAILY_LIMITS, kind)) throw new HttpsError('invalid-argument', 'Geçersiz işlem türü.');
  return getQuota(a, kind);
});

export { Timestamp };
