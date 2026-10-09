// Sunucu tarafı sabitleri. Buradaki değerler istemciye hiç gitmez.

/** Firestore kurallarındaki listeyle aynı olmalı (firestore.rules -> isSuperAdmin). */
export const SUPER_ADMIN_EMAILS = [
  'sevdaliferhat64@gmail.com',
  'hasimturcan199@gmail.com',
];

/** QR koduna giren karakterler: karışan harf/rakamlar (I, L, O, 0, 1) yok. */
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const CODE_LENGTH = 12;
export const CODE_REGEX = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{12}$/;

/** Araç kartına bağlanabilen ürün tipi. */
export const VEHICLE_PRODUCT = 'OQ';
export const PRODUCT_TYPES = ['OQ', 'MQ', 'KQ'] as const;
export type ProductType = (typeof PRODUCT_TYPES)[number];

export const PRODUCT_NAMES: Record<ProductType, string> = {
  OQ: 'Otomobil Ön Cam QR Etiketi',
  MQ: 'Medikal Acil SOS QR Etiketi',
  KQ: 'Kişisel Dijital Kartvizit QR',
};

/** Ziyaretçinin gönderebileceği hazır bildirim tipleri. */
export const NOTICE_TYPES = ['blocking', 'lights', 'window', 'alarm', 'other'] as const;
export type NoticeType = (typeof NOTICE_TYPES)[number];
export const NOTICE_NOTE_MAX = 200;

/** Bildirim metinleri (araç sahibinin telefonunda görünür) */
export const NOTICE_TEXT: Record<NoticeType, string> = {
  blocking: 'Aracınız yolu / çıkışı kapatıyor',
  lights: 'Farlarınız açık kalmış',
  window: 'Camınız veya kapınız açık',
  alarm: 'Alarm çalıyor / araca temas oldu',
  other: 'Yeni bir mesajınız var',
};

/** Hız sınırları: [adet, saniye] */
export const LIMITS = {
  scanPerIp: [60, 3600],
  scanPerTag: [120, 3600],
  claimPerUser: [20, 3600],
  noticePerIp: [10, 3600],
  noticePerTag: [20, 3600],
  noticePerIpTag: [3, 600],
  adminBatchPerUser: [20, 3600],
  testPushPerUser: [5, 3600],
} as const;

export const MAX_BATCH_SIZE = 1000;
