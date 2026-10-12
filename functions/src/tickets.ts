/**
 * Destek talepleri (istek, şikayet, öneri, soru) ve QR sayfasından gelen kötüye kullanım bildirimleri.
 *
 * Veri:
 *   tickets/{id}                 Müşterinin de okuyabildiği alanlar (numara, durum, başlık, son hareket…)
 *   tickets/{id}/messages/{m}    Müşteriye açık yazışma + durum olayları
 *   tickets/{id}/notes/{n}       Yalnızca ekibin gördüğü iç notlar ve atama olayları
 *   ticket_staff/{id}            Yalnızca ekip: sorumlu, öncelik, hedef süreler, müşteri e-postası
 *   ticket_files/{id}            Fotoğraflar (istemcide küçültülmüş JPEG; konum bilgisi sunucuda da silinir)
 *   ticket_templates/{id}        Hazır yanıtlar
 *   abuse_reports/{id}           Kötüye kullanım bildirimleri (girişsiz ziyaretçi)
 *
 * Hedef süreler: ilk yanıt 24 saat, çözüm 72 saat (müşteriden bilgi beklenirken süre durur).
 * Çözülen talep 3 gün sonra kendiliğinden kapanır; kapanan talep 2 yıl sonra silinir.
 */

import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { SUPER_ADMIN_EMAILS } from './config';
import { clientIp, db, parseCode, rateLimit, requireAuth, sha256, yearMonthIstanbul } from './helpers';
import { MEMBERS, StaffAccess, audit, isSuperAdminEmail, requirePerm, tsMs } from './permissions';
import { notify, staffWithPerm } from './inbox';
import { maskEmail } from './directory';
import { sendPushToUser } from './push';

// ---------------------------------------------------------------------------
// Sabitler
// ---------------------------------------------------------------------------

export const TICKET_TYPES = ['request', 'complaint', 'suggestion', 'question'] as const;
export type TicketType = (typeof TICKET_TYPES)[number];
export const TYPE_TR: Record<TicketType, string> = { request: 'İstek', complaint: 'Şikayet', suggestion: 'Öneri', question: 'Soru' };

export const TOPICS: Record<string, string> = {
  qr_unreadable: 'QR okunmuyor / sayfa açılmıyor',
  qr_link: 'QR etiketi bağlama',
  notifications: 'Bildirimler',
  account: 'Hesap ve giriş',
  vehicle: 'Araç bilgileri',
  lost: 'Kayıp veya çalıntı etiket',
  privacy: 'Gizlilik ve kişisel veriler',
  purchase: 'Satın alma ve etiket temini',
  other: 'Diğer',
};

export const STATUSES = ['new', 'in_review', 'waiting_customer', 'resolved', 'closed'] as const;
export type TicketStatus = (typeof STATUSES)[number];
export const OPEN: TicketStatus[] = ['new', 'in_review', 'waiting_customer'];

const H = 3600e3;
export const FIRST_RESPONSE_MS = 24 * H;
export const RESOLVE_MS = 72 * H;
export const AUTO_CLOSE_MS = 72 * H;
export const RETENTION_MS = 730 * 24 * H;
const WARN_BEFORE_MS = 2 * H;

export const LIMITS = {
  titleMin: 5, titleMax: 120, bodyMin: 10, bodyMax: 1000, replyMax: 2000, attachMax: 4,
  fileMaxChars: 720_000, thumbMaxChars: 48_000, openMax: 5, commentMax: 500, noteMax: 300,
};

export const ABUSE_REASONS: Record<string, string> = {
  wrong_vehicle: 'QR etiketi başka bir araca yapıştırılmış',
  fake: 'QR etiketi sahte veya kopya görünüyor',
  harassment: 'Rahatsız edici kullanım',
  other: 'Diğer',
};

export const TICKETS = () => db().collection('tickets');
export const STAFF = () => db().collection('ticket_staff');
export const FILES = () => db().collection('ticket_files');
export const TEMPLATES = () => db().collection('ticket_templates');
export const ABUSE = () => db().collection('abuse_reports');

const ID_RE = /^[\w-]{1,64}$/;

// ---------------------------------------------------------------------------
// Yardımcılar
// ---------------------------------------------------------------------------

function cleanLine(v: unknown, max: number): string {
  return typeof v === 'string' ? v.replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max + 1) : '';
}
function cleanText(v: unknown, max: number): string {
  if (typeof v !== 'string') return '';
  return v.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, ' ')
    .split('\n').map((l) => l.replace(/[ \t]+/g, ' ').trim()).join('\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, max + 1);
}
function idOf(v: unknown, what = 'Talep'): string {
  if (typeof v !== 'string' || !ID_RE.test(v)) throw new HttpsError('invalid-argument', `${what} bulunamadı.`);
  return v;
}
const displayName = (a: { name?: string; email: string }) => (a.name || '').trim() || a.email.split('@')[0];

/** JPEG mi? (FF D8 … FF D9) ve EXIF/konum (APP1) bölümleri çıkarılmış hali */
export function stripJpeg(buf: Buffer): Buffer | null {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  const out: Buffer[] = [buf.subarray(0, 2)];
  let i = 2;
  while (i + 4 <= buf.length) {
    if (buf[i] !== 0xff) return null;
    const marker = buf[i + 1];
    if (marker === 0xda) { out.push(buf.subarray(i)); return Buffer.concat(out); } // görüntü verisi başladı
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { out.push(buf.subarray(i, i + 2)); i += 2; continue; }
    const len = buf.readUInt16BE(i + 2);
    if (len < 2 || i + 2 + len > buf.length) return null;
    // APP1 (EXIF/XMP: konum, cihaz bilgisi) ve APP2-APP15 atılır; JFIF (APP0) ve tablolar kalır
    if (!(marker >= 0xe1 && marker <= 0xef)) out.push(buf.subarray(i, i + 2 + len));
    i += 2 + len;
  }
  return null;
}

function decodeImage(b64: unknown, maxChars: number, what: string): string {
  if (typeof b64 !== 'string' || b64.length < 100 || b64.length > maxChars || !/^[A-Za-z0-9+/]+={0,2}$/.test(b64)) {
    throw new HttpsError('invalid-argument', `${what} geçersiz ya da çok büyük.`);
  }
  const clean = stripJpeg(Buffer.from(b64, 'base64'));
  if (!clean) throw new HttpsError('invalid-argument', `${what} JPEG biçiminde olmalı.`);
  return clean.toString('base64');
}

async function nextTicketNo(): Promise<string> {
  const ym = yearMonthIstanbul();
  const ref = db().collection('counters').doc(`tickets_${ym}`);
  const n = await db().runTransaction(async (tx) => {
    const s = await tx.get(ref);
    const v = (Number(s.get('value')) || 0) + 1;
    tx.set(ref, { value: v }, { merge: true });
    return v;
  });
  return `TLP-${ym}-${String(n).padStart(4, '0')}`;
}

type Attachment = { id: string; w: number; h: number; thumb: string };

