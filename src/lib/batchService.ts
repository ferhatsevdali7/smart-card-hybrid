// src/lib/batchService.ts
// Endüstriyel Parti Üretim ve Yaşam Döngüsü Servisi
// Parti ve etiket OLUŞTURMA sunucudadır (adminCreateBatch). Burada yalnızca
// okuma ve parti durumunun güncellenmesi yapılır.

import {
  collection, doc, getDocs, updateDoc, query, where, serverTimestamp, onSnapshot,
} from 'firebase/firestore';
import { db } from './firebase';
import { BatchItem, BatchStatus, BatchTagItem, ProductType } from '../types/batch';
import { adminCreateBatchFn, formatCode, tagUrl } from './functionsClient';
import { downloadCsv } from './qrBankService';

const BATCHES_COLLECTION = 'production_batches';
const TAGS_COLLECTION = 'tags';

/**
 * Geçerli Yıl ve Ay kodunu üretir (örn: 2026 Ekim -> 2610)
 */
export function getCurrentYearMonthCode(): string {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  return `${yy}${mm}`;
}

/**
 * Yeni bir Seri Üretim Partisi Oluşturur (HF-OQ-YYMM-BXX-XXXX Standardı).
 * Etiket kodları sunucuda kriptografik olarak rastgele üretilir.
 */
export async function createProductionBatch(
  productType: ProductType,
  count: number,
  notes: string,
  _adminEmail?: string
): Promise<{ batchId: string; count: number }> {
  if (count < 1 || count > 1000) {
    throw new Error('Üretim adedi 1 ile 1000 arasında olmalıdır.');
  }
  return adminCreateBatchFn({ productType, count, notes });
}

/**
 * Tüm Üretim Partilerini Gerçek Zamanlı Dinler
 */
export function listenToBatches(onUpdate: (batches: BatchItem[]) => void): () => void {
  const colRef = collection(db, BATCHES_COLLECTION);
  return onSnapshot(colRef, (snap) => {
    const items: BatchItem[] = [];
    snap.forEach((docSnap) => {
      items.push(docSnap.data() as BatchItem);
    });
    // Yeniden eskiye sırala
    items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    onUpdate(items);
  }, (err) => {
    console.warn('Parti dinleme uyarısı:', err);
  });
}

/**
 * Belirli bir partiye ait etiketleri getirir
 */
export async function fetchBatchTags(batchId: string): Promise<BatchTagItem[]> {
  try {
    const q = query(collection(db, TAGS_COLLECTION), where('batchId', '==', batchId));
    const snap = await getDocs(q);
    const tags: BatchTagItem[] = [];
    snap.forEach(d => tags.push(d.data() as BatchTagItem));
    return tags.sort((a, b) => a.sequenceNumber - b.sequenceNumber);
  } catch (error) {
    console.error('Parti etiketleri getirme hatası:', error);
    return [];
  }
}

/**
 * Parti Durumunu Günceller (Yaşam Döngüsü Adımları)
 */
export async function updateBatchStatus(
  batchId: string,
  newStatus: BatchStatus,
  adminEmail: string
): Promise<void> {
  const batchRef = doc(db, BATCHES_COLLECTION, batchId);
  await updateDoc(batchRef, {
    status: newStatus,
    updatedBy: adminEmail,
    updatedAt: new Date().toISOString(),
    updatedAtFirestore: serverTimestamp()
  });
}

/**
 * Partiye Özel Teknik Matbaa Veri Dökümü (CSV)
 * QR'a basılacak içerik: QR İÇERİĞİ (URL). QR'ın altına küçük yazı olarak: QR ALTI KOD.
 */
export function exportBatchTechnicalData(batch: BatchItem, tags: BatchTagItem[]): void {
  if (tags.length === 0) return;
  const headers = [
    'SIRA NO',
    'SERİ NUMARASI',
    'QR ALTI KOD',
    'QR İÇERİĞİ (URL)',
    'ÜRÜN TİPİ',
    'PARTİ KODU',
    'MATBAA NOTU',
    'DURUM'
  ];
  const rows = tags.map(t => [
    t.sequenceNumber,
    t.tagId,
    formatCode(t.code),
    tagUrl(t.code),
    batch.productName,
    batch.id,
    batch.notes,
    batch.status
  ]);
  downloadCsv(headers, rows, `Teknik_Matbaa_Baski_${batch.id}_${batch.yearMonth}.csv`);
}
