// Destek talepleri: sabitler (Firestore içermez; QR ziyaretçi sayfası da kullanır, hafif kalmalı).

export type TicketType = 'request' | 'complaint' | 'suggestion' | 'question';
export type TicketStatus = 'new' | 'in_review' | 'waiting_customer' | 'resolved' | 'closed';
export type Priority = 'normal' | 'high' | 'urgent';
export const OPEN_STATUSES: TicketStatus[] = ['new', 'in_review', 'waiting_customer'];

export const TYPES: { id: TicketType; tr: string; en: string }[] = [
  { id: 'request', tr: 'İstek', en: 'Request' },
  { id: 'complaint', tr: 'Şikayet', en: 'Complaint' },
  { id: 'suggestion', tr: 'Öneri', en: 'Suggestion' },
  { id: 'question', tr: 'Soru', en: 'Question' },
];
export const TOPICS: { id: string; tr: string; en: string }[] = [
  { id: 'qr_unreadable', tr: 'QR okunmuyor / sayfa açılmıyor', en: 'QR not working' },
  { id: 'qr_link', tr: 'QR etiketi bağlama', en: 'Linking a QR tag' },
  { id: 'notifications', tr: 'Bildirimler', en: 'Notifications' },
  { id: 'account', tr: 'Hesap ve giriş', en: 'Account and sign-in' },
  { id: 'vehicle', tr: 'Araç bilgileri', en: 'Vehicle details' },
  { id: 'lost', tr: 'Kayıp veya çalıntı etiket', en: 'Lost or stolen tag' },
  { id: 'privacy', tr: 'Gizlilik ve kişisel veriler', en: 'Privacy and personal data' },
  { id: 'purchase', tr: 'Satın alma ve etiket temini', en: 'Purchase and supply' },
  { id: 'other', tr: 'Diğer', en: 'Other' },
];
export const ABUSE_REASONS: { id: string; tr: string; en: string }[] = [
  { id: 'wrong_vehicle', tr: 'QR etiketi başka bir araca yapıştırılmış', en: 'Tag is on another vehicle' },
  { id: 'fake', tr: 'QR etiketi sahte veya kopya görünüyor', en: 'Tag looks fake or copied' },
  { id: 'harassment', tr: 'Rahatsız edici kullanım', en: 'Harassing use' },
  { id: 'other', tr: 'Diğer', en: 'Other' },
];
export const LIMITS = { titleMin: 5, titleMax: 120, bodyMin: 10, bodyMax: 1000, replyMax: 2000, attachMax: 4, commentMax: 500, noteMax: 300 };