/** Yüklenen fotoğrafları talebe bağlar (yalnızca yükleyen kişinin, 24 saat içinde yüklediği, bağlanmamış dosyalar). */
async function attachFiles(ids: unknown, uploaderUid: string, ticketId: string, ownerUid: string): Promise<Attachment[]> {
  if (ids === undefined || ids === null) return [];
  if (!Array.isArray(ids) || ids.length > LIMITS.attachMax || !ids.every((x) => typeof x === 'string' && ID_RE.test(x))) {
    throw new HttpsError('invalid-argument', `En fazla ${LIMITS.attachMax} görsel eklenebilir.`);
  }
  const uniq = [...new Set(ids as string[])];
  if (!uniq.length) return [];
  const snaps = await db().getAll(...uniq.map((id) => FILES().doc(id)));
  const out: Attachment[] = [];
  for (const s of snaps) {
    const d = s.data();
    if (!s.exists || !d || d.uploaderUid !== uploaderUid || d.attached === true || (tsMs(d.createdAt) || 0) < Date.now() - 24 * H) {
      throw new HttpsError('failed-precondition', 'Görsellerden biri yüklenemedi; lütfen yeniden ekleyin.');
    }
    out.push({ id: s.id, w: Number(d.w) || 0, h: Number(d.h) || 0, thumb: String(d.thumb || '') });
  }
  const b = db().batch();
  for (const a of out) b.update(FILES().doc(a.id), { attached: true, ticketId, ownerUid, attachedAt: FieldValue.serverTimestamp() });
  await b.commit();
  return out;
}

/** Durum değişimi + hedef süre duraklatma (müşteriden bilgi beklenirken çözüm süresi durur) */
function statusPatch(staff: FirebaseFirestore.DocumentData, from: TicketStatus, to: TicketStatus, now: number) {
  const pub: Record<string, unknown> = { status: to };
  const st: Record<string, unknown> = {};
  if (from === 'waiting_customer' && to !== 'waiting_customer') {
    const since = tsMs(staff.waitingSince) || now;
    const paused = (Number(staff.pausedMs) || 0) + Math.max(0, now - since);
    st.pausedMs = paused;
    st.waitingSince = null;
    st.resolveDueAt = Timestamp.fromMillis((tsMs(staff.createdAt) || now) + RESOLVE_MS + paused);
  }
  if (to === 'waiting_customer' && from !== 'waiting_customer') st.waitingSince = Timestamp.fromMillis(now);
  if (to === 'resolved') pub.resolvedAt = Timestamp.fromMillis(now);
  if (from === 'resolved' && OPEN.includes(to)) { pub.resolvedAt = null; pub.reopenCount = FieldValue.increment(1); }
  if (to === 'closed') { pub.closedAt = Timestamp.fromMillis(now); st.expiresAt = Timestamp.fromMillis(now + RETENTION_MS); }
  return { pub, st };
}

/** Müşteriye görünür olay satırı */
function eventMsg(event: string, extra: Record<string, unknown> = {}) {
  return { kind: 'event', event, body: '', attachments: [], authorName: '', createdAt: FieldValue.serverTimestamp(), ...extra };
}

/** Talebin sorumlusu varsa ona, yoksa talepleri gören herkese */
async function ticketRecipients(staffDoc: FirebaseFirestore.DocumentData | undefined): Promise<string[] | undefined> {
  const a = staffDoc?.assigneeEmail;
  return typeof a === 'string' && a ? [a] : undefined;
}

function preview(text: string): string {
  const t = text.replace(/\s+/g, ' ').trim();
  return t.length > 140 ? `${t.slice(0, 137)}…` : t;
}

// ===========================================================================
// MÜŞTERİ
// ===========================================================================

/** Fotoğraf yükleme (müşteri ya da ekip). İstemci önce küçültür; burada boyut/biçim denetlenir, konum bilgisi silinir. */
export const ticketUploadFile = onCall(async (req) => {
  const { uid } = requireAuth(req);
  await rateLimit(`ticketfile:${uid}`, 40, 3600, 'Kısa sürede çok fazla görsel yüklendi. Lütfen biraz sonra tekrar deneyin.');
  const data = decodeImage(req.data?.data, LIMITS.fileMaxChars, 'Görsel');
  const thumb = decodeImage(req.data?.thumb, LIMITS.thumbMaxChars, 'Önizleme');
  const w = Math.max(0, Math.min(5000, Math.round(Number(req.data?.w) || 0)));
  const h = Math.max(0, Math.min(5000, Math.round(Number(req.data?.h) || 0)));
  const ref = FILES().doc();
  await ref.set({
    uploaderUid: uid, ownerUid: null, ticketId: null, attached: false, contentType: 'image/jpeg',
    data, thumb, w, h, size: Math.round((data.length * 3) / 4), createdAt: FieldValue.serverTimestamp(),
  });
  return { id: ref.id };
});

export const ticketCreate = onCall(async (req) => {
  const { uid, email } = requireAuth(req);
  const d = req.data || {};
  const type = d.type as TicketType;
  if (!TICKET_TYPES.includes(type)) throw new HttpsError('invalid-argument', 'Talep türünü seçiniz.');
  const topic = typeof d.topic === 'string' && TOPICS[d.topic] ? d.topic : null;
  if (!topic) throw new HttpsError('invalid-argument', 'Konu seçiniz.');
  const title = cleanLine(d.title, LIMITS.titleMax);
  if (title.length < LIMITS.titleMin || title.length > LIMITS.titleMax) throw new HttpsError('invalid-argument', `Başlık ${LIMITS.titleMin}-${LIMITS.titleMax} karakter olmalıdır.`);
  const body = cleanText(d.body, LIMITS.bodyMax);
  if (body.length < LIMITS.bodyMin || body.length > LIMITS.bodyMax) throw new HttpsError('invalid-argument', `Açıklama ${LIMITS.bodyMin}-${LIMITS.bodyMax} karakter olmalıdır.`);

  let vehicle: { id: string; plate: string; brandModel: string; tagCode: string | null; serial: string | null } | null = null;
  if (d.vehicleId !== undefined && d.vehicleId !== null && d.vehicleId !== '') {
    const vid = idOf(d.vehicleId, 'Araç');
    const v = await db().collection('vehicles').doc(vid).get();
    if (!v.exists || v.get('ownerUid') !== uid) throw new HttpsError('not-found', 'Araç bulunamadı.');
    vehicle = { id: vid, plate: String(v.get('plateNumber') || ''), brandModel: String(v.get('brandModel') || ''), tagCode: v.get('tagCode') || null, serial: v.get('tagSerial') || null };
  }
  const open = await TICKETS().where('uid', '==', uid).where('status', 'in', OPEN).count().get();
  if (open.data().count >= LIMITS.openMax) {
    throw new HttpsError('resource-exhausted', `Aynı anda en fazla ${LIMITS.openMax} açık talebiniz olabilir. Mevcut talepleriniz sonuçlandığında yeni talep oluşturabilirsiniz.`);
  }
  await rateLimit(`ticketcreate:${uid}`, 5, 86400, 'Bugün için talep oluşturma sınırına ulaştınız. Lütfen yarın tekrar deneyiniz.');

  const ref = TICKETS().doc();
  const attachments = await attachFiles(d.attachments, uid, ref.id, uid);
  const no = await nextTicketNo();
  const now = Date.now();
  const nowTs = Timestamp.fromMillis(now);
  const userName = String(req.auth?.token.name || '').trim().slice(0, 80);
  const b = db().batch();
  b.set(ref, {
    no, uid, type, topic, title,
    vehicleId: vehicle?.id || null, plate: vehicle?.plate || null, brandModel: vehicle?.brandModel || null,
    tagCode: vehicle?.tagCode || null, serial: vehicle?.serial || null,
    status: 'new', createdAt: nowTs, updatedAt: nowTs, lastActivityAt: nowTs, lastActor: 'customer',
    firstResponseAt: null, resolvedAt: null, closedAt: null, reopenCount: 0, rating: null,
    msgCount: 1, unreadForCustomer: false, preview: preview(body), previewBy: 'customer',
  });
  b.set(STAFF().doc(ref.id), {
    uid, userEmail: (email || '').toLowerCase(), userName, assigneeEmail: null, assigneeName: null, priority: 'normal',
    createdAt: nowTs, firstDueAt: Timestamp.fromMillis(now + FIRST_RESPONSE_MS), resolveDueAt: Timestamp.fromMillis(now + RESOLVE_MS),
    pausedMs: 0, waitingSince: null, unreadForStaff: true, slaWarned: {}, slaBreached: {}, expiresAt: null,
  });
  b.set(ref.collection('messages').doc(), { kind: 'customer', authorUid: uid, authorName: userName || 'Müşteri', body, attachments, createdAt: nowTs });
  await b.commit();
  await notify('ticket_new', {
    title: `Yeni ${TYPE_TR[type].toLocaleLowerCase('tr-TR')}: ${title}`,
    body: `${no} · ${TOPICS[topic]}`,
    actorName: userName || 'Müşteri',
    link: { section: 'tickets', id: ref.id },
    data: { ticketId: ref.id, no, type, topic },
  });
  return { id: ref.id, no };
});

