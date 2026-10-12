/**
 * Bildirimler sayfası uçları.
 *  - Herkes: kendi kutusunu okundu yapar, temizler, görevi "Tamamlandı" işaretler.
 *  - Süper yönetici: ekibe bildirim / görev gönderir, gönderdiklerini (kim okudu, kim tamamladı) görür.
 * Okuma istemcide doğrudan Firestore'dan (yalnızca kendi kutusu); bütün yazmalar burada.
 */

import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { SUPER_ADMIN_EMAILS } from './config';
import { db, rateLimit } from './helpers';
import { MEMBERS, POSITIONS, audit, ensureTeamSeeded, isSuperAdminEmail, requireAnyStaff, requireSuperAdmin, tsMs } from './permissions';
import { SENDS, baseItem, cleanLink, inboxCol, isProtected, recipientKey } from './inbox';

const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,24}$/i;
const ID_RE = /^[\w-]{1,160}$/;
export const SEND_TITLE_MAX = 120;
export const SEND_BODY_MAX = 500;
export const SEND_MAX_RECIPIENTS = 300;

/** Tek satırlık metin: kontrol karakterleri ve fazla boşluk temizlenir */
function oneLine(v: unknown): string {
  return typeof v === 'string' ? v.replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim() : '';
}
/** Çok satırlı metin: satır sonları korunur, en fazla iki boş satır */
function multiLine(v: unknown): string {
  if (typeof v !== 'string') return '';
  return v.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, ' ')
    .split('\n').map((l) => l.replace(/[ \t]+/g, ' ').trim()).join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

// ===========================================================================
// Kendi kutusu
// ===========================================================================

/** Bildirimler sayfası açılınca: okunmamışların hepsi okundu olur (zildeki sayaç sıfırlanır). */
export const adminInboxMarkRead = onCall(async (req) => {
  const a = await requireAnyStaff(req);
  await rateLimit(`inboxread:${a.uid}`, 600, 3600);
  const snap = await inboxCol(a.email).where('readAt', '==', null).limit(200).get();
  if (snap.empty) return { marked: 0, more: false };
  const now = Timestamp.now();
  const batch = db().batch();
  const key = recipientKey(a.email);
  const sends = new Set<string>();
  for (const d of snap.docs) {
    batch.update(d.ref, { readAt: now });
    const sid = d.get('sendId');
    if (typeof sid === 'string' && sid) sends.add(sid);
  }
  // Gönderen "kim okudu" listesinde görür
  // Alan yolu ile yalnızca bu kişinin satırı güncellenir (kayıt yoksa atlanır; toplu yazma bozulmasın)
  if (sends.size) {
    const refs = [...sends].map((sid) => SENDS().doc(sid));
    const found = await db().getAll(...refs);
    found.forEach((f, i) => { if (f.exists) batch.update(refs[i], { [`recipients.${key}.readAt`]: now }); });
  }
  await batch.commit();
  return { marked: snap.size, more: snap.size === 200 };
});

/**
 * Temizleme. ids verilirse yalnızca onlar, verilmezse okunmuş bütün bildirimler.
 * Okunmamış, tamamlanmamış görev ve bugün karar bekleyen sınır bildirimi silinmez.
 */
export const adminInboxClear = onCall(async (req) => {
  const a = await requireAnyStaff(req);
  await rateLimit(`inboxclear:${a.uid}`, 120, 3600);
  const col = inboxCol(a.email);
  let docs: FirebaseFirestore.DocumentSnapshot[];
  if (req.data?.ids !== undefined) {
    const ids = req.data.ids;
    if (!Array.isArray(ids) || ids.length < 1 || ids.length > 100 || !ids.every((x) => typeof x === 'string' && ID_RE.test(x))) {
      throw new HttpsError('invalid-argument', 'Geçersiz bildirim listesi.');
    }
    docs = await db().getAll(...[...new Set(ids as string[])].map((id) => col.doc(id)));
  } else {
    docs = (await col.orderBy('createdAt', 'desc').limit(500).get()).docs;
  }
  const kept = { unread: 0, task: 0, limit: 0 };
  const del: FirebaseFirestore.DocumentReference[] = [];
  for (const d of docs) {
    if (!d.exists) continue;
    const p = isProtected(d.data()!);
    if (p) kept[p] += 1;
    else del.push(d.ref);
  }
  for (let i = 0; i < del.length; i += 400) {
    const b = db().batch();
    del.slice(i, i + 400).forEach((r) => b.delete(r));
    await b.commit();
  }
  return { removed: del.length, kept };
});

