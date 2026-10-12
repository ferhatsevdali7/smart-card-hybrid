/**
 * Yönetici bildirimleri: her ekip üyesinin (süper yöneticiler dahil) kendi gelen kutusu.
 *
 *   admin_inbox/{email}/inbox_items/{id}
 *     kind       critical | limit_reached | batch_created | tag_lost | task | message
 *     category   critical | system | task | message   (sayfadaki süzgeçler)
 *     title, body          metin (görev/duyuruda süper yöneticinin yazdığı; diğerlerinde yedek metin)
 *     actorEmail, actorName  işlemi yapan / gönderen
 *     link       { section, id?, tab? } | null   "İlgili sayfaya git" düğmesi
 *     data       türe özel alanlar (adet, sebep, gizlenmiş e-posta…)
 *     readAt     null = okunmadı (zildeki sayaç bunları sayar)
 *     doneAt     görevlerde "Tamamlandı" zamanı
 *     resolvedAt sınır bildiriminde kısıtın kaldırıldığı zaman
 *     sendId     süper yöneticinin gönderdiği bildirimin kaydı (admin_sends)
 *     expiresAt  90 gün sonra gece temizliğinde silinir
 *
 * İstemci yalnızca kendi kutusunu okur; yazma her zaman sunucudan.
 * Hangi olayın kime gideceği ROUTES tablosundadır (ileride pozisyonlara göre genişletilecek).
 */

import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { SUPER_ADMIN_EMAILS } from './config';
import { db, sha256 } from './helpers';
import { dayKey } from './stats';

export const INBOX_TTL_DAYS = 90;

export type NoteKind = 'critical' | 'limit_reached' | 'batch_created' | 'tag_lost' | 'task' | 'message'
  | 'ticket_new' | 'ticket_reply' | 'ticket_sla' | 'abuse_report';
export type NoteCategory = 'critical' | 'system' | 'task' | 'message' | 'ticket';

export const CATEGORY: Record<NoteKind, NoteCategory> = {
  critical: 'critical',
  limit_reached: 'critical',
  batch_created: 'system',
  tag_lost: 'system',
  task: 'task',
  message: 'message',
  ticket_new: 'ticket',
  ticket_reply: 'ticket',
  ticket_sla: 'ticket',
  abuse_report: 'ticket',
};

/** Bildirimin götürebileceği sayfalar (istemcideki bölüm adlarıyla aynı) */
export const LINK_SECTIONS = ['overview', 'depot', 'batch', 'stand', 'bank', 'disabled', 'trash', 'vehicles', 'users', 'tickets', 'team', 'audit'] as const;
export type LinkSection = (typeof LINK_SECTIONS)[number];
export interface NoteLink { section: LinkSection; id?: string; tab?: string }

/**
 * Olay → alıcı grubu.
 *  super   : süper yöneticiler
 *  tickets : Talepler sayfasını görebilen ekip üyeleri (etkin / davetli) + süper yöneticiler
 * notify(..., { to }) ile alıcılar açıkça da verilebilir (örn. talebin sorumlusu).
 */
type Audience = 'super' | 'tickets';
const ROUTES: Record<Exclude<NoteKind, 'task' | 'message'>, Audience[]> = {
  critical: ['super'],
  limit_reached: ['super'],
  batch_created: ['super'],
  tag_lost: ['super'],
  ticket_new: ['tickets'],
  ticket_reply: ['tickets'],
  ticket_sla: ['tickets'],
  abuse_report: ['tickets'],
};

export const inboxCol = (email: string) => db().collection('admin_inbox').doc(email.toLowerCase()).collection('inbox_items');
export const SENDS = () => db().collection('admin_sends');
/** Alıcı anahtarı (e-postadaki noktalar alan yolunu bozmasın diye) */
export const recipientKey = (email: string) => sha256(email.toLowerCase()).slice(0, 16);

export function expiresAt(from = Date.now()): Timestamp {
  return Timestamp.fromMillis(from + INBOX_TTL_DAYS * 86400e3);
}

export function cleanLink(v: unknown): NoteLink | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  if (typeof o.section !== 'string' || !(LINK_SECTIONS as readonly string[]).includes(o.section)) return null;
  const out: NoteLink = { section: o.section as LinkSection };
  if (typeof o.id === 'string' && /^[\w.@+-]{1,120}$/.test(o.id)) out.id = o.id;
  if (typeof o.tab === 'string' && /^[a-z_]{1,24}$/.test(o.tab)) out.tab = o.tab;
  return out;
}