async function ownTicket(uid: string, id: string) {
  const ref = TICKETS().doc(id);
  const [s, st] = await Promise.all([ref.get(), STAFF().doc(id).get()]);
  if (!s.exists || s.get('uid') !== uid) throw new HttpsError('not-found', 'Talep bulunamadı.');
  return { ref, t: s.data()!, staff: st.data() || {} };
}

export const ticketReply = onCall(async (req) => {
  const { uid } = requireAuth(req);
  const id = idOf(req.data?.ticketId);
  const { ref, t, staff } = await ownTicket(uid, id);
  if (t.status === 'closed') throw new HttpsError('failed-precondition', 'Kapatılmış talebe yanıt verilemez. Lütfen yeni bir talep oluşturunuz.');
  const body = cleanText(req.data?.body, LIMITS.bodyMax);
  if (body.length > LIMITS.bodyMax) throw new HttpsError('invalid-argument', `Yanıt en fazla ${LIMITS.bodyMax} karakter olabilir.`);
  await rateLimit(`ticketreply:${uid}`, 60, 3600);
  const attachments = await attachFiles(req.data?.attachments, uid, id, uid);
  if (!body && !attachments.length) throw new HttpsError('invalid-argument', 'Yanıtınızı yazınız ya da görsel ekleyiniz.');
  const now = Date.now();
  const from = t.status as TicketStatus;
  const to: TicketStatus = from === 'new' ? 'new' : 'in_review';
  const { pub, st } = statusPatch(staff, from, to, now);
  const b = db().batch();
  b.set(ref.collection('messages').doc(), { kind: 'customer', authorUid: uid, authorName: staff.userName || 'Müşteri', body, attachments, createdAt: Timestamp.fromMillis(now) });
  if (from === 'resolved') b.set(ref.collection('messages').doc(), eventMsg('reopened', { createdAt: Timestamp.fromMillis(now + 1) }));
  b.update(ref, { ...pub, updatedAt: Timestamp.fromMillis(now), lastActivityAt: Timestamp.fromMillis(now), lastActor: 'customer', msgCount: FieldValue.increment(1), preview: preview(body || 'Görsel eklendi'), previewBy: 'customer' });
  b.set(STAFF().doc(id), { ...st, unreadForStaff: true }, { merge: true });
  await b.commit();
  await notify('ticket_reply', {
    title: from === 'resolved' ? `Talep yeniden açıldı: ${t.title}` : `Müşteri yanıt verdi: ${t.title}`,
    body: t.no, actorName: staff.userName || 'Müşteri', link: { section: 'tickets', id }, data: { ticketId: id, no: t.no },
    to: await ticketRecipients(staff),
  });
  return { ok: true, status: to };
});

export const ticketReopen = onCall(async (req) => {
  const { uid } = requireAuth(req);
  const id = idOf(req.data?.ticketId);
  const { ref, t, staff } = await ownTicket(uid, id);
  if (t.status !== 'resolved') throw new HttpsError('failed-precondition', 'Yalnızca çözülmüş talepler yeniden açılabilir.');
  const now = Date.now();
  const { pub, st } = statusPatch(staff, 'resolved', 'in_review', now);
  const b = db().batch();
  b.set(ref.collection('messages').doc(), eventMsg('reopened', { createdAt: Timestamp.fromMillis(now) }));
  b.update(ref, { ...pub, updatedAt: Timestamp.fromMillis(now), lastActivityAt: Timestamp.fromMillis(now), lastActor: 'customer' });
  b.set(STAFF().doc(id), { ...st, unreadForStaff: true }, { merge: true });
  await b.commit();
  await notify('ticket_reply', {
    title: `Talep yeniden açıldı: ${t.title}`, body: t.no, actorName: staff.userName || 'Müşteri',
    link: { section: 'tickets', id }, data: { ticketId: id, no: t.no }, to: await ticketRecipients(staff),
  });
  return { ok: true };
});

/** Değerlendirme: 1-5 puan + isteğe bağlı görüş. Çözülmüş talep değerlendirilince kapanır. */
export const ticketRate = onCall(async (req) => {
  const { uid } = requireAuth(req);
  const id = idOf(req.data?.ticketId);
  const { ref, t, staff } = await ownTicket(uid, id);
  if (t.status !== 'resolved' && t.status !== 'closed') throw new HttpsError('failed-precondition', 'Talep sonuçlandığında değerlendirme yapabilirsiniz.');
  if (t.rating) throw new HttpsError('already-exists', 'Bu talep için değerlendirmeniz alınmıştır.');
  const score = Number(req.data?.score);
  if (!Number.isInteger(score) || score < 1 || score > 5) throw new HttpsError('invalid-argument', 'Lütfen 1 ile 5 arasında puan veriniz.');
  const comment = cleanText(req.data?.comment, LIMITS.commentMax);
  if (comment.length > LIMITS.commentMax) throw new HttpsError('invalid-argument', `Görüşünüz en fazla ${LIMITS.commentMax} karakter olabilir.`);
  const now = Date.now();
  const patch: Record<string, unknown> = { rating: { score, comment, at: Timestamp.fromMillis(now) }, updatedAt: Timestamp.fromMillis(now) };
  const b = db().batch();
  if (t.status === 'resolved') {
    const { pub, st } = statusPatch(staff, 'resolved', 'closed', now);
    Object.assign(patch, pub);
    b.set(STAFF().doc(id), st, { merge: true });
    b.set(ref.collection('messages').doc(), eventMsg('closed_rated', { createdAt: Timestamp.fromMillis(now) }));
  }
  b.update(ref, patch);
  await b.commit();
  return { ok: true };
});

