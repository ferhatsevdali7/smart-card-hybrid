// Araç kartı veri modeli (vehicles koleksiyonu)

export interface Vehicle {
  id: string;
  ownerUid: string;
  plateNumber: string;
  brandModel?: string;
  ownerName?: string;
  /** Sadece sahibine görünür. Ziyaretçiye hiçbir zaman gönderilmez. */
  contactPhone?: string;
  parkingNote?: string;
  /** Ziyaretçilerin hazır bildirim göndermesine izin ver */
  allowMessages?: boolean;
  /** Bağlı QR etiketinin kodu (yalnızca sunucu yazar) */
  tagCode?: string | null;
  /** Bağlı QR etiketinin okunaklı seri numarası (örn: HF-OQ-2610-B01-0001) */
  tagSerial?: string | null;
  unreadNotices?: number;
}

export type VehicleInput = Pick<Vehicle, 'plateNumber' | 'brandModel' | 'ownerName' | 'contactPhone' | 'parkingNote' | 'allowMessages'>;

export type NoticeType = 'blocking' | 'lights' | 'window' | 'alarm' | 'other';

export interface VehicleNotice {
  id: string;
  type: NoticeType;
  note: string;
  read: boolean;
  createdAt: Date | null;
}

export type TagStatus = 'unclaimed' | 'active' | 'disabled' | 'expired';

/** tags koleksiyonundaki etiket (sahibi ve yöneticiler okuyabilir) */
export interface TagRecord {
  code: string;
  tagId: string;
  batchId: string;
  batchNumber?: string;
  productType: 'OQ' | 'MQ' | 'KQ';
  sequenceNumber: number;
  status: TagStatus;
  assignedUserId: string | null;
  assignedUserEmail: string | null;
  assignedVehicleId: string | null;
  assignedPlate: string | null;
  activatedAt: string | null;
  disabledReason: 'lost' | 'admin' | null;
  notes?: string;
  scanCount?: number;
  createdAt: string;
}

export type ClaimResult =
  | 'OK'
  | 'NOT_OURS'
  | 'WRONG_PRODUCT'
  | 'DISABLED'
  | 'EXPIRED'
  | 'OWNED_BY_OTHER'
  | 'ALREADY_LINKED'
  | 'VEHICLE_HAS_TAG';

export type ScanStatus = 'not_found' | 'unclaimed' | 'unassigned' | 'disabled' | 'expired' | 'active';

export interface ScanResponse {
  status: ScanStatus;
  isOwner?: boolean;
  serial?: string;
  vehicle?: {
    plateMasked: string;
    brandModel: string;
    parkingNote: string;
    allowMessages: boolean;
  };
}

export const NOTICE_LABELS: Record<NoticeType, { tr: string; en: string }> = {
  blocking: { tr: 'Aracınız yolu / çıkışı kapatıyor', en: 'Your vehicle is blocking the way' },
  lights: { tr: 'Farlarınız açık kalmış', en: 'Your lights are on' },
  window: { tr: 'Camınız veya kapınız açık', en: 'A window or door is open' },
  alarm: { tr: 'Alarm çalıyor / araca temas oldu', en: 'Alarm / impact on your vehicle' },
  other: { tr: 'Diğer', en: 'Other' },
};
