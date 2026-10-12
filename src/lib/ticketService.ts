// Destek talepleri: müşteri (kendi talepleri, canlı) ve yönetim konsolu (sunucu uçları) için ortak tipler ve çağrılar.

import { collection, doc, getDoc, limit as qLimit, onSnapshot, orderBy, query, where, type DocumentData, type QueryDocumentSnapshot } from 'firebase/firestore';
import { db } from './firebase';
import {
  adminAbuseDisableFn, adminAbuseReviewFn, adminDeleteTemplateFn, adminGetTicketFn, adminListAbuseFn, adminListTemplatesFn,
  adminListTicketsFn, adminSaveTemplateFn, adminTicketFileFn, adminTicketReplyFn, adminTicketStaffFn, adminTicketUpdateFn,
  reportAbuseFn, ticketCreateFn, ticketMarkReadFn, ticketRateFn, ticketReopenFn, ticketReplyFn, ticketUploadFileFn,
} from './functionsClient';
import type { PreparedImage } from './imageCompress';

export * from './ticketConstants';
import { TOPICS, TYPES, type Priority, type TicketStatus, type TicketType } from './ticketConstants';

const tr = (lang: string) => lang === 'tr';
export const typeLabel = (t: string, lang = 'tr') => { const x = TYPES.find((y) => y.id === t); return x ? (tr(lang) ? x.tr : x.en) : t; };
export const topicLabel = (t: string, lang = 'tr') => { const x = TOPICS.find((y) => y.id === t); return x ? (tr(lang) ? x.tr : x.en) : t; };

/** Durum adları: konsolda kısa, müşteriye resmi */
export function statusLabel(s: string, lang = 'tr', audience: 'staff' | 'customer' = 'staff'): string {
  const T = tr(lang);
  if (audience === 'customer') {
    return s === 'new' ? (T ? 'Alındı' : 'Received') : s === 'in_review' ? (T ? 'İnceleniyor' : 'In review')
      : s === 'waiting_customer' ? (T ? 'Yanıtınız bekleniyor' : 'Awaiting your reply') : s === 'resolved' ? (T ? 'Çözüldü' : 'Resolved') : (T ? 'Kapatıldı' : 'Closed');
  }
  return s === 'new' ? (T ? 'Yeni' : 'New') : s === 'in_review' ? (T ? 'İnceleniyor' : 'In review')
    : s === 'waiting_customer' ? (T ? 'Bilgi bekleniyor' : 'Waiting on customer') : s === 'resolved' ? (T ? 'Çözüldü' : 'Resolved') : (T ? 'Kapandı' : 'Closed');
}
export function eventLabel(e: string | null, lang = 'tr', audience: 'staff' | 'customer' = 'staff'): string {
  const T = tr(lang);
  if (!e) return '';
  if (e.startsWith('status_')) {
    const s = e.slice(7);
    if (audience === 'customer') {
      return s === 'waiting_customer' ? (T ? 'Destek ekibi sizden ek bilgi talep etti' : 'Support requested more information')
        : s === 'resolved' ? (T ? 'Talebiniz çözüldü olarak işaretlendi' : 'Marked as resolved')
          : s === 'closed' ? (T ? 'Talebiniz kapatıldı' : 'Ticket closed') : (T ? 'Talebiniz incelemeye alındı' : 'Ticket is in review');
    }
    return `${T ? 'Durum' : 'Status'}: ${statusLabel(s, lang)}`;
  }
  if (e === 'reopened') return T ? 'Talep yeniden açıldı' : 'Ticket reopened';
  if (e === 'closed_rated') return T ? 'Değerlendirme alındı, talep kapatıldı' : 'Rated and closed';
  if (e === 'auto_closed') return T ? 'Talep 3 gün sonra otomatik olarak kapatıldı' : 'Closed automatically after 3 days';
  return e;
}

// ------------------------------------------------------------------ müşteri

export interface Attachment { id: string; w: number; h: number; thumb: string }
export interface CustomerTicket {
  id: string; no: string; type: TicketType; topic: string; title: string; status: TicketStatus;
  plate: string | null; brandModel: string | null; createdAt: number | null; lastActivityAt: number | null; lastActor: 'customer' | 'staff';
  firstResponseAt: number | null; resolvedAt: number | null; closedAt: number | null;
  rating: { score: number; comment: string } | null; unreadForCustomer: boolean; preview: string; previewBy: 'customer' | 'staff';
}
export interface CustomerMessage { id: string; kind: 'customer' | 'staff' | 'event'; event: string | null; authorName: string; body: string; attachments: Attachment[]; createdAt: number | null }
export interface CreateInput { type: TicketType; topic: string; title: string; body: string; vehicleId?: string | null; attachments?: string[] }