export const ticketMarkRead = onCall(async (req) => {
  const { uid } = requireAuth(req);
  const id = idOf(req.data?.ticketId);
  const { ref, t } = await ownTicket(uid, id);
  if (t.unreadForCustomer) await ref.update({ unreadForCustomer: false });
  return { ok: true };
});

// ---------------------------------------------------------------------------
// Kötüye kullanım bildirimi (QR sayfası, giriş gerekmez)
// ---------------------------------------------------------------------------

export const reportAbuse = onCall(async (req) => {
  const code = parseCode(req.data?.code);
  if (!code) throw new HttpsError('invalid-argument', 'Geçersiz QR etiketi.');
  const reason = typeof req.data?.reason === 'string' && ABUSE_REASONS[req.data.reason] ? req.data.reason : null;
  if (!reason) throw new HttpsError('invalid-argument', 'Bildirim nedenini seçiniz.');
  const note = cleanText(req.data?.note, LIMITS.noteMax).replace(/(https?:\/\/|www\.)\S+/gi, '[bağlantı kaldırıldı]');
  if (note.length > LIMITS.noteMax) throw new HttpsError('invalid-argument', `Açıklama en fazla ${LIMITS.noteMax} karakter olabilir.`);
  const ip = clientIp(req);
  const busy = 'Kısa süre içinde çok fazla bildirim gönderildi. Lütfen daha sonra tekrar deneyiniz.';
  await rateLimit(`abuse:ip:${ip}`, 5, 3600, busy);
  await rateLimit(`abuse:iptag:${ip}:${code}`, 1, 86400, 'Bu QR etiketi için bildiriminiz alınmıştır.');
  const tag = await db().collection('tags').doc(code).get();
  if (!tag.exists || !tag.get('assignedUserId')) throw new HttpsError('not-found', 'Bu QR etiketi için bildirim yapılamaz.');
  const ref = ABUSE().doc();
  await ref.set({
    code, serial: tag.get('tagId') || null, batchId: tag.get('batchId') || null, vehicleId: tag.get('assignedVehicleId') || null,
    ownerUid: tag.get('assignedUserId'), reason, note, status: 'new', reporterHash: sha256(`abuse:${ip}`).slice(0, 16),
    createdAt: FieldValue.serverTimestamp(), reviewedAt: null, reviewedBy: null, action: null,
  });
  await notify('abuse_report', {
    title: `Kötüye kullanım bildirimi: ${ABUSE_REASONS[reason]}`, body: tag.get('tagId') || code, actorName: 'Ziyaretçi',
    link: { section: 'tickets', tab: 'abuse' }, data: { reportId: ref.id, reason },
  });
  return { ok: true };
});

// ===========================================================================
// YÖNETİM KONSOLU
// ===========================================================================

function slaOf(t: FirebaseFirestore.DocumentData, st: FirebaseFirestore.DocumentData, now = Date.now()) {
  const status = t.status as TicketStatus;
  if (status === 'resolved' || status === 'closed') {
    const created = tsMs(t.createdAt) || now;
    const end = tsMs(t.resolvedAt) || tsMs(t.closedAt) || now;
    return { kind: 'done' as const, dueAt: null, overdue: false, tookMs: Math.max(0, end - created - (Number(st.pausedMs) || 0)) };
  }
  if (!t.firstResponseAt) {
    const due = tsMs(st.firstDueAt) || (tsMs(t.createdAt) || now) + FIRST_RESPONSE_MS;
    return { kind: 'first' as const, dueAt: due, overdue: now > due, tookMs: null };
  }
  if (status === 'waiting_customer') return { kind: 'paused' as const, dueAt: tsMs(st.resolveDueAt), overdue: false, tookMs: null };
  const due = tsMs(st.resolveDueAt) || (tsMs(t.createdAt) || now) + RESOLVE_MS;
  return { kind: 'resolve' as const, dueAt: due, overdue: now > due, tookMs: null };
}

function rowOf(s: FirebaseFirestore.DocumentSnapshot, st: FirebaseFirestore.DocumentData | undefined, now: number) {
  const t = s.data()!;
  const x = st || {};
  return {
    id: s.id, no: t.no, title: t.title, type: t.type, topic: t.topic, status: t.status,
    userName: x.userName || '', userEmail: x.userEmail || '', plate: t.plate || null,
    assignee: x.assigneeEmail ? { email: x.assigneeEmail, name: x.assigneeName || x.assigneeEmail.split('@')[0] } : null,
    priority: x.priority || 'normal', sla: slaOf(t, x, now),
    createdAt: tsMs(t.createdAt), lastActivityAt: tsMs(t.lastActivityAt), lastActor: t.lastActor || 'customer',
    unreadForStaff: x.unreadForStaff === true, msgCount: Number(t.msgCount) || 0, rating: t.rating ? Number(t.rating.score) || null : null,
  };
}

type ListView = 'open' | TicketStatus;

