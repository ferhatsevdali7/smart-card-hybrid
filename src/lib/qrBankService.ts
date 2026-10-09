// Merkezi QR bankası (tags koleksiyonu) - yönetici servisi.
// Okuma doğrudan Firestore'dan (kurallar yalnızca yöneticilere izin verir),
// her türlü değişiklik Cloud Functions üzerinden yapılır.

import { collection, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';
import { QrTagItem, QrTagStatus } from '../types/card';
import { adminCreateBatchFn, adminSetTagStatusFn, formatCode, tagUrl } from './functionsClient';

const TAGS_COLLECTION = 'tags';

/** Araç etiketi partisi oluşturur (sunucuda). */
export async function createBatchQrTags(batchName: string, count: number): Promise<{ batchId: string; count: number }> {
  return adminCreateBatchFn({ productType: 'OQ', count, notes: batchName });
}

/** QR bankasını canlı dinler. */
export function listenToQrTags(onUpdate: (tags: QrTagItem[]) => void): () => void {
  return onSnapshot(
    collection(db, TAGS_COLLECTION),
    (snap) => {
      const items = snap.docs.map((d) => d.data() as QrTagItem);
      items.sort((a, b) => b.tagId.localeCompare(a.tagId));
      onUpdate(items);
    },
    (err) => {
      console.warn('QR bankası okunamadı:', err);
      onUpdate([]);
    },
  );
}

/**
 * Etiket durumunu değiştirir.
 * disabled -> kullanıma kapat, active/unclaimed -> yeniden aç, expired -> süresi doldu
 */
export async function updateQrTagStatus(code: string, status: QrTagStatus, notes?: string): Promise<void> {
  const action = status === 'disabled' ? 'disable' : status === 'expired' ? 'expire' : 'enable';
  await adminSetTagStatusFn({ code, action, note: notes });
}

/** Sahipliği ve araç bağını silip etiketi stoğa döndürür. */
export async function resetQrTag(code: string): Promise<void> {
  await adminSetTagStatusFn({ code, action: 'reset' });
}

/** Matbaa için CSV dökümü */
export function exportToPrintCsv(tags: QrTagItem[]): void {
  if (tags.length === 0) return;
  const headers = ['Seri No', 'QR Altı Kod', 'QR İçeriği (URL)', 'Parti', 'Durum', 'Oluşturulma Tarihi'];
  const rows = tags.map((t) => [
    t.tagId,
    formatCode(t.code),
    tagUrl(t.code),
    t.batchNumber || '',
    t.status,
    t.createdAt ? new Date(t.createdAt).toLocaleString('tr-TR') : '',
  ]);
  downloadCsv(headers, rows, `matbaa_qr_listesi_${new Date().toISOString().split('T')[0]}.csv`);
}

export function downloadCsv(headers: string[], rows: (string | number)[][], filename: string): void {
  const csvContent = '﻿' + [
    headers.join(';'),
    ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')),
  ].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