const ms = (v: unknown): number | null => { const t = v as { toMillis?: () => number } | null; return t && typeof t.toMillis === 'function' ? t.toMillis() : null; };
function toTicket(d: QueryDocumentSnapshot<DocumentData>): CustomerTicket {
  const x = d.data({ serverTimestamps: 'estimate' });
  return {
    id: d.id, no: x.no || '', type: x.type, topic: x.topic, title: x.title || '', status: x.status, plate: x.plate || null, brandModel: x.brandModel || null,
    createdAt: ms(x.createdAt), lastActivityAt: ms(x.lastActivityAt), lastActor: x.lastActor === 'staff' ? 'staff' : 'customer',
    firstResponseAt: ms(x.firstResponseAt), resolvedAt: ms(x.resolvedAt), closedAt: ms(x.closedAt),
    rating: x.rating ? { score: Number(x.rating.score) || 0, comment: x.rating.comment || '' } : null,
    unreadForCustomer: x.unreadForCustomer === true, preview: x.preview || '', previewBy: x.previewBy === 'staff' ? 'staff' : 'customer',
  };
}
function toMessage(d: QueryDocumentSnapshot<DocumentData>): CustomerMessage {
  const x = d.data({ serverTimestamps: 'estimate' });
  return { id: d.id, kind: x.kind, event: x.event || null, authorName: x.authorName || '', body: x.body || '', attachments: Array.isArray(x.attachments) ? x.attachments : [], createdAt: ms(x.createdAt) };
}

export function listenMyTickets(uid: string, onData: (l: CustomerTicket[]) => void, onError?: (e: unknown) => void): () => void {
  return onSnapshot(query(collection(db, 'tickets'), where('uid', '==', uid), orderBy('lastActivityAt', 'desc'), qLimit(100)),
    (s) => onData(s.docs.map(toTicket)), (e) => onError?.(e));
}
export function listenTicket(id: string, onData: (t: CustomerTicket | null) => void, onError?: (e: unknown) => void): () => void {
  return onSnapshot(doc(db, 'tickets', id), (s) => onData(s.exists() ? toTicket(s as QueryDocumentSnapshot<DocumentData>) : null), (e) => onError?.(e));
}
export function listenMessages(id: string, onData: (l: CustomerMessage[]) => void, onError?: (e: unknown) => void): () => void {
  return onSnapshot(query(collection(db, 'tickets', id, 'messages'), orderBy('createdAt', 'asc'), qLimit(400)),
    (s) => onData(s.docs.map(toMessage)), (e) => onError?.(e));
}
/** Müşterinin kendi görseli (tam boy) — Firestore kuralı yalnızca sahibine izin verir */
export async function getMyFile(id: string): Promise<string | null> {
  const s = await getDoc(doc(db, 'ticket_files', id));
  return s.exists() ? String(s.get('data') || '') : null;
}

export async function uploadImage(img: PreparedImage): Promise<string> {
  return (await ticketUploadFileFn({ data: img.data, thumb: img.thumb, w: img.w, h: img.h })).id;
}
export const createTicket = (p: CreateInput) => ticketCreateFn(p);
export const replyTicket = (ticketId: string, body: string, attachments: string[]) => ticketReplyFn({ ticketId, body, attachments });
export const reopenTicket = (ticketId: string) => ticketReopenFn({ ticketId });
export const rateTicket = (ticketId: string, score: number, comment: string) => ticketRateFn({ ticketId, score, comment });
export const markTicketRead = (ticketId: string) => ticketMarkReadFn({ ticketId });
export const reportAbuse = (code: string, reason: string, note: string) => reportAbuseFn({ code, reason, note });

// ------------------------------------------------------------------ yönetim konsolu