export const adminListTickets = onCall({ timeoutSeconds: 60 }, async (req) => {
  const a = await requirePerm(req, 'view.tickets');
  const d = req.data || {};
  const view: ListView = d.view === undefined ? 'open' : d.view;
  if (view !== 'open' && !STATUSES.includes(view as TicketStatus)) throw new HttpsError('invalid-argument', 'Geçersiz görünüm.');
  const type = d.type && TICKET_TYPES.includes(d.type) ? (d.type as TicketType) : null;
  const assignee: string | null = d.assignee === 'me' ? a.email : d.assignee === 'none' ? 'none' : null;
  const q = typeof d.q === 'string' ? d.q.trim().toLocaleLowerCase('tr-TR').slice(0, 80) : '';
  const now = Date.now();

  let docs: FirebaseFirestore.QueryDocumentSnapshot[] = [];
  const byNo = /^tlp-\d{4}-\d{4}$/i.test(q);
  if (byNo) {
    docs = (await TICKETS().where('no', '==', q.toUpperCase()).limit(1).get()).docs;
  } else if (view === 'open' || OPEN.includes(view as TicketStatus)) {
    const statuses = view === 'open' ? OPEN : [view as TicketStatus];
    docs = (await TICKETS().where('status', 'in', statuses).orderBy('lastActivityAt', 'desc').limit(300).get()).docs;
  } else {
    let qq = TICKETS().where('status', '==', view).orderBy('lastActivityAt', 'desc').limit(q ? 300 : 60);
    if (typeof d.before === 'number' && Number.isFinite(d.before)) qq = qq.where('lastActivityAt', '<', Timestamp.fromMillis(d.before));
    docs = (await qq.get()).docs;
  }
  const staffSnaps = docs.length ? await db().getAll(...docs.map((x) => STAFF().doc(x.id))) : [];
  let rows = docs.map((x, i) => rowOf(x, staffSnaps[i]?.data(), now));
  if (type) rows = rows.filter((r) => r.type === type);
  if (assignee === 'none') rows = rows.filter((r) => !r.assignee);
  else if (assignee) rows = rows.filter((r) => r.assignee?.email === assignee);
  if (q && !byNo) {
    const plateQ = q.replace(/\s+/g, '');
    rows = rows.filter((r) => [r.title, r.userName, r.userEmail, r.no].some((f) => String(f || '').toLocaleLowerCase('tr-TR').includes(q))
      || (r.plate && r.plate.replace(/\s+/g, '').toLocaleLowerCase('tr-TR').includes(plateQ)));
  }
  // Açık görünümlerde süresi geçenler ve yaklaşanlar önde
  if (view === 'open' || OPEN.includes(view as TicketStatus)) {
    rows.sort((x, y) => Number(y.sla.overdue) - Number(x.sla.overdue) || (x.sla.dueAt || Infinity) - (y.sla.dueAt || Infinity));
  }
  const next = (view === 'resolved' || view === 'closed') && !q && docs.length === 60 ? rows[rows.length - 1]?.lastActivityAt || null : null;

  // Sayılar ve özet
  const counts: Record<string, number> = {};
  await Promise.all(STATUSES.map(async (s) => { counts[s] = (await TICKETS().where('status', '==', s).count().get()).data().count; }));
  counts.open = counts.new + counts.in_review + counts.waiting_customer;
  const openDocs = view === 'open' && !byNo ? docs : (await TICKETS().where('status', 'in', OPEN).orderBy('lastActivityAt', 'desc').limit(300).get()).docs;
  const openStaff = openDocs === docs ? staffSnaps : (openDocs.length ? await db().getAll(...openDocs.map((x) => STAFF().doc(x.id))) : []);
  const openRows = openDocs.map((x, i) => rowOf(x, openStaff[i]?.data(), now));
  const since = Timestamp.fromMillis(now - 30 * 24 * H);
  const recent = (await TICKETS().where('createdAt', '>=', since).limit(1000).get()).docs.map((x) => x.data());
  const fr = recent.filter((t) => t.firstResponseAt).map((t) => (tsMs(t.firstResponseAt) || 0) - (tsMs(t.createdAt) || 0)).filter((v) => v >= 0);
  const rated = recent.filter((t) => t.rating && Number(t.rating.score) >= 1).map((t) => Number(t.rating.score));
  return {
    rows: rows.slice(0, 200), next, counts,
    kpis: {
      open: counts.open,
      newCount: counts.new,
      unassigned: openRows.filter((r) => !r.assignee).length,
      mine: openRows.filter((r) => r.assignee?.email === a.email).length,
      overdue: openRows.filter((r) => r.sla.overdue).length,
      avgFirstResponseMs: fr.length ? Math.round(fr.reduce((p, c) => p + c, 0) / fr.length) : null,
      satisfaction: rated.length ? Math.round((rated.reduce((p, c) => p + c, 0) / rated.length) * 10) / 10 : null,
      ratedCount: rated.length,
    },
  };
});

function msgOut(s: FirebaseFirestore.QueryDocumentSnapshot, note = false) {
  const m = s.data();
  return {
    id: s.id, kind: note ? (m.kind === 'event' ? 'staff_event' : 'note') : m.kind, event: m.event || null,
    authorName: m.authorName || '', body: m.body || '', attachments: Array.isArray(m.attachments) ? m.attachments : [],
    data: m.data || null, createdAt: tsMs(m.createdAt),
  };
}

export const adminGetTicket = onCall(async (req) => {
  const a = await requirePerm(req, 'view.tickets');
  const id = idOf(req.data?.id);
  const ref = TICKETS().doc(id);
  const [s, st, msgs, notes] = await Promise.all([
    ref.get(), STAFF().doc(id).get(), ref.collection('messages').orderBy('createdAt', 'asc').limit(400).get(),
    ref.collection('notes').orderBy('createdAt', 'asc').limit(400).get(),
  ]);
  if (!s.exists) throw new HttpsError('not-found', 'Talep bulunamadı.');
  const t = s.data()!;
  const x = st.data() || {};
  const [ui, tag, otherCount] = await Promise.all([
    db().collection('user_index').doc(t.uid).get(),
    t.tagCode ? db().collection('tags').doc(t.tagCode).get() : Promise.resolve(null),
    TICKETS().where('uid', '==', t.uid).count().get(),
  ]);
  if (x.unreadForStaff) await STAFF().doc(id).update({ unreadForStaff: false }).catch(() => undefined);
  await db().collection('admin_access_log').add({ by: a.uid, byEmail: a.email, kind: 'ticket', target: id, at: FieldValue.serverTimestamp() }).catch(() => undefined);
  const u = ui.exists ? ui.data()! : null;
  const thread = [...msgs.docs.map((m) => msgOut(m)), ...notes.docs.map((m) => msgOut(m, true))]
    .sort((p, q) => (p.createdAt || 0) - (q.createdAt || 0));
  return {
    ticket: {
      ...rowOf(s, x, Date.now()), brandModel: t.brandModel || null, vehicleId: t.vehicleId || null, tagCode: t.tagCode || null,
      serial: t.serial || null, firstResponseAt: tsMs(t.firstResponseAt), resolvedAt: tsMs(t.resolvedAt), closedAt: tsMs(t.closedAt),
      reopenCount: Number(t.reopenCount) || 0, ratingDetail: t.rating ? { score: Number(t.rating.score), comment: t.rating.comment || '', at: tsMs(t.rating.at) } : null,
    },
    customer: {
      uid: t.uid, name: u?.name || x.userName || '', email: u?.email || x.userEmail || '', emailMasked: maskEmail(u?.email || x.userEmail || ''),
      phoneMasked: u?.phoneMasked || null, createdAt: tsMs(u?.createdAt), vehicleCount: Number(u?.vehicleCount) || 0,
      ticketCount: otherCount.data().count, deleted: !u,
    },
    tag: tag && tag.exists ? { code: tag.id, serial: tag.get('tagId') || t.serial || null, status: tag.get('status') || null, lastScanAt: tsMs(tag.get('lastScanAt')), scanCount: Number(tag.get('scanCount')) || 0 } : null,
    thread,
    can: { reply: a.superAdmin || a.perms.has('act.ticket_reply'), manage: a.superAdmin || a.perms.has('act.ticket_manage') },
  };
});

/** Atanabilecek kişiler: süper yöneticiler + Talepler sayfasını görebilenler */
export const adminTicketStaff = onCall(async (req) => {
  await requirePerm(req, 'view.tickets');
  const emails = new Set<string>([...SUPER_ADMIN_EMAILS.map((e) => e.toLowerCase()), ...(await staffWithPerm('view.tickets'))]);
  const mem = await db().getAll(...[...emails].map((e) => MEMBERS().doc(e)));
  const list = [...emails].map((e, i) => ({ email: e, name: String(mem[i]?.get('name') || '') || e.split('@')[0], superAdmin: isSuperAdminEmail(e) }));
  list.sort((p, q) => p.name.localeCompare(q.name, 'tr'));
  return { staff: list };
});

