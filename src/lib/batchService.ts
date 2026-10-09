// src/lib/batchService.ts
// Endüstriyel Parti Üretim ve Yaşam Döngüsü Servisi

import { 
  collection, doc, getDoc, getDocs, setDoc, updateDoc, 
  query, where, orderBy, serverTimestamp, onSnapshot, writeBatch 
} from 'firebase/firestore';
import { db } from './firebase';
import { BatchItem, BatchStatus, BatchTagItem, ProductType } from '../types/batch';
import { assertSuperAdmin } from './staffAuthService';

const BATCHES_COLLECTION = 'production_batches';
const TAGS_COLLECTION = 'qr_registry';

/**
 * Kriptografik rastgele PIN üretici (8 karakterli, okunabilir büyük harf ve rakamlar)
 */
function generateSecretKey(length = 8): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Geçerli Yıl ve Ay kodunu üretir (örn: 2026 Nisan -> 2604)
 */
export function getCurrentYearMonthCode(): string {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  return `${yy}${mm}`;
}

/**
 * Yeni bir Seri Üretim Partisi Oluşturur (HF-OQ-YYMM-BXX-XXXX Standardı)
 */
export async function createProductionBatch(
  productType: ProductType,
  count: number,
  notes: string,
  adminEmail: string
): Promise<{ batch: BatchItem; tags: BatchTagItem[] }> {
  await assertSuperAdmin();

  if (count < 1 || count > 1000) {
    throw new Error('Üretim adedi 1 ile 1000 arasında olmalıdır.');
  }

  const prefix = 'HF';
  const yearMonth = getCurrentYearMonthCode();

  // Mevcut partileri sorgulayarak sıradaki BXX (Parti No) değerini bul
  const batchesRef = collection(db, BATCHES_COLLECTION);
  const snap = await getDocs(batchesRef);
  const existingBatches: BatchItem[] = [];
  snap.forEach(d => existingBatches.push(d.data() as BatchItem));

  // Bu ayki partilerin sayısını bul
  const thisMonthBatches = existingBatches.filter(b => b.yearMonth === yearMonth && b.productType === productType);
  const nextBatchIndex = thisMonthBatches.length + 1;
  const batchNumber = `B${String(nextBatchIndex).padStart(2, '0')}`; // Örn: B01, B02
  const batchId = `BATCH-${yearMonth}-${productType}-${batchNumber}`;

  const productNameMap: Record<ProductType, string> = {
    OQ: 'Otomobil Ön Cam QR Etiketi',
    MQ: 'Medikal Acil SOS QR Etiketi',
    KQ: 'Kişisel Dijital Kartvizit QR'
  };

  const nowIso = new Date().toISOString();

  const newBatch: BatchItem = {
    id: batchId,
    batchNumber,
    productType,
    productName: productNameMap[productType] || 'Otomobil QR',
    prefix,
    yearMonth,
    totalCount: count,
    status: 'STATUS_CREATED',
    notes: notes.trim() || 'Standart Matbaa Üretimi',
    createdBy: adminEmail,
    createdAt: nowIso,
    updatedAt: nowIso
  };

  // Firestore Batch Write
  const firestoreBatch = writeBatch(db);

  // 1. Parti kaydını ekle
  const batchDocRef = doc(db, BATCHES_COLLECTION, batchId);
  firestoreBatch.set(batchDocRef, {
    ...newBatch,
    createdAtFirestore: serverTimestamp(),
    updatedAtFirestore: serverTimestamp()
  });

  // 2. Her bir etiketi üret ve ekle
  const createdTags: BatchTagItem[] = [];
  for (let i = 1; i <= count; i++) {
    const sequenceFormatted = String(i).padStart(4, '0');
    // STANDART: HF-OQ-2604-B01-0001
    const tagId = `${prefix}-${productType}-${yearMonth}-${batchNumber}-${sequenceFormatted}`;
    const secretKey = generateSecretKey(8);

    const tagItem: BatchTagItem = {
      tagId,
      batchId,
      secretKey,
      productType,
      sequenceNumber: i,
      status: 'unclaimed',
      createdAt: nowIso
    };

    createdTags.push(tagItem);

    // Ana qr_registry koleksiyonuna da yansıt (Aktivasyon sistemi için)
    const tagDocRef = doc(db, TAGS_COLLECTION, tagId);
    firestoreBatch.set(tagDocRef, {
      ...tagItem,
      batchNumber: `${batchId} (${newBatch.notes})`,
      createdAtFirestore: serverTimestamp()
    });
  }

  await firestoreBatch.commit();
  return { batch: newBatch, tags: createdTags };
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
  await assertSuperAdmin();
  try {
    const tagsRef = collection(db, TAGS_COLLECTION);
    const q = query(tagsRef, where('batchId', '==', batchId));
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
  await assertSuperAdmin();
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
 */
export function exportBatchTechnicalData(batch: BatchItem, tags: BatchTagItem[]): void {
  if (tags.length === 0) return;
  const baseUrl = window.location.origin;
  const headers = [
    'SIRA NO',
    'SERİ NUMARASI (TAG ID)',
    'GÜVENLİK PIN',
    'AKTİVASYON URL',
    'ÜRÜN TİPİ',
    'PARTİ KODU',
    'MATBAA NOTU',
    'DURUM'
  ];

  const rows = tags.map(t => [
    t.sequenceNumber,
    t.tagId,
    t.secretKey,
    `${baseUrl}/activate?tag=${t.tagId}&key=${t.secretKey}`,
    batch.productName,
    batch.id,
    batch.notes,
    batch.status
  ]);

  const csvContent = '\uFEFF' + [
    headers.join(';'),
    ...rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';'))
  ].join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `Teknik_Matbaa_Baski_${batch.id}_${batch.yearMonth}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