export type ListView = 'open' | TicketStatus;
export interface ListInput { view?: ListView; type?: TicketType | null; assignee?: 'me' | 'none' | null; q?: string; before?: number | null }
export interface Sla { kind: 'first' | 'resolve' | 'paused' | 'done'; dueAt: number | null; overdue: boolean; tookMs: number | null }
export interface TicketRow {
  id: string; no: string; title: string; type: TicketType; topic: string; status: TicketStatus; userName: string; userEmail: string; plate: string | null;
  assignee: { email: string; name: string } | null; priority: Priority; sla: Sla; createdAt: number | null; lastActivityAt: number | null;
  lastActor: 'customer' | 'staff'; unreadForStaff: boolean; msgCount: number; rating: number | null;
}
export interface ListResult {
  rows: TicketRow[]; next: number | null; counts: Record<string, number>;
  kpis: { open: number; newCount: number; unassigned: number; mine: number; overdue: number; avgFirstResponseMs: number | null; satisfaction: number | null; ratedCount: number };
}
export interface ThreadItem { id: string; kind: 'customer' | 'staff' | 'event' | 'note' | 'staff_event'; event: string | null; authorName: string; body: string; attachments: Attachment[]; data: Record<string, unknown> | null; createdAt: number | null }
export interface TicketDetail {
  ticket: TicketRow & { brandModel: string | null; vehicleId: string | null; tagCode: string | null; serial: string | null; firstResponseAt: number | null; resolvedAt: number | null; closedAt: number | null; reopenCount: number; ratingDetail: { score: number; comment: string; at: number | null } | null };
  customer: { uid: string; name: string; email: string; emailMasked: string; phoneMasked: string | null; createdAt: number | null; vehicleCount: number; ticketCount: number; deleted: boolean };
  tag: { code: string; serial: string | null; status: string | null; lastScanAt: number | null; scanCount: number } | null;
  thread: ThreadItem[];
  can: { reply: boolean; manage: boolean };
}
export interface StaffOption { email: string; name: string; superAdmin: boolean }
export interface Template { id: string; title: string; body: string; uses: number; updatedByName: string; updatedAt: number | null }
export interface AbuseReport {
  id: string; code: string; serial: string | null; reason: string; reasonText: string; note: string; ownerName: string | null; plate: string | null;
  status: 'new' | 'reviewed'; action: 'reviewed' | 'disabled' | null; reviewedByName: string | null; reviewedAt: number | null; createdAt: number | null; sameCode7d: number;
}
export interface AbuseList { counts: { new: number; reviewed: number }; reports: AbuseReport[] }

export const listTickets = (p: ListInput) => adminListTicketsFn(p);
export const getTicket = (id: string) => adminGetTicketFn({ id });
export const ticketStaff = () => adminTicketStaffFn({});
export const staffReply = (p: { id: string; body: string; internal?: boolean; nextStatus?: TicketStatus; attachments?: string[]; templateId?: string }) => adminTicketReplyFn(p);
export const updateTicket = (p: { id: string; status?: TicketStatus; assigneeEmail?: string | null; priority?: Priority }) => adminTicketUpdateFn(p);
export const staffFile = async (id: string) => (await adminTicketFileFn({ id })).data;
export const listTemplates = () => adminListTemplatesFn({});
export const saveTemplate = (p: { id?: string; title: string; body: string }) => adminSaveTemplateFn(p);
export const deleteTemplate = (id: string) => adminDeleteTemplateFn({ id });
export const listAbuse = (status: 'new' | 'reviewed') => adminListAbuseFn({ status });
export const reviewAbuse = (id: string) => adminAbuseReviewFn({ id });
export const disableFromAbuse = (id: string) => adminAbuseDisableFn({ id });

/** Hedef süre metni: "21 sa kaldı", "Süresi geçti · 2 sa", "1 gün 2 sa sürdü" */
export function durationText(msv: number, lang = 'tr'): string {
  const T = tr(lang);
  const m = Math.max(0, Math.round(msv / 60000));
  if (m < 60) return T ? `${Math.max(1, m)} dk` : `${Math.max(1, m)} min`;
  const h = Math.floor(m / 60);
  if (h < 24) { const mm = m % 60; return T ? `${h} sa${h < 6 && mm ? ` ${mm} dk` : ''}` : `${h} h${h < 6 && mm ? ` ${mm} min` : ''}`; }
  const d = Math.floor(h / 24); const hh = h % 24;
  return T ? `${d} gün${hh ? ` ${hh} sa` : ''}` : `${d} d${hh ? ` ${hh} h` : ''}`;
}
export function slaText(s: Sla, lang = 'tr', now = Date.now()): { text: string; sub: string; tone: 'ok' | 'warn' | 'bad' | 'done' | 'muted' } {
  const T = tr(lang);
  if (s.kind === 'done') return { text: s.tookMs !== null ? (T ? `${durationText(s.tookMs, lang)} sürdü` : `took ${durationText(s.tookMs, lang)}`) : '—', sub: T ? 'Çözüldü' : 'Resolved', tone: 'done' };
  if (s.kind === 'paused') return { text: T ? 'Süre durdu' : 'Paused', sub: T ? 'Müşteriden bilgi bekleniyor' : 'Waiting on customer', tone: 'muted' };
  const sub = s.kind === 'first' ? (T ? 'İlk yanıt' : 'First reply') : (T ? 'Çözüm' : 'Resolution');
  if (!s.dueAt) return { text: '—', sub, tone: 'muted' };
  const left = s.dueAt - now;
  if (left < 0) return { text: T ? `Süresi geçti · ${durationText(-left, lang)}` : `Overdue · ${durationText(-left, lang)}`, sub, tone: 'bad' };
  return { text: T ? `${durationText(left, lang)} kaldı` : `${durationText(left, lang)} left`, sub, tone: left < 6 * 3600e3 ? 'warn' : 'ok' };
}