async function staffTicket(id: string) {
  const ref = TICKETS().doc(id);
  const [s, st] = await Promise.all([ref.get(), STAFF().doc(id).get()]);
  if (!s.exists) throw new HttpsError('not-found', 'Talep bulunamadı.');
  return { ref, t: s.data()!, staff: st.data() || {} };
}

export const adminTicketReply = onCall(async (req) => {
  const a = await requirePerm(req, 'act.ticket_reply');
  const id = idOf(req.data?.id);
  const internal = req.data?.internal === true;
  const { ref, t, staff } = await staffTicket(id);
  const body = cleanText(req.data?.body, LIMITS.replyMax);
  if (body.length > LIMITS.replyMax) throw new HttpsError('invalid-argument', `Yanıt en fazla ${LIMITS.replyMax} karakter olabilir.`);
  const from = t.status as TicketStatus;
  if (!internal && from === 'closed') throw new HttpsError('failed-precondition', 'Kapatılmış talebe müşteri yanıtı yazılamaz; iç not ekleyebilirsiniz.');
  const nextStatus = req.data?.nextStatus as TicketStatus | undefined;
  if (nextStatus !== undefined && !['in_review', 'waiting_customer', 'resolved'].includes(nextStatus)) throw new HttpsError('invalid-argument', 'Geçersiz durum.');
  if (internal && nextStatus) throw new HttpsError('invalid-argument', 'İç not durum değiştirmez.');
  await rateLimit(`staffreply:${a.uid}`, 300, 3600);
  const attachments = await attachFiles(req.data?.attachments, a.uid, id, t.uid);
  if (!body && !attachments.length) throw new HttpsError('invalid-argument', 'Yanıt boş olamaz.');
  const now = Date.now();
  const nowTs = Timestamp.fromMillis(now);
  const name = displayName(a);
  const b = db().batch();
  const stPatch: Record<string, unknown> = {};
  if (!staff.assigneeEmail) {
    stPatch.assigneeEmail = a.email; stPatch.assigneeName = name;
    b.set(ref.collection('notes').doc(), { kind: 'event', event: 'assigned', authorName: name, body: '', attachments: [], data: { to: name, auto: true }, createdAt: Timestamp.fromMillis(now - 1) });
  }
  if (internal) {
    b.set(ref.collection('notes').doc(), { kind: 'note', authorName: name, authorEmail: a.email, body, attachments, createdAt: nowTs });
    b.set(STAFF().doc(id), stPatch, { merge: true });
    await b.commit();
    await audit(a, 'ticket_note', { ticketId: id, no: t.no });
    return { ok: true, status: from };
  }
  const to: TicketStatus = nextStatus || (from === 'new' ? 'in_review' : from === 'resolved' ? 'resolved' : from);
  const { pub, st } = statusPatch(staff, from, to, now);
  b.set(ref.collection('messages').doc(), { kind: 'staff', authorUid: null, authorName: name, body, attachments, createdAt: nowTs });
  if (to !== from) b.set(ref.collection('messages').doc(), eventMsg(`status_${to}`, { createdAt: Timestamp.fromMillis(now + 1) }));
  b.update(ref, {
    ...pub, updatedAt: nowTs, lastActivityAt: nowTs, lastActor: 'staff', msgCount: FieldValue.increment(1),
    unreadForCustomer: true, preview: preview(body || 'Görsel eklendi'), previewBy: 'staff',
    ...(t.firstResponseAt ? {} : { firstResponseAt: nowTs }),
  });
  b.set(STAFF().doc(id), { ...stPatch, ...st }, { merge: true });
  if (typeof req.data?.templateId === 'string' && ID_RE.test(req.data.templateId)) {
    const tr = TEMPLATES().doc(req.data.templateId);
    if ((await tr.get()).exists) b.update(tr, { uses: FieldValue.increment(1) });
  }
  await b.commit();
  await audit(a, 'ticket_reply', { ticketId: id, no: t.no, status: to });
  await sendPushToUser(t.uid, {
    title: 'Destek talebinize yanıt verildi',
    body: `${t.no} · ${t.title}`,
    url: `/?view=support&ticket=${id}`,
    tag: `ticket-${id}`,
  });
  return { ok: true, status: to };
});

export const adminTicketUpdate = onCall(async (req) => {
  const a = await requirePerm(req, 'act.ticket_manage');
  const id = idOf(req.data?.id);
  const { ref, t, staff } = await staffTicket(id);
  const now = Date.now();
  const nowTs = Timestamp.fromMillis(now);
  const name = displayName(a);
  const b = db().batch();
  const stPatch: Record<string, unknown> = {};
  const pubPatch: Record<string, unknown> = {};
  const changes: string[] = [];
  let notifyAssignee: string | null = null;

  if (req.data?.assigneeEmail !== undefined) {
    const raw = req.data.assigneeEmail;
    if (raw === null || raw === '') {
      if (staff.assigneeEmail) { stPatch.assigneeEmail = null; stPatch.assigneeName = null; changes.push('unassigned'); }
    } else {
      const e = String(raw).trim().toLowerCase();
      const allowed = isSuperAdminEmail(e) || (await staffWithPerm('view.tickets')).includes(e);
      if (!allowed) throw new HttpsError('failed-precondition', 'Bu kişinin Talepler sayfasını görme yetkisi yok.');
      if (e !== staff.assigneeEmail) {
        const m = await MEMBERS().doc(e).get();
        const nm = String(m.get('name') || '') || e.split('@')[0];
        stPatch.assigneeEmail = e; stPatch.assigneeName = nm;
        b.set(ref.collection('notes').doc(), { kind: 'event', event: 'assigned', authorName: name, body: '', attachments: [], data: { to: nm }, createdAt: nowTs });
        changes.push('assigned');
        if (e !== a.email) notifyAssignee = e;
      }
    }
  }
  if (req.data?.priority !== undefined) {
    const p = req.data.priority;
    if (!['normal', 'high', 'urgent'].includes(p)) throw new HttpsError('invalid-argument', 'Geçersiz öncelik.');
    if (p !== (staff.priority || 'normal')) {
      stPatch.priority = p;
      b.set(ref.collection('notes').doc(), { kind: 'event', event: 'priority', authorName: name, body: '', attachments: [], data: { to: p }, createdAt: nowTs });
      changes.push('priority');
    }
  }
  if (req.data?.status !== undefined) {
    const to = req.data.status as TicketStatus;
    const from = t.status as TicketStatus;
    if (!STATUSES.includes(to) || to === 'new') throw new HttpsError('invalid-argument', 'Geçersiz durum.');
    if (from === 'closed') throw new HttpsError('failed-precondition', 'Kapatılmış talebin durumu değiştirilemez.');
    if (to !== from) {
      const { pub, st } = statusPatch(staff, from, to, now);
      Object.assign(pubPatch, pub, { lastActivityAt: nowTs });
      Object.assign(stPatch, st);
      b.set(ref.collection('messages').doc(), eventMsg(`status_${to}`, { createdAt: nowTs }));
      changes.push(`status_${to}`);
      if (to === 'resolved' || to === 'waiting_customer') pubPatch.unreadForCustomer = true;
    }
  }
  if (!changes.length) return { ok: true, changed: false };
  b.update(ref, { ...pubPatch, updatedAt: nowTs });
  b.set(STAFF().doc(id), stPatch, { merge: true });
  await b.commit();
  await audit(a, 'ticket_update', { ticketId: id, no: t.no, changes });
  if (notifyAssignee) {
    await notify('ticket_new', {
      title: `Size bir talep atandı: ${t.title}`, body: t.no, actorEmail: a.email, actorName: name,
      link: { section: 'tickets', id }, data: { ticketId: id, no: t.no, assigned: true }, to: [notifyAssignee],
    });
  }
  if (changes.includes('status_resolved') || changes.includes('status_waiting_customer')) {
    await sendPushToUser(t.uid, {
      title: changes.includes('status_resolved') ? 'Destek talebiniz çözüldü' : 'Destek ekibimiz sizden bilgi bekliyor',
      body: `${t.no} · ${t.title}`, url: `/?view=support&ticket=${id}`, tag: `ticket-${id}`,
    });
  }
  return { ok: true, changed: true };
});