/** Görevi tamamlandı işaretler; gönderen Gönderdiklerim'de görür. Geri alınamaz. */
export const adminInboxTaskDone = onCall(async (req) => {
  const a = await requireAnyStaff(req);
  const id = req.data?.id;
  if (typeof id !== 'string' || !ID_RE.test(id)) throw new HttpsError('invalid-argument', 'Geçersiz bildirim.');
  const ref = inboxCol(a.email).doc(id);
  const s = await ref.get();
  if (!s.exists) throw new HttpsError('not-found', 'Bildirim bulunamadı.');
  if (s.get('kind') !== 'task') throw new HttpsError('failed-precondition', 'Bu bildirim bir görev değil.');
  if (s.get('doneAt')) return { ok: true, already: true };
  const now = Timestamp.now();
  const wasUnread = !s.get('readAt');
  const batch = db().batch();
  batch.update(ref, { doneAt: now, ...(wasUnread ? { readAt: now } : {}) });
  const sid = s.get('sendId');
  if (typeof sid === 'string' && sid && (await SENDS().doc(sid).get()).exists) {
    const k = recipientKey(a.email);
    batch.update(SENDS().doc(sid), { [`recipients.${k}.doneAt`]: now, ...(wasUnread ? { [`recipients.${k}.readAt`]: now } : {}) });
  }
  await batch.commit();
  await audit(a, 'task_done', { sendId: sid || null, title: s.get('title') || '' });
  return { ok: true, already: false };
});

// ===========================================================================
// Süper yönetici: bildirim gönder
// ===========================================================================

type Recipient = { email: string; name: string; positionName: string | null };

async function superName(email: string): Promise<string> {
  try {
    const u = await getAuth().getUserByEmail(email);
    const prof = await db().collection('admin_profiles').doc(u.uid).get();
    return (prof.get('displayName') as string) || u.displayName || '';
  } catch {
    return '';
  }
}

export const adminSendNotification = onCall(async (req) => {
  const a = await requireSuperAdmin(req);
  const d = req.data || {};
  const title = oneLine(d.title);
  if (title.length < 3 || title.length > SEND_TITLE_MAX) throw new HttpsError('invalid-argument', `Başlık 3-${SEND_TITLE_MAX} karakter olmalı.`);
  const body = multiLine(d.body);
  if (body.length > SEND_BODY_MAX) throw new HttpsError('invalid-argument', `Mesaj en fazla ${SEND_BODY_MAX} karakter olabilir.`);
  const task = d.task === true;
  let link = null;
  if (d.link !== undefined && d.link !== null) {
    link = cleanLink(d.link);
    if (!link || link.section === 'batch') throw new HttpsError('invalid-argument', 'Geçersiz sayfa bağlantısı.');
    link = { section: link.section };
  }
  const mode = d.mode;
  if (mode !== 'people' && mode !== 'positions' && mode !== 'all') throw new HttpsError('invalid-argument', 'Alıcı seçin.');
  await ensureTeamSeeded();

  const [memSnap, posSnap] = await Promise.all([MEMBERS().get(), POSITIONS().get()]);
  const posName = new Map(posSnap.docs.map((p) => [p.id, String(p.get('name') || p.id)]));
  // Gönderilebilecek ekip üyeleri: etkin ya da davetli (askıdakiler panele giremez)
  const eligible = new Map<string, FirebaseFirestore.DocumentData>();
  for (const m of memSnap.docs) {
    if (isSuperAdminEmail(m.id)) continue;
    const x = m.data();
    const status = x.status || (x.isActive === false ? 'suspended' : 'active');
    if (status === 'active' || status === 'invited') eligible.set(m.id, x);
  }
  const chosen = new Map<string, FirebaseFirestore.DocumentData | 'super'>();
  const self = a.email.toLowerCase();
  let positionIds: string[] = [];
  if (mode === 'people') {
    const emails = d.emails;
    if (!Array.isArray(emails) || emails.length < 1 || emails.length > 100) throw new HttpsError('invalid-argument', 'En az bir kişi seçin.');
    for (const raw of emails) {
      const e = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
      if (!EMAIL_RE.test(e)) throw new HttpsError('invalid-argument', 'Geçersiz e-posta.');
      if (e === self) continue;
      if (isSuperAdminEmail(e)) chosen.set(e, 'super');
      else if (eligible.has(e)) chosen.set(e, eligible.get(e)!);
      else throw new HttpsError('failed-precondition', `${e} ekipte değil ya da askıda.`);
    }
  } else if (mode === 'positions') {
    const ids = d.positionIds;
    if (!Array.isArray(ids) || ids.length < 1 || ids.length > 20 || !ids.every((x) => typeof x === 'string' && ID_RE.test(x))) {
      throw new HttpsError('invalid-argument', 'En az bir pozisyon seçin.');
    }
    positionIds = [...new Set(ids as string[])];
    for (const id of positionIds) if (!posName.has(id)) throw new HttpsError('not-found', 'Pozisyon bulunamadı.');
    for (const [e, x] of eligible) if (positionIds.includes(x.positionId)) chosen.set(e, x);
  } else {
    for (const [e, x] of eligible) chosen.set(e, x);
    for (const e of SUPER_ADMIN_EMAILS) if (e.toLowerCase() !== self) chosen.set(e.toLowerCase(), 'super');
  }
  chosen.delete(self);
  if (chosen.size === 0) throw new HttpsError('failed-precondition', 'Seçtiğiniz grupta bildirim gönderilecek etkin kimse yok.');
  if (chosen.size > SEND_MAX_RECIPIENTS) throw new HttpsError('invalid-argument', `Bir bildirim en fazla ${SEND_MAX_RECIPIENTS} kişiye gönderilebilir.`);

  // Hız sınırı yalnızca geçerli gönderimleri sayar
  await rateLimit(`notifysend:${a.uid}`, 30, 3600, 'Bir saatte en fazla 30 bildirim gönderebilirsiniz.');

  // Alıcı adları (profil adı > kayıttaki ad)
  const memberUids = [...chosen.entries()].filter(([, x]) => x !== 'super' && typeof (x as FirebaseFirestore.DocumentData).uid === 'string')
    .map(([e, x]) => [e, (x as FirebaseFirestore.DocumentData).uid as string] as const);
  const profs = memberUids.length ? await db().getAll(...memberUids.map(([, uid]) => db().collection('admin_profiles').doc(uid))) : [];
  const profName = new Map(memberUids.map(([e], i) => [e, (profs[i]?.get('displayName') as string) || '']));
  const recipients: Recipient[] = await Promise.all([...chosen.entries()].map(async ([email, x]) => (x === 'super'
    ? { email, name: await superName(email), positionName: null }
    : { email, name: profName.get(email) || String(x.name || ''), positionName: (x.positionId && posName.get(x.positionId)) || null })));

  const actorName = a.name || (await superName(a.email)) || a.email.split('@')[0];
  const positionNames = positionIds.map((id) => posName.get(id)!);
  const sendRef = SENDS().doc();
  const recMap: Record<string, unknown> = {};
  for (const r of recipients) recMap[recipientKey(r.email)] = { email: r.email, name: r.name, positionName: r.positionName, readAt: null, doneAt: null };
  await sendRef.set({
    by: a.email, byName: actorName, title, body, link, task, mode, positionIds, positionNames,
    count: recipients.length, recipients: recMap, createdAt: FieldValue.serverTimestamp(),
  });
  const item = baseItem(task ? 'task' : 'message', {
    title, body, actorEmail: a.email, actorName, link, sendId: sendRef.id,
    data: { mode, positionNames, count: recipients.length },
  });
  for (let i = 0; i < recipients.length; i += 400) {
    const b = db().batch();
    recipients.slice(i, i + 400).forEach((r) => b.set(inboxCol(r.email).doc(sendRef.id), item));
    await b.commit();
  }
  await audit(a, 'notification_sent', { sendId: sendRef.id, task, mode, count: recipients.length, title });
  return { ok: true, sendId: sendRef.id, count: recipients.length };
});