export function baseItem(kind: NoteKind, p: {
  title: string; body?: string; actorEmail?: string | null; actorName?: string | null; link?: NoteLink | null;
  data?: Record<string, unknown>; sendId?: string | null;
}) {
  return {
    kind,
    category: CATEGORY[kind],
    title: p.title.slice(0, 160),
    body: (p.body || '').slice(0, 600),
    actorEmail: p.actorEmail || null,
    actorName: p.actorName || null,
    link: p.link || null,
    data: p.data || {},
    readAt: null,
    doneAt: null,
    resolvedAt: null,
    sendId: p.sendId || null,
    day: dayKey(),
    createdAt: FieldValue.serverTimestamp(),
    expiresAt: expiresAt(),
  };
}

/** Belirli bir yetkisi olan etkin / davetli ekip üyeleri */
export async function staffWithPerm(perm: string): Promise<string[]> {
  const snap = await db().collection('staff_members').where('perms', 'array-contains', perm).get();
  return snap.docs.filter((d) => {
    const x = d.data();
    const status = x.status || (x.isActive === false ? 'suspended' : 'active');
    return status === 'active' || status === 'invited';
  }).map((d) => d.id.toLowerCase());
}

async function audienceEmails(kind: keyof typeof ROUTES): Promise<string[]> {
  const out = new Set<string>();
  for (const a of ROUTES[kind]) {
    if (a === 'super' || a === 'tickets') SUPER_ADMIN_EMAILS.forEach((e) => out.add(e.toLowerCase()));
    if (a === 'tickets') (await staffWithPerm('view.tickets')).forEach((e) => out.add(e));
  }
  return [...out];
}

/**
 * Sistem olayını ilgili kişilerin kutusuna düşürür. İşlemi yapan kişiye kendi işlemi bildirilmez.
 * Hiçbir zaman hata fırlatmaz: bildirim yazılamasa da asıl işlem başarılı sayılır.
 * @param docId verilirse her alıcıda aynı kimlikle bir kez oluşturulur (örn. günde tek sınır bildirimi)
 */
export async function notify(kind: keyof typeof ROUTES, p: {
  title: string; body?: string; actorEmail?: string | null; actorName?: string | null; link?: NoteLink | null;
  data?: Record<string, unknown>; docId?: string;
  /** Verilirse yalnızca bu kişilere gider (yönlendirme tablosu yerine) */
  to?: string[];
}): Promise<number> {
  try {
    const actor = (p.actorEmail || '').toLowerCase();
    const base = p.to ? [...new Set(p.to.map((e) => e.toLowerCase()))] : await audienceEmails(kind);
    const to = base.filter((e) => e && e !== actor);
    const item = baseItem(kind, p);
    let n = 0;
    await Promise.all(to.map(async (email) => {
      const col = inboxCol(email);
      try {
        if (p.docId) await col.doc(p.docId).create(item);
        else await col.add(item);
        n += 1;
      } catch {
        /* aynı kimlikle zaten var */
      }
    }));
    return n;
  } catch (e) {
    console.error('[inbox] bildirim yazılamadı', kind, e);
    return 0;
  }
}

/** Sınır bildirimini (kısıt kaldırılınca) bütün süper yöneticilerin kutusunda "çözüldü" yapar. */
export async function resolveEverywhere(docId: string, by: string): Promise<void> {
  await Promise.all(SUPER_ADMIN_EMAILS.map(async (email) => {
    const ref = inboxCol(email).doc(docId);
    const s = await ref.get();
    if (s.exists && !s.get('resolvedAt')) await ref.update({ resolvedAt: FieldValue.serverTimestamp(), 'data.resolvedBy': by });
  }));
}

/**
 * Temizlenemeyen bildirim: okunmamış, tamamlanmamış görev ya da bugün karar bekleyen sınır bildirimi.
 * (Geçmiş günün sınır bildirimi kendiliğinden geçersizdir; temizlenebilir.)
 */
export function isProtected(d: FirebaseFirestore.DocumentData, today = dayKey()): 'unread' | 'task' | 'limit' | null {
  if (!d.readAt) return 'unread';
  if (d.kind === 'task' && !d.doneAt) return 'task';
  if (d.kind === 'limit_reached' && !d.resolvedAt && d.day === today) return 'limit';
  return null;
}

/** Kişinin bütün bildirimlerini siler (ekipten çıkarılınca). */
export async function clearInboxOf(email: string): Promise<number> {
  let total = 0;
  for (let i = 0; i < 20; i++) {
    const snap = await inboxCol(email).limit(400).get();
    if (snap.empty) break;
    const b = db().batch();
    snap.docs.forEach((d) => b.delete(d.ref));
    await b.commit();
    total += snap.size;
    if (snap.size < 400) break;
  }
  return total;
}