/** Görsel (tam boy). Müşteri kendi dosyasını Firestore'dan okur; ekip için bu uç. */
export const adminTicketFile = onCall(async (req) => {
  await requirePerm(req, 'view.tickets');
  const id = idOf(req.data?.id, 'Görsel');
  const s = await FILES().doc(id).get();
  if (!s.exists || s.get('attached') !== true) throw new HttpsError('not-found', 'Görsel bulunamadı.');
  return { data: s.get('data'), w: s.get('w') || 0, h: s.get('h') || 0 };
});

// ---------------------------------------------------------------------------
// Hazır yanıtlar
// ---------------------------------------------------------------------------

export const adminListTemplates = onCall(async (req) => {
  await requirePerm(req, 'view.tickets');
  const snap = await TEMPLATES().orderBy('title').limit(200).get();
  return {
    templates: snap.docs.map((s) => ({
      id: s.id, title: s.get('title') || '', body: s.get('body') || '', uses: Number(s.get('uses')) || 0,
      updatedByName: s.get('updatedByName') || '', updatedAt: tsMs(s.get('updatedAt')),
    })),
  };
});

export const adminSaveTemplate = onCall(async (req) => {
  const a = await requirePerm(req, 'act.ticket_manage');
  const title = cleanLine(req.data?.title, 60);
  const body = cleanText(req.data?.body, 1500);
  if (title.length < 2 || title.length > 60) throw new HttpsError('invalid-argument', 'Şablon adı 2-60 karakter olmalıdır.');
  if (body.length < 5 || body.length > 1500) throw new HttpsError('invalid-argument', 'Şablon metni 5-1500 karakter olmalıdır.');
  const dup = await TEMPLATES().where('title', '==', title).limit(2).get();
  const id = req.data?.id ? idOf(req.data.id, 'Şablon') : null;
  if (dup.docs.some((x) => x.id !== id)) throw new HttpsError('already-exists', 'Bu adda bir şablon zaten var.');
  const ref = id ? TEMPLATES().doc(id) : TEMPLATES().doc();
  if (id && !(await ref.get()).exists) throw new HttpsError('not-found', 'Şablon bulunamadı.');
  await ref.set({ title, body, updatedBy: a.email, updatedByName: displayName(a), updatedAt: FieldValue.serverTimestamp(), ...(id ? {} : { uses: 0, createdAt: FieldValue.serverTimestamp() }) }, { merge: true });
  await audit(a, id ? 'ticket_template_updated' : 'ticket_template_created', { templateId: ref.id, title });
  return { ok: true, id: ref.id };
});

export const adminDeleteTemplate = onCall(async (req) => {
  const a = await requirePerm(req, 'act.ticket_manage');
  const id = idOf(req.data?.id, 'Şablon');
  const ref = TEMPLATES().doc(id);
  const s = await ref.get();
  if (!s.exists) throw new HttpsError('not-found', 'Şablon bulunamadı.');
  await ref.delete();
  await audit(a, 'ticket_template_deleted', { templateId: id, title: s.get('title') || '' });
  return { ok: true };
});

// ---------------------------------------------------------------------------
// Kötüye kullanım bildirimleri (konsol)
// ---------------------------------------------------------------------------

export const adminListAbuse = onCall(async (req) => {
  await requirePerm(req, 'view.tickets');
  const status = req.data?.status === 'reviewed' ? 'reviewed' : 'new';
  const snap = await ABUSE().where('status', '==', status).orderBy('createdAt', 'desc').limit(100).get();
  const since = Timestamp.fromMillis(Date.now() - 7 * 24 * H);
  const codes = [...new Set(snap.docs.map((s) => s.get('code') as string))].slice(0, 40);
  const counts = new Map<string, number>();
  await Promise.all(codes.map(async (c) => {
    counts.set(c, (await ABUSE().where('code', '==', c).where('createdAt', '>=', since).count().get()).data().count);
  }));
  const owners = [...new Set(snap.docs.map((s) => s.get('ownerUid') as string).filter(Boolean))];
  const vehicles = [...new Set(snap.docs.map((s) => s.get('vehicleId') as string).filter(Boolean))];
  const [ownerSnaps, vehSnaps] = await Promise.all([
    owners.length ? db().getAll(...owners.map((u) => db().collection('user_index').doc(u))) : Promise.resolve([]),
    vehicles.length ? db().getAll(...vehicles.map((v) => db().collection('vehicles').doc(v))) : Promise.resolve([]),
  ]);
  const ownerName = new Map(owners.map((u, i) => [u, String(ownerSnaps[i]?.get('name') || '') || null]));
  const plate = new Map(vehicles.map((v, i) => [v, String(vehSnaps[i]?.get('plateNumber') || '') || null]));
  const [newCount, reviewedCount] = await Promise.all([
    ABUSE().where('status', '==', 'new').count().get(), ABUSE().where('status', '==', 'reviewed').count().get(),
  ]);
  return {
    counts: { new: newCount.data().count, reviewed: reviewedCount.data().count },
    reports: snap.docs.map((s) => {
      const x = s.data();
      return {
        id: s.id, code: x.code, serial: x.serial || null, reason: x.reason, reasonText: ABUSE_REASONS[x.reason] || x.reason, note: x.note || '',
        ownerName: ownerName.get(x.ownerUid) || null, plate: x.vehicleId ? plate.get(x.vehicleId) || null : null,
        status: x.status, action: x.action || null, reviewedByName: x.reviewedByName || null, reviewedAt: tsMs(x.reviewedAt),
        createdAt: tsMs(x.createdAt), sameCode7d: counts.get(x.code) || 1,
      };
    }),
  };
});

async function markReviewed(a: StaffAccess, ids: string[], action: 'reviewed' | 'disabled'): Promise<void> {
  const b = db().batch();
  for (const id of ids) b.update(ABUSE().doc(id), { status: 'reviewed', action, reviewedAt: FieldValue.serverTimestamp(), reviewedBy: a.email, reviewedByName: displayName(a) });
  await b.commit();
}

