// src/types/batch.ts
// Endüstriyel Parti (Batch) ve Seri Numaralandırma Tipleri

export type BatchStatus = 
  | 'STATUS_CREATED'       // Oluşturuldu (Taslak)
  | 'STATUS_IN_PRODUCTION' // Matbaada (Üretimde)
  | 'STATUS_IN_STOCK'      // Depoda (Satışa Hazır)
  | 'STATUS_ARCHIVED'      // Arşivlendi (Tamamlandı)
  | 'STATUS_REJECTED';     // Hatalı Baskı (İptal)

export type ProductType = 
  | 'OQ' // Otomobil QR / Ön Cam Park
  | 'MQ' // Medikal SOS QR
  | 'KQ'; // Kişisel / Kartvizit QR

export interface BatchItem {
  id: string; // örn: BATCH-202604-B01
  batchNumber: string; // B01, B02...
  productType: ProductType; // OQ, MQ, KQ
  productName: string; // Otomobil Ön Cam QR Etiketi
  prefix: string; // HF
  yearMonth: string; // 2604 (2026 Nisan)
  totalCount: number; // Üretilen adet (örn: 500)
  status: BatchStatus;
  notes: string; // Matbaa Notu (örn: 300 Micron UV Baskı)
  createdBy: string; // admin e-postası
  createdAt: string; // ISO Date
  updatedAt: string;
}

export interface BatchTagItem {
  tagId: string; // örn: HF-OQ-2604-B01-0001
  batchId: string; // BATCH-202604-B01
  secretKey: string; // Kripto PIN örn: 8A9F21KC
  productType: ProductType;
  sequenceNumber: number; // 1, 2, 3...
  status: 'unclaimed' | 'active' | 'disabled';
  assignedPlate?: string | null;
  assignedUserEmail?: string | null;
  assignedUserId?: string | null;
  createdAt: string;
  activatedAt?: string | null;
}