/** Gönderdiklerim: iki süper yöneticinin gönderdikleri birlikte, yeniden eskiye */
export const adminListSent = onCall(async (req) => {
  await requireSuperAdmin(req);
  const PAGE = 20;
  let q = SENDS().orderBy('createdAt', 'desc').limit(PAGE);
  const before = req.data?.before;
  if (before !== undefined && before !== null) {
    if (typeof before !== 'number' || !Number.isFinite(before)) throw new HttpsError('invalid-argument', 'Geçersiz sayfa.');
    q = q.where('createdAt', '<', Timestamp.fromMillis(before));
  }
  const snap = await q.get();
  const items = snap.docs.map((s) => {
    const x = s.data();
    const recipients = Object.values((x.recipients || {}) as Record<string, Record<string, unknown>>).map((r) => ({
      email: String(r.email || ''), name: String(r.name || ''), positionName: (r.positionName as string) || null,
      readAt: tsMs(r.readAt), doneAt: tsMs(r.doneAt),
    })).sort((p, n) => (p.name || p.email).localeCompare(n.name || n.email, 'tr'));
    return {
      id: s.id, by: x.by || '', byName: x.byName || '', title: x.title || '', body: x.body || '', link: x.link || null,
      task: x.task === true, mode: x.mode || 'people', positionNames: Array.isArray(x.positionNames) ? x.positionNames : [],
      count: recipients.length, createdAt: tsMs(x.createdAt),
      readCount: recipients.filter((r) => r.readAt).length, doneCount: recipients.filter((r) => r.doneAt).length,
      recipients,
    };
  });
  const last = items[items.length - 1];
  return { items, next: items.length === PAGE && last?.createdAt ? last.createdAt : null };
});

// ===========================================================================
// Gece: 90 günü dolan bildirimler silinir
// ===========================================================================

export async function purgeExpiredInbox(now = Date.now(), maxRounds = 25): Promise<number> {
  let total = 0;
  for (let i = 0; i < maxRounds; i++) {
    const snap = await db().collectionGroup('inbox_items').where('expiresAt', '<', Timestamp.fromMillis(now)).limit(400).get();
    if (snap.empty) break;
    const b = db().batch();
    snap.docs.forEach((d) => b.delete(d.ref));
    await b.commit();
    total += snap.size;
    if (snap.size < 400) break;
  }
  return total;
}

export const nightlyInboxCleanup = onSchedule(
  { schedule: '20 4 * * *', timeZone: 'Europe/Istanbul', timeoutSeconds: 300 },
  async () => {
    const n = await purgeExpiredInbox();
    console.log(`[inbox] ${n} eski bildirim silindi`);
  },
);