export const adminAbuseReview = onCall(async (req) => {
  const a = await requirePerm(req, 'act.ticket_manage');
  const id = idOf(req.data?.id, 'Bildirim');
  const s = await ABUSE().doc(id).get();
  if (!s.exists) throw new HttpsError('not-found', 'Bildirim bulunamadı.');
  if (s.get('status') === 'reviewed') return { ok: true };
  await markReviewed(a, [id], 'reviewed');
  await audit(a, 'abuse_reviewed', { reportId: id, code: s.get('code') });
  return { ok: true };
});

/** QR'ı kötüye kullanım nedeniyle kapatır (QR Bankası'ndaki "kapatma" yetkisi gerekir). Aynı QR'ın bekleyen bildirimleri de kapanır. */
export const adminAbuseDisable = onCall(async (req) => {
  const a = await requirePerm(req, 'act.disable');
  const id = idOf(req.data?.id, 'Bildirim');
  const s = await ABUSE().doc(id).get();
  if (!s.exists) throw new HttpsError('not-found', 'Bildirim bulunamadı.');
  const code = s.get('code') as string;
  const { runTagAction, ownersOf } = await import('./lifecycle');
  const r = await runTagAction(a, [code], 'disable', `Kötüye kullanım bildirimi (${ABUSE_REASONS[s.get('reason')] || s.get('reason')})`);
  if (!r.done) throw new HttpsError('failed-precondition', r.skipped[0]?.reason || 'QR kapatılamadı.');
  const same = await ABUSE().where('code', '==', code).where('status', '==', 'new').get();
  await markReviewed(a, [...new Set([id, ...same.docs.map((x) => x.id)])], 'disabled');
  const owners = ownersOf(r);
  if (owners.length) { const { refreshQuietly } = await import('./directory'); await refreshQuietly(owners); }
  await audit(a, 'abuse_disabled', { reportId: id, code });
  return { ok: true };
});

// ===========================================================================
// ZAMANLANMIŞ: hedef süre uyarıları, otomatik kapatma, saklama süresi
// ===========================================================================

export async function ticketSweep(now = Date.now()): Promise<{ warned: number; breached: number; closed: number; deleted: number; orphans: number }> {
  const out = { warned: 0, breached: 0, closed: 0, deleted: 0, orphans: 0 };
  // 1) Hedef süreler
  const open = await TICKETS().where('status', 'in', OPEN).limit(500).get();
  const staffSnaps = open.empty ? [] : await db().getAll(...open.docs.map((x) => STAFF().doc(x.id)));
  for (let i = 0; i < open.docs.length; i++) {
    const s = open.docs[i];
    const t = s.data();
    const st = staffSnaps[i]?.data() || {};
    const sla = slaOf(t, st, now);
    if (sla.kind !== 'first' && sla.kind !== 'resolve') continue;
    const key = sla.kind;
    const due = sla.dueAt || 0;
    const warned = st.slaWarned?.[key] === true;
    const breached = st.slaBreached?.[key] === true;
    const label = key === 'first' ? 'ilk yanıt' : 'çözüm';
    if (now > due && !breached) {
      await STAFF().doc(s.id).set({ slaBreached: { [key]: true }, slaWarned: { [key]: true } }, { merge: true });
      await notify('ticket_sla', {
        title: `Hedef süre aşıldı (${label}): ${t.title}`, body: t.no, link: { section: 'tickets', id: s.id },
        data: { ticketId: s.id, no: t.no, kind: key, breached: true }, to: await ticketRecipients(st),
      });
      out.breached += 1;
    } else if (now <= due && now > due - WARN_BEFORE_MS && !warned) {
      await STAFF().doc(s.id).set({ slaWarned: { [key]: true } }, { merge: true });
      await notify('ticket_sla', {
        title: `Hedef süre dolmak üzere (${label}): ${t.title}`, body: t.no, link: { section: 'tickets', id: s.id },
        data: { ticketId: s.id, no: t.no, kind: key, breached: false }, to: await ticketRecipients(st),
      });
      out.warned += 1;
    }
  }
  // 2) Çözülen talep 3 gün sonra kapanır
  const resolved = await TICKETS().where('status', '==', 'resolved').where('resolvedAt', '<', Timestamp.fromMillis(now - AUTO_CLOSE_MS)).limit(300).get();
  for (const s of resolved.docs) {
    const st = (await STAFF().doc(s.id).get()).data() || {};
    const { pub, st: stp } = statusPatch(st, 'resolved', 'closed', now);
    const b = db().batch();
    b.update(s.ref, { ...pub, updatedAt: Timestamp.fromMillis(now) });
    b.set(STAFF().doc(s.id), stp, { merge: true });
    b.set(s.ref.collection('messages').doc(), eventMsg('auto_closed', { createdAt: Timestamp.fromMillis(now) }));
    await b.commit();
    out.closed += 1;
  }
  // 3) Saklama süresi dolan kapalı talepler silinir
  const expired = await STAFF().where('expiresAt', '<', Timestamp.fromMillis(now)).limit(100).get();
  for (const s of expired.docs) { await deleteTicket(s.id); out.deleted += 1; }
  // 4) 24 saat içinde talebe bağlanmayan görseller
  const orphans = await FILES().where('attached', '==', false).where('createdAt', '<', Timestamp.fromMillis(now - 24 * H)).limit(300).get();
  if (!orphans.empty) {
    const b = db().batch();
    orphans.docs.forEach((d) => b.delete(d.ref));
    await b.commit();
    out.orphans = orphans.size;
  }
  return out;
}

async function deleteCol(ref: FirebaseFirestore.CollectionReference): Promise<void> {
  for (let i = 0; i < 20; i++) {
    const snap = await ref.limit(400).get();
    if (snap.empty) return;
    const b = db().batch();
    snap.docs.forEach((d) => b.delete(d.ref));
    await b.commit();
    if (snap.size < 400) return;
  }
}

export async function deleteTicket(id: string): Promise<void> {
  const ref = TICKETS().doc(id);
  await deleteCol(ref.collection('messages'));
  await deleteCol(ref.collection('notes'));
  const files = await FILES().where('ticketId', '==', id).get();
  if (!files.empty) { const b = db().batch(); files.docs.forEach((d) => b.delete(d.ref)); await b.commit(); }
  await STAFF().doc(id).delete();
  await ref.delete();
}

/** Hesabı silinen müşterinin bütün talepleri, yazışmaları ve görselleri silinir. */
export async function deleteTicketsOf(uid: string): Promise<number> {
  const snap = await TICKETS().where('uid', '==', uid).get();
  for (const s of snap.docs) await deleteTicket(s.id);
  const loose = await FILES().where('uploaderUid', '==', uid).where('attached', '==', false).get();
  if (!loose.empty) { const b = db().batch(); loose.docs.forEach((d) => b.delete(d.ref)); await b.commit(); }
  return snap.size;
}

export const ticketSweepJob = onSchedule(
  { schedule: '5 * * * *', timeZone: 'Europe/Istanbul', timeoutSeconds: 300 },
  async () => {
    const r = await ticketSweep();
    console.log('[tickets] tarama', r);
  },
);
