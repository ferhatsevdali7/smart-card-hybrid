// Bildirimler: kişinin kendi gelen kutusu (Firestore'dan canlı okunur), okundu / temizle / görev,
// süper yöneticinin bildirim göndermesi ve gönderdikleri. Bütün yazmalar sunucuda yapılır.

import { collection, limit as qLimit, onSnapshot, orderBy, query, where, type DocumentData, type QueryDocumentSnapshot } from 'firebase/firestore';
import { db } from './firebase';
import {
  adminInboxClearFn, adminInboxMarkReadFn, adminInboxTaskDoneFn, adminListSentFn, adminSendNotificationFn,
} from './functionsClient';

export type NoteKind = 'critical' | 'limit_reached' | 'batch_created' | 'tag_lost' | 'task' | 'message'
  | 'ticket_new' | 'ticket_reply' | 'ticket_sla' | 'abuse_report';
export type NoteCategory = 'critical' | 'system' | 'task' | 'message' | 'ticket';
export type LinkSection = 'overview' | 'depot' | 'batch' | 'stand' | 'bank' | 'disabled' | 'trash' | 'vehicles' | 'users' | 'tickets' | 'team' | 'audit';
export interface NoteLink { section: LinkSection; id?: string; tab?: string }

export interface InboxItem {
  id: string;
  kind: NoteKind | string;
  category: NoteCategory | string;
  title: string;
  body: string;
  actorEmail: string | null;
  actorName: string | null;
  link: NoteLink | null;
  data: Record<string, unknown>;
  readAt: number | null;
  doneAt: number | null;
  resolvedAt: number | null;
  sendId: string | null;
  day: string;
  createdAt: number | null;
}

export interface SendInput {
  mode: 'people' | 'positions' | 'all';
  emails?: string[];
  positionIds?: string[];
  title: string;
  body: string;
  task: boolean;
  link?: { section: LinkSection } | null;
}

export interface SentRecipient { email: string; name: string; positionName: string | null; readAt: number | null; doneAt: number | null }
export interface SentItem {
  id: string; by: string; byName: string; title: string; body: string; link: NoteLink | null; task: boolean;
  mode: 'people' | 'positions' | 'all'; positionNames: string[]; count: number; createdAt: number | null;
  readCount: number; doneCount: number; recipients: SentRecipient[];
}

export const TITLE_MAX = 120;
export const BODY_MAX = 500;
export const KEEP_DAYS = 90;

const ms = (v: unknown): number | null => {
  const t = v as { toMillis?: () => number } | null;
  return t && typeof t.toMillis === 'function' ? t.toMillis() : null;
};

function toItem(d: QueryDocumentSnapshot<DocumentData>): InboxItem {
  const x = d.data({ serverTimestamps: 'estimate' });
  const link = x.link && typeof x.link === 'object' && typeof x.link.section === 'string' ? (x.link as NoteLink) : null;
  return {
    id: d.id,
    kind: String(x.kind || 'message'),
    category: String(x.category || 'message'),
    title: String(x.title || ''),
    body: String(x.body || ''),
    actorEmail: x.actorEmail || null,
    actorName: x.actorName || null,
    link,
    data: x.data && typeof x.data === 'object' ? x.data : {},
    readAt: ms(x.readAt),
    doneAt: ms(x.doneAt),
    resolvedAt: ms(x.resolvedAt),
    sendId: x.sendId || null,
    day: String(x.day || ''),
    createdAt: ms(x.createdAt),
  };
}

const inboxCol = (email: string) => collection(db, 'admin_inbox', email.toLowerCase(), 'inbox_items');
const byNewest = (a: InboxItem, b: InboxItem) => (b.createdAt || 0) - (a.createdAt || 0);

/** Okunmamış bildirimler (zildeki sayaç ve yeni bildirim uyarısı). En fazla 100 sayılır: "99+". */
export function listenUnread(email: string, onData: (items: InboxItem[]) => void, onError?: (e: unknown) => void): () => void {
  return onSnapshot(
    query(inboxCol(email), where('readAt', '==', null), qLimit(100)),
    (s) => onData(s.docs.map(toItem).sort(byNewest)),
    (e) => onError?.(e),
  );
}

/** Gelen kutusu (yeniden eskiye, canlı). n arttırılarak daha eskiler yüklenir. */
export function listenInbox(email: string, n: number, onData: (items: InboxItem[]) => void, onError?: (e: unknown) => void): () => void {
  return onSnapshot(
    query(inboxCol(email), orderBy('createdAt', 'desc'), qLimit(n)),
    (s) => onData(s.docs.map(toItem)),
    (e) => onError?.(e),
  );
}

/** Sayfa açıkken: okunmamışların hepsini okundu yapar. */
export async function markAllRead(): Promise<number> {
  let total = 0;
  for (let i = 0; i < 5; i++) {
    const r = await adminInboxMarkReadFn({});
    total += r.marked;
    if (!r.more) break;
  }
  return total;
}

export const clearInbox = (ids?: string[]) => adminInboxClearFn(ids ? { ids } : {});
export const markTaskDone = (id: string) => adminInboxTaskDoneFn({ id });
export const sendNotification = (p: SendInput) => adminSendNotificationFn(p);
export const listSent = (before?: number | null) => adminListSentFn({ before: before ?? null });

// ------------------------------------------------------------------ kurallar (sunucuyla aynı)

export function todayKey(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

/** Karar bekleyen sınır bildirimi (bugün ve kısıt kaldırılmamış) */
export const limitPending = (it: InboxItem, today = todayKey()) => it.kind === 'limit_reached' && !it.resolvedAt && it.day === today;
export const limitExpired = (it: InboxItem, today = todayKey()) => it.kind === 'limit_reached' && !it.resolvedAt && !!it.day && it.day !== today;
export const taskOpen = (it: InboxItem) => it.kind === 'task' && !it.doneAt;

/** Temizlenebilir mi? (okunmamış, tamamlanmamış görev ve bugün karar bekleyen sınır bildirimi temizlenemez) */
export function removable(it: InboxItem, today = todayKey()): boolean {
  return !!it.readAt && !taskOpen(it) && !limitPending(it, today);
}

// ------------------------------------------------------------------ metinler

type L = (tr: string, en: string) => string;

export interface NoteText {
  /** Başta kalın yazılan kişi adı (yoksa null) */
  actor: string | null;
  /** Başlığın kalanı */
  rest: string;
  /** Saat yanında gösterilen ayrıntı */
  meta: string;
  /** Açıklama / sebep */
  body: string;
}

const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : Number(v) || 0);
const s = (v: unknown) => (typeof v === 'string' ? v : '');

/** Kime gönderildiği (alıcının gözünden) */
export function audienceText(data: Record<string, unknown>, L: L): string {
  const mode = s(data.mode);
  const count = n(data.count);
  const names = Array.isArray(data.positionNames) ? (data.positionNames as unknown[]).map(String) : [];
  if (mode === 'all') return L('tüm ekibe', 'to the whole team');
  if (mode === 'positions') return L(`${names.join(', ')} pozisyonundaki ${count} kişiye`, `to ${count} people in ${names.join(', ')}`);
  return count <= 1 ? L('size', 'to you') : L(`size ve ${count - 1} kişiye daha`, `to you and ${count - 1} others`);
}

export function noteText(it: InboxItem, L: L): NoteText {
  const actor = it.actorName || (it.actorEmail ? it.actorEmail.split('@')[0] : null);
  const d = it.data;
  switch (it.kind) {
    case 'critical':
      if (d.action === 'qr_purged') {
        return { actor, rest: L(`${n(d.count)} QR'ı kalıcı olarak sildi`, `permanently deleted ${n(d.count)} QR codes`), meta: '', body: s(d.reason) || it.body };
      }
      return {
        actor,
        rest: L('bir müşteri hesabını sildi', 'deleted a customer account'),
        meta: [s(d.targetMasked), d.vehicles !== undefined ? L(`${n(d.vehicles)} araç, ${n(d.tags)} QR kapandı`, `${n(d.vehicles)} vehicles, ${n(d.tags)} QR closed`) : ''].filter(Boolean).join(' · '),
        body: s(d.reason) || it.body,
      };
    case 'limit_reached': {
      const purge = d.action === 'purge';
      const what = purge ? L('kalıcı QR silme', 'permanent QR deletion') : L('müşteri hesabı silme', 'customer deletion');
      const past = !!it.day && it.day !== todayKey();
      return {
        actor,
        rest: L(`günlük ${what} sınırına ulaştı`, `reached the daily ${what} limit`),
        meta: past || it.resolvedAt ? '' : L('yeni silme işlemleri durdu', 'new deletions are blocked'),
        body: past
          ? L(`O gün ${n(d.used)} / ${n(d.limit)} ${purge ? 'QR' : 'hesap'} sildi.`, `${n(d.used)} / ${n(d.limit)} used that day.`)
          : L(
            `Bugün ${n(d.used)} / ${n(d.limit)} ${purge ? 'QR' : 'hesap'} sildi. Kısıtı kaldırırsanız gece yarısına kadar sınırsız silebilir; her işlem yine şifre ve sebep ister.`,
            `${n(d.used)} / ${n(d.limit)} used today. Lifting allows unlimited deletions until midnight; each still needs a password and a reason.`,
          ),
      };
    }
    case 'batch_created':
      return { actor: null, rest: L(`Yeni parti üretildi: ${s(d.batchId)}`, `New batch created: ${s(d.batchId)}`), meta: [actor, L(`${n(d.count)} QR depoya girdi`, `${n(d.count)} QR added to stock`)].filter(Boolean).join(' · '), body: '' };
    case 'tag_lost':
      return { actor: null, rest: L("Bir müşteri QR'ını kayıp bildirdi", 'A customer reported a QR as lost'), meta: [s(d.serial), L('otomatik kapatıldı', 'disabled automatically')].filter(Boolean).join(' · '), body: '' };
    case 'ticket_new':
      if (d.assigned) return { actor: null, rest: it.title, meta: [actor, s(d.no)].filter(Boolean).join(' · '), body: '' };
      return { actor: null, rest: it.title, meta: [actor, it.body].filter(Boolean).join(' · '), body: '' };
    case 'ticket_reply':
      return { actor: null, rest: it.title, meta: [actor, s(d.no)].filter(Boolean).join(' · '), body: '' };
    case 'ticket_sla':
      return { actor: null, rest: it.title, meta: s(d.no), body: '' };
    case 'abuse_report':
      return { actor: null, rest: it.title, meta: [L('QR', 'QR') + ' ' + it.body, L('girişsiz ziyaretçi', 'anonymous visitor')].join(' · '), body: '' };
    case 'task':
    case 'message':
      return { actor: null, rest: it.title, meta: [actor, audienceText(d, L)].filter(Boolean).join(' · '), body: it.body };
    default:
      return { actor: null, rest: it.title, meta: actor || '', body: it.body };
  }
}

/** Tek satırlık özet (yeni bildirim uyarısı için) */
export function noteSummary(it: InboxItem, L: L): string {
  const t = noteText(it, L);
  if (it.kind === 'task') return L(`${it.actorName || 'Süper yönetici'} size bir görev gönderdi`, `${it.actorName || 'A super admin'} sent you a task`);
  if (it.kind === 'message') return L(`${it.actorName || 'Süper yönetici'} bir duyuru gönderdi`, `${it.actorName || 'A super admin'} sent an announcement`);
  return t.actor ? `${t.actor} ${t.rest}` : t.rest;
}

export const SECTION_NAMES: Record<LinkSection, { tr: string; en: string; go: string }> = {
  overview: { tr: 'Genel Bakış', en: 'Overview', go: "Genel Bakış'a git" },
  depot: { tr: 'QR Deposu', en: 'QR Stock', go: "QR Deposu'na git" },
  batch: { tr: 'Parti', en: 'Batch', go: 'Partiye git' },
  stand: { tr: 'Satış Standı', en: 'On Sale', go: "Satış Standı'na git" },
  bank: { tr: 'QR Bankası', en: 'QR Bank', go: "QR Bankası'na git" },
  disabled: { tr: 'Devre Dışı', en: 'Disabled', go: "Devre Dışı'na git" },
  trash: { tr: 'Çöp Kutusu', en: 'Trash', go: "Çöp Kutusu'na git" },
  vehicles: { tr: 'Bağlı Araçlar', en: 'Linked Vehicles', go: "Bağlı Araçlar'a git" },
  users: { tr: 'Kullanıcılar', en: 'Users', go: "Kullanıcılar'a git" },
  tickets: { tr: 'Talepler', en: 'Requests', go: "Talepler'e git" },
  team: { tr: 'Ekip ve Yetkiler', en: 'Team', go: "Ekip ve Yetkiler'e git" },
  audit: { tr: 'Denetim Kayıtları', en: 'Audit Logs', go: "Denetim Kayıtları'na git" },
};

/** Bildirimde seçilebilen sayfalar (parti gibi kimlik isteyenler hariç) */
export const COMPOSE_SECTIONS: LinkSection[] = ['overview', 'depot', 'stand', 'bank', 'disabled', 'trash', 'vehicles', 'users', 'tickets', 'audit'];

export function linkLabel(link: NoteLink, L: L): string {
  if (link.section === 'users' && link.tab === 'deleted') return L('Silinmiş hesaplara git', 'Open deleted accounts');
  if (link.section === 'team' && link.id) return L('Üyeye git', 'Open member');
  if (link.section === 'tickets' && link.tab === 'abuse') return L('Kötüye kullanım bildirimlerine git', 'Open abuse reports');
  if (link.section === 'tickets' && link.id) return L('Talebe git', 'Open request');
  const nm = SECTION_NAMES[link.section];
  return nm ? L(nm.go, `Open ${nm.en}`) : L('Sayfaya git', 'Open page');
}
